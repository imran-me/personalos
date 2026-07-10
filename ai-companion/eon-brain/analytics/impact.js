/* ============================================================
   EON · analytics/impact.js  —  Quantified Impact Counter
   ------------------------------------------------------------
   The measurable-impact headline: "Eon's impact so far — X deadlines
   guarded · Y opportunities surfaced · Z hours saved · ৳W leaks flagged."
   Derived from real data (never fabricated), persisted as running maxima
   so the headline never regresses, and SYNCED across devices via the
   eon-brain/brain doc (window.EonBrain.getStore/setStore) — with a
   localStorage cache as an offline fallback.

   Portable: reads window.EonBrain (records/deadlines), window.EonWinPredictor
   (live pipeline) and window.EonAnomaly (৳ leaks). Register: window.EonImpact.
   API: get() → merged metrics · refresh() → recompute+persist.
   ============================================================ */

const KEY = 'impact';
const LS = 'eon-impact-v1';
const round = (x, d = 0) => { const p = Math.pow(10, d); return Math.round((Number(x) || 0) * p) / p; };
const brain = () => { try { return window.EonBrain || null; } catch { return null; } };
const ownerOK = () => { const b = brain(); try { return !!(b && b.isOwner && b.isOwner()); } catch { return false; } };
const daysTo = (iso) => { const t = Date.parse(iso); return isNaN(t) ? null : Math.floor((t - Date.now()) / 86400000); };

function compute() {
  const b = brain();
  const recs = (() => { try { return (b && b.getRecords && b.getRecords()) || []; } catch { return []; } })();
  const withDl = recs.filter((r) => r.deadlineAt && !isNaN(Date.parse(r.deadlineAt)));
  const upcoming = withDl.filter((r) => { const d = daysTo(r.deadlineAt); return d != null && d >= 0 && d <= 30; }).length;

  // opportunities surfaced = live pipeline the model actively scores (fallback: upcoming)
  let surfaced = upcoming;
  try { const w = window.EonWinPredictor && window.EonWinPredictor.summary(); if (w && w.live != null) surfaced = Math.max(surfaced, w.live); } catch {}

  // deadlines guarded = future deadlines Eon is actively watching
  const guarded = upcoming;

  // hours saved — a modest, defensible estimate from what Eon organises
  const hours = round(recs.length * 0.08 + surfaced * 0.3, 1);

  // ৳ leaks flagged/at-risk from the anomaly detector
  let money = 0, leaksN = 0;
  try { const L = window.EonAnomaly && window.EonAnomaly.scan(); if (L) { money = L.recovered || 0; leaksN = L.count || 0; } } catch {}

  return { guarded, surfaced, hours, leaksFlagged: leaksN, money: round(money) };
}

const EonImpact = {
  _merged: null,
  refresh() {
    const live = compute();
    // running maxima so the headline never regresses
    const b = brain();
    let saved = {};
    try { saved = (b && b.getStore && b.getStore(KEY)) || JSON.parse(localStorage.getItem(LS) || '{}'); } catch {}
    const today = new Date().toISOString().slice(0, 10);
    const merged = {
      guarded: Math.max(saved.guarded || 0, live.guarded),
      surfaced: Math.max(saved.surfaced || 0, live.surfaced),
      hours: Math.max(saved.hours || 0, live.hours),
      leaksFlagged: Math.max(saved.leaksFlagged || 0, live.leaksFlagged),
      money: Math.max(saved.money || 0, live.money),
      since: saved.since || today,
    };
    this._merged = merged;
    // persist: Firestore-synced (owner) + local cache
    try { localStorage.setItem(LS, JSON.stringify(merged)); } catch {}
    try { if (ownerOK() && b && b.mergeStore && JSON.stringify(saved) !== JSON.stringify(merged)) b.mergeStore(KEY, merged); } catch {}
    return merged;
  },
  get() { return this._merged || this.refresh(); },
};
if (typeof window !== 'undefined') window.EonImpact = Object.assign(window.EonImpact || {}, EonImpact);
export default EonImpact;
