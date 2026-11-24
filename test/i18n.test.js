// Language choice and helpers (js/i18n.js)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'i18n.js'), 'utf8');

// i18n.js in a context with an optional saved language and browser language
function load(saved, browser) {
  const ctx = vm.createContext({});
  if (saved !== undefined) ctx.localStorage = {getItem: k => (k === 'lang' ? saved : null)};
  if (browser !== undefined) ctx.navigator = {language: browser};
  vm.runInContext(SRC, ctx);
  return vm.runInContext('({LANG, L, tr, cz, langSync})', ctx);
}

test('the language: a saved choice wins, then the browser language, else English', () => {
  assert.equal(load('cs', 'en-US').LANG, 'cs');
  assert.equal(load('en', 'cs-CZ').LANG, 'en');
  assert.equal(load(null, 'cs-CZ').LANG, 'cs');
  assert.equal(load(null, 'cs').LANG, 'cs');
  assert.equal(load(null, 'de-DE').LANG, 'en');
  assert.equal(load('xx', 'de').LANG, 'en', 'an unknown saved value is ignored');
  assert.equal(load().LANG, 'en', 'no localStorage or navigator (node tests)');
});

test('L and tr give Czech only when the page is Czech, else English', () => {
  const cs = load('cs'), en = load('en');
  assert.equal(cs.L('Start', 'Začít'), 'Začít');
  assert.equal(en.L('Start', 'Začít'), 'Start');
  assert.equal(cs.L('Start'), 'Start', 'no Czech falls back to English');
  assert.equal(cs.tr('Log in'), 'Přihlásit se');
  assert.equal(en.tr('Log in'), 'Log in');
  assert.equal(cs.tr('no such text'), 'no such text');
});

test('cz picks the Czech plural form', () => {
  const {cz} = load('cs');
  assert.deepEqual([0, 1, 2, 4, 5, 11, 22].map(n => cz(n, 'host', 'hosty', 'hostů')),
    ['hostů', 'host', 'hosty', 'hosty', 'hostů', 'hostů', 'hostů']);
});

// Every word of page text in the markup is marked data-i18n and has its Czech in CS. Text that reads the same in Czech is listed.
const SAME = new Set(['ls-labbing', 'Linux', 'CCNA', 'Expert', 'PC', 'WLC', 'DHCP server', 'Router', 'Switch', 'Serial', 'Console',
  '0/0', '%', '→', '←', '·']);
const PAGES = ['index.html', 'switching.html'];
const decode = s => s.replace(/&amp;/g, '&').replace(/&larr;/g, '←').replace(/&rarr;/g, '→').replace(/\s+/g, ' ').trim();

test('every page text is marked data-i18n and has a Czech entry', () => {
  const ctx = vm.createContext({});
  vm.runInContext(SRC, ctx);
  const CS = vm.runInContext('CS', ctx);
  const missing = [];
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<head>[\s\S]*?<\/head>/, '');
    // each piece of text with the tag just before it
    for (const m of html.matchAll(/<(\/?)([a-z0-9]+)((?:"[^"]*"|[^>"])*)>([^<]*)/gi)) {
      const [, closing, , attrs, raw] = m, marked = /\sdata-i18n\b/.test(attrs);
      const texts = [];
      const text = decode(raw);
      if (/[A-Za-z]/.test(text)) texts.push(text);
      if (!closing) for (const a of attrs.matchAll(/\s(placeholder|aria-label|title)="([^"]*)"/g)) texts.push(decode(a[2]));
      for (const t of texts) {
        if (SAME.has(t)) continue;
        if (closing || !marked) missing.push(`${page}: not marked: ${t}`);
        else if (!CS[t]) missing.push(`${page}: no Czech: ${t}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test('langSync: push a pending choice, pull a different valid saved one, else nothing (no reload loop)', () => {
  const {langSync} = load('en');
  assert.equal(langSync({lang: 'cs'}, '1'), 'push');
  assert.equal(langSync({lang: 'cs'}, null), 'pull');
  assert.equal(langSync({lang: 'en'}, null), null, 'after a pull the languages match');
  assert.equal(langSync({}, null), null);
  assert.equal(langSync({lang: 'xx'}, null), null, 'user_metadata is user-editable');
});
