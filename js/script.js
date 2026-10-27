// App core: shared state, console, lab setup, navigation. Loads last and starts the app.
const $ = id => document.getElementById(id);
const term = $('term'), input = $('cmd'), promptEl = $('prompt');
let log = $('log');
const logs = {R1: log};
let dev = 'R1';
let state;
let swState;
const past = [];
let pos = 0;

let hintN = 0, REQS = [], SOLUTION = [], lastNet = null, level = 'intermediate', topic = 'ipv4';
function reset(){
  hintN = 0; hintLabel();
  swState = freshSw();
  state = {mode:'user', iface:null, host:'R1', cdp:true, lldp:false, routes:[], saved:null, acls:{}, aclName:null, dhcp:{}, dhcpEx:[], dhcpName:null, nat:{pat:[], stat:[]}, svc:{ntp:[], log:[], dns:[]}, sw:swState, ifs:{'gi0/0':iface('Gi0/0'), 'gi0/1':iface('Gi0/1'), 'gi0/2':iface('Gi0/2'), 'gi0/3':iface('Gi0/3')}};
  Object.values(logs).forEach(l => { l.textContent = ''; });
  past.length = 0; pos = 0;
  showDevice('R1');
  renderPrompt(); renderReqs(null);
}
function print(text, cls = ''){
  const d = document.createElement('div');
  if (cls) d.className = cls;
  d.textContent = text;
  log.appendChild(d);
  term.scrollTop = term.scrollHeight;
}
function echo(line){
  const d = document.createElement('div');
  const p = document.createElement('span');
  p.className = 'ps';
  p.textContent = promptFor() + ' ';
  d.append(p, line);
  log.appendChild(d);
  term.scrollTop = term.scrollHeight;
}
const SUFFIX = {user:'>', priv:'#', config:'(config)#', ifc:'(config-if)#', vlan:'(config-vlan)#', nacl:'(config-nacl)#', dhcp:'(config-dhcp)#', line:'(config-line)#', router:'(config-router)#'};
function promptFor(){ if (dev === 'S1') return swState.host + SUFFIX[swState.mode]; return dev === 'R1' ? state.host + SUFFIX[state.mode] : dev + '>'; }
function renderPrompt(){ promptEl.textContent = promptFor(); }
function showDevice(name){
  dev = name;
  if (!logs[name]) { logs[name] = document.createElement('div'); term.insertBefore(logs[name], input.parentNode); }
  Object.keys(logs).forEach(k => { logs[k].hidden = k !== name; });
  log = logs[name];
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.dev === name));
  document.querySelectorAll('#topo [data-dev]').forEach(g => g.classList.toggle('sel', g.dataset.dev === name));
  renderPrompt();
  if (!log.textContent) {
    if (name === 'R1' || name === 'S1') { print(`Connected to ${name} \u2014 type ? or help for available commands.`); print('Press Tab to complete, Up/Down for history.'); }
    else print(`Connected to ${name} \u2014 this device is not configurable in this lab.`);
  }
  input.focus();
}
function complete(){
  const text = input.value.toLowerCase();
  const hits = keysNow().filter(k => k.startsWith(text));
  if (!hits.length) return;
  if (hits.length === 1) { input.value = hits[0] + ' '; return; }
  let p = hits[0];
  for (const h of hits) while (!h.startsWith(p)) p = p.slice(0, -1);
  if (p.length > text.length) input.value = p;
  else print(hits.join('   '));
}
function addStep(text){ const li = document.createElement('li'); li.textContent = text; $('steps').appendChild(li); }
function markLevel(){
  document.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.set === level));
  moveSeg();
}
// slide the highlight under the active difficulty button (needs the bar to be visible to measure it)
function moveSeg(){
  const seg = document.querySelector('.seg'), a = seg.querySelector('.active');
  if (!a || !a.offsetWidth) return;
  seg.style.setProperty('--x', a.offsetLeft + 'px');
  seg.style.setProperty('--w', a.offsetWidth + 'px');
  requestAnimationFrame(() => seg.classList.add('ready'));
}
function renderReqs(results){
  const ul = $('reqs'); ul.textContent = '';
  $('req-count').textContent = `${results ? results.filter(Boolean).length : 0}/${REQS.length}`;
  REQS.forEach((r, i) => {
    const li = document.createElement('li');
    const res = results ? results[i] : null;
    if (res !== null) li.className = res ? 'ok' : 'bad';
    li.textContent = (res === null ? '\u25CB ' : res ? '\u2713 ' : '\u2717 ') + r.text + (res === false && r.hint ? ` \u2014 expected: ${r.hint}` : '');
    ul.appendChild(li);
  });
}
function node(id, type, x, y, name, sub){
  const icon = {
    router: '<rect x="2" y="9" width="20" height="10" rx="2"/><path d="M6 14h.01M10 14h.01M14 14h.01M12 9V5"/>',
    switch: '<rect x="2" y="10" width="20" height="8" rx="2"/><path d="M6 14h.01M10 14h.01M14 14h.01M18 14h.01"/>',
    pc: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>'
  }[type];
  return `<g data-dev="${id}" class="node">` +
    `<rect class="box" x="${x}" y="${y}" width="150" height="52" rx="8"/>` +
    `<g class="icon" transform="translate(${x + 12} ${y + 14})">${icon}</g>` +
    `<text class="name" x="${x + 46}" y="${y + 22}">${name}</text>` +
    `<text class="sub" x="${x + 46}" y="${y + 39}">${sub}</text></g>`;
}
function drawTopo(nodes, links, H){
  const at = id => nodes.find(n => n.id === id);
  let s = `<svg viewBox="0 0 528 ${H}" role="img" aria-label="Lab topology. Click a device to open its console.">`;
  s += '<defs><pattern id="topo-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#1d2833"/></pattern></defs>';
  s += `<rect width="528" height="${H}" fill="url(#topo-dots)"/>`;
  links.forEach(l => {
    const a = at(l.a), b = at(l.b);
    const x1 = a.x + 150, y1 = a.y + 26, x2 = b.x, y2 = b.y + 26;
    s += `<line class="link" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    if (l.port) s += `<text class="port" x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 7}">${l.port}</text>`;
  });
  nodes.forEach(n => { s += node(n.id, n.type, n.x, n.y, n.name, n.sub); });
  return s + '</svg>';
}
function renderTabs(names){
  const box = document.querySelector('.tabs');
  box.textContent = '';
  names.forEach(n => {
    const b = document.createElement('button');
    b.className = 'tab';
    b.dataset.dev = n;
    b.textContent = n;
    box.appendChild(b);
  });
}
function keysNow(){ return dev === 'S1' ? SW_KEYS[swState.mode] : (KEYS[state.mode] || ['permit', 'deny', 'exit', 'end']); }
function check(){
  const results = REQS.map(r => r.ok(state));
  renderReqs(results);
  const failed = results.filter(x => !x).length;
  print(failed ? `[lab] ${failed} requirement(s) not met.` : '[lab] All requirements met.', failed ? 'ln-err' : 'ln-ok');
}
// Strip values from a command so it shows syntax only
function cmdSyntax(c){ return c.replace(/\(.*?\)/g, '').replace(/\s+on\s+\S*\d\S*$/i, '').trim()
    .replace(/^conf t$/, 'configure terminal').replace(/^int \S+$/, 'interface <name>')
    .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '<ip>').replace(/\S*:\S*:\S*/g, '<addr/len>')
    .replace(/^(name|description) .+/, '$1 <text>').replace(/(?<=\s)\d+(,\d+)*(?=\s|$)/g, '<n>'); }
// Commands card: only what this lab uses, shown as syntax (values stripped so answers are not given away)
function renderCmds(){
  const src = SOLUTION.length ? SOLUTION : REQS.flatMap(r => (r.hint || '').split(/,\s*(?:then\s+)?(?=[a-z])/i));
  const list = ['enable', 'configure terminal', ...src.map(cmdSyntax).filter(c => c && c !== 'enable'), 'show running-config', 'exit', 'end'];
  $('cmds').textContent = [...new Set(list)].join(' · ');
}
function newLab(lvl = level, t = topic){
  level = lvl; topic = t; markLevel();
  const T = TOPICS[topic], cfg = T.levels[level];
  let x;
  do { x = Math.floor(Math.random() * 256); } while (x === lastNet);
  lastNet = x;
  $('lab-title').textContent = T.name;
  $('lab-sub').textContent = cfg.sub;
  $('steps').textContent = '';
  $('scenario-lead').className = '';
  if (cfg.kind === 'rt') {
    REQS = cfg.build(x);
    SOLUTION = [];
    $('scenario-lead').textContent = typeof cfg.lead === 'function' ? cfg.lead(x) : cfg.lead;
    cfg.steps.forEach(addStep);
    $('topo').innerHTML = drawTopo(RT_NODES, RT_LINKS, 180);
    renderTabs(['R1', 'PC1', 'R2', 'R3']);
    renderCmds();
    reset();
    return;
  }
  if (cfg.kind === 'proto' || cfg.kind === 'sw') {
    REQS = cfg.reqs;
    SOLUTION = cfg.cmds ? ['enable', 'conf t', ...cfg.cmds, 'end'] : [];
    $('scenario-lead').textContent = cfg.lead;
    cfg.steps.forEach(addStep);
    const cdpNodes = [
      {id:'R1', type:'router', x:8, y:64, name:'R1', sub:'Router'},
      {id:'S1', type:'switch', x:190, y:64, name:'S1', sub:'Switch'},
      {id:'PC1', type:'pc', x:370, y:24, name:'PC1', sub:'Host'},
      {id:'PC2', type:'pc', x:370, y:104, name:'PC2', sub:'Host'}];
    $('topo').innerHTML = drawTopo(cdpNodes, [{a:'R1', b:'S1', port:'Gi0/0'}, {a:'S1', b:'PC1', port:'Fa0/1'}, {a:'S1', b:'PC2', port:'Fa0/2'}], 180);
    renderTabs(['R1', 'S1', 'PC1', 'PC2']);
  } else {
    const v6 = cfg.kind === 'v6';
    const ifs = cfg.ifs.map(r => ({...r, name: r.k.replace('gi', 'Gi'), ip: v6 ? `2001:db8:${x}:${r.sub}::1/64` : `192.168.${x}.${r.host}`}));
    REQS = [];
    ifs.forEach(r => {
      if (v6) REQS.push({text:`${r.name} gets an address ::1 in subnet ${r.sub} of 2001:db8:${x}::/48, with a /64 prefix`, ok: st => st.ifs[r.k].ip6 === r.ip, hint: r.ip});
      else REQS.push({text:`${r.name} gets the ${r.rule} usable address in ${r.lan}${T.showNet ? ` (192.168.${x}.${r.net})` : ''}, with ${T.maskRule}`, ok: st => st.ifs[r.k].ip === r.ip && st.ifs[r.k].mask === r.mask, hint: `${r.ip} ${r.mask}`});
      if (r.ll) REQS.push({text:`${r.name} has the link-local address fe80::1`, ok: st => st.ifs[r.k].ll === 'fe80::1', hint:'ipv6 address fe80::1 link-local'});
    });
    ifs.forEach(r => REQS.push({text:`${r.name} is up`, ok: st => !st.ifs[r.k].shut, hint:'no shutdown'}));
    SOLUTION = ['enable', 'conf t'];
    ifs.forEach(r => {
      SOLUTION.push(`int ${r.k}`, v6 ? `ipv6 address ${r.ip}` : `ip address ${r.ip} ${r.mask}`);
      if (r.ll) SOLUTION.push('ipv6 address fe80::1 link-local');
      SOLUTION.push('no shutdown', 'exit');
    });
    SOLUTION.push('end');
    $('scenario-lead').textContent = T.lead(x);
    ifs.forEach(r => addStep(v6
      ? `${r.name} serves subnet ${r.sub}; use ::1 as its address`
      : `${r.name} serves ${r.lan}${r.need ? ` (${r.need} hosts)` : ''}${T.showNet ? ` at 192.168.${x}.${r.net}` : ''}; use the ${r.rule} usable address as the gateway`));
    addStep('Bring each interface up and check that it stays up.');
    const n = ifs.length, H = Math.max(180, (n - 1) * 64 + 92), mid = H / 2;
    const topoNodes = [{id:'R1', type:'router', x:8, y:mid - 26, name:'R1', sub:'Router'}];
    const topoLinks = [];
    ifs.forEach((r, i) => {
      const id = `PC${i + 1}`, cy = mid + (i - (n - 1) / 2) * 64;
      topoNodes.push({id, type:'pc', x:370, y:cy - 26, name:id, sub: v6 ? `Subnet ${r.sub}` : (r.need ? `${r.lan}, ${r.need} hosts` : r.lan)});
      topoLinks.push({a:'R1', b:id, port:r.name});
    });
    $('topo').innerHTML = drawTopo(topoNodes, topoLinks, H);
    renderTabs(topoNodes.map(p => p.id));
  }
  renderCmds();
  reset();
}
function show(view){
  $('dash').hidden = view !== 'dash';
  $('lab').hidden = view !== 'lab';
  $('ref').hidden = view !== 'ref';
  $('topo-view').hidden = view !== 'topo';
  $('exam-view').hidden = view !== 'exam';
  if (view === 'ref') refHome();
  if (view === 'dash') moveSeg();
  $('nav-labs').classList.toggle('active', view === 'dash' || view === 'lab');
  $('nav-ref').classList.toggle('active', view === 'ref');
  $('nav-topo').classList.toggle('active', view === 'topo');
  $('nav-exam').classList.toggle('active', view === 'exam');
  window.scrollTo(0, 0);
  if (view === 'lab') input.focus();
}

input.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const line = input.value.trim();
    if (line) past.push(line);
    pos = past.length;
    run(input.value);
    renderReqs(REQS.map(r => r.ok(state) || null)); // live: ticks met items, leaves the rest neutral (no hints)
    input.value = '';
  } else if (e.key === 'Tab') {
    e.preventDefault();
    if (dev === 'R1' || dev === 'S1') complete();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (pos > 0) { pos--; input.value = past[pos]; }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (pos < past.length - 1) { pos++; input.value = past[pos]; }
    else { pos = past.length; input.value = ''; }
  }
});
term.addEventListener('click', () => input.focus());
$('check').addEventListener('click', check);
// Hints: 1 = which command to think about, 2 = its syntax, 3 = the full configuration
function hintLabel(){ $('hint').textContent = hintN < 3 ? `Hint (${3 - hintN} left)` : 'Hint (none left)'; $('hint').disabled = hintN >= 3; }
$('hint').addEventListener('click', () => {
  const r = REQS.find(q => !q.ok(state));
  if (!r) return print('[hint] Every requirement is already met.', 'ln-ok');
  const raw = /^[\d.]+ /.test(r.hint) ? 'ip address ' + r.hint : /^[0-9a-f:]+\/\d+$/i.test(r.hint) ? 'ipv6 address ' + r.hint : r.hint || '';
  const parts = raw.split(/,\s*(?:then\s+)?(?=[a-z])/i).map(cmdSyntax);
  hintN++;
  if (hintN === 1) print(`[hint 1/3] Next up: "${r.text}". Which command, in which mode, does that? Try ${parts[0].split(' ').slice(0, 2).join(' ')} ...`, 'ln-ok');
  else if (hintN === 2) print(`[hint 2/3] Syntax: ${parts.join(' then ')}`, 'ln-ok');
  else {
    print(`[hint 3/3] Full configuration${SOLUTION.length ? '' : ' (enter each line under the right interface or mode)'}:`, 'ln-ok');
    (SOLUTION.length ? SOLUTION : ['enable', 'configure terminal', ...REQS.flatMap(q => (q.hint || '').split(/,\s*(?:then\s+)?(?=[a-z])/i))]).forEach(c => print('  ' + c, 'ln-ok'));
  }
  hintLabel();
});
$('reset').addEventListener('click', () => newLab());
$('back').addEventListener('click', () => show('dash'));
$('nav-labs').addEventListener('click', () => show('dash'));
$('nav-ref').addEventListener('click', () => show('ref'));
$('ref').addEventListener('click', e => { const c = e.target.closest('.ref-item'); if (c) showRef(c); });
$('ref').addEventListener('keydown', e => { const c = e.target.closest && e.target.closest('.ref-item'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showRef(c); } });
document.addEventListener('click', e => { const b = e.target.closest('[data-lab]'); if (b) { newLab(level, b.dataset.lab); show('lab'); } });
$('ref-detail').addEventListener('click', e => { if (e.target.closest('#ref-back')) refHome(); });
document.querySelectorAll('.seg-btn').forEach(b => b.addEventListener('click', () => { level = b.dataset.set; markLevel(); }));
$('search').addEventListener('input', e => { const q = e.target.value.trim().toLowerCase(); if (q) document.querySelectorAll('details.domain').forEach(d => { d.open = true; }); document.querySelectorAll('[data-name]').forEach(r => { r.hidden = !r.dataset.name.includes(q); }); });

$('topo').addEventListener('click', e => { const g = e.target.closest('[data-dev]'); if (g) showDevice(g.dataset.dev); });
document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-dev]'); if (b) showDevice(b.dataset.dev); });
// self-check: the known-good config must pass, then the lab resets
newLab();
SOLUTION.forEach(run);
console.assert(REQS.every(r => r.ok(state)), 'self-check: known-good config failed');
newLab();
show('dash');

// smooth open/close for the collapsible sections; plain toggle if the user prefers reduced motion
document.addEventListener('click', e => {
  const sum = e.target.closest('details.domain > summary, details.card > summary');
  if (!sum) return;
  const d = sum.parentElement, rows = d.querySelector('.rows, .dbody');
  if (!rows || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  e.preventDefault();
  if (rows.anim) rows.anim.cancel();
  const opening = !d.open || d.classList.contains('closing');
  if (opening) d.open = true;
  const cs = getComputedStyle(rows), h = rows.scrollHeight;
  d.classList.toggle('closing', !opening);
  const shut = {height:'0px', paddingTop:'0px', paddingBottom:'0px', opacity:0};
  const full = {height:h + 'px', paddingTop:cs.paddingTop, paddingBottom:cs.paddingBottom, opacity:1};
  rows.style.overflow = 'hidden';
  rows.anim = rows.animate(opening ? [shut, full] : [full, shut], {duration:260, easing:'cubic-bezier(.4,0,.2,1)'});
  rows.anim.onfinish = () => { rows.style.overflow = ''; rows.anim = null; d.classList.remove('closing'); if (!opening) d.open = false; };
  rows.anim.oncancel = () => { rows.style.overflow = ''; };
});
window.addEventListener('resize', moveSeg);
