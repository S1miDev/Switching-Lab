// Sandbox model: a network the student builds freely. No page and no DOM (sandbox.js draws it), so the tests load it.
// It is session-like: it has the nodes, links and devices the devices (devices/*.js) and the console (console.js) use, so
// both work on it unchanged. Differences from a lab session: devices come and go, and links carry a port at each end.
//
//   node  {id, type, x, y, at?}  at: where a PC is cabled ('S1 fa0/1'), which is how a PC finds its gateway
//   link  {a, b, pa, pb}         pa/pb: the port on a/b (peersOf in devices/device.js reads them)
//   log   the history, in order: ['add', id, type], ['del', id], ['cable', a, pa, b, pb], ['uncable', id, port] and
//         ['run', id, line] for each typed line that changed the device. This is what is saved: loading replays it, so a
//         reloaded sandbox is in exactly the state it was in (a DHCP lease taken before a cable moved stays as it was).

const SB_TYPES = ['router', 'switch', 'mls', 'pc'];
const SB_W = 900, SB_H = 520, SB_EDGE = 8;   // the canvas (viewBox) size and the margin devices keep from its edge
const SB_MAX_DEVICES = 30, SB_MAX_LOG = 20000; // the history limit keeps a save small enough for localStorage and quick to replay
const SB_ID = /^[A-Za-z]{1,4}\d{1,2}$/;        // a device name like R1 or MLS2 (it ends up in the page)

// the ports of a device type, read from a fresh device so the list cannot drift from the device code (a PC's card has no name)
const sbPortCache = {};
const sbPorts = type => (sbPortCache[type] ||= type === 'pc' ? ['NIC']
  : DEVICE_TYPES[type]({id: 'X1', type}, {devices: {}, links: []}).ports().map(p => p.name));

// keep a device's box on the canvas
function sbPlace(n, x, y) {
  n.x = clamp(Number.isFinite(+x) ? +x : 0, SB_EDGE, SB_W - NODE_W - SB_EDGE);
  n.y = clamp(Number.isFinite(+y) ? +y : 0, SB_EDGE, SB_H - NODE_H - SB_EDGE);
}

function createSandbox() {
  const FULL = `This sandbox has reached its limit of ${SB_MAX_LOG} saved steps. Export it, then start a new one to keep going.`;
  const sb = {
    nodes: [], links: [], devices: {}, log: [],
    server: null, // no preconfigured DHCP server: put a pool on a router instead
    get home() { return sb.nodes[0]?.id; }, // the console opens this device first
    config: name => sb.devices[name]?.state,
    nodeOf: id => sb.nodes.find(n => n.id === id),
    cableOn: (id, port) => sb.links.find(l => (l.a === id && l.pa === port) || (l.b === id && l.pb === port)),
    full: () => sb.log.length >= SB_MAX_LOG,

    // Type one line. Only a line that changed the device is kept: a show, a ping or help changes nothing, so leaving it out
    // of the history does not change what a replay builds.
    run(name, raw) {
      if (sb.full()) return [{text: '% ' + FULL, cls: 'ln-err'}];
      const st = sb.devices[name].state, before = JSON.stringify(st), out = runOn(sb, name, raw);
      if (JSON.stringify(st) !== before) sb.log.push(['run', name, raw]);
      return out;
    },

    // Each change below returns why it cannot be made (a sentence), or null once it is made and added to the history.
    add(id, type, x, y) {
      if (sb.full()) return FULL;
      if (!SB_TYPES.includes(type) || !SB_ID.test(id)) return 'Unknown device type or name.';
      if (sb.devices[id]) return `There is already a ${id}.`;
      if (sb.nodes.length >= SB_MAX_DEVICES) return `A sandbox holds up to ${SB_MAX_DEVICES} devices.`;
      const node = {id, type};
      sbPlace(node, x, y);
      sb.nodes.push(node);
      sb.devices[id] = DEVICE_TYPES[type](node, sb);
      sb.log.push(['add', id, type]);
      return null;
    },
    // a new device with the next free name of its type (R1, R2 ...); returns it, or why not (a sentence)
    addNode(type, x, y) {
      let i = 1;
      while (sb.devices[TOPO_TYPES[type].prefix + i]) i++;
      const id = TOPO_TYPES[type].prefix + i;
      return sb.add(id, type, x, y) || sb.nodeOf(id);
    },
    removeNode(id) {
      if (sb.full()) return FULL;
      if (!sb.devices[id]) return `There is no ${id}.`;
      sb.links.filter(l => l.a === id || l.b === id).forEach(l => sb.unlink(l));
      sb.nodes = sb.nodes.filter(n => n.id !== id);
      delete sb.devices[id];
      sb.log.push(['del', id]);
      return null;
    },
    connect(a, pa, b, pb) {
      if (sb.full()) return FULL;
      const A = sb.nodeOf(a), B = sb.nodeOf(b);
      if (!A || !B) return 'Unknown device.';
      if (a === b) return 'A device cannot be cabled to itself.';
      const find = (n, p) => sbPorts(n.type).find(q => q.toLowerCase() === String(p).toLowerCase());
      const x = find(A, pa), y = find(B, pb);
      if (!x || !y) return `${x ? b : a} has no port ${x ? pb : pa}.`;
      for (const [id, p] of [[a, x], [b, y]]) if (sb.cableOn(id, p)) return `${id} ${p} is already cabled.`;
      sb.links.push({a, b, pa: x, pb: y});
      for (const [n, peer, port] of [[A, b, y], [B, a, x]]) if (n.type === 'pc') sb.setAt(n, `${peer} ${port.toLowerCase()}`);
      sb.log.push(['cable', a, x, b, y]);
      return null;
    },
    // remove the cable on a device's port
    disconnect(id, port) {
      if (sb.full()) return FULL;
      const link = sb.cableOn(id, port);
      if (!link) return `${id} ${port} is not cabled.`;
      sb.unlink(link);
      sb.log.push(['uncable', id, port]);
      return null;
    },
    unlink(link) {
      sb.links = sb.links.filter(l => l !== link);
      for (const n of [sb.nodeOf(link.a), sb.nodeOf(link.b)]) if (n.type === 'pc') sb.setAt(n, null);
    },
    setAt(pc, at) {
      pc.at = at;
      sb.devices[pc.id].state.at = at;
    },

    // the first free spot for a device added without a position: a spaced grid first, then any gap, then the middle
    freeSpot() {
      const free = (x, y) => !sb.nodes.some(n => Math.abs(n.x - x) < NODE_W && Math.abs(n.y - y) < NODE_H);
      for (const [sx, sy, start] of [[140, 72, 40], [8, 8, SB_EDGE]]) {
        for (let y = start; y <= SB_H - NODE_H - SB_EDGE; y += sy) {
          for (let x = start; x <= SB_W - NODE_W - SB_EDGE; x += sx) if (free(x, y)) return {x, y};
        }
      }
      return {x: (SB_W - NODE_W) / 2, y: (SB_H - NODE_H) / 2};
    },

    // the cable is up when neither end is shut down (a PC's card is always up)
    linkUp(l) {
      const up = (id, port) => {
        const st = sb.devices[id].state;
        return !(st.ifs || st.ports || {})[port.toLowerCase()]?.shut;
      };
      return up(l.a, l.pa) && up(l.b, l.pb);
    },

    // the devices a packet crosses from a to b over the cables, as ids [a, ..., b], or null when they are not connected
    findPath(a, b) {
      const prev = {[a]: null};
      for (const queue = [a]; queue.length;) {
        const cur = queue.shift();
        if (cur === b) break;
        for (const l of sb.links) {
          const next = l.a === cur ? l.b : l.b === cur ? l.a : null;
          if (next && !(next in prev)) { prev[next] = cur; queue.push(next); }
        }
      }
      if (!(b in prev)) return null;
      const path = [];
      for (let n = b; n; n = prev[n]) path.unshift(n);
      return path;
    },

    // A ping from a PC to an address. Whether it is answered comes from the devices' real configuration (the PC's canReach);
    // the path is just the cabling from the PC to whichever device owns the address, for the animation and the event list.
    // shortcut: one verdict for the whole trip, not a hop-by-hop protocol run; extend when the devices can forward per hop
    ping(src, ip) {
      const pc = sb.devices[src], dst = Object.values(sb.devices).find(d => d.ports().some(p => p.ip === ip));
      const ok = !!pc.canReach(ip), path = dst ? sb.findPath(src, dst.name) : null;
      const events = [{text: `${src} sends an ICMP echo request to ${ip}`}];
      if (path) path.slice(1).forEach((id, i) => events.push({text: `${path[i]} → ${id}`}));
      if (ok) events.push({text: `${dst.name} answers; ${src} gets the echo reply`, cls: 'ok'});
      else events.push({text: dst ? 'No reply. Check the addresses, the gateway, the VLANs and any shut down port.' : `No device has the address ${ip}.`, cls: 'err'});
      return {ok, path, events};
    },

    // the saved form: the history, and where each device is now
    serialize: () => ({
      v: 2,
      pos: Object.fromEntries(sb.nodes.map(n => [n.id, [n.x, n.y]])),
      log: sb.log.map(e => [...e]),
    }),
  };
  return sb;
}

// The first saved form (v1: the final nodes and links, then the typed lines), still used to write the presets below
function sbUpgrade(data) {
  if (data?.v !== 1 || !Array.isArray(data.nodes) || !Array.isArray(data.links) || !Array.isArray(data.log)) return data;
  return {
    v: 2,
    pos: Object.fromEntries(data.nodes.map(n => [n?.id, [n?.x, n?.y]])),
    log: [...data.nodes.map(n => ['add', n?.id, n?.type]), ...data.links.map(l => ['cable', l?.a, l?.pa, l?.b, l?.pb]),
      ...data.log.map(e => ['run', ...(Array.isArray(e) ? e : [])])],
  };
}

// A sandbox from saved data (a file or localStorage, so untrusted): checked, then rebuilt by replaying its history.
// Throws an Error saying what is wrong.
function loadSandbox(raw) {
  const bad = why => { throw new Error(`Not a valid sandbox: ${why}`); };
  const data = sbUpgrade(raw);
  if (data?.v !== 2 || !Array.isArray(data.log) || typeof data.pos !== 'object' || !data.pos) bad('its history is missing');
  if (data.log.length > SB_MAX_LOG) bad('its history is too long');
  const sb = createSandbox();
  const str = v => typeof v === 'string';
  const steps = {
    add: (id, type) => str(id) && str(type) && sb.add(id, type, 0, 0),
    del: id => str(id) && sb.removeNode(id),
    cable: (a, pa, b, pb) => [a, pa, b, pb].every(str) && sb.connect(a, pa, b, pb),
    uncable: (id, port) => str(id) && str(port) && sb.disconnect(id, port),
    run: (id, line) => {
      if (!str(id) || !str(line) || !sb.devices[id]) return `no device ${id} for a command`;
      sb.run(id, line);
      return null;
    },
  };
  data.log.forEach((e, i) => {
    const step = Array.isArray(e) && Object.hasOwn(steps, e[0]) && steps[e[0]];
    const why = step ? step(...e.slice(1)) : 'an unknown step';
    if (why !== null) bad(`step ${i + 1}: ${why || 'a malformed step'}`);
  });
  for (const n of sb.nodes) {
    const p = Object.hasOwn(data.pos, n.id) && Array.isArray(data.pos[n.id]) ? data.pos[n.id] : [];
    sbPlace(n, p[0], p[1]);
  }
  return sb;
}

// Starting points, written in the first saved form (sbUpgrade turns them into the current one). x, y is a box's top-left corner.
const sbCmds = (dev, ...lines) => ['enable', 'conf t', ...lines, 'end'].map(l => [dev, l]);
const sbAccess = (port, vlan) => [`interface ${port}`, 'switchport mode access', `switchport access vlan ${vlan}`, 'no shutdown', 'exit'];
const sbPc = (dev, ip, gw) => [[dev, `ip ${ip} 255.255.255.0 ${gw}`]];
const SB_PRESETS = [
  {name: 'Blank canvas', desc: 'Start from nothing and build your own network.', data: {v: 1, nodes: [], links: [], log: []}},
  {
    name: 'Router on a stick', desc: 'One router and one switch carry VLAN 10 and VLAN 20 over a trunk; the two PCs ping each other.',
    data: {
      v: 1,
      nodes: [{id: 'R1', type: 'router', x: 390, y: 60}, {id: 'S1', type: 'switch', x: 390, y: 230},
        {id: 'PC1', type: 'pc', x: 190, y: 400}, {id: 'PC2', type: 'pc', x: 590, y: 400}],
      links: [{a: 'R1', pa: 'Gi0/0', b: 'S1', pb: 'Gi0/1'}, {a: 'S1', pa: 'Fa0/1', b: 'PC1', pb: 'NIC'}, {a: 'S1', pa: 'Fa0/2', b: 'PC2', pb: 'NIC'}],
      log: [
        ...sbCmds('S1', 'vlan 10', 'name Sales', 'exit', 'vlan 20', 'name Staff', 'exit', ...sbAccess('fa0/1', 10), ...sbAccess('fa0/2', 20),
          'interface gi0/1', 'switchport mode trunk', 'no shutdown'),
        ...sbCmds('R1', 'interface gi0/0', 'no shutdown', 'exit',
          'interface gi0/0.10', 'encapsulation dot1Q 10', 'ip address 192.168.10.1 255.255.255.0', 'no shutdown', 'exit',
          'interface gi0/0.20', 'encapsulation dot1Q 20', 'ip address 192.168.20.1 255.255.255.0', 'no shutdown'),
        ...sbPc('PC1', '192.168.10.10', '192.168.10.1'), ...sbPc('PC2', '192.168.20.10', '192.168.20.1'),
      ],
    },
  },
  {
    name: 'Multilayer switch (SVIs)', desc: 'One layer 3 switch routes between VLAN 10 and VLAN 20 with SVIs.',
    data: {
      v: 1,
      nodes: [{id: 'MLS1', type: 'mls', x: 390, y: 120}, {id: 'PC1', type: 'pc', x: 190, y: 360}, {id: 'PC2', type: 'pc', x: 590, y: 360}],
      links: [{a: 'MLS1', pa: 'Fa0/1', b: 'PC1', pb: 'NIC'}, {a: 'MLS1', pa: 'Fa0/2', b: 'PC2', pb: 'NIC'}],
      log: [
        ...sbCmds('MLS1', 'vlan 10', 'exit', 'vlan 20', 'exit', ...sbAccess('fa0/1', 10), ...sbAccess('fa0/2', 20), 'ip routing',
          'interface vlan 10', 'ip address 192.168.10.1 255.255.255.0', 'no shutdown', 'exit',
          'interface vlan 20', 'ip address 192.168.20.1 255.255.255.0', 'no shutdown'),
        ...sbPc('PC1', '192.168.10.10', '192.168.10.1'), ...sbPc('PC2', '192.168.20.10', '192.168.20.1'),
      ],
    },
  },
  {
    name: 'Router with DHCP', desc: 'A router gives two LANs their addresses by DHCP; type dhcp on each PC.',
    data: {
      v: 1,
      nodes: [{id: 'R1', type: 'router', x: 390, y: 120}, {id: 'PC1', type: 'pc', x: 190, y: 360}, {id: 'PC2', type: 'pc', x: 590, y: 360}],
      links: [{a: 'R1', pa: 'Gi0/0', b: 'PC1', pb: 'NIC'}, {a: 'R1', pa: 'Gi0/1', b: 'PC2', pb: 'NIC'}],
      log: [
        ...sbCmds('R1', 'interface gi0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'exit',
          'interface gi0/1', 'ip address 192.168.2.1 255.255.255.0', 'no shutdown', 'exit',
          'ip dhcp excluded-address 192.168.1.1 192.168.1.10', 'ip dhcp excluded-address 192.168.2.1 192.168.2.10',
          'ip dhcp pool LAN1', 'network 192.168.1.0 255.255.255.0', 'default-router 192.168.1.1', 'exit',
          'ip dhcp pool LAN2', 'network 192.168.2.0 255.255.255.0', 'default-router 192.168.2.1'),
        ['PC1', 'dhcp'], ['PC2', 'dhcp'],
      ],
    },
  },
];
SB_PRESETS.forEach(p => { p.data = sbUpgrade(p.data); });
