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

// an interface that has an address and is not shut down, or null
const usable = i => (i && i.ip && !i.shut ? i : null);

// User and privileged EXEC, shared by the router and the switch (st is the device's state, save its save function)
function execCommand(c, w, st, save) {
  if (c === 'enable' && st.mode === 'user') st.mode = 'priv'; // in config mode "enable secret" is a configuration command
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
