/* ============================================================
   EON · analytics/anomaly.js  —  Profit-Leak / Anomaly Detector
   ------------------------------------------------------------
   Statistical anomaly detection over financial data: unusual spend
   (z-score outliers per category), duplicate / double charges, and
   budget overruns — each surfaced as a red "leak" with the ৳ number
   and the WHY. This is the cash-flow-leak radar that turns "real-time
   data" into "real money caught".

   Data science: per-category rolling mean/σ → flag |z| > k; duplicate
   detection (same amount+payee within a short window); budget variance.

   Portable: it finds its own finance data. On the host site it uses
   window.FinanceDB if present (OppTrack's private ledger); otherwise it
   auto-detects a transactions-like entity in the discovered EonBrain
   data (an amount column + optional category/date) — so it works on an
   ERP's finance table with zero wiring. Pure client-side, offline-safe.
   Register: window.EonAnomaly.  API: scan(), detectLeaks(txns).
   ============================================================ */

const MONEY_COL = /amount|amt|price|cost|total|spend|spent|paid|payment|expense|debit|credit|value|fee|charge|salary|revenue|sales|balance/i;
const CAT_COL = /category|type|head|account|class|group|kind|dept|department|vendor|payee|merchant|supplier|name|title/i;
const DATE_COL = /date|on|at|time|day|month|when/i;

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const std = (a, m) => { if (a.length < 2) return 0; m = m == null ? mean(a) : m; return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length); };
const toNum = (v) => { if (typeof v === 'number') return v; const n = parseFloat(String(v == null ? '' : v).replace(/[,৳$€£¥\s%]/g, '')); return isNaN(n) ? null : n; };
const money = (n) => { try { return typeof window.fmtBDT === 'function' ? window.fmtBDT(n) : '৳' + Math.round(Math.abs(n)).toLocaleString(); } catch { return '৳' + Math.round(Math.abs(n)); } };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const daydiff = (a, b) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);

/* ---------- core: leaks over a normalized txn array ---------- */
/** txns: [{ amount, category, date, note, type? }] — type 'income' is ignored. */
export function detectLeaks(txns, opts = {}) {
  const k = opts.k || 2.5;
  const rows = (Array.isArray(txns) ? txns : []).map((t) => ({
    amount: Math.abs(toNum(t.amount) ?? 0),
    category: (t.category || t.head || t.account || 'Uncategorised'),
    date: t.date || t.on || t.at || '',
    note: t.note || t.payee || t.merchant || t.vendor || t.description || t.category || '',
    type: t.type || 'expense',
  })).filter((t) => t.type !== 'income' && t.amount > 0);

  const flags = [];
  // 1) per-category outliers via LEAVE-ONE-OUT z-score. (A plain in-sample
  //    z-score is bounded by (n-1)/√n, so a lone spike in a small category can
  //    never exceed ~2σ; LOO compares each point to the OTHERS, so a true
  //    outlier pops as the many-σ event it is.)
  const byCat = {}; rows.forEach((t) => (byCat[t.category] = byCat[t.category] || []).push(t));
  for (const [cat, list] of Object.entries(byCat)) {
    if (list.length < 4) continue;
    const amts = list.map((t) => t.amount);
    const total = amts.reduce((a, b) => a + b, 0);
    const sq = amts.reduce((a, b) => a + b * b, 0);
    const n = amts.length;
    list.forEach((t) => {
      const n1 = n - 1; if (n1 < 2) return;
      const m = (total - t.amount) / n1;                          // mean of the others
      const v = Math.max(0, (sq - t.amount * t.amount) / n1 - m * m);
      const s = Math.sqrt(v); if (!s) return;
      const z = (t.amount - m) / s;
      if (z >= k) { const zd = z > 20 ? '20+' : z.toFixed(1); flags.push({ kind: 'outlier', amount: t.amount, z, zLabel: zd, category: cat, date: t.date, note: t.note, why: `${zd}σ above your usual ${esc(cat)} spend (avg ${money(m)}).` }); }
    });
  }
  // 2) duplicate / double charges (same amount + payee within 4 days)
  const seen = new Map();
  [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((t) => {
    const key = `${t.amount}|${String(t.note).toLowerCase().slice(0, 16)}`;
    const prev = seen.get(key);
    if (prev && t.date && prev.date && daydiff(t.date, prev.date) <= 4) flags.push({ kind: 'duplicate', amount: t.amount, category: t.category, date: t.date, note: t.note, why: `Possible duplicate of a ${money(t.amount)} “${esc(t.note)}” charge ${Math.round(daydiff(t.date, prev.date))}d earlier.` });
    seen.set(key, t);
  });
  // 3) budget overrun (this month vs a supplied monthly budget)
  let overrun = null;
  if (opts.monthlyBudget > 0) {
    const mk = new Date().toISOString().slice(0, 7);
    const spend = rows.filter((t) => String(t.date).slice(0, 7) === mk).reduce((s, t) => s + t.amount, 0);
    if (spend > opts.monthlyBudget) overrun = { over: spend - opts.monthlyBudget, budget: opts.monthlyBudget, spend };
  }
  flags.sort((a, b) => b.amount - a.amount);
  const recovered = flags.filter((f) => f.kind === 'duplicate').reduce((s, f) => s + f.amount, 0) + (overrun ? overrun.over : 0);
  return { flags, overrun, count: flags.length + (overrun ? 1 : 0), recovered, txCount: rows.length, hasData: rows.length > 0 };
}

/* ---------- gather transactions from whatever the host exposes ---------- */
function fromFinanceDB() {
  try {
    const F = window.FinanceDB; if (!F) return null;
    if (!F.data && F.loadLocal) F.loadLocal();
    const tx = F.all ? F.all() : (F.data && F.data.tx) || [];
    if (!tx || !tx.length) return null;
    const monthlyBudget = (F.data && Number(F.data.monthlyBudget)) || 0;
    return { txns: tx, monthlyBudget };
  } catch { return null; }
}
function fromBrain() {
  try {
    const b = window.EonBrain; if (!b || !b.getData) return null;
    const data = b.getData() || {}, ents = (b.getEntities && b.getEntities()) || {};
    let best = null;
    for (const [key, arr] of Object.entries(data)) {
      if (!Array.isArray(arr) || arr.length < 4) continue;
      const fields = (ents[key] && ents[key].fields) || Object.keys(arr[0] || {});
      const amtField = fields.find((f) => MONEY_COL.test(f) && arr.some((r) => toNum(r && r[f]) != null));
      if (!amtField) continue;
      const catField = fields.find((f) => f !== amtField && CAT_COL.test(f)) || null;
      const dateField = (ents[key] && ents[key].deadlineField) || fields.find((f) => DATE_COL.test(f)) || null;
      const withAmt = arr.filter((r) => toNum(r && r[amtField]) != null).length;
      if (!best || withAmt > best.withAmt) best = { key, arr, amtField, catField, dateField, withAmt };
    }
    if (!best) return null;
    const txns = best.arr.map((r) => ({ amount: toNum(r[best.amtField]), category: best.catField ? r[best.catField] : best.key, date: best.dateField ? r[best.dateField] : '', note: best.catField ? r[best.catField] : '' }));
    return { txns, monthlyBudget: 0, entity: best.key };
  } catch { return null; }
}

const EonAnomaly = {
  detectLeaks,
  /** find finance data + run the detector. Returns the leak report (portable). */
  scan(opts = {}) {
    const src = fromFinanceDB() || fromBrain();
    if (!src) return { flags: [], overrun: null, count: 0, recovered: 0, txCount: 0, hasData: false, source: null };
    const rep = detectLeaks(src.txns, { monthlyBudget: src.monthlyBudget, ...opts });
    rep.source = src.entity || 'finance';
    return rep;
  },
};
if (typeof window !== 'undefined') window.EonAnomaly = Object.assign(window.EonAnomaly || {}, EonAnomaly);
export default EonAnomaly;
