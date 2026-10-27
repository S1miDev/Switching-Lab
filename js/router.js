// R1: router command-line simulator (parsing, show output, running-config)
const DOTTED = /^\d{1,3}(\.\d{1,3}){3}$/;
const SHOWS = ['show ip interface brief', 'show ipv6 interface brief', 'show cdp neighbors', 'show lldp neighbors', 'show ip route', 'show running-config', 'show startup-config', 'show version'];
const KEYS = {
  user: ['enable', 'exit', 'ping', 'terminal length 0', ...SHOWS],
  priv: ['configure terminal', 'copy running-config startup-config', 'disable', 'exit', 'ping', 'terminal length 0', 'write memory', ...SHOWS],
  config: ['hostname', 'interface', 'line console 0', 'line vty 0 4', 'router ospf 1', 'router eigrp 100', 'router rip', 'ip route', 'no ip route', 'cdp run', 'no cdp run', 'lldp run', 'no lldp run', 'exit', 'end', ...SHOWS],
  line: ['exit', 'end'],
  router: ['exit', 'end'],
  ifc: ['description', 'ip address', 'ipv6 address', 'no ip address', 'no ipv6 address', 'cdp enable', 'no cdp enable', 'no shutdown', 'shutdown', 'exit', 'end', ...SHOWS]
};

function iface(name){ return {name, ip:null, mask:null, ip6:null, ll:null, desc:null, aclIn:null, aclOut:null, helpers:[], nat:null, cdp:true, shut:true}; }
function briefV4(){
  print('Interface    IP-Address       Status');
  Object.values(state.ifs).forEach(i => print(i.name.padEnd(13) + (i.ip || 'unassigned').padEnd(17) + (i.shut ? 'administratively down' : 'up')));
}
function briefV6(){
  print('Interface    IPv6-Address                     Link-local');
  Object.values(state.ifs).forEach(i => print(i.name.padEnd(13) + (i.ip6 || 'unassigned').padEnd(32) + (i.ll || 'none')));
}
function neighbors(proto){
  const on = proto === 'cdp' ? state.cdp : state.lldp;
  if (!on) return print(`% ${proto.toUpperCase()} is not enabled on R1`, 'ln-err');
  const rows = Object.values(state.ifs).filter(i => i.name === 'Gi0/0' && !i.shut && (proto === 'lldp' || i.cdp));
  print('Device ID    Local Intf');
  rows.forEach(() => print('S1'.padEnd(13) + 'Gi0/0'));
  print(`Total ${proto} entries displayed : ${rows.length}`);
}
const CMDS = {
  user: ['enable', 'exit', 'ping', 'show', 'terminal'],
  priv: ['configure', 'copy', 'disable', 'exit', 'ping', 'show', 'terminal', 'write'],
  config: ['hostname', 'interface', 'ip', 'cdp', 'lldp', 'no', 'ntp', 'logging', 'access-list', 'line', 'router', 'exit', 'end', 'show'],
  line: ['no', 'exit', 'end', 'show'], router: ['no', 'exit', 'end', 'show'],
  ifc: ['description', 'ip', 'ipv6', 'shutdown', 'no', 'cdp', 'exit', 'end', 'show', 'encapsulation'], nacl: ['permit', 'deny', 'exit', 'end', 'show'], dhcp: ['network', 'default-router', 'dns-server', 'domain-name', 'exit', 'end']
};
// Cisco-style short forms: an exact word wins, otherwise a unique prefix does
function pick(t, opts){
  if (!t) return null;
  if (opts.includes(t)) return t;
  const hits = opts.filter(o => o.startsWith(t));
  return hits.length === 1 ? hits[0] : null;
}
// accepts Gi0/0, gi0/0, g0/0, gig0/0, gigabitethernet0/0 or 0/0
function ifKey(t){
  const m = (t || '').toLowerCase().match(/^(?:gigabitethernet|gigabit|gig|gi|g)?(\d+\/\d+)(\.\d+)?$/);
  if (!m) return null;
  const k = 'gi' + m[1] + (m[2] || '');
  if (m[2] && !Object.hasOwn(state.ifs, k) && Object.hasOwn(state.ifs, 'gi' + m[1])) state.ifs[k] = {...iface('Gi' + m[1] + m[2]), sub:true, encap:null};
  return Object.hasOwn(state.ifs, k) ? k : null;
}
// IPv4 helpers for routes and ping
const ipInt = s => s.split('.').reduce((acc, o) => acc * 256 + Number(o), 0);
const inNet = (ip, mask, target) => ((ipInt(ip) & ipInt(mask)) >>> 0) === ((ipInt(target) & ipInt(mask)) >>> 0);
const netText = (ip, mask) => { const n = (ipInt(ip) & ipInt(mask)) >>> 0; return [24, 16, 8, 0].map(s => (n >>> s) & 255).join('.'); };
const prefixLen = mask => ipInt(mask).toString(2).split('').filter(b => b === '1').length;
function configLines(){
  const L = [`hostname ${state.host}`, state.cdp ? 'cdp run' : 'no cdp run'];
  if (state.lldp) L.push('lldp run');
  Object.values(state.ifs).forEach(i => {
    L.push(`interface ${i.name}`);
    if (i.desc) L.push(` description ${i.desc}`);
    if (i.encap) L.push(` encapsulation dot1Q ${i.encap}`);
    i.helpers.forEach(h => L.push(` ip helper-address ${h}`));
    if (i.nat) L.push(` ip nat ${i.nat}`);
    if (i.ip) L.push(` ip address ${i.ip} ${i.mask}`);
    if (i.ip6) L.push(` ipv6 address ${i.ip6}`);
    if (i.ll) L.push(` ipv6 address ${i.ll} link-local`);
    if (!i.cdp) L.push(' no cdp enable');
    L.push(i.shut ? ' shutdown' : ' no shutdown', '!');
  });
  Object.keys(state.acls).forEach(n => L.push(`ip access-list ${state.acls[n].type} ${n}`, ...state.acls[n].entries.map(e => ' ' + e), '!'));
  Object.keys(state.dhcp).forEach(n => { const d = state.dhcp[n]; L.push(`ip dhcp pool ${n}`, ` network ${d.net} ${d.mask}`, ` default-router ${d.gw}`, ...d.dns.map(x => ` dns-server ${x}`), ...(d.domain ? [` domain-name ${d.domain}`] : []), '!'); });
  state.dhcpEx.forEach(([a, b]) => L.push(`ip dhcp excluded-address ${a} ${b}`));
  state.nat.pat.forEach(p => L.push(`ip nat inside source list ${p.acl} interface ${p.iface} overload`));
  state.nat.stat.forEach(p => L.push(`ip nat inside source static ${p.in} ${p.out}`));
  state.svc.ntp.forEach(a => L.push(`ntp server ${a}`));
  state.svc.log.forEach(a => L.push(`logging host ${a}`));
  state.svc.dns.forEach(a => L.push(`ip name-server ${a}`));
  state.routes.forEach(r => L.push(`ip route ${r.net} ${r.mask} ${r.nh}${r.dist !== 1 ? ' ' + r.dist : ''}`));
  return L;
}
function save(){ state.saved = configLines(); print('Building configuration...'); print('[OK]', 'ln-ok'); }
function routeTable(){
  print('Codes: C - connected, S - static');
  Object.values(state.ifs).filter(i => i.ip && !i.shut).forEach(i => print(`C    ${netText(i.ip, i.mask)}/${prefixLen(i.mask)} is directly connected, ${i.name}`));
  state.routes.forEach(r => print(r.nh.startsWith('Gi') ? `S    ${r.net}/${prefixLen(r.mask)} is directly connected, ${r.nh}` : `S    ${r.net}/${prefixLen(r.mask)} [${r.dist}/0] via ${r.nh}`));
}
function ping(target){
  if (!DOTTED.test(target || '')) return print('% Unrecognized host or address', 'ln-err');
  const hit = Object.values(state.ifs).some(i => i.ip && !i.shut && inNet(i.ip, i.mask, target));
  print(`Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`);
  print(hit ? '!!!!!' : '.....', hit ? 'ln-ok' : 'ln-err');
  print(hit ? 'Success rate is 100 percent (5/5)' : 'Success rate is 0 percent (0/5)', hit ? 'ln-ok' : 'ln-err');
}
function showCmd(args){
  const first = pick(args[0], ['ip', 'ipv6', 'cdp', 'lldp', 'running-config', 'startup-config', 'version']);
  if (first === 'version' && args.length === 1) { print('SwitchLab simulated IOS'); return print(`${state.host} uptime: this lab session`); }
  if (first === 'running-config' && args.length === 1) return configLines().forEach(l => print(l));
  if (first === 'startup-config' && args.length === 1) return state.saved ? state.saved.forEach(l => print(l)) : print('startup-config is not present', 'ln-err');
  if (first === 'ip' && args.length === 2 && pick(args[1], ['route'])) return routeTable();
  if (args.length === 3 && pick(args[1], ['interface']) && pick(args[2], ['brief'])) {
    if (first === 'ip') return briefV4();
    if (first === 'ipv6') return briefV6();
  }
  if (args.length === 2 && (first === 'cdp' || first === 'lldp') && pick(args[1], ['neighbors'])) return neighbors(first);
  print('% Invalid input detected', 'ln-err');
}
function run(raw){
  const line = raw.trim();
  echo(line);
  if (!line) return;
  if (line.length > 1 && line.endsWith('?')) return helpNext(line);
  if (dev === 'S1') return runSw(line);
  if (dev !== 'R1') return print('% Not configurable in this lab', 'ln-err');
  if (line === '?' || line === 'help') return help();
  const w = line.toLowerCase().split(/\s+/), m = state.mode, cmd = w[0], ifs = state.ifs;
  const cur = () => ifs[state.iface];
  // "sh" means shutdown in interface mode and show everywhere else
  const c = m === 'ifc' && cmd === 'sh' ? 'shutdown' : m === 'ifc' && cmd === 'en' ? 'end' : pick(cmd, CMDS[m]);
  if (c === 'show') return showCmd(w.slice(1));
  if (c === 'enable') state.mode = 'priv';
  else if (c === 'disable') state.mode = 'user';
  else if (c === 'configure' && pick(w[1], ['terminal'])) state.mode = 'config';
  else if (c === 'write') save();
  else if (c === 'copy' && pick(w[1], ['running-config']) && pick(w[2], ['startup-config'])) save();
  else if (c === 'ping') ping(w[1]);
  else if (c === 'terminal' && pick(w[1], ['length'])) { /* no output */ }
  else if (c === 'hostname' && m === 'config' && w[1]) state.host = raw.trim().split(/\s+/)[1];
  else if (c === 'interface' && m === 'config' && ifKey(w[1])) { state.iface = ifKey(w[1]); state.mode = 'ifc'; }
  else if (c === 'ip' && m === 'config' && pick(w[1], ['dhcp']) && pick(w[2], ['pool']) && w[3]) { state.dhcp[w[3]] = state.dhcp[w[3]] || {net:null, mask:null, gw:null, dns:[], domain:null}; state.dhcpName = w[3]; state.mode = 'dhcp'; }
  else if (c === 'ip' && m === 'config' && pick(w[1], ['dhcp']) && pick(w[2], ['excluded-address']) && DOTTED.test(w[3] || '')) state.dhcpEx.push([w[3], DOTTED.test(w[4] || '') ? w[4] : w[3]]);
  else if (c === 'ip' && m === 'config' && pick(w[1], ['nat']) && pick(w[2], ['inside']) && pick(w[3], ['source']) && pick(w[4], ['list']) && w.length === 9 && pick(w[6], ['interface']) && ifKey(w[7]) && pick(w[8], ['overload'])) state.nat.pat.push({acl: w[5], iface: state.ifs[ifKey(w[7])].name});
  else if (c === 'ip' && m === 'config' && pick(w[1], ['nat']) && pick(w[2], ['inside']) && pick(w[3], ['source']) && pick(w[4], ['static']) && w.length === 7 && DOTTED.test(w[5]) && DOTTED.test(w[6])) state.nat.stat.push({in: w[5], out: w[6]});
  else if (c === 'ip' && m === 'config' && pick(w[1], ['name-server']) && DOTTED.test(w[2] || '')) state.svc.dns.push(w[2]);
  else if (c === 'ntp' && m === 'config' && pick(w[1], ['server']) && DOTTED.test(w[2] || '')) state.svc.ntp.push(w[2]);
  else if (c === 'logging' && m === 'config' && pick(w[1], ['host']) && DOTTED.test(w[2] || '')) state.svc.log.push(w[2]);
  else if (c === 'access-list' && m === 'config' && w[1] && pick(w[2], ['permit', 'deny'])) { state.acls[w[1]] = state.acls[w[1]] || {type:'standard', entries:[]}; state.acls[w[1]].entries.push(w.slice(2).join(' ')); }
  else if (c === 'ip' && m === 'config' && pick(w[1], ['access-list']) && pick(w[2], ['standard', 'extended']) && w[3]) { const t = pick(w[2], ['standard', 'extended']); state.acls[w[3]] = state.acls[w[3]] || {type:t, entries:[]}; state.aclName = w[3]; state.mode = 'nacl'; }
  else if (c === 'ip' && m === 'config' && pick(w[1], ['route']) && (w.length === 5 || w.length === 6) && DOTTED.test(w[2]) && DOTTED.test(w[3]) && (DOTTED.test(w[4]) || ifKey(w[4])) && (w.length === 5 || /^\d+$/.test(w[5]))) state.routes.push({net:w[2], mask:w[3], nh: DOTTED.test(w[4]) ? w[4] : state.ifs[ifKey(w[4])].name, dist: w.length === 6 ? Number(w[5]) : 1});
  else if (c === 'no' && m === 'config' && pick(w[1], ['ip']) && pick(w[2], ['route']) && w.length === 6) state.routes = state.routes.filter(r => !(r.net === w[3] && r.mask === w[4] && r.nh === w[5]));
  else if (c === 'ip' && m === 'ifc' && pick(w[1], ['address']) && w.length === 4 && DOTTED.test(w[2]) && DOTTED.test(w[3])) Object.assign(cur(), {ip:w[2], mask:w[3]});
  else if (c === 'ip' && m === 'ifc' && pick(w[1], ['helper-address']) && DOTTED.test(w[2] || '')) cur().helpers.push(w[2]);
  else if (c === 'ip' && m === 'ifc' && pick(w[1], ['nat']) && pick(w[2], ['inside', 'outside']) && w.length === 3) cur().nat = pick(w[2], ['inside', 'outside']);
  else if (c === 'no' && m === 'ifc' && pick(w[1], ['ip']) && pick(w[2], ['helper-address'])) cur().helpers = [];
  else if (c === 'ip' && m === 'ifc' && pick(w[1], ['access-group']) && w[2] && pick(w[3], ['in', 'out'])) cur()[pick(w[3], ['in', 'out']) === 'in' ? 'aclIn' : 'aclOut'] = w[2];
  else if (c === 'ipv6' && m === 'ifc' && pick(w[1], ['address']) && w.length === 3) cur().ip6 = w[2];
  else if (c === 'ipv6' && m === 'ifc' && pick(w[1], ['address']) && w.length === 4 && pick(w[3], ['link-local'])) cur().ll = w[2];
  else if (c === 'description' && m === 'ifc' && w.length > 1) cur().desc = raw.trim().slice(raw.trim().indexOf(' ') + 1);
  else if (c === 'encapsulation' && m === 'ifc' && pick(w[1], ['dot1q']) && /^\d+$/.test(w[2] || '')) cur().encap = Number(w[2]);
  else if (c === 'shutdown' && m === 'ifc') cur().shut = true;
  else if (c === 'line' && m === 'config' && ((pick(w[1], ['console']) && w.length === 3 && /^\d+$/.test(w[2])) || (pick(w[1], ['vty']) && w.length === 4 && /^\d+$/.test(w[2]) && /^\d+$/.test(w[3])))) state.mode = 'line';
  else if (c === 'router' && m === 'config' && ((pick(w[1], ['ospf', 'eigrp']) && w.length === 3 && /^\d+$/.test(w[2]) && Number(w[2]) >= 1 && Number(w[2]) <= 65535) || (pick(w[1], ['rip']) && w.length === 2))) { state.proto = pick(w[1], ['ospf', 'eigrp', 'rip']); state.mode = 'router'; }
  else if (c === 'cdp' && m === 'ifc' && pick(w[1], ['enable'])) cur().cdp = true;
  else if (c === 'cdp' && m === 'config' && pick(w[1], ['run'])) state.cdp = true;
  else if (c === 'lldp' && m === 'config' && pick(w[1], ['run'])) state.lldp = true;
  else if (c === 'no' && m === 'ifc' && pick(w[1], ['shutdown'])) cur().shut = false;
  else if (c === 'no' && m === 'ifc' && pick(w[1], ['ip']) && pick(w[2], ['address'])) Object.assign(cur(), {ip:null, mask:null});
  else if (c === 'no' && m === 'ifc' && pick(w[1], ['ipv6']) && pick(w[2], ['address'])) Object.assign(cur(), {ip6:null, ll:null});
  else if (c === 'no' && m === 'ifc' && pick(w[1], ['cdp']) && pick(w[2], ['enable'])) cur().cdp = false;
  else if (c === 'no' && m === 'config' && pick(w[1], ['cdp']) && pick(w[2], ['run'])) state.cdp = false;
  else if (c === 'no' && m === 'config' && pick(w[1], ['lldp']) && pick(w[2], ['run'])) state.lldp = false;
  else if (c === 'network' && m === 'dhcp' && DOTTED.test(w[1] || '') && DOTTED.test(w[2] || '')) { state.dhcp[state.dhcpName].net = w[1]; state.dhcp[state.dhcpName].mask = w[2]; }
  else if (c === 'default-router' && m === 'dhcp' && DOTTED.test(w[1] || '')) state.dhcp[state.dhcpName].gw = w[1];
  else if (c === 'dns-server' && m === 'dhcp' && DOTTED.test(w[1] || '')) state.dhcp[state.dhcpName].dns.push(w[1]);
  else if (c === 'domain-name' && m === 'dhcp' && w[1]) state.dhcp[state.dhcpName].domain = w[1];
  else if ((c === 'permit' || c === 'deny') && m === 'nacl') state.acls[state.aclName].entries.push(w.join(' '));
  else if (c === 'exit') state.mode = {ifc:'config', config:'priv', priv:'user', user:'user', nacl:'config', dhcp:'config', line:'config', router:'config'}[m];
  else if (c === 'end' && (m === 'config' || m === 'ifc' || m === 'nacl' || m === 'dhcp' || m === 'line' || m === 'router')) state.mode = 'priv';
  else print('% Invalid input detected', 'ln-err');
  renderPrompt();
}
