// S1: the switch's command line. Uses the shared helpers in router.js (pick, isNum, execCommand ...).

// The words each mode accepts. Short forms are resolved against these lists.
const SW_CMDS = {
  user: ['enable', 'exit', 'show'],
  priv: ['configure', 'copy', 'disable', 'exit', 'show', 'write'],
  config: ['hostname', 'interface', 'line', 'vlan', 'spanning-tree', 'port-channel', 'exit', 'end', 'show'],
  vlan: ['name', 'exit', 'end'],
  line: ['no', 'exit', 'end', 'show'],
  ifc: ['interface', 'description', 'no', 'shutdown', 'switchport', 'channel-group', 'spanning-tree', 'exit', 'end', 'show'],
};

// The full commands Tab completes to, per mode, in the order Tab lists them
const SW_SHOWS = ['show vlan brief', 'show interfaces status', 'show running-config', 'show startup-config', 'show etherchannel summary',
  'show spanning-tree'];
const SW_KEYS = {
  user: ['enable', 'exit', 'show vlan brief', 'show interfaces status', 'show running-config'],
  priv: ['configure terminal', 'copy running-config startup-config', 'disable', 'exit', 'write memory', ...SW_SHOWS],
  config: ['hostname', 'interface', 'line console 0', 'line vty 0 15', 'vlan', 'spanning-tree mode rapid-pvst', 'spanning-tree vlan 10 root primary',
    'port-channel load-balance src-dst-ip', 'exit', 'end', ...SW_SHOWS],
  vlan: ['name', 'exit', 'end'],
  line: ['exit', 'end'],
  ifc: ['interface', 'description', 'switchport mode access', 'switchport mode trunk', 'switchport access vlan', 'switchport trunk allowed vlan',
    'switchport trunk native vlan', 'shutdown', 'no shutdown', 'channel-group 1 mode active', 'spanning-tree portfast',
    'spanning-tree bpduguard enable', 'exit', 'end', ...SW_SHOWS],
};

const CHANNEL_MODES = ['active', 'passive', 'on', 'desirable', 'auto'];
const VIOLATION_MODES = ['shutdown', 'restrict', 'protect'];

function freshSw() {
  const port = (name, shut = true) => ({
    name, mode: 'dynamic', vlan: 1, native: 1, allowed: null, shut, desc: null, group: null, chanMode: null,
    portfast: false, bpdu: false, psec: false, psMax: null, psViolation: null, psSticky: false,
  });
  return {
    mode: 'user', iface: null, host: 'S1', saved: null, vlanId: null, lb: null,
    vlans: {1: {name: 'default'}},
    stp: {mode: 'pvst', prio: {}},
    // Fa0/3 starts up: it is the unused port some labs ask you to shut down
    ports: {'fa0/1': port('Fa0/1'), 'fa0/2': port('Fa0/2'), 'fa0/3': port('Fa0/3', false), 'gi0/1': port('Gi0/1')},
  };
}

// Port name -> key in swState.ports. Accepts Fa0/1, f0/1, fastethernet0/1, Gi0/1, g0/1, gig0/1 ... or 0/1 (read as Gi).
function swKey(text) {
  const m = (text || '').match(/^(fastethernet|fa|f|gigabitethernet|gigabit|gig|gi|g)?(\d+\/\d+)$/);
  if (!m) return null;
  const key = (m[1]?.startsWith('f') ? 'fa' : 'gi') + m[2];
  return swState.ports[key] ? key : null;
}

function swConfigLines() {
  const s = swState;
  const lines = [`hostname ${s.host}`];
  if (s.stp.mode === 'rapid-pvst') lines.push('spanning-tree mode rapid-pvst');
  for (const [id, prio] of Object.entries(s.stp.prio)) lines.push(`spanning-tree vlan ${id} priority ${prio}`);
  for (const [id, vlan] of Object.entries(s.vlans)) if (id !== '1') lines.push(`vlan ${id}`, ` name ${vlan.name}`, '!');
  for (const p of Object.values(s.ports)) {
    lines.push(`interface ${p.name}`);
    if (p.desc) lines.push(` description ${p.desc}`);
    if (p.group) lines.push(` channel-group ${p.group} mode ${p.chanMode}`);
    if (p.portfast) lines.push(' spanning-tree portfast');
    if (p.bpdu) lines.push(' spanning-tree bpduguard enable');
    if (p.psec) lines.push(' switchport port-security');
    if (p.psMax) lines.push(` switchport port-security maximum ${p.psMax}`);
    if (p.psViolation) lines.push(` switchport port-security violation ${p.psViolation}`);
    if (p.psSticky) lines.push(' switchport port-security mac-address sticky');
    if (p.mode === 'access') lines.push(' switchport mode access', ` switchport access vlan ${p.vlan}`);
    if (p.mode === 'trunk') lines.push(' switchport mode trunk');
    if (p.allowed) lines.push(` switchport trunk allowed vlan ${p.allowed.join(',')}`);
    if (p.native !== 1) lines.push(` switchport trunk native vlan ${p.native}`);
    lines.push(p.shut ? ' shutdown' : ' no shutdown', '!');
  }
  return lines;
}

function swSave() {
  swState.saved = swConfigLines();
  print('Building configuration...');
  print('[OK]', 'ln-ok');
}

// ---- show commands ----

function swVlanBrief() {
  print('VLAN Name                 Status    Ports');
  print('---- -------------------- --------- ----------');
  for (const [id, vlan] of Object.entries(swState.vlans)) {
    const ports = Object.values(swState.ports).filter(p => p.mode === 'access' && p.vlan === Number(id)).map(p => p.name).join(', ');
    print(id.padEnd(4) + ' ' + vlan.name.padEnd(20) + ' ' + 'active'.padEnd(9) + ' ' + ports);
  }
}

function swStatus() {
  print('Port      Status');
  for (const p of Object.values(swState.ports)) print(p.name.padEnd(10) + (p.shut ? 'administratively down' : 'up'));
}

function swEtherSummary() {
  const groups = {};
  for (const p of Object.values(swState.ports)) if (p.group !== null) (groups[p.group] ||= []).push(p);
  if (!Object.keys(groups).length) return print('No aggregators configured');
  print('Group  Port-channel  Ports');
  for (const [g, ports] of Object.entries(groups)) print(`${g.padEnd(7)}Po${g.padEnd(12)}${ports.map(p => `${p.name}(${p.chanMode})`).join(' ')}`);
}

// S1 is root for a VLAN when its priority is 24576 or lower (the "root primary" value)
function swStp() {
  print(`Spanning tree mode: ${swState.stp.mode}`);
  for (const id of Object.keys(swState.vlans)) {
    const prio = swState.stp.prio[id] ?? 32768;
    print(`VLAN${id.padStart(4, '0')}  priority ${prio}  ${prio <= 24576 ? 'this switch is root' : 'another switch is root'}`);
  }
}

// the order matters: "show s" means spanning-tree
function swShow(args) {
  if (pick(args[0], ['vlan']) && pick(args[1], ['brief'])) return swVlanBrief();
  if (pick(args[0], ['interfaces']) && pick(args[1], ['status'])) return swStatus();
  if (pick(args[0], ['running-config']) && args.length === 1) return swConfigLines().forEach(l => print(l));
  if (pick(args[0], ['etherchannel']) && pick(args[1], ['summary'])) return swEtherSummary();
  if (pick(args[0], ['spanning-tree'])) return swStp();
  if (pick(args[0], ['startup-config']) && args.length === 1) {
    return swState.saved ? swState.saved.forEach(l => print(l)) : print('startup-config is not present', 'ln-err');
  }
  print('% Invalid input detected', 'ln-err');
}

// ---- the command line ----

function runSw(raw) {
  const line = raw.trim();
  if (!line) return;
  if (line === '?' || line === 'help') return help();
  const w = line.toLowerCase().split(/\s+/);
  const mode = swState.mode;
  const c = mode === 'ifc' && w[0] === 'sh' ? 'shutdown' : pick(w[0], SW_CMDS[mode]); // "sh" means shutdown in interface mode
  if (c === 'show') return swShow(w.slice(1));
  const done = execCommand(c, w, swState, swSave)
    || (c === 'interface' && enterInterface(swState, swKey(w[1])))
    || (mode === 'config' && swConfigCommand(c, w, line))
    || (mode === 'vlan' && swVlanCommand(c, w, line))
    || (mode === 'ifc' && swInterfaceCommand(c, w, line))
    || leaveMode(c, swState);
  if (!done) print('% Invalid input detected', 'ln-err');
  renderPrompt();
}

// The handlers below return false when they do not know the command (see router.js)

// global configuration
function swConfigCommand(c, w, line) {
  const s = swState;
  if (c === 'hostname' && w[1]) s.host = line.split(/\s+/)[1];
  else if (c === 'vlan' && isNum(w[1])) {
    s.vlanId = Number(w[1]);
    s.vlans[s.vlanId] ||= {name: 'VLAN' + String(s.vlanId).padStart(4, '0')};
    s.mode = 'vlan';
  }
  else if (c === 'line' && isLineCmd(w)) s.mode = 'line';
  else if (c === 'spanning-tree' && pick(w[1], ['mode']) && pick(w[2], ['rapid-pvst'])) s.stp.mode = 'rapid-pvst';
  else if (c === 'spanning-tree' && pick(w[1], ['vlan']) && isNum(w[2]) && pick(w[3], ['priority']) && isNum(w[4])) s.stp.prio[w[2]] = Number(w[4]);
  else if (c === 'spanning-tree' && pick(w[1], ['vlan']) && isNum(w[2]) && pick(w[3], ['root']) && pick(w[4], ['primary'])) s.stp.prio[w[2]] = 24576;
  else if (c === 'port-channel' && pick(w[1], ['load-balance']) && w[2]) s.lb = w[2];
  else return false;
  return true;
}

// VLAN configuration ("name" keeps only the first word, as before)
function swVlanCommand(c, w, line) {
  if (c !== 'name' || !w[1]) return false;
  swState.vlans[swState.vlanId].name = line.split(/\s+/)[1];
  return true;
}

// interface configuration
function swInterfaceCommand(c, w, line) {
  const p = swState.ports[swState.iface];
  if (c === 'switchport') switchport(p, w);
  else if (c === 'description' && w.length > 1) p.desc = line.slice(line.indexOf(' ') + 1);
  else if (c === 'shutdown') p.shut = true;
  else if (c === 'no' && pick(w[1], ['shutdown'])) p.shut = false;
  else if (c === 'spanning-tree' && pick(w[1], ['portfast'])) p.portfast = true;
  else if (c === 'spanning-tree' && pick(w[1], ['bpduguard']) && pick(w[2], ['enable'])) p.bpdu = true;
  else if (c === 'channel-group' && isNum(w[1]) && pick(w[2], ['mode']) && pick(w[3], CHANNEL_MODES)) {
    p.group = Number(w[1]);
    p.chanMode = pick(w[3], CHANNEL_MODES);
  }
  else return false;
  return true;
}

// switchport mode ... | port-security ... | access vlan <n> | trunk allowed vlan <list> | trunk native vlan <n>
// (prints its own error, so a bad switchport line still counts as handled)
function switchport(p, w) {
  if (pick(w[1], ['mode'])) {
    const mode = pick(w[2], ['access', 'trunk', 'dynamic']);
    if (!mode) return print('% Invalid input detected', 'ln-err');
    p.mode = mode;
  } else if (pick(w[1], ['port-security'])) {
    if (!w[2]) p.psec = true;
    else if (pick(w[2], ['maximum']) && isNum(w[3])) Object.assign(p, {psec: true, psMax: Number(w[3])});
    else if (pick(w[2], ['violation']) && pick(w[3], VIOLATION_MODES)) Object.assign(p, {psec: true, psViolation: pick(w[3], VIOLATION_MODES)});
    else if (pick(w[2], ['mac-address']) && pick(w[3], ['sticky'])) Object.assign(p, {psec: true, psSticky: true});
    else print('% Invalid input detected', 'ln-err');
  }
  else if (pick(w[1], ['access']) && pick(w[2], ['vlan']) && isNum(w[3])) p.vlan = Number(w[3]);
  else if (pick(w[1], ['trunk']) && pick(w[2], ['allowed']) && pick(w[3], ['vlan']) && /^[\d,]+$/.test(w[4])) {
    p.allowed = w[4].split(',').map(Number).sort((a, b) => a - b);
  }
  else if (pick(w[1], ['trunk']) && pick(w[2], ['native']) && pick(w[3], ['vlan']) && isNum(w[4])) p.native = Number(w[4]);
  else print('% Invalid input detected', 'ln-err');
}
