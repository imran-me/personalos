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

const GENERIC = /^(day|days|today|tomorrow|week|weeks|month|life|stuff|things?|it|everything|work|tasks?|schedule|time|due|pending|priorities|priority)$/i;
const APP_HINT = /\b(appl|apply|scholarship|fellowship|grant|admission|chevening|fulbright|program|programme|intern|internship|job|position|award|bursary|competition|hackathon|conference|exam)\b/i;

/* ---- turn a command into a dated plan, grounded in your real data ---- */
function planFor(text) {
  const low = String(text || '').trim().toLowerCase();
  const appHint = APP_HINT.test(low);
  // day / week / "what's due" / "my priorities" → a real plan from your pending items
  const wantsWeek = /\b(my week|this week|the week|weekly plan)\b/.test(low) || (/\bweek\b/.test(low) && !appHint);
  const wantsDay = /\b(my day|today|the day|daily plan)\b/.test(low) || /\b(what'?s?\s+due|what should i|priorit|pending|to[- ]?do|due (soon|today|this)|catch up)\b/.test(low) || (/\bday\b/.test(low) && !appHint);
  if ((wantsDay || wantsWeek) && !appHint) return dayPlan(wantsWeek ? 'week' : 'day');

  // otherwise extract a real subject for a goal / application plan
  let subj = (low.match(/(?:plan|prepare|prep(?:are)?|build|organi[sz]e|set ?up|help me with|apply (?:for|to)|application (?:for|to)|work on|finish|do|study for|revise for)\s+(?:my |the |a |an |for )?([^,.;]+?)(?:\s+and\b|,|\.|$)/) || [])[1] || '';
  subj = subj.replace(/\bapplication\b/g, '').replace(/\b(today|tomorrow|this week|by \w+day)\b/g, '').replace(/\s+/g, ' ').trim();
  if (!subj || GENERIC.test(subj)) return dayPlan('day');    // no real subject → day plan

  const subject = subj.replace(/\b\w/g, (c) => c.toUpperCase());
  const weekly = /every\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|week|weekly)/.test(low) || /each week/.test(low);
  const isApplication = appHint || /\b(scholarship|fellowship|grant|award|program|admission)\b/i.test(subj);
  let steps = isApplication ? [
    { in: 1, title: `Research ${subject}: eligibility, deadline & required documents` },
    { in: 5, title: `Draft the statement / SOP for ${subject}` },
    { in: 9, title: `Line up 2 referees for ${subject} and request recommendations` },
    { in: 14, title: `Prepare & verify all documents for ${subject}` },
    { in: 20, title: `Final review and submit ${subject}` },
  ] : [
    { in: 0, title: `Break “${subject}” into the first concrete step` },
    { in: 2, title: `Do the core work on ${subject}` },
    { in: 5, title: `Review progress on ${subject} and adjust` },
    { in: 9, title: `Wrap up and check ${subject} is done` },
  ];
  if (weekly) steps.push({ in: 7, title: `Weekly check-in on ${subject}`, repeat: 'weekly' });
  return { subject, weekly, steps: steps.map((s) => ({ ...s, when: addDays(s.in) })) };
}

/* a grounded day/week plan built from your REAL pending records (titles + dates) */
function dayPlan(scope) {
  const recs = (() => { try { return (window.EonBrain && window.EonBrain.getRecords && window.EonBrain.getRecords()) || []; } catch { return []; } })();
  const now = Date.now();
  const horizon = scope === 'week' ? 14 : 45;
  const due = recs.filter((r) => r.deadlineAt && !isNaN(Date.parse(r.deadlineAt)))
    .map((r) => ({ r, days: (Date.parse(r.deadlineAt) - now) / 86400000 }))
    .filter((x) => x.days >= -3 && x.days <= horizon)
    .sort((a, b) => a.days - b.days).slice(0, 6);
  const at = (dayOff, h) => { const d = new Date(); d.setDate(d.getDate() + dayOff); d.setHours(h, 0, 0, 0); return d; };
  let steps;
  if (due.length) {
    const hrs = [9, 11, 13, 15, 17, 19];
    steps = due.map((x, i) => ({
      title: `Work on “${x.r.label}”${x.r.entity ? ` (${x.r.entity})` : ''} — due ${fmt(new Date(x.r.deadlineAt))}${x.days < 0 ? ', overdue' : x.days < 1 ? ', today' : ''}`,
      when: scope === 'week' ? at(Math.max(0, Math.min(6, Math.round(x.days) - 1)), 9) : at(0, hrs[i] || 18),
      pointTo: x.r.pointTo,
    }));
  } else {
    const layout = scope === 'week' ? [[0, 9], [1, 9], [2, 9], [4, 9]] : [[0, 9], [0, 12], [0, 15], [0, 18]];
    ['Tackle your most important task first', 'Clear quick wins & follow-ups', 'Deep-work block on the big thing', 'Review & plan what’s next']
      .forEach((title, i) => (steps = steps || []).push({ title, when: at(layout[i][0], layout[i][1]) }));
  }
  return { subject: scope === 'week' ? 'this week' : 'today', weekly: false, day: true, empty: !due.length, steps };
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
  #eon-agent .ag-plan .ag-hd{font:700 12.5px "Inter";color:#16203a;margin:8px 0 4px}
  #eon-agent .ag-hint2{font:500 11.5px "Inter";color:#9aa3b2;margin-top:3px}
  #eon-agent .ag-step{display:flex;gap:10px;align-items:center;padding:9px 0;border-top:1px solid #eef1f6}
  #eon-agent .ag-step:first-of-type{border-top:0}
  #eon-agent .ag-chk{width:17px;height:17px;flex:0 0 auto;accent-color:${A};cursor:pointer}
  #eon-agent .ag-n{width:22px;height:22px;flex:0 0 auto;border-radius:7px;background:#eef0fe;color:${A};display:grid;place-items:center;font:700 11px "JetBrains Mono"}
  #eon-agent .ag-body{flex:1;min-width:0}
  #eon-agent .ag-body label{cursor:pointer;display:inline-block}
  #eon-agent .ag-date::-webkit-calendar-picker-indicator{cursor:pointer}
  #eon-agent .ag-step b{font-size:13px;color:#16203a;font-weight:600}
  #eon-agent .ag-when{display:flex;align-items:center;gap:6px;margin-top:4px;color:#5b6678;font-size:11.5px}
  #eon-agent .ag-when i{font-size:12px;color:#9aa3b2}
  #eon-agent .ag-date{border:1px solid #e7eaf1;border-radius:7px;padding:2px 8px;font:600 11.5px "Inter";color:#16203a;cursor:pointer}
  #eon-agent .ag-date:focus{outline:0;border-color:${A}}
  #eon-agent .ag-act{display:flex;gap:10px;margin-top:16px}
  #eon-agent .ag-go{border:0;background:${A};color:#fff;border-radius:10px;padding:11px 18px;font:700 13px "Inter";cursor:pointer}
  #eon-agent .ag-go:hover{background:#4338ca}
  #eon-agent .ag-go:disabled{opacity:.45;cursor:default}
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
  el.querySelector('.ag-x').onclick = (e) => { e.stopPropagation(); el.classList.remove('show'); };   // direct — bubbling is blocked by the card
  el.addEventListener('click', (e) => { if (e.target === el) el.classList.remove('show'); });            // click backdrop to close
  el.querySelector('.ag').addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el.classList.contains('show')) el.classList.remove('show'); });
  return el;
}

function show(el, text) {
  const wrap = el.querySelector('.ag-plan');
  const p = planFor(text);
  const dstr = (d) => { const z = new Date(d); return new Date(z.getTime() - z.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const hd = p.day
    ? (p.empty ? `Here's a plan for <b>${esc(p.subject)}</b>:` : `Your top items for <b>${esc(p.subject)}</b> — I'll remind you about each:`)
    : `Eon's plan for <b>${esc(p.subject)}</b>${p.weekly ? ' <span style="color:#4f46e5">· weekly check-ins</span>' : ''}:`;
  wrap.innerHTML = `
    <div class="ag-hd">${hd}<div class="ag-hint2">Tick the ones you want; adjust any date. Nothing is written until you confirm.</div></div>
    ${p.steps.map((s, i) => `
      <div class="ag-step">
        <input type="checkbox" class="ag-chk" id="agchk${i}" checked>
        <span class="ag-n">${i + 1}</span>
        <div class="ag-body">
          <label for="agchk${i}"><b>${esc(s.title)}</b></label>
          <span class="ag-when"><i class="bi bi-clock"></i><input type="date" class="ag-date" value="${dstr(s.when)}" onclick="try{this.showPicker&&this.showPicker()}catch(e){}">${s.repeat ? ' · repeats ' + esc(s.repeat) : ''}</span>
        </div>
      </div>`).join('')}
    <div class="ag-act"><button class="ag-go"><i class="bi bi-check2-circle me-1"></i>Create <span class="ag-count">${p.steps.length}</span> reminder<span class="ag-plural">s</span></button><button class="ag-cancel">Not now</button></div>`;
  const chks = [...wrap.querySelectorAll('.ag-chk')];
  const goBtn = wrap.querySelector('.ag-go'), countEl = wrap.querySelector('.ag-count'), plural = wrap.querySelector('.ag-plural');
  const sync = () => { const n = chks.filter((c) => c.checked).length; countEl.textContent = n; plural.style.display = n === 1 ? 'none' : ''; goBtn.disabled = n === 0; };
  chks.forEach((c) => (c.onchange = sync)); sync();
  wrap.querySelector('.ag-cancel').onclick = () => { wrap.innerHTML = ''; };
  goBtn.onclick = async () => {
    const chosen = [...wrap.querySelectorAll('.ag-step')].map((row, i) => ({ row, s: p.steps[i] }))
      .filter((x) => x.row.querySelector('.ag-chk').checked)
      .map((x) => { const dv = x.row.querySelector('.ag-date').value; return { title: x.s.title, when: dv ? new Date(dv + 'T09:00:00') : x.s.when, link: x.s.pointTo }; });
    if (!chosen.length) return;
    goBtn.disabled = true;
    let ok = 0;
    for (const s of chosen) {
      try { const r = window.EonBrain && window.EonBrain.createReminder && window.EonBrain.createReminder({ title: s.title, remindAt: s.when.toISOString(), note: `Planned by Eon for "${p.subject}"`, link: s.link || null }); if (r && r.then) await r; ok++; } catch {}
    }
    wrap.querySelector('.ag-act').style.display = 'none';
    wrap.insertAdjacentHTML('beforeend', `<div class="ag-done"><i class="bi bi-check2-all me-1"></i>Done — ${ok} reminder${ok === 1 ? '' : 's'} created and synced. Eon will nudge you on each date.</div>`);
    try { window.EonTrace && window.EonTrace.unshift({ t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), line: `Agent: created ${ok} reminder${ok === 1 ? '' : 's'} for "${p.subject}"` }); } catch {}
    try { window.EON && window.EON.character && window.EON.character.playEmote && window.EON.character.playEmote('cheer'); } catch {}
  };
}

const EonAgent = {
  planFor,
  open(text) { const el = ensureEl(); el.classList.add('show'); const input = el.querySelector('.ag-in input'); if (text) { input.value = text; show(el, text); } else { el.querySelector('.ag-plan').innerHTML = ''; setTimeout(() => input.focus(), 50); } return el; },
};
if (typeof window !== 'undefined') window.EonAgent = Object.assign(window.EonAgent || {}, EonAgent);
export default EonAgent;
