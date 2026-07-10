/* ============================================================
   EON · intel/crisis.js  —  Live Crisis Feed Fusion
   ------------------------------------------------------------
   Eon reaches out to a live external signal (foreign-exchange rates via
   a free, no-key public API) and fuses it with the founder's OWN exposure
   (import-linked costs from the finance ledger): "the taka moved X% — that
   puts ~৳Y of your monthly costs at risk, here's the live data."

   Real-time multi-source data fusion — the "calamity agent" pattern.
   Free-plan safe: a keyless CORS-enabled endpoint (open.er-api.com), a 4s
   timeout, and a graceful OFFLINE fallback to the last synced rate so it
   never dead-ends on venue Wi-Fi. Register: window.EonCrisis.
   ============================================================ */

const A = '#4f46e5', R = '#d6453d', G = '#0f9d58', AM = '#c77d0a';
const FX_URL = 'https://open.er-api.com/v6/latest/USD';
const IMPORT_SHARE = 0.35;         // assumed share of costs that are import/FX-linked
const money = (n) => { try { return typeof window.fmtBDT === 'function' ? window.fmtBDT(n) : '৳' + Math.round(Math.abs(n)).toLocaleString(); } catch { return '৳' + Math.round(Math.abs(n)); } };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function monthlyExpense() {
  try {
    const F = window.FinanceDB; if (!F) return 0; if (!F.data && F.loadLocal) F.loadLocal();
    const tx = (F.all ? F.all() : (F.data && F.data.tx) || []) || [];
    const exp = tx.filter((t) => t.type === 'expense');
    if (!exp.length) return 0;
    const total = exp.reduce((s, t) => s + Math.abs(+t.amount || 0), 0);
    const months = (() => { const ds = exp.map((t) => Date.parse(t.date || t.on || '')).filter((n) => !isNaN(n)); return ds.length < 2 ? 1 : Math.max(1, Math.round((Math.max(...ds) - Math.min(...ds)) / (30 * 86400000))); })();
    return total / months;
  } catch { return 0; }
}

async function fetchFX() {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(FX_URL, { signal: ctrl.signal });
    const j = await r.json();
    clearTimeout(to);
    const rate = j && j.rates && j.rates.BDT;
    if (!rate) throw new Error('no BDT');
    return { rate, live: true, at: (j.time_last_update_utc || '').slice(0, 16) };
  } catch (e) {
    clearTimeout(to);
    // OFFLINE fallback → last synced rate, else a sensible default
    let last = null; try { last = (window.EonBrain && window.EonBrain.getStore && window.EonBrain.getStore('fx')) || null; } catch {}
    return { rate: (last && last.rate) || 119.5, live: false, at: last && last.at || null, cached: !!last };
  }
}

async function scan() {
  const fx = await fetchFX();
  // change vs the last time we looked (stored, synced)
  let prev = null; try { prev = (window.EonBrain && window.EonBrain.getStore && window.EonBrain.getStore('fx')) || null; } catch {}
  const delta = (prev && prev.rate) ? (fx.rate - prev.rate) / prev.rate : 0;
  // persist the latest reading (owner, synced)
  try { if (fx.live && window.EonBrain && window.EonBrain.setStore) window.EonBrain.setStore('fx', { rate: fx.rate, at: fx.at || new Date().toISOString().slice(0, 10) }); } catch {}
  const monthly = monthlyExpense();
  const exposure = monthly * IMPORT_SHARE;
  const stressMove = 0.03;                 // a plausible 3% taka slide
  const atRisk = exposure * stressMove;
  return { rate: fx.rate, live: fx.live, cached: fx.cached, at: fx.at, delta, monthly, exposure, atRisk, stressMove };
}

function view(s) {
  const dirUp = s.delta > 0.0005, dirDn = s.delta < -0.0005;
  const chg = Math.abs(s.delta) >= 0.0005 ? `${dirUp ? '▲' : '▼'} ${(Math.abs(s.delta) * 100).toFixed(2)}% since Eon last looked` : 'stable since last check';
  const implication = s.exposure > 0
    ? `~<b>${money(s.exposure)}</b>/mo of your costs are import-linked. A 3% taka slide would add <b style="color:${R}">${money(s.atRisk)}</b> to them — ${s.delta > 0.005 ? 'and the rate just moved against you.' : 'worth hedging if the trend continues.'}`
    : `Connect Accounts and Eon will translate every currency move into your real ৳ exposure.`;
  return `
    <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
      <div class="ed-num" style="font-size:30px;color:#111634">৳${s.rate.toFixed(2)}<span style="font-size:14px;color:var(--text-soft);font-weight:500"> / USD</span></div>
      <span style="font-size:12px;font-weight:600;color:${dirUp ? R : dirDn ? G : 'var(--text-soft)'}">${chg}</span>
      <span style="margin-left:auto;font:600 10px 'Inter';text-transform:uppercase;letter-spacing:.05em;padding:3px 8px;border-radius:999px;background:${s.live ? '#e6f6ee' : '#fdf2e0'};color:${s.live ? G : AM}">${s.live ? '● live' : 'offline · cached'}</span>
    </div>
    <p class="ed-empty" style="margin-top:12px">${implication}</p>
    <div style="margin-top:6px;font-size:11px;color:var(--text-faint)">Source: open exchange rates${s.at ? ' · ' + esc(s.at) : ''}. Eon fuses live markets with your ledger.</div>`;
}

let _last = null, _lastAt = 0;
const EonCrisis = {
  scan,
  /** render into a container (async): shows a live FX signal fused with exposure.
      Caches the reading for 60s so re-renders/re-mounts never double-hit the network. */
  async render(el) {
    if (!el) return;
    if (_last && (Date.now() - _lastAt) < 60000) { el.innerHTML = view(_last); return; }
    el.innerHTML = `<p class="ed-empty">Reaching the market feed…</p>`;
    try {
      const s = await scan(); _last = s; _lastAt = Date.now(); el.innerHTML = view(s);
      try { window.EonTrace && window.EonTrace.unshift({ t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), line: `Crisis feed: USD/BDT ${s.rate.toFixed(2)}${s.live ? ' (live)' : ' (offline)'}${s.exposure ? ` · ${money(s.atRisk)} at risk on a 3% move` : ''}` }); } catch {}
    } catch { el.innerHTML = `<p class="ed-empty">Couldn't reach the market feed — Eon will retry. Your last-known rate is used offline.</p>`; }
  },
};
if (typeof window !== 'undefined') window.EonCrisis = Object.assign(window.EonCrisis || {}, EonCrisis);
export default EonCrisis;
