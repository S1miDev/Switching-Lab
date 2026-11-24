// Every Linux lab builds, and its known-good solution (plus the right answers) meets every requirement, which a fresh
// lab does not, in both languages. Mirrors test/labs.test.js for the Switching labs.
const test = require('node:test');
const assert = require('node:assert');
const get = require('./linux-load');
const switching = require('./load');

const CATALOGUE = get('LINUX_CATALOGUE'), LABS = get('LINUX_LABS'), createSession = get('createSession');
const NETS = [0, 37, 101, 200, 255];

// type a line; sudo's password prompt gets student's password, as the student would type it (other prompts, such as
// passwd's, are answered by the next solution lines)
function type(s, line) {
  const out = s.run('lab', line);
  const dev = s.devices.lab;
  if (dev.asksPassword() && dev.prompt().startsWith('[sudo]')) out.push(...s.run('lab', 'student'));
  return out.filter(l => l.cls === 'ln-err').map(l => l.text);
}
const fill = (s, value) => s.reqs.forEach((r, i) => { if (r.answer) s.answers[i] = value(r, i); });
const right = (s, r) => [].concat(r.answer(s)).join(', ');

test('Linux topic ids are prefixed and never clash with Switching ids', () => {
  const swIds = Object.keys(switching('CATALOGUE'));
  for (const id of Object.keys(CATALOGUE)) {
    assert.match(id, /^lx-/);
    assert.ok(!swIds.includes(id), id);
  }
});

test('catalogue and lab builds agree, and every topic has a full reference entry', () => {
  for (const id of Object.keys(CATALOGUE)) {
    assert.deepEqual(LABS[id] ? Object.keys(LABS[id].levels) : [], [...CATALOGUE[id].labLevels], id);
    const c = CATALOGUE[id], ref = c.ref;
    assert.ok(c.name && c.desc && c.keywords.length && get('LINUX_DOMAINS')[c.domain] && get('LINUX_REF_GROUPS').includes(c.refGroup), id);
    for (const k of ['summary', 'cta', 'intro']) assert.ok(ref[k], `${id} ref.${k}`);
    for (const k of ['know', 'commands', 'verify', 'mistakes']) assert.ok(ref[k].length, `${id} ref.${k}`);
    for (const row of ref.commands) assert.equal(row.length, 3, `${id}: ${row[0]}`);
  }
  for (const id of Object.keys(LABS)) assert.ok(CATALOGUE[id], `${id} has no topic`);
});

for (const lang of ['en', 'cs']) {
  const createSession = get.load(lang)('createSession');
  for (const [id, T] of Object.entries(LABS)) for (const level of Object.keys(T.levels)) {
    test(`${id} ${level} (${lang})`, () => {
      for (const net of NETS) {
        const s = createSession({topic: id, level, net});
        const at = `${id} ${level} x=${net}`;
        assert.ok(s.reqs.length && s.steps.length && s.sub && s.lead, `${at}: has requirements, steps and texts`);
        assert.equal(s.home, 'lab');
        for (const r of s.reqs) {
          assert.ok(r.text && (typeof r.ok === 'function') !== (typeof r.answer === 'function'), `${at}: requirement shape: ${r.text}`);
          assert.ok(Array.isArray(r.hint.cmds) && r.hint.cmds.length, `${at}: hint commands: ${r.text}`);
        }
        assert.ok(s.solution.length === 1 && s.solution[0][1].length, `${at}: has a solution`);
        assert.ok(!s.solution[0][1].includes('student'), `${at}: the solution never holds the password`);
        const fresh = JSON.stringify(s.devices.lab.state.root);
        assert.ok(!s.grade().every(Boolean), `${at}: starts out solved`);
        for (const line of s.solution[0][1]) assert.deepEqual(type(s, line), [], `${at}: ${line}`);
        assert.equal(s.devices.lab.state.askPw, null, `${at}: the solution leaves a prompt open: ${s.devices.lab.prompt()}`);
        fill(s, r => right(s, r));
        assert.deepEqual(s.reqs.filter((r, i) => !s.grade()[i]).map(r => r.text), [], `${at}: unmet after the solution`);
        s.reqs.forEach((r, i) => {
          if (!r.answer) return;
          s.answers[i] = 'wrong';
          assert.equal(s.grade()[i], false, `${at}: a wrong answer passes: ${r.text}`);
          s.answers[i] = right(s, r);
        });
        s.reset();
        assert.ok(!s.grade().every(Boolean), `${at}: solved after reset`);
        assert.equal(JSON.stringify(s.devices.lab.state.root), fresh, `${at}: reset gives the same system`);
      }
    });
  }
}

test('the random values change between labs', () => {
  for (const [id, T] of Object.entries(LABS)) {
    for (const level of Object.keys(T.levels)) {
      const subs = new Set(NETS.map(net => { const s = createSession({topic: id, level, net}); return [s.sub, ...s.steps, ...s.reqs.map(r => r.text)].join(' '); }));
      assert.ok(subs.size > 1, `${id} ${level} is the same every time`);
    }
  }
});
