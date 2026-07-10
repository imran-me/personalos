/* ============================================================
   EON · analytics/graph.js  —  Relationship-Graph Intelligence
   ------------------------------------------------------------
   Builds a graph over the founder's contacts (mentors, referees,
   alumni) and opportunities, matches people to opportunities by
   field/skill overlap, computes simple centrality and recency, and
   surfaces "for this fellowship, your strongest referee is Prof. X —
   and you've gone quiet with them, reach out."

   Technique: graph analytics — adjacency + bipartite matching +
   centrality/recency. Portable: reads whatever contacts/opportunity
   entities EonBrain discovered. Pure client-side. Register: window.EonGraph.
   ============================================================ */

const STOP = new Set('the a an and or of for to in on at by with from your you i me my our we is are as it this that these those be will can into over under new more most all any each per via at'.split(' '));
const tokens = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function pickEntity(ents, data, re) {
  const keys = Object.keys(ents).filter((k) => Array.isArray(data[k]) && data[k].length);
  return keys.find((k) => re.test(k)) || null;
}
function profileText(rec, desc) {
  if (!rec) return '';
  const skip = new Set([desc.idField, desc.deadlineField].filter(Boolean));
  return Object.entries(rec).filter(([k, v]) => !skip.has(k) && typeof v !== 'object').map(([, v]) => v).join(' ');
}
function dateFieldOf(arr, desc) {
  const fields = (desc.fields || Object.keys(arr[0] || {}));
  const pref = ['lastcontact', 'last_contacted', 'contacted', 'updatedat', 'updated', 'lastseen', 'date', 'createdat'];
  for (const p of pref) { const f = fields.find((x) => x.toLowerCase().replace(/[^a-z]/g, '').includes(p)); if (f && arr.some((r) => r && !isNaN(Date.parse(r[f])))) return f; }
  return null;
}

function compute() {
  const b = window.EonBrain; if (!b || !b.getData) return null;
  let data = {}, ents = {};
  try { data = b.getData() || {}; ents = b.getEntities() || {}; } catch {}
  const cKey = pickEntity(ents, data, /contact|people|network|mentor|referee|alumni/i);
  const oKey = pickEntity(ents, data, /opportunit|scholarship|deal|lead|application|pipeline/i);
  if (!cKey || !oKey) return { ok: false, reason: !cKey ? 'no contacts' : 'no opportunities' };
  const cDesc = ents[cKey], oDesc = ents[oKey];
  const contacts = data[cKey].filter((r) => r && typeof r === 'object');
  const opps = data[oKey].filter((r) => r && typeof r === 'object');
  const label = (r, d) => (d.labelField && r[d.labelField]) || r.name || r.title || '—';

  // token profiles
  const cProf = contacts.map((c) => ({ rec: c, name: label(c, cDesc), toks: new Set(tokens(profileText(c, cDesc))) }));
  const oProf = opps.map((o) => ({ rec: o, name: label(o, oDesc), status: o.status || o.stage || '', toks: new Set(tokens((o.type || '') + ' ' + (o.field || '') + ' ' + label(o, oDesc) + ' ' + (o.category || '') + ' ' + (o.tags || o.skills || ''))) }));

  const overlap = (a, c) => { let n = 0; for (const t of c) if (a.has(t)) n++; return n; };
  const edges = [];
  const recs = [];
  const DONE = /won|lost|reject|accept|complete|withdraw|miss|irrelevant/i;
  oProf.forEach((o) => {
    const live = !DONE.test(o.status);
    let best = null;
    cProf.forEach((c) => { const s = overlap(o.toks, c.toks); if (s > 0) { edges.push({ o: o.name, c: c.name, w: s }); if (!best || s > best.s) best = { c, s }; } });
    if (best && live) recs.push({ opp: o.name, contact: best.c.name, shared: best.s, contactRec: best.c.rec });
  });
  recs.sort((a, c) => c.shared - a.shared);

  // centrality: contact linked to the most opportunities
  const deg = {}; edges.forEach((e) => { deg[e.c] = (deg[e.c] || 0) + 1; });
  const central = Object.entries(deg).sort((a, c) => c[1] - a[1])[0] || null;

  // neglected: a key contact with an old "last contacted" date
  const dField = dateFieldOf(contacts, cDesc);
  const neglected = [];
  if (dField) {
    const now = Date.now();
    cProf.forEach((c) => { const t = Date.parse(c.rec[dField]); if (!isNaN(t)) { const days = Math.floor((now - t) / 86400000); if (days >= 30 && (deg[c.name] || 0) > 0) neglected.push({ name: c.name, days }); } });
    neglected.sort((a, c) => c.days - a.days);
  }

  return { ok: true, contacts: contacts.length, opps: opps.length, edges, recs, central, neglected, nodesC: cProf.map((c) => c.name), nodesO: oProf.map((o) => o.name) };
}

/* compact bipartite graph SVG (opportunities ↔ contacts) */
function graphSvg(g) {
  const O = g.nodesO.slice(0, 6), C = g.nodesC.slice(0, 7);
  const W = 340, H = Math.max(160, Math.max(O.length, C.length) * 30 + 20);
  const yO = (i) => 20 + i * ((H - 40) / Math.max(1, O.length - 1 || 1));
  const yC = (i) => 20 + i * ((H - 40) / Math.max(1, C.length - 1 || 1));
  const oi = {}; O.forEach((n, i) => oi[n] = i); const ci = {}; C.forEach((n, i) => ci[n] = i);
  const maxW = Math.max(1, ...g.edges.map((e) => e.w));
  const lines = g.edges.filter((e) => oi[e.o] != null && ci[e.c] != null).map((e) => `<path d="M40,${yO(oi[e.o]).toFixed(0)} C${W / 2},${yO(oi[e.o]).toFixed(0)} ${W / 2},${yC(ci[e.c]).toFixed(0)} ${W - 40},${yC(ci[e.c]).toFixed(0)}" fill="none" stroke="#4f46e5" stroke-width="${(0.6 + e.w / maxW * 2).toFixed(1)}" opacity="${(0.15 + e.w / maxW * 0.4).toFixed(2)}"/>`).join('');
  const oNodes = O.map((n, i) => `<circle cx="40" cy="${yO(i).toFixed(0)}" r="5" fill="#0ea5e9"/><text x="32" y="${(yO(i) + 3).toFixed(0)}" text-anchor="end" font-size="10" fill="#374151" font-family="Inter">${esc(n.length > 18 ? n.slice(0, 17) + '…' : n)}</text>`).join('');
  const cNodes = C.map((n, i) => `<circle cx="${W - 40}" cy="${yC(i).toFixed(0)}" r="5" fill="#4f46e5"/><text x="${W - 32}" y="${(yC(i) + 3).toFixed(0)}" font-size="10" fill="#374151" font-family="Inter">${esc(n.length > 16 ? n.slice(0, 15) + '…' : n)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">${lines}${oNodes}${cNodes}</svg>`;
}

const EonGraph = { compute, graphSvg };
if (typeof window !== 'undefined') window.EonGraph = Object.assign(window.EonGraph || {}, EonGraph);
export default EonGraph;
