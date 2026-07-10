/* ============================================================
   EON · intel/agent.js  —  NL → Action Agent (advisory-first)
   ------------------------------------------------------------
   Type a messy instruction ("plan my Chevening application and remind me
   every Sunday") and Eon turns it into a concrete PLAN of dated steps,
   shows it for approval, and — on one click — writes the reminders to
   your synced brain. It doesn't just answer; it does the work.

   Free-plan: fully rule-based / offline (no LLM). The LLM tool-use path
   (Claude Opus + a constrained toolset over the EON API) is the future
   upgrade — this scaffold keeps the identical advisory-first contract
   (show the plan → confirm → write) so swapping the planner in later
   changes nothing downstream. Writes go through EonBrain.createReminder
   (owner-gated, synced). Register: window.EonAgent.  API: open(text?).
   ============================================================ */

const A = '#4f46e5', G = '#0f9d58';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const fmt = (d) => d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });

/* ---- turn a command into a dated plan (rule-based) ---- */
function planFor(text) {
  const t = String(text || '').trim();
  const low = t.toLowerCase();
  // pull the subject: after "for/my/the", before "and/,"
  let subj = (low.match(/(?:plan|prepare|prep|build|organi[sz]e|set up|help me with|apply (?:for|to)|application (?:for|to))\s+(?:my |the |a |an )?([^,.;]+?)(?:\s+and\b|,|\.|$)/) || [])[1] || '';
  subj = subj.replace(/\bapplication\b/, '').replace(/\bplan\b/, '').trim();
  const subject = subj ? subj.replace(/\b\w/g, (c) => c.toUpperCase()) : 'this goal';
  const weekly = /every\s+(sunday|monday|week|weekly)/.test(low) || /each week/.test(low);

  const isApplication = /appl|scholarship|fellowship|grant|admission|chevening|fulbright|program|programme|intern|job|position/.test(low) || subj;
  let steps;
  if (isApplication) {
    steps = [
      { in: 1, title: `Research ${subject}: eligibility, deadline & required documents` },
      { in: 5, title: `Draft the statement / SOP for ${subject}` },
      { in: 9, title: `Line up 2 referees for ${subject} and request recommendations` },
      { in: 14, title: `Prepare & verify all documents for ${subject}` },
      { in: 20, title: `Final review and SUBMIT ${subject}` },
    ];
  } else {
    steps = [
      { in: 1, title: `Break "${subject}" into the first concrete step` },
      { in: 4, title: `Do the core work on ${subject}` },
      { in: 8, title: `Review progress on ${subject} and adjust` },
      { in: 12, title: `Wrap up and check ${subject} is done` },
    ];
  }
  if (weekly) steps.push({ in: 7, title: `Weekly check-in on ${subject}`, repeat: 'weekly' });
  return { subject, weekly, steps: steps.map((s) => ({ ...s, when: addDays(s.in) })) };
}

function injectStyle() {
  if (document.getElementById('eon-agent-style')) return;
  const s = document.createElement('style'); s.id = 'eon-agent-style';
  s.textContent = `
  #eon-agent{position:fixed;inset:0;z-index:2147483646;display:none;align-items:center;justify-content:center;background:rgba(12,18,34,.55);backdrop-filter:blur(4px);font:500 14px "Inter",system-ui,sans-serif}
  #eon-agent.show{display:flex}
  #eon-agent .ag{width:min(560px,94vw);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 30px 70px rgba(8,14,30,.42)}
  #eon-agent .ag-h{display:flex;align-items:center;gap:11px;padding:16px 20px;background:linear-gradient(115deg,#101a33,#26268a 60%,#4f46e5);color:#fff}
  #eon-agent .ag-h b{font:800 16px "Plus Jakarta Sans"}#eon-agent .ag-h small{display:block;opacity:.82;font-size:11.5px}
  #eon-agent .ag-x{margin-left:auto;cursor:pointer;font-size:20px;opacity:.85}
  #eon-agent .ag-b{padding:18px 20px}
  #eon-agent .ag-in{display:flex;gap:8px;margin-bottom:8px}
  #eon-agent .ag-in input{flex:1;border:1px solid #e7eaf1;border-radius:11px;padding:11px 14px;font:500 14px "Inter";outline:0}
  #eon-agent .ag-in input:focus{border-color:${A};box-shadow:0 0 0 3px rgba(79,70,229,.12)}
  #eon-agent .ag-in button{border:0;background:#111634;color:#fff;border-radius:11px;padding:0 16px;font:700 12.5px "Inter";cursor:pointer}
  #eon-agent .ag-note{font-size:11.5px;color:#9aa3b2;margin-bottom:10px}
  #eon-agent .ag-plan .ag-hd{font:700 12px "Inter";color:#16203a;margin:8px 0}
  #eon-agent .ag-step{display:flex;gap:11px;align-items:flex-start;padding:9px 0;border-top:1px solid #eef1f6}
  #eon-agent .ag-step:first-of-type{border-top:0}
  #eon-agent .ag-n{width:22px;height:22px;flex:0 0 auto;border-radius:7px;background:#eef0fe;color:${A};display:grid;place-items:center;font:700 11px "JetBrains Mono"}
  #eon-agent .ag-step b{font-size:13px;color:#16203a;font-weight:600}
  #eon-agent .ag-step small{color:#5b6678;font-size:11.5px;display:block;margin-top:2px}
  #eon-agent .ag-act{display:flex;gap:10px;margin-top:14px}
  #eon-agent .ag-go{border:0;background:${A};color:#fff;border-radius:10px;padding:11px 18px;font:700 13px "Inter";cursor:pointer}
  #eon-agent .ag-go:hover{background:#4338ca}
  #eon-agent .ag-cancel{border:1px solid #e7eaf1;background:#fff;border-radius:10px;padding:11px 16px;font:700 13px "Inter";color:#5b6678;cursor:pointer}
  #eon-agent .ag-done{margin-top:12px;padding:12px 14px;background:#e6f6ee;border-radius:11px;color:#0b6b3a;font-size:13px;font-weight:600}`;
  document.head.appendChild(s);
}
function ensureEl() {
  let el = document.getElementById('eon-agent'); if (el) return el;
  injectStyle();
  el = document.createElement('div'); el.id = 'eon-agent';
  el.innerHTML = `<div class="ag"><div class="ag-h"><span style="font-size:18px">🤖</span><div><b>Eon · Action Agent</b><small>Tell Eon what to do — it plans, you approve, it writes the reminders</small></div><span class="ag-x">✕</span></div>
    <div class="ag-b"><div class="ag-in"><input placeholder="e.g. plan my Chevening application and remind me every Sunday"><button>Plan it</button></div>
    <div class="ag-note"><i class="bi bi-shield-check"></i> Advisory-first: Eon shows the plan and never writes anything until you confirm.</div>
    <div class="ag-plan"></div></div></div>`;
  document.body.appendChild(el);
  const input = el.querySelector('.ag-in input'), btn = el.querySelector('.ag-in button');
  const go = () => { const q = input.value.trim(); if (q) show(el, q); };
  btn.onclick = go; input.onkeydown = (e) => { if (e.key === 'Enter') go(); };
  el.addEventListener('click', (e) => { if (e.target === el || e.target.classList.contains('ag-x')) el.classList.remove('show'); });
  el.querySelector('.ag').addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el.classList.contains('show')) el.classList.remove('show'); });
  return el;
}

function show(el, text) {
  const wrap = el.querySelector('.ag-plan');
  const p = planFor(text);
  wrap.innerHTML = `<div class="ag-hd">Eon's plan for <b>${esc(p.subject)}</b>${p.weekly ? ' <span style="color:#4f46e5">· weekly check-ins</span>' : ''}:</div>
    ${p.steps.map((s, i) => `<div class="ag-step"><span class="ag-n">${i + 1}</span><div><b>${esc(s.title)}</b><small>${fmt(s.when)}${s.repeat ? ' · repeats ' + s.repeat : ''}</small></div></div>`).join('')}
    <div class="ag-act"><button class="ag-go"><i class="bi bi-check2-circle me-1"></i>Create ${p.steps.length} reminders</button><button class="ag-cancel">Not now</button></div>`;
  wrap.querySelector('.ag-cancel').onclick = () => { wrap.innerHTML = ''; };
  wrap.querySelector('.ag-go').onclick = async () => {
    let ok = 0;
    for (const s of p.steps) {
      try { const r = window.EonBrain && window.EonBrain.createReminder && window.EonBrain.createReminder({ title: s.title, remindAt: s.when.toISOString(), note: `Planned by Eon for "${p.subject}"` }); if (r && r.then) { await r; } ok++; } catch {}
    }
    wrap.querySelector('.ag-act').style.display = 'none';
    wrap.insertAdjacentHTML('beforeend', `<div class="ag-done"><i class="bi bi-check2-all me-1"></i>Done — ${ok} reminder${ok === 1 ? '' : 's'} created and synced. Eon will nudge you on each date.</div>`);
    try { window.EonTrace && window.EonTrace.unshift({ t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), line: `Agent: planned "${p.subject}" → created ${ok} reminders` }); } catch {}
    try { window.EON && window.EON.character && window.EON.character.playEmote && window.EON.character.playEmote('cheer'); } catch {}
  };
}

const EonAgent = {
  planFor,
  open(text) { const el = ensureEl(); el.classList.add('show'); const input = el.querySelector('.ag-in input'); if (text) { input.value = text; show(el, text); } else { el.querySelector('.ag-plan').innerHTML = ''; setTimeout(() => input.focus(), 50); } return el; },
};
if (typeof window !== 'undefined') window.EonAgent = Object.assign(window.EonAgent || {}, EonAgent);
export default EonAgent;
