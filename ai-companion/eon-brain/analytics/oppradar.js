/* ============================================================
   EON · analytics/oppradar.js  —  Opportunity Radar
   ------------------------------------------------------------
   Eon scans a curated opportunity feed (contests, hackathons,
   scholarships, grants) and ranks each item by FIT to the owner's
   real interests — learned from their own records (opportunity
   names/types they pursue, projects, research topics) — showing
   "new things you can participate in", not FX rates.

   The feed lives in the repo (knowledge/opportunities-feed.json):
   same-origin fetch → live-updateable by just editing the file, no
   code change, works on GitHub Pages, offline falls back to an
   embedded snapshot. Content-based recommendation via token overlap
   (idea #8 'Signal Radar 2.0' — curated feed now, live scraping is
   the roadmap). Register: window.EonOppRadar.
   ============================================================ */

const FEED_URL = new URL('../knowledge/opportunities-feed.json', import.meta.url);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STOP = new Set('the a an and or of for to in on at by with from 2025 2026 2027 new my our your challenge challange competition contest program programme project research about'.split(' '));
const toks = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w));

/* fallback snapshot (subset) so the radar works offline / first-run */
const EMBEDDED = [
  { title: 'NASA Space Apps Challenge 2026', org: 'NASA', tags: ['hackathon', 'space', 'data science', 'ai', 'global', 'team'], deadline: '2026-08-01', url: 'https://www.spaceappschallenge.org', prize: 'Global awards' },
  { title: 'Kaggle Community Competitions', org: 'Kaggle', tags: ['data science', 'machine learning', 'competition', 'portfolio'], deadline: '2026-09-30', approx: true, url: 'https://www.kaggle.com/competitions', prize: 'Medals & prizes' },
  { title: 'Chevening Scholarship (UK)', org: 'UK Government', tags: ['scholarship', 'masters', 'uk', 'leadership', 'fully funded'], deadline: '2026-11-04', approx: true, url: 'https://www.chevening.org', prize: 'Fully-funded master’s' },
  { title: 'Microsoft Imagine Cup', org: 'Microsoft', tags: ['startup', 'ai', 'students', 'pitch', 'global'], deadline: '2026-12-15', approx: true, url: 'https://imaginecup.microsoft.com', prize: 'USD 100,000' },
  { title: 'BASIS National ICT Awards', org: 'BASIS', tags: ['ict', 'startup', 'bangladesh', 'award'], deadline: '2026-09-15', approx: true, url: 'https://bnia.basis.org.bd', prize: 'National recognition' },
];

let _feed = null;
async function loadFeed() {
  if (_feed) return _feed;
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(FEED_URL, { signal: ctrl.signal }); clearTimeout(to);
    const j = await r.json();
    if (j && Array.isArray(j.items) && j.items.length) { _feed = { items: j.items, live: true, updated: j.updated }; return _feed; }
    throw new Error('empty feed');
  } catch { _feed = { items: EMBEDDED, live: false, updated: null }; return _feed; }
}

/* the owner's interest profile — tokens weighted by where they come from */
function profile() {
  const w = {};
  const add = (words, weight) => words.forEach((t) => { w[t] = (w[t] || 0) + weight; });
  try {
    const b = window.EonBrain; const data = (b && b.getData && b.getData()) || {};
    for (const [key, arr] of Object.entries(data)) {
      if (!Array.isArray(arr)) continue;
      const isOpp = /opportunit|scholarship|deal|pipeline/i.test(key);
      arr.forEach((r) => {
        if (!r || typeof r !== 'object') return;
        add(toks(r.name || r.title || ''), isOpp ? 3 : 1.5);
        add(toks(r.type || r.category || r.field || ''), isOpp ? 4 : 2);
      });
    }
  } catch {}
  // sensible seed interests so the radar works even with thin data
  add(['data', 'science', 'hackathon', 'scholarship', 'bangladesh', 'students'], 1);
  return w;
}

export async function scan({ max = 5 } = {}) {
  const feed = await loadFeed();
  const prof = profile();
  const now = Date.now();
  const scored = feed.items
    .filter((it) => { const t = Date.parse(it.deadline || ''); return isNaN(t) || t >= now - 86400000; })
    .map((it) => {
      const itToks = [...new Set([...toks(it.title), ...(it.tags || []).flatMap(toks), ...toks(it.org)])];
      const raw = itToks.reduce((s, t) => s + (prof[t] || 0), 0);
      const days = (() => { const t = Date.parse(it.deadline || ''); return isNaN(t) ? null : Math.ceil((t - now) / 86400000); })();
      return { ...it, raw, days };
    });
  const maxRaw = Math.max(1, ...scored.map((x) => x.raw));
  const items = scored.map((x) => ({ ...x, fit: Math.round(28 + (x.raw / maxRaw) * 67 * (x.raw > 0 ? 1 : 0.4)) }))
    .sort((a, b) => b.fit - a.fit || (a.days ?? 999) - (b.days ?? 999)).slice(0, max);
  return { items, live: feed.live, updated: feed.updated, total: feed.items.length };
}

function view(res) {
  const rows = res.items.map((it) => `
    <a class="ed-row" href="${esc(it.url || '#')}" target="_blank" rel="noopener">
      <span class="ed-cd ${it.days != null && it.days <= 14 ? 'soon' : ''}" title="fit to your interests">${it.fit}%</span>
      <span style="flex:1;min-width:0"><b>${esc(it.title)}</b>
      <small>${esc(it.org)}${it.days != null ? ` · ${it.days <= 0 ? 'closes today' : it.days + 'd left'}${it.approx ? ' (typical window)' : ''}` : ''}${it.prize ? ' · ' + esc(it.prize) : ''}</small></span>
      <i class="bi bi-box-arrow-up-right" style="color:var(--text-faint,#9aa3b2);font-size:12px"></i>
    </a>`).join('');
  return `${rows || '<p class="ed-empty">No open opportunities in the feed right now.</p>'}
    <div style="margin-top:10px;font-size:11px;color:var(--text-faint,#9aa3b2)">Ranked by fit to <b>your</b> fields · ${res.live ? 'curated feed' + (res.updated ? ' · updated ' + esc(res.updated) : '') : 'offline snapshot'} · live scraping on the roadmap</div>`;
}

let _last = null, _lastAt = 0;
const EonOppRadar = {
  scan,
  async render(el) {
    if (!el) return;
    if (_last && Date.now() - _lastAt < 60000) { el.innerHTML = view(_last); return; }
    el.innerHTML = `<p class="ed-empty">Scanning for opportunities that fit you…</p>`;
    try {
      const res = await scan(); _last = res; _lastAt = Date.now();
      el.innerHTML = view(res);
      try { if (res.items[0]) window.EonTrace && window.EonTrace.unshift({ t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), line: `Opportunity radar: ${res.items.length}/${res.total} matches · top “${res.items[0].title}” (${res.items[0].fit}% fit)` }); } catch {}
    } catch { el.innerHTML = `<p class="ed-empty">Couldn't scan the feed — Eon will retry.</p>`; }
  },
};
if (typeof window !== 'undefined') window.EonOppRadar = Object.assign(window.EonOppRadar || {}, EonOppRadar);
export default EonOppRadar;
