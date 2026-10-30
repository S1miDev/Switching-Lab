// Switch: a Catalyst-style switch's configuration, command line, Tab keys and "?" help. A multilayer switch (mls.js) is the same
// device with l3 on. Uses the helpers in ios.js (pick, execCommand ...) and the help engine in help.js.

// The words each mode accepts. Short forms are resolved against these lists.
const SW_CMDS = {
  user: ['enable', 'exit', 'show'],
  priv: ['configure', 'copy', 'disable', 'exit', 'show', 'write'],
  config: ['hostname', 'interface', 'ip', 'no', 'line', 'vlan', 'spanning-tree', 'port-channel', 'exit', 'end', 'show'],
  vlan: ['name', 'exit', 'end'],
  line: ['no', 'exit', 'end', 'show'],
  ifc: ['interface', 'description', 'ip', 'no', 'shutdown', 'switchport', 'channel-group', 'spanning-tree', 'exit', 'end', 'show'],
};

// The full commands Tab completes to, per mode, in the order Tab lists them
const SW_SHOWS = ['show vlan brief', 'show interfaces status', 'show ip interface brief', 'show running-config', 'show startup-config',
  'show etherchannel summary', 'show spanning-tree'];
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

const SWITCH_HELP = {
  user: {head: 'Exec commands:', rows: EXEC_USER},
  priv: {head: 'Exec commands:', rows: [
    H.session, H.clear, H.clock, H.configure, H.connect, H.copy, H.debug, H.del, H.dir, H.disable, H.disconnect, H.enable, H.erase, H.exit,
    H.logout, H.more, ['no', 'Disable debugging informations'], H.ping, H.reload, H.resume, H.setup, H.show, H.ssh, H.telnet, H.terminal,
    H.traceroute, H.undebug, H.vlan, H.write,
  ]},
  config: {head: 'Configure commands:', rows: [
    ['access-list', 'Add an access list entry'],
    ['banner', 'Define a login banner'],
    ['boot', 'Modify system boot parameters'],
    ['cdp', 'Global CDP configuration subcommands'],
    ['clock', 'Configure time-of-day clock'],
    ['do', 'To run exec commands in config mode'],
    ['enable', 'Modify enable password parameters'],
    ['end', 'Exit from configure mode'],
    ['exit', 'Exit from configure mode'],
    ['hostname', "Set system's network name"],
    ['interface', 'Select an interface to configure'],
    ['ip', 'Global IP configuration subcommands'],
    ['line', 'Configure a terminal line'],
    ['logging', 'Modify message logging facilities'],
    ['mac-address-table', 'Configure the MAC address table'],
    H.no,
    ['port-channel', 'EtherChannel configuration'],
    ['privilege', 'Command privilege parameters'],
    ['service', 'Modify use of network based services'],
    ['snmp-server', 'Modify SNMP engine parameters'],
    ['spanning-tree', 'Spanning Tree Subsystem'],
    ['username', 'Establish User Name Authentication'],
    H.vlan,
    ['vtp', 'Configure global VTP state'],
  ]},
  ifc: {head: null, rows: [
    ['cdp', 'CDP interface subcommands'],
    ['channel-group', 'Etherchannel/port bundling configuration'],
    ['channel-protocol', 'Select the channel protocol (LACP, PAgP)'],
    ['description', 'Interface specific description'],
    ['duplex', 'Configure duplex operation.'],
    ['exit', 'Exit from interface configuration mode'],
    ['ip', 'Interface Internet Protocol config commands'],
    ['mac-address', 'Manually set interface MAC address'],
    ['mdix', 'Set Media Dependent Interface with Crossover'],
    ['mls', 'mls interface commands'],
    H.no,
    ['shutdown', 'Shutdown the selected interface'],
    ['spanning-tree', 'Spanning Tree Subsystem'],
    ['speed', 'Configure speed operation.'],
    ['storm-control', 'Storm control command'],
    ['switchport', 'Set switching mode characteristics'],
    ['tx-ring-limit', 'Configure PA level transmit ring limit'],
  ]},
  vlan: {head: 'VLAN configuration commands:', rows: [
    ['exit', 'Apply changes, bump revision number, and exit mode'],
    ['name', 'Ascii name of the VLAN'],
    H.no,
  ]},
  line: LINE,
};

const CHANNEL_MODES = ['active', 'passive', 'on', 'desirable', 'auto'];
const VIOLATION_MODES = ['shutdown', 'restrict', 'protect'];
// a switch port; also used for SVIs (svi) and, on a multilayer switch, routed ports (routed)
const swPort = (name, shut = true) => ({
  name, mode: 'dynamic', vlan: 1, native: 1, allowed: null, shut, desc: null, group: null, chanMode: null,
  portfast: false, bpdu: false, psec: false, psMax: null, psViolation: null, psSticky: false,
  svi: false, routed: false, ip: null, mask: null, helpers: [],
});
// a plain access switch; l3 makes it a multilayer switch (a Catalyst 3560 has the same ports)
function freshSw(host, l3) {
  return {
    mode: 'user', iface: null, host, l3, routing: false, saved: null, vlanId: null, lb: null,
    vlans: {1: {name: 'default'}},
    stp: {mode: 'pvst', prio: {}},
    // Fa0/3 starts up: it is the unused port some labs ask you to shut down
    ports: {'fa0/1': swPort('Fa0/1'), 'fa0/2': swPort('Fa0/2'), 'fa0/3': swPort('Fa0/3', false), 'gi0/1': swPort('Gi0/1')},
  };
}

// Port name -> key in the switch's ports. Accepts Fa0/1, f0/1, fastethernet0/1, Gi0/1, g0/1, gig0/1 ... or 0/1 (read as Gi).
// Vlan10 (or vlan 10, typed as two words) is an SVI, created the first time it is named.
function swKey(st, text) {
  const v = (text || '').match(/^(?:vlan|vl|v)(\d+)$/);
  if (v && Number(v[1]) >= 1 && Number(v[1]) <= 4094) {
    st.ports['vlan' + Number(v[1])] ||= {...swPort('Vlan' + Number(v[1]), false), svi: true};
    return 'vlan' + Number(v[1]);
  }
  const m = (text || '').match(/^(fastethernet|fa|f|gigabitethernet|gigabit|gig|gi|g)?(\d+\/\d+)$/);
  if (!m) return null;
  const key = (m[1]?.startsWith('f') ? 'fa' : 'gi') + m[2];
  return st.ports[key] ? key : null;
}

function swConfigLines(s) {
  const lines = [`hostname ${s.host}`];
  if (s.routing) lines.push('ip routing');
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
    if (p.routed) lines.push(' no switchport');
    if (p.ip) lines.push(` ip address ${p.ip} ${p.mask}`);
    for (const h of p.helpers) lines.push(` ip helper-address ${h}`);
    lines.push(p.shut ? ' shutdown' : ' no shutdown', '!');
  }
  return lines;
}

function swSave(s, out) {
  s.saved = swConfigLines(s);
  out('Building configuration...');
  out('[OK]', 'ln-ok');
}

// ---- show commands ----

function swVlanBrief(s, out) {
  out('VLAN Name                 Status    Ports');
  out('---- -------------------- --------- ----------');
  for (const [id, vlan] of Object.entries(s.vlans)) {
    const ports = Object.values(s.ports).filter(p => p.mode === 'access' && p.vlan === Number(id)).map(p => p.name).join(', ');
    out(id.padEnd(4) + ' ' + vlan.name.padEnd(20) + ' ' + 'active'.padEnd(9) + ' ' + ports);
  }
}

function swStatus(s, out) {
  out('Port      Status');
  for (const p of Object.values(s.ports)) out(p.name.padEnd(10) + (p.shut ? 'administratively down' : 'up'));
}

function swEtherSummary(s, out) {
  const groups = {};
  for (const p of Object.values(s.ports)) if (p.group !== null) (groups[p.group] ||= []).push(p);
  if (!Object.keys(groups).length) return out('No aggregators configured');
  out('Group  Port-channel  Ports');
  for (const [g, ports] of Object.entries(groups)) out(`${g.padEnd(7)}Po${g.padEnd(12)}${ports.map(p => `${p.name}(${p.chanMode})`).join(' ')}`);
}

// The switch is root for a VLAN when its priority is 24576 or lower (the "root primary" value)
function swStp(s, out) {
  out(`Spanning tree mode: ${s.stp.mode}`);
  for (const id of Object.keys(s.vlans)) {
    const prio = s.stp.prio[id] ?? 32768;
    out(`VLAN${id.padStart(4, '0')}  priority ${prio}  ${prio <= 24576 ? 'this switch is root' : 'another switch is root'}`);
  }
}

function swBriefV4(s, out) {
  out('Interface    IP-Address       Status');
  for (const p of Object.values(s.ports)) out(p.name.padEnd(13) + (p.ip || 'unassigned').padEnd(17) + (p.shut ? 'administratively down' : 'up'));
}

// the order matters: "show s" means spanning-tree
function swShow(s, args, out) {
  if (pick(args[0], ['ip']) && pick(args[1], ['interface']) && pick(args[2], ['brief'])) return swBriefV4(s, out);
  if (pick(args[0], ['vlan']) && pick(args[1], ['brief'])) return swVlanBrief(s, out);
  if (pick(args[0], ['interfaces']) && pick(args[1], ['status'])) return swStatus(s, out);
  if (pick(args[0], ['running-config']) && args.length === 1) return swConfigLines(s).forEach(l => out(l));
  if (pick(args[0], ['etherchannel']) && pick(args[1], ['summary'])) return swEtherSummary(s, out);
  if (pick(args[0], ['spanning-tree'])) return swStp(s, out);
  if (pick(args[0], ['startup-config']) && args.length === 1) {
    return s.saved ? s.saved.forEach(l => out(l)) : out('startup-config is not present', 'ln-err');
  }
  out('% Invalid input detected', 'ln-err');
}

// ---- the command line ----

function runSw(s, line, out) {
  const w = line.toLowerCase().split(/\s+/);
  const mode = s.mode;
  const c = mode === 'ifc' && w[0] === 'sh' ? 'shutdown' : pick(w[0], SW_CMDS[mode]); // "sh" means shutdown in interface mode
  if (c === 'show') return swShow(s, w.slice(1), out);
  const done = execCommand(c, w, s, () => swSave(s, out))
    || (c === 'interface' && enterInterface(s, swKey(s, w.slice(1).join(''))))
    || (mode === 'config' && swConfigCommand(s, c, w, line))
    || (mode === 'vlan' && swVlanCommand(s, c, w, line))
    || (mode === 'ifc' && swInterfaceCommand(s, c, w, line, out))
    || leaveMode(c, s);
  if (!done) out('% Invalid input detected', 'ln-err');
}

// The handlers below return false when they do not know the command (see router.js)

// global configuration
function swConfigCommand(s, c, w, line) {
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
  else if (c === 'ip' && s.l3 && pick(w[1], ['routing']) && w.length === 2) s.routing = true;
  else if (c === 'no' && s.l3 && pick(w[1], ['ip']) && pick(w[2], ['routing']) && w.length === 3) s.routing = false;
  else return false;
  return true;
}

// VLAN configuration ("name" keeps only the first word, as before)
function swVlanCommand(s, c, w, line) {
  if (c !== 'name' || !w[1]) return false;
  s.vlans[s.vlanId].name = line.split(/\s+/)[1];
  return true;
}

// interface configuration
function swInterfaceCommand(s, c, w, line, out) {
  const p = s.ports[s.iface];
  const l3Port = p.svi || p.routed; // only these take an IP address
  if (c === 'switchport' && w.length === 1 && s.l3 && !p.svi) Object.assign(p, {routed: false, ip: null, mask: null, helpers: []});
  else if (c === 'switchport' && !p.svi) switchport(p, w, out);
  else if (c === 'no' && pick(w[1], ['switchport']) && w.length === 2 && s.l3 && !p.svi) p.routed = true;
  else if (c === 'ip' && pick(w[1], ['address', 'helper-address']) && !l3Port) out('% IP addresses may not be configured on L2 links.', 'ln-err');
  else if (c === 'ip' && pick(w[1], ['address']) && w.length === 4 && DOTTED.test(w[2]) && DOTTED.test(w[3])) Object.assign(p, {ip: w[2], mask: w[3]});
  else if (c === 'ip' && pick(w[1], ['helper-address']) && w.length === 3 && DOTTED.test(w[2])) p.helpers.push(w[2]);
  else if (c === 'no' && pick(w[1], ['ip']) && pick(w[2], ['address'])) Object.assign(p, {ip: null, mask: null});
  else if (c === 'no' && pick(w[1], ['ip']) && pick(w[2], ['helper-address'])) p.helpers = [];
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
function switchport(p, w, out) {
  if (pick(w[1], ['mode'])) {
    const mode = pick(w[2], ['access', 'trunk', 'dynamic']);
    if (!mode) return out('% Invalid input detected', 'ln-err');
    p.mode = mode;
  } else if (pick(w[1], ['port-security'])) {
    if (!w[2]) p.psec = true;
    else if (pick(w[2], ['maximum']) && isNum(w[3])) Object.assign(p, {psec: true, psMax: Number(w[3])});
    else if (pick(w[2], ['violation']) && pick(w[3], VIOLATION_MODES)) Object.assign(p, {psec: true, psViolation: pick(w[3], VIOLATION_MODES)});
    else if (pick(w[2], ['mac-address']) && pick(w[3], ['sticky'])) Object.assign(p, {psec: true, psSticky: true});
    else out('% Invalid input detected', 'ln-err');
  }
  else if (pick(w[1], ['access']) && pick(w[2], ['vlan']) && isNum(w[3])) p.vlan = Number(w[3]);
  else if (pick(w[1], ['trunk']) && pick(w[2], ['allowed']) && pick(w[3], ['vlan']) && /^[\d,]+$/.test(w[4])) {
    p.allowed = w[4].split(',').map(Number).sort((a, b) => a - b);
  }
  else if (pick(w[1], ['trunk']) && pick(w[2], ['native']) && pick(w[3], ['vlan']) && isNum(w[4])) p.native = Number(w[4]);
  else out('% Invalid input detected', 'ln-err');
}

// A switch in the lab: the node's id is its hostname. l3 makes it a multilayer switch; keys are its Tab commands.
function createSwitch(node, session, {l3 = false, keys = SW_KEYS} = {}) {
  const st = freshSw(node.id, l3);
  const self = defineDevice({
    name: node.id, type: node.type, configurable: true, discoverable: true, state: st,
    prompt: () => st.host + SUFFIX[st.mode],
    ports: () => Object.values(st.ports),
    routes: () => st.routing,
    // The interface a host on port key uses as its gateway: the VLAN's SVI on a multilayer switch, otherwise the router's
    // subinterface for the VLAN, over the Gi0/1 trunk to a cabled router (router-on-a-stick).
    // shortcut: the uplink is Gi0/1 in every lab; read it from the links when a lab cables the switch to a router elsewhere
    gateway(key) {
      const p = st.ports[key];
      if (p.shut || p.mode === 'trunk' || p.routed) return null;
      if (st.l3) return usable(st.ports['vlan' + p.vlan]);
      const up = st.ports['gi0/1'];
      if (up.mode !== 'trunk' || up.shut || (up.allowed && !up.allowed.includes(p.vlan))) return null;
      for (const [peer, l] of peersOf(session, node.id)) {
        const g = peer.vlanGateway?.(l.port.toLowerCase(), p.vlan);
        if (g) return g;
      }
      return null;
    },
    run(line, out) {
      if (line === '?' || line === 'help') return self.help('?', out);
      runSw(st, line, out);
    },
    complete: line => tabComplete(line, keys[st.mode], st.mode === 'config' || st.mode === 'ifc' ? self.ports().map(p => p.name) : null),
    help: (line, out) => helpFor(line, SWITCH_HELP[st.mode], st.mode, 's', out),
  });
  return self;
}
DEVICE_TYPES.switch = createSwitch;
