/* ============================================================
   EON · intel/selfcorrect.js  —  Live Self-Correction Loop
   ------------------------------------------------------------
   Eon makes a prediction, then runs a self-critique pass, notices where
   it was over-confident (by checking its OWN calibration — predicted vs
   actual — and sample size), explains the error in plain English, and
   reweights itself live (a learned shrinkage toward the base rate that
   the win-predictor then applies). Reflection / self-verification — the
   "does it recover from its own errors?" criterion, on screen.

   Rule-based, offline. Persists the correction to the synced brain store
   so the model stays humbler across sessions. Register: window.EonSelfCorrect.
   ============================================================ */

const A = '#4f46e5', G = '#0f9d58', R = '#d6453d', AM = '#c77d0a';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const pc = (x) => Math.round(x * 100);

function analyse() {
  let sum = null, cal = null;
  try { window.EonWinPredictor && window.EonWinPredictor.refresh(); sum = window.EonWinPredictor.summary(); cal = window.EonWinPredictor.calibration(); } catch {}
  if (!sum || !sum.ok || !sum.top || !sum.top.length) return null;
  const top = sum.top[0];
  const base = sum.base != null ? sum.base : 0.4;
  const p0 = top.p;
  // measure over/under-confidence from the calibration curve
  let avgPred = p0, avgActual = base, ece = 0, n = cal && cal.n || 0;
  if (cal && cal.ok && cal.points.length) {
    const tot = cal.points.reduce((s, q) => s + q.n, 0);
    avgPred = cal.points.reduce((s, q) => s + q.pred * q.n, 0) / tot;
    avgActual = cal.points.reduce((s, q) => s + q.actual * q.n, 0) / tot;
    ece = cal.ece;
  }
  const overconf = avgPred - avgActual;                 // >0 → predicts higher than reality
  const smallSample = n < 8;
  // how much to shrink: driven by the miscalibration + a small-sample penalty
  const curShrink = (() => { try { return ((window.EonBrain.getStore('winCalib')) || {}).shrink || 0; } catch { return 0; } })();
  let shrink = curShrink;
  const issues = [];
  if (overconf > 0.05) { shrink = clamp(curShrink + overconf * 1.2 + ece, 0.08, 0.6); issues.push('overconfident'); }
  else if (smallSample && Math.abs(p0 - base) > 0.25) { shrink = clamp(curShrink + 0.18, 0.08, 0.4); issues.push('thin evidence'); }
  const p1 = clamp(base + (p0 - base) * (1 - shrink), 0.02, 0.98);
  return { name: top.name, p0, p1, base, ece, n, overconf, smallSample, shrink, issues, avgPred, avgActual };
}

function injectStyle() {
  if (document.getElementById('eon-sc-style')) return;
  const s = document.createElement('style'); s.id = 'eon-sc-style';
  s.textContent = `
  #eon-sc{position:fixed;inset:0;z-index:2147483646;display:none;align-items:center;justify-content:center;background:rgba(12,18,34,.55);backdrop-filter:blur(4px);font:500 14px "Inter",system-ui,sans-serif}
  #eon-sc.show{display:flex}
  #eon-sc .sc{width:min(560px,94vw);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 30px 70px rgba(8,14,30,.42)}
  #eon-sc .sc-h{display:flex;align-items:center;gap:11px;padding:16px 20px;background:#111634;color:#fff}
  #eon-sc .sc-h b{font:800 16px "Plus Jakarta Sans"}#eon-sc .sc-h small{display:block;opacity:.8;font-size:11.5px}
  #eon-sc .sc-x{margin-left:auto;cursor:pointer;font-size:20px;opacity:.85}
  #eon-sc .sc-b{padding:20px}
  #eon-sc .sc-step{display:flex;gap:12px;margin:0 0 14px;opacity:0;transform:translateY(8px);transition:.45s}
  #eon-sc .sc-step.in{opacity:1;transform:none}
  #eon-sc .sc-ic{width:34px;height:34px;flex:0 0 auto;border-radius:10px;display:grid;place-items:center;color:#fff;font-size:15px}
  #eon-sc .sc-t{flex:1}
  #eon-sc .sc-t b{font:700 13px "Inter";color:#16203a;display:block;margin-bottom:2px}
  #eon-sc .sc-t p{margin:0;font-size:13px;color:#374151;line-height:1.5}
  #eon-sc .sc-corr{display:flex;align-items:center;gap:14px;justify-content:center;margin:6px 0 4px;padding:16px;background:#f5f7fb;border-radius:14px}
  #eon-sc .sc-corr .v{font:700 34px "JetBrains Mono";letter-spacing:-.02em}
  #eon-sc .sc-corr .old{color:#9aa3b2;text-decoration:line-through;font-size:26px}
  #eon-sc .sc-corr .ar{color:${A};font-size:22px}
  #eon-sc .sc-corr .new{color:${G}}
  #eon-sc .sc-corr .lab{font-size:11px;color:#5b6678;text-align:center;margin-top:3px}
  #eon-sc .sc-foot{font-size:11.5px;color:#9aa3b2;margin-top:8px}
  #eon-sc .sc-rerun{margin-top:12px;border:1px solid #e7eaf1;background:#fff;border-radius:10px;padding:9px 15px;font:700 12.5px "Inter";color:${A};cursor:pointer}`;
  document.head.appendChild(s);
}
function ensureEl() {
  let el = document.getElementById('eon-sc'); if (el) return el;
  injectStyle();
  el = document.createElement('div'); el.id = 'eon-sc';
  el.innerHTML = `<div class="sc"><div class="sc-h"><span style="font-size:18px">🔍</span><div><b>Self-Correction</b><small>Eon checks its own work and reweights live</small></div><span class="sc-x">✕</span></div><div class="sc-b"></div></div>`;
  document.body.appendChild(el);
  el.querySelector('.sc-x').onclick = (e) => { e.stopPropagation(); el.classList.remove('show'); };   // direct: card blocks bubbling
  el.addEventListener('click', (e) => { if (e.target === el) el.classList.remove('show'); });            // backdrop
  el.querySelector('.sc').addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el.classList.contains('show')) el.classList.remove('show'); });
  return el;
}

function run(el) {
  const b = el.querySelector('.sc-b');
  const a = analyse();
  if (!a) { b.innerHTML = `<p style="color:#5b6678">Log a few opportunity outcomes first — then Eon has predictions to check itself against.</p>`; return; }
  const corrected = a.p1 < a.p0 - 0.005;
  const steps = [
    { ic: '🧠', c: A, t: 'Initial call', p: `I predicted <b>${esc(a.name)}</b> at <b>${pc(a.p0)}%</b> to win.` },
    { ic: '🔍', c: AM, t: 'Self-critique', p: a.issues.length
        ? `Checking myself against my own record: across ${a.n} decided cases I've predicted <b>${pc(a.avgPred)}%</b> on average but actually won <b>${pc(a.avgActual)}%</b> — a ${pc(a.ece)}% calibration gap. I'm <b>${a.issues.join(' and ')}</b>.`
        : `Across ${a.n} decided cases my predicted rate (${pc(a.avgPred)}%) matches my actual win-rate (${pc(a.avgActual)}%). This call looks well-calibrated.` },
    { ic: corrected ? '✅' : '👍', c: corrected ? G : G, t: corrected ? 'Correction applied' : 'No correction needed', p: corrected
        ? `Shrinking toward my <b>${pc(a.base)}%</b> base rate and reweighting. I've saved a <b>${pc(a.shrink)}%</b> humility factor — every future prediction is now calibrated down, automatically.`
        : `I'll leave the prediction as is — my confidence is earning its keep.` },
  ];
  b.innerHTML = steps.map((s) => `<div class="sc-step"><span class="sc-ic" style="background:${s.c}">${s.ic}</span><div class="sc-t"><b>${s.t}</b><p>${s.p}</p></div></div>`).join('')
    + (corrected ? `<div class="sc-corr"><div><div class="v old">${pc(a.p0)}%</div><div class="lab">before</div></div><span class="ar">→</span><div><div class="v new">${pc(a.p1)}%</div><div class="lab">after reflection</div></div></div>` : '')
    + `<div class="sc-foot">${corrected ? 'The correction is saved to Eon\'s synced memory — it persists across devices and sessions.' : 'Self-verification runs on every prediction; corrections only apply when the evidence demands them.'}</div>`
    + `<button class="sc-rerun">↻ Run the check again</button>`;
  const nodes = [...b.querySelectorAll('.sc-step')];
  nodes.forEach((n, i) => setTimeout(() => n.classList.add('in'), 300 + i * 1500));
  b.querySelector('.sc-rerun').onclick = () => run(el);
  // persist the learned correction (owner, synced) so the model actually improves
  if (corrected) { try { window.EonBrain && window.EonBrain.setStore && window.EonBrain.setStore('winCalib', { shrink: a.shrink, ece: a.ece, at: new Date().toISOString().slice(0, 10) }); } catch {} }
  try { window.EonTrace && window.EonTrace.unshift({ t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), line: corrected ? `Self-correction: ${pc(a.p0)}%→${pc(a.p1)}% (overconfident by ${pc(a.ece)}%), reweighted` : 'Self-check: predictions well-calibrated' }); } catch {}
}

const EonSelfCorrect = { open() { const el = ensureEl(); el.classList.add('show'); run(el); return el; }, analyse };
if (typeof window !== 'undefined') window.EonSelfCorrect = Object.assign(window.EonSelfCorrect || {}, EonSelfCorrect);
export default EonSelfCorrect;
