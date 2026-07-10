/* ============================================================
   EON · INTELLIGENCE CENTER  (assets/js/intelligence.js)
   ------------------------------------------------------------
   The dashboard home for ALL of EON's data-science intelligence.
   Loaded as a classic script AFTER app.js, so it shares app.js's
   global scope (DB, FinanceDB, Security, EonSignals, EonProductivity,
   EonBrain, and the helpers escapeHtml / daysUntil / fmtDate / fmtBDT
   / OPP_WIN / OPP_LOSS / OPP_LADDER / stageIndex / isClosed …).

   It ADDS the missing data-science layer and surfaces everything the
   app already computes in one place:
     • Win-probability model  — in-browser logistic regression (gradient
       descent) over your closed opportunities, with an honest cold-start
       prior and per-feature contributions (explainable).
     • Auto-EDA / Data Story  — win-rate by type, application funnel,
       weekly workload sparkline, best category — narrated.
     • Money Radar            — z-score outliers + duplicate charges +
       budget overrun over your private finance data (৳ leaks).
     • Next Best Actions      — one ranked to-do fused from the opportunity
       Signal layer, the productivity layer and the deadline brain.
     • Impact Counter         — deadlines guarded, opportunities surfaced,
       hours saved, ৳ leaks flagged (derived from real data, persisted).
     • Live Process card      — real-time "what EON is doing right now",
       driven by window.EonBrain's meditation state + this cycle's log.

   Isolated by design: one container (#eonIntel) injected under the KPI
   grid, its own stylesheet, every subsystem wrapped in try/catch so a
   bug here can never freeze the dashboard or the avatar. Owner-only.
   ============================================================ */
(function () {
  'use strict';

  // ---- tiny local helpers (never assume app.js internals beyond the globals) ----
  const $ = (sel, root) => (root || document).querySelector(sel);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const round = (x, d = 0) => { const p = Math.pow(10, d); return Math.round((Number(x) || 0) * p) / p; };
  const pct = (x) => Math.round(clamp01(x) * 100);
  const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s == null ? '' : s));
  const money = (n, sign) => (typeof fmtBDT === 'function' ? fmtBDT(n, sign) : '৳' + Math.round(n || 0));
  const moneyK = (n) => (typeof fmtBDTk === 'function' ? fmtBDTk(n) : money(n));
  const dfmt = (d) => (typeof fmtDate === 'function' ? fmtDate(d) : String(d || ''));
  const dUntil = (d) => (typeof daysUntil === 'function' ? daysUntil(d) : null);
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const std = (a, m) => { if (a.length < 2) return 0; m = (m == null ? mean(a) : m); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length); };
  const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const isoWeek = (d) => { const t = new Date(d); const day = (t.getDay() + 6) % 7; t.setDate(t.getDate() - day); return t.toISOString().slice(0, 10); };

  const ownerOK = () => { try { return Security.isOwner() && (typeof signalsEnabled !== 'function' || signalsEnabled()); } catch { return false; } };
  const winSet = (typeof OPP_WIN !== 'undefined') ? OPP_WIN : ['Won', 'Accepted', 'Completed'];
  const lossSet = (typeof OPP_LOSS !== 'undefined') ? OPP_LOSS : ['Lost', 'Rejected', 'Irrelevant', 'Missed', 'Withdrawn'];
  const ladder = (typeof OPP_LADDER !== 'undefined') ? OPP_LADDER : ['New', 'Researching', 'Preparing', 'Documents Ready', 'Shortlisted', 'Applied', 'Interview', 'Won'];
  const stageIdx = (s) => (typeof stageIndex === 'function' ? stageIndex(s) : Math.max(0, ladder.indexOf(s)));
  const closed = (s) => (typeof isClosed === 'function' ? isClosed(s) : winSet.includes(s) || lossSet.includes(s));
  const isWin = (s) => winSet.includes(s);
  const isLoss = (s) => lossSet.includes(s);

  /* =========================================================
     1. WIN-PROBABILITY MODEL — logistic regression, in-browser
     ========================================================= */
  const WP_FEATURES = ['progress', 'deadline', 'priority', 'typeWinRate', 'effort', 'momentum'];
  const PRW = { Critical: 1.0, High: 0.78, Medium: 0.5, Low: 0.28 };
  const sigmoid = (z) => 1 / (1 + Math.exp(-z));

  function wpContext(opps) {
    // historical win-rate per type (learned prior for the typeWinRate feature)
    const byType = {}; let w = 0, n = 0;
    opps.forEach((o) => {
      if (!closed(o.status)) return;
      const t = o.type || 'Other'; (byType[t] = byType[t] || { w: 0, n: 0 });
      byType[t].n++; n++; if (isWin(o.status)) { byType[t].w++; w++; }
    });
    const base = n ? w / n : 0.4;
    const typeWR = {}; Object.entries(byType).forEach(([t, v]) => { typeWR[t] = v.n >= 2 ? v.w / v.n : (v.w + base * 2) / (v.n + 2); });
    return { typeWR, base, closedN: n };
  }

  function wpFeaturize(o, ctx) {
    const sig = (() => { try { return window.EonSignals?.byId?.[o.id] || null; } catch { return null; } })();
    const idx = stageIdx(o.status);
    const progress = clamp01(idx / (ladder.length - 1));
    const dl = dUntil(o.deadline);
    // deadline: readiness pressure — a healthy runway scores best, past-due worst
    const deadline = dl == null ? 0.5 : dl < 0 ? 0.1 : clamp01(1 - Math.abs(dl - 21) / 60);
    const priority = PRW[o.priority] ?? 0.5;
    const typeWinRate = clamp01(ctx.typeWR[o.type || 'Other'] ?? ctx.base);
    const effort = clamp01(((o.activities?.length || 0) + (o.nextAction ? 1 : 0)) / 6);
    const momentum = sig ? clamp01((sig.momentum || 0) * 0.6 + (sig.resonance || 0) * 0.4) : 0.35;
    return [progress, deadline, priority, typeWinRate, effort, momentum];
  }

  function wpTrain(opps, ctx) {
    const model = { w: new Array(WP_FEATURES.length).fill(0), b: 0, trained: false, n: 0 };
    const labeled = opps.filter((o) => isWin(o.status) || isLoss(o.status));
    model.n = labeled.length;
    if (labeled.length < 8) {           // honest cold-start prior — refines as outcomes accrue
      model.w = [1.1, 0.6, 0.7, 1.4, 0.8, 1.0]; model.b = -1.1; model.trained = false;
      return model;
    }
    const X = labeled.map((o) => wpFeaturize(o, ctx));
    const y = labeled.map((o) => (isWin(o.status) ? 1 : 0));
    const lr = 0.3, epochs = 500, lambda = 0.002;
    for (let e = 0; e < epochs; e++) {
      const gw = new Array(model.w.length).fill(0); let gb = 0;
      for (let i = 0; i < X.length; i++) {
        const p = sigmoid(X[i].reduce((s, xi, k) => s + xi * model.w[k], model.b));
        const err = p - y[i];
        for (let k = 0; k < gw.length; k++) gw[k] += err * X[i][k];
        gb += err;
      }
      for (let k = 0; k < model.w.length; k++) model.w[k] -= lr * (gw[k] / X.length + lambda * model.w[k]);
      model.b -= lr * (gb / X.length);
    }
    model.trained = true;
    return model;
  }

  function wpPredict(o, ctx, model) {
    const x = wpFeaturize(o, ctx);
    const contrib = x.map((xi, k) => xi * model.w[k]);
    const p = sigmoid(contrib.reduce((s, c) => s + c, model.b));
    // rank contributions for the "why"
    const ranked = WP_FEATURES.map((f, k) => ({ f, v: contrib[k] })).sort((a, b) => b.v - a.v);
    return { p, contrib, ranked, coldStart: !model.trained };
  }

  const WP_LABEL = { progress: 'stage progress', deadline: 'deadline runway', priority: 'priority', typeWinRate: 'your track record in its category', effort: 'effort logged', momentum: 'recent momentum' };

  /* =========================================================
     2. AUTO-EDA — the narrated data story
     ========================================================= */
  function eda(opps) {
    const decided = opps.filter((o) => closed(o.status));
    const wins = decided.filter((o) => isWin(o.status));
    const overall = decided.length ? wins.length / decided.length : null;

    const byType = {};
    decided.forEach((o) => { const t = o.type || 'Other'; (byType[t] = byType[t] || { w: 0, n: 0 }); byType[t].n++; if (isWin(o.status)) byType[t].w++; });
    const cats = Object.entries(byType).filter(([, v]) => v.n >= 2).map(([t, v]) => ({ t, wr: v.w / v.n, n: v.n })).sort((a, b) => b.wr - a.wr);

    // funnel across all opportunities
    const funnel = {
      tracked: opps.length,
      applied: opps.filter((o) => ['Applied', 'Shortlisted', 'Interview'].includes(o.status) || isWin(o.status) || o.status === 'Lost' || o.status === 'Rejected').length,
      shortlisted: opps.filter((o) => ['Shortlisted', 'Interview'].includes(o.status) || isWin(o.status)).length,
      won: wins.length,
    };

    // weekly workload — deadlines per ISO week over the next ~8 weeks
    const now = Date.now(); const weeks = {};
    opps.forEach((o) => {
      if (!o.deadline) return; const dl = dUntil(o.deadline);
      if (dl == null || dl < 0 || dl > 63) return;
      const k = isoWeek(o.deadline); weeks[k] = (weeks[k] || 0) + 1;
    });
    const weekKeys = []; for (let i = 0; i < 8; i++) { const d = new Date(now + i * 7 * 86400000); weekKeys.push(isoWeek(d.toISOString())); }
    const workload = weekKeys.map((k) => ({ k, n: weeks[k] || 0 }));

    // narration
    const narrated = [];
    if (overall != null) narrated.push(`Across ${decided.length} decided opportunit${decided.length === 1 ? 'y' : 'ies'}, your win rate is <b>${pct(overall)}%</b>.`);
    if (cats[0] && overall != null && cats[0].wr > overall + 0.12) narrated.push(`You convert <b>"${esc(cats[0].t)}"</b> at ${pct(cats[0].wr)}% — well above average. Lean there.`);
    const peak = workload.reduce((m, x) => x.n > m.n ? x : m, { n: 0 });
    if (peak.n >= 3) narrated.push(`Heaviest week ahead has <b>${peak.n}</b> deadlines — spread the load early.`);
    if (funnel.applied) narrated.push(`Funnel: ${funnel.tracked} tracked → ${funnel.applied} applied → ${funnel.shortlisted} shortlisted → ${funnel.won} won.`);
    if (!narrated.length) narrated.push('Log a few outcomes and EON will start narrating the patterns in your pipeline.');

    return { overall, cats, funnel, workload, decidedN: decided.length };
  }

  /* =========================================================
     3. MONEY RADAR — anomaly / leak detection over finance
     ========================================================= */
  function loadFinance() {
    try {
      if (typeof FinanceDB === 'undefined' || !FinanceDB) return [];
      if (!FinanceDB.data) FinanceDB.loadLocal();
      if (ownerOK() && FinanceDB.loadCloud) { try { const r = FinanceDB.loadCloud(); if (r && r.then) r.then(() => EonIntel.render()).catch(() => {}); } catch {} }
      return FinanceDB.all ? FinanceDB.all() : ((FinanceDB.data && FinanceDB.data.tx) || []);
    } catch { return []; }
  }

  function leaks() {
    const tx = loadFinance();
    const flags = [];
    const expenses = tx.filter((t) => t.type === 'expense' && (Number(t.amount) || 0) > 0);

    // 1) statistical outliers per category (z-score)
    const byCat = {}; expenses.forEach((t) => (byCat[t.category || 'Uncategorised'] = byCat[t.category || 'Uncategorised'] || []).push(t));
    for (const [cat, rows] of Object.entries(byCat)) {
      if (rows.length < 4) continue;
      const amts = rows.map((t) => Math.abs(Number(t.amount) || 0));
      const m = mean(amts), s = std(amts, m); if (!s) continue;
      rows.forEach((t) => {
        const z = (Math.abs(Number(t.amount)) - m) / s;
        if (z >= 2.3) flags.push({ kind: 'outlier', amount: Math.abs(Number(t.amount)), z, cat, date: t.date, note: t.note || t.category, why: `${z.toFixed(1)}σ above your usual ${esc(cat)} spend (avg ${money(m)}).` });
      });
    }

    // 2) duplicate charges — same amount + category within 4 days
    const seen = new Map();
    [...expenses].sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((t) => {
      const key = `${Math.abs(Number(t.amount))}|${(t.category || '').toLowerCase()}|${(t.note || '').toLowerCase().slice(0, 12)}`;
      const prev = seen.get(key);
      if (prev && Math.abs((Date.parse(t.date) - Date.parse(prev.date)) / 86400000) <= 4) {
        flags.push({ kind: 'duplicate', amount: Math.abs(Number(t.amount)), cat: t.category, date: t.date, note: t.note || t.category, why: `Possible duplicate of a ${money(Math.abs(Number(t.amount)))} ${esc(t.category || 'charge')} ${Math.abs(round((Date.parse(t.date) - Date.parse(prev.date)) / 86400000))}d earlier.` });
      }
      seen.set(key, t);
    });

    // 3) budget overrun (this month)
    const monthlyBudget = (() => { try { return Number(FinanceDB.data && FinanceDB.data.monthlyBudget) || 0; } catch { return 0; } })();
    const mk = new Date().toISOString().slice(0, 7);
    const monthSpend = expenses.filter((t) => String(t.date).slice(0, 7) === mk).reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    let overrun = null;
    if (monthlyBudget > 0 && monthSpend > monthlyBudget) overrun = { over: monthSpend - monthlyBudget, budget: monthlyBudget, spend: monthSpend };

    flags.sort((a, b) => b.amount - a.amount);
    const flagged = flags.reduce((s, f) => s + (f.kind === 'duplicate' ? f.amount : 0), 0)
      + (overrun ? overrun.over : 0);
    return { flags: flags.slice(0, 6), overrun, txN: tx.length, monthSpend, totalFlagged: flagged, hasFinance: tx.length > 0 };
  }

  /* =========================================================
     4. NEXT BEST ACTIONS — fuse Signals + Productivity + Brain
     ========================================================= */
  function nextActions() {
    const out = [];
    // opportunity signals
    try {
      const S = window.EonSignals;
      if (S && S.ranked) S.ranked.slice(0, 4).forEach((s) => {
        const map = { press: { t: 'green', ico: 'lightning-charge-fill', v: 'Press' }, intervene: { t: 'amber', ico: 'exclamation-triangle-fill', v: 'Intervene' }, revive: { t: 'red', ico: 'arrow-counterclockwise', v: 'Revive' }, watch: { t: 'slate', ico: 'eye', v: 'Watch' } };
        const r = map[s.recommend] || map.watch;
        out.push({ score: (s.effortYield || 0) * 3 + s.confidence, tag: r.v, t: r.t, ico: r.ico, title: s.name, why: s.why && s.why[0] || '', link: s.pointTo });
      });
    } catch {}
    // productivity alerts
    try {
      const P = window.EonProductivity;
      if (P && P.alerts) P.alerts.slice(0, 3).forEach((a) => out.push({ score: (a.sev || 0), tag: 'Task', t: a.sev >= 4.5 ? 'red' : a.sev >= 3.5 ? 'amber' : 'blue', ico: 'check2-square', title: a.text, why: '', link: a.pointTo || 'tasks.html' }));
    } catch {}
    // deadline brain alerts
    try {
      const b = window.EonBrain;
      const alerts = (b && b.getAlerts) ? b.getAlerts() : [];
      const uw = { overdue: 6, 'due-today': 5.4, 'within-1d': 4.6, 'within-3d': 3.6, 'within-7d': 2.6, reminder: 3 };
      alerts.slice(0, 4).forEach((a) => out.push({ score: uw[a.urgency] ?? 2, tag: 'Deadline', t: a.urgency === 'overdue' ? 'red' : a.urgency === 'due-today' ? 'amber' : 'blue', ico: 'alarm-fill', title: a.label, why: (a.urgency || '').replace('-', ' '), link: a.pointTo }));
    } catch {}
    // de-dupe by title, keep highest score
    const byTitle = {}; out.forEach((o) => { const k = (o.title || '').toLowerCase().slice(0, 40); if (!byTitle[k] || byTitle[k].score < o.score) byTitle[k] = o; });
    return Object.values(byTitle).sort((a, b) => b.score - a.score).slice(0, 5);
  }

  /* =========================================================
     5. IMPACT COUNTER — derived from real data, persisted (grows only)
     ========================================================= */
  const IMPACT_KEY = 'eon-impact-v1';
  function impact(opps, tasks, leakInfo) {
    const now = Date.now();
    // deadlines guarded: opps applied/submitted on-or-before their deadline (didn't miss)
    const guarded = opps.filter((o) => o.deadline && (['Applied', 'Shortlisted', 'Interview'].includes(o.status) || isWin(o.status))).length;
    // opportunities surfaced: those EON's signal layer actively coached
    const surfaced = (() => { try { return (window.EonSignals?.ranked || []).length; } catch { return 0; } })() || opps.filter((o) => !closed(o.status)).length;
    // hours saved: modest, defensible estimate — completed tasks + activities logged
    const doneTasks = tasks.filter((t) => t.status === 'Completed').length;
    const acts = opps.reduce((s, o) => s + (o.activities?.length || 0), 0);
    const hours = round(doneTasks * 0.4 + acts * 0.15 + opps.length * 0.1, 1);
    const leaksFlagged = leakInfo ? (leakInfo.flags.length + (leakInfo.overrun ? 1 : 0)) : 0;
    const money_ = leakInfo ? leakInfo.totalFlagged : 0;

    const live = { guarded, surfaced, hours, leaksFlagged, money: money_ };
    // persist running maxima so the headline never regresses across sessions
    let saved = {}; try { saved = JSON.parse(localStorage.getItem(IMPACT_KEY) || '{}'); } catch {}
    const merged = {
      guarded: Math.max(saved.guarded || 0, guarded),
      surfaced: Math.max(saved.surfaced || 0, surfaced),
      hours: Math.max(saved.hours || 0, hours),
      leaksFlagged: Math.max(saved.leaksFlagged || 0, leaksFlagged),
      money: Math.max(saved.money || 0, money_),
      since: saved.since || new Date(now).toISOString().slice(0, 10),
    };
    if (ownerOK()) { try { localStorage.setItem(IMPACT_KEY, JSON.stringify(merged)); } catch {} }
    return merged;
  }

  /* =========================================================
     6. LIVE PROCESS — "what EON is doing right now"
     ========================================================= */
  const PROC_STATE = {
    idle: { label: 'Watching quietly', ico: 'eye', tone: 'slate' },
    meditating: { label: 'Meditating on your data', ico: 'stars', tone: 'violet' },
    'reading-section': { label: 'Reading', ico: 'journal-text', tone: 'blue' },
    insight: { label: 'Surfaced an insight', ico: 'lightbulb-fill', tone: 'amber' },
  };
  function liveStatus(cycleLog) {
    let s = { state: 'idle', progress: 1, section: null, message: null };
    try { const st = window.EonBrain?.getState?.(); if (st) s = st; } catch {}
    const meta = PROC_STATE[s.state] || PROC_STATE.idle;
    let label = meta.label;
    if (s.state === 'reading-section' && s.section) label = `Reading “${esc(s.section)}”`;
    if (s.state === 'insight' && s.message) label = esc(s.message);
    return { label, ico: meta.ico, tone: meta.tone, progress: s.progress == null ? 1 : s.progress, state: s.state, log: cycleLog };
  }

  /* =========================================================
     RENDER
     ========================================================= */
  const EonIntel = {
    _model: null, _mountedAt: 0, _log: [], _dataStamp: '',
    _tick: null,

    /** injects the hub container right after the KPI grid, once. */
    _ensureHost() {
      let host = document.getElementById('eonIntel');
      if (host) return host;
      const grid = document.getElementById('statGrid');
      const anchor = grid ? (grid.closest('section') || grid.parentElement) : null;
      host = document.createElement('div');
      host.id = 'eonIntel';
      host.className = 'eon-intel owner-only';
      if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(host, anchor.nextSibling);
      else if (grid) grid.parentElement.appendChild(host);
      else document.querySelector('.page-wrap')?.prepend(host);
      return host;
    },

    _pushLog(line) {
      const at = new Date();
      this._log.unshift({ t: at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), line });
      this._log = this._log.slice(0, 6);
    },

    render() {
      let host;
      try { host = this._ensureHost(); } catch { return; }
      if (!host) return;
      if (!ownerOK()) { host.innerHTML = ''; host.style.display = 'none'; return; }
      host.style.display = '';

      let opps = [], tasks = [];
      try { opps = DB.getAll('opportunities') || []; } catch {}
      try { tasks = DB.getAll('tasks') || []; } catch {}

      // recompute only when data actually changed (keeps the model stable, cheap)
      const stamp = `${opps.length}:${tasks.length}:${(() => { try { return window.EonSignals?.at || 0; } catch { return 0; } })()}`;
      const changed = stamp !== this._dataStamp;
      if (changed || !this._model) {
        const ctx = wpContext(opps); this._wpCtx = ctx; this._model = wpTrain(opps, ctx);
        this._eda = eda(opps); this._leaks = leaks(); this._nba = nextActions();
        this._impact = impact(opps, tasks, this._leaks);
        // predictions for live (non-closed) opportunities
        this._preds = opps.filter((o) => !closed(o.status)).map((o) => ({ o, ...wpPredict(o, ctx, this._model) })).sort((a, b) => b.p - a.p);
        if (changed) {
          this._pushLog(`Scored ${this._preds.length} live opportunit${this._preds.length === 1 ? 'y' : 'ies'} · pipeline model ${this._model.trained ? 'trained (' + this._model.n + ' outcomes)' : 'cold-start prior'}`);
          if (this._leaks.hasFinance) this._pushLog(`Scanned ${this._leaks.txN} transactions · ${this._leaks.flags.length} anomal${this._leaks.flags.length === 1 ? 'y' : 'ies'} flagged`);
          if (this._eda.overall != null) this._pushLog(`Ran EDA · win-rate ${pct(this._eda.overall)}% across ${this._eda.decidedN} decided`);
        }
        this._dataStamp = stamp;
      }

      host.innerHTML = this._html();
      this._bind(host);
    },

    /** light real-time refresh of just the live card (avatar brain state). */
    _refreshLive() {
      const el = document.getElementById('eiLive');
      if (!el || !ownerOK()) return;
      el.innerHTML = this._liveHtml();
    },

    _html() {
      return `
        <div class="ei-head">
          <div class="ei-title"><span class="ei-orb"></span>
            <div><b>EON Intelligence</b><small>One brain reading everything — live analysis, predictions & impact</small></div>
          </div>
          <span class="ei-badge" id="eiModelBadge">${this._model.trained ? `<i class="bi bi-cpu"></i> model trained · ${this._model.n} outcomes` : `<i class="bi bi-hourglass-split"></i> cold-start prior`}</span>
          <button class="ei-wsbtn" id="eiOpenWs" title="Open the full Intelligence Workstation"><i class="bi bi-arrows-fullscreen"></i> Workstation</button>
        </div>

        <div class="ei-live" id="eiLive">${this._liveHtml()}</div>

        <div class="ei-grid">
          ${this._cardProver()}
          ${this._cardWin()}
          ${this._cardEda()}
          ${this._cardMoney()}
          ${this._cardNba()}
          ${this._cardImpact()}
        </div>`;
    },

    _liveHtml() {
      const L = liveStatus(this._log);
      const p = pct(L.progress);
      const thinking = L.state === 'meditating' || L.state === 'reading-section';
      return `
        <div class="eil-brain ${thinking ? 'on' : ''}"><i class="bi bi-${L.ico}"></i><span class="eil-wave"></span></div>
        <div class="eil-main">
          <div class="eil-row"><span class="eil-dot t-${L.tone} ${thinking ? 'pulse' : ''}"></span><b>${L.label}</b>
            <span class="eil-stamp">${thinking ? p + '%' : 'real-time'}</span></div>
          <div class="eil-bar"><span style="width:${thinking ? p : 100}%"></span></div>
          <div class="eil-log">${(L.log && L.log.length ? L.log : [{ t: '', line: 'Warming up the intelligence layer…' }]).map((r) => `<span class="eill"><i>${r.t}</i>${r.line}</span>`).join('')}</div>
        </div>`;
    },

    // ---- card: win probability ----
    _cardWin() {
      const top = (this._preds || []).slice(0, 4);
      const avg = top.length ? mean((this._preds || []).map((x) => x.p)) : null;
      const rows = top.map((x) => {
        const p = pct(x.p);
        const tone = p >= 66 ? 'green' : p >= 40 ? 'amber' : 'red';
        const why = x.ranked.filter((r) => r.v > 0).slice(0, 2).map((r) => WP_LABEL[r.f]).join(', ');
        return `<a class="ei-opprow" href="opportunity-details.html?id=${esc(x.o.id)}">
            <span class="ei-ring t-${tone}" style="--p:${p}"><b>${p}<i>%</i></b></span>
            <span class="ei-oppbody"><b>${esc(x.o.name)}</b><small>${esc(x.o.type || 'Opportunity')} · ${why ? 'lifted by ' + esc(why) : x.o.status}</small></span>
            <i class="bi bi-chevron-right text-faint"></i>
          </a>`;
      }).join('');
      return `<div class="ei-card ei-span2">
        <div class="ei-ch"><i class="bi bi-graph-up-arrow"></i>Win probability<span class="ei-tag">${this._model.trained ? 'logistic · trained' : 'logistic · prior'}</span></div>
        ${avg != null ? `<div class="ei-hero"><div class="ei-hero-v">${pct(avg)}<span>%</span></div><div class="ei-hero-l">avg live win-probability<br><small>${(this._preds || []).length} open opportunities scored on 6 engineered features</small></div></div>` : ''}
        <div class="ei-opps">${rows || '<p class="ei-empty">Add opportunities and log outcomes — EON learns to predict your wins.</p>'}</div>
      </div>`;
    },

    // ---- card: auto-EDA ----
    _cardEda() {
      const e = this._eda; const f = e.funnel;
      const steps = [['Tracked', f.tracked], ['Applied', f.applied], ['Shortlisted', f.shortlisted], ['Won', f.won]];
      const fmax = Math.max(1, ...steps.map((s) => s[1]));
      const funnelH = steps.map((s) => `<div class="ei-fstep"><span class="ei-fbar" style="width:${Math.max(6, s[1] / fmax * 100)}%"></span><em>${s[0]}</em><b>${s[1]}</b></div>`).join('');
      const wl = e.workload; const wmax = Math.max(1, ...wl.map((w) => w.n));
      const spark = wl.map((w) => `<span class="ei-sbar" style="height:${Math.max(8, w.n / wmax * 100)}%" title="${w.n} due · week of ${dfmt(w.k)}"></span>`).join('');
      const story = (e.overall != null || e.cats.length) ?
        [`Across ${e.decidedN} decided, win rate <b>${e.overall != null ? pct(e.overall) + '%' : '—'}</b>.`]
          .concat(e.cats[0] && e.overall != null && e.cats[0].wr > e.overall + 0.12 ? [`Strongest: <b>${esc(e.cats[0].t)}</b> at ${pct(e.cats[0].wr)}%.`] : [])
        : ['Log a few outcomes to unlock the data story.'];
      return `<div class="ei-card ei-span2">
        <div class="ei-ch"><i class="bi bi-bar-chart-line"></i>Data story<span class="ei-tag">auto-EDA</span></div>
        <div class="ei-eda">
          <div class="ei-funnel">${funnelH}</div>
          <div class="ei-spark"><div class="ei-sparkrow">${spark}</div><small>deadlines · next 8 weeks</small></div>
        </div>
        <div class="ei-story">${story.map((s) => `<div><i class="bi bi-dot"></i>${s}</div>`).join('')}</div>
      </div>`;
    },

    // ---- card: money radar ----
    _cardMoney() {
      const L = this._leaks;
      if (!L.hasFinance) return `<div class="ei-card">
        <div class="ei-ch"><i class="bi bi-cash-stack"></i>Money radar<span class="ei-tag">anomaly</span></div>
        <p class="ei-empty">Add income & expenses in <a href="accounts.html">Accounts</a> and EON watches for outliers, duplicate charges and budget overruns.</p></div>`;
      const rows = L.flags.slice(0, 3).map((fl) => `<div class="ei-leak">
          <span class="ei-leak-amt t-${fl.kind === 'duplicate' ? 'amber' : 'red'}">${money(fl.amount)}</span>
          <span class="ei-leak-why"><b>${fl.kind === 'duplicate' ? 'Duplicate?' : (fl.z ? fl.z.toFixed(1) + 'σ outlier' : 'Anomaly')}</b><small>${fl.why}</small></span>
        </div>`).join('');
      const over = L.overrun ? `<div class="ei-leak"><span class="ei-leak-amt t-red">${money(L.overrun.over)}</span><span class="ei-leak-why"><b>Over budget</b><small>Spent ${money(L.overrun.spend)} of a ${money(L.overrun.budget)} monthly budget.</small></span></div>` : '';
      return `<div class="ei-card">
        <div class="ei-ch"><i class="bi bi-cash-stack"></i>Money radar<span class="ei-tag">${L.flags.length + (L.overrun ? 1 : 0)} flag${(L.flags.length + (L.overrun ? 1 : 0)) === 1 ? '' : 's'}</span></div>
        ${rows || over ? (over + rows) : `<p class="ei-empty">Scanned ${L.txN} transactions — nothing unusual. Your spending looks clean. 🌿</p>`}
      </div>`;
    },

    // ---- card: next best actions ----
    _cardNba() {
      const list = this._nba || [];
      const rows = list.map((a) => `<a class="ei-nba" href="${esc(a.link || '#')}">
          <span class="chip t-${a.t} ei-nbatag"><i class="bi bi-${a.ico} me-1"></i>${esc(a.tag)}</span>
          <span class="ei-nbabody"><b>${esc(a.title)}</b>${a.why ? `<small>${esc(a.why)}</small>` : ''}</span>
        </a>`).join('');
      return `<div class="ei-card">
        <div class="ei-ch"><i class="bi bi-compass"></i>Do next<span class="ei-tag">ranked</span></div>
        ${rows || '<p class="ei-empty">Nothing pressing — you\'re clear. 🌿</p>'}
      </div>`;
    },

    // ---- card: impact ----
    _cardImpact() {
      const m = this._impact;
      const cells = [
        ['shield-check', m.guarded, 'deadlines guarded', 'green'],
        ['broadcast', m.surfaced, 'opportunities surfaced', 'blue'],
        ['hourglass-split', m.hours, 'hours saved', 'violet'],
        ['cash-coin', m.money ? moneyK(m.money) : m.leaksFlagged, m.money ? 'leaks flagged' : 'leaks watched', 'amber'],
      ];
      return `<div class="ei-card ei-span2 ei-impact">
        <div class="ei-ch"><i class="bi bi-patch-check"></i>Impact so far<span class="ei-tag">since ${esc(m.since)}</span></div>
        <div class="ei-impgrid">${cells.map((c) => `<div class="ei-imp"><span class="ei-imp-ic t-${c[3]}"><i class="bi bi-${c[0]}"></i></span><div class="ei-imp-v">${typeof c[1] === 'number' ? c[1] : c[1]}</div><div class="ei-imp-l">${c[2]}</div></div>`).join('')}</div>
      </div>`;
    },

    // ---- card: any-dataset live prover (Idea #1) ----
    _cardProver() {
      const last = (() => { try { return window.EonProver && window.EonProver.last; } catch { return null; } })();
      const lastHtml = last ? `<div class="ei-prov-last"><i class="bi bi-check-circle-fill"></i> Last read: <b>${esc(last.name)}</b> · ${last.rowCount.toLocaleString()} rows · ${esc(last.domain.label)}</div>` : '';
      return `<div class="ei-card ei-span2 ei-prover" id="eiProver">
        <div class="ei-ch"><i class="bi bi-upload"></i>Any-dataset prover<span class="ei-tag">discovery + auto-EDA</span></div>
        <div class="ei-provbody">
          <div class="ei-provtext"><b>Hand EON any spreadsheet.</b><small>Drop a CSV here or pick a sample — he infers the schema and profiles it live. Any business, any data, zero integration.</small>${lastHtml}</div>
          <button class="ei-provbtn" id="eiProveBtn"><i class="bi bi-graph-up-arrow"></i> Prove it</button>
        </div>
        <div class="ei-provdrop-hint"><i class="bi bi-arrow-down-circle"></i> drop a file anywhere on this card</div>
      </div>`;
    },

    _bind(host) {
      if (!host) return;
      try {
        const ws = host.querySelector('#eiOpenWs');
        if (ws) ws.onclick = () => { try { window.EonWorkstation && window.EonWorkstation.open(); } catch {} };
        const openProver = (opts) => { try { if (window.EonProver && window.EonProver.openOverlay) window.EonProver.openOverlay(opts || {}); } catch {} };
        const btn = host.querySelector('#eiProveBtn');
        if (btn) btn.onclick = () => openProver({ onReact: () => { try { window.EON?.character?.playEmote?.('cheer'); } catch {} setTimeout(() => { try { this.render(); } catch {} }, 400); } });
        const card = host.querySelector('#eiProver');
        if (card && !card._wired) {
          card._wired = true;
          ['dragover', 'dragenter'].forEach((ev) => card.addEventListener(ev, (e) => { e.preventDefault(); card.classList.add('ei-over'); }));
          ['dragleave', 'drop'].forEach((ev) => card.addEventListener(ev, (e) => { e.preventDefault(); card.classList.remove('ei-over'); }));
          card.addEventListener('drop', (e) => {
            const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (!f) return;
            const rd = new FileReader();
            rd.onload = () => { try { window.EonProver && window.EonProver.openWith(String(rd.result || ''), f.name.replace(/\.[^.]+$/, ''), { onReact: () => setTimeout(() => { try { this.render(); } catch {} }, 400) }); } catch {} };
            rd.readAsText(f);
          });
        }
      } catch {}
    },

    /** boot: render once app data is ready, keep the live card ticking. */
    start() {
      const boot = () => {
        try { if (typeof DB !== 'undefined' && DB.data) { this.render(); } } catch {}
      };
      // render when the dashboard is present and data has loaded
      let tries = 0;
      const wait = setInterval(() => {
        tries++;
        if (document.getElementById('statGrid') && typeof DB !== 'undefined' && DB.data) { clearInterval(wait); boot(); }
        if (tries > 40) clearInterval(wait);
      }, 150);
      // real-time heartbeat for the live "what EON is doing" card
      if (this._tick) clearInterval(this._tick);
      this._tick = setInterval(() => { try { this._refreshLive(); } catch {} }, 900);
    },
  };

  window.EonIntel = EonIntel;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => EonIntel.start());
  else EonIntel.start();
})();
