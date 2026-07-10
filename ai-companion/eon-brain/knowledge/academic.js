/* ============================================================
   EON · knowledge/academic.js  —  Eon's academic "brain"
   ------------------------------------------------------------
   A curated knowledge base for the academic / student / teacher /
   extracurricular domain, so Eon can RELATE to documents and
   questions beyond the user's own records — even offline, no LLM.

   (Honest scope: this is a hand-built knowledge base, not a 10 MB
   internet-trained model — that needs the paid/LLM upgrade. But it
   makes Eon genuinely knowledgeable in this domain.)

   Exports:
     • classifyDoc(text) → { type, label, topics[], entities[], tip }
     • answerAcademic(q) → { speak, detail? } | null   (for Ask Eon)
   Register: window.EonAcademic.
   ============================================================ */

/* ---- academic entities Eon recognises ---- */
const SCHOLARSHIPS = ['fulbright', 'chevening', 'erasmus', 'commonwealth', 'daad', 'rhodes', 'gates cambridge', 'knight-hennessy', 'schwarzman', 'mext', 'stipendium hungaricum', 'orange knowledge', 'vanier', 'aga khan', 'inlaks', 'swedish institute', 'eiffel', 'holland', 'clarendon', 'marshall'];
const TESTS = ['ielts', 'toefl', 'gre', 'gmat', 'sat', 'act', 'duolingo', 'pte', 'lsat', 'mcat', 'ossd'];
const DEGREES = ['bachelor', 'undergraduate', 'masters', "master's", 'msc', 'ma', 'mba', 'phd', 'doctorate', 'diploma', 'associate', 'postdoc', 'bsc', 'beng'];
const FIELDS = ['computer science', 'data science', 'machine learning', 'artificial intelligence', 'engineering', 'medicine', 'business', 'economics', 'physics', 'mathematics', 'biology', 'chemistry', 'law', 'psychology', 'design', 'architecture', 'public health', 'environmental', 'robotics', 'statistics'];
const EXTRAS = ['hackathon', 'debate', 'model un', 'mun', 'olympiad', 'volunteering', 'internship', 'research', 'club', 'sports', 'music', 'drama', 'student council', 'ngo', 'competition', 'conference', 'workshop', 'bootcamp', 'community service', 'mentorship'];

/* ---- document types Eon knows (patterns → label + tip) ---- */
const DOC_TYPES = [
  { type: 'sop', label: 'a Statement of Purpose (SOP)', re: /\b(statement of purpose|my (academic|research) (goals|journey)|i am applying|motivat(ion|es me)|why (this|your) (program|university)|long[- ]term goals)\b/i, tip: 'Strong SOPs open with a specific hook, connect past → present → future, and name the program precisely.' },
  { type: 'personal-statement', label: 'a Personal Statement', re: /\b(personal statement|who i am|my story|shaped me|i have always been|growing up)\b/i, tip: 'Lead with a concrete moment, not a cliché — show, don\'t tell.' },
  { type: 'recommendation', label: 'a Recommendation / Reference Letter', re: /\b(recommend(ation)?|it is my (pleasure|privilege)|i (have )?(known|taught|supervised)|strongly recommend|to whom it may concern|referee)\b/i, tip: 'The best ones give a specific anecdote + a comparison ("top 5% I\'ve taught").' },
  { type: 'essay', label: 'an academic essay / article', re: /\b(thesis statement|in conclusion|this essay|argues that|furthermore|on the other hand|in summary)\b/i, tip: 'Check the thesis is arguable and each paragraph earns its place.' },
  { type: 'research', label: 'a research paper / thesis', re: /\b(abstract|introduction|literature review|methodology|dataset|hypothesis|results|discussion|references|et al\.?|figure \d)\b/i, tip: 'Judges skim the abstract, figures and conclusion first — make those bullet-proof.' },
  { type: 'cv', label: 'a CV / résumé', re: /\b(curriculum vitae|resume|work experience|education\b.*(skills|projects)|references available|objective|gpa|cgpa)\b/i, tip: 'Quantify impact ("improved X by 30%"), keep it 1–2 pages, lead with your strongest line.' },
  { type: 'cover-letter', label: 'a cover letter', re: /\b(dear (hiring|sir|madam)|i am writing to apply|position of|i believe i (am|would)|please find (attached|enclosed))\b/i, tip: 'Tailor the first line to the role; mirror the posting\'s language.' },
  { type: 'transcript', label: 'an academic transcript / grade sheet', re: /\b(transcript|grade point|gpa|cgpa|semester|credit hours?|marks obtained|course code|grade\b)\b/i, tip: 'If grades dip somewhere, an SOP line can frame the recovery.' },
  { type: 'assignment', label: 'an assignment / lab report', re: /\b(assignment|homework|problem set|lab report|due date|submission|question \d|marks?:)\b/i, tip: 'Match every answer to the marking rubric — that\'s where marks live.' },
  { type: 'application', label: 'an application form', re: /\b(application form|applicant|date of birth|nationality|passport|declaration|i hereby declare|signature)\b/i, tip: 'Copy exact names/dates from official documents to avoid rejection on a typo.' },
];

/* ---- Q&A knowledge (patterns → varied helpful answers) ---- */
const QA = [
  { re: /\bsop\b|statement of purpose|personal statement|how.*(write|start).*(sop|statement|essay)/i, a: [
    'For an SOP: open with a specific moment (not "since childhood"), then connect your past → why this program → your goal. Name the program and 1–2 professors. End with what you\'ll contribute.',
    'Strong statement = a hook, a through-line, and specificity. Show one real project in depth rather than listing ten. Tie everything to why THIS program.',
  ], d: ['Structure: hook → academic journey → why this program (specific) → career goal → fit & contribution.'] },
  { re: /recommend(ation)? letter|reference letter|referee|who.*(ask|recommend)/i, a: [
    'Ask a recommender who can speak to specifics — a professor who supervised a project beats a famous one who barely knows you. Give them your CV, the deadline, and 3 bullet points you\'d love them to mention.',
    'Best referees give an anecdote + a ranking ("top 5% I\'ve taught in 10 years"). Pick people who\'ve seen you do the work.',
  ] },
  { re: /\bielts\b|\btoefl\b|english (test|proficiency)|language (test|requirement)/i, a: [
    'IELTS/TOEFL: most master\'s programs want IELTS 6.5–7.0 (or TOEFL 90–100). Book early — scores take ~2 weeks and are valid 2 years. Practice the section that scares you most.',
    'For English tests, the writing and speaking bands sink most people — do timed practice and get one honest review.',
  ] },
  { re: /\bgre\b|\bgmat\b|graduate.*(exam|test)/i, a: [
    'GRE: quant matters most for STEM (aim 165+), verbal for humanities. Many programs are now GRE-optional — check before you spend months on it.',
    'GMAT is for business schools; GRE is broader. Confirm which your target programs actually require — a lot dropped it post-2021.',
  ] },
  { re: /scholarship|fully funded|funding|financial aid|stipend/i, a: [
    'For fully-funded scholarships (Fulbright, Chevening, Erasmus, DAAD…), start 8–12 months early. They score leadership + a clear give-back plan as much as grades. Match your story to their mission.',
    'Funding tip: apply to the scholarship AND the university/department funding in parallel — assistantships and departmental grants are less competitive than the famous named awards.',
  ], d: ['Big ones: Fulbright (US), Chevening (UK), Erasmus Mundus (EU), DAAD (Germany), Commonwealth (UK), MEXT (Japan).'] },
  { re: /chevening/i, a: ['Chevening (UK): needs 2+ years work experience, strong leadership evidence, and a networking mindset. Its essays reward specific stories over ambition-speak. Deadline is usually early November.'] },
  { re: /fulbright/i, a: ['Fulbright (US): cultural-exchange focus — they want future ambassadors, not just top students. A clear community give-back plan is essential. Applies via your home-country commission.'] },
  { re: /extracurricular|\bclub\b|\bmun\b|model un|debate|olympiad|volunteer/i, a: [
    'For extracurriculars, depth beats breadth: one activity where you led or created something says more than ten memberships. Show initiative and measurable impact.',
    'Admissions look for a "spike" — evidence you went deep on something. Founding a club, winning a competition, or a sustained volunteering role all read strongly.',
  ] },
  { re: /hackathon|competition|contest/i, a: ['For hackathons/competitions: a placed finish or a shipped demo is gold on applications. Even without winning, frame what you built and what you learned — judges and admissions both reward doing.'] },
  { re: /\bcv\b|resume|résumé/i, a: [
    'Academic CV: lead with education + research/projects, quantify impact, keep it clean and 1–2 pages. Put your single strongest line at the top third — that\'s what gets read.',
    'Résumé rule: every bullet = action verb + what you did + the result/number. Cut anything that doesn\'t earn its line.',
  ] },
  { re: /\bphd\b|doctorate|research proposal|find.*(supervisor|advisor)/i, a: [
    'For a PhD, the research fit + supervisor matter more than rankings. Email 3–5 potential supervisors with a short, specific pitch and a 1-page proposal. A reply is often your real "admission".',
    'PhD applications hinge on the proposal and the supervisor match — show you\'ve read their recent papers and have a question worth 3–4 years.',
  ] },
  { re: /deadline|when.*(apply|due)|timeline|when should i start/i, a: [
    'Application timeline: start ~12 months out. Tests 8–10 months before, drafts + recommenders 4–6 months before, submit 1–2 months early. Deadlines cluster Nov–Jan for Fall intake.',
    'Rule of thumb: whatever the deadline is, aim to finish 2 weeks early — recommenders and portals fail at the worst moment.',
  ] },
  { re: /procrastinat|focus|study (tips|better|smart)|productiv|time management/i, a: [
    'Study smarter: 25-min focused blocks (Pomodoro), one task at a time, phone in another room. Active recall + spaced repetition beats re-reading every time.',
    'Beat procrastination by shrinking the task: commit to just 10 minutes on the scariest thing. Starting is 80% of the battle.',
  ] },
  { re: /stress|anxious|overwhelm|burn.?out|too much|can'?t cope/i, a: [
    'Feeling overwhelmed is normal in application season. Brain-dump everything, pick the ONE next action, and protect sleep — a tired brain makes the work take twice as long.',
    'When it\'s too much: shrink the scope, ask for one extension if you need it, and remember done-and-imperfect beats perfect-and-late.',
  ] },
  { re: /gap year|took time off|explain.*gap/i, a: ['A gap year is fine — frame it as purposeful: what you learned, built, or clarified. Admissions worry about drift, not gaps. Give the story a reason and a result.'] },
  { re: /low (gpa|grade|cgpa)|bad (grade|result)|weak academic/i, a: ['A low grade isn\'t fatal — address it briefly and honestly in the SOP (what happened, what changed), then let an upward trend, strong tests, and real projects do the talking.'] },
];

/* ---- classification + answering ---- */
function classifyDoc(text) {
  const t = String(text || '');
  const low = t.toLowerCase();
  let best = null;
  for (const d of DOC_TYPES) { const m = (t.match(d.re) || []).length; if (m && (!best || m > best.m)) best = { ...d, m }; }
  const topics = FIELDS.filter((f) => low.includes(f)).slice(0, 4);
  const entities = [...SCHOLARSHIPS, ...TESTS, ...EXTRAS].filter((e) => low.includes(e)).slice(0, 5);
  if (!best && !topics.length && !entities.length) return null;
  return { type: best ? best.type : 'academic', label: best ? best.label : 'an academic document', topics, entities, tip: best ? best.tip : null };
}
function answerAcademic(q) {
  const nq = String(q || '').toLowerCase();
  for (const item of QA) { if (item.re.test(nq)) { const a = item.a[Math.floor(Math.random() * item.a.length)]; return { speak: a, detail: item.d || null, source: 'academic-knowledge' }; } }
  return null;
}

const EonAcademic = { classifyDoc, answerAcademic, SCHOLARSHIPS, TESTS, DEGREES, FIELDS, EXTRAS, DOC_TYPES };
if (typeof window !== 'undefined') window.EonAcademic = Object.assign(window.EonAcademic || {}, EonAcademic);
export { classifyDoc, answerAcademic };
export default EonAcademic;
