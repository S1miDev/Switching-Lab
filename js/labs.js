// Lab definitions: every topic and level, with the requirements that grade it.
// A requirement is {text, ok, hint}: ok(st) is true when it is met (st is R1's state, st.sw is S1's),
// and hint holds the commands that meet it.
//
// TOPICS[topic].kind says how a lab is set up (see newLab in script.js):
//   'v4', 'v6'  addressing on R1; the requirements come from each level's interface list (ifs)
//   'sw'        the R1-S1 diagram; each level lists its requirements (reqs)
//   'rt'        the R1-R2-R3 diagram; build(x) makes the requirements for the random network 192.168.x.0
// A scenario text (lead) sits on the topic or on the level; a function gets x.
// shortcut: fixed values per level on a random network; move labs to data files when the lab library grows

const portName = key => key.replace('fa', 'Fa').replace('gi', 'Gi'); // 'fa0/1' -> 'Fa0/1'

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

// CDP and LLDP run on R1. cmds is a known-good config, used by the start-up self-check and the Commands card.
const LLDP_ON = {text: 'LLDP is enabled globally', ok: st => st.lldp, hint: 'lldp run'};
const CDP_OFF = {text: 'CDP is disabled globally', ok: st => !st.cdp, hint: 'no cdp run'};
const learnsS1 = hint => ({text: 'R1 learns S1 over LLDP on Gi0/0', ok: st => st.lldp && !st.ifs['gi0/0'].shut, hint});
const CDP_LEAD = 'R1 is connected to S1 on Gi0/0. CDP is running.';
const CDP = {
  beginner: {
    sub: 'Turn LLDP on and make R1 learn S1 over LLDP',
    lead: 'R1 is connected to S1 on Gi0/0. Discovery is set up as on a fresh device.',
    steps: ['Turn LLDP on for the whole device.', 'Bring up Gi0/0 so the link is active.'],
    cmds: ['lldp run', 'int gi0/0', 'no shutdown', 'exit'],
    reqs: [LLDP_ON, learnsS1('lldp run, then no shutdown on Gi0/0')],
  },
  intermediate: {
    sub: 'Turn CDP off, run LLDP, and make R1 learn S1 over LLDP',
    lead: CDP_LEAD,
    steps: ['Turn CDP off for the whole device.', 'Turn LLDP on and bring up Gi0/0.'],
    cmds: ['no cdp run', 'lldp run', 'int gi0/0', 'no shutdown', 'exit'],
    reqs: [CDP_OFF, LLDP_ON, learnsS1('no shutdown on Gi0/0')],
  },
  advanced: {
    sub: 'Keep CDP and LLDP on, but turn CDP off on Gi0/0 and bring it up',
    lead: CDP_LEAD,
    steps: ['Keep CDP and LLDP running for the whole device.', 'Turn CDP off on Gi0/0 only.'],
    cmds: ['lldp run', 'int gi0/0', 'no cdp enable', 'no shutdown', 'exit'],
    reqs: [
      {text: 'CDP is enabled globally', ok: st => st.cdp, hint: 'cdp run'},
      LLDP_ON,
      {text: 'Gi0/0 has CDP disabled', ok: st => st.ifs['gi0/0'].cdp === false, hint: 'no cdp enable (on Gi0/0)'},
      learnsS1('no shutdown on Gi0/0'),
    ],
  },
  expert: {
    sub: 'Turn CDP off everywhere, keep LLDP running, and bring up Gi0/0 and Gi0/1',
    lead: CDP_LEAD,
    steps: ['Turn CDP off for the whole device.', 'Keep LLDP running and bring up both interfaces.'],
    cmds: ['no cdp run', 'lldp run', 'int gi0/0', 'no shutdown', 'exit', 'int gi0/1', 'no shutdown', 'exit'],
    reqs: [CDP_OFF, LLDP_ON, learnsS1('no shutdown on Gi0/0'), {text: 'Gi0/1 is up', ok: st => !st.ifs['gi0/1'].shut, hint: 'no shutdown on Gi0/1'}],
  },
};

// ---- 2.0 network access: switch labs ----

// the R1-S1 diagram used by the switch and CDP labs
const SW_NODES = [
  {id: 'R1', type: 'router', x: 8, y: 64, sub: 'Router'},
  {id: 'S1', type: 'switch', x: 190, y: 64, sub: 'Switch'},
  {id: 'PC1', type: 'pc', x: 370, y: 24, sub: 'Host'},
  {id: 'PC2', type: 'pc', x: 370, y: 104, sub: 'Host'},
];
const SW_LINKS = [{a: 'R1', b: 'S1', port: 'Gi0/0'}, {a: 'S1', b: 'PC1', port: 'Fa0/1'}, {a: 'S1', b: 'PC2', port: 'Fa0/2'}];
const SW_LEAD = 'R1 Gi0/0 is cabled to S1 Gi0/1. PC1 is on Fa0/1 and PC2 on Fa0/2.';

const swVlan = (id, name) => ({
  text: `VLAN ${id}${name ? ` is named ${name}` : ' exists'}`,
  ok: st => !!st.sw.vlans[id] && (!name || st.sw.vlans[id].name === name),
  hint: name ? `vlan ${id}, name ${name}` : `vlan ${id}`,
});
const swAccess = (p, id) => ({
  text: `${portName(p)} is an access port in VLAN ${id}`,
  ok: st => st.sw.ports[p].mode === 'access' && st.sw.ports[p].vlan === id,
  hint: `switchport mode access, switchport access vlan ${id}`,
});
const swMode = p => ({text: `${portName(p)} is an access port`, ok: st => st.sw.ports[p].mode === 'access', hint: 'switchport mode access'});
const swUp = p => ({text: `${portName(p)} is up`, ok: st => !st.sw.ports[p].shut, hint: 'no shutdown'});
const swDown = p => ({text: `${portName(p)} is shut down`, ok: st => st.sw.ports[p].shut, hint: 'shutdown'});
const swDesc = (p, d) => ({text: `${portName(p)} has the description ${d}`, ok: st => st.sw.ports[p].desc === d, hint: `description ${d}`});
const swTrunk = p => ({text: `${portName(p)} is a trunk`, ok: st => st.sw.ports[p].mode === 'trunk', hint: 'switchport mode trunk'});
const swAllowed = (p, list) => ({
  text: `${portName(p)} allows only VLANs ${list.join(', ')} on the trunk`,
  ok: st => !!st.sw.ports[p].allowed && st.sw.ports[p].allowed.join(',') === list.join(','),
  hint: `switchport trunk allowed vlan ${list.join(',')}`,
});
const swNative = (p, id) => ({text: `${portName(p)} uses VLAN ${id} as the native VLAN`, ok: st => st.sw.ports[p].native === id, hint: `switchport trunk native vlan ${id}`});
const r1Up = {text: 'R1 Gi0/0 is up', ok: st => !st.ifs['gi0/0'].shut, hint: 'no shutdown (on R1 Gi0/0)'};

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
  ok: st => st.sw.stp.prio[id] !== undefined && st.sw.stp.prio[id] <= 24576,
  hint: `spanning-tree vlan ${id} root primary`,
});
const swPrio = (id, n) => ({text: `VLAN ${id} has spanning-tree priority ${n}`, ok: st => st.sw.stp.prio[id] === n, hint: `spanning-tree vlan ${id} priority ${n}`});
const swRstp = {text: 'S1 runs Rapid PVST+', ok: st => st.sw.stp.mode === 'rapid-pvst', hint: 'spanning-tree mode rapid-pvst'};
const swPortfast = p => ({text: `${portName(p)} has PortFast enabled`, ok: st => st.sw.ports[p].portfast === true, hint: 'spanning-tree portfast'});
const swBpdu = p => ({text: `${portName(p)} has BPDU guard enabled`, ok: st => st.sw.ports[p].bpdu === true, hint: 'spanning-tree bpduguard enable'});
const swGroup = (p, n, mode) => ({
  text: `${portName(p)} is in channel-group ${n} with mode ${mode}`,
  ok: st => st.sw.ports[p].group === n && st.sw.ports[p].chanMode === mode,
  hint: `channel-group ${n} mode ${mode}`,
});
const swLb = v => ({text: `EtherChannel load balancing is ${v}`, ok: st => st.sw.lb === v, hint: `port-channel load-balance ${v}`});
// R1 subinterface Gi0/0.<vlan> with 192.168.<vlan>.1/24 (router-on-a-stick)
const r1Sub = vlan => {
  const key = `gi0/0.${vlan}`, name = `Gi0/0.${vlan}`, ip = `192.168.${vlan}.1`, mask = '255.255.255.0';
  return [
    {text: `${name} is encapsulation dot1Q ${vlan}`, ok: st => !!st.ifs[key] && st.ifs[key].encap === vlan, hint: `encapsulation dot1Q ${vlan}`},
    {text: `${name} has the address ${ip} ${mask}`, ok: st => !!st.ifs[key] && st.ifs[key].ip === ip && st.ifs[key].mask === mask, hint: `ip address ${ip} ${mask}`},
    {text: `${name} is up`, ok: st => !!st.ifs[key] && !st.ifs[key].shut, hint: 'no shutdown'},
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

const INTER_ADV = [...TRUNK_UP, ...r1Sub(10), ...r1Sub(20), ...PCS_IN_10_20];
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
    sub: 'As Intermediate, and put Fa0/1 in VLAN 10 and Fa0/2 in VLAN 20',
    steps: ['Keep the subinterfaces working.', 'Put Fa0/1 in VLAN 10 and Fa0/2 in VLAN 20.', 'Bring both ports up.'],
    reqs: INTER_ADV,
  },
  expert: {
    sub: 'As Advanced, and add Gi0/0.99 on 192.168.99.1/24 with VLANs 10, 20 and 99 allowed on the trunk',
    steps: ['Create VLAN 99 on S1.', 'On R1, create Gi0/0.99 with dot1Q 99 and 192.168.99.1/24.', 'Allow only VLANs 10, 20 and 99 on the trunk.'],
    reqs: [...INTER_ADV, ...r1Sub(99), swVlan(99), swAllowed('gi0/1', [10, 20, 99])],
  },
};

// ---- 5.0 security: port security ----
const swPsec = p => ({text: `${portName(p)} has port security on`, ok: st => st.sw.ports[p].psec === true, hint: 'switchport port-security'});
const swPsMax = (p, n) => ({
  text: `${portName(p)} allows ${n} MAC address${n > 1 ? 'es' : ''}`,
  ok: st => st.sw.ports[p].psMax === n,
  hint: `switchport port-security maximum ${n}`,
});
const swPsViol = (p, v) => ({text: `${portName(p)} violation mode is ${v}`, ok: st => st.sw.ports[p].psViolation === v, hint: `switchport port-security violation ${v}`});
const swPsSticky = p => ({text: `${portName(p)} learns sticky MAC addresses`, ok: st => st.sw.ports[p].psSticky === true, hint: 'switchport port-security mac-address sticky'});
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

// the R1-R2-R3 diagram used by the router labs
const RT_NODES = [
  {id: 'R1', type: 'router', x: 8, y: 64, sub: 'Router'},
  {id: 'PC1', type: 'pc', x: 370, y: 14, sub: 'LAN 1'},
  {id: 'R2', type: 'router', x: 370, y: 64, sub: '10.0.0.2'},
  {id: 'R3', type: 'router', x: 370, y: 114, sub: '10.0.1.2'},
];
const RT_LINKS = [{a: 'R1', b: 'PC1', port: 'Gi0/0'}, {a: 'R1', b: 'R2', port: 'Gi0/1'}, {a: 'R1', b: 'R3', port: 'Gi0/2'}];

// an R1 interface with its address, and up
const rtIf = (k, ip, mask) => [
  {text: `${portName(k)} is ${ip} ${mask}`, ok: st => st.ifs[k].ip === ip && st.ifs[k].mask === mask, hint: `ip address ${ip} ${mask}`},
  {text: `${portName(k)} is up`, ok: st => !st.ifs[k].shut, hint: 'no shutdown'},
];
const LAN_IF = x => rtIf('gi0/0', `192.168.${x}.1`, '255.255.255.0'); // towards PC1
const WAN_IF = rtIf('gi0/1', '10.0.0.1', '255.255.255.252'); // towards R2
const R3_IF = rtIf('gi0/2', '10.0.1.1', '255.255.255.252'); // towards R3
const BOTH_IFS = x => [...LAN_IF(x), ...WAN_IF];
const rtRoute = (net, mask, nh, dist = 1) => ({
  text: `R1 has a route to ${net} ${mask} via ${nh}${dist !== 1 ? ` with distance ${dist}` : ''}`,
  ok: st => st.routes.some(r => r.net === net && r.mask === mask && r.nh === nh && r.dist === dist),
  hint: `ip route ${net} ${mask} ${nh}${dist !== 1 ? ' ' + dist : ''}`,
});
const DEFAULT_VIA_R2 = rtRoute('0.0.0.0', '0.0.0.0', '10.0.0.2');
const aclEntries = (name, type, expected) => ({
  text: `ACL ${name} has the entries: ${expected.join('; ')}`,
  ok: st => !!st.acls[name] && st.acls[name].type === type && st.acls[name].entries.join(' | ') === expected.join(' | '),
  hint: `ip access-list ${type} ${name}, then ${expected.join(', ')}`,
});
const aclApplied = (k, dir, name) => ({
  text: `${portName(k)} applies ACL ${name} ${dir === 'in' ? 'inbound' : 'outbound'}`,
  ok: st => (dir === 'in' ? st.ifs[k].aclIn : st.ifs[k].aclOut) === name,
  hint: `ip access-group ${name} ${dir}`,
});

const STATIC = {
  beginner: {
    sub: 'Route the remote LAN 172.16.x.0/24 through R2 at 10.0.0.2',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is the next hop on Gi0/1.`,
    steps: ['Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Add a static route for 172.16.x.0/24 via 10.0.0.2.'],
    build: x => [...BOTH_IFS(x), rtRoute(`172.16.${x}.0`, '255.255.255.0', '10.0.0.2')],
  },
  intermediate: {
    sub: 'Add a second remote LAN, 172.17.x.0/24, also through R2',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is the next hop on Gi0/1.`,
    steps: ['Keep the first static route working.', 'Add a static route for 172.17.x.0/24 via 10.0.0.2.'],
    build: x => [...STATIC.beginner.build(x), rtRoute(`172.17.${x}.0`, '255.255.255.0', '10.0.0.2')],
  },
  advanced: {
    sub: 'Add R3 on Gi0/2 as a backup for 172.16.x.0/24, using distance 150',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is on Gi0/1 and R3 on Gi0/2.`,
    steps: ['Keep the routes to R2 working.', 'Address Gi0/2 as 10.0.1.1/30 and bring it up.', 'Add a backup route for 172.16.x.0/24 via 10.0.1.2 with distance 150.'],
    build: x => [...STATIC.intermediate.build(x), ...R3_IF, rtRoute(`172.16.${x}.0`, '255.255.255.0', '10.0.1.2', 150)],
  },
  expert: {
    sub: 'As Advanced, and add 172.18.x.0/24 as a route out the exit interface Gi0/2',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is on Gi0/1 and R3 on Gi0/2.`,
    steps: ['Keep the Advanced routes.', 'Add a static route for 172.18.x.0/24 that uses Gi0/2 as the exit interface.'],
    build: x => [...STATIC.advanced.build(x), rtRoute(`172.18.${x}.0`, '255.255.255.0', 'Gi0/2')],
  },
};

const DEFROUTE = {
  beginner: {
    sub: 'Send unknown traffic to R2 at 10.0.0.2 with a default route',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 at 10.0.0.2 is the way out.`,
    steps: ['Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Add a default route via 10.0.0.2.'],
    build: x => [...BOTH_IFS(x), DEFAULT_VIA_R2],
  },
  intermediate: {
    sub: 'Add R3 at 10.0.1.2 as a backup default route with distance 150',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is on Gi0/1 and R3 on Gi0/2.`,
    steps: ['Keep the default route via R2.', 'Address Gi0/2 as 10.0.1.1/30 and bring it up.', 'Add a backup default route via 10.0.1.2 with distance 150.'],
    build: x => [...BOTH_IFS(x), DEFAULT_VIA_R2, ...R3_IF, rtRoute('0.0.0.0', '0.0.0.0', '10.0.1.2', 150)],
  },
  advanced: {
    sub: 'Make Gi0/1 the exit interface for the default route',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is on Gi0/1.`,
    steps: ['Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Add a default route that uses Gi0/1 as the exit interface.'],
    build: x => [...BOTH_IFS(x), rtRoute('0.0.0.0', '0.0.0.0', 'Gi0/1')],
  },
  expert: {
    sub: 'Default route via R2, plus a specific route to 172.16.x.0/24 via R2',
    lead: x => `R1 Gi0/0 serves 192.168.${x}.0/24. R2 is on Gi0/1.`,
    steps: ['Add a default route via 10.0.0.2.', 'Add a specific route for 172.16.x.0/24 via 10.0.0.2 so it is not sent to the default.'],
    build: x => [...BOTH_IFS(x), DEFAULT_VIA_R2, rtRoute(`172.16.${x}.0`, '255.255.255.0', '10.0.0.2')],
  },
};

const TELNET_ACL = [aclEntries('110', 'extended', ['deny tcp any any eq telnet', 'permit ip any any']), aclApplied('gi0/0', 'in', '110')];
const ACL = {
  beginner: {
    sub: 'Block 192.168.x.10 with standard ACL 10 on inbound Gi0/0',
    lead: x => `PC1 is on 192.168.${x}.0/24 behind Gi0/0.`,
    steps: ['Create standard ACL 10: deny host 192.168.x.10, then permit any.', 'Apply ACL 10 inbound on Gi0/0.'],
    build: x => [...LAN_IF(x), aclEntries('10', 'standard', [`deny host 192.168.${x}.10`, 'permit any']), aclApplied('gi0/0', 'in', '10')],
  },
  intermediate: {
    sub: 'Block the first half of the LAN with standard ACL 10 on outbound Gi0/1',
    lead: x => `PC1 is on 192.168.${x}.0/24. R2 is reached through Gi0/1.`,
    steps: ['Create standard ACL 10: deny 192.168.x.0 0.0.0.127, then permit any.', 'Apply ACL 10 outbound on Gi0/1.'],
    build: x => [...BOTH_IFS(x), aclEntries('10', 'standard', [`deny 192.168.${x}.0 0.0.0.127`, 'permit any']), aclApplied('gi0/1', 'out', '10')],
  },
  advanced: {
    sub: 'Block Telnet inbound on Gi0/0 with extended ACL 110',
    lead: x => `PC1 is on 192.168.${x}.0/24 behind Gi0/0.`,
    steps: ['Create extended ACL 110: deny tcp any any eq telnet, then permit ip any any.', 'Apply ACL 110 inbound on Gi0/0.'],
    build: x => [...LAN_IF(x), ...TELNET_ACL],
  },
  expert: {
    sub: 'Keep ACL 110 on Gi0/0, and filter web traffic from the LAN with web-filter outbound on Gi0/1',
    lead: x => `PC1 is on 192.168.${x}.0/24. R2 is reached through Gi0/1.`,
    steps: ['Keep ACL 110 inbound on Gi0/0.', 'Create extended ACL web-filter: deny tcp the first half of the LAN to any eq www, then permit ip any any.',
      'Apply web-filter outbound on Gi0/1.'],
    build: x => [...BOTH_IFS(x), ...TELNET_ACL,
      aclEntries('web-filter', 'extended', [`deny tcp 192.168.${x}.0 0.0.0.127 any eq www`, 'permit ip any any']), aclApplied('gi0/1', 'out', 'web-filter')],
  },
};

// DHCP, DHCP relay, NAT, network services
const dhcpPool = (name, net, mask, gw) => ({
  text: `DHCP pool ${name} serves ${net} ${mask} with default router ${gw}`,
  ok: st => !!st.dhcp[name] && st.dhcp[name].net === net && st.dhcp[name].mask === mask && st.dhcp[name].gw === gw,
  hint: `ip dhcp pool ${name}, network ${net} ${mask}, default-router ${gw}`,
});
const dhcpEx = (first, last) => ({text: `DHCP excludes ${first} to ${last}`, ok: st => st.dhcpEx.some(([a, b]) => a === first && b === last), hint: `ip dhcp excluded-address ${first} ${last}`});
const dhcpDns = (name, ip) => ({text: `DHCP pool ${name} gives DNS server ${ip}`, ok: st => !!st.dhcp[name] && st.dhcp[name].dns.includes(ip), hint: `dns-server ${ip}`});
const dhcpDomain = (name, d) => ({text: `DHCP pool ${name} sets the domain to ${d}`, ok: st => !!st.dhcp[name] && st.dhcp[name].domain === d, hint: `domain-name ${d}`});
const helperOn = (k, ip) => ({text: `${portName(k)} forwards DHCP to ${ip}`, ok: st => st.ifs[k].helpers.includes(ip), hint: `ip helper-address ${ip}`});
const noHelper = k => ({text: `${portName(k)} does not forward DHCP`, ok: st => st.ifs[k].helpers.length === 0, hint: 'no ip helper-address'});
const natSide = (k, dir) => ({text: `${portName(k)} is NAT ${dir}`, ok: st => st.ifs[k].nat === dir, hint: `ip nat ${dir}`});
const natPat = (acl, k) => ({
  text: `ACL ${acl} hosts use ${portName(k)} with PAT (overload)`,
  ok: st => st.nat.pat.some(p => p.acl === acl && p.iface === portName(k)),
  hint: `ip nat inside source list ${acl} interface ${portName(k)} overload`,
});
const natStatic = (inside, outside) => ({
  text: `${inside} is NATed to ${outside} with a static entry`,
  ok: st => st.nat.stat.some(p => p.in === inside && p.out === outside),
  hint: `ip nat inside source static ${inside} ${outside}`,
});
const svcNtp = ip => ({text: `R1 uses NTP server ${ip}`, ok: st => st.svc.ntp.includes(ip), hint: `ntp server ${ip}`});
const svcLog = ip => ({text: `R1 sends logs to ${ip}`, ok: st => st.svc.log.includes(ip), hint: `logging host ${ip}`});
const svcDns = ip => ({text: `R1 uses DNS server ${ip}`, ok: st => st.svc.dns.includes(ip), hint: `ip name-server ${ip}`});

const DHCP_LEAD = x => `PC1 is on 192.168.${x}.0/24 behind Gi0/0 and gets its settings from R1.`;
const DHCP = {
  beginner: {
    sub: 'Create DHCP pool LAN1 for 192.168.x.0/24 with R1 as the default router',
    lead: DHCP_LEAD,
    steps: ['Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Create ip dhcp pool LAN1 with network 192.168.x.0 255.255.255.0.',
      'Set default-router to 192.168.x.1.'],
    build: x => [...BOTH_IFS(x), dhcpPool('lan1', `192.168.${x}.0`, '255.255.255.0', `192.168.${x}.1`)],
  },
  intermediate: {
    sub: 'As Beginner, and exclude 192.168.x.1 to 192.168.x.20 from the pool',
    lead: DHCP_LEAD,
    steps: ['Keep the LAN1 pool.', 'Add ip dhcp excluded-address 192.168.x.1 192.168.x.20.'],
    build: x => [...DHCP.beginner.build(x), dhcpEx(`192.168.${x}.1`, `192.168.${x}.20`)],
  },
  advanced: {
    sub: 'As Intermediate, and give clients the DNS server 172.16.x.53',
    lead: DHCP_LEAD,
    steps: ['Keep the LAN1 pool and excluded range.', 'Add dns-server 172.16.x.53 to LAN1.'],
    build: x => [...DHCP.intermediate.build(x), dhcpDns('lan1', `172.16.${x}.53`)],
  },
  expert: {
    sub: 'As Advanced, and set the domain name to lab.local',
    lead: DHCP_LEAD,
    steps: ['Keep the Advanced settings.', 'Add domain-name lab.local to LAN1.'],
    build: x => [...DHCP.advanced.build(x), dhcpDomain('lan1', 'lab.local')],
  },
};

const RELAY_LEAD = x => `PC1 is on 192.168.${x}.0/24 behind Gi0/0. Both DHCP servers are behind R2.`;
const DHCPRELAY = {
  beginner: {
    sub: 'Forward DHCP from the LAN to the server 172.16.x.10 behind R2',
    lead: x => `PC1 is on 192.168.${x}.0/24 behind Gi0/0. The DHCP server 172.16.x.10 is behind R2.`,
    steps: ['Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Add a route to 172.16.x.0/24 via 10.0.0.2.', 'On Gi0/0, add ip helper-address 172.16.x.10.'],
    build: x => [...BOTH_IFS(x), rtRoute(`172.16.${x}.0`, '255.255.255.0', '10.0.0.2'), helperOn('gi0/0', `172.16.${x}.10`)],
  },
  intermediate: {
    sub: 'Add a second DHCP server 172.17.x.10 behind R2 as a backup helper',
    lead: RELAY_LEAD,
    steps: ['Keep the relay to 172.16.x.10.', 'Add a route to 172.17.x.0/24 via 10.0.0.2.', 'Add a second ip helper-address 172.17.x.10 on Gi0/0.'],
    build: x => [...DHCPRELAY.beginner.build(x), rtRoute(`172.17.${x}.0`, '255.255.255.0', '10.0.0.2'), helperOn('gi0/0', `172.17.${x}.10`)],
  },
  advanced: {
    sub: 'As Intermediate, and make sure the uplink Gi0/1 does not relay DHCP',
    lead: RELAY_LEAD,
    steps: ['Keep both helper addresses on Gi0/0.', 'Make sure Gi0/1 has no ip helper-address.'],
    build: x => [...DHCPRELAY.intermediate.build(x), noHelper('gi0/1')],
  },
  expert: {
    sub: 'As Advanced, and add a default route via R2 so replies leave the network',
    lead: RELAY_LEAD,
    steps: ['Keep the Advanced settings.', 'Add a default route via 10.0.0.2.'],
    build: x => [...DHCPRELAY.advanced.build(x), DEFAULT_VIA_R2],
  },
};

const NAT_LEAD = x => `PC1 is on 192.168.${x}.0/24 behind Gi0/0. R2 is outside on Gi0/1.`;
const NAT = {
  beginner: {
    sub: 'Mark Gi0/0 as NAT inside, Gi0/1 as NAT outside, and define ACL 1 for the LAN',
    lead: NAT_LEAD,
    steps: ['Address Gi0/0 and Gi0/1 and bring them up.', 'Set Gi0/0 to ip nat inside and Gi0/1 to ip nat outside.',
      'Create access-list 1 permit 192.168.x.0 0.0.0.255.'],
    build: x => [...BOTH_IFS(x), natSide('gi0/0', 'inside'), natSide('gi0/1', 'outside'), aclEntries('1', 'standard', [`permit 192.168.${x}.0 0.0.0.255`])],
  },
  intermediate: {
    sub: 'As Beginner, and translate the LAN to the Gi0/1 address with PAT',
    lead: NAT_LEAD,
    steps: ['Keep the NAT inside and outside sides.', 'Add ip nat inside source list 1 interface Gi0/1 overload.'],
    build: x => [...NAT.beginner.build(x), natPat('1', 'gi0/1')],
  },
  advanced: {
    sub: 'As Intermediate, and add a static NAT from 192.168.x.20 to 198.51.100.x',
    lead: NAT_LEAD,
    steps: ['Keep the PAT rule.', 'Add ip nat inside source static 192.168.x.20 198.51.100.x.'],
    build: x => [...NAT.intermediate.build(x), natStatic(`192.168.${x}.20`, `198.51.100.${x}`)],
  },
  expert: {
    sub: 'As Advanced, and add a default route via R2 so NAT traffic can leave',
    lead: NAT_LEAD,
    steps: ['Keep the Advanced NAT rules.', 'Add a default route via 10.0.0.2.'],
    build: x => [...NAT.advanced.build(x), DEFAULT_VIA_R2],
  },
};

const SERVICES = {
  beginner: {
    sub: 'Point R1 at the NTP server 10.0.0.2 behind R2',
    lead: 'R1 reaches R2 on Gi0/1. The NTP server 10.0.0.2 sits behind R2.',
    steps: ['Address Gi0/1 and bring it up.', 'Add ntp server 10.0.0.2.'],
    build: () => [...WAN_IF, svcNtp('10.0.0.2')],
  },
  intermediate: {
    sub: 'Also send logs to the syslog server 172.16.x.100 behind R2',
    lead: 'R1 reaches R2 on Gi0/1. The syslog server 172.16.x.100 sits behind R2.',
    steps: ['Keep the NTP server.', 'Add a route to 172.16.x.0/24 via 10.0.0.2.', 'Add logging host 172.16.x.100.'],
    build: x => [...SERVICES.beginner.build(x), rtRoute(`172.16.${x}.0`, '255.255.255.0', '10.0.0.2'), svcLog(`172.16.${x}.100`)],
  },
  advanced: {
    sub: 'As Intermediate, and use the DNS server 172.16.x.53',
    lead: 'R1 reaches R2 on Gi0/1. The syslog and DNS servers sit behind R2.',
    steps: ['Keep the NTP and syslog settings.', 'Add ip name-server 172.16.x.53.'],
    build: x => [...SERVICES.intermediate.build(x), svcDns(`172.16.${x}.53`)],
  },
  expert: {
    sub: 'As Advanced, and add a second NTP server 10.0.1.2 on Gi0/2',
    lead: 'R1 reaches R2 on Gi0/1 and R3 on Gi0/2.',
    steps: ['Keep the Advanced settings.', 'Address Gi0/2 as 10.0.1.1/30 and bring it up.', 'Add ntp server 10.0.1.2.'],
    build: x => [...WAN_IF, ...R3_IF, svcNtp('10.0.0.2'), svcNtp('10.0.1.2'), rtRoute(`172.16.${x}.0`, '255.255.255.0', '10.0.0.2'),
      svcLog(`172.16.${x}.100`), svcDns(`172.16.${x}.53`)],
  },
};

// The labs behind each "Start lab" button (data-lab in index.html).
// showNet and maskRule only matter for the IPv4 addressing topics.
const NET_LEAD = x => `Your network is 192.168.${x}.0/24. R1 has no addressing yet.`;
const TOPICS = {
  ipv4: {name: 'IPv4 addressing', kind: 'v4', showNet: true, maskRule: 'the correct mask', lead: NET_LEAD, levels: IPV4},
  subnetting: {name: 'Subnetting', kind: 'v4', maskRule: 'the correct mask', lead: NET_LEAD, levels: SUBNET},
  vlsm: {name: 'VLSM', kind: 'v4', maskRule: 'the smallest mask that fits its hosts',
    lead: x => `Your network is 192.168.${x}.0/24. Each LAN has a host requirement.`, levels: VLSM},
  ipv6: {name: 'IPv6 Addressing', kind: 'v6', lead: x => `Your prefix is 2001:db8:${x}::/48. R1 has no IPv6 addressing yet.`, levels: IPV6},
  cdp: {name: 'CDP & LLDP', kind: 'sw', levels: CDP},
  vlans: {name: 'VLANs', kind: 'sw', lead: SW_LEAD, levels: VLANS},
  access: {name: 'Access Ports', kind: 'sw', lead: SW_LEAD, levels: ACCESS},
  trunk: {name: 'Trunking (802.1Q)', kind: 'sw', lead: SW_LEAD, levels: TRUNK},
  stp: {name: 'Spanning Tree Protocol (STP)', kind: 'sw', lead: SW_LEAD, levels: STP},
  advstp: {name: 'Advanced STP', kind: 'sw', lead: SW_LEAD, levels: ADVSTP},
  etherchannel: {name: 'EtherChannel', kind: 'sw', lead: SW_LEAD, levels: ETHERCHANNEL},
  advetherchannel: {name: 'Advanced EtherChannel', kind: 'sw', lead: SW_LEAD, levels: ADVETHER},
  intervlan: {name: 'Inter-VLAN Routing', kind: 'sw', lead: INTER_LEAD, levels: INTERVLAN},
  portsec: {name: 'Port Security', kind: 'sw', lead: SW_LEAD, levels: PORTSEC},
  static: {name: 'Static Routing', kind: 'rt', levels: STATIC},
  defroute: {name: 'Default Routes', kind: 'rt', levels: DEFROUTE},
  acl: {name: 'Standard and Extended ACLs (IPv4)', kind: 'rt', levels: ACL},
  dhcp: {name: 'DHCP', kind: 'rt', levels: DHCP},
  dhcprelay: {name: 'DHCP Relay', kind: 'rt', levels: DHCPRELAY},
  nat: {name: 'NAT', kind: 'rt', levels: NAT},
  services: {name: 'Network Services (NTP, Syslog, DNS)', kind: 'rt', levels: SERVICES},
};
