/* ============================================================
   EON — owner/ask.js
   "Ask EON" — a lightweight question→answer over the owner's data.
   No backend / LLM: a rule-based engine that reads the brain's cached
   records (EonBrain.getRecords / ensureData) and answers the common
   things — counts, what's due / overdue / this week, totals & averages,
   list a module, find by name. Answers in his bubble + a small panel,
   and can drop results into the backpack.

   Owner-only. Examples:
     "how many opportunities?"  "what's due this week?"  "overdue"
     "total amount of invoices"  "list my tasks"  "find chevening"
   ============================================================ */

import { CompanionBrain } from './companion-brain.js';
import '../knowledge/academic.js';   // Eon's academic knowledge base (window.EonAcademic)
import '../knowledge/brain-qa.js';   // Eon's wide Q&A brain — 340+ offline answers (window.EonBrainQA)

const SYN = {
  opportunities: ['opportunit', 'opps', 'opp'],
  tasks: ['task', 'to-do', 'todo'],
  documents: ['document', 'doc', 'file'],
  contacts: ['contact', 'people', 'person'],
  achievements: ['achiev', 'award', 'certif', 'trophy'],
  projects: ['project'],
  research: ['research', 'paper', 'thesis'],
  reminders: ['reminder'],
};
const AMOUNT_HINTS = ['amount', 'value', 'price', 'cost', 'fee', 'total', 'budget', 'salary', 'paid'];
// Honest, creative fallbacks when a message isn't in the rule-based library yet.
// (A practical, data-grounded digest is always attached — see _fallback().)
const FALLBACKS = [
  "I don't have that exact one in my library yet — I'm a growing brain 🌱. But here's what I can tell you right now:",
  "That's beyond my offline playbook (a full language model is on my roadmap). Practically, though — here's where you stand:",
  "Hmm, my language side is still learning that one. What I *do* know cold is your data — right now:",
  "Not in my library yet 🙂 — I get smarter as I grow. Meanwhile, the practical picture:",
  "I can't parse that one yet, but I never come empty-handed — here's your live snapshot:",
  "New one for me — noted for my training list 📚. In the meantime, practically:",
];

export class AskEon {
  constructor(ctx) { this.ctx = ctx; this._open = false; this.cb = new CompanionBrain(() => (typeof window !== 'undefined' ? window.EonBrain : null)); }

  start() {
    this._injectStyle();
    this._buildChip();
    this._buildPanel();
    if (typeof window !== 'undefined') window.EonAsk = this;
  }

  update() {
    const show = this._owner();
    if (this._chip) this._chip.style.display = show ? 'inline-flex' : 'none';
    if (!show && this._open) this._toggle(false);
  }

  // ---------------- ask flow ----------------
  async ask(q) {
    q = String(q || '').trim(); if (!q) return;
    // planning commands → the Action Agent (checkboxes + one-click reminders),
    // so it's available from EVERY Ask Eon, not just the dashboard deck.
    if (/\b(plan|prepare|prep|build|organi[sz]e|set ?up|schedule|draft me)\b/i.test(q) && window.EonAgent && window.EonAgent.open) {
      try { window.EonAgent.open(q); this._toggle && this._toggle(false); return; } catch {}
    }
    this._echo(q);
    this._answerEl.textContent = '…thinking';
    try { this.ctx.character.playEmote('think'); } catch {}
    let res;
    try { res = await this._answer(q); } catch (e) { res = { speak: 'I tripped on that one — try rephrasing?' }; }
    this._lastItems = res.items || null;
    this._answerEl.textContent = res.detail ? `${res.speak}\n${res.detail}` : res.speak;
    const hasItems = !!(res.items && res.items.length);
    this._keepBtn.style.display = hasItems ? 'inline-block' : 'none';
    const first = hasItems ? res.items[0] : null;
    this._goBtn.style.display = (first && first.entity) ? 'inline-block' : 'none';
    if (first && first.entity) this._goBtn.textContent = `➡️ Take me to “${this._short(first.label, 22)}”`;
    try { this.ctx.character.playEmote('point'); } catch {}
    try { this.ctx.ai?.speak(res.speak.slice(0, 140), 5200); } catch {}
  }

  /** Public: answer a question and RETURN the result (for inline UIs like the deck),
      without touching the floating chip's DOM. */
  async answer(q) { try { return await this._answer(String(q || '')); } catch { return this._fallback(q); } }

  /** Never come empty-handed: honest line + a PRACTICAL, live digest — closest
      matching records for the question, next deadline, best bet, money headline. */
  _fallback(q) {
    const detail = [];
    const DONE = /done|complete|closed|won|lost|accept|reject|success|approved|paid|submitted|finished|archiv|cancel|withdraw|missed|graded/i;
    try {  // closest records by token overlap — practical even off-library
      const toks = String(q || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
      if (toks.length) {
        const recs = window.EonBrain?.getRecords?.() || [];
        const hits = recs.map((r) => ({ r, s: toks.reduce((n, t) => n + ((r.label || '').toLowerCase().includes(t) ? 1 : 0), 0) }))
          .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3);
        if (hits.length) detail.push(...hits.map((h) => `• Closest in your data: ${h.r.label}${h.r.deadlineAt ? ' — ' + this._date(h.r.deadlineAt) : ''}`));
      }
    } catch {}
    try {  // live snapshot
      const recs = window.EonBrain?.getRecords?.() || [];
      const now = Date.now();
      const open = recs.filter((r) => r.deadlineAt && !Number.isNaN(Date.parse(r.deadlineAt)) && !DONE.test(String(r.payload?.status || r.payload?.stage || '')));
      const next = open.filter((r) => Date.parse(r.deadlineAt) >= now).sort((a, b) => Date.parse(a.deadlineAt) - Date.parse(b.deadlineAt))[0];
      if (next) detail.push(`• Next deadline: ${next.label} — ${this._date(next.deadlineAt)}`);
      const od = open.filter((r) => Date.parse(r.deadlineAt) < now).length;
      if (od) detail.push(`• ${od} overdue ${od > 1 ? 'items need' : 'item needs'} attention`);
    } catch {}
    try { const w = window.EonWinPredictor?.summary?.(); if (w && w.ok && w.top && w.top[0]) detail.push(`• Best bet right now: ${w.top[0].name} (${Math.round(w.top[0].p * 100)}% win)`); } catch {}
    try { const f = window.EonFinance?.analyze?.(); if (f && f.hasData) detail.push(`• ${String(f.headline).replace(/<[^>]+>/g, '')}`); } catch {}
    if (!detail.length) detail.push('• Ask me: “what’s due?”, “what should I focus on?”, “where can I save money?”');
    return { speak: this._pick(FALLBACKS), detail };
  }

  async _answer(q) {
    const B = window.EonBrain;
    await B?.ensureData?.();
    const data = B?.getData?.() || {};
    const records = B?.getRecords?.() || [];
    const keys = Object.keys(data).filter((k) => Array.isArray(data[k]));

    const nq = q.toLowerCase().trim();
    const ex = this._extra(nq, data, records); if (ex) return ex;   // greetings/help/win/money/... (many need no data)
    if (!records.length) return { speak: this._pick([
      "I'm still reading your data — give the brain a moment (or run a meditation). Meanwhile, ask me “what can you do?” 🌱",
      "My data brain is warming up. Ask me what I can do while I finish reading your records.",
    ]) };

    const now = Date.now();
    const days = (iso) => Math.floor((Date.parse(iso) - now) / 86400000);

    if (/\bremind me\b|don'?t let me forget|set (a )?reminder/.test(nq)) return this._remind(q);
    if (/forget|forgetting|loose ?ends?|losing track|slipping|fell through|follow[- ]?up|\bstale\b|neglect/.test(nq)) {
      const le = this.cb.looseEnds();
      if (!le.length) return { speak: "You're on top of everything — nothing slipping. ✨" };
      const detail = le.map((x) => `• ${x.label} — ${x.reason}`).join('\n');
      return { speak: `${le.length} thing${le.length > 1 ? 's' : ''} you might be losing track of:`, detail, items: le };
    }
    if (/\bplan\b|what should i do|where (to|do i) start|prioriti|my day|to-?do list|organi[sz]e/.test(nq)) {
      const { items, overload } = this.cb.plan();
      if (!items.length) return { speak: "Nothing scheduled — you're clear. 🌿" };
      const detail = items.map((i, idx) => `${idx + 1}. ${i.label}${i.dueAt ? ` — ${this._date(i.dueAt)}` : ''}`).join('\n');
      const ov = overload.length ? ` Heads up: ${overload.map((o) => `${o.count} on ${this._date(o.date)}`).join(', ')}.` : '';
      return { speak: `Here's how I'd tackle it:${ov}`, detail, items };
    }
    if (/problem|issue|anomal|missing|incomplete|looks off|clean ?up|hygiene|wrong|tidy/.test(nq)) {
      const h = this.cb.hygiene();
      if (!h.length) return { speak: 'Everything looks tidy. ✨' };
      const detail = h.map((x) => `• ${x.label} — ${x.issue} (${x.entity})`).join('\n');
      return { speak: `${h.length} thing${h.length > 1 ? 's' : ''} to tidy:`, detail };
    }
    const ent = this._entityIn(nq, keys);
    const recs = ent ? records.filter((r) => r.entity === ent) : records;
    const dl = recs.filter((r) => r.deadlineAt && !Number.isNaN(Date.parse(r.deadlineAt)));

    if (/overdue|past due|missed|late\b/.test(nq)) {
      const od = dl.filter((r) => Date.parse(r.deadlineAt) < now).sort((a, b) => Date.parse(a.deadlineAt) - Date.parse(b.deadlineAt));
      return this._list(od, `${od.length} overdue${ent ? ' ' + ent : ''}`);
    }
    if (/due today|\btoday\b/.test(nq)) {
      const td = dl.filter((r) => days(r.deadlineAt) === 0);
      return this._list(td, `${td.length} due today`);
    }
    if (/tomorrow/.test(nq)) {
      const tm = dl.filter((r) => days(r.deadlineAt) === 1);
      return this._list(tm, `${tm.length} due tomorrow`);
    }
    if (/next deadline|nearest|soonest|what'?s next/.test(nq)) {
      const fut = dl.filter((r) => Date.parse(r.deadlineAt) >= now).sort((a, b) => Date.parse(a.deadlineAt) - Date.parse(b.deadlineAt));
      if (!fut.length) return { speak: 'No upcoming deadlines on the radar. 🌿' };
      const f = fut[0]; return { speak: `Next up: "${f.label}" — ${this._date(f.deadlineAt)} (${days(f.deadlineAt)} days).`, items: [f] };
    }
    if (/this week|next 7|upcoming|coming up|\bsoon\b|due\b/.test(nq)) {
      const wk = dl.filter((r) => { const d = days(r.deadlineAt); return d >= 0 && d <= 7; }).sort((a, b) => Date.parse(a.deadlineAt) - Date.parse(b.deadlineAt));
      return this._list(wk, `${wk.length} due in the next 7 days`);
    }
    if (/how many|number of|count|how much.*have/.test(nq)) {
      if (ent) return { speak: `You have ${recs.length} ${ent}.` };
      return { speak: keys.map((k) => `${data[k].length} ${k}`).join(', ') + '.' };
    }
    if (/total|sum|average|avg|how much/.test(nq)) {
      const field = this._amountField(nq, recs);
      if (field) {
        const vals = recs.map((r) => this._num(r.payload?.[field])).filter((n) => n != null);
        if (!vals.length) return { speak: `No numeric "${field}" to add up.` };
        const s = vals.reduce((a, b) => a + b, 0);
        if (/average|avg/.test(nq)) return { speak: `Average ${field}${ent ? ' of ' + ent : ''}: ${this._fmt(s / vals.length)} (over ${vals.length}).` };
        return { speak: `Total ${field}${ent ? ' of ' + ent : ''}: ${this._fmt(s)} across ${vals.length}.` };
      }
      return { speak: 'Which number should I total? Try e.g. "total amount of opportunities".' };
    }
    if (ent && /list|show|what are|give me|^my |all my/.test(nq)) {
      return this._list(recs.slice(0, 10), `${recs.length} ${ent}`);
    }
    if (/find|search|look ?up|who is|where is/.test(nq)) {
      const term = nq.replace(/.*?(find|search|look ?up|who is|where is)\s+/, '').replace(/[?.!]/g, '').trim();
      if (term.length >= 2) {
        const hits = records.filter((r) => (r.label || '').toLowerCase().includes(term));
        return this._list(hits.slice(0, 10), `${hits.length} match "${term}"`);
      }
    }
    if (ent) return this._list(recs.slice(0, 10), `${recs.length} ${ent}`);
    // creative + PRACTICAL fallback — honest line, then a live grounded digest
    return this._fallback(q);
  }

  _pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  _miniDigest() {
    try {
      const recs = window.EonBrain?.getRecords?.() || []; const now = Date.now();
      const due = recs.filter((r) => r.deadlineAt && (() => { const d = (Date.parse(r.deadlineAt) - now) / 86400000; return d >= 0 && d <= 7; })()).length;
      const data = window.EonBrain?.getData?.() || {};
      const opps = (data.opportunities || data.opportunity || []).length;
      if (due) return `You've got ${due} deadline${due > 1 ? 's' : ''} this week.`;
      if (opps) return `${opps} opportunit${opps > 1 ? 'ies' : 'y'} on your radar.`;
      return 'All quiet right now.';
    } catch { return ''; }
  }

  /* Rich, grounded, varied intents — most work even before the full data loads.
     Pulls live from the portable intelligence modules (win / finance / impact /
     graph) so answers are real-time and match the user's field. Returns null if
     nothing matches (the data intents + creative fallback then take over). */
  _extra(nq, data, records) {
    const pick = (a) => this._pick(a);
    const nm = (() => { try { return (document.getElementById('pfName')?.textContent || '').trim().split(/\s+/)[0] || ''; } catch { return ''; } })();
    const hi = nm ? `, ${nm}` : '';
    const strip = (s) => String(s).replace(/<[^>]+>/g, '');

    if (/^(hi+|hey+|hello+|yo+|hola|salam|assalam|assalamualaikum|good\s*(morning|afternoon|evening)|morning|evening|sup|howdy|namaste|greetings)\b/.test(nq) || /^what'?s\s*up\b/.test(nq))
      return { speak: pick([`Hey${hi}! ${this._miniDigest()} What do you want to tackle?`, `Hi${hi} 👋 ${this._miniDigest()} Ask me about your deadlines, opportunities, money or focus.`, `Hello${hi}! ${this._miniDigest()} I'm all ears.`, `Yo${hi} — ${this._miniDigest()} Where do we start?`, `Salam${hi}! ${this._miniDigest()} Say the word and I'll dig in.`, `Hey hey${hi} 🙌 ${this._miniDigest()} What's on your mind?`]) };

    if (/how are (you|u)\b|how'?s it going|you (ok|good|alright)|how do you feel/.test(nq))
      return { speak: pick([`Running smooth and watching your data 🌿 ${this._miniDigest()}`, `Sharp — just re-read everything. ${this._miniDigest()}`, `Good! Quietly crunching your numbers. ${this._miniDigest()}`, `Fully charged ⚡ ${this._miniDigest()} How are YOU holding up?`, `Never better — your data keeps me busy. ${this._miniDigest()}`]) };

    if (/what can you do|help me\b|how do you work|what do you do|your (features|abilities|skills)|commands|who are you|what are you|how can you help/.test(nq))
      return { speak: pick(["I'm Eon — your data co-worker. A few things I can do:", "Plenty! I read your whole operation. For example:", "I'm your AI co-worker. Try any of these:", "Think of me as a colleague who never sleeps. Some favourites:", "I read, predict, and act on your data. Ask me things like:"]), detail: ['• “what’s due this week?” · “overdue” · “next deadline”', '• “what should I focus on?” (win-probability)', '• “where can I save money?” (finance coach)', '• “how am I doing?” · “my win rate”', '• “who should I ask for a reference?”', '• “plan my Chevening application” (I create reminders)', '• “what’s my impact so far?”'] };

    if (/\bwin\b|chanc|\bodds\b|likel|worth (my|the) time|which.*(focus|apply|prioriti|pick|choose|first)|best bet|most likely|should i apply|what.*focus|focus on|priorit/.test(nq)) {
      try { window.EonWinPredictor?.refresh(); const w = window.EonWinPredictor?.summary(); if (w && w.ok && w.top && w.top.length) { const t = w.top[0]; const p = Math.round(t.p * 100); return { speak: pick([`Focus on “${t.name}” — I put it at ${p}%.`, `Highest odds: “${t.name}” (${p}%). Spend today there.`, `“${t.name}” is your best bet at ${p}%.`, `If I had one hour of your time, I'd spend it on “${t.name}” — ${p}% win odds.`, `The math says “${t.name}” (${p}%). The rest can wait.`]), detail: w.top.slice(0, 4).map((x) => `• ${x.name} — ${Math.round(x.p * 100)}% win`) }; } } catch {}
      return this._fallback(nq);
    }

    if (/money|financ|spend|budget|\bleak|afford|\bcash\b|expens|save|saving|cut cost|overspend|where.*money|how much.*(spend|save)/.test(nq)) {
      try { const f = window.EonFinance?.analyze(); if (f && f.hasData) return { speak: strip(f.headline), detail: f.tips.slice(0, 3).map((t) => '• ' + strip(t.text)) }; } catch {}
      return { speak: "Add income & expenses in Accounts and I'll forecast your spend and find real savings." };
    }

    if (/how am i doing|my (stats|record|performance|progress)|win rate|success rate|how many.*won|track record|am i on track|my numbers/.test(nq)) {
      try {
        const opps = (data.opportunities || []);
        const WON = /won|accept|complete|approv|award|admit|success/i, LOST = /lost|reject|declin|withdraw|miss|irrelevant/i;
        const decided = opps.filter((o) => WON.test(o.status || '') || LOST.test(o.status || ''));
        const wins = decided.filter((o) => WON.test(o.status || ''));
        if (decided.length) { const pc = Math.round(wins.length / decided.length * 100); return { speak: pick([`You're at a ${pc}% win rate — ${wins.length} of ${decided.length} decided.`, `Track record: ${wins.length}/${decided.length} won (${pc}%). ${this._miniDigest()}`, `${wins.length} wins out of ${decided.length} decided — that's ${pc}%. ${pc >= 50 ? 'Strong.' : 'Every loss is training data.'}`, `Scoreboard: ${pc}% conversion (${wins.length}W/${decided.length - wins.length}L). ${this._miniDigest()}`, `Your hit rate is ${pc}%. ${pc >= 40 ? 'Better than most pipelines I read.' : 'Focus on fewer, better-fit bets and this climbs.'}`]) }; }
      } catch {}
      return { speak: `Here's where things stand — ${this._miniDigest()}` };
    }

    if (/impact|what have you done|how.*helped|your value|\broi\b|contribution/.test(nq)) {
      try { const m = window.EonImpact?.get(); if (m) return { speak: `So far: ${m.guarded} deadlines guarded · ${m.surfaced} opportunities surfaced · ${m.hours} hrs saved${m.money ? ` · ${this._fmt(m.money)} in leaks flagged` : ''}.` }; } catch {}
    }

    if (/who (should|can|do) i (ask|contact)|referee|recommend|reference for|best (person|contact)|network|reach out/.test(nq)) {
      try { const g = window.EonGraph?.compute(); if (g && g.ok && g.recs && g.recs.length) { const r = g.recs[0]; const d = g.recs.slice(0, 3).map((x) => `• ${x.contact} — for ${x.opp}`); const neg = (g.neglected || [])[0]; return { speak: pick([`For your top opportunity, ${r.contact} is your strongest referee.`, `Ask ${r.contact} — best fit for “${r.opp}”.`]) + (neg ? ` (You've gone quiet with ${neg.name} — ${neg.days}d.)` : ''), detail: d }; } } catch {}
    }

    if (/motivat|encourag|stress|tired|overwhelm|give up|can'?t do|too hard|struggl|anxious|burn.?out|demotivat|feeling low|exhaust/.test(nq))
      return { speak: pick([`One step at a time${hi}. Pick the smallest next thing and just start — momentum does the rest. 💪`, `You've got this${hi}. Look how much you're already on top of. Do one small thing now.`, `Deep breath${hi}. I'll hold the deadlines; you take the next single move. 🌿`, `Progress beats perfection${hi}. Ship the 10-minute version and build from there.`, `Tired is data, not defeat${hi}. Rest tonight, and tomorrow we take the smallest win first.`, `Remember why you started${hi} — and let me carry the remembering-what's-due part. You just do the next step.`]) };

    if (/\b(thank|thx|thanks|cheers|appreciate|great job|nice one|awesome|good (job|bot|work)|love (it|you)|well done|helpful)\b/.test(nq))
      return { speak: pick(['Anytime 🙌', "Happy to help — that's the job.", 'You got it. 💙', 'My pleasure — keep the questions coming.', '🙌 Always here.']) };

    if (/summit|competition|data science summit|\bdss\b|\bpitch\b|judge|showcase|contest|present\b/.test(nq))
      return { speak: pick(['The Summit is your stage — lead with the live demo: hand a judge any spreadsheet and let me read it. 🎤', 'For the summit: show win-probability, the money coach and the board meeting — real data science on live data.', 'Pitch tip: open with the pain, then prove me on a judge’s own file. Mic drop.']) };

    // academic knowledge base — general questions about SOPs, scholarships, tests,
    // extracurriculars, study/career, even when they're not about the user's own data.
    try { const ak = window.EonAcademic && window.EonAcademic.answerAcademic(nq); if (ak) return { speak: ak.speak, detail: ak.detail }; } catch {}

    // the wide Q&A brain — 340+ offline entries (academic, productivity, data-science
    // concepts, the app itself, small talk), each with 3-5 varied practical answers.
    try { const bq = window.EonBrainQA && window.EonBrainQA.answerBrain(nq); if (bq) return { speak: bq.speak, detail: bq.detail }; } catch {}

    return null;
  }


  _remind(q) {
    let task = q.replace(/.*?(remind me( to| about)?|don'?t let me forget( to)?|set (a )?reminder( to| about)?)\s*/i, '').trim();
    const parsed = this._parseWhen(task);
    task = (parsed.task || task).replace(/[?.!]+$/, '').trim();
    if (!task) return { speak: 'Sure — what should I remind you about, and when?' };
    const when = parsed.date || (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; })();
    try {
      if (window.AppReminders?.create) window.AppReminders.create({ title: task, remindAt: when.toISOString(), source: 'eon' });
      else if (window.EonBrain?.createReminder) { const r = window.EonBrain.createReminder({ title: task, remindAt: when.toISOString() }); if (r && r.catch) r.catch(() => {}); }
      else return { speak: 'Sign in as owner and I’ll set reminders. 🔒' };
    } catch { return { speak: 'Sign in as owner and I’ll set reminders. 🔒' }; }
    return { speak: `Done — I'll remind you to "${task}" ${this._whenLabel(when)}. ⏰` };
  }

  /* Parse a natural "when" out of a reminder phrase. Understands:
     in/after N sec|min|hour|day|week · today/tonight/tomorrow/next week
     · a date (YYYY-MM-DD or D/M/Y, day-first) · a weekday · a time (10pm,
     22:00, 10:30 am), combinable e.g. "at 10pm on 26/06/2026". */
  _parseWhen(text) {
    let task = ' ' + text + ' ';
    let base = null, timeH = null, timeM = 0, rel = null, m;

    // relative offset: "in 5 min", "after 2 hours", "in 90 seconds", "in 3 days"
    if ((m = task.match(/\b(?:in|after|within)\s+(\d+)\s*(sec(?:ond)?|min(?:ute)?|hour|hr|day|week)s?\b/i))) {
      const n = parseInt(m[1], 10), u = m[2].toLowerCase();
      const mult = u.startsWith('sec') ? 1000 : u.startsWith('min') ? 60000
        : (u.startsWith('hour') || u === 'hr') ? 3600000 : u.startsWith('day') ? 86400000 : 604800000;
      rel = n * mult; task = task.replace(m[0], ' ');
    }
    // explicit date anywhere (ISO or day-first D/M/Y)
    if ((m = task.match(/\b(\d{4}-\d{1,2}-\d{1,2})\b/)) || (m = task.match(/\b(\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?)\b/))) {
      const dd = this._parseDateStr(m[1]); if (dd) { base = dd; task = task.replace(m[0], ' '); }
    }
    // relative day words (only if no explicit date)
    if (!base && rel == null) {
      if (/\btomorrow\b/i.test(task)) { base = new Date(); base.setDate(base.getDate() + 1); task = task.replace(/\btomorrow\b/i, ' '); }
      else if (/\bnext week\b/i.test(task)) { base = new Date(); base.setDate(base.getDate() + 7); task = task.replace(/\bnext week\b/i, ' '); }
      else if (/\btonight\b/i.test(task)) { base = new Date(); timeH = timeH ?? 20; task = task.replace(/\btonight\b/i, ' '); }
      else if (/\btoday\b/i.test(task)) { base = new Date(); task = task.replace(/\btoday\b/i, ' '); }
      else { const wm = task.toLowerCase().match(/\b(?:on |next )?(sun|mon|tue|wed|thu|fri|sat)[a-z]*/); if (wm) { const dn = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], idx = dn.indexOf(wm[1]); if (idx >= 0) { const d = new Date(); let add = (idx - d.getDay() + 7) % 7; if (add === 0) add = 7; d.setDate(d.getDate() + add); base = d; task = task.replace(wm[0], ' '); } } }
    }
    // time of day: "at 10pm", "at 22:00", "10:30 am", "at 7"
    if ((m = task.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)) ||
        (m = task.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i)) ||
        (m = task.match(/\b(\d{1,2})\s*(am|pm)\b/i))) {
      let h = parseInt(m[1], 10); const mins = /^\d{2}$/.test(m[2] || '') ? parseInt(m[2], 10) : 0;
      const ap = (m[3] || m[2] || '').toString().toLowerCase();
      if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
      if (h >= 0 && h <= 23) { timeH = h; timeM = (mins >= 0 && mins < 60) ? mins : 0; task = task.replace(m[0], ' '); }
    }

    let date = null;
    if (rel != null) date = new Date(Date.now() + rel);
    else if (base || timeH != null) {
      date = base || new Date();
      if (timeH != null) date.setHours(timeH, timeM, 0, 0); else date.setHours(9, 0, 0, 0);
      // a bare time already past today → assume the owner means tomorrow
      if (!base && timeH != null && date.getTime() < Date.now()) date.setDate(date.getDate() + 1);
    }
    task = task.replace(/^\s*(to|that|about)\s+/i, '').replace(/\s+/g, ' ').trim();
    return { date, task };
  }
  /* Parse a date token. ISO stays ISO; D/M/Y is read day-first. */
  _parseDateStr(s) {
    s = String(s).trim();
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return new Date(+m[1], +m[2] - 1, +m[3]);
    if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?$/))) {
      let y = m[3] ? +m[3] : new Date().getFullYear(); if (y < 100) y += 2000;
      return new Date(y, +m[2] - 1, +m[1]);   // day-first
    }
    const t = Date.parse(s); return Number.isNaN(t) ? null : new Date(t);
  }
  /* Human label: "in 5 minutes" stays relative; dated reminders show date (+time). */
  _whenLabel(d) {
    const ms = d.getTime() - Date.now();
    if (ms > 0 && ms < 3600000) return `in ${Math.max(1, Math.round(ms / 60000))} minute${Math.round(ms / 60000) === 1 ? '' : 's'}`;
    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
    const date = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    if (!hasTime) return `on ${date}`;
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `on ${date} at ${time}`;
  }

  _list(items, lead) {
    if (!items.length) return { speak: `Nothing there — ${lead.replace(/^\d+\s*/, '')}. 🌿` };
    const detail = items.slice(0, 8).map((r) => `• ${r.label}${r.deadlineAt ? ` — ${this._date(r.deadlineAt)}` : ''}`).join('\n');
    return { speak: `${lead}:`, detail, items };
  }

  // ---------------- helpers ----------------
  _entityIn(nq, keys) {
    for (const k of keys) { const syns = SYN[k] || [k]; if (nq.includes(k) || syns.some((s) => nq.includes(s))) return k; }
    return null;
  }
  _amountField(nq, recs) {
    const fields = [...new Set(recs.flatMap((r) => Object.keys(r.payload || {})))];
    // a field named in the question?
    const named = fields.find((f) => nq.includes(f.toLowerCase()));
    if (named && this._isNumericField(named, recs)) return named;
    // a common money-ish field that actually holds numbers?
    for (const h of AMOUNT_HINTS) { const f = fields.find((x) => x.toLowerCase().includes(h)); if (f && this._isNumericField(f, recs)) return f; }
    return null;
  }
  _isNumericField(f, recs) { return recs.some((r) => this._num(r.payload?.[f]) != null); }
  _num(v) { if (v == null) return null; const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return Number.isNaN(n) ? null : n; }
  _fmt(n) { return (Math.round(n * 100) / 100).toLocaleString(); }
  _date(iso) { const d = new Date(iso); return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); }
  _help(keys) { return `Ask me things like "how many ${keys[0] || 'tasks'}?", "what's due this week?", "overdue", "find <name>", or "total <field>".`; }
  _owner() { try { return !!window.EonBrain?.isOwner?.(); } catch { return false; } }

  // ---------------- DOM ----------------
  _injectStyle() {
    if (document.getElementById('eon-ask-style')) return;
    const s = document.createElement('style'); s.id = 'eon-ask-style';
    s.textContent = `
      #eon-ask-chip{position:relative;display:none;align-items:center;gap:5px;height:26px;white-space:nowrap;
        background:#1f6dff;color:#fff;border:0;border-radius:14px;padding:0 11px;cursor:pointer;line-height:1;
        box-shadow:0 4px 12px rgba(31,109,255,.3);font:700 12px system-ui;transition:transform .15s,background .15s}
      #eon-ask-chip:hover{background:#1559d8;transform:translateY(-2px)}
      #eon-ask{position:fixed;right:16px;bottom:50px;z-index:2147483600;width:320px;max-width:calc(100vw - 32px);
        background:#fff;color:#10225e;border-radius:14px;border:1.5px solid #1f6dff33;box-shadow:0 16px 44px rgba(16,34,94,.26);
        opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity .18s,transform .18s;font:500 13px system-ui;overflow:hidden}
      #eon-ask.show{opacity:1;transform:none;pointer-events:auto}
      #eon-ask .ea-h{display:flex;align-items:center;padding:10px 12px;background:#1f6dff;color:#fff;font-weight:700;font-size:12.5px}
      #eon-ask .ea-x{margin-left:auto;cursor:pointer;opacity:.85;font-size:14px}
      #eon-ask .ea-in{display:flex;gap:6px;padding:10px 12px}
      #eon-ask input{flex:1;border:1.5px solid #e2e7f2;border-radius:9px;padding:8px 10px;font:500 13px system-ui;color:#16203a}
      #eon-ask input:focus{outline:none;border-color:#1f6dff}
      #eon-ask .ea-go{border:0;border-radius:9px;background:#1f6dff;color:#fff;padding:0 12px;cursor:pointer;font:700 13px system-ui}
      #eon-ask .ea-a{padding:0 12px 12px;white-space:pre-wrap;color:#16203a;max-height:42vh;overflow:auto;font-weight:600}
      #eon-ask .ea-keep{display:none;margin:0 12px 12px;border:0;border-radius:9px;background:#eef1f7;color:#10225e;padding:7px 10px;cursor:pointer;font:700 12px system-ui}
      #eon-ask .ea-keep:hover{background:#e2e7f2}
      #eon-ask .ea-go-there{display:none;margin:0 12px 8px;border:0;border-radius:9px;background:#1f6dff;color:#fff;padding:7px 10px;cursor:pointer;font:700 12px system-ui}
      #eon-ask .ea-go-there:hover{background:#1559d8}
      #eon-ask .ea-ex{padding:2px 12px 10px;color:#8a96ad;font-size:11px}`;
    document.head.appendChild(s);
  }
  _buildChip() {
    if (document.getElementById('eon-ask-chip')) { this._chip = document.getElementById('eon-ask-chip'); return; }
    const b = document.createElement('button'); b.id = 'eon-ask-chip';
    b.innerHTML = '💬 Ask EON'; b.title = 'Ask EON about your data';
    b.onclick = (e) => { e.stopPropagation(); this._toggle(); };
    (document.getElementById('eon-controls') || document.body).appendChild(b); this._chip = b;
  }
  _buildPanel() {
    if (document.getElementById('eon-ask')) { this._panel = document.getElementById('eon-ask'); return; }
    const p = document.createElement('div'); p.id = 'eon-ask';
    p.innerHTML = `
      <div class="ea-h">💬 Ask EON <span class="ea-x" title="Close">✕</span></div>
      <div class="ea-in"><input type="text" placeholder="e.g. what's due this week?" /><button class="ea-go">Ask</button></div>
      <div class="ea-ex">Try: what am I forgetting · remind me to call X tomorrow · plan my day · what's due · overdue · find &lt;name&gt; · total amount</div>
      <div class="ea-a"></div>
      <button class="ea-go-there">➡️ Take me there</button>
      <button class="ea-keep">🎒 Keep these in the backpack</button>`;
    document.body.appendChild(p);
    this._panel = p;
    this._input = p.querySelector('input');
    this._answerEl = p.querySelector('.ea-a');
    this._keepBtn = p.querySelector('.ea-keep');
    this._goBtn = p.querySelector('.ea-go-there');
    this._goBtn.onclick = (e) => { e.stopPropagation(); this._goThere(); };
    p.querySelector('.ea-x').onclick = (e) => { e.stopPropagation(); this._toggle(false); };
    p.querySelector('.ea-go').onclick = (e) => { e.stopPropagation(); this.ask(this._input.value); };
    this._input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.ask(this._input.value); });
    this._keepBtn.onclick = (e) => {
      e.stopPropagation();
      const items = this._lastItems || [];
      const text = items.map((r) => `${r.label}${r.deadlineAt ? ` — ${this._date(r.deadlineAt)}` : ''}`).join('\n');
      try { window.EonBackpack?.addText(text, `Kept ${items.length} from your question. 🎒`); } catch {}
      this._keepBtn.style.display = 'none';
    };
  }
  _goThere() {
    const f = (this._lastItems || [])[0]; if (!f || !f.entity) return;
    const id = f.recordId ?? f.id;
    const item = { entity: f.entity, recordId: id, pointTo: f.pointTo || this.cb._pointTo(f.entity, id), label: f.label, line: `Here it is — ${f.label}.` };
    this._toggle(false);
    try { window.EonCompanion?.escortTo?.(item); } catch {}
  }
  _short(t, n = 28) { const s = String(t).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  _echo(q) { if (this._answerEl) this._answerEl.textContent = ''; if (this._keepBtn) this._keepBtn.style.display = 'none'; if (this._goBtn) this._goBtn.style.display = 'none'; }
  _toggle(force) {
    this._open = (force === undefined) ? !this._open : force;
    this._panel.classList.toggle('show', this._open);
    if (this._open) setTimeout(() => this._input?.focus(), 60);
  }
}
