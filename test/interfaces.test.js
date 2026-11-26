// Speed, duplex and port security faults (portLink in devices/switch.js)
const test = require('node:test');
const assert = require('node:assert');
const get = require('./load');

const createSession = get('createSession'), portLink = get('portLink');

// the beginner interface lab with its one fault fixed: a working PC1 - S1 = S2 - PC2
function working() {
  const s = createSession({topic: 'iftrouble', level: 'beginner', net: 5});
  conf(s, 'S2', 'int fa0/1', 'no shutdown');
  return s;
}
const conf = (s, name, ...lines) => ['enable', 'conf t', ...lines, 'end'].flatMap(l => s.run(name, l));
const show = (s, name, line) => s.run(name, line).map(l => l.text).join('\n');
const pings = s => s.devices.PC1.canReach('192.168.10.2');

test('speed set differently on the two ends takes the link down', () => {
  const s = working();
  assert.ok(pings(s));
  conf(s, 'S1', 'int gi0/1', 'speed 1000');
  assert.ok(pings(s), 'the auto end follows');
  conf(s, 'S2', 'int gi0/1', 'speed 100');
  assert.ok(!pings(s));
  assert.match(show(s, 'S1', 'show interfaces gi0/1'), /is down, line protocol is down \(notconnect\)/);
  assert.match(show(s, 'S1', 'show interfaces status'), /Gi0\/1\s+notconnect/);
  assert.match(show(s, 'S1', 'show ip interface brief'), /Gi0\/1\s+unassigned\s+down/);
  assert.match(show(s, 'S2', 'show running-config'), / speed 100/);
  conf(s, 'S2', 'int gi0/1', 'speed auto');
  assert.ok(pings(s));
});

test('a duplex mismatch still pings, and the counters give it away on both ends', () => {
  const s = working();
  conf(s, 'S1', 'int gi0/1', 'duplex full');
  conf(s, 'S2', 'int gi0/1', 'duplex half');
  assert.ok(pings(s));
  assert.match(show(s, 'S1', 'show interfaces gi0/1'), /Full-duplex[\s\S]*[1-9]\d* CRC[\s\S]* 0 late collision/);
  assert.match(show(s, 'S2', 'show interfaces gi0/1'), /Half-duplex[\s\S]* 0 CRC[\s\S]*[1-9]\d* late collision/);
});

test('an auto end falls back to half only when the other end has speed and duplex both fixed', () => {
  const s = working();
  const up = () => portLink(s, 'S1', 'gi0/1');
  conf(s, 'S1', 'int gi0/1', 'duplex full');
  assert.ok(!up().mismatch, 'duplex alone is still negotiated');
  conf(s, 'S1', 'int gi0/1', 'speed 100');
  assert.ok(up().mismatch);
  assert.strictEqual(portLink(s, 'S2', 'gi0/1').duplex, 'half');
  conf(s, 'S1', 'int fa0/1', 'speed 100', 'duplex full');
  assert.ok(portLink(s, 'S1', 'fa0/1').mismatch, 'a PC negotiates, so it falls back too');
});

test('a port is connected only when something is cabled to it', () => {
  assert.match(show(working(), 'S1', 'show interfaces status'), /Fa0\/3\s+notconnect/);
  // lab diagrams with display-only neighbours, or PCs that do not say where they are cabled, still count as cabled
  for (const [topic, level, dev, keys] of [['static', 'advanced', 'R1', ['gi0/0', 'gi0/1', 'gi0/2']], ['ipv4', 'beginner', 'R1', ['gi0/0']],
    ['mlsvlan', 'advanced', 'MLS1', ['gi0/1']]]) {
    const s = createSession({topic, level, net: 5});
    for (const [name, lines] of s.solution) lines.forEach(l => s.run(name, l));
    for (const key of keys) assert.strictEqual(portLink(s, dev, key).state, 'connected', `${topic} ${dev} ${key}`);
  }
});

test('speed and duplex refuse what the port cannot do', () => {
  const s = working();
  for (const l of ['enable', 'conf t', 'int fa0/1']) s.run('S1', l);
  for (const l of ['speed 1000', 'speed fast', 'duplex both']) assert.match(show(s, 'S1', l), /Invalid input/, l);
  assert.strictEqual(show(s, 'S1', 'speed 100'), '');
});

test('a wrong secure MAC err-disables the port until the cause is fixed and the port is bounced', () => {
  const s = working();
  const state = () => portLink(s, 'S1', 'fa0/1').state;
  conf(s, 'S1', 'int fa0/1', 'switchport port-security', 'switchport port-security mac-address 0050.7966.9999');
  assert.strictEqual(state(), 'err-disabled');
  assert.ok(!pings(s));
  assert.match(show(s, 'S1', 'show interfaces status err-disabled'), /Fa0\/1\s+err-disabled\s+psecure-violation/);
  assert.match(show(s, 'S1', 'show port-security interface fa0/1'), /Secure-shutdown[\s\S]*0050\.7966\.6801/);
  conf(s, 'S1', 'int fa0/1', 'no shutdown');
  assert.strictEqual(state(), 'err-disabled', 'no shutdown alone does nothing');
  conf(s, 'S1', 'int fa0/1', 'shutdown', 'no shutdown');
  assert.strictEqual(state(), 'err-disabled', 'trips again while the cause remains');
  conf(s, 'S1', 'int fa0/1', 'no switchport port-security mac-address 0050.7966.9999', 'shutdown');
  assert.strictEqual(state(), 'disabled');
  conf(s, 'S1', 'int fa0/1', 'no shutdown');
  assert.strictEqual(state(), 'connected');
  assert.ok(pings(s));
});

test('the right secure MAC passes; restrict drops a wrong one without disabling the port', () => {
  const s = working();
  assert.match(show(s, 'PC1', 'ipconfig'), /0050\.7966\.6801/);
  conf(s, 'S1', 'int fa0/1', 'switchport port-security', 'switchport port-security mac-address 0050.7966.6801');
  assert.ok(pings(s));
  conf(s, 'S1', 'int fa0/1', 'switchport port-security violation restrict',
    'no switchport port-security mac-address 0050.7966.6801', 'switchport port-security mac-address 0050.7966.9999');
  assert.strictEqual(portLink(s, 'S1', 'fa0/1').state, 'connected');
  assert.ok(!pings(s));
  conf(s, 'S1', 'int fa0/1', 'switchport port-security maximum 2');
  assert.ok(pings(s), 'a free slot lets the PC address be learned');
});

test('a router interface shows its real speed and duplex', () => {
  const s = createSession({topic: 'intervlan', level: 'beginner', net: 5});
  assert.match(show(s, 'R1', 'show interfaces gi0/0'), /Full-duplex, 1Gbps/);
  conf(s, 'R1', 'int gi0/0', 'speed 100', 'duplex half', 'no shutdown');
  assert.match(show(s, 'R1', 'show interfaces gi0/0'), /Half-duplex, 100Mbps/);
  assert.match(show(s, 'R1', 'show running-config'), / speed 100\n duplex half/);
});
