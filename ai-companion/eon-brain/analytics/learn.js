/* ============================================================
   EON · analytics/learn.js  —  Adaptive Learning Loop
   ------------------------------------------------------------
   Eon learns YOU. It tracks, per category, which nudges you act on vs
   dismiss (and bootstraps from your real engagement + win-rate), then
   tunes what it surfaces — measurably getting more useful over time. A
   Beta-Bernoulli posterior per (category) with a small exploration
   bonus (a lightweight Thompson-style bandit) upgrades the old flat
   learned-trust weight into a per-category policy.

   Online learning, persisted + synced via the eon-brain/brain store.
   Register: window.EonLearn.  API: weight(cat), noteAccept(cat),
   noteDismiss(cat), summary().
   ============================================================ */

const KEY = 'learn';
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function store() { try { return (window.EonBrain && window.EonBrain.getStore && window.EonBrain.getStore(KEY)) || {}; } catch { return {}; } }
function save(obj) { try { if (window.EonBrain && window.EonBrain.setStore && window.EonBrain.isOwner && window.EonBrain.isOwner()) window.EonBrain.setStore(KEY, obj); } catch {} }

/* engagement + outcome prior from the real pipeline data (per category/type) */
function priors() {
  const out = {};
  try {
    const b = window.EonBrain; if (!b || !b.getData) return out;
    const data = b.getData() || {}, ents = b.getEntities() || {};
    const oKey = Object.keys(ents).find((k) => /opportunit|deal|lead|application|pipeline/i.test(k) && Array.isArray(data[k]));
    if (!oKey) return out;
    const desc = ents[oKey];
    const catField = (desc.fields || []).find((f) => /type|category|kind|track|field/i.test(f)) || 'type';
    const WIN = /won|accept|approv|award|select|grant|admit|hire|success|paid|complete/i;
    const LOSS = /lost|reject|declin|fail|withdraw|miss|irrelevant|cancel/i;
    (data[oKey] || []).forEach((r) => {
      if (!r || typeof r !== 'object') return;
      const c = String(r[catField] || 'Other');
      const p = (out[c] = out[c] || { engage: 0, n: 0, win: 0, decided: 0 });
      p.n++;
      p.engage += (Array.isArray(r.activities) ? r.activities.length : 0) + (r.nextAction ? 1 : 0);
      const s = String(r.status || r.stage || '');
      if (WIN.test(s)) { p.win++; p.decided++; } else if (LOSS.test(s)) p.decided++;
    });
  } catch {}
  return out;
}

function categories() {
  const pri = priors(); const st = store().byCat || {};
  const cats = new Set([...Object.keys(pri), ...Object.keys(st)]);
  const rows = [];
  cats.forEach((c) => {
    const p = pri[c] || { engage: 0, n: 0, win: 0, decided: 0 };
    const s = st[c] || { accept: 0, dismiss: 0 };
    // Beta posterior over "worth surfacing": prior from engagement + win-rate,
    // updated by explicit accept/dismiss. Mean = (a)/(a+b).
    const engageRate = p.n ? clamp01(p.engage / (p.n * 3)) : 0.3;
    const winRate = p.decided ? p.win / p.decided : 0.4;
    const a = 1 + s.accept + engageRate * 3 + winRate * 2;
    const b = 1 + s.dismiss + (1 - engageRate) * 1.5;
    const mean = a / (a + b);
    const n = p.n + s.accept + s.dismiss;
    rows.push({ cat: c, weight: mean, n, engageRate, winRate, accept: s.accept, dismiss: s.dismiss });
  });
  return rows.sort((x, y) => y.weight - x.weight);
}

const EonLearn = {
  /** per-category surface weight (0..1) — feeds the decision brain's _score(). */
  weight(cat) {
    if (!cat) return 1;
    const row = categories().find((r) => r.cat.toLowerCase() === String(cat).toLowerCase());
    // exploration bonus for thin evidence keeps Eon from prematurely giving up on a category
    const explore = row && row.n < 4 ? 0.1 : 0;
    return row ? clamp01(row.weight + explore) : 0.6;
  },
  noteAccept(cat) { if (!cat) return; const s = store(); s.byCat = s.byCat || {}; s.byCat[cat] = s.byCat[cat] || { accept: 0, dismiss: 0 }; s.byCat[cat].accept++; save(s); },
  noteDismiss(cat) { if (!cat) return; const s = store(); s.byCat = s.byCat || {}; s.byCat[cat] = s.byCat[cat] || { accept: 0, dismiss: 0 }; s.byCat[cat].dismiss++; save(s); },
  /** what Eon has learned — top preferred + deprioritized, with a plain-English line. */
  summary() {
    const rows = categories();
    if (!rows.length) return { ok: false };
    const top = rows[0], bottom = rows[rows.length - 1];
    const line = rows.length > 1 && top.weight - bottom.weight > 0.08
      ? `Eon has learned you lean into <b>${top.cat}</b> and get less from <b>${bottom.cat}</b> — it now surfaces accordingly.`
      : `Eon is still learning your preferences — the more you act on or dismiss nudges, the sharper this gets.`;
    return { ok: true, rows, top, bottom, line };
  },
};
if (typeof window !== 'undefined') window.EonLearn = Object.assign(window.EonLearn || {}, EonLearn);
export default EonLearn;
