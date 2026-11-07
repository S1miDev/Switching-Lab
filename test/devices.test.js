// The devices, typed into through a session the way the console does
const test = require('node:test');
const assert = require('node:assert');
const get = require('./load');

const session = get('createSession')({topic: 'vlans', level: 'beginner', net: 5});
const texts = (name, line) => session.run(name, line).map(l => l.text);

test('router modes change the prompt', () => {
  const r1 = session.devices.R1;
  assert.strictEqual(r1.prompt(), 'R1>');
  session.run('R1', 'en');
  assert.strictEqual(r1.prompt(), 'R1#');
  session.run('R1', 'conf t');
  assert.strictEqual(r1.prompt(), 'R1(config)#');
  session.run('R1', 'end');
});

test('unknown commands are refused', () => {
  assert.match(texts('R1', 'bogus').join('\n'), /^%/);
  assert.match(texts('PC1', 'bogus').join('\n'), /^%/);
});

test('"?" lists help, and empty lines print nothing', () => {
  assert.ok(texts('S1', '?').length > 1);
  assert.ok(texts('S1', 'en?').length > 0);
  assert.deepEqual(session.run('S1', '   '), []);
});

test('help, interface-mode short forms, saving and ip interface brief on both IOS devices', () => {
  const s = get('createSession')({topic: 'vlans', level: 'beginner', net: 5});
  const run = (name, line) => s.run(name, line).map(l => l.text);
  for (const [name, port] of [['R1', 'gi0/1'], ['S1', 'fa0/2']]) {
    assert.deepEqual(run(name, 'help'), run(name, '?'));
    for (const l of ['en', 'conf t', 'int ' + port, 'no sh', 'sh']) run(name, l);
    assert.ok(s.devices[name].ports().find(p => p.name.toLowerCase() === port).shut, 'sh means shutdown');
    run(name, 'en');
    assert.match(s.devices[name].prompt(), /#$/, 'en means end');
    assert.match(run(name, 'show startup-config')[0], /not present/);
    assert.deepEqual(run(name, 'wr'), ['Building configuration...', '[OK]']);
    assert.ok(run(name, 'show startup-config').includes(`hostname ${name}`));
    assert.match(run(name, 'show ip interface brief')[0], /^Interface +IP-Address +Status$/);
  }
});

test('a PC takes a static address', () => {
  session.run('PC1', 'ip 192.168.1.10 255.255.255.0 192.168.1.1');
  assert.ok(texts('PC1', 'ipconfig').some(t => t.includes('192.168.1.10/24')));
});

test('display-only devices refuse commands', () => {
  const ro = get('createSession')({topic: 'static', level: 'beginner', net: 5});
  assert.match(ro.run('R2', 'en')[0].text, /Not configurable/);
});

test('EUI-64, IPv6 canonical form and VLAN lists', () => {
  const eui64 = get('eui64'), v6Canon = get('v6Canon'), vlanList = get('vlanList');
  assert.strictEqual(eui64('ca01.1a2b.0003'), 'c801:1aff:fe2b:3'); // bit 7 flipped, FFFE inserted
  assert.strictEqual(eui64('0050.7966.6800'), '250:79ff:fe66:6800');
  assert.strictEqual(v6Canon('2001:DB8:0005:1::/64'), '2001:db8:5:1:0:0:0:0/64');
  assert.strictEqual(v6Canon('::/0'), '0:0:0:0:0:0:0:0/0');
  assert.strictEqual(v6Canon('fe80::2'), 'fe80:0:0:0:0:0:0:2');
  assert.deepEqual(vlanList('10,20,30-32'), [10, 20, 30, 31, 32]);
  assert.strictEqual(vlanList('10,x'), null);
});

test('trunk allowed VLAN lists: remove from all, add back, and range output', () => {
  const s = get('createSession')({topic: 'trunk', level: 'beginner', net: 5});
  const port = () => s.config('S1').ports['gi0/1'];
  for (const l of ['en', 'conf t', 'int gi0/1', 'switchport mode trunk', 'switchport trunk allowed vlan remove 10,20']) s.run('S1', l);
  assert.strictEqual(port().allowed.length, 4092);
  assert.ok(!port().allowed.includes(10) && port().allowed.includes(11));
  assert.ok(get('swConfigLines')(s.config('S1')).includes(' switchport trunk allowed vlan 1-9,11-19,21-4094'));
  s.run('S1', 'switchport trunk allowed vlan add 10,20');
  assert.strictEqual(port().allowed, null); // all VLANs again
  assert.strictEqual(get('vlanRanges')([1, 2, 3, 5, 7, 8]), '1-3,5,7,8');
});
