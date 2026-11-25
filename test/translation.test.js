// Czech completeness: every display text comes out in Czech when the page is Czech (js/i18n.js L()), so no view mixes the
// two languages. Commands, addresses and names read the same in both, so a text with no word longer than 3 letters passes.
const test = require('node:test');
const assert = require('node:assert');
const {load} = require('./load.js');

const en = load('en'), cs = load('cs');
// texts that are the same in Czech on purpose (product and protocol names)
const SAME = new Set(['Trunking (802.1Q)', 'Spanning Tree Protocol (STP)', 'EtherChannel', 'IPv6 routing', 'DHCP snooping',
  'Dynamic ARP inspection', 'Switching', 'Router', 'Switch', 'L3 switch', 'Ubuntu 24.04']);
const sameOk = t => SAME.has(t) || !/[A-Za-zÀ-ž]{4,}/.test(t.replace(/\b[A-Z0-9][A-Za-z0-9-]*[A-Z0-9][a-z]?\b/g, ''));

// pairs [where, english, czech] that read the same although they should not
const untranslated = pairs => pairs.filter(([, e, c]) => e === c && !sameOk(e)).map(([at, e]) => `${at}: ${e}`);

// every display text of a catalogue, with where it is
function catalogueTexts(get, name) {
  const out = [];
  for (const [id, t] of Object.entries(get(name))) {
    out.push([`${id}.name`, t.name], [`${id}.desc`, t.desc]);
    const r = t.ref;
    if (!r) continue;
    out.push([`${id}.summary`, r.summary], [`${id}.cta`, r.cta], [`${id}.intro`, r.intro]);
    (r.know || []).forEach((k, i) => out.push([`${id}.know[${i}]`, k]));
    (r.commands || []).forEach((c, i) => out.push([`${id}.commands[${i}]`, c[2]]));
    (r.mistakes || []).forEach((m, i) => out.push([`${id}.mistakes[${i}]`, m]));
  }
  return out.filter(([, t]) => t !== undefined);
}
const zip = (a, b) => a.map(([at, e], i) => [at, e, b[i][1]]);

test('the Switching catalogue is all in Czech', () => {
  assert.deepEqual(untranslated(zip(catalogueTexts(en, 'CATALOGUE'), catalogueTexts(cs, 'CATALOGUE'))), []);
  assert.deepEqual(untranslated(Object.entries(en('DOMAINS')).map(([n, e]) => [`domain ${n}`, e, cs('DOMAINS')[n]])), []);
});

test('the Switching catalogue keeps its keys, commands and modes in English', () => {
  for (const [id, t] of Object.entries(en('CATALOGUE'))) {
    const c = cs('CATALOGUE')[id];
    assert.deepEqual([c.refGroup, c.keywords, c.labLevels, c.domain], [t.refGroup, t.keywords, t.labLevels, t.domain], id);
    if (t.ref) assert.deepEqual([c.ref.verify, c.ref.commands.map(r => r.slice(0, 2))], [t.ref.verify, t.ref.commands.map(r => r.slice(0, 2))], id);
  }
});

// every text a lab session shows: subtitle, scenario, steps, requirements and diagram labels
const sessionTexts = s => [['sub', s.sub], ['lead', s.lead], ...s.steps.map((t, i) => [`step ${i}`, t]),
  ...s.reqs.map((r, i) => [`req ${i}`, r.text]), ...s.nodes.map(n => [`node ${n.id}`, n.sub])].filter(([, t]) => t);

test('every Switching lab is all in Czech', () => {
  const misses = [];
  for (const [id, t] of Object.entries(en('CATALOGUE'))) for (const level of t.labLevels) {
    const a = en('createSession')({topic: id, level, net: 7}), b = cs('createSession')({topic: id, level, net: 7});
    misses.push(...untranslated(zip(sessionTexts(a), sessionTexts(b))).map(m => `${id} ${level} ${m}`));
  }
  assert.deepEqual(misses, []);
});

const lx = require('./linux-load.js').load, lxEn = lx('en'), lxCs = lx('cs');

test('the Linux catalogue is all in Czech', () => {
  assert.deepEqual(untranslated(zip(catalogueTexts(lxEn, 'LINUX_CATALOGUE'), catalogueTexts(lxCs, 'LINUX_CATALOGUE'))), []);
  assert.deepEqual(untranslated(Object.entries(lxEn('LINUX_DOMAINS')).map(([n, e]) => [`domain ${n}`, e, lxCs('LINUX_DOMAINS')[n]])), []);
  const tr = lxCs('tr');
  assert.deepEqual(lxEn('LINUX_REF_GROUPS').filter(g => tr(g) === g), []);
});

test('every Linux lab is all in Czech', () => {
  const misses = [];
  for (const [id, t] of Object.entries(lxEn('CATALOGUE'))) for (const level of t.labLevels) {
    const a = lxEn('createSession')({topic: id, level, net: 7}), b = lxCs('createSession')({topic: id, level, net: 7});
    misses.push(...untranslated(zip(sessionTexts(a), sessionTexts(b))).map(m => `${id} ${level} ${m}`));
  }
  assert.deepEqual(misses, []);
});

// a text can be different and still half English (a lead with an English start): no English function words may be left
const ENGLISH = /(?<![\w-])(the|is|are|and|with|from|serves|has|have|into|your|you|this|that|will|should|must|when|which)(?![\w-])/;
const englishLeft = (get, name) => {
  const out = new Set();
  for (const [id, t] of Object.entries(get(name))) {
    const texts = catalogueTexts(get, name).filter(([at]) => at.startsWith(id + '.')).map(([, x]) => x);
    for (const level of t.labLevels) texts.push(...sessionTexts(get('createSession')({topic: id, level, net: 7})).map(([, x]) => x));
    for (const x of texts) if (ENGLISH.test(x)) out.add(`${id}: ${x}`);
  }
  return [...out];
};

test('no Czech text keeps English words', () => {
  assert.deepEqual(englishLeft(cs, 'CATALOGUE'), []);
  assert.deepEqual(englishLeft(lxCs, 'LINUX_CATALOGUE'), []);
  assert.ok(englishLeft(en, 'CATALOGUE').length > 100, 'the check finds English in the English texts');
});

test('every Reference group has its Czech name', () => {
  const tr = cs('tr');
  assert.deepEqual(en('REF_GROUPS').filter(g => tr(g) === g && !sameOk(g)), []);
});
