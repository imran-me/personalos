/* ============================================================
   EON · analytics/scholar.js  —  the Academic brain
   ------------------------------------------------------------
   Eon's intelligence layer over the Academics section (courses,
   attendance, assessments, assignments). Portable: reads whatever
   the host exposes through window.EonBrain (discovery.js), so it
   works on any site that stores similar entity arrays.

     • fusion()      — §6.1 one prioritized list across assessments,
                       assignments AND opportunities (urgency × weight)
     • performance() — §6.2 course-wise + topic-wise results, trends,
                       prep↔result correlation, plain-English pattern
     • improvement() — §6.3 the flagship: detects the weak course,
                       builds an ordered study plan from YOUR logged
                       topics, attaches real study resources (curated
                       free links + live YouTube search deep-links),
                       and keeps a persistent synced Focus List
     • anomalies()   — §6.4 attendance runs, results that are outliers
                       vs your own history, workload spike weeks
   Every output carries a plain-English "why" (§6.5).
   Register: window.EonScholar.
   ============================================================ */

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const brain = () => { try { return window.EonBrain || null; } catch { return null; } };
const dataOf = () => { try { return (brain() && brain().getData()) || {}; } catch { return {}; } };
const daysTo = (d) => { const t = Date.parse(d); return isNaN(t) ? null : Math.floor((t - Date.now()) / 86400000); };
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const GRADE_PT = { 'a+': 4, a: 3.75, 'a-': 3.5, 'b+': 3.25, b: 3, 'b-': 2.75, 'c+': 2.5, c: 2.25, 'c-': 2, 'd+': 1.75, d: 1.5, f: 0 };
const pct = (a) => { const o = Number(a.obtainedMarks), t = Number(a.totalMarks); return (isFinite(o) && isFinite(t) && t > 0) ? o / t : null; };
const courseKey = (a) => String(a.course || '').trim();
const shortCourse = (label) => String(label || '').split(' — ')[0] || label;
const DONE_ASG = /completed|submitted|graded/i;

/* ---------- §6.1 deadline & workload fusion ---------- */
export function fusion({ max = 6 } = {}) {
  const d = dataOf(); const out = [];
  (d.assessments || []).forEach((a) => {
    if ((a.status || 'Upcoming') !== 'Upcoming') return;
    const dl = daysTo(a.date); if (dl == null || dl < -1) return;
    const w = Number(a.weight) || 5;
    out.push({ kind: a.type || 'Test', label: a.title || a.type, course: shortCourse(a.course), days: dl, weight: w, link: 'academics.html', score: (dl <= 0 ? 4 : dl <= 2 ? 3 : dl <= 5 ? 2 : 1.2) * (1 + w / 25), why: `${a.type || 'Assessment'} in ${dl <= 0 ? 'hours' : dl + 'd'} · ${w}% of the grade` });
  });
  (d.assignments || []).forEach((a) => {
    if (DONE_ASG.test(a.status || '')) return;
    const dl = daysTo(a.dueDate); if (dl == null || dl < -14) return;
    const w = Number(a.weight) || 5;
    out.push({ kind: 'Assignment', label: a.title, course: shortCourse(a.course), days: dl, weight: w, link: 'academics.html', score: (dl < 0 ? 4.5 : dl <= 1 ? 3.4 : dl <= 4 ? 2.2 : 1.1) * (1 + w / 25), why: `${dl < 0 ? 'Overdue' : 'Due in ' + dl + 'd'} · ${w}%${a.status ? ' · ' + a.status : ''}` });
  });
  (d.opportunities || []).forEach((o) => {
    if (/won|lost|reject|accept|complete|withdraw|miss|irrelevant/i.test(o.status || '')) return;
    const dl = daysTo(o.deadline); if (dl == null || dl < 0 || dl > 21) return;
    out.push({ kind: 'Opportunity', label: o.name, course: o.type || '', days: dl, link: `opportunity-details.html?id=${o.id}`, score: (dl <= 1 ? 3.2 : dl <= 4 ? 2.4 : 1.3) * 1.15, why: `Deadline in ${dl}d` });
  });
  return out.sort((a, b) => b.score - a.score || a.days - b.days).slice(0, max);
}

/* ---------- §6.2 course-wise & topic-wise performance ---------- */
export function performance() {
  const d = dataOf();
  const done = (d.assessments || []).filter((a) => a.status === 'Done' && pct(a) != null);
  const byCourse = {};
  done.forEach((a) => (byCourse[courseKey(a)] = byCourse[courseKey(a)] || []).push(a));
  const courses = Object.entries(byCourse).map(([label, list]) => {
    list.sort((x, y) => String(x.date || '').localeCompare(String(y.date || '')));
    const scores = list.map(pct);
    const avg = mean(scores);
    const half = Math.floor(scores.length / 2);
    const trend = scores.length >= 3 ? (mean(scores.slice(half)) - mean(scores.slice(0, half))) : 0;
    const vs = list.map((a) => { const ca = Number(a.classAverage), t = Number(a.totalMarks); return (isFinite(ca) && isFinite(t) && t > 0) ? pct(a) - ca / t : null; }).filter((x) => x != null);
    return { label, short: shortCourse(label), n: scores.length, avg, trend, vsClass: vs.length ? mean(vs) : null };
  }).sort((a, b) => a.avg - b.avg);

  const byTopic = {};
  done.forEach((a) => (Array.isArray(a.topics) ? a.topics : []).forEach((t) => (byTopic[String(t).toLowerCase()] = byTopic[String(t).toLowerCase()] || []).push(pct(a))));
  const topics = Object.entries(byTopic).filter(([, v]) => v.length >= 1).map(([t, v]) => ({ topic: t, n: v.length, avg: mean(v) })).sort((a, b) => a.avg - b.avg);

  // prep ↔ result correlation (needs the preparedness field logged)
  const prepNum = (p) => { const m = String(p || '').match(/^(\d)/); return m ? +m[1] : null; };
  const hi = done.filter((a) => (prepNum(a.preparedness) || 0) >= 4).map(pct);
  const lo = done.filter((a) => { const p = prepNum(a.preparedness); return p != null && p <= 2; }).map(pct);
  const prep = (hi.length >= 2 && lo.length >= 1) ? { hi: mean(hi), lo: mean(lo) } : null;

  // the plain-English cross-course pattern (§6.2)
  let pattern = null;
  if (topics.length >= 2 && topics[0].avg != null) {
    const weak = topics[0], strong = topics[topics.length - 1];
    if (strong.avg - weak.avg >= 0.15) pattern = `You score ${Math.round(strong.avg * 100)}% on “${strong.topic}” but ${Math.round(weak.avg * 100)}% on “${weak.topic}” — a topic-level gap, not a course-level one. Target the topic, not the subject.`;
  }
  if (!pattern && prep && prep.hi - prep.lo >= 0.12) pattern = `When you rate yourself prepared (4-5) you average ${Math.round(prep.hi * 100)}%, vs ${Math.round(prep.lo * 100)}% when unprepared — preparation, not ability, is your grade lever.`;
  return { courses, topics, prep, pattern, n: done.length };
}

/* ---------- §6.3 the improvement engine ---------- */
const RESOURCE_LIB = [
  { re: /program|coding|\bc\b|c\+\+|java|python|pointer|recursion|loop|array|function|data structure|algorithm|linked list|stack|queue|tree|graph/, links: [
    { label: 'CS50 (Harvard) — full course, free', url: 'https://cs50.harvard.edu/x/' },
    { label: 'freeCodeCamp — interactive practice', url: 'https://www.freecodecamp.org/learn' },
    { label: 'Neso Academy — C programming playlist', url: 'https://www.youtube.com/@nesoacademy/playlists' },
  ] },
  { re: /math|algebra|matrix|matrices|calculus|determinant|vector|geometry|trigonometry/, links: [
    { label: 'Khan Academy — step-by-step math', url: 'https://www.khanacademy.org/math' },
    { label: '3Blue1Brown — visual intuition', url: 'https://www.youtube.com/@3blue1brown' },
  ] },
  { re: /statistic|probability|regression|data science|machine learning/, links: [
    { label: 'StatQuest — statistics made clear', url: 'https://www.youtube.com/@statquest' },
    { label: 'Khan Academy — statistics & probability', url: 'https://www.khanacademy.org/math/statistics-probability' },
  ] },
  { re: /physics|circuit|electronics|signal/, links: [
    { label: 'Khan Academy — physics', url: 'https://www.khanacademy.org/science/physics' },
    { label: 'The Organic Chemistry Tutor — worked problems', url: 'https://www.youtube.com/@TheOrganicChemistryTutor' },
  ] },
  { re: /english|writing|essay|grammar|communication/, links: [
    { label: 'Purdue OWL — academic writing', url: 'https://owl.purdue.edu/owl/purdue_owl.html' },
  ] },
];
function resourcesFor(topic, courseTitle) {
  const q = `${topic} ${courseTitle || ''}`.toLowerCase();
  const lib = RESOURCE_LIB.find((r) => r.re.test(q));
  const links = [
    { label: `YouTube: “${topic}” explained`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + ' tutorial explained')}` },
    ...(lib ? lib.links.slice(0, 2) : [{ label: 'freeCodeCamp — search the topic', url: 'https://www.freecodecamp.org/news/search/?query=' + encodeURIComponent(topic) }]),
  ];
  return links;
}

export function improvement() {
  const d = dataOf();
  const perf = performance();
  const findings = [];

  // (1) weak ONGOING course from results: lowest average with ≥2 logged results, or declining
  const weakLive = perf.courses.find((c) => c.n >= 2 && c.avg != null && (c.avg < 0.65 || c.trend < -0.08));
  if (weakLive) {
    const declining = weakLive.trend < -0.05;
    findings.push({
      course: weakLive.label, short: weakLive.short, kind: 'live',
      grade: `${Math.round(weakLive.avg * 100)}% avg`,
      why: `${weakLive.short} is your ${perf.courses[0] === weakLive ? 'lowest-scoring' : 'weakest'} course (${Math.round(weakLive.avg * 100)}% over ${weakLive.n} assessments)${declining ? ', and the scores are DECLINING, not flat' : ''}${weakLive.vsClass != null ? ` · ${weakLive.vsClass >= 0 ? 'above' : 'below'} class average by ${Math.abs(Math.round(weakLive.vsClass * 100))}%` : ''}.`,
    });
  }
  // (2) weak COMPLETED course from the final grade (the "C in Structured Programming" case)
  (d.courses || []).forEach((c) => {
    const gp = Number(c.gradePoint) || GRADE_PT[String(c.finalGrade || '').toLowerCase().trim()];
    if (c.status === 'Completed' && gp != null && gp <= 2.5) {
      findings.push({ course: `${c.code} — ${c.title}`, short: c.code || c.title, kind: 'completed', grade: c.finalGrade || `GP ${gp}`, why: `${c.title} finished with a ${c.finalGrade || gp} — worth a structured review before anything builds on it${c.difficulty ? ` (you rated it ${String(c.difficulty).toLowerCase()})` : ''}.` });
    }
  });
  if (!findings.length) return { ok: perf.n > 0, findings: [], plan: null, perf };

  // study plan for the top finding: weakest topics first (from YOUR logged data)
  const f = findings[0];
  const courseAssess = (d.assessments || []).filter((a) => a.status === 'Done' && courseKey(a) === f.course && pct(a) != null);
  const topicScores = {};
  courseAssess.forEach((a) => (Array.isArray(a.topics) ? a.topics : []).forEach((t) => (topicScores[t] = topicScores[t] || []).push(pct(a))));
  let weakTopics = Object.entries(topicScores).map(([t, v]) => ({ topic: t, avg: mean(v) })).sort((a, b) => a.avg - b.avg).slice(0, 4);
  if (!weakTopics.length) {
    const c = (d.courses || []).find((x) => `${x.code} — ${x.title}` === f.course || x.title === f.course);
    weakTopics = (Array.isArray(c && c.syllabusTopics) ? c.syllabusTopics : []).slice(0, 4).map((t) => ({ topic: t, avg: null }));
  }
  const courseTitle = f.course.split(' — ')[1] || f.course;
  const plan = weakTopics.map((w, i) => ({
    order: i + 1, topic: w.topic, score: w.avg != null ? Math.round(w.avg * 100) + '%' : 'not tested yet',
    hours: w.avg == null ? 2 : w.avg < 0.5 ? 4 : w.avg < 0.7 ? 3 : 2,
    resources: resourcesFor(w.topic, courseTitle),
  }));
  return { ok: true, findings, top: f, plan, perf };
}

/* ---------- Focus List (persistent + synced) ---------- */
export function focusList() { try { return ((brain() && brain().getStore && brain().getStore('scholar')) || {}).focus || []; } catch { return []; } }
export function addFocus(course, reason) {
  try {
    const cur = focusList().filter((x) => x.course !== course);
    cur.unshift({ course, reason: String(reason || '').slice(0, 140), since: new Date().toISOString().slice(0, 10) });
    brain() && brain().mergeStore && brain().mergeStore('scholar', { focus: cur.slice(0, 6) });
    return true;
  } catch { return false; }
}
export function removeFocus(course) {
  try { brain() && brain().mergeStore && brain().mergeStore('scholar', { focus: focusList().filter((x) => x.course !== course) }); return true; } catch { return false; }
}
/** create spaced study reminders for the current plan (owner, synced). */
export async function remindPlan(plan, short) {
  let n = 0;
  for (let i = 0; i < Math.min(3, (plan || []).length); i++) {
    const when = new Date(); when.setDate(when.getDate() + 1 + i * 2); when.setHours(19, 0, 0, 0);
    try { const r = brain() && brain().createReminder && brain().createReminder({ title: `Study ${plan[i].topic} — ${short}`, remindAt: when.toISOString(), note: 'From EON’s improvement plan' }); if (r && r.then) await r; n++; } catch {}
  }
  return n;
}

/* ---------- §6.4 anomalies, academic edition ---------- */
export function anomalies() {
  const d = dataOf(); const out = [];
  // attendance: consecutive-absence runs + threshold proximity
  const byCourse = {};
  (d.attendance || []).forEach((a) => (byCourse[courseKey(a)] = byCourse[courseKey(a)] || []).push(a));
  Object.entries(byCourse).forEach(([label, rows]) => {
    rows.sort((x, y) => String(x.date || '').localeCompare(String(y.date || '')));
    const real = rows.filter((r) => ['Present', 'Absent', 'Late'].includes(r.status));
    let run = 0; for (let i = real.length - 1; i >= 0 && real[i].status === 'Absent'; i--) run++;
    if (run >= 2) out.push({ kind: 'attendance', sev: 3 + run, label: shortCourse(label), why: `${run} absences in a row in ${shortCourse(label)} — that's a pattern, not a one-off.` });
    const present = real.filter((r) => r.status !== 'Absent').length;
    const c = (d.courses || []).find((x) => `${x.code} — ${x.title}` === label);
    const thr = ((c && Number(c.attendanceThreshold)) || 75) / 100;
    if (real.length >= 6) { const p = present / real.length; if (p >= thr && p - thr <= 0.05) out.push({ kind: 'attendance', sev: 3.5, label: shortCourse(label), why: `${shortCourse(label)} attendance is ${Math.round(p * 100)}% — only ${Math.round((p - thr) * 100)}% above the ${Math.round(thr * 100)}% minimum. One skipped week could sink it.` }); }
  });
  // grades: latest result an outlier vs your OWN history in that course (leave-one-out)
  const done = (d.assessments || []).filter((a) => a.status === 'Done' && pct(a) != null);
  const byC = {}; done.forEach((a) => (byC[courseKey(a)] = byC[courseKey(a)] || []).push(a));
  Object.entries(byC).forEach(([label, list]) => {
    if (list.length < 3) return;
    list.sort((x, y) => String(x.date || '').localeCompare(String(y.date || '')));
    const last = list[list.length - 1]; const rest = list.slice(0, -1).map(pct);
    const m = mean(rest); const sd = Math.sqrt(mean(rest.map((x) => (x - m) * (x - m)))) || 0.08;
    const z = (pct(last) - m) / sd;
    if (z <= -1.6) out.push({ kind: 'grade', sev: 4.2, label: shortCourse(label), why: `“${last.title || last.type}” scored ${Math.round(pct(last) * 100)}% — unusually low FOR YOU in ${shortCourse(label)} (you average ${Math.round(m * 100)}%).` });
  });
  // workload: a week ≥2× your rolling average of due items
  const weekOf = (dt) => { const t = new Date(dt); const day = (t.getDay() + 6) % 7; t.setDate(t.getDate() - day); return t.toISOString().slice(0, 10); };
  const counts = {};
  [...(d.assessments || []).filter((a) => (a.status || 'Upcoming') === 'Upcoming').map((a) => a.date), ...(d.assignments || []).filter((a) => !DONE_ASG.test(a.status || '')).map((a) => a.dueDate)]
    .filter((x) => { const dl = daysTo(x); return dl != null && dl >= 0 && dl <= 42; })
    .forEach((x) => { const k = weekOf(x); counts[k] = (counts[k] || 0) + 1; });
  const vals = Object.values(counts);
  if (vals.length >= 2) { const avg = mean(vals); const [peakWk, peakN] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]; if (peakN >= 3 && peakN >= avg * 2) out.push({ kind: 'workload', sev: 3.8, label: 'Crunch week', why: `Week of ${peakWk}: ${peakN} academic deadlines — ${(peakN / avg).toFixed(1)}× your usual load. Start the biggest one now.` }); }
  return out.sort((a, b) => b.sev - a.sev).slice(0, 4);
}

/* ---------- master compute for the deck ---------- */
export function compute() {
  const d = dataOf();
  const has = (k) => Array.isArray(d[k]) && d[k].length > 0;
  if (!has('courses') && !has('assessments') && !has('assignments')) return { ok: false };
  return { ok: true, fusion: fusion(), perf: performance(), improve: improvement(), anomalies: anomalies(), focus: focusList() };
}

const EonScholar = { compute, fusion, performance, improvement, anomalies, focusList, addFocus, removeFocus, remindPlan };
if (typeof window !== 'undefined') window.EonScholar = Object.assign(window.EonScholar || {}, EonScholar);
export default EonScholar;
