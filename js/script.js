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
let level = 'intermediate';  // the chosen difficulty
let topic = 'ipv4';          // the open lab (a key of TOPICS)
let state, swState;          // R1's and S1's configuration, fresh for every lab
let reqs = [];               // the open lab's requirements
let solution = [];           // a known-good config for it, when the lab has one
let reqHints = [];           // how many hints each requirement has shown
let lastNet = null;          // the previous lab's random network, so the next one differs
let solved = false;          // all requirements met (the automatic check runs once per solve)
let dev = 'R1';              // the device whose console is open
let log = $('log');          // that device's console output
const logs = {R1: log};      // console output per device
const cmdHistory = [];       // typed commands, for Up/Down
let historyPos = 0;

// ---- console ----

const configurable = () => dev === 'R1' || dev === 'S1';
const devState = () => (dev === 'S1' ? swState : state); // the open device's configuration (R1's for the PCs)

function print(text, cls = '') {
  log.append(el('div', cls, text));
  term.scrollTop = term.scrollHeight;
}

// a typed command, after the prompt it was typed at
function echo(text) {
  const line = el('div');
  line.append(el('span', 'ps', promptFor() + ' '), text);
  log.append(line);
  term.scrollTop = term.scrollHeight;
}

const SUFFIX = {user: '>', priv: '#', config: '(config)#', ifc: '(config-if)#', vlan: '(config-vlan)#', nacl: '(config-nacl)#',
  dhcp: '(config-dhcp)#', line: '(config-line)#', router: '(config-router)#'};
function promptFor() {
  return configurable() ? devState().host + SUFFIX[devState().mode] : dev + '>';
}
function renderPrompt() {
  promptEl.textContent = promptFor();
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
  if (!log.textContent) {
    if (configurable()) {
      print(`Connected to ${name} — type ? or help for available commands.`);
      print('Press Tab to complete, Up/Down for history.');
    } else {
      print(`Connected to ${name} — this device is not configurable in this lab.`);
    }
  }
  input.focus();
}

function renderTabs(names) {
  document.querySelector('.tabs').replaceChildren(...names.map(name => {
    const tab = el('button', 'tab', name);
    tab.dataset.dev = name;
    return tab;
  }));
}

// the full commands Tab can complete to right now
const keysNow = () => (dev === 'S1' ? SW_KEYS : KEYS)[devState().mode];

// Tab completes word by word, so abbreviations work ("conf t", "sh ip int"). After "interface" it completes
// port names, and when several ports match, each further Tab moves on to the next one.
let tabCycle = null; // {value, hits, i} while stepping through matching ports
function complete() {
  if (tabCycle && input.value === tabCycle.value) {
    tabCycle.i = (tabCycle.i + 1) % tabCycle.hits.length;
    input.value = tabCycle.value = tabCycle.hits[tabCycle.i];
    return;
  }
  tabCycle = null;
  const text = input.value.toLowerCase();
  const typed = text.split(/\s+/);
  const mode = devState().mode;
  let hits;
  if (typed.length === 2 && typed[0].length >= 3 && 'interface'.startsWith(typed[0]) && (mode === 'config' || mode === 'ifc')) {
    const ports = Object.values(dev === 'S1' ? swState.ports : state.ifs).map(p => p.name);
    hits = ports.filter(p => p.toLowerCase().startsWith(typed[1])).map(p => 'interface ' + p);
    if (hits.length > 1) {
      tabCycle = {value: hits[0], hits, i: 0};
      input.value = hits[0];
      return;
    }
  } else {
    hits = keysNow().filter(key => {
      const words = key.split(' ');
      return typed.length <= words.length && typed.every((w, i) => words[i].startsWith(w));
    });
  }
  if (!hits.length) return;
  if (hits.length === 1) {
    input.value = hits[0] + ' ';
    return;
  }
  // several matches: extend each typed word as far as all matches agree
  const split = hits.map(h => h.split(' '));
  const words = typed.map((_, i) => {
    let common = split[0][i];
    for (const h of split) while (!h[i].startsWith(common)) common = common.slice(0, -1);
    return common;
  });
  const last = typed.length - 1;
  const wordDone = split.every(h => h[last] === split[0][last] && h.length > typed.length);
  const completed = words.join(' ') + (wordDone ? ' ' : '');
  if (completed === text) print(hits.join('   ')); // nothing more to fill in: list the options
  input.value = completed;
}

input.addEventListener('keydown', e => {
  if (e.key === '?' && configurable()) { // like IOS: show the options at once and keep what was typed
    e.preventDefault();
    const typed = input.value;
    echo(typed + '?');
    if (typed.trim()) helpNext(typed + '?');
    else help();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const line = input.value.trim();
    if (line) cmdHistory.push(line);
    historyPos = cmdHistory.length;
    run(input.value);
    input.value = '';
    liveCheck();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    if (configurable()) complete();
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

// ---- requirements and hints ----

// results has one true/false/null per requirement (null = not judged), or is null for "none judged"
function renderReqs(results) {
  const done = results ? results.filter(Boolean).length : 0;
  $('req-count').textContent = `${done}/${reqs.length}`;
  $('req-bar').style.width = reqs.length ? `${100 * done / reqs.length}%` : '0';
  let current = false; // the first unfinished requirement gets the "current" highlight
  $('reqs').replaceChildren(...reqs.map((r, i) => {
    const res = results ? results[i] : null;
    const li = el('li');
    if (res !== null) li.className = res ? 'ok' : 'bad';
    if (res !== true && !current) {
      current = true;
      li.classList.add('cur');
    }
    li.append(el('span', 'mark', res === null ? '○' : res ? '✓' : '✗'));
    li.append(el('span', 'rtext', r.text + (res === false ? ` — expected: ${r.hint}` : '')));
    const used = reqHints[i] || 0;
    if (res !== true && used < 3) {
      const b = el('button', 'ghost rhint-btn', `Hint (${3 - used} left)`);
      b.dataset.i = i;
      li.append(b);
    }
    for (let k = 0; k < used; k++) li.append(el('div', 'rhint', `Hint ${k + 1}/3: ` + hintLines(r, k)));
    return li;
  }));
}

function check() {
  const results = reqs.map(r => r.ok(state));
  renderReqs(results);
  const failed = results.filter(ok => !ok).length;
  print(failed ? `[lab] ${failed} requirement(s) not met.` : '[lab] All requirements met.', failed ? 'ln-err' : 'ln-ok');
}

// After every command: tick what is already met (the rest stays neutral, without hints),
// and run the full check once, automatically, when the last requirement is met.
function liveCheck() {
  const met = reqs.map(r => r.ok(state));
  renderReqs(met.map(ok => ok || null));
  const all = reqs.length > 0 && met.every(Boolean);
  if (all && !solved) check();
  solved = all;
}

// "vlan 10, name Sales" and "a, then b" hold several commands
const HINT_SPLIT = /,\s*(?:then\s+)?(?=[a-z])/i;

// Hint 1 names the command to think about, hint 2 shows its syntax, hint 3 gives the exact commands
function hintLines(r, k) {
  const raw = /^[\d.]+ /.test(r.hint) ? 'ip address ' + r.hint     // addressing labs keep just "ip mask"
    : /^[0-9a-f:]+\/\d+$/i.test(r.hint) ? 'ipv6 address ' + r.hint // or just the IPv6 address
    : r.hint;
  const cmds = raw.split(HINT_SPLIT);
  if (k === 0) return `Think about which mode you need, then the command "${cmdSyntax(cmds[0]).split(' ').slice(0, 2).join(' ')} ..."`;
  if (k === 1) return 'Syntax: ' + cmds.map(cmdSyntax).join(' → ');
  const port = r.text.match(/^(?:[RS]\d )?((?:Gi|Fa|Po|Port-channel)\S*)/i);
  return 'Commands: ' + [port ? 'interface ' + port[1] : '', ...cmds].filter(Boolean).join(' → ');
}

// ---- Commands card ----

// a command with its values replaced by placeholders, so the card does not give the answers away
function cmdSyntax(c) {
  return c
    .replace(/\(.*?\)/g, '')                          // notes such as "(on Gi0/0)"
    .replace(/\s+on\s+\S*\d\S*$/i, '')               // a trailing "on Gi0/0"
    .trim()
    .replace(/^conf t$/, 'configure terminal')
    .replace(/^int \S+$/, 'interface <name>')
    .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '<ip>')
    .replace(/\S*:\S*:\S*/g, '<addr/len>')           // IPv6 addresses
    .replace(/^(name|description) .+/, '$1 <text>')
    .replace(/(?<=\s)\d+(,\d+)*(?=\s|$)/g, '<n>');   // numbers and lists such as 10,20
}

// only the commands the open lab uses
function renderCmds() {
  const used = solution.length ? solution : reqs.flatMap(r => r.hint.split(HINT_SPLIT));
  const list = ['enable', 'configure terminal', ...used.map(cmdSyntax).filter(c => c && c !== 'enable'), 'show running-config', 'exit', 'end'];
  $('cmds').replaceChildren(...[...new Set(list)].map(c => el('code', 'cmd', c)));
}

// ---- lab diagram ----

// devices are 150x52 boxes; each link runs from the right edge of one box to the left edge of the other
function drawTopo(nodes, links, height) {
  const at = id => nodes.find(n => n.id === id);
  let svg = `<svg viewBox="0 0 528 ${height}" role="img" aria-label="Lab topology. Click a device to open its console.">`;
  for (const l of links) {
    const a = at(l.a), b = at(l.b);
    const x1 = a.x + 150, y1 = a.y + 26, x2 = b.x, y2 = b.y + 26;
    svg += `<line class="link" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>` +
      `<text class="port" x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 7}">${l.port}</text>`;
  }
  for (const n of nodes) {
    svg += `<g data-dev="${n.id}">` +
      `<rect class="box" x="${n.x}" y="${n.y}" width="150" height="52" rx="12"/>` +
      `<circle class="ico-bg" cx="${n.x + 26}" cy="${n.y + 26}" r="20"/>` +
      `<g class="icon" transform="translate(${n.x + 14} ${n.y + 14})">${TOPO_ICONS[n.type]}</g>` +
      `<text class="name" x="${n.x + 54}" y="${n.y + 23}">${n.id}</text>` +
      `<text class="sub" x="${n.x + 54}" y="${n.y + 39}">${n.sub}</text></g>`;
  }
  return svg + '</svg>';
}

// ---- labs ----

// fresh R1 and S1, and an empty console
function reset() {
  reqHints = [];
  swState = freshSw();
  state = freshRouter();
  state.sw = swState; // the labs grade both devices through one object
  for (const out of Object.values(logs)) out.textContent = '';
  cmdHistory.length = 0;
  historyPos = 0;
  showDevice('R1');
  renderReqs(null);
}

// open a lab (keeps the current difficulty and topic unless given) on a new random network 192.168.x.0
function newLab(lvl = level, t = topic) {
  level = lvl;
  topic = t;
  markLevel();
  const T = TOPICS[topic], cfg = T.levels[level];
  let x;
  do x = Math.floor(Math.random() * 256); while (x === lastNet);
  lastNet = x;
  const lab = T.kind === 'rt' ? {reqs: cfg.build(x), steps: cfg.steps, nodes: RT_NODES, links: RT_LINKS}
    : T.kind === 'sw' ? {reqs: cfg.reqs, solution: cfg.cmds && ['enable', 'conf t', ...cfg.cmds, 'end'], steps: cfg.steps, nodes: SW_NODES, links: SW_LINKS}
    : addressingLab(T, cfg, x);
  reqs = lab.reqs;
  solution = lab.solution || [];
  const lead = cfg.lead || T.lead;
  const domain = document.querySelector(`#dash [data-lab="${topic}"]`).closest('.domain');
  $('crumb').textContent = `Labs / ${domain.querySelector('.dom-num').textContent} ${domain.querySelector('.dom-title').textContent} / ${T.name}`;
  $('lab-title').textContent = T.name;
  $('lab-level').textContent = level;
  $('lab-sub').textContent = cfg.sub;
  $('scenario-lead').textContent = typeof lead === 'function' ? lead(x) : lead;
  $('steps').replaceChildren(...lab.steps.map(step => el('li', '', step)));
  $('topo').innerHTML = drawTopo(lab.nodes, lab.links, lab.height || 180);
  renderTabs(lab.nodes.map(n => n.id));
  renderCmds();
  reset();
}

// IPv4 and IPv6 addressing labs: requirements, solution, steps and diagram all follow from the level's interfaces
function addressingLab(T, cfg, x) {
  const v6 = T.kind === 'v6';
  const ifs = cfg.ifs.map(r => ({...r, name: portName(r.k), ip: v6 ? `2001:db8:${x}:${r.sub}::1/64` : `192.168.${x}.${r.host}`}));
  const reqs = [], solution = ['enable', 'conf t'], steps = [];
  for (const r of ifs) {
    reqs.push(v6
      ? {text: `${r.name} gets an address ::1 in subnet ${r.sub} of 2001:db8:${x}::/48, with a /64 prefix`, ok: st => st.ifs[r.k].ip6 === r.ip, hint: r.ip}
      : {text: `${r.name} gets the ${r.rule} usable address in ${r.lan}${T.showNet ? ` (192.168.${x}.${r.net})` : ''}, with ${T.maskRule}`,
        ok: st => st.ifs[r.k].ip === r.ip && st.ifs[r.k].mask === r.mask, hint: `${r.ip} ${r.mask}`});
    if (r.ll) reqs.push({text: `${r.name} has the link-local address fe80::1`, ok: st => st.ifs[r.k].ll === 'fe80::1', hint: 'ipv6 address fe80::1 link-local'});
    solution.push(`int ${r.k}`, v6 ? `ipv6 address ${r.ip}` : `ip address ${r.ip} ${r.mask}`);
    if (r.ll) solution.push('ipv6 address fe80::1 link-local');
    solution.push('no shutdown', 'exit');
    steps.push(v6 ? `${r.name} serves subnet ${r.sub}; use ::1 as its address`
      : `${r.name} serves ${r.lan}${r.need ? ` (${r.need} hosts)` : ''}${T.showNet ? ` at 192.168.${x}.${r.net}` : ''}; use the ${r.rule} usable address as the gateway`);
  }
  for (const r of ifs) reqs.push({text: `${r.name} is up`, ok: st => !st.ifs[r.k].shut, hint: 'no shutdown'});
  solution.push('end');
  steps.push('Bring each interface up and check that it stays up.');
  // R1 on the left, one PC per interface stacked on the right
  const n = ifs.length, height = Math.max(180, (n - 1) * 64 + 92), mid = height / 2;
  const nodes = [{id: 'R1', type: 'router', x: 8, y: mid - 26, sub: 'Router'}], links = [];
  ifs.forEach((r, i) => {
    const id = `PC${i + 1}`, cy = mid + (i - (n - 1) / 2) * 64;
    nodes.push({id, type: 'pc', x: 370, y: cy - 26, sub: v6 ? `Subnet ${r.sub}` : r.need ? `${r.lan}, ${r.need} hosts` : r.lan});
    links.push({a: 'R1', b: id, port: r.name});
  });
  return {reqs, solution, steps, nodes, links, height};
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
$('nav-ref').addEventListener('click', () => show('ref'));
$('back').addEventListener('click', () => show('dash'));
// every "Start lab" button, on the Labs page and in the Reference
document.addEventListener('click', e => {
  const b = e.target.closest('[data-lab]');
  if (!b) return;
  newLab(level, b.dataset.lab);
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
  document.querySelectorAll('[data-name]').forEach(row => { row.hidden = !row.dataset.name.includes(q); });
});

// lab page: open a device's console from the diagram or the console tabs; Check, Reset and the hint buttons
$('lab').addEventListener('click', e => {
  const device = e.target.closest('[data-dev]');
  if (device) showDevice(device.dataset.dev);
});
term.addEventListener('click', () => input.focus());
$('check').addEventListener('click', check);
$('reset').addEventListener('click', () => newLab());
$('reqs').addEventListener('click', e => {
  const b = e.target.closest('.rhint-btn');
  if (!b) return;
  const i = Number(b.dataset.i);
  reqHints[i] = (reqHints[i] || 0) + 1;
  renderReqs(reqs.map(r => r.ok(state) || null));
});

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

// the saved theme is applied in index.html before the page first paints
$('theme-toggle').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch {} // storage can be blocked; the switch still works for this visit
});

// ---- start ----
// self-check: the default lab's known-good config must pass; then that lab starts fresh and the Labs page opens
newLab();
solution.forEach(run);
console.assert(reqs.every(r => r.ok(state)), 'self-check: known-good config failed');
newLab();
show('dash');
