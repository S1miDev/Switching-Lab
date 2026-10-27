// Topology view: drag devices from the bar onto the canvas, move them, then cable them to match a task.
const TOPO_ICONS = {
  router: '<rect x="2" y="9" width="20" height="10" rx="2"/><path d="M6 14h.01M10 14h.01M14 14h.01M12 9V5"/>',
  switch: '<rect x="2" y="10" width="20" height="8" rx="2"/><path d="M6 14h.01M10 14h.01M14 14h.01M18 14h.01"/>',
  mls: '<rect x="2" y="10" width="20" height="8" rx="2"/><path d="M6 14h.01M10 14h.01M14 14h.01M18 14h.01M12 6v3M9 7l3-3 3 3"/>',
  dhcp: '<rect x="4" y="3" width="16" height="6" rx="1"/><rect x="4" y="11" width="16" height="6" rx="1"/><path d="M8 6h.01M8 14h.01M12 20v-3"/>',
  pc: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>'
};
const TOPO_TYPES = {
  router: {prefix:'R', label:'router', sub:'router', ports:['Gi0/0', 'Gi0/1', 'Gi0/2']},
  switch: {prefix:'S', label:'switch', sub:'switch', ports:['Fa0/1', 'Fa0/2', 'Fa0/3', 'Fa0/4', 'Fa0/5', 'Fa0/6', 'Fa0/7', 'Fa0/8']},
  pc: {prefix:'PC', label:'PC', sub:'PC', ports:['NIC']},
  mls: {prefix:'MLS', label:'multilayer switch', sub:'L3 switch', ports:['Gi1/0/1', 'Gi1/0/2', 'Gi1/0/3', 'Gi1/0/4', 'Gi1/0/5', 'Gi1/0/6']},
  dhcp: {prefix:'DHCP', label:'DHCP server', sub:'server', ports:['NIC']}
};
const TOPO_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const TOPO_TASKS = [
  {level:'beginner', title:'Connect the router to the switch', devices:[{name:'R1', type:'router'}, {name:'S1', type:'switch'}], links:[['R1', 'S1']]},
  {level:'beginner', title:'Connect the switch to a PC', devices:[{name:'S1', type:'switch'}, {name:'PC1', type:'pc'}], links:[['S1', 'PC1']]},
  {level:'intermediate', title:'Connect R1, S1 and PC1 in a line', devices:[{name:'R1', type:'router'}, {name:'S1', type:'switch'}, {name:'PC1', type:'pc'}], links:[['R1', 'S1'], ['S1', 'PC1']]},
  {level:'intermediate', title:'Connect the switch to both PCs', devices:[{name:'S1', type:'switch'}, {name:'PC1', type:'pc'}, {name:'PC2', type:'pc'}], links:[['S1', 'PC1'], ['S1', 'PC2']]},
  {level:'intermediate', title:'Give a PC an address from a DHCP server', devices:[{name:'S1', type:'switch'}, {name:'PC1', type:'pc'}, {name:'DHCP1', type:'dhcp'}], links:[['S1', 'PC1'], ['S1', 'DHCP1']]},
  {level:'advanced', title:'Put a multilayer switch between the router and an access switch', devices:[{name:'R1', type:'router'}, {name:'MLS1', type:'mls'}, {name:'S1', type:'switch'}, {name:'PC1', type:'pc'}], links:[['R1', 'MLS1'], ['MLS1', 'S1'], ['S1', 'PC1']]},
  {level:'advanced', title:'Chain two switches behind the router', devices:[{name:'R1', type:'router'}, {name:'S1', type:'switch'}, {name:'S2', type:'switch'}], links:[['R1', 'S1'], ['S1', 'S2']]},
  {level:'advanced', title:'Put a multilayer switch between the router and the switch', devices:[{name:'R1', type:'router'}, {name:'MLS1', type:'mls'}, {name:'S1', type:'switch'}], links:[['R1', 'MLS1'], ['MLS1', 'S1']]},
  {level:'expert', title:'Build the full topology with two switches', devices:[{name:'R1', type:'router'}, {name:'S1', type:'switch'}, {name:'S2', type:'switch'}, {name:'PC1', type:'pc'}, {name:'PC2', type:'pc'}], links:[['R1', 'S1'], ['S1', 'S2'], ['S1', 'PC1'], ['S2', 'PC2']]},
  {level:'expert', title:'Core switching with a DHCP server and two PCs', devices:[{name:'MLS1', type:'mls'}, {name:'S1', type:'switch'}, {name:'PC1', type:'pc'}, {name:'PC2', type:'pc'}, {name:'DHCP1', type:'dhcp'}], links:[['MLS1', 'S1'], ['MLS1', 'DHCP1'], ['S1', 'PC1'], ['S1', 'PC2']]}
];
const NODE_W = 120, NODE_H = 44, TOPO_W = 600, TOPO_H = 340, EDGE = 8;
// copper rule from the CCNA course: unlike ends (host/router vs switch) use straight-through, like ends use crossover
const SWITCHY = new Set(['switch', 'mls']);
const CABLE_NAMES = {straight:'straight-through', cross:'crossover'};
const rightCable = (x, y) => SWITCHY.has(nodeOf(x).type) === SWITCHY.has(nodeOf(y).type) ? 'cross' : 'straight';
let cableType = 'straight';
let topoLevel = 'beginner', topoTask = null, topoNodes = [], topoCables = [], topoSel = null, topoDrag = null;
const nodeOf = name => topoNodes.find(n => n.name === name);
const cableOf = (x, y) => topoCables.find(c => (c.a === x && c.b === y) || (c.a === y && c.b === x));
const linked = (x, y) => !!cableOf(x, y);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function topoMsg(text){ document.getElementById('topo-msg').textContent = text; }
function nextName(type){
  const p = TOPO_TYPES[type].prefix; let i = 1;
  while (topoNodes.some(n => n.name === p + i)) i++;
  return p + i;
}
function freePort(name){
  const n = nodeOf(name);
  return TOPO_TYPES[n.type].ports.find(p => !topoCables.some(c => (c.a === name && c.pa === p) || (c.b === name && c.pb === p)));
}
function addNode(type, p){
  const name = nextName(type);
  topoNodes.push({name, type, x:clamp(p.x - NODE_W / 2, EDGE, TOPO_W - NODE_W - EDGE), y:clamp(p.y - NODE_H / 2, EDGE, TOPO_H - NODE_H - EDGE)});
  topoMsg(`Added ${name}.`);
  topoRender();
}
function topoConnect(a, b){
  if (linked(a, b)) return topoMsg(`${a} and ${b} are already cabled.`);
  const pa = freePort(a), pb = freePort(b);
  if (!pa || !pb) return topoMsg(`No free port on ${pa ? b : a}.`);
  topoCables.push({a, b, pa, pb, type:cableType});
  topoMsg(`Cabled ${a} ${pa} to ${b} ${pb} with a ${CABLE_NAMES[cableType]} cable.`);
}
function topoClick(name){
  if (!topoSel) { topoSel = name; topoMsg(`Selected ${name}. Click another device to cable them.`); }
  else if (topoSel === name) { topoSel = null; topoMsg('Deselected.'); }
  else { topoConnect(topoSel, name); topoSel = null; }
  topoRender();
}
function topoRemoveSelected(){
  if (!topoSel) return topoMsg('Click a device first, then remove it.');
  const name = topoSel;
  topoNodes = topoNodes.filter(n => n.name !== name);
  topoCables = topoCables.filter(c => c.a !== name && c.b !== name);
  topoSel = null;
  topoMsg(`Removed ${name} and its cables.`);
  topoRender();
}
function topoReqs(){
  const devs = topoTask.devices.map(d => ({text:`Add a ${TOPO_TYPES[d.type].label} (${d.name})`, ok:!!nodeOf(d.name)}));
  const links = topoTask.links.map(([x, y]) => {
    const c = cableOf(x, y), ok = !!c && c.type === rightCable(x, y);
    return {text:`Cable ${x} to ${y} with the right cable${c && !ok ? ' (wrong cable type)' : ''}`, ok};
  });
  return [...devs, ...links, {text:'No extra cables', ok:topoCables.length === topoTask.links.length}];
}
function svgPoint(e){
  const svg = document.querySelector('#topo-canvas svg');
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const r = pt.matrixTransform(svg.getScreenCTM().inverse());
  return {x:r.x, y:r.y};
}
function topoSvg(){
  const mid = n => ({x:n.x + NODE_W / 2, y:n.y + NODE_H / 2});
  let s = `<svg viewBox="0 0 ${TOPO_W} ${TOPO_H}" role="img" aria-label="Lab topology. Drag devices to move them.">`;
  s += '<defs><pattern id="topo-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#1d2833"/></pattern></defs>';
  s += `<rect width="${TOPO_W}" height="${TOPO_H}" fill="url(#topo-dots)"/>`;
  topoCables.forEach(c => {
    const a = mid(nodeOf(c.a)), b = mid(nodeOf(c.b));
    s += `<line class="link${c.type === 'cross' ? ' cross' : ''}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>` +
      `<line class="hit" data-cable="${c.a}|${c.b}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"><title>Click to remove this cable</title></line>`;
  });
  topoNodes.forEach(n => {
    const label = TOPO_TYPES[n.type].sub;
    s += `<g data-dev="${n.name}" class="node">` +
      `<rect class="box" x="${n.x}" y="${n.y}" width="${NODE_W}" height="${NODE_H}" rx="7"/>` +
      `<g class="icon" transform="translate(${n.x + 8} ${n.y + 10}) scale(0.75)">${TOPO_ICONS[n.type]}</g>` +
      `<text class="name" x="${n.x + 36}" y="${n.y + 18}">${n.name}</text>` +
      `<text class="sub" x="${n.x + 36}" y="${n.y + 33}">${label}</text></g>`;
  });
  return s + '</svg>';
}
function topoRender(){
  const reqs = topoReqs(), ok = reqs.filter(r => r.ok).length;
  document.getElementById('topo-count').textContent = `${ok}/${reqs.length}`;
  document.getElementById('topo-reqs').innerHTML = reqs.map(r => `<li class="${r.ok ? 'ok' : ''}">${r.ok ? '✓' : '○'} ${r.text}</li>`).join('');
  document.getElementById('topo-canvas').innerHTML = topoSvg();
  if (topoSel && nodeOf(topoSel)) document.querySelector(`#topo-canvas [data-dev="${topoSel}"]`).classList.add('sel');
  document.getElementById('topo-cables').innerHTML = topoCables.map(c => `<li>${c.a} ${c.pa} ↔ ${c.b} ${c.pb} (${CABLE_NAMES[c.type]}) <button class="ghost cable-x" data-rm="${c.a}|${c.b}">Remove</button></li>`).join('') || '<li>No cables yet.</li>';
}
function topoNewTask(){
  let next;
  const pool = TOPO_TASKS.filter(t => t.level === topoLevel);
  do { next = pool[Math.floor(Math.random() * pool.length)]; } while (next === topoTask && pool.length > 1);
  topoTask = next; topoNodes = []; topoCables = []; topoSel = null;
  document.getElementById('topo-title').textContent = topoTask.title;
  document.getElementById('topo-desc').textContent = 'Drag the devices you need from the bar onto the canvas, then cable them.';
  topoMsg('');
  topoRender();
}

// canvas: drag devices to move them; a press without movement counts as a click (for cabling)
const topoCanvas = document.getElementById('topo-canvas');
topoCanvas.addEventListener('pointerdown', e => {
  const g = e.target.closest('[data-dev]');
  if (!g) return;
  const n = nodeOf(g.dataset.dev), p = svgPoint(e);
  topoDrag = {name:n.name, dx:p.x - n.x, dy:p.y - n.y, sx:e.clientX, sy:e.clientY, moved:false};
  topoCanvas.setPointerCapture(e.pointerId);
});
topoCanvas.addEventListener('pointermove', e => {
  if (!topoDrag) return;
  if (!topoDrag.moved && Math.hypot(e.clientX - topoDrag.sx, e.clientY - topoDrag.sy) < 5) return;
  topoDrag.moved = true;
  const n = nodeOf(topoDrag.name), p = svgPoint(e);
  n.x = clamp(p.x - topoDrag.dx, EDGE, TOPO_W - NODE_W - EDGE);
  n.y = clamp(p.y - topoDrag.dy, EDGE, TOPO_H - NODE_H - EDGE);
  topoRender();
});
const endDrag = () => {
  if (!topoDrag) return;
  const d = topoDrag; topoDrag = null;
  if (!d.moved) topoClick(d.name);
};
topoCanvas.addEventListener('pointerup', endDrag);
topoCanvas.addEventListener('pointercancel', () => { topoDrag = null; });

// palette: drag a device chip onto the canvas to add it
document.querySelectorAll('.topo-chip').forEach(chip => chip.addEventListener('pointerdown', e => {
  const type = chip.dataset.type, ghost = document.getElementById('topo-ghost');
  ghost.textContent = TOPO_TYPES[type].label; ghost.hidden = false;
  const place = ev => { ghost.style.left = ev.clientX + 12 + 'px'; ghost.style.top = ev.clientY + 12 + 'px'; };
  place(e);
  chip.setPointerCapture(e.pointerId);
  const move = ev => place(ev);
  const up = ev => {
    chip.removeEventListener('pointermove', move);
    ghost.hidden = true;
    const r = topoCanvas.getBoundingClientRect();
    if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) addNode(type, svgPoint(ev));
    else topoMsg('Drop the device on the canvas.');
  };
  chip.addEventListener('pointermove', move);
  chip.addEventListener('pointerup', up, {once:true});
  chip.addEventListener('pointercancel', () => { chip.removeEventListener('pointermove', move); ghost.hidden = true; }, {once:true});
}));

document.getElementById('nav-topo').addEventListener('click', () => { show('topo'); if (!topoTask) topoNewTask(); });
document.getElementById('topo-remove').addEventListener('click', topoRemoveSelected);
document.getElementById('topo-clear').addEventListener('click', () => { topoNodes = []; topoCables = []; topoSel = null; topoMsg('Cleared the canvas.'); topoRender(); });
document.getElementById('topo-next').addEventListener('click', topoNewTask);
document.getElementById('topo-level').addEventListener('change', e => { topoLevel = e.target.value; topoNewTask(); });
document.getElementById('topo-check').addEventListener('click', () => {
  const reqs = topoReqs();
  topoMsg(reqs.every(r => r.ok) ? 'Task complete.' : `${reqs.filter(r => !r.ok).length} requirement(s) not met yet.`);
  topoRender();
});

document.querySelectorAll('.cable-btn').forEach(b => b.addEventListener('click', () => {
  cableType = b.dataset.cable;
  document.querySelectorAll('.cable-btn').forEach(x => x.classList.toggle('on', x === b));
  topoMsg(`New cables will be ${CABLE_NAMES[cableType]}.`);
}));

// remove a cable: click it on the canvas or use its Remove button in the list
function topoRemoveCable(key){
  const [x, y] = key.split('|');
  topoCables = topoCables.filter(c => !((c.a === x && c.b === y) || (c.a === y && c.b === x)));
  topoMsg(`Removed the cable between ${x} and ${y}.`);
  topoRender();
}
topoCanvas.addEventListener('click', e => { const l = e.target.closest('[data-cable]'); if (l) topoRemoveCable(l.dataset.cable); });
document.getElementById('topo-cables').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) topoRemoveCable(b.dataset.rm); });
