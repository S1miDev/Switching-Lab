// Lab session: one generated lab with its devices, requirements and grading. It knows nothing about the page or the console.
// The lab page (lab.js) shows a session and the mock exam (exam.js) grades one; the commands typed in the console change its devices.

// The session the console types into. Whoever shows a session sets it.
let activeSession = null;

// a random network number 0-255 for 192.168.x.0, different from avoid (the previous lab's)
function randomNet(avoid) {
  let x;
  do x = Math.floor(Math.random() * 256); while (x === avoid);
  return x;
}

// A lab for a topic and difficulty on the network 192.168.net.0, with fresh devices:
//   devices          the device of each node by name, built by the factory registered for the node's type (devices/device.js)
//   router, sw, pcs  the requirements' shortcuts into the devices' configuration: the router's, the switch's (S1 or MLS1),
//                    and the PCs' by name
//   server           the preconfigured DHCP server {name, ip, pools, reach(session)}, or null
//   reqs, solution   the requirements ({text, ok, hint}) and a known-good config (empty when the lab has none)
//   sub, lead, steps, nodes, links, height   the texts and the diagram
//   home             the device whose console opens first
//   grade()          true/false for each requirement
//   reset()          fresh devices
function createSession({topic, level, net}) {
  const T = LABS[topic], cfg = T.levels[level];
  const lab = T.kind === 'rt' ? {reqs: cfg.build(net), steps: cfg.steps, nodes: RT_NODES, links: RT_LINKS}
    : T.kind === 'sw' ? {reqs: cfg.reqs, solution: cfg.cmds && ['enable', 'conf t', ...cfg.cmds, 'end'], steps: cfg.steps, nodes: SW_NODES, links: SW_LINKS}
    : T.kind === 'mls' ? {reqs: cfg.reqs, steps: cfg.steps, nodes: MLS_NODES, links: MLS_LINKS, mls: true}
    : addressingLab(T, cfg, net);
  const lead = cfg.lead || T.lead;
  const session = {
    topic, level, net, sub: cfg.sub,
    lead: typeof lead === 'function' ? lead(net) : lead,
    steps: lab.steps, nodes: lab.nodes, links: lab.links, height: lab.height || 180,
    reqs: lab.reqs, solution: lab.solution || [],
    home: lab.mls ? 'MLS1' : 'R1',
    server: T.server ? T.server(net) : null,
    grade: () => session.reqs.map(r => !!r.ok(session)),
    reset() {
      // a node marked readonly is display-only whatever its type
      session.devices = Object.fromEntries(session.nodes.map(n => [n.id, DEVICE_TYPES[n.readonly ? 'readonly' : n.type](n, session)]));
    },
    get router() { return configured('router'); },
    get sw() { return configured('switch', 'mls'); },
    get pcs() { return Object.fromEntries(Object.entries(session.devices).filter(([, d]) => d.type === 'pc').map(([name, d]) => [name, d.state])); },
  };
  // the configuration of the first configurable device of one of these types
  const configured = (...types) => Object.values(session.devices).find(d => d.configurable && types.includes(d.type))?.state;
  session.reset();
  return session;
}

// IPv4 and IPv6 addressing labs: requirements, solution, steps and diagram all follow from the level's interfaces
function addressingLab(T, cfg, x) {
  const v6 = T.kind === 'v6';
  const ifs = cfg.ifs.map(r => ({...r, name: portName(r.k), ip: v6 ? `2001:db8:${x}:${r.sub}::1/64` : `192.168.${x}.${r.host}`}));
  const reqs = [], solution = ['enable', 'conf t'], steps = [];
  for (const r of ifs) {
    reqs.push(v6
      ? {text: `${r.name} gets an address ::1 in subnet ${r.sub} of 2001:db8:${x}::/48, with a /64 prefix`, ok: s => s.router.ifs[r.k].ip6 === r.ip, hint: r.ip}
      : {text: `${r.name} gets the ${r.rule} usable address in ${r.lan}${T.showNet ? ` (192.168.${x}.${r.net})` : ''}, with ${T.maskRule}`,
        ok: s => s.router.ifs[r.k].ip === r.ip && s.router.ifs[r.k].mask === r.mask, hint: `${r.ip} ${r.mask}`});
    if (r.ll) reqs.push({text: `${r.name} has the link-local address fe80::1`, ok: s => s.router.ifs[r.k].ll === 'fe80::1', hint: 'ipv6 address fe80::1 link-local'});
    solution.push(`int ${r.k}`, v6 ? `ipv6 address ${r.ip}` : `ip address ${r.ip} ${r.mask}`);
    if (r.ll) solution.push('ipv6 address fe80::1 link-local');
    solution.push('no shutdown', 'exit');
    steps.push(v6 ? `${r.name} serves subnet ${r.sub}; use ::1 as its address`
      : `${r.name} serves ${r.lan}${r.need ? ` (${r.need} hosts)` : ''}${T.showNet ? ` at 192.168.${x}.${r.net}` : ''}; use the ${r.rule} usable address as the gateway`);
  }
  for (const r of ifs) reqs.push({text: `${r.name} is up`, ok: s => !s.router.ifs[r.k].shut, hint: 'no shutdown'});
  solution.push('end');
  steps.push('Bring each interface up and check that it stays up.');
  // R1 on the left, one PC per interface stacked on the right
  const n = ifs.length, height = Math.max(180, (n - 1) * 64 + 92), mid = height / 2;
  const nodes = [{id: 'R1', type: 'router', x: 8, y: mid - 26, sub: 'Router'}], links = [];
  ifs.forEach((r, i) => {
    const id = `PC${i + 1}`, cy = mid + (i - (n - 1) / 2) * 64;
    nodes.push({id, type: 'pc', x: 370, y: cy - 26, sub: v6 ? `Subnet ${r.sub}` : r.need ? `${r.lan}, ${r.need} hosts` : r.lan, at: `R1 ${r.k}`});
    links.push({a: 'R1', b: id, port: r.name});
  });
  return {reqs, solution, steps, nodes, links, height};
}
