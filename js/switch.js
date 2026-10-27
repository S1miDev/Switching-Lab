// S1: switch command-line simulator
const SW_CMDS = {
  user: ['enable', 'exit', 'show'],
  priv: ['configure', 'copy', 'disable', 'exit', 'show', 'write'],
  config: ['hostname', 'interface', 'line', 'vlan', 'spanning-tree', 'port-channel', 'exit', 'end', 'show'],
  vlan: ['name', 'exit', 'end'],
  line: ['no', 'exit', 'end', 'show'],
  ifc: ['interface', 'description', 'no', 'shutdown', 'switchport', 'channel-group', 'spanning-tree', 'exit', 'end', 'show']
};
const SW_SHOWS = ['show vlan brief', 'show interfaces status', 'show running-config', 'show startup-config', 'show etherchannel summary', 'show spanning-tree'];
const SW_KEYS = {
  user: ['enable', 'exit', 'show vlan brief', 'show interfaces status', 'show running-config'],
  priv: ['configure terminal', 'copy running-config startup-config', 'disable', 'exit', 'write memory', ...SW_SHOWS],
  config: ['hostname', 'interface', 'line console 0', 'line vty 0 15', 'vlan', 'spanning-tree mode rapid-pvst', 'spanning-tree vlan 10 root primary', 'port-channel load-balance src-dst-ip', 'exit', 'end', ...SW_SHOWS],
  vlan: ['name', 'exit', 'end'],
  line: ['exit', 'end'],
  ifc: ['interface', 'description', 'switchport mode access', 'switchport mode trunk', 'switchport access vlan', 'switchport trunk allowed vlan', 'switchport trunk native vlan', 'shutdown', 'no shutdown', 'channel-group 1 mode active', 'spanning-tree portfast', 'spanning-tree bpduguard enable', 'exit', 'end', ...SW_SHOWS]
};
function freshSw(){
  const port = (name, shut = true) => ({name, mode:'dynamic', vlan:1, native:1, allowed:null, shut, desc:null, group:null, chanMode:null, portfast:false, bpdu:false, psec:false, psMax:null, psViolation:null, psSticky:false});
  return {mode:'user', iface:null, host:'S1', saved:null, stp:{mode:'pvst', prio:{}}, lb:null, vlans:{1:{name:'default'}},
    ports:{'fa0/1':port('Fa0/1'), 'fa0/2':port('Fa0/2'), 'fa0/3':port('Fa0/3', false), 'gi0/1':port('Gi0/1')}};
}
function swKey(t){
  const m = (t || '').toLowerCase().match(/^(fastethernet|fa|f|gigabitethernet|gigabit|gig|gi|g)?(\d+\/\d+)$/);
  if (!m) return null;
  const k = (/^(f|fa|fastethernet)$/.test(m[1] || '') ? 'fa' : 'gi') + m[2];
  return Object.hasOwn(swState.ports, k) ? k : null;
}
function swConfigLines(){
  const L = [`hostname ${swState.host}`];
  if (swState.stp.mode === 'rapid-pvst') L.push('spanning-tree mode rapid-pvst');
  Object.keys(swState.stp.prio).forEach(id => L.push(`spanning-tree vlan ${id} priority ${swState.stp.prio[id]}`));
  Object.keys(swState.vlans).filter(id => id !== '1').forEach(id => L.push(`vlan ${id}`, ` name ${swState.vlans[id].name}`, '!'));
  Object.values(swState.ports).forEach(p => {
    L.push(`interface ${p.name}`);
    if (p.desc) L.push(` description ${p.desc}`);
    if (p.group) L.push(` channel-group ${p.group} mode ${p.chanMode}`);
    if (p.portfast) L.push(' spanning-tree portfast');
    if (p.bpdu) L.push(' spanning-tree bpduguard enable');
    if (p.psec) L.push(' switchport port-security');
    if (p.psMax) L.push(` switchport port-security maximum ${p.psMax}`);
    if (p.psViolation) L.push(` switchport port-security violation ${p.psViolation}`);
    if (p.psSticky) L.push(' switchport port-security mac-address sticky');
    if (p.mode === 'access') L.push(' switchport mode access', ` switchport access vlan ${p.vlan}`);
    if (p.mode === 'trunk') L.push(' switchport mode trunk');
    if (p.allowed) L.push(` switchport trunk allowed vlan ${p.allowed.join(',')}`);
    if (p.native !== 1) L.push(` switchport trunk native vlan ${p.native}`);
    L.push(p.shut ? ' shutdown' : ' no shutdown', '!');
  });
  return L;
}
function swSave(){ swState.saved = swConfigLines(); print('Building configuration...'); print('[OK]', 'ln-ok'); }
function swVlanBrief(){
  print('VLAN Name                 Status    Ports');
  print('---- -------------------- --------- ----------');
  Object.keys(swState.vlans).forEach(id => {
    const ports = Object.values(swState.ports).filter(p => p.mode === 'access' && p.vlan === Number(id)).map(p => p.name).join(', ');
    print(id.padEnd(4) + ' ' + swState.vlans[id].name.padEnd(20) + ' ' + 'active'.padEnd(9) + ' ' + ports);
  });
}
function swStatus(){
  print('Port      Status');
  Object.values(swState.ports).forEach(p => print(p.name.padEnd(10) + (p.shut ? 'administratively down' : 'up')));
}
function swShow(args){
  if (pick(args[0], ['vlan']) && pick(args[1], ['brief'])) return swVlanBrief();
  if (pick(args[0], ['interfaces']) && pick(args[1], ['status'])) return swStatus();
  if (pick(args[0], ['running-config']) && args.length === 1) return swConfigLines().forEach(l => print(l));
  if (pick(args[0], ['etherchannel']) && pick(args[1], ['summary'])) return swEtherSummary();
  if (pick(args[0], ['spanning-tree'])) return swStp();
  if (pick(args[0], ['startup-config']) && args.length === 1) return swState.saved ? swState.saved.forEach(l => print(l)) : print('startup-config is not present', 'ln-err');
  print('% Invalid input detected', 'ln-err');
}
function swSwitchport(w){
  const p = swState.ports[swState.iface];
  if (pick(w[1], ['mode'])) {
    const v = pick(w[2], ['access', 'trunk', 'dynamic']);
    if (!v) return print('% Invalid input detected', 'ln-err');
    p.mode = v;
  } else if (pick(w[1], ['port-security'])) {
    if (!w[2]) p.psec = true;
    else if (pick(w[2], ['maximum']) && /^\d+$/.test(w[3] || '')) { p.psec = true; p.psMax = Number(w[3]); }
    else if (pick(w[2], ['violation']) && pick(w[3], ['shutdown', 'restrict', 'protect'])) { p.psec = true; p.psViolation = pick(w[3], ['shutdown', 'restrict', 'protect']); }
    else if (pick(w[2], ['mac-address']) && pick(w[3], ['sticky'])) { p.psec = true; p.psSticky = true; }
    else print('% Invalid input detected', 'ln-err');
  } else if (pick(w[1], ['access']) && pick(w[2], ['vlan']) && /^\d+$/.test(w[3] || '')) p.vlan = Number(w[3]);
  else if (pick(w[1], ['trunk']) && pick(w[2], ['allowed']) && pick(w[3], ['vlan']) && /^[\d,]+$/.test(w[4] || '')) p.allowed = w[4].split(',').map(Number).sort((a, b) => a - b);
  else if (pick(w[1], ['trunk']) && pick(w[2], ['native']) && pick(w[3], ['vlan']) && /^\d+$/.test(w[4] || '')) p.native = Number(w[4]);
  else print('% Invalid input detected', 'ln-err');
}
function runSw(raw){
  const line = raw.trim();
  if (!line) return;
  if (line === '?' || line === 'help') return help();
  const w = line.toLowerCase().split(/\s+/), s = swState, m = s.mode, cmd = w[0];
  const port = () => s.ports[s.iface];
  const c = m === 'ifc' && cmd === 'sh' ? 'shutdown' : pick(cmd, SW_CMDS[m]);
  if (c === 'show') return swShow(w.slice(1));
  if (c === 'enable') s.mode = 'priv';
  else if (c === 'disable') s.mode = 'user';
  else if (c === 'configure' && pick(w[1], ['terminal'])) s.mode = 'config';
  else if (c === 'write') swSave();
  else if (c === 'copy' && pick(w[1], ['running-config']) && pick(w[2], ['startup-config'])) swSave();
  else if (c === 'hostname' && m === 'config' && w[1]) s.host = raw.trim().split(/\s+/)[1];
  else if (c === 'vlan' && m === 'config' && /^\d+$/.test(w[1] || '')) { s.vlanId = Number(w[1]); s.vlans[s.vlanId] = s.vlans[s.vlanId] || {name: 'VLAN' + String(s.vlanId).padStart(4, '0')}; s.mode = 'vlan'; }
  else if (c === 'line' && m === 'config' && ((pick(w[1], ['console']) && w.length === 3 && /^\d+$/.test(w[2])) || (pick(w[1], ['vty']) && w.length === 4 && /^\d+$/.test(w[2]) && /^\d+$/.test(w[3])))) s.mode = 'line';
  else if (c === 'name' && m === 'vlan' && w[1]) s.vlans[s.vlanId].name = raw.trim().split(/\s+/)[1];
  else if (c === 'interface' && (m === 'config' || m === 'ifc') && swKey(w[1])) { s.iface = swKey(w[1]); s.mode = 'ifc'; }
  else if (c === 'switchport' && m === 'ifc') swSwitchport(w);
  else if (c === 'description' && m === 'ifc' && w.length > 1) port().desc = raw.trim().slice(raw.trim().indexOf(' ') + 1);
  else if (c === 'shutdown' && m === 'ifc') port().shut = true;
  else if (c === 'no' && m === 'ifc' && pick(w[1], ['shutdown'])) port().shut = false;
  else if (c === 'spanning-tree' && m === 'config' && pick(w[1], ['mode']) && pick(w[2], ['rapid-pvst'])) s.stp.mode = 'rapid-pvst';
  else if (c === 'spanning-tree' && m === 'config' && pick(w[1], ['vlan']) && /^\d+$/.test(w[2] || '') && pick(w[3], ['priority']) && /^\d+$/.test(w[4] || '')) s.stp.prio[w[2]] = Number(w[4]);
  else if (c === 'spanning-tree' && m === 'config' && pick(w[1], ['vlan']) && /^\d+$/.test(w[2] || '') && pick(w[3], ['root']) && pick(w[4], ['primary'])) s.stp.prio[w[2]] = 24576;
  else if (c === 'spanning-tree' && m === 'ifc' && pick(w[1], ['portfast'])) port().portfast = true;
  else if (c === 'spanning-tree' && m === 'ifc' && pick(w[1], ['bpduguard']) && pick(w[2], ['enable'])) port().bpdu = true;
  else if (c === 'channel-group' && m === 'ifc' && /^\d+$/.test(w[1] || '') && pick(w[2], ['mode']) && pick(w[3], ['active', 'passive', 'on', 'desirable', 'auto'])) { port().group = Number(w[1]); port().chanMode = pick(w[3], ['active', 'passive', 'on', 'desirable', 'auto']); }
  else if (c === 'port-channel' && m === 'config' && pick(w[1], ['load-balance']) && w[2]) s.lb = w[2];
  else if (c === 'exit') s.mode = {ifc:'config', vlan:'config', line:'config', config:'priv', priv:'user', user:'user'}[m];
  else if (c === 'end' && m !== 'user' && m !== 'priv') s.mode = 'priv';
  else print('% Invalid input detected', 'ln-err');
  renderPrompt();
}
function swEtherSummary(){
  const groups = {};
  Object.values(swState.ports).filter(p => p.group !== null).forEach(p => { (groups[p.group] = groups[p.group] || []).push(p); });
  if (!Object.keys(groups).length) return print('No aggregators configured');
  print('Group  Port-channel  Ports');
  Object.keys(groups).forEach(g => print(`${g.padEnd(7)}Po${g.padEnd(12)}${groups[g].map(p => `${p.name}(${p.chanMode})`).join(' ')}`));
}
function swStp(){
  print(`Spanning tree mode: ${swState.stp.mode}`);
  Object.keys(swState.vlans).forEach(id => {
    const pr = swState.stp.prio[id] !== undefined ? swState.stp.prio[id] : 32768;
    print(`VLAN${id.padStart(4, '0')}  priority ${pr}  ${pr <= 24576 ? 'this switch is root' : 'another switch is root'}`);
  });
}
