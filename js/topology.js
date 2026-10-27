// Topology view: cable devices together to match a task. Uses drawTopo from script.js.
const TOPO_DEVS = [
  {id:'R1', type:'router', name:'R1', sub:'Router', x:20, y:84, ports:['Gi0/0', 'Gi0/1', 'Gi0/2']},
  {id:'S1', type:'switch', name:'S1', sub:'Switch', x:190, y:84, ports:['Fa0/1', 'Fa0/2', 'Fa0/3', 'Fa0/4']},
  {id:'PC1', type:'pc', name:'PC1', sub:'PC', x:360, y:20, ports:['NIC']},
  {id:'PC2', type:'pc', name:'PC2', sub:'PC', x:360, y:148, ports:['NIC']}
];
const TOPO_TASKS = [
  {title:'Connect the router to the switch', links:[['R1', 'S1']]},
  {title:'Connect the switch to a PC', links:[['S1', 'PC1']]},
  {title:'Connect R1, S1 and PC1 in a line', links:[['R1', 'S1'], ['S1', 'PC1']]},
  {title:'Connect the switch to both PCs', links:[['S1', 'PC1'], ['S1', 'PC2']]},
  {title:'Build the full topology', links:[['R1', 'S1'], ['S1', 'PC1'], ['S1', 'PC2']]}
];
let topoTask = null, topoCables = [], topoSel = null;
const devOf = id => TOPO_DEVS.find(d => d.id === id);
const linked = (x, y) => topoCables.some(c => (c.a === x && c.b === y) || (c.a === y && c.b === x));
function topoMsg(text){ document.getElementById('topo-msg').textContent = text; }
function freePort(id){
  return devOf(id).ports.find(p => !topoCables.some(c => (c.a === id && c.pa === p) || (c.b === id && c.pb === p)));
}
function topoConnect(a, b){
  if (linked(a, b)) return topoMsg(`${a} and ${b} are already cabled.`);
  const pa = freePort(a), pb = freePort(b);
  if (!pa || !pb) return topoMsg(`No free port on ${pa ? b : a}.`);
  topoCables.push({a, b, pa, pb});
  topoMsg(`Cabled ${a} ${pa} to ${b} ${pb}.`);
}
function topoClick(id){
  if (!topoSel) { topoSel = id; topoMsg(`Selected ${id}. Click another device to cable them.`); }
  else if (topoSel === id) { topoSel = null; topoMsg('Cancelled.'); }
  else { topoConnect(topoSel, id); topoSel = null; }
  topoRender();
}
function topoReqs(){
  const list = topoTask.links.map(([x, y]) => ({text:`Cable ${x} to ${y}`, ok:linked(x, y)}));
  list.push({text:'No extra cables', ok:topoCables.length === topoTask.links.length});
  return list;
}
function topoRender(){
  const reqs = topoReqs(), ok = reqs.filter(r => r.ok).length;
  document.getElementById('topo-count').textContent = `${ok}/${reqs.length}`;
  document.getElementById('topo-reqs').innerHTML = reqs.map(r => `<li class="${r.ok ? 'ok' : ''}">${r.ok ? '✓' : '○'} ${r.text}</li>`).join('');
  const nodes = TOPO_DEVS.map(d => ({id:d.id, type:d.type, x:d.x, y:d.y, name:d.name, sub:d.sub}));
  document.getElementById('topo-canvas').innerHTML = drawTopo(nodes, topoCables.map(c => ({a:c.a, b:c.b})), 220);
  if (topoSel) document.querySelector(`#topo-canvas [data-dev="${topoSel}"]`).classList.add('sel');
  document.getElementById('topo-cables').innerHTML = topoCables.map(c => `<li>${c.a} ${c.pa} ↔ ${c.b} ${c.pb}</li>`).join('') || '<li>No cables yet.</li>';
}
function topoNewTask(){
  let next;
  do { next = TOPO_TASKS[Math.floor(Math.random() * TOPO_TASKS.length)]; } while (next === topoTask && TOPO_TASKS.length > 1);
  topoTask = next; topoCables = []; topoSel = null;
  document.getElementById('topo-title').textContent = topoTask.title;
  document.getElementById('topo-desc').textContent = 'Cable the devices to match the task. Click one device, then another, to run a cable.';
  topoMsg('');
  topoRender();
}
document.getElementById('nav-topo').addEventListener('click', () => { show('topo'); if (!topoTask) topoNewTask(); });
document.getElementById('topo-canvas').addEventListener('click', e => { const g = e.target.closest('[data-dev]'); if (g) topoClick(g.dataset.dev); });
document.getElementById('topo-clear').addEventListener('click', () => { topoCables = []; topoSel = null; topoMsg('Cables cleared.'); topoRender(); });
document.getElementById('topo-next').addEventListener('click', topoNewTask);
document.getElementById('topo-check').addEventListener('click', () => {
  const reqs = topoReqs();
  topoMsg(reqs.every(r => r.ok) ? 'Task complete.' : `${reqs.filter(r => !r.ok).length} requirement(s) not met yet.`);
  topoRender();
});
