// Every lab builds, and every known-good solution meets all its requirements (which a fresh lab does not).
const test = require('node:test');
const assert = require('node:assert');
const get = require('./load');

const CATALOGUE = get('CATALOGUE'), LABS = get('LABS'), createSession = get('createSession');
const net = get('randomNet')();

// the error lines a typed line prints (a failed ping is not an error here)
const errorsOf = (session, name, line) => session.run(name, line).filter(l => l.cls === 'ln-err' && !/ping|timed out/i.test(l.text)).map(l => l.text);
const unmet = session => session.reqs.filter((r, i) => !session.grade()[i]).map(r => r.text);

test('catalogue and lab builds agree', () => {
  for (const id of Object.keys(CATALOGUE)) {
    assert.deepEqual(LABS[id] ? Object.keys(LABS[id].levels) : [], CATALOGUE[id].labLevels, id);
  }
  for (const id of Object.keys(LABS)) assert.ok(CATALOGUE[id], `${id} has no topic`);
});

for (const [id, T] of Object.entries(LABS)) {
  for (const level of Object.keys(T.levels)) {
    test(`${id} ${level}`, () => {
      const session = createSession({topic: id, level, net});
      assert.ok(session.reqs.length && session.steps.length, 'has requirements and steps');
      assert.ok(session.nodes.some(n => n.id === session.home), 'home is a node');
      for (const r of session.reqs) {
        assert.ok(r.text && typeof r.ok === 'function' && Array.isArray(r.hint.cmds) && r.hint.cmds.length, `requirement shape: ${r.text}`);
      }
      if (T.kind === 'rt') assert.ok(session.solution.length, 'router labs have a solution');
      // a preset config is typed on every reset, which hides its errors: type it again here to see them
      for (const [name, lines] of session.setup || []) {
        for (const line of ['enable', 'conf t', ...lines, 'end', 'disable']) assert.deepEqual(errorsOf(session, name, line), [], `setup ${name}: ${line}`);
      }
      if (!session.solution.length) return;
      assert.ok(!session.grade().every(Boolean), 'starts out solved');
      for (const [name, lines] of session.solution) {
        for (const line of lines) assert.deepEqual(errorsOf(session, name, line), [], `${name}: ${line}`);
      }
      assert.deepEqual(unmet(session), []);
    });
  }
}
