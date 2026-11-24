// Answer requirements: the student types what they found, the session compares it with the expected value.
const test = require('node:test');
const assert = require('node:assert');
const get = require('./load');

const answerMatches = get('answerMatches'), createSession = get('createSession');

test('a single answer ignores surrounding whitespace', () => {
  assert.equal(answerMatches(' 214 ', '214'), true);
  assert.equal(answerMatches('213', '214'), false);
});

test('a list answer is a set: any order, separated by spaces, commas or new lines', () => {
  assert.equal(answerMatches('a.conf, b.conf', ['b.conf', 'a.conf']), true);
  assert.equal(answerMatches('a.conf\nb.conf', ['a.conf', 'b.conf']), true);
  assert.equal(answerMatches('a.conf b.conf', ['a.conf', 'b.conf']), true);
  assert.equal(answerMatches('a.conf', ['a.conf', 'b.conf']), false);
  assert.equal(answerMatches('a.conf b.conf c.conf', ['a.conf', 'b.conf']), false);
});

test('a single answer evens out the spaces inside it', () => {
  assert.equal(answerMatches('2026-11-24  08:00 ok', '2026-11-24 08:00 ok'), true);
});

test('a list whose items contain spaces is split at commas and new lines only', () => {
  assert.equal(answerMatches('my file, b c', ['b c', 'my file']), true);
  assert.equal(answerMatches('my file\nb  c', ['b c', 'my file']), true);
  assert.equal(answerMatches('my file', ['b c', 'my file']), false);
  assert.equal(answerMatches('my file b c', ['b c', 'my file']), false);
});

test('an empty or missing answer never matches', () => {
  assert.equal(answerMatches('', '0'), false);
  assert.equal(answerMatches(undefined, 'x'), false);
  assert.equal(answerMatches('  ', []), false);
});

test('a session grades an answer requirement from session.answers, and reset clears it', () => {
  const s = createSession({topic: 'vlans', level: 'beginner', net: 3});
  s.reqs.unshift({text: 'How many?', answer: () => '7', hint: {cmds: ['show vlan brief']}});
  s.reset();
  assert.equal(s.grade()[0], false);
  s.answers[0] = '7';
  assert.equal(s.grade()[0], true);
  s.reset();
  assert.equal(s.grade()[0], false);
});
