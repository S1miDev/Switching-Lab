// The sandbox model: building a network, saving it, and the starting points
const test = require('node:test');
const assert = require('node:assert');
const get = require('./load');

const createSandbox = get('createSandbox'), loadSandbox = get('loadSandbox'), PRESETS = get('SB_PRESETS');
const MAX_LOG = get('SB_MAX_LOG'), W = get('SB_W'), H = get('SB_H'), NODE_W = get('NODE_W'), NODE_H = get('NODE_H');
const plain = x => JSON.parse(JSON.stringify(x)); // values made inside the loader's context have its own prototypes
const preset = name => loadSandbox(plain(PRESETS.find(p => p.name === name).data));
const type = (sb, dev, ...lines) => lines.flatMap(l => sb.run(dev, l));
const errors = out => out.filter(o => o.text.startsWith('%')).map(o => o.text);

// a sandbox from a list of device types, cabled by [a, pa, b, pb] lists
function build(types, cables = []) {
  const sb = createSandbox();
  types.forEach(t => assert.strictEqual(typeof sb.addNode(t, 0, 0), 'object'));
  cables.forEach(c => assert.strictEqual(sb.connect(...c), null, c.join(' ')));
  return sb;
}

test('devices get the next free name and can be removed with their cables', () => {
  const sb = build(['pc', 'pc', 'switch'], [['S1', 'fa0/1', 'PC1', 'NIC']]);
  assert.deepEqual(sb.nodes.map(n => n.id), ['PC1', 'PC2', 'S1']);
  assert.strictEqual(sb.removeNode('PC1'), null);
  assert.strictEqual(sb.links.length, 0);
  assert.strictEqual(sb.addNode('pc', 0, 0).id, 'PC1');
  assert.ok(!sb.devices.PC1.state.at, 'the new PC1 is not cabled');
  assert.match(sb.removeNode('R7'), /no R7/);
});

test('cabling refuses a busy port, a self cable and an unknown port', () => {
  const sb = build(['switch', 'pc', 'pc'], [['S1', 'Fa0/1', 'PC1', 'NIC']]);
  assert.match(sb.connect('S1', 'Fa0/1', 'PC2', 'NIC'), /already cabled/);
  assert.match(sb.connect('PC1', 'NIC', 'PC2', 'NIC'), /already cabled/);
  assert.match(sb.connect('S1', 'Fa0/2', 'S1', 'Fa0/3'), /itself/);
  assert.match(sb.connect('S1', 'Gi0/9', 'PC2', 'NIC'), /no port/);
  assert.strictEqual(sb.devices.PC1.state.at, 'S1 fa0/1');
  assert.strictEqual(sb.disconnect('PC1', 'NIC'), null);
  assert.strictEqual(sb.devices.PC1.state.at, null);
  assert.match(sb.disconnect('PC1', 'NIC'), /not cabled/);
});

test('the ports offered are the ports the devices really have', () => {
  const ports = get('sbPorts');
  const sb = build(['router', 'switch', 'mls']);
  for (const id of ['R1', 'S1', 'MLS1']) {
    assert.deepEqual(plain(ports(sb.nodeOf(id).type)), sb.devices[id].ports().map(p => p.name), id);
  }
  assert.deepEqual(plain(ports('pc')), ['NIC']);
});

test('findPath follows the cables and is null for devices that are not connected', () => {
  const sb = build(['pc', 'switch', 'router', 'pc'], [['PC1', 'NIC', 'S1', 'Fa0/1'], ['S1', 'Gi0/1', 'R1', 'Gi0/0']]);
  assert.deepEqual(plain(sb.findPath('PC1', 'R1')), ['PC1', 'S1', 'R1']);
  assert.strictEqual(sb.findPath('PC1', 'PC2'), null);
});

test('every starting point replays without errors and its PCs end up able to ping', () => {
  for (const p of PRESETS) {
    const sb = createSandbox(), out = [];
    for (const [op, ...args] of plain(p.data.log)) {
      if (op === 'run') out.push(...sb.run(...args));
      else assert.strictEqual(sb[{add: 'add', cable: 'connect'}[op]](...args, ...(op === 'add' ? [0, 0] : [])), null, `${p.name}: ${op}`);
    }
    assert.deepEqual(errors(out), [], p.name);
  }
  assert.ok(preset('Router on a stick').ping('PC1', '192.168.20.10').ok);
  assert.ok(preset('Multilayer switch (SVIs)').ping('PC1', '192.168.20.10').ok);
  const dhcp = preset('Router with DHCP');
  assert.match(dhcp.devices.PC1.state.ip, /^192\.168\.1\./);
  assert.match(dhcp.devices.PC2.state.ip, /^192\.168\.2\./);
  assert.ok(dhcp.ping('PC1', dhcp.devices.PC2.state.ip).ok);
});

test('a ping reports a broken network and shows the path it took', () => {
  const sb = preset('Router on a stick');
  assert.deepEqual(plain(sb.ping('PC1', '192.168.20.10').path), ['PC1', 'S1', 'PC2']);
  type(sb, 'S1', 'conf t', 'interface fa0/2', 'shutdown');
  assert.ok(!sb.ping('PC1', '192.168.20.10').ok);
  assert.ok(!sb.linkUp(sb.links[2]));
  assert.strictEqual(sb.ping('PC1', '10.9.9.9').path, null);
});

// router on a stick through a chosen switch port; the PC is on Fa0/1 in VLAN 10
function stick(switchPort, trunkPort) {
  const sb = build(['router', 'switch', 'pc'], [['R1', 'Gi0/0', 'S1', switchPort], ['S1', 'Fa0/1', 'PC1', 'NIC']]);
  type(sb, 'S1', 'enable', 'conf t', 'vlan 10', 'exit', 'interface fa0/1', 'switchport mode access', 'switchport access vlan 10',
    'no shutdown', 'exit', `interface ${trunkPort}`, 'switchport mode trunk', 'no shutdown', 'end');
  type(sb, 'R1', 'enable', 'conf t', 'interface gi0/0', 'no shutdown', 'exit', 'interface gi0/0.10', 'encapsulation dot1Q 10',
    'ip address 192.168.10.1 255.255.255.0', 'no shutdown', 'end');
  type(sb, 'PC1', 'ip 192.168.10.10 255.255.255.0 192.168.10.1');
  return sb.ping('PC1', '192.168.10.1').ok;
}

test('router on a stick works over the trunk that is cabled to the router, on any switch port', () => {
  assert.ok(stick('Gi0/1', 'gi0/1'));
  assert.ok(stick('Fa0/3', 'fa0/3'), 'a trunk to the router on Fa0/3');
  assert.ok(!stick('Fa0/3', 'gi0/1'), 'a trunk with nothing on it, while the router hangs off an access port');
});

test('CDP on two cabled routers shows each one on its own local interface', () => {
  const sb = build(['router', 'router'], [['R1', 'Gi0/0', 'R2', 'Gi0/2']]);
  type(sb, 'R1', 'enable', 'conf t', 'interface gi0/0', 'no shutdown', 'end');
  type(sb, 'R2', 'enable', 'conf t', 'interface gi0/2', 'no shutdown', 'end');
  const seen = dev => type(sb, dev, 'show cdp neighbors').map(o => o.text).join('\n');
  assert.match(seen('R1'), /R2\s+Gi0\/0/);
  assert.match(seen('R2'), /R1\s+Gi0\/2/);
});

test('saving and loading brings back the devices, cables, positions and configuration', () => {
  const sb = preset('Router on a stick');
  sb.nodeOf('R1').x = 123;
  const copy = loadSandbox(plain(sb.serialize()));
  assert.deepEqual(plain(copy.serialize()), plain(sb.serialize()));
  assert.strictEqual(copy.nodeOf('R1').x, 123);
  assert.ok(copy.ping('PC1', '192.168.20.10').ok);
  assert.strictEqual(copy.devices.S1.state.vlans[10].name, 'Sales');
});

test('only commands that change a device go into the history', () => {
  const sb = build(['router', 'pc']);
  const before = sb.log.length;
  type(sb, 'R1', '?', 'help', '   ', 'show ip interface brief', 'bogus');
  type(sb, 'PC1', 'ipconfig', 'ping 1.2.3.4');
  assert.strictEqual(sb.log.length, before);
  type(sb, 'R1', 'enable');
  assert.strictEqual(sb.log.length, before + 1);
});

test('a reload rebuilds the state as it was, even after cables moved and devices went away', () => {
  const sb = build(['router', 'pc'], [['R1', 'Gi0/0', 'PC1', 'NIC']]);
  type(sb, 'R1', 'enable', 'conf t', 'interface gi0/0', 'ip address 10.1.1.1 255.255.255.0', 'no shutdown', 'exit',
    'ip dhcp pool A', 'network 10.1.1.0 255.255.255.0', 'default-router 10.1.1.1', 'end');
  type(sb, 'PC1', 'dhcp');
  const ip = sb.devices.PC1.state.ip;
  assert.match(ip, /^10\.1\.1\./);
  sb.disconnect('PC1', 'NIC');
  sb.connect('R1', 'Gi0/1', 'PC1', 'NIC');
  assert.strictEqual(loadSandbox(plain(sb.serialize())).devices.PC1.state.ip, ip, 'after re-cabling');
  sb.removeNode('R1');
  assert.strictEqual(loadSandbox(plain(sb.serialize())).devices.PC1.state.ip, ip, 'after deleting the DHCP router');
});

test('a full history refuses more changes, so what is saved always loads again', () => {
  const sb = build(['router']);
  while (sb.log.length < MAX_LOG) sb.log.push(['run', 'R1', 'show version']); // stand-ins; only the length matters here
  assert.match(errors(sb.run('R1', 'enable'))[0], /limit/);
  assert.match(sb.addNode('pc', 0, 0), /limit/);
  assert.match(sb.removeNode('R1'), /limit/);
  assert.strictEqual(sb.log.length, MAX_LOG);
  const saved = plain(sb.serialize());
  assert.doesNotThrow(() => loadSandbox(saved));
  saved.log.push(['run', 'R1', 'enable']);
  assert.throws(() => loadSandbox(saved), /too long/);
});

test('devices stay on the canvas: added ones never overlap, loaded ones are pulled back in', () => {
  const sb = createSandbox();
  for (let i = 0; i < 30; i++) {
    const p = sb.freeSpot();
    assert.strictEqual(typeof sb.addNode(['router', 'switch', 'mls', 'pc'][i % 4], p.x, p.y), 'object');
  }
  assert.match(sb.addNode('pc', 0, 0), /up to 30/);
  for (const n of sb.nodes) {
    assert.ok(n.x >= 0 && n.y >= 0 && n.x + NODE_W <= W && n.y + NODE_H <= H, `${n.id} inside`);
    for (const m of sb.nodes) if (m !== n) assert.ok(Math.abs(n.x - m.x) >= NODE_W || Math.abs(n.y - m.y) >= NODE_H, `${n.id} / ${m.id}`);
  }
  const far = loadSandbox({v: 2, pos: {R1: [5000, -40]}, log: [['add', 'R1', 'router']]}).nodeOf('R1');
  assert.ok(far.x + NODE_W <= W && far.y >= 0);
});

test('loading refuses data that is not a sandbox', () => {
  const ok = {v: 2, pos: {}, log: []};
  assert.doesNotThrow(() => loadSandbox(ok));
  for (const data of [null, {}, {v: 2, log: []}, {...ok, log: 'x'}, {...ok, v: 3},
    {...ok, log: [['add', '<img src=x onerror=1>', 'pc']]},
    {...ok, log: [['add', 'X1', 'toaster']]},
    {...ok, log: [['add', 'PC1', 'pc'], ['add', 'PC1', 'pc']]},
    {...ok, log: [['add', 'PC1', 'pc'], ['cable', 'PC1', 'NIC', 'S9', 'Fa0/1']]},
    {...ok, log: [['run', 'R9', 'enable']]},
    {...ok, log: [['add', 'R1', {}]]},
    {...ok, log: [['__proto__']]},
    {...ok, log: [7]},
    {...ok, log: Array.from({length: MAX_LOG + 1}, () => ['run', 'R1', 'x'])}]) {
    assert.throws(() => loadSandbox(data), /Not a valid sandbox/, JSON.stringify(data)?.slice(0, 80));
  }
});
