/* ============================================================
   EON · models/win-predictor.js  —  Win-Probability model
   ------------------------------------------------------------
   A calibrated logistic-regression classifier, trained in the
   browser by gradient descent (no library), that predicts the
   probability of SUCCESS for every live record in a pipeline —
   scholarships, hackathons, grants, sales deals, leads, invoices.

   Portable: it does NOT assume OppTrack's schema. It reads whatever
   the host exposes via window.EonBrain (discovery.js), auto-detects
   the "pipeline" entity (the one whose records carry win/loss
   outcomes), engineers features from whatever fields exist (stage
   progress, deadline runway, priority, category win-rate, effort,
   recency), trains on the decided records, and predicts the rest.
   When too few outcomes exist it uses an honest hand-tuned cold-start
   prior and says so. Every prediction exposes its per-feature
   contributions, so the "why" is always available (explainable AI).

   On sites that already compute richer signals (window.EonSignals)
   it folds momentum/resonance in. Pure client-side, offline-safe.
   Register: window.EonWinPredictor.  API: refresh(), predictAll(),
   get(id), summary().
   ============================================================ */

// NB: leading \b only — a trailing \b would fail on stemmed forms ("Rejected",
// "Missed", "Withdrawn"). Stems are chosen to avoid colliding with common
// category values (e.g. "granted" not "grant", so the "Grant" TYPE isn't matched).
const WIN_RE = /\b(won|win\b|accepted|approv|awarded|selected|granted|admitted|hired|success|paid|complete|closed[\s-]*won)/i;
const LOSS_RE = /\b(lost|reject|declin|fail|withdraw|missed|miss\b|irrelevant|cancel|expire|no[\s-]*show|closed[\s-]*lost)/i;
const PRIO_RE = /\b(critical|urgent|high|medium|normal|low)\b/i;
const PRIO_W = { critical: 1.0, urgent: 1.0, high: 0.78, medium: 0.5, normal: 0.5, low: 0.28 };

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const lc = (v) => String(v == null ? '' : v).toLowerCase();
const num = (v) => { const n = parseFloat(String(v).replace(/[,৳$€£\s%]/g, '')); return isNaN(n) ? null : n; };

const FEATURES = ['progress', 'deadline', 'priority', 'categoryWinRate', 'effort', 'momentum', 'docReadiness', 'competitiveness'];
const FLABEL = { progress: 'stage progress', deadline: 'deadline runway', priority: 'priority', categoryWinRate: 'track record in its category', effort: 'effort logged', momentum: 'recent momentum', docReadiness: 'document readiness', competitiveness: 'how winnable it is' };
// optional per-record factors (present only if the host captures them; safe defaults otherwise)
const DOCR = { 'not started': 0.1, 'in progress': 0.45, 'mostly ready': 0.75, ready: 1.0 };
const COMP = { low: 0.85, medium: 0.55, high: 0.3, 'very high': 0.15 };   // favorability: higher = easier to win

function brain() { try { return window.EonBrain || null; } catch { return null; } }
function ownerOK() { const b = brain(); try { return !!(b && b.isOwner && b.isOwner()); } catch { return false; } }

/* ---------- detect the pipeline entity + its key fields ---------- */
function detect() {
  const b = brain(); if (!b) return null;
  let data = {}, ents = {};
  try { data = b.getData() || {}; ents = b.getEntities() || {}; } catch {}
  let best = null;
  for (const [key, desc] of Object.entries(ents)) {
    const arr = Array.isArray(data[key]) ? data[key] : [];
    if (arr.length < 3) continue;
    const fields = desc.fields || Object.keys(arr[0] || {});
    // find the status field: the text field whose values most often match win/loss/stage words
    let statusField = null, statusHits = 0;
    for (const f of fields) {
      let hits = 0;
      for (const r of arr) { const v = lc(r && r[f]); if (WIN_RE.test(v) || LOSS_RE.test(v)) hits++; }
      if (hits > statusHits) { statusHits = hits; statusField = f; }
    }
    if (!statusField || statusHits < 2) continue;
    const decided = arr.filter((r) => { const v = lc(r[statusField]); return WIN_RE.test(v) || LOSS_RE.test(v); }).length;
    const score = decided;
    if (!best || score > best.score) {
      // category field: a low-cardinality text field that isn't the status/label/id
      let catField = null, catCard = 1e9;
      for (const f of fields) {
        if (f === statusField || f === desc.labelField || f === desc.idField) continue;
        const vals = arr.map((r) => r && r[f]).filter((v) => v != null && v !== '' && typeof v !== 'object');
        if (!vals.length || vals.some((v) => num(v) != null)) continue;      // skip numeric/date-ish
        const card = new Set(vals.map(lc)).size;
        if (card >= 2 && card <= Math.max(2, arr.length * 0.6) && card < catCard) { catCard = card; catField = f; }
      }
      // priority field
      let prioField = null;
      for (const f of fields) { if (arr.some((r) => PRIO_RE.test(lc(r && r[f])))) { prioField = f; break; } }
      // effort field: an array field (e.g. activities) or a numeric "count/effort/hours" field
      let effortField = null, effortIsArr = false;
      for (const f of fields) {
        if (arr.some((r) => Array.isArray(r && r[f]))) { effortField = f; effortIsArr = true; break; }
      }
      if (!effortField) for (const f of fields) { if (/effort|hours|logged|count|activit|touch/i.test(f) && arr.some((r) => num(r && r[f]) != null)) { effortField = f; break; } }
      best = { score, entity: key, desc, statusField, catField, prioField, effortField, effortIsArr, arr };
    }
  }
  return best && best.score >= 2 ? best : (best || null);
}

/* ---------- ordered stage ladder (for a progress feature) ---------- */
function buildLadder(arr, statusField) {
  // order distinct statuses by a heuristic rank so "further along" scores higher
  const rank = (s) => {
    const v = lc(s);
    if (WIN_RE.test(v)) return 100;
    if (LOSS_RE.test(v)) return -1;
    if (/interview|final|offer|shortlist|negotiat/.test(v)) return 70;
    if (/appl|submit|sent|pending|review/.test(v)) return 55;
    if (/prepar|document|draft|qualif/.test(v)) return 40;
    if (/research|new|idea|lead|open/.test(v)) return 20;
    return 30;
  };
  const distinct = [...new Set(arr.map((r) => r[statusField]).filter((v) => v != null && v !== ''))];
  const ranks = distinct.map(rank).filter((r) => r >= 0 && r < 100);
  const max = Math.max(70, ...ranks, 1);
  return { rank, max };
}

/* ---------- the model ---------- */
const EonWinPredictor = {
  _model: null, _ctx: null, _preds: null, _at: 0, _info: null,

  refresh() {
    try { this._shrink = ((window.EonBrain && window.EonBrain.getStore && window.EonBrain.getStore('winCalib')) || {}).shrink || 0; } catch { this._shrink = 0; }
    const det = detect();
    if (!det) { this._info = { ok: false, reason: 'no pipeline' }; this._preds = []; return this; }
    const { arr, statusField, catField, prioField, effortField, effortIsArr, desc, entity } = det;
    const ladder = buildLadder(arr, statusField);

    // category historical win-rate (Laplace-smoothed toward base rate)
    const decided = arr.filter((r) => WIN_RE.test(lc(r[statusField])) || LOSS_RE.test(lc(r[statusField])));
    const wins = decided.filter((r) => WIN_RE.test(lc(r[statusField])));
    const base = decided.length ? wins.length / decided.length : 0.4;
    const catWR = {};
    if (catField) {
      const g = {}; decided.forEach((r) => { const k = lc(r[catField]); (g[k] = g[k] || { w: 0, n: 0 }); g[k].n++; if (WIN_RE.test(lc(r[statusField]))) g[k].w++; });
      Object.entries(g).forEach(([k, v]) => { catWR[k] = (v.w + base * 2) / (v.n + 2); });
    }
    const maxEffort = effortField ? Math.max(1, ...arr.map((r) => effortIsArr ? (Array.isArray(r[effortField]) ? r[effortField].length : 0) : (num(r[effortField]) || 0))) : 1;
    const ctx = { statusField, catField, prioField, effortField, effortIsArr, desc, entity, ladder, catWR, base, maxEffort };
    this._ctx = ctx;

    const feat = (r) => {
      const progress = clamp01(ladder.rank(r[statusField]) / ladder.max);
      const dl = desc.deadlineField ? this._daysTo(r[desc.deadlineField]) : null;
      const deadline = dl == null ? 0.5 : dl < 0 ? 0.1 : clamp01(1 - Math.abs(dl - 21) / 60);
      const priority = prioField ? (PRIO_W[(lc(r[prioField]).match(PRIO_RE) || [])[0]] ?? 0.5) : 0.5;
      const categoryWinRate = clamp01(catField ? (catWR[lc(r[catField])] ?? base) : base);
      const effRaw = effortField ? (effortIsArr ? (Array.isArray(r[effortField]) ? r[effortField].length : 0) : (num(r[effortField]) || 0)) : 0;
      const effort = clamp01(effRaw / maxEffort);
      const momentum = this._momentum(r, desc);
      const docReadiness = DOCR[lc(r.docReadiness)] ?? clamp01(effort);        // fallback: effort as a readiness proxy
      const competitiveness = COMP[lc(r.competitiveness)] ?? 0.5;              // neutral if not captured
      return [progress, deadline, priority, categoryWinRate, effort, momentum, docReadiness, competitiveness];
    };
    ctx.feat = feat;

    // train
    const labeled = decided.map((r) => ({ x: feat(r), y: WIN_RE.test(lc(r[statusField])) ? 1 : 0 }));
    const model = { w: new Array(FEATURES.length).fill(0), b: 0, trained: false, n: labeled.length };
    if (labeled.length < 8) { model.w = [1.1, 0.6, 0.7, 1.4, 0.8, 1.0, 0.9, 0.8]; model.b = -1.35; }
    else {
      const lr = 0.3, epochs = 500, lambda = 0.002;
      for (let e = 0; e < epochs; e++) {
        const gw = new Array(model.w.length).fill(0); let gb = 0;
        for (const { x, y } of labeled) { const p = sigmoid(x.reduce((s, xi, k) => s + xi * model.w[k], model.b)); const err = p - y; for (let k = 0; k < gw.length; k++) gw[k] += err * x[k]; gb += err; }
        for (let k = 0; k < model.w.length; k++) model.w[k] -= lr * (gw[k] / labeled.length + lambda * model.w[k]);
        model.b -= lr * (gb / labeled.length);
      }
      model.trained = true;
    }
    this._model = model;

    // retrospective calibration: what the model says vs what actually happened,
    // on the decided records — the basis for the honesty / reliability curve, and
    // the auditable raw comparison (name · predicted · actual · match).
    this._calib = decided.map((r) => ({
      name: (desc.labelField && r[desc.labelField]) || r.name || r.title || `${entity} #${r[desc.idField] ?? '?'}`,
      status: r[statusField], p: this._predictRow(r, ctx, model).p, y: WIN_RE.test(lc(r[statusField])) ? 1 : 0,
    }));

    // predict the live (non-decided) records
    this._preds = arr.filter((r) => { const v = lc(r[statusField]); return !WIN_RE.test(v) && !LOSS_RE.test(v); })
      .map((r) => ({ id: r[desc.idField] ?? r.id, name: (desc.labelField && r[desc.labelField]) || r.name || r.title || `${entity} #${r[desc.idField] ?? '?'}`, raw: r, ...this._predictRow(r, ctx, model) }))
      .sort((a, b) => b.p - a.p);
    this._info = { ok: true, entity, statusField, catField, prioField, effortField, base, decided: decided.length, trained: model.trained, n: model.n };
    this._at = Date.now();
    return this;
  },

  _predictRow(r, ctx, model) {
    const x = ctx.feat(r);
    const contrib = x.map((xi, k) => xi * model.w[k]);
    let p = sigmoid(contrib.reduce((s, c) => s + c, model.b));
    // self-correction: a learned shrinkage toward the base rate, set by the
    // reflection loop (selfcorrect.js) when it catches the model over-confident.
    const shrink = this._shrink || 0;
    if (shrink) p = clamp01((ctx.base ?? 0.4) + (p - (ctx.base ?? 0.4)) * (1 - shrink));
    const ranked = FEATURES.map((f, k) => ({ f, label: FLABEL[f], v: contrib[k] })).sort((a, b) => b.v - a.v);
    return { p, contrib, ranked, coldStart: !model.trained, shrunk: shrink > 0 };
  },

  _daysTo(v) { if (v == null || v === '') return null; if (typeof v === 'object' && typeof v.seconds === 'number') v = v.seconds * 1000; const t = typeof v === 'number' ? v : Date.parse(v); return isNaN(t) ? null : Math.floor((t - Date.now()) / 86400000); },
  _momentum(r, desc) {
    try { const id = String(r[desc.idField] ?? r.id); const s = window.EonSignals && window.EonSignals.byId && window.EonSignals.byId[id]; if (s) return clamp01((s.momentum || 0) * 0.6 + (s.resonance || 0) * 0.4); } catch {}
    return 0.35;
  },

  _fresh() { if (!this._preds || Date.now() - this._at > 4000) { try { this.refresh(); } catch {} } },
  predictAll() { this._fresh(); return this._preds || []; },
  get(id) { this._fresh(); return (this._preds || []).find((p) => String(p.id) === String(id)) || null; },
  /** predict a single raw record object directly (used site-wide before refresh). */
  predictRecord(raw) { this._fresh(); if (!this._ctx || !this._model) return null; try { return { ...this._predictRow(raw, this._ctx, this._model) }; } catch { return null; } },
  summary() { this._fresh(); const ps = this._preds || []; return { ...(this._info || { ok: false }), live: ps.length, avg: ps.length ? ps.reduce((s, x) => s + x.p, 0) / ps.length : null, top: ps.slice(0, 5) }; },
  /** reliability analysis: accuracy, Brier score, and a calibration curve
      (predicted probability vs observed win-rate) over the decided records. */
  calibration() {
    this._fresh();
    const rows = this._calib || [];
    if (rows.length < 3) return { ok: false, n: rows.length };
    const nb = 10; const buckets = Array.from({ length: nb }, () => ({ sp: 0, sy: 0, n: 0 }));
    let correct = 0, brier = 0;
    rows.forEach(({ p, y }) => { const b = Math.min(nb - 1, Math.max(0, Math.floor(p * nb))); buckets[b].sp += p; buckets[b].sy += y; buckets[b].n++; if ((p >= 0.5 ? 1 : 0) === y) correct++; brier += (p - y) * (p - y); });
    const points = buckets.filter((b) => b.n > 0).map((b) => ({ pred: b.sp / b.n, actual: b.sy / b.n, n: b.n }));
    // expected calibration error (weighted |pred-actual|)
    const ece = points.reduce((s, pt) => s + (pt.n / rows.length) * Math.abs(pt.pred - pt.actual), 0);
    // the auditable raw comparison behind the score — every decided record
    const detail = rows.map((c) => ({ name: c.name, status: c.status, p: c.p, won: c.y === 1, correct: (c.p >= 0.5 ? 1 : 0) === c.y }))
      .sort((a, b) => b.p - a.p);
    return { ok: true, n: rows.length, accuracy: correct / rows.length, brier: brier / rows.length, ece, points, detail, trained: this._info ? this._info.trained : false };
  },
  FEATURES, FLABEL,
};

if (typeof window !== 'undefined') window.EonWinPredictor = Object.assign(window.EonWinPredictor || {}, EonWinPredictor);
import './win-surfacer.js';   // surfaces P(win) pills + detail banner site-wide (guarded, owner-only)
export default EonWinPredictor;
