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
import '../intel/selfcorrect.js'; // registers window.EonSelfCorrect (feature c)
import '../intel/crisis.js';      // registers window.EonCrisis (feature d — market fusion, kept for the money coach)
import '../analytics/oppradar.js';// registers window.EonOppRadar (opportunity discovery)
import '../analytics/scholar.js'; // registers window.EonScholar (the Academic brain)
import '../analytics/graph.js';   // registers window.EonGraph (relationship-graph intelligence)
import '../analytics/learn.js';   // registers window.EonLearn (adaptive learning loop)
import '../analytics/finance.js'; // registers window.EonFinance (personal-finance coach)
import '../intel/agent.js';       // registers window.EonAgent (NL -> action agent, idea #3)

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
  if (_trace[0] && _trace[0].line === line) return;   // skip consecutive duplicates
  const d = new Date();
  _trace.unshift({ t: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), line });
  if (_trace.length > 12) _trace.length = 12;
}
/** collapse consecutive duplicate lines for display (other modules push directly). */
function traceRows() {
  const out = []; let last = null;
  for (const t of _trace) { if (t.line !== last) { out.push(t); last = t.line; } }
  return out.slice(0, 6);
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
  const finance = (() => { try { return window.EonFinance ? window.EonFinance.analyze() : null; } catch { return null; } })();
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

  return { keys, records: recs.length, upcoming: upcoming.length, overdue: overdue.length, radar, eda, primaryKey, entities, win, leaks, finance, impact };
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
  /* academic space */
  #eonDeck .ed-improve{border-left:3px solid ${AM}}
  #eonDeck .ed-improve-head{display:flex;gap:13px;align-items:flex-start;padding:4px 0 12px;border-bottom:1px dashed var(--line,#e7eaf1);margin-bottom:10px}
  #eonDeck .ed-impgrade{font:800 17px "JetBrains Mono";color:${R};background:#fdeceb;border-radius:10px;padding:7px 12px;flex:0 0 auto}
  #eonDeck .ed-improve-head b{font-size:14px;color:#111634;display:block}
  #eonDeck .ed-improve-head small{color:var(--text-soft,#5b6678);font-size:12.5px;line-height:1.5;display:block;margin-top:2px}
  #eonDeck .ed-plan{display:flex;gap:11px;padding:9px 0;border-bottom:1px solid var(--line-2,#eef1f6)}
  #eonDeck .ed-plan:last-of-type{border-bottom:0}
  #eonDeck .ed-plann{width:22px;height:22px;flex:0 0 auto;border-radius:7px;background:#fdf2e0;color:${AM};display:grid;place-items:center;font:700 11px "JetBrains Mono"}
  #eonDeck .ed-plan b{font-size:13px;color:#16203a;text-transform:capitalize}
  #eonDeck .ed-plan small{color:var(--text-soft);font-size:11.5px}
  #eonDeck .ed-planres{display:flex;flex-wrap:wrap;gap:6px;margin-top:5px}
  #eonDeck .ed-planres a{display:inline-flex;align-items:center;gap:5px;font:600 11px "Inter";color:${A};border:1px solid var(--line,#e7eaf1);border-radius:999px;padding:3px 10px;text-decoration:none}
  #eonDeck .ed-planres a:hover{border-color:${A};background:#eef0fe}
  #eonDeck .ed-improve-actions{display:flex;gap:9px;margin-top:13px;flex-wrap:wrap}
  #eonDeck .ed-focuschip{display:inline-flex;align-items:center;gap:7px;background:#fdf2e0;border:1px solid #f2dfb8;color:#7a4d06;border-radius:999px;padding:5px 7px 5px 12px;font:600 12px "Inter";margin:0 6px 6px 0}
  #eonDeck .ed-focuschip em{font-style:normal;font-size:10px;opacity:.7}
  #eonDeck .ed-focusrm{border:0;background:none;color:inherit;opacity:.6;cursor:pointer;font-size:11px}
  #eonDeck .ed-focusrm:hover{opacity:1}
  /* calibration verification table */
  #eonDeck .ed-verify-btn{margin-top:12px;border:0;background:none;color:${A};font:600 12px "Inter";cursor:pointer;padding:0}
  #eonDeck .ed-verify-btn:hover{text-decoration:underline}
  #eonDeck .ed-verify{margin-top:14px;border-top:1px solid var(--line-2,#eef1f6);padding-top:10px}
  #eonDeck .ed-verify-hd,#eonDeck .ed-verify-row{display:grid;grid-template-columns:1fr 92px 62px 92px;gap:8px;align-items:center;font-size:12px;padding:7px 0}
  #eonDeck .ed-verify-hd{font:700 9.5px "Inter";color:var(--text-faint);text-transform:uppercase;letter-spacing:.06em}
  #eonDeck .ed-verify-row{border-top:1px solid var(--line-2,#eef1f6)}
  #eonDeck .ed-verify-row .nm{color:#16203a;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #eonDeck .ed-verify-row .pr{font-family:"JetBrains Mono";color:${A};font-weight:700}
  #eonDeck .ed-verify-row .ac.w{color:${G};font-weight:600}
  #eonDeck .ed-verify-row .ac.l{color:${R};font-weight:600}
  #eonDeck .ed-verify-row .mk.ok{color:${G};font-size:11.5px;font-weight:600}
  #eonDeck .ed-verify-row .mk.no{color:${R};font-size:11.5px;font-weight:600}
  #eonDeck .ed-verify-foot{font-size:11px;color:var(--text-faint);margin-top:9px;line-height:1.45}
  /* money coach */
  #eonDeck .ed-money-headline{display:flex;gap:9px;align-items:flex-start;font-size:14px;color:#16203a;line-height:1.5;padding:2px 0 12px;border-bottom:1px dashed var(--line,#e7eaf1);margin-bottom:12px}
  #eonDeck .ed-money-headline i{font-size:17px;margin-top:1px}
  #eonDeck .ed-money-headline b{color:#111634}
  #eonDeck .ed-fcast{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:6px}
  #eonDeck .ed-fcast>div{background:var(--surface-2,#fbfcfe);border:1px solid var(--line-2,#eef1f6);border-radius:11px;padding:10px 12px}
  #eonDeck .ed-fcast .v{font:700 18px "JetBrains Mono";display:block;line-height:1.1}
  #eonDeck .ed-fcast .l{font-size:11px;color:var(--text-soft);font-weight:500}
  #eonDeck .ed-money-sec{font:700 10.5px "Inter";text-transform:uppercase;letter-spacing:.07em;color:var(--text-faint);margin:16px 0 8px}
  #eonDeck .ed-tips{display:flex;flex-direction:column;gap:7px}
  #eonDeck .ed-tip{display:flex;gap:9px;align-items:flex-start;font-size:13px;color:#374151;line-height:1.5;background:linear-gradient(180deg,#f7fbf8,#fff);border:1px solid #e2f0e8;border-radius:10px;padding:9px 12px}
  #eonDeck .ed-tip i{color:${G};font-size:14px;margin-top:2px;flex:0 0 auto}
  #eonDeck .ed-tip b{color:#111634}
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
  /* quick-jump navigation (sticky at the top of the page) */
  #eonDeck .ed-nav{position:sticky;top:0;z-index:6;display:flex;gap:7px;flex-wrap:wrap;padding:9px 0 11px;margin-bottom:6px;
    background:linear-gradient(180deg,var(--canvas,#f5f7fb) 82%,transparent)}
  #eonDeck .ed-navbtn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,#e7eaf1);background:#fff;
    border-radius:999px;padding:7px 14px;font:600 12px "Inter",system-ui;color:var(--text-soft,#5b6678);cursor:pointer;transition:.15s}
  #eonDeck .ed-navbtn i{font-size:12px;color:${A}}
  #eonDeck .ed-navbtn:hover{border-color:${A};color:${A};transform:translateY(-1px)}
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
  #eonDeck .ed-ask{display:flex;gap:10px;align-items:center;background:#fff;border:1px solid var(--line,#e7eaf1);border-radius:14px;padding:7px 7px 7px 17px;margin-bottom:12px;transition:border-color .15s,box-shadow .15s}
  #eonDeck .ed-ask:focus-within{border-color:${A};box-shadow:0 0 0 3px rgba(79,70,229,.12)}
  #eonDeck .ed-ask .q{color:${A};font-size:17px}
  #eonDeck .ed-ask input{flex:1;border:0;outline:0;font:500 14px "Inter";color:#16203a;background:transparent}
  #eonDeck .ed-ask input::placeholder{color:var(--text-faint,#9aa3b2)}
  #eonDeck .ed-ask button{border:0;background:${A};color:#fff;border-radius:10px;padding:10px 18px;font:700 12.5px "Inter";cursor:pointer;transition:background .15s}
  #eonDeck .ed-ask button:hover{background:#4338ca}
  /* inline Ask Eon answer (right on the deck, not a floating popup) */
  #eonDeck .ed-answer{background:#fff;border:1px solid var(--line,#e7eaf1);border-radius:14px;padding:14px 17px;margin-bottom:28px}
  #eonDeck .ed-ansq{font:600 12.5px "Inter";color:var(--text-faint,#9aa3b2);margin-bottom:8px}
  #eonDeck .ed-ansa{font-size:14px;color:#1f2937;line-height:1.55}
  #eonDeck .ed-ansa .sp{color:#16203a;font-weight:500}
  #eonDeck .ed-ansa .dt{margin-top:8px;display:flex;flex-direction:column;gap:4px;color:#374151;font-size:13px}
  #eonDeck .ed-ansa .dt>div{padding-left:2px}
  #eonDeck .ed-anstyping{color:var(--text-faint,#9aa3b2);font-weight:500}
  #eonDeck .ed-anstyping i{font-style:normal;animation:edtype 1.2s infinite}
  #eonDeck .ed-anstyping i:nth-child(2){animation-delay:.2s}#eonDeck .ed-anstyping i:nth-child(3){animation-delay:.4s}
  @keyframes edtype{0%,60%,100%{opacity:.25}30%{opacity:1}}
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
function cardMoney(F, L) {
  const hasF = F && F.hasData, hasL = L && L.hasData;
  if (!hasF && !hasL) return '';
  const fmt = (n) => { try { return typeof window.fmtBDT === 'function' ? window.fmtBDT(Math.round(n)) : '৳' + Math.round(n).toLocaleString(); } catch { return '৳' + Math.round(n); } };
  // yearly forecast tiles
  const fc = hasF ? `<div class="ed-fcast">
    <div><span class="v" style="color:${G}">${fmt(F.yearly.income)}</span><span class="l">income / yr</span></div>
    <div><span class="v" style="color:#16203a">${fmt(F.yearly.expense)}</span><span class="l">spend / yr</span></div>
    <div><span class="v" style="color:${F.netM >= 0 ? G : R}">${fmt(Math.abs(F.yearly.net))}</span><span class="l">${F.netM >= 0 ? 'saved' : 'short'} / yr</span></div>
    ${F.potentialYearly > 0 ? `<div><span class="v" style="color:${A}">${fmt(F.potentialYearly)}</span><span class="l">savable / yr</span></div>` : ''}
  </div>` : '';
  const tips = hasF && F.tips.length ? `<div class="ed-money-sec">Where you can save</div><div class="ed-tips">${F.tips.map((t) => `<div class="ed-tip"><i class="bi bi-piggy-bank-fill"></i><span>${t.text}</span></div>`).join('')}</div>` : '';
  // anomalies as secondary watch-outs
  const leakItems = [];
  if (hasL && L.overrun) leakItems.push({ amt: L.overrun.over, c: R, h: 'Over budget', w: `Spent ${fmt(L.overrun.spend)} of a ${fmt(L.overrun.budget)} budget.` });
  if (hasL) (L.flags || []).slice(0, 3).forEach((f) => leakItems.push({ amt: f.amount, c: f.kind === 'duplicate' ? AM : R, h: f.kind === 'duplicate' ? 'Possible duplicate' : (f.zLabel ? f.zLabel + 'σ outlier' : 'Anomaly'), w: f.why }));
  const leaks = leakItems.length ? `<div class="ed-money-sec">Watch-outs Eon caught</div>${leakItems.map((it) => `<div class="ed-leak"><span class="amt" style="color:${it.c}">${fmt(it.amt)}</span><span><b>${esc(it.h)}</b><small>${it.w}</small></span></div>`).join('')}` : '';
  const sub = hasF ? `${F.months} months of your ledger · forecast, savings & watch-outs` : `${L.txCount} transactions scanned`;
  const body = `${hasF ? `<div class="ed-money-headline"><i class="bi bi-${F.netM >= 0 ? 'graph-up-arrow' : 'graph-down-arrow'}" style="color:${F.netM >= 0 ? G : R}"></i><span>${F.headline}</span></div>` : ''}${fc}${tips}${leaks || (hasF && !tips ? `<p class="ed-empty">Your spending looks clean — nothing to flag. 🌿</p>` : '')}`;
  return `<div class="ed-card ed-money-card"><div class="ed-ct">Money coach</div><div class="ed-cs">${sub}</div>${body}</div>`;
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
function cardAgent() {
  return card('Action agent', 'tell Eon what to do — it plans, you approve, it writes', `<p class="ed-empty">“Plan my Chevening application and remind me every Sunday.” Eon turns a messy instruction into a dated plan and — on your approval — writes the reminders to your synced brain. Advisory-first.</p><button class="ed-cardbtn" id="edAgent"><i class="bi bi-robot me-1"></i>Give Eon a task</button>`);
}
const COMMAND_RE = /\b(plan|prepare|prep|remind|create|build|organi[sz]e|set ?up|schedule|draft me|make me|apply)\b/i;
// The boardroom is for true YES/NO business decisions only ("should I hire…?").
// Questions like "what should I focus on?" are Ask-Eon questions and must be
// answered INLINE — so require a decision opener + a business-action verb.
const DECISION_RE = /(?:\b(?:should|shall|do|dare)\s+i\b|\bis it worth\b|\bworth it\b|\bbetter to\b)[^?]*\b(hire|fire|recruit|staff|buy|purchase|invest|equipment|expand|launch|open|scale|borrow|loan|debt|quit|drop|cancel|shut|close|pivot|raise (?:my )?price|discount|outsource|partner|franchise)\b|\bconvene\b|\bboard meeting\b/i;

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
        <button class="ed-verify-btn" id="edCalVerify">Show the ${c.n} comparisons Eon checked ▾</button>
      </div>
    </div>
    <div class="ed-verify" id="edCalTable" hidden>
      <div class="ed-verify-hd"><span>Opportunity</span><span>Eon predicted</span><span>Actually</span><span></span></div>
      ${(c.detail || []).map((d) => `<div class="ed-verify-row">
        <span class="nm">${esc(d.name)}</span>
        <span class="pr">${Math.round(d.p * 100)}%</span>
        <span class="ac ${d.won ? 'w' : 'l'}">${d.won ? 'Won' : 'Lost'}</span>
        <span class="mk ${d.correct ? 'ok' : 'no'}">${d.correct ? '✓ matched' : '✗ missed'}</span>
      </div>`).join('')}
      <div class="ed-verify-foot">Accuracy = correct calls ÷ ${c.n}. A call is “correct” when a &gt;50% prediction won (or a &lt;50% prediction lost). Recomputed live from your synced outcomes.</div>
    </div>`);
}

function cardSelfCorrect() {
  return card('Self-correction', 'reflection loop — Eon checks &amp; reweights itself', `<p class="ed-empty">Watch Eon audit its own prediction, catch where it's over-confident against its track record, explain the miss, and <b>reweight itself live</b> — a correction that persists.</p><button class="ed-cardbtn" id="edSelf"><i class="bi bi-arrow-repeat me-1"></i>Run the self-check</button>`);
}
function cardOppRadar() {
  return card('Opportunity radar', 'live contests & scholarships matched to your fields', `<div id="edOppRadarBody"><p class="ed-empty">Scanning for opportunities that fit you…</p></div>`);
}

function cardGraph(g) {
  if (!g || !g.ok) return '';
  const recs = g.recs.slice(0, 4).map((r) => `<div style="padding:8px 0;border-top:1px solid var(--line-2,#eef1f6)"><b style="font-size:12.5px;color:#16203a">${esc(r.contact)}</b><small style="display:block;color:var(--text-soft);font-size:11.5px">strongest referee for <b>${esc(r.opp)}</b> · ${r.shared} shared ${r.shared > 1 ? 'themes' : 'theme'}</small></div>`).join('');
  const neg = g.neglected.slice(0, 2).map((n) => `<div style="font-size:12px;color:${AM};margin-top:8px"><i class="bi bi-arrow-repeat me-1"></i>You've gone quiet with <b>${esc(n.name)}</b> — ${n.days} days. Reach out.</div>`).join('');
  return `<div class="ed-card">
    <div class="ed-ct">Relationship graph</div><div class="ed-cs">${g.contacts} contacts × ${g.opps} opportunities · who to ask for what</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:center">
      <div style="min-width:0">${g.edges.length ? window.EonGraph.graphSvg(g) : '<p class="ed-empty">No overlaps yet.</p>'}</div>
      <div style="min-width:0"><div style="font:700 11px Inter;text-transform:uppercase;letter-spacing:.06em;color:var(--text-faint);margin-bottom:2px">Best referees</div>${recs || '<p class="ed-empty">Add fields/skills to your contacts and Eon matches them to opportunities.</p>'}${neg}</div>
    </div>
  </div>`;
}

function cardLearn() {
  let s = null; try { s = window.EonLearn && window.EonLearn.summary(); } catch {}
  if (!s || !s.ok) return '';
  const rows = s.rows.slice(0, 5).map((r) => `<div style="display:flex;align-items:center;gap:10px;padding:5px 0"><span style="flex:0 0 108px;font-size:12.5px;color:#16203a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.cat)}</span><span style="flex:1;height:6px;border-radius:3px;background:var(--line,#e7eaf1)"><span style="display:block;height:100%;border-radius:3px;width:${Math.round(r.weight * 100)}%;background:linear-gradient(90deg,${A},#0ea5e9)"></span></span><span class="ed-num" style="font-size:11.5px;color:var(--text-soft);min-width:26px;text-align:right">${Math.round(r.weight * 100)}</span></div>`).join('');
  return card('Adaptive learning', 'online learning — Eon tunes to your behaviour', `${rows}<p class="ed-empty" style="margin-top:10px">${s.line}</p>`);
}

/* ---------- Academic space cards (§6) ---------- */
function cardAcadFusion(s) {
  const rows = (s.fusion || []).map((f) => `
    <a class="ed-row" href="${esc(f.link || 'academics.html')}">
      <span class="ed-cd ${f.days != null && f.days <= 2 ? 'soon' : ''}">${f.days == null ? '—' : f.days < 0 ? 'over' : f.days === 0 ? 'today' : f.days + 'd'}</span>
      <span style="flex:1;min-width:0"><b>${esc(f.label)}</b><small>${esc(f.kind)}${f.course ? ' · ' + esc(f.course) : ''} · <i style="font-style:italic">${esc(f.why)}</i></small></span>
    </a>`).join('');
  return card('Everything due, fused', 'tests + assignments + opportunities, one realistic order', rows || `<p class="ed-empty">Nothing pressing across your academic and opportunity pipelines. 🌿</p>`);
}
function cardAcadPerf(s) {
  const p = s.perf || {};
  if (!p.n) return card('Performance', 'course-wise & topic-wise results', `<p class="ed-empty">Log assessment results (marks, topics, class average) and Eon maps exactly where you're strong and weak.</p>`);
  const cRows = (p.courses || []).slice(0, 4).map((c) => {
    const v = Math.round(c.avg * 100); const tone = v >= 75 ? G : v >= 60 ? AM : R;
    return `<div style="display:flex;align-items:center;gap:10px;padding:5px 0">
      <span style="flex:0 0 96px;font:700 11.5px 'JetBrains Mono';color:#16203a">${esc(c.short)}</span>
      <span style="flex:1;height:6px;border-radius:3px;background:var(--line,#e7eaf1)"><span style="display:block;height:100%;border-radius:3px;width:${v}%;background:${tone}"></span></span>
      <span class="ed-num" style="font-size:12px;color:${tone};min-width:34px;text-align:right">${v}%</span>
      ${c.trend > 0.05 ? `<i class="bi bi-arrow-up-right" style="color:${G};font-size:11px"></i>` : c.trend < -0.05 ? `<i class="bi bi-arrow-down-right" style="color:${R};font-size:11px"></i>` : '<span style="width:11px"></span>'}
    </div>`;
  }).join('');
  const tRows = (p.topics || []).slice(0, 3).map((t) => `<span class="ed-chip"><b>${esc(t.topic)}</b><i>${Math.round(t.avg * 100)}%</i></span>`).join('');
  return card('Performance', `${p.n} results analysed · course & topic level`, `${cRows}${tRows ? `<div style="font:700 10px Inter;text-transform:uppercase;letter-spacing:.07em;color:var(--text-faint);margin:12px 0 6px">Weakest topics first</div><div class="ed-chips" style="margin-top:0">${tRows}</div>` : ''}${p.pattern ? `<p class="ed-empty" style="margin-top:12px"><i class="bi bi-lightbulb" style="color:${AM};margin-right:5px"></i>${p.pattern}</p>` : ''}`);
}
function cardImprove(s) {
  const im = s.improve || {};
  const focus = s.focus || [];
  if ((!im.findings || !im.findings.length) && !focus.length) return '';
  const f = im.top;
  const planRows = f && im.plan ? im.plan.map((st) => `
    <div class="ed-plan">
      <span class="ed-plann">${st.order}</span>
      <div style="flex:1;min-width:0">
        <b>${esc(st.topic)}</b><small> · currently ${esc(st.score)} · budget ~${st.hours}h</small>
        <div class="ed-planres">${st.resources.map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener"><i class="bi bi-play-circle"></i>${esc(r.label)}</a>`).join('')}</div>
      </div>
    </div>`).join('') : '';
  const focusRows = focus.map((x) => `<span class="ed-focuschip" title="${esc(x.reason || '')}"><i class="bi bi-bullseye"></i>${esc(shortName(x.course))} <em>since ${esc(x.since)}</em><button class="ed-focusrm" data-course="${esc(x.course)}">✕</button></span>`).join('');
  return `<div class="ed-card ed-improve">
    <div class="ed-ct">Improvement engine</div>
    <div class="ed-cs">Eon found the weak spot and built the study plan — with real resources</div>
    ${f ? `<div class="ed-improve-head"><span class="ed-impgrade">${esc(f.grade)}</span><div><b>${esc(f.short)}</b><small>${esc(f.why)}</small></div></div>${planRows}
      <div class="ed-improve-actions">
        <button class="ed-cardbtn" id="edFocusAdd" data-course="${esc(f.course)}" data-why="${esc(f.why)}"><i class="bi bi-bullseye me-1"></i>Add to Focus List</button>
        <button class="ed-cardbtn" id="edPlanRemind"><i class="bi bi-alarm me-1"></i>Remind me to study these</button>
      </div>` : ''}
    ${focusRows ? `<div style="font:700 10px Inter;text-transform:uppercase;letter-spacing:.07em;color:var(--text-faint);margin:14px 0 7px">Active focus</div><div>${focusRows}</div>` : ''}
  </div>`;
}
function shortName(label) { return String(label || '').split(' — ')[0]; }
function cardAcadAnomalies(s) {
  const an = s.anomalies || [];
  if (!an.length) return '';
  const ico = { attendance: 'person-x', grade: 'graph-down-arrow', workload: 'stack' };
  return card('Academic anomalies', 'unusual for YOU — caught early', an.map((a) => `
    <div class="ed-leak"><span class="amt" style="color:${a.kind === 'grade' ? R : AM};font-size:13px"><i class="bi bi-${ico[a.kind] || 'exclamation-triangle'}"></i></span>
    <span><b>${esc(a.label)}</b><small>${esc(a.why)}</small></span></div>`).join(''));
}

function card(title, sub, body) { return `<div class="ed-card"><div class="ed-ct">${title}</div><div class="ed-cs">${sub}</div>${body}</div>`; }

function liveSection(m, L) {
  const tr = traceRows();
  const rows = tr.length ? tr.map((t) => `<div class="tr"><i>${t.t}</i><span>${esc(t.line)}</span></div>`).join('') : `<div class="tr"><span>Warming up the intelligence layer…</span></div>`;
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
  return `<div class="ed-ask"><i class="bi bi-stars q"></i><input id="edAsk" placeholder="Ask Eon anything — “what should I focus on?”, “where can I save money?”, or just say hi"><button id="edAskBtn">Ask Eon</button></div>
    <div class="ed-answer" id="edAnswer" hidden></div>`;
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
    this._sig = this._dataSig();
    if (this._tick) clearInterval(this._tick);
    // EonBrain loads async and only has data after its first meditation cycle (and
    // owner may sign in after load). Watch the data signature and do a FULL re-render
    // when it changes — otherwise just refresh the live card. This is what makes the
    // page fill in on a real session instead of showing an empty/sign-in deck.
    this._tick = setInterval(() => {
      try {
        const sig = this._dataSig();
        if (sig !== this._sig) { this._sig = sig; this.render(); }
        else this._refreshLive();
      } catch {}
    }, 1200);
  },
  _dataSig() {
    try {
      const b = brain();
      const owner = ownerOK() ? 1 : 0;
      const r = (b && b.getRecords) ? b.getRecords().length : 0;
      const e = (b && b.getEntities) ? Object.keys(b.getEntities()).length : 0;
      const s = (() => { try { return (window.EonSignals && window.EonSignals.at) || 0; } catch { return 0; } })();
      const fin = (() => { try { const F = window.FinanceDB; return (F && F.data && F.data.tx) ? F.data.tx.length : 0; } catch { return 0; } })();
      return owner + ':' + r + ':' + e + ':' + s + ':' + fin;
    } catch { return ''; }
  },
  render() {
    const host = this._host || document.getElementById('eonDeck'); if (!host) return;
    if (!ownerOK()) {
      // keep the adopted native panels alive across the wipe (e.g. sign-out → sign-in)
      let nat = null; try { nat = host.querySelector('.eon-native'); if (nat) nat.parentElement.removeChild(nat); } catch {}
      host.innerHTML = `<div class="ed-card" style="text-align:center;padding:44px">Sign in as the owner to see Eon's intelligence.</div>`;
      if (nat) host.appendChild(nat);
      return;
    }
    // Preserve the host site's native panels (Signal radar / Realistic day / Tracks /
    // Pulse): detach BEFORE we wipe innerHTML so the node survives re-renders, then
    // re-adopt it into the slot right after the prover.
    let native = null;
    try { native = document.querySelector('.eon-native'); if (native && native.parentElement) native.parentElement.removeChild(native); } catch {}
    let m; try { m = compute(); } catch { host.innerHTML = `<div class="ed-card">Warming up…</div>`; if (native) host.appendChild(native); return; }
    const L = live();
    // Business section only shows cards that have real content (no empty space).
    const moneyCoach = ((m.finance && m.finance.hasData) || (m.leaks && m.leaks.hasData)) ? cardMoney(m.finance, m.leaks) : '';
    const bizCards = [cardBoard(), cardTwin(), cardAgent(), cardOppRadar()].filter(Boolean);
    let graph = null; try { graph = window.EonGraph && window.EonGraph.compute(); } catch {}
    const hasNet = !!(graph && graph.ok);
    let scholar = null; try { scholar = window.EonScholar && window.EonScholar.compute(); } catch {}
    const hasAcad = !!(scholar && scholar.ok);
    // quick-jump navigation for the growing page (Live / Signals / sections)
    const navBtn = (id, ico, label) => `<button class="ed-navbtn" data-go="${id}"><i class="bi bi-${ico}"></i>${label}</button>`;
    const navRow = `<div class="ed-nav" id="edNav">
      ${navBtn('edLiveBox', 'activity', 'Live')}
      ${navBtn('edProverSec', 'upload', 'Prover')}
      ${navBtn('edNativeSlot', 'broadcast-pin', 'Signals')}
      ${hasAcad ? navBtn('edSecAcad', 'mortarboard', 'Academics') : ''}
      ${navBtn('edSecIntel', 'graph-up-arrow', 'Intelligence')}
      ${navBtn('edSecBiz', 'briefcase', 'Business')}
      ${hasNet ? navBtn('edSecNet', 'diagram-3', 'Network') : ''}
      ${navBtn('edSecRep', 'clipboard-data', 'Reports')}
    </div>`;
    host.innerHTML = `
      <div class="ed-hero">
        <div><h1>Intelligence</h1><p>Everything Eon reads, predicts and decides across your operation — one brain, explained.</p></div>
      </div>

      ${navRow}
      ${liveSection(m, L)}
      ${askBar()}
      <div class="ed-sec" id="edProverSec"><div class="ed-grid">${cardProver()}</div></div>

      <!-- host site's native panels (Signal radar / Realistic day / Tracks / Pulse)
           are adopted into this slot after each render — see the adopt logic below -->
      <div id="edNativeSlot" class="ed-sec"></div>

      ${hasAcad ? `<div class="ed-sec" id="edSecAcad">
        <div class="ed-seclabel"><b>Academics</b></div>
        ${(() => { const imp = cardImprove(scholar); return imp ? `<div class="ed-grid" style="margin-bottom:16px">${imp}</div>` : ''; })()}
        <div class="ed-grid ed-2">${cardAcadFusion(scholar)}${cardAcadPerf(scholar)}</div>
        ${(() => { const an = cardAcadAnomalies(scholar); return an ? `<div class="ed-grid" style="margin-top:16px">${an}</div>` : ''; })()}
      </div>` : ''}

      <div class="ed-sec" id="edSecIntel">
        <div class="ed-seclabel"><b>Intelligence</b></div>
        <div class="ed-grid ed-2">${cardWin(m.win)}${cardStory(m.eda) || cardProver()}</div>
        <div class="ed-grid ed-2" style="margin-top:16px">${cardCalibration()}${cardSelfCorrect()}</div>
      </div>

      <div class="ed-sec" id="edSecBiz">
        <div class="ed-seclabel"><b>Business</b></div>
        ${moneyCoach ? `<div class="ed-grid" style="margin-bottom:16px">${moneyCoach}</div>` : ''}
        <div class="ed-grid ${bizCards.length >= 3 ? 'ed-3' : bizCards.length === 2 ? 'ed-2' : ''}">${bizCards.join('')}</div>
      </div>

      ${hasNet ? `<div class="ed-sec" id="edSecNet"><div class="ed-seclabel"><b>Network</b></div><div class="ed-grid">${cardGraph(graph)}</div></div>` : ''}

      <div class="ed-sec" id="edSecRep">
        <div class="ed-seclabel"><b>Reports</b></div>
        ${m.impact ? `<div class="ed-grid" style="margin-bottom:16px">${cardImpact(m.impact)}</div>` : ''}
        ${(() => { const rep = [cardRadar(m.radar, m.overdue), cardSources(m.entities, m.records), cardLearn()].filter(Boolean); return `<div class="ed-grid ${rep.length >= 3 ? 'ed-3' : 'ed-2'}">${rep.join('')}</div>`; })()}
      </div>`;

    // adopt the native panels into their slot (right after the prover)
    try { const slot = host.querySelector('#edNativeSlot'); if (native && slot) slot.appendChild(native); } catch {}

    // quick-jump navigation
    host.querySelectorAll('.ed-navbtn').forEach((b) => { b.onclick = () => { try { const t = host.querySelector('#' + b.dataset.go) || document.getElementById(b.dataset.go); t && t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {} }; });

    host.querySelectorAll('#edProve, .ed-provetrigger').forEach((pv) => { pv.onclick = () => { try { window.EonProver && window.EonProver.openOverlay({ onReact: () => setTimeout(() => this.render(), 400) }); } catch {} }; });
    const bd = host.querySelector('#edBoard');
    if (bd) bd.onclick = () => { try { window.EonBoardroom && window.EonBoardroom.open(); } catch {} };
    const tw = host.querySelector('#edTwin');
    if (tw) tw.onclick = () => { try { window.EonTwin && window.EonTwin.open(); } catch {} };
    const sc = host.querySelector('#edSelf');
    if (sc) sc.onclick = () => { try { window.EonSelfCorrect && window.EonSelfCorrect.open(); } catch {} };
    const ag = host.querySelector('#edAgent');
    if (ag) ag.onclick = () => { try { window.EonAgent && window.EonAgent.open(); } catch {} };
    const cv = host.querySelector('#edCalVerify');
    if (cv) cv.onclick = () => { const t = host.querySelector('#edCalTable'); if (t) { t.hidden = !t.hidden; cv.textContent = cv.textContent.replace(/[▾▴]\s*$/, '').trim() + (t.hidden ? ' ▾' : ' ▴'); } };
    const orb = host.querySelector('#edOppRadarBody');
    if (orb && !orb._hydrated) { orb._hydrated = true; try { window.EonOppRadar && window.EonOppRadar.render(orb); } catch {} }
    // academic space actions
    const fa = host.querySelector('#edFocusAdd');
    if (fa) fa.onclick = () => { try { window.EonScholar.addFocus(fa.dataset.course, fa.dataset.why); this.render(); } catch {} };
    host.querySelectorAll('.ed-focusrm').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); try { window.EonScholar.removeFocus(b.dataset.course); this.render(); } catch {} }; });
    const pr = host.querySelector('#edPlanRemind');
    if (pr) pr.onclick = async () => {
      pr.disabled = true;
      try { const s = window.EonScholar.compute(); const n = await window.EonScholar.remindPlan(s.improve && s.improve.plan, s.improve && s.improve.top ? s.improve.top.short : 'course'); pr.innerHTML = `<i class="bi bi-check2-circle me-1"></i>${n} study reminders set`; } catch { pr.disabled = false; }
    };
    const ask = host.querySelector('#edAsk'), askBtn = host.querySelector('#edAskBtn');
    const doAsk = async () => {
      const q = (ask && ask.value || '').trim(); if (!q) return;
      // a command → the action agent; a decision → the board
      if (COMMAND_RE.test(q)) { try { window.EonAgent && window.EonAgent.open(q); } catch {} if (ask) ask.value = ''; return; }
      if (DECISION_RE.test(q)) { try { window.EonBoardroom && window.EonBoardroom.open(q); } catch {} if (ask) ask.value = ''; return; }
      // everything else → answer INLINE, right here on the deck
      const ans = host.querySelector('#edAnswer'); if (!ans) return;
      ans.hidden = false;
      ans.innerHTML = `<div class="ed-ansq">“${esc(q)}”</div><div class="ed-ansa"><span class="ed-anstyping">Eon is thinking<i>.</i><i>.</i><i>.</i></span></div>`;
      if (ask) ask.value = '';
      try {
        const r = (window.EonAsk && window.EonAsk.answer) ? await window.EonAsk.answer(q) : { speak: 'Ask Eon is warming up — try again in a second.' };
        const detail = r && r.detail ? (Array.isArray(r.detail) ? r.detail : String(r.detail).split('\n')) : [];
        ans.querySelector('.ed-ansa').innerHTML = `<div class="sp">${esc((r && r.speak) || '')}</div>${detail.length ? `<div class="dt">${detail.map((l) => `<div>${esc(l)}</div>`).join('')}</div>` : ''}`;
        try { window.EON && window.EON.character && window.EON.character.playEmote && window.EON.character.playEmote('point'); } catch {}
      } catch { const a = ans.querySelector('.ed-ansa'); if (a) a.textContent = 'I tripped on that — try rephrasing?'; }
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
    const tl = el.querySelector('.tl'); const tr = traceRows(); if (tl && tr.length) tl.innerHTML = tr.map((t) => `<div class="tr"><i>${t.t}</i><span>${esc(t.line)}</span></div>`).join('');
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
