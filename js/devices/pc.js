// PCs: a small host command line in the style of GNS3's VPCS: set a static address, ask DHCP for one, show it, ping.
// A PC's node in the lab diagram says where it is cabled (at: 'R1 gi0/0' or 'S1 fa0/1'); its gateway follows from that.

const PC_KEYS = {pc: ['ip', 'dhcp', 'ipconfig', 'ping', 'show ip', 'help']};
const PC_HELP = {pc: {head: 'PC commands:', rows: [
  ['dhcp', 'Get an address, mask and gateway from a DHCP server'],
  ['ip', 'ip <address> <mask> [gateway]  Set a static address'],
  ['ipconfig', 'Show the address, mask and gateway'],
  ['ping', 'ping <address>  Check that an address answers'],
  ['show ip', 'Same as ipconfig'],
]}};

function freshPc(node) {
  return {mode: 'pc', host: node.id, at: node.at, ip: null, mask: null, gw: null, dhcp: false};
}


// A PC in the lab. Its gateway, the DHCP pools it can reach and the other hosts it can ping all come from the other devices in the session.
function createPc(node, session) {
  const st = freshPc(node);
  const ownerOf = iface => Object.values(session.devices).find(d => d.ports().includes(iface));

  // The router interface or SVI that is the gateway of the PC's LAN, or null when the path to it is down
  const gateway = () => {
    const [name, key] = st.at.split(' ');
    return session.devices[name].gateway(key);
  };

  // the gateway, when the PC has an address on its subnet
  const link = () => {
    const g = st.ip ? gateway() : null;
    return g && inNet(g.ip, g.mask, st.ip) ? g : null;
  };

  // shortcut: one hop only (the PC's own gateway device); extend when a lab puts a router between two PCs
  function canReach(target) {
    const g = link();
    if (!g) return false;
    const owner = ownerOf(g), ifs = owner.ports(), routes = owner.routes();
    const other = Object.values(session.devices).find(o => o !== self && o.link && o.state.ip === target);
    if (other) {
      const og = other.link();
      if (og === g) return true; // same LAN
      return !!og && ifs.includes(og) && routes && st.gw === g.ip && other.state.gw === og.ip;
    }
    if (target === g.ip) return true;
    return routes && st.gw === g.ip && ifs.some(i => usable(i) && i.ip === target);
  }

  // the lowest address in a pool that is not excluded and not used by a device
  function freeAddress(pool) {
    const net = ipInt(netText(pool.net, pool.mask)), size = 2 ** (32 - prefixLen(pool.mask));
    const used = new Set(Object.values(session.devices).filter(d => d !== self).flatMap(d => d.ports().map(i => i.ip)));
    for (let n = net + 1; n < net + size - 1; n++) {
      if (!used.has(ipText(n)) && !pool.ex.some(([a, b]) => n >= ipInt(a) && n <= ipInt(b))) return ipText(n);
    }
    return null;
  }

  // A lease comes from a pool on the gateway device, or from the lab's DHCP server through an ip helper-address.
  // The pool must cover the gateway's subnet, as on a real DHCP server.
  function dhcp(out) {
    const g = gateway(), server = session.server, pools = [];
    if (g) pools.push(...ownerOf(g).pools());
    if (g && server && g.helpers.includes(server.ip) && server.reach(session)) pools.push(...server.pools);
    const pool = pools.find(p => p.net && p.mask && inNet(p.net, p.mask, g.ip));
    const ip = pool && freeAddress(pool);
    if (!ip) return out('DDD  DHCP request timed out: no DHCP server answered', 'ln-err');
    Object.assign(st, {ip, mask: pool.mask, gw: pool.gw, dhcp: true});
    out(`DORA IP ${ip}/${prefixLen(pool.mask)} GW ${pool.gw || 'none'}`, 'ln-ok');
  }

  const self = defineDevice({
    name: node.id, type: node.type, configurable: true, state: st,
    prompt: () => st.host + SUFFIX[st.mode],
    ports: () => [st], // its one network card
    link, canReach,
    run(line, out) {
      if (line === '?' || line === 'help') return self.help('?', out);
      const w = line.toLowerCase().split(/\s+/);
      const c = pick(w[0], ['ip', 'dhcp', 'ipconfig', 'ping', 'show', 'help']);
      if (c === 'dhcp' || (c === 'ip' && pick(w[1], ['dhcp']) && w.length === 2)) return dhcp(out);
      if (c === 'ip' && (w.length === 3 || w.length === 4) && w.slice(1).every(a => DOTTED.test(a))) {
        Object.assign(st, {ip: w[1], mask: w[2], gw: w[3] || null, dhcp: false});
        return out(`${st.host} : ${w[1]} ${w[2]}${w[3] ? ' gateway ' + w[3] : ''}`);
      }
      if (c === 'ipconfig' || (c === 'show' && pick(w[1], ['ip']))) {
        out(`NAME        : ${st.host}`);
        out(`IP/MASK     : ${st.ip ? `${st.ip}/${prefixLen(st.mask)}` : 'not set'}`);
        out(`GATEWAY     : ${st.gw || 'not set'}`);
        return out(`DHCP        : ${st.dhcp ? 'yes' : 'no'}`);
      }
      if (c === 'ping' && w.length === 2) {
        if (!DOTTED.test(w[1])) return out('% Unrecognized host or address', 'ln-err');
        return pingResult(w[1], canReach(w[1]), out);
      }
      out('% Unknown command. Type ? for the list.', 'ln-err');
    },
    complete: line => tabComplete(line, PC_KEYS[st.mode], null),
    help: (line, out) => helpFor(line, PC_HELP[st.mode], st.mode, null, out),
  });
  return self;
}
DEVICE_TYPES.pc = createPc;
