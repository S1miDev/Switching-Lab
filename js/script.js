// App core: lab set-up, the Labs page, navigation and page wiring. Starts the app; only auth.js loads after it.

// ---- state ----
// the open lab's devices live in its session (session.js), shown by the lab page (lab.js) and its console (console.js)
let level = localStorage.getItem('level') || 'intermediate';  // the chosen difficulty, remembered across visits
let topic = 'ipv4';          // the open lab (an id of CATALOGUE, with its build in LABS)
let lastNet = null;          // the previous lab's random network, so the next one differs
let labFrom = 'dash';        // the page a lab was started from ('dash', 'trouble' or 'exam'): its tab stays lit, Back returns there

// ---- labs ----

// open a lab (keeps the current difficulty and topic unless given) on a new random network 192.168.x.0
function newLab(lvl = level, t = topic) {
  level = lvl;
  topic = t;
  markLevel();
  lastNet = randomNet(lastNet);
  labPage.open(createSession({topic, level, net: lastNet}), {crumb: isFix(topic) ? `Troubleshooting / ${CATALOGUE[topic].name}` : undefined});
}

// highlight the chosen difficulty on the Labs page
function markLevel() {
  document.querySelectorAll('[data-set]').forEach(b => b.classList.toggle('active', b.dataset.set === level));
  moveSeg($('dash-seg'));
  moveSeg($('trouble-seg'));
}

// slide a segmented control's highlight under its active button (it can only measure while visible)
function moveSeg(seg) {
  const active = seg.querySelector('.active');
  if (!active || !active.offsetWidth) return;
  seg.style.setProperty('--x', active.offsetLeft + 'px');
  seg.style.setProperty('--w', active.offsetWidth + 'px');
  seg.style.setProperty('--h', active.offsetHeight + 'px'); // only the navbar highlight uses it
  requestAnimationFrame(() => seg.classList.add('ready')); // animate from the second move on
}

// ---- dashboard ----

// the Labs page (or, with fix, the Troubleshooting page): one section per domain, each topic with a lab, in catalogue order
const isFix = id => CATALOGUE[id].refGroup === 'Troubleshooting';
function renderDashboard(box, fix) {
  const ids = Object.keys(CATALOGUE).filter(id => CATALOGUE[id].labLevels.length && isFix(id) === fix);
  // the Troubleshooting page only lists domains that have a lab, all open
  const domains = Object.entries(DOMAINS).filter(([n]) => !fix || ids.some(id => CATALOGUE[id].domain === Number(n)));
  $(box).innerHTML = domains.map(([n, title], d) => {
    const rows = ids.filter(id => CATALOGUE[id].domain === Number(n));
    return `<details class="domain"${d && !fix ? '' : ' open'}>` +
      `<summary><span class="dom-num">${n}.0</span><span class="dom-title">${esc(title)}</span><span class="dom-meta">${topicCount(rows.length)}</span></summary>` +
      '<div class="rows">' +
      rows.map(id => `<div class="row" data-search="${esc(searchText(id))}">` +
        `<div class="row-title">${esc(CATALOGUE[id].name)}</div><div class="row-desc">${esc(CATALOGUE[id].desc)}</div>` +
        `<button class="start" data-start="${id}">Start lab →</button></div>`).join('') +
      '</div></details>';
  }).join('');
}

// ---- navigation ----

// each view: its section, its nav tab (the lab page has none: it lights the tab of labFrom) and its segmented control
const VIEWS = {
  dash: {page: 'dash', nav: 'nav-labs', seg: 'dash-seg'},
  trouble: {page: 'trouble', nav: 'nav-trouble', seg: 'trouble-seg'},
  sandbox: {page: 'sandbox', nav: 'nav-sandbox', seg: 'sandbox-seg'},
  topo: {page: 'topo-view', nav: 'nav-topo', seg: 'topo-seg'},
  exam: {page: 'exam-view', nav: 'nav-exam'},
  ccna: {page: 'ccna-view', nav: 'nav-ccna'},
  ref: {page: 'ref', nav: 'nav-ref'},
  profile: {page: 'profile', nav: 'nav-auth'},
  lab: {page: 'lab'},
};

// navbar highlight; to Profile it slides left and shrinks away, then grows in from the right;
// from Profile it slides right and shrinks away, then grows in from the left. It never passes behind the brand.
let onProfile = false, navMove = 0;
function moveNav(toProfile) {
  const nav = document.querySelector('.side');
  const wrap = toProfile !== onProfile && nav.classList.contains('ready')
    && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const from = onProfile;
  onProfile = toProfile;
  const id = ++navMove;
  if (!wrap) return moveSeg(nav);
  const first = $('nav-labs').offsetLeft, auth = $('nav-auth');
  nav.style.setProperty('--x', (from ? auth.offsetLeft + auth.offsetWidth : first) + 'px');
  nav.style.setProperty('--w', '0px');
  setTimeout(() => {
    if (id !== navMove) return; // a newer move took over
    nav.classList.remove('ready'); // jump to the opposite edge without animating
    nav.style.setProperty('--x', (from ? first : nav.scrollWidth) + 'px');
    nav.offsetWidth; // force reflow
    moveSeg(nav);
  }, 300);
}

function show(view) {
  const lit = view === 'lab' ? labFrom : view;
  for (const [name, v] of Object.entries(VIEWS)) {
    $(v.page).hidden = name !== view;
    if (v.nav) $(v.nav).classList.toggle('active', name === lit);
  }
  if (VIEWS[view].seg) moveSeg($(VIEWS[view].seg));
  moveNav(view === 'profile');
  if (view === 'ref') refHome();
  window.scrollTo(0, 0);
  if (view === 'lab') $('cmd').focus();
}

$('nav-labs').addEventListener('click', () => show('dash'));
$('nav-brand').addEventListener('click', () => show('dash'));
$('nav-sandbox').addEventListener('click', () => show('sandbox'));
$('sb-go-labs').addEventListener('click', () => show('dash'));
document.querySelectorAll('[data-sb-tab]').forEach(b => b.addEventListener('click', () => {
  $('sb-guided').hidden = b.dataset.sbTab !== 'guided';
  $('sb-mine').hidden = b.dataset.sbTab !== 'mine';
  document.querySelectorAll('[data-sb-tab]').forEach(x => x.classList.toggle('active', x === b));
  moveSeg($('sandbox-seg'));
}));
$('nav-ref').addEventListener('click', () => show('ref'));
$('nav-trouble').addEventListener('click', () => show('trouble'));
$('back').addEventListener('click', () => show(labFrom));
// every "Start lab" button, on the Labs page and in the Reference
document.addEventListener('click', e => {
  const b = e.target.closest('[data-start]');
  if (!b) return;
  labFrom = b.closest('#trouble') ? 'trouble' : 'dash';
  newLab(level, b.dataset.start);
  show('lab');
});
document.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => {
  level = b.dataset.set;
  localStorage.setItem('level', level);
  markLevel();
}));
// search: open every section, and hide the labs whose name does not contain the text
$('search').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  if (q) $('dash').querySelectorAll('details.domain').forEach(d => { d.open = true; });
  $('dash').querySelectorAll('[data-search]').forEach(row => { row.hidden = !row.dataset.search.includes(q); });
});

// lab page: New network starts another lab (Reset, hints and the solution are in lab.js, device tabs in console.js)
$('new-net').addEventListener('click', () => newLab());

window.addEventListener('resize', () => {
  for (const v of Object.values(VIEWS)) if (v.seg) moveSeg($(v.seg));
  moveSeg(document.querySelector('.side'));
});
window.addEventListener('load', () => moveSeg(document.querySelector('.side'))); // after fonts, so widths are final

// ---- start ----
renderDashboard('dash-domains', false);
renderDashboard('trouble-domains', true);
markLevel();
