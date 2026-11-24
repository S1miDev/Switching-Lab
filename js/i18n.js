// Language (Czech or English): chosen once per page load, before the data files build their texts with L().
// The switch stores the choice and reloads, so nothing has to re-render. Console and terminal output stays English.
// Logged in, auth.js keeps the choice in user_metadata.lang (langSync).

const LANGS = ['en', 'cs'];
const LANG = (() => {
  let saved = null;
  try { saved = typeof localStorage !== 'undefined' && localStorage.getItem('lang'); } catch {} // storage may be blocked
  if (LANGS.includes(saved)) return saved;
  return typeof navigator !== 'undefined' && /^cs\b/i.test(navigator.language || '') ? 'cs' : 'en';
})();

// a text in the page's language: L('Start lab', 'Spustit lab'); without Czech, the English
const L = (en, cs) => (LANG === 'cs' && cs ? cs : en);

// Czech for the markup (elements marked data-i18n) and for display-only keys such as domain and group names, by English text
const CS = {
  'Log in': 'Přihlásit se',
};
const tr = en => (LANG === 'cs' && CS[en]) || en;

// the Czech plural: 1 host, 2-4 hosty, 0 or 5+ hostů
const cz = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

// what auth.js does with the account's saved language: push a choice made on this device (pending), pull a different
// valid saved one (then reload once), else nothing. user_metadata is user-editable, so only known languages count.
const langSync = (meta, pending) => (pending ? 'push' : LANGS.includes(meta.lang) && meta.lang !== LANG ? 'pull' : null);

function setLang(lang) {
  localStorage.setItem('lang', lang);
  localStorage.setItem('langPending', '1');
  location.reload();
}

if (typeof document !== 'undefined') {
  document.documentElement.lang = LANG;
  // own text nodes only, so a <label>'s <input> survives
  document.querySelectorAll('[data-i18n]').forEach(e => {
    for (const n of e.childNodes) if (n.nodeType === 3 && n.data.trim()) n.data = n.data.replace(n.data.trim(), tr(n.data.trim()));
    for (const a of ['placeholder', 'aria-label', 'title']) if (e.hasAttribute(a)) e.setAttribute(a, tr(e.getAttribute(a)));
  });
  const other = LANG === 'cs' ? 'en' : 'cs';
  const sw = document.createElement('button');
  sw.type = 'button';
  sw.className = document.querySelector('nav.side') ? 'nav-item' : 'ghost';
  sw.textContent = other.toUpperCase().replace('CS', 'CZ');
  sw.setAttribute('aria-label', other === 'cs' ? 'Čeština' : 'English');
  sw.lang = other;
  sw.addEventListener('click', () => setLang(other));
  (document.querySelector('nav.side') || document.querySelector('.sb-bar')).append(sw);
}
