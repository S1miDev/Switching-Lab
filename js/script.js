// App core: the lab console, lab set-up, navigation and page wiring. Loads last and starts the app.

const $ = id => document.getElementById(id);

// a new element with an optional class and text
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

const term = $('term'), input = $('cmd'), promptEl = $('prompt');

// ---- state ----
// the open lab's devices live in its session (session.js), shown by the lab page (lab.js)
let level = 'intermediate';  // the chosen difficulty
let topic = 'ipv4';          // the open lab (an id of CATALOGUE, with its build in LABS)
let lastNet = null;          // the previous lab's random network, so the next one differs
let dev = 'R1';              // the device whose console is open
let log = $('log');          // that device's console output
const logs = {R1: log};      // console output per device
const cmdHistory = [];       // typed commands, for Up/Down
let historyPos = 0;

// ---- console ----

// the open device (devices/device.js): the console only talks to it through its interface
const active = () => activeSession.devices[dev];

// sink: while set, print and echo hand their lines to it instead of the page (the headless self-check uses this)
let sink = null;

function print(text, cls = '') {
  if (sink) return sink(text, cls);
  log.append(el('div', cls, text));
  term.scrollTop = term.scrollHeight;
}

// a typed command, after the prompt it was typed at
function echo(text) {
  if (sink) return sink(active().prompt() + ' ' + text);
  const line = el('div');
  line.append(el('span', 'ps', active().prompt() + ' '), text);
  log.append(line);
  term.scrollTop = term.scrollHeight;
}

function renderPrompt() {
  if (!sink) promptEl.textContent = active().prompt();
}

// Runs one typed line on the open device. A line ending in "?" asks for help; the device does the rest, writing through print.
function run(raw) {
  const line = raw.trim();
  echo(line);
  if (!line) return;
  if (line.length > 1 && line.endsWith('?')) active().help(line, print);
  else active().run(line, print);
  renderPrompt();
}

// open a device's console: its own output, its tab and its box in the diagram
function showDevice(name) {
  dev = name;
  if (!logs[name]) {
    logs[name] = el('div');
    term.insertBefore(logs[name], input.parentNode);
  }
  for (const [n, out] of Object.entries(logs)) out.hidden = n !== name;
  log = logs[name];
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.dev === name));
  document.querySelectorAll('#topo [data-dev]').forEach(g => g.classList.toggle('sel', g.dataset.dev === name));
  renderPrompt();
  if (!log.textContent) active().banner().forEach(line => print(line));
  input.focus();
}

// empty every device's console and the typed-command history, then open the first device
function resetConsole(home) {
  for (const out of Object.values(logs)) out.textContent = '';
  cmdHistory.length = 0;
  historyPos = 0;
  showDevice(home);
}

function renderTabs(names) {
  document.querySelector('.tabs').replaceChildren(...names.map(name => {
    const tab = el('button', 'tab', name);
    tab.dataset.dev = name;
    return tab;
  }));
}

// Tab asks the open device to complete the input (it knows its commands and ports). When several ports match, the device
// says so (cycle) and each further Tab moves on to the next one.
let tabCycle = null; // {value, hits, i} while stepping through matching ports
function complete() {
  if (tabCycle && input.value === tabCycle.value) {
    tabCycle.i = (tabCycle.i + 1) % tabCycle.hits.length;
    input.value = tabCycle.value = tabCycle.hits[tabCycle.i];
    return;
  }
  const done = active().complete(input.value);
  tabCycle = done.cycle ? {value: done.value, hits: done.cycle, i: 0} : null;
  if (done.list) print(done.list);
  input.value = done.value;
}

input.addEventListener('keydown', e => {
  if (e.key === '?' && active().configurable) { // like IOS: show the options at once and keep what was typed
    e.preventDefault();
    const typed = input.value;
    echo(typed + '?');
    active().help(typed + '?', print);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const line = input.value.trim();
    if (line) cmdHistory.push(line);
    historyPos = cmdHistory.length;
    run(input.value);
    input.value = '';
    labPage.afterCommand();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    if (active().configurable) complete();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (historyPos > 0) input.value = cmdHistory[--historyPos];
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyPos < cmdHistory.length - 1) {
      input.value = cmdHistory[++historyPos];
    } else {
      historyPos = cmdHistory.length;
      input.value = '';
    }
  }
});

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
  if (view === 'lab') input.focus();
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

// lab page: open a device's console from the diagram or the console tabs; New network starts another lab (Reset, hints and the solution are in lab.js)
$('lab').addEventListener('click', e => {
  const device = e.target.closest('[data-dev]');
  if (device) showDevice(device.dataset.dev);
});
term.addEventListener('click', () => input.focus());
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

// ---- self-check ----

// Types commands into a session's devices without the page: script is [device, lines] pairs run in order through the real run(),
// with the output collected (and returned) instead of printed. The open session and console device are put back afterwards.
function drive(session, script) {
  const saved = [activeSession, dev, sink], out = [];
  [activeSession, sink] = [session, text => out.push(text)];
  try {
    for (const [name, lines] of script) {
      dev = name;
      lines.forEach(run);
    }
  } finally {
    [activeSession, dev, sink] = saved;
  }
  return out;
}

// A new session must not meet all its requirements; after the script it must.
function solves(session, script, label) {
  console.assert(!session.grade().every(Boolean), `self-check: ${label} starts out solved`);
  drive(session, script);
  const grade = session.grade();
  console.assert(grade.every(Boolean), `self-check: ${label} failed`, session.reqs.filter((r, i) => !grade[i]).map(r => r.text));
}

// labs that span several devices: script(x) gives [device, commands] pairs for network x
const MULTI_DEVICE = [
  ['mlsvlan', 'expert', () => [
    ['MLS1', ['en', 'conf t', 'ip routing', 'vlan 10', 'exit', 'vlan 20', 'exit', 'int vlan 10', 'ip add 192.168.10.1 255.255.255.0',
      'ip helper-address 192.168.99.10', 'int vlan 20', 'ip add 192.168.20.1 255.255.255.0', 'ip helper-address 192.168.99.10',
      'int gi0/1', 'no switchport', 'ip add 192.168.99.1 255.255.255.0', 'no sh', 'int fa0/1', 'sw mode access', 'sw access vlan 10', 'no sh',
      'int fa0/2', 'sw mode access', 'sw access vlan 20', 'no sh', 'end']],
    ['PC1', ['dhcp']], ['PC2', ['dhcp']], ['PC1', ['ping 192.168.20.11']],
  ]],
  ['dhcprelay', 'beginner', x => [
    ['R1', ['en', 'conf t', 'int gi0/0', `ip add 192.168.${x}.1 255.255.255.0`, `ip helper-address 172.16.${x}.10`, 'no sh',
      'int gi0/1', 'ip add 10.0.0.1 255.255.255.252', 'no sh', 'exit', `ip route 172.16.${x}.0 255.255.255.0 10.0.0.2`, 'end']],
    ['PC1', ['dhcp']],
  ]],
];

// Runs on the sessions alone: the catalogue and the lab builds agree, every known-good config meets its requirements, and so do the multi-device scripts.
function selfCheck() {
  // a topic has a build for exactly its labLevels, and every build has a topic
  console.assert(Object.keys(CATALOGUE).every(id => {
    const built = LABS[id] ? Object.keys(LABS[id].levels) : [];
    return built.join() === CATALOGUE[id].labLevels.join();
  }) && Object.keys(LABS).every(id => CATALOGUE[id]), 'self-check: the catalogue and the lab builds disagree');
  const net = randomNet();
  for (const [id, T] of Object.entries(LABS)) {
    for (const lvl of Object.keys(T.levels)) {
      const session = createSession({topic: id, level: lvl, net});
      if (session.solution.length) solves(session, [[session.home, session.solution]], `${id} ${lvl}`);
    }
  }
  for (const [id, lvl, script] of MULTI_DEVICE) solves(createSession({topic: id, level: lvl, net}), script(net), `${id} ${lvl}`);
}

// ---- start ----
renderDashboard();
selfCheck();
