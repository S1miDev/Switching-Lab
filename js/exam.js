// Mock exam: a few random labs from the chosen topics at one difficulty, optionally timed, passed at 80%.
// The labs are the normal lab page (newLab in script.js); the exam only picks them, times them and adds up their requirements.
const EXAM_PASS = 80;
// the number of labs: at least one per chosen topic, at most 10 more than that (30 in all)
const examRange = n => [Math.max(1, n), Math.min(30, n + 10)];
const EXAM_MIN_PER_LAB = {beginner: 5, intermediate: 8, advanced: 12, expert: 15};
let examLabs = [];    // {topic, met, total} for each lab of this exam
let examPos = 0;      // the open lab
let examLevel = '';
let examEnd = 0;      // when the time runs out (ms timestamp), 0 = no time limit
let examTimer = null;
let examRunning = false;
let examDone = false;
const examCard = document.getElementById('exam-card');

const secondsLeft = () => Math.max(0, Math.round((examEnd - Date.now()) / 1000));
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const cap = s => s[0].toUpperCase() + s.slice(1);

// keep the open lab's result before moving on
function examSave() {
  const lab = examLabs[examPos];
  lab.met = reqs.filter(r => r.ok(state)).length;
  lab.total = reqs.length;
}

// an exam is plain: no command list, hints or solution, and no way back to the Labs page
function examAids(on) {
  $('exam-bar').hidden = on;
  $('back').hidden = !on;
  $('cmds-card').hidden = !on;
  $('show-solution').hidden = !on;
}

function examOpen() {
  newLab(examLevel, examLabs[examPos].topic);
  $('exam-pos').textContent = `${examPos + 1}/${examLabs.length}`;
  $('exam-next').textContent = examPos === examLabs.length - 1 ? 'Finish exam' : 'Next lab';
  $('crumb').textContent = 'Mock exam / ' + TOPICS[examLabs[examPos].topic].name;
  examShowLab();
}

// the lab page, but with Mock exam staying the highlighted tab
function examShowLab() {
  show('lab');
  $('nav-labs').classList.remove('active');
  $('nav-exam').classList.add('active');
}

function examStart(form) {
  const data = new FormData(form);
  const picked = data.getAll('topic'), [min, max] = examRange(picked.length);
  const count = Math.min(max, Math.max(min, Number(data.get('count')) || min));
  // every chosen topic once, the extra labs go to random chosen topics, then shuffle by sorting on random keys
  const extra = Array.from({length: count - picked.length}, () => picked[Math.floor(Math.random() * picked.length)]);
  const topics = [...picked, ...extra].map(t => [Math.random(), t]).sort((a, b) => a[0] - b[0]).map(([, t]) => t);
  examLevel = data.get('level');
  examLabs = topics.map(topic => ({topic}));
  examPos = 0;
  examDone = false;
  examRunning = true;
  examEnd = data.get('timed') === '1' ? Date.now() + EXAM_MIN_PER_LAB[examLevel] * 60000 * topics.length : 0;
  clearInterval(examTimer);
  if (examEnd) examTimer = setInterval(examTick, 1000);
  examAids(false);
  examTick();
  examOpen();
}

function examTick() {
  $('exam-time').textContent = examEnd ? 'Time left ' + clock(secondsLeft()) : 'No time limit';
  if (examEnd && !secondsLeft()) examFinish();
}

function examFinish() {
  examSave();
  clearInterval(examTimer);
  examRunning = false;
  examDone = true;
  examAids(true);
  show('exam');
  examRender();
}

function examRender() {
  examCard.innerHTML = examDone ? resultHtml() : setupHtml();
  if (!examDone) examSync();
}

// look shared by the setup choices: a tile that lights up in the accent colour when its input is checked
const TILE = 'flex cursor-pointer items-center gap-2 rounded-[10px] border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3.5 py-2.5 ' +
  'transition-colors hover:border-[color:var(--accent)] has-[:checked]:border-[color:var(--accent)] has-[:checked]:bg-[color:var(--accent-tint)]';
const BOX = 'rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5';

// a numbered section of the setup form, like the domains on the Labs page
const section = (n, title, body, extra = '') =>
  `<fieldset class="${BOX} min-w-0"><legend class="sr-only">${title}</legend>` +
  `<div class="mb-4 flex items-center gap-3"><span class="font-mono text-[13px] text-[color:var(--success)]">${n}</span>` +
  `<span class="text-lg font-semibold">${title}</span>${extra}</div>${body}</fieldset>`;

function setupHtml() {
  const levels = Object.keys(EXAM_MIN_PER_LAB).map(l =>
    `<label class="${TILE} flex-col !items-start gap-0.5"><span class="flex items-center gap-2 font-medium">` +
    `<input type="radio" name="level" value="${l}" class="accent-[color:var(--accent)]"${l === level ? ' checked' : ''}>${cap(l)}</span>` +
    `<span class="pl-6 text-xs text-[color:var(--muted)]">${EXAM_MIN_PER_LAB[l]} min per lab</span></label>`);
  const topics = Object.entries(TOPICS).map(([k, t]) =>
    `<label class="${TILE} text-sm"><input type="checkbox" name="topic" value="${k}" class="accent-[color:var(--accent)]">${esc(t.name)}</label>`);
  const timed = (v, text, on) =>
    `<label class="${TILE}"><input type="radio" name="timed" value="${v}" class="accent-[color:var(--accent)]"${on ? ' checked' : ''}>${text}</label>`;
  const allNone = '<span class="ml-auto flex gap-2"><button type="button" class="ghost !px-3 !py-1.5 !text-xs" data-all="1">All</button>' +
    '<button type="button" class="ghost !px-3 !py-1.5 !text-xs" data-all="0">None</button></span>';
  return '<form id="exam-form" class="grid gap-5">' +
    section('1', 'Difficulty', `<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">${levels.join('')}</div>`) +
    section('2', 'Time limit', `<div class="grid gap-2 sm:grid-cols-2">${timed(1, 'Timed (grows with the difficulty)', true)}${timed(0, 'No time limit', false)}</div>`) +
    section('3', 'Topics', `<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">${topics.join('')}</div>`, allNone) +
    section('4', 'Number of labs',
      '<div class="flex flex-wrap items-center gap-3"><input type="number" name="count" id="exam-count" step="1" class="w-24 rounded-[10px] border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-2 font-mono">' +
      '<span class="note !m-0" id="exam-range"></span></div>') +
    '<div class="flex flex-wrap items-center justify-between gap-3">' +
    `<p class="note !m-0">Random labs, at least one per topic. Pass mark ${EXAM_PASS}%.</p>` +
    '<button type="submit" id="exam-go" class="!px-6" disabled>Start exam →</button></div></form>';
}

function resultHtml() {
  const met = examLabs.reduce((sum, l) => sum + l.met, 0), total = examLabs.reduce((sum, l) => sum + l.total, 0);
  const pass = met * 100 >= EXAM_PASS * total; // compared exactly, so 79.6% never rounds up to a pass
  const rows = examLabs.map(l =>
    `<li class="flex items-center justify-between gap-4 rounded-[10px] border border-[color:var(--border)] bg-[color:var(--surface-2)] px-4 py-3">` +
    `<span class="font-medium">${esc(TOPICS[l.topic].name)}</span>` +
    `<span class="font-mono text-[13px] text-[color:var(--muted)]"><span class="text-[color:var(--text)]">${l.met}/${l.total}</span></span></li>`);
  return '<div class="grid gap-5">' +
    `<div class="${BOX} flex flex-wrap items-center justify-between gap-4">` +
    `<div><p class="m-0 text-[13px] text-[color:var(--muted)]">${cap(examLevel)} · pass mark ${EXAM_PASS}%</p>` +
    `<p class="m-0 text-4xl font-semibold">${Math.floor(100 * met / total)}% <span class="font-mono text-base font-normal text-[color:var(--muted)]">${met}/${total} requirements</span></p></div>` +
    `<span class="rounded-full px-4 py-1.5 text-sm font-semibold ${pass ? 'bg-[color:var(--success)] text-[color:var(--accent-ink)]' : 'bg-[color:var(--bad)] text-[color:var(--accent-ink)]'}">${pass ? 'PASSED' : 'FAILED'}</span></div>` +
    `<ul class="m-0 grid list-none gap-2 p-0">${rows.join('')}</ul>` +
    '<div><button id="exam-again">New exam</button></div></div>';
}

examCard.addEventListener('submit', e => {
  e.preventDefault();
  examStart(e.target);
});
examCard.addEventListener('click', e => {
  if (e.target.id === 'exam-again') {
    examDone = false;
    examRender();
  } else if (e.target.dataset.all) {
    examCard.querySelectorAll('[name=topic]').forEach(c => { c.checked = e.target.dataset.all === '1'; });
    examSync();
  }
});
// Start needs at least one topic, and the number of labs has to stay between its limits
function examSync() {
  const n = examCard.querySelectorAll('[name=topic]:checked').length, [min, max] = examRange(n);
  const box = examCard.querySelector('#exam-count');
  box.min = min;
  box.max = max;
  box.value = Math.min(max, Math.max(min, Number(box.value) || 5));
  examCard.querySelector('#exam-range').textContent = `Between ${min} and ${max}`;
  examCard.querySelector('#exam-go').disabled = !n;
}
examCard.addEventListener('change', e => {
  if (e.target.name === 'topic' || e.target.name === 'count') examSync();
});
document.getElementById('exam-next').addEventListener('click', () => {
  examSave();
  if (examPos === examLabs.length - 1) return examFinish();
  examPos++;
  examOpen();
});
// during an exam the nav button goes back to the open lab
document.getElementById('nav-exam').addEventListener('click', () => {
  if (examRunning) return examShowLab();
  show('exam');
  if (!examCard.innerHTML) examRender();
});
