// Troubleshooting labs: every level presets a broken config (setup); cmds and then are only the fix.
// Loaded after labs.js, whose helpers it uses, and adds its topics to LABS.

// 2.0 trunk troubleshooting between S1 and S2 (SW2_TOPO in labs.js)
const TRUNKFIX_LEAD = L('S1 Gi0/1 is cabled to S2 Gi0/1, but VLAN traffic does not cross the link. Find what is wrong with show interfaces trunk and show running-config, and fix it.', 'S1 Gi0/1 je propojený s S2 Gi0/1, ale provoz VLANů linkou neprojde. Najdi chybu pomocí show interfaces trunk a show running-config a oprav ji.');
// what both switches already have: the VLANs and PC1/PC2 in VLAN 10
const SW2_BASE = ['vlan 10', 'name USERS', 'exit', 'vlan 20', 'name SERVERS', 'exit', 'vlan 99', 'name NATIVE', 'exit',
  ...onIf('fa0/1', 'switchport mode access', 'switchport access vlan 10', 'no shutdown')];
const uplink = (...lines) => onIf('gi0/1', ...lines, 'no shutdown');
const bothTrunk = ['S1', 'S2'].flatMap(d => [devReq(d, 'gi0/1', L('is a trunk', 'je trunk'), q => q.mode === 'trunk', 'switchport mode trunk'),
  devReq(d, 'gi0/1', L('is up', 'je zapnutý'), q => !q.shut, 'no shutdown')]);
const bothNative = ['S1', 'S2'].map(d => devReq(d, 'gi0/1', L('uses native VLAN 99', 'používá native VLAN 99'), q => q.native === 99, 'switchport trunk native vlan 99'));
const bothAllowed = ['S1', 'S2'].map(d => devReq(d, 'gi0/1', L('allows VLANs 10, 20 and 99', 'povoluje VLANy 10, 20 a 99'), q => !!q.allowed && q.allowed.join(',') === '10,20,99',
  'switchport trunk allowed vlan add 20'));
const bothNoneg = ['S1', 'S2'].map(d => devReq(d, 'gi0/1', L('does not send DTP frames', 'neposílá rámce DTP'), q => q.noneg, 'switchport nonegotiate'));
const TRUNKFIX = {
  beginner: {
    sub: L('S2 does not trunk: fix its side of the link', 'S2 netvoří trunk: oprav jeho stranu linky'),
    steps: [L('On S2, run show interfaces trunk: Gi0/1 is missing.', 'Na S2 spusť show interfaces trunk: Gi0/1 chybí.'), L('Check Gi0/1 in show running-config on S2.', 'Zkontroluj Gi0/1 v show running-config na S2.'), L('Make S2 Gi0/1 a trunk.', 'Nastav S2 Gi0/1 jako trunk.')],
    setup: [['S1', [...SW2_BASE, ...uplink('switchport mode trunk')]], ['S2', [...SW2_BASE, ...uplink('switchport mode access')]]],
    reqs: [...bothTrunk, pcPings('PC1', 'PC2')],
    then: [onDev('S2', ...onIf('gi0/1', 'switchport mode trunk'))],
  },
  intermediate: {
    sub: L('Fix the native VLAN mismatch: both sides must use native VLAN 99', 'Oprav neshodu native VLAN: obě strany musí používat native VLAN 99'),
    steps: [L('Compare the native VLAN of Gi0/1 on S1 and S2 with show interfaces trunk.', 'Porovnej native VLAN na Gi0/1 na S1 a S2 pomocí show interfaces trunk.'), L('Set the side that is wrong to native VLAN 99.', 'Nastav stranu, která je špatně, na native VLAN 99.')],
    setup: [['S1', [...SW2_BASE, ...uplink('switchport mode trunk', 'switchport trunk native vlan 99')]],
      ['S2', [...SW2_BASE, ...uplink('switchport mode trunk')]]],
    reqs: [...bothTrunk, ...bothNative],
    then: [onDev('S2', ...onIf('gi0/1', 'switchport trunk native vlan 99'))],
  },
  advanced: {
    sub: L('VLAN 20 does not cross the trunk: add it to the allowed list without retyping the list', 'VLAN 20 neprojde trunkem: přidej ho do seznamu povolených bez přepisování seznamu'),
    steps: [L('Compare the allowed VLANs on both sides.', 'Porovnej povolené VLANy na obou stranách.'), L('On the side that is missing VLAN 20, use switchport trunk allowed vlan add 20.', 'Na straně, které chybí VLAN 20, použij switchport trunk allowed vlan add 20.')],
    setup: [['S1', [...SW2_BASE, ...uplink('switchport mode trunk', 'switchport trunk native vlan 99', 'switchport trunk allowed vlan 10,99')]],
      ['S2', [...SW2_BASE, ...uplink('switchport mode trunk', 'switchport trunk native vlan 99', 'switchport trunk allowed vlan 10,20,99')]]],
    reqs: [...bothTrunk, ...bothNative, ...bothAllowed],
    cmds: [...onIf('gi0/1', 'switchport trunk allowed vlan add 20')],
  },
  expert: {
    sub: L('Both sides are dynamic auto, so no trunk forms: make it a static trunk with DTP off', 'Obě strany jsou dynamic auto, takže trunk nevznikne: udělej z linky statický trunk s vypnutým DTP'),
    steps: [L('Run show interfaces gi0/1 switchport on both switches: dynamic auto on both ends never forms a trunk.', 'Spusť show interfaces gi0/1 switchport na obou switchích: dynamic auto na obou koncích trunk nikdy nevytvoří.'), L('On both switches, make Gi0/1 a trunk.', 'Na obou switchích nastav Gi0/1 jako trunk.'),
      L('Then turn off DTP on both ends with switchport nonegotiate (it is refused while the port is dynamic).', 'Pak na obou koncích vypni DTP příkazem switchport nonegotiate (na dynamickém portu ho switch odmítne).')],
    setup: ['S1', 'S2'].map(d => [d, [...SW2_BASE, ...uplink('switchport mode dynamic auto', 'switchport trunk native vlan 99',
      'switchport trunk allowed vlan 10,20,99')]]),
    reqs: [...bothTrunk, ...bothNative, ...bothAllowed, ...bothNoneg, pcPings('PC1', 'PC2')],
    cmds: onIf('gi0/1', 'switchport mode trunk', 'switchport nonegotiate'),
    then: [onDev('S2', ...onIf('gi0/1', 'switchport mode trunk', 'switchport nonegotiate'))],
  },
};

// 2.0 VLAN troubleshooting on the same diagram: the symptom is PC1 failing to ping PC2
const VLANFIX_LEAD = L('PC1 on S1 Fa0/1 and PC2 on S2 Fa0/1 both belong in VLAN 10, but PC1 cannot ping 192.168.10.2. S1 Gi0/1 to S2 Gi0/1 should be a trunk. Find the fault and fix it.',
  'PC1 na S1 Fa0/1 i PC2 na S2 Fa0/1 patří do VLAN 10, ale PC1 nepingne 192.168.10.2. Linka S1 Gi0/1 – S2 Gi0/1 má být trunk. Najdi chybu a oprav ji.');
// a working setup of one switch, with the faults of a level: the PC port's VLAN, the trunk's allowed list and its mode
const vlanSetup = ({vlan = 10, allowed, mode = 'trunk'} = {}) => [...SW2_BASE, ...onIf('fa0/1', `switchport access vlan ${vlan}`),
  ...uplink(`switchport mode ${mode}`, ...(allowed ? [`switchport trunk allowed vlan ${allowed}`] : []))];
const VLANFIX_ALL = [
  ...['S1', 'S2'].flatMap(d => [
    devReq(d, 'fa0/1', L('is an access port in VLAN 10', 'je access port ve VLAN 10'), q => q.mode === 'access' && q.vlan === 10, 'switchport access vlan 10'),
    devReq(d, 'gi0/1', L('is a trunk', 'je trunk'), q => q.mode === 'trunk', 'switchport mode trunk'),
    devReq(d, 'gi0/1', L('allows VLAN 10', 'povoluje VLAN 10'), q => !q.allowed || q.allowed.includes(10), 'switchport trunk allowed vlan add 10'),
  ]),
  pcPings('PC1', 'PC2'),
];
const VLAN_PING_STEP = L('On PC1, run ping 192.168.10.2 to see the fault.', 'Na PC1 spusť ping 192.168.10.2 a uvidíš chybu.');
const VLANFIX = {
  beginner: {
    sub: L('One PC port is in the wrong VLAN', 'Jeden port PC je ve špatném VLANu'),
    steps: [VLAN_PING_STEP, L('Run show vlan brief on both switches: which VLAN is each Fa0/1 in?', 'Spusť show vlan brief na obou switchích: v jakém VLANu je který Fa0/1?'),
      L('Move the wrong port to VLAN 10, then ping again.', 'Přesuň špatný port do VLAN 10 a pingni znovu.')],
    setup: [['S1', vlanSetup()], ['S2', vlanSetup({vlan: 20})]],
    reqs: VLANFIX_ALL,
    then: [onDev('S2', ...onIf('fa0/1', 'switchport access vlan 10'))],
  },
  intermediate: {
    sub: L('Both PC ports are right, but VLAN 10 does not cross the trunk', 'Oba porty PC jsou správně, ale VLAN 10 neprojde trunkem'),
    steps: [VLAN_PING_STEP, L('Compare the allowed VLANs in show interfaces trunk on both switches.', 'Porovnej povolené VLANy v show interfaces trunk na obou switchích.'),
      L('Add VLAN 10 without retyping the list.', 'Přidej VLAN 10 bez přepisování seznamu.')],
    setup: [['S1', vlanSetup({allowed: '20,99'})], ['S2', vlanSetup()]],
    reqs: VLANFIX_ALL,
    cmds: onIf('gi0/1', 'switchport trunk allowed vlan add 10'),
  },
  advanced: {
    sub: L('Two faults: one on each switch', 'Dvě chyby: jedna na každém switchi'),
    steps: [VLAN_PING_STEP, L('Check the VLAN of each PC port with show vlan brief.', 'Zkontroluj VLAN každého portu PC pomocí show vlan brief.'),
      L('Check the allowed list at both ends of the trunk: one fix alone does not bring the ping back.', 'Zkontroluj seznam povolených na obou koncích trunku: jedna oprava sama ping neobnoví.')],
    setup: [['S1', vlanSetup({vlan: 20})], ['S2', vlanSetup({allowed: '20,99'})]],
    reqs: VLANFIX_ALL,
    cmds: onIf('fa0/1', 'switchport access vlan 10'),
    then: [onDev('S2', ...onIf('gi0/1', 'switchport trunk allowed vlan add 10'))],
  },
  expert: {
    sub: L('Three faults between PC1 and PC2', 'Tři chyby mezi PC1 a PC2'),
    steps: [VLAN_PING_STEP, L('Follow the path of the frame: PC port, trunk on S1, trunk on S2, PC port.', 'Sleduj cestu rámce: port PC, trunk na S1, trunk na S2, port PC.'),
      L('Use show interfaces gi0/1 switchport to compare both ends of the link, and ping after each fix.', 'Pomocí show interfaces gi0/1 switchport porovnej oba konce linky a po každé opravě pingni.')],
    setup: [['S1', vlanSetup({allowed: '20,99'})], ['S2', vlanSetup({vlan: 99, mode: 'access'})]],
    reqs: VLANFIX_ALL,
    cmds: onIf('gi0/1', 'switchport trunk allowed vlan add 10'),
    then: [onDev('S2', ...onIf('fa0/1', 'switchport access vlan 10'), ...onIf('gi0/1', 'switchport mode trunk'))],
  },
};

// 1.0 interface troubleshooting on the same diagram: speed, duplex, shutdown and err-disabled faults
const IFFIX_LEAD = L('PC1 on S1 Fa0/1 and PC2 on S2 Fa0/1 are in VLAN 10, and S1 Gi0/1 is trunked to S2 Gi0/1. The VLANs and the trunk are right: the faults are on the interfaces. Read show interfaces status and show interfaces on both switches.',
  'PC1 na S1 Fa0/1 a PC2 na S2 Fa0/1 jsou ve VLAN 10 a S1 Gi0/1 je trunkem propojený s S2 Gi0/1. VLANy a trunk jsou správně: chyby jsou na rozhraních. Přečti show interfaces status a show interfaces na obou switchích.');
const ifSetup = (pcPort = [], uplinkPort = []) => [...SW2_BASE, ...(pcPort.length ? onIf('fa0/1', ...pcPort) : []),
  ...uplink('switchport mode trunk', ...uplinkPort)];
// the port is up on its cable and both ends run the same duplex; hint is the level's fix for it
const portHealthy = (dev, key, text, hint) => ({
  text,
  ok: s => {
    const l = portLink(s, dev, key);
    return l.state === 'connected' && !l.mismatch;
  },
  hint: {cmds: hint, port: portName(key), dev},
});
// each argument is the fix hint of S1 Fa0/1, S2 Fa0/1 and the uplink
const ifReqs = ({s1 = ['no shutdown'], s2 = ['no shutdown'], up = ['no shutdown'], upDev = 'S2'} = {}) => [
  portHealthy('S1', 'fa0/1', L('S1 Fa0/1 is connected with no duplex mismatch', 'S1 Fa0/1 je připojený bez neshody duplexu'), s1),
  portHealthy('S2', 'fa0/1', L('S2 Fa0/1 is connected with no duplex mismatch', 'S2 Fa0/1 je připojený bez neshody duplexu'), s2),
  portHealthy(upDev, 'gi0/1', L('The link S1 Gi0/1 - S2 Gi0/1 is connected with no duplex mismatch', 'Linka S1 Gi0/1 - S2 Gi0/1 je připojená bez neshody duplexu'), up),
  pcPings('PC1', 'PC2'),
];
const BAD_MAC = '0050.7966.9999';
const IFFIX = {
  beginner: {
    sub: L('One port is switched off', 'Jeden port je vypnutý'),
    steps: [VLAN_PING_STEP, L('Run show interfaces status on both switches: look for a port that is disabled.', 'Spusť show interfaces status na obou switchích: hledej port ve stavu disabled.'),
      L('Bring the port up and ping again.', 'Zapni port a znovu pingni.')],
    setup: [['S1', ifSetup()], ['S2', ifSetup(['shutdown'])]],
    reqs: ifReqs(),
    then: [onDev('S2', ...onIf('fa0/1', 'no shutdown'))],
  },
  intermediate: {
    sub: L('The link between the switches is down although both ports are on', 'Linka mezi switchi je dole, i když jsou oba porty zapnuté'),
    steps: [VLAN_PING_STEP, L('show interfaces status shows notconnect on the uplink: compare the Speed column on both switches.', 'show interfaces status ukazuje na uplinku notconnect: porovnej sloupec Speed na obou switchích.'),
      L('Set both ends to the same speed, or back to auto.', 'Nastav na obou koncích stejnou rychlost, nebo je vrať na auto.')],
    setup: [['S1', ifSetup([], ['speed 1000'])], ['S2', ifSetup([], ['speed 100'])]],
    reqs: ifReqs({up: ['speed auto']}),
    then: [onDev('S2', ...onIf('gi0/1', 'speed auto'))],
  },
  advanced: {
    sub: L('Two faults: one breaks the ping, the other only slows the link', 'Dvě chyby: jedna rozbije ping, druhá linku jen zpomalí'),
    steps: [VLAN_PING_STEP, L('Fix what stops the ping, then keep looking: a ping that works does not prove the link is healthy.', 'Oprav to, co brání pingu, a hledej dál: funkční ping nedokazuje, že je linka v pořádku.'),
      L('Run show interfaces gi0/1 on both switches and read the duplex and the error counters.', 'Spusť show interfaces gi0/1 na obou switchích a přečti duplex a čítače chyb.')],
    setup: [['S1', ifSetup(['shutdown'], ['duplex full'])], ['S2', ifSetup([], ['duplex half'])]],
    reqs: ifReqs({up: ['duplex auto']}),
    cmds: onIf('fa0/1', 'no shutdown'),
    then: [onDev('S2', ...onIf('gi0/1', 'duplex auto'))],
  },
  expert: {
    sub: L('Three faults: an err-disabled port, a dead uplink and a duplex mismatch', 'Tři chyby: port v err-disabled, mrtvý uplink a neshoda duplexu'),
    steps: [VLAN_PING_STEP, L('For the err-disabled port, run show port-security interface fa0/1 and compare the secure MAC address with the one ipconfig shows on the PC.', 'U portu v err-disabled spusť show port-security interface fa0/1 a porovnej zabezpečenou MAC adresu s tou, kterou na PC ukáže ipconfig.'),
      L('Remove the cause first, then use shutdown and no shutdown to recover the port.', 'Nejdřív odstraň příčinu, pak port obnov příkazy shutdown a no shutdown.'),
      L('Check speed on the uplink and duplex on S2 Fa0/1: a PC always negotiates.', 'Zkontroluj rychlost na uplinku a duplex na S2 Fa0/1: PC vždy autonegociuje.')],
    setup: [['S1', ifSetup(['switchport port-security', `switchport port-security mac-address ${BAD_MAC}`], ['speed 100'])],
      ['S2', ifSetup(['speed 100', 'duplex full'], ['speed 1000'])]],
    reqs: ifReqs({s1: [`no switchport port-security mac-address ${BAD_MAC}`, 'shutdown', 'no shutdown'], s2: ['speed auto', 'duplex auto'],
      up: ['speed auto'], upDev: 'S1'}),
    cmds: [...onIf('fa0/1', `no switchport port-security mac-address ${BAD_MAC}`, 'shutdown', 'no shutdown'), ...onIf('gi0/1', 'speed auto')],
    then: [onDev('S2', ...onIf('fa0/1', 'speed auto', 'duplex auto'), ...onIf('gi0/1', 'speed auto'))],
  },
};

// 3.0 OSPF troubleshooting on R1: R2 on Gi0/1 should be an area 0 neighbour
const OSPFFIX_LEAD = serves(L('R2 on Gi0/1 should be an OSPF neighbour in area 0, but the adjacency is not working. ', 'R2 na Gi0/1 má být soused OSPF v oblasti 0, ale sousedství nefunguje. ') +
  L('Find the fault with show ip ospf interface brief and show running-config, and fix it.', 'Najdi chybu pomocí show ip ospf interface brief a show running-config a oprav ji.'));
// a working OSPF config with the given router ID, network lines and passive interfaces
const ospfSetup = (x, rid, nets, passive, extra = []) => [...BOTH_CMDS(x), ...extra, 'router ospf 1', `router-id ${rid}`,
  `network 192.168.${x}.0 0.0.0.255 area 0`, ...nets, ...passive.map(p => `passive-interface ${p}`), 'exit'];
const OSPFFIX_ALL = x => [...OSPF_BASE(x), ospfRid(false, '1.1.1.1'), igpPassive('ospf', 'gi0/0'), igpPassive('ospf', 'gi0/1', false)];
const OSPFFIX = {
  beginner: {
    sub: L('The link to R2 is in the wrong area: put it in area 0', 'Linka k R2 je ve špatné oblasti: dej ji do oblasti 0'),
    steps: [L('Run show ip ospf interface brief: note the area of Gi0/1.', 'Spusť show ip ospf interface brief: všimni si oblasti Gi0/1.'), L('Find the network statement for 10.0.0.0/30 in show running-config.', 'Najdi v show running-config příkaz network pro 10.0.0.0/30.'),
      L('Remove it with no network and add it again in area 0.', 'Odeber ho příkazem no network a přidej ho znovu v oblasti 0.')],
    setup: x => [['R1', ospfSetup(x, '1.1.1.1', ['network 10.0.0.0 0.0.0.3 area 1'], ['gi0/0'])]],
    reqs: OSPF_BASE,
    cmds: ['router ospf 1', 'no network 10.0.0.0 0.0.0.3 area 1', 'network 10.0.0.0 0.0.0.3 area 0', 'exit'],
  },
  intermediate: {
    sub: L('R1 sends no hellos to R2: find out why', 'R1 neposílá R2 žádné hello: zjisti proč'),
    steps: [L('Check the passive-interface lines under router ospf 1.', 'Zkontroluj řádky passive-interface pod router ospf 1.'), L('A passive interface sends no hellos, so no neighbour forms on it.', 'Pasivní rozhraní neposílá hello, takže na něm soused nevznikne.'),
      L('Keep the LAN passive, but not the link to R2.', 'Nech LAN pasivní, ale linku k R2 ne.')],
    setup: x => [['R1', ospfSetup(x, '1.1.1.1', ['network 10.0.0.0 0.0.0.3 area 0'], ['gi0/0', 'gi0/1'])]],
    reqs: OSPFFIX_ALL,
    cmds: ['router ospf 1', 'no passive-interface gi0/1', 'exit'],
  },
  advanced: {
    sub: L('Gi0/1 does not run OSPF at all: there are two faults', 'Gi0/1 vůbec neběží v OSPF: jsou tam dvě chyby'),
    steps: [L('Run show ip interface brief: is Gi0/1 up?', 'Spusť show ip interface brief: je Gi0/1 zapnuté?'), L('Check the wildcard of the 10.0.0.0 network statement: does it match 10.0.0.1?', 'Zkontroluj wildcard masku příkazu network pro 10.0.0.0: odpovídá 10.0.0.1?'),
      L('Fix the interface, then replace the network statement with one that covers 10.0.0.0/30.', 'Oprav rozhraní a pak nahraď příkaz network takovým, který pokryje 10.0.0.0/30.')],
    setup: x => [['R1', [...ospfSetup(x, '1.1.1.1', ['network 10.0.0.0 0.0.0.0 area 0'], ['gi0/0']), ...onIf('gi0/1', 'shutdown')]]],
    reqs: OSPFFIX_ALL,
    cmds: [...onIf('gi0/1', 'no shutdown'), 'router ospf 1', 'no network 10.0.0.0 0.0.0.0 area 0', 'network 10.0.0.0 0.0.0.3 area 0', 'exit'],
  },
  expert: {
    sub: L('Three faults: duplicate router ID, an interface command overriding the area, and hellos sent to the LAN', 'Tři chyby: duplicitní router ID, příkaz na rozhraní, který přebije oblast, a hello posílané do LAN'),
    steps: [L('R2 also uses router ID 2.2.2.2: set R1 back to 1.1.1.1 (on real IOS, clear ip ospf process afterwards).', 'R2 také používá router ID 2.2.2.2: nastav R1 zpět na 1.1.1.1 (na skutečném IOS pak spusť clear ip ospf process).'),
      L('An ip ospf command on an interface beats any network statement: check Gi0/1 in show running-config.', 'Příkaz ip ospf na rozhraní přebije jakýkoli příkaz network: zkontroluj Gi0/1 v show running-config.'),
      L('Make the LAN Gi0/0 passive again.', 'Nastav LAN Gi0/0 znovu jako pasivní.')],
    setup: x => [['R1', ospfSetup(x, '2.2.2.2', ['network 10.0.0.0 0.0.0.3 area 0'], [], onIf('gi0/1', 'ip ospf 1 area 1'))]],
    reqs: OSPFFIX_ALL,
    cmds: [...onIf('gi0/1', 'no ip ospf 1 area 1'), 'router ospf 1', 'router-id 1.1.1.1', 'passive-interface gi0/0', 'exit'],
  },
};

// 2.0 router-on-a-stick troubleshooting: R1 Gi0/0.10 and .20 over the trunk to S1, PC1 in VLAN 10 and PC2 in VLAN 20
const INTERFIX_LEAD = L('R1 Gi0/0 is trunked to S1 Gi0/1 and routes between VLAN 10 (PC1 on Fa0/1) and VLAN 20 (PC2 on Fa0/2), ', 'R1 Gi0/0 je trunkem propojený s S1 Gi0/1 a routuje mezi VLAN 10 (PC1 na Fa0/1) a VLAN 20 (PC2 na Fa0/2), ') +
  L('but the VLANs cannot reach their gateway. Compare R1 and S1 and fix what is wrong.', 'ale VLANy nedosáhnou na svou bránu. Porovnej R1 a S1 a oprav, co je špatně.');
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
    sub: L('VLAN 20 has no gateway: check R1 Gi0/0.20', 'VLAN 20 nemá bránu: zkontroluj R1 Gi0/0.20'),
    steps: [L('On R1, check Gi0/0.20 in show running-config.', 'Na R1 zkontroluj Gi0/0.20 v show running-config.'), L('The dot1Q tag must match the VLAN the subinterface serves.', 'Tag dot1Q musí odpovídat VLANu, který subrozhraní obsluhuje.'), L('Set the right encapsulation.', 'Nastav správné zapouzdření.')],
    setup: [['R1', r1Stick({tag20: 30})], ['S1', s1Stick()]],
    reqs: INTERFIX_ALL,
    then: [onDev('R1', ...onIf('gi0/0.20', 'encapsulation dot1Q 20'))],
  },
  intermediate: {
    sub: L('Neither VLAN reaches R1: check the switch side of the link', 'Žádný VLAN nedosáhne na R1: zkontroluj stranu linky u switche'),
    steps: [L('On S1, run show interfaces trunk: Gi0/1 is missing.', 'Na S1 spusť show interfaces trunk: Gi0/1 chybí.'), L('Check Gi0/1 in show running-config on S1.', 'Zkontroluj Gi0/1 v show running-config na S1.'), L('Make it a trunk again.', 'Udělej z něj znovu trunk.')],
    setup: [['R1', r1Stick()], ['S1', s1Stick({mode: 'access'})]],
    reqs: INTERFIX_ALL,
    cmds: onIf('gi0/1', 'switchport mode trunk'),
  },
  advanced: {
    sub: L('Two faults: one on R1, one on S1', 'Dvě chyby: jedna na R1, jedna na S1'),
    steps: [L('On R1, run show ip interface brief: a subinterface is only up when its physical interface is.', 'Na R1 spusť show ip interface brief: subrozhraní je zapnuté, jen když je zapnuté jeho fyzické rozhraní.'),
      L('On S1, run show vlan brief: is each PC in the VLAN of its gateway?', 'Na S1 spusť show vlan brief: je každé PC ve VLANu své brány?'), L('Fix both.', 'Oprav obě.')],
    setup: [['R1', r1Stick({phys: 'shutdown'})], ['S1', s1Stick({vlan2: 10})]],
    reqs: INTERFIX_ALL,
    cmds: onIf('fa0/2', 'switchport access vlan 20'),
    then: [onDev('R1', ...onIf('gi0/0', 'no shutdown'))],
  },
  expert: {
    sub: L('Three faults: the trunk drops VLAN 20, Gi0/0.10 has the wrong mask, and a PC port is down', 'Tři chyby: trunk zahazuje VLAN 20, Gi0/0.10 má špatnou masku a port jednoho PC je vypnutý'),
    steps: [L('On S1, compare the allowed VLANs on the trunk with the VLANs in use; add the missing one without retyping the list.', 'Na S1 porovnej povolené VLANy na trunku s používanými VLANy; chybějící přidej bez přepisování seznamu.'),
      L('On R1, check the mask of Gi0/0.10: PC1 must fit in its subnet.', 'Na R1 zkontroluj masku Gi0/0.10: PC1 se musí vejít do jeho podsítě.'), L('On S1, check that both PC ports are up.', 'Na S1 zkontroluj, že oba porty PC jsou zapnuté.')],
    setup: [['R1', r1Stick({mask10: '255.255.255.252'})], ['S1', s1Stick({allowed: '10', fa1: 'shutdown'})]],
    reqs: [...INTERFIX_ALL, swAllowed('gi0/1', [10, 20])],
    cmds: [...onIf('gi0/1', 'switchport trunk allowed vlan add 20'), ...onIf('fa0/1', 'no shutdown')],
    then: [onDev('R1', ...onIf('gi0/0.10', `ip address 192.168.10.1 ${MASK24}`))],
  },
};

// 4.0 DHCP troubleshooting: R1 serves pool LAN1 for 192.168.x.0/24 and keeps .1 to .20 out of it
const DHCPFIX_LEAD = x => L(`R1 is the DHCP server for PC1 on 192.168.${x}.0/24 behind Gi0/0, but PC1 does not get working settings. `, `R1 je DHCP server pro PC1 v 192.168.${x}.0/24 za Gi0/0, ale PC1 nedostává funkční nastavení. `) +
  L('Find the fault with show running-config, fix it, then type dhcp on PC1.', 'Najdi chybu v show running-config, oprav ji a pak na PC1 napiš dhcp.');
const dhcpSetup = (x, f = {}) => [...BOTH_CMDS(x), ...(f.lanShut ? onIf('gi0/0', 'shutdown') : []),
  `ip dhcp excluded-address 192.168.${x}.1 192.168.${x}.${f.exLast || 20}`,
  'ip dhcp pool LAN1', `network ${f.net || `192.168.${x}.0`} 255.255.255.0`, `default-router 192.168.${x}.${f.gw || 1}`, 'exit'];
const DHCPFIX_ALL = x => [...BOTH_IFS(x), dhcpPool('lan1', `192.168.${x}.0`, MASK24, `192.168.${x}.1`), dhcpEx(`192.168.${x}.1`, `192.168.${x}.20`),
  // a lease taken before the fix keeps the old gateway, so PC1 must ask again
  pcLease('PC1', `192.168.${x}`, `192.168.${x}.1`)];
const fixExclusion = x => [`no ip dhcp excluded-address 192.168.${x}.1 192.168.${x}.254`, `ip dhcp excluded-address 192.168.${x}.1 192.168.${x}.20`];
const DHCPFIX = {
  beginner: {
    sub: L('PC1 gets an address but cannot leave its LAN: check the gateway it is given', 'PC1 dostane adresu, ale nedostane se ven ze své LAN: zkontroluj bránu, kterou dostává'),
    steps: [L('On PC1, type dhcp and look at the GW it gets.', 'Na PC1 napiš dhcp a podívej se na GW, kterou dostane.'), L('Compare it with R1 Gi0/0 and with default-router in the pool.', 'Porovnej ji s R1 Gi0/0 a s default-router v poolu.'), L('Fix the pool, then type dhcp on PC1 again.', 'Oprav pool a pak na PC1 znovu napiš dhcp.')],
    setup: x => [['R1', dhcpSetup(x, {gw: 254})]],
    reqs: DHCPFIX_ALL,
    cmds: x => ['ip dhcp pool LAN1', `default-router 192.168.${x}.1`, 'exit'],
    then: PC1_DHCP,
  },
  intermediate: {
    sub: L('PC1 gets no address at all: the pool does not match the LAN', 'PC1 nedostane vůbec žádnou adresu: pool neodpovídá LAN'),
    steps: [L('On PC1, type dhcp: no server answers.', 'Na PC1 napiš dhcp: žádný server neodpoví.'), L('A pool only serves the subnet of the interface the request comes in on; compare the pool network with Gi0/0.', 'Pool obsluhuje jen podsíť rozhraní, na které žádost přijde; porovnej síť poolu s Gi0/0.'),
      L('Fix the pool network, then type dhcp on PC1.', 'Oprav síť poolu a pak na PC1 napiš dhcp.')],
    setup: x => [['R1', dhcpSetup(x, {net: '10.10.10.0'})]],
    reqs: DHCPFIX_ALL,
    cmds: x => ['ip dhcp pool LAN1', `network 192.168.${x}.0 255.255.255.0`, 'exit'],
    then: PC1_DHCP,
  },
  advanced: {
    sub: L('The pool is right but has no free addresses: check the excluded range', 'Pool je správně, ale nemá volné adresy: zkontroluj vyloučený rozsah'),
    steps: [L('Find ip dhcp excluded-address in show running-config: how much of the pool does it cover?', 'Najdi ip dhcp excluded-address v show running-config: kolik poolu pokrývá?'), L('Remove it with no ip dhcp excluded-address.', 'Odeber ho příkazem no ip dhcp excluded-address.'),
      L('Exclude only .1 to .20, then type dhcp on PC1.', 'Vyluč jen .1 až .20 a pak na PC1 napiš dhcp.')],
    setup: x => [['R1', dhcpSetup(x, {exLast: 254})]],
    reqs: DHCPFIX_ALL,
    cmds: fixExclusion,
    then: PC1_DHCP,
  },
  expert: {
    sub: L('Three faults between PC1 and a working lease', 'Tři chyby mezi PC1 a funkční zápůjčkou'),
    steps: [L('Check that the interface PC1 is on is up.', 'Zkontroluj, že rozhraní, na kterém je PC1, je zapnuté.'), L('Check the excluded range and the default router in the pool.', 'Zkontroluj vyloučený rozsah a výchozí router v poolu.'), L('Fix all three, then type dhcp on PC1.', 'Oprav všechny tři a pak na PC1 napiš dhcp.')],
    setup: x => [['R1', dhcpSetup(x, {lanShut: true, exLast: 254, gw: 254})]],
    reqs: DHCPFIX_ALL,
    cmds: x => [...onIf('gi0/0', 'no shutdown'), ...fixExclusion(x), 'ip dhcp pool LAN1', `default-router 192.168.${x}.1`, 'exit'],
    then: PC1_DHCP,
  },
};

// 5.0 ACL troubleshooting on R1: the ACLs from the ACL labs, written or applied wrongly
const ACLFIX_LEAD = x => L(`PC1 is on 192.168.${x}.0/24 behind Gi0/0 and R2 is reached through Gi0/1. The ACLs on R1 do not filter what they should. `, `PC1 je v 192.168.${x}.0/24 za Gi0/0 a R2 je dosažitelný přes Gi0/1. ACL na R1 nefiltrují to, co mají. `) +
  L('Read them in show running-config (and show access-lists on real IOS), and fix them.', 'Přečti je v show running-config (a na skutečném IOS v show access-lists) a oprav je.');
const aclNone = (k, dir, name) => rtReq(k, L(`has no ACL ${dir === 'in' ? 'inbound' : 'outbound'}`, `nemá ${dir === 'in' ? 'příchozí' : 'odchozí'} ACL`), i => !(dir === 'in' ? i.aclIn : i.aclOut),
  `no ip access-group ${name} ${dir}`);
// starts by deleting the ACL, so typing it twice does not double its entries
const aclSetup = (type, name, entries) => [`no ip access-list ${type} ${name}`, `ip access-list ${type} ${name}`, ...entries, 'exit'];
const TELNET_WRONG = aclSetup('extended', '110', ['permit ip any any', 'deny tcp any any eq telnet']); // the deny never matches
const ACLFIX = {
  beginner: {
    sub: L('ACL 10 should stop 192.168.x.10 entering R1, but it is applied in the wrong direction', 'ACL 10 má zastavit 192.168.x.10 při vstupu do R1, ale je použité ve špatném směru'),
    steps: [L('Check ip access-group on Gi0/0 in show running-config.', 'Zkontroluj ip access-group na Gi0/0 v show running-config.'), L('Traffic from PC1 enters R1 on Gi0/0, so it is filtered inbound there.', 'Provoz z PC1 vstupuje do R1 na Gi0/0, takže se tam filtruje příchozí.'),
      L('Remove the outbound ACL and apply it inbound.', 'Odeber odchozí ACL a použij ho jako příchozí.')],
    setup: x => [['R1', [...LAN_CMDS(x), ...aclSetup('standard', '10', BLOCK10(x)), ...onIf('gi0/0', 'ip access-group 10 out')]]],
    reqs: x => [...LAN_IF(x), aclEntries('10', 'standard', BLOCK10(x)), aclApplied('gi0/0', 'in', '10'), aclNone('gi0/0', 'out', '10')],
    cmds: onIf('gi0/0', 'no ip access-group 10 out', 'ip access-group 10 in'),
  },
  intermediate: {
    sub: L('Since ACL 10 went on, nobody on the LAN gets through', 'Od zapnutí ACL 10 neprojde nikdo z LAN'),
    steps: [L('Read the entries of ACL 10.', 'Přečti položky ACL 10.'), L('Every ACL ends in an implicit deny any: what happens to traffic that matches no entry?', 'Každé ACL končí implicitním deny any: co se stane s provozem, kterému neodpovídá žádná položka?'), L('Add the entry that lets everyone else through.', 'Přidej položku, která propustí všechny ostatní.')],
    setup: x => [['R1', [...LAN_CMDS(x), ...aclSetup('standard', '10', [`deny host 192.168.${x}.10`]), ...onIf('gi0/0', 'ip access-group 10 in')]]],
    reqs: x => [...LAN_IF(x), aclEntries('10', 'standard', BLOCK10(x)), aclApplied('gi0/0', 'in', '10')],
    cmds: ['ip access-list standard 10', 'permit any', 'exit'],
  },
  advanced: {
    sub: L('ACL 110 should block Telnet, but Telnet still gets through', 'ACL 110 má blokovat Telnet, ale Telnet pořád prochází'),
    steps: [L('Read the entries of ACL 110 in order: an ACL stops at the first entry that matches.', 'Přečti položky ACL 110 v pořadí: ACL končí u první položky, která odpovídá.'), L('Delete ACL 110 with no ip access-list extended 110.', 'Smaž ACL 110 příkazem no ip access-list extended 110.'),
      L('Write it again with the deny first; the ip access-group line on Gi0/0 can stay.', 'Napiš ho znovu s deny na začátku; řádek ip access-group na Gi0/0 může zůstat.')],
    setup: x => [['R1', [...LAN_CMDS(x), ...TELNET_WRONG, ...onIf('gi0/0', 'ip access-group 110 in')]]],
    reqs: x => [...LAN_IF(x), ...TELNET_ACL],
    cmds: aclSetup('extended', '110', TELNET_ENTRIES),
  },
  expert: {
    sub: L('Two faults: ACL 110 sits on the wrong interface, and web-filter blocks the whole LAN instead of its first half', 'Dvě chyby: ACL 110 je na špatném rozhraní a web-filter blokuje celou LAN místo její první poloviny'),
    steps: [L('ACL 110 must filter traffic from the LAN as it enters R1: find where it is applied now.', 'ACL 110 musí filtrovat provoz z LAN při vstupu do R1: zjisti, kde je použité teď.'), L('Move it to inbound Gi0/0.', 'Přesuň ho jako příchozí na Gi0/0.'),
      L('Check the wildcard in web-filter: the first half of a /24 is 0.0.0.127. Delete and rewrite web-filter.', 'Zkontroluj wildcard masku ve web-filter: první polovina /24 je 0.0.0.127. Smaž web-filter a napiš ho znovu.')],
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
  vlanfix: {kind: 'sw2', lead: VLANFIX_LEAD, levels: VLANFIX},
  iftrouble: {kind: 'sw2', lead: IFFIX_LEAD, levels: IFFIX},
  ospffix: {kind: 'rt', lead: OSPFFIX_LEAD, levels: OSPFFIX},
  intervlanfix: {kind: 'sw', lead: INTERFIX_LEAD, levels: INTERVLANFIX},
  dhcpfix: {kind: 'rt', lead: DHCPFIX_LEAD, levels: DHCPFIX},
  aclfix: {kind: 'rt', lead: ACLFIX_LEAD, levels: ACLFIX},
});
