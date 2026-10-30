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

test('a PC takes a static address', () => {
  session.run('PC1', 'ip 192.168.1.10 255.255.255.0 192.168.1.1');
  assert.ok(texts('PC1', 'ipconfig').some(t => t.includes('192.168.1.10/24')));
});

test('display-only devices refuse commands', () => {
  const ro = get('createSession')({topic: 'static', level: 'beginner', net: 5});
  assert.match(ro.run('R2', 'en')[0].text, /Not configurable/);
});
