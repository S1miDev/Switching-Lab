// Lab definitions: every topic and level, with everything the lab shows and grades. Every level ends up with
// build(x) -> {reqs, solution, steps, nodes, links, home, height?} for the random network 192.168.x.0 (see the end of this file).
//
// A requirement is {text, ok, hint}: ok(s) is true when it is met (s is the lab session), reading the devices' configuration
// by name through s.config(name) (the fields are listed in devices/device.js). hint is {cmds, port, dev}: the commands
// that meet it, typed on interface port (if any) of device dev (if not the lab's first device).
// A solution is [[device, lines], ...], typed in order.
//
// LABS[topic].kind says how its levels are set up:
//   'v4', 'v6'  addressing on R1; requirements, solution and diagram come from each level's interface list (ifs)
//   'sw', 'mls' the R1-S1 or the MLS1 diagram; each level lists its requirements (reqs), and cmds is a known-good config
//   'rt'        the R1-R2-R3 diagram; reqs(x) and cmds(x) are the requirements and a known-good config for network x
//   'sw2'       the S1-S2 diagram (trunk troubleshooting); 'hsrp' the R1 and R2 on S1 diagram. Like 'rt', reqs and cmds may take x.
// A level may also have setup [[device, lines], ...]: a preset (often broken) config typed in global configuration on every reset.
// cmds are typed in global configuration on the home device; then lists [device, lines] for the other devices.
// A scenario text (lead) sits on the topic or on the level; a function gets x.
// shortcut: fixed values per level on a random network; move labs to data files when the lab library grows

const portName = key => key.replace('fa', 'Fa').replace('gi', 'Gi'); // 'fa0/1' -> 'Fa0/1'
const MASK24 = '255.255.255.0';
const R1 = s => s.config('R1');
const SW = s => s.config('S1') || s.config('MLS1'); // the lab's switch

// PCs, configured from their own console (devices/pc.js)
const pcStatic = (pc, ip, gw) => ({
  text: `${pc} is ${ip} ${MASK24} with gateway ${gw}`,
  ok: s => !!s.config(pc) && s.config(pc).ip === ip && s.config(pc).mask === MASK24 && s.config(pc).gw === gw,
  hint: {cmds: [`ip ${ip} ${MASK24} ${gw}`], dev: pc},
});
const pcLease = (pc, net) => ({
  text: `${pc} gets an address in ${net}.0/24 by DHCP`,
  ok: s => !!s.config(pc) && s.config(pc).dhcp && s.config(pc).ip.startsWith(net + '.'),
  hint: {cmds: ['dhcp'], dev: pc},
});
const pcPings = (pc, other) => ({
  text: `${pc} can ping ${other}`,
  ok: s => !!s.config(other) && !!s.config(other).ip && s.devices[pc].canReach(s.config(other).ip),
  hint: {cmds: [`ping <${other}'s address>`], dev: pc},
});

// ---- 1.0 network fundamentals: addressing ----
// ifs lists R1's interfaces: k = interface, host = last octet of its address, net = its subnet inside the /24,
// lan = its name, rule = first or last usable address, need = how many hosts it must fit (VLSM)

const IPV4 = {
  beginner: {sub: 'Address one LAN on R1 and bring the interface up', ifs: [
    {k: 'gi0/0', host: 1, mask: '255.255.255.128', net: '0/25', lan: 'LAN 1', rule: 'first'},
  ]},
  intermediate: {sub: 'Address two LANs on R1 using first usable addresses', ifs: [
    {k: 'gi0/0', host: 1, mask: '255.255.255.128', net: '0/25', lan: 'LAN 1', rule: 'first'},
    {k: 'gi0/1', host: 129, mask: '255.255.255.192', net: '128/26', lan: 'LAN 2', rule: 'first'},
  ]},
  advanced: {sub: 'Address two LANs on R1 using last usable addresses', ifs: [
    {k: 'gi0/0', host: 126, mask: '255.255.255.128', net: '0/25', lan: 'LAN 1', rule: 'last'},
    {k: 'gi0/1', host: 190, mask: '255.255.255.192', net: '128/26', lan: 'LAN 2', rule: 'last'},
  ]},
  expert: {sub: 'Address three LANs on R1 using last usable addresses', ifs: [
    {k: 'gi0/0', host: 62, mask: '255.255.255.192', net: '0/26', lan: 'LAN 1', rule: 'last'},
    {k: 'gi0/1', host: 94, mask: '255.255.255.224', net: '64/27', lan: 'LAN 2', rule: 'last'},
    {k: 'gi0/2', host: 126, mask: '255.255.255.224', net: '96/27', lan: 'LAN 3', rule: 'last'},
  ]},
};

const SUBNET = {
  beginner: {sub: 'Split the /24 into two equal blocks and address R1 in each', ifs: [
    {k: 'gi0/0', host: 1, mask: '255.255.255.128', net: '0/25', lan: 'block 1', rule: 'first'},
    {k: 'gi0/1', host: 129, mask: '255.255.255.128', net: '128/25', lan: 'block 2', rule: 'first'},
  ]},
  intermediate: {sub: 'Use three equal blocks from the /24 and address R1 in each', ifs: [
    {k: 'gi0/0', host: 1, mask: '255.255.255.192', net: '0/26', lan: 'block 1', rule: 'first'},
    {k: 'gi0/1', host: 65, mask: '255.255.255.192', net: '64/26', lan: 'block 2', rule: 'first'},
    {k: 'gi0/2', host: 129, mask: '255.255.255.192', net: '128/26', lan: 'block 3', rule: 'first'},
  ]},
  advanced: {sub: 'Split the /24 into eight equal blocks and address R1 in blocks 1 to 4', ifs: [
    {k: 'gi0/0', host: 1, mask: '255.255.255.224', net: '0/27', lan: 'block 1', rule: 'first'},
    {k: 'gi0/1', host: 33, mask: '255.255.255.224', net: '32/27', lan: 'block 2', rule: 'first'},
    {k: 'gi0/2', host: 65, mask: '255.255.255.224', net: '64/27', lan: 'block 3', rule: 'first'},
    {k: 'gi0/3', host: 97, mask: '255.255.255.224', net: '96/27', lan: 'block 4', rule: 'first'},
  ]},
  expert: {sub: 'Split the /24 into eight equal blocks and address R1 in blocks 5 to 8, using last usable addresses', ifs: [
    {k: 'gi0/0', host: 158, mask: '255.255.255.224', net: '128/27', lan: 'block 5', rule: 'last'},
    {k: 'gi0/1', host: 190, mask: '255.255.255.224', net: '160/27', lan: 'block 6', rule: 'last'},
    {k: 'gi0/2', host: 222, mask: '255.255.255.224', net: '192/27', lan: 'block 7', rule: 'last'},
    {k: 'gi0/3', host: 254, mask: '255.255.255.224', net: '224/27', lan: 'block 8', rule: 'last'},
  ]},
};

const VLSM = {
  beginner: {sub: 'Address two LANs that need 50 and 20 hosts, using first usable addresses', ifs: [
    {k: 'gi0/0', host: 1, mask: '255.255.255.192', net: '0/26', lan: 'LAN A', need: 50, rule: 'first'},
    {k: 'gi0/1', host: 65, mask: '255.255.255.224', net: '64/27', lan: 'LAN B', need: 20, rule: 'first'},
  ]},
  intermediate: {sub: 'Address three LANs that need 50, 20 and 10 hosts, using first usable addresses', ifs: [
    {k: 'gi0/0', host: 1, mask: '255.255.255.192', net: '0/26', lan: 'LAN A', need: 50, rule: 'first'},
    {k: 'gi0/1', host: 65, mask: '255.255.255.224', net: '64/27', lan: 'LAN B', need: 20, rule: 'first'},
    {k: 'gi0/2', host: 97, mask: '255.255.255.240', net: '96/28', lan: 'LAN C', need: 10, rule: 'first'},
  ]},
  advanced: {sub: 'Address four LANs that need 50, 20, 10 and 5 hosts, using first usable addresses', ifs: [
    {k: 'gi0/0', host: 1, mask: '255.255.255.192', net: '0/26', lan: 'LAN A', need: 50, rule: 'first'},
    {k: 'gi0/1', host: 65, mask: '255.255.255.224', net: '64/27', lan: 'LAN B', need: 20, rule: 'first'},
    {k: 'gi0/2', host: 97, mask: '255.255.255.240', net: '96/28', lan: 'LAN C', need: 10, rule: 'first'},
    {k: 'gi0/3', host: 113, mask: '255.255.255.248', net: '112/29', lan: 'LAN D', need: 5, rule: 'first'},
  ]},
  expert: {sub: 'The same four LANs (50, 20, 10 and 5 hosts), using last usable addresses', ifs: [
    {k: 'gi0/0', host: 62, mask: '255.255.255.192', net: '0/26', lan: 'LAN A', need: 50, rule: 'last'},
    {k: 'gi0/1', host: 94, mask: '255.255.255.224', net: '64/27', lan: 'LAN B', need: 20, rule: 'last'},
    {k: 'gi0/2', host: 110, mask: '255.255.255.240', net: '96/28', lan: 'LAN C', need: 10, rule: 'last'},
    {k: 'gi0/3', host: 118, mask: '255.255.255.248', net: '112/29', lan: 'LAN D', need: 5, rule: 'last'},
  ]},
};

// sub = the subnet number inside the /48, ll = also needs the link-local address fe80::1
const IPV6 = {
  beginner: {sub: 'Give Gi0/0 a global IPv6 address in subnet 1 and bring it up', ifs: [{k: 'gi0/0', sub: 1}]},
  intermediate: {sub: 'Address two IPv6 subnets, one on Gi0/0 and one on Gi0/1', ifs: [{k: 'gi0/0', sub: 1}, {k: 'gi0/1', sub: 2}]},
  advanced: {sub: 'Address three IPv6 subnets, and give Gi0/0 the link-local address fe80::1', ifs: [
    {k: 'gi0/0', sub: 1, ll: true}, {k: 'gi0/1', sub: 2}, {k: 'gi0/2', sub: 3},
  ]},
  expert: {sub: 'Address four IPv6 subnets, with link-local address fe80::1 on every interface', ifs: [
    {k: 'gi0/0', sub: 1, ll: true}, {k: 'gi0/1', sub: 2, ll: true}, {k: 'gi0/2', sub: 3, ll: true}, {k: 'gi0/3', sub: 4, ll: true},
  ]},
};

// CDP and LLDP run on R1.
const LLDP_ON = {text: 'LLDP is enabled globally', ok: s => R1(s).lldp, hint: {cmds: ['lldp run']}};
const CDP_OFF = {text: 'CDP is disabled globally', ok: s => !R1(s).cdp, hint: {cmds: ['no cdp run']}};
const learnsS1 = hint => ({text: 'R1 learns S1 over LLDP on Gi0/0', ok: s => R1(s).lldp && !R1(s).ifs['gi0/0'].shut, hint});
const GI00_UP = {cmds: ['no shutdown'], port: 'Gi0/0'};
const CDP_LEAD = 'R1 is connected to S1 on Gi0/0. CDP is running.';
const CDP = {
  beginner: {
    sub: 'Turn LLDP on and make R1 learn S1 over LLDP',
    lead: 'R1 is connected to S1 on Gi0/0. Discovery is set up as on a fresh device.',
    steps: ['Turn LLDP on for the whole device.', 'Bring up Gi0/0 so the link is active.'],
    cmds: ['lldp run', 'int gi0/0', 'no shutdown', 'exit'],
    reqs: [LLDP_ON, learnsS1({cmds: ['lldp run', 'interface Gi0/0', 'no shutdown']})],
  },
  intermediate: {
    sub: 'Turn CDP off, run LLDP, and make R1 learn S1 over LLDP',
    lead: CDP_LEAD,
    steps: ['Turn CDP off for the whole device.', 'Turn LLDP on and bring up Gi0/0.'],
    cmds: ['no cdp run', 'lldp run', 'int gi0/0', 'no shutdown', 'exit'],
    reqs: [CDP_OFF, LLDP_ON, learnsS1(GI00_UP)],
  },
  advanced: {
    sub: 'Keep CDP and LLDP on, but turn CDP off on Gi0/0 and bring it up',
    lead: CDP_LEAD,
    steps: ['Keep CDP and LLDP running for the whole device.', 'Turn CDP off on Gi0/0 only.'],
    cmds: ['lldp run', 'int gi0/0', 'no cdp enable', 'no shutdown', 'exit'],
    reqs: [
      {text: 'CDP is enabled globally', ok: s => R1(s).cdp, hint: {cmds: ['cdp run']}},
      LLDP_ON,
      {text: 'Gi0/0 has CDP disabled', ok: s => R1(s).ifs['gi0/0'].cdp === false, hint: {cmds: ['no cdp enable'], port: 'Gi0/0'}},
      learnsS1(GI00_UP),
    ],
  },
  expert: {
    sub: 'Turn CDP off everywhere, keep LLDP running, and bring up Gi0/0 and Gi0/1',
    lead: CDP_LEAD,
    steps: ['Turn CDP off for the whole device.', 'Keep LLDP running and bring up both interfaces.'],
    cmds: ['no cdp run', 'lldp run', 'int gi0/0', 'no shutdown', 'exit', 'int gi0/1', 'no shutdown', 'exit'],
    reqs: [CDP_OFF, LLDP_ON, learnsS1(GI00_UP), {text: 'Gi0/1 is up', ok: s => !R1(s).ifs['gi0/1'].shut, hint: {cmds: ['no shutdown'], port: 'Gi0/1'}}],
  },
};

// ---- 2.0 network access: switch labs ----

// the R1-S1 diagram used by the switch and CDP labs; home is the device whose console opens first
const SW_TOPO = {
  nodes: [
    {id: 'R1', type: 'router', x: 8, y: 64, sub: 'Router'},
    {id: 'S1', type: 'switch', x: 190, y: 64, sub: 'Switch'},
    {id: 'PC1', type: 'pc', x: 370, y: 24, sub: 'Host', at: 'S1 fa0/1'},
    {id: 'PC2', type: 'pc', x: 370, y: 104, sub: 'Host', at: 'S1 fa0/2'},
  ],
  links: [{a: 'R1', b: 'S1', port: 'Gi0/0'}, {a: 'S1', b: 'PC1', port: 'Fa0/1'}, {a: 'S1', b: 'PC2', port: 'Fa0/2'}],
  home: 'R1',
};
const SW_LEAD = 'R1 Gi0/0 is cabled to S1 Gi0/1. PC1 is on Fa0/1 and PC2 on Fa0/2.';

const swVlan = (id, name) => ({
  text: `VLAN ${id}${name ? ` is named ${name}` : ' exists'}`,
  ok: s => !!SW(s).vlans[id] && (!name || SW(s).vlans[id].name === name),
  hint: {cmds: name ? [`vlan ${id}`, `name ${name}`] : [`vlan ${id}`]},
});
// a switch port requirement: the text after the port name, the check on the port, and the commands on that port
const swReq = (p, text, ok, ...cmds) => ({text: `${portName(p)} ${text}`, ok: s => ok(SW(s).ports[p]), hint: {cmds, port: portName(p)}});
const swAccess = (p, id) => swReq(p, `is an access port in VLAN ${id}`, q => q.mode === 'access' && q.vlan === id,
  'switchport mode access', `switchport access vlan ${id}`);
const swMode = p => swReq(p, 'is an access port', q => q.mode === 'access', 'switchport mode access');
const swUp = p => swReq(p, 'is up', q => !q.shut, 'no shutdown');
const swDown = p => swReq(p, 'is shut down', q => q.shut, 'shutdown');
const swDesc = (p, d) => swReq(p, `has the description ${d}`, q => q.desc === d, `description ${d}`);
const swTrunk = p => swReq(p, 'is a trunk', q => q.mode === 'trunk', 'switchport mode trunk');
const swAllowed = (p, list) => swReq(p, `allows only VLANs ${list.join(', ')} on the trunk`,
  q => !!q.allowed && q.allowed.join(',') === list.join(','), `switchport trunk allowed vlan ${list.join(',')}`);
const swNative = (p, id) => swReq(p, `uses VLAN ${id} as the native VLAN`, q => q.native === id, `switchport trunk native vlan ${id}`);
const r1Up = {text: 'R1 Gi0/0 is up', ok: s => !R1(s).ifs['gi0/0'].shut, hint: {cmds: ['no shutdown'], port: 'Gi0/0', dev: 'R1'}};

const TRUNK_UP = [swTrunk('gi0/1'), swUp('gi0/1'), r1Up];
const PCS_IN_10_20 = [swAccess('fa0/1', 10), swAccess('fa0/2', 20), swUp('fa0/1'), swUp('fa0/2')];
const NATIVE_99 = [swVlan(99), swNative('gi0/1', 99), swAllowed('gi0/1', [10, 20, 99])];

const VLANS = {
  beginner: {
    sub: 'Create VLAN 10 and put Fa0/1 in it',
    steps: ['Create VLAN 10 on S1.', 'Make Fa0/1 an access port in VLAN 10.', 'Bring Fa0/1 up.'],
    reqs: [swVlan(10), swAccess('fa0/1', 10), swUp('fa0/1')],
  },
  intermediate: {
    sub: 'Create VLANs 10 and 20, and put Fa0/1 and Fa0/2 in them',
    steps: ['Create VLANs 10 and 20 on S1.', 'Put Fa0/1 in VLAN 10 and Fa0/2 in VLAN 20.', 'Bring both ports up.'],
    reqs: [swVlan(10), swVlan(20), ...PCS_IN_10_20],
  },
  advanced: {
    sub: 'Create named VLANs Sales (10) and Staff (20), and put Fa0/1 and Fa0/2 in them',
    steps: ['Create VLAN 10 named Sales and VLAN 20 named Staff.', 'Put Fa0/1 in VLAN 10 and Fa0/2 in VLAN 20.', 'Bring both ports up.'],
    reqs: [swVlan(10, 'Sales'), swVlan(20, 'Staff'), ...PCS_IN_10_20],
  },
  expert: {
    sub: 'Add a Parking VLAN 999 for the unused Fa0/3 and shut Fa0/3 down',
    steps: ['Create VLAN 999 named Parking.', 'Put Fa0/3 in VLAN 999 and shut it down.', 'Keep Fa0/1 and Fa0/2 working in their VLANs.'],
    reqs: [swVlan(10, 'Sales'), swVlan(20, 'Staff'), swVlan(999, 'Parking'), ...PCS_IN_10_20, swAccess('fa0/3', 999), swDown('fa0/3')],
  },
};

const ACCESS = {
  beginner: {
    sub: 'Make Fa0/1 an access port and bring it up',
    steps: ['Set Fa0/1 to access mode.', 'Bring Fa0/1 up.'],
    reqs: [swMode('fa0/1'), swUp('fa0/1')],
  },
  intermediate: {
    sub: 'Make Fa0/1 and Fa0/2 access ports and bring both up',
    steps: ['Set Fa0/1 and Fa0/2 to access mode.', 'Bring both ports up.'],
    reqs: [swMode('fa0/1'), swMode('fa0/2'), swUp('fa0/1'), swUp('fa0/2')],
  },
  advanced: {
    sub: 'Make Fa0/1 and Fa0/2 access ports, and shut down the unused Fa0/3',
    steps: ['Set Fa0/1 and Fa0/2 to access mode.', 'Bring Fa0/1 and Fa0/2 up.', 'Shut down the unused Fa0/3.'],
    reqs: [swMode('fa0/1'), swMode('fa0/2'), swUp('fa0/1'), swUp('fa0/2'), swDown('fa0/3')],
  },
  expert: {
    sub: 'As Advanced, and give each PC port a description',
    steps: ['Set Fa0/1 and Fa0/2 to access mode and bring them up.', 'Shut down the unused Fa0/3.', 'Describe Fa0/1 as PC1 and Fa0/2 as PC2.'],
    reqs: [swMode('fa0/1'), swMode('fa0/2'), swUp('fa0/1'), swUp('fa0/2'), swDown('fa0/3'), swDesc('fa0/1', 'PC1'), swDesc('fa0/2', 'PC2')],
  },
};

const TRUNK = {
  beginner: {
    sub: 'Make Gi0/1 on S1 a trunk to R1 and bring both sides up',
    steps: ['Set Gi0/1 on S1 to trunk mode.', 'Bring Gi0/1 on S1 up.', 'Bring R1 Gi0/0 up.'],
    reqs: TRUNK_UP,
  },
  intermediate: {
    sub: 'Allow only VLANs 10 and 20 on the trunk',
    steps: ['Keep the trunk up on both sides.', 'Allow only VLANs 10 and 20 on the trunk.'],
    reqs: [...TRUNK_UP, swAllowed('gi0/1', [10, 20])],
  },
  advanced: {
    sub: 'Set the native VLAN to 99 and allow VLANs 10, 20 and 99 on the trunk',
    steps: ['Create VLAN 99.', 'Set VLAN 99 as the native VLAN.', 'Allow VLANs 10, 20 and 99 on the trunk.'],
    reqs: [...TRUNK_UP, ...NATIVE_99],
  },
  expert: {
    sub: 'As Advanced, and make Fa0/1 and Fa0/2 access ports on VLANs 10 and 20',
    steps: ['Finish the trunk as in Advanced.', 'Make Fa0/1 an access port in VLAN 10 and Fa0/2 in VLAN 20.', 'Bring Fa0/1 and Fa0/2 up.'],
    reqs: [...TRUNK_UP, ...NATIVE_99, ...PCS_IN_10_20],
  },
};

// STP, EtherChannel, inter-VLAN routing
const swRoot = id => ({
  text: `S1 is root for VLAN ${id}`,
  ok: s => SW(s).stp.prio[id] !== undefined && SW(s).stp.prio[id] <= 24576,
  hint: {cmds: [`spanning-tree vlan ${id} root primary`]},
});
const swPrio = (id, n) => ({text: `VLAN ${id} has spanning-tree priority ${n}`, ok: s => SW(s).stp.prio[id] === n, hint: {cmds: [`spanning-tree vlan ${id} priority ${n}`]}});
const swRstp = {text: 'S1 runs Rapid PVST+', ok: s => SW(s).stp.mode === 'rapid-pvst', hint: {cmds: ['spanning-tree mode rapid-pvst']}};
const swPortfast = p => swReq(p, 'has PortFast enabled', q => q.portfast === true, 'spanning-tree portfast');
const swBpdu = p => swReq(p, 'has BPDU guard enabled', q => q.bpdu === true, 'spanning-tree bpduguard enable');
const swGroup = (p, n, mode) => swReq(p, `is in channel-group ${n} with mode ${mode}`, q => q.group === n && q.chanMode === mode, `channel-group ${n} mode ${mode}`);
const swLb = v => ({text: `EtherChannel load balancing is ${v}`, ok: s => SW(s).lb === v, hint: {cmds: [`port-channel load-balance ${v}`]}});
// R1 subinterface Gi0/0.<vlan> with 192.168.<vlan>.1/24 (router-on-a-stick)
const r1Sub = vlan => {
  const key = `gi0/0.${vlan}`, name = `Gi0/0.${vlan}`, ip = `192.168.${vlan}.1`, mask = '255.255.255.0';
  const sub = (text, ok, cmd) => ({text: `${name} ${text}`, ok: s => !!R1(s).ifs[key] && ok(R1(s).ifs[key]), hint: {cmds: [cmd], port: name, dev: 'R1'}});
  return [
    sub(`is encapsulation dot1Q ${vlan}`, i => i.encap === vlan, `encapsulation dot1Q ${vlan}`),
    sub(`has the address ${ip} ${mask}`, i => i.ip === ip && i.mask === mask, `ip address ${ip} ${mask}`),
    sub('is up', i => !i.shut, 'no shutdown'),
  ];
};
const INTER_LEAD = 'R1 Gi0/0 is cabled to S1 Gi0/1 as a trunk. PC1 is on Fa0/1 and PC2 on Fa0/2.';
const LACP = [swGroup('fa0/1', 1, 'active'), swGroup('fa0/2', 1, 'active')];

const STP = {
  beginner: {
    sub: 'Make S1 the root bridge for VLAN 10',
    steps: ['Make S1 the root for VLAN 10 with spanning-tree vlan 10 root primary.'],
    reqs: [swRoot(10)],
  },
  intermediate: {
    sub: 'Make S1 the root bridge for VLANs 10 and 20',
    steps: ['Make S1 the root for VLAN 10.', 'Make S1 the root for VLAN 20.'],
    reqs: [swRoot(10), swRoot(20)],
  },
  advanced: {
    sub: 'Run Rapid PVST+ and make S1 the root for VLANs 10 and 20',
    steps: ['Set the spanning-tree mode to rapid-pvst.', 'Make S1 the root for VLANs 10 and 20.'],
    reqs: [swRstp, swRoot(10), swRoot(20)],
  },
  expert: {
    sub: 'As Advanced, and give VLAN 30 a backup priority of 28672',
    steps: ['Keep Rapid PVST+ and S1 root for VLANs 10 and 20.', 'Set VLAN 30 to priority 28672.'],
    reqs: [swRstp, swRoot(10), swRoot(20), swPrio(30, 28672)],
  },
};

const ADVSTP = {
  beginner: {
    sub: 'Run Rapid PVST+ on S1',
    steps: ['Set the spanning-tree mode to rapid-pvst.'],
    reqs: [swRstp],
  },
  intermediate: {
    sub: 'Run Rapid PVST+ and enable PortFast on Fa0/1 and Fa0/2',
    steps: ['Set the spanning-tree mode to rapid-pvst.', 'Enable PortFast on Fa0/1 and Fa0/2.'],
    reqs: [swRstp, swPortfast('fa0/1'), swPortfast('fa0/2')],
  },
  advanced: {
    sub: 'As Intermediate, and enable BPDU guard on Fa0/1 and Fa0/2',
    steps: ['Keep Rapid PVST+ and PortFast on Fa0/1 and Fa0/2.', 'Enable BPDU guard on Fa0/1 and Fa0/2.'],
    reqs: [swRstp, swPortfast('fa0/1'), swPortfast('fa0/2'), swBpdu('fa0/1'), swBpdu('fa0/2')],
  },
  expert: {
    sub: 'As Advanced, and also protect the unused Fa0/3 with PortFast and BPDU guard',
    steps: ['Keep the Advanced settings on Fa0/1 and Fa0/2.', 'Enable PortFast and BPDU guard on Fa0/3.'],
    reqs: [swRstp, swPortfast('fa0/1'), swPortfast('fa0/2'), swBpdu('fa0/1'), swBpdu('fa0/2'), swPortfast('fa0/3'), swBpdu('fa0/3')],
  },
};

const ETHERCHANNEL = {
  beginner: {
    sub: 'Bundle Fa0/1 and Fa0/2 into channel-group 1 with mode on',
    steps: ['Use channel-group 1 mode on on Fa0/1 and Fa0/2.'],
    reqs: [swGroup('fa0/1', 1, 'on'), swGroup('fa0/2', 1, 'on')],
  },
  intermediate: {
    sub: 'Bundle Fa0/1 and Fa0/2 into channel-group 1 with mode on, and bring both up',
    steps: ['Use channel-group 1 mode on on Fa0/1 and Fa0/2.', 'Bring both ports up.'],
    reqs: [swGroup('fa0/1', 1, 'on'), swGroup('fa0/2', 1, 'on'), swUp('fa0/1'), swUp('fa0/2')],
  },
  advanced: {
    sub: 'Use LACP (mode active) for channel-group 1 on Fa0/1 and Fa0/2, and bring both up',
    steps: ['Use channel-group 1 mode active on Fa0/1 and Fa0/2.', 'Bring both ports up.'],
    reqs: [...LACP, swUp('fa0/1'), swUp('fa0/2')],
  },
  expert: {
    sub: 'As Advanced, and make both channel ports trunks',
    steps: ['Keep the LACP channel on Fa0/1 and Fa0/2.', 'Make Fa0/1 and Fa0/2 trunks.'],
    reqs: [...LACP, swUp('fa0/1'), swUp('fa0/2'), swTrunk('fa0/1'), swTrunk('fa0/2')],
  },
};

const ADVETHER = {
  beginner: {
    sub: 'Use LACP (mode active) for channel-group 1 on Fa0/1 and Fa0/2',
    steps: ['Use channel-group 1 mode active on Fa0/1 and Fa0/2.'],
    reqs: LACP,
  },
  intermediate: {
    sub: 'As Beginner, and balance traffic by source and destination IP',
    steps: ['Keep the LACP channel on Fa0/1 and Fa0/2.', 'Set load balancing to src-dst-ip.'],
    reqs: [...LACP, swLb('src-dst-ip')],
  },
  advanced: {
    sub: 'As Intermediate, with both channel ports up and trunked',
    steps: ['Keep the LACP channel and load balancing.', 'Bring both ports up and make them trunks.'],
    reqs: [...LACP, swLb('src-dst-ip'), swUp('fa0/1'), swUp('fa0/2'), swTrunk('fa0/1'), swTrunk('fa0/2')],
  },
  expert: {
    sub: 'As Advanced, and allow only VLANs 10 and 20 on the channel',
    steps: ['Keep the Advanced settings.', 'Allow only VLANs 10 and 20 on Fa0/1 and Fa0/2.'],
    reqs: [...LACP, swLb('src-dst-ip'), swUp('fa0/1'), swUp('fa0/2'), swTrunk('fa0/1'), swTrunk('fa0/2'),
      swAllowed('fa0/1', [10, 20]), swAllowed('fa0/2', [10, 20])],
  },
};

const INTER_PCS = [pcStatic('PC1', '192.168.10.10', '192.168.10.1'), pcStatic('PC2', '192.168.20.10', '192.168.20.1'), pcPings('PC1', 'PC2')];
const INTER_ADV = [...TRUNK_UP, ...r1Sub(10), ...r1Sub(20), ...PCS_IN_10_20, ...INTER_PCS];
const INTERVLAN = {
  beginner: {
    sub: 'Trunk S1 Gi0/1 to R1 and give R1 a VLAN 10 subinterface',
    steps: ['Make S1 Gi0/1 a trunk and bring it up.', 'On R1, create Gi0/0.10 with dot1Q 10 and 192.168.10.1/24.', 'Bring Gi0/0.10 up.'],
    reqs: [...TRUNK_UP, ...r1Sub(10)],
  },
  intermediate: {
    sub: 'Add VLAN 20 on subinterface Gi0/0.20 with 192.168.20.1/24',
    steps: ['Keep the trunk and Gi0/0.10 working.', 'On R1, create Gi0/0.20 with dot1Q 20 and 192.168.20.1/24.', 'Bring Gi0/0.20 up.'],
    reqs: [...TRUNK_UP, ...r1Sub(10), ...r1Sub(20)],
  },
  advanced: {
    sub: 'As Intermediate, put the PCs in VLANs 10 and 20, and make PC1 reach PC2',
    steps: ['Keep the subinterfaces working.', 'Put Fa0/1 in VLAN 10 and Fa0/2 in VLAN 20, and bring both ports up.',
      'On PC1, set 192.168.10.10/24 with gateway 192.168.10.1; on PC2, 192.168.20.10/24 with gateway 192.168.20.1.', 'From PC1, ping PC2.'],
    reqs: INTER_ADV,
  },
  expert: {
    sub: 'As Advanced, and add Gi0/0.99 on 192.168.99.1/24 with VLANs 10, 20 and 99 allowed on the trunk',
    steps: ['Create VLAN 99 on S1.', 'On R1, create Gi0/0.99 with dot1Q 99 and 192.168.99.1/24.', 'Allow only VLANs 10, 20 and 99 on the trunk.'],
    reqs: [...INTER_ADV, ...r1Sub(99), swVlan(99), swAllowed('gi0/1', [10, 20, 99])],
  },
};

// Inter-VLAN routing on a multilayer switch (MLS1): SVIs, a routed port to the DHCP server DHCP1, DHCP relay, PCs
const MLS_TOPO = {
  nodes: [
    {id: 'DHCP1', type: 'dhcp', x: 8, y: 64, sub: '192.168.99.10'},
    {id: 'MLS1', type: 'mls', x: 190, y: 64, sub: 'L3 switch'},
    {id: 'PC1', type: 'pc', x: 370, y: 24, sub: 'VLAN 10', at: 'MLS1 fa0/1'},
    {id: 'PC2', type: 'pc', x: 370, y: 104, sub: 'VLAN 20', at: 'MLS1 fa0/2'},
  ],
  links: [{a: 'DHCP1', b: 'MLS1', port: 'Gi0/1'}, {a: 'MLS1', b: 'PC1', port: 'Fa0/1'}, {a: 'MLS1', b: 'PC2', port: 'Fa0/2'}],
  home: 'MLS1',
};
const MLS_LEAD = 'MLS1 is a multilayer switch. PC1 is on Fa0/1, PC2 on Fa0/2, and the DHCP server DHCP1 (192.168.99.10) on Gi0/1.';
const DHCP1_IP = '192.168.99.10';
const mlsPool = vlan => ({name: `VLAN${vlan}`, net: `192.168.${vlan}.0`, mask: MASK24, gw: `192.168.${vlan}.1`,
  ex: [[`192.168.${vlan}.1`, `192.168.${vlan}.10`]]});
// DHCP1 answers when MLS1 routes and its routed port Gi0/1 is up on DHCP1's subnet
const MLS_SERVER = () => ({name: 'DHCP1', ip: DHCP1_IP, pools: [mlsPool(10), mlsPool(20)],
  reach: s => SW(s).routing && SW(s).ports['gi0/1'].routed && !!usable(SW(s).ports['gi0/1']) && inNet(SW(s).ports['gi0/1'].ip, SW(s).ports['gi0/1'].mask, DHCP1_IP)});

const IP_ROUTING = {text: 'MLS1 routes between VLANs', ok: s => SW(s).routing, hint: {cmds: ['ip routing']}};
// an SVI requirement: like swReq, but the SVI exists only once interface vlan <n> was typed
const sviReq = (vlan, text, ok, ...cmds) => ({text: `Vlan${vlan} ${text}`, ok: s => !!SW(s).ports[`vlan${vlan}`] && ok(SW(s).ports[`vlan${vlan}`]),
  hint: {cmds, port: `Vlan${vlan}`}});
const svi = vlan => {
  const ip = `192.168.${vlan}.1`;
  return [
    sviReq(vlan, `has the address ${ip} ${MASK24}`, q => q.ip === ip && q.mask === MASK24, `ip address ${ip} ${MASK24}`),
    sviReq(vlan, 'is up', q => !q.shut, 'no shutdown'),
  ];
};
const sviHelper = vlan => sviReq(vlan, `relays DHCP to ${DHCP1_IP}`, q => q.helpers.includes(DHCP1_IP), `ip helper-address ${DHCP1_IP}`);
const ROUTED_UPLINK = [
  swReq('gi0/1', 'is a routed port', q => q.routed, 'no switchport'),
  swReq('gi0/1', `has the address 192.168.99.1 ${MASK24}`, q => q.ip === '192.168.99.1' && q.mask === MASK24, `ip address 192.168.99.1 ${MASK24}`),
  swUp('gi0/1'),
];
const MLS_VLAN10 = [IP_ROUTING, swVlan(10), ...svi(10), swAccess('fa0/1', 10), swUp('fa0/1')];
const MLS_BOTH = [...MLS_VLAN10, swVlan(20), ...svi(20), swAccess('fa0/2', 20), swUp('fa0/2')];
const MLSVLAN = {
  beginner: {
    sub: 'Turn on routing on MLS1 and give VLAN 10 a gateway on an SVI',
    steps: ['Turn on ip routing.', 'Create VLAN 10, then interface vlan 10 with 192.168.10.1/24, and bring it up.',
      'Make Fa0/1 an access port in VLAN 10 and bring it up.'],
    reqs: MLS_VLAN10,
  },
  intermediate: {
    sub: 'Route between VLANs 10 and 20 on MLS1, and make PC1 reach PC2',
    steps: ['Keep VLAN 10 working.', 'Create VLAN 20 with SVI 192.168.20.1/24, and put Fa0/2 in VLAN 20.',
      'On PC1, set 192.168.10.10/24 with gateway 192.168.10.1; on PC2, 192.168.20.10/24 with gateway 192.168.20.1.', 'From PC1, ping PC2.'],
    reqs: [...MLS_BOTH, pcStatic('PC1', '192.168.10.10', '192.168.10.1'), pcStatic('PC2', '192.168.20.10', '192.168.20.1'), pcPings('PC1', 'PC2')],
  },
  advanced: {
    sub: 'Make Gi0/1 a routed port to DHCP1 and relay DHCP for VLAN 10',
    steps: ['Keep both VLANs and their SVIs.', 'Make Gi0/1 a routed port (no switchport) with 192.168.99.1/24, and bring it up.',
      'On interface vlan 10, add ip helper-address 192.168.99.10.', 'Open PC1 and type dhcp.'],
    reqs: [...MLS_BOTH, ...ROUTED_UPLINK, sviHelper(10), pcLease('PC1', '192.168.10')],
  },
  expert: {
    sub: 'As Advanced, relay DHCP for VLAN 20 too, and make PC1 reach PC2 with their DHCP addresses',
    steps: ['Keep the Advanced settings.', 'On interface vlan 20, add ip helper-address 192.168.99.10.', 'Type dhcp on PC1 and PC2.', 'From PC1, ping PC2.'],
    reqs: [...MLS_BOTH, ...ROUTED_UPLINK, sviHelper(10), sviHelper(20), pcLease('PC1', '192.168.10'), pcLease('PC2', '192.168.20'), pcPings('PC1', 'PC2')],
    cmds: ['ip routing', 'vlan 10', 'exit', 'vlan 20', 'exit', 'int vlan 10', 'ip add 192.168.10.1 255.255.255.0',
      'ip helper-address 192.168.99.10', 'int vlan 20', 'ip add 192.168.20.1 255.255.255.0', 'ip helper-address 192.168.99.10',
      'int gi0/1', 'no switchport', 'ip add 192.168.99.1 255.255.255.0', 'no sh', 'int fa0/1', 'sw mode access', 'sw access vlan 10', 'no sh',
      'int fa0/2', 'sw mode access', 'sw access vlan 20', 'no sh'],
    then: [['PC1', ['dhcp']], ['PC2', ['dhcp']], ['PC1', ['ping 192.168.20.11']]],
  },
};

// ---- 5.0 security: port security ----
const swPsec = p => swReq(p, 'has port security on', q => q.psec === true, 'switchport port-security');
const swPsMax = (p, n) => swReq(p, `allows ${n} MAC address${n > 1 ? 'es' : ''}`, q => q.psMax === n, `switchport port-security maximum ${n}`);
const swPsViol = (p, v) => swReq(p, `violation mode is ${v}`, q => q.psViolation === v, `switchport port-security violation ${v}`);
const swPsSticky = p => swReq(p, 'learns sticky MAC addresses', q => q.psSticky === true, 'switchport port-security mac-address sticky');
const PS_ADV = [swMode('fa0/1'), swMode('fa0/2'), swUp('fa0/1'), swUp('fa0/2'), swPsec('fa0/1'), swPsec('fa0/2'), swPsSticky('fa0/1'), swPsSticky('fa0/2'),
  swPsMax('fa0/1', 1), swPsMax('fa0/2', 1), swPsViol('fa0/1', 'shutdown'), swPsViol('fa0/2', 'restrict')];
const PORTSEC = {
  beginner: {
    sub: 'Turn on port security on Fa0/1',
    steps: ['Make Fa0/1 an access port and bring it up.', 'Enable port security on Fa0/1.'],
    reqs: [swMode('fa0/1'), swUp('fa0/1'), swPsec('fa0/1')],
  },
  intermediate: {
    sub: 'Allow one MAC address on Fa0/1 and shut the port on a violation',
    steps: ['Keep port security on Fa0/1.', 'Set the maximum to 1 and the violation mode to shutdown.'],
    reqs: [swMode('fa0/1'), swUp('fa0/1'), swPsec('fa0/1'), swPsMax('fa0/1', 1), swPsViol('fa0/1', 'shutdown')],
  },
  advanced: {
    sub: 'Use sticky MAC addresses on Fa0/1 and Fa0/2, and restrict Fa0/2 on a violation',
    steps: ['Turn on sticky port security on Fa0/1 and Fa0/2.', 'Allow one MAC per port.', 'Shut Fa0/1 on a violation and restrict Fa0/2.'],
    reqs: PS_ADV,
  },
  expert: {
    sub: 'As Advanced, and protect the unused Fa0/3 with sticky MAC, one address and shutdown',
    steps: ['Keep the Advanced settings on Fa0/1 and Fa0/2.', 'Protect Fa0/3 with sticky MAC, a maximum of 1 and shutdown on violation.'],
    reqs: [...PS_ADV, swPsec('fa0/3'), swPsSticky('fa0/3'), swPsMax('fa0/3', 1), swPsViol('fa0/3', 'shutdown')],
  },
};

// ---- 3.0 IP connectivity, 4.0 IP services and 5.0 ACLs: router labs ----

// the R1-R2-R3 diagram used by the router labs (R2 and R3 are display-only: readonly)
const RT_TOPO = {
  nodes: [
    {id: 'R1', type: 'router', x: 8, y: 64, sub: 'Router'},
    {id: 'PC1', type: 'pc', x: 370, y: 14, sub: 'LAN 1', at: 'R1 gi0/0'},
    {id: 'R2', type: 'router', readonly: true, x: 370, y: 64, sub: '10.0.0.2'},
    {id: 'R3', type: 'router', readonly: true, x: 370, y: 114, sub: '10.0.1.2'},
  ],
  links: [{a: 'R1', b: 'PC1', port: 'Gi0/0'}, {a: 'R1', b: 'R2', port: 'Gi0/1'}, {a: 'R1', b: 'R3', port: 'Gi0/2'}],
  home: 'R1',
};

// an R1 interface requirement: the text after the interface name, the check on the interface, and the commands on it
const rtReq = (k, text, ok, ...cmds) => ({text: `${portName(k)} ${text}`, ok: s => ok(R1(s).ifs[k]), hint: {cmds, port: portName(k)}});
// an R1 interface with its address, and up
const rtIf = (k, ip, mask) => [
  rtReq(k, `is ${ip} ${mask}`, i => i.ip === ip && i.mask === mask, `ip address ${ip} ${mask}`),
  rtReq(k, 'is up', i => !i.shut, 'no shutdown'),
];
const LAN_IF = x => rtIf('gi0/0', `192.168.${x}.1`, '255.255.255.0'); // towards PC1
const WAN_IF = rtIf('gi0/1', '10.0.0.1', '255.255.255.252'); // towards R2
const R3_IF = rtIf('gi0/2', '10.0.1.1', '255.255.255.252'); // towards R3
const BOTH_IFS = x => [...LAN_IF(x), ...WAN_IF];
// the same interfaces as solution commands; every piece of a solution ends back in global configuration
const onIf = (k, ...lines) => [`int ${k}`, ...lines, 'exit'];
const LAN_CMDS = x => onIf('gi0/0', `ip address 192.168.${x}.1 255.255.255.0`, 'no shutdown');
const WAN_CMDS = onIf('gi0/1', 'ip address 10.0.0.1 255.255.255.252', 'no shutdown');
const R3_CMDS = onIf('gi0/2', 'ip address 10.0.1.1 255.255.255.252', 'no shutdown');
const BOTH_CMDS = x => [...LAN_CMDS(x), ...WAN_CMDS];
const DEFAULT_CMD = 'ip route 0.0.0.0 0.0.0.0 10.0.0.2';
const PC1_DHCP = [['PC1', ['dhcp']]];
const rtRoute = (net, mask, nh, dist = 1) => ({
  text: `R1 has a route to ${net} ${mask} via ${nh}${dist !== 1 ? ` with distance ${dist}` : ''}`,
  ok: s => R1(s).routes.some(r => r.net === net && r.mask === mask && r.nh === nh && r.dist === dist),
  hint: {cmds: [`ip route ${net} ${mask} ${nh}${dist !== 1 ? ' ' + dist : ''}`]},
});
const DEFAULT_VIA_R2 = rtRoute('0.0.0.0', '0.0.0.0', '10.0.0.2');
const aclEntries = (name, type, expected) => ({
  text: `ACL ${name} has the entries: ${expected.join('; ')}`,
  ok: s => !!R1(s).acls[name] && R1(s).acls[name].type === type && R1(s).acls[name].entries.join(' | ') === expected.join(' | '),
  hint: {cmds: [`ip access-list ${type} ${name}`, ...expected]},
});
const aclApplied = (k, dir, name) => rtReq(k, `applies ACL ${name} ${dir === 'in' ? 'inbound' : 'outbound'}`,
  i => (dir === 'in' ? i.aclIn : i.aclOut) === name, `ip access-group ${name} ${dir}`);

const STATIC = {
  beginner: {
    sub: 'Route the remote LAN 172.16.x.0/24 through R2 at 10.0.0.2',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is the next hop on Gi0/1.`,
    steps: ['Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Add a static route for 172.16.x.0/24 via 10.0.0.2.'],
    reqs: x => [...BOTH_IFS(x), rtRoute(`172.16.${x}.0`, '255.255.255.0', '10.0.0.2')],
    cmds: x => [...BOTH_CMDS(x), `ip route 172.16.${x}.0 255.255.255.0 10.0.0.2`],
  },
  intermediate: {
    sub: 'Add a second remote LAN, 172.17.x.0/24, also through R2',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is the next hop on Gi0/1.`,
    steps: ['Keep the first static route working.', 'Add a static route for 172.17.x.0/24 via 10.0.0.2.'],
    reqs: x => [...STATIC.beginner.reqs(x), rtRoute(`172.17.${x}.0`, '255.255.255.0', '10.0.0.2')],
    cmds: x => [...STATIC.beginner.cmds(x), `ip route 172.17.${x}.0 255.255.255.0 10.0.0.2`],
  },
  advanced: {
    sub: 'Add R3 on Gi0/2 as a backup for 172.16.x.0/24, using distance 150',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is on Gi0/1 and R3 on Gi0/2.`,
    steps: ['Keep the routes to R2 working.', 'Address Gi0/2 as 10.0.1.1/30 and bring it up.', 'Add a backup route for 172.16.x.0/24 via 10.0.1.2 with distance 150.'],
    reqs: x => [...STATIC.intermediate.reqs(x), ...R3_IF, rtRoute(`172.16.${x}.0`, '255.255.255.0', '10.0.1.2', 150)],
    cmds: x => [...STATIC.intermediate.cmds(x), ...R3_CMDS, `ip route 172.16.${x}.0 255.255.255.0 10.0.1.2 150`],
  },
  expert: {
    sub: 'As Advanced, and add 172.18.x.0/24 as a route out the exit interface Gi0/2',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is on Gi0/1 and R3 on Gi0/2.`,
    steps: ['Keep the Advanced routes.', 'Add a static route for 172.18.x.0/24 that uses Gi0/2 as the exit interface.'],
    reqs: x => [...STATIC.advanced.reqs(x), rtRoute(`172.18.${x}.0`, '255.255.255.0', 'Gi0/2')],
    cmds: x => [...STATIC.advanced.cmds(x), `ip route 172.18.${x}.0 255.255.255.0 gi0/2`],
  },
};

const DEFROUTE = {
  beginner: {
    sub: 'Send unknown traffic to R2 at 10.0.0.2 with a default route',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 at 10.0.0.2 is the way out.`,
    steps: ['Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Add a default route via 10.0.0.2.'],
    reqs: x => [...BOTH_IFS(x), DEFAULT_VIA_R2],
    cmds: x => [...BOTH_CMDS(x), DEFAULT_CMD],
  },
  intermediate: {
    sub: 'Add R3 at 10.0.1.2 as a backup default route with distance 150',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is on Gi0/1 and R3 on Gi0/2.`,
    steps: ['Keep the default route via R2.', 'Address Gi0/2 as 10.0.1.1/30 and bring it up.', 'Add a backup default route via 10.0.1.2 with distance 150.'],
    reqs: x => [...BOTH_IFS(x), DEFAULT_VIA_R2, ...R3_IF, rtRoute('0.0.0.0', '0.0.0.0', '10.0.1.2', 150)],
    cmds: x => [...DEFROUTE.beginner.cmds(x), ...R3_CMDS, 'ip route 0.0.0.0 0.0.0.0 10.0.1.2 150'],
  },
  advanced: {
    sub: 'Make Gi0/1 the exit interface for the default route',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is on Gi0/1.`,
    steps: ['Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Add a default route that uses Gi0/1 as the exit interface.'],
    reqs: x => [...BOTH_IFS(x), rtRoute('0.0.0.0', '0.0.0.0', 'Gi0/1')],
    cmds: x => [...BOTH_CMDS(x), 'ip route 0.0.0.0 0.0.0.0 gi0/1'],
  },
  expert: {
    sub: 'Default route via R2, plus a specific route to 172.16.x.0/24 via R2',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is on Gi0/1.`,
    steps: ['Add a default route via 10.0.0.2.', 'Add a specific route for 172.16.x.0/24 via 10.0.0.2 so it is not sent to the default.'],
    reqs: x => [...BOTH_IFS(x), DEFAULT_VIA_R2, rtRoute(`172.16.${x}.0`, '255.255.255.0', '10.0.0.2')],
    cmds: x => [...DEFROUTE.beginner.cmds(x), `ip route 172.16.${x}.0 255.255.255.0 10.0.0.2`],
  },
};

// OSPFv2 and OSPFv3 on R1, process 1
const ospfIn = (k, area, network) => ({text: `${portName(k)} runs OSPF in area ${area}`, ok: s => ospfArea(R1(s), k) === area,
  hint: {cmds: ['router ospf 1', network]}});
const ospfIfCmd = (k, area) => rtReq(k, `is put in area ${area} with the interface command`, i => i.ospf?.pid === 1 && i.ospf.area === area,
  `ip ospf 1 area ${area}`);
const ospf6In = (k, area) => rtReq(k, `runs OSPFv3 in area ${area}`, i => i.ospf6?.pid === 1 && i.ospf6.area === area, `ipv6 ospf 1 area ${area}`);
const ospfRid = (v6, rid) => ({
  text: `The ${v6 ? 'OSPFv3' : 'OSPF'} router ID is ${rid}`,
  ok: s => R1(s)[v6 ? 'ospf6' : 'ospf'].rid === rid,
  hint: {cmds: [v6 ? 'ipv6 router ospf 1' : 'router ospf 1', `router-id ${rid}`]},
});
const ospfPassive = (v6, k) => ({
  text: `${portName(k)} is passive in ${v6 ? 'OSPFv3' : 'OSPF'}`,
  ok: s => R1(s)[v6 ? 'ospf6' : 'ospf'].passive.includes(portName(k)),
  hint: {cmds: [`passive-interface ${portName(k)}`]},
});
const OSPF_ORIGINATE = {text: 'OSPF advertises the default route', ok: s => R1(s).ospf.originate, hint: {cmds: ['router ospf 1', 'default-information originate']}};
const v6If = (k, ip) => [rtReq(k, `is ${ip}`, i => i.ip6 === ip, `ipv6 address ${ip}`), rtReq(k, 'is up', i => !i.shut, 'no shutdown')];
const linkLocal = k => rtReq(k, 'has the link-local address fe80::1', i => i.ll === 'fe80::1', 'ipv6 address fe80::1 link-local');
const V6_ROUTING = {text: 'IPv6 routing is on', ok: s => R1(s).v6routing, hint: {cmds: ['ipv6 unicast-routing']}};

const OSPF_LEAD = x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is an OSPF neighbour on Gi0/1.`;
const OSPF_BASE = x => [...BOTH_IFS(x), ospfIn('gi0/0', 0, `network 192.168.${x}.0 0.0.0.255 area 0`), ospfIn('gi0/1', 0, 'network 10.0.0.0 0.0.0.3 area 0')];
const OSPF = {
  beginner: {
    sub: 'Run OSPF process 1 in area 0 on the LAN and the link to R2',
    lead: OSPF_LEAD,
    steps: ['Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Start router ospf 1.',
      'Add network statements for 192.168.x.0/24 and 10.0.0.0/30, both in area 0.'],
    reqs: OSPF_BASE,
    cmds: x => [...BOTH_CMDS(x), 'router ospf 1', `network 192.168.${x}.0 0.0.0.255 area 0`, 'network 10.0.0.0 0.0.0.3 area 0', 'exit'],
  },
  intermediate: {
    sub: 'As Beginner, with router ID 1.1.1.1 and no OSPF hellos sent to the LAN',
    lead: OSPF_LEAD,
    steps: ['Keep OSPF running on both networks.', 'Set the router ID to 1.1.1.1.', 'Make Gi0/0 a passive interface.'],
    reqs: x => [...OSPF_BASE(x), ospfRid(false, '1.1.1.1'), ospfPassive(false, 'gi0/0')],
    cmds: x => [...OSPF.beginner.cmds(x), 'router ospf 1', 'router-id 1.1.1.1', 'passive-interface gi0/0', 'exit'],
  },
  advanced: {
    sub: 'As Intermediate, and bring R3 on Gi0/2 into area 0 with the interface command',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is on Gi0/1 and R3 on Gi0/2.`,
    steps: ['Keep the Intermediate settings.', 'Address Gi0/2 as 10.0.1.1/30 and bring it up.', 'On Gi0/2, use ip ospf 1 area 0 instead of a network statement.'],
    reqs: x => [...OSPF.intermediate.reqs(x), ...R3_IF, ospfIfCmd('gi0/2', 0)],
    cmds: x => [...OSPF.intermediate.cmds(x), ...onIf('gi0/2', 'ip address 10.0.1.1 255.255.255.252', 'no shutdown', 'ip ospf 1 area 0')],
  },
  expert: {
    sub: 'As Advanced, and advertise a default route via R2 into OSPF',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is the way out on Gi0/1; R3 is on Gi0/2.`,
    steps: ['Keep the Advanced settings.', 'Add a static default route via 10.0.0.2.', 'Under router ospf 1, add default-information originate.'],
    reqs: x => [...OSPF.advanced.reqs(x), DEFAULT_VIA_R2, OSPF_ORIGINATE],
    cmds: x => [...OSPF.advanced.cmds(x), DEFAULT_CMD, 'router ospf 1', 'default-information originate', 'exit'],
  },
};

const OSPF6_LEAD = x => `Your prefix is 2001:db8:${x}::/48. R2 is an OSPFv3 neighbour on Gi0/1.`;
const OSPF6_BASE = x => [V6_ROUTING, ...v6If('gi0/0', `2001:db8:${x}:1::1/64`), ...v6If('gi0/1', `2001:db8:${x}:12::1/64`),
  ospfRid(true, '1.1.1.1'), ospf6In('gi0/0', 0), ospf6In('gi0/1', 0)];
const OSPF6 = {
  beginner: {
    sub: 'Run OSPFv3 process 1 in area 0 on the LAN and the link to R2',
    lead: OSPF6_LEAD,
    steps: ['Turn on ipv6 unicast-routing.', 'Address Gi0/0 as 2001:db8:x:1::1/64 and Gi0/1 as 2001:db8:x:12::1/64, and bring them up.',
      'Start ipv6 router ospf 1 with router ID 1.1.1.1 (R1 has no IPv4 address to borrow one from).', 'On both interfaces, add ipv6 ospf 1 area 0.'],
    reqs: OSPF6_BASE,
    cmds: x => ['ipv6 unicast-routing', 'ipv6 router ospf 1', 'router-id 1.1.1.1', 'exit',
      ...onIf('gi0/0', `ipv6 address 2001:db8:${x}:1::1/64`, 'no shutdown', 'ipv6 ospf 1 area 0'),
      ...onIf('gi0/1', `ipv6 address 2001:db8:${x}:12::1/64`, 'no shutdown', 'ipv6 ospf 1 area 0')],
  },
  intermediate: {
    sub: 'As Beginner, and stop OSPFv3 hellos on the LAN',
    lead: OSPF6_LEAD,
    steps: ['Keep OSPFv3 running on both interfaces.', 'Under ipv6 router ospf 1, make Gi0/0 passive.'],
    reqs: x => [...OSPF6_BASE(x), ospfPassive(true, 'gi0/0')],
    cmds: x => [...OSPF6.beginner.cmds(x), 'ipv6 router ospf 1', 'passive-interface gi0/0', 'exit'],
  },
  advanced: {
    sub: 'As Intermediate, and put the link to R3 on Gi0/2 in area 1',
    lead: x => `Your prefix is 2001:db8:${x}::/48. R2 is on Gi0/1 (area 0) and R3 on Gi0/2 (area 1).`,
    steps: ['Keep the Intermediate settings.', 'Address Gi0/2 as 2001:db8:x:13::1/64 and bring it up.', 'Add ipv6 ospf 1 area 1 on Gi0/2.'],
    reqs: x => [...OSPF6.intermediate.reqs(x), ...v6If('gi0/2', `2001:db8:${x}:13::1/64`), ospf6In('gi0/2', 1)],
    cmds: x => [...OSPF6.intermediate.cmds(x), ...onIf('gi0/2', `ipv6 address 2001:db8:${x}:13::1/64`, 'no shutdown', 'ipv6 ospf 1 area 1')],
  },
  expert: {
    sub: 'As Advanced, with the link-local address fe80::1 on every interface',
    lead: x => `Your prefix is 2001:db8:${x}::/48. R2 is on Gi0/1 (area 0) and R3 on Gi0/2 (area 1).`,
    steps: ['Keep the Advanced settings.', 'Give Gi0/0, Gi0/1 and Gi0/2 the link-local address fe80::1, so OSPFv3 neighbours see a simple next hop.'],
    reqs: x => [...OSPF6.advanced.reqs(x), ...['gi0/0', 'gi0/1', 'gi0/2'].map(linkLocal)],
    cmds: x => [...OSPF6.advanced.cmds(x), ...['gi0/0', 'gi0/1', 'gi0/2'].flatMap(k => onIf(k, 'ipv6 address fe80::1 link-local'))],
  },
};

// RIP and EIGRP on R1 (EIGRP uses AS 100)
const IGP_NAME = {rip: 'RIP', eigrp: 'EIGRP'};
const IGP_START = {rip: 'router rip', eigrp: 'router eigrp 100'};
const igpIn = (p, k, network) => ({text: `${portName(k)} runs ${IGP_NAME[p]}`, ok: s => !!netHit(R1(s), p, k), hint: {cmds: [IGP_START[p], network]}});
const igpPassive = (p, k) => ({
  text: `${portName(k)} is passive in ${IGP_NAME[p]}`,
  ok: s => R1(s)[p].passive.includes(portName(k)),
  hint: {cmds: [`passive-interface ${portName(k)}`]},
});
const igpNoSum = p => ({text: `${IGP_NAME[p]} auto-summary is off`, ok: s => R1(s)[p].nosum, hint: {cmds: ['no auto-summary']}});
const RIP_V2 = {text: 'RIP runs version 2', ok: s => R1(s).rip.ver === 2, hint: {cmds: ['router rip', 'version 2']}};
const RIP_ORIGINATE = {text: 'RIP advertises the default route', ok: s => R1(s).rip.originate, hint: {cmds: ['router rip', 'default-information originate']}};
const eigrpRid = rid => ({text: `The EIGRP router ID is ${rid}`, ok: s => R1(s).eigrp.rid === rid, hint: {cmds: ['router eigrp 100', `eigrp router-id ${rid}`]}});
const EIGRP_AS = {text: 'EIGRP runs as AS 100', ok: s => R1(s).eigrp.pid === 100, hint: {cmds: ['router eigrp 100']}};
const EIGRP_CLASSFUL = {text: 'EIGRP covers 10.0.0.0 with one classful network statement', ok: s => R1(s).eigrp.nets.some(n => n.cf && n.net === '10.0.0.0'), hint: {cmds: ['network 10.0.0.0']}};

const RIP_LEAD = x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is a RIP neighbour on Gi0/1.`;
const RIP_BASE = x => [...BOTH_IFS(x), RIP_V2, igpIn('rip', 'gi0/0', `network 192.168.${x}.0`), igpIn('rip', 'gi0/1', 'network 10.0.0.0')];
const RIP = {
  beginner: {
    sub: 'Run RIP version 2 on the LAN and the link to R2',
    lead: RIP_LEAD,
    steps: ['Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Start router rip and set version 2.',
      'Add network 192.168.x.0 and network 10.0.0.0 (RIP networks are classful).'],
    reqs: RIP_BASE,
    cmds: x => [...BOTH_CMDS(x), 'router rip', 'version 2', `network 192.168.${x}.0`, 'network 10.0.0.0', 'exit'],
  },
  intermediate: {
    sub: 'As Beginner, with auto-summary off and no RIP updates sent to the LAN',
    lead: RIP_LEAD,
    steps: ['Keep RIPv2 running on both networks.', 'Turn off auto-summary.', 'Make Gi0/0 a passive interface.'],
    reqs: x => [...RIP_BASE(x), igpNoSum('rip'), igpPassive('rip', 'gi0/0')],
    cmds: x => [...RIP.beginner.cmds(x), 'router rip', 'no auto-summary', 'passive-interface gi0/0', 'exit'],
  },
  advanced: {
    sub: 'As Intermediate, and advertise a default route via R2 into RIP',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is the way out on Gi0/1.`,
    steps: ['Keep the Intermediate settings.', 'Add a static default route via 10.0.0.2.', 'Under router rip, add default-information originate.'],
    reqs: x => [...RIP.intermediate.reqs(x), DEFAULT_VIA_R2, RIP_ORIGINATE],
    cmds: x => [...RIP.intermediate.cmds(x), DEFAULT_CMD, 'router rip', 'default-information originate', 'exit'],
  },
  expert: {
    sub: 'As Advanced, and bring up R3 on Gi0/2 without sending it RIP updates',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is the way out on Gi0/1; R3 is on Gi0/2.`,
    steps: ['Keep the Advanced settings.', 'Address Gi0/2 as 10.0.1.1/30 and bring it up (network 10.0.0.0 already covers it).', 'Make Gi0/2 a passive interface.'],
    reqs: x => [...RIP.advanced.reqs(x), ...R3_IF, igpIn('rip', 'gi0/2', 'network 10.0.0.0'), igpPassive('rip', 'gi0/2')],
    cmds: x => [...RIP.advanced.cmds(x), ...R3_CMDS, 'router rip', 'passive-interface gi0/2', 'exit'],
  },
};

const EIGRP_LEAD = x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is an EIGRP neighbour on Gi0/1.`;
const EIGRP_BASE = x => [...BOTH_IFS(x), EIGRP_AS, igpIn('eigrp', 'gi0/0', `network 192.168.${x}.0 0.0.0.255`), igpIn('eigrp', 'gi0/1', 'network 10.0.0.0 0.0.0.3')];
const EIGRP = {
  beginner: {
    sub: 'Run EIGRP AS 100 on the LAN and the link to R2',
    lead: EIGRP_LEAD,
    steps: ['Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Start router eigrp 100.',
      'Add network 192.168.x.0 0.0.0.255 and network 10.0.0.0 0.0.0.3.'],
    reqs: EIGRP_BASE,
    cmds: x => [...BOTH_CMDS(x), 'router eigrp 100', `network 192.168.${x}.0 0.0.0.255`, 'network 10.0.0.0 0.0.0.3', 'exit'],
  },
  intermediate: {
    sub: 'As Beginner, with router ID 1.1.1.1 and no EIGRP hellos sent to the LAN',
    lead: EIGRP_LEAD,
    steps: ['Keep EIGRP running on both networks.', 'Set the router ID to 1.1.1.1.', 'Make Gi0/0 a passive interface.'],
    reqs: x => [...EIGRP_BASE(x), eigrpRid('1.1.1.1'), igpPassive('eigrp', 'gi0/0')],
    cmds: x => [...EIGRP.beginner.cmds(x), 'router eigrp 100', 'eigrp router-id 1.1.1.1', 'passive-interface gi0/0', 'exit'],
  },
  advanced: {
    sub: 'As Intermediate, with auto-summary off and R3 on Gi0/2 in EIGRP',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is on Gi0/1 and R3 on Gi0/2.`,
    steps: ['Keep the Intermediate settings.', 'Turn off auto-summary.', 'Address Gi0/2 as 10.0.1.1/30 and bring it up.', 'Add network 10.0.1.0 0.0.0.3.'],
    reqs: x => [...EIGRP.intermediate.reqs(x), igpNoSum('eigrp'), ...R3_IF, igpIn('eigrp', 'gi0/2', 'network 10.0.1.0 0.0.0.3')],
    cmds: x => [...EIGRP.intermediate.cmds(x), ...R3_CMDS, 'router eigrp 100', 'no auto-summary', 'network 10.0.1.0 0.0.0.3', 'exit'],
  },
  expert: {
    sub: 'As Advanced, and cover both 10.0.x.0/30 links with one classful network statement',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is on Gi0/1 and R3 on Gi0/2.`,
    steps: ['Keep the Advanced settings.', 'Add network 10.0.0.0 with no wildcard mask, which EIGRP treats as the whole classful network.'],
    reqs: x => [...EIGRP.advanced.reqs(x), EIGRP_CLASSFUL],
    cmds: x => [...EIGRP.advanced.cmds(x), 'router eigrp 100', 'network 10.0.0.0', 'exit'],
  },
};

// Device hardening best practices on R1
// a line requirement: cmds are typed under the line (console = line console 0, vty = line vty 0 4)
const LINE_CMD = {console: 'line console 0', vty: 'line vty 0 4'};
const lineCheck = (name, text, ok, ...cmds) => ({text, ok: s => ok(R1(s).lines[name]), hint: {cmds: [LINE_CMD[name], ...cmds]}});
const hardenLine = name => [
  lineCheck(name, `${name === 'vty' ? 'VTY lines have' : 'The console has'} a password`, l => !!l.pw, 'password <word>'),
  lineCheck(name, `${name === 'vty' ? 'VTY lines require' : 'The console requires'} a login`, l => l.login, 'login'),
];
const HARDEN_BASE = [
  {text: 'The hostname is EDGE1', ok: s => R1(s).host === 'EDGE1', hint: {cmds: ['hostname EDGE1']}},
  {text: 'The privileged EXEC mode is protected by an enable secret', ok: s => R1(s).sec.secret, hint: {cmds: ['enable secret <word>']}},
  {text: 'Stored passwords are encrypted', ok: s => R1(s).sec.enc, hint: {cmds: ['service password-encryption']}},
];
const HARDEN = {
  beginner: {
    sub: 'Name the router EDGE1, protect privileged mode and encrypt stored passwords',
    lead: 'R1 is a fresh router with no security configured.',
    steps: ['Set the hostname to EDGE1.', 'Set an enable secret.', 'Turn on service password-encryption.'],
    reqs: () => HARDEN_BASE,
    cmds: ['hostname EDGE1', 'enable secret class', 'service password-encryption'],
  },
  intermediate: {
    sub: 'As Beginner, with a login banner and no DNS lookups for mistyped commands',
    lead: 'R1 is a fresh router with no security configured.',
    steps: ['Keep the Beginner settings.', 'Add a banner, for example banner motd #Authorized access only#.', 'Turn off DNS lookups with no ip domain-lookup.'],
    reqs: () => [...HARDEN_BASE, {text: 'A MOTD banner is set', ok: s => !!R1(s).sec.banner, hint: {cmds: ['banner motd #Authorized access only#']}},
      {text: 'DNS lookups for mistyped commands are off', ok: s => R1(s).sec.nolookup, hint: {cmds: ['no ip domain-lookup']}}],
    cmds: () => [...HARDEN.beginner.cmds, 'banner motd #Authorized access only#', 'no ip domain-lookup'],
  },
  advanced: {
    sub: 'As Intermediate, and lock down the console line',
    lead: 'R1 is a fresh router with no security configured.',
    steps: ['Keep the Intermediate settings.', 'Under line console 0, set a password and login.', 'Add logging synchronous so log messages do not interrupt typing.'],
    reqs: () => [...HARDEN.intermediate.reqs(), ...hardenLine('console'),
      lineCheck('console', 'The console uses logging synchronous', l => l.sync, 'logging synchronous')],
    cmds: () => [...HARDEN.intermediate.cmds(), 'line console 0', 'password cisco', 'login', 'logging synchronous', 'exit'],
  },
  expert: {
    sub: 'As Advanced, and lock down the VTY lines with an idle timeout on every line',
    lead: 'R1 is a fresh router with no security configured.',
    steps: ['Keep the Advanced settings.', 'Under line vty 0 4, set a password and login.', 'Set exec-timeout 5 0 on the console and on the VTY lines.'],
    reqs: () => [...HARDEN.advanced.reqs(), ...hardenLine('vty'),
      lineCheck('console', 'The console logs out after 5 idle minutes', l => l.timeout === '5 0', 'exec-timeout 5 0'),
      lineCheck('vty', 'VTY lines log out after 5 idle minutes', l => l.timeout === '5 0', 'exec-timeout 5 0')],
    cmds: () => [...HARDEN.advanced.cmds(), 'line vty 0 4', 'password cisco', 'login', 'exec-timeout 5 0', 'exit',
      'line console 0', 'exec-timeout 5 0', 'exit'],
  },
};

const TELNET_ACL = [aclEntries('110', 'extended', ['deny tcp any any eq telnet', 'permit ip any any']), aclApplied('gi0/0', 'in', '110')];
const TELNET_CMDS = ['ip access-list extended 110', 'deny tcp any any eq telnet', 'permit ip any any', 'exit', ...onIf('gi0/0', 'ip access-group 110 in')];
const ACL = {
  beginner: {
    sub: 'Block 192.168.x.10 with standard ACL 10 on inbound Gi0/0',
    lead: x => `PC1 is on 192.168.${x}.0/24 behind Gi0/0.`,
    steps: ['Create standard ACL 10: deny host 192.168.x.10, then permit any.', 'Apply ACL 10 inbound on Gi0/0.'],
    reqs: x => [...LAN_IF(x), aclEntries('10', 'standard', [`deny host 192.168.${x}.10`, 'permit any']), aclApplied('gi0/0', 'in', '10')],
    cmds: x => [...LAN_CMDS(x), 'ip access-list standard 10', `deny host 192.168.${x}.10`, 'permit any', 'exit', ...onIf('gi0/0', 'ip access-group 10 in')],
  },
  intermediate: {
    sub: 'Block the first half of the LAN with standard ACL 10 on outbound Gi0/1',
    lead: x => `PC1 is on 192.168.${x}.0/24. R2 is reached through Gi0/1.`,
    steps: ['Create standard ACL 10: deny 192.168.x.0 0.0.0.127, then permit any.', 'Apply ACL 10 outbound on Gi0/1.'],
    reqs: x => [...BOTH_IFS(x), aclEntries('10', 'standard', [`deny 192.168.${x}.0 0.0.0.127`, 'permit any']), aclApplied('gi0/1', 'out', '10')],
    cmds: x => [...BOTH_CMDS(x), 'ip access-list standard 10', `deny 192.168.${x}.0 0.0.0.127`, 'permit any', 'exit', ...onIf('gi0/1', 'ip access-group 10 out')],
  },
  advanced: {
    sub: 'Block Telnet inbound on Gi0/0 with extended ACL 110',
    lead: x => `PC1 is on 192.168.${x}.0/24 behind Gi0/0.`,
    steps: ['Create extended ACL 110: deny tcp any any eq telnet, then permit ip any any.', 'Apply ACL 110 inbound on Gi0/0.'],
    reqs: x => [...LAN_IF(x), ...TELNET_ACL],
    cmds: x => [...LAN_CMDS(x), ...TELNET_CMDS],
  },
  expert: {
    sub: 'Keep ACL 110 on Gi0/0, and filter web traffic from the LAN with web-filter outbound on Gi0/1',
    lead: x => `PC1 is on 192.168.${x}.0/24. R2 is reached through Gi0/1.`,
    steps: ['Keep ACL 110 inbound on Gi0/0.', 'Create extended ACL web-filter: deny tcp the first half of the LAN to any eq www, then permit ip any any.',
      'Apply web-filter outbound on Gi0/1.'],
    reqs: x => [...BOTH_IFS(x), ...TELNET_ACL,
      aclEntries('web-filter', 'extended', [`deny tcp 192.168.${x}.0 0.0.0.127 any eq www`, 'permit ip any any']), aclApplied('gi0/1', 'out', 'web-filter')],
    cmds: x => [...BOTH_CMDS(x), ...TELNET_CMDS, 'ip access-list extended web-filter', `deny tcp 192.168.${x}.0 0.0.0.127 any eq www`,
      'permit ip any any', 'exit', ...onIf('gi0/1', 'ip access-group web-filter out')],
  },
};

// DHCP, DHCP relay, NAT, network services
const dhcpPool = (name, net, mask, gw) => ({
  text: `DHCP pool ${name} serves ${net} ${mask} with default router ${gw}`,
  ok: s => !!R1(s).dhcp[name] && R1(s).dhcp[name].net === net && R1(s).dhcp[name].mask === mask && R1(s).dhcp[name].gw === gw,
  hint: {cmds: [`ip dhcp pool ${name}`, `network ${net} ${mask}`, `default-router ${gw}`]},
});
const dhcpEx = (first, last) => ({text: `DHCP excludes ${first} to ${last}`, ok: s => R1(s).dhcpEx.some(([a, b]) => a === first && b === last), hint: {cmds: [`ip dhcp excluded-address ${first} ${last}`]}});
const dhcpDns = (name, ip) => ({text: `DHCP pool ${name} gives DNS server ${ip}`, ok: s => !!R1(s).dhcp[name] && R1(s).dhcp[name].dns.includes(ip), hint: {cmds: [`dns-server ${ip}`]}});
const dhcpDomain = (name, d) => ({text: `DHCP pool ${name} sets the domain to ${d}`, ok: s => !!R1(s).dhcp[name] && R1(s).dhcp[name].domain === d, hint: {cmds: [`domain-name ${d}`]}});
const helperOn = (k, ip) => rtReq(k, `forwards DHCP to ${ip}`, i => i.helpers.includes(ip), `ip helper-address ${ip}`);
const noHelper = k => rtReq(k, 'does not forward DHCP', i => i.helpers.length === 0, 'no ip helper-address');
const natSide = (k, dir) => rtReq(k, `is NAT ${dir}`, i => i.nat === dir, `ip nat ${dir}`);
const natPat = (acl, k) => ({
  text: `ACL ${acl} hosts use ${portName(k)} with PAT (overload)`,
  ok: s => R1(s).nat.pat.some(p => p.acl === acl && p.iface === portName(k)),
  hint: {cmds: [`ip nat inside source list ${acl} interface ${portName(k)} overload`]},
});
const natStatic = (inside, outside) => ({
  text: `${inside} is NATed to ${outside} with a static entry`,
  ok: s => R1(s).nat.stat.some(p => p.in === inside && p.out === outside),
  hint: {cmds: [`ip nat inside source static ${inside} ${outside}`]},
});
const svcNtp = ip => ({text: `R1 uses NTP server ${ip}`, ok: s => R1(s).svc.ntp.includes(ip), hint: {cmds: [`ntp server ${ip}`]}});
const svcLog = ip => ({text: `R1 sends logs to ${ip}`, ok: s => R1(s).svc.log.includes(ip), hint: {cmds: [`logging host ${ip}`]}});
const svcDns = ip => ({text: `R1 uses DNS server ${ip}`, ok: s => R1(s).svc.dns.includes(ip), hint: {cmds: [`ip name-server ${ip}`]}});

const DHCP_LEAD = x => `PC1 is on 192.168.${x}.0/24 behind Gi0/0 and gets its settings from R1.`;
const DHCP = {
  beginner: {
    sub: 'Create DHCP pool LAN1 for 192.168.x.0/24 with R1 as the default router',
    lead: DHCP_LEAD,
    steps: ['Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Create ip dhcp pool LAN1 with network 192.168.x.0 255.255.255.0.',
      'Set default-router to 192.168.x.1.', 'Open PC1 and type dhcp to get an address.'],
    reqs: x => [...BOTH_IFS(x), dhcpPool('lan1', `192.168.${x}.0`, '255.255.255.0', `192.168.${x}.1`), pcLease('PC1', `192.168.${x}`)],
    cmds: x => [...BOTH_CMDS(x), 'ip dhcp pool LAN1', `network 192.168.${x}.0 255.255.255.0`, `default-router 192.168.${x}.1`, 'exit'],
    then: PC1_DHCP,
  },
  intermediate: {
    sub: 'As Beginner, and exclude 192.168.x.1 to 192.168.x.20 from the pool',
    lead: DHCP_LEAD,
    steps: ['Keep the LAN1 pool.', 'Add ip dhcp excluded-address 192.168.x.1 192.168.x.20.'],
    reqs: x => [...DHCP.beginner.reqs(x), dhcpEx(`192.168.${x}.1`, `192.168.${x}.20`)],
    cmds: x => [...DHCP.beginner.cmds(x), `ip dhcp excluded-address 192.168.${x}.1 192.168.${x}.20`],
    then: PC1_DHCP,
  },
  advanced: {
    sub: 'As Intermediate, and give clients the DNS server 172.16.x.53',
    lead: DHCP_LEAD,
    steps: ['Keep the LAN1 pool and excluded range.', 'Add dns-server 172.16.x.53 to LAN1.'],
    reqs: x => [...DHCP.intermediate.reqs(x), dhcpDns('lan1', `172.16.${x}.53`)],
    cmds: x => [...DHCP.intermediate.cmds(x), 'ip dhcp pool LAN1', `dns-server 172.16.${x}.53`, 'exit'],
    then: PC1_DHCP,
  },
  expert: {
    sub: 'As Advanced, and set the domain name to lab.local',
    lead: DHCP_LEAD,
    steps: ['Keep the Advanced settings.', 'Add domain-name lab.local to LAN1.'],
    reqs: x => [...DHCP.advanced.reqs(x), dhcpDomain('lan1', 'lab.local')],
    cmds: x => [...DHCP.advanced.cmds(x), 'ip dhcp pool LAN1', 'domain-name lab.local', 'exit'],
    then: PC1_DHCP,
  },
};

const RELAY_LEAD = x => `PC1 is on 192.168.${x}.0/24 behind Gi0/0. Both DHCP servers are behind R2.`;
const DHCPRELAY = {
  beginner: {
    sub: 'Forward DHCP from the LAN to the server 172.16.x.10 behind R2',
    lead: x => `PC1 is on 192.168.${x}.0/24 behind Gi0/0. The DHCP server 172.16.x.10 is behind R2.`,
    steps: ['Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Add a route to 172.16.x.0/24 via 10.0.0.2.', 'On Gi0/0, add ip helper-address 172.16.x.10.',
      'Open PC1 and type dhcp to get an address through the relay.'],
    reqs: x => [...BOTH_IFS(x), rtRoute(`172.16.${x}.0`, '255.255.255.0', '10.0.0.2'), helperOn('gi0/0', `172.16.${x}.10`), pcLease('PC1', `192.168.${x}`)],
    cmds: x => [...BOTH_CMDS(x), `ip route 172.16.${x}.0 255.255.255.0 10.0.0.2`, ...onIf('gi0/0', `ip helper-address 172.16.${x}.10`)],
    then: PC1_DHCP,
  },
  intermediate: {
    sub: 'Add a second DHCP server 172.17.x.10 behind R2 as a backup helper',
    lead: RELAY_LEAD,
    steps: ['Keep the relay to 172.16.x.10.', 'Add a route to 172.17.x.0/24 via 10.0.0.2.', 'Add a second ip helper-address 172.17.x.10 on Gi0/0.'],
    reqs: x => [...DHCPRELAY.beginner.reqs(x), rtRoute(`172.17.${x}.0`, '255.255.255.0', '10.0.0.2'), helperOn('gi0/0', `172.17.${x}.10`)],
    cmds: x => [...DHCPRELAY.beginner.cmds(x), `ip route 172.17.${x}.0 255.255.255.0 10.0.0.2`, ...onIf('gi0/0', `ip helper-address 172.17.${x}.10`)],
    then: PC1_DHCP,
  },
  advanced: {
    sub: 'As Intermediate, and make sure the uplink Gi0/1 does not relay DHCP',
    lead: RELAY_LEAD,
    steps: ['Keep both helper addresses on Gi0/0.', 'Make sure Gi0/1 has no ip helper-address.'],
    reqs: x => [...DHCPRELAY.intermediate.reqs(x), noHelper('gi0/1')],
    cmds: x => DHCPRELAY.intermediate.cmds(x), // Gi0/1 relays nothing unless told to
    then: PC1_DHCP,
  },
  expert: {
    sub: 'As Advanced, and add a default route via R2 so replies leave the network',
    lead: RELAY_LEAD,
    steps: ['Keep the Advanced settings.', 'Add a default route via 10.0.0.2.'],
    reqs: x => [...DHCPRELAY.advanced.reqs(x), DEFAULT_VIA_R2],
    cmds: x => [...DHCPRELAY.advanced.cmds(x), DEFAULT_CMD],
    then: PC1_DHCP,
  },
};

const NAT_LEAD = x => `PC1 is on 192.168.${x}.0/24 behind Gi0/0. R2 is outside on Gi0/1.`;
const NAT = {
  beginner: {
    sub: 'Mark Gi0/0 as NAT inside, Gi0/1 as NAT outside, and define ACL 1 for the LAN',
    lead: NAT_LEAD,
    steps: ['Address Gi0/0 and Gi0/1 and bring them up.', 'Set Gi0/0 to ip nat inside and Gi0/1 to ip nat outside.',
      'Create access-list 1 permit 192.168.x.0 0.0.0.255.'],
    reqs: x => [...BOTH_IFS(x), natSide('gi0/0', 'inside'), natSide('gi0/1', 'outside'), aclEntries('1', 'standard', [`permit 192.168.${x}.0 0.0.0.255`])],
    cmds: x => [...BOTH_CMDS(x), ...onIf('gi0/0', 'ip nat inside'), ...onIf('gi0/1', 'ip nat outside'), `access-list 1 permit 192.168.${x}.0 0.0.0.255`],
  },
  intermediate: {
    sub: 'As Beginner, and translate the LAN to the Gi0/1 address with PAT',
    lead: NAT_LEAD,
    steps: ['Keep the NAT inside and outside sides.', 'Add ip nat inside source list 1 interface Gi0/1 overload.'],
    reqs: x => [...NAT.beginner.reqs(x), natPat('1', 'gi0/1')],
    cmds: x => [...NAT.beginner.cmds(x), 'ip nat inside source list 1 interface gi0/1 overload'],
  },
  advanced: {
    sub: 'As Intermediate, and add a static NAT from 192.168.x.20 to 198.51.100.x',
    lead: NAT_LEAD,
    steps: ['Keep the PAT rule.', 'Add ip nat inside source static 192.168.x.20 198.51.100.x.'],
    reqs: x => [...NAT.intermediate.reqs(x), natStatic(`192.168.${x}.20`, `198.51.100.${x}`)],
    cmds: x => [...NAT.intermediate.cmds(x), `ip nat inside source static 192.168.${x}.20 198.51.100.${x}`],
  },
  expert: {
    sub: 'As Advanced, and add a default route via R2 so NAT traffic can leave',
    lead: NAT_LEAD,
    steps: ['Keep the Advanced NAT rules.', 'Add a default route via 10.0.0.2.'],
    reqs: x => [...NAT.advanced.reqs(x), DEFAULT_VIA_R2],
    cmds: x => [...NAT.advanced.cmds(x), DEFAULT_CMD],
  },
};

const SERVICES = {
  beginner: {
    sub: 'Point R1 at the NTP server 10.0.0.2 behind R2',
    lead: 'R1 reaches R2 on Gi0/1. The NTP server 10.0.0.2 sits behind R2.',
    steps: ['Address Gi0/1 and bring it up.', 'Add ntp server 10.0.0.2.'],
    reqs: () => [...WAN_IF, svcNtp('10.0.0.2')],
    cmds: [...WAN_CMDS, 'ntp server 10.0.0.2'],
  },
  intermediate: {
    sub: 'Also send logs to the syslog server 172.16.x.100 behind R2',
    lead: 'R1 reaches R2 on Gi0/1. The syslog server 172.16.x.100 sits behind R2.',
    steps: ['Keep the NTP server.', 'Add a route to 172.16.x.0/24 via 10.0.0.2.', 'Add logging host 172.16.x.100.'],
    reqs: x => [...SERVICES.beginner.reqs(x), rtRoute(`172.16.${x}.0`, '255.255.255.0', '10.0.0.2'), svcLog(`172.16.${x}.100`)],
    cmds: x => [...SERVICES.beginner.cmds, `ip route 172.16.${x}.0 255.255.255.0 10.0.0.2`, `logging host 172.16.${x}.100`],
  },
  advanced: {
    sub: 'As Intermediate, and use the DNS server 172.16.x.53',
    lead: 'R1 reaches R2 on Gi0/1. The syslog and DNS servers sit behind R2.',
    steps: ['Keep the NTP and syslog settings.', 'Add ip name-server 172.16.x.53.'],
    reqs: x => [...SERVICES.intermediate.reqs(x), svcDns(`172.16.${x}.53`)],
    cmds: x => [...SERVICES.intermediate.cmds(x), `ip name-server 172.16.${x}.53`],
  },
  expert: {
    sub: 'As Advanced, and add a second NTP server 10.0.1.2 on Gi0/2',
    lead: 'R1 reaches R2 on Gi0/1 and R3 on Gi0/2.',
    steps: ['Keep the Advanced settings.', 'Address Gi0/2 as 10.0.1.1/30 and bring it up.', 'Add ntp server 10.0.1.2.'],
    reqs: x => [...WAN_IF, ...R3_IF, svcNtp('10.0.0.2'), svcNtp('10.0.1.2'), rtRoute(`172.16.${x}.0`, '255.255.255.0', '10.0.0.2'),
      svcLog(`172.16.${x}.100`), svcDns(`172.16.${x}.53`)],
    cmds: x => [...SERVICES.advanced.cmds(x), ...R3_CMDS, 'ntp server 10.0.1.2'],
  },
};

// ---- batch 2: EUI-64, summarization, voice VLAN, trunk troubleshooting, IPv6 static, OSPF tuning, HSRP, SSH, AAA, snooping, DAI ----

// a requirement on any configurable device's port or interface: dev is S1, S2, R1 or R2
const portOf = (s, dev, k) => (s.config(dev).ports || s.config(dev).ifs)[k];
const devReq = (dev, k, text, ok, ...cmds) => ({text: `${dev} ${portName(k)} ${text}`, ok: s => ok(portOf(s, dev, k)), hint: {cmds, port: portName(k), dev}});
// global configuration lines on another device, as a solution step
const onDev = (dev, ...lines) => [dev, ['enable', 'conf t', ...lines, 'end']];
// a switch lab's solution: the diagram opens on R1, but the commands go to S1
const onS1 = lines => ({cmds: [], then: [onDev('S1', ...lines)]});

// 1.0 EUI-64 and SLAAC on R1: the interface ID comes from the MAC (see show interfaces)
const v6Eui = (k, prefix) => rtReq(k, `builds its address in ${prefix} with EUI-64`,
  i => i.eui && !!i.ip6 && v6Canon(i.ip6) === v6Canon(prefix), `ipv6 address ${prefix} eui-64`);
const rtUp = k => rtReq(k, 'is up', i => !i.shut, 'no shutdown');
const EUI_LEAD = x => `Your prefix is 2001:db8:${x}::/48. R1 has no IPv6 addressing yet. Each interface has its own MAC address.`;
const EUI_B = x => [v6Eui('gi0/0', `2001:db8:${x}:1::/64`), rtUp('gi0/0')];
const EUI_I = x => [...EUI_B(x), v6Eui('gi0/1', `2001:db8:${x}:2::/64`), rtUp('gi0/1')];
const EUI_A = x => [...EUI_I(x), rtReq('gi0/2', 'learns its address by SLAAC', i => i.auto, 'ipv6 address autoconfig'), rtUp('gi0/2')];
const euiFull = x => `2001:db8:${x}:4:${eui64(routerMac('R1', 3))}/64`; // what EUI-64 would build on Gi0/3
const EUI_CMDS_B = x => onIf('gi0/0', `ipv6 address 2001:db8:${x}:1::/64 eui-64`, 'no shutdown');
const EUI_CMDS_I = x => [...EUI_CMDS_B(x), ...onIf('gi0/1', `ipv6 address 2001:db8:${x}:2::/64 eui-64`, 'no shutdown')];
const EUI_CMDS_A = x => [...EUI_CMDS_I(x), ...onIf('gi0/2', 'ipv6 address autoconfig', 'no shutdown')];
const EUI64 = {
  beginner: {
    sub: 'Give Gi0/0 an EUI-64 address in subnet 1 and bring it up',
    steps: ['On Gi0/0, use ipv6 address with the subnet 1 prefix and the eui-64 keyword.', 'Bring Gi0/0 up.',
      'Check the address the router built with show ipv6 interface brief.'],
    reqs: EUI_B,
    cmds: EUI_CMDS_B,
  },
  intermediate: {
    sub: 'Use EUI-64 on Gi0/0 (subnet 1) and Gi0/1 (subnet 2)',
    steps: ['Give Gi0/0 subnet 1 and Gi0/1 subnet 2, both with eui-64.', 'Bring both interfaces up.',
      'Compare the two interface IDs: only the last digits of the MAC differ.'],
    reqs: EUI_I,
    cmds: EUI_CMDS_I,
  },
  advanced: {
    sub: 'As Intermediate, and let Gi0/2 learn its address from R3 by SLAAC',
    lead: x => `Your prefix is 2001:db8:${x}::/48. R3 on Gi0/2 sends router advertisements for 2001:db8:${x}:3::/64.`,
    steps: ['Keep Gi0/0 and Gi0/1 on EUI-64.', 'On Gi0/2, use ipv6 address autoconfig so the router acts as a SLAAC client.', 'Bring Gi0/2 up.'],
    reqs: EUI_A,
    cmds: EUI_CMDS_A,
  },
  expert: {
    sub: 'As Advanced, and type the EUI-64 address for Gi0/3 (subnet 4) by hand',
    lead: x => `Your prefix is 2001:db8:${x}::/48. R3 on Gi0/2 sends router advertisements for 2001:db8:${x}:3::/64.`,
    steps: ['Keep the Advanced settings.', 'Read the MAC of Gi0/3 with show interfaces gi0/3.',
      'Flip the 7th bit of the first byte and put FFFE in the middle to get the interface ID.',
      'Configure the full address in subnet 4 with /64, without the eui-64 keyword, and bring Gi0/3 up.'],
    reqs: x => [...EUI_A(x), rtReq('gi0/3', 'has the address EUI-64 would build in subnet 4, typed in full',
      i => !i.eui && !!i.ip6 && v6Canon(i.ip6) === v6Canon(euiFull(x)), `ipv6 address ${euiFull(x)}`), rtUp('gi0/3')],
    cmds: x => [...EUI_CMDS_A(x), ...onIf('gi0/3', `ipv6 address ${euiFull(x)}`, 'no shutdown')],
  },
};

// 1.0 route summarization: one static route that covers a block of /24s behind R2 (or R3); the steps never give the mask
const sumRoute = (who, nh, first, last, net, mask) => ({
  text: `R1 has one summary route via ${nh} that covers ${who}'s LANs ${first} to ${last}, and no more than it must`,
  ok: s => R1(s).routes.some(r => r.net === net && r.mask === mask && r.nh === nh),
  hint: {cmds: [`ip route ${net} ${mask} ${nh}`]},
});
// count /24s from 172.<o2>.<start>.0, summarized by one route with the given mask
const block = (o2, start, count, mask) => ({first: `172.${o2}.${start}.0/24`, last: `172.${o2}.${start + count - 1}.0/24`, net: `172.${o2}.${start}.0`, mask});
const SUM_B = x => block(16, 4 * (x % 64), 4, '255.255.252.0');
const SUM_I = x => block(16, 8 * (x % 32), 8, '255.255.248.0');
const SUM_A = x => block(16, 8 * (x % 32), 6, '255.255.248.0'); // six LANs still need the /21
const SUM_E3 = x => block(17, 16 * (x % 16), 16, '255.255.240.0');
const sumLead = (b, who = 'R2', nh = '10.0.0.2') => `${who} (${nh}) has the LANs ${b.first} to ${b.last}.`;
const sumReq = (b, who = 'R2', nh = '10.0.0.2') => sumRoute(who, nh, b.first, b.last, b.net, b.mask);
const sumCmd = (b, nh = '10.0.0.2') => `ip route ${b.net} ${b.mask} ${nh}`;
const SUMMARY = {
  beginner: {
    sub: 'Reach four LANs behind R2 with one summary route',
    lead: x => sumLead(SUM_B(x)) + ' R1 Gi0/1 is 10.0.0.1/30.',
    steps: ['Address Gi0/1 as 10.0.0.1/30 and bring it up.', 'Write the four networks in binary and find the bits they share.',
      'Add one static route for that summary via 10.0.0.2.'],
    reqs: x => [...WAN_IF, sumReq(SUM_B(x))],
    cmds: x => [...WAN_CMDS, sumCmd(SUM_B(x))],
  },
  intermediate: {
    sub: 'Reach eight LANs behind R2 with one summary route',
    lead: x => sumLead(SUM_I(x)) + ' R1 Gi0/1 is 10.0.0.1/30.',
    steps: ['Address Gi0/1 and bring it up.', 'Find the bits the eight networks share.', 'Add one summary route via 10.0.0.2.'],
    reqs: x => [...WAN_IF, sumReq(SUM_I(x))],
    cmds: x => [...WAN_CMDS, sumCmd(SUM_I(x))],
  },
  advanced: {
    sub: 'Reach six LANs behind R2 with the smallest summary that covers them',
    lead: x => sumLead(SUM_A(x)) + ' R1 Gi0/1 is 10.0.0.1/30.',
    steps: ['Address Gi0/1 and bring it up.', 'Six is not a power of two: find the smallest block that holds all six.',
      'Add one summary route via 10.0.0.2.'],
    reqs: x => [...WAN_IF, sumReq(SUM_A(x))],
    cmds: x => [...WAN_CMDS, sumCmd(SUM_A(x))],
  },
  expert: {
    sub: 'Summarize the LANs behind R2 and the sixteen LANs behind R3, one route each',
    lead: x => `${sumLead(SUM_B(x))} ${sumLead(SUM_E3(x), 'R3', '10.0.1.2')} R1 Gi0/1 is 10.0.0.1/30 and Gi0/2 is 10.0.1.1/30.`,
    steps: ['Address Gi0/1 and Gi0/2 and bring them up.', 'Add one summary route for R2\'s LANs via 10.0.0.2.',
      'Add one summary route for R3\'s LANs via 10.0.1.2.'],
    reqs: x => [...WAN_IF, ...R3_IF, sumReq(SUM_B(x)), sumReq(SUM_E3(x), 'R3', '10.0.1.2')],
    cmds: x => [...WAN_CMDS, ...R3_CMDS, sumCmd(SUM_B(x)), sumCmd(SUM_E3(x), '10.0.1.2')],
  },
};

// 2.0 voice VLAN: an IP phone on Fa0/1 (and Fa0/2) with a PC behind it
const swVoice = (p, id) => swReq(p, `carries voice VLAN ${id}`, q => q.voice === id, `switchport voice vlan ${id}`);
const phonePort = p => [swAccess(p, 10), swVoice(p, 150), swUp(p)];
const phoneCmds = p => onIf(p, 'switchport mode access', 'switchport access vlan 10', 'switchport voice vlan 150', 'no shutdown');
const VOICE_LEAD = 'An IP phone is on S1 Fa0/1 with PC1 plugged into the phone. Another phone and PC2 are on Fa0/2.';
const VOICE_I = [swVlan(10, 'DATA'), swVlan(150, 'VOICE'), ...phonePort('fa0/1'), ...phonePort('fa0/2')];
const VOICE_I_CMDS = ['vlan 10', 'name DATA', 'exit', 'vlan 150', 'name VOICE', 'exit', ...phoneCmds('fa0/1'), ...phoneCmds('fa0/2')];
const VOICEVLAN = {
  beginner: {
    sub: 'Put the PC on Fa0/1 in data VLAN 10 and the phone in voice VLAN 150',
    steps: ['Create VLANs 10 and 150.', 'Make Fa0/1 an access port in VLAN 10.', 'Add switchport voice vlan 150 on Fa0/1 and bring it up.'],
    reqs: [swVlan(10), swVlan(150), ...phonePort('fa0/1')],
    ...onS1(['vlan 10', 'exit', 'vlan 150', 'exit', ...phoneCmds('fa0/1')]),
  },
  intermediate: {
    sub: 'Name the VLANs DATA and VOICE, and set up Fa0/2 the same way',
    steps: ['Name VLAN 10 DATA and VLAN 150 VOICE.', 'Give Fa0/1 and Fa0/2 data VLAN 10 and voice VLAN 150.', 'Bring both ports up.'],
    reqs: VOICE_I,
    ...onS1(VOICE_I_CMDS),
  },
  advanced: {
    sub: 'As Intermediate, with PortFast on both phone ports',
    steps: ['Keep the Intermediate settings.', 'Enable PortFast on Fa0/1 and Fa0/2 so the phones come up fast.'],
    reqs: [...VOICE_I, swPortfast('fa0/1'), swPortfast('fa0/2')],
    ...onS1([...VOICE_I_CMDS, ...onIf('fa0/1', 'spanning-tree portfast'), ...onIf('fa0/2', 'spanning-tree portfast')]),
  },
  expert: {
    sub: 'As Advanced, and trunk Gi0/1 to R1 carrying only VLANs 10 and 150',
    steps: ['Keep the Advanced settings.', 'Make Gi0/1 a trunk, allow only VLANs 10 and 150, and bring it up.'],
    reqs: [...VOICE_I, swPortfast('fa0/1'), swPortfast('fa0/2'), swTrunk('gi0/1'), swAllowed('gi0/1', [10, 150]), swUp('gi0/1')],
    ...onS1([...VOICE_I_CMDS, ...onIf('fa0/1', 'spanning-tree portfast'), ...onIf('fa0/2', 'spanning-tree portfast'),
      ...onIf('gi0/1', 'switchport mode trunk', 'switchport trunk allowed vlan 10,150', 'no shutdown')]),
  },
};

// 2.0 trunk troubleshooting between S1 and S2: each level starts from a broken preset config (setup)
const SW2_TOPO = {
  nodes: [
    {id: 'S1', type: 'switch', x: 8, y: 40, sub: 'Switch'},
    {id: 'S2', type: 'switch', x: 190, y: 40, sub: 'Switch'},
    {id: 'PC1', type: 'pc', x: 190, y: 120, sub: 'VLAN 10', at: 'S1 fa0/1'},
    {id: 'PC2', type: 'pc', x: 370, y: 40, sub: 'VLAN 10', at: 'S2 fa0/1'},
  ],
  links: [{a: 'S1', b: 'S2', port: 'Gi0/1'}, {a: 'S1', b: 'PC1', port: 'Fa0/1'}, {a: 'S2', b: 'PC2', port: 'Fa0/1'}],
  home: 'S1',
};
const TRUNKFIX_LEAD = 'S1 Gi0/1 is cabled to S2 Gi0/1, but VLAN traffic does not cross the link. Find what is wrong with show interfaces trunk and show running-config, and fix it.';
// what both switches already have: the VLANs and PC1/PC2 in VLAN 10
const SW2_BASE = ['vlan 10', 'name USERS', 'exit', 'vlan 20', 'name SERVERS', 'exit', 'vlan 99', 'name NATIVE', 'exit',
  ...onIf('fa0/1', 'switchport mode access', 'switchport access vlan 10', 'no shutdown')];
const uplink = (...lines) => onIf('gi0/1', ...lines, 'no shutdown');
const bothTrunk = ['S1', 'S2'].flatMap(d => [devReq(d, 'gi0/1', 'is a trunk', q => q.mode === 'trunk', 'switchport mode trunk'),
  devReq(d, 'gi0/1', 'is up', q => !q.shut, 'no shutdown')]);
const bothNative = ['S1', 'S2'].map(d => devReq(d, 'gi0/1', 'uses native VLAN 99', q => q.native === 99, 'switchport trunk native vlan 99'));
const bothAllowed = ['S1', 'S2'].map(d => devReq(d, 'gi0/1', 'allows VLANs 10, 20 and 99', q => !!q.allowed && q.allowed.join(',') === '10,20,99',
  'switchport trunk allowed vlan add 20'));
const bothNoneg = ['S1', 'S2'].map(d => devReq(d, 'gi0/1', 'does not send DTP frames', q => q.noneg, 'switchport nonegotiate'));
const TRUNKFIX = {
  beginner: {
    sub: 'S2 does not trunk: fix its side of the link',
    steps: ['On S2, run show interfaces trunk: Gi0/1 is missing.', 'Check Gi0/1 in show running-config on S2.', 'Make S2 Gi0/1 a trunk.'],
    setup: [['S1', [...SW2_BASE, ...uplink('switchport mode trunk')]], ['S2', [...SW2_BASE, ...uplink('switchport mode access')]]],
    reqs: bothTrunk,
    cmds: [],
    then: [onDev('S2', ...onIf('gi0/1', 'switchport mode trunk'))],
  },
  intermediate: {
    sub: 'Fix the native VLAN mismatch: both sides must use native VLAN 99',
    steps: ['Compare the native VLAN of Gi0/1 on S1 and S2 with show interfaces trunk.', 'Set the side that is wrong to native VLAN 99.'],
    setup: [['S1', [...SW2_BASE, ...uplink('switchport mode trunk', 'switchport trunk native vlan 99')]],
      ['S2', [...SW2_BASE, ...uplink('switchport mode trunk')]]],
    reqs: [...bothTrunk, ...bothNative],
    cmds: [],
    then: [onDev('S2', ...onIf('gi0/1', 'switchport trunk native vlan 99'))],
  },
  advanced: {
    sub: 'VLAN 20 does not cross the trunk: add it to the allowed list without retyping the list',
    steps: ['Compare the allowed VLANs on both sides.', 'On the side that is missing VLAN 20, use switchport trunk allowed vlan add 20.'],
    setup: [['S1', [...SW2_BASE, ...uplink('switchport mode trunk', 'switchport trunk native vlan 99', 'switchport trunk allowed vlan 10,99')]],
      ['S2', [...SW2_BASE, ...uplink('switchport mode trunk', 'switchport trunk native vlan 99', 'switchport trunk allowed vlan 10,20,99')]]],
    reqs: [...bothTrunk, ...bothNative, ...bothAllowed],
    cmds: [...onIf('gi0/1', 'switchport trunk allowed vlan add 20')],
  },
  expert: {
    sub: 'Both sides are dynamic auto, so no trunk forms: make it a static trunk with DTP off',
    steps: ['Run show interfaces gi0/1 switchport on both switches: dynamic auto on both ends never forms a trunk.', 'On both switches, make Gi0/1 a trunk.',
      'Then turn off DTP on both ends with switchport nonegotiate (it is refused while the port is dynamic).'],
    setup: ['S1', 'S2'].map(d => [d, [...SW2_BASE, ...uplink('switchport mode dynamic auto', 'switchport trunk native vlan 99',
      'switchport trunk allowed vlan 10,20,99')]]),
    reqs: [...bothTrunk, ...bothNative, ...bothAllowed, ...bothNoneg],
    cmds: onIf('gi0/1', 'switchport mode trunk', 'switchport nonegotiate'),
    then: [onDev('S2', ...onIf('gi0/1', 'switchport mode trunk', 'switchport nonegotiate'))],
  },
};

// 3.0 IPv6 static and default routes on R1; R2 is 2001:db8:acad:1::2 on Gi0/1 and R3 2001:db8:acad:2::2 on Gi0/2
const route6Req = (prefix, iface, nh, dist = 1) => {
  const want = {prefix, iface, nh, dist};
  return {
    text: `R1 has an IPv6 route to ${prefix}${iface ? ` out ${iface}` : ''}${nh ? ` via ${nh}` : ''}${dist !== 1 ? ` with distance ${dist}` : ''}`,
    ok: s => R1(s).routes6.some(r => sameRoute6(r, want) && r.dist === dist),
    hint: {cmds: [route6Text(want)]},
  };
};
const R2_V6 = '2001:db8:acad:1::2', R3_V6 = '2001:db8:acad:2::2';
const V6RT_LEAD = x => `R2 (${R2_V6}) on Gi0/1 leads to the remote LAN 2001:db8:${x}:100::/64. R3 (${R3_V6}) is on Gi0/2.`;
const V6RT_B = x => [V6_ROUTING, ...v6If('gi0/1', '2001:db8:acad:1::1/64'), route6Req(`2001:db8:${x}:100::/64`, null, R2_V6)];
const V6RT_B_CMDS = x => ['ipv6 unicast-routing', ...onIf('gi0/1', 'ipv6 address 2001:db8:acad:1::1/64', 'no shutdown'),
  `ipv6 route 2001:db8:${x}:100::/64 ${R2_V6}`];
const R3_V6_IF = v6If('gi0/2', '2001:db8:acad:2::1/64');
const R3_V6_CMDS = onIf('gi0/2', 'ipv6 address 2001:db8:acad:2::1/64', 'no shutdown');
const IPV6ROUTING = {
  beginner: {
    sub: 'Turn on IPv6 routing and add a static route to the remote LAN via R2',
    steps: ['Turn on ipv6 unicast-routing.', 'Address Gi0/1 as 2001:db8:acad:1::1/64 and bring it up.',
      'Add a static route for 2001:db8:x:100::/64 via R2.'],
    reqs: V6RT_B,
    cmds: V6RT_B_CMDS,
  },
  intermediate: {
    sub: 'As Beginner, and add an IPv6 default route via R2',
    steps: ['Keep the Beginner settings.', 'Add a default route ::/0 via R2.'],
    reqs: x => [...V6RT_B(x), route6Req('::/0', null, R2_V6)],
    cmds: x => [...V6RT_B_CMDS(x), `ipv6 route ::/0 ${R2_V6}`],
  },
  advanced: {
    sub: 'As Intermediate, and add a floating default route via R3 with distance 150',
    steps: ['Keep the Intermediate settings.', 'Address Gi0/2 as 2001:db8:acad:2::1/64 and bring it up.',
      'Add a backup default route via R3 with administrative distance 150.'],
    reqs: x => [...V6RT_B(x), route6Req('::/0', null, R2_V6), ...R3_V6_IF, route6Req('::/0', null, R3_V6, 150)],
    cmds: x => [...V6RT_B_CMDS(x), `ipv6 route ::/0 ${R2_V6}`, ...R3_V6_CMDS, `ipv6 route ::/0 ${R3_V6} 150`],
  },
  expert: {
    sub: 'Send the default route out Gi0/1 to R2\'s link-local fe80::2, with R3 as a floating backup',
    steps: ['Keep the Beginner settings and address Gi0/2.', 'A link-local next hop needs the exit interface: add ::/0 out Gi0/1 via fe80::2.',
      'Add the backup default route via R3 with distance 150.'],
    reqs: x => [...V6RT_B(x), route6Req('::/0', 'Gi0/1', 'fe80::2'), ...R3_V6_IF, route6Req('::/0', null, R3_V6, 150)],
    cmds: x => [...V6RT_B_CMDS(x), 'ipv6 route ::/0 gi0/1 fe80::2', ...R3_V6_CMDS, `ipv6 route ::/0 ${R3_V6} 150`],
  },
};

// 3.0 multi-area OSPF and tuning on R1 (process 1)
const OSPFADV_LEAD = x => `R1 Gi0/0 serves 192.168.${x}.0/24 in area 1. R2 on Gi0/1 is in the backbone (area 0).`;
const OSPFADV_B = x => [...BOTH_IFS(x), ospfIn('gi0/0', 1, `network 192.168.${x}.0 0.0.0.255 area 1`),
  ospfIn('gi0/1', 0, 'network 10.0.0.0 0.0.0.3 area 0')];
const OSPFADV_B_CMDS = x => [...BOTH_CMDS(x), 'router ospf 1', `network 192.168.${x}.0 0.0.0.255 area 1`, 'network 10.0.0.0 0.0.0.3 area 0', 'exit'];
const OSPFADV_I = x => [...OSPFADV_B(x), rtReq('gi0/0', 'has OSPF priority 255 so R1 wins the DR election', i => i.ospfPrio === 255, 'ip ospf priority 255'),
  rtReq('gi0/1', 'has OSPF priority 0 so R1 never becomes DR there', i => i.ospfPrio === 0, 'ip ospf priority 0')];
const OSPFADV_I_CMDS = x => [...OSPFADV_B_CMDS(x), ...onIf('gi0/0', 'ip ospf priority 255'), ...onIf('gi0/1', 'ip ospf priority 0')];
const OSPF_REFBW = {text: 'OSPF uses a reference bandwidth of 10000 Mbit/s', ok: s => R1(s).ospf.refBw === 10000,
  hint: {cmds: ['router ospf 1', 'auto-cost reference-bandwidth 10000']}};
const OSPFADV_A = x => [...OSPFADV_I(x), OSPF_REFBW, ...R3_IF, ospfIn('gi0/2', 0, 'network 10.0.1.0 0.0.0.3 area 0'),
  rtReq('gi0/2', 'has OSPF cost 50', i => i.ospfCost === 50, 'ip ospf cost 50')];
const OSPFADV_A_CMDS = x => [...OSPFADV_I_CMDS(x), ...R3_CMDS, ...onIf('gi0/2', 'ip ospf cost 50'),
  'router ospf 1', 'auto-cost reference-bandwidth 10000', 'network 10.0.1.0 0.0.0.3 area 0', 'exit'];
const p2p = k => rtReq(k, 'is an OSPF point-to-point network (no DR election)', i => i.ospfP2p, 'ip ospf network point-to-point');
const OSPFADV = {
  beginner: {
    sub: 'Make R1 an ABR: Gi0/0 in area 1 and Gi0/1 in area 0',
    lead: OSPFADV_LEAD,
    steps: ['Address Gi0/0 and Gi0/1 and bring them up.', 'Start router ospf 1.', 'Put the LAN in area 1 and the link to R2 in area 0.'],
    reqs: OSPFADV_B,
    cmds: OSPFADV_B_CMDS,
  },
  intermediate: {
    sub: 'As Beginner, and control the DR election with OSPF priority',
    lead: OSPFADV_LEAD,
    steps: ['Keep the Beginner settings.', 'Give Gi0/0 priority 255 so R1 is DR on the LAN.', 'Give Gi0/1 priority 0 so R1 is never DR there.'],
    reqs: OSPFADV_I,
    cmds: OSPFADV_I_CMDS,
  },
  advanced: {
    sub: 'As Intermediate, set the reference bandwidth to 10 Gbit/s and add R3 with cost 50',
    lead: x => `${OSPFADV_LEAD(x)} R3 on Gi0/2 is also in area 0.`,
    steps: ['Keep the Intermediate settings.', 'Set auto-cost reference-bandwidth 10000 so 1 and 10 Gbit/s links get different costs.',
      'Address Gi0/2 as 10.0.1.1/30, put it in area 0 and give it ip ospf cost 50.'],
    reqs: OSPFADV_A,
    cmds: OSPFADV_A_CMDS,
  },
  expert: {
    sub: 'As Advanced, make both WAN links point-to-point and advertise a default route via R2',
    lead: x => `${OSPFADV_LEAD(x)} R3 on Gi0/2 is also in area 0. R2 is the way to the internet.`,
    steps: ['Keep the Advanced settings.', 'Set ip ospf network point-to-point on Gi0/1 and Gi0/2.',
      'Add a static default route via 10.0.0.2 and default-information originate under OSPF.'],
    reqs: x => [...OSPFADV_A(x), p2p('gi0/1'), p2p('gi0/2'), DEFAULT_VIA_R2, OSPF_ORIGINATE],
    cmds: x => [...OSPFADV_A_CMDS(x), ...onIf('gi0/1', 'ip ospf network point-to-point'), ...onIf('gi0/2', 'ip ospf network point-to-point'),
      DEFAULT_CMD, 'router ospf 1', 'default-information originate', 'exit'],
  },
};

// 3.0 HSRP: R1 and R2 share the LAN through S1 and give PC1 one virtual gateway (.1); R1 is .2 and R2 .3
const HSRP_TOPO = {
  nodes: [
    {id: 'R1', type: 'router', x: 8, y: 14, sub: 'Router'},
    {id: 'R2', type: 'router', x: 8, y: 114, sub: 'Router'},
    {id: 'S1', type: 'switch', x: 190, y: 64, sub: 'Switch'},
    {id: 'PC1', type: 'pc', x: 370, y: 64, sub: 'Host', at: 'S1 fa0/1'},
  ],
  links: [{a: 'R1', b: 'S1', port: 'Gi0/0'}, {a: 'R2', b: 'S1', port: 'Gi0/0'}, {a: 'S1', b: 'PC1', port: 'Fa0/1'}],
  home: 'R1',
};
const HSRP_LEAD = x => `R1 and R2 both sit on 192.168.${x}.0/24 through S1. PC1 needs a gateway that keeps working when one router fails.`;
const hsrpBase = (dev, x, host, grp) => [
  devReq(dev, 'gi0/0', `is 192.168.${x}.${host} ${MASK24}`, i => i.ip === `192.168.${x}.${host}` && i.mask === MASK24, `ip address 192.168.${x}.${host} ${MASK24}`),
  devReq(dev, 'gi0/0', 'is up', i => !i.shut, 'no shutdown'),
  devReq(dev, 'gi0/0', `is in HSRP group ${grp} with virtual IP 192.168.${x}.1`, i => i.hsrp?.grp === grp && i.hsrp.vip === `192.168.${x}.1`,
    `standby ${grp} ip 192.168.${x}.1`),
];
const hsrpCmds = (x, host, grp, ...more) => onIf('gi0/0', `ip address 192.168.${x}.${host} ${MASK24}`, `standby ${grp} ip 192.168.${x}.1`, ...more, 'no shutdown');
const hsrpActive = grp => [
  devReq('R1', 'gi0/0', 'has HSRP priority 110', i => i.hsrp?.grp === grp && i.hsrp.prio === 110, `standby ${grp} priority 110`),
  devReq('R1', 'gi0/0', 'takes the active role back (preempt)', i => i.hsrp?.grp === grp && i.hsrp.preempt, `standby ${grp} preempt`),
];
const hsrpV2 = dev => devReq(dev, 'gi0/0', 'runs HSRP version 2', i => i.hsrpVer === 2, 'standby version 2');
const HSRP = {
  beginner: {
    sub: 'Address R1 Gi0/0 as .2 and make it offer the virtual gateway .1 in HSRP group 1',
    steps: ['On R1, address Gi0/0 as 192.168.x.2/24 and bring it up.', 'Add standby 1 ip 192.168.x.1.'],
    reqs: x => hsrpBase('R1', x, 2, 1),
    cmds: x => hsrpCmds(x, 2, 1),
  },
  intermediate: {
    sub: 'As Beginner, and add R2 (.3) to the same HSRP group',
    steps: ['Keep R1 as in Beginner.', 'Open R2: address Gi0/0 as 192.168.x.3/24, bring it up and add standby 1 ip 192.168.x.1.'],
    reqs: x => [...hsrpBase('R1', x, 2, 1), ...hsrpBase('R2', x, 3, 1)],
    cmds: x => hsrpCmds(x, 2, 1),
    then: x => [onDev('R2', ...hsrpCmds(x, 3, 1))],
  },
  advanced: {
    sub: 'As Intermediate, and make R1 the active router with priority 110 and preempt',
    steps: ['Keep both routers in group 1.', 'On R1, set standby 1 priority 110 and standby 1 preempt.', 'Check with show standby brief.'],
    reqs: x => [...hsrpBase('R1', x, 2, 1), ...hsrpBase('R2', x, 3, 1), ...hsrpActive(1)],
    cmds: x => hsrpCmds(x, 2, 1, 'standby 1 priority 110', 'standby 1 preempt'),
    then: x => [onDev('R2', ...hsrpCmds(x, 3, 1))],
  },
  expert: {
    sub: 'Use HSRP version 2 and group 10 on both routers, R1 active, and point PC1 at the virtual gateway',
    steps: ['On both routers, set standby version 2 first, then use group 10 for the virtual IP .1.',
      'On R1, give group 10 priority 110 and preempt.', 'On PC1, set 192.168.x.10/24 with gateway 192.168.x.1.'],
    reqs: x => [...hsrpBase('R1', x, 2, 10), ...hsrpBase('R2', x, 3, 10), hsrpV2('R1'), hsrpV2('R2'), ...hsrpActive(10),
      pcStatic('PC1', `192.168.${x}.10`, `192.168.${x}.1`)],
    cmds: x => [...onIf('gi0/0', 'standby version 2'), ...hsrpCmds(x, 2, 10, 'standby 10 priority 110', 'standby 10 preempt')],
    then: x => [onDev('R2', ...onIf('gi0/0', 'standby version 2'), ...hsrpCmds(x, 3, 10)), ['PC1', [`ip 192.168.${x}.10 ${MASK24} 192.168.${x}.1`]]],
  },
};

// 4.0 SSH on R1
const SSH_DOMAIN = {text: 'The domain name is lab.local', ok: s => R1(s).sec.domain === 'lab.local', hint: {cmds: ['ip domain-name lab.local']}};
const SSH_RSA = {text: 'R1 has an RSA key of at least 2048 bits', ok: s => R1(s).sec.rsa >= 2048, hint: {cmds: ['crypto key generate rsa modulus 2048']}};
const userAdmin = {text: 'A local user admin exists', ok: s => !!R1(s).users.admin, hint: {cmds: ['username admin secret <word>']}};
const SSH_B = [SSH_DOMAIN, SSH_RSA, userAdmin];
const SSH_I = [...SSH_B, lineCheck('vty', 'VTY lines accept SSH only', l => l.transport === 'ssh', 'transport input ssh'),
  lineCheck('vty', 'VTY lines log in with the local user database', l => l.local, 'login local')];
const SSH_V2 = {text: 'Only SSH version 2 is allowed', ok: s => R1(s).sec.sshVer === 2, hint: {cmds: ['ip ssh version 2']}};
const SSH_A = [...SSH_I, SSH_V2, lineCheck('vty', 'Idle VTY sessions end after 10 minutes', l => l.timeout === '10 0', 'exec-timeout 10 0')];
const SSH_B_CMDS = ['ip domain-name lab.local', 'crypto key generate rsa modulus 2048', 'username admin secret Cisco123'];
const SSH_I_CMDS = [...SSH_B_CMDS, 'line vty 0 4', 'transport input ssh', 'login local', 'exit'];
const SSH_A_CMDS = [...SSH_I_CMDS, 'ip ssh version 2', 'line vty 0 4', 'exec-timeout 10 0', 'exit'];
const SSH_LEAD = 'R1 is reachable over the network, but only by Telnet. Its hostname is already set.';
const SSH = {
  beginner: {
    sub: 'Prepare R1 for SSH: domain name, RSA key and a local user',
    steps: ['Set ip domain-name lab.local (the key is named after hostname and domain).', 'Generate a 2048-bit RSA key.',
      'Create the local user admin with a secret.'],
    reqs: SSH_B,
    cmds: SSH_B_CMDS,
  },
  intermediate: {
    sub: 'As Beginner, and allow only SSH on the VTY lines with local login',
    steps: ['Keep the Beginner settings.', 'Under line vty 0 4, set transport input ssh.', 'Use login local so users log in as admin.'],
    reqs: SSH_I,
    cmds: SSH_I_CMDS,
  },
  advanced: {
    sub: 'As Intermediate, force SSH version 2 and time out idle sessions after 10 minutes',
    steps: ['Keep the Intermediate settings.', 'Set ip ssh version 2.', 'Under line vty 0 4, set exec-timeout 10 0.'],
    reqs: SSH_A,
    cmds: SSH_A_CMDS,
  },
  expert: {
    sub: 'As Advanced, and let only the 192.168.x.0/24 LAN open SSH sessions',
    steps: ['Keep the Advanced settings.', 'Create standard ACL 10 that permits 192.168.x.0 0.0.0.255.',
      'Apply it to the VTY lines with access-class 10 in.'],
    reqs: x => [...SSH_A, aclEntries('10', 'standard', [`permit 192.168.${x}.0 0.0.0.255`]),
      lineCheck('vty', 'VTY lines filter sessions with ACL 10', l => l.acIn === '10', 'access-class 10 in')],
    cmds: x => [...SSH_A_CMDS, `access-list 10 permit 192.168.${x}.0 0.0.0.255`, 'line vty 0 4', 'access-class 10 in', 'exit'],
  },
};

// 5.0 AAA with local authentication on R1
const AAA_ON = {text: 'AAA is enabled', ok: s => R1(s).aaa.on, hint: {cmds: ['aaa new-model']}};
const aaaList = (name, methods) => ({text: `Login list ${name} uses ${methods}`, ok: s => R1(s).aaa.lists[name] === methods,
  hint: {cmds: [`aaa authentication login ${name} ${methods}`]}});
const AAA_B = [AAA_ON, userAdmin, aaaList('default', 'local')];
const AAA_I = [...AAA_B, aaaList('VTY-AUTH', 'local')];
const AAA_A = [...AAA_I, lineCheck('vty', 'VTY lines use the login list VTY-AUTH', l => l.authList === 'VTY-AUTH', 'login authentication VTY-AUTH')];
const AAA_B_CMDS = ['username admin secret Cisco123', 'aaa new-model', 'aaa authentication login default local'];
const AAA_I_CMDS = [...AAA_B_CMDS, 'aaa authentication login VTY-AUTH local'];
const AAA_A_CMDS = [...AAA_I_CMDS, 'line vty 0 4', 'login authentication VTY-AUTH', 'exit'];
const AAA_LEAD = 'R1 still uses line passwords. Move its logins to AAA with the local user database.';
const AAA = {
  beginner: {
    sub: 'Turn on AAA and make the default login list use local users',
    steps: ['Create the local user admin with a secret first, so you do not lock yourself out.', 'Turn on aaa new-model.',
      'Add aaa authentication login default local.'],
    reqs: AAA_B,
    cmds: AAA_B_CMDS,
  },
  intermediate: {
    sub: 'As Beginner, and add a named login list VTY-AUTH that uses local users',
    steps: ['Keep the Beginner settings.', 'Add aaa authentication login VTY-AUTH local.'],
    reqs: AAA_I,
    cmds: AAA_I_CMDS,
  },
  advanced: {
    sub: 'As Intermediate, and apply VTY-AUTH to the VTY lines',
    steps: ['Keep the Intermediate settings.', 'Under line vty 0 4, set login authentication VTY-AUTH.'],
    reqs: AAA_A,
    cmds: AAA_A_CMDS,
  },
  expert: {
    sub: 'As Advanced, protect privileged mode and point the console at the default list',
    steps: ['Keep the Advanced settings.', 'Set an enable secret.', 'Under line console 0, set login authentication default.'],
    reqs: [...AAA_A, HARDEN_BASE[1], lineCheck('console', 'The console uses the default login list', l => l.authList === 'default', 'login authentication default')],
    cmds: [...AAA_A_CMDS, 'enable secret class', 'line console 0', 'login authentication default', 'exit'],
  },
};

// 5.0 DHCP snooping and dynamic ARP inspection on S1; R1 behind Gi0/1 is the only real DHCP server
const SNOOP_ON = {text: 'DHCP snooping is on', ok: s => SW(s).snoop.on, hint: {cmds: ['ip dhcp snooping']}};
const snoopVlan = id => ({text: `DHCP snooping covers VLAN ${id}`, ok: s => SW(s).snoop.vlans.includes(id), hint: {cmds: [`ip dhcp snooping vlan ${id}`]}});
const SNOOP_TRUST = swReq('gi0/1', 'is trusted for DHCP snooping', q => q.trust, 'ip dhcp snooping trust');
const SNOOP_NO82 = {text: 'S1 does not insert option 82', ok: s => !SW(s).snoop.opt82, hint: {cmds: ['no ip dhcp snooping information option']}};
const snoopRate = p => swReq(p, 'limits DHCP to 10 packets per second', q => q.rate === 10, 'ip dhcp snooping limit rate 10');
const SNOOP_LEAD = 'R1 behind S1 Gi0/1 is the only real DHCP server. PC1 and PC2 are on Fa0/1 and Fa0/2.';
const snoopCmds = vlan => ['ip dhcp snooping', `ip dhcp snooping vlan ${vlan}`, ...onIf('gi0/1', 'ip dhcp snooping trust')];
const rateCmds = ['fa0/1', 'fa0/2'].flatMap(p => onIf(p, 'ip dhcp snooping limit rate 10'));
const VLAN10_PCS = [swVlan(10), swAccess('fa0/1', 10), swAccess('fa0/2', 10)];
const VLAN10_CMDS = ['vlan 10', 'exit', ...['fa0/1', 'fa0/2'].flatMap(p => onIf(p, 'switchport mode access', 'switchport access vlan 10'))];
const DHCPSNOOP = {
  beginner: {
    sub: 'Turn on DHCP snooping for VLAN 1 and trust the port to R1',
    steps: ['Turn on ip dhcp snooping.', 'Turn it on for VLAN 1.', 'Trust Gi0/1, where the real server is.'],
    reqs: [SNOOP_ON, snoopVlan(1), SNOOP_TRUST],
    ...onS1(snoopCmds(1)),
  },
  intermediate: {
    sub: 'As Beginner, and stop S1 inserting option 82',
    steps: ['Keep the Beginner settings.', 'Turn off option 82 insertion, which R1 would otherwise reject.'],
    reqs: [SNOOP_ON, snoopVlan(1), SNOOP_TRUST, SNOOP_NO82],
    ...onS1([...snoopCmds(1), 'no ip dhcp snooping information option']),
  },
  advanced: {
    sub: 'As Intermediate, and rate-limit DHCP on the PC ports to stop starvation attacks',
    steps: ['Keep the Intermediate settings.', 'Limit DHCP on Fa0/1 and Fa0/2 to 10 packets per second.'],
    reqs: [SNOOP_ON, snoopVlan(1), SNOOP_TRUST, SNOOP_NO82, snoopRate('fa0/1'), snoopRate('fa0/2')],
    ...onS1([...snoopCmds(1), 'no ip dhcp snooping information option', ...rateCmds]),
  },
  expert: {
    sub: 'Move the PCs to VLAN 10 and protect that VLAN with the Advanced settings',
    steps: ['Create VLAN 10 and make Fa0/1 and Fa0/2 access ports in it.', 'Turn on snooping for VLAN 10, trust Gi0/1 and turn off option 82.',
      'Rate-limit DHCP on Fa0/1 and Fa0/2 to 10 packets per second.'],
    reqs: [...VLAN10_PCS, SNOOP_ON, snoopVlan(10), SNOOP_TRUST, SNOOP_NO82, snoopRate('fa0/1'), snoopRate('fa0/2')],
    ...onS1([...VLAN10_CMDS, ...snoopCmds(10), 'no ip dhcp snooping information option', ...rateCmds]),
  },
};

const daiVlan = id => ({text: `ARP inspection covers VLAN ${id}`, ok: s => SW(s).dai.vlans.includes(id), hint: {cmds: [`ip arp inspection vlan ${id}`]}});
const DAI_TRUST = swReq('gi0/1', 'is trusted for ARP inspection', q => q.daiTrust, 'ip arp inspection trust');
const daiChecks = (list, text) => ({text, ok: s => list.every(v => SW(s).dai.validate.includes(v)), hint: {cmds: [`ip arp inspection validate ${list.join(' ')}`]}});
const DAI_SRC = daiChecks(['src-mac'], 'ARP inspection checks the source MAC');
const DAI_ALL = daiChecks(['src-mac', 'dst-mac', 'ip'], 'ARP inspection checks source MAC, destination MAC and IP addresses');
const daiBase = vlan => [SNOOP_ON, snoopVlan(vlan), SNOOP_TRUST, daiVlan(vlan), DAI_TRUST];
const daiCmds = vlan => [...snoopCmds(vlan), `ip arp inspection vlan ${vlan}`, ...onIf('gi0/1', 'ip arp inspection trust')];
const DAI_LEAD = 'R1 behind S1 Gi0/1 is the gateway and DHCP server. PC1 and PC2 on Fa0/1 and Fa0/2 get their addresses by DHCP.';
const DAI = {
  beginner: {
    sub: 'Turn on DHCP snooping, then ARP inspection for VLAN 1, trusting the port to R1',
    steps: ['DAI checks ARP against the snooping table: turn on DHCP snooping for VLAN 1 and trust Gi0/1.',
      'Turn on ip arp inspection vlan 1.', 'Trust Gi0/1 for ARP inspection too.'],
    reqs: daiBase(1),
    ...onS1(daiCmds(1)),
  },
  intermediate: {
    sub: 'As Beginner, and also check the source MAC of ARP packets',
    steps: ['Keep the Beginner settings.', 'Add ip arp inspection validate src-mac.'],
    reqs: [...daiBase(1), DAI_SRC],
    ...onS1([...daiCmds(1), 'ip arp inspection validate src-mac']),
  },
  advanced: {
    sub: 'As Beginner, and check source MAC, destination MAC and IP together',
    steps: ['Keep the Beginner settings.', 'Each validate line replaces the last one, so list all three checks in one command.'],
    reqs: [...daiBase(1), DAI_ALL],
    ...onS1([...daiCmds(1), 'ip arp inspection validate src-mac dst-mac ip']),
  },
  expert: {
    sub: 'Move the PCs to VLAN 10 and protect it with snooping and full ARP inspection',
    steps: ['Create VLAN 10 and make Fa0/1 and Fa0/2 access ports in it.', 'Turn on snooping and ARP inspection for VLAN 10, trusting Gi0/1 for both.',
      'Validate source MAC, destination MAC and IP.'],
    reqs: [...VLAN10_PCS, ...daiBase(10), DAI_ALL],
    ...onS1([...VLAN10_CMDS, ...daiCmds(10), 'ip arp inspection validate src-mac dst-mac ip']),
  },
};

// The lab build for each topic with labs, keyed by its id in CATALOGUE (js/topics.js).
// showNet and maskRule only matter for the IPv4 addressing topics.
const NET_LEAD = x => `Your network is 192.168.${x}.0/24. R1 has no addressing yet.`;
const LABS = {
  ipv4: {kind: 'v4', showNet: true, maskRule: 'the correct mask', lead: NET_LEAD, levels: IPV4},
  subnetting: {kind: 'v4', maskRule: 'the correct mask', lead: NET_LEAD, levels: SUBNET},
  vlsm: {kind: 'v4', maskRule: 'the smallest mask that fits its hosts',
    lead: x => `Your network is 192.168.${x}.0/24. Each LAN has a host requirement.`, levels: VLSM},
  ipv6: {kind: 'v6', lead: x => `Your prefix is 2001:db8:${x}::/48. R1 has no IPv6 addressing yet.`, levels: IPV6},
  cdp: {kind: 'sw', levels: CDP},
  vlans: {kind: 'sw', lead: SW_LEAD, levels: VLANS},
  access: {kind: 'sw', lead: SW_LEAD, levels: ACCESS},
  trunk: {kind: 'sw', lead: SW_LEAD, levels: TRUNK},
  stp: {kind: 'sw', lead: SW_LEAD, levels: STP},
  advstp: {kind: 'sw', lead: SW_LEAD, levels: ADVSTP},
  etherchannel: {kind: 'sw', lead: SW_LEAD, levels: ETHERCHANNEL},
  advetherchannel: {kind: 'sw', lead: SW_LEAD, levels: ADVETHER},
  intervlan: {kind: 'sw', lead: INTER_LEAD, levels: INTERVLAN},
  mlsvlan: {kind: 'mls', lead: MLS_LEAD, levels: MLSVLAN, server: MLS_SERVER},
  portsec: {kind: 'sw', lead: SW_LEAD, levels: PORTSEC},
  static: {kind: 'rt', levels: STATIC},
  defroute: {kind: 'rt', levels: DEFROUTE},
  ospf: {kind: 'rt', levels: OSPF},
  ospfv3: {kind: 'rt', levels: OSPF6},
  rip: {kind: 'rt', levels: RIP},
  eigrp: {kind: 'rt', levels: EIGRP},
  harden: {kind: 'rt', levels: HARDEN},
  acl: {kind: 'rt', levels: ACL},
  dhcp: {kind: 'rt', levels: DHCP},
  // the DHCP server behind R2: it answers once R1 has Gi0/1 up and a route towards it
  dhcprelay: {kind: 'rt', levels: DHCPRELAY, server: x => ({name: 'DHCP server', ip: `172.16.${x}.10`,
    pools: [{name: 'LAN1', net: `192.168.${x}.0`, mask: MASK24, gw: `192.168.${x}.1`, ex: [[`192.168.${x}.1`, `192.168.${x}.10`]]}],
    reach: s => !!usable(R1(s).ifs['gi0/1']) && R1(s).routes.some(r => DOTTED.test(r.nh) && inNet(r.nh, R1(s).ifs['gi0/1'].mask, R1(s).ifs['gi0/1'].ip) && inNet(r.net, r.mask, `172.16.${x}.10`))})},
  nat: {kind: 'rt', levels: NAT},
  services: {kind: 'rt', levels: SERVICES},
  eui64: {kind: 'rt', lead: EUI_LEAD, levels: EUI64},
  summary: {kind: 'rt', levels: SUMMARY},
  voicevlan: {kind: 'sw', lead: VOICE_LEAD, levels: VOICEVLAN},
  trunkfix: {kind: 'sw2', lead: TRUNKFIX_LEAD, levels: TRUNKFIX},
  ipv6routing: {kind: 'rt', lead: V6RT_LEAD, levels: IPV6ROUTING},
  ospfadv: {kind: 'rt', levels: OSPFADV},
  hsrp: {kind: 'hsrp', lead: HSRP_LEAD, levels: HSRP},
  ssh: {kind: 'rt', lead: SSH_LEAD, levels: SSH},
  aaa: {kind: 'rt', lead: AAA_LEAD, levels: AAA},
  dhcpsnoop: {kind: 'sw', lead: SNOOP_LEAD, levels: DHCPSNOOP},
  dai: {kind: 'sw', lead: DAI_LEAD, levels: DAI},
};

// IPv4 and IPv6 addressing labs: requirements, solution, steps and diagram all follow from the level's interfaces
function addressingLab(T, cfg, x) {
  const v6 = T.kind === 'v6';
  const ifs = cfg.ifs.map(r => ({...r, name: portName(r.k), ip: v6 ? `2001:db8:${x}:${r.sub}::1/64` : `192.168.${x}.${r.host}`}));
  const reqs = [], cmds = [], steps = [];
  for (const r of ifs) {
    reqs.push(v6
      ? {text: `${r.name} gets an address ::1 in subnet ${r.sub} of 2001:db8:${x}::/48, with a /64 prefix`, ok: s => R1(s).ifs[r.k].ip6 === r.ip,
        hint: {cmds: [`ipv6 address ${r.ip}`], port: r.name}}
      : {text: `${r.name} gets the ${r.rule} usable address in ${r.lan}${T.showNet ? ` (192.168.${x}.${r.net})` : ''}, with ${T.maskRule}`,
        ok: s => R1(s).ifs[r.k].ip === r.ip && R1(s).ifs[r.k].mask === r.mask, hint: {cmds: [`ip address ${r.ip} ${r.mask}`], port: r.name}});
    if (r.ll) reqs.push(linkLocal(r.k));
    cmds.push(`int ${r.k}`, v6 ? `ipv6 address ${r.ip}` : `ip address ${r.ip} ${r.mask}`);
    if (r.ll) cmds.push('ipv6 address fe80::1 link-local');
    cmds.push('no shutdown', 'exit');
    steps.push(v6 ? `${r.name} serves subnet ${r.sub}; use ::1 as its address`
      : `${r.name} serves ${r.lan}${r.need ? ` (${r.need} hosts)` : ''}${T.showNet ? ` at 192.168.${x}.${r.net}` : ''}; use the ${r.rule} usable address as the gateway`);
  }
  for (const r of ifs) reqs.push(rtReq(r.k, 'is up', i => !i.shut, 'no shutdown'));
  steps.push('Bring each interface up and check that it stays up.');
  // R1 on the left, one PC per interface stacked on the right
  const n = ifs.length, height = Math.max(180, (n - 1) * 64 + 92), mid = height / 2;
  const nodes = [{id: 'R1', type: 'router', x: 8, y: mid - 26, sub: 'Router'}], links = [];
  ifs.forEach((r, i) => {
    const id = `PC${i + 1}`, cy = mid + (i - (n - 1) / 2) * 64;
    nodes.push({id, type: 'pc', x: 370, y: cy - 26, sub: v6 ? `Subnet ${r.sub}` : r.need ? `${r.lan}, ${r.need} hosts` : r.lan, at: `R1 ${r.k}`});
    links.push({a: 'R1', b: id, port: r.name});
  });
  return {reqs, solution: solutionOf('R1', cmds), steps, nodes, links, height, home: 'R1'};
}

// the known-good config: cmds typed in global configuration on the home device, then the other devices' lines; [] without cmds
const solutionOf = (home, cmds, then = []) => cmds ? [[home, ['enable', 'conf t', ...cmds, 'end']], ...then] : [];

// how each kind of lab builds a level for the network x
const atNet = (v, x) => (typeof v === 'function' ? v(x) : v);
const fixedLab = topo => (T, cfg) => x => ({...topo, reqs: atNet(cfg.reqs, x), steps: cfg.steps,
  setup: cfg.setup && atNet(cfg.setup, x), solution: solutionOf(topo.home, atNet(cfg.cmds, x), cfg.then && atNet(cfg.then, x))});
const LAB_KINDS = {
  v4: (T, cfg) => x => addressingLab(T, cfg, x),
  v6: (T, cfg) => x => addressingLab(T, cfg, x),
  sw: fixedLab(SW_TOPO),
  mls: fixedLab(MLS_TOPO),
  rt: fixedLab(RT_TOPO),
  sw2: fixedLab(SW2_TOPO),
  hsrp: fixedLab(HSRP_TOPO),
};
for (const T of Object.values(LABS)) for (const cfg of Object.values(T.levels)) cfg.build = LAB_KINDS[T.kind](T, cfg);
