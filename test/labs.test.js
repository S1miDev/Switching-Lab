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
      assert.ok(session.solution.length, 'has a known-good solution');
      for (const [name, lines] of session.solution) assert.ok(lines.some(l => !['enable', 'conf t', 'end'].includes(l)), `${name} block is not empty`);
      // a preset config is typed on every reset, which hides its errors: type it again here to see them
      for (const [name, lines] of session.setup || []) {
        for (const line of ['enable', 'conf t', ...lines, 'end', 'disable']) assert.deepEqual(errorsOf(session, name, line), [], `setup ${name}: ${line}`);
      }
      assert.ok(!session.grade().every(Boolean), 'starts out solved');
      for (const [name, lines] of session.solution) {
        for (const line of lines) assert.deepEqual(errorsOf(session, name, line), [], `${name}: ${line}`);
      }
      assert.deepEqual(unmet(session), []);
    });
  }
}

test('vlsm host needs vary per network and always fit aligned in the /24', () => {
  const seen = new Set();
  for (let x = 0; x < 256; x++) {
    for (const level of Object.keys(LABS.vlsm.levels)) {
      const s = createSession({topic: 'vlsm', level, net: x});
      const ifs = s.nodes.filter(n => n.type === 'pc').map(n => +n.sub.match(/(\d+) hosts/)[1]);
      let off = 0;
      for (const need of ifs) {
        let size = 4;
        while (size - 2 < need) size *= 2;
        assert.equal(off % size, 0, `x=${x} ${level}: block of ${size} misaligned at ${off}`);
        off += size;
      }
      assert.ok(off <= 256, `x=${x} ${level}: overflows /24`);
      if (level === 'advanced') seen.add(ifs.join());
    }
  }
  assert.ok(seen.size > 20, 'needs differ between labs');
});
