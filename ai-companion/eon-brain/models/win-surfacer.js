/* ============================================================
   EON · models/win-surfacer.js  —  P(win) everywhere
   ------------------------------------------------------------
   Surfaces the win-probability model's output across the WHOLE site:
   a small P(win) pill next to every opportunity wherever it appears
   (the opportunities table, the dashboard's recent list, deadline
   alerts), and a prominent banner on the opportunity-details page —
   each colour-coded and explaining its top reason on hover.

   Reads window.EonWinPredictor (models/win-predictor.js), which reads
   the host's data via EonBrain/discovery — so this lights up on any
   site whose records link out to a detail page with `?id=`. Owner-only
   (predictions only exist for the signed-in owner), self-styled,
   guarded, and re-runs on an interval so it survives table re-renders.
   ============================================================ */

const LINK_RE = /(?:^|\/)([a-z0-9_-]*details[a-z0-9_-]*)\.html\?id=([^&#"']+)/i;
const T = { green: '#0f9d58', amber: '#c77d0a', red: '#d6453d', primary: '#4f46e5' };

function wp() { try { return window.EonWinPredictor || null; } catch { return null; } }
function ownerOK() { try { return !!(window.EonBrain && window.EonBrain.isOwner && window.EonBrain.isOwner()); } catch { return false; } }
const tone = (p) => (p >= 0.66 ? T.green : p >= 0.4 ? T.amber : T.red);

function injectStyle() {
  if (document.getElementById('eon-pwin-style')) return;
  const s = document.createElement('style'); s.id = 'eon-pwin-style';
  s.textContent = `
  .eon-pwin{display:inline-flex;align-items:center;gap:4px;vertical-align:middle;margin-left:7px;
    font:700 10.5px/1 "JetBrains Mono","Inter",monospace;color:#fff;padding:3px 7px;border-radius:999px;
    box-shadow:0 1px 3px rgba(16,24,40,.18);cursor:help;white-space:nowrap}
  .eon-pwin i{font-style:normal;font-weight:600;opacity:.85;font-size:9px}
  .eon-pwin-banner{display:flex;align-items:center;gap:13px;margin:0 0 16px;padding:13px 17px;border-radius:14px;
    background:linear-gradient(115deg,#101a33,#26268a 60%,#4f46e5);color:#eaf0ff;box-shadow:0 10px 26px rgba(16,24,40,.18)}
  .eon-pwin-banner .pb-ring{width:52px;height:52px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;position:relative;
    background:conic-gradient(var(--k) calc(var(--p)*1%),rgba(255,255,255,.16) 0)}
  .eon-pwin-banner .pb-ring::after{content:"";position:absolute;inset:5px;border-radius:50%;background:#1a2244}
  .eon-pwin-banner .pb-ring b{position:relative;z-index:1;font:700 15px "JetBrains Mono";color:#fff}
  .eon-pwin-banner .pb-main b{font:800 15px "Plus Jakarta Sans",system-ui}
  .eon-pwin-banner .pb-main small{display:block;opacity:.85;font-size:12px;margin-top:1px}
  .eon-pwin-banner .pb-tag{margin-left:auto;font:600 10.5px "JetBrains Mono";opacity:.8;background:rgba(255,255,255,.12);padding:4px 9px;border-radius:999px}`;
  document.head.appendChild(s);
}

function pill(p, why) {
  const pc = Math.round(p * 100);
  const el = document.createElement('span');
  el.className = 'eon-pwin'; el.style.background = tone(p);
  el.innerHTML = `${pc}<i>% win</i>`;
  el.title = `Eon's win-probability: ${pc}%${why ? ' — lifted by ' + why : ''}`;
  return el;
}

function whyOf(pred) { try { return (pred.ranked || []).filter((r) => r.v > 0).slice(0, 2).map((r) => r.label).join(', '); } catch { return ''; } }

/* pills next to every opportunity link */
function surfacePills() {
  const W = wp(); if (!W) return;
  const anchors = document.querySelectorAll('a[href*="details.html?id="]:not([data-eonpw]), [onclick*="details.html?id="]:not([data-eonpw])');
  anchors.forEach((a) => {
    let m = LINK_RE.exec(a.getAttribute('href') || '');
    if (!m) { const oc = a.getAttribute('onclick') || ''; m = LINK_RE.exec(oc); }
    if (!m) { a.setAttribute('data-eonpw', '0'); return; }
    const id = decodeURIComponent(m[2]);
    let pred = null; try { pred = W.get(id); } catch {}
    a.setAttribute('data-eonpw', '1');
    if (!pred || pred.p == null) return;                 // decided/unknown → no pill
    // don't double-badge a row: attach to the anchor once
    if (a.querySelector('.eon-pwin')) return;
    a.appendChild(pill(pred.p, whyOf(pred)));
  });
}

/* a prominent banner on the detail page for the current record */
function surfaceBanner() {
  const W = wp(); if (!W) return;
  const m = LINK_RE.exec(location.pathname + location.search); if (!m) return;
  const id = decodeURIComponent(m[2]);
  const wrap = document.querySelector('.page-wrap'); if (!wrap) return;
  let pred = null; try { pred = W.get(id); } catch {}
  const existing = document.getElementById('eonPwinBanner');
  if (!pred || pred.p == null) { if (existing) existing.remove(); return; }
  const pc = Math.round(pred.p * 100);
  const why = whyOf(pred);
  injectStyle();
  let b = existing;
  if (!b) { b = document.createElement('div'); b.id = 'eonPwinBanner'; b.className = 'eon-pwin-banner'; wrap.insertBefore(b, wrap.firstChild); }
  b.innerHTML = `
    <span class="pb-ring" style="--p:${pc};--k:${tone(pred.p)}"><b>${pc}%</b></span>
    <div class="pb-main"><b>Eon predicts a ${pc}% chance you win this.</b><small>${why ? 'Lifted by ' + why + '.' : 'Live prediction from your pipeline model.'} ${pred.coldStart ? '(cold-start prior — refines as you log outcomes)' : ''}</small></div>
    <span class="pb-tag">P(win)</span>`;
}

function tick() {
  if (!ownerOK()) return;
  injectStyle();
  try { surfacePills(); } catch {}
  try { surfaceBanner(); } catch {}
}

function start() {
  let n = 0;
  const iv = setInterval(() => { n++; try { tick(); } catch {} if (n > 600) clearInterval(iv); }, 1300);
  tick();
}
if (typeof window !== 'undefined') {
  window.EonWinSurfacer = { tick, start };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}
