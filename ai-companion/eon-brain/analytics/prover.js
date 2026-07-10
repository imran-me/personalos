/* ============================================================
   EON · analytics/prover.js  —  Any-Dataset Live Prover
   ------------------------------------------------------------
   Hand EON ANY spreadsheet (CSV/TSV) — or pick a sample — and he
   instantly understands it: infers the schema with the SAME
   discovery.js the live app uses, auto-profiles every column
   (type, missing %, cardinality, distribution, outliers, date
   range), guesses the business domain, and narrates plain-English
   findings. No config, no integration. The platform thesis —
   "any business, any data" — made tangible.

   Data science: automated schema/type inference + auto-EDA
   (column typing, date detection by name AND value, missing-value
   profiling, cardinality, basic distributions, z-score outliers).

   Pure client-side, zero dependencies (own CSV parser), offline-safe.
   Portable: reuses ../discovery.js, so it works unchanged inside the
   ERP (or any Firestore-backed app) — drop the companion in and go.

   Exposes:
     • ES exports: parseTable, profileDataset, narrate, SAMPLES
     • window.EonProver.openOverlay(opts)  — the full drop-zone modal
     • window.EonProver.profile(text|rows)  — headless profiling
     • window.EonProver.last                 — the most recent profile
   ============================================================ */

import { discover } from '../discovery.js';

/* ---------------- CSV / TSV parsing ---------------- */
/** Robust delimited-text parser: quotes, escaped quotes, embedded
    newlines, CR/LF. Auto-detects comma vs tab vs semicolon. */
export function parseTable(text) {
  const src = String(text || '').replace(/^﻿/, '');           // strip BOM
  if (!src.trim()) return { headers: [], rows: [] };
  const delim = detectDelim(src);
  const records = [];
  let field = '', row = [], inQ = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); records.push(row); field = ''; row = []; }
    else if (c === '\r') { /* handled by \n or trailing */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); records.push(row); }
  const nonEmpty = records.filter((r) => r.some((v) => String(v).trim() !== ''));
  if (!nonEmpty.length) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map((h, i) => String(h).trim() || `column_${i + 1}`);
  const rows = nonEmpty.slice(1).map((r) => {
    const o = {}; headers.forEach((h, i) => { o[h] = coerce(r[i]); }); return o;
  });
  return { headers, rows };
}

function detectDelim(src) {
  const head = src.split(/\r?\n/).slice(0, 5).join('\n');
  const counts = { ',': 0, '\t': 0, ';': 0, '|': 0 };
  let inQ = false;
  for (const c of head) { if (c === '"') inQ = !inQ; else if (!inQ && counts[c] != null) counts[c]++; }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ',';
}

function coerce(v) {
  if (v == null) return '';
  const s = String(v).trim();
  if (s === '') return '';
  // keep as string; typing is done in the profiler (so we keep raw dates/ids)
  return s;
}

/* ---------------- type + stat helpers ---------------- */
const NUM_RE = /^-?[৳$€£¥]?\s?-?[\d,]*\.?\d+\s?%?$/;
function toNum(v) {
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[৳$€£¥,%\s]/g, '');
  if (s === '' || isNaN(s)) return NaN;
  return parseFloat(s);
}
const isNumish = (v) => v !== '' && v != null && NUM_RE.test(String(v).trim()) && !isNaN(toNum(v));
function isDateish(v) {
  if (v == null || v === '') return false;
  const s = String(v);
  if (!/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(s)) return false;
  return !isNaN(Date.parse(s));
}
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const std = (a, m) => { if (a.length < 2) return 0; m = m == null ? mean(a) : m; return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length); };
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const fmtN = (n) => { n = Number(n) || 0; const r = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100; return r.toLocaleString(); };

/* ---------------- the auto-EDA profiler ---------------- */
export function profileDataset(rows, name = 'dataset') {
  rows = Array.isArray(rows) ? rows.filter((r) => r && typeof r === 'object') : [];
  const n = rows.length;
  const cols = n ? Object.keys(rows[0]) : [];
  // reuse the app's own schema discovery (date/label/id detection by name+value)
  let schema = {};
  try { schema = discover({ [name]: rows })[name] || {}; } catch {}
  const dateFields = new Set(schema.dateFields || []);

  const columns = cols.map((col) => {
    const raw = rows.map((r) => r[col]);
    const vals = raw.filter((v) => v != null && String(v).trim() !== '');
    const missing = n ? 1 - vals.length / n : 0;
    const uniq = new Set(vals.map((v) => String(v))).size;
    const numish = vals.filter(isNumish);
    const dateish = vals.filter(isDateish);
    let type = 'text';
    if (vals.length && numish.length / vals.length >= 0.8 && uniq > 1) type = 'number';
    if ((dateFields.has(col) || (vals.length && dateish.length / vals.length >= 0.7))) type = 'date';
    if (type === 'text' && uniq > 0 && uniq <= Math.max(2, Math.min(12, vals.length * 0.5))) type = 'category';
    if (type === 'text' && uniq === vals.length && uniq > 1) type = /id$|^id|code|ref|email|phone/i.test(col) ? 'id' : 'text';

    const c = { name: col, type, missing, cardinality: uniq, count: vals.length };
    if (type === 'number') {
      const a = numish.map(toNum);
      const m = mean(a), s = std(a, m);
      const outliers = s ? a.filter((x) => Math.abs((x - m) / s) > 2.5).length : 0;
      Object.assign(c, { min: Math.min(...a), max: Math.max(...a), mean: m, std: s, sum: a.reduce((x, y) => x + y, 0), outliers, isMoney: /amount|price|cost|revenue|sales|total|paid|salary|fee|budget|৳|\$|balance|income|expense/i.test(col) });
    } else if (type === 'date') {
      const ts = dateish.map((v) => Date.parse(v)).filter((t) => !isNaN(t));
      if (ts.length) Object.assign(c, { minDate: new Date(Math.min(...ts)).toISOString().slice(0, 10), maxDate: new Date(Math.max(...ts)).toISOString().slice(0, 10), spanDays: Math.round((Math.max(...ts) - Math.min(...ts)) / 86400000) });
    } else if (type === 'category') {
      const freq = {}; vals.forEach((v) => { const k = String(v); freq[k] = (freq[k] || 0) + 1; });
      c.top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => ({ k, v }));
    }
    return c;
  });

  const domain = guessDomain(cols, columns);
  const profile = { name, rowCount: n, colCount: cols.length, columns, schema, domain };
  profile.insights = narrate(profile);
  return profile;
}

function guessDomain(cols, columns) {
  const j = cols.join(' ').toLowerCase();
  const has = (re) => re.test(j);
  if (has(/invoice|billed|paid|client|freelanc/)) return { label: 'invoicing / freelance', ico: 'receipt' };
  if (has(/patient|appointment|doctor|clinic|diagnos/)) return { label: 'clinic / appointments', ico: 'heart-pulse' };
  if (has(/product|sku|sale|revenue|order|qty|quantity|price/)) return { label: 'shop / sales', ico: 'cart' };
  if (has(/student|grade|course|marks|exam|enroll/)) return { label: 'education / students', ico: 'mortarboard' };
  if (has(/expense|budget|category|spend|txn|transaction/)) return { label: 'finance / expenses', ico: 'cash-stack' };
  if (has(/lead|deal|pipeline|stage|opportunit/)) return { label: 'sales pipeline / CRM', ico: 'diagram-3' };
  if (has(/employee|payroll|attendance|hr\b|department/)) return { label: 'HR / people', ico: 'people' };
  const moneyCol = columns.find((c) => c.isMoney);
  if (moneyCol) return { label: 'financial records', ico: 'cash-stack' };
  return { label: 'general records', ico: 'table' };
}

/* ---------------- narration (data storytelling) ---------------- */
export function narrate(p) {
  const out = [];
  out.push(`I read <b>${p.rowCount.toLocaleString()}</b> rows × <b>${p.colCount}</b> columns — looks like a <b>${p.domain.label}</b> dataset.`);
  const dateCol = p.columns.find((c) => c.type === 'date' && c.spanDays != null);
  if (dateCol) out.push(`Time column <b>“${dateCol.name}”</b> spans ${dateCol.minDate} → ${dateCol.maxDate} (${dateCol.spanDays} days) — I can track trends & deadlines on it.`);
  const money = p.columns.filter((c) => c.type === 'number' && c.isMoney).sort((a, b) => (b.sum || 0) - (a.sum || 0))[0];
  if (money) out.push(`<b>“${money.name}”</b> totals <b>${fmtN(money.sum)}</b> (avg ${fmtN(money.mean)}${money.outliers ? `, <b>${money.outliers} outlier${money.outliers > 1 ? 's' : ''}</b> beyond 2.5σ` : ''}).`);
  const otherNum = p.columns.find((c) => c.type === 'number' && !c.isMoney && c.outliers);
  if (otherNum) out.push(`<b>“${otherNum.name}”</b> has ${otherNum.outliers} unusual value${otherNum.outliers > 1 ? 's' : ''} worth a look (range ${fmtN(otherNum.min)}–${fmtN(otherNum.max)}).`);
  const cat = p.columns.filter((c) => c.type === 'category' && c.top && c.top.length).sort((a, b) => b.cardinality - a.cardinality)[0];
  if (cat && cat.top[0]) out.push(`<b>“${cat.name}”</b> splits into ${cat.cardinality} groups — most common: <b>${cat.top[0].k}</b> (${Math.round(cat.top[0].v / p.rowCount * 100)}%).`);
  const gap = p.columns.filter((c) => c.missing > 0.2).sort((a, b) => b.missing - a.missing)[0];
  if (gap) out.push(`⚠ <b>“${gap.name}”</b> is ${Math.round(gap.missing * 100)}% empty — data-quality gap to fix.`);
  if (p.schema && p.schema.labelField) out.push(`Best human label for each row: <b>“${p.schema.labelField}”</b>${p.schema.deadlineField ? `; deadline field: <b>“${p.schema.deadlineField}”</b>.` : '.'}`);
  return out;
}

/* ---------------- sample datasets (offline mic-drop) ---------------- */
export const SAMPLES = {
  'Shop sales': `date,product,category,units,price,total,channel
2026-06-01,Cold Brew 1L,Beverages,12,340,4080,Store
2026-06-01,Oat Cookies,Snacks,20,60,1200,Store
2026-06-02,Cold Brew 1L,Beverages,9,340,3060,Online
2026-06-02,Ceramic Mug,Merch,4,650,2600,Online
2026-06-03,Espresso Beans 500g,Beverages,15,890,13350,Store
2026-06-03,Oat Cookies,Snacks,,60,,Store
2026-06-04,Gift Card,Merch,2,5000,10000,Online
2026-06-05,Cold Brew 1L,Beverages,11,340,3740,Store
2026-06-06,Ceramic Mug,Merch,6,650,3900,Store
2026-06-07,Espresso Beans 500g,Beverages,3,890,2670,Online
2026-06-08,Cold Brew 1L,Beverages,40,340,13600,Online
2026-06-09,Oat Cookies,Snacks,18,60,1080,Store`,
  'Clinic appointments': `appointment_id,patient,date,doctor,department,status,fee
A-1001,Rahim U.,2026-06-02,Dr. Sultana,Cardiology,Completed,1200
A-1002,Nadia K.,2026-06-02,Dr. Karim,Dermatology,Completed,900
A-1003,Imran H.,2026-06-03,Dr. Sultana,Cardiology,No-show,1200
A-1004,Fariha R.,2026-06-03,Dr. Alam,Orthopedics,Completed,1500
A-1005,Tanvir S.,2026-06-04,Dr. Karim,Dermatology,Cancelled,900
A-1006,Sadia M.,2026-06-05,Dr. Sultana,Cardiology,Completed,1200
A-1007,Rakib J.,2026-06-06,Dr. Alam,Orthopedics,Completed,1500
A-1008,Mitu A.,2026-06-07,Dr. Karim,Dermatology,Completed,900
A-1009,Hasan T.,2026-06-08,Dr. Sultana,Cardiology,Completed,9500
A-1010,Lamia B.,2026-06-09,Dr. Alam,Orthopedics,No-show,1500`,
  'Freelancer invoices': `invoice,client,issued,due,amount,status
INV-201,Acme Co,2026-05-10,2026-05-24,45000,Paid
INV-202,BluePeak,2026-05-15,2026-05-29,32000,Paid
INV-203,Acme Co,2026-05-20,2026-06-03,45000,Overdue
INV-204,Nimbus,2026-05-22,2026-06-05,18000,Paid
INV-205,BluePeak,2026-06-01,2026-06-15,32000,Sent
INV-206,Acme Co,2026-06-03,2026-06-17,120000,Sent
INV-207,Nimbus,2026-06-05,2026-06-19,18000,Overdue
INV-208,Skylark,2026-06-08,2026-06-22,27500,Paid
INV-209,BluePeak,2026-06-10,2026-06-24,32000,Sent
INV-210,Nimbus,2026-06-12,2026-06-26,18000,Sent`,
};

/* ---------------- profiling entrypoint ---------------- */
function profileAny(input, name) {
  const rows = typeof input === 'string' ? parseTable(input).rows : (Array.isArray(input) ? input : []);
  const p = profileDataset(rows, name || 'dataset');
  window.EonProver.last = p;
  return p;
}

/* =========================================================
   The drop-zone overlay (shared by the bag + the dashboard hub)
   ========================================================= */
function injectStyle() {
  if (document.getElementById('eon-prover-style')) return;
  const s = document.createElement('style'); s.id = 'eon-prover-style';
  s.textContent = `
  #eon-prover{position:fixed;inset:0;z-index:2147483646;display:none;align-items:center;justify-content:center;background:rgba(12,18,34,.5);backdrop-filter:blur(3px)}
  #eon-prover.show{display:flex}
  #eon-prover .epv-card{width:min(680px,94vw);max-height:88vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 30px 70px rgba(8,14,30,.4);font:500 14px/1.5 "Inter",system-ui,sans-serif;color:#1f2937}
  #eon-prover .epv-h{display:flex;align-items:center;gap:11px;padding:16px 20px;position:sticky;top:0;z-index:2;color:#fff;
    background:linear-gradient(115deg,#101a33,#2a2a8f 55%,#4f46e5)}
  #eon-prover .epv-h .epv-ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:rgba(255,255,255,.15);font-size:17px}
  #eon-prover .epv-h b{font:800 16px "Plus Jakarta Sans",system-ui;letter-spacing:-.01em}
  #eon-prover .epv-h small{display:block;opacity:.85;font-size:11.5px;font-weight:500}
  #eon-prover .epv-x{margin-left:auto;cursor:pointer;font-size:20px;opacity:.85;line-height:1}
  #eon-prover .epv-x:hover{opacity:1}
  #eon-prover .epv-b{padding:18px 20px}
  #eon-prover .epv-drop{border:2px dashed #c7cbe6;border-radius:14px;padding:26px 16px;text-align:center;background:#f7f8fc;transition:.18s;cursor:pointer}
  #eon-prover .epv-drop:hover,#eon-prover .epv-drop.over{border-color:#4f46e5;background:#eef0fe}
  #eon-prover .epv-drop i{font-size:30px;color:#4f46e5}
  #eon-prover .epv-drop p{margin:8px 0 2px;font-weight:600;color:#16203a}
  #eon-prover .epv-drop small{color:#5b6678;font-size:12px}
  #eon-prover .epv-samples{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 4px;align-items:center}
  #eon-prover .epv-samples span{font-size:11.5px;color:#9aa3b2;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-right:2px}
  #eon-prover .epv-chip{border:1px solid #e0e3f0;background:#fff;border-radius:999px;padding:6px 13px;font:600 12.5px "Inter";color:#3730a3;cursor:pointer;transition:.15s}
  #eon-prover .epv-chip:hover{border-color:#4f46e5;background:#eef0fe}
  #eon-prover .epv-res{margin-top:16px;opacity:0;transform:translateY(6px);transition:.35s}
  #eon-prover .epv-res.in{opacity:1;transform:none}
  #eon-prover .epv-headline{display:flex;align-items:center;gap:11px;background:linear-gradient(120deg,#eef0fe,#e6f6ff);border:1px solid #d9def7;border-radius:13px;padding:13px 15px}
  #eon-prover .epv-headline .hl-ic{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#4f46e5,#0ea5e9);color:#fff;display:grid;place-items:center;font-size:18px;flex:0 0 auto}
  #eon-prover .epv-headline b{font:800 15px "Plus Jakarta Sans"}
  #eon-prover .epv-headline small{color:#5b6678;font-size:12px}
  #eon-prover .epv-stats{display:flex;gap:8px;margin:12px 0}
  #eon-prover .epv-stat{flex:1;background:#f7f8fc;border:1px solid #eef1f6;border-radius:11px;padding:9px 11px}
  #eon-prover .epv-stat .v{font:700 18px "JetBrains Mono",monospace;color:#16203a}
  #eon-prover .epv-stat .l{font-size:10.5px;color:#5b6678;font-weight:600}
  #eon-prover .epv-sec{font:700 11px "Inter";text-transform:uppercase;letter-spacing:.06em;color:#9aa3b2;margin:16px 0 8px}
  #eon-prover .epv-ins{display:flex;flex-direction:column;gap:6px}
  #eon-prover .epv-ins div{font-size:13px;color:#1f2937;display:flex;gap:7px;align-items:baseline;line-height:1.45}
  #eon-prover .epv-ins i.dot{color:#4f46e5;font-size:15px;flex:0 0 auto}
  #eon-prover .epv-cols{display:flex;flex-wrap:wrap;gap:6px}
  #eon-prover .epv-col{display:inline-flex;align-items:center;gap:6px;border:1px solid #e7eaf1;border-radius:9px;padding:5px 9px;font-size:11.5px;background:#fff}
  #eon-prover .epv-col b{color:#16203a;font-weight:600}
  #eon-prover .epv-col .tp{font:700 9.5px "Inter";text-transform:uppercase;letter-spacing:.04em;padding:1px 6px;border-radius:6px}
  #eon-prover .tp.number{background:#e9f0ff;color:#2563eb}
  #eon-prover .tp.date{background:#f1ebfe;color:#7c3aed}
  #eon-prover .tp.category{background:#e6f6ee;color:#0f9d58}
  #eon-prover .tp.id{background:#eef1f6;color:#64748b}
  #eon-prover .tp.text{background:#fdf2e0;color:#c77d0a}
  #eon-prover .epv-col .miss{color:#d6453d;font-weight:700}
  @media (max-width:520px){#eon-prover .epv-stats{flex-wrap:wrap}#eon-prover .epv-stat{min-width:44%}}`;
  document.head.appendChild(s);
}

function ensureOverlay() {
  let el = document.getElementById('eon-prover');
  if (el) return el;
  injectStyle();
  el = document.createElement('div'); el.id = 'eon-prover';
  el.innerHTML = `
    <div class="epv-card">
      <div class="epv-h">
        <span class="epv-ic"><i class="bi bi-graph-up-arrow"></i></span>
        <div><b>Any-Dataset Live Prover</b><small>Hand EON any spreadsheet — he reads it instantly, no setup</small></div>
        <span class="epv-x" title="Close">✕</span>
      </div>
      <div class="epv-b">
        <div class="epv-drop" tabindex="0">
          <i class="bi bi-filetype-csv"></i>
          <p>Drop a CSV/TSV here, or click to choose</p>
          <small>Nothing leaves your browser — profiling runs 100% locally.</small>
          <input type="file" accept=".csv,.tsv,.txt,text/csv" hidden>
        </div>
        <div class="epv-samples"><span>Or try</span></div>
        <div class="epv-res"></div>
      </div>
    </div>`;
  document.body.appendChild(el);

  const card = el.querySelector('.epv-card');
  const drop = el.querySelector('.epv-drop');
  const input = el.querySelector('input[type=file]');
  const res = el.querySelector('.epv-res');
  const samplesWrap = el.querySelector('.epv-samples');

  Object.keys(SAMPLES).forEach((name) => {
    const b = document.createElement('button'); b.className = 'epv-chip'; b.textContent = name;
    b.onclick = () => runInput(SAMPLES[name], name, res, el);
    samplesWrap.appendChild(b);
  });

  el.querySelector('.epv-x').onclick = (e) => { e.stopPropagation(); hide(el); };   // direct: card blocks bubbling
  el.addEventListener('click', (e) => { if (e.target === el) hide(el); });            // backdrop click closes
  card.addEventListener('click', (e) => e.stopPropagation());
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.click(); });
  input.addEventListener('change', () => { const f = input.files[0]; if (f) readFile(f, res, el); });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => { const f = e.dataTransfer?.files?.[0]; if (f) readFile(f, res, el); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el.classList.contains('show')) hide(el); });
  return el;
}

function readFile(file, res, el) {
  const rd = new FileReader();
  rd.onload = () => runInput(String(rd.result || ''), file.name.replace(/\.[^.]+$/, ''), res, el);
  rd.onerror = () => { res.innerHTML = `<p style="color:#d6453d">Couldn't read that file.</p>`; res.classList.add('in'); };
  rd.readAsText(file);
}

function runInput(text, name, res, el) {
  let p; try { p = profileAny(text, name || 'dataset'); } catch (e) { res.innerHTML = `<p style="color:#d6453d">Couldn't parse that — is it a CSV?</p>`; res.classList.add('in'); return; }
  if (!p.rowCount) { res.innerHTML = `<p style="color:#d6453d">No rows found. Make sure the first line is a header.</p>`; res.classList.add('in'); return; }
  res.innerHTML = renderProfile(p);
  res.classList.remove('in'); void res.offsetWidth; res.classList.add('in');
  try { el._opts && el._opts.onReact && el._opts.onReact('celebrate', p); } catch {}
}

function renderProfile(p) {
  const typeChips = p.columns.slice(0, 14).map((c) => `<span class="epv-col"><b>${escapeHtmlLocal(c.name)}</b><span class="tp ${c.type}">${c.type}</span>${c.missing > 0.2 ? `<span class="miss">${Math.round(c.missing * 100)}% empty</span>` : ''}</span>`).join('');
  return `
    <div class="epv-headline">
      <span class="hl-ic"><i class="bi bi-${p.domain.ico}"></i></span>
      <div><b>${p.insights[0].replace(/<\/?b>/g, '')}</b><small>Schema inferred automatically — EON is ready to advise on it.</small></div>
    </div>
    <div class="epv-stats">
      <div class="epv-stat"><div class="v">${p.rowCount.toLocaleString()}</div><div class="l">rows</div></div>
      <div class="epv-stat"><div class="v">${p.colCount}</div><div class="l">columns</div></div>
      <div class="epv-stat"><div class="v">${p.columns.filter((c) => c.type === 'number').length}</div><div class="l">numeric</div></div>
      <div class="epv-stat"><div class="v">${p.columns.filter((c) => c.type === 'date').length}</div><div class="l">date</div></div>
    </div>
    <div class="epv-sec">What EON found</div>
    <div class="epv-ins">${p.insights.slice(1).map((s) => `<div><i class="bi bi-dot dot"></i><span>${s}</span></div>`).join('') || '<div>Clean, simple table — no anomalies to flag. 🌿</div>'}</div>
    <div class="epv-sec">Columns &amp; inferred types</div>
    <div class="epv-cols">${typeChips}</div>`;
}

function escapeHtmlLocal(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function show(el) { el.classList.add('show'); }
function hide(el) { el.classList.remove('show'); }

/* ---------------- public API ---------------- */
const EonProver = {
  last: null,
  profile: profileAny,
  parseTable,
  profileDataset,
  narrate,
  SAMPLES,
  /** open the full drop-zone modal. opts.onReact(emote, profile) for avatar reactions. */
  openOverlay(opts = {}) {
    const el = ensureOverlay();
    el._opts = opts;
    const res = el.querySelector('.epv-res'); res.innerHTML = ''; res.classList.remove('in');
    show(el);
    return el;
  },
  /** open the modal AND immediately profile the given CSV text (used for drops). */
  openWith(text, name, opts = {}) {
    const el = this.openOverlay(opts);
    runInput(String(text || ''), name || 'dataset', el.querySelector('.epv-res'), el);
    return el;
  },
};
if (typeof window !== 'undefined') window.EonProver = Object.assign(window.EonProver || {}, EonProver);

export default EonProver;
