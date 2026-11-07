// Lab session: one generated lab with its devices, requirements and grading. It knows nothing about the page or the console.
// The lab page (lab.js) shows a session and the mock exam (exam.js) grades one; the commands typed in the console change its devices.

// a random network number 0-255 for 192.168.x.0, different from avoid (the previous lab's)
function randomNet(avoid) {
  let x;
  do x = Math.floor(Math.random() * 256); while (x === avoid);
  return x;
}

// Type one line on a session's device; returns its output as [{text, cls}]. A line ending in "?" (or just "help") asks for
// help; the device does the rest. Shared by lab sessions and the sandbox (sandbox-model.js).
function runOn(session, name, raw) {
  const d = session.devices[name], line = raw.trim(), out = [];
  const print = (text, cls = '') => out.push({text, cls});
  if (line === 'help') d.help('?', print);
  else if (line.endsWith('?')) d.help(line, print);
  else if (line || d.state?.askPw) d.run(line, print); // an empty line still answers a password prompt
  return out;
}

// A lab for a topic and difficulty on the network 192.168.net.0, with fresh devices. Everything about the lab comes from its build (labs.js):
//   reqs, solution   the requirements ({text, ok, hint}) and a known-good config [[device, lines], ...] (empty when the lab has none)
//   sub, lead, steps, nodes, links, height   the texts and the diagram
//   home             the device whose console opens first
//   setup            a preset (often broken) config [[device, lines], ...], typed in global configuration on every reset
//   server           the preconfigured DHCP server {name, ip, pools, reach(session)}, or null
//   devices          the device of each node by name, built by the factory registered for the node's type (devices/device.js)
//   config(name)     that device's configuration (null on a display-only device), which the requirements read
//   run(name, line)  type one line on that device; returns its output as [{text, cls}]
//   grade()          true/false for each requirement
//   score()          {done, total}: scored requirements met, and how many are scored
//   judge()          like grade, but null for a requirement met since the (re)start in a lab with a preset config: not the
//                    student's work, so it is neither ticked nor scored; once broken it counts as false again
//   reset()          fresh devices
function createSession({topic, level, net}) {
  const T = LABS[topic], cfg = T.levels[level];
  const session = {
    topic, level, net, sub: atNet(cfg.sub, net),
    lead: atNet(cfg.lead || T.lead, net),
    height: 180,
    ...buildLab(T, cfg, net),
    server: T.server ? T.server(net) : null,
    config: name => session.devices[name]?.state,
    grade: () => session.reqs.map(r => !!r.ok(session)),
    judge: () => session.grade().map((ok, i) => (session.startMet[i] && ok ? null : ok)),
    // met and scored requirements; the total is fixed at the (re)start, so breaking a requirement met since then does not grow it
    score() {
      const judged = session.judge();
      return {done: judged.filter(r => r === true).length, total: session.startMet.filter(m => !m).length};
    },
    run: (name, raw) => runOn(session, name, raw),
    reset() {
      // a node marked readonly is display-only whatever its type
      session.devices = Object.fromEntries(session.nodes.map(n => [n.id, DEVICE_TYPES[n.readonly ? 'readonly' : n.type](n, session)]));
      for (const [name, lines] of session.setup || []) for (const l of ['enable', 'conf t', ...lines, 'end', 'disable']) session.run(name, l);
      // only a preset config (troubleshooting) makes requirements "given"; in other labs every requirement is the student's work
      session.startMet = session.setup?.length ? session.grade() : session.reqs.map(() => false);
    },
  };
  session.reset();
  return session;
}
