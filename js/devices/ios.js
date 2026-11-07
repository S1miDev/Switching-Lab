// What the IOS-style devices share: word matching, IPv4 helpers, the EXEC commands, Tab completion and ping output.

const DOTTED = /^\d{1,3}(\.\d{1,3}){3}$/; // an IPv4 address or mask
const isNum = text => /^\d+$/.test(text);

// Where "exit" leaves each mode, on a router and a switch
const EXIT_TO = {user: 'user', priv: 'user', config: 'priv', ifc: 'config', vlan: 'config', line: 'config', router: 'config', nacl: 'config', dhcp: 'config'};

// the end of the prompt for each mode
const SUFFIX = {user: '>', priv: '#', config: '(config)#', ifc: '(config-if)#', vlan: '(config-vlan)#', nacl: '(config-nacl)#',
  dhcp: '(config-dhcp)#', line: '(config-line)#', router: '(config-router)#', pc: '>'};

// Cisco-style short forms: an exact word wins, otherwise a unique prefix does
function pick(word, options) {
  if (!word) return null;
  if (options.includes(word)) return word;
  const hits = options.filter(o => o.startsWith(word));
  return hits.length === 1 ? hits[0] : null;
}

// "line console 0" or "line vty 0 4"
function isLineCmd(w) {
  return (pick(w[1], ['console']) && w.length === 3 && isNum(w[2])) ||
    (pick(w[1], ['vty']) && w.length === 4 && isNum(w[2]) && isNum(w[3]));
}

// IPv4 helpers for routes and ping
const ipInt = ip => ip.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0);
const ipText = n => [24, 16, 8, 0].map(shift => (n >>> shift) & 255).join('.');
const inNet = (ip, mask, target) => ((ipInt(ip) & ipInt(mask)) >>> 0) === ((ipInt(target) & ipInt(mask)) >>> 0);
const netText = (ip, mask) => ipText((ipInt(ip) & ipInt(mask)) >>> 0);
const prefixLen = mask => ipInt(mask).toString(2).split('').filter(bit => bit === '1').length;

// IPv6 helpers: an address with or without a prefix length, and its canonical form for comparing (lower case, no leading zeros,
// all 8 groups written out), so 2001:DB8:0:1::/64 and 2001:db8::1:0:0:0:0/64 are the same
const V6 = /^[0-9a-f:]+(\/\d{1,3})?$/i;
const isV6 = text => !!text && text.includes(':') && V6.test(text);
function v6Canon(text) {
  const [addr, len] = text.toLowerCase().split('/');
  const [head, tail] = addr.includes('::') ? addr.split('::') : [addr, null];
  const left = head ? head.split(':') : [], right = tail ? tail.split(':') : [];
  const groups = tail === null ? left : [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
  return groups.map(g => parseInt(g || '0', 16).toString(16)).join(':') + (len ? '/' + len : '');
}

// The 64-bit interface ID EUI-64 builds from a MAC (aabb.ccdd.eeff): flip bit 7 of the first byte and put FFFE in the middle.
// Returns the four groups, e.g. 'c801:1aff:fe2b:0'
function eui64(mac) {
  const hex = mac.replace(/\./g, '');
  const b = hex.match(/../g).map(h => parseInt(h, 16));
  b[0] ^= 2;
  const bytes = [...b.slice(0, 3), 0xff, 0xfe, ...b.slice(3)];
  return [0, 2, 4, 6].map(i => ((bytes[i] << 8) | bytes[i + 1]).toString(16)).join(':');
}

// a VLAN list such as 10,20,30-32 -> [10, 20, 30, 31, 32], or null when it is not one
// the other way round: [1, 2, 3, 5] -> '1-3,5', as IOS prints allowed VLANs
const vlanRanges = ids => ids.reduce((runs, id) => {
  const last = runs[runs.length - 1];
  if (last && id === last[1] + 1) last[1] = id;
  else runs.push([id, id]);
  return runs;
}, []).map(([a, b]) => (a === b ? `${a}` : b === a + 1 ? `${a},${b}` : `${a}-${b}`)).join(',');

function vlanList(text) {
  if (!/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(text || '')) return null;
  const ids = text.split(',').flatMap(part => {
    const [a, b = a] = part.split('-').map(Number);
    return Array.from({length: Math.max(0, b - a + 1)}, (_, i) => a + i);
  });
  return [...new Set(ids)].sort((a, b) => a - b);
}

// an interface that has an address and is not shut down, or null
const usable = i => (i && i.ip && !i.shut ? i : null);

// User and privileged EXEC, shared by the router and the switch (st is the device's state, save its save function)
function execCommand(c, w, st, save) {
  // in config mode "enable secret" is a configuration command; with a secret set the next line is the password (switches have no sec)
  if (c === 'enable' && st.mode === 'user') { if (st.sec?.secret) st.askPw = 3; else st.mode = 'priv'; }
  else if (c === 'disable') st.mode = 'user';
  else if (c === 'configure' && pick(w[1], ['terminal'])) st.mode = 'config';
  else if (c === 'write' || (c === 'copy' && pick(w[1], ['running-config']) && pick(w[2], ['startup-config']))) save();
  else if (c === 'terminal' && pick(w[1], ['length'])) { /* accepted; nothing to page here */ }
  else return false;
  return true;
}

// "interface <name>"; key is null when the name is not one of the device's ports
function enterInterface(st, key) {
  if (!key) return false;
  st.iface = key;
  st.mode = 'ifc';
  return true;
}

// "exit" goes up one level, "end" back to privileged EXEC
function leaveMode(c, st) {
  if (c === 'exit') st.mode = EXIT_TO[st.mode];
  else if (c === 'end') st.mode = 'priv';
  else return false;
  return true;
}

// The command a typed first word means in a mode; in interface mode "sh" means shutdown and "en" means end, as on IOS
function iosWord(word, mode, cmds) {
  if (mode === 'ifc' && word === 'sh') return 'shutdown';
  if (mode === 'ifc' && word === 'en') return 'end';
  return pick(word, cmds);
}

// copy running-config startup-config / write memory
function saveConfig(st, lines, out) {
  st.saved = lines;
  out('Building configuration...');
  out('[OK]', 'ln-ok');
}

// show startup-config
const showStartup = (st, out) => (st.saved ? st.saved.forEach(l => out(l)) : out('startup-config is not present', 'ln-err'));

// show ip interface brief, for a router's interfaces or a switch's ports
function ipBrief(ports, out) {
  out('Interface    IP-Address       Status');
  for (const p of ports) out(p.name.padEnd(13) + (p.ip || 'unassigned').padEnd(17) + (p.shut ? 'administratively down' : 'up'));
}

// Tab on an IOS device: interface names complete in global and interface configuration
const iosComplete = (line, keys, mode, ports) => tabComplete(line, keys, mode === 'config' || mode === 'ifc' ? ports.map(p => p.name) : null);

// IOS-style ping output (shared with the PCs)
function pingResult(target, ok, out) {
  const cls = ok ? 'ln-ok' : 'ln-err';
  out(`Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`);
  out(ok ? '!!!!!' : '.....', cls);
  out(ok ? 'Success rate is 100 percent (5/5)' : 'Success rate is 0 percent (0/5)', cls);
}

// Tab completes word by word, so abbreviations work ("conf t", "sh ip int"). keys are the full commands of the current mode.
// After "interface" it completes names from ports (when given), and when several match, each further Tab moves on to the next one.
// Returns {value, cycle, list}: the new input, the ports to step through, a line of options to print.
function tabComplete(line, keys, ports) {
  const text = line.toLowerCase();
  const typed = text.split(/\s+/);
  let hits;
  if (ports && typed.length === 2 && typed[0].length >= 3 && 'interface'.startsWith(typed[0])) {
    hits = ports.filter(p => p.toLowerCase().startsWith(typed[1])).map(p => 'interface ' + p);
    if (hits.length > 1) return {value: hits[0], cycle: hits};
  } else {
    hits = keys.filter(key => {
      const words = key.split(' ');
      return typed.length <= words.length && typed.every((w, i) => words[i].startsWith(w));
    });
  }
  if (!hits.length) return {value: line};
  if (hits.length === 1) return {value: hits[0] + ' '};
  // several matches: extend each typed word as far as all matches agree
  const split = hits.map(h => h.split(' '));
  const words = typed.map((_, i) => {
    let common = split[0][i];
    for (const h of split) while (!h[i].startsWith(common)) common = common.slice(0, -1);
    return common;
  });
  const last = typed.length - 1;
  const wordDone = split.every(h => h[last] === split[0][last] && h.length > typed.length);
  const completed = words.join(' ') + (wordDone ? ' ' : '');
  return {value: completed, list: completed === text ? hits.join('   ') : undefined}; // nothing more to fill in: list the options
}
