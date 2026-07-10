/* ============================================================
   EON · intel/boardroom.js  —  The Adversarial Board Meeting
   ------------------------------------------------------------
   Type a decision ("should I hire 2 more staff?") and four advisors —
   CFO, Skeptic, Growth and Compliance — argue it out live on screen
   (colored bubbles, ~15s), grounding every point in the founder's REAL
   data (cash, leaks, pipeline win-rate, deadlines), then converge on a
   verdict with the dissenting view kept visible.

   Multi-agent debate / society-of-mind — done fully rule-based so it
   runs offline on the free plan (no LLM). Each persona is a heuristic
   analyst over the live context. Register: window.EonBoardroom.
   API: open(decisionText?).
   ============================================================ */

const C = { cfo: '#0f9d58', skeptic: '#d6453d', growth: '#4f46e5', compliance: '#c77d0a' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => { try { return typeof window.fmtBDT === 'function' ? window.fmtBDT(n) : '৳' + Math.round(Math.abs(n)).toLocaleString(); } catch { return '৳' + Math.round(Math.abs(n)); } };
const pct = (x) => Math.round(Math.max(0, Math.min(1, x)) * 100);

/* ---------------- gather the real context ---------------- */
function context() {
  const c = { income: 0, expense: 0, net: 0, monthlyBudget: 0, leaks: 0, leakAmt: 0, winRate: null, avgWin: null, liveOpps: 0, upcoming: 0, hasFinance: false };
  try {
    const F = window.FinanceDB; if (F) { if (!F.data && F.loadLocal) F.loadLocal(); const tx = (F.all ? F.all() : (F.data && F.data.tx) || []) || [];
      c.income = tx.filter((t) => t.type === 'income').reduce((s, t) => s + Math.abs(+t.amount || 0), 0);
      c.expense = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + Math.abs(+t.amount || 0), 0);
      c.net = c.income - c.expense; c.monthlyBudget = (F.data && +F.data.monthlyBudget) || 0; c.hasFinance = tx.length > 0; }
  } catch {}
  try { const L = window.EonAnomaly && window.EonAnomaly.scan(); if (L) { c.leaks = L.count || 0; c.leakAmt = L.recovered || 0; if (L.hasData) c.hasFinance = true; } } catch {}
  try { window.EonWinPredictor && window.EonWinPredictor.refresh(); const w = window.EonWinPredictor && window.EonWinPredictor.summary(); if (w && w.ok) { c.winRate = w.base; c.avgWin = w.avg; c.liveOpps = w.live; } } catch {}
  try { const recs = (window.EonBrain && window.EonBrain.getRecords && window.EonBrain.getRecords()) || []; const now = Date.now(); c.upcoming = recs.filter((r) => r.deadlineAt && (() => { const d = (Date.parse(r.deadlineAt) - now) / 86400000; return d >= 0 && d <= 14; })()).length; } catch {}
  return c;
}
function kindOf(text) {
  const t = String(text || '').toLowerCase();
  if (/\b(hire|recruit|staff|employ|headcount)\b/.test(t)) return 'hire';
  if (/\b(buy|purchase|invest|equipment|acquire|upgrade|lease)\b/.test(t)) return 'spend';
  if (/\b(launch|expand|scale|grow|new market|open a|another branch|go global)\b/.test(t)) return 'expand';
  if (/\b(borrow|loan|debt|credit|finance it)\b/.test(t)) return 'borrow';
  if (/\b(quit|drop|cancel|shut|close|kill|discontinue)\b/.test(t)) return 'cut';
  if (/\b(raise|price|increase|discount|cut price)\b/.test(t)) return 'price';
  return 'general';
}

/* ---------------- the four advisors ---------------- */
const STANCE = { for: 1, caution: 0, against: -1 };
function advisors(decision, x) {
  const costy = ['hire', 'spend', 'expand', 'borrow'].includes(kindOf(decision));
  const out = [];

  // CFO — cash, runway, leaks
  (() => {
    const lines = []; let stance = 'caution';
    if (x.hasFinance) {
      lines.push(`Cash position: income ${money(x.income)} vs spend ${money(x.expense)} → net <b>${x.net >= 0 ? money(x.net) : '−' + money(-x.net)}</b>.`);
      if (x.leaks) lines.push(`I'm still seeing ${x.leaks} leak${x.leaks > 1 ? 's' : ''} worth ~<b>${money(x.leakAmt)}</b>. Plug that before new outflows.`);
      if (costy) stance = (x.net > 0 && !x.leaks) ? 'for' : (x.net > 0 ? 'caution' : 'against');
      else stance = x.net >= 0 ? 'for' : 'caution';
      lines.push(costy ? (stance === 'for' ? 'Affordable — the numbers support it.' : stance === 'against' ? 'Not from this cash position. Fix the bleed first.' : 'Only if it pays back inside a quarter.') : 'Financially this is defensible.');
    } else { lines.push('No finance data connected — I can only reason on unit economics in principle. Show me the cash and I sharpen this.'); }
    out.push({ key: 'cfo', name: 'CFO', role: 'Cash & runway', color: C.cfo, stance, lines });
  })();

  // Skeptic — evidence, worst case
  (() => {
    const lines = ['What is the evidence this beats your next-best use of the same money and time?'];
    if (x.winRate != null) lines.push(`Your track record converts at <b>${pct(x.winRate)}%</b>. Is this bet demonstrably better than that?`);
    lines.push(costy ? 'Assume it costs 1.5× and returns half as fast — does it still clear?' : 'What breaks if you are wrong? Name the reversible version first.');
    const stance = costy ? 'against' : 'caution';
    out.push({ key: 'skeptic', name: 'Skeptic', role: 'Risk & evidence', color: C.skeptic, stance, lines });
  })();

  // Growth — upside, momentum
  (() => {
    const lines = []; let stance = 'caution';
    if (x.liveOpps) { lines.push(`You have <b>${x.liveOpps}</b> live opportunit${x.liveOpps === 1 ? 'y' : 'ies'}${x.avgWin != null ? ` at ~${pct(x.avgWin)}% avg win` : ''} — momentum is real.`); stance = (x.avgWin != null && x.avgWin >= 0.5) ? 'for' : 'caution'; }
    else lines.push('Thin pipeline right now — a bold move only pays if it feeds the funnel.');
    lines.push(kindOf(decision) === 'cut' ? 'Cutting can free focus — but protect the channels that actually win.' : 'Fortune favors the prepared aggressor. If it compounds your edge, lean in.');
    out.push({ key: 'growth', name: 'Growth', role: 'Upside & momentum', color: C.growth, stance, lines });
  })();

  // Compliance — obligations, capacity
  (() => {
    const lines = []; let stance = 'caution';
    if (x.upcoming) { lines.push(`You have <b>${x.upcoming}</b> commitment${x.upcoming > 1 ? 's' : ''} due in the next 14 days. Don't let a new bet make you miss them.`); stance = x.upcoming >= 3 ? 'against' : 'caution'; }
    else { lines.push('Calendar is clear enough to absorb this — no imminent obligations at risk.'); stance = 'for'; }
    if (kindOf(decision) === 'hire') lines.push('If hiring: paperwork, onboarding and payroll obligations start day one — budget the overhead, not just the salary.');
    if (kindOf(decision) === 'borrow') lines.push('Debt adds a fixed obligation regardless of outcome. Model the downside repayment.');
    out.push({ key: 'compliance', name: 'Compliance', role: 'Obligations & capacity', color: C.compliance, stance, lines });
  })();

  return out;
}

function synthesize(board) {
  const score = board.reduce((s, a) => s + STANCE[a.stance], 0) / board.length;
  let verdict, tone;
  if (score >= 0.4) { verdict = 'Proceed'; tone = C.cfo; }
  else if (score <= -0.4) { verdict = 'Hold'; tone = C.skeptic; }
  else { verdict = 'Proceed with caution'; tone = C.compliance; }
  // dissent = the advisor furthest from the verdict direction
  const dir = Math.sign(score) || 1;
  const dissent = [...board].sort((a, b) => (STANCE[a.stance] * dir) - (STANCE[b.stance] * dir))[0];
  const fors = board.filter((a) => a.stance === 'for').map((a) => a.name);
  const againsts = board.filter((a) => a.stance === 'against').map((a) => a.name);
  const rationale = `${fors.length ? fors.join(' & ') + ' in favour' : 'no clear advocate'}${againsts.length ? '; ' + againsts.join(' & ') + ' opposed' : ''}.`;
  return { verdict, tone, score, dissent, rationale };
}

/* ---------------- UI ---------------- */
function injectStyle() {
  if (document.getElementById('eon-board-style')) return;
  const s = document.createElement('style'); s.id = 'eon-board-style';
  s.textContent = `
  #eon-board{position:fixed;inset:0;z-index:2147483646;display:none;align-items:center;justify-content:center;background:rgba(12,18,34,.55);backdrop-filter:blur(4px);font:500 14px/1.5 "Inter",system-ui,sans-serif}
  #eon-board.show{display:flex}
  #eon-board .bd{width:min(720px,94vw);max-height:90vh;overflow:auto;background:#f5f7fb;border-radius:18px;box-shadow:0 30px 70px rgba(8,14,30,.42)}
  #eon-board .bd-h{display:flex;align-items:center;gap:11px;padding:16px 20px;background:#111634;color:#fff;position:sticky;top:0;z-index:2}
  #eon-board .bd-h b{font:800 16px "Plus Jakarta Sans"}
  #eon-board .bd-h small{display:block;opacity:.8;font-size:11.5px}
  #eon-board .bd-x{margin-left:auto;cursor:pointer;font-size:20px;opacity:.85}
  #eon-board .bd-x:hover{opacity:1}
  #eon-board .bd-ask{display:flex;gap:8px;padding:16px 20px}
  #eon-board .bd-ask input{flex:1;border:1px solid #e7eaf1;border-radius:11px;padding:11px 14px;font:500 14px "Inter";outline:0}
  #eon-board .bd-ask input:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.12)}
  #eon-board .bd-ask button{border:0;background:#111634;color:#fff;border-radius:11px;padding:0 18px;font:700 13px "Inter";cursor:pointer}
  #eon-board .bd-chips{display:flex;flex-wrap:wrap;gap:7px;padding:0 20px 12px}
  #eon-board .bd-chip{border:1px solid #e0e3f0;background:#fff;border-radius:999px;padding:6px 12px;font:600 12px "Inter";color:#3730a3;cursor:pointer}
  #eon-board .bd-chip:hover{background:#eef0fe}
  #eon-board .bd-body{padding:4px 20px 20px}
  #eon-board .bd-q{font:700 15px "Plus Jakarta Sans";color:#111634;margin:6px 0 14px;padding:12px 15px;background:#fff;border:1px solid #e7eaf1;border-radius:12px}
  #eon-board .bd-msg{display:flex;gap:11px;margin:11px 0;opacity:0;transform:translateY(8px);transition:opacity .4s,transform .4s}
  #eon-board .bd-msg.in{opacity:1;transform:none}
  #eon-board .bd-av{width:38px;height:38px;flex:0 0 auto;border-radius:11px;display:grid;place-items:center;color:#fff;font:800 13px "Plus Jakarta Sans"}
  #eon-board .bd-bub{flex:1;background:#fff;border:1px solid #e7eaf1;border-left:3px solid var(--k);border-radius:12px;padding:11px 14px}
  #eon-board .bd-bub .nm{font:700 12.5px "Inter";color:#16203a}
  #eon-board .bd-bub .nm .rl{color:#9aa3b2;font-weight:500;margin-left:6px}
  #eon-board .bd-bub .nm .st{float:right;font:700 10px "Inter";text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;border-radius:999px}
  #eon-board .bd-bub p{margin:6px 0 0;font-size:13px;color:#374151;line-height:1.5}
  #eon-board .bd-verdict{margin-top:16px;padding:16px 18px;border-radius:14px;background:#111634;color:#fff;opacity:0;transform:translateY(8px);transition:.5s}
  #eon-board .bd-verdict.in{opacity:1;transform:none}
  #eon-board .bd-verdict .vh{display:flex;align-items:center;gap:10px}
  #eon-board .bd-verdict .vt{font:800 20px "Plus Jakarta Sans";color:var(--k)}
  #eon-board .bd-verdict small{opacity:.85;font-size:12px}
  #eon-board .bd-verdict .diss{margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.15);font-size:12.5px;opacity:.9}
  #eon-board .bd-verdict .diss b{color:#fff}`;
  document.head.appendChild(s);
}

function ensureEl() {
  let el = document.getElementById('eon-board');
  if (el) return el;
  injectStyle();
  el = document.createElement('div'); el.id = 'eon-board';
  el.innerHTML = `
    <div class="bd">
      <div class="bd-h"><span class="bd-x2" style="font-size:19px">🧑‍⚖️</span><div><b>The Board Meeting</b><small>Four advisors argue your decision — grounded in your live data</small></div><span class="bd-x" title="Close">✕</span></div>
      <div class="bd-ask"><input placeholder="Type a decision — e.g. “should I hire 2 more staff?”"><button>Convene</button></div>
      <div class="bd-chips"></div>
      <div class="bd-body"></div>
    </div>`;
  document.body.appendChild(el);
  const input = el.querySelector('.bd-ask input'), btn = el.querySelector('.bd-ask button'), chips = el.querySelector('.bd-chips');
  ['Should I hire 2 more staff?', 'Should I buy new equipment now?', 'Should I expand to a new market?', 'Should I raise my prices?'].forEach((q) => { const b = document.createElement('button'); b.className = 'bd-chip'; b.textContent = q; b.onclick = () => { input.value = q; run(el, q); }; chips.appendChild(b); });
  const go = () => { const q = input.value.trim(); if (q) run(el, q); };
  btn.onclick = go; input.onkeydown = (e) => { if (e.key === 'Enter') go(); };
  el.querySelector('.bd-x').onclick = (e) => { e.stopPropagation(); el.classList.remove('show'); };   // direct: card blocks bubbling
  el.addEventListener('click', (e) => { if (e.target === el) el.classList.remove('show'); });            // backdrop
  el.querySelector('.bd').addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el.classList.contains('show')) el.classList.remove('show'); });
  return el;
}

function run(el, decision) {
  const body = el.querySelector('.bd-body');
  try { runInner(el, body, decision); }
  catch (e) {
    // never fail silently — show what went wrong (usually a stale cached module)
    body.innerHTML = `<div style="color:#d6453d;font-size:13px;padding:10px 2px">The board hit a snag: ${esc((e && e.message) || 'unknown error')}.<br><span style="color:#5b6678">Try a hard refresh (Ctrl+Shift+R) — an older cached version of Eon may still be loaded.</span></div>`;
  }
}
function runInner(el, body, decision) {
  const x = context();
  const board = advisors(decision, x);
  const verdict = synthesize(board);
  body.innerHTML = `<div class="bd-q">“${esc(decision)}”</div>` + board.map((a) => `
    <div class="bd-msg" data-k="${a.key}">
      <span class="bd-av" style="background:${a.color}">${esc(a.name.slice(0, 2))}</span>
      <div class="bd-bub" style="--k:${a.color}">
        <div class="nm">${esc(a.name)}<span class="rl">${esc(a.role)}</span><span class="st" style="background:${a.color}1a;color:${a.color}">${a.stance === 'for' ? 'in favour' : a.stance}</span></div>
        <p>${a.lines.join(' ')}</p>
      </div>
    </div>`).join('') + `
    <div class="bd-verdict" id="bdVerdict" style="--k:${verdict.tone}">
      <div class="vh"><span class="vt">${verdict.verdict}</span><small>— Eon's synthesis · ${esc(verdict.rationale)}</small></div>
      <div class="diss"><b>Dissent kept visible:</b> ${esc(verdict.dissent.name)} (${verdict.dissent.stance}) — “${esc(verdict.dissent.lines[0].replace(/<[^>]+>/g, ''))}”</div>
    </div>`;
  // reveal sequentially (~15s feel: ~2.2s per advisor + verdict)
  const msgs = [...body.querySelectorAll('.bd-msg')];
  msgs.forEach((mnode, i) => setTimeout(() => mnode.classList.add('in'), 350 + i * 2200));
  const v = body.querySelector('#bdVerdict');
  setTimeout(() => { v && v.classList.add('in'); v && v.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 350 + msgs.length * 2200 + 400);
  try { window.EonTrace && window.EonTrace.unshift({ t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), line: `Board meeting: “${decision.slice(0, 40)}” → ${verdict.verdict}` }); } catch {}
}

const EonBoardroom = {
  open(decision) { const el = ensureEl(); el.classList.add('show'); const input = el.querySelector('.bd-ask input'); if (decision) { input.value = decision; run(el, decision); } else { el.querySelector('.bd-body').innerHTML = ''; setTimeout(() => input.focus(), 50); } return el; },
  evaluate(decision) { const x = context(); const board = advisors(decision, x); return { board, verdict: synthesize(board) }; },
};
if (typeof window !== 'undefined') window.EonBoardroom = Object.assign(window.EonBoardroom || {}, EonBoardroom);
export default EonBoardroom;
