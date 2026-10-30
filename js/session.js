// Lab session: one generated lab with its devices, requirements and grading. It knows nothing about the page or the console.
// The lab page (lab.js) shows a session and the mock exam (exam.js) grades one; the commands typed in the console change its devices.

// a random network number 0-255 for 192.168.x.0, different from avoid (the previous lab's)
function randomNet(avoid) {
  let x;
  do x = Math.floor(Math.random() * 256); while (x === avoid);
  return x;
}

// A lab for a topic and difficulty on the network 192.168.net.0, with fresh devices. Everything about the lab comes from its build (labs.js):
//   reqs, solution   the requirements ({text, ok, hint}) and a known-good config [[device, lines], ...] (empty when the lab has none)
//   sub, lead, steps, nodes, links, height   the texts and the diagram
//   home             the device whose console opens first
//   server           the preconfigured DHCP server {name, ip, pools, reach(session)}, or null
//   devices          the device of each node by name, built by the factory registered for the node's type (devices/device.js)
//   config(name)     that device's configuration (null on a display-only device), which the requirements read
//   run(name, line)  type one line on that device; returns its output as [{text, cls}]
//   grade()          true/false for each requirement
//   reset()          fresh devices
function createSession({topic, level, net}) {
  const T = LABS[topic], cfg = T.levels[level];
  const lead = cfg.lead || T.lead;
  const session = {
    topic, level, net, sub: cfg.sub,
    lead: typeof lead === 'function' ? lead(net) : lead,
    height: 180,
    ...cfg.build(net),
    server: T.server ? T.server(net) : null,
    config: name => session.devices[name]?.state,
    grade: () => session.reqs.map(r => !!r.ok(session)),
    // a line ending in "?" asks for help; the device does the rest
    run(name, raw) {
      const d = session.devices[name], line = raw.trim(), out = [];
      const print = (text, cls = '') => out.push({text, cls});
      if (line.length > 1 && line.endsWith('?')) d.help(line, print);
      else if (line) d.run(line, print);
      return out;
    },
    reset() {
      // a node marked readonly is display-only whatever its type
      session.devices = Object.fromEntries(session.nodes.map(n => [n.id, DEVICE_TYPES[n.readonly ? 'readonly' : n.type](n, session)]));
    },
  };
  session.reset();
  return session;
}
