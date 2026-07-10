/* ============================================================
   EON · intel/workstation.js  —  Intelligence Workstation
   ------------------------------------------------------------
   Eon's own, self-contained intelligence dashboard — it travels
   INSIDE the ai-companion folder, so dropping the folder into the
   ERP (or any Firestore-backed site) gives that site a full
   intelligence workstation with zero wiring.

   It reads whatever data the host exposes through window.EonBrain
   (discovered via discovery.js — getData / getRecords / getEntities),
   so it adapts to ANY schema. On sites that also compute richer
   signals (window.EonSignals / EonProductivity / EonProver) it folds
   them in; everywhere else it degrades to discovered-data-only.

   Surfaces: KPIs · live "what Eon is doing" process · auto-EDA data
   story on the primary entity · deadline radar · per-entity profiles
   · a launch into the Any-Dataset Prover. Fully client-side, offline
   safe, self-styled (explicit theme hexes so it looks right on any
   host). Owner-gated. Launch: window.EonWorkstation.open().
   ============================================================ */

import { profileDataset } from '../analytics/prover.js';
import '../models/win-predictor.js';   // registers window.EonWinPredictor
import '../analytics/anomaly.js';       // registers window.EonAnomaly
import '../analytics/impact.js';        // registers window.EonImpact (synced)

const T = {                      // theme (explicit — portable to any host)
  primary: '#4f46e5', primary700: '#3730a3', accent: '#0ea5e9',
  green: '#0f9d58', amber: '#c77d0a', red: '#d6453d', violet: '#7c3aed', slate: '#64748b',
  ink: '#101a33', ink2: '#16203a', soft: '#5b6678', faint: '#9aa3b2', line: '#e7eaf1',
};

/* ---------- data access (portable via EonBrain) ---------- */
function brain() { try { return window.EonBrain || null; } catch { return null; } }
function ownerOK() { const b = brain(); try { return !!(b && b.isOwner && b.isOwner()); } catch { return false; } }
function getData() { const b = brain(); try { return (b && b.getData && b.getData()) || {}; } catch { return {}; } }
function getRecords() { const b = brain(); try { return (b && b.getRecords && b.getRecords()) || []; } catch { return []; } }
function getEntities() { const b = brain(); try { return (b && b.getEntities && b.getEntities()) || {}; } catch { return {}; } }

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const escapeH = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const daysTo = (iso) => { const t = Date.parse(iso); return isNaN(t) ? null : Math.floor((t - Date.now()) / 86400000); };
const fmtD = (iso) => { const d = new Date(iso); return isNaN(d) ? String(iso || '') : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }); };

/* ---------- compute the workstation model from discovered data ---------- */
function compute() {
  const data = getData();
  const ents = getEntities();
  const recs = getRecords();
  const entityKeys = Object.keys(ents).filter((k) => Array.isArray(data[k]) && data[k].length);

  // KPIs
  const totalRecords = recs.length || entityKeys.reduce((s, k) => s + (data[k] ? data[k].length : 0), 0);
  const withDl = recs.filter((r) => r.deadlineAt && !isNaN(Date.parse(r.deadlineAt)));
  const upcoming = withDl.filter((r) => { const d = daysTo(r.deadlineAt); return d != null && d >= 0 && d <= 30; });
  const overdue = withDl.filter((r) => { const d = daysTo(r.deadlineAt); return d != null && d < 0; });
  // data health: share of records carrying their label + (if applicable) deadline
  let filled = 0, slots = 0;
  entityKeys.forEach((k) => {
    const desc = ents[k] || {}; const arr = data[k] || [];
    arr.forEach((r) => { if (!r || typeof r !== 'object') return; slots++; const lf = desc.labelField; if (!lf || (r[lf] != null && String(r[lf]).trim() !== '')) filled++; });
  });
  const health = slots ? filled / slots : 1;

  // primary entity = largest → run the auto-EDA profiler on it
  const primaryKey = entityKeys.slice().sort((a, b) => (data[b].length) - (data[a].length))[0] || null;
  let primary = null;
  if (primaryKey) { try { primary = profileDataset(data[primaryKey], primaryKey); } catch {} }

  // per-entity mini profiles
  const entities = entityKeys.map((k) => {
    const desc = ents[k] || {};
    return { key: k, count: (data[k] || []).length, label: desc.labelField || null, deadline: desc.deadlineField || null, dateFields: desc.dateFields || [], fields: (desc.fields || []).length };
  }).sort((a, b) => b.count - a.count);

  // deadline radar (soonest first)
  const radar = [...upcoming].sort((a, b) => Date.parse(a.deadlineAt) - Date.parse(b.deadlineAt)).slice(0, 6)
    .map((r) => ({ label: r.label, entity: r.entity, days: daysTo(r.deadlineAt), when: fmtD(r.deadlineAt), pointTo: r.pointTo }));

  // fold in richer host signals if present (OppTrack)
  const signals = (() => { try { return window.EonSignals && window.EonSignals.enabled ? window.EonSignals : null; } catch { return null; } })();
  const prod = (() => { try { return window.EonProductivity && window.EonProductivity.enabled ? window.EonProductivity : null; } catch { return null; } })();
  // win-probability model (portable — detects its own pipeline entity)
  const win = (() => { try { window.EonWinPredictor && window.EonWinPredictor.refresh(); return window.EonWinPredictor ? window.EonWinPredictor.summary() : null; } catch { return null; } })();
  // money radar — profit-leak / anomaly detection (portable finance discovery)
  const leaks = (() => { try { return window.EonAnomaly ? window.EonAnomaly.scan() : null; } catch { return null; } })();
  // quantified impact (synced running maxima)
  const impact = (() => { try { return window.EonImpact ? window.EonImpact.refresh() : null; } catch { return null; } })();

  return { entityKeys, totalRecords, upcoming: upcoming.length, overdue: overdue.length, health, primaryKey, primary, entities, radar, signals, prod, win, leaks, impact };
}

/* ---------- live process (what Eon is doing) ---------- */
const PROC = {
  idle: ['Watching quietly', 'eye', T.slate],
  meditating: ['Meditating on your data', 'stars', T.violet],
  'reading-section': ['Reading', 'journal-text', T.accent],
  insight: ['Surfaced an insight', 'lightbulb-fill', T.amber],
};
function live() {
  let s = { state: 'idle', progress: 1, section: null, message: null };
  try { const st = brain()?.getState?.(); if (st) s = st; } catch {}
  const meta = PROC[s.state] || PROC.idle;
  let label = meta[0];
  if (s.state === 'reading-section' && s.section) label = `Reading “${escapeH(s.section)}”`;
  if (s.state === 'insight' && s.message) label = escapeH(s.message);
  return { label, ico: meta[1], color: meta[2], progress: s.progress == null ? 1 : s.progress, thinking: s.state === 'meditating' || s.state === 'reading-section' };
}

/* =========================================================
   RENDER — full-screen overlay
   ========================================================= */
function injectStyle() {
  if (document.getElementById('eon-ws-style')) return;
  const s = document.createElement('style'); s.id = 'eon-ws-style';
  s.textContent = `
  #eon-ws{position:fixed;inset:0;z-index:2147483645;display:none;background:rgba(10,15,28,.55);backdrop-filter:blur(4px);
    font:500 14px/1.5 "Inter",system-ui,sans-serif}
  #eon-ws.show{display:block}
  #eon-ws .ws-shell{position:absolute;inset:2.5vh 2.5vw;background:#f5f7fb;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;
    box-shadow:0 40px 90px rgba(8,14,30,.5)}
  #eon-ws .ws-top{display:flex;align-items:center;gap:13px;padding:16px 22px;color:#fff;
    background:linear-gradient(115deg,#101a33 0%,#26268a 55%,#4f46e5 100%);flex:0 0 auto}
  #eon-ws .ws-orb{width:38px;height:38px;border-radius:12px;flex:0 0 auto;display:grid;place-items:center;font-size:19px;
    background:linear-gradient(135deg,#4f46e5,#0ea5e9);box-shadow:0 6px 18px rgba(14,165,233,.5)}
  #eon-ws .ws-top b{font:800 18px "Plus Jakarta Sans",system-ui;letter-spacing:-.01em}
  #eon-ws .ws-top small{display:block;opacity:.82;font-size:12px;font-weight:500}
  #eon-ws .ws-prove{margin-left:auto;border:0;cursor:pointer;border-radius:10px;padding:9px 15px;font:700 12.5px "Inter";
    color:#16203a;background:linear-gradient(135deg,#fff,#e6f0ff);box-shadow:0 4px 12px rgba(0,0,0,.2)}
  #eon-ws .ws-prove:hover{transform:translateY(-1px)}
  #eon-ws .ws-x{cursor:pointer;font-size:22px;opacity:.85;line-height:1;margin-left:8px}#eon-ws .ws-x:hover{opacity:1}
  #eon-ws .ws-body{flex:1;overflow:auto;padding:18px 22px 26px}
  #eon-ws .ws-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px}
  #eon-ws .ws-kpi{background:#fff;border:1px solid ${T.line};border-radius:14px;padding:13px 15px;position:relative;overflow:hidden}
  #eon-ws .ws-kpi::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,#4f46e5,#0ea5e9)}
  #eon-ws .ws-kpi .v{font:700 26px "JetBrains Mono",monospace;color:#16203a;line-height:1}
  #eon-ws .ws-kpi .l{font-size:12px;color:${T.soft};margin-top:4px;font-weight:600}
  #eon-ws .ws-live{display:flex;gap:14px;align-items:center;background:linear-gradient(115deg,#101a33,#24246e 60%,#2f2fae);
    color:#eaf0ff;border-radius:14px;padding:14px 18px;margin-bottom:16px}
  #eon-ws .ws-live .lb{width:44px;height:44px;flex:0 0 auto;border-radius:12px;display:grid;place-items:center;font-size:19px;background:rgba(255,255,255,.12)}
  #eon-ws .ws-live b{color:#fff}
  #eon-ws .ws-live .bar{height:4px;border-radius:3px;background:rgba(255,255,255,.15);overflow:hidden;margin-top:8px}
  #eon-ws .ws-live .bar>span{display:block;height:100%;background:linear-gradient(90deg,#0ea5e9,#7db9ff);transition:width .5s}
  #eon-ws .ws-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:14px}
  #eon-ws .ws-card{background:#fff;border:1px solid ${T.line};border-radius:14px;padding:15px 17px}
  #eon-ws .ws-ch{display:flex;align-items:center;gap:8px;font:700 12px "Inter";text-transform:uppercase;letter-spacing:.06em;color:${T.faint};margin-bottom:12px}
  #eon-ws .ws-ch i{color:${T.primary};font-size:14px}
  #eon-ws .ws-ch .tag{margin-left:auto;text-transform:none;letter-spacing:0;font-size:10.5px;color:${T.primary700};background:#eef0fe;padding:2px 8px;border-radius:999px}
  #eon-ws .ws-ins div{font-size:13px;color:#1f2937;display:flex;gap:7px;align-items:baseline;line-height:1.5;margin:3px 0}
  #eon-ws .ws-ins i.dot{color:${T.primary};font-size:15px;flex:0 0 auto}
  #eon-ws .ws-ins b{color:#16203a}
  #eon-ws .ws-cols{display:flex;flex-wrap:wrap;gap:6px;margin-top:11px}
  #eon-ws .ws-col{display:inline-flex;align-items:center;gap:6px;border:1px solid ${T.line};border-radius:9px;padding:4px 8px;font-size:11px;background:#fbfcfe}
  #eon-ws .ws-col b{color:#16203a}
  #eon-ws .ws-col .tp{font:700 9px "Inter";text-transform:uppercase;padding:1px 5px;border-radius:5px}
  #eon-ws .tp.number{background:#e9f0ff;color:#2563eb}#eon-ws .tp.date{background:#f1ebfe;color:#7c3aed}
  #eon-ws .tp.category{background:#e6f6ee;color:#0f9d58}#eon-ws .tp.id{background:#eef1f6;color:#64748b}#eon-ws .tp.text{background:#fdf2e0;color:#c77d0a}
  #eon-ws .ws-rad a{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid #eef1f6;text-decoration:none;color:inherit}
  #eon-ws .ws-rad a:first-child{border-top:0}
  #eon-ws .ws-rad .cd{font:700 12px "JetBrains Mono";min-width:40px;text-align:center;border-radius:7px;padding:3px 0;background:#eef0fe;color:#3730a3}
  #eon-ws .ws-rad .cd.soon{background:#fdeceb;color:#d6453d}
  #eon-ws .ws-rad b{font-size:13px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #eon-ws .ws-rad small{color:${T.soft};font-size:11.5px}
  #eon-ws .ws-ent{display:flex;align-items:center;gap:9px;padding:7px 0;border-top:1px solid #eef1f6}
  #eon-ws .ws-ent:first-child{border-top:0}
  #eon-ws .ws-ent .n{font:700 15px "JetBrains Mono";color:#16203a;min-width:38px}
  #eon-ws .ws-ent b{font-size:13px;text-transform:capitalize;display:block}
  #eon-ws .ws-ent small{color:${T.soft};font-size:11px}
  #eon-ws .ws-empty{color:${T.soft};font-size:13px}
  #eon-ws .ws-wincard{margin-bottom:14px}
  #eon-ws .ws-winbody{display:grid;grid-template-columns:minmax(180px,1fr) 1.4fr;gap:16px;align-items:center}
  #eon-ws .ws-winhero{display:flex;align-items:center;gap:12px;border-right:1px dashed ${T.line};padding-right:12px}
  #eon-ws .ws-winhero .v{font:700 42px "JetBrains Mono",monospace;color:${T.primary};line-height:1}
  #eon-ws .ws-winhero .v span{font-size:20px;color:${T.accent}}
  #eon-ws .ws-winhero .l{font-size:12.5px;color:#16203a;font-weight:600;line-height:1.35}
  #eon-ws .ws-winhero .l small{color:${T.soft};font-weight:500;font-size:11px}
  #eon-ws .ws-ops{display:flex;flex-direction:column;gap:7px}
  #eon-ws .ws-oprow{display:flex;align-items:center;gap:11px}
  #eon-ws .ws-ring{--p:0;--k:${T.primary};width:40px;height:40px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;position:relative;
    background:conic-gradient(var(--k) calc(var(--p)*1%),${T.line} 0)}
  #eon-ws .ws-ring::after{content:"";position:absolute;inset:4px;border-radius:50%;background:#fff}
  #eon-ws .ws-ring b{position:relative;z-index:1;font:700 12px "JetBrains Mono";color:#16203a}
  #eon-ws .ws-ring b i{font-size:8px;font-style:normal;color:${T.soft}}
  #eon-ws .ws-impact{margin-bottom:14px;background:linear-gradient(150deg,#fff,#eef0fe 320%)}
  #eon-ws .ws-impgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  #eon-ws .ws-imp .ic{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-size:14px;margin-bottom:5px}
  #eon-ws .ws-imp .v{font:700 24px "JetBrains Mono",monospace;color:#16203a;line-height:1}
  #eon-ws .ws-imp .l{font-size:11px;color:${T.soft};font-weight:500;margin-top:2px}
  @media (max-width:640px){#eon-ws .ws-impgrid{grid-template-columns:repeat(2,1fr)}}
  #eon-ws .ws-money{margin-bottom:14px}
  #eon-ws .ws-leak{display:flex;align-items:center;gap:12px;padding:8px 0;border-top:1px solid #eef1f6}
  #eon-ws .ws-leak:first-of-type{border-top:0}
  #eon-ws .ws-leak .amt{font:700 15px "JetBrains Mono";flex:0 0 auto;min-width:70px}
  #eon-ws .ws-leak .why b{display:block;font-size:12px;color:#16203a}
  #eon-ws .ws-leak .why small{color:${T.soft};font-size:11.5px;line-height:1.35;display:block}
  @media (max-width:820px){#eon-ws .ws-grid,#eon-ws .ws-winbody{grid-template-columns:1fr}#eon-ws .ws-winhero{border-right:0;border-bottom:1px dashed ${T.line};padding:0 0 10px}#eon-ws .ws-shell{inset:0;border-radius:0}}`;
  document.head.appendChild(s);
}

function ensureEl() {
  let el = document.getElementById('eon-ws');
  if (el) return el;
  injectStyle();
  el = document.createElement('div'); el.id = 'eon-ws';
  el.innerHTML = `
    <div class="ws-shell">
      <div class="ws-top">
        <span class="ws-orb"><i class="bi bi-cpu"></i></span>
        <div><b>Eon · Intelligence Workstation</b><small>One brain, reading your whole operation — live</small></div>
        <button class="ws-prove"><i class="bi bi-upload"></i> Prove a dataset</button>
        <span class="ws-x" title="Close">✕</span>
      </div>
      <div class="ws-body"></div>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('.ws-x').onclick = (e) => { e.stopPropagation(); hide(); };   // direct: card blocks bubbling
  el.addEventListener('click', (e) => { if (e.target === el) hide(); });           // backdrop
  el.querySelector('.ws-shell').addEventListener('click', (e) => e.stopPropagation());
  el.querySelector('.ws-prove').addEventListener('click', () => { try { window.EonProver && window.EonProver.openOverlay({}); } catch {} });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el.classList.contains('show')) hide(); });
  return el;
}

function body(m) {
  const L = live();
  const p = Math.round(clamp01(L.progress) * 100);
  const kpis = [
    ['diagram-3', m.entityKeys.length, 'data sources'],
    ['stack', m.totalRecords.toLocaleString(), 'records read'],
    ['alarm', m.upcoming, 'deadlines ≤30d'],
    ['heart-pulse', Math.round(m.health * 100) + '%', 'data health'],
  ];
  const winRate = (() => { try { const c = m.signals && m.signals.coefficients; return c && c.winRate != null ? Math.round(c.winRate * 100) + '%' : null; } catch { return null; } })();
  if (winRate) kpis.push(['graph-up-arrow', winRate, 'win rate']);

  const story = m.primary && m.primary.insights ? m.primary.insights : [];
  const cols = m.primary && m.primary.columns ? m.primary.columns.slice(0, 12) : [];

  return `
    <div class="ws-live">
      <span class="lb" style="${L.thinking ? 'background:rgba(14,165,233,.28)' : ''}"><i class="bi bi-${L.ico}"></i></span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px"><b>${L.label}</b><span style="margin-left:auto;font:600 10.5px 'JetBrains Mono';color:#9fb2d6">${L.thinking ? p + '%' : 'real-time'}</span></div>
        <div class="bar"><span style="width:${L.thinking ? p : 100}%"></span></div>
      </div>
    </div>
    <div class="ws-kpis">${kpis.map((k) => `<div class="ws-kpi"><div class="v">${k[1]}</div><div class="l"><i class="bi bi-${k[0]}" style="margin-right:5px;color:${T.primary}"></i>${k[2]}</div></div>`).join('')}</div>
    ${winCard(m.win)}
    ${impactCard(m.impact)}
    ${moneyCard(m.leaks)}
    <div class="ws-grid">
      <div class="ws-card">
        <div class="ws-ch"><i class="bi bi-bar-chart-line"></i>Data story${m.primaryKey ? `<span class="tag">${escapeH(m.primaryKey)} · auto-EDA</span>` : ''}</div>
        ${story.length ? `<div class="ws-ins">${story.map((s) => `<div><i class="bi bi-dot dot"></i><span>${s}</span></div>`).join('')}</div>
          <div class="ws-cols">${cols.map((c) => `<span class="ws-col"><b>${escapeH(c.name)}</b><span class="tp ${c.type}">${c.type}</span></span>`).join('')}</div>`
      : `<p class="ws-empty">Connect Eon to your data and he'll narrate it here. Or hit <b>Prove a dataset</b> to hand him any spreadsheet.</p>`}
      </div>
      <div class="ws-card">
        <div class="ws-ch"><i class="bi bi-alarm"></i>Deadline radar<span class="tag">${m.overdue ? m.overdue + ' overdue' : m.upcoming + ' soon'}</span></div>
        <div class="ws-rad">${m.radar.length ? m.radar.map((r) => `<a href="${escapeH(r.pointTo || '#')}"><span class="cd ${r.days <= 3 ? 'soon' : ''}">${r.days}d</span><span style="flex:1;min-width:0"><b>${escapeH(r.label)}</b><small>${escapeH(r.entity)} · ${escapeH(r.when)}</small></span></a>`).join('') : '<p class="ws-empty">Nothing due in the next 30 days. 🌿</p>'}</div>
        <div class="ws-ch" style="margin:16px 0 12px"><i class="bi bi-collection"></i>Data sources</div>
        ${m.entities.map((e) => `<div class="ws-ent"><span class="n">${e.count}</span><span style="flex:1;min-width:0"><b>${escapeH(e.key)}</b><small>${e.fields} fields${e.deadline ? ' · has deadlines' : ''}${e.dateFields.length ? ' · ' + e.dateFields.length + ' date field' + (e.dateFields.length > 1 ? 's' : '') : ''}</small></span></div>`).join('')}
      </div>
    </div>`;
}

function winCard(w) {
  if (!w || !w.ok || !w.top || !w.top.length) return '';
  const avg = w.avg != null ? Math.round(w.avg * 100) : null;
  const rows = w.top.slice(0, 4).map((p) => {
    const pc = Math.round(p.p * 100);
    const tone = pc >= 66 ? T.green : pc >= 40 ? T.amber : T.red;
    const why = (p.ranked || []).filter((r) => r.v > 0).slice(0, 2).map((r) => r.label).join(', ');
    return `<div class="ws-oprow"><span class="ws-ring" style="--p:${pc};--k:${tone}"><b>${pc}<i>%</i></b></span>
      <span style="flex:1;min-width:0"><b style="display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeH(p.name)}</b>
      <small style="color:${T.soft};font-size:11.5px">${why ? 'lifted by ' + escapeH(why) : 'live'}</small></span></div>`;
  }).join('');
  return `<div class="ws-card ws-wincard">
    <div class="ws-ch"><i class="bi bi-graph-up-arrow"></i>Win probability<span class="tag">${w.trained ? 'logistic · trained · ' + w.n + ' outcomes' : 'logistic · cold-start prior'}</span></div>
    <div class="ws-winbody">
      ${avg != null ? `<div class="ws-winhero"><div class="v">${avg}<span>%</span></div><div class="l">avg live win-probability<br><small>${w.live} open · scored on 6 engineered features${w.base != null ? ' · ' + Math.round(w.base * 100) + '% base rate' : ''}</small></div></div>` : ''}
      <div class="ws-ops">${rows}</div>
    </div>
  </div>`;
}

function impactCard(m) {
  if (!m) return '';
  const money = (n) => { try { return typeof window.fmtBDTk === 'function' ? window.fmtBDTk(n) : (typeof window.fmtBDT === 'function' ? window.fmtBDT(n) : '৳' + Math.round(n)); } catch { return '৳' + Math.round(n); } };
  const cells = [
    ['shield-check', m.guarded, 'deadlines guarded', T.green],
    ['broadcast', m.surfaced, 'opportunities surfaced', T.accent],
    ['hourglass-split', m.hours, 'hours saved', T.violet],
    ['cash-coin', m.money ? money(m.money) : m.leaksFlagged, m.money ? 'leaks flagged' : 'leaks watched', T.amber],
  ];
  return `<div class="ws-card ws-impact">
    <div class="ws-ch"><i class="bi bi-patch-check"></i>Impact so far<span class="tag">since ${escapeH(m.since)} · synced</span></div>
    <div class="ws-impgrid">${cells.map((c) => `<div class="ws-imp"><span class="ic" style="background:${c[3]}1a;color:${c[3]}"><i class="bi bi-${c[0]}"></i></span><div class="v">${typeof c[1] === 'number' ? c[1] : c[1]}</div><div class="l">${c[2]}</div></div>`).join('')}</div>
  </div>`;
}

function moneyCard(L) {
  if (!L || !L.hasData) return '';
  const money = (n) => { try { return typeof window.fmtBDT === 'function' ? window.fmtBDT(n) : '৳' + Math.round(Math.abs(n)).toLocaleString(); } catch { return '৳' + Math.round(Math.abs(n)); } };
  const items = [];
  if (L.overrun) items.push({ amt: L.overrun.over, tone: T.red, head: 'Over budget', why: `Spent ${money(L.overrun.spend)} of a ${money(L.overrun.budget)} monthly budget.` });
  (L.flags || []).slice(0, 4).forEach((f) => items.push({ amt: f.amount, tone: f.kind === 'duplicate' ? T.amber : T.red, head: f.kind === 'duplicate' ? 'Duplicate?' : (f.zLabel ? f.zLabel + 'σ outlier' : 'Anomaly'), why: f.why }));
  const rows = items.length ? items.map((it) => `<div class="ws-leak"><span class="amt" style="color:${it.tone}">${money(it.amt)}</span><span class="why"><b>${escapeH(it.head)}</b><small>${it.why}</small></span></div>`).join('')
    : `<p class="ws-empty">Scanned ${L.txCount} transactions — nothing unusual. Your spending looks clean. 🌿</p>`;
  return `<div class="ws-card ws-money">
    <div class="ws-ch"><i class="bi bi-cash-stack"></i>Money radar<span class="tag">${L.count ? L.count + ' flag' + (L.count === 1 ? '' : 's') + (L.recovered ? ' · ' + money(L.recovered) + ' at risk' : '') : L.txCount + ' scanned'}</span></div>
    ${rows}
  </div>`;
}

let _tick = null;
function render() {
  const el = ensureEl();
  const host = el.querySelector('.ws-body');
  if (!ownerOK()) { host.innerHTML = `<p class="ws-empty" style="padding:30px;text-align:center">Sign in as the owner to open the Intelligence Workstation.</p>`; return; }
  let m; try { m = compute(); } catch (e) { host.innerHTML = `<p class="ws-empty" style="padding:30px">Warming up…</p>`; return; }
  host.innerHTML = body(m);
}
function refreshLive() {
  const el = document.getElementById('eon-ws'); if (!el || !el.classList.contains('show')) return;
  const L = live(); const p = Math.round(clamp01(L.progress) * 100);
  const lb = el.querySelector('.ws-live .lb i'); const bar = el.querySelector('.ws-live .bar>span');
  const b = el.querySelector('.ws-live b'); const stamp = el.querySelector('.ws-live span[style*="JetBrains"]');
  if (lb) lb.className = `bi bi-${L.ico}`;
  if (bar) bar.style.width = (L.thinking ? p : 100) + '%';
  if (b) b.textContent = L.label.replace(/<[^>]+>/g, '');
  if (stamp) stamp.textContent = L.thinking ? p + '%' : 'real-time';
}
function show() { const el = ensureEl(); render(); el.classList.add('show'); if (_tick) clearInterval(_tick); _tick = setInterval(refreshLive, 900); }
function hide() { const el = document.getElementById('eon-ws'); if (el) el.classList.remove('show'); if (_tick) { clearInterval(_tick); _tick = null; } }

const EonWorkstation = { open: show, close: hide, render, compute, isOpen: () => !!document.getElementById('eon-ws')?.classList.contains('show') };
if (typeof window !== 'undefined') window.EonWorkstation = Object.assign(window.EonWorkstation || {}, EonWorkstation);
export default EonWorkstation;
