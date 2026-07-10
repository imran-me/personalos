/* ============================================================
   EON · intel/deck.js  —  the dedicated Intelligence deck (inline)
   ------------------------------------------------------------
   The full, premium intelligence dashboard that lives on its own page
   (eon.html → #eonDeck) instead of cluttering the KPI dashboard. Reads
   the host's data through EonBrain/discovery and the portable engines
   (win-predictor, anomaly, impact, prover), so it travels with the
   ai-companion folder and adapts to any site.

   Design: minimal & editorial — mostly white + ink with a single indigo
   accent, generous whitespace, typographic hierarchy. Organised by
   importance into LIVE · INTELLIGENCE · BUSINESS · REPORTS. New showcase
   features plug in as their own cards (board meeting, digital twin,
   calibration, crisis feed, reasoning trace).

   Public: window.EonDeck.mount(el?) · refresh(). Self-mounts on #eonDeck.
   ============================================================ */

import { profileDataset } from '../analytics/prover.js';
import '../models/win-predictor.js';
import '../analytics/anomaly.js';
import '../analytics/impact.js';
import '../intel/boardroom.js';   // registers window.EonBoardroom (feature a)
import '../intel/twin.js';        // registers window.EonTwin (feature b)

const A = '#4f46e5';        // indigo accent (used sparingly)
const G = '#0f9d58', AM = '#c77d0a', R = '#d6453d', SL = '#64748b';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const pct = (x) => Math.round(clamp01(x) * 100);
const daysTo = (iso) => { const t = Date.parse(iso); return isNaN(t) ? null : Math.floor((t - Date.now()) / 86400000); };
const fmtD = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }); };
const money = (n) => { try { return typeof window.fmtBDTk === 'function' ? window.fmtBDTk(n) : '৳' + Math.round(n).toLocaleString(); } catch { return '৳' + Math.round(n); } };
const brain = () => { try { return window.EonBrain || null; } catch { return null; } };
const ownerOK = () => { const b = brain(); try { return !!(b && b.isOwner && b.isOwner()); } catch { return false; } };

/* reasoning trace — the "show your work" audit log (feature f). Shared so any
   engine can push to it; deck adds a line whenever the analysis actually changes. */
const _trace = (window.EonTrace = window.EonTrace || []);
let _traceSig = '';
function trace(line) {
  const d = new Date();
  _trace.unshift({ t: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), line });
  if (_trace.length > 12) _trace.length = 12;
}

/* ---------------- compute ---------------- */
function compute() {
  const b = brain();
  const data = (() => { try { return (b && b.getData()) || {}; } catch { return {}; } })();
  const ents = (() => { try { return (b && b.getEntities()) || {}; } catch { return {}; } })();
  const recs = (() => { try { return (b && b.getRecords()) || []; } catch { return []; } })();
  const keys = Object.keys(ents).filter((k) => Array.isArray(data[k]) && data[k].length);

  const withDl = recs.filter((r) => r.deadlineAt && !isNaN(Date.parse(r.deadlineAt)));
  const upcoming = withDl.filter((r) => { const d = daysTo(r.deadlineAt); return d != null && d >= 0 && d <= 30; });
  const overdue = withDl.filter((r) => { const d = daysTo(r.deadlineAt); return d != null && d < 0; });
  const radar = [...upcoming].sort((a, c) => Date.parse(a.deadlineAt) - Date.parse(c.deadlineAt)).slice(0, 6)
    .map((r) => ({ label: r.label, entity: r.entity, days: daysTo(r.deadlineAt), when: fmtD(r.deadlineAt), pointTo: r.pointTo }));

  const primaryKey = keys.slice().sort((a, c) => data[c].length - data[a].length)[0] || null;
  let eda = null; if (primaryKey) { try { eda = profileDataset(data[primaryKey], primaryKey); } catch {} }
  const entities = keys.map((k) => ({ key: k, count: data[k].length, fields: (ents[k].fields || []).length, deadline: !!ents[k].deadlineField, dates: (ents[k].dateFields || []).length })).sort((a, c) => c.count - a.count);

  const win = (() => { try { window.EonWinPredictor && window.EonWinPredictor.refresh(); return window.EonWinPredictor.summary(); } catch { return null; } })();
  const leaks = (() => { try { return window.EonAnomaly ? window.EonAnomaly.scan() : null; } catch { return null; } })();
  const impact = (() => { try { return window.EonImpact ? window.EonImpact.refresh() : null; } catch { return null; } })();

  // grow the reasoning trace only when the analysis actually changes
  const sig = `${recs.length}:${keys.length}:${win ? win.live + '/' + win.trained : 0}:${leaks ? leaks.count : 0}`;
  if (sig !== _traceSig) {
    _traceSig = sig;
    if (keys.length) trace(`Discovered ${keys.length} data source${keys.length > 1 ? 's' : ''} · ${recs.length} records`);
    if (win && win.ok) trace(`Scored ${win.live} live opportunit${win.live === 1 ? 'y' : 'ies'} · model ${win.trained ? 'trained on ' + win.n + ' outcomes' : 'cold-start prior'}`);
    if (eda) trace(`Auto-EDA on “${primaryKey}” · ${eda.colCount} columns typed`);
    if (leaks && leaks.hasData) trace(`Scanned ${leaks.txCount} transactions · ${leaks.count} anomal${leaks.count === 1 ? 'y' : 'ies'} flagged`);
    if (upcoming.length) trace(`Watching ${upcoming.length} deadline${upcoming.length > 1 ? 's' : ''} within 30 days`);
  }

  return { keys, records: recs.length, upcoming: upcoming.length, overdue: overdue.length, radar, eda, primaryKey, entities, win, leaks, impact };
}

const PROC = { idle: ['Watching quietly', SL], meditating: ['Studying your data', A], 'reading-section': ['Reading', A], insight: ['Surfaced an insight', AM] };
function live() {
  let s = { state: 'idle', progress: 1, section: null, message: null };
  try { const st = brain()?.getState?.(); if (st) s = st; } catch {}
  const m = PROC[s.state] || PROC.idle;
  let label = m[0];
  if (s.state === 'reading-section' && s.section) label = `Reading ${esc(s.section)}`;
  if (s.state === 'insight' && s.message) label = esc(s.message);
  return { label, color: m[1], thinking: s.state === 'meditating' || s.state === 'reading-section', progress: s.progress == null ? 1 : s.progress };
}

/* ---------------- styles (minimal, editorial) ---------------- */
function injectStyle() {
  if (document.getElementById('eon-deck-style')) return;
  const s = document.createElement('style'); s.id = 'eon-deck-style';
  s.textContent = `
  #eonDeck{max-width:1160px;color:var(--text,#1f2937)}
  #eonDeck .ed-hero{display:flex;align-items:flex-end;gap:16px;margin:2px 0 26px;flex-wrap:wrap}
  #eonDeck .ed-hero h1{font:800 30px/1.05 "Plus Jakarta Sans",system-ui;letter-spacing:-.02em;color:#111634;margin:0}
  #eonDeck .ed-hero p{margin:6px 0 0;color:var(--text-soft,#5b6678);font-size:14px;max-width:52ch}
  #eonDeck .ed-livepill{margin-left:auto;display:inline-flex;align-items:center;gap:9px;background:#fff;border:1px solid var(--line,#e7eaf1);
    border-radius:999px;padding:8px 15px;font-size:12.5px;font-weight:600;color:#16203a;box-shadow:0 1px 2px rgba(16,24,40,.04)}
  #eonDeck .ed-livepill .dot{width:8px;height:8px;border-radius:50%;background:var(--k,#64748b)}
  #eonDeck .ed-livepill .dot.on{animation:edp 1.3s ease-in-out infinite}
  @keyframes edp{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.5)}}
  #eonDeck .ed-livepill .trace{color:var(--text-faint,#9aa3b2);font-weight:500;font-family:"JetBrains Mono",monospace;font-size:11px}
  #eonDeck .ed-sec{margin:0 0 30px}
  #eonDeck .ed-seclabel{display:flex;align-items:center;gap:12px;margin:0 0 14px;font:700 11.5px "Inter",system-ui;text-transform:uppercase;letter-spacing:.14em;color:var(--text-faint,#9aa3b2)}
  #eonDeck .ed-seclabel::after{content:"";flex:1;height:1px;background:var(--line,#e7eaf1)}
  #eonDeck .ed-seclabel b{color:var(--text-soft,#5b6678);font-weight:800}
  #eonDeck .ed-grid{display:grid;gap:16px}
  #eonDeck .ed-2{grid-template-columns:repeat(2,1fr)}
  #eonDeck .ed-3{grid-template-columns:repeat(3,1fr)}
  #eonDeck .ed-card{background:#fff;border:1px solid var(--line,#e7eaf1);border-radius:16px;padding:20px 22px;transition:box-shadow .2s}
  #eonDeck .ed-card:hover{box-shadow:0 6px 22px rgba(16,24,40,.06)}
  #eonDeck .ed-ct{font:700 13px "Plus Jakarta Sans",system-ui;color:#16203a;margin:0 0 3px;letter-spacing:-.01em}
  #eonDeck .ed-cs{color:var(--text-faint,#9aa3b2);font-size:11.5px;margin:0 0 16px;font-weight:500}
  #eonDeck .ed-num{font-family:"JetBrains Mono",monospace;font-weight:700;letter-spacing:-.02em}
  #eonDeck .ed-empty{color:var(--text-soft,#5b6678);font-size:13px;line-height:1.55}
  /* win */
  #eonDeck .ed-winhero{display:flex;align-items:baseline;gap:10px;padding-bottom:14px;margin-bottom:6px;border-bottom:1px solid var(--line-2,#eef1f6)}
  #eonDeck .ed-winhero .v{font:700 44px "JetBrains Mono";color:${A};line-height:1;letter-spacing:-.03em}
  #eonDeck .ed-winhero .u{font-size:15px;color:var(--text-soft);font-weight:600}
  #eonDeck .ed-oprow{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line-2,#eef1f6)}
  #eonDeck .ed-oprow:last-child{border-bottom:0}
  #eonDeck .ed-opp{flex:1;min-width:0}
  #eonDeck .ed-opp b{font-size:13.5px;font-weight:600;color:#16203a;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #eonDeck .ed-opp small{color:var(--text-soft);font-size:11.5px}
  #eonDeck .ed-opp small em{font-style:italic}
  #eonDeck .ed-opbar{width:84px;flex:0 0 auto;height:5px;border-radius:3px;background:var(--line,#e7eaf1);overflow:hidden}
  #eonDeck .ed-opbar>span{display:block;height:100%;border-radius:3px}
  #eonDeck .ed-oppct{font-family:"JetBrains Mono";font-weight:700;font-size:14px;min-width:42px;text-align:right}
  /* story */
  #eonDeck .ed-story div{font-size:13px;color:#374151;line-height:1.55;margin:5px 0;padding-left:14px;position:relative}
  #eonDeck .ed-story div::before{content:"";position:absolute;left:0;top:9px;width:5px;height:5px;border-radius:50%;background:${A}}
  #eonDeck .ed-story b{color:#111634}
  #eonDeck .ed-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
  #eonDeck .ed-chip{font-size:11px;border:1px solid var(--line);border-radius:8px;padding:3px 9px;color:var(--text-soft);background:var(--surface-2,#fbfcfe)}
  #eonDeck .ed-chip b{color:#16203a;font-weight:600}
  #eonDeck .ed-chip i{font-style:normal;font-family:"JetBrains Mono";font-size:9px;opacity:.6;margin-left:5px;text-transform:uppercase}
  /* leaks */
  #eonDeck .ed-leak{display:flex;gap:13px;padding:11px 0;border-bottom:1px solid var(--line-2,#eef1f6)}
  #eonDeck .ed-leak:last-child{border-bottom:0}
  #eonDeck .ed-leak .amt{font-family:"JetBrains Mono";font-weight:700;font-size:15px;min-width:78px}
  #eonDeck .ed-leak b{display:block;font-size:12.5px;color:#16203a}
  #eonDeck .ed-leak small{color:var(--text-soft);font-size:11.5px;line-height:1.4}
  /* impact */
  #eonDeck .ed-impact{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
  #eonDeck .ed-imp{padding:6px 4px}
  #eonDeck .ed-imp .v{font:700 30px "JetBrains Mono";color:#111634;line-height:1;letter-spacing:-.02em}
  #eonDeck .ed-imp .l{font-size:11.5px;color:var(--text-soft);margin-top:5px;font-weight:500}
  /* radar + sources */
  #eonDeck .ed-row{display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid var(--line-2,#eef1f6);text-decoration:none;color:inherit}
  #eonDeck .ed-row:last-child{border-bottom:0}
  #eonDeck .ed-cd{font-family:"JetBrains Mono";font-weight:700;font-size:11.5px;min-width:38px;text-align:center;padding:3px 0;border-radius:6px;background:#eef0fe;color:${A}}
  #eonDeck .ed-cd.soon{background:#fdeceb;color:${R}}
  #eonDeck .ed-row b{font-size:13px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #eonDeck .ed-row small{color:var(--text-soft);font-size:11.5px}
  #eonDeck .ed-row .n{font-family:"JetBrains Mono";font-weight:700;font-size:15px;color:#16203a;min-width:36px}
  #eonDeck .ed-cardbtn{margin-top:14px;border:1px solid var(--line);background:#fff;border-radius:10px;padding:9px 14px;font:700 12.5px "Inter";color:${A};cursor:pointer;transition:.15s}
  #eonDeck .ed-cardbtn:hover{background:#eef0fe;border-color:${A}}
  /* live working area (top) */
  #eonDeck .ed-live{display:grid;grid-template-columns:1fr 1.15fr;border:1px solid var(--line,#e7eaf1);border-radius:16px;overflow:hidden;margin-bottom:14px;background:#fff}
  #eonDeck .ed-live-l{padding:20px 22px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid var(--line-2,#eef1f6)}
  #eonDeck .ed-live-l .sub{color:var(--text-faint,#9aa3b2);font:700 10.5px "Inter";text-transform:uppercase;letter-spacing:.13em;margin-bottom:8px}
  #eonDeck .ed-live-l .st{display:flex;align-items:center;gap:10px}
  #eonDeck .ed-live-l .st .dot{width:9px;height:9px;border-radius:50%;background:var(--k,#64748b);flex:0 0 auto}
  #eonDeck .ed-live-l .st .dot.on{animation:edp 1.3s ease-in-out infinite}
  #eonDeck .ed-live-l .st b{font:700 16px "Plus Jakarta Sans",system-ui;color:#111634}
  #eonDeck .ed-live-l .bar{height:4px;border-radius:3px;background:var(--line,#e7eaf1);overflow:hidden;margin-top:13px;max-width:240px}
  #eonDeck .ed-live-l .bar>span{display:block;height:100%;background:linear-gradient(90deg,${A},#0ea5e9);transition:width .5s}
  #eonDeck .ed-trace{padding:15px 20px;background:var(--surface-2,#fbfcfe)}
  #eonDeck .ed-trace .th{font:700 10.5px "Inter";text-transform:uppercase;letter-spacing:.12em;color:var(--text-faint,#9aa3b2);margin-bottom:10px;display:flex;align-items:center;gap:7px}
  #eonDeck .ed-trace .tl{max-height:110px;overflow:auto;display:flex;flex-direction:column;gap:6px}
  #eonDeck .ed-trace .tr{font-size:12px;color:#374151;display:flex;gap:10px;align-items:baseline;line-height:1.3}
  #eonDeck .ed-trace .tr:first-child{color:#111634;font-weight:500}
  #eonDeck .ed-trace .tr i{font-family:"JetBrains Mono",monospace;font-style:normal;color:var(--text-faint,#9aa3b2);font-size:10.5px;flex:0 0 auto}
  /* ask bar */
  #eonDeck .ed-ask{display:flex;gap:10px;align-items:center;background:#fff;border:1px solid var(--line,#e7eaf1);border-radius:14px;padding:7px 7px 7px 17px;margin-bottom:28px;transition:border-color .15s,box-shadow .15s}
  #eonDeck .ed-ask:focus-within{border-color:${A};box-shadow:0 0 0 3px rgba(79,70,229,.12)}
  #eonDeck .ed-ask .q{color:${A};font-size:17px}
  #eonDeck .ed-ask input{flex:1;border:0;outline:0;font:500 14px "Inter";color:#16203a;background:transparent}
  #eonDeck .ed-ask input::placeholder{color:var(--text-faint,#9aa3b2)}
  #eonDeck .ed-ask button{border:0;background:${A};color:#fff;border-radius:10px;padding:10px 18px;font:700 12.5px "Inter";cursor:pointer;transition:background .15s}
  #eonDeck .ed-ask button:hover{background:#4338ca}
  @media(max-width:900px){#eonDeck .ed-2,#eonDeck .ed-3{grid-template-columns:1fr}#eonDeck .ed-impact{grid-template-columns:repeat(2,1fr)}#eonDeck .ed-live{grid-template-columns:1fr}#eonDeck .ed-live-l{border-right:0;border-bottom:1px solid var(--line-2,#eef1f6)}}`;
  document.head.appendChild(s);
}

/* ---------------- card renderers ---------------- */
function cardWin(w) {
  if (!w || !w.ok || !w.top || !w.top.length) return card('Win probability', 'logistic model over your pipeline', `<p class="ed-empty">Log a few outcomes and Eon will predict which opportunities are worth your time.</p>`);
  const tone = (p) => (p >= 0.66 ? G : p >= 0.4 ? AM : R);
  const rows = w.top.slice(0, 5).map((p) => {
    const c = tone(p.p); const why = (p.ranked || []).filter((r) => r.v > 0).slice(0, 2).map((r) => r.label).join(', ');
    return `<div class="ed-oprow"><span class="ed-opp"><b>${esc(p.name)}</b><small>${why ? 'lifted by <em>' + esc(why) + '</em>' : 'live'}</small></span>
      <span class="ed-opbar"><span style="width:${pct(p.p)}%;background:${c}"></span></span>
      <span class="ed-oppct" style="color:${c}">${pct(p.p)}%</span></div>`;
  }).join('');
  const sub = `${w.trained ? 'trained · ' + w.n + ' outcomes' : 'cold-start prior'} · base rate ${w.base != null ? pct(w.base) + '%' : '—'}`;
  return card('Win probability', sub, `<div class="ed-winhero"><span class="v">${w.avg != null ? pct(w.avg) : '—'}</span><span class="u">avg across ${w.live} live opportunit${w.live === 1 ? 'y' : 'ies'}</span></div>${rows}`);
}
function cardStory(e) {
  if (!e || !e.insights) return '';
  const chips = (e.columns || []).slice(0, 10).map((c) => `<span class="ed-chip"><b>${esc(c.name)}</b><i>${c.type}</i></span>`).join('');
  return card('Data story', `${esc(e.name)} · automatic EDA`, `<div class="ed-story">${e.insights.map((s) => `<div>${s}</div>`).join('')}</div><div class="ed-chips">${chips}</div>`);
}
function cardMoney(L) {
  if (!L || !L.hasData) return '';
  const items = [];
  if (L.overrun) items.push({ amt: L.overrun.over, c: R, h: 'Over budget', w: `Spent ${money(L.overrun.spend)} of a ${money(L.overrun.budget)} budget.` });
  (L.flags || []).slice(0, 4).forEach((f) => items.push({ amt: f.amount, c: f.kind === 'duplicate' ? AM : R, h: f.kind === 'duplicate' ? 'Possible duplicate' : (f.zLabel ? f.zLabel + 'σ outlier' : 'Anomaly'), w: f.why }));
  const rows = items.length ? items.map((it) => `<div class="ed-leak"><span class="amt" style="color:${it.c}">${money(it.amt)}</span><span><b>${esc(it.h)}</b><small>${it.w}</small></span></div>`).join('')
    : `<p class="ed-empty">Scanned ${L.txCount} transactions — nothing unusual. 🌿</p>`;
  const sub = L.count ? `${L.count} flag${L.count === 1 ? '' : 's'}${L.recovered ? ' · ' + money(L.recovered) + ' at risk' : ''}` : `${L.txCount} transactions scanned`;
  return card('Money radar', sub, rows);
}
function cardImpact(m) {
  if (!m) return '';
  const cells = [['deadlines guarded', m.guarded], ['opportunities surfaced', m.surfaced], ['hours saved', m.hours], [m.money ? 'leaks flagged' : 'leaks watched', m.money ? money(m.money) : m.leaksFlagged]];
  return card('Impact so far', `measured from your data · since ${esc(m.since)} · synced`, `<div class="ed-impact">${cells.map((c) => `<div class="ed-imp"><div class="v">${c[1]}</div><div class="l">${c[0]}</div></div>`).join('')}</div>`);
}
function cardRadar(radar, overdue) {
  const rows = radar.length ? radar.map((r) => `<a class="ed-row" href="${esc(r.pointTo || '#')}"><span class="ed-cd ${r.days <= 3 ? 'soon' : ''}">${r.days}d</span><span style="flex:1;min-width:0"><b>${esc(r.label)}</b><small>${esc(r.entity)} · ${esc(r.when)}</small></span></a>`).join('')
    : `<p class="ed-empty">Nothing due in the next 30 days. 🌿</p>`;
  return card('Deadline radar', overdue ? `${overdue} overdue` : 'next 30 days', rows);
}
function cardSources(entities, records) {
  const rows = entities.map((e) => `<div class="ed-row"><span class="n">${e.count}</span><span style="flex:1;min-width:0"><b style="text-transform:capitalize">${esc(e.key)}</b><small>${e.fields} fields${e.deadline ? ' · deadlines' : ''}${e.dates ? ' · ' + e.dates + ' date field' + (e.dates > 1 ? 's' : '') : ''}</small></span></div>`).join('');
  return card('Data sources', `${records.toLocaleString()} records · ${entities.length} sources`, rows || `<p class="ed-empty">No data yet.</p>`);
}
function cardProver() {
  return card('Any-dataset prover', 'discovery + auto-EDA on any file', `<p class="ed-empty">Hand Eon any spreadsheet and he infers the schema and profiles it live — any business, any data, zero integration.</p><button class="ed-cardbtn" id="edProve"><i class="bi bi-upload me-1"></i>Prove a dataset</button>`);
}
function cardBoard() {
  return card('Board meeting', 'four advisors argue your call, grounded in your data', `<p class="ed-empty">Put any decision to Eon's boardroom — <b>CFO</b>, <b>Skeptic</b>, <b>Growth</b> and <b>Compliance</b> debate it live and converge on a verdict, with the dissenting view kept visible.</p><button class="ed-cardbtn" id="edBoard"><i class="bi bi-chat-square-quote me-1"></i>Convene the board</button>`);
}
function cardTwin() {
  return card('Digital twin', 'Monte-Carlo forecast of your next 90 days', `<p class="ed-empty">Eon fast-forwards hundreds of possible futures from your cash flow and pipeline, then shows the <b>probability fan</b> of outcomes — the odds you stay cash-positive, not a single guess.</p><button class="ed-cardbtn" id="edTwin"><i class="bi bi-graph-up me-1"></i>Run the simulation</button>`);
}
const DECISION_RE = /\b(should i|shall i|do i|is it worth|worth it|better to|hire|fire|buy|invest|expand|launch|borrow|quit|pivot|raise|discount|scale)\b|\?\s*$/i;

function cardCalibration() {
  let c = null; try { c = window.EonWinPredictor && window.EonWinPredictor.calibration(); } catch {}
  if (!c || !c.ok) return card('Trust calibration', 'how honest Eon’s predictions are', `<p class="ed-empty">Once you've logged a handful of outcomes, Eon grades its own accuracy here — a reliability curve, not just a claim.</p>`);
  const W = 200, H = 200, pad = 22;
  const X = (v) => pad + v * (W - 2 * pad), Y = (v) => H - pad - v * (H - 2 * pad);
  const dots = c.points.map((p) => `<circle cx="${X(p.pred).toFixed(1)}" cy="${Y(p.actual).toFixed(1)}" r="${(3 + Math.min(6, p.n)).toFixed(1)}" fill="${A}" opacity=".72"/>`).join('');
  const curve = c.points.length > 1 ? `<polyline points="${c.points.map((p) => X(p.pred).toFixed(1) + ',' + Y(p.actual).toFixed(1)).join(' ')}" fill="none" stroke="${A}" stroke-width="1.5" opacity=".4"/>` : '';
  return card('Trust calibration', `${c.n} outcomes · Eon grades itself`, `
    <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
      <svg viewBox="0 0 ${W} ${H}" width="176" height="176" style="flex:0 0 auto">
        <rect x="${pad}" y="${pad}" width="${W - 2 * pad}" height="${H - 2 * pad}" fill="none" stroke="#eef1f6"/>
        <line x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(1)}" stroke="#c7cbe6" stroke-width="1" stroke-dasharray="4 4"/>
        ${curve}${dots}
        <text x="${W / 2}" y="${H - 3}" text-anchor="middle" font-size="9" fill="#9aa3b2" font-family="Inter">predicted →</text>
        <text x="9" y="${H / 2}" text-anchor="middle" font-size="9" fill="#9aa3b2" font-family="Inter" transform="rotate(-90 9 ${H / 2})">actual →</text>
      </svg>
      <div style="flex:1;min-width:150px">
        <div style="display:flex;gap:20px">
          <div><div class="ed-num" style="font-size:28px;color:${G}">${Math.round(c.accuracy * 100)}%</div><div style="font-size:11.5px;color:var(--text-soft)">accuracy</div></div>
          <div><div class="ed-num" style="font-size:28px;color:#16203a">${c.brier.toFixed(2)}</div><div style="font-size:11.5px;color:var(--text-soft)">Brier score</div></div>
        </div>
        <p class="ed-empty" style="margin-top:12px">Dots on the dashed line = perfectly calibrated. Expected calibration error <b>${Math.round(c.ece * 100)}%</b>${c.trained ? '' : ' — cold-start, sharpens as you log outcomes'}.</p>
      </div>
    </div>`);
}

function card(title, sub, body) { return `<div class="ed-card"><div class="ed-ct">${title}</div><div class="ed-cs">${sub}</div>${body}</div>`; }

function liveSection(m, L) {
  const rows = _trace.length ? _trace.map((t) => `<div class="tr"><i>${t.t}</i><span>${esc(t.line)}</span></div>`).join('') : `<div class="tr"><span>Warming up the intelligence layer…</span></div>`;
  return `<div class="ed-live" id="edLiveBox" style="--k:${L.color}">
    <div class="ed-live-l">
      <div class="sub">Eon · working live</div>
      <div class="st"><span class="dot ${L.thinking ? 'on' : ''}"></span><b class="lbl">${L.label}</b></div>
      <div class="bar"><span style="width:${L.thinking ? pct(L.progress) : 100}%"></span></div>
    </div>
    <div class="ed-trace">
      <div class="th"><i class="bi bi-list-columns-reverse"></i>Reasoning trace · show your work</div>
      <div class="tl">${rows}</div>
    </div>
  </div>`;
}

function askBar() {
  return `<div class="ed-ask"><i class="bi bi-stars q"></i><input id="edAsk" placeholder="Ask Eon anything about your data — e.g. “which opportunity should I focus on this week?”"><button id="edAskBtn">Ask Eon</button></div>`;
}

/* ---------------- render ---------------- */
const EonDeck = {
  _tick: null,
  mount(el) {
    injectStyle();
    const host = el || document.getElementById('eonDeck');
    if (!host) return;
    this._host = host;
    this.render();
    if (this._tick) clearInterval(this._tick);
    this._tick = setInterval(() => this._refreshLive(), 1000);
  },
  render() {
    const host = this._host || document.getElementById('eonDeck'); if (!host) return;
    if (!ownerOK()) { host.innerHTML = `<div class="ed-card" style="text-align:center;padding:44px">Sign in as the owner to see Eon's intelligence.</div>`; return; }
    let m; try { m = compute(); } catch { host.innerHTML = `<div class="ed-card">Warming up…</div>`; return; }
    const L = live();
    // Business section only shows cards that have real content (no empty space).
    const bizCards = [(m.leaks && m.leaks.hasData) ? cardMoney(m.leaks) : '', cardBoard(), cardTwin(), cardProver()].filter(Boolean);
    host.innerHTML = `
      <div class="ed-hero">
        <div><h1>Intelligence</h1><p>Everything Eon reads, predicts and decides across your operation — one brain, explained.</p></div>
      </div>

      ${liveSection(m, L)}
      ${askBar()}

      <div class="ed-sec">
        <div class="ed-seclabel"><b>Intelligence</b></div>
        <div class="ed-grid ed-2">${cardWin(m.win)}${cardStory(m.eda) || cardProver()}</div>
        <div class="ed-grid" style="margin-top:16px">${cardCalibration()}</div>
      </div>

      <div class="ed-sec">
        <div class="ed-seclabel"><b>Business</b></div>
        <div class="ed-grid ${bizCards.length >= 3 ? 'ed-3' : bizCards.length === 2 ? 'ed-2' : ''}">${bizCards.join('')}</div>
      </div>

      <div class="ed-sec">
        <div class="ed-seclabel"><b>Reports</b></div>
        ${m.impact ? `<div class="ed-grid" style="margin-bottom:16px">${cardImpact(m.impact)}</div>` : ''}
        <div class="ed-grid ed-2">${cardRadar(m.radar, m.overdue)}${cardSources(m.entities, m.records)}</div>
      </div>`;

    host.querySelectorAll('#edProve, .ed-provetrigger').forEach((pv) => { pv.onclick = () => { try { window.EonProver && window.EonProver.openOverlay({ onReact: () => setTimeout(() => this.render(), 400) }); } catch {} }; });
    const bd = host.querySelector('#edBoard');
    if (bd) bd.onclick = () => { try { window.EonBoardroom && window.EonBoardroom.open(); } catch {} };
    const tw = host.querySelector('#edTwin');
    if (tw) tw.onclick = () => { try { window.EonTwin && window.EonTwin.open(); } catch {} };
    const ask = host.querySelector('#edAsk'), askBtn = host.querySelector('#edAskBtn');
    const doAsk = () => {
      const q = (ask && ask.value || '').trim(); if (!q) return;
      // a decision → convene the board; a question → the existing Ask EON engine
      if (DECISION_RE.test(q)) { try { window.EonBoardroom && window.EonBoardroom.open(q); } catch {} }
      else { try { const chip = document.getElementById('eon-ask-chip'); if (chip) chip.click(); } catch {} }
      if (ask) ask.value = '';
    };
    if (askBtn) askBtn.onclick = doAsk;
    if (ask) ask.onkeydown = (e) => { if (e.key === 'Enter') doAsk(); };
  },
  _refreshLive() {
    const el = document.getElementById('edLiveBox'); if (!el || !ownerOK()) return;
    const L = live();
    el.style.setProperty('--k', L.color);
    const dot = el.querySelector('.dot'); if (dot) dot.className = 'dot' + (L.thinking ? ' on' : '');
    const lbl = el.querySelector('.lbl'); if (lbl) lbl.textContent = L.label;
    const bar = el.querySelector('.bar > span'); if (bar) bar.style.width = (L.thinking ? pct(L.progress) : 100) + '%';
    // keep the trace fresh (compute() grows it; re-render just the list)
    try { compute(); } catch {}
    const tl = el.querySelector('.tl'); if (tl && _trace.length) tl.innerHTML = _trace.map((t) => `<div class="tr"><i>${t.t}</i><span>${esc(t.line)}</span></div>`).join('');
  },
  refresh() { this.render(); },
};

if (typeof window !== 'undefined') {
  window.EonDeck = Object.assign(window.EonDeck || {}, EonDeck);
  const boot = () => { if (document.getElementById('eonDeck')) EonDeck.mount(); };
  let n = 0; const iv = setInterval(() => { n++; if (document.getElementById('eonDeck') && brain()) { clearInterval(iv); boot(); } if (n > 60) clearInterval(iv); }, 200);
  if (document.readyState !== 'loading') boot();
}
export default EonDeck;
