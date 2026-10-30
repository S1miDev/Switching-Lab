// Topology page: drag devices from the palette onto the canvas, move them, then cable them to match a task.

// device icons (24x24), also used by the lab diagram in script.js and the palette buttons below
const TOPO_ICONS = {
  router: '<rect x="2" y="9" width="20" height="10" rx="2"/><path d="M6 14h.01M10 14h.01M14 14h.01M12 9V5"/>',
  switch: '<rect x="2" y="10" width="20" height="8" rx="2"/><path d="M6 14h.01M10 14h.01M14 14h.01M18 14h.01"/>',
  mls: '<rect x="2" y="10" width="20" height="8" rx="2"/><path d="M6 14h.01M10 14h.01M14 14h.01M18 14h.01M12 6v3M9 7l3-3 3 3"/>',
  dhcp: '<rect x="4" y="3" width="16" height="6" rx="1"/><rect x="4" y="11" width="16" height="6" rx="1"/><path d="M8 6h.01M8 14h.01M12 20v-3"/>',
  pc: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>',
};
const TOPO_TYPES = {
  router: {prefix: 'R', label: 'router', sub: 'router', ports: ['Gi0/0', 'Gi0/1', 'Gi0/2']},
  switch: {prefix: 'S', label: 'switch', sub: 'switch', ports: ['Fa0/1', 'Fa0/2', 'Fa0/3', 'Fa0/4', 'Fa0/5', 'Fa0/6', 'Fa0/7', 'Fa0/8']},
  pc: {prefix: 'PC', label: 'PC', sub: 'PC', ports: ['NIC']},
  mls: {prefix: 'MLS', label: 'multilayer switch', sub: 'L3 switch', ports: ['Gi1/0/1', 'Gi1/0/2', 'Gi1/0/3', 'Gi1/0/4', 'Gi1/0/5', 'Gi1/0/6']},
  dhcp: {prefix: 'DHCP', label: 'DHCP server', sub: 'server', ports: ['NIC']},
};
// device names are a type prefix plus a number (R1, MLS2), so the name tells the type
const typeOf = name => Object.keys(TOPO_TYPES).find(type => TOPO_TYPES[type].prefix === name.replace(/\d+$/, ''));

const TOPO_TASKS = [
  {level: 'beginner', title: 'Connect the router to the switch', devices: ['R1', 'S1'], links: [['R1', 'S1']]},
  {level: 'beginner', title: 'Connect the switch to a PC', devices: ['S1', 'PC1'], links: [['S1', 'PC1']]},
  {level: 'intermediate', title: 'Connect R1, S1 and PC1 in a line', devices: ['R1', 'S1', 'PC1'], links: [['R1', 'S1'], ['S1', 'PC1']]},
  {level: 'intermediate', title: 'Connect the switch to both PCs', devices: ['S1', 'PC1', 'PC2'], links: [['S1', 'PC1'], ['S1', 'PC2']]},
  {level: 'intermediate', title: 'Give a PC an address from a DHCP server', devices: ['S1', 'PC1', 'DHCP1'], links: [['S1', 'PC1'], ['S1', 'DHCP1']]},
  {level: 'advanced', title: 'Put a multilayer switch between the router and an access switch', devices: ['R1', 'MLS1', 'S1', 'PC1'],
    links: [['R1', 'MLS1'], ['MLS1', 'S1'], ['S1', 'PC1']]},
  {level: 'advanced', title: 'Chain two switches behind the router', devices: ['R1', 'S1', 'S2'], links: [['R1', 'S1'], ['S1', 'S2']]},
  {level: 'advanced', title: 'Put a multilayer switch between the router and the switch', devices: ['R1', 'MLS1', 'S1'],
    links: [['R1', 'MLS1'], ['MLS1', 'S1']]},
  {level: 'expert', title: 'Build the full topology with two switches', devices: ['R1', 'S1', 'S2', 'PC1', 'PC2'],
    links: [['R1', 'S1'], ['S1', 'S2'], ['S1', 'PC1'], ['S2', 'PC2']]},
  {level: 'expert', title: 'Core switching with a DHCP server and two PCs', devices: ['MLS1', 'S1', 'PC1', 'PC2', 'DHCP1'],
    links: [['MLS1', 'S1'], ['MLS1', 'DHCP1'], ['S1', 'PC1'], ['S1', 'PC2']]},
];

// copper rule from the CCNA course: unlike devices (a host or router to a switch) use straight-through, like devices crossover
const SWITCHY = new Set(['switch', 'mls']);
const rightCable = (x, y) => (SWITCHY.has(typeOf(x)) === SWITCHY.has(typeOf(y)) ? 'cross' : 'straight');
const CABLE_NAMES = {straight: 'straight-through', cross: 'crossover'};

// canvas size (the SVG viewBox), device box size, and the margin devices keep from the edge
const TOPO_W = 600, TOPO_H = 340, NODE_W = 120, NODE_H = 44, EDGE = 8;

let topoLevel = 'beginner';
let topoTask = null;
let topoNodes = [];   // {name, type, x, y}: x, y is the box's top-left corner
let topoCables = [];  // {a, b, pa, pb, type}: the two device names, their ports, and 'straight' or 'cross'
let topoSel = null;   // the device clicked first when cabling
let topoDrag = null;  // the device being moved
let cableType = 'straight';
const topoCanvas = document.getElementById('topo-canvas');

const nodeOf = name => topoNodes.find(n => n.name === name);
const cableOf = (x, y) => topoCables.find(c => (c.a === x && c.b === y) || (c.a === y && c.b === x));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

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
  topoMsg(`Added ${n.name}.`);
  topoRender();
}

function topoConnect(a, b) {
  if (cableOf(a, b)) return topoMsg(`${a} and ${b} are already cabled.`);
  const pa = freePort(a), pb = freePort(b);
  if (!pa || !pb) return topoMsg(`No free port on ${pa ? b : a}.`);
  topoCables.push({a, b, pa, pb, type: cableType});
  topoMsg(`Cabled ${a} ${pa} to ${b} ${pb} with a ${CABLE_NAMES[cableType]} cable.`);
}

// the first click selects a device, a click on another cables the two, a second click on the same one deselects it
function topoClick(name) {
  if (!topoSel) {
    topoSel = name;
    topoMsg(`Selected ${name}. Click another device to cable them.`);
  } else if (topoSel === name) {
    topoSel = null;
    topoMsg('Deselected.');
  } else {
    topoConnect(topoSel, name);
    topoSel = null;
  }
  topoRender();
}

function topoRemoveSelected() {
  if (!topoSel) return topoMsg('Click a device first, then remove it.');
  const name = topoSel;
  topoNodes = topoNodes.filter(n => n.name !== name);
  topoCables = topoCables.filter(c => c.a !== name && c.b !== name);
  topoSel = null;
  topoMsg(`Removed ${name} and its cables.`);
  topoRender();
}

// key is "A|B", as stored on the cable's line and its Remove button
function topoRemoveCable(key) {
  const [x, y] = key.split('|');
  const cable = cableOf(x, y);
  topoCables = topoCables.filter(c => c !== cable);
  topoMsg(`Removed the cable between ${x} and ${y}.`);
  topoRender();
}

function clearCanvas() {
  topoNodes = [];
  topoCables = [];
  topoSel = null;
}

function topoReqs() {
  const devices = topoTask.devices.map(name => ({text: `Add a ${TOPO_TYPES[typeOf(name)].label} (${name})`, ok: !!nodeOf(name)}));
  const cables = topoTask.links.map(([x, y]) => {
    const c = cableOf(x, y), ok = !!c && c.type === rightCable(x, y);
    return {text: `Cable ${x} to ${y} with the right cable${c && !ok ? ' (wrong cable type)' : ''}`, ok};
  });
  return [...devices, ...cables, {text: 'No extra cables', ok: topoCables.length === topoTask.links.length}];
}

// the pointer position in canvas (viewBox) coordinates
function svgPoint(e) {
  const svg = topoCanvas.querySelector('svg');
  const point = Object.assign(svg.createSVGPoint(), {x: e.clientX, y: e.clientY});
  return point.matrixTransform(svg.getScreenCTM().inverse());
}

function topoSvg() {
  const mid = n => ({x: n.x + NODE_W / 2, y: n.y + NODE_H / 2});
  // a port label just outside a device's edge, along the cable (d is the cable's direction, length 1)
  const portChip = (n, d, port) => {
    const c = mid(n);
    const k = Math.min(NODE_W / 2 / (Math.abs(d.x) || 1e-9), NODE_H / 2 / (Math.abs(d.y) || 1e-9)) + 16;
    const x = c.x + d.x * k, y = c.y + d.y * k, w = port.length * 6 + 10;
    return `<g class="pchip"><rect x="${x - w / 2}" y="${y - 8}" width="${w}" height="16" rx="4"/><text x="${x}" y="${y + 3.5}">${port}</text></g>`;
  };
  let svg = `<svg viewBox="0 0 ${TOPO_W} ${TOPO_H}" role="img" aria-label="Lab topology. Drag devices to move them.">`;
  if (!topoNodes.length) {
    svg += `<rect class="empty" x="40" y="40" width="${TOPO_W - 80}" height="${TOPO_H - 80}" rx="12"/>` +
      `<text class="empty-t" x="${TOPO_W / 2}" y="${TOPO_H / 2 - 4}">Drag a device here to add it</text>` +
      `<text class="empty-s" x="${TOPO_W / 2}" y="${TOPO_H / 2 + 16}">then click two devices to cable them</text>`;
  }
  let labels = ''; // drawn last, on top of the devices
  for (const c of topoCables) {
    const a = mid(nodeOf(c.a)), b = mid(nodeOf(c.b));
    const ends = `x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"`;
    // the visible line, then a wide invisible one on top that is easier to click
    svg += `<line class="link${c.type === 'cross' ? ' cross' : ''}" ${ends}/>` +
      `<line class="hit" data-cable="${c.a}|${c.b}" ${ends}><title>Click to remove this cable</title></line>`;
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
  if (met === reqs.length) topoMsg('Task complete.');
  document.getElementById('topo-count').textContent = `${met}/${reqs.length}`;
  document.getElementById('topo-bar').style.width = `${100 * met / reqs.length}%`;
  document.getElementById('topo-reqs').innerHTML = reqs.map((r, i) =>
    `<li class="${r.ok ? 'ok' : i === current ? 'cur' : ''}"><span class="mark">${r.ok ? '✓' : '○'}</span><span class="rtext">${r.text}</span></li>`).join('');
  document.getElementById('topo-ncables').textContent = `${topoCables.length} cable${topoCables.length === 1 ? '' : 's'}`;
  topoCanvas.innerHTML = topoSvg();
  if (topoSel) topoCanvas.querySelector(`[data-dev="${topoSel}"]`).classList.add('sel');
  document.getElementById('topo-cables').innerHTML = topoCables.map(c =>
    `<li>${c.a} ${c.pa} ↔ ${c.b} ${c.pb} (${CABLE_NAMES[c.type]}) <button class="ghost cable-x" data-rm="${c.a}|${c.b}">Remove</button></li>`,
  ).join('') || '<li>No cables yet.</li>';
}

// a random task of the chosen difficulty, never the same one twice in a row
function topoNewTask() {
  const pool = TOPO_TASKS.filter(t => t.level === topoLevel);
  let next;
  do next = pool[Math.floor(Math.random() * pool.length)]; while (next === topoTask && pool.length > 1);
  topoTask = next;
  clearCanvas();
  document.getElementById('topo-title').textContent = topoTask.title;
  topoMsg('');
  topoRender();
}

// canvas: drag a device to move it; a press that does not move counts as a click (for cabling)
topoCanvas.addEventListener('pointerdown', e => {
  const g = e.target.closest('[data-dev]');
  if (!g) return;
  const n = nodeOf(g.dataset.dev), p = svgPoint(e);
  topoDrag = {name: n.name, dx: p.x - n.x, dy: p.y - n.y, startX: e.clientX, startY: e.clientY, moved: false};
  topoCanvas.setPointerCapture(e.pointerId);
});
topoCanvas.addEventListener('pointermove', e => {
  if (!topoDrag) return;
  if (!topoDrag.moved && Math.hypot(e.clientX - topoDrag.startX, e.clientY - topoDrag.startY) < 5) return; // still a click
  topoDrag.moved = true;
  const p = svgPoint(e);
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
  chip.addEventListener('pointerdown', e => {
    const ghost = document.getElementById('topo-ghost'); // the label that follows the pointer
    const follow = ev => {
      ghost.style.left = ev.clientX + 12 + 'px';
      ghost.style.top = ev.clientY + 12 + 'px';
    };
    const stop = () => {
      chip.removeEventListener('pointermove', follow);
      chip.removeEventListener('pointerup', drop);
      chip.removeEventListener('pointercancel', stop);
      ghost.hidden = true;
    };
    const drop = ev => {
      stop();
      const r = topoCanvas.getBoundingClientRect();
      if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) addNode(type, svgPoint(ev));
      else topoMsg('Drop the device on the canvas.');
    };
    ghost.textContent = TOPO_TYPES[type].label;
    ghost.hidden = false;
    follow(e);
    chip.setPointerCapture(e.pointerId);
    chip.addEventListener('pointermove', follow);
    chip.addEventListener('pointerup', drop);
    chip.addEventListener('pointercancel', stop);
  });
});

document.getElementById('nav-topo').addEventListener('click', () => {
  show('topo');
  if (!topoTask) topoNewTask();
});
document.getElementById('topo-next').addEventListener('click', topoNewTask);
document.getElementById('topo-remove').addEventListener('click', topoRemoveSelected);
document.getElementById('topo-clear').addEventListener('click', () => {
  clearCanvas();
  topoMsg('Cleared the canvas.');
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
  topoMsg(`New cables will be ${CABLE_NAMES[cableType]}.`);
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
