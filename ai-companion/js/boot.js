/* ============================================================
   EON · boot.js — idle-time loader.
   The page's CONTENT paints first; Eon (the Three.js avatar, the
   brain, the Q&A library) loads a moment later when the browser is
   idle — so navigation feels instant on slow connections. Same
   modules, same behaviour, just politely late.
   ============================================================ */
let started = false;
function start() {
  if (started) return; started = true;
  import('./main.js').catch((e) => console.warn('[EON] companion failed to load:', e));
  import('../eon-brain/eon-brain.js').catch((e) => console.warn('[EON] brain failed to load:', e));
}
function whenIdle() {
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 2200 });
  else setTimeout(start, 700);
}
if (document.readyState === 'complete') whenIdle();
else window.addEventListener('load', whenIdle, { once: true });
setTimeout(start, 3500);   // hard fallback — Eon always arrives
