// Topology view: drag devices from the bar onto the canvas, move them, then cable them to match a task.
const TOPO_TYPES = {
  router: {prefix:'R', label:'router', ports:['Gi0/0', 'Gi0/1', 'Gi0/2']},
  switch: {prefix:'S', label:'switch', ports:['Fa0/1', 'Fa0/2', 'Fa0/3', 'Fa0/4', 'Fa0/5', 'Fa0/6', 'Fa0/7', 'Fa0/8']},
  pc: {prefix:'PC', label:'PC', ports:['NIC']}
};
const TOPO_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const TOPO_TASKS = [
  {level:'beginner', title:'Connect the router to the switch', devices:[{name:'R1', type:'router'}, {name:'S1', type:'switch'}], links:[['R1', 'S1']]},
  {level:'beginner', title:'Connect the switch to a PC', devices:[{name:'S1', type:'switch'}, {name:'PC1', type:'pc'}], links:[['S1', 'PC1']]},
  {level:'intermediate', title:'Connect R1, S1 and PC1 in a line', devices:[{name:'R1', type:'router'}, {name:'S1', type:'switch'}, {name:'PC1', type:'pc'}], links:[['R1', 'S1'], ['S1', 'PC1']]},
  {level:'intermediate', title:'Connect the switch to both PCs', devices:[{name:'S1', type:'switch'}, {name:'PC1', type:'pc'}, {name:'PC2', type:'pc'}], links:[['S1', 'PC1'], ['S1', 'PC2']]},
  {level:'advanced', title:'Chain two switches behind the router', devices:[{name:'R1', type:'router'}, {name:'S1', type:'switch'}, {name:'S2', type:'switch'}], links:[['R1', 'S1'], ['S1', 'S2']]},
  {level:'expert', title:'Build the full topology with two switches', devices:[{name:'R1', type:'router'}, {name:'S1', type:'switch'}, {name:'S2', type:'switch'}, {name:'PC1', type:'pc'}, {name:'PC2', type:'pc'}], links:[['R1', 'S1'], ['S1', 'S2'], ['S1', 'PC1'], ['S2', 'PC2']]}
];
const NODE_W = 150, NODE_H = 52, TOPO_W = 528, TOPO_H = 220;
let topoLevel = 'beginner', topoTask = null, topoNodes = [], topoCables = [], topoSel = null, topoDrag = null;
const nodeOf = name => topoNodes.find(n => n.name === name);
const linked = (x, y) => topoCables.some(c => (c.a === x && c.b === y) || (c.a === y && c.b === x));
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
  topoNodes.push({name, type, x:clamp(p.x - NODE_W / 2, 6, TOPO_W - NODE_W - 6), y:clamp(p.y - NODE_H / 2, 6, TOPO_H - NODE_H - 6)});
  topoMsg(`Added ${name}.`);
  topoRender();
}
function topoConnect(a, b){
  if (linked(a, b)) return topoMsg(`${a} and ${b} are already cabled.`);
  const pa = freePort(a), pb = freePort(b);
  if (!pa || !pb) return topoMsg(`No free port on ${pa ? b : a}.`);
  topoCables.push({a, b, pa, pb});
  topoMsg(`Cabled ${a} ${pa} to ${b} ${pb}.`);
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
  const links = topoTask.links.map(([x, y]) => ({text:`Cable ${x} to ${y}`, ok:linked(x, y)}));
  return [...devs, ...links, {text:'No extra cables', ok:topoCables.length === topoTask.links.length}];
}
function svgPoint(e){
  const svg = document.querySelector('#topo-canvas svg');
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const r = pt.matrixTransform(svg.getScreenCTM().inverse());
  return {x:r.x, y:r.y};
}
function topoRender(){
  const reqs = topoReqs(), ok = reqs.filter(r => r.ok).length;
  document.getElementById('topo-count').textContent = `${ok}/${reqs.length}`;
  document.getElementById('topo-reqs').innerHTML = reqs.map(r => `<li class="${r.ok ? 'ok' : ''}">${r.ok ? '✓' : '○'} ${r.text}</li>`).join('');
  const nodes = topoNodes.map(n => ({id:n.name, type:n.type, x:n.x, y:n.y, name:n.name, sub:TOPO_TYPES[n.type].label}));
  document.getElementById('topo-canvas').innerHTML = drawTopo(nodes, topoCables.map(c => ({a:c.a, b:c.b})), TOPO_H);
  if (topoSel && nodeOf(topoSel)) document.querySelector(`#topo-canvas [data-dev="${topoSel}"]`).classList.add('sel');
  document.getElementById('topo-cables').innerHTML = topoCables.map(c => `<li>${c.a} ${c.pa} ↔ ${c.b} ${c.pb}</li>`).join('') || '<li>No cables yet.</li>';
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
  n.x = clamp(p.x - topoDrag.dx, 6, TOPO_W - NODE_W - 6);
  n.y = clamp(p.y - topoDrag.dy, 6, TOPO_H - NODE_H - 6);
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
