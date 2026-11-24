// Czech completeness: every display text comes out in Czech when the page is Czech (js/i18n.js L()), so no view mixes the
// two languages. Commands, addresses and names read the same in both, so a text with no word longer than 3 letters passes.
const test = require('node:test');
const assert = require('node:assert');
const {load} = require('./load.js');

const en = load('en'), cs = load('cs');
// texts that are the same in Czech on purpose (product and protocol names)
const SAME = new Set(['Trunking (802.1Q)', 'Spanning Tree Protocol (STP)', 'EtherChannel', 'IPv6 routing', 'DHCP snooping',
  'Dynamic ARP inspection', 'Switching']);
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

test('every Reference group has its Czech name', () => {
  const tr = cs('tr');
  assert.deepEqual(en('REF_GROUPS').filter(g => tr(g) === g && !sameOk(g)), []);
});
