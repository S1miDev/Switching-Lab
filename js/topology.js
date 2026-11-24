// Topology page: drag devices from the palette onto the canvas, move them, then cable them to match a task.

const TOPO_TASKS = [
  {level: 'beginner', title: L('Connect the router to the switch', 'Propoj router se switchem'), devices: ['R1', 'S1'], links: [['R1', 'S1']]},
  {level: 'beginner', title: L('Connect the switch to a PC', 'Propoj switch s PC'), devices: ['S1', 'PC1'], links: [['S1', 'PC1']]},
  {level: 'beginner', title: L('Connect a notebook to the switch', 'Připoj notebook ke switchi'), devices: ['S1', 'NB1'], links: [['S1', 'NB1']]},
  {level: 'beginner', title: L('Manage the router from a PC with a console cable', 'Spravuj router z PC přes konzolový kabel'), devices: ['R1', 'PC1'], links: [['R1', 'PC1', 'console']]},
  {level: 'beginner', title: L('Connect an access point to the switch', 'Připoj přístupový bod ke switchi'), devices: ['S1', 'AP1'], links: [['S1', 'AP1']]},
  {level: 'intermediate', title: L('Connect R1, S1 and PC1 in a line', 'Propoj R1, S1 a PC1 za sebou'), devices: ['R1', 'S1', 'PC1'], links: [['R1', 'S1'], ['S1', 'PC1']]},
  {level: 'intermediate', title: L('Connect the switch to a PC and a printer', 'Připoj ke switchi PC a tiskárnu'), devices: ['S1', 'PC1', 'PRN1'], links: [['S1', 'PC1'], ['S1', 'PRN1']]},
  {level: 'intermediate', title: L('Join two switches directly with copper', 'Propoj dva switche přímo metalikou'), devices: ['S1', 'S2'], links: [['S1', 'S2']]},
  {level: 'intermediate', title: L('Link two routers over a serial WAN cable', 'Propoj dva routery sériovým WAN kabelem'), devices: ['R1', 'R2'], links: [['R1', 'R2', 'serial']]},
  {level: 'intermediate', title: L('Give a PC an address from a DHCP server', 'Dej PC adresu z DHCP serveru'), devices: ['S1', 'PC1', 'DHCP1'], links: [['S1', 'PC1'], ['S1', 'DHCP1']]},
  {level: 'intermediate', title: L('Connect a wireless LAN controller and an access point to the switch', 'Připoj ke switchi WLAN controller a přístupový bod'), devices: ['S1', 'WLC1', 'AP1'],
    links: [['S1', 'WLC1'], ['S1', 'AP1']]},
  {level: 'advanced', title: L('Put a multilayer switch between the router and an access switch', 'Dej multilayer switch mezi router a přístupový switch'), devices: ['R1', 'MLS1', 'S1', 'PC1'],
    links: [['R1', 'MLS1'], ['MLS1', 'S1'], ['S1', 'PC1']]},
  {level: 'advanced', title: L('Chain two switches behind the router', 'Zapoj dva switche za sebou za router'), devices: ['R1', 'S1', 'S2'], links: [['R1', 'S1'], ['S1', 'S2']]},
  {level: 'advanced', title: L('Put a WLC and two access points on the switch behind the router', 'Připoj WLC a dva přístupové body ke switchi za routerem'), devices: ['R1', 'S1', 'WLC1', 'AP1', 'AP2'],
    links: [['R1', 'S1'], ['S1', 'WLC1'], ['S1', 'AP1'], ['S1', 'AP2']]},
  {level: 'advanced', title: L('Put a multilayer switch between the router and the switch', 'Dej multilayer switch mezi router a switch'), devices: ['R1', 'MLS1', 'S1'],
    links: [['R1', 'MLS1'], ['MLS1', 'S1']]},
  {level: 'advanced', title: L('Link two switches with a fiber uplink and attach a PC and a notebook', 'Propoj dva switche optickým uplinkem a připoj PC a notebook'), devices: ['S1', 'S2', 'PC1', 'NB1'],
    links: [['S1', 'S2', 'fiber'], ['S1', 'PC1'], ['S2', 'NB1']]},
  {level: 'advanced', title: L('Connect a branch LAN to R1 over a serial WAN link', 'Připoj LAN pobočky k R1 přes sériovou WAN linku'), devices: ['R1', 'R2', 'S1', 'PC1'],
    links: [['R1', 'R2', 'serial'], ['R2', 'S1'], ['S1', 'PC1']]},
  {level: 'advanced', title: L('Cable a PC to the switch and manage the switch from a notebook console', 'Připoj PC ke switchi a spravuj switch z notebooku přes konzoli'), devices: ['S1', 'PC1', 'NB1'],
    links: [['S1', 'PC1'], ['S1', 'NB1', 'console']]},
  {level: 'expert', title: L('Campus wireless: fiber from the core to the WLC and to the access switch, with two access points on the access switch', 'Bezdrátový kampus: optika z jádra do WLC a do přístupového switche, na přístupovém switchi dva přístupové body'),
    devices: ['MLS1', 'S1', 'WLC1', 'AP1', 'AP2'], links: [['MLS1', 'WLC1', 'fiber'], ['MLS1', 'S1', 'fiber'], ['S1', 'AP1'], ['S1', 'AP2']]},
  {level: 'expert', title: L('Build the full topology with two switches', 'Postav celou topologii se dvěma switchi'), devices: ['R1', 'S1', 'S2', 'PC1', 'PC2'],
    links: [['R1', 'S1'], ['S1', 'S2'], ['S1', 'PC1'], ['S2', 'PC2']]},
  {level: 'expert', title: L('Core switching with a DHCP server and two PCs', 'Páteřní switching s DHCP serverem a dvěma PC'), devices: ['MLS1', 'S1', 'PC1', 'PC2', 'DHCP1'],
    links: [['MLS1', 'S1'], ['MLS1', 'DHCP1'], ['S1', 'PC1'], ['S1', 'PC2']]},
  {level: 'expert', title: L('Office LAN: fiber from the router to the core and on to the access switch, with a PC, a notebook and a printer, and an admin PC on the console', 'Kancelářská LAN: optika z routeru do jádra a dál do přístupového switche s PC, notebookem a tiskárnou, a admin PC na konzoli'),
    devices: ['R1', 'MLS1', 'S1', 'PC1', 'NB1', 'PRN1', 'PC2'],
    links: [['R1', 'MLS1', 'fiber'], ['MLS1', 'S1', 'fiber'], ['S1', 'PC1'], ['S1', 'NB1'], ['S1', 'PRN1'], ['MLS1', 'PC2', 'console']]},
  {level: 'expert', title: L('Two sites joined by a serial WAN, each with a switch, and a PC at one and a printer at the other', 'Dvě pobočky spojené sériovou WAN, každá se switchem, v jedné PC a v druhé tiskárna'),
    devices: ['R1', 'R2', 'S1', 'S2', 'PC1', 'PRN1'],
    links: [['R1', 'R2', 'serial'], ['R1', 'S1'], ['R2', 'S2'], ['S1', 'PC1'], ['S2', 'PRN1']]},
];

// copper rule from the CCNA course: unlike devices (a host or router to a switch) use straight-through, like devices crossover
const SWITCHY = new Set(['switch', 'mls']);
const rightCable = (x, y) => (SWITCHY.has(typeOf(x)) === SWITCHY.has(typeOf(y)) ? 'cross' : 'straight');
// a task link is [a, b] (copper, by the rule above) or [a, b, type] when the task needs a specific cable such as fiber, serial or console
// coax has no task yet, so it counts as the wrong cable type everywhere
const CABLE_NAMES = LANG === 'cs'
  ? {straight: 'přímý', cross: 'křížený', fiber: 'optický', serial: 'sériový', console: 'konzolový', coax: 'koaxiální'}
  : {straight: 'straight-through', cross: 'crossover', fiber: 'fiber', serial: 'serial', console: 'console', coax: 'coaxial'};

// canvas size (the SVG viewBox), device box size, and the margin devices keep from the edge
const TOPO_W = 600, TOPO_H = 340, EDGE = 8; // the device box size (NODE_W, NODE_H) is in topo-data.js

let topoLevel = 'beginner';
let topoTask = null;
let topoNodes = [];   // {name, type, x, y}: x, y is the box's top-left corner
let topoCables = [];  // {a, b, pa, pb, type}: the two device names, their ports, and 'straight', 'cross', 'fiber', 'serial', 'console' or 'coax'
let topoSel = null;   // the device clicked first when cabling
let topoDrag = null;  // the device being moved
let topoCounted = false; // this task already counted toward the day streak
let cableType = 'straight';
const topoCanvas = document.getElementById('topo-canvas');

const nodeOf = name => topoNodes.find(n => n.name === name);
const cableOf = (x, y) => topoCables.find(c => (c.a === x && c.b === y) || (c.a === y && c.b === x));

function topoMsg(text) {
  document.getElementById('topo-msg').textContent = text;
}

// move a device's box to (x, y), keeping it inside the canvas
function moveNode(n, x, y) {
  n.x = clamp(x, EDGE, TOPO_W - NODE_W - EDGE);
  n.y = clamp(y, EDGE, TOPO_H - NODE_H - EDGE);
}

// the first free name for a type: R1, R2 ...
function nextName(type) {
  const prefix = TOPO_TYPES[type].prefix;
  let i = 1;
  while (nodeOf(prefix + i)) i++;
  return prefix + i;
}

function freePort(name) {
  return TOPO_TYPES[typeOf(name)].ports.find(p => !topoCables.some(c => (c.a === name && c.pa === p) || (c.b === name && c.pb === p)));
}

// add a device centred on canvas point p
function addNode(type, p) {
  const n = {name: nextName(type), type};
  moveNode(n, p.x - NODE_W / 2, p.y - NODE_H / 2);
  topoNodes.push(n);
  topoMsg(L(`Added ${n.name}.`, `Přidáno ${n.name}.`));
  topoRender();
}

function topoConnect(a, b) {
  if (cableOf(a, b)) return topoMsg(L(`${a} and ${b} are already cabled.`, `${a} a ${b} už jsou propojené.`));
  const pa = freePort(a), pb = freePort(b);
  if (!pa || !pb) return topoMsg(L(`No free port on ${pa ? b : a}.`, `${pa ? b : a} nemá volný port.`));
  topoCables.push({a, b, pa, pb, type: cableType});
  topoMsg(L(`Cabled ${a} ${pa} to ${b} ${pb} with a ${CABLE_NAMES[cableType]} cable.`, `Propojeno ${a} ${pa} s ${b} ${pb}, kabel ${CABLE_NAMES[cableType]}.`));
}

// the first click selects a device, a click on another cables the two, a second click on the same one deselects it
function topoClick(name) {
  if (!topoSel) {
    topoSel = name;
    topoMsg(L(`Selected ${name}. Click another device to cable them.`, `Vybráno ${name}. Kliknutím na další zařízení je propojíš.`));
  } else if (topoSel === name) {
    topoSel = null;
    topoMsg(L('Deselected.', 'Výběr zrušen.'));
  } else {
    topoConnect(topoSel, name);
    topoSel = null;
  }
  topoRender();
}

function topoRemoveSelected() {
  if (!topoSel) return topoMsg(L('Click a device first, then remove it.', 'Nejdřív klikni na zařízení, pak ho odeber.'));
  const name = topoSel;
  topoNodes = topoNodes.filter(n => n.name !== name);
  topoCables = topoCables.filter(c => c.a !== name && c.b !== name);
  topoSel = null;
  topoMsg(L(`Removed ${name} and its cables.`, `Odebráno ${name} i s kabely.`));
  topoRender();
}

// key is "A|B", as stored on the cable's line and its Remove button
function topoRemoveCable(key) {
  const [x, y] = key.split('|');
  const cable = cableOf(x, y);
  topoCables = topoCables.filter(c => c !== cable);
  topoMsg(L(`Removed the cable between ${x} and ${y}.`, `Odebrán kabel mezi ${x} a ${y}.`));
  topoRender();
}

function clearCanvas() {
  topoNodes = [];
  topoCables = [];
  topoSel = null;
}

function topoReqs() {
  const devices = topoTask.devices.map(name => ({text: L(`Add a ${TOPO_TYPES[typeOf(name)].label} (${name})`, `Přidej ${TOPO_TYPES[typeOf(name)].label} (${name})`), ok: !!nodeOf(name)}));
  const cables = topoTask.links.map(([x, y, want = rightCable(x, y)]) => {
    const c = cableOf(x, y), ok = !!c && c.type === want;
    return {text: L(`Cable ${x} to ${y} with the right cable`, `Propoj ${x} s ${y} správným kabelem`) + (c && !ok ? L(' (wrong cable type)', ' (špatný typ kabelu)') : ''), ok};
  });
  return [...devices, ...cables, {text: L('No extra cables', 'Žádné kabely navíc'), ok: topoCables.length === topoTask.links.length}];
}


function topoSvg() {
  let svg = `<svg viewBox="0 0 ${TOPO_W} ${TOPO_H}" role="img" aria-label="${L('Lab topology. Drag devices to move them.', 'Topologie labu. Zařízení přesuneš tažením.')}">`;
  if (!topoNodes.length) {
    svg += `<rect class="empty" x="40" y="40" width="${TOPO_W - 80}" height="${TOPO_H - 80}" rx="12"/>` +
      `<text class="empty-t" x="${TOPO_W / 2}" y="${TOPO_H / 2 - 4}">${L('Drag a device here to add it', 'Přetáhni sem zařízení')}</text>` +
      `<text class="empty-s" x="${TOPO_W / 2}" y="${TOPO_H / 2 + 16}">${L('then click two devices to cable them', 'pak klikni na dvě zařízení a propoj je')}</text>`;
  }
  let labels = ''; // drawn last, on top of the devices
  for (const c of topoCables) {
    const a = nodeMid(nodeOf(c.a)), b = nodeMid(nodeOf(c.b));
    const ends = `x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"`;
    // the visible line, then a wide invisible one on top that is easier to click
    svg += `<line class="link ${c.type}" ${ends}/>` +
      `<line class="hit" data-cable="${c.a}|${c.b}" ${ends}><title>${L('Click to remove this cable', 'Kliknutím kabel odebereš')}</title></line>`;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) continue;
    const d = {x: (b.x - a.x) / len, y: (b.y - a.y) / len};
    labels += `<text class="ctype" x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 16}">${CABLE_NAMES[c.type]}</text>` +
      portChip(nodeOf(c.a), d, c.pa) + portChip(nodeOf(c.b), {x: -d.x, y: -d.y}, c.pb);
  }
  for (const n of topoNodes) {
    svg += `<g data-dev="${n.name}">` +
      `<rect class="box" x="${n.x}" y="${n.y}" width="${NODE_W}" height="${NODE_H}" rx="12"/>` +
      `<circle class="ico-bg" cx="${n.x + 22}" cy="${n.y + 22}" r="16"/>` +
      `<g class="icon" transform="translate(${n.x + 13} ${n.y + 13}) scale(0.75)">${TOPO_ICONS[n.type]}</g>` +
      `<text class="name" x="${n.x + 44}" y="${n.y + 19}">${n.name}</text>` +
      `<text class="sub" x="${n.x + 44}" y="${n.y + 33}">${TOPO_TYPES[n.type].sub}</text></g>`;
  }
  return svg + labels + '</svg>';
}

function topoRender() {
  const reqs = topoReqs(), met = reqs.filter(r => r.ok).length;
  const current = reqs.findIndex(r => !r.ok); // the first unfinished step gets the "current" highlight
  if (met === reqs.length) topoMsg(L('Task complete.', 'Zadání splněno.'));
  if (met === reqs.length && !topoCounted) { topoCounted = true; globalThis.recordStreakDay?.(); } // from auth.js
  document.getElementById('topo-count').textContent = `${met}/${reqs.length}`;
  document.getElementById('topo-bar').style.width = `${100 * met / reqs.length}%`;
  document.getElementById('topo-reqs').innerHTML = reqs.map((r, i) =>
    `<li class="${r.ok ? 'ok' : i === current ? 'cur' : ''}"><span class="mark">${r.ok ? '✓' : '○'}</span><span class="rtext">${r.text}</span></li>`).join('');
  document.getElementById('topo-ncables').textContent = L(`${topoCables.length} cable${topoCables.length === 1 ? '' : 's'}`, `${topoCables.length} ${cz(topoCables.length, 'kabel', 'kabely', 'kabelů')}`);
  topoCanvas.innerHTML = topoSvg();
  if (topoSel) topoCanvas.querySelector(`[data-dev="${topoSel}"]`).classList.add('sel');
  document.getElementById('topo-cables').innerHTML = topoCables.map(c =>
    `<li>${c.a} ${c.pa} ↔ ${c.b} ${c.pb} (${CABLE_NAMES[c.type]}) <button class="ghost cable-x" data-rm="${c.a}|${c.b}">${L('Remove', 'Odebrat')}</button></li>`,
  ).join('') || `<li>${L('No cables yet.', 'Zatím žádné kabely.')}</li>`;
}

// a random task of the chosen difficulty, never the same one twice in a row
function topoNewTask() {
  const pool = TOPO_TASKS.filter(t => t.level === topoLevel);
  let next;
  do next = pool[Math.floor(Math.random() * pool.length)]; while (next === topoTask && pool.length > 1);
  topoTask = next;
  topoCounted = false;
  clearCanvas();
  document.getElementById('topo-title').textContent = topoTask.title;
  topoMsg('');
  topoRender();
}

// canvas: drag a device to move it; a press that does not move counts as a click (for cabling)
topoCanvas.addEventListener('pointerdown', e => {
  const g = e.target.closest('[data-dev]');
  if (!g) return;
  const n = nodeOf(g.dataset.dev), p = svgPoint(topoCanvas, e);
  topoDrag = {name: n.name, dx: p.x - n.x, dy: p.y - n.y, startX: e.clientX, startY: e.clientY, moved: false};
  topoCanvas.setPointerCapture(e.pointerId);
});
topoCanvas.addEventListener('pointermove', e => {
  if (!topoDrag) return;
  if (!topoDrag.moved && Math.hypot(e.clientX - topoDrag.startX, e.clientY - topoDrag.startY) < 5) return; // still a click
  topoDrag.moved = true;
  const p = svgPoint(topoCanvas, e);
  moveNode(nodeOf(topoDrag.name), p.x - topoDrag.dx, p.y - topoDrag.dy);
  topoRender();
});
topoCanvas.addEventListener('pointerup', () => {
  const drag = topoDrag;
  topoDrag = null;
  if (drag && !drag.moved) topoClick(drag.name);
});
topoCanvas.addEventListener('pointercancel', () => { topoDrag = null; });

// palette: each button gets its icon, and dragging it onto the canvas adds that device
document.querySelectorAll('.topo-chip').forEach(chip => {
  const type = chip.dataset.type;
  chip.insertAdjacentHTML('afterbegin', `<svg class="chip-ico" viewBox="0 0 24 24" aria-hidden="true">${TOPO_ICONS[type]}</svg>`);
  const miss = () => topoMsg(L('Drop the device on the canvas.', 'Pusť zařízení na plátno.'));
  dragFromChip(chip, TOPO_TYPES[type].label, topoCanvas, p => addNode(type, p), miss);
  chip.addEventListener('click', () => { if (!chip.dragged) miss(); }); // a plain click: say how to add it
});

document.getElementById('nav-topo').addEventListener('click', () => {
  show('topo');
  if (!topoTask) topoNewTask();
});
document.getElementById('topo-next').addEventListener('click', topoNewTask);
document.getElementById('topo-remove').addEventListener('click', topoRemoveSelected);
document.getElementById('topo-clear').addEventListener('click', () => {
  clearCanvas();
  topoMsg(L('Cleared the canvas.', 'Plátno vymazáno.'));
  topoRender();
});
document.querySelectorAll('[data-topo-level]').forEach(b => b.addEventListener('click', () => {
  topoLevel = b.dataset.topoLevel;
  document.querySelectorAll('[data-topo-level]').forEach(x => x.classList.toggle('active', x === b));
  moveSeg(document.getElementById('topo-seg'));
  topoNewTask();
}));
document.querySelectorAll('.cable-btn').forEach(b => b.addEventListener('click', () => {
  cableType = b.dataset.cable;
  document.querySelectorAll('.cable-btn').forEach(x => x.classList.toggle('on', x === b));
  topoMsg(L(`New cables will be ${CABLE_NAMES[cableType]}.`, `Nové kabely budou typu ${CABLE_NAMES[cableType]}.`));
}));
// remove a cable: click it on the canvas, or use its Remove button in the list
topoCanvas.addEventListener('click', e => {
  const line = e.target.closest('[data-cable]');
  if (line) topoRemoveCable(line.dataset.cable);
});
document.getElementById('topo-cables').addEventListener('click', e => {
  const b = e.target.closest('[data-rm]');
  if (b) topoRemoveCable(b.dataset.rm);
});
