// Lab definitions: every topic and level, with everything the lab shows and grades (the troubleshooting topics are in labs-fix.js).
// buildLab(T, cfg, x) -> {reqs, solution, steps, nodes, links, home, height?} builds a level for the random network 192.168.x.0 (see the end of this file).
//
// A requirement is {text, ok, hint}: ok(s) is true when it is met (s is the lab session), reading the devices' configuration
// by name through s.config(name) (the fields are listed in devices/device.js). hint is {cmds, port, dev}: the commands
// that meet it, typed on interface port (if any) of device dev (if not the lab's home device).
// A solution is [[device, lines], ...], typed in order.
//
// LABS[topic].kind says how its levels are set up:
//   'v4', 'v6'  addressing on R1; requirements, solution and diagram come from each level's interface list (ifs)
//   'sw', 'mls' the R1-S1 diagram (home S1) or the MLS1 diagram; each level lists its requirements (reqs), and cmds is a known-good config
//   'cdp'       the R1-S1 diagram with home R1
//   'rt'        the R1-R2-R3 diagram; reqs(x) and cmds(x) are the requirements and a known-good config for network x
//   'sw2'       the S1-S2 diagram (trunk troubleshooting); 'hsrp' the R1 and R2 on S1 diagram. Like 'rt', reqs and cmds may take x.
// A level may also have setup [[device, lines], ...]: a preset (often broken) config typed in global configuration on every reset.
// cmds are typed in global configuration on the home device; then lists [device, lines] for the other devices.
// A scenario text (lead) sits on the topic or on the level; a function gets x.
// shortcut: fixed values per level on a random network; move labs to data files when the lab library grows

const portName = key => key.replace('fa', 'Fa').replace('gi', 'Gi'); // 'fa0/1' -> 'Fa0/1'
const MASK24 = '255.255.255.0';
// the lead of the router labs: R1's LAN, then what else is cabled to it
const serves = rest => x => L(`R1 Gi0/0 serves 192.168.${x}.0/24. ${rest}`, `R1 Gi0/0 obsluhuje 192.168.${x}.0/24. ${rest}`);
// solution helpers: lines on an interface (ending back in global configuration), and global configuration lines on another device
const onIf = (k, ...lines) => [`int ${k}`, ...lines, 'exit'];
const onDev = (dev, ...lines) => [dev, ['enable', 'conf t', ...lines, 'end']];
const R1 = s => s.config('R1');
const SW = s => s.config('S1') || s.config('MLS1'); // the lab's switch

// PCs, configured from their own console (devices/pc.js)
const pcStatic = (pc, ip, gw) => ({
  text: L(`${pc} is ${ip} ${MASK24} with gateway ${gw}`, `${pc} má adresu ${ip} ${MASK24} s bránou ${gw}`),
  ok: s => !!s.config(pc) && s.config(pc).ip === ip && s.config(pc).mask === MASK24 && s.config(pc).gw === gw,
  hint: {cmds: [`ip ${ip} ${MASK24} ${gw}`], dev: pc},
});
// with gw, the lease must also carry that default gateway
const pcLease = (pc, net, gw) => ({
  text: L(`${pc} gets an address in ${net}.0/24 by DHCP`, `${pc} dostane adresu v ${net}.0/24 přes DHCP`) + (gw ? L(` with gateway ${gw}`, ` s bránou ${gw}`) : ''),
  ok: s => !!s.config(pc) && s.config(pc).dhcp && s.config(pc).ip.startsWith(net + '.') && (!gw || s.config(pc).gw === gw),
  hint: {cmds: ['dhcp'], dev: pc},
});
const pcPings = (pc, other) => ({
  text: L(`${pc} can ping ${other}`, `${pc} pingne ${other}`),
  ok: s => !!s.config(other) && !!s.config(other).ip && s.devices[pc].canReach(s.config(other).ip),
  hint: {cmds: [`ping <${other}'s address>`], dev: pc},
});

// ---- 1.0 network fundamentals: addressing ----
// ifs lists R1's interfaces: k = interface, host = last octet of its address, net = its subnet inside the /24,
// lan = its name, rule = first or last usable address, need = how many hosts it must fit (VLSM)

const IPV4 = {
  beginner: {sub: L('Address one LAN on R1 and bring the interface up', 'Adresuj jednu LAN na R1 a zapni rozhraní'), ifs: [
    {k: 'gi0/0', host: 1, mask: '255.255.255.128', net: '0/25', lan: 'LAN 1', rule: 'first'},
  ]},
  intermediate: {sub: L('Address two LANs on R1 using first usable addresses', 'Adresuj dvě LAN na R1 prvními použitelnými adresami'), ifs: [
    {k: 'gi0/0', host: 1, mask: '255.255.255.128', net: '0/25', lan: 'LAN 1', rule: 'first'},
    {k: 'gi0/1', host: 129, mask: '255.255.255.192', net: '128/26', lan: 'LAN 2', rule: 'first'},
  ]},
  advanced: {sub: L('Address two LANs on R1 using last usable addresses', 'Adresuj dvě LAN na R1 posledními použitelnými adresami'), ifs: [
    {k: 'gi0/0', host: 126, mask: '255.255.255.128', net: '0/25', lan: 'LAN 1', rule: 'last'},
    {k: 'gi0/1', host: 190, mask: '255.255.255.192', net: '128/26', lan: 'LAN 2', rule: 'last'},
  ]},
  expert: {sub: L('Address three LANs on R1 using last usable addresses', 'Adresuj tři LAN na R1 posledními použitelnými adresami'), ifs: [
    {k: 'gi0/0', host: 62, mask: '255.255.255.192', net: '0/26', lan: 'LAN 1', rule: 'last'},
    {k: 'gi0/1', host: 94, mask: '255.255.255.224', net: '64/27', lan: 'LAN 2', rule: 'last'},
    {k: 'gi0/2', host: 126, mask: '255.255.255.224', net: '96/27', lan: 'LAN 3', rule: 'last'},
  ]},
};

const SUBNET = {
  beginner: {sub: L('Split the /24 into two equal blocks and address R1 in each', 'Rozděl /24 na dva stejné bloky a adresuj R1 v každém'), ifs: [
    {k: 'gi0/0', host: 1, mask: '255.255.255.128', net: '0/25', lan: L('block 1', 'blok 1'), rule: 'first'},
    {k: 'gi0/1', host: 129, mask: '255.255.255.128', net: '128/25', lan: L('block 2', 'blok 2'), rule: 'first'},
  ]},
  intermediate: {sub: L('Use three equal blocks from the /24 and address R1 in each', 'Použij tři stejné bloky z /24 a adresuj R1 v každém'), ifs: [
    {k: 'gi0/0', host: 1, mask: '255.255.255.192', net: '0/26', lan: L('block 1', 'blok 1'), rule: 'first'},
    {k: 'gi0/1', host: 65, mask: '255.255.255.192', net: '64/26', lan: L('block 2', 'blok 2'), rule: 'first'},
    {k: 'gi0/2', host: 129, mask: '255.255.255.192', net: '128/26', lan: L('block 3', 'blok 3'), rule: 'first'},
  ]},
  advanced: {sub: L('Split the /24 into eight equal blocks and address R1 in blocks 1 to 4', 'Rozděl /24 na osm stejných bloků a adresuj R1 v blocích 1 až 4'), ifs: [
    {k: 'gi0/0', host: 1, mask: '255.255.255.224', net: '0/27', lan: L('block 1', 'blok 1'), rule: 'first'},
    {k: 'gi0/1', host: 33, mask: '255.255.255.224', net: '32/27', lan: L('block 2', 'blok 2'), rule: 'first'},
    {k: 'gi0/2', host: 65, mask: '255.255.255.224', net: '64/27', lan: L('block 3', 'blok 3'), rule: 'first'},
    {k: 'gi0/3', host: 97, mask: '255.255.255.224', net: '96/27', lan: L('block 4', 'blok 4'), rule: 'first'},
  ]},
  expert: {sub: L('Split the /24 into eight equal blocks and address R1 in blocks 5 to 8, using last usable addresses', 'Rozděl /24 na osm stejných bloků a adresuj R1 v blocích 5 až 8 posledními použitelnými adresami'), ifs: [
    {k: 'gi0/0', host: 158, mask: '255.255.255.224', net: '128/27', lan: L('block 5', 'blok 5'), rule: 'last'},
    {k: 'gi0/1', host: 190, mask: '255.255.255.224', net: '160/27', lan: L('block 6', 'blok 6'), rule: 'last'},
    {k: 'gi0/2', host: 222, mask: '255.255.255.224', net: '192/27', lan: L('block 7', 'blok 7'), rule: 'last'},
    {k: 'gi0/3', host: 254, mask: '255.255.255.224', net: '224/27', lan: L('block 8', 'blok 8'), rule: 'last'},
  ]},
};

// VLSM host needs change with the network number x. Ranges are per LAN, largest first; their blocks never sum past
// 128+64+32+16, so the LANs always fit one after another in the /24 with every block aligned.
const VLSM_RANGES = [[33, 120], [17, 60], [9, 28], [3, 12]];
const vlsmIfs = (x, count, rule) => {
  let seed = (x + 1) * 7919; // same x, same lab
  const roll = (lo, hi) => lo + Math.floor((seed = seed * 16807 % 2147483647) / 2147483647 * (hi - lo + 1));
  let off = 0;
  return VLSM_RANGES.slice(0, count).map(([lo, hi], i) => {
    const need = roll(lo, hi);
    let size = 4;
    while (size - 2 < need) size *= 2;
    const mask = `255.255.255.${256 - size}`, net = `${off}/${32 - Math.log2(size)}`, host = rule === 'first' ? off + 1 : off + size - 2;
    off += size;
    return {k: `gi0/${i}`, host, mask, net, lan: `LAN ${'ABCD'[i]}`, need, rule};
  });
};
const vlsmLevel = (count, rule, sub) => ({
  sub: x => sub(vlsmIfs(x, count, rule).map(r => r.need)),
  ifs: x => vlsmIfs(x, count, rule),
});
const needsText = n => L(`${n.slice(0, -1).join(', ')} and ${n.at(-1)}`, `${n.slice(0, -1).join(', ')} a ${n.at(-1)}`);
const VLSM = {
  beginner: vlsmLevel(2, 'first', n => L(`Address two LANs that need ${needsText(n)} hosts, using first usable addresses`, `Adresuj dvě LAN, které potřebují ${needsText(n)} ${cz(n.at(-1), 'hostitele', 'hostitele', 'hostitelů')}, prvními použitelnými adresami`)),
  intermediate: vlsmLevel(3, 'first', n => L(`Address three LANs that need ${needsText(n)} hosts, using first usable addresses`, `Adresuj tři LAN, které potřebují ${needsText(n)} ${cz(n.at(-1), 'hostitele', 'hostitele', 'hostitelů')}, prvními použitelnými adresami`)),
  advanced: vlsmLevel(4, 'first', n => L(`Address four LANs that need ${needsText(n)} hosts, using first usable addresses`, `Adresuj čtyři LAN, které potřebují ${needsText(n)} ${cz(n.at(-1), 'hostitele', 'hostitele', 'hostitelů')}, prvními použitelnými adresami`)),
  expert: vlsmLevel(4, 'last', n => L(`The same four LANs (${needsText(n)} hosts), using last usable addresses`, `Stejné čtyři LAN (${needsText(n)} ${cz(n.at(-1), 'hostitele', 'hostitele', 'hostitelů')}), posledními použitelnými adresami`)),
};

// sub = the subnet number inside the /48, ll = also needs the link-local address fe80::1
const IPV6 = {
  beginner: {sub: L('Give Gi0/0 a global IPv6 address in subnet 1 and bring it up', 'Dej Gi0/0 globální IPv6 adresu v podsíti 1 a zapni ho'), ifs: [{k: 'gi0/0', sub: 1}]},
  intermediate: {sub: L('Address two IPv6 subnets, one on Gi0/0 and one on Gi0/1', 'Adresuj dvě IPv6 podsítě, jednu na Gi0/0 a jednu na Gi0/1'), ifs: [{k: 'gi0/0', sub: 1}, {k: 'gi0/1', sub: 2}]},
  advanced: {sub: L('Address three IPv6 subnets, and give Gi0/0 the link-local address fe80::1', 'Adresuj tři IPv6 podsítě a dej Gi0/0 link-local adresu fe80::1'), ifs: [
    {k: 'gi0/0', sub: 1, ll: true}, {k: 'gi0/1', sub: 2}, {k: 'gi0/2', sub: 3},
  ]},
  expert: {sub: L('Address four IPv6 subnets, with link-local address fe80::1 on every interface', 'Adresuj čtyři IPv6 podsítě s link-local adresou fe80::1 na každém rozhraní'), ifs: [
    {k: 'gi0/0', sub: 1, ll: true}, {k: 'gi0/1', sub: 2, ll: true}, {k: 'gi0/2', sub: 3, ll: true}, {k: 'gi0/3', sub: 4, ll: true},
  ]},
};

// CDP and LLDP run on R1.
const LLDP_ON = {text: L('LLDP is enabled globally', 'LLDP je zapnuté globálně'), ok: s => R1(s).lldp, hint: {cmds: ['lldp run']}};
const CDP_OFF = {text: L('CDP is disabled globally', 'CDP je vypnuté globálně'), ok: s => !R1(s).cdp, hint: {cmds: ['no cdp run']}};
const learnsS1 = hint => ({text: L('R1 learns S1 over LLDP on Gi0/0', 'R1 se přes LLDP na Gi0/0 dozví o S1'), ok: s => R1(s).lldp && !R1(s).ifs['gi0/0'].shut, hint});
const GI00_UP = {cmds: ['no shutdown'], port: 'Gi0/0'};
const CDP_LEAD = L('R1 is connected to S1 on Gi0/0. CDP is running.', 'R1 je připojený k S1 na Gi0/0. CDP běží.');
const CDP = {
  beginner: {
    sub: L('Turn LLDP on and make R1 learn S1 over LLDP', 'Zapni LLDP a nech R1 dozvědět se o S1 přes LLDP'),
    lead: L('R1 is connected to S1 on Gi0/0. Discovery is set up as on a fresh device.', 'R1 je připojený k S1 na Gi0/0. Zjišťování sousedů je nastavené jako na novém zařízení.'),
    steps: [L('Turn LLDP on for the whole device.', 'Zapni LLDP pro celé zařízení.'), L('Bring up Gi0/0 so the link is active.', 'Zapni Gi0/0, aby linka byla aktivní.')],
    cmds: ['lldp run', 'int gi0/0', 'no shutdown', 'exit'],
    reqs: [LLDP_ON, learnsS1({cmds: ['lldp run', 'interface Gi0/0', 'no shutdown']})],
  },
  intermediate: {
    sub: L('Turn CDP off, run LLDP, and make R1 learn S1 over LLDP', 'Vypni CDP, spusť LLDP a nech R1 dozvědět se o S1 přes LLDP'),
    lead: CDP_LEAD,
    steps: [L('Turn CDP off for the whole device.', 'Vypni CDP pro celé zařízení.'), L('Turn LLDP on and bring up Gi0/0.', 'Zapni LLDP a zapni Gi0/0.')],
    cmds: ['no cdp run', 'lldp run', 'int gi0/0', 'no shutdown', 'exit'],
    reqs: [CDP_OFF, LLDP_ON, learnsS1(GI00_UP)],
  },
  advanced: {
    sub: L('Keep CDP and LLDP on, but turn CDP off on Gi0/0 and bring it up', 'Nech CDP i LLDP zapnuté, ale vypni CDP na Gi0/0 a zapni ho'),
    lead: CDP_LEAD,
    steps: [L('Keep CDP and LLDP running for the whole device.', 'Nech CDP i LLDP běžet pro celé zařízení.'), L('Turn CDP off on Gi0/0 only.', 'Vypni CDP jen na Gi0/0.')],
    cmds: ['lldp run', 'int gi0/0', 'no cdp enable', 'no shutdown', 'exit'],
    reqs: [
      {text: L('CDP is enabled globally', 'CDP je zapnuté globálně'), ok: s => R1(s).cdp, hint: {cmds: ['cdp run']}},
      LLDP_ON,
      {text: L('Gi0/0 has CDP disabled', 'Gi0/0 má vypnuté CDP'), ok: s => R1(s).ifs['gi0/0'].cdp === false, hint: {cmds: ['no cdp enable'], port: 'Gi0/0'}},
      learnsS1(GI00_UP),
    ],
  },
  expert: {
    sub: L('Turn CDP off everywhere, keep LLDP running, and bring up Gi0/0 and Gi0/1', 'Vypni CDP všude, nech běžet LLDP a zapni Gi0/0 a Gi0/1'),
    lead: CDP_LEAD,
    steps: [L('Turn CDP off for the whole device.', 'Vypni CDP pro celé zařízení.'), L('Keep LLDP running and bring up both interfaces.', 'Nech běžet LLDP a zapni obě rozhraní.')],
    cmds: ['no cdp run', 'lldp run', 'int gi0/0', 'no shutdown', 'exit', 'int gi0/1', 'no shutdown', 'exit'],
    reqs: [CDP_OFF, LLDP_ON, learnsS1(GI00_UP), {text: L('Gi0/1 is up', 'Gi0/1 je zapnuté'), ok: s => !R1(s).ifs['gi0/1'].shut, hint: {cmds: ['no shutdown'], port: 'Gi0/1'}}],
  },
};

// ---- 2.0 network access: switch labs ----

// the R1-S1 diagram used by the switch and CDP labs; home is the device whose console opens first (R1 in the CDP labs)
const SW_TOPO = {
  nodes: [
    {id: 'R1', type: 'router', x: 8, y: 64, sub: L('Router', 'Router')},
    {id: 'S1', type: 'switch', x: 190, y: 64, sub: L('Switch', 'Switch')},
    {id: 'PC1', type: 'pc', x: 370, y: 24, sub: L('Host', 'Hostitel'), at: 'S1 fa0/1'},
    {id: 'PC2', type: 'pc', x: 370, y: 104, sub: L('Host', 'Hostitel'), at: 'S1 fa0/2'},
  ],
  links: [{a: 'R1', b: 'S1', port: 'Gi0/0'}, {a: 'S1', b: 'PC1', port: 'Fa0/1'}, {a: 'S1', b: 'PC2', port: 'Fa0/2'}],
  home: 'S1',
};
const SW_LEAD = L('R1 Gi0/0 is cabled to S1 Gi0/1. PC1 is on Fa0/1 and PC2 on Fa0/2.', 'R1 Gi0/0 je propojený s S1 Gi0/1. PC1 je na Fa0/1 a PC2 na Fa0/2.');

const swVlan = (id, name) => ({
  text: `VLAN ${id}${name ? L(` is named ${name}`, ` se jmenuje ${name}`) : L(' exists', ' existuje')}`,
  ok: s => !!SW(s).vlans[id] && (!name || SW(s).vlans[id].name === name),
  hint: {cmds: name ? [`vlan ${id}`, `name ${name}`] : [`vlan ${id}`]},
});
// a switch port requirement: the text after the port name, the check on the port, and the commands on that port
const swReq = (p, text, ok, ...cmds) => ({text: `${portName(p)} ${text}`, ok: s => ok(SW(s).ports[p]), hint: {cmds, port: portName(p)}});
const swAccess = (p, id) => swReq(p, L(`is an access port in VLAN ${id}`, `je access port ve VLAN ${id}`), q => q.mode === 'access' && q.vlan === id,
  'switchport mode access', `switchport access vlan ${id}`);
const swMode = p => swReq(p, L('is an access port', 'je access port'), q => q.mode === 'access', 'switchport mode access');
const swUp = p => swReq(p, L('is up', 'je zapnutý'), q => !q.shut, 'no shutdown');
const swDown = p => swReq(p, L('is shut down', 'je vypnutý'), q => q.shut, 'shutdown');
const swDesc = (p, d) => swReq(p, L(`has the description ${d}`, `má popis ${d}`), q => q.desc === d, `description ${d}`);
const swTrunk = p => swReq(p, L('is a trunk', 'je trunk'), q => q.mode === 'trunk', 'switchport mode trunk');
const swAllowed = (p, list) => swReq(p, L(`allows only VLANs ${list.join(', ')} on the trunk`, `povoluje na trunku jen VLANy ${list.join(', ')}`),
  q => !!q.allowed && q.allowed.join(',') === list.join(','), `switchport trunk allowed vlan ${list.join(',')}`);
const swNative = (p, id) => swReq(p, L(`uses VLAN ${id} as the native VLAN`, `používá VLAN ${id} jako native VLAN`), q => q.native === id, `switchport trunk native vlan ${id}`);
const r1Up = {text: L('R1 Gi0/0 is up', 'R1 Gi0/0 je zapnuté'), ok: s => !R1(s).ifs['gi0/0'].shut, hint: {cmds: ['no shutdown'], port: 'Gi0/0', dev: 'R1'}};

const TRUNK_UP = [swTrunk('gi0/1'), swUp('gi0/1'), r1Up];
const PCS_IN_10_20 = [swAccess('fa0/1', 10), swAccess('fa0/2', 20), swUp('fa0/1'), swUp('fa0/2')];
const NATIVE_99 = [swVlan(99), swNative('gi0/1', 99), swAllowed('gi0/1', [10, 20, 99])];

// known-good commands for the switch labs: typed on S1, the home device; R1's and the PCs' parts go in then
const accessCmds = (p, id) => onIf(p, 'switchport mode access', `switchport access vlan ${id}`, 'no shutdown');
const PCS_10_20_CMDS = [...accessCmds('fa0/1', 10), ...accessCmds('fa0/2', 20)];
const TRUNK_CMDS = onIf('gi0/1', 'switchport mode trunk', 'no shutdown');
const NATIVE_99_CMDS = ['vlan 99', 'exit', ...onIf('gi0/1', 'switchport trunk native vlan 99', 'switchport trunk allowed vlan 10,20,99')];
const R1_UP = onDev('R1', ...onIf('gi0/0', 'no shutdown'));
const VLANS_A_CMDS = ['vlan 10', 'name Sales', 'exit', 'vlan 20', 'name Staff', 'exit', ...PCS_10_20_CMDS];
const accessUp = p => onIf(p, 'switchport mode access', 'no shutdown');
const ACCESS_A_CMDS = [...accessUp('fa0/1'), ...accessUp('fa0/2'), ...onIf('fa0/3', 'shutdown')];

const VLANS = {
  beginner: {
    sub: L('Create VLAN 10 and put Fa0/1 in it', 'Vytvoř VLAN 10 a dej do něj Fa0/1'),
    steps: [L('Create VLAN 10 on S1.', 'Vytvoř na S1 VLAN 10.'), L('Make Fa0/1 an access port in VLAN 10.', 'Nastav Fa0/1 jako access port ve VLAN 10.'), L('Bring Fa0/1 up.', 'Zapni Fa0/1.')],
    reqs: [swVlan(10), swAccess('fa0/1', 10), swUp('fa0/1')],
    cmds: ['vlan 10', 'exit', ...accessCmds('fa0/1', 10)],
  },
  intermediate: {
    sub: L('Create VLANs 10 and 20, and put Fa0/1 and Fa0/2 in them', 'Vytvoř VLANy 10 a 20 a dej do nich Fa0/1 a Fa0/2'),
    steps: [L('Create VLANs 10 and 20 on S1.', 'Vytvoř na S1 VLANy 10 a 20.'), L('Put Fa0/1 in VLAN 10 and Fa0/2 in VLAN 20.', 'Dej Fa0/1 do VLAN 10 a Fa0/2 do VLAN 20.'), L('Bring both ports up.', 'Zapni oba porty.')],
    reqs: [swVlan(10), swVlan(20), ...PCS_IN_10_20],
    cmds: ['vlan 10', 'exit', 'vlan 20', 'exit', ...PCS_10_20_CMDS],
  },
  advanced: {
    sub: L('Create named VLANs Sales (10) and Staff (20), and put Fa0/1 and Fa0/2 in them', 'Vytvoř pojmenované VLANy Sales (10) a Staff (20) a dej do nich Fa0/1 a Fa0/2'),
    steps: [L('Create VLAN 10 named Sales and VLAN 20 named Staff.', 'Vytvoř VLAN 10 s názvem Sales a VLAN 20 s názvem Staff.'), L('Put Fa0/1 in VLAN 10 and Fa0/2 in VLAN 20.', 'Dej Fa0/1 do VLAN 10 a Fa0/2 do VLAN 20.'), L('Bring both ports up.', 'Zapni oba porty.')],
    reqs: [swVlan(10, 'Sales'), swVlan(20, 'Staff'), ...PCS_IN_10_20],
    cmds: VLANS_A_CMDS,
  },
  expert: {
    sub: L('Add a Parking VLAN 999 for the unused Fa0/3 and shut Fa0/3 down', 'Přidej parkovací VLAN 999 pro nepoužívaný Fa0/3 a Fa0/3 vypni'),
    steps: [L('Create VLAN 999 named Parking.', 'Vytvoř VLAN 999 s názvem Parking.'), L('Put Fa0/3 in VLAN 999 and shut it down.', 'Dej Fa0/3 do VLAN 999 a vypni ho.'), L('Keep Fa0/1 and Fa0/2 working in their VLANs.', 'Nech Fa0/1 a Fa0/2 fungovat v jejich VLANech.')],
    reqs: [swVlan(10, 'Sales'), swVlan(20, 'Staff'), swVlan(999, 'Parking'), ...PCS_IN_10_20, swAccess('fa0/3', 999), swDown('fa0/3')],
    cmds: [...VLANS_A_CMDS, 'vlan 999', 'name Parking', 'exit', ...onIf('fa0/3', 'switchport mode access', 'switchport access vlan 999', 'shutdown')],
  },
};

const ACCESS = {
  beginner: {
    sub: L('Make Fa0/1 an access port and bring it up', 'Nastav Fa0/1 jako access port a zapni ho'),
    steps: [L('Set Fa0/1 to access mode.', 'Nastav Fa0/1 do režimu access.'), L('Bring Fa0/1 up.', 'Zapni Fa0/1.')],
    reqs: [swMode('fa0/1'), swUp('fa0/1')],
    cmds: accessUp('fa0/1'),
  },
  intermediate: {
    sub: L('Make Fa0/1 and Fa0/2 access ports and bring both up', 'Nastav Fa0/1 a Fa0/2 jako access porty a oba zapni'),
    steps: [L('Set Fa0/1 and Fa0/2 to access mode.', 'Nastav Fa0/1 a Fa0/2 do režimu access.'), L('Bring both ports up.', 'Zapni oba porty.')],
    reqs: [swMode('fa0/1'), swMode('fa0/2'), swUp('fa0/1'), swUp('fa0/2')],
    cmds: [...accessUp('fa0/1'), ...accessUp('fa0/2')],
  },
  advanced: {
    sub: L('Make Fa0/1 and Fa0/2 access ports, and shut down the unused Fa0/3', 'Nastav Fa0/1 a Fa0/2 jako access porty a vypni nepoužívaný Fa0/3'),
    steps: [L('Set Fa0/1 and Fa0/2 to access mode.', 'Nastav Fa0/1 a Fa0/2 do režimu access.'), L('Bring Fa0/1 and Fa0/2 up.', 'Zapni Fa0/1 a Fa0/2.'), L('Shut down the unused Fa0/3.', 'Vypni nepoužívaný Fa0/3.')],
    reqs: [swMode('fa0/1'), swMode('fa0/2'), swUp('fa0/1'), swUp('fa0/2'), swDown('fa0/3')],
    cmds: ACCESS_A_CMDS,
  },
  expert: {
    sub: L('As Advanced, and give each PC port a description', 'Jako Pokročilý a navíc dej každému portu s PC popis'),
    steps: [L('Set Fa0/1 and Fa0/2 to access mode and bring them up.', 'Nastav Fa0/1 a Fa0/2 do režimu access a zapni je.'), L('Shut down the unused Fa0/3.', 'Vypni nepoužívaný Fa0/3.'), L('Describe Fa0/1 as PC1 and Fa0/2 as PC2.', 'Popiš Fa0/1 jako PC1 a Fa0/2 jako PC2.')],
    reqs: [swMode('fa0/1'), swMode('fa0/2'), swUp('fa0/1'), swUp('fa0/2'), swDown('fa0/3'), swDesc('fa0/1', 'PC1'), swDesc('fa0/2', 'PC2')],
    cmds: [...ACCESS_A_CMDS, ...onIf('fa0/1', 'description PC1'), ...onIf('fa0/2', 'description PC2')],
  },
};

const TRUNK = {
  beginner: {
    sub: L('Make Gi0/1 on S1 a trunk to R1 and bring both sides up', 'Udělej z Gi0/1 na S1 trunk k R1 a zapni obě strany'),
    steps: [L('Set Gi0/1 on S1 to trunk mode.', 'Nastav Gi0/1 na S1 do režimu trunk.'), L('Bring Gi0/1 on S1 up.', 'Zapni Gi0/1 na S1.'), L('Bring R1 Gi0/0 up.', 'Zapni R1 Gi0/0.')],
    reqs: TRUNK_UP,
    cmds: TRUNK_CMDS,
    then: [R1_UP],
  },
  intermediate: {
    sub: L('Allow only VLANs 10 and 20 on the trunk', 'Povol na trunku jen VLANy 10 a 20'),
    steps: [L('Keep the trunk up on both sides.', 'Nech trunk zapnutý na obou stranách.'), L('Allow only VLANs 10 and 20 on the trunk.', 'Povol na trunku jen VLANy 10 a 20.')],
    reqs: [...TRUNK_UP, swAllowed('gi0/1', [10, 20])],
    cmds: [...TRUNK_CMDS, ...onIf('gi0/1', 'switchport trunk allowed vlan 10,20')],
    then: [R1_UP],
  },
  advanced: {
    sub: L('Set the native VLAN to 99 and allow VLANs 10, 20 and 99 on the trunk', 'Nastav native VLAN na 99 a povol na trunku VLANy 10, 20 a 99'),
    steps: [L('Create VLAN 99.', 'Vytvoř VLAN 99.'), L('Set VLAN 99 as the native VLAN.', 'Nastav VLAN 99 jako native VLAN.'), L('Allow VLANs 10, 20 and 99 on the trunk.', 'Povol na trunku VLANy 10, 20 a 99.')],
    reqs: [...TRUNK_UP, ...NATIVE_99],
    cmds: [...TRUNK_CMDS, ...NATIVE_99_CMDS],
    then: [R1_UP],
  },
  expert: {
    sub: L('As Advanced, and make Fa0/1 and Fa0/2 access ports on VLANs 10 and 20', 'Jako Pokročilý a navíc nastav Fa0/1 a Fa0/2 jako access porty ve VLANech 10 a 20'),
    steps: [L('Finish the trunk as in Advanced.', 'Dokonči trunk jako v úrovni Pokročilý.'), L('Make Fa0/1 an access port in VLAN 10 and Fa0/2 in VLAN 20.', 'Nastav Fa0/1 jako access port ve VLAN 10 a Fa0/2 ve VLAN 20.'), L('Bring Fa0/1 and Fa0/2 up.', 'Zapni Fa0/1 a Fa0/2.')],
    reqs: [...TRUNK_UP, ...NATIVE_99, ...PCS_IN_10_20],
    cmds: [...TRUNK_CMDS, ...NATIVE_99_CMDS, ...PCS_10_20_CMDS],
    then: [R1_UP],
  },
};

// STP, EtherChannel, inter-VLAN routing
const swRoot = id => ({
  text: L(`S1 is root for VLAN ${id}`, `S1 je root pro VLAN ${id}`),
  ok: s => SW(s).stp.prio[id] !== undefined && SW(s).stp.prio[id] <= 24576,
  hint: {cmds: [`spanning-tree vlan ${id} root primary`]},
});
const swPrio = (id, n) => ({text: L(`VLAN ${id} has spanning-tree priority ${n}`, `VLAN ${id} má prioritu spanning-tree ${n}`), ok: s => SW(s).stp.prio[id] === n, hint: {cmds: [`spanning-tree vlan ${id} priority ${n}`]}});
const swRstp = {text: L('S1 runs Rapid PVST+', 'S1 používá Rapid PVST+'), ok: s => SW(s).stp.mode === 'rapid-pvst', hint: {cmds: ['spanning-tree mode rapid-pvst']}};
const swPortfast = p => swReq(p, L('has PortFast enabled', 'má zapnutý PortFast'), q => q.portfast === true, 'spanning-tree portfast');
const swBpdu = p => swReq(p, L('has BPDU guard enabled', 'má zapnutý BPDU guard'), q => q.bpdu === true, 'spanning-tree bpduguard enable');
const swGroup = (p, n, mode) => swReq(p, L(`is in channel-group ${n} with mode ${mode}`, `je v channel-group ${n} v režimu ${mode}`), q => q.group === n && q.chanMode === mode, `channel-group ${n} mode ${mode}`);
const swLb = v => ({text: L(`EtherChannel load balancing is ${v}`, `Rozkládání zátěže EtherChannel je ${v}`), ok: s => SW(s).lb === v, hint: {cmds: [`port-channel load-balance ${v}`]}});
// R1 subinterface Gi0/0.<vlan> with 192.168.<vlan>.1/24 (router-on-a-stick)
const r1Sub = vlan => {
  const key = `gi0/0.${vlan}`, name = `Gi0/0.${vlan}`, ip = `192.168.${vlan}.1`, mask = '255.255.255.0';
  const sub = (text, ok, cmd) => ({text: `${name} ${text}`, ok: s => !!R1(s).ifs[key] && ok(R1(s).ifs[key]), hint: {cmds: [cmd], port: name, dev: 'R1'}});
  return [
    sub(L(`is encapsulation dot1Q ${vlan}`, `má encapsulation dot1Q ${vlan}`), i => i.encap === vlan, `encapsulation dot1Q ${vlan}`),
    sub(L(`has the address ${ip} ${mask}`, `má adresu ${ip} ${mask}`), i => i.ip === ip && i.mask === mask, `ip address ${ip} ${mask}`),
    sub(L('is up', 'je zapnuté'), i => !i.shut, 'no shutdown'),
  ];
};
const INTER_LEAD = L('R1 Gi0/0 is cabled to S1 Gi0/1 as a trunk. PC1 is on Fa0/1 and PC2 on Fa0/2.', 'R1 Gi0/0 je propojený s S1 Gi0/1 jako trunk. PC1 je na Fa0/1 a PC2 na Fa0/2.');
const LACP = [swGroup('fa0/1', 1, 'active'), swGroup('fa0/2', 1, 'active')];
const ROOT_10_20 = ['spanning-tree vlan 10 root primary', 'spanning-tree vlan 20 root primary'];
const RSTP_CMD = 'spanning-tree mode rapid-pvst';
const guardCmds = p => onIf(p, 'spanning-tree portfast', 'spanning-tree bpduguard enable');
const ADVSTP_A_CMDS = [RSTP_CMD, ...guardCmds('fa0/1'), ...guardCmds('fa0/2')];
// channel-group 1 on Fa0/1 and Fa0/2, with the same extra lines on both
const chanCmds = (mode, ...lines) => ['fa0/1', 'fa0/2'].flatMap(p => onIf(p, `channel-group 1 mode ${mode}`, ...lines));
const LB_CMD = 'port-channel load-balance src-dst-ip';

const STP = {
  beginner: {
    sub: L('Make S1 the root bridge for VLAN 10', 'Udělej z S1 root bridge pro VLAN 10'),
    steps: [L('Make S1 the root for VLAN 10 with spanning-tree vlan 10 root primary.', 'Udělej z S1 root pro VLAN 10 příkazem spanning-tree vlan 10 root primary.')],
    reqs: [swRoot(10)],
    cmds: ['spanning-tree vlan 10 root primary'],
  },
  intermediate: {
    sub: L('Make S1 the root bridge for VLANs 10 and 20', 'Udělej z S1 root bridge pro VLANy 10 a 20'),
    steps: [L('Make S1 the root for VLAN 10.', 'Udělej z S1 root pro VLAN 10.'), L('Make S1 the root for VLAN 20.', 'Udělej z S1 root pro VLAN 20.')],
    reqs: [swRoot(10), swRoot(20)],
    cmds: ROOT_10_20,
  },
  advanced: {
    sub: L('Run Rapid PVST+ and make S1 the root for VLANs 10 and 20', 'Spusť Rapid PVST+ a udělej z S1 root pro VLANy 10 a 20'),
    steps: [L('Set the spanning-tree mode to rapid-pvst.', 'Nastav režim spanning-tree na rapid-pvst.'), L('Make S1 the root for VLANs 10 and 20.', 'Udělej z S1 root pro VLANy 10 a 20.')],
    reqs: [swRstp, swRoot(10), swRoot(20)],
    cmds: [RSTP_CMD, ...ROOT_10_20],
  },
  expert: {
    sub: L('As Advanced, and give VLAN 30 a backup priority of 28672', 'Jako Pokročilý a navíc dej VLAN 30 záložní prioritu 28672'),
    steps: [L('Keep Rapid PVST+ and S1 root for VLANs 10 and 20.', 'Nech Rapid PVST+ a S1 jako root pro VLANy 10 a 20.'), L('Set VLAN 30 to priority 28672.', 'Nastav VLAN 30 prioritu 28672.')],
    reqs: [swRstp, swRoot(10), swRoot(20), swPrio(30, 28672)],
    cmds: [RSTP_CMD, ...ROOT_10_20, 'spanning-tree vlan 30 priority 28672'],
  },
};

const ADVSTP = {
  beginner: {
    sub: L('Run Rapid PVST+ on S1', 'Spusť na S1 Rapid PVST+'),
    steps: [L('Set the spanning-tree mode to rapid-pvst.', 'Nastav režim spanning-tree na rapid-pvst.')],
    reqs: [swRstp],
    cmds: [RSTP_CMD],
  },
  intermediate: {
    sub: L('Run Rapid PVST+ and enable PortFast on Fa0/1 and Fa0/2', 'Spusť Rapid PVST+ a zapni PortFast na Fa0/1 a Fa0/2'),
    steps: [L('Set the spanning-tree mode to rapid-pvst.', 'Nastav režim spanning-tree na rapid-pvst.'), L('Enable PortFast on Fa0/1 and Fa0/2.', 'Zapni PortFast na Fa0/1 a Fa0/2.')],
    reqs: [swRstp, swPortfast('fa0/1'), swPortfast('fa0/2')],
    cmds: [RSTP_CMD, ...onIf('fa0/1', 'spanning-tree portfast'), ...onIf('fa0/2', 'spanning-tree portfast')],
  },
  advanced: {
    sub: L('As Intermediate, and enable BPDU guard on Fa0/1 and Fa0/2', 'Jako Mírně pokročilý a navíc zapni BPDU guard na Fa0/1 a Fa0/2'),
    steps: [L('Keep Rapid PVST+ and PortFast on Fa0/1 and Fa0/2.', 'Nech Rapid PVST+ a PortFast na Fa0/1 a Fa0/2.'), L('Enable BPDU guard on Fa0/1 and Fa0/2.', 'Zapni BPDU guard na Fa0/1 a Fa0/2.')],
    reqs: [swRstp, swPortfast('fa0/1'), swPortfast('fa0/2'), swBpdu('fa0/1'), swBpdu('fa0/2')],
    cmds: ADVSTP_A_CMDS,
  },
  expert: {
    sub: L('As Advanced, and also protect the unused Fa0/3 with PortFast and BPDU guard', 'Jako Pokročilý a navíc chraň nepoužívaný Fa0/3 pomocí PortFast a BPDU guard'),
    steps: [L('Keep the Advanced settings on Fa0/1 and Fa0/2.', 'Nech nastavení z úrovně Pokročilý na Fa0/1 a Fa0/2.'), L('Enable PortFast and BPDU guard on Fa0/3.', 'Zapni PortFast a BPDU guard na Fa0/3.')],
    reqs: [swRstp, swPortfast('fa0/1'), swPortfast('fa0/2'), swBpdu('fa0/1'), swBpdu('fa0/2'), swPortfast('fa0/3'), swBpdu('fa0/3')],
    cmds: [...ADVSTP_A_CMDS, ...guardCmds('fa0/3')],
  },
};

const ETHERCHANNEL = {
  beginner: {
    sub: L('Bundle Fa0/1 and Fa0/2 into channel-group 1 with mode on', 'Spoj Fa0/1 a Fa0/2 do channel-group 1 v režimu on'),
    steps: [L('Use channel-group 1 mode on on Fa0/1 and Fa0/2.', 'Použij channel-group 1 mode on na Fa0/1 a Fa0/2.')],
    reqs: [swGroup('fa0/1', 1, 'on'), swGroup('fa0/2', 1, 'on')],
    cmds: chanCmds('on'),
  },
  intermediate: {
    sub: L('Bundle Fa0/1 and Fa0/2 into channel-group 1 with mode on, and bring both up', 'Spoj Fa0/1 a Fa0/2 do channel-group 1 v režimu on a oba zapni'),
    steps: [L('Use channel-group 1 mode on on Fa0/1 and Fa0/2.', 'Použij channel-group 1 mode on na Fa0/1 a Fa0/2.'), L('Bring both ports up.', 'Zapni oba porty.')],
    reqs: [swGroup('fa0/1', 1, 'on'), swGroup('fa0/2', 1, 'on'), swUp('fa0/1'), swUp('fa0/2')],
    cmds: chanCmds('on', 'no shutdown'),
  },
  advanced: {
    sub: L('Use LACP (mode active) for channel-group 1 on Fa0/1 and Fa0/2, and bring both up', 'Použij LACP (mode active) pro channel-group 1 na Fa0/1 a Fa0/2 a oba zapni'),
    steps: [L('Use channel-group 1 mode active on Fa0/1 and Fa0/2.', 'Použij channel-group 1 mode active na Fa0/1 a Fa0/2.'), L('Bring both ports up.', 'Zapni oba porty.')],
    reqs: [...LACP, swUp('fa0/1'), swUp('fa0/2')],
    cmds: chanCmds('active', 'no shutdown'),
  },
  expert: {
    sub: L('As Advanced, and make both channel ports trunks', 'Jako Pokročilý a navíc udělej z obou portů kanálu trunky'),
    steps: [L('Keep the LACP channel on Fa0/1 and Fa0/2.', 'Nech kanál LACP na Fa0/1 a Fa0/2.'), L('Make Fa0/1 and Fa0/2 trunks.', 'Udělej z Fa0/1 a Fa0/2 trunky.')],
    reqs: [...LACP, swUp('fa0/1'), swUp('fa0/2'), swTrunk('fa0/1'), swTrunk('fa0/2')],
    cmds: chanCmds('active', 'no shutdown', 'switchport mode trunk'),
  },
};

const ADVETHER = {
  beginner: {
    sub: L('Use LACP (mode active) for channel-group 1 on Fa0/1 and Fa0/2', 'Použij LACP (mode active) pro channel-group 1 na Fa0/1 a Fa0/2'),
    steps: [L('Use channel-group 1 mode active on Fa0/1 and Fa0/2.', 'Použij channel-group 1 mode active na Fa0/1 a Fa0/2.')],
    reqs: LACP,
    cmds: chanCmds('active'),
  },
  intermediate: {
    sub: L('As Beginner, and balance traffic by source and destination IP', 'Jako Začátečník a navíc rozkládej provoz podle zdrojové a cílové IP'),
    steps: [L('Keep the LACP channel on Fa0/1 and Fa0/2.', 'Nech kanál LACP na Fa0/1 a Fa0/2.'), L('Set load balancing to src-dst-ip.', 'Nastav rozkládání zátěže na src-dst-ip.')],
    reqs: [...LACP, swLb('src-dst-ip')],
    cmds: [LB_CMD, ...chanCmds('active')],
  },
  advanced: {
    sub: L('As Intermediate, with both channel ports up and trunked', 'Jako Mírně pokročilý, s oběma porty kanálu zapnutými a jako trunky'),
    steps: [L('Keep the LACP channel and load balancing.', 'Nech kanál LACP i rozkládání zátěže.'), L('Bring both ports up and make them trunks.', 'Zapni oba porty a udělej z nich trunky.')],
    reqs: [...LACP, swLb('src-dst-ip'), swUp('fa0/1'), swUp('fa0/2'), swTrunk('fa0/1'), swTrunk('fa0/2')],
    cmds: [LB_CMD, ...chanCmds('active', 'no shutdown', 'switchport mode trunk')],
  },
  expert: {
    sub: L('As Advanced, and allow only VLANs 10 and 20 on the channel', 'Jako Pokročilý a navíc povol na kanálu jen VLANy 10 a 20'),
    steps: [L('Keep the Advanced settings.', 'Nech nastavení z úrovně Pokročilý.'), L('Allow only VLANs 10 and 20 on Fa0/1 and Fa0/2.', 'Povol na Fa0/1 a Fa0/2 jen VLANy 10 a 20.')],
    reqs: [...LACP, swLb('src-dst-ip'), swUp('fa0/1'), swUp('fa0/2'), swTrunk('fa0/1'), swTrunk('fa0/2'),
      swAllowed('fa0/1', [10, 20]), swAllowed('fa0/2', [10, 20])],
    cmds: [LB_CMD, ...chanCmds('active', 'no shutdown', 'switchport mode trunk', 'switchport trunk allowed vlan 10,20')],
  },
};

const INTER_PCS = [pcStatic('PC1', '192.168.10.10', '192.168.10.1'), pcStatic('PC2', '192.168.20.10', '192.168.20.1'), pcPings('PC1', 'PC2')];
const INTER_ADV = [...TRUNK_UP, ...r1Sub(10), ...r1Sub(20), ...PCS_IN_10_20, ...INTER_PCS];
const r1SubCmds = vlan => onIf(`gi0/0.${vlan}`, `encapsulation dot1Q ${vlan}`, `ip address 192.168.${vlan}.1 ${MASK24}`, 'no shutdown');
const r1StickCmds = (...vlans) => onDev('R1', ...onIf('gi0/0', 'no shutdown'), ...vlans.flatMap(r1SubCmds));
const PC_STATIC_THEN = [['PC1', [`ip 192.168.10.10 ${MASK24} 192.168.10.1`]], ['PC2', [`ip 192.168.20.10 ${MASK24} 192.168.20.1`]]];
const INTERVLAN = {
  beginner: {
    sub: L('Trunk S1 Gi0/1 to R1 and give R1 a VLAN 10 subinterface', 'Udělej z S1 Gi0/1 trunk k R1 a dej R1 subrozhraní pro VLAN 10'),
    steps: [L('Make S1 Gi0/1 a trunk and bring it up.', 'Nastav S1 Gi0/1 jako trunk a zapni ho.'), L('On R1, create Gi0/0.10 with dot1Q 10 and 192.168.10.1/24.', 'Na R1 vytvoř Gi0/0.10 s dot1Q 10 a 192.168.10.1/24.'), L('Bring Gi0/0.10 up.', 'Zapni Gi0/0.10.')],
    reqs: [...TRUNK_UP, ...r1Sub(10)],
    cmds: TRUNK_CMDS,
    then: [r1StickCmds(10)],
  },
  intermediate: {
    sub: L('Add VLAN 20 on subinterface Gi0/0.20 with 192.168.20.1/24', 'Přidej VLAN 20 na subrozhraní Gi0/0.20 s 192.168.20.1/24'),
    steps: [L('Keep the trunk and Gi0/0.10 working.', 'Nech trunk a Gi0/0.10 fungovat.'), L('On R1, create Gi0/0.20 with dot1Q 20 and 192.168.20.1/24.', 'Na R1 vytvoř Gi0/0.20 s dot1Q 20 a 192.168.20.1/24.'), L('Bring Gi0/0.20 up.', 'Zapni Gi0/0.20.')],
    reqs: [...TRUNK_UP, ...r1Sub(10), ...r1Sub(20)],
    cmds: TRUNK_CMDS,
    then: [r1StickCmds(10, 20)],
  },
  advanced: {
    sub: L('As Intermediate, put the PCs in VLANs 10 and 20, and make PC1 reach PC2', 'Jako Mírně pokročilý a navíc dej PC do VLANů 10 a 20 a zajisti, aby PC1 dosáhlo na PC2'),
    steps: [L('Keep the subinterfaces working.', 'Nech subrozhraní fungovat.'), L('Put Fa0/1 in VLAN 10 and Fa0/2 in VLAN 20, and bring both ports up.', 'Dej Fa0/1 do VLAN 10 a Fa0/2 do VLAN 20 a zapni oba porty.'),
      L('On PC1, set 192.168.10.10/24 with gateway 192.168.10.1; on PC2, 192.168.20.10/24 with gateway 192.168.20.1.', 'Na PC1 nastav 192.168.10.10/24 s bránou 192.168.10.1; na PC2 192.168.20.10/24 s bránou 192.168.20.1.'), L('From PC1, ping PC2.', 'Z PC1 pingni PC2.')],
    reqs: INTER_ADV,
    cmds: [...TRUNK_CMDS, ...PCS_10_20_CMDS],
    then: [r1StickCmds(10, 20), ...PC_STATIC_THEN],
  },
  expert: {
    sub: L('As Advanced, and add Gi0/0.99 on 192.168.99.1/24 with VLANs 10, 20 and 99 allowed on the trunk', 'Jako Pokročilý a navíc přidej Gi0/0.99 s 192.168.99.1/24 a na trunku povol VLANy 10, 20 a 99'),
    steps: [L('Create VLAN 99 on S1.', 'Vytvoř na S1 VLAN 99.'), L('On R1, create Gi0/0.99 with dot1Q 99 and 192.168.99.1/24.', 'Na R1 vytvoř Gi0/0.99 s dot1Q 99 a 192.168.99.1/24.'), L('Allow only VLANs 10, 20 and 99 on the trunk.', 'Povol na trunku jen VLANy 10, 20 a 99.')],
    reqs: [...INTER_ADV, ...r1Sub(99), swVlan(99), swAllowed('gi0/1', [10, 20, 99])],
    cmds: [...TRUNK_CMDS, ...PCS_10_20_CMDS, 'vlan 99', 'exit', ...onIf('gi0/1', 'switchport trunk allowed vlan 10,20,99')],
    then: [r1StickCmds(10, 20, 99), ...PC_STATIC_THEN],
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
const MLS_LEAD = L('MLS1 is a multilayer switch. PC1 is on Fa0/1, PC2 on Fa0/2, and the DHCP server DHCP1 (192.168.99.10) on Gi0/1.', 'MLS1 je multilayer switch. PC1 je na Fa0/1, PC2 na Fa0/2 a DHCP server DHCP1 (192.168.99.10) na Gi0/1.');
const DHCP1_IP = '192.168.99.10';
const mlsPool = vlan => ({name: `VLAN${vlan}`, net: `192.168.${vlan}.0`, mask: MASK24, gw: `192.168.${vlan}.1`,
  ex: [[`192.168.${vlan}.1`, `192.168.${vlan}.10`]]});
// DHCP1 answers when MLS1 routes and its routed port Gi0/1 is up on DHCP1's subnet
const MLS_SERVER = () => ({name: 'DHCP1', ip: DHCP1_IP, pools: [mlsPool(10), mlsPool(20)],
  reach: s => SW(s).routing && SW(s).ports['gi0/1'].routed && !!usable(SW(s).ports['gi0/1']) && inNet(SW(s).ports['gi0/1'].ip, SW(s).ports['gi0/1'].mask, DHCP1_IP)});

const IP_ROUTING = {text: L('MLS1 routes between VLANs', 'MLS1 routuje mezi VLANy'), ok: s => SW(s).routing, hint: {cmds: ['ip routing']}};
// an SVI requirement: like swReq, but the SVI exists only once interface vlan <n> was typed
const sviReq = (vlan, text, ok, ...cmds) => ({text: `Vlan${vlan} ${text}`, ok: s => !!SW(s).ports[`vlan${vlan}`] && ok(SW(s).ports[`vlan${vlan}`]),
  hint: {cmds, port: `Vlan${vlan}`}});
const svi = vlan => {
  const ip = `192.168.${vlan}.1`;
  return [
    sviReq(vlan, L(`has the address ${ip} ${MASK24}`, `má adresu ${ip} ${MASK24}`), q => q.ip === ip && q.mask === MASK24, `ip address ${ip} ${MASK24}`),
    sviReq(vlan, L('is up', 'je zapnuté'), q => !q.shut, 'no shutdown'),
  ];
};
const sviHelper = vlan => sviReq(vlan, L(`relays DHCP to ${DHCP1_IP}`, `předává DHCP na ${DHCP1_IP}`), q => q.helpers.includes(DHCP1_IP), `ip helper-address ${DHCP1_IP}`);
const ROUTED_UPLINK = [
  swReq('gi0/1', L('is a routed port', 'je routovaný port'), q => q.routed, 'no switchport'),
  swReq('gi0/1', L(`has the address 192.168.99.1 ${MASK24}`, `má adresu 192.168.99.1 ${MASK24}`), q => q.ip === '192.168.99.1' && q.mask === MASK24, `ip address 192.168.99.1 ${MASK24}`),
  swUp('gi0/1'),
];
const MLS_VLAN10 = [IP_ROUTING, swVlan(10), ...svi(10), swAccess('fa0/1', 10), swUp('fa0/1')];
const MLS_BOTH = [...MLS_VLAN10, swVlan(20), ...svi(20), swAccess('fa0/2', 20), swUp('fa0/2')];
const sviCmds = vlan => [`vlan ${vlan}`, 'exit', ...onIf(`vlan ${vlan}`, `ip address 192.168.${vlan}.1 ${MASK24}`, 'no shutdown'), ...accessCmds(`fa0/${vlan / 10}`, vlan)];
const MLS_BOTH_CMDS = ['ip routing', ...sviCmds(10), ...sviCmds(20)];
const MLSVLAN = {
  beginner: {
    sub: L('Turn on routing on MLS1 and give VLAN 10 a gateway on an SVI', 'Zapni routing na MLS1 a dej VLAN 10 bránu na SVI'),
    steps: [L('Turn on ip routing.', 'Zapni ip routing.'), L('Create VLAN 10, then interface vlan 10 with 192.168.10.1/24, and bring it up.', 'Vytvoř VLAN 10, pak interface vlan 10 s 192.168.10.1/24, a zapni ho.'),
      L('Make Fa0/1 an access port in VLAN 10 and bring it up.', 'Nastav Fa0/1 jako access port ve VLAN 10 a zapni ho.')],
    reqs: MLS_VLAN10,
    cmds: ['ip routing', ...sviCmds(10)],
  },
  intermediate: {
    sub: L('Route between VLANs 10 and 20 on MLS1, and make PC1 reach PC2', 'Routuj mezi VLANy 10 a 20 na MLS1 a zajisti, aby PC1 dosáhlo na PC2'),
    steps: [L('Keep VLAN 10 working.', 'Nech VLAN 10 fungovat.'), L('Create VLAN 20 with SVI 192.168.20.1/24, and put Fa0/2 in VLAN 20.', 'Vytvoř VLAN 20 se SVI 192.168.20.1/24 a dej Fa0/2 do VLAN 20.'),
      L('On PC1, set 192.168.10.10/24 with gateway 192.168.10.1; on PC2, 192.168.20.10/24 with gateway 192.168.20.1.', 'Na PC1 nastav 192.168.10.10/24 s bránou 192.168.10.1; na PC2 192.168.20.10/24 s bránou 192.168.20.1.'), L('From PC1, ping PC2.', 'Z PC1 pingni PC2.')],
    reqs: [...MLS_BOTH, pcStatic('PC1', '192.168.10.10', '192.168.10.1'), pcStatic('PC2', '192.168.20.10', '192.168.20.1'), pcPings('PC1', 'PC2')],
    cmds: MLS_BOTH_CMDS,
    then: PC_STATIC_THEN,
  },
  advanced: {
    sub: L('Make Gi0/1 a routed port to DHCP1 and relay DHCP for VLAN 10', 'Udělej z Gi0/1 routovaný port k DHCP1 a předávej DHCP pro VLAN 10'),
    steps: [L('Keep both VLANs and their SVIs.', 'Nech oba VLANy a jejich SVI.'), L('Make Gi0/1 a routed port (no switchport) with 192.168.99.1/24, and bring it up.', 'Udělej z Gi0/1 routovaný port (no switchport) s 192.168.99.1/24 a zapni ho.'),
      L('On interface vlan 10, add ip helper-address 192.168.99.10.', 'Na interface vlan 10 přidej ip helper-address 192.168.99.10.'), L('Open PC1 and type dhcp.', 'Otevři PC1 a napiš dhcp.')],
    reqs: [...MLS_BOTH, ...ROUTED_UPLINK, sviHelper(10), pcLease('PC1', '192.168.10')],
    cmds: [...MLS_BOTH_CMDS, ...onIf('gi0/1', 'no switchport', `ip address 192.168.99.1 ${MASK24}`, 'no shutdown'), ...onIf('vlan 10', `ip helper-address ${DHCP1_IP}`)],
    then: [['PC1', ['dhcp']]],
  },
  expert: {
    sub: L('As Advanced, relay DHCP for VLAN 20 too, and make PC1 reach PC2 with their DHCP addresses', 'Jako Pokročilý a navíc předávej DHCP i pro VLAN 20 a zajisti, aby PC1 dosáhlo na PC2 s adresami z DHCP'),
    steps: [L('Keep the Advanced settings.', 'Nech nastavení z úrovně Pokročilý.'), L('On interface vlan 20, add ip helper-address 192.168.99.10.', 'Na interface vlan 20 přidej ip helper-address 192.168.99.10.'), L('Type dhcp on PC1 and PC2.', 'Napiš dhcp na PC1 a PC2.'), L('From PC1, ping PC2.', 'Z PC1 pingni PC2.')],
    reqs: [...MLS_BOTH, ...ROUTED_UPLINK, sviHelper(10), sviHelper(20), pcLease('PC1', '192.168.10'), pcLease('PC2', '192.168.20'), pcPings('PC1', 'PC2')],
    cmds: ['ip routing', 'vlan 10', 'exit', 'vlan 20', 'exit', 'int vlan 10', 'ip add 192.168.10.1 255.255.255.0',
      'ip helper-address 192.168.99.10', 'int vlan 20', 'ip add 192.168.20.1 255.255.255.0', 'ip helper-address 192.168.99.10',
      'int gi0/1', 'no switchport', 'ip add 192.168.99.1 255.255.255.0', 'no sh', 'int fa0/1', 'sw mode access', 'sw access vlan 10', 'no sh',
      'int fa0/2', 'sw mode access', 'sw access vlan 20', 'no sh'],
    then: [['PC1', ['dhcp']], ['PC2', ['dhcp']], ['PC1', ['ping 192.168.20.11']]],
  },
};

// ---- 5.0 security: port security ----
const swPsec = p => swReq(p, L('has port security on', 'má zapnutý port security'), q => q.psec === true, 'switchport port-security');
const swPsMax = (p, n) => swReq(p, L(`allows ${n} MAC address${n > 1 ? 'es' : ''}`, `povoluje ${n} ${cz(n, 'MAC adresu', 'MAC adresy', 'MAC adres')}`), q => q.psMax === n, `switchport port-security maximum ${n}`);
const swPsViol = (p, v) => swReq(p, L(`violation mode is ${v}`, `má režim porušení ${v}`), q => q.psViolation === v, `switchport port-security violation ${v}`);
const swPsSticky = p => swReq(p, L('learns sticky MAC addresses', 'se učí sticky MAC adresy'), q => q.psSticky === true, 'switchport port-security mac-address sticky');
const PS_ADV = [swMode('fa0/1'), swMode('fa0/2'), swUp('fa0/1'), swUp('fa0/2'), swPsec('fa0/1'), swPsec('fa0/2'), swPsSticky('fa0/1'), swPsSticky('fa0/2'),
  swPsMax('fa0/1', 1), swPsMax('fa0/2', 1), swPsViol('fa0/1', 'shutdown'), swPsViol('fa0/2', 'restrict')];
// sticky port security with one address and the given violation mode, on an access port that is up
const stickyCmds = (p, viol) => onIf(p, 'switchport mode access', 'no shutdown', 'switchport port-security', 'switchport port-security mac-address sticky',
  'switchport port-security maximum 1', `switchport port-security violation ${viol}`);
const PS_ADV_CMDS = [...stickyCmds('fa0/1', 'shutdown'), ...stickyCmds('fa0/2', 'restrict')];
const PORTSEC = {
  beginner: {
    sub: L('Turn on port security on Fa0/1', 'Zapni port security na Fa0/1'),
    steps: [L('Make Fa0/1 an access port and bring it up.', 'Nastav Fa0/1 jako access port a zapni ho.'), L('Enable port security on Fa0/1.', 'Zapni port security na Fa0/1.')],
    reqs: [swMode('fa0/1'), swUp('fa0/1'), swPsec('fa0/1')],
    cmds: onIf('fa0/1', 'switchport mode access', 'no shutdown', 'switchport port-security'),
  },
  intermediate: {
    sub: L('Allow one MAC address on Fa0/1 and shut the port on a violation', 'Povol na Fa0/1 jednu MAC adresu a při porušení port vypni'),
    steps: [L('Keep port security on Fa0/1.', 'Nech port security na Fa0/1.'), L('Set the maximum to 1 and the violation mode to shutdown.', 'Nastav maximum na 1 a režim porušení na shutdown.')],
    reqs: [swMode('fa0/1'), swUp('fa0/1'), swPsec('fa0/1'), swPsMax('fa0/1', 1), swPsViol('fa0/1', 'shutdown')],
    cmds: onIf('fa0/1', 'switchport mode access', 'no shutdown', 'switchport port-security', 'switchport port-security maximum 1',
      'switchport port-security violation shutdown'),
  },
  advanced: {
    sub: L('Use sticky MAC addresses on Fa0/1 and Fa0/2, and restrict Fa0/2 on a violation', 'Použij sticky MAC adresy na Fa0/1 a Fa0/2 a při porušení na Fa0/2 použij restrict'),
    steps: [L('Turn on sticky port security on Fa0/1 and Fa0/2.', 'Zapni sticky port security na Fa0/1 a Fa0/2.'), L('Allow one MAC per port.', 'Povol jednu MAC na port.'), L('Shut Fa0/1 on a violation and restrict Fa0/2.', 'Při porušení Fa0/1 vypni a na Fa0/2 použij restrict.')],
    reqs: PS_ADV,
    cmds: PS_ADV_CMDS,
  },
  expert: {
    sub: L('As Advanced, and protect the unused Fa0/3 with sticky MAC, one address and shutdown', 'Jako Pokročilý a navíc chraň nepoužívaný Fa0/3 pomocí sticky MAC, jedné adresy a shutdown'),
    steps: [L('Keep the Advanced settings on Fa0/1 and Fa0/2.', 'Nech nastavení z úrovně Pokročilý na Fa0/1 a Fa0/2.'), L('Protect Fa0/3 with sticky MAC, a maximum of 1 and shutdown on violation.', 'Chraň Fa0/3 pomocí sticky MAC, maxima 1 a shutdown při porušení.')],
    reqs: [...PS_ADV, swPsec('fa0/3'), swPsSticky('fa0/3'), swPsMax('fa0/3', 1), swPsViol('fa0/3', 'shutdown')],
    cmds: [...PS_ADV_CMDS, ...stickyCmds('fa0/3', 'shutdown')],
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
const rtUp = k => rtReq(k, L('is up', 'je zapnuté'), i => !i.shut, 'no shutdown');
// an R1 interface with its address, and up
const rtIf = (k, ip, mask) => [rtReq(k, L(`is ${ip} ${mask}`, `je ${ip} ${mask}`), i => i.ip === ip && i.mask === mask, `ip address ${ip} ${mask}`), rtUp(k)];
const LAN_IF = x => rtIf('gi0/0', `192.168.${x}.1`, '255.255.255.0'); // towards PC1
const WAN_IF = rtIf('gi0/1', '10.0.0.1', '255.255.255.252'); // towards R2
const R3_IF = rtIf('gi0/2', '10.0.1.1', '255.255.255.252'); // towards R3
const BOTH_IFS = x => [...LAN_IF(x), ...WAN_IF];
// the same interfaces as solution commands; every piece of a solution ends back in global configuration
const LAN_CMDS = x => onIf('gi0/0', `ip address 192.168.${x}.1 255.255.255.0`, 'no shutdown');
const WAN_CMDS = onIf('gi0/1', 'ip address 10.0.0.1 255.255.255.252', 'no shutdown');
const R3_CMDS = onIf('gi0/2', 'ip address 10.0.1.1 255.255.255.252', 'no shutdown');
const BOTH_CMDS = x => [...LAN_CMDS(x), ...WAN_CMDS];
const DEFAULT_CMD = 'ip route 0.0.0.0 0.0.0.0 10.0.0.2';
const PC1_DHCP = [['PC1', ['dhcp']]];
const rtRoute = (net, mask, nh, dist = 1) => ({
  text: L(`R1 has a route to ${net} ${mask} via ${nh}${dist !== 1 ? ` with distance ${dist}` : ''}`, `R1 má routu do ${net} ${mask} přes ${nh}${dist !== 1 ? ` se vzdáleností ${dist}` : ''}`),
  ok: s => R1(s).routes.some(r => r.net === net && r.mask === mask && r.nh === nh && r.dist === dist),
  hint: {cmds: [`ip route ${net} ${mask} ${nh}${dist !== 1 ? ' ' + dist : ''}`]},
});
const DEFAULT_VIA_R2 = rtRoute('0.0.0.0', '0.0.0.0', '10.0.0.2');
const aclEntries = (name, type, expected) => ({
  text: L(`ACL ${name} has the entries: ${expected.join('; ')}`, `ACL ${name} má položky: ${expected.join('; ')}`),
  ok: s => !!R1(s).acls[name] && R1(s).acls[name].type === type && R1(s).acls[name].entries.join(' | ') === expected.join(' | '),
  hint: {cmds: [`ip access-list ${type} ${name}`, ...expected]},
});
const aclApplied = (k, dir, name) => rtReq(k, L(`applies ACL ${name} ${dir === 'in' ? 'inbound' : 'outbound'}`, `má ACL ${name} ${dir === 'in' ? 'příchozí' : 'odchozí'}`),
  i => (dir === 'in' ? i.aclIn : i.aclOut) === name, `ip access-group ${name} ${dir}`);

const STATIC = {
  beginner: {
    sub: L('Route the remote LAN 172.16.x.0/24 through R2 at 10.0.0.2', 'Směruj vzdálenou LAN 172.16.x.0/24 přes R2 na 10.0.0.2'),
    lead: serves(L('R2 is the next hop on Gi0/1.', 'R2 je další skok na Gi0/1.')),
    steps: [L('Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Adresuj Gi0/0 a Gi0/1 na R1 a zapni je.'), L('Add a static route for 172.16.x.0/24 via 10.0.0.2.', 'Přidej statickou routu pro 172.16.x.0/24 přes 10.0.0.2.')],
    reqs: x => [...BOTH_IFS(x), rtRoute(`172.16.${x}.0`, '255.255.255.0', '10.0.0.2')],
    cmds: x => [...BOTH_CMDS(x), `ip route 172.16.${x}.0 255.255.255.0 10.0.0.2`],
  },
  intermediate: {
    sub: L('Add a second remote LAN, 172.17.x.0/24, also through R2', 'Přidej druhou vzdálenou LAN, 172.17.x.0/24, také přes R2'),
    lead: serves(L('R2 is the next hop on Gi0/1.', 'R2 je další skok na Gi0/1.')),
    steps: [L('Keep the first static route working.', 'Nech první statickou routu fungovat.'), L('Add a static route for 172.17.x.0/24 via 10.0.0.2.', 'Přidej statickou routu pro 172.17.x.0/24 přes 10.0.0.2.')],
    reqs: x => [...STATIC.beginner.reqs(x), rtRoute(`172.17.${x}.0`, '255.255.255.0', '10.0.0.2')],
    cmds: x => [...STATIC.beginner.cmds(x), `ip route 172.17.${x}.0 255.255.255.0 10.0.0.2`],
  },
  advanced: {
    sub: L('Add R3 on Gi0/2 as a backup for 172.16.x.0/24, using distance 150', 'Přidej R3 na Gi0/2 jako zálohu pro 172.16.x.0/24 se vzdáleností 150'),
    lead: serves(L('R2 is on Gi0/1 and R3 on Gi0/2.', 'R2 je na Gi0/1 a R3 na Gi0/2.')),
    steps: [L('Keep the routes to R2 working.', 'Nech routy přes R2 fungovat.'), L('Address Gi0/2 as 10.0.1.1/30 and bring it up.', 'Adresuj Gi0/2 jako 10.0.1.1/30 a zapni ho.'), L('Add a backup route for 172.16.x.0/24 via 10.0.1.2 with distance 150.', 'Přidej záložní routu pro 172.16.x.0/24 přes 10.0.1.2 se vzdáleností 150.')],
    reqs: x => [...STATIC.intermediate.reqs(x), ...R3_IF, rtRoute(`172.16.${x}.0`, '255.255.255.0', '10.0.1.2', 150)],
    cmds: x => [...STATIC.intermediate.cmds(x), ...R3_CMDS, `ip route 172.16.${x}.0 255.255.255.0 10.0.1.2 150`],
  },
  expert: {
    sub: L('As Advanced, and add 172.18.x.0/24 as a route out the exit interface Gi0/2', 'Jako Pokročilý a navíc přidej 172.18.x.0/24 jako routu přes výstupní rozhraní Gi0/2'),
    lead: serves(L('R2 is on Gi0/1 and R3 on Gi0/2.', 'R2 je na Gi0/1 a R3 na Gi0/2.')),
    steps: [L('Keep the Advanced routes.', 'Nech routy z úrovně Pokročilý.'), L('Add a static route for 172.18.x.0/24 that uses Gi0/2 as the exit interface.', 'Přidej statickou routu pro 172.18.x.0/24, která používá Gi0/2 jako výstupní rozhraní.')],
    reqs: x => [...STATIC.advanced.reqs(x), rtRoute(`172.18.${x}.0`, '255.255.255.0', 'Gi0/2')],
    cmds: x => [...STATIC.advanced.cmds(x), `ip route 172.18.${x}.0 255.255.255.0 gi0/2`],
  },
};

const DEFROUTE = {
  beginner: {
    sub: L('Send unknown traffic to R2 at 10.0.0.2 with a default route', 'Posílej neznámý provoz výchozí routou na R2 na 10.0.0.2'),
    lead: serves(L('R2 at 10.0.0.2 is the way out.', 'Cesta ven vede přes R2 na 10.0.0.2.')),
    steps: [L('Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Adresuj Gi0/0 a Gi0/1 na R1 a zapni je.'), L('Add a default route via 10.0.0.2.', 'Přidej výchozí routu přes 10.0.0.2.')],
    reqs: x => [...BOTH_IFS(x), DEFAULT_VIA_R2],
    cmds: x => [...BOTH_CMDS(x), DEFAULT_CMD],
  },
  intermediate: {
    sub: L('Add R3 at 10.0.1.2 as a backup default route with distance 150', 'Přidej R3 na 10.0.1.2 jako záložní výchozí routu se vzdáleností 150'),
    lead: serves(L('R2 is on Gi0/1 and R3 on Gi0/2.', 'R2 je na Gi0/1 a R3 na Gi0/2.')),
    steps: [L('Keep the default route via R2.', 'Nech výchozí routu přes R2.'), L('Address Gi0/2 as 10.0.1.1/30 and bring it up.', 'Adresuj Gi0/2 jako 10.0.1.1/30 a zapni ho.'), L('Add a backup default route via 10.0.1.2 with distance 150.', 'Přidej záložní výchozí routu přes 10.0.1.2 se vzdáleností 150.')],
    reqs: x => [...BOTH_IFS(x), DEFAULT_VIA_R2, ...R3_IF, rtRoute('0.0.0.0', '0.0.0.0', '10.0.1.2', 150)],
    cmds: x => [...DEFROUTE.beginner.cmds(x), ...R3_CMDS, 'ip route 0.0.0.0 0.0.0.0 10.0.1.2 150'],
  },
  advanced: {
    sub: L('Make Gi0/1 the exit interface for the default route', 'Udělej z Gi0/1 výstupní rozhraní výchozí routy'),
    lead: serves(L('R2 is on Gi0/1.', 'R2 je na Gi0/1.')),
    steps: [L('Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Adresuj Gi0/0 a Gi0/1 na R1 a zapni je.'), L('Add a default route that uses Gi0/1 as the exit interface.', 'Přidej výchozí routu, která používá Gi0/1 jako výstupní rozhraní.')],
    reqs: x => [...BOTH_IFS(x), rtRoute('0.0.0.0', '0.0.0.0', 'Gi0/1')],
    cmds: x => [...BOTH_CMDS(x), 'ip route 0.0.0.0 0.0.0.0 gi0/1'],
  },
  expert: {
    sub: L('Default route via R2, plus a specific route to 172.16.x.0/24 via R2', 'Výchozí routa přes R2 a k tomu konkrétní routa do 172.16.x.0/24 přes R2'),
    lead: serves(L('R2 is on Gi0/1.', 'R2 je na Gi0/1.')),
    steps: [L('Add a default route via 10.0.0.2.', 'Přidej výchozí routu přes 10.0.0.2.'), L('Add a specific route for 172.16.x.0/24 via 10.0.0.2 so it is not sent to the default.', 'Přidej konkrétní routu pro 172.16.x.0/24 přes 10.0.0.2, aby se neposílala výchozí routou.')],
    reqs: x => [...BOTH_IFS(x), DEFAULT_VIA_R2, rtRoute(`172.16.${x}.0`, '255.255.255.0', '10.0.0.2')],
    cmds: x => [...DEFROUTE.beginner.cmds(x), `ip route 172.16.${x}.0 255.255.255.0 10.0.0.2`],
  },
};

// OSPFv2 and OSPFv3 on R1, process 1
const ospfIn = (k, area, network) => ({text: L(`${portName(k)} runs OSPF in area ${area}`, `${portName(k)} běží v OSPF v oblasti ${area}`), ok: s => ospfArea(R1(s), k) === area,
  hint: {cmds: ['router ospf 1', network]}});
const ospfIfCmd = (k, area) => rtReq(k, L(`is put in area ${area} with the interface command`, `je v oblasti ${area} přes příkaz na rozhraní`), i => i.ospf?.pid === 1 && i.ospf.area === area,
  `ip ospf 1 area ${area}`);
const ospf6In = (k, area) => rtReq(k, L(`runs OSPFv3 in area ${area}`, `běží v OSPFv3 v oblasti ${area}`), i => i.ospf6?.pid === 1 && i.ospf6.area === area, `ipv6 ospf 1 area ${area}`);
// routing processes on R1 by their key in its state (devices/router.js)
const IGP_NAME = {ospf: 'OSPF', ospf6: 'OSPFv3', rip: 'RIP', eigrp: 'EIGRP'};
const IGP_START = {ospf: 'router ospf 1', ospf6: 'ipv6 router ospf 1', rip: 'router rip', eigrp: 'router eigrp 100'};
// R1 interface k is passive in process p (or, with on false, is not)
const igpPassive = (p, k, on = true) => ({
  text: L(`${portName(k)} is ${on ? '' : 'not '}passive in ${IGP_NAME[p]}`, `${portName(k)} ${on ? 'je' : 'není'} pasivní v ${IGP_NAME[p]}`),
  ok: s => R1(s)[p].passive.includes(portName(k)) === on,
  hint: {cmds: on ? [`passive-interface ${portName(k)}`] : [IGP_START[p], `no passive-interface ${portName(k)}`]},
});
const ospfRid = (v6, rid) => ({
  text: L(`The ${v6 ? 'OSPFv3' : 'OSPF'} router ID is ${rid}`, `Router ID pro ${v6 ? 'OSPFv3' : 'OSPF'} je ${rid}`),
  ok: s => R1(s)[v6 ? 'ospf6' : 'ospf'].rid === rid,
  hint: {cmds: [v6 ? 'ipv6 router ospf 1' : 'router ospf 1', `router-id ${rid}`]},
});
const OSPF_ORIGINATE = {text: L('OSPF advertises the default route', 'OSPF ohlašuje výchozí routu'), ok: s => R1(s).ospf.originate, hint: {cmds: ['router ospf 1', 'default-information originate']}};
const v6If = (k, ip) => [rtReq(k, L(`is ${ip}`, `je ${ip}`), i => i.ip6 === ip, `ipv6 address ${ip}`), rtUp(k)];
const linkLocal = k => rtReq(k, L('has the link-local address fe80::1', 'má link-local adresu fe80::1'), i => i.ll === 'fe80::1', 'ipv6 address fe80::1 link-local');
const V6_ROUTING = {text: L('IPv6 routing is on', 'IPv6 routing je zapnutý'), ok: s => R1(s).v6routing, hint: {cmds: ['ipv6 unicast-routing']}};

const OSPF_LEAD = serves(L('R2 is an OSPF neighbour on Gi0/1.', 'R2 je soused OSPF na Gi0/1.'));
const OSPF_BASE = x => [...BOTH_IFS(x), ospfIn('gi0/0', 0, `network 192.168.${x}.0 0.0.0.255 area 0`), ospfIn('gi0/1', 0, 'network 10.0.0.0 0.0.0.3 area 0')];
const OSPF = {
  beginner: {
    sub: L('Run OSPF process 1 in area 0 on the LAN and the link to R2', 'Spusť proces OSPF 1 v oblasti 0 na LAN a na lince k R2'),
    lead: OSPF_LEAD,
    steps: [L('Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Adresuj Gi0/0 a Gi0/1 na R1 a zapni je.'), L('Start router ospf 1.', 'Spusť router ospf 1.'),
      L('Add network statements for 192.168.x.0/24 and 10.0.0.0/30, both in area 0.', 'Přidej příkazy network pro 192.168.x.0/24 a 10.0.0.0/30, oba v oblasti 0.')],
    reqs: OSPF_BASE,
    cmds: x => [...BOTH_CMDS(x), 'router ospf 1', `network 192.168.${x}.0 0.0.0.255 area 0`, 'network 10.0.0.0 0.0.0.3 area 0', 'exit'],
  },
  intermediate: {
    sub: L('As Beginner, with router ID 1.1.1.1 and no OSPF hellos sent to the LAN', 'Jako Začátečník, s router ID 1.1.1.1 a bez hello OSPF do LAN'),
    lead: OSPF_LEAD,
    steps: [L('Keep OSPF running on both networks.', 'Nech OSPF běžet v obou sítích.'), L('Set the router ID to 1.1.1.1.', 'Nastav router ID na 1.1.1.1.'), L('Make Gi0/0 a passive interface.', 'Nastav Gi0/0 jako pasivní rozhraní.')],
    reqs: x => [...OSPF_BASE(x), ospfRid(false, '1.1.1.1'), igpPassive('ospf', 'gi0/0')],
    cmds: x => [...OSPF.beginner.cmds(x), 'router ospf 1', 'router-id 1.1.1.1', 'passive-interface gi0/0', 'exit'],
  },
  advanced: {
    sub: L('As Intermediate, and bring R3 on Gi0/2 into area 0 with the interface command', 'Jako Mírně pokročilý a navíc připoj R3 na Gi0/2 do oblasti 0 příkazem na rozhraní'),
    lead: serves(L('R2 is on Gi0/1 and R3 on Gi0/2.', 'R2 je na Gi0/1 a R3 na Gi0/2.')),
    steps: [L('Keep the Intermediate settings.', 'Nech nastavení z úrovně Mírně pokročilý.'), L('Address Gi0/2 as 10.0.1.1/30 and bring it up.', 'Adresuj Gi0/2 jako 10.0.1.1/30 a zapni ho.'), L('On Gi0/2, use ip ospf 1 area 0 instead of a network statement.', 'Na Gi0/2 použij ip ospf 1 area 0 místo příkazu network.')],
    reqs: x => [...OSPF.intermediate.reqs(x), ...R3_IF, ospfIfCmd('gi0/2', 0)],
    cmds: x => [...OSPF.intermediate.cmds(x), ...onIf('gi0/2', 'ip address 10.0.1.1 255.255.255.252', 'no shutdown', 'ip ospf 1 area 0')],
  },
  expert: {
    sub: L('As Advanced, and advertise a default route via R2 into OSPF', 'Jako Pokročilý a navíc ohlas do OSPF výchozí routu přes R2'),
    lead: serves(L('R2 is the way out on Gi0/1; R3 is on Gi0/2.', 'Cesta ven vede přes R2 na Gi0/1; R3 je na Gi0/2.')),
    steps: [L('Keep the Advanced settings.', 'Nech nastavení z úrovně Pokročilý.'), L('Add a static default route via 10.0.0.2.', 'Přidej statickou výchozí routu přes 10.0.0.2.'), L('Under router ospf 1, add default-information originate.', 'Pod router ospf 1 přidej default-information originate.')],
    reqs: x => [...OSPF.advanced.reqs(x), DEFAULT_VIA_R2, OSPF_ORIGINATE],
    cmds: x => [...OSPF.advanced.cmds(x), DEFAULT_CMD, 'router ospf 1', 'default-information originate', 'exit'],
  },
};

const OSPF6_LEAD = x => L(`Your prefix is 2001:db8:${x}::/48. R2 is an OSPFv3 neighbour on Gi0/1.`, `Tvůj prefix je 2001:db8:${x}::/48. R2 je soused OSPFv3 na Gi0/1.`);
const OSPF6_BASE = x => [V6_ROUTING, ...v6If('gi0/0', `2001:db8:${x}:1::1/64`), ...v6If('gi0/1', `2001:db8:${x}:12::1/64`),
  ospfRid(true, '1.1.1.1'), ospf6In('gi0/0', 0), ospf6In('gi0/1', 0)];
const OSPF6 = {
  beginner: {
    sub: L('Run OSPFv3 process 1 in area 0 on the LAN and the link to R2', 'Spusť proces OSPFv3 1 v oblasti 0 na LAN a na lince k R2'),
    lead: OSPF6_LEAD,
    steps: [L('Turn on ipv6 unicast-routing.', 'Zapni ipv6 unicast-routing.'), L('Address Gi0/0 as 2001:db8:x:1::1/64 and Gi0/1 as 2001:db8:x:12::1/64, and bring them up.', 'Adresuj Gi0/0 jako 2001:db8:x:1::1/64 a Gi0/1 jako 2001:db8:x:12::1/64 a zapni je.'),
      L('Start ipv6 router ospf 1 with router ID 1.1.1.1 (R1 has no IPv4 address to borrow one from).', 'Spusť ipv6 router ospf 1 s router ID 1.1.1.1 (R1 nemá IPv4 adresu, ze které by si ho vzal).'), L('On both interfaces, add ipv6 ospf 1 area 0.', 'Na obou rozhraních přidej ipv6 ospf 1 area 0.')],
    reqs: OSPF6_BASE,
    cmds: x => ['ipv6 unicast-routing', 'ipv6 router ospf 1', 'router-id 1.1.1.1', 'exit',
      ...onIf('gi0/0', `ipv6 address 2001:db8:${x}:1::1/64`, 'no shutdown', 'ipv6 ospf 1 area 0'),
      ...onIf('gi0/1', `ipv6 address 2001:db8:${x}:12::1/64`, 'no shutdown', 'ipv6 ospf 1 area 0')],
  },
  intermediate: {
    sub: L('As Beginner, and stop OSPFv3 hellos on the LAN', 'Jako Začátečník a navíc zastav hello OSPFv3 do LAN'),
    lead: OSPF6_LEAD,
    steps: [L('Keep OSPFv3 running on both interfaces.', 'Nech OSPFv3 běžet na obou rozhraních.'), L('Under ipv6 router ospf 1, make Gi0/0 passive.', 'Pod ipv6 router ospf 1 nastav Gi0/0 jako pasivní.')],
    reqs: x => [...OSPF6_BASE(x), igpPassive('ospf6', 'gi0/0')],
    cmds: x => [...OSPF6.beginner.cmds(x), 'ipv6 router ospf 1', 'passive-interface gi0/0', 'exit'],
  },
  advanced: {
    sub: L('As Intermediate, and put the link to R3 on Gi0/2 in area 1', 'Jako Mírně pokročilý a navíc dej linku k R3 na Gi0/2 do oblasti 1'),
    lead: x => L(`Your prefix is 2001:db8:${x}::/48. R2 is on Gi0/1 (area 0) and R3 on Gi0/2 (area 1).`, `Tvůj prefix je 2001:db8:${x}::/48. R2 je na Gi0/1 (oblast 0) a R3 na Gi0/2 (oblast 1).`),
    steps: [L('Keep the Intermediate settings.', 'Nech nastavení z úrovně Mírně pokročilý.'), L('Address Gi0/2 as 2001:db8:x:13::1/64 and bring it up.', 'Adresuj Gi0/2 jako 2001:db8:x:13::1/64 a zapni ho.'), L('Add ipv6 ospf 1 area 1 on Gi0/2.', 'Přidej ipv6 ospf 1 area 1 na Gi0/2.')],
    reqs: x => [...OSPF6.intermediate.reqs(x), ...v6If('gi0/2', `2001:db8:${x}:13::1/64`), ospf6In('gi0/2', 1)],
    cmds: x => [...OSPF6.intermediate.cmds(x), ...onIf('gi0/2', `ipv6 address 2001:db8:${x}:13::1/64`, 'no shutdown', 'ipv6 ospf 1 area 1')],
  },
  expert: {
    sub: L('As Advanced, with the link-local address fe80::1 on every interface', 'Jako Pokročilý, s link-local adresou fe80::1 na každém rozhraní'),
    lead: x => L(`Your prefix is 2001:db8:${x}::/48. R2 is on Gi0/1 (area 0) and R3 on Gi0/2 (area 1).`, `Tvůj prefix je 2001:db8:${x}::/48. R2 je na Gi0/1 (oblast 0) a R3 na Gi0/2 (oblast 1).`),
    steps: [L('Keep the Advanced settings.', 'Nech nastavení z úrovně Pokročilý.'), L('Give Gi0/0, Gi0/1 and Gi0/2 the link-local address fe80::1, so OSPFv3 neighbours see a simple next hop.', 'Dej Gi0/0, Gi0/1 a Gi0/2 link-local adresu fe80::1, aby sousedé OSPFv3 viděli jednoduchý další skok.')],
    reqs: x => [...OSPF6.advanced.reqs(x), ...['gi0/0', 'gi0/1', 'gi0/2'].map(linkLocal)],
    cmds: x => [...OSPF6.advanced.cmds(x), ...['gi0/0', 'gi0/1', 'gi0/2'].flatMap(k => onIf(k, 'ipv6 address fe80::1 link-local'))],
  },
};

// RIP and EIGRP on R1 (EIGRP uses AS 100)
const igpIn = (p, k, network) => ({text: L(`${portName(k)} runs ${IGP_NAME[p]}`, `${portName(k)} používá ${IGP_NAME[p]}`), ok: s => !!netHit(R1(s), p, k), hint: {cmds: [IGP_START[p], network]}});
const igpNoSum = p => ({text: L(`${IGP_NAME[p]} auto-summary is off`, `${IGP_NAME[p]} má auto-summary vypnuté`), ok: s => R1(s)[p].nosum, hint: {cmds: ['no auto-summary']}});
const RIP_V2 = {text: L('RIP runs version 2', 'RIP používá verzi 2'), ok: s => R1(s).rip.ver === 2, hint: {cmds: ['router rip', 'version 2']}};
const RIP_ORIGINATE = {text: L('RIP advertises the default route', 'RIP ohlašuje výchozí routu'), ok: s => R1(s).rip.originate, hint: {cmds: ['router rip', 'default-information originate']}};
const eigrpRid = rid => ({text: L(`The EIGRP router ID is ${rid}`, `Router ID pro EIGRP je ${rid}`), ok: s => R1(s).eigrp.rid === rid, hint: {cmds: ['router eigrp 100', `eigrp router-id ${rid}`]}});
const EIGRP_AS = {text: L('EIGRP runs as AS 100', 'EIGRP běží jako AS 100'), ok: s => R1(s).eigrp.pid === 100, hint: {cmds: ['router eigrp 100']}};
const EIGRP_CLASSFUL = {text: L('EIGRP covers 10.0.0.0 with one classful network statement', 'EIGRP pokrývá 10.0.0.0 jedním třídním příkazem network'), ok: s => R1(s).eigrp.nets.some(n => n.cf && n.net === '10.0.0.0'), hint: {cmds: ['network 10.0.0.0']}};

const RIP_LEAD = serves(L('R2 is a RIP neighbour on Gi0/1.', 'R2 je soused RIP na Gi0/1.'));
const RIP_BASE = x => [...BOTH_IFS(x), RIP_V2, igpIn('rip', 'gi0/0', `network 192.168.${x}.0`), igpIn('rip', 'gi0/1', 'network 10.0.0.0')];
const RIP = {
  beginner: {
    sub: L('Run RIP version 2 on the LAN and the link to R2', 'Spusť RIP verze 2 na LAN a na lince k R2'),
    lead: RIP_LEAD,
    steps: [L('Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Adresuj Gi0/0 a Gi0/1 na R1 a zapni je.'), L('Start router rip and set version 2.', 'Spusť router rip a nastav version 2.'),
      L('Add network 192.168.x.0 and network 10.0.0.0 (RIP networks are classful).', 'Přidej network 192.168.x.0 a network 10.0.0.0 (sítě RIP jsou třídní).')],
    reqs: RIP_BASE,
    cmds: x => [...BOTH_CMDS(x), 'router rip', 'version 2', `network 192.168.${x}.0`, 'network 10.0.0.0', 'exit'],
  },
  intermediate: {
    sub: L('As Beginner, with auto-summary off and no RIP updates sent to the LAN', 'Jako Začátečník, s vypnutým auto-summary a bez aktualizací RIP do LAN'),
    lead: RIP_LEAD,
    steps: [L('Keep RIPv2 running on both networks.', 'Nech RIPv2 běžet v obou sítích.'), L('Turn off auto-summary.', 'Vypni auto-summary.'), L('Make Gi0/0 a passive interface.', 'Nastav Gi0/0 jako pasivní rozhraní.')],
    reqs: x => [...RIP_BASE(x), igpNoSum('rip'), igpPassive('rip', 'gi0/0')],
    cmds: x => [...RIP.beginner.cmds(x), 'router rip', 'no auto-summary', 'passive-interface gi0/0', 'exit'],
  },
  advanced: {
    sub: L('As Intermediate, and advertise a default route via R2 into RIP', 'Jako Mírně pokročilý a navíc ohlas do RIP výchozí routu přes R2'),
    lead: serves(L('R2 is the way out on Gi0/1.', 'Cesta ven vede přes R2 na Gi0/1.')),
    steps: [L('Keep the Intermediate settings.', 'Nech nastavení z úrovně Mírně pokročilý.'), L('Add a static default route via 10.0.0.2.', 'Přidej statickou výchozí routu přes 10.0.0.2.'), L('Under router rip, add default-information originate.', 'Pod router rip přidej default-information originate.')],
    reqs: x => [...RIP.intermediate.reqs(x), DEFAULT_VIA_R2, RIP_ORIGINATE],
    cmds: x => [...RIP.intermediate.cmds(x), DEFAULT_CMD, 'router rip', 'default-information originate', 'exit'],
  },
  expert: {
    sub: L('As Advanced, and bring up R3 on Gi0/2 without sending it RIP updates', 'Jako Pokročilý a navíc zapoj R3 na Gi0/2, aniž bys mu posílal aktualizace RIP'),
    lead: serves(L('R2 is the way out on Gi0/1; R3 is on Gi0/2.', 'Cesta ven vede přes R2 na Gi0/1; R3 je na Gi0/2.')),
    steps: [L('Keep the Advanced settings.', 'Nech nastavení z úrovně Pokročilý.'), L('Address Gi0/2 as 10.0.1.1/30 and bring it up (network 10.0.0.0 already covers it).', 'Adresuj Gi0/2 jako 10.0.1.1/30 a zapni ho (network 10.0.0.0 ho už pokrývá).'), L('Make Gi0/2 a passive interface.', 'Nastav Gi0/2 jako pasivní rozhraní.')],
    reqs: x => [...RIP.advanced.reqs(x), ...R3_IF, igpIn('rip', 'gi0/2', 'network 10.0.0.0'), igpPassive('rip', 'gi0/2')],
    cmds: x => [...RIP.advanced.cmds(x), ...R3_CMDS, 'router rip', 'passive-interface gi0/2', 'exit'],
  },
};

// Legacy classful routing: RIPv1 on R1 (no masks in updates, so no VLSM and no turning auto-summary off)
const RIP_V1 = {text: L('RIP runs version 1', 'RIP používá verzi 1'), ok: s => R1(s).rip.ver === 1, hint: {cmds: ['router rip', 'version 1']}};
const RIP1_BASE = x => [...BOTH_IFS(x), RIP_V1, igpIn('rip', 'gi0/0', `network 192.168.${x}.0`), igpIn('rip', 'gi0/1', 'network 10.0.0.0')];
const RIP1 = {
  beginner: {
    sub: L('Run legacy RIP version 1 on the LAN and the link to R2', 'Spusť starší RIP verze 1 na LAN a na lince k R2'),
    lead: RIP_LEAD,
    steps: [L('Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Adresuj Gi0/0 a Gi0/1 na R1 a zapni je.'), L('Start router rip and set version 1 (classful, no masks in updates).', 'Spusť router rip a nastav version 1 (třídní, bez masek v aktualizacích).'),
      L('Add network 192.168.x.0 and network 10.0.0.0.', 'Přidej network 192.168.x.0 a network 10.0.0.0.')],
    reqs: RIP1_BASE,
    cmds: x => [...BOTH_CMDS(x), 'router rip', 'version 1', `network 192.168.${x}.0`, 'network 10.0.0.0', 'exit'],
  },
  intermediate: {
    sub: L('As Beginner, with no RIP updates sent to the LAN', 'Jako Začátečník, bez aktualizací RIP do LAN'),
    lead: RIP_LEAD,
    steps: [L('Keep RIPv1 running on both networks.', 'Nech RIPv1 běžet v obou sítích.'), L('Make Gi0/0 a passive interface.', 'Nastav Gi0/0 jako pasivní rozhraní.')],
    reqs: x => [...RIP1_BASE(x), igpPassive('rip', 'gi0/0')],
    cmds: x => [...RIP1.beginner.cmds(x), 'router rip', 'passive-interface gi0/0', 'exit'],
  },
  advanced: {
    sub: L('As Intermediate, and advertise a default route via R2 into RIP', 'Jako Mírně pokročilý a navíc ohlas do RIP výchozí routu přes R2'),
    lead: serves(L('R2 is the way out on Gi0/1.', 'Cesta ven vede přes R2 na Gi0/1.')),
    steps: [L('Keep the Intermediate settings.', 'Nech nastavení z úrovně Mírně pokročilý.'), L('Add a static default route via 10.0.0.2.', 'Přidej statickou výchozí routu přes 10.0.0.2.'), L('Under router rip, add default-information originate.', 'Pod router rip přidej default-information originate.')],
    reqs: x => [...RIP1.intermediate.reqs(x), DEFAULT_VIA_R2, RIP_ORIGINATE],
    cmds: x => [...RIP1.intermediate.cmds(x), DEFAULT_CMD, 'router rip', 'default-information originate', 'exit'],
  },
  expert: {
    sub: L('As Advanced, and bring up R3 on Gi0/2 without sending it RIP updates', 'Jako Pokročilý a navíc zapoj R3 na Gi0/2, aniž bys mu posílal aktualizace RIP'),
    lead: serves(L('R2 is the way out on Gi0/1; R3 is on Gi0/2.', 'Cesta ven vede přes R2 na Gi0/1; R3 je na Gi0/2.')),
    steps: [L('Keep the Advanced settings.', 'Nech nastavení z úrovně Pokročilý.'), L('Address Gi0/2 as 10.0.1.1/30 and bring it up (network 10.0.0.0 already covers it).', 'Adresuj Gi0/2 jako 10.0.1.1/30 a zapni ho (network 10.0.0.0 ho už pokrývá).'), L('Make Gi0/2 a passive interface.', 'Nastav Gi0/2 jako pasivní rozhraní.')],
    reqs: x => [...RIP1.advanced.reqs(x), ...R3_IF, igpIn('rip', 'gi0/2', 'network 10.0.0.0'), igpPassive('rip', 'gi0/2')],
    cmds: x => [...RIP1.advanced.cmds(x), ...R3_CMDS, 'router rip', 'passive-interface gi0/2', 'exit'],
  },
};

const EIGRP_LEAD = serves(L('R2 is an EIGRP neighbour on Gi0/1.', 'R2 je soused EIGRP na Gi0/1.'));
const EIGRP_BASE = x => [...BOTH_IFS(x), EIGRP_AS, igpIn('eigrp', 'gi0/0', `network 192.168.${x}.0 0.0.0.255`), igpIn('eigrp', 'gi0/1', 'network 10.0.0.0 0.0.0.3')];
const EIGRP = {
  beginner: {
    sub: L('Run EIGRP AS 100 on the LAN and the link to R2', 'Spusť EIGRP AS 100 na LAN a na lince k R2'),
    lead: EIGRP_LEAD,
    steps: [L('Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Adresuj Gi0/0 a Gi0/1 na R1 a zapni je.'), L('Start router eigrp 100.', 'Spusť router eigrp 100.'),
      L('Add network 192.168.x.0 0.0.0.255 and network 10.0.0.0 0.0.0.3.', 'Přidej network 192.168.x.0 0.0.0.255 a network 10.0.0.0 0.0.0.3.')],
    reqs: EIGRP_BASE,
    cmds: x => [...BOTH_CMDS(x), 'router eigrp 100', `network 192.168.${x}.0 0.0.0.255`, 'network 10.0.0.0 0.0.0.3', 'exit'],
  },
  intermediate: {
    sub: L('As Beginner, with router ID 1.1.1.1 and no EIGRP hellos sent to the LAN', 'Jako Začátečník, s router ID 1.1.1.1 a bez hello EIGRP do LAN'),
    lead: EIGRP_LEAD,
    steps: [L('Keep EIGRP running on both networks.', 'Nech EIGRP běžet v obou sítích.'), L('Set the router ID to 1.1.1.1.', 'Nastav router ID na 1.1.1.1.'), L('Make Gi0/0 a passive interface.', 'Nastav Gi0/0 jako pasivní rozhraní.')],
    reqs: x => [...EIGRP_BASE(x), eigrpRid('1.1.1.1'), igpPassive('eigrp', 'gi0/0')],
    cmds: x => [...EIGRP.beginner.cmds(x), 'router eigrp 100', 'eigrp router-id 1.1.1.1', 'passive-interface gi0/0', 'exit'],
  },
  advanced: {
    sub: L('As Intermediate, with auto-summary off and R3 on Gi0/2 in EIGRP', 'Jako Mírně pokročilý, s vypnutým auto-summary a R3 na Gi0/2 v EIGRP'),
    lead: serves(L('R2 is on Gi0/1 and R3 on Gi0/2.', 'R2 je na Gi0/1 a R3 na Gi0/2.')),
    steps: [L('Keep the Intermediate settings.', 'Nech nastavení z úrovně Mírně pokročilý.'), L('Turn off auto-summary.', 'Vypni auto-summary.'), L('Address Gi0/2 as 10.0.1.1/30 and bring it up.', 'Adresuj Gi0/2 jako 10.0.1.1/30 a zapni ho.'), L('Add network 10.0.1.0 0.0.0.3.', 'Přidej network 10.0.1.0 0.0.0.3.')],
    reqs: x => [...EIGRP.intermediate.reqs(x), igpNoSum('eigrp'), ...R3_IF, igpIn('eigrp', 'gi0/2', 'network 10.0.1.0 0.0.0.3')],
    cmds: x => [...EIGRP.intermediate.cmds(x), ...R3_CMDS, 'router eigrp 100', 'no auto-summary', 'network 10.0.1.0 0.0.0.3', 'exit'],
  },
  expert: {
    sub: L('As Advanced, and cover both 10.0.x.0/30 links with one classful network statement', 'Jako Pokročilý a navíc pokryj obě linky 10.0.x.0/30 jedním třídním příkazem network'),
    lead: serves(L('R2 is on Gi0/1 and R3 on Gi0/2.', 'R2 je na Gi0/1 a R3 na Gi0/2.')),
    steps: [L('Keep the Advanced settings.', 'Nech nastavení z úrovně Pokročilý.'), L('Add network 10.0.0.0 with no wildcard mask, which EIGRP treats as the whole classful network.', 'Přidej network 10.0.0.0 bez wildcard masky, což EIGRP bere jako celou třídní síť.')],
    reqs: x => [...EIGRP.advanced.reqs(x), EIGRP_CLASSFUL],
    cmds: x => [...EIGRP.advanced.cmds(x), 'router eigrp 100', 'network 10.0.0.0', 'exit'],
  },
};

// Device hardening best practices on R1
// a line requirement: cmds are typed under the line (console = line console 0, vty = line vty 0 4)
const LINE_CMD = {console: 'line console 0', vty: 'line vty 0 4'};
const lineCheck = (name, text, ok, ...cmds) => ({text, ok: s => ok(R1(s).lines[name]), hint: {cmds: [LINE_CMD[name], ...cmds]}});
const hardenLine = name => [
  lineCheck(name, L(`${name === 'vty' ? 'VTY lines have' : 'The console has'} a password`, `${name === 'vty' ? 'Linky VTY mají' : 'Konzole má'} heslo`), l => !!l.pw, 'password <word>'),
  lineCheck(name, L(`${name === 'vty' ? 'VTY lines require' : 'The console requires'} a login`, `${name === 'vty' ? 'Linky VTY vyžadují' : 'Konzole vyžaduje'} přihlášení`), l => l.login, 'login'),
];
const HARDEN_BASE = [
  {text: L('The hostname is EDGE1', 'Hostname je EDGE1'), ok: s => R1(s).host === 'EDGE1', hint: {cmds: ['hostname EDGE1']}},
  {text: L('The privileged EXEC mode is protected by an enable secret', 'Privilegovaný režim EXEC chrání enable secret'), ok: s => R1(s).sec.secret, hint: {cmds: ['enable secret <word>']}},
  {text: L('Stored passwords are encrypted', 'Uložená hesla jsou zašifrovaná'), ok: s => R1(s).sec.enc, hint: {cmds: ['service password-encryption']}},
];
const HARDEN_I = [...HARDEN_BASE, {text: L('A MOTD banner is set', 'Je nastavený banner MOTD'), ok: s => !!R1(s).sec.banner, hint: {cmds: ['banner motd #Authorized access only#']}},
  {text: L('DNS lookups for mistyped commands are off', 'Vyhledávání DNS u překlepů v příkazech je vypnuté'), ok: s => R1(s).sec.nolookup, hint: {cmds: ['no ip domain-lookup']}}];
const HARDEN_A = [...HARDEN_I, ...hardenLine('console'), lineCheck('console', L('The console uses logging synchronous', 'Konzole používá logging synchronous'), l => l.sync, 'logging synchronous')];
const HARDEN_B_CMDS = ['hostname EDGE1', 'enable secret class', 'service password-encryption'];
const HARDEN_I_CMDS = [...HARDEN_B_CMDS, 'banner motd #Authorized access only#', 'no ip domain-lookup'];
const HARDEN_A_CMDS = [...HARDEN_I_CMDS, 'line console 0', 'password cisco', 'login', 'logging synchronous', 'exit'];
const HARDEN = {
  beginner: {
    sub: L('Name the router EDGE1, protect privileged mode and encrypt stored passwords', 'Pojmenuj router EDGE1, chraň privilegovaný režim a zašifruj uložená hesla'),
    steps: [L('Set the hostname to EDGE1.', 'Nastav hostname na EDGE1.'), L('Set an enable secret.', 'Nastav enable secret.'), L('Turn on service password-encryption.', 'Zapni service password-encryption.')],
    reqs: HARDEN_BASE,
    cmds: HARDEN_B_CMDS,
  },
  intermediate: {
    sub: L('As Beginner, with a login banner and no DNS lookups for mistyped commands', 'Jako Začátečník, s přihlašovacím bannerem a bez vyhledávání DNS u překlepů v příkazech'),
    steps: [L('Keep the Beginner settings.', 'Nech nastavení z úrovně Začátečník.'), L('Add a banner, for example banner motd #Authorized access only#.', 'Přidej banner, například banner motd #Authorized access only#.'), L('Turn off DNS lookups with no ip domain-lookup.', 'Vypni vyhledávání DNS příkazem no ip domain-lookup.')],
    reqs: HARDEN_I,
    cmds: HARDEN_I_CMDS,
  },
  advanced: {
    sub: L('As Intermediate, and lock down the console line', 'Jako Mírně pokročilý a navíc zabezpeč linku console'),
    steps: [L('Keep the Intermediate settings.', 'Nech nastavení z úrovně Mírně pokročilý.'), L('Under line console 0, set a password and login.', 'Pod line console 0 nastav password a login.'), L('Add logging synchronous so log messages do not interrupt typing.', 'Přidej logging synchronous, aby logové zprávy nepřerušovaly psaní.')],
    reqs: HARDEN_A,
    cmds: HARDEN_A_CMDS,
  },
  expert: {
    sub: L('As Advanced, and lock down the VTY lines with an idle timeout on every line', 'Jako Pokročilý a navíc zabezpeč linky VTY a na každé lince nastav časový limit nečinnosti'),
    steps: [L('Keep the Advanced settings.', 'Nech nastavení z úrovně Pokročilý.'), L('Under line vty 0 4, set a password and login.', 'Pod line vty 0 4 nastav password a login.'), L('Set exec-timeout 5 0 on the console and on the VTY lines.', 'Nastav exec-timeout 5 0 na konzoli i na linkách VTY.')],
    reqs: [...HARDEN_A, ...hardenLine('vty'),
      lineCheck('console', L('The console logs out after 5 idle minutes', 'Konzole odhlásí po 5 minutách nečinnosti'), l => l.timeout === '5 0', 'exec-timeout 5 0'),
      lineCheck('vty', L('VTY lines log out after 5 idle minutes', 'Linky VTY odhlásí po 5 minutách nečinnosti'), l => l.timeout === '5 0', 'exec-timeout 5 0')],
    cmds: [...HARDEN_A_CMDS, 'line vty 0 4', 'password cisco', 'login', 'exec-timeout 5 0', 'exit',
      'line console 0', 'exec-timeout 5 0', 'exit'],
  },
};

// the entries of the ACL labs' ACLs (the troubleshooting ACL labs in labs-fix.js break and fix the same ones)
const BLOCK10 = x => [`deny host 192.168.${x}.10`, 'permit any'];
const TELNET_ENTRIES = ['deny tcp any any eq telnet', 'permit ip any any'];
const WEB_ENTRIES = x => [`deny tcp 192.168.${x}.0 0.0.0.127 any eq www`, 'permit ip any any'];
const TELNET_ACL = [aclEntries('110', 'extended', TELNET_ENTRIES), aclApplied('gi0/0', 'in', '110')];
const TELNET_CMDS = ['ip access-list extended 110', ...TELNET_ENTRIES, 'exit', ...onIf('gi0/0', 'ip access-group 110 in')];
const ACL = {
  beginner: {
    sub: L('Block 192.168.x.10 with standard ACL 10 on inbound Gi0/0', 'Zablokuj 192.168.x.10 standardním ACL 10 příchozím na Gi0/0'),
    lead: x => L(`PC1 is on 192.168.${x}.0/24 behind Gi0/0.`, `PC1 je v 192.168.${x}.0/24 za Gi0/0.`),
    steps: [L('Create standard ACL 10: deny host 192.168.x.10, then permit any.', 'Vytvoř standardní ACL 10: deny host 192.168.x.10, pak permit any.'), L('Apply ACL 10 inbound on Gi0/0.', 'Použij ACL 10 příchozí na Gi0/0.')],
    reqs: x => [...LAN_IF(x), aclEntries('10', 'standard', BLOCK10(x)), aclApplied('gi0/0', 'in', '10')],
    cmds: x => [...LAN_CMDS(x), 'ip access-list standard 10', ...BLOCK10(x), 'exit', ...onIf('gi0/0', 'ip access-group 10 in')],
  },
  intermediate: {
    sub: L('Block the first half of the LAN with standard ACL 10 on outbound Gi0/1', 'Zablokuj první polovinu LAN standardním ACL 10 odchozím na Gi0/1'),
    lead: x => L(`PC1 is on 192.168.${x}.0/24. R2 is reached through Gi0/1.`, `PC1 je v 192.168.${x}.0/24. R2 je dosažitelný přes Gi0/1.`),
    steps: [L('Create standard ACL 10: deny 192.168.x.0 0.0.0.127, then permit any.', 'Vytvoř standardní ACL 10: deny 192.168.x.0 0.0.0.127, pak permit any.'), L('Apply ACL 10 outbound on Gi0/1.', 'Použij ACL 10 odchozí na Gi0/1.')],
    reqs: x => [...BOTH_IFS(x), aclEntries('10', 'standard', [`deny 192.168.${x}.0 0.0.0.127`, 'permit any']), aclApplied('gi0/1', 'out', '10')],
    cmds: x => [...BOTH_CMDS(x), 'ip access-list standard 10', `deny 192.168.${x}.0 0.0.0.127`, 'permit any', 'exit', ...onIf('gi0/1', 'ip access-group 10 out')],
  },
  advanced: {
    sub: L('Block Telnet inbound on Gi0/0 with extended ACL 110', 'Zablokuj Telnet příchozí na Gi0/0 rozšířeným ACL 110'),
    lead: x => L(`PC1 is on 192.168.${x}.0/24 behind Gi0/0.`, `PC1 je v 192.168.${x}.0/24 za Gi0/0.`),
    steps: [L('Create extended ACL 110: deny tcp any any eq telnet, then permit ip any any.', 'Vytvoř rozšířené ACL 110: deny tcp any any eq telnet, pak permit ip any any.'), L('Apply ACL 110 inbound on Gi0/0.', 'Použij ACL 110 příchozí na Gi0/0.')],
    reqs: x => [...LAN_IF(x), ...TELNET_ACL],
    cmds: x => [...LAN_CMDS(x), ...TELNET_CMDS],
  },
  expert: {
    sub: L('Keep ACL 110 on Gi0/0, and filter web traffic from the LAN with web-filter outbound on Gi0/1', 'Nech ACL 110 na Gi0/0 a filtruj webový provoz z LAN pomocí web-filter odchozího na Gi0/1'),
    lead: x => L(`PC1 is on 192.168.${x}.0/24. R2 is reached through Gi0/1.`, `PC1 je v 192.168.${x}.0/24. R2 je dosažitelný přes Gi0/1.`),
    steps: [L('Keep ACL 110 inbound on Gi0/0.', 'Nech ACL 110 příchozí na Gi0/0.'), L('Create extended ACL web-filter: deny tcp the first half of the LAN to any eq www, then permit ip any any.', 'Vytvoř rozšířené ACL web-filter: deny tcp první polovina LAN do any eq www, pak permit ip any any.'),
      L('Apply web-filter outbound on Gi0/1.', 'Použij web-filter odchozí na Gi0/1.')],
    reqs: x => [...BOTH_IFS(x), ...TELNET_ACL, aclEntries('web-filter', 'extended', WEB_ENTRIES(x)), aclApplied('gi0/1', 'out', 'web-filter')],
    cmds: x => [...BOTH_CMDS(x), ...TELNET_CMDS, 'ip access-list extended web-filter', ...WEB_ENTRIES(x), 'exit',
      ...onIf('gi0/1', 'ip access-group web-filter out')],
  },
};

// DHCP, DHCP relay, NAT, network services
const dhcpPool = (name, net, mask, gw) => ({
  text: L(`DHCP pool ${name} serves ${net} ${mask} with default router ${gw}`, `DHCP pool ${name} obsluhuje ${net} ${mask} s výchozím routerem ${gw}`),
  ok: s => !!R1(s).dhcp[name] && R1(s).dhcp[name].net === net && R1(s).dhcp[name].mask === mask && R1(s).dhcp[name].gw === gw,
  hint: {cmds: [`ip dhcp pool ${name}`, `network ${net} ${mask}`, `default-router ${gw}`]},
});
const dhcpEx = (first, last) => ({text: L(`DHCP excludes ${first} to ${last}`, `DHCP vylučuje ${first} až ${last}`), ok: s => R1(s).dhcpEx.some(([a, b]) => a === first && b === last), hint: {cmds: [`ip dhcp excluded-address ${first} ${last}`]}});
const dhcpDns = (name, ip) => ({text: L(`DHCP pool ${name} gives DNS server ${ip}`, `DHCP pool ${name} dává DNS server ${ip}`), ok: s => !!R1(s).dhcp[name] && R1(s).dhcp[name].dns.includes(ip), hint: {cmds: [`dns-server ${ip}`]}});
const dhcpDomain = (name, d) => ({text: L(`DHCP pool ${name} sets the domain to ${d}`, `DHCP pool ${name} nastavuje doménu ${d}`), ok: s => !!R1(s).dhcp[name] && R1(s).dhcp[name].domain === d, hint: {cmds: [`domain-name ${d}`]}});
const helperOn = (k, ip) => rtReq(k, L(`forwards DHCP to ${ip}`, `předává DHCP na ${ip}`), i => i.helpers.includes(ip), `ip helper-address ${ip}`);
const noHelper = k => rtReq(k, L('does not forward DHCP', 'nepředává DHCP'), i => i.helpers.length === 0, 'no ip helper-address');
const natSide = (k, dir) => rtReq(k, L(`is NAT ${dir}`, `je NAT ${dir}`), i => i.nat === dir, `ip nat ${dir}`);
const natPat = (acl, k) => ({
  text: L(`ACL ${acl} hosts use ${portName(k)} with PAT (overload)`, `Hostitelé z ACL ${acl} používají ${portName(k)} s PAT (overload)`),
  ok: s => R1(s).nat.pat.some(p => p.acl === acl && p.iface === portName(k)),
  hint: {cmds: [`ip nat inside source list ${acl} interface ${portName(k)} overload`]},
});
const natStatic = (inside, outside) => ({
  text: L(`${inside} is NATed to ${outside} with a static entry`, `${inside} se překládá na ${outside} statickou položkou`),
  ok: s => R1(s).nat.stat.some(p => p.in === inside && p.out === outside),
  hint: {cmds: [`ip nat inside source static ${inside} ${outside}`]},
});
const svcNtp = ip => ({text: L(`R1 uses NTP server ${ip}`, `R1 používá NTP server ${ip}`), ok: s => R1(s).svc.ntp.includes(ip), hint: {cmds: [`ntp server ${ip}`]}});
const svcLog = ip => ({text: L(`R1 sends logs to ${ip}`, `R1 posílá logy na ${ip}`), ok: s => R1(s).svc.log.includes(ip), hint: {cmds: [`logging host ${ip}`]}});
const svcDns = ip => ({text: L(`R1 uses DNS server ${ip}`, `R1 používá DNS server ${ip}`), ok: s => R1(s).svc.dns.includes(ip), hint: {cmds: [`ip name-server ${ip}`]}});

const DHCP_LEAD = x => L(`PC1 is on 192.168.${x}.0/24 behind Gi0/0 and gets its settings from R1.`, `PC1 je v 192.168.${x}.0/24 za Gi0/0 a nastavení dostává od R1.`);
const DHCP = {
  beginner: {
    sub: L('Create DHCP pool LAN1 for 192.168.x.0/24 with R1 as the default router', 'Vytvoř DHCP pool LAN1 pro 192.168.x.0/24 s R1 jako výchozím routerem'),
    lead: DHCP_LEAD,
    steps: [L('Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Adresuj Gi0/0 a Gi0/1 na R1 a zapni je.'), L('Create ip dhcp pool LAN1 with network 192.168.x.0 255.255.255.0.', 'Vytvoř ip dhcp pool LAN1 s network 192.168.x.0 255.255.255.0.'),
      L('Set default-router to 192.168.x.1.', 'Nastav default-router na 192.168.x.1.'), L('Open PC1 and type dhcp to get an address.', 'Otevři PC1 a napiš dhcp, aby dostalo adresu.')],
    reqs: x => [...BOTH_IFS(x), dhcpPool('lan1', `192.168.${x}.0`, '255.255.255.0', `192.168.${x}.1`), pcLease('PC1', `192.168.${x}`)],
    cmds: x => [...BOTH_CMDS(x), 'ip dhcp pool LAN1', `network 192.168.${x}.0 255.255.255.0`, `default-router 192.168.${x}.1`, 'exit'],
    then: PC1_DHCP,
  },
  intermediate: {
    sub: L('As Beginner, and exclude 192.168.x.1 to 192.168.x.20 from the pool', 'Jako Začátečník a navíc vyluč z poolu 192.168.x.1 až 192.168.x.20'),
    lead: DHCP_LEAD,
    steps: [L('Keep the LAN1 pool.', 'Nech pool LAN1.'), L('Add ip dhcp excluded-address 192.168.x.1 192.168.x.20.', 'Přidej ip dhcp excluded-address 192.168.x.1 192.168.x.20.')],
    reqs: x => [...DHCP.beginner.reqs(x), dhcpEx(`192.168.${x}.1`, `192.168.${x}.20`)],
    cmds: x => [...DHCP.beginner.cmds(x), `ip dhcp excluded-address 192.168.${x}.1 192.168.${x}.20`],
    then: PC1_DHCP,
  },
  advanced: {
    sub: L('As Intermediate, and give clients the DNS server 172.16.x.53', 'Jako Mírně pokročilý a navíc dej klientům DNS server 172.16.x.53'),
    lead: DHCP_LEAD,
    steps: [L('Keep the LAN1 pool and excluded range.', 'Nech pool LAN1 a vyloučený rozsah.'), L('Add dns-server 172.16.x.53 to LAN1.', 'Přidej do LAN1 dns-server 172.16.x.53.')],
    reqs: x => [...DHCP.intermediate.reqs(x), dhcpDns('lan1', `172.16.${x}.53`)],
    cmds: x => [...DHCP.intermediate.cmds(x), 'ip dhcp pool LAN1', `dns-server 172.16.${x}.53`, 'exit'],
    then: PC1_DHCP,
  },
  expert: {
    sub: L('As Advanced, and set the domain name to lab.local', 'Jako Pokročilý a navíc nastav doménové jméno lab.local'),
    lead: DHCP_LEAD,
    steps: [L('Keep the Advanced settings.', 'Nech nastavení z úrovně Pokročilý.'), L('Add domain-name lab.local to LAN1.', 'Přidej do LAN1 domain-name lab.local.')],
    reqs: x => [...DHCP.advanced.reqs(x), dhcpDomain('lan1', 'lab.local')],
    cmds: x => [...DHCP.advanced.cmds(x), 'ip dhcp pool LAN1', 'domain-name lab.local', 'exit'],
    then: PC1_DHCP,
  },
};

const RELAY_LEAD = x => L(`PC1 is on 192.168.${x}.0/24 behind Gi0/0. Both DHCP servers are behind R2.`, `PC1 je v 192.168.${x}.0/24 za Gi0/0. Oba DHCP servery jsou za R2.`);
const DHCPRELAY = {
  beginner: {
    sub: L('Forward DHCP from the LAN to the server 172.16.x.10 behind R2', 'Předávej DHCP z LAN na server 172.16.x.10 za R2'),
    lead: x => L(`PC1 is on 192.168.${x}.0/24 behind Gi0/0. The DHCP server 172.16.x.10 is behind R2.`, `PC1 je v 192.168.${x}.0/24 za Gi0/0. DHCP server 172.16.x.10 je za R2.`),
    steps: [L('Address Gi0/0 and Gi0/1 on R1 and bring them up.', 'Adresuj Gi0/0 a Gi0/1 na R1 a zapni je.'), L('Add a route to 172.16.x.0/24 via 10.0.0.2.', 'Přidej routu do 172.16.x.0/24 přes 10.0.0.2.'), L('On Gi0/0, add ip helper-address 172.16.x.10.', 'Na Gi0/0 přidej ip helper-address 172.16.x.10.'),
      L('Open PC1 and type dhcp to get an address through the relay.', 'Otevři PC1 a napiš dhcp, aby dostalo adresu přes relay.')],
    reqs: x => [...BOTH_IFS(x), rtRoute(`172.16.${x}.0`, '255.255.255.0', '10.0.0.2'), helperOn('gi0/0', `172.16.${x}.10`), pcLease('PC1', `192.168.${x}`)],
    cmds: x => [...BOTH_CMDS(x), `ip route 172.16.${x}.0 255.255.255.0 10.0.0.2`, ...onIf('gi0/0', `ip helper-address 172.16.${x}.10`)],
    then: PC1_DHCP,
  },
  intermediate: {
    sub: L('Add a second DHCP server 172.17.x.10 behind R2 as a backup helper', 'Přidej druhý DHCP server 172.17.x.10 za R2 jako záložní helper'),
    lead: RELAY_LEAD,
    steps: [L('Keep the relay to 172.16.x.10.', 'Nech relay na 172.16.x.10.'), L('Add a route to 172.17.x.0/24 via 10.0.0.2.', 'Přidej routu do 172.17.x.0/24 přes 10.0.0.2.'), L('Add a second ip helper-address 172.17.x.10 on Gi0/0.', 'Přidej na Gi0/0 druhou ip helper-address 172.17.x.10.')],
    reqs: x => [...DHCPRELAY.beginner.reqs(x), rtRoute(`172.17.${x}.0`, '255.255.255.0', '10.0.0.2'), helperOn('gi0/0', `172.17.${x}.10`)],
    cmds: x => [...DHCPRELAY.beginner.cmds(x), `ip route 172.17.${x}.0 255.255.255.0 10.0.0.2`, ...onIf('gi0/0', `ip helper-address 172.17.${x}.10`)],
    then: PC1_DHCP,
  },
  advanced: {
    sub: L('As Intermediate, and make sure the uplink Gi0/1 does not relay DHCP', 'Jako Mírně pokročilý a navíc zajisti, aby uplink Gi0/1 nepředával DHCP'),
    lead: RELAY_LEAD,
    steps: [L('Keep both helper addresses on Gi0/0.', 'Nech obě helper adresy na Gi0/0.'), L('Make sure Gi0/1 has no ip helper-address.', 'Zajisti, aby Gi0/1 nemělo žádnou ip helper-address.')],
    reqs: x => [...DHCPRELAY.intermediate.reqs(x), noHelper('gi0/1')],
    cmds: x => DHCPRELAY.intermediate.cmds(x), // Gi0/1 relays nothing unless told to
    then: PC1_DHCP,
  },
  expert: {
    sub: L('As Advanced, and add a default route via R2 so replies leave the network', 'Jako Pokročilý a navíc přidej výchozí routu přes R2, aby odpovědi opustily síť'),
    lead: RELAY_LEAD,
    steps: [L('Keep the Advanced settings.', 'Nech nastavení z úrovně Pokročilý.'), L('Add a default route via 10.0.0.2.', 'Přidej výchozí routu přes 10.0.0.2.')],
    reqs: x => [...DHCPRELAY.advanced.reqs(x), DEFAULT_VIA_R2],
    cmds: x => [...DHCPRELAY.advanced.cmds(x), DEFAULT_CMD],
    then: PC1_DHCP,
  },
};

const NAT_LEAD = x => L(`PC1 is on 192.168.${x}.0/24 behind Gi0/0. R2 is outside on Gi0/1.`, `PC1 je v 192.168.${x}.0/24 za Gi0/0. R2 je venku na Gi0/1.`);
const NAT = {
  beginner: {
    sub: L('Mark Gi0/0 as NAT inside, Gi0/1 as NAT outside, and define ACL 1 for the LAN', 'Označ Gi0/0 jako NAT inside, Gi0/1 jako NAT outside a definuj ACL 1 pro LAN'),
    lead: NAT_LEAD,
    steps: [L('Address Gi0/0 and Gi0/1 and bring them up.', 'Adresuj Gi0/0 a Gi0/1 a zapni je.'), L('Set Gi0/0 to ip nat inside and Gi0/1 to ip nat outside.', 'Nastav Gi0/0 na ip nat inside a Gi0/1 na ip nat outside.'),
      L('Create access-list 1 permit 192.168.x.0 0.0.0.255.', 'Vytvoř access-list 1 permit 192.168.x.0 0.0.0.255.')],
    reqs: x => [...BOTH_IFS(x), natSide('gi0/0', 'inside'), natSide('gi0/1', 'outside'), aclEntries('1', 'standard', [`permit 192.168.${x}.0 0.0.0.255`])],
    cmds: x => [...BOTH_CMDS(x), ...onIf('gi0/0', 'ip nat inside'), ...onIf('gi0/1', 'ip nat outside'), `access-list 1 permit 192.168.${x}.0 0.0.0.255`],
  },
  intermediate: {
    sub: L('As Beginner, and translate the LAN to the Gi0/1 address with PAT', 'Jako Začátečník a navíc překládej LAN na adresu Gi0/1 pomocí PAT'),
    lead: NAT_LEAD,
    steps: [L('Keep the NAT inside and outside sides.', 'Nech strany NAT inside a outside.'), L('Add ip nat inside source list 1 interface Gi0/1 overload.', 'Přidej ip nat inside source list 1 interface Gi0/1 overload.')],
    reqs: x => [...NAT.beginner.reqs(x), natPat('1', 'gi0/1')],
    cmds: x => [...NAT.beginner.cmds(x), 'ip nat inside source list 1 interface gi0/1 overload'],
  },
  advanced: {
    sub: L('As Intermediate, and add a static NAT from 192.168.x.20 to 198.51.100.x', 'Jako Mírně pokročilý a navíc přidej statický NAT z 192.168.x.20 na 198.51.100.x'),
    lead: NAT_LEAD,
    steps: [L('Keep the PAT rule.', 'Nech pravidlo PAT.'), L('Add ip nat inside source static 192.168.x.20 198.51.100.x.', 'Přidej ip nat inside source static 192.168.x.20 198.51.100.x.')],
    reqs: x => [...NAT.intermediate.reqs(x), natStatic(`192.168.${x}.20`, `198.51.100.${x}`)],
    cmds: x => [...NAT.intermediate.cmds(x), `ip nat inside source static 192.168.${x}.20 198.51.100.${x}`],
  },
  expert: {
    sub: L('As Advanced, and add a default route via R2 so NAT traffic can leave', 'Jako Pokročilý a navíc přidej výchozí routu přes R2, aby provoz přes NAT mohl ven'),
    lead: NAT_LEAD,
    steps: [L('Keep the Advanced NAT rules.', 'Nech pravidla NAT z úrovně Pokročilý.'), L('Add a default route via 10.0.0.2.', 'Přidej výchozí routu přes 10.0.0.2.')],
    reqs: x => [...NAT.advanced.reqs(x), DEFAULT_VIA_R2],
    cmds: x => [...NAT.advanced.cmds(x), DEFAULT_CMD],
  },
};

const SERVICES = {
  beginner: {
    sub: L('Point R1 at the NTP server 10.0.0.2 behind R2', 'Nasměruj R1 na NTP server 10.0.0.2 za R2'),
    lead: L('R1 reaches R2 on Gi0/1. The NTP server 10.0.0.2 sits behind R2.', 'R1 dosáhne na R2 přes Gi0/1. NTP server 10.0.0.2 je za R2.'),
    steps: [L('Address Gi0/1 and bring it up.', 'Adresuj Gi0/1 a zapni ho.'), L('Add ntp server 10.0.0.2.', 'Přidej ntp server 10.0.0.2.')],
    reqs: () => [...WAN_IF, svcNtp('10.0.0.2')],
    cmds: [...WAN_CMDS, 'ntp server 10.0.0.2'],
  },
  intermediate: {
    sub: L('Also send logs to the syslog server 172.16.x.100 behind R2', 'Posílej také logy na syslog server 172.16.x.100 za R2'),
    lead: L('R1 reaches R2 on Gi0/1. The syslog server 172.16.x.100 sits behind R2.', 'R1 dosáhne na R2 přes Gi0/1. Syslog server 172.16.x.100 je za R2.'),
    steps: [L('Keep the NTP server.', 'Nech NTP server.'), L('Add a route to 172.16.x.0/24 via 10.0.0.2.', 'Přidej routu do 172.16.x.0/24 přes 10.0.0.2.'), L('Add logging host 172.16.x.100.', 'Přidej logging host 172.16.x.100.')],
    reqs: x => [...SERVICES.beginner.reqs(x), rtRoute(`172.16.${x}.0`, '255.255.255.0', '10.0.0.2'), svcLog(`172.16.${x}.100`)],
    cmds: x => [...SERVICES.beginner.cmds, `ip route 172.16.${x}.0 255.255.255.0 10.0.0.2`, `logging host 172.16.${x}.100`],
  },
  advanced: {
    sub: L('As Intermediate, and use the DNS server 172.16.x.53', 'Jako Mírně pokročilý a navíc používej DNS server 172.16.x.53'),
    lead: L('R1 reaches R2 on Gi0/1. The syslog and DNS servers sit behind R2.', 'R1 dosáhne na R2 přes Gi0/1. Syslog a DNS servery jsou za R2.'),
    steps: [L('Keep the NTP and syslog settings.', 'Nech nastavení NTP a syslogu.'), L('Add ip name-server 172.16.x.53.', 'Přidej ip name-server 172.16.x.53.')],
    reqs: x => [...SERVICES.intermediate.reqs(x), svcDns(`172.16.${x}.53`)],
    cmds: x => [...SERVICES.intermediate.cmds(x), `ip name-server 172.16.${x}.53`],
  },
  expert: {
    sub: L('As Advanced, and add a second NTP server 10.0.1.2 on Gi0/2', 'Jako Pokročilý a navíc přidej druhý NTP server 10.0.1.2 na Gi0/2'),
    lead: L('R1 reaches R2 on Gi0/1 and R3 on Gi0/2.', 'R1 dosáhne na R2 přes Gi0/1 a na R3 přes Gi0/2.'),
    steps: [L('Keep the Advanced settings.', 'Nech nastavení z úrovně Pokročilý.'), L('Address Gi0/2 as 10.0.1.1/30 and bring it up.', 'Adresuj Gi0/2 jako 10.0.1.1/30 a zapni ho.'), L('Add ntp server 10.0.1.2.', 'Přidej ntp server 10.0.1.2.')],
    reqs: x => [...WAN_IF, ...R3_IF, svcNtp('10.0.0.2'), svcNtp('10.0.1.2'), rtRoute(`172.16.${x}.0`, '255.255.255.0', '10.0.0.2'),
      svcLog(`172.16.${x}.100`), svcDns(`172.16.${x}.53`)],
    cmds: x => [...SERVICES.advanced.cmds(x), ...R3_CMDS, 'ntp server 10.0.1.2'],
  },
};

// ---- batch 2: EUI-64, summarization, voice VLAN, trunk troubleshooting, IPv6 static, OSPF tuning, HSRP, SSH, AAA, snooping, DAI ----

// a requirement on any configurable device's port or interface: dev is S1, S2, R1 or R2
const portOf = (s, dev, k) => (s.config(dev).ports || s.config(dev).ifs)[k];
const devReq = (dev, k, text, ok, ...cmds) => ({text: `${dev} ${portName(k)} ${text}`, ok: s => ok(portOf(s, dev, k)), hint: {cmds, port: portName(k), dev}});
// a switch lab's solution: the diagram opens on R1, but the commands go to S1

// 1.0 EUI-64 and SLAAC on R1: the interface ID comes from the MAC (see show interfaces)
const v6Eui = (k, prefix) => rtReq(k, L(`builds its address in ${prefix} with EUI-64`, `si sestaví adresu v ${prefix} pomocí EUI-64`),
  i => i.eui && !!i.ip6 && v6Canon(i.ip6) === v6Canon(prefix), `ipv6 address ${prefix} eui-64`);
const EUI_LEAD = x => L(`Your prefix is 2001:db8:${x}::/48. R1 has no IPv6 addressing yet. Each interface has its own MAC address.`, `Tvůj prefix je 2001:db8:${x}::/48. R1 zatím nemá žádné IPv6 adresy. Každé rozhraní má vlastní MAC adresu.`);
const EUI_B = x => [v6Eui('gi0/0', `2001:db8:${x}:1::/64`), rtUp('gi0/0')];
const EUI_I = x => [...EUI_B(x), v6Eui('gi0/1', `2001:db8:${x}:2::/64`), rtUp('gi0/1')];
const EUI_A = x => [...EUI_I(x), rtReq('gi0/2', L('learns its address by SLAAC', 'se naučí adresu přes SLAAC'), i => i.auto, 'ipv6 address autoconfig'), rtUp('gi0/2')];
const euiFull = x => `2001:db8:${x}:4:${eui64(routerMac('R1', 3))}/64`; // what EUI-64 would build on Gi0/3
const EUI_CMDS_B = x => onIf('gi0/0', `ipv6 address 2001:db8:${x}:1::/64 eui-64`, 'no shutdown');
const EUI_CMDS_I = x => [...EUI_CMDS_B(x), ...onIf('gi0/1', `ipv6 address 2001:db8:${x}:2::/64 eui-64`, 'no shutdown')];
const EUI_CMDS_A = x => [...EUI_CMDS_I(x), ...onIf('gi0/2', 'ipv6 address autoconfig', 'no shutdown')];
const EUI64 = {
  beginner: {
    sub: L('Give Gi0/0 an EUI-64 address in subnet 1 and bring it up', 'Dej Gi0/0 adresu EUI-64 v podsíti 1 a zapni ho'),
    steps: [L('On Gi0/0, use ipv6 address with the subnet 1 prefix and the eui-64 keyword.', 'Na Gi0/0 použij ipv6 address s prefixem podsítě 1 a klíčovým slovem eui-64.'), L('Bring Gi0/0 up.', 'Zapni Gi0/0.'),
      L('Check the address the router built with show ipv6 interface brief.', 'Zkontroluj adresu, kterou router sestavil, příkazem show ipv6 interface brief.')],
    reqs: EUI_B,
    cmds: EUI_CMDS_B,
  },
  intermediate: {
    sub: L('Use EUI-64 on Gi0/0 (subnet 1) and Gi0/1 (subnet 2)', 'Použij EUI-64 na Gi0/0 (podsíť 1) a Gi0/1 (podsíť 2)'),
    steps: [L('Give Gi0/0 subnet 1 and Gi0/1 subnet 2, both with eui-64.', 'Dej Gi0/0 podsíť 1 a Gi0/1 podsíť 2, obě s eui-64.'), L('Bring both interfaces up.', 'Zapni obě rozhraní.'),
      L('Compare the two interface IDs: only the last digits of the MAC differ.', 'Porovnej obě ID rozhraní: liší se jen poslední číslice MAC.')],
    reqs: EUI_I,
    cmds: EUI_CMDS_I,
  },
  advanced: {
    sub: L('As Intermediate, and let Gi0/2 learn its address from R3 by SLAAC', 'Jako Mírně pokročilý a navíc nech Gi0/2 naučit se adresu od R3 přes SLAAC'),
    lead: x => L(`Your prefix is 2001:db8:${x}::/48. R3 on Gi0/2 sends router advertisements for 2001:db8:${x}:3::/64.`, `Tvůj prefix je 2001:db8:${x}::/48. R3 na Gi0/2 posílá ohlášení routeru pro 2001:db8:${x}:3::/64.`),
    steps: [L('Keep Gi0/0 and Gi0/1 on EUI-64.', 'Nech Gi0/0 a Gi0/1 na EUI-64.'), L('On Gi0/2, use ipv6 address autoconfig so the router acts as a SLAAC client.', 'Na Gi0/2 použij ipv6 address autoconfig, aby se router choval jako klient SLAAC.'), L('Bring Gi0/2 up.', 'Zapni Gi0/2.')],
    reqs: EUI_A,
    cmds: EUI_CMDS_A,
  },
  expert: {
    sub: L('As Advanced, and type the EUI-64 address for Gi0/3 (subnet 4) by hand', 'Jako Pokročilý a navíc napiš adresu EUI-64 pro Gi0/3 (podsíť 4) ručně'),
    lead: x => L(`Your prefix is 2001:db8:${x}::/48. R3 on Gi0/2 sends router advertisements for 2001:db8:${x}:3::/64.`, `Tvůj prefix je 2001:db8:${x}::/48. R3 na Gi0/2 posílá ohlášení routeru pro 2001:db8:${x}:3::/64.`),
    steps: [L('Keep the Advanced settings.', 'Nech nastavení z úrovně Pokročilý.'), L('Read the MAC of Gi0/3 with show interfaces gi0/3.', 'Přečti MAC Gi0/3 příkazem show interfaces gi0/3.'),
      L('Flip the 7th bit of the first byte and put FFFE in the middle to get the interface ID.', 'Překlop 7. bit prvního bajtu a doprostřed vlož FFFE, tak dostaneš ID rozhraní.'),
      L('Configure the full address in subnet 4 with /64, without the eui-64 keyword, and bring Gi0/3 up.', 'Nastav celou adresu v podsíti 4 s /64, bez klíčového slova eui-64, a zapni Gi0/3.')],
    reqs: x => [...EUI_A(x), rtReq('gi0/3', L('has the address EUI-64 would build in subnet 4, typed in full', 'má adresu, kterou by EUI-64 sestavilo v podsíti 4, napsanou celou'),
      i => !i.eui && !!i.ip6 && v6Canon(i.ip6) === v6Canon(euiFull(x)), `ipv6 address ${euiFull(x)}`), rtUp('gi0/3')],
    cmds: x => [...EUI_CMDS_A(x), ...onIf('gi0/3', `ipv6 address ${euiFull(x)}`, 'no shutdown')],
  },
};

// 1.0 route summarization: one static route that covers a block of /24s behind R2 (or R3); the steps never give the mask
const sumRoute = (who, nh, first, last, net, mask) => ({
  text: L(`R1 has one summary route via ${nh} that covers ${who}'s LANs ${first} to ${last}, and no more than it must`, `R1 má jednu sumární routu přes ${nh}, která pokrývá LAN za ${who} od ${first} do ${last}, a ne víc, než musí`),
  ok: s => R1(s).routes.some(r => r.net === net && r.mask === mask && r.nh === nh),
  hint: {cmds: [`ip route ${net} ${mask} ${nh}`]},
});
// count /24s from 172.<o2>.<start>.0, summarized by one route with the given mask
const block = (o2, start, count, mask) => ({first: `172.${o2}.${start}.0/24`, last: `172.${o2}.${start + count - 1}.0/24`, net: `172.${o2}.${start}.0`, mask});
const SUM_B = x => block(16, 4 * (x % 64), 4, '255.255.252.0');
const SUM_I = x => block(16, 8 * (x % 32), 8, '255.255.248.0');
const SUM_A = x => block(16, 8 * (x % 32), 6, '255.255.248.0'); // six LANs still need the /21
const SUM_E3 = x => block(17, 16 * (x % 16), 16, '255.255.240.0');
const sumLead = (b, who = 'R2', nh = '10.0.0.2') => L(`${who} (${nh}) has the LANs ${b.first} to ${b.last}.`, `${who} (${nh}) má LAN ${b.first} až ${b.last}.`);
const sumReq = (b, who = 'R2', nh = '10.0.0.2') => sumRoute(who, nh, b.first, b.last, b.net, b.mask);
const sumCmd = (b, nh = '10.0.0.2') => `ip route ${b.net} ${b.mask} ${nh}`;
const SUMMARY = {
  beginner: {
    sub: L('Reach four LANs behind R2 with one summary route', 'Dosáhni na čtyři LAN za R2 jednou sumární routou'),
    lead: x => sumLead(SUM_B(x)) + L(' R1 Gi0/1 is 10.0.0.1/30.', ' R1 Gi0/1 je 10.0.0.1/30.'),
    steps: [L('Address Gi0/1 as 10.0.0.1/30 and bring it up.', 'Adresuj Gi0/1 jako 10.0.0.1/30 a zapni ho.'), L('Write the four networks in binary and find the bits they share.', 'Zapiš čtyři sítě binárně a najdi bity, které mají společné.'),
      L('Add one static route for that summary via 10.0.0.2.', 'Přidej jednu statickou routu pro tuto sumarizaci přes 10.0.0.2.')],
    reqs: x => [...WAN_IF, sumReq(SUM_B(x))],
    cmds: x => [...WAN_CMDS, sumCmd(SUM_B(x))],
  },
  intermediate: {
    sub: L('Reach eight LANs behind R2 with one summary route', 'Dosáhni na osm LAN za R2 jednou sumární routou'),
    lead: x => sumLead(SUM_I(x)) + L(' R1 Gi0/1 is 10.0.0.1/30.', ' R1 Gi0/1 je 10.0.0.1/30.'),
    steps: [L('Address Gi0/1 and bring it up.', 'Adresuj Gi0/1 a zapni ho.'), L('Find the bits the eight networks share.', 'Najdi bity, které mají všech osm sítí společné.'), L('Add one summary route via 10.0.0.2.', 'Přidej jednu sumární routu přes 10.0.0.2.')],
    reqs: x => [...WAN_IF, sumReq(SUM_I(x))],
    cmds: x => [...WAN_CMDS, sumCmd(SUM_I(x))],
  },
  advanced: {
    sub: L('Reach six LANs behind R2 with the smallest summary that covers them', 'Dosáhni na šest LAN za R2 nejmenší sumarizací, která je pokryje'),
    lead: x => sumLead(SUM_A(x)) + L(' R1 Gi0/1 is 10.0.0.1/30.', ' R1 Gi0/1 je 10.0.0.1/30.'),
    steps: [L('Address Gi0/1 and bring it up.', 'Adresuj Gi0/1 a zapni ho.'), L('Six is not a power of two: find the smallest block that holds all six.', 'Šest není mocnina dvou: najdi nejmenší blok, který pojme všech šest.'),
      L('Add one summary route via 10.0.0.2.', 'Přidej jednu sumární routu přes 10.0.0.2.')],
    reqs: x => [...WAN_IF, sumReq(SUM_A(x))],
    cmds: x => [...WAN_CMDS, sumCmd(SUM_A(x))],
  },
  expert: {
    sub: L('Summarize the LANs behind R2 and the sixteen LANs behind R3, one route each', 'Sumarizuj LAN za R2 a šestnáct LAN za R3, každé jednou routou'),
    lead: x => L(`${sumLead(SUM_B(x))} ${sumLead(SUM_E3(x), 'R3', '10.0.1.2')} R1 Gi0/1 is 10.0.0.1/30 and Gi0/2 is 10.0.1.1/30.`, `${sumLead(SUM_B(x))} ${sumLead(SUM_E3(x), 'R3', '10.0.1.2')} R1 Gi0/1 je 10.0.0.1/30 a Gi0/2 je 10.0.1.1/30.`),
    steps: [L('Address Gi0/1 and Gi0/2 and bring them up.', 'Adresuj Gi0/1 a Gi0/2 a zapni je.'), L('Add one summary route for R2\'s LANs via 10.0.0.2.', 'Přidej jednu sumární routu pro LAN za R2 přes 10.0.0.2.'),
      L('Add one summary route for R3\'s LANs via 10.0.1.2.', 'Přidej jednu sumární routu pro LAN za R3 přes 10.0.1.2.')],
    reqs: x => [...WAN_IF, ...R3_IF, sumReq(SUM_B(x)), sumReq(SUM_E3(x), 'R3', '10.0.1.2')],
    cmds: x => [...WAN_CMDS, ...R3_CMDS, sumCmd(SUM_B(x)), sumCmd(SUM_E3(x), '10.0.1.2')],
  },
};

// 2.0 voice VLAN: an IP phone on Fa0/1 (and Fa0/2) with a PC behind it
const swVoice = (p, id) => swReq(p, L(`carries voice VLAN ${id}`, `přenáší hlasový VLAN ${id}`), q => q.voice === id, `switchport voice vlan ${id}`);
const phonePort = p => [swAccess(p, 10), swVoice(p, 150), swUp(p)];
const phoneCmds = p => onIf(p, 'switchport mode access', 'switchport access vlan 10', 'switchport voice vlan 150', 'no shutdown');
const VOICE_LEAD = L('An IP phone is on S1 Fa0/1 with PC1 plugged into the phone. Another phone and PC2 are on Fa0/2.', 'Na S1 Fa0/1 je IP telefon a do telefonu je zapojené PC1. Další telefon a PC2 jsou na Fa0/2.');
const VOICE_I = [swVlan(10, 'DATA'), swVlan(150, 'VOICE'), ...phonePort('fa0/1'), ...phonePort('fa0/2')];
const VOICE_I_CMDS = ['vlan 10', 'name DATA', 'exit', 'vlan 150', 'name VOICE', 'exit', ...phoneCmds('fa0/1'), ...phoneCmds('fa0/2')];
const VOICEVLAN = {
  beginner: {
    sub: L('Put the PC on Fa0/1 in data VLAN 10 and the phone in voice VLAN 150', 'Dej PC na Fa0/1 do datového VLAN 10 a telefon do hlasového VLAN 150'),
    steps: [L('Create VLANs 10 and 150.', 'Vytvoř VLANy 10 a 150.'), L('Make Fa0/1 an access port in VLAN 10.', 'Nastav Fa0/1 jako access port ve VLAN 10.'), L('Add switchport voice vlan 150 on Fa0/1 and bring it up.', 'Přidej na Fa0/1 switchport voice vlan 150 a zapni ho.')],
    reqs: [swVlan(10), swVlan(150), ...phonePort('fa0/1')],
    cmds: ['vlan 10', 'exit', 'vlan 150', 'exit', ...phoneCmds('fa0/1')],
  },
  intermediate: {
    sub: L('Name the VLANs DATA and VOICE, and set up Fa0/2 the same way', 'Pojmenuj VLANy DATA a VOICE a nastav stejně i Fa0/2'),
    steps: [L('Name VLAN 10 DATA and VLAN 150 VOICE.', 'Pojmenuj VLAN 10 DATA a VLAN 150 VOICE.'), L('Give Fa0/1 and Fa0/2 data VLAN 10 and voice VLAN 150.', 'Dej Fa0/1 a Fa0/2 datový VLAN 10 a hlasový VLAN 150.'), L('Bring both ports up.', 'Zapni oba porty.')],
    reqs: VOICE_I,
    cmds: VOICE_I_CMDS,
  },
  advanced: {
    sub: L('As Intermediate, with PortFast on both phone ports', 'Jako Mírně pokročilý, s PortFast na obou portech telefonů'),
    steps: [L('Keep the Intermediate settings.', 'Nech nastavení z úrovně Mírně pokročilý.'), L('Enable PortFast on Fa0/1 and Fa0/2 so the phones come up fast.', 'Zapni PortFast na Fa0/1 a Fa0/2, aby telefony naběhly rychle.')],
    reqs: [...VOICE_I, swPortfast('fa0/1'), swPortfast('fa0/2')],
    cmds: [...VOICE_I_CMDS, ...onIf('fa0/1', 'spanning-tree portfast'), ...onIf('fa0/2', 'spanning-tree portfast')],
  },
  expert: {
    sub: L('As Advanced, and trunk Gi0/1 to R1 carrying only VLANs 10 and 150', 'Jako Pokročilý a navíc udělej z Gi0/1 trunk k R1, který přenáší jen VLANy 10 a 150'),
    steps: [L('Keep the Advanced settings.', 'Nech nastavení z úrovně Pokročilý.'), L('Make Gi0/1 a trunk, allow only VLANs 10 and 150, and bring it up.', 'Nastav Gi0/1 jako trunk, povol jen VLANy 10 a 150 a zapni ho.')],
    reqs: [...VOICE_I, swPortfast('fa0/1'), swPortfast('fa0/2'), swTrunk('gi0/1'), swAllowed('gi0/1', [10, 150]), swUp('gi0/1')],
    cmds: [...VOICE_I_CMDS, ...onIf('fa0/1', 'spanning-tree portfast'), ...onIf('fa0/2', 'spanning-tree portfast'),
      ...onIf('gi0/1', 'switchport mode trunk', 'switchport trunk allowed vlan 10,150', 'no shutdown')],
  },
};

// the S1-S2 diagram of the trunk troubleshooting lab (labs-fix.js)
const SW2_TOPO = {
  nodes: [
    {id: 'S1', type: 'switch', x: 8, y: 40, sub: 'Switch'},
    {id: 'S2', type: 'switch', x: 190, y: 40, sub: 'Switch'},
    {id: 'PC1', type: 'pc', x: 190, y: 120, sub: '192.168.10.1', at: 'S1 fa0/1', ip: '192.168.10.1', mask: MASK24},
    {id: 'PC2', type: 'pc', x: 370, y: 40, sub: '192.168.10.2', at: 'S2 fa0/1', ip: '192.168.10.2', mask: MASK24},
  ],
  links: [{a: 'S1', b: 'S2', port: 'Gi0/1'}, {a: 'S1', b: 'PC1', port: 'Fa0/1'}, {a: 'S2', b: 'PC2', port: 'Fa0/1'}],
  home: 'S1',
};
// 3.0 IPv6 static and default routes on R1; R2 is 2001:db8:acad:1::2 on Gi0/1 and R3 2001:db8:acad:2::2 on Gi0/2
const route6Req = (prefix, iface, nh, dist = 1) => {
  const want = {prefix, iface, nh, dist};
  return {
    text: L(`R1 has an IPv6 route to ${prefix}${iface ? ` out ${iface}` : ''}${nh ? ` via ${nh}` : ''}${dist !== 1 ? ` with distance ${dist}` : ''}`, `R1 má IPv6 routu do ${prefix}${iface ? ` přes rozhraní ${iface}` : ''}${nh ? ` přes ${nh}` : ''}${dist !== 1 ? ` se vzdáleností ${dist}` : ''}`),
    ok: s => R1(s).routes6.some(r => sameRoute6(r, want) && r.dist === dist),
    hint: {cmds: [route6Text(want)]},
  };
};
const R2_V6 = '2001:db8:acad:1::2', R3_V6 = '2001:db8:acad:2::2';
const V6RT_LEAD = x => L(`R2 (${R2_V6}) on Gi0/1 leads to the remote LAN 2001:db8:${x}:100::/64. R3 (${R3_V6}) is on Gi0/2.`, `R2 (${R2_V6}) na Gi0/1 vede do vzdálené LAN 2001:db8:${x}:100::/64. R3 (${R3_V6}) je na Gi0/2.`);
const V6RT_B = x => [V6_ROUTING, ...v6If('gi0/1', '2001:db8:acad:1::1/64'), route6Req(`2001:db8:${x}:100::/64`, null, R2_V6)];
const V6RT_B_CMDS = x => ['ipv6 unicast-routing', ...onIf('gi0/1', 'ipv6 address 2001:db8:acad:1::1/64', 'no shutdown'),
  `ipv6 route 2001:db8:${x}:100::/64 ${R2_V6}`];
const R3_V6_IF = v6If('gi0/2', '2001:db8:acad:2::1/64');
const R3_V6_CMDS = onIf('gi0/2', 'ipv6 address 2001:db8:acad:2::1/64', 'no shutdown');
const IPV6ROUTING = {
  beginner: {
    sub: L('Turn on IPv6 routing and add a static route to the remote LAN via R2', 'Zapni IPv6 routing a přidej statickou routu do vzdálené LAN přes R2'),
    steps: [L('Turn on ipv6 unicast-routing.', 'Zapni ipv6 unicast-routing.'), L('Address Gi0/1 as 2001:db8:acad:1::1/64 and bring it up.', 'Adresuj Gi0/1 jako 2001:db8:acad:1::1/64 a zapni ho.'),
      L('Add a static route for 2001:db8:x:100::/64 via R2.', 'Přidej statickou routu pro 2001:db8:x:100::/64 přes R2.')],
    reqs: V6RT_B,
    cmds: V6RT_B_CMDS,
  },
  intermediate: {
    sub: L('As Beginner, and add an IPv6 default route via R2', 'Jako Začátečník a navíc přidej výchozí IPv6 routu přes R2'),
    steps: [L('Keep the Beginner settings.', 'Nech nastavení z úrovně Začátečník.'), L('Add a default route ::/0 via R2.', 'Přidej výchozí routu ::/0 přes R2.')],
    reqs: x => [...V6RT_B(x), route6Req('::/0', null, R2_V6)],
    cmds: x => [...V6RT_B_CMDS(x), `ipv6 route ::/0 ${R2_V6}`],
  },
  advanced: {
    sub: L('As Intermediate, and add a floating default route via R3 with distance 150', 'Jako Mírně pokročilý a navíc přidej plovoucí výchozí routu přes R3 se vzdáleností 150'),
    steps: [L('Keep the Intermediate settings.', 'Nech nastavení z úrovně Mírně pokročilý.'), L('Address Gi0/2 as 2001:db8:acad:2::1/64 and bring it up.', 'Adresuj Gi0/2 jako 2001:db8:acad:2::1/64 a zapni ho.'),
      L('Add a backup default route via R3 with administrative distance 150.', 'Přidej záložní výchozí routu přes R3 s administrativní vzdáleností 150.')],
    reqs: x => [...V6RT_B(x), route6Req('::/0', null, R2_V6), ...R3_V6_IF, route6Req('::/0', null, R3_V6, 150)],
    cmds: x => [...V6RT_B_CMDS(x), `ipv6 route ::/0 ${R2_V6}`, ...R3_V6_CMDS, `ipv6 route ::/0 ${R3_V6} 150`],
  },
  expert: {
    sub: L('Send the default route out Gi0/1 to R2\'s link-local fe80::2, with R3 as a floating backup', 'Pošli výchozí routu přes Gi0/1 na link-local adresu R2 fe80::2, s R3 jako plovoucí zálohou'),
    steps: [L('Keep the Beginner settings and address Gi0/2.', 'Nech nastavení z úrovně Začátečník a adresuj Gi0/2.'), L('A link-local next hop needs the exit interface: add ::/0 out Gi0/1 via fe80::2.', 'Další skok link-local potřebuje výstupní rozhraní: přidej ::/0 přes Gi0/1 na fe80::2.'),
      L('Add the backup default route via R3 with distance 150.', 'Přidej záložní výchozí routu přes R3 se vzdáleností 150.')],
    reqs: x => [...V6RT_B(x), route6Req('::/0', 'Gi0/1', 'fe80::2'), ...R3_V6_IF, route6Req('::/0', null, R3_V6, 150)],
    cmds: x => [...V6RT_B_CMDS(x), 'ipv6 route ::/0 gi0/1 fe80::2', ...R3_V6_CMDS, `ipv6 route ::/0 ${R3_V6} 150`],
  },
};

// 3.0 multi-area OSPF and tuning on R1 (process 1)
const OSPFADV_LEAD = x => L(`R1 Gi0/0 serves 192.168.${x}.0/24 in area 1. R2 on Gi0/1 is in the backbone (area 0).`, `R1 Gi0/0 obsluhuje 192.168.${x}.0/24 v oblasti 1. R2 na Gi0/1 je v páteři (oblast 0).`);
const OSPFADV_B = x => [...BOTH_IFS(x), ospfIn('gi0/0', 1, `network 192.168.${x}.0 0.0.0.255 area 1`),
  ospfIn('gi0/1', 0, 'network 10.0.0.0 0.0.0.3 area 0')];
const OSPFADV_B_CMDS = x => [...BOTH_CMDS(x), 'router ospf 1', `network 192.168.${x}.0 0.0.0.255 area 1`, 'network 10.0.0.0 0.0.0.3 area 0', 'exit'];
const OSPFADV_I = x => [...OSPFADV_B(x), rtReq('gi0/0', L('has OSPF priority 255 so R1 wins the DR election', 'má prioritu OSPF 255, takže R1 vyhraje volbu DR'), i => i.ospfPrio === 255, 'ip ospf priority 255'),
  rtReq('gi0/1', L('has OSPF priority 0 so R1 never becomes DR there', 'má prioritu OSPF 0, takže R1 tam nikdy nebude DR'), i => i.ospfPrio === 0, 'ip ospf priority 0')];
const OSPFADV_I_CMDS = x => [...OSPFADV_B_CMDS(x), ...onIf('gi0/0', 'ip ospf priority 255'), ...onIf('gi0/1', 'ip ospf priority 0')];
const OSPF_REFBW = {text: L('OSPF uses a reference bandwidth of 10000 Mbit/s', 'OSPF používá referenční šířku pásma 10000 Mbit/s'), ok: s => R1(s).ospf.refBw === 10000,
  hint: {cmds: ['router ospf 1', 'auto-cost reference-bandwidth 10000']}};
const OSPFADV_A = x => [...OSPFADV_I(x), OSPF_REFBW, ...R3_IF, ospfIn('gi0/2', 0, 'network 10.0.1.0 0.0.0.3 area 0'),
  rtReq('gi0/2', L('has OSPF cost 50', 'má cenu OSPF 50'), i => i.ospfCost === 50, 'ip ospf cost 50')];
const OSPFADV_A_CMDS = x => [...OSPFADV_I_CMDS(x), ...R3_CMDS, ...onIf('gi0/2', 'ip ospf cost 50'),
  'router ospf 1', 'auto-cost reference-bandwidth 10000', 'network 10.0.1.0 0.0.0.3 area 0', 'exit'];
const p2p = k => rtReq(k, L('is an OSPF point-to-point network (no DR election)', 'je síť OSPF point-to-point (bez volby DR)'), i => i.ospfP2p, 'ip ospf network point-to-point');
const OSPFADV = {
  beginner: {
    sub: L('Make R1 an ABR: Gi0/0 in area 1 and Gi0/1 in area 0', 'Udělej z R1 ABR: Gi0/0 v oblasti 1 a Gi0/1 v oblasti 0'),
    lead: OSPFADV_LEAD,
    steps: [L('Address Gi0/0 and Gi0/1 and bring them up.', 'Adresuj Gi0/0 a Gi0/1 a zapni je.'), L('Start router ospf 1.', 'Spusť router ospf 1.'), L('Put the LAN in area 1 and the link to R2 in area 0.', 'Dej LAN do oblasti 1 a linku k R2 do oblasti 0.')],
    reqs: OSPFADV_B,
    cmds: OSPFADV_B_CMDS,
  },
  intermediate: {
    sub: L('As Beginner, and control the DR election with OSPF priority', 'Jako Začátečník a navíc řiď volbu DR prioritou OSPF'),
    lead: OSPFADV_LEAD,
    steps: [L('Keep the Beginner settings.', 'Nech nastavení z úrovně Začátečník.'), L('Give Gi0/0 priority 255 so R1 is DR on the LAN.', 'Dej Gi0/0 prioritu 255, aby R1 byl v LAN DR.'), L('Give Gi0/1 priority 0 so R1 is never DR there.', 'Dej Gi0/1 prioritu 0, aby tam R1 nikdy nebyl DR.')],
    reqs: OSPFADV_I,
    cmds: OSPFADV_I_CMDS,
  },
  advanced: {
    sub: L('As Intermediate, set the reference bandwidth to 10 Gbit/s and add R3 with cost 50', 'Jako Mírně pokročilý, nastav referenční šířku pásma na 10 Gbit/s a přidej R3 s cenou 50'),
    lead: x => L(`${OSPFADV_LEAD(x)} R3 on Gi0/2 is also in area 0.`, `${OSPFADV_LEAD(x)} R3 na Gi0/2 je také v oblasti 0.`),
    steps: [L('Keep the Intermediate settings.', 'Nech nastavení z úrovně Mírně pokročilý.'), L('Set auto-cost reference-bandwidth 10000 so 1 and 10 Gbit/s links get different costs.', 'Nastav auto-cost reference-bandwidth 10000, aby linky 1 a 10 Gbit/s měly různé ceny.'),
      L('Address Gi0/2 as 10.0.1.1/30, put it in area 0 and give it ip ospf cost 50.', 'Adresuj Gi0/2 jako 10.0.1.1/30, dej ho do oblasti 0 a nastav mu ip ospf cost 50.')],
    reqs: OSPFADV_A,
    cmds: OSPFADV_A_CMDS,
  },
  expert: {
    sub: L('As Advanced, make both WAN links point-to-point and advertise a default route via R2', 'Jako Pokročilý, nastav obě WAN linky jako point-to-point a ohlas výchozí routu přes R2'),
    lead: x => L(`${OSPFADV_LEAD(x)} R3 on Gi0/2 is also in area 0. R2 is the way to the internet.`, `${OSPFADV_LEAD(x)} R3 na Gi0/2 je také v oblasti 0. R2 je cesta do internetu.`),
    steps: [L('Keep the Advanced settings.', 'Nech nastavení z úrovně Pokročilý.'), L('Set ip ospf network point-to-point on Gi0/1 and Gi0/2.', 'Nastav ip ospf network point-to-point na Gi0/1 a Gi0/2.'),
      L('Add a static default route via 10.0.0.2 and default-information originate under OSPF.', 'Přidej statickou výchozí routu přes 10.0.0.2 a pod OSPF default-information originate.')],
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
    {id: 'PC1', type: 'pc', x: 370, y: 64, sub: L('Host', 'Hostitel'), at: 'S1 fa0/1'},
  ],
  links: [{a: 'R1', b: 'S1', port: 'Gi0/0'}, {a: 'R2', b: 'S1', port: 'Gi0/0'}, {a: 'S1', b: 'PC1', port: 'Fa0/1'}],
  home: 'R1',
};
const HSRP_LEAD = x => L(`R1 and R2 both sit on 192.168.${x}.0/24 through S1. PC1 needs a gateway that keeps working when one router fails.`, `R1 i R2 jsou v 192.168.${x}.0/24 přes S1. PC1 potřebuje bránu, která funguje, i když jeden router selže.`);
const hsrpBase = (dev, x, host, grp) => [
  devReq(dev, 'gi0/0', L(`is 192.168.${x}.${host} ${MASK24}`, `je 192.168.${x}.${host} ${MASK24}`), i => i.ip === `192.168.${x}.${host}` && i.mask === MASK24, `ip address 192.168.${x}.${host} ${MASK24}`),
  devReq(dev, 'gi0/0', L('is up', 'je zapnuté'), i => !i.shut, 'no shutdown'),
  devReq(dev, 'gi0/0', L(`is in HSRP group ${grp} with virtual IP 192.168.${x}.1`, `je v HSRP skupině ${grp} s virtuální IP 192.168.${x}.1`), i => i.hsrp?.grp === grp && i.hsrp.vip === `192.168.${x}.1`,
    `standby ${grp} ip 192.168.${x}.1`),
];
const hsrpCmds = (x, host, grp, ...more) => onIf('gi0/0', `ip address 192.168.${x}.${host} ${MASK24}`, `standby ${grp} ip 192.168.${x}.1`, ...more, 'no shutdown');
const hsrpActive = grp => [
  devReq('R1', 'gi0/0', L('has HSRP priority 110', 'má prioritu HSRP 110'), i => i.hsrp?.grp === grp && i.hsrp.prio === 110, `standby ${grp} priority 110`),
  devReq('R1', 'gi0/0', L('takes the active role back (preempt)', 'převezme aktivní roli zpět (preempt)'), i => i.hsrp?.grp === grp && i.hsrp.preempt, `standby ${grp} preempt`),
];
const hsrpV2 = dev => devReq(dev, 'gi0/0', L('runs HSRP version 2', 'používá HSRP verze 2'), i => i.hsrpVer === 2, 'standby version 2');
const HSRP = {
  beginner: {
    sub: L('Address R1 Gi0/0 as .2 and make it offer the virtual gateway .1 in HSRP group 1', 'Adresuj R1 Gi0/0 jako .2 a nech ho nabízet virtuální bránu .1 v HSRP skupině 1'),
    steps: [L('On R1, address Gi0/0 as 192.168.x.2/24 and bring it up.', 'Na R1 adresuj Gi0/0 jako 192.168.x.2/24 a zapni ho.'), L('Add standby 1 ip 192.168.x.1.', 'Přidej standby 1 ip 192.168.x.1.')],
    reqs: x => hsrpBase('R1', x, 2, 1),
    cmds: x => hsrpCmds(x, 2, 1),
  },
  intermediate: {
    sub: L('As Beginner, and add R2 (.3) to the same HSRP group', 'Jako Začátečník a navíc přidej R2 (.3) do stejné HSRP skupiny'),
    steps: [L('Keep R1 as in Beginner.', 'Nech R1 jako v úrovni Začátečník.'), L('Open R2: address Gi0/0 as 192.168.x.3/24, bring it up and add standby 1 ip 192.168.x.1.', 'Otevři R2: adresuj Gi0/0 jako 192.168.x.3/24, zapni ho a přidej standby 1 ip 192.168.x.1.')],
    reqs: x => [...hsrpBase('R1', x, 2, 1), ...hsrpBase('R2', x, 3, 1)],
    cmds: x => hsrpCmds(x, 2, 1),
    then: x => [onDev('R2', ...hsrpCmds(x, 3, 1))],
  },
  advanced: {
    sub: L('As Intermediate, and make R1 the active router with priority 110 and preempt', 'Jako Mírně pokročilý a navíc udělej z R1 aktivní router s prioritou 110 a preempt'),
    steps: [L('Keep both routers in group 1.', 'Nech oba routery ve skupině 1.'), L('On R1, set standby 1 priority 110 and standby 1 preempt.', 'Na R1 nastav standby 1 priority 110 a standby 1 preempt.'), L('Check with show standby brief.', 'Zkontroluj to příkazem show standby brief.')],
    reqs: x => [...hsrpBase('R1', x, 2, 1), ...hsrpBase('R2', x, 3, 1), ...hsrpActive(1)],
    cmds: x => hsrpCmds(x, 2, 1, 'standby 1 priority 110', 'standby 1 preempt'),
    then: x => [onDev('R2', ...hsrpCmds(x, 3, 1))],
  },
  expert: {
    sub: L('Use HSRP version 2 and group 10 on both routers, R1 active, and point PC1 at the virtual gateway', 'Použij HSRP verze 2 a skupinu 10 na obou routerech, R1 aktivní, a nasměruj PC1 na virtuální bránu'),
    steps: [L('On both routers, set standby version 2 first, then use group 10 for the virtual IP .1.', 'Na obou routerech nejdřív nastav standby version 2, pak pro virtuální IP .1 použij skupinu 10.'),
      L('On R1, give group 10 priority 110 and preempt.', 'Na R1 dej skupině 10 prioritu 110 a preempt.'), L('On PC1, set 192.168.x.10/24 with gateway 192.168.x.1.', 'Na PC1 nastav 192.168.x.10/24 s bránou 192.168.x.1.')],
    reqs: x => [...hsrpBase('R1', x, 2, 10), ...hsrpBase('R2', x, 3, 10), hsrpV2('R1'), hsrpV2('R2'), ...hsrpActive(10),
      pcStatic('PC1', `192.168.${x}.10`, `192.168.${x}.1`)],
    cmds: x => [...onIf('gi0/0', 'standby version 2'), ...hsrpCmds(x, 2, 10, 'standby 10 priority 110', 'standby 10 preempt')],
    then: x => [onDev('R2', ...onIf('gi0/0', 'standby version 2'), ...hsrpCmds(x, 3, 10)), ['PC1', [`ip 192.168.${x}.10 ${MASK24} 192.168.${x}.1`]]],
  },
};

// 4.0 SSH on R1
const SSH_DOMAIN = {text: L('The domain name is lab.local', 'Doménové jméno je lab.local'), ok: s => R1(s).sec.domain === 'lab.local', hint: {cmds: ['ip domain-name lab.local']}};
const SSH_RSA = {text: L('R1 has an RSA key of at least 2048 bits', 'R1 má klíč RSA aspoň 2048 bitů'), ok: s => R1(s).sec.rsa >= 2048, hint: {cmds: ['crypto key generate rsa modulus 2048']}};
const userAdmin = {text: L('A local user admin exists', 'Místní uživatel admin existuje'), ok: s => !!R1(s).users.admin, hint: {cmds: ['username admin secret <word>']}};
const SSH_B = [SSH_DOMAIN, SSH_RSA, userAdmin];
const SSH_I = [...SSH_B, lineCheck('vty', L('VTY lines accept SSH only', 'Linky VTY přijímají jen SSH'), l => l.transport === 'ssh', 'transport input ssh'),
  lineCheck('vty', L('VTY lines log in with the local user database', 'Linky VTY přihlašují přes místní databázi uživatelů'), l => l.local, 'login local')];
const SSH_V2 = {text: L('Only SSH version 2 is allowed', 'Povolené je jen SSH verze 2'), ok: s => R1(s).sec.sshVer === 2, hint: {cmds: ['ip ssh version 2']}};
const SSH_A = [...SSH_I, SSH_V2, lineCheck('vty', L('Idle VTY sessions end after 10 minutes', 'Nečinné relace VTY skončí po 10 minutách'), l => l.timeout === '10 0', 'exec-timeout 10 0')];
const SSH_B_CMDS = ['ip domain-name lab.local', 'crypto key generate rsa modulus 2048', 'username admin secret Cisco123'];
const SSH_I_CMDS = [...SSH_B_CMDS, 'line vty 0 4', 'transport input ssh', 'login local', 'exit'];
const SSH_A_CMDS = [...SSH_I_CMDS, 'ip ssh version 2', 'line vty 0 4', 'exec-timeout 10 0', 'exit'];
const SSH_LEAD = L('R1 is reachable over the network, but only by Telnet. Its hostname is already set.', 'R1 je dosažitelný po síti, ale jen přes Telnet. Hostname už má nastavený.');
const SSH = {
  beginner: {
    sub: L('Prepare R1 for SSH: domain name, RSA key and a local user', 'Připrav R1 na SSH: doménové jméno, klíč RSA a místní uživatel'),
    steps: [L('Set ip domain-name lab.local (the key is named after hostname and domain).', 'Nastav ip domain-name lab.local (klíč se jmenuje podle hostname a domény).'), L('Generate a 2048-bit RSA key.', 'Vygeneruj klíč RSA o 2048 bitech.'),
      L('Create the local user admin with a secret.', 'Vytvoř místního uživatele admin se secret.')],
    reqs: SSH_B,
    cmds: SSH_B_CMDS,
  },
  intermediate: {
    sub: L('As Beginner, and allow only SSH on the VTY lines with local login', 'Jako Začátečník a navíc povol na linkách VTY jen SSH s místním přihlášením'),
    steps: [L('Keep the Beginner settings.', 'Nech nastavení z úrovně Začátečník.'), L('Under line vty 0 4, set transport input ssh.', 'Pod line vty 0 4 nastav transport input ssh.'), L('Use login local so users log in as admin.', 'Použij login local, aby se uživatelé přihlašovali jako admin.')],
    reqs: SSH_I,
    cmds: SSH_I_CMDS,
  },
  advanced: {
    sub: L('As Intermediate, force SSH version 2 and time out idle sessions after 10 minutes', 'Jako Mírně pokročilý, vynuť SSH verze 2 a ukončuj nečinné relace po 10 minutách'),
    steps: [L('Keep the Intermediate settings.', 'Nech nastavení z úrovně Mírně pokročilý.'), L('Set ip ssh version 2.', 'Nastav ip ssh version 2.'), L('Under line vty 0 4, set exec-timeout 10 0.', 'Pod line vty 0 4 nastav exec-timeout 10 0.')],
    reqs: SSH_A,
    cmds: SSH_A_CMDS,
  },
  expert: {
    sub: L('As Advanced, and let only the 192.168.x.0/24 LAN open SSH sessions', 'Jako Pokročilý a navíc dovol otevírat relace SSH jen z LAN 192.168.x.0/24'),
    steps: [L('Keep the Advanced settings.', 'Nech nastavení z úrovně Pokročilý.'), L('Create standard ACL 10 that permits 192.168.x.0 0.0.0.255.', 'Vytvoř standardní ACL 10, které povolí 192.168.x.0 0.0.0.255.'),
      L('Apply it to the VTY lines with access-class 10 in.', 'Použij ho na linkách VTY příkazem access-class 10 in.')],
    reqs: x => [...SSH_A, aclEntries('10', 'standard', [`permit 192.168.${x}.0 0.0.0.255`]),
      lineCheck('vty', L('VTY lines filter sessions with ACL 10', 'Linky VTY filtrují relace pomocí ACL 10'), l => l.acIn === '10', 'access-class 10 in')],
    cmds: x => [...SSH_A_CMDS, `access-list 10 permit 192.168.${x}.0 0.0.0.255`, 'line vty 0 4', 'access-class 10 in', 'exit'],
  },
};

// 5.0 AAA with local authentication on R1
const AAA_ON = {text: L('AAA is enabled', 'AAA je zapnuté'), ok: s => R1(s).aaa.on, hint: {cmds: ['aaa new-model']}};
const aaaList = (name, methods) => ({text: L(`Login list ${name} uses ${methods}`, `Přihlašovací seznam ${name} používá ${methods}`), ok: s => R1(s).aaa.lists[name] === methods,
  hint: {cmds: [`aaa authentication login ${name} ${methods}`]}});
const AAA_B = [AAA_ON, userAdmin, aaaList('default', 'local')];
const AAA_I = [...AAA_B, aaaList('VTY-AUTH', 'local')];
const AAA_A = [...AAA_I, lineCheck('vty', L('VTY lines use the login list VTY-AUTH', 'Linky VTY používají přihlašovací seznam VTY-AUTH'), l => l.authList === 'VTY-AUTH', 'login authentication VTY-AUTH')];
const AAA_B_CMDS = ['username admin secret Cisco123', 'aaa new-model', 'aaa authentication login default local'];
const AAA_I_CMDS = [...AAA_B_CMDS, 'aaa authentication login VTY-AUTH local'];
const AAA_A_CMDS = [...AAA_I_CMDS, 'line vty 0 4', 'login authentication VTY-AUTH', 'exit'];
const AAA_LEAD = L('R1 still uses line passwords. Move its logins to AAA with the local user database.', 'R1 pořád používá hesla linek. Převeď jeho přihlašování na AAA s místní databází uživatelů.');
const AAA = {
  beginner: {
    sub: L('Turn on AAA and make the default login list use local users', 'Zapni AAA a nech výchozí přihlašovací seznam používat místní uživatele'),
    steps: [L('Create the local user admin with a secret first, so you do not lock yourself out.', 'Nejdřív vytvoř místního uživatele admin se secret, ať se nezamkneš.'), L('Turn on aaa new-model.', 'Zapni aaa new-model.'),
      L('Add aaa authentication login default local.', 'Přidej aaa authentication login default local.')],
    reqs: AAA_B,
    cmds: AAA_B_CMDS,
  },
  intermediate: {
    sub: L('As Beginner, and add a named login list VTY-AUTH that uses local users', 'Jako Začátečník a navíc přidej pojmenovaný přihlašovací seznam VTY-AUTH s místními uživateli'),
    steps: [L('Keep the Beginner settings.', 'Nech nastavení z úrovně Začátečník.'), L('Add aaa authentication login VTY-AUTH local.', 'Přidej aaa authentication login VTY-AUTH local.')],
    reqs: AAA_I,
    cmds: AAA_I_CMDS,
  },
  advanced: {
    sub: L('As Intermediate, and apply VTY-AUTH to the VTY lines', 'Jako Mírně pokročilý a navíc použij VTY-AUTH na linkách VTY'),
    steps: [L('Keep the Intermediate settings.', 'Nech nastavení z úrovně Mírně pokročilý.'), L('Under line vty 0 4, set login authentication VTY-AUTH.', 'Pod line vty 0 4 nastav login authentication VTY-AUTH.')],
    reqs: AAA_A,
    cmds: AAA_A_CMDS,
  },
  expert: {
    sub: L('As Advanced, protect privileged mode and point the console at the default list', 'Jako Pokročilý, chraň privilegovaný režim a nasměruj konzoli na výchozí seznam'),
    steps: [L('Keep the Advanced settings.', 'Nech nastavení z úrovně Pokročilý.'), L('Set an enable secret.', 'Nastav enable secret.'), L('Under line console 0, set login authentication default.', 'Pod line console 0 nastav login authentication default.')],
    reqs: [...AAA_A, HARDEN_BASE[1], lineCheck('console', L('The console uses the default login list', 'Konzole používá výchozí přihlašovací seznam'), l => l.authList === 'default', 'login authentication default')],
    cmds: [...AAA_A_CMDS, 'enable secret class', 'line console 0', 'login authentication default', 'exit'],
  },
};

// 5.0 DHCP snooping and dynamic ARP inspection on S1; R1 behind Gi0/1 is the only real DHCP server
const SNOOP_ON = {text: L('DHCP snooping is on', 'DHCP snooping je zapnutý'), ok: s => SW(s).snoop.on, hint: {cmds: ['ip dhcp snooping']}};
const snoopVlan = id => ({text: L(`DHCP snooping covers VLAN ${id}`, `DHCP snooping pokrývá VLAN ${id}`), ok: s => SW(s).snoop.vlans.includes(id), hint: {cmds: [`ip dhcp snooping vlan ${id}`]}});
const SNOOP_TRUST = swReq('gi0/1', L('is trusted for DHCP snooping', 'je trusted pro DHCP snooping'), q => q.trust, 'ip dhcp snooping trust');
const SNOOP_NO82 = {text: L('S1 does not insert option 82', 'S1 nevkládá volbu 82'), ok: s => !SW(s).snoop.opt82, hint: {cmds: ['no ip dhcp snooping information option']}};
const snoopRate = p => swReq(p, L('limits DHCP to 10 packets per second', 'omezuje DHCP na 10 paketů za sekundu'), q => q.rate === 10, 'ip dhcp snooping limit rate 10');
const SNOOP_LEAD = L('R1 behind S1 Gi0/1 is the only real DHCP server. PC1 and PC2 are on Fa0/1 and Fa0/2.', 'R1 za S1 Gi0/1 je jediný skutečný DHCP server. PC1 a PC2 jsou na Fa0/1 a Fa0/2.');
const snoopCmds = vlan => ['ip dhcp snooping', `ip dhcp snooping vlan ${vlan}`, ...onIf('gi0/1', 'ip dhcp snooping trust')];
const rateCmds = ['fa0/1', 'fa0/2'].flatMap(p => onIf(p, 'ip dhcp snooping limit rate 10'));
const VLAN10_PCS = [swVlan(10), swAccess('fa0/1', 10), swAccess('fa0/2', 10)];
const VLAN10_CMDS = ['vlan 10', 'exit', ...['fa0/1', 'fa0/2'].flatMap(p => onIf(p, 'switchport mode access', 'switchport access vlan 10'))];
const DHCPSNOOP = {
  beginner: {
    sub: L('Turn on DHCP snooping for VLAN 1 and trust the port to R1', 'Zapni DHCP snooping pro VLAN 1 a nastav port k R1 jako trusted'),
    steps: [L('Turn on ip dhcp snooping.', 'Zapni ip dhcp snooping.'), L('Turn it on for VLAN 1.', 'Zapni ho pro VLAN 1.'), L('Trust Gi0/1, where the real server is.', 'Nastav jako trusted Gi0/1, kde je skutečný server.')],
    reqs: [SNOOP_ON, snoopVlan(1), SNOOP_TRUST],
    cmds: snoopCmds(1),
  },
  intermediate: {
    sub: L('As Beginner, and stop S1 inserting option 82', 'Jako Začátečník a navíc zakaž S1 vkládat volbu 82'),
    steps: [L('Keep the Beginner settings.', 'Nech nastavení z úrovně Začátečník.'), L('Turn off option 82 insertion, which R1 would otherwise reject.', 'Vypni vkládání volby 82, kterou by R1 jinak odmítl.')],
    reqs: [SNOOP_ON, snoopVlan(1), SNOOP_TRUST, SNOOP_NO82],
    cmds: [...snoopCmds(1), 'no ip dhcp snooping information option'],
  },
  advanced: {
    sub: L('As Intermediate, and rate-limit DHCP on the PC ports to stop starvation attacks', 'Jako Mírně pokročilý a navíc omez DHCP na portech PC proti útokům vyčerpáním'),
    steps: [L('Keep the Intermediate settings.', 'Nech nastavení z úrovně Mírně pokročilý.'), L('Limit DHCP on Fa0/1 and Fa0/2 to 10 packets per second.', 'Omez DHCP na Fa0/1 a Fa0/2 na 10 paketů za sekundu.')],
    reqs: [SNOOP_ON, snoopVlan(1), SNOOP_TRUST, SNOOP_NO82, snoopRate('fa0/1'), snoopRate('fa0/2')],
    cmds: [...snoopCmds(1), 'no ip dhcp snooping information option', ...rateCmds],
  },
  expert: {
    sub: L('Move the PCs to VLAN 10 and protect that VLAN with the Advanced settings', 'Přesuň PC do VLAN 10 a chraň ten VLAN nastavením z úrovně Pokročilý'),
    steps: [L('Create VLAN 10 and make Fa0/1 and Fa0/2 access ports in it.', 'Vytvoř VLAN 10 a nastav v něm Fa0/1 a Fa0/2 jako access porty.'), L('Turn on snooping for VLAN 10, trust Gi0/1 and turn off option 82.', 'Zapni snooping pro VLAN 10, nastav Gi0/1 jako trusted a vypni volbu 82.'),
      L('Rate-limit DHCP on Fa0/1 and Fa0/2 to 10 packets per second.', 'Omez DHCP na Fa0/1 a Fa0/2 na 10 paketů za sekundu.')],
    reqs: [...VLAN10_PCS, SNOOP_ON, snoopVlan(10), SNOOP_TRUST, SNOOP_NO82, snoopRate('fa0/1'), snoopRate('fa0/2')],
    cmds: [...VLAN10_CMDS, ...snoopCmds(10), 'no ip dhcp snooping information option', ...rateCmds],
  },
};

const daiVlan = id => ({text: L(`ARP inspection covers VLAN ${id}`, `ARP inspection pokrývá VLAN ${id}`), ok: s => SW(s).dai.vlans.includes(id), hint: {cmds: [`ip arp inspection vlan ${id}`]}});
const DAI_TRUST = swReq('gi0/1', L('is trusted for ARP inspection', 'je trusted pro ARP inspection'), q => q.daiTrust, 'ip arp inspection trust');
const daiChecks = (list, text) => ({text, ok: s => list.every(v => SW(s).dai.validate.includes(v)), hint: {cmds: [`ip arp inspection validate ${list.join(' ')}`]}});
const DAI_SRC = daiChecks(['src-mac'], L('ARP inspection checks the source MAC', 'ARP inspection kontroluje zdrojovou MAC'));
const DAI_ALL = daiChecks(['src-mac', 'dst-mac', 'ip'], L('ARP inspection checks source MAC, destination MAC and IP addresses', 'ARP inspection kontroluje zdrojovou MAC, cílovou MAC i IP adresy'));
const daiBase = vlan => [SNOOP_ON, snoopVlan(vlan), SNOOP_TRUST, daiVlan(vlan), DAI_TRUST];
const daiCmds = vlan => [...snoopCmds(vlan), `ip arp inspection vlan ${vlan}`, ...onIf('gi0/1', 'ip arp inspection trust')];
const DAI_LEAD = L('R1 behind S1 Gi0/1 is the gateway and DHCP server. PC1 and PC2 on Fa0/1 and Fa0/2 get their addresses by DHCP.', 'R1 za S1 Gi0/1 je brána a DHCP server. PC1 a PC2 na Fa0/1 a Fa0/2 dostávají adresy přes DHCP.');
const DAI = {
  beginner: {
    sub: L('Turn on DHCP snooping, then ARP inspection for VLAN 1, trusting the port to R1', 'Zapni DHCP snooping a pak ARP inspection pro VLAN 1, s portem k R1 jako trusted'),
    steps: [L('DAI checks ARP against the snooping table: turn on DHCP snooping for VLAN 1 and trust Gi0/1.', 'DAI kontroluje ARP podle tabulky snoopingu: zapni DHCP snooping pro VLAN 1 a nastav Gi0/1 jako trusted.'),
      L('Turn on ip arp inspection vlan 1.', 'Zapni ip arp inspection vlan 1.'), L('Trust Gi0/1 for ARP inspection too.', 'Nastav Gi0/1 jako trusted i pro ARP inspection.')],
    reqs: daiBase(1),
    cmds: daiCmds(1),
  },
  intermediate: {
    sub: L('As Beginner, and also check the source MAC of ARP packets', 'Jako Začátečník a navíc kontroluj zdrojovou MAC paketů ARP'),
    steps: [L('Keep the Beginner settings.', 'Nech nastavení z úrovně Začátečník.'), L('Add ip arp inspection validate src-mac.', 'Přidej ip arp inspection validate src-mac.')],
    reqs: [...daiBase(1), DAI_SRC],
    cmds: [...daiCmds(1), 'ip arp inspection validate src-mac'],
  },
  advanced: {
    sub: L('As Beginner, and check source MAC, destination MAC and IP together', 'Jako Začátečník a navíc kontroluj zdrojovou MAC, cílovou MAC i IP najednou'),
    steps: [L('Keep the Beginner settings.', 'Nech nastavení z úrovně Začátečník.'), L('Each validate line replaces the last one, so list all three checks in one command.', 'Každý řádek validate nahradí předchozí, takže uveď všechny tři kontroly v jednom příkazu.')],
    reqs: [...daiBase(1), DAI_ALL],
    cmds: [...daiCmds(1), 'ip arp inspection validate src-mac dst-mac ip'],
  },
  expert: {
    sub: L('Move the PCs to VLAN 10 and protect it with snooping and full ARP inspection', 'Přesuň PC do VLAN 10 a chraň ho snoopingem a úplnou ARP inspection'),
    steps: [L('Create VLAN 10 and make Fa0/1 and Fa0/2 access ports in it.', 'Vytvoř VLAN 10 a nastav v něm Fa0/1 a Fa0/2 jako access porty.'), L('Turn on snooping and ARP inspection for VLAN 10, trusting Gi0/1 for both.', 'Zapni snooping i ARP inspection pro VLAN 10, s Gi0/1 jako trusted pro obojí.'),
      L('Validate source MAC, destination MAC and IP.', 'Kontroluj zdrojovou MAC, cílovou MAC a IP.')],
    reqs: [...VLAN10_PCS, ...daiBase(10), DAI_ALL],
    cmds: [...VLAN10_CMDS, ...daiCmds(10), 'ip arp inspection validate src-mac dst-mac ip'],
  },
};

// The lab build for each topic with labs, keyed by its id in CATALOGUE (js/topics.js).
// showNet and maskRule only matter for the IPv4 addressing topics.
const NET_LEAD = x => L(`Your network is 192.168.${x}.0/24. R1 has no addressing yet.`, `Tvoje síť je 192.168.${x}.0/24. R1 zatím nemá žádné adresy.`);
const LABS = {
  ipv4: {kind: 'v4', showNet: true, maskRule: L('the correct mask', 'se správnou maskou'), lead: NET_LEAD, levels: IPV4},
  subnetting: {kind: 'v4', maskRule: L('the correct mask', 'se správnou maskou'), lead: NET_LEAD, levels: SUBNET},
  vlsm: {kind: 'v4', maskRule: L('the smallest mask that fits its hosts', 's nejmenší maskou, do které se vejdou jeho hostitelé'),
    lead: x => L(`Your network is 192.168.${x}.0/24. Each LAN has a host requirement.`, `Tvoje síť je 192.168.${x}.0/24. Každá LAN má požadavek na počet hostitelů.`), levels: VLSM},
  ipv6: {kind: 'v6', lead: x => L(`Your prefix is 2001:db8:${x}::/48. R1 has no IPv6 addressing yet.`, `Tvůj prefix je 2001:db8:${x}::/48. R1 zatím nemá žádné IPv6 adresy.`), levels: IPV6},
  cdp: {kind: 'cdp', levels: CDP},
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
  legacyrouting: {kind: 'rt', levels: RIP1},
  eigrp: {kind: 'rt', levels: EIGRP},
  harden: {kind: 'rt', lead: L('R1 is a fresh router with no security configured.', 'R1 je nový router bez nastaveného zabezpečení.'), levels: HARDEN},
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
  const ifs = atNet(cfg.ifs, x).map(r => ({...r, name: portName(r.k), ip: v6 ? `2001:db8:${x}:${r.sub}::1/64` : `192.168.${x}.${r.host}`}));
  const reqs = [], cmds = [], steps = [];
  for (const r of ifs) {
    reqs.push(v6
      ? {text: L(`${r.name} gets an address ::1 in subnet ${r.sub} of 2001:db8:${x}::/48, with a /64 prefix`, `${r.name} dostane adresu ::1 v podsíti ${r.sub} sítě 2001:db8:${x}::/48 s prefixem /64`), ok: s => R1(s).ifs[r.k].ip6 === r.ip,
        hint: {cmds: [`ipv6 address ${r.ip}`], port: r.name}}
      : {text: L(`${r.name} gets the ${r.rule} usable address in ${r.lan}${T.showNet ? ` (192.168.${x}.${r.net})` : ''}, with ${T.maskRule}`, `${r.name} dostane ${r.rule === 'first' ? 'první' : 'poslední'} použitelnou adresu v ${r.lan}${T.showNet ? ` (192.168.${x}.${r.net})` : ''} ${T.maskRule}`),
        ok: s => R1(s).ifs[r.k].ip === r.ip && R1(s).ifs[r.k].mask === r.mask, hint: {cmds: [`ip address ${r.ip} ${r.mask}`], port: r.name}});
    if (r.ll) reqs.push(linkLocal(r.k));
    cmds.push(`int ${r.k}`, v6 ? `ipv6 address ${r.ip}` : `ip address ${r.ip} ${r.mask}`);
    if (r.ll) cmds.push('ipv6 address fe80::1 link-local');
    cmds.push('no shutdown', 'exit');
    steps.push(v6 ? L(`${r.name} serves subnet ${r.sub}; use ::1 as its address`, `${r.name} obsluhuje podsíť ${r.sub}; použij ::1 jako jeho adresu`)
      : L(`${r.name} serves ${r.lan}${r.need ? ` (${r.need} hosts)` : ''}${T.showNet ? ` at 192.168.${x}.${r.net}` : ''}; use the ${r.rule} usable address as the gateway`, `${r.name} obsluhuje ${r.lan}${r.need ? ` (${r.need} ${cz(r.need, 'hostitel', 'hostitelé', 'hostitelů')})` : ''}${T.showNet ? ` na 192.168.${x}.${r.net}` : ''}; jako bránu použij ${r.rule === 'first' ? 'první' : 'poslední'} použitelnou adresu`));
  }
  reqs.push(...ifs.map(r => rtUp(r.k)));
  steps.push(L('Bring each interface up and check that it stays up.', 'Zapni každé rozhraní a zkontroluj, že zůstane zapnuté.'));
  // R1 on the left, one PC per interface stacked on the right
  const n = ifs.length, height = Math.max(180, (n - 1) * 64 + 92), mid = height / 2;
  const nodes = [{id: 'R1', type: 'router', x: 8, y: mid - 26, sub: 'Router'}], links = [];
  ifs.forEach((r, i) => {
    const id = `PC${i + 1}`, cy = mid + (i - (n - 1) / 2) * 64;
    nodes.push({id, type: 'pc', x: 370, y: cy - 26, sub: v6 ? L(`Subnet ${r.sub}`, `Podsíť ${r.sub}`) : r.need ? L(`${r.lan}, ${r.need} hosts`, `${r.lan}, ${r.need} ${cz(r.need, 'hostitel', 'hostitelé', 'hostitelů')}`) : r.lan, at: `R1 ${r.k}`});
    links.push({a: 'R1', b: id, port: r.name});
  });
  return {reqs, solution: solutionOf('R1', cmds), steps, nodes, links, height, home: 'R1'};
}

// the known-good config: cmds typed in global configuration on the home device (if any), then the other devices' lines
const solutionOf = (home, cmds, then = []) => [...(cmds?.length ? [[home, ['enable', 'conf t', ...cmds, 'end']]] : []), ...then];

// how each kind of lab builds level cfg of topic T for the network x; a level's fields may be values or functions of x
const fixedLab = topo => (T, cfg, x) => ({...topo, reqs: atNet(cfg.reqs, x), steps: cfg.steps,
  setup: cfg.setup && atNet(cfg.setup, x), solution: solutionOf(topo.home, atNet(cfg.cmds, x), cfg.then && atNet(cfg.then, x))});
const LAB_KINDS = {
  v4: addressingLab,
  v6: addressingLab,
  sw: fixedLab(SW_TOPO),
  cdp: fixedLab({...SW_TOPO, home: 'R1'}),
  mls: fixedLab(MLS_TOPO),
  rt: fixedLab(RT_TOPO),
  sw2: fixedLab(SW2_TOPO),
  hsrp: fixedLab(HSRP_TOPO),
};
// a level of topic T built for the network x (troubleshooting topics join LABS later, in labs-fix.js)
const buildLab = (T, cfg, x) => LAB_KINDS[T.kind](T, cfg, x);
