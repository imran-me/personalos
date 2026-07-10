/* ==========================================================
   ACADEMICS — the institution layer (assets/js/academics.js)
   Programme & courses → weekly schedule → one-tap attendance →
   assessments (tests/quizzes) with rich result logging → a live
   assignment board with a working canvas, auto-filled printable
   cover page and email-to-teacher.

   Classic script loaded AFTER app.js: shares DB / SCHEMAS /
   openEntityModal / Security / helpers, and stores everything as
   plain entity arrays in the same opptrack/data doc — so EON's
   discovery.js reads it all with zero extra wiring.
   ========================================================== */

/* ---------- constants ---------- */
const ACAD_ENTITIES = ['programme', 'courses', 'faculty', 'attendance', 'assessments', 'assignments'];
const ACAD_GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F', 'Incomplete', 'Withdrawn'];
const ACAD_ASG_COLS = ['To Do', 'In Progress', 'Review', 'Completed', 'Submitted'];
const ACAD_COL_DOT = { 'To Do': 'var(--slate)', 'In Progress': 'var(--blue)', 'Review': 'var(--amber)', 'Completed': 'var(--green)', 'Submitted': 'var(--violet)' };
const ACAD_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ACAD_COLORS = ['Indigo', 'Sky', 'Green', 'Amber', 'Red', 'Violet', 'Slate'];
const ACAD_COLOR_HEX = { Indigo: '#4f46e5', Sky: '#0ea5e9', Green: '#0f9d58', Amber: '#c77d0a', Red: '#d6453d', Violet: '#7c3aed', Slate: '#64748b' };

/* ---------- schemas: rich fields so EON has maximum signal ---------- */
Object.assign(SCHEMAS, {
  programme: {
    label: 'Programme', icon: 'mortarboard-fill',
    fields: [
      { key: 'degree', label: 'Degree / Programme name', type: 'text', required: true, span: true },
      { key: 'department', label: 'Department', type: 'text' },
      { key: 'institution', label: 'Institution / University', type: 'text' },
      { key: 'batch', label: 'Batch', type: 'text' },
      { key: 'section', label: 'Section', type: 'text' },
      { key: 'rollId', label: 'Roll / Student ID', type: 'text' },
      { key: 'currentSemester', label: 'Current semester', type: 'number' },
      { key: 'totalSemesters', label: 'Total semesters', type: 'number' },
      { key: 'creditsCompleted', label: 'Credits completed', type: 'number' },
      { key: 'totalCredits', label: 'Total credits required', type: 'number' },
      { key: 'cgpa', label: 'Current CGPA', type: 'number' },
      { key: 'cgpaTarget', label: 'CGPA target', type: 'number', hint: 'EON tracks your gap to this' },
      { key: 'advisor', label: 'Academic advisor', type: 'text' },
      { key: 'startDate', label: 'Started', type: 'date' },
      { key: 'expectedGraduation', label: 'Expected graduation', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea', span: true },
    ],
  },
  courses: {
    label: 'Course', icon: 'journal-bookmark',
    fields: [
      { key: 'code', label: 'Course code', type: 'text', required: true, hint: 'e.g. CSE-1101' },
      { key: 'title', label: 'Course title', type: 'text', required: true },
      { key: 'credit', label: 'Credit hours', type: 'number' },
      { key: 'semester', label: 'Semester', type: 'text', hint: 'e.g. 3 or Fall 2026' },
      { key: 'teacher', label: 'Teacher', type: 'text' },
      { key: 'teacherEmail', label: 'Teacher email', type: 'text', hint: 'Used by “Send to teacher”' },
      { key: 'section', label: 'Section', type: 'text' },
      { key: 'room', label: 'Room / building', type: 'text' },
      { key: 'classDays', label: 'Class days & times', type: 'text', span: true, hint: 'e.g. “Sun 10:00-11:30; Tue 10:00-11:30” — builds the weekly schedule automatically' },
      { key: 'status', label: 'Status', type: 'select', opts: ['Ongoing', 'Completed', 'Dropped', 'Retaking'] },
      { key: 'finalGrade', label: 'Final grade (when completed)', type: 'select', opts: ACAD_GRADES, hint: 'EON reads this for the improvement engine' },
      { key: 'gradePoint', label: 'Grade point (e.g. 3.75)', type: 'number' },
      { key: 'attendanceThreshold', label: 'Attendance minimum %', type: 'number', hint: 'Default 75 — “at risk” is judged against this' },
      { key: 'totalPlannedClasses', label: 'Total planned classes', type: 'number', hint: 'Sharpens the “classes you can still miss” counter' },
      { key: 'courseType', label: 'Type', type: 'select', opts: ['Theory', 'Lab', 'Theory + Lab', 'Project', 'Thesis', 'Seminar'] },
      { key: 'difficulty', label: 'Difficulty (your feel)', type: 'select', opts: ['Easy', 'Moderate', 'Hard', 'Very hard'], hint: 'EON weighs harder courses higher' },
      { key: 'color', label: 'Color tag', type: 'select', opts: ACAD_COLORS },
      { key: 'syllabusLink', label: 'Syllabus link', type: 'url' },
      { key: 'syllabusTopics', label: 'Syllabus topics', type: 'tags', span: true, hint: 'Comma separated — powers topic-wise analysis & study plans' },
      { key: 'notes', label: 'Notes', type: 'textarea', span: true },
    ],
  },
  faculty: {
    label: 'Faculty member', icon: 'person-badge',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, span: true },
      { key: 'designation', label: 'Designation', type: 'select', opts: ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Instructor', 'Teaching Assistant'] },
      { key: 'department', label: 'Department', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'courses', label: 'Courses taught', type: 'text', hint: 'e.g. CSE-1101, CSE-2202' },
      { key: 'officeRoom', label: 'Office room', type: 'text' },
      { key: 'officeHours', label: 'Office hours', type: 'text', hint: 'e.g. Sun & Tue 14:00-16:00' },
      { key: 'preferredContact', label: 'Preferred contact', type: 'select', opts: ['Email', 'Phone', 'WhatsApp', 'In person'] },
      { key: 'lastContact', label: 'Last contact', type: 'date', hint: 'EON nudges neglected relationships' },
      { key: 'notes', label: 'Notes', type: 'textarea', span: true },
    ],
  },
  attendance: {
    label: 'Attendance entry', icon: 'check2-square',
    fields: [
      { key: 'course', label: 'Course', type: 'select', opts: '@courses', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'status', label: 'Status', type: 'select', opts: ['Present', 'Absent', 'Late', 'Cancelled', 'Holiday'] },
      { key: 'classTopic', label: 'Topic covered', type: 'text', span: true, hint: 'What was taught — feeds topic-wise analysis' },
      { key: 'note', label: 'Note / reason', type: 'text', span: true },
    ],
  },
  assessments: {
    label: 'Assessment', icon: 'pencil-square',
    fields: [
      { key: 'course', label: 'Course', type: 'select', opts: '@courses', required: true },
      { key: 'type', label: 'Type', type: 'select', opts: ['Class Test', 'Quiz', 'Midterm', 'Final', 'Lab Test', 'Presentation', 'Viva', 'Project Defense'] },
      { key: 'title', label: 'Title', type: 'text', required: true, hint: 'e.g. “Quiz 2 — Recursion”' },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'time', label: 'Time', type: 'text', hint: 'e.g. 10:00' },
      { key: 'venue', label: 'Room / venue', type: 'text' },
      { key: 'topics', label: 'Topics covered', type: 'tags', span: true, hint: 'Comma separated — EON analyses strengths per topic' },
      { key: 'weight', label: 'Weight (% of grade)', type: 'number', hint: 'EON prioritises heavier assessments' },
      { key: 'totalMarks', label: 'Total marks', type: 'number' },
      { key: 'preparedness', label: 'Preparedness (before)', type: 'select', opts: ['1 — Not ready', '2 — Barely', '3 — Okay', '4 — Well prepared', '5 — Fully ready'], hint: 'EON correlates prep with results' },
      { key: 'status', label: 'Status', type: 'select', opts: ['Upcoming', 'Done', 'Missed', 'Cancelled'] },
      { key: 'obtainedMarks', label: 'Marks obtained (after)', type: 'number' },
      { key: 'grade', label: 'Grade received', type: 'text' },
      { key: 'classAverage', label: 'Class average (if known)', type: 'number', hint: 'Lets EON compare you vs the class' },
      { key: 'difficultyFelt', label: 'How hard did it feel?', type: 'select', opts: ['1 — Easy', '2 — Fair', '3 — Moderate', '4 — Hard', '5 — Brutal'] },
      { key: 'feedback', label: 'Teacher feedback', type: 'textarea', span: true },
      { key: 'reviewNotes', label: 'Answer-review notes', type: 'textarea', span: true, hint: 'What you got wrong & why — gold for the improvement engine' },
    ],
  },
  assignments: {
    label: 'Assignment', icon: 'file-earmark-text',
    fields: [
      { key: 'course', label: 'Course', type: 'select', opts: '@courses', required: true },
      { key: 'title', label: 'Assignment title', type: 'text', required: true, span: true },
      { key: 'subtitle', label: 'Subtitle / topic', type: 'text', span: true },
      { key: 'assignedDate', label: 'Assigned', type: 'date' },
      { key: 'dueDate', label: 'Due date', type: 'date', required: true },
      { key: 'weight', label: 'Weight (% of grade)', type: 'number' },
      { key: 'totalMarks', label: 'Total marks', type: 'number' },
      { key: 'format', label: 'Format', type: 'text', hint: 'e.g. 1500 words / 6 pages / slides' },
      { key: 'submissionMode', label: 'Submission mode', type: 'select', opts: ['Hardcopy', 'Email', 'Online portal', 'Google Classroom', 'In class'] },
      { key: 'priority', label: 'Priority', type: 'select', opts: 'priorities' },
      { key: 'groupWork', label: 'Group assignment', type: 'checkbox', span: true, hint: 'Tick if this is group work' },
      { key: 'groupMembers', label: 'Group members', type: 'text', span: true },
      { key: 'requirements', label: 'Requirements checklist', type: 'textarea', span: true, hint: 'One requirement per line — becomes a tick-list in the working canvas' },
      { key: 'status', label: 'Status', type: 'select', opts: [...ACAD_ASG_COLS, 'Graded'] },
      { key: 'obtainedMarks', label: 'Marks obtained (after grading)', type: 'number' },
      { key: 'teacherFeedback', label: 'Teacher feedback', type: 'textarea', span: true },
    ],
  },
});

/* ---------- shared helpers ---------- */
function acadEnsure() { ACAD_ENTITIES.forEach(k => { if (!Array.isArray(DB.data[k])) DB.data[k] = []; }); }
function courseLabel(c) { return `${c.code || ''} — ${c.title || ''}`.replace(/^ — /, ''); }
function courseByLabel(label) {
  const l = String(label || '').trim();
  return DB.getAll('courses').find(c => courseLabel(c) === l || c.title === l || c.code === l) || null;
}
function courseHex(c) { return ACAD_COLOR_HEX[c && c.color] || 'var(--primary)'; }
const acadOngoing = () => DB.getAll('courses').filter(c => (c.status || 'Ongoing') === 'Ongoing' || c.status === 'Retaking');

/* Parse "Sun 10:00-11:30; Tue 2pm-3:30pm (Lab-2)" → [{day, start, end, room}] */
function parseClassDays(str) {
  const out = [];
  String(str || '').split(/[;,]+/).forEach(seg => {
    const m = seg.trim().match(/^(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?\s*(\d{1,2}[:.]?\d{0,2})?\s*(am|pm)?\s*(?:-|to|–)?\s*(\d{1,2}[:.]?\d{0,2})?\s*(am|pm)?\s*(?:\((.+?)\))?$/i);
    if (!m) return;
    const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(m[1].slice(0, 3).toLowerCase());
    const norm = (t, ap) => {
      if (!t) return null;
      let [h, mm] = t.replace('.', ':').split(':'); h = +h; mm = mm ? +mm : 0;
      const a = (ap || '').toLowerCase();
      if (a === 'pm' && h < 12) h += 12; if (a === 'am' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    };
    out.push({ day, start: norm(m[2], m[3]), end: norm(m[4], m[5] || m[3]), room: m[6] || null });
  });
  return out;
}

/* Attendance stats per course label. Late counts as attended (flagged separately). */
function attendanceStats(label) {
  const rows = DB.getAll('attendance').filter(a => a.course === label);
  const held = rows.filter(a => a.status === 'Present' || a.status === 'Absent' || a.status === 'Late').length;
  const present = rows.filter(a => a.status === 'Present' || a.status === 'Late').length;
  const late = rows.filter(a => a.status === 'Late').length;
  const absent = held - present;
  const pct = held ? present / held : null;
  return { held, present, late, absent, pct, rows };
}
/* “Classes you can still afford to miss” — the number students actually want. */
function canStillMiss(course, st) {
  const t = (Number(course.attendanceThreshold) || 75) / 100;
  const planned = Number(course.totalPlannedClasses) || 0;
  if (planned > 0) return Math.max(0, Math.floor(planned * (1 - t)) - st.absent);
  if (!st.held) return null;
  return Math.max(0, Math.floor(st.present / t - st.held));
}

/* Assessment % for result rows. */
function assessPct(a) {
  const ob = Number(a.obtainedMarks), tot = Number(a.totalMarks);
  return (isFinite(ob) && isFinite(tot) && tot > 0) ? ob / tot : null;
}

/* ---------- page renderers ---------- */
function acadRenderStats() {
  const host = document.getElementById('acadStats'); if (!host) return;
  const prog = DB.getAll('programme')[0] || {};
  const courses = acadOngoing();
  const credits = courses.reduce((s, c) => s + (Number(c.credit) || 0), 0);
  // overall attendance across ongoing courses
  let held = 0, present = 0;
  courses.forEach(c => { const st = attendanceStats(courseLabel(c)); held += st.held; present += st.present; });
  const attPct = held ? Math.round(present / held * 100) : null;
  const upcoming = DB.getAll('assessments').filter(a => (a.status || 'Upcoming') === 'Upcoming' && daysUntil(a.date) != null && daysUntil(a.date) >= 0).length
    + DB.getAll('assignments').filter(a => !['Completed', 'Submitted', 'Graded'].includes(a.status) && daysUntil(a.dueDate) != null && daysUntil(a.dueDate) >= 0).length;
  const openAsg = DB.getAll('assignments').filter(a => !['Submitted', 'Graded'].includes(a.status || 'To Do')).length;
  const cells = [
    { lbl: prog.degree ? `Semester ${prog.currentSemester || '—'}` : 'Set up programme', val: prog.degree ? (prog.currentSemester || '—') : '⚙', ico: 'mortarboard-fill', t: 'primary' },
    { lbl: 'Ongoing courses', val: courses.length, ico: 'journal-bookmark', t: 'blue' },
    { lbl: 'Credits this semester', val: credits, ico: 'stack', t: 'violet' },
    { lbl: 'Attendance', val: attPct == null ? '—' : attPct + '%', ico: 'check2-square', t: attPct != null && attPct < 80 ? 'red' : 'green' },
    { lbl: 'Upcoming (tests + due)', val: upcoming, ico: 'alarm-fill', t: 'amber' },
    { lbl: 'Open assignments', val: openAsg, ico: 'file-earmark-text', t: 'accent' },
    ...(prog.cgpa ? [{ lbl: `CGPA${prog.cgpaTarget ? ' · target ' + prog.cgpaTarget : ''}`, val: prog.cgpa, ico: 'graph-up-arrow', t: 'green' }] : []),
  ];
  host.innerHTML = cells.map(c => `<div class="stat"><div class="ico t-${c.t}"><i class="bi bi-${c.ico}"></i></div><div class="val">${c.val}</div><div class="lbl">${escapeHtml(String(c.lbl))}</div></div>`).join('');
}

function acadRenderToday() {
  const host = document.getElementById('acadToday'); if (!host) return;
  const today = new Date(); const dow = today.getDay(); const iso = today.toISOString().slice(0, 10);
  const marks = DB.getAll('attendance').filter(a => a.date === iso);
  const classes = [];
  acadOngoing().forEach(c => parseClassDays(c.classDays).forEach(s => { if (s.day === dow) classes.push({ c, s }); }));
  classes.sort((a, b) => String(a.s.start || '99').localeCompare(String(b.s.start || '99')));
  if (!classes.length) { host.innerHTML = `<p class="text-soft mb-0" style="font-size:13px">No classes today. 🌿 ${acadOngoing().length ? '' : 'Add your courses (with class days) to build the schedule.'}</p>`; return; }
  host.innerHTML = classes.map(({ c, s }) => {
    const label = courseLabel(c);
    const mark = marks.find(a => a.course === label);
    const btn = (st, ico, cls) => `<button class="acad-att ${cls} owner-only" data-course="${escapeHtml(label)}" data-status="${st}" title="${st}"><i class="bi bi-${ico}"></i>${st}</button>`;
    return `<div class="acad-todayrow" style="--k:${courseHex(c)}">
      <span class="acad-time">${s.start || '—'}${s.end ? '–' + s.end : ''}</span>
      <span class="acad-tbody"><b>${escapeHtml(label)}</b><small>${escapeHtml(c.teacher || '')}${s.room || c.room ? ' · ' + escapeHtml(s.room || c.room) : ''}</small></span>
      ${mark
        ? `<span class="acad-marked st-${escapeHtml(mark.status)}"><i class="bi bi-check2"></i> ${escapeHtml(mark.status)}</span><button class="acad-unmark owner-only" data-id="${mark.id}" title="Undo">↺</button>`
        : `<span class="acad-attwrap">${btn('Present', 'check2-circle', 'p')}${btn('Late', 'clock-history', 'l')}${btn('Absent', 'x-circle', 'a')}${btn('Cancelled', 'slash-circle', 'c')}</span>`}
    </div>`;
  }).join('');
  host.querySelectorAll('.acad-att').forEach(b => b.onclick = () => {
    if (!Security.guard('mark attendance')) return;
    acadEnsure();
    DB.upsert('attendance', { course: b.dataset.course, date: iso, status: b.dataset.status });
    toast(`${b.dataset.status} — ${b.dataset.course.split(' — ')[0]}`, 'ok');
    acadRedraw();
  });
  host.querySelectorAll('.acad-unmark').forEach(b => b.onclick = () => { DB.remove('attendance', b.dataset.id); acadRedraw(); });
}

function acadRenderSchedule() {
  const host = document.getElementById('acadSchedule'); if (!host) return;
  const byDay = ACAD_DAYS.map(() => []);
  acadOngoing().forEach(c => parseClassDays(c.classDays).forEach(s => { if (s.day >= 0) byDay[s.day].push({ c, s }); }));
  byDay.forEach(list => list.sort((a, b) => String(a.s.start || '99').localeCompare(String(b.s.start || '99'))));
  const todayDow = new Date().getDay();
  if (!byDay.some(l => l.length)) { host.innerHTML = `<p class="text-soft mb-0" style="font-size:13px">Add courses with “class days & times” (e.g. <code>Sun 10:00-11:30; Tue 10:00-11:30</code>) and the weekly grid builds itself.</p>`; return; }
  host.innerHTML = byDay.map((list, d) => `
    <div class="acad-day ${d === todayDow ? 'today' : ''}">
      <div class="acad-dayhead">${ACAD_DAYS[d]}${d === todayDow ? '<span>today</span>' : ''}</div>
      ${list.length ? list.map(({ c, s }) => `<div class="acad-slot" style="--k:${courseHex(c)}" title="${escapeHtml(courseLabel(c))}${c.teacher ? ' · ' + escapeHtml(c.teacher) : ''}">
          <b>${escapeHtml(c.code || c.title)}</b><small>${s.start || ''}${s.end ? '–' + s.end : ''}${s.room || c.room ? ' · ' + escapeHtml(s.room || c.room) : ''}</small>
        </div>`).join('') : '<div class="acad-free">—</div>'}
    </div>`).join('');
}

function acadRenderCourses() {
  const host = document.getElementById('acadCourses'); if (!host) return;
  const courses = DB.getAll('courses');
  if (!courses.length) {
    host.innerHTML = `<div style="text-align:center;padding:18px 10px">
      <p class="text-soft mb-2" style="font-size:13px">No courses yet — add your first course, or load a ready starter pack<br>(your DIU CIS info + real faculty + sample courses, attendance, tests &amp; assignments — everything editable).</p>
      <button class="btn btn-primary btn-sm owner-only" id="acadStarterBtn"><i class="bi bi-magic me-1"></i>Load my starter data</button>
    </div>`;
    const sb = document.getElementById('acadStarterBtn'); if (sb) sb.onclick = acadLoadStarter;
    return;
  }
  const ordered = [...courses].sort((a, b) => (a.status === 'Ongoing' ? -1 : 1) - (b.status === 'Ongoing' ? -1 : 1) || String(a.code).localeCompare(String(b.code)));
  host.innerHTML = ordered.map(c => {
    const label = courseLabel(c);
    const st = attendanceStats(label);
    const thr = (Number(c.attendanceThreshold) || 75);
    const pct = st.pct == null ? null : Math.round(st.pct * 100);
    const risk = pct != null && pct < thr;
    const miss = canStillMiss(c, st);
    const done = (c.status === 'Completed');
    return `<div class="acad-course ${done ? 'done' : ''}" style="--k:${courseHex(c)}" data-id="${c.id}">
      <div class="acad-chead">
        <b>${escapeHtml(c.code || '')}</b>
        <span class="acad-credit">${c.credit ? c.credit + ' cr' : ''}${c.courseType ? ' · ' + escapeHtml(c.courseType) : ''}</span>
        ${done ? `<span class="acad-grade">${escapeHtml(c.finalGrade || '')}</span>` : ''}
      </div>
      <div class="acad-ctitle">${escapeHtml(c.title || '')}</div>
      <div class="acad-cteach">${escapeHtml(c.teacher || '')}${c.section ? ' · Sec ' + escapeHtml(c.section) : ''}</div>
      ${!done ? `
      <div class="acad-attbar" title="attendance vs ${thr}% minimum"><span style="width:${pct == null ? 0 : pct}%;background:${risk ? 'var(--red)' : 'var(--green)'}"></span><i style="left:${thr}%"></i></div>
      <div class="acad-cfoot">
        <span class="${risk ? 'text-danger' : ''}" style="font-weight:600">${pct == null ? 'No attendance yet' : pct + '% attendance'}</span>
        ${miss != null ? `<span class="text-faint">· can still miss <b>${miss}</b></span>` : ''}
        ${st.late ? `<span class="text-faint">· ${st.late} late</span>` : ''}
      </div>` : `<div class="acad-cfoot"><span class="text-faint">Completed${c.gradePoint ? ' · GP ' + c.gradePoint : ''}</span></div>`}
    </div>`;
  }).join('');
  host.querySelectorAll('.acad-course').forEach(el => el.onclick = () => openEntityModal('courses', el.dataset.id, acadRedraw));
}

function acadRenderAssessments() {
  const up = document.getElementById('acadAssessUpcoming'), res = document.getElementById('acadAssessResults');
  if (!up || !res) return;
  const all = DB.getAll('assessments');
  const upcoming = all.filter(a => (a.status || 'Upcoming') === 'Upcoming').map(a => ({ a, d: daysUntil(a.date) }))
    .filter(x => x.d == null || x.d >= -1).sort((x, y) => (x.d ?? 999) - (y.d ?? 999));
  up.innerHTML = upcoming.length ? `<div class="acad-upgrid">${upcoming.slice(0, 6).map(({ a, d }) => {
    const c = courseByLabel(a.course);
    return `<div class="acad-up" style="--k:${courseHex(c)}" data-id="${a.id}">
      <span class="acad-cd ${d != null && d <= 2 ? 'soon' : ''}">${d == null ? '—' : d <= 0 ? 'today' : d + 'd'}</span>
      <div class="acad-upbody">
        <b>${escapeHtml(a.title || a.type || 'Assessment')}</b>
        <small>${escapeHtml((a.course || '').split(' — ')[0])} · ${escapeHtml(a.type || '')}${a.weight ? ' · ' + a.weight + '%' : ''}${a.time ? ' · ' + escapeHtml(a.time) : ''}${a.venue ? ' · ' + escapeHtml(a.venue) : ''}</small>
        ${(Array.isArray(a.topics) && a.topics.length) ? `<small class="acad-topics">${a.topics.slice(0, 4).map(t => `<em>${escapeHtml(t)}</em>`).join('')}</small>` : ''}
      </div>
      <button class="btn btn-soft btn-sm owner-only acad-log" data-id="${a.id}">Log result</button>
    </div>`;
  }).join('')}</div>` : `<p class="text-soft mb-2" style="font-size:13px">No upcoming assessments — add class tests, quizzes, midterms & finals and EON counts them down.</p>`;

  const done = all.filter(a => a.status === 'Done' && assessPct(a) != null)
    .sort((x, y) => String(y.date || '').localeCompare(String(x.date || ''))).slice(0, 8);
  res.innerHTML = done.length ? `
    <div class="section-title" style="margin:6px 0 8px;font-size:11.5px">Recent results</div>
    ${done.map(a => {
      const p = Math.round(assessPct(a) * 100);
      const avg = Number(a.classAverage), tot = Number(a.totalMarks);
      const vsAvg = (isFinite(avg) && isFinite(tot) && tot > 0) ? p - Math.round(avg / tot * 100) : null;
      return `<div class="acad-res" data-id="${a.id}">
        <span class="acad-respct ${p >= 80 ? 'g' : p >= 60 ? 'a' : 'r'}">${p}%</span>
        <span class="acad-resbody"><b>${escapeHtml(a.title || a.type)}</b><small>${escapeHtml((a.course || '').split(' — ')[0])} · ${escapeHtml(a.type || '')} · ${a.obtainedMarks}/${a.totalMarks}${a.grade ? ' · ' + escapeHtml(a.grade) : ''}</small></span>
        ${vsAvg != null ? `<span class="acad-vs ${vsAvg >= 0 ? 'up' : 'dn'}">${vsAvg >= 0 ? '▲' : '▼'} ${Math.abs(vsAvg)}% vs class</span>` : ''}
      </div>`;
    }).join('')}` : '';
  up.querySelectorAll('.acad-log').forEach(b => b.onclick = (e) => { e.stopPropagation(); openEntityModal('assessments', b.dataset.id, acadRedraw); });
  up.querySelectorAll('.acad-up').forEach(el => el.onclick = () => openEntityModal('assessments', el.dataset.id, acadRedraw));
  res.querySelectorAll('.acad-res').forEach(el => el.onclick = () => openEntityModal('assessments', el.dataset.id, acadRedraw));
}

/* ---------- assignment board (kanban + working canvas) ---------- */
function acadRenderBoard() {
  const board = document.getElementById('acadBoard'); if (!board) return;
  const asgs = DB.getAll('assignments');
  board.innerHTML = ACAD_ASG_COLS.map(col => {
    const items = asgs.filter(a => ((a.status === 'Graded' ? 'Submitted' : a.status) || 'To Do') === col);
    return `<div class="kcol" data-col="${col}">
      <div class="kcol-head"><span class="k-dot" style="background:${ACAD_COL_DOT[col]}"></span><b>${col}</b><span class="k-count">${items.length}</span></div>
      <div class="kcol-body" data-col="${col}">
        ${items.map(a => {
          const c = courseByLabel(a.course); const d = daysUntil(a.dueDate);
          const reqs = String(a.requirements || '').split('\n').filter(x => x.trim());
          const ticked = reqs.filter((_, i) => a.reqTicks && a.reqTicks[i]).length;
          return `<div class="kcard acad-asg" draggable="${Security.isOwner()}" data-id="${a.id}" style="--k:${courseHex(c)}">
            <b>${escapeHtml(a.title || 'Assignment')}</b>
            <small>${escapeHtml((a.course || '').split(' — ')[0])}${a.dueDate ? ` · due ${fmtDate(a.dueDate)}` : ''}${d != null && d < 0 && !['Completed', 'Submitted', 'Graded'].includes(a.status) ? ' · <span class="text-danger">overdue</span>' : ''}</small>
            <div class="acad-asgmeta">
              ${reqs.length ? `<span><i class="bi bi-check2-square"></i>${ticked}/${reqs.length}</span>` : ''}
              ${a.canvasContent ? `<span><i class="bi bi-pencil"></i>${String(a.canvasContent).split(/\s+/).filter(Boolean).length}w</span>` : ''}
              ${a.weight ? `<span>${a.weight}%</span>` : ''}
              ${a.status === 'Graded' && a.obtainedMarks != null ? `<span class="acad-gradechip">${a.obtainedMarks}/${a.totalMarks || '—'}</span>` : ''}
              ${a.groupWork ? '<span title="group"><i class="bi bi-people"></i></span>' : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');

  let dragId = null;
  board.querySelectorAll('.kcard').forEach(card => {
    card.addEventListener('dragstart', () => { dragId = card.dataset.id; card.classList.add('dragging'); });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('click', () => acadOpenCanvas(card.dataset.id));
  });
  board.querySelectorAll('.kcol-body').forEach(zone => {
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault(); zone.classList.remove('drag-over');
      if (!dragId || !Security.guard('move assignments')) return;
      const a = DB.get('assignments', dragId);
      if (a && a.status !== zone.dataset.col) { DB.upsert('assignments', { id: a.id, status: zone.dataset.col }); toast(`Moved to “${zone.dataset.col}”.`, 'ok'); }
      acadRedraw();
    });
  });
}

/* The working canvas — write the assignment right where it lives. */
let _acadSaveTimer = null;
function acadOpenCanvas(id) {
  const a = DB.get('assignments', id); if (!a) return;
  const c = courseByLabel(a.course) || {};
  document.getElementById('acadCanvas')?.remove();
  const reqs = String(a.requirements || '').split('\n').filter(x => x.trim());
  const wrap = document.createElement('div'); wrap.id = 'acadCanvas';
  const canPrint = ['Completed', 'Submitted', 'Graded'].includes(a.status);
  wrap.innerHTML = `
    <div class="acv-card">
      <div class="acv-head" style="--k:${courseHex(c)}">
        <div class="acv-ht">
          <b>${escapeHtml(a.title || 'Assignment')}</b>
          <small>${escapeHtml(a.course || '')}${a.dueDate ? ` · due ${fmtDate(a.dueDate)}` : ''}${a.weight ? ` · ${a.weight}%` : ''}</small>
        </div>
        <span class="acv-status">${escapeHtml(a.status || 'To Do')}</span>
        <button class="acv-edit owner-only" title="Edit details"><i class="bi bi-pencil"></i></button>
        <span class="acv-x" title="Close">✕</span>
      </div>
      <div class="acv-body">
        ${reqs.length ? `<div class="acv-reqs"><div class="acv-sec">Requirements — tick as you go</div>
          ${reqs.map((r, i) => `<label class="acv-req"><input type="checkbox" data-i="${i}" ${a.reqTicks && a.reqTicks[i] ? 'checked' : ''} ${Security.isOwner() ? '' : 'disabled'}><span>${escapeHtml(r)}</span></label>`).join('')}</div>` : ''}
        <div class="acv-sec">Your work <span class="acv-saved" id="acvSaved">auto-saves as you type</span></div>
        <textarea id="acvText" placeholder="Write the assignment here — it saves automatically and never leaves your data…" ${Security.isOwner() ? '' : 'disabled'}>${escapeHtml(a.canvasContent || '')}</textarea>
      </div>
      <div class="acv-foot">
        <div class="acv-move owner-only">
          ${ACAD_ASG_COLS.map(col => `<button class="acv-col ${(a.status === 'Graded' ? 'Submitted' : a.status || 'To Do') === col ? 'on' : ''}" data-col="${col}">${col}</button>`).join('')}
        </div>
        <div class="acv-actions">
          <button class="btn btn-soft btn-sm" id="acvPrint" ${canPrint ? '' : 'disabled title="Move to Completed first"'}><i class="bi bi-printer me-1"></i>Print / PDF</button>
          <button class="btn btn-primary btn-sm owner-only" id="acvSend" ${canPrint ? '' : 'disabled title="Move to Completed first"'}><i class="bi bi-envelope me-1"></i>Send to teacher</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => { clearTimeout(_acadSaveTimer); wrap.remove(); acadRedraw(); };
  wrap.querySelector('.acv-x').onclick = close;
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('.acv-edit').onclick = () => { close(); openEntityModal('assignments', id, acadRedraw); };

  // continuous auto-save (debounced) — the workflow IS the writing process
  const ta = wrap.querySelector('#acvText'); const saved = wrap.querySelector('#acvSaved');
  ta.addEventListener('input', () => {
    if (!Security.isOwner()) return;
    saved.textContent = 'saving…';
    clearTimeout(_acadSaveTimer);
    _acadSaveTimer = setTimeout(() => { DB.upsert('assignments', { id, canvasContent: ta.value }); saved.textContent = 'saved ✓'; }, 900);
  });
  wrap.querySelectorAll('.acv-req input').forEach(cb => cb.onchange = () => {
    if (!Security.guard('tick requirements')) return;
    const ticks = Object.assign({}, (DB.get('assignments', id) || {}).reqTicks || {});
    ticks[cb.dataset.i] = cb.checked;
    DB.upsert('assignments', { id, reqTicks: ticks });
  });
  wrap.querySelectorAll('.acv-col').forEach(b => b.onclick = () => {
    if (!Security.guard('move assignments')) return;
    DB.upsert('assignments', { id, status: b.dataset.col });
    acadOpenCanvas(id);   // re-open with fresh state (enables print/send at Completed)
  });
  wrap.querySelector('#acvPrint').onclick = () => acadPrint(id);
  wrap.querySelector('#acvSend').onclick = () => acadSendMail(id);
}

/* Minimal safe formatting for the print body: escape, then **bold**, *italic*,
   __underline__; blank line = new paragraph, single newline = line break. */
function acadRichHtml(text) {
  let s = escapeHtml(String(text || ''));
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/__([^_]+)__/g, '<u>$1</u>').replace(/\*([^*\n]+)\*/g, '<i>$1</i>');
  return s.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

/* Print / PDF export — auto-filled cover page, never retype the header block. */
function acadPrint(id) {
  const a = DB.get('assignments', id); if (!a) return;
  const c = courseByLabel(a.course) || {};
  const prog = DB.getAll('programme')[0] || {};
  const prof = (DB.data.profile || {});
  const fac = DB.getAll('faculty').find(f => f.name && c.teacher && f.name.toLowerCase() === String(c.teacher).toLowerCase());
  const studentName = prof.name || prof.fullName || 'Student Name';
  const rows = [
    ['Name', studentName], ['Roll / ID', prog.rollId], ['Section', prog.section || c.section], ['Batch', prog.batch],
    ['Programme', prog.degree], ['Department', prog.department], ['Semester', c.semester || prog.currentSemester],
  ].filter(r => r[1]);
  const w = window.open('', '_blank');
  if (!w) { toast('Allow pop-ups to generate the print version.', 'err'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(a.title || 'Assignment')}</title>
  <style>
    @page{size:A4;margin:25mm 22mm}
    body{font-family:'Times New Roman',Georgia,serif;color:#111;margin:0;line-height:1.65;font-size:12.5pt}
    .cover{height:92vh;display:flex;flex-direction:column;align-items:center;text-align:center;page-break-after:always;padding-top:8vh;box-sizing:border-box}
    .inst{font-size:15pt;font-weight:bold;letter-spacing:.03em}
    .dept{font-size:11.5pt;margin-top:4px;color:#333}
    .atype{margin-top:12vh;font-size:11pt;letter-spacing:.28em;text-transform:uppercase;color:#444}
    h1{font-size:22pt;margin:14px 0 6px;max-width:80%}
    .sub{font-size:13pt;font-style:italic;color:#333}
    .course{margin-top:26px;font-size:12pt}
    .meta{margin-top:auto;margin-bottom:6vh;width:100%;display:flex;justify-content:space-between;gap:40px;text-align:left}
    .meta h4{font-size:10.5pt;letter-spacing:.14em;text-transform:uppercase;margin:0 0 8px;border-bottom:1.5px solid #111;padding-bottom:4px}
    .meta table{font-size:11.5pt;border-collapse:collapse}
    .meta td{padding:2.5px 0}.meta td:first-child{padding-right:16px;color:#444}
    .date{font-size:11pt;color:#333}
    .body p{margin:0 0 11px;text-align:justify}
  </style></head><body>
  <div class="cover">
    ${prog.institution ? `<div class="inst">${escapeHtml(prog.institution)}</div>` : ''}
    ${prog.department ? `<div class="dept">Department of ${escapeHtml(prog.department)}</div>` : ''}
    <div class="atype">Assignment</div>
    <h1>${escapeHtml(a.title || '')}</h1>
    ${a.subtitle ? `<div class="sub">${escapeHtml(a.subtitle)}</div>` : ''}
    <div class="course">${escapeHtml(c.code || '')}${c.title ? ' — ' + escapeHtml(c.title) : ''}</div>
    <div class="meta">
      <div><h4>Submitted by</h4><table>${rows.map(r => `<tr><td>${escapeHtml(r[0])}</td><td><b>${escapeHtml(String(r[1]))}</b></td></tr>`).join('')}</table></div>
      <div><h4>Submitted to</h4><table>
        ${c.teacher ? `<tr><td>Teacher</td><td><b>${escapeHtml(c.teacher)}</b></td></tr>` : ''}
        ${fac && fac.designation ? `<tr><td>Designation</td><td>${escapeHtml(fac.designation)}</td></tr>` : ''}
        ${prog.department ? `<tr><td>Department</td><td>${escapeHtml(prog.department)}</td></tr>` : ''}
        <tr><td>Date</td><td>${new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })}</td></tr>
      </table></div>
    </div>
  </div>
  <div class="body">${acadRichHtml(a.canvasContent || '')}</div>
  <script>setTimeout(function(){window.print()},450)<\/script>
  </body></html>`);
  w.document.close();
  DB.upsert('assignments', { id, printedAt: new Date().toISOString() });
}

/* Pre-filled email to the teacher — logs the send so “Submitted” has a record. */
function acadSendMail(id) {
  const a = DB.get('assignments', id); if (!a) return;
  const c = courseByLabel(a.course) || {};
  const prog = DB.getAll('programme')[0] || {};
  const prof = (DB.data.profile || {});
  const fac = DB.getAll('faculty').find(f => f.name && c.teacher && f.name.toLowerCase() === String(c.teacher).toLowerCase());
  const email = c.teacherEmail || (fac && fac.email) || '';
  if (!email) { toast('Add the teacher’s email on the course (or in Faculty) first.', 'err'); return; }
  const me = prof.name || 'Student';
  const subject = `[${c.code || 'Course'}] ${a.title || 'Assignment'} — ${me}${prog.rollId ? ' (' + prog.rollId + ')' : ''}`;
  const body = `Dear ${c.teacher || 'Sir/Madam'},%0D%0A%0D%0APlease find attached my assignment “${a.title || ''}” for ${c.code || ''}${c.title ? ' — ' + c.title : ''}.%0D%0A%0D%0A(Tip: use Print / PDF first, save it, and attach the file to this email.)%0D%0A%0D%0ARegards,%0D%0A${me}${prog.rollId ? '%0D%0ARoll: ' + prog.rollId : ''}${prog.section ? ' · Section: ' + prog.section : ''}${prog.batch ? ' · Batch: ' + prog.batch : ''}`;
  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${body}`;
  DB.upsert('assignments', { id, status: 'Submitted', submittedAt: new Date().toISOString(), sentTo: email });
  toast(`Email drafted to ${email} — attach the PDF and send.`, 'ok');
  acadRedraw();
}

/* ---------- starter pack: Imran @ DIU CIS + living sample data ----------
   Real identity + real CIS faculty (public roster); representative courses,
   ~4 weeks of attendance, logged results and live assignments — so every
   Academic feature (and EON's academic brain) has true-shaped data from
   minute one. Owner-clicked; dates are relative to today so it stays alive. */
function acadStarterData() {
  const day = (d, h = 0) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
  const OOP = 'CIS 352 — Object Oriented Programming (Java)';
  const DBMS = 'CIS 344 — Database Management Systems';
  const SAD = 'CIS 331 — System Analysis & Design';
  const MIS = 'CIS 361 — Management Information Systems';
  const WEB = 'CIS 355 — Web Technologies Lab';
  const att = [];
  // ~4 weeks of history: SAD & DBMS solid, MIS one late, OOP ends with a 2-absence run
  const addAtt = (course, offsets, statuses) => offsets.forEach((o, i) => att.push({ course, date: day(o), status: statuses[i] || 'Present' }));
  addAtt(SAD, [-24, -22, -17, -15, -10, -8, -3, -1], []);
  addAtt(DBMS, [-23, -21, -16, -14, -9, -7, -2], []);
  addAtt(MIS, [-23, -21, -16, -14, -9, -7, -2], ['Present', 'Present', 'Late', 'Present', 'Present', 'Present', 'Present']);
  addAtt(OOP, [-24, -22, -17, -15, -10, -8, -3, -1], ['Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Absent', 'Absent']);
  addAtt(WEB, [-19, -12, -5], []);
  return {
    programme: [{ degree: 'B.Sc. in Computing and Information System (CIS)', department: 'Computing and Information System (CIS)', institution: 'Daffodil International University', batch: '232', section: 'A', rollId: '232-16-53', currentSemester: 9, totalSemesters: 12, creditsCompleted: 98, totalCredits: 140, cgpa: 3.42, cgpaTarget: 3.75, advisor: 'Md. Sarwar Hossain Mollah', startDate: '2023-05-02', expectedGraduation: '2027-04-30' }],
    faculty: [
      { name: 'Md. Sarwar Hossain Mollah', designation: 'Associate Professor', department: 'CIS', courses: 'Head of the Department', officeHours: 'Sun & Tue 14:00-16:00', preferredContact: 'Email' },
      { name: 'Mohammad Azam Khan', designation: 'Associate Professor', department: 'CIS', courses: 'CIS 344', preferredContact: 'Email' },
      { name: 'Md. Biplob Hossain', designation: 'Assistant Professor', department: 'CIS', courses: 'CIS 331', preferredContact: 'Email' },
      { name: 'Md. Nasimul Kader', designation: 'Assistant Professor', department: 'CIS', preferredContact: 'Email' },
      { name: 'Md. Mehedi Hassan', designation: 'Lecturer', department: 'CIS', courses: 'CIS 352', preferredContact: 'Email' },
      { name: 'Md. Faruk Hosen', designation: 'Lecturer', department: 'CIS', courses: 'CIS 355', preferredContact: 'Email' },
      { name: 'Sonia Nasrin', designation: 'Lecturer', department: 'CIS', courses: 'CIS 361', preferredContact: 'Email' },
      { name: 'Tamanna Akter', designation: 'Lecturer', department: 'CIS', preferredContact: 'Email' },
    ],
    courses: [
      { code: 'CIS 331', title: 'System Analysis & Design', credit: 3, semester: '9', teacher: 'Md. Biplob Hossain', section: 'A', room: 'AB4-503', classDays: 'Sun 10:00-11:30; Tue 10:00-11:30', status: 'Ongoing', attendanceThreshold: 75, totalPlannedClasses: 24, courseType: 'Theory', difficulty: 'Moderate', color: 'Indigo', syllabusTopics: ['requirements analysis', 'dfd', 'use case', 'uml', 'feasibility study'] },
      { code: 'CIS 344', title: 'Database Management Systems', credit: 3, semester: '9', teacher: 'Mohammad Azam Khan', section: 'A', room: 'AB4-402', classDays: 'Mon 11:40-13:10; Wed 11:40-13:10', status: 'Ongoing', attendanceThreshold: 75, totalPlannedClasses: 24, courseType: 'Theory', difficulty: 'Moderate', color: 'Green', syllabusTopics: ['er model', 'sql', 'normalization', 'transactions', 'indexing'] },
      { code: 'CIS 352', title: 'Object Oriented Programming (Java)', credit: 3, semester: '9', teacher: 'Md. Mehedi Hassan', section: 'A', room: 'AB4-401', classDays: 'Sun 14:00-15:30; Tue 14:00-15:30', status: 'Ongoing', attendanceThreshold: 75, totalPlannedClasses: 24, courseType: 'Theory + Lab', difficulty: 'Hard', color: 'Red', syllabusTopics: ['classes and objects', 'inheritance', 'polymorphism', 'interfaces', 'exception handling'] },
      { code: 'CIS 361', title: 'Management Information Systems', credit: 3, semester: '9', teacher: 'Sonia Nasrin', section: 'A', room: 'AB4-505', classDays: 'Mon 08:30-10:00; Wed 08:30-10:00', status: 'Ongoing', attendanceThreshold: 75, totalPlannedClasses: 24, courseType: 'Theory', difficulty: 'Easy', color: 'Sky', syllabusTopics: ['decision support systems', 'erp', 'business processes', 'it strategy'] },
      { code: 'CIS 355', title: 'Web Technologies Lab', credit: 1.5, semester: '9', teacher: 'Md. Faruk Hosen', section: 'A', room: 'Lab-3', classDays: 'Thu 14:00-16:00 (Lab-3)', status: 'Ongoing', attendanceThreshold: 75, totalPlannedClasses: 12, courseType: 'Lab', difficulty: 'Moderate', color: 'Violet', syllabusTopics: ['html css', 'javascript', 'php basics', 'rest apis'] },
      { code: 'CIS 221', title: 'Structured Programming', credit: 3, semester: '5', teacher: 'Md. Nasimul Kader', status: 'Completed', finalGrade: 'C+', gradePoint: 2.5, courseType: 'Theory', difficulty: 'Hard', color: 'Amber', syllabusTopics: ['loops', 'functions', 'arrays', 'pointers', 'recursion'] },
      { code: 'CIS 111', title: 'Fundamentals of Computing', credit: 3, semester: '1', status: 'Completed', finalGrade: 'A-', gradePoint: 3.5, courseType: 'Theory', color: 'Slate' },
    ],
    attendance: att,
    assessments: [
      // OOP — the declining pattern EON should catch
      { course: OOP, type: 'Class Test', title: 'CT 1 — Classes & Objects', date: day(-21), topics: ['classes and objects'], weight: 10, totalMarks: 20, obtainedMarks: 15, classAverage: 13, preparedness: '4 — Well prepared', status: 'Done' },
      { course: OOP, type: 'Quiz', title: 'Quiz 1 — Inheritance', date: day(-12), topics: ['inheritance'], weight: 5, totalMarks: 20, obtainedMarks: 12, classAverage: 12.5, preparedness: '3 — Okay', status: 'Done', difficultyFelt: '4 — Hard' },
      { course: OOP, type: 'Quiz', title: 'Quiz 2 — Polymorphism', date: day(-4), topics: ['polymorphism'], weight: 5, totalMarks: 20, obtainedMarks: 9, classAverage: 12, preparedness: '2 — Barely', status: 'Done', difficultyFelt: '5 — Brutal', reviewNotes: 'Confused method overriding vs overloading; dynamic dispatch unclear.' },
      { course: OOP, type: 'Midterm', title: 'Midterm — Ch 1-6', date: day(3), time: '14:00', venue: 'AB4-401', topics: ['inheritance', 'polymorphism', 'interfaces'], weight: 25, totalMarks: 40, status: 'Upcoming', preparedness: '3 — Okay' },
      // DBMS — strong and above class
      { course: DBMS, type: 'Class Test', title: 'CT 1 — ER Modeling', date: day(-18), topics: ['er model'], weight: 10, totalMarks: 20, obtainedMarks: 18, classAverage: 14, preparedness: '5 — Fully ready', status: 'Done' },
      { course: DBMS, type: 'Quiz', title: 'Quiz 1 — SQL Joins', date: day(-8), topics: ['sql'], weight: 5, totalMarks: 20, obtainedMarks: 17, classAverage: 13, preparedness: '4 — Well prepared', status: 'Done' },
      { course: DBMS, type: 'Midterm', title: 'Midterm — ER to Normalization', date: day(8), time: '11:40', topics: ['er model', 'sql', 'normalization'], weight: 25, totalMarks: 40, status: 'Upcoming' },
      // SAD + MIS
      { course: SAD, type: 'Quiz', title: 'Quiz 1 — DFD Levels', date: day(-10), topics: ['dfd'], weight: 5, totalMarks: 15, obtainedMarks: 11, classAverage: 10, status: 'Done' },
      { course: SAD, type: 'Quiz', title: 'Quiz 2 — Use Cases', date: day(1), time: '10:00', topics: ['use case'], weight: 5, totalMarks: 15, status: 'Upcoming' },
      { course: MIS, type: 'Presentation', title: 'Group Presentation — ERP Case', date: day(6), topics: ['erp'], weight: 10, totalMarks: 20, status: 'Upcoming' },
    ],
    assignments: [
      { course: DBMS, title: 'Library Database Design Report', subtitle: 'ER diagram to normalized schema', assignedDate: day(-6), dueDate: day(4), weight: 10, totalMarks: 20, format: '8-10 pages', submissionMode: 'Email', priority: 'High', requirements: 'Cover page\nER diagram (Crow’s foot)\nNormalization to 3NF shown step by step\nSQL DDL script\nReferences', reqTicks: { 0: true, 1: true }, canvasContent: 'The library management system tracks members, books, loans and fines.\n\n**Entities**: Member, Book, Copy, Loan, Fine, Staff.\n\nThe ER model places Member and Copy in a many-to-many relation resolved by Loan...', status: 'In Progress' },
      { course: SAD, title: 'Use Case Diagram — Online Pharmacy', assignedDate: day(-3), dueDate: day(2), weight: 5, format: 'Diagram + 2-page description', submissionMode: 'Hardcopy', priority: 'Medium', requirements: 'Actor list\nUse case diagram\nInclude/extend relations explained', status: 'To Do' },
      { course: OOP, title: 'Bank Account OOP Implementation', subtitle: 'Inheritance & polymorphism in practice', assignedDate: day(-14), dueDate: day(-2), weight: 8, totalMarks: 15, submissionMode: 'Email', priority: 'High', requirements: 'Class hierarchy diagram\nSavings & Current account subclasses\nOverridden withdraw() rules\nJUnit-style test output screenshots', reqTicks: { 0: true, 1: true, 2: true, 3: true }, canvasContent: '**Design.** Account is the abstract base class with balance, deposit() and an abstract withdraw().\n\nSavingsAccount overrides withdraw() to enforce the minimum balance; CurrentAccount allows an overdraft limit...\n\n**Polymorphism.** A single Account[] processes month-end interest via dynamic dispatch.', status: 'Completed' },
      { course: MIS, title: 'ERP Adoption Case Study', subtitle: 'Why mid-size firms fail at ERP', assignedDate: day(-20), dueDate: day(-7), weight: 10, submissionMode: 'Email', requirements: '1500 words\n2 real company cases\nAPA references', status: 'Submitted', submittedAt: day(-8), canvasContent: 'ERP projects fail less from software and more from process mismatch...' },
    ],
  };
}
function acadLoadStarter() {
  if (!Security.guard('load starter data')) return;
  acadEnsure();
  const existing = ACAD_ENTITIES.reduce((s, k) => s + DB.getAll(k).length, 0);
  if (existing && !confirm(`You already have ${existing} academic records — add the starter pack on top?`)) return;
  const pack = acadStarterData();
  const now = new Date().toISOString();
  Object.entries(pack).forEach(([entity, rows]) => rows.forEach(r => { r.id = uid(); r.createdAt = now; DB.data[entity].push(r); }));
  DB.save();
  toast('Starter data loaded — your Academics is alive. Edit anything, anytime.', 'ok');
  acadRedraw();
}
if (typeof window !== 'undefined') window.AcademicsStarter = { load: acadLoadStarter };

/* ---------- init + registration ---------- */
function acadRedraw() { try { acadEnsure(); acadRenderStats(); acadRenderToday(); acadRenderSchedule(); acadRenderCourses(); acadRenderAssessments(); acadRenderBoard(); } catch (e) { console.warn('[academics] render failed:', e); } }

function initAcademics() {
  acadEnsure();
  const wire = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  wire('acadCourseAdd', () => openEntityModal('courses', null, acadRedraw));
  wire('acadAssessAdd', () => openEntityModal('assessments', null, acadRedraw));
  wire('acadAsgAdd', () => openEntityModal('assignments', null, acadRedraw));
  wire('acadFacBtn', () => {
    const list = DB.getAll('faculty');
    if (!list.length) return openEntityModal('faculty', null, acadRedraw);
    // tiny picker: edit existing or add new
    const pick = prompt(`Faculty:\n${list.map((f, i) => `${i + 1}. ${f.name}`).join('\n')}\n\nType a number to edit, or "new" to add:`, 'new');
    if (pick == null) return;
    if (String(pick).trim().toLowerCase() === 'new') return openEntityModal('faculty', null, acadRedraw);
    const f = list[parseInt(pick, 10) - 1]; if (f) openEntityModal('faculty', f.id, acadRedraw);
  });
  wire('acadProgBtn', () => { const p = DB.getAll('programme')[0]; openEntityModal('programme', p ? p.id : null, acadRedraw); });
  acadRedraw();
}
PAGE_INIT.academics = initAcademics;
