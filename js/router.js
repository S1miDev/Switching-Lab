// R1: the router's command line (parsing, show output and running-config)

const DOTTED = /^\d{1,3}(\.\d{1,3}){3}$/; // an IPv4 address or mask
const isNum = text => /^\d+$/.test(text);
const isPid = text => isNum(text) && Number(text) >= 1 && Number(text) <= 65535; // routing process ID

// The words each mode accepts. Short forms are resolved against these lists (see pick).
const CMDS = {
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
const KEYS = {
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

// Where "exit" leaves each mode, on R1 and S1
const EXIT_TO = {user: 'user', priv: 'user', config: 'priv', ifc: 'config', vlan: 'config', line: 'config', router: 'config', nacl: 'config', dhcp: 'config'};

function freshRouter() {
  return {
    mode: 'user', iface: null, host: 'R1', cdp: true, lldp: false, saved: null, proto: null,
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

// Cisco-style short forms: an exact word wins, otherwise a unique prefix does
function pick(word, options) {
  if (!word) return null;
  if (options.includes(word)) return word;
  const hits = options.filter(o => o.startsWith(word));
  return hits.length === 1 ? hits[0] : null;
}

// "line console 0" or "line vty 0 4" (shared with S1)
function isLineCmd(w) {
  return (pick(w[1], ['console']) && w.length === 3 && isNum(w[2])) ||
    (pick(w[1], ['vty']) && w.length === 4 && isNum(w[2]) && isNum(w[3]));
}

// Interface name -> key in state.ifs. Accepts Gi0/0, g0/0, gig0/0, gigabitethernet0/0 or 0/0.
// A subinterface such as Gi0/0.10 is created the first time it is named.
function ifKey(text) {
  const m = (text || '').match(/^(?:gigabitethernet|gigabit|gig|gi|g)?(\d+\/\d+)(\.\d+)?$/);
  if (!m) return null;
  const [, port, sub = ''] = m;
  const key = 'gi' + port + sub;
  if (sub && !state.ifs[key] && state.ifs['gi' + port]) state.ifs[key] = iface('Gi' + port + sub);
  return state.ifs[key] ? key : null;
}

// IPv4 helpers for routes and ping
const ipInt = ip => ip.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0);
const inNet = (ip, mask, target) => ((ipInt(ip) & ipInt(mask)) >>> 0) === ((ipInt(target) & ipInt(mask)) >>> 0);
const netText = (ip, mask) => {
  const n = (ipInt(ip) & ipInt(mask)) >>> 0;
  return [24, 16, 8, 0].map(shift => (n >>> shift) & 255).join('.');
};
const prefixLen = mask => ipInt(mask).toString(2).split('').filter(bit => bit === '1').length;

function configLines() {
  const lines = [`hostname ${state.host}`, state.cdp ? 'cdp run' : 'no cdp run'];
  if (state.sec.secret) lines.push('enable secret 5 $1$mERr$hashed');
  if (state.sec.enc) lines.push('service password-encryption');
  if (state.sec.nolookup) lines.push('no ip domain-lookup');
  if (state.sec.banner) lines.push(`banner motd ^C${state.sec.banner}^C`);
  if (state.lldp) lines.push('lldp run');
  for (const i of Object.values(state.ifs)) {
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
  for (const [name, acl] of Object.entries(state.acls)) {
    lines.push(`ip access-list ${acl.type} ${name}`, ...acl.entries.map(e => ' ' + e), '!');
  }
  for (const [name, pool] of Object.entries(state.dhcp)) {
    lines.push(`ip dhcp pool ${name}`, ` network ${pool.net} ${pool.mask}`, ` default-router ${pool.gw}`, ...pool.dns.map(d => ` dns-server ${d}`));
    if (pool.domain) lines.push(` domain-name ${pool.domain}`);
    lines.push('!');
  }
  for (const [first, last] of state.dhcpEx) lines.push(`ip dhcp excluded-address ${first} ${last}`);
  for (const p of state.nat.pat) lines.push(`ip nat inside source list ${p.acl} interface ${p.iface} overload`);
  for (const p of state.nat.stat) lines.push(`ip nat inside source static ${p.in} ${p.out}`);
  for (const ip of state.svc.ntp) lines.push(`ntp server ${ip}`);
  for (const ip of state.svc.log) lines.push(`logging host ${ip}`);
  for (const ip of state.svc.dns) lines.push(`ip name-server ${ip}`);
  for (const r of state.routes) lines.push(`ip route ${r.net} ${r.mask} ${r.nh}${r.dist !== 1 ? ' ' + r.dist : ''}`);
  if (state.v6routing) lines.push('ipv6 unicast-routing');
  for (const [name, head] of [['console', 'line console 0'], ['vty', 'line vty 0 4']]) {
    const l = state.lines[name];
    lines.push(head);
    if (l.timeout) lines.push(` exec-timeout ${l.timeout}`);
    if (l.pw) lines.push(state.sec.enc ? ' password 7 0822455D0A16' : ` password ${l.pw}`);
    if (l.sync) lines.push(' logging synchronous');
    if (l.login) lines.push(' login');
    lines.push('!');
  }
  for (const [head, o] of [['router ospf', state.ospf], ['ipv6 router ospf', state.ospf6], ['router eigrp', state.eigrp], ['router rip', state.rip]]) {
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

function save() {
  state.saved = configLines();
  print('Building configuration...');
  print('[OK]', 'ln-ok');
}

// ---- show commands ----

function briefV4() {
  print('Interface    IP-Address       Status');
  for (const i of Object.values(state.ifs)) print(i.name.padEnd(13) + (i.ip || 'unassigned').padEnd(17) + (i.shut ? 'administratively down' : 'up'));
}

function briefV6() {
  print('Interface    IPv6-Address                     Link-local');
  for (const i of Object.values(state.ifs)) print(i.name.padEnd(13) + (i.ip6 || 'unassigned').padEnd(32) + (i.ll || 'none'));
}

// S1 is the only neighbour: it is seen on Gi0/0 while that link is up (and, for CDP, CDP is on there)
function neighbors(proto) {
  if (!state[proto]) return print(`% ${proto.toUpperCase()} is not enabled on R1`, 'ln-err');
  const link = state.ifs['gi0/0'];
  const seen = !link.shut && (proto === 'lldp' || link.cdp);
  print('Device ID    Local Intf');
  if (seen) print('S1'.padEnd(13) + 'Gi0/0');
  print(`Total ${proto} entries displayed : ${seen ? 1 : 0}`);
}

function routeTable() {
  print('Codes: C - connected, S - static');
  for (const i of Object.values(state.ifs)) {
    if (i.ip && !i.shut) print(`C    ${netText(i.ip, i.mask)}/${prefixLen(i.mask)} is directly connected, ${i.name}`);
  }
  for (const r of state.routes) {
    const prefix = `${r.net}/${prefixLen(r.mask)}`;
    print(r.nh.startsWith('Gi') ? `S    ${prefix} is directly connected, ${r.nh}` : `S    ${prefix} [${r.dist}/0] via ${r.nh}`);
  }
}

// a ping succeeds when the target is on a connected network that is up
function ping(target) {
  if (!DOTTED.test(target)) return print('% Unrecognized host or address', 'ln-err');
  const ok = Object.values(state.ifs).some(i => i.ip && !i.shut && inNet(i.ip, i.mask, target));
  const cls = ok ? 'ln-ok' : 'ln-err';
  print(`Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`);
  print(ok ? '!!!!!' : '.....', cls);
  print(ok ? 'Success rate is 100 percent (5/5)' : 'Success rate is 0 percent (0/5)', cls);
}

function showCmd(args) {
  const what = pick(args[0], ['ip', 'ipv6', 'cdp', 'lldp', 'running-config', 'startup-config', 'version']);
  const alone = args.length === 1;
  if (what === 'version' && alone) {
    print('SwitchLab simulated IOS');
    return print(`${state.host} uptime: this lab session`);
  }
  if (what === 'running-config' && alone) return configLines().forEach(l => print(l));
  if (what === 'startup-config' && alone) return state.saved ? state.saved.forEach(l => print(l)) : print('startup-config is not present', 'ln-err');
  if (what === 'ip' && args.length === 2 && pick(args[1], ['route'])) return routeTable();
  if (args.length === 3 && pick(args[1], ['interface']) && pick(args[2], ['brief'])) {
    if (what === 'ip') return briefV4();
    if (what === 'ipv6') return briefV6();
  }
  if (args.length === 2 && (what === 'cdp' || what === 'lldp') && pick(args[1], ['neighbors'])) return neighbors(what);
  print('% Invalid input detected', 'ln-err');
}

// ---- the command line ----

// Runs one typed line on whichever device's console is open
function run(raw) {
  const line = raw.trim();
  echo(line);
  if (!line) return;
  if (line.length > 1 && line.endsWith('?')) return helpNext(line);
  if (dev === 'S1') return runSw(line);
  if (dev !== 'R1') return print('% Not configurable in this lab', 'ln-err');
  if (line === '?' || line === 'help') return help();

  const w = line.toLowerCase().split(/\s+/);
  const mode = state.mode;
  // in interface mode "sh" means shutdown and "en" means end; elsewhere short forms resolve as usual
  const c = mode === 'ifc' && w[0] === 'sh' ? 'shutdown'
    : mode === 'ifc' && w[0] === 'en' ? 'end'
    : pick(w[0], CMDS[mode]);
  if (c === 'show') return showCmd(w.slice(1));
  const done = execCommand(c, w, state, save)
    || (c === 'interface' && enterInterface(state, ifKey(w[1])))
    || (mode === 'config' && configCommand(c, w, line))
    || (mode === 'ifc' && interfaceCommand(c, w, line))
    || (mode === 'router' && routerCommand(c, w))
    || (mode === 'line' && lineCommand(c, w, line))
    || (mode === 'dhcp' && dhcpCommand(c, w))
    || (mode === 'nacl' && aclCommand(c, w))
    || leaveMode(c, state);
  if (!done) print('% Invalid input detected', 'ln-err');
  renderPrompt();
}

// The handlers below return false when they do not know the command.
// Where two branches could both match an abbreviation, the earlier one wins, so keep their order.

// User and privileged EXEC, shared with S1 (st is R1's or S1's state, save its save function).
// Only R1 lists ping and terminal in CMDS, so S1 never reaches those two.
function execCommand(c, w, st, save) {
  if (c === 'enable' && st.mode === 'user') st.mode = 'priv'; // in config mode "enable secret" is a configuration command
  else if (c === 'disable') st.mode = 'user';
  else if (c === 'configure' && pick(w[1], ['terminal'])) st.mode = 'config';
  else if (c === 'write' || (c === 'copy' && pick(w[1], ['running-config']) && pick(w[2], ['startup-config']))) save();
  else if (c === 'ping') ping(w[1]);
  else if (c === 'terminal' && pick(w[1], ['length'])) { /* accepted; nothing to page here */ }
  else return false;
  return true;
}

// "interface <name>", shared with S1; key is null when the name is not one of the device's ports
function enterInterface(st, key) {
  if (!key) return false;
  st.iface = key;
  st.mode = 'ifc';
  return true;
}

// global configuration
function configCommand(c, w, line) {
  if (c === 'hostname' && w[1]) state.host = line.split(/\s+/)[1];
  else if (c === 'ip' && pick(w[1], ['dhcp']) && pick(w[2], ['pool']) && w[3]) {
    state.dhcp[w[3]] ||= {net: null, mask: null, gw: null, dns: [], domain: null};
    state.dhcpName = w[3];
    state.mode = 'dhcp';
  }
  else if (c === 'ip' && pick(w[1], ['dhcp']) && pick(w[2], ['excluded-address']) && DOTTED.test(w[3])) {
    state.dhcpEx.push([w[3], DOTTED.test(w[4]) ? w[4] : w[3]]);
  }
  // ip nat inside source list <acl> interface <if> overload
  else if (c === 'ip' && pick(w[1], ['nat']) && pick(w[2], ['inside']) && pick(w[3], ['source']) && pick(w[4], ['list'])
    && w.length === 9 && pick(w[6], ['interface']) && ifKey(w[7]) && pick(w[8], ['overload'])) {
    state.nat.pat.push({acl: w[5], iface: state.ifs[ifKey(w[7])].name});
  }
  // ip nat inside source static <inside> <outside>
  else if (c === 'ip' && pick(w[1], ['nat']) && pick(w[2], ['inside']) && pick(w[3], ['source']) && pick(w[4], ['static'])
    && w.length === 7 && DOTTED.test(w[5]) && DOTTED.test(w[6])) {
    state.nat.stat.push({in: w[5], out: w[6]});
  }
  else if (c === 'ip' && pick(w[1], ['name-server']) && DOTTED.test(w[2])) state.svc.dns.push(w[2]);
  else if (c === 'ntp' && pick(w[1], ['server']) && DOTTED.test(w[2])) state.svc.ntp.push(w[2]);
  else if (c === 'logging' && pick(w[1], ['host']) && DOTTED.test(w[2])) state.svc.log.push(w[2]);
  // numbered ACL: access-list <n> permit|deny ...
  else if (c === 'access-list' && w[1] && pick(w[2], ['permit', 'deny'])) {
    state.acls[w[1]] ||= {type: 'standard', entries: []};
    state.acls[w[1]].entries.push(w.slice(2).join(' '));
  }
  // named ACL: ip access-list standard|extended <name>
  else if (c === 'ip' && pick(w[1], ['access-list']) && pick(w[2], ['standard', 'extended']) && w[3]) {
    state.acls[w[3]] ||= {type: pick(w[2], ['standard', 'extended']), entries: []};
    state.aclName = w[3];
    state.mode = 'nacl';
  }
  // ip route <net> <mask> <next hop or exit interface> [distance]
  else if (c === 'ip' && pick(w[1], ['route']) && (w.length === 5 || w.length === 6) && DOTTED.test(w[2]) && DOTTED.test(w[3])
    && (DOTTED.test(w[4]) || ifKey(w[4])) && (w.length === 5 || isNum(w[5]))) {
    const nh = DOTTED.test(w[4]) ? w[4] : state.ifs[ifKey(w[4])].name;
    state.routes.push({net: w[2], mask: w[3], nh, dist: w.length === 6 ? Number(w[5]) : 1});
  }
  else if (c === 'no' && pick(w[1], ['ip']) && pick(w[2], ['route']) && w.length === 6) {
    state.routes = state.routes.filter(r => !(r.net === w[3] && r.mask === w[4] && r.nh === w[5]));
  }
  else if (c === 'line' && isLineCmd(w)) {
    state.line = pick(w[1], ['console', 'vty']);
    state.mode = 'line';
  }
  else if (c === 'enable' && pick(w[1], ['secret']) && w.length === 3) state.sec.secret = true;
  else if (c === 'service' && pick(w[1], ['password-encryption']) && w.length === 2) state.sec.enc = true;
  else if (c === 'no' && pick(w[1], ['service']) && pick(w[2], ['password-encryption']) && w.length === 3) state.sec.enc = false;
  else if (c === 'no' && pick(w[1], ['ip']) && pick(w[2], ['domain-lookup']) && w.length === 3) state.sec.nolookup = true;
  // banner motd <delimiter>text<delimiter>
  else if (c === 'banner' && pick(w[1], ['motd'])) {
    const m = line.match(/^\S+\s+\S+\s+(\S)(.+)\1\s*$/);
    if (!m) return false;
    state.sec.banner = m[2];
  }
  else if (c === 'router' && ((pick(w[1], ['ospf', 'eigrp']) && w.length === 3 && isPid(w[2])) || (pick(w[1], ['rip']) && w.length === 2))) {
    state.proto = pick(w[1], ['ospf', 'eigrp', 'rip']);
    state[state.proto].pid = state.proto === 'rip' ? 0 : Number(w[2]);
    state.mode = 'router';
  }
  else if (c === 'ipv6' && pick(w[1], ['unicast-routing']) && w.length === 2) state.v6routing = true;
  else if (c === 'no' && pick(w[1], ['ipv6']) && pick(w[2], ['unicast-routing']) && w.length === 3) state.v6routing = false;
  else if (c === 'ipv6' && pick(w[1], ['router']) && pick(w[2], ['ospf']) && w.length === 4 && isPid(w[3])) {
    state.proto = 'ospf6';
    state.ospf6.pid = Number(w[3]);
    state.mode = 'router';
  }
  else if (c === 'cdp' && pick(w[1], ['run'])) state.cdp = true;
  else if (c === 'lldp' && pick(w[1], ['run'])) state.lldp = true;
  else if (c === 'no' && pick(w[1], ['cdp']) && pick(w[2], ['run'])) state.cdp = false;
  else if (c === 'no' && pick(w[1], ['lldp']) && pick(w[2], ['run'])) state.lldp = false;
  else return false;
  return true;
}

// interface configuration
function interfaceCommand(c, w, line) {
  const i = state.ifs[state.iface];
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

// router ospf / ipv6 router ospf / router eigrp / router rip configuration; state.proto names the process in state
function routerCommand(c, w) {
  const p = state.proto;
  const o = state[p];
  // the interface may be typed as one word or two: Gi0/0 or GigabitEthernet 0/0
  const passiveKey = from => w.length > from && ifKey(w.slice(from).join(''));
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
    const name = state.ifs[passiveKey(1)].name;
    if (!o.passive.includes(name)) o.passive.push(name);
  }
  else if (c === 'no' && pick(w[1], ['passive-interface']) && passiveKey(2)) {
    o.passive = o.passive.filter(p => p !== state.ifs[passiveKey(2)].name);
  }
  else if (c === 'default-information' && p !== 'eigrp' && pick(w[1], ['originate']) && w.length === 2) o.originate = true;
  else return false;
  return true;
}

// line console 0 / line vty 0 4 configuration
function lineCommand(c, w, line) {
  const l = state.lines[state.line];
  if (c === 'password' && w.length === 2) l.pw = line.split(/\s+/)[1];
  else if (c === 'login' && w.length === 1) l.login = true;
  else if (c === 'logging' && pick(w[1], ['synchronous']) && w.length === 2) l.sync = true;
  else if (c === 'exec-timeout' && (w.length === 2 || w.length === 3) && w.slice(1).every(isNum)) l.timeout = w.slice(1).join(' ') + (w.length === 2 ? ' 0' : '');
  else if (c === 'no' && pick(w[1], ['login']) && w.length === 2) l.login = false;
  else return false;
  return true;
}

// DHCP pool configuration
function dhcpCommand(c, w) {
  const pool = state.dhcp[state.dhcpName];
  if (c === 'network' && DOTTED.test(w[1]) && DOTTED.test(w[2])) Object.assign(pool, {net: w[1], mask: w[2]});
  else if (c === 'default-router' && DOTTED.test(w[1])) pool.gw = w[1];
  else if (c === 'dns-server' && DOTTED.test(w[1])) pool.dns.push(w[1]);
  else if (c === 'domain-name' && w[1]) pool.domain = w[1];
  else return false;
  return true;
}

// named ACL entries
function aclCommand(c, w) {
  if (c !== 'permit' && c !== 'deny') return false;
  state.acls[state.aclName].entries.push(w.join(' '));
  return true;
}

// "exit" goes up one level, "end" back to privileged EXEC. Shared with S1: st is R1's or S1's state.
function leaveMode(c, st) {
  if (c === 'exit') st.mode = EXIT_TO[st.mode];
  else if (c === 'end') st.mode = 'priv';
  else return false;
  return true;
}
