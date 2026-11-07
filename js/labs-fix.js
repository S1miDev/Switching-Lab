// Troubleshooting labs: every level presets a broken config (setup); cmds and then are only the fix.
// Loaded after labs.js, whose helpers it uses, and adds its topics to LABS.

// 2.0 trunk troubleshooting between S1 and S2 (SW2_TOPO in labs.js)
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
    then: [onDev('S2', ...onIf('gi0/1', 'switchport mode trunk'))],
  },
  intermediate: {
    sub: 'Fix the native VLAN mismatch: both sides must use native VLAN 99',
    steps: ['Compare the native VLAN of Gi0/1 on S1 and S2 with show interfaces trunk.', 'Set the side that is wrong to native VLAN 99.'],
    setup: [['S1', [...SW2_BASE, ...uplink('switchport mode trunk', 'switchport trunk native vlan 99')]],
      ['S2', [...SW2_BASE, ...uplink('switchport mode trunk')]]],
    reqs: [...bothTrunk, ...bothNative],
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

// 3.0 OSPF troubleshooting on R1: R2 on Gi0/1 should be an area 0 neighbour
const OSPFFIX_LEAD = serves('R2 on Gi0/1 should be an OSPF neighbour in area 0, but the adjacency is not working. ' +
  'Find the fault with show ip ospf interface brief and show running-config, and fix it.');
// a working OSPF config with the given router ID, network lines and passive interfaces
const ospfSetup = (x, rid, nets, passive, extra = []) => [...BOTH_CMDS(x), ...extra, 'router ospf 1', `router-id ${rid}`,
  `network 192.168.${x}.0 0.0.0.255 area 0`, ...nets, ...passive.map(p => `passive-interface ${p}`), 'exit'];
const OSPFFIX_ALL = x => [...OSPF_BASE(x), ospfRid(false, '1.1.1.1'), igpPassive('ospf', 'gi0/0'), igpPassive('ospf', 'gi0/1', false)];
const OSPFFIX = {
  beginner: {
    sub: 'The link to R2 is in the wrong area: put it in area 0',
    steps: ['Run show ip ospf interface brief: note the area of Gi0/1.', 'Find the network statement for 10.0.0.0/30 in show running-config.',
      'Remove it with no network and add it again in area 0.'],
    setup: x => [['R1', ospfSetup(x, '1.1.1.1', ['network 10.0.0.0 0.0.0.3 area 1'], ['gi0/0'])]],
    reqs: OSPF_BASE,
    cmds: ['router ospf 1', 'no network 10.0.0.0 0.0.0.3 area 1', 'network 10.0.0.0 0.0.0.3 area 0', 'exit'],
  },
  intermediate: {
    sub: 'R1 sends no hellos to R2: find out why',
    steps: ['Check the passive-interface lines under router ospf 1.', 'A passive interface sends no hellos, so no neighbour forms on it.',
      'Keep the LAN passive, but not the link to R2.'],
    setup: x => [['R1', ospfSetup(x, '1.1.1.1', ['network 10.0.0.0 0.0.0.3 area 0'], ['gi0/0', 'gi0/1'])]],
    reqs: OSPFFIX_ALL,
    cmds: ['router ospf 1', 'no passive-interface gi0/1', 'exit'],
  },
  advanced: {
    sub: 'Gi0/1 does not run OSPF at all: there are two faults',
    steps: ['Run show ip interface brief: is Gi0/1 up?', 'Check the wildcard of the 10.0.0.0 network statement: does it match 10.0.0.1?',
      'Fix the interface, then replace the network statement with one that covers 10.0.0.0/30.'],
    setup: x => [['R1', [...ospfSetup(x, '1.1.1.1', ['network 10.0.0.0 0.0.0.0 area 0'], ['gi0/0']), ...onIf('gi0/1', 'shutdown')]]],
    reqs: OSPFFIX_ALL,
    cmds: [...onIf('gi0/1', 'no shutdown'), 'router ospf 1', 'no network 10.0.0.0 0.0.0.0 area 0', 'network 10.0.0.0 0.0.0.3 area 0', 'exit'],
  },
  expert: {
    sub: 'Three faults: duplicate router ID, an interface command overriding the area, and hellos sent to the LAN',
    steps: ['R2 also uses router ID 2.2.2.2: set R1 back to 1.1.1.1 (on real IOS, clear ip ospf process afterwards).',
      'An ip ospf command on an interface beats any network statement: check Gi0/1 in show running-config.',
      'Make the LAN Gi0/0 passive again.'],
    setup: x => [['R1', ospfSetup(x, '2.2.2.2', ['network 10.0.0.0 0.0.0.3 area 0'], [], onIf('gi0/1', 'ip ospf 1 area 1'))]],
    reqs: OSPFFIX_ALL,
    cmds: [...onIf('gi0/1', 'no ip ospf 1 area 1'), 'router ospf 1', 'router-id 1.1.1.1', 'passive-interface gi0/0', 'exit'],
  },
};

// 2.0 router-on-a-stick troubleshooting: R1 Gi0/0.10 and .20 over the trunk to S1, PC1 in VLAN 10 and PC2 in VLAN 20
const INTERFIX_LEAD = 'R1 Gi0/0 is trunked to S1 Gi0/1 and routes between VLAN 10 (PC1 on Fa0/1) and VLAN 20 (PC2 on Fa0/2), ' +
  'but the VLANs cannot reach their gateway. Compare R1 and S1 and fix what is wrong.';
const r1Stick = (fault = {}) => [...onIf('gi0/0', fault.phys || 'no shutdown'),
  ...onIf('gi0/0.10', 'encapsulation dot1Q 10', `ip address 192.168.10.1 ${fault.mask10 || MASK24}`, 'no shutdown'),
  ...onIf('gi0/0.20', `encapsulation dot1Q ${fault.tag20 || 20}`, `ip address 192.168.20.1 ${MASK24}`, 'no shutdown')];
const s1Stick = (fault = {}) => ['vlan 10', 'exit', 'vlan 20', 'exit',
  ...onIf('fa0/1', 'switchport mode access', 'switchport access vlan 10', fault.fa1 || 'no shutdown'),
  ...onIf('fa0/2', 'switchport mode access', `switchport access vlan ${fault.vlan2 || 20}`, 'no shutdown'),
  ...onIf('gi0/1', `switchport mode ${fault.mode || 'trunk'}`, ...(fault.allowed ? [`switchport trunk allowed vlan ${fault.allowed}`] : []), 'no shutdown')];
const INTERFIX_ALL = [...TRUNK_UP, ...r1Sub(10), ...r1Sub(20), ...PCS_IN_10_20];
const INTERVLANFIX = {
  beginner: {
    sub: 'VLAN 20 has no gateway: check R1 Gi0/0.20',
    steps: ['On R1, check Gi0/0.20 in show running-config.', 'The dot1Q tag must match the VLAN the subinterface serves.', 'Set the right encapsulation.'],
    setup: [['R1', r1Stick({tag20: 30})], ['S1', s1Stick()]],
    reqs: INTERFIX_ALL,
    then: [onDev('R1', ...onIf('gi0/0.20', 'encapsulation dot1Q 20'))],
  },
  intermediate: {
    sub: 'Neither VLAN reaches R1: check the switch side of the link',
    steps: ['On S1, run show interfaces trunk: Gi0/1 is missing.', 'Check Gi0/1 in show running-config on S1.', 'Make it a trunk again.'],
    setup: [['R1', r1Stick()], ['S1', s1Stick({mode: 'access'})]],
    reqs: INTERFIX_ALL,
    cmds: onIf('gi0/1', 'switchport mode trunk'),
  },
  advanced: {
    sub: 'Two faults: one on R1, one on S1',
    steps: ['On R1, run show ip interface brief: a subinterface is only up when its physical interface is.',
      'On S1, run show vlan brief: is each PC in the VLAN of its gateway?', 'Fix both.'],
    setup: [['R1', r1Stick({phys: 'shutdown'})], ['S1', s1Stick({vlan2: 10})]],
    reqs: INTERFIX_ALL,
    cmds: onIf('fa0/2', 'switchport access vlan 20'),
    then: [onDev('R1', ...onIf('gi0/0', 'no shutdown'))],
  },
  expert: {
    sub: 'Three faults: the trunk drops VLAN 20, Gi0/0.10 has the wrong mask, and a PC port is down',
    steps: ['On S1, compare the allowed VLANs on the trunk with the VLANs in use; add the missing one without retyping the list.',
      'On R1, check the mask of Gi0/0.10: PC1 must fit in its subnet.', 'On S1, check that both PC ports are up.'],
    setup: [['R1', r1Stick({mask10: '255.255.255.252'})], ['S1', s1Stick({allowed: '10', fa1: 'shutdown'})]],
    reqs: [...INTERFIX_ALL, swAllowed('gi0/1', [10, 20])],
    cmds: [...onIf('gi0/1', 'switchport trunk allowed vlan add 20'), ...onIf('fa0/1', 'no shutdown')],
    then: [onDev('R1', ...onIf('gi0/0.10', `ip address 192.168.10.1 ${MASK24}`))],
  },
};

// 4.0 DHCP troubleshooting: R1 serves pool LAN1 for 192.168.x.0/24 and keeps .1 to .20 out of it
const DHCPFIX_LEAD = x => `R1 is the DHCP server for PC1 on 192.168.${x}.0/24 behind Gi0/0, but PC1 does not get working settings. ` +
  'Find the fault with show running-config, fix it, then type dhcp on PC1.';
const dhcpSetup = (x, f = {}) => [...BOTH_CMDS(x), ...(f.lanShut ? onIf('gi0/0', 'shutdown') : []),
  `ip dhcp excluded-address 192.168.${x}.1 192.168.${x}.${f.exLast || 20}`,
  'ip dhcp pool LAN1', `network ${f.net || `192.168.${x}.0`} 255.255.255.0`, `default-router 192.168.${x}.${f.gw || 1}`, 'exit'];
const DHCPFIX_ALL = x => [...BOTH_IFS(x), dhcpPool('lan1', `192.168.${x}.0`, MASK24, `192.168.${x}.1`), dhcpEx(`192.168.${x}.1`, `192.168.${x}.20`),
  // a lease taken before the fix keeps the old gateway, so PC1 must ask again
  pcLease('PC1', `192.168.${x}`, `192.168.${x}.1`)];
const fixExclusion = x => [`no ip dhcp excluded-address 192.168.${x}.1 192.168.${x}.254`, `ip dhcp excluded-address 192.168.${x}.1 192.168.${x}.20`];
const DHCPFIX = {
  beginner: {
    sub: 'PC1 gets an address but cannot leave its LAN: check the gateway it is given',
    steps: ['On PC1, type dhcp and look at the GW it gets.', 'Compare it with R1 Gi0/0 and with default-router in the pool.', 'Fix the pool, then type dhcp on PC1 again.'],
    setup: x => [['R1', dhcpSetup(x, {gw: 254})]],
    reqs: DHCPFIX_ALL,
    cmds: x => ['ip dhcp pool LAN1', `default-router 192.168.${x}.1`, 'exit'],
    then: PC1_DHCP,
  },
  intermediate: {
    sub: 'PC1 gets no address at all: the pool does not match the LAN',
    steps: ['On PC1, type dhcp: no server answers.', 'A pool only serves the subnet of the interface the request comes in on; compare the pool network with Gi0/0.',
      'Fix the pool network, then type dhcp on PC1.'],
    setup: x => [['R1', dhcpSetup(x, {net: '10.10.10.0'})]],
    reqs: DHCPFIX_ALL,
    cmds: x => ['ip dhcp pool LAN1', `network 192.168.${x}.0 255.255.255.0`, 'exit'],
    then: PC1_DHCP,
  },
  advanced: {
    sub: 'The pool is right but has no free addresses: check the excluded range',
    steps: ['Find ip dhcp excluded-address in show running-config: how much of the pool does it cover?', 'Remove it with no ip dhcp excluded-address.',
      'Exclude only .1 to .20, then type dhcp on PC1.'],
    setup: x => [['R1', dhcpSetup(x, {exLast: 254})]],
    reqs: DHCPFIX_ALL,
    cmds: fixExclusion,
    then: PC1_DHCP,
  },
  expert: {
    sub: 'Three faults between PC1 and a working lease',
    steps: ['Check that the interface PC1 is on is up.', 'Check the excluded range and the default router in the pool.', 'Fix all three, then type dhcp on PC1.'],
    setup: x => [['R1', dhcpSetup(x, {lanShut: true, exLast: 254, gw: 254})]],
    reqs: DHCPFIX_ALL,
    cmds: x => [...onIf('gi0/0', 'no shutdown'), ...fixExclusion(x), 'ip dhcp pool LAN1', `default-router 192.168.${x}.1`, 'exit'],
    then: PC1_DHCP,
  },
};

// 5.0 ACL troubleshooting on R1: the ACLs from the ACL labs, written or applied wrongly
const ACLFIX_LEAD = x => `PC1 is on 192.168.${x}.0/24 behind Gi0/0 and R2 is reached through Gi0/1. The ACLs on R1 do not filter what they should. ` +
  'Read them in show running-config (and show access-lists on real IOS), and fix them.';
const aclNone = (k, dir, name) => rtReq(k, `has no ACL ${dir === 'in' ? 'inbound' : 'outbound'}`, i => !(dir === 'in' ? i.aclIn : i.aclOut),
  `no ip access-group ${name} ${dir}`);
// starts by deleting the ACL, so typing it twice does not double its entries
const aclSetup = (type, name, entries) => [`no ip access-list ${type} ${name}`, `ip access-list ${type} ${name}`, ...entries, 'exit'];
const TELNET_WRONG = aclSetup('extended', '110', ['permit ip any any', 'deny tcp any any eq telnet']); // the deny never matches
const ACLFIX = {
  beginner: {
    sub: 'ACL 10 should stop 192.168.x.10 entering R1, but it is applied in the wrong direction',
    steps: ['Check ip access-group on Gi0/0 in show running-config.', 'Traffic from PC1 enters R1 on Gi0/0, so it is filtered inbound there.',
      'Remove the outbound ACL and apply it inbound.'],
    setup: x => [['R1', [...LAN_CMDS(x), ...aclSetup('standard', '10', BLOCK10(x)), ...onIf('gi0/0', 'ip access-group 10 out')]]],
    reqs: x => [...LAN_IF(x), aclEntries('10', 'standard', BLOCK10(x)), aclApplied('gi0/0', 'in', '10'), aclNone('gi0/0', 'out', '10')],
    cmds: onIf('gi0/0', 'no ip access-group 10 out', 'ip access-group 10 in'),
  },
  intermediate: {
    sub: 'Since ACL 10 went on, nobody on the LAN gets through',
    steps: ['Read the entries of ACL 10.', 'Every ACL ends in an implicit deny any: what happens to traffic that matches no entry?', 'Add the entry that lets everyone else through.'],
    setup: x => [['R1', [...LAN_CMDS(x), ...aclSetup('standard', '10', [`deny host 192.168.${x}.10`]), ...onIf('gi0/0', 'ip access-group 10 in')]]],
    reqs: x => [...LAN_IF(x), aclEntries('10', 'standard', BLOCK10(x)), aclApplied('gi0/0', 'in', '10')],
    cmds: ['ip access-list standard 10', 'permit any', 'exit'],
  },
  advanced: {
    sub: 'ACL 110 should block Telnet, but Telnet still gets through',
    steps: ['Read the entries of ACL 110 in order: an ACL stops at the first entry that matches.', 'Delete ACL 110 with no ip access-list extended 110.',
      'Write it again with the deny first; the ip access-group line on Gi0/0 can stay.'],
    setup: x => [['R1', [...LAN_CMDS(x), ...TELNET_WRONG, ...onIf('gi0/0', 'ip access-group 110 in')]]],
    reqs: x => [...LAN_IF(x), ...TELNET_ACL],
    cmds: aclSetup('extended', '110', TELNET_ENTRIES),
  },
  expert: {
    sub: 'Two faults: ACL 110 sits on the wrong interface, and web-filter blocks the whole LAN instead of its first half',
    steps: ['ACL 110 must filter traffic from the LAN as it enters R1: find where it is applied now.', 'Move it to inbound Gi0/0.',
      'Check the wildcard in web-filter: the first half of a /24 is 0.0.0.127. Delete and rewrite web-filter.'],
    setup: x => [['R1', [...BOTH_CMDS(x), ...aclSetup('extended', '110', TELNET_ENTRIES),
      ...aclSetup('extended', 'web-filter', [`deny tcp 192.168.${x}.0 0.0.0.255 any eq www`, 'permit ip any any']),
      ...onIf('gi0/1', 'ip access-group 110 in', 'ip access-group web-filter out')]]],
    reqs: x => [...BOTH_IFS(x), ...TELNET_ACL, aclNone('gi0/1', 'in', '110'),
      aclEntries('web-filter', 'extended', WEB_ENTRIES(x)), aclApplied('gi0/1', 'out', 'web-filter')],
    cmds: x => [...onIf('gi0/1', 'no ip access-group 110 in'), ...onIf('gi0/0', 'ip access-group 110 in'),
      ...aclSetup('extended', 'web-filter', WEB_ENTRIES(x))],
  },
};

Object.assign(LABS, {
  trunkfix: {kind: 'sw2', lead: TRUNKFIX_LEAD, levels: TRUNKFIX},
  ospffix: {kind: 'rt', lead: OSPFFIX_LEAD, levels: OSPFFIX},
  intervlanfix: {kind: 'sw', lead: INTERFIX_LEAD, levels: INTERVLANFIX},
  dhcpfix: {kind: 'rt', lead: DHCPFIX_LEAD, levels: DHCPFIX},
  aclfix: {kind: 'rt', lead: ACLFIX_LEAD, levels: ACLFIX},
});
