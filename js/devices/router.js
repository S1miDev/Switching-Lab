// Router: an IOS router's configuration, command line (parsing, show output and running-config), Tab keys and "?" help.
// Uses the helpers in ios.js (pick, execCommand ...) and the help engine in help.js.

const isPid = text => isNum(text) && Number(text) >= 1 && Number(text) <= 65535; // routing process ID

// The words each mode accepts. Short forms are resolved against these lists (see pick).
const ROUTER_CMDS = {
  user: ['enable', 'exit', 'ping', 'show', 'terminal'],
  priv: ['configure', 'copy', 'disable', 'exit', 'ping', 'show', 'terminal', 'write'],
  config: ['hostname', 'interface', 'ip', 'ipv6', 'cdp', 'lldp', 'no', 'ntp', 'logging', 'access-list', 'line', 'router', 'enable', 'service', 'banner', 'exit', 'end', 'show'],
  ifc: ['interface', 'description', 'ip', 'ipv6', 'shutdown', 'no', 'cdp', 'exit', 'end', 'show', 'encapsulation'],
  line: ['password', 'login', 'logging', 'exec-timeout', 'no', 'exit', 'end', 'show'],
  router: ['network', 'router-id', 'passive-interface', 'default-information', 'version', 'eigrp', 'no', 'exit', 'end', 'show'],
  nacl: ['permit', 'deny', 'exit', 'end', 'show'],
  dhcp: ['network', 'default-router', 'dns-server', 'domain-name', 'exit', 'end'],
};

// The full commands Tab completes to, per mode, in the order Tab lists them
const SHOWS = ['show ip interface brief', 'show ipv6 interface brief', 'show cdp neighbors', 'show lldp neighbors', 'show ip route',
  'show running-config', 'show startup-config', 'show version'];
const ROUTER_KEYS = {
  user: ['enable', 'exit', 'ping', 'terminal length 0', ...SHOWS],
  priv: ['configure terminal', 'copy running-config startup-config', 'disable', 'exit', 'ping', 'terminal length 0', 'write memory', ...SHOWS],
  config: ['hostname', 'interface', 'line console 0', 'line vty 0 4', 'router ospf 1', 'ipv6 router ospf 1', 'ipv6 unicast-routing',
    'enable secret', 'service password-encryption', 'banner motd', 'no ip domain-lookup', 'router eigrp 100', 'router rip', 'ip route', 'no ip route', 'cdp run', 'no cdp run', 'lldp run', 'no lldp run', 'exit', 'end', ...SHOWS],
  ifc: ['interface', 'description', 'ip address', 'ipv6 address', 'ip ospf 1 area 0', 'ipv6 ospf 1 area 0', 'no ip address', 'no ipv6 address',
    'cdp enable', 'no cdp enable', 'no shutdown', 'shutdown', 'exit', 'end', ...SHOWS],
  line: ['password', 'login', 'logging synchronous', 'exec-timeout 5 0', 'exit', 'end'],
  router: ['network', 'router-id', 'passive-interface', 'no passive-interface', 'default-information originate', 'version 2', 'eigrp router-id','no auto-summary', 'exit', 'end'],
  nacl: ['permit', 'deny', 'exit', 'end'],
  dhcp: ['network', 'default-router', 'dns-server', 'domain-name', 'exit', 'end'],
};

const ACL_ROWS = [
  ['default', 'Set a command to its defaults'],
  ['deny', 'Specify packets to reject'],
  ['exit', 'Exit from access-list configuration mode'],
  H.no,
  ['permit', 'Specify packets to forward'],
  ['remark', 'Access list entry comment'],
];
const ROUTING_COMMON = [
  ['default-information', 'Control distribution of default information'],
  ['default-metric', 'Set metric of redistributed routes'],
  ['distance', 'Define an administrative distance'],
  ['distribute-list', 'Filter networks in routing updates'],
  ['exit', 'Exit from routing protocol configuration mode'],
  ['maximum-paths', 'Forward packets over multiple paths'],
  ['neighbor', 'Specify a neighbor router'],
  ['network', 'Enable routing on an IP network'],
  H.no,
  ['passive-interface', 'Suppress routing updates on an interface'],
  ['redistribute', 'Redistribute information from another routing protocol'],
  ['timers', 'Adjust routing timers'],
];

const OSPF_HELP = {head: 'Router configuration commands:', rows: byName([
  ['area', 'OSPF area parameters'],
  ['auto-cost', 'Calculate OSPF interface cost according to bandwidth'],
  ['compatible', 'OSPF router compatibility list'],
  ['log-adjacency-changes', 'Log changes in adjacency state'],
  ['router-id', 'router-id for this OSPF process'],
  ['summary-address', 'Configure IP address summaries'],
  ...ROUTING_COMMON,
])};

const ROUTER_HELP = {
  user: {head: 'Exec commands:', rows: EXEC_USER},
  priv: {head: 'Exec commands:', rows: [
    H.session, ['auto', 'Exec level Automation'], H.clear, H.clock, H.configure, H.connect, H.copy, H.debug, H.del, H.dir, H.disable,
    H.disconnect, H.enable, H.erase, H.exit, H.logout, ['mkdir', 'Create new directory'], H.more, ['no', 'Disable debugging informations'],
    H.ping, H.reload, H.resume, ['rmdir', 'Remove existing directory'], ['send', 'Send a message to other tty lines'], H.setup, H.show,
    H.ssh, H.telnet, H.terminal, H.traceroute, H.undebug, H.vlan, H.write,
  ]},
  config: {head: 'Configure commands:', rows: [
    ['aaa', 'Authentication, Authorization and Accounting.'],
    ['access-list', 'Add an access list entry'],
    ['banner', 'Define a login banner'],
    ['bba-group', 'Configure BBA Group'],
    ['boot', 'Modify system boot parameters'],
    ['cdp', 'Global CDP configuration subcommands'],
    ['class-map', 'Configure Class Map'],
    ['clock', 'Configure time-of-day clock'],
    ['config-register', 'Define the configuration register'],
    ['crypto', 'Encryption module'],
    ['default', 'Set a command to its defaults'],
    ['do', 'To run exec commands in config mode'],
    ['dot11', 'IEEE 802.11 config commands'],
    ['enable', 'Modify enable password parameters'],
    ['end', 'Exit from configure mode'],
    ['exit', 'Exit from configure mode'],
    ['flow', 'Global Flow configuration subcommands'],
    ['hostname', "Set system's network name"],
    ['interface', 'Select an interface to configure'],
    ['ip', 'Global IP configuration subcommands'],
    ['ipv6', 'Global IPv6 configuration commands'],
    ['key', 'Key management'],
    ['license', 'Configure license features'],
    ['line', 'Configure a terminal line'],
    ['lldp', 'Global LLDP configuration subcommands'],
    ['logging', 'Modify message logging facilities'],
    ['login', 'Enable secure login checking'],
    ['mac-address-table', 'Configure the MAC address table'],
    ['no', 'Negate a command or set its defaults'],
    ['ntp', 'Configure NTP'],
    ['parser', 'Configure parser'],
    ['policy-map', 'Configure QoS Policy Map'],
    ['port-channel', 'EtherChannel configuration'],
    ['priority-list', 'Build a priority list'],
    ['privilege', 'Command privilege parameters'],
    ['queue-list', 'Build a custom queue list'],
    ['router', 'Enable a routing process'],
    ['secure', 'Secure image and configuration archival commands'],
    ['security', 'Infra Security CLIs'],
    ['service', 'Modify use of network based services'],
    ['snmp-server', 'Modify SNMP engine parameters'],
    ['spanning-tree', 'Spanning Tree Subsystem'],
    ['tacacs-server', 'Modify TACACS query parameters'],
    ['username', 'Establish User Name Authentication'],
    ['vpdn', 'Virtual Private Dialup Network'],
    ['vpdn-group', 'VPDN group configuration'],
  ]},
  ifc: {head: null, rows: [
    ['arp', 'Set arp type (arpa, probe, snap) or timeout'],
    ['bandwidth', 'Set bandwidth informational parameter'],
    ['cdp', 'CDP interface subcommands'],
    ['channel-group', 'Add this interface to an Etherchannel group'],
    ['crypto', 'Encryption/Decryption commands'],
    ['custom-queue-list', 'Assign a custom queue list to an interface'],
    ['delay', 'Specify interface throughput delay'],
    ['description', 'Interface specific description'],
    ['duplex', 'Configure duplex operation.'],
    ['exit', 'Exit from interface configuration mode'],
    ['fair-queue', 'Enable Fair Queuing on an Interface'],
    ['hold-queue', 'Set hold queue depth'],
    ['ip', 'Interface Internet Protocol config commands'],
    ['ipv6', 'IPv6 interface subcommands'],
    ['lldp', 'LLDP interface subcommands'],
    ['mac-address', 'Manually set interface MAC address'],
    ['mtu', 'Set the interface Maximum Transmission Unit (MTU)'],
    H.no,
    ['pppoe', 'pppoe interface subcommands'],
    ['pppoe-client', 'pppoe client'],
    ['priority-group', 'Assign a priority group to an interface'],
    ['service-policy', 'Configure QoS Service Policy'],
    ['shutdown', 'Shutdown the selected interface'],
    ['speed', 'Configure speed operation.'],
  ]},
  line: LINE,
  // per routing protocol (the router state's proto)
  router: {
    ospf: OSPF_HELP,
    ospf6: OSPF_HELP,
    eigrp: {head: 'Router configuration commands:', rows: byName([
      ['auto-summary', 'Enable automatic network number summarization'],
      ['eigrp', 'EIGRP specific commands'],
      ['metric', 'Modify EIGRP routing metrics and parameters'],
      ['offset-list', 'Add or subtract offset from EIGRP metrics'],
      ['traffic-share', 'How to compute traffic share over alternate paths'],
      ['variance', 'Control load balancing variance'],
      ...ROUTING_COMMON,
    ])},
    rip: {head: 'Router configuration commands:', rows: byName([
      ['auto-summary', 'Enable automatic network number summarization'],
      ['offset-list', 'Add or subtract offset from RIP metrics'],
      ['validate-update-source', 'Perform sanity checks against source address of routing updates'],
      ['version', 'Set routing protocol version'],
      ...ROUTING_COMMON,
    ])},
  },
  // per ACL type
  nacl: {
    std: {head: 'Standard Access List configuration commands:', rows: [['<1-2147483647>', 'Sequence Number'], ...ACL_ROWS]},
    ext: {head: 'Extended Access List configuration commands:', rows: byName([
      ['<1-2147483647>', 'Sequence Number'], ...ACL_ROWS, ['evaluate', 'Evaluate an access list'],
    ])},
  },
  dhcp: {head: 'DHCP pool configuration commands:', rows: [
    ['default-router', 'Default routers'],
    ['dns-server', 'DNS servers'],
    ['domain-name', 'Domain name'],
    ['exit', 'Exit from DHCP pool configuration mode'],
    ['lease', 'Address lease time'],
    ['netbios-name-server', 'NetBIOS (WINS) name servers'],
    ['network', 'Network number and mask'],
    H.no,
    ['option', 'Raw DHCP options'],
  ]},
};

function freshRouter(host) {
  return {
    mode: 'user', iface: null, host, cdp: true, lldp: false, saved: null, proto: null,
    ifs: {'gi0/0': iface('Gi0/0'), 'gi0/1': iface('Gi0/1'), 'gi0/2': iface('Gi0/2'), 'gi0/3': iface('Gi0/3')},
    routes: [],
    acls: {}, aclName: null,
    dhcp: {}, dhcpEx: [], dhcpName: null,
    nat: {pat: [], stat: []},
    svc: {ntp: [], log: [], dns: []},
    v6routing: false,
    sec: {secret: false, enc: false, banner: null, nolookup: false}, line: null, // line = console or vty while in line mode
    lines: {console: freshLine(), vty: freshLine()},
    ospf: freshProc(), ospf6: freshProc(), eigrp: freshProc(), rip: freshProc(), // router ospf / ipv6 router ospf / router eigrp / router rip
  };
}

function freshLine() {
  return {pw: null, login: false, sync: false, timeout: null};
}

// pid is null until the process is started (0 for RIP, which has no process ID); ver and nosum are for RIP and EIGRP
function freshProc() {
  return {pid: null, rid: null, nets: [], passive: [], originate: false, ver: null, nosum: false};
}

// ospf and ospf6 are {pid, area} once "ip ospf" / "ipv6 ospf" is set on the interface
function iface(name) {
  return {name, ip: null, mask: null, ip6: null, ll: null, desc: null, encap: null, aclIn: null, aclOut: null, helpers: [], nat: null,
    ospf: null, ospf6: null, cdp: true, shut: true};
}

// OSPF areas may be typed as 0 or 0.0.0.0; both are stored as a number
const areaNum = text => isNum(text) ? Number(text) : DOTTED.test(text) ? ipInt(text) : null;

// The first network statement of a process that covers the interface's address, or undefined
function netHit(st, proto, k) {
  const i = st.ifs[k];
  return i.ip && st[proto].nets.find(n => ((ipInt(i.ip) | ipInt(n.wc)) >>> 0) === ((ipInt(n.net) | ipInt(n.wc)) >>> 0));
}

// The OSPFv2 area an interface is in, from "ip ospf" or a matching network statement, or null
function ospfArea(st, k) {
  if (st.ifs[k].ospf) return st.ifs[k].ospf.area;
  return netHit(st, 'ospf', k)?.area ?? null;
}

// The wildcard of the classful network an address belongs to (used by "network" under RIP and EIGRP)
const classWc = ip => Number(ip.split('.')[0]) < 128 ? '0.255.255.255' : Number(ip.split('.')[0]) < 192 ? '0.0.255.255' : '0.0.0.255';


// Interface name -> key in the router's ifs. Accepts Gi0/0, g0/0, gig0/0, gigabitethernet0/0 or 0/0.
// A subinterface such as Gi0/0.10 is created the first time it is named.
function ifKey(st, text) {
  const m = (text || '').match(/^(?:gigabitethernet|gigabit|gig|gi|g)?(\d+\/\d+)(\.\d+)?$/);
  if (!m) return null;
  const [, port, sub = ''] = m;
  const key = 'gi' + port + sub;
  if (sub && !st.ifs[key] && st.ifs['gi' + port]) st.ifs[key] = iface('Gi' + port + sub);
  return st.ifs[key] ? key : null;
}

function configLines(st) {
  const lines = [`hostname ${st.host}`, st.cdp ? 'cdp run' : 'no cdp run'];
  if (st.sec.secret) lines.push('enable secret 5 $1$mERr$hashed');
  if (st.sec.enc) lines.push('service password-encryption');
  if (st.sec.nolookup) lines.push('no ip domain-lookup');
  if (st.sec.banner) lines.push(`banner motd ^C${st.sec.banner}^C`);
  if (st.lldp) lines.push('lldp run');
  for (const i of Object.values(st.ifs)) {
    lines.push(`interface ${i.name}`);
    if (i.desc) lines.push(` description ${i.desc}`);
    if (i.encap) lines.push(` encapsulation dot1Q ${i.encap}`);
    for (const h of i.helpers) lines.push(` ip helper-address ${h}`);
    if (i.nat) lines.push(` ip nat ${i.nat}`);
    if (i.ip) lines.push(` ip address ${i.ip} ${i.mask}`);
    if (i.ip6) lines.push(` ipv6 address ${i.ip6}`);
    if (i.ll) lines.push(` ipv6 address ${i.ll} link-local`);
    if (i.ospf) lines.push(` ip ospf ${i.ospf.pid} area ${i.ospf.area}`);
    if (i.ospf6) lines.push(` ipv6 ospf ${i.ospf6.pid} area ${i.ospf6.area}`);
    if (!i.cdp) lines.push(' no cdp enable');
    lines.push(i.shut ? ' shutdown' : ' no shutdown', '!');
  }
  for (const [name, acl] of Object.entries(st.acls)) {
    lines.push(`ip access-list ${acl.type} ${name}`, ...acl.entries.map(e => ' ' + e), '!');
  }
  for (const [name, pool] of Object.entries(st.dhcp)) {
    lines.push(`ip dhcp pool ${name}`, ` network ${pool.net} ${pool.mask}`, ` default-router ${pool.gw}`, ...pool.dns.map(d => ` dns-server ${d}`));
    if (pool.domain) lines.push(` domain-name ${pool.domain}`);
    lines.push('!');
  }
  for (const [first, last] of st.dhcpEx) lines.push(`ip dhcp excluded-address ${first} ${last}`);
  for (const p of st.nat.pat) lines.push(`ip nat inside source list ${p.acl} interface ${p.iface} overload`);
  for (const p of st.nat.stat) lines.push(`ip nat inside source static ${p.in} ${p.out}`);
  for (const ip of st.svc.ntp) lines.push(`ntp server ${ip}`);
  for (const ip of st.svc.log) lines.push(`logging host ${ip}`);
  for (const ip of st.svc.dns) lines.push(`ip name-server ${ip}`);
  for (const r of st.routes) lines.push(`ip route ${r.net} ${r.mask} ${r.nh}${r.dist !== 1 ? ' ' + r.dist : ''}`);
  if (st.v6routing) lines.push('ipv6 unicast-routing');
  for (const [name, head] of [['console', 'line console 0'], ['vty', 'line vty 0 4']]) {
    const l = st.lines[name];
    lines.push(head);
    if (l.timeout) lines.push(` exec-timeout ${l.timeout}`);
    if (l.pw) lines.push(st.sec.enc ? ' password 7 0822455D0A16' : ` password ${l.pw}`);
    if (l.sync) lines.push(' logging synchronous');
    if (l.login) lines.push(' login');
    lines.push('!');
  }
  for (const [head, o] of [['router ospf', st.ospf], ['ipv6 router ospf', st.ospf6], ['router eigrp', st.eigrp], ['router rip', st.rip]]) {
    if (o.pid === null) continue;
    lines.push(head === 'router rip' ? head : `${head} ${o.pid}`);
    if (o.ver) lines.push(` version ${o.ver}`);
    if (o.rid) lines.push(head === 'router eigrp' ? ` eigrp router-id ${o.rid}` : ` router-id ${o.rid}`);
    for (const p of o.passive) lines.push(` passive-interface ${p}`);
    for (const n of o.nets) {
      lines.push(head === 'router ospf' ? ` network ${n.net} ${n.wc} area ${n.area}` : ` network ${n.net}${head === 'router eigrp' && !n.cf ? ' ' + n.wc : ''}`);
    }
    if (o.nosum) lines.push(' no auto-summary');
    if (o.originate) lines.push(' default-information originate');
    lines.push('!');
  }
  return lines;
}

function save(st, out) {
  st.saved = configLines(st);
  out('Building configuration...');
  out('[OK]', 'ln-ok');
}

// ---- show commands ----

function briefV4(st, out) {
  out('Interface    IP-Address       Status');
  for (const i of Object.values(st.ifs)) out(i.name.padEnd(13) + (i.ip || 'unassigned').padEnd(17) + (i.shut ? 'administratively down' : 'up'));
}

function briefV6(st, out) {
  out('Interface    IPv6-Address                     Link-local');
  for (const i of Object.values(st.ifs)) out(i.name.padEnd(13) + (i.ip6 || 'unassigned').padEnd(32) + (i.ll || 'none'));
}

// The discoverable devices cabled to the router (by the lab's links) are seen on their link's port while it is up (and, for CDP, CDP is on there)
function neighbors(st, name, session, proto, out) {
  if (!st[proto]) return out(`% ${proto.toUpperCase()} is not enabled on ${name}`, 'ln-err');
  const seen = [];
  for (const [peer, l] of peersOf(session, name)) {
    const link = peer.discoverable && st.ifs[l.port.toLowerCase()];
    if (link && !link.shut && (proto === 'lldp' || link.cdp)) seen.push([peer.name, link.name]);
  }
  out('Device ID    Local Intf');
  for (const [id, local] of seen) out(id.padEnd(13) + local);
  out(`Total ${proto} entries displayed : ${seen.length}`);
}

function routeTable(st, out) {
  out('Codes: C - connected, S - static');
  for (const i of Object.values(st.ifs)) {
    if (i.ip && !i.shut) out(`C    ${netText(i.ip, i.mask)}/${prefixLen(i.mask)} is directly connected, ${i.name}`);
  }
  for (const r of st.routes) {
    const prefix = `${r.net}/${prefixLen(r.mask)}`;
    out(r.nh.startsWith('Gi') ? `S    ${prefix} is directly connected, ${r.nh}` : `S    ${prefix} [${r.dist}/0] via ${r.nh}`);
  }
}

// a ping succeeds when the target is on a connected network that is up
function ping(st, target, out) {
  if (!DOTTED.test(target)) out('% Unrecognized host or address', 'ln-err');
  else pingResult(target, Object.values(st.ifs).some(i => i.ip && !i.shut && inNet(i.ip, i.mask, target)), out);
  return true;
}

function showCmd(st, name, session, args, out) {
  const what = pick(args[0], ['ip', 'ipv6', 'cdp', 'lldp', 'running-config', 'startup-config', 'version']);
  const alone = args.length === 1;
  if (what === 'version' && alone) {
    out('SwitchLab simulated IOS');
    return out(`${st.host} uptime: this lab session`);
  }
  if (what === 'running-config' && alone) return configLines(st).forEach(l => out(l));
  if (what === 'startup-config' && alone) return st.saved ? st.saved.forEach(l => out(l)) : out('startup-config is not present', 'ln-err');
  if (what === 'ip' && args.length === 2 && pick(args[1], ['route'])) return routeTable(st, out);
  if (args.length === 3 && pick(args[1], ['interface']) && pick(args[2], ['brief'])) {
    if (what === 'ip') return briefV4(st, out);
    if (what === 'ipv6') return briefV6(st, out);
  }
  if (args.length === 2 && (what === 'cdp' || what === 'lldp') && pick(args[1], ['neighbors'])) return neighbors(st, name, session, what, out);
  out('% Invalid input detected', 'ln-err');
}

// ---- the command line ----

// Runs one typed line on the router named name
function runRouter(st, name, session, line, out) {
  const w = line.toLowerCase().split(/\s+/);
  const mode = st.mode;
  // in interface mode "sh" means shutdown and "en" means end; elsewhere short forms resolve as usual
  const c = mode === 'ifc' && w[0] === 'sh' ? 'shutdown'
    : mode === 'ifc' && w[0] === 'en' ? 'end'
    : pick(w[0], ROUTER_CMDS[mode]);
  if (c === 'show') return showCmd(st, name, session, w.slice(1), out);
  const done = execCommand(c, w, st, () => save(st, out))
    || (c === 'ping' && ping(st, w[1], out))
    || (c === 'interface' && enterInterface(st, ifKey(st, w[1])))
    || (mode === 'config' && configCommand(st, c, w, line))
    || (mode === 'ifc' && interfaceCommand(st, c, w, line))
    || (mode === 'router' && routerCommand(st, c, w))
    || (mode === 'line' && lineCommand(st, c, w, line))
    || (mode === 'dhcp' && dhcpCommand(st, c, w))
    || (mode === 'nacl' && aclCommand(st, c, w))
    || leaveMode(c, st);
  if (!done) out('% Invalid input detected', 'ln-err');
}

// The handlers below return false when they do not know the command.
// Where two branches could both match an abbreviation, the earlier one wins, so keep their order.

// global configuration
function configCommand(st, c, w, line) {
  if (c === 'hostname' && w[1]) st.host = line.split(/\s+/)[1];
  else if (c === 'ip' && pick(w[1], ['dhcp']) && pick(w[2], ['pool']) && w[3]) {
    st.dhcp[w[3]] ||= {net: null, mask: null, gw: null, dns: [], domain: null};
    st.dhcpName = w[3];
    st.mode = 'dhcp';
  }
  else if (c === 'ip' && pick(w[1], ['dhcp']) && pick(w[2], ['excluded-address']) && DOTTED.test(w[3])) {
    st.dhcpEx.push([w[3], DOTTED.test(w[4]) ? w[4] : w[3]]);
  }
  // ip nat inside source list <acl> interface <if> overload
  else if (c === 'ip' && pick(w[1], ['nat']) && pick(w[2], ['inside']) && pick(w[3], ['source']) && pick(w[4], ['list'])
    && w.length === 9 && pick(w[6], ['interface']) && ifKey(st, w[7]) && pick(w[8], ['overload'])) {
    st.nat.pat.push({acl: w[5], iface: st.ifs[ifKey(st, w[7])].name});
  }
  // ip nat inside source static <inside> <outside>
  else if (c === 'ip' && pick(w[1], ['nat']) && pick(w[2], ['inside']) && pick(w[3], ['source']) && pick(w[4], ['static'])
    && w.length === 7 && DOTTED.test(w[5]) && DOTTED.test(w[6])) {
    st.nat.stat.push({in: w[5], out: w[6]});
  }
  else if (c === 'ip' && pick(w[1], ['name-server']) && DOTTED.test(w[2])) st.svc.dns.push(w[2]);
  else if (c === 'ntp' && pick(w[1], ['server']) && DOTTED.test(w[2])) st.svc.ntp.push(w[2]);
  else if (c === 'logging' && pick(w[1], ['host']) && DOTTED.test(w[2])) st.svc.log.push(w[2]);
  // numbered ACL: access-list <n> permit|deny ...
  else if (c === 'access-list' && w[1] && pick(w[2], ['permit', 'deny'])) {
    st.acls[w[1]] ||= {type: 'standard', entries: []};
    st.acls[w[1]].entries.push(w.slice(2).join(' '));
  }
  // named ACL: ip access-list standard|extended <name>
  else if (c === 'ip' && pick(w[1], ['access-list']) && pick(w[2], ['standard', 'extended']) && w[3]) {
    st.acls[w[3]] ||= {type: pick(w[2], ['standard', 'extended']), entries: []};
    st.aclName = w[3];
    st.mode = 'nacl';
  }
  // ip route <net> <mask> <next hop or exit interface> [distance]
  else if (c === 'ip' && pick(w[1], ['route']) && (w.length === 5 || w.length === 6) && DOTTED.test(w[2]) && DOTTED.test(w[3])
    && (DOTTED.test(w[4]) || ifKey(st, w[4])) && (w.length === 5 || isNum(w[5]))) {
    const nh = DOTTED.test(w[4]) ? w[4] : st.ifs[ifKey(st, w[4])].name;
    st.routes.push({net: w[2], mask: w[3], nh, dist: w.length === 6 ? Number(w[5]) : 1});
  }
  else if (c === 'no' && pick(w[1], ['ip']) && pick(w[2], ['route']) && w.length === 6) {
    st.routes = st.routes.filter(r => !(r.net === w[3] && r.mask === w[4] && r.nh === w[5]));
  }
  else if (c === 'line' && isLineCmd(w)) {
    st.line = pick(w[1], ['console', 'vty']);
    st.mode = 'line';
  }
  else if (c === 'enable' && pick(w[1], ['secret']) && w.length === 3) st.sec.secret = true;
  else if (c === 'service' && pick(w[1], ['password-encryption']) && w.length === 2) st.sec.enc = true;
  else if (c === 'no' && pick(w[1], ['service']) && pick(w[2], ['password-encryption']) && w.length === 3) st.sec.enc = false;
  else if (c === 'no' && pick(w[1], ['ip']) && pick(w[2], ['domain-lookup']) && w.length === 3) st.sec.nolookup = true;
  // banner motd <delimiter>text<delimiter>
  else if (c === 'banner' && pick(w[1], ['motd'])) {
    const m = line.match(/^\S+\s+\S+\s+(\S)(.+)\1\s*$/);
    if (!m) return false;
    st.sec.banner = m[2];
  }
  else if (c === 'router' && ((pick(w[1], ['ospf', 'eigrp']) && w.length === 3 && isPid(w[2])) || (pick(w[1], ['rip']) && w.length === 2))) {
    st.proto = pick(w[1], ['ospf', 'eigrp', 'rip']);
    st[st.proto].pid = st.proto === 'rip' ? 0 : Number(w[2]);
    st.mode = 'router';
  }
  else if (c === 'ipv6' && pick(w[1], ['unicast-routing']) && w.length === 2) st.v6routing = true;
  else if (c === 'no' && pick(w[1], ['ipv6']) && pick(w[2], ['unicast-routing']) && w.length === 3) st.v6routing = false;
  else if (c === 'ipv6' && pick(w[1], ['router']) && pick(w[2], ['ospf']) && w.length === 4 && isPid(w[3])) {
    st.proto = 'ospf6';
    st.ospf6.pid = Number(w[3]);
    st.mode = 'router';
  }
  else if (c === 'cdp' && pick(w[1], ['run'])) st.cdp = true;
  else if (c === 'lldp' && pick(w[1], ['run'])) st.lldp = true;
  else if (c === 'no' && pick(w[1], ['cdp']) && pick(w[2], ['run'])) st.cdp = false;
  else if (c === 'no' && pick(w[1], ['lldp']) && pick(w[2], ['run'])) st.lldp = false;
  else return false;
  return true;
}

// interface configuration
function interfaceCommand(st, c, w, line) {
  const i = st.ifs[st.iface];
  if (c === 'ip' && pick(w[1], ['address']) && w.length === 4 && DOTTED.test(w[2]) && DOTTED.test(w[3])) Object.assign(i, {ip: w[2], mask: w[3]});
  else if (c === 'ip' && pick(w[1], ['helper-address']) && DOTTED.test(w[2])) i.helpers.push(w[2]);
  else if (c === 'ip' && pick(w[1], ['nat']) && pick(w[2], ['inside', 'outside']) && w.length === 3) i.nat = pick(w[2], ['inside', 'outside']);
  else if (c === 'ip' && pick(w[1], ['access-group']) && w[2] && pick(w[3], ['in', 'out'])) {
    i[pick(w[3], ['in', 'out']) === 'in' ? 'aclIn' : 'aclOut'] = w[2];
  }
  // ip ospf <pid> area <area> / ipv6 ospf <pid> area <area>
  else if ((c === 'ip' || c === 'ipv6') && pick(w[1], ['ospf']) && w.length === 5 && isPid(w[2]) && pick(w[3], ['area']) && areaNum(w[4]) !== null) {
    i[c === 'ip' ? 'ospf' : 'ospf6'] = {pid: Number(w[2]), area: areaNum(w[4])};
  }
  else if (c === 'no' && pick(w[1], ['ip', 'ipv6']) && pick(w[2], ['ospf'])) i[pick(w[1], ['ip', 'ipv6']) === 'ip' ? 'ospf' : 'ospf6'] = null;
  else if (c === 'ipv6' && pick(w[1], ['address']) && w.length === 3) i.ip6 = w[2];
  else if (c === 'ipv6' && pick(w[1], ['address']) && w.length === 4 && pick(w[3], ['link-local'])) i.ll = w[2];
  else if (c === 'description' && w.length > 1) i.desc = line.slice(line.indexOf(' ') + 1);
  else if (c === 'encapsulation' && pick(w[1], ['dot1q']) && isNum(w[2])) i.encap = Number(w[2]);
  else if (c === 'shutdown') i.shut = true;
  else if (c === 'cdp' && pick(w[1], ['enable'])) i.cdp = true;
  else if (c === 'no' && pick(w[1], ['ip']) && pick(w[2], ['helper-address'])) i.helpers = [];
  else if (c === 'no' && pick(w[1], ['shutdown'])) i.shut = false;
  else if (c === 'no' && pick(w[1], ['ip']) && pick(w[2], ['address'])) Object.assign(i, {ip: null, mask: null});
  else if (c === 'no' && pick(w[1], ['ipv6']) && pick(w[2], ['address'])) Object.assign(i, {ip6: null, ll: null});
  else if (c === 'no' && pick(w[1], ['cdp']) && pick(w[2], ['enable'])) i.cdp = false;
  else return false;
  return true;
}

// router ospf / ipv6 router ospf / router eigrp / router rip configuration; the state's proto names the process
function routerCommand(st, c, w) {
  const p = st.proto;
  const o = st[p];
  // the interface may be typed as one word or two: Gi0/0 or GigabitEthernet 0/0
  const passiveKey = from => w.length > from && ifKey(st, w.slice(from).join(''));
  // network <net> <wildcard> area <area> (OSPFv3 has no network command)
  if (c === 'network' && p === 'ospf' && w.length === 5 && DOTTED.test(w[1]) && DOTTED.test(w[2]) && pick(w[3], ['area']) && areaNum(w[4]) !== null) {
    o.nets.push({net: w[1], wc: w[2], area: areaNum(w[4])});
  }
  // network <net> [wildcard] for EIGRP, network <net> for RIP; without a wildcard it is the whole classful network
  else if (c === 'network' && (p === 'eigrp' || p === 'rip') && DOTTED.test(w[1]) && (w.length === 2 || (p === 'eigrp' && w.length === 3 && DOTTED.test(w[2])))) {
    const cf = w.length === 2;
    const wc = cf ? classWc(w[1]) : w[2];
    o.nets.push({net: cf ? netText(w[1], [255, 255, 255, 255].map((b, n) => b ^ Number(wc.split('.')[n])).join('.')) : w[1], wc, cf});
  }
  else if (c === 'version' && p === 'rip' && w.length === 2 && (w[1] === '1' || w[1] === '2')) o.ver = Number(w[1]);
  else if (c === 'no' && pick(w[1], ['auto-summary']) && w.length === 2 && (p === 'eigrp' || p === 'rip')) o.nosum = true;
  else if (c === 'router-id' && p.startsWith('ospf') && w.length === 2 && DOTTED.test(w[1])) o.rid = w[1];
  else if (c === 'eigrp' && p === 'eigrp' && pick(w[1], ['router-id']) && w.length === 3 && DOTTED.test(w[2])) o.rid = w[2];
  else if (c === 'passive-interface' && passiveKey(1)) {
    const name = st.ifs[passiveKey(1)].name;
    if (!o.passive.includes(name)) o.passive.push(name);
  }
  else if (c === 'no' && pick(w[1], ['passive-interface']) && passiveKey(2)) {
    o.passive = o.passive.filter(p => p !== st.ifs[passiveKey(2)].name);
  }
  else if (c === 'default-information' && p !== 'eigrp' && pick(w[1], ['originate']) && w.length === 2) o.originate = true;
  else return false;
  return true;
}

// line console 0 / line vty 0 4 configuration
function lineCommand(st, c, w, line) {
  const l = st.lines[st.line];
  if (c === 'password' && w.length === 2) l.pw = line.split(/\s+/)[1];
  else if (c === 'login' && w.length === 1) l.login = true;
  else if (c === 'logging' && pick(w[1], ['synchronous']) && w.length === 2) l.sync = true;
  else if (c === 'exec-timeout' && (w.length === 2 || w.length === 3) && w.slice(1).every(isNum)) l.timeout = w.slice(1).join(' ') + (w.length === 2 ? ' 0' : '');
  else if (c === 'no' && pick(w[1], ['login']) && w.length === 2) l.login = false;
  else return false;
  return true;
}

// DHCP pool configuration
function dhcpCommand(st, c, w) {
  const pool = st.dhcp[st.dhcpName];
  if (c === 'network' && DOTTED.test(w[1]) && DOTTED.test(w[2])) Object.assign(pool, {net: w[1], mask: w[2]});
  else if (c === 'default-router' && DOTTED.test(w[1])) pool.gw = w[1];
  else if (c === 'dns-server' && DOTTED.test(w[1])) pool.dns.push(w[1]);
  else if (c === 'domain-name' && w[1]) pool.domain = w[1];
  else return false;
  return true;
}

// named ACL entries
function aclCommand(st, c, w) {
  if (c !== 'permit' && c !== 'deny') return false;
  st.acls[st.aclName].entries.push(w.join(' '));
  return true;
}

// The "?" list for the current mode
function routerHelpEntry(st) {
  const entry = ROUTER_HELP[st.mode];
  if (st.mode === 'router') return entry[st.proto];
  if (st.mode === 'nacl') return entry[st.acls[st.aclName].type === 'extended' ? 'ext' : 'std'];
  return entry;
}

// A router in the lab: the node's id is its hostname
function createRouter(node, session) {
  const st = freshRouter(node.id);
  const self = defineDevice({
    name: node.id, type: node.type, configurable: true, discoverable: true, state: st,
    prompt: () => st.host + SUFFIX[st.mode],
    ports: () => Object.values(st.ifs),
    gateway: key => usable(st.ifs[key]),
    routes: () => true,
    pools: () => Object.values(st.dhcp).map(p => ({...p, ex: st.dhcpEx})),
    // the subinterface of a VLAN, for a switch trunked to the physical interface key (router-on-a-stick)
    vlanGateway: (key, vlan) => (st.ifs[key].shut ? null : usable(Object.values(st.ifs).find(i => i.encap === vlan))),
    run(line, out) {
      if (line === '?' || line === 'help') return self.help('?', out);
      runRouter(st, node.id, session, line, out);
    },
    complete: line => tabComplete(line, ROUTER_KEYS[st.mode], st.mode === 'config' || st.mode === 'ifc' ? self.ports().map(p => p.name) : null),
    help: (line, out) => helpFor(line, routerHelpEntry(st), st.mode, 'r', out),
  });
  return self;
}
DEVICE_TYPES.router = createRouter;
