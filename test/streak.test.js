// Day streak counting (js/streak.js)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'streak.js'), 'utf8'), ctx);
const { nextStreak, liveStreak } = vm.runInContext('({nextStreak, liveStreak})', ctx);
const plain = o => JSON.parse(JSON.stringify(o));

// meta after n solves on `day`, starting from `meta`
function solve(meta, day, n) {
  for (let i = 0; i < n; i++) meta = { ...meta, ...plain(nextStreak(meta, day)) };
  return meta;
}

test('fewer than three solves in a day do not start a streak', () => {
  const meta = solve({}, '2026-10-30', 2);
  assert.strictEqual(meta.streak, undefined);
  assert.strictEqual(meta.solves, 2);
});

test('the third solve starts a streak of 1', () => {
  const meta = solve({}, '2026-10-30', 3);
  assert.deepEqual([meta.streak, meta.best, meta.last_day], [1, 1, '2026-10-30']);
});

test('more solves on the same day do not count the day twice', () => {
  assert.strictEqual(solve({}, '2026-10-30', 7).streak, 1);
});

test('the solve count restarts each day', () => {
  const meta = solve(solve({}, '2026-10-30', 2), '2026-10-31', 1);
  assert.strictEqual(meta.solves, 1);
  assert.strictEqual(meta.streak, undefined);
});

test('three solves the next day extend it, across a month end', () => {
  const meta = solve({ streak: 4, best: 9, last_day: '2026-10-31' }, '2026-11-01', 3);
  assert.deepEqual([meta.streak, meta.best], [5, 9]);
});

test('a missed day resets it but keeps the best', () => {
  const meta = solve({ streak: 6, best: 6, last_day: '2026-10-28' }, '2026-10-30', 3);
  assert.deepEqual([meta.streak, meta.best], [1, 6]);
});

test('the shown streak survives until the end of the next day', () => {
  const meta = { streak: 2, last_day: '2026-10-29' };
  assert.strictEqual(liveStreak(meta, '2026-10-30'), 2);
  assert.strictEqual(liveStreak(meta, '2026-10-31'), 0);
});
