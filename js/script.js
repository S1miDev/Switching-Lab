// App core: lab set-up, the Labs page, navigation and page wiring. Starts the app; only auth.js loads after it.

// ---- state ----
// the open lab's devices live in its session (session.js), shown by the lab page (lab.js) and its console (console.js)
let level = 'intermediate';  // the chosen difficulty
let topic = 'ipv4';          // the open lab (an id of CATALOGUE, with its build in LABS)
let lastNet = null;          // the previous lab's random network, so the next one differs

// ---- labs ----

// open a lab (keeps the current difficulty and topic unless given) on a new random network 192.168.x.0
function newLab(lvl = level, t = topic) {
  level = lvl;
  topic = t;
  markLevel();
  lastNet = randomNet(lastNet);
  labPage.open(createSession({topic, level, net: lastNet}));
}

// highlight the chosen difficulty on the Labs page
function markLevel() {
  document.querySelectorAll('[data-set]').forEach(b => b.classList.toggle('active', b.dataset.set === level));
  moveSeg($('dash-seg'));
}

// slide a segmented control's highlight under its active button (it can only measure while visible)
function moveSeg(seg) {
  const active = seg.querySelector('.active');
  if (!active || !active.offsetWidth) return;
  seg.style.setProperty('--x', active.offsetLeft + 'px');
  seg.style.setProperty('--w', active.offsetWidth + 'px');
  requestAnimationFrame(() => seg.classList.add('ready')); // animate from the second move on
}

// ---- dashboard ----

// the Labs page: one section per domain, each topic with a lab, in catalogue order
function renderDashboard() {
  const ids = Object.keys(CATALOGUE).filter(id => CATALOGUE[id].labLevels.length);
  $('dash-domains').innerHTML = Object.entries(DOMAINS).map(([n, title], d) => {
    const rows = ids.filter(id => CATALOGUE[id].domain === Number(n));
    return `<details class="domain"${d ? '' : ' open'}>` +
      `<summary><span class="dom-num">${n}.0</span><span class="dom-title">${esc(title)}</span><span class="dom-meta">${topicCount(rows.length)}</span></summary>` +
      '<div class="rows">' +
      rows.map(id => `<div class="row" data-search="${esc(searchText(id))}">` +
        `<div class="row-title">${esc(CATALOGUE[id].name)}</div><div class="row-desc">${esc(CATALOGUE[id].desc)}</div>` +
        `<button class="start" data-start="${id}">Start lab →</button></div>`).join('') +
      '</div></details>';
  }).join('');
}

// ---- navigation ----

function show(view) {
  $('dash').hidden = view !== 'dash';
  $('lab').hidden = view !== 'lab';
  $('topo-view').hidden = view !== 'topo';
  $('exam-view').hidden = view !== 'exam';
  $('ref').hidden = view !== 'ref';
  $('nav-labs').classList.toggle('active', view === 'dash' || view === 'lab');
  $('nav-topo').classList.toggle('active', view === 'topo');
  $('nav-exam').classList.toggle('active', view === 'exam');
  $('nav-ref').classList.toggle('active', view === 'ref');
  if (view === 'dash') moveSeg($('dash-seg'));
  if (view === 'topo') moveSeg($('topo-seg'));
  if (view === 'ref') refHome();
  window.scrollTo(0, 0);
  if (view === 'lab') $('cmd').focus();
}

$('nav-labs').addEventListener('click', () => show('dash'));
$('nav-brand').addEventListener('click', () => show('dash'));
$('nav-ref').addEventListener('click', () => show('ref'));
$('back').addEventListener('click', () => show('dash'));
// every "Start lab" button, on the Labs page and in the Reference
document.addEventListener('click', e => {
  const b = e.target.closest('[data-start]');
  if (!b) return;
  newLab(level, b.dataset.start);
  show('lab');
});
document.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => {
  level = b.dataset.set;
  markLevel();
}));
// search: open every section, and hide the labs whose name does not contain the text
$('search').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  if (q) document.querySelectorAll('details.domain').forEach(d => { d.open = true; });
  document.querySelectorAll('[data-search]').forEach(row => { row.hidden = !row.dataset.search.includes(q); });
});

// lab page: New network starts another lab (Reset, hints and the solution are in lab.js, device tabs in console.js)
$('new-net').addEventListener('click', () => newLab());

// smooth open and close for the collapsible sections (a plain toggle when the user prefers reduced motion)
document.addEventListener('click', e => {
  const summary = e.target.closest('details.domain > summary, details.card > summary');
  if (!summary || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  e.preventDefault();
  const details = summary.parentElement, body = details.querySelector('.rows, .dbody');
  body.anim?.cancel();
  const opening = !details.open || details.classList.contains('closing');
  if (opening) details.open = true;
  const style = getComputedStyle(body), height = body.scrollHeight;
  details.classList.toggle('closing', !opening);
  const shut = {height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0};
  const full = {height: height + 'px', paddingTop: style.paddingTop, paddingBottom: style.paddingBottom, opacity: 1};
  body.style.overflow = 'hidden';
  body.anim = body.animate(opening ? [shut, full] : [full, shut], {duration: 260, easing: 'cubic-bezier(.4,0,.2,1)'});
  body.anim.onfinish = () => {
    body.style.overflow = '';
    body.anim = null;
    details.classList.remove('closing');
    if (!opening) details.open = false;
  };
  body.anim.oncancel = () => { body.style.overflow = ''; };
});

window.addEventListener('resize', () => {
  moveSeg($('dash-seg'));
  moveSeg($('topo-seg'));
});

// ---- start ----
renderDashboard();
