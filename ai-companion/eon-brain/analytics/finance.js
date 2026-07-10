/* ============================================================
   EON · analytics/finance.js  —  Personal-Finance Coach
   ------------------------------------------------------------
   Reads your Accounts ledger (income/expense with category,
   necessity band — Essential / Important / Discretionary /
   Avoidable — and recurring cadence) and turns it into forward-
   looking, personal advice, not just past anomalies:

     • Are you saving or bleeding money each month, and per year?
     • A per-category spend FORECAST (monthly run-rate → yearly).
     • Concrete SAVINGS opportunities: "trim Dining Out — the
       avoidable part is ~৳X/mo (৳Y/year)."
     • Specific-item advice from your notes: "skip 'Coca-Cola'
       (bought 9×) → save ~৳Z/year."
     • Recurring drains (subscriptions): annualised cost.

   Grounded in YOUR real, synced data (window.FinanceDB). Pure
   client-side. Register: window.EonFinance.  API: analyze().
   ============================================================ */

const money = (n) => { try { return typeof window.fmtBDT === 'function' ? window.fmtBDT(Math.round(n)) : '৳' + Math.round(Math.abs(n)).toLocaleString(); } catch { return '৳' + Math.round(Math.abs(n)); } };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const abs = (t) => Math.abs(Number(t.amount) || 0);
const REC_MULT = { Daily: 365, Weekly: 52, Monthly: 12, Yearly: 1 };

function loadTx() {
  try { const F = window.FinanceDB; if (!F) return { tx: [], budget: 0 }; if (!F.data && F.loadLocal) F.loadLocal();
    return { tx: (F.all ? F.all() : (F.data && F.data.tx) || []) || [], budget: (F.data && Number(F.data.monthlyBudget)) || 0 };
  } catch { return { tx: [], budget: 0 }; }
}
/* normalise a note into a merchant/item key (drop amounts, dates, filler) */
function normNote(s) {
  const t = String(s || '').toLowerCase().replace(/[0-9৳$.,/-]+/g, ' ').replace(/\b(payment|paid|for|the|a|to|at|on|of|monthly|bill)\b/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length >= 3 ? t : '';
}

export function analyze() {
  const { tx, budget } = loadTx();
  const exp = tx.filter((t) => t.type === 'expense' && abs(t) > 0);
  const inc = tx.filter((t) => t.type === 'income' && abs(t) > 0);
  if (!exp.length && !inc.length) return { hasData: false };

  // denominator for run-rates = number of distinct calendar months you logged
  // (so monthly income/expense isn't inflated by a partial-month span).
  const monthKeys = new Set(tx.map((t) => String(t.date || t.on || '').slice(0, 7)).filter((k) => /^\d{4}-\d{2}$/.test(k)));
  const months = Math.max(1, monthKeys.size);
  const sum = (a) => a.reduce((s, t) => s + abs(t), 0);
  const incomeM = sum(inc) / months, expenseM = sum(exp) / months, netM = incomeM - expenseM;
  const savingsRate = incomeM > 0 ? netM / incomeM : 0;

  // necessity split (per month)
  const byNeed = { Essential: 0, Important: 0, Discretionary: 0, Avoidable: 0 };
  exp.forEach((t) => { const k = byNeed[t.necessity] != null ? t.necessity : 'Discretionary'; byNeed[k] += abs(t); });
  const avoidY = byNeed.Avoidable / months * 12, discY = byNeed.Discretionary / months * 12;

  // per-category run-rate + its avoidable/discretionary slice
  const byCat = {};
  exp.forEach((t) => { const k = t.category || 'Other'; const c = (byCat[k] = byCat[k] || { sum: 0, n: 0, soft: 0 }); c.sum += abs(t); c.n++; if (/Discretionary|Avoidable/.test(t.necessity || '')) c.soft += abs(t); });
  const forecast = Object.entries(byCat).map(([cat, v]) => ({ cat, monthly: v.sum / months, yearly: v.sum / months * 12, softYearly: v.soft / months * 12 })).sort((a, b) => b.yearly - a.yearly);
  const savingsCats = forecast.filter((c) => c.softYearly > 0).sort((a, b) => b.softYearly - a.softYearly);

  // specific items from your NOTES only (a real merchant/item like "Coca-Cola"),
  // never a category — those are handled separately above.
  const byNote = {};
  exp.filter((t) => /Discretionary|Avoidable/.test(t.necessity || '') && normNote(t.note)).forEach((t) => { const k = normNote(t.note); const it = (byNote[k] = byNote[k] || { sum: 0, n: 0, label: String(t.note).trim() }); it.sum += abs(t); it.n++; });
  const items = Object.values(byNote).filter((x) => x.n >= 2).map((x) => ({ label: x.label, count: x.n, yearly: x.sum / months * 12 })).sort((a, b) => b.yearly - a.yearly).slice(0, 4);

  // recurring drains — EXCLUDE Essentials (you can't cut rent) and de-duplicate
  // (a monthly item logged twice is still one subscription).
  const recSeen = new Set();
  const recurring = exp.filter((t) => t.recurring && t.recurring !== 'One-time' && t.necessity !== 'Essential')
    .map((t) => ({ label: t.note || t.category, cadence: t.recurring, yearly: abs(t) * (REC_MULT[t.recurring] || 0), key: (t.note || t.category) + '|' + t.recurring + '|' + abs(t) }))
    .filter((r) => r.yearly > 0 && !recSeen.has(r.key) && recSeen.add(r.key))
    .sort((a, b) => b.yearly - a.yearly).slice(0, 4);

  // creative, specific suggestions (most impactful first)
  const tips = [];
  if (byNeed.Avoidable > 0) tips.push({ save: avoidY, text: `You've flagged <b>${money(byNeed.Avoidable / months)}/mo</b> as <b>Avoidable</b> — cutting it saves <b>${money(avoidY)}/year</b>.` });
  items.forEach((it) => tips.push({ save: it.yearly, text: `Skip “<b>${esc(it.label)}</b>” (bought ${it.count}×) and save ~<b>${money(it.yearly)}/year</b>.` }));
  savingsCats.slice(0, 3).forEach((s) => tips.push({ save: s.softYearly, text: `Trim <b>${esc(s.cat)}</b> — the wants/regret part runs ~${money(s.softYearly / 12)}/mo (<b>${money(s.softYearly)}/year</b>).` }));
  recurring.slice(0, 2).forEach((r) => tips.push({ save: r.yearly, text: `“<b>${esc(r.label)}</b>” repeats ${r.cadence.toLowerCase()} — <b>${money(r.yearly)}/year</b>. Still worth it?` }));
  tips.sort((a, b) => b.save - a.save);
  const potentialY = Math.min(avoidY + discY * 0.5, tips.reduce((s, t) => s + t.save, 0)) || avoidY;

  const overBudget = budget > 0 && expenseM > budget;
  const headline = netM >= 0
    ? `You're saving about <b>${money(netM)}/mo</b> — <b>${Math.round(savingsRate * 100)}%</b> of income. On track for <b>${money(netM * 12)}</b> this year.`
    : `You're spending <b>${money(-netM)}/mo</b> more than you earn — about <b>${money(-netM * 12)}/year</b>. Let's fix that.`;

  return {
    hasData: true, months: Math.round(months * 10) / 10, incomeM, expenseM, netM, savingsRate, overBudget, budget,
    byNeed, avoidableYearly: avoidY, discretionaryYearly: discY, potentialYearly: potentialY,
    yearly: { income: incomeM * 12, expense: expenseM * 12, net: netM * 12 },
    forecast, savingsCats, items, recurring, tips: tips.slice(0, 5), headline,
  };
}

const EonFinance = { analyze };
if (typeof window !== 'undefined') window.EonFinance = Object.assign(window.EonFinance || {}, EonFinance);
export default EonFinance;
