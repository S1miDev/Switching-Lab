// Accounts: email + password sign up / log in through Supabase Auth. Uses el and $ from dom.js.
// The URL and publishable key are public by design; access is protected by Row Level Security on any table.

const sb = supabase.createClient(
  'https://nbswxmsopowarotqswnd.supabase.co',
  'sb_publishable_aSKQ2Oi7H7cbSqz6FkmBbg_CiZh6XO-'
);

const authBtn = $('nav-auth');
const authDlg = el('dialog', 'auth-dlg');
const authTitle = el('h2');
const authEmail = el('input');
const authPass = el('input');
const authMsg = el('p', 'note');
const authGo = el('button', 'wide');
const authSwap = el('button', 'ghost wide');
const authClose = el('button', 'ghost wide', L('Cancel', 'Zrušit'));
let authSignup = false;

authEmail.type = 'email';
authEmail.autocomplete = 'email';
authEmail.placeholder = L('Email', 'E-mail');
authEmail.required = true;
authPass.type = 'password';
authPass.placeholder = L('Password (8+ characters)', 'Heslo (aspoň 8 znaků)');
authPass.minLength = 8;
authPass.required = true;
authMsg.setAttribute('role', 'status');
authGo.type = 'submit';
authSwap.type = 'button';
authClose.type = 'button';

const authForm = el('form', 'auth-form');
authForm.append(authTitle, authEmail, authPass, authMsg, authGo, authSwap, authClose);
authDlg.append(authForm);
document.body.append(authDlg);

function authMode(signup) {
  authSignup = signup;
  authTitle.textContent = signup ? L('Create account', 'Nový účet') : L('Log in', 'Přihlášení');
  authGo.textContent = signup ? L('Sign up', 'Zaregistrovat se') : L('Log in', 'Přihlásit se');
  authSwap.textContent = signup ? L('I already have an account', 'Už mám účet') : L('Create an account', 'Vytvořit účet');
  authPass.autocomplete = signup ? 'new-password' : 'current-password';
  authMsg.textContent = '';
}

authSwap.addEventListener('click', () => authMode(!authSignup));
authClose.addEventListener('click', () => authDlg.close());

authForm.addEventListener('submit', async e => {
  e.preventDefault();
  authGo.disabled = true;
  authMsg.textContent = '';
  const creds = { email: authEmail.value.trim(), password: authPass.value };
  const { data, error } = authSignup ? await sb.auth.signUp(creds) : await sb.auth.signInWithPassword(creds);
  authGo.disabled = false;
  if (error) { authMsg.textContent = error.message; return; }
  // with "Confirm email" on, sign up returns no session until the link in the email is clicked
  if (authSignup && !data.session) { authMsg.textContent = L('Check your inbox to confirm your email, then log in.', 'Potvrď e-mail odkazem ve schránce a pak se přihlas.'); return; }
  authPass.value = '';
  authDlg.close();
});

// logged in: the button opens the Profile view of the landing page, which has Log out (on the landing page only the hash changes)
authBtn.addEventListener('click', async () => {
  const { data } = await sb.auth.getSession();
  if (data.session) { location.href = 'index.html#profile'; return; }
  authMode(false);
  authDlg.showModal();
});

// accent presets for the profile page; all are light enough for the dark --color-accent-ink text
const ACCENTS = { Blue: '#4C8DFF', Green: '#5FD38D', Amber: '#d9a441', Pink: '#f472b6', Purple: '#a78bfa', Teal: '#2dd4bf' };

function applyAccent(color) {
  const s = document.documentElement.style;
  // user_metadata is user-editable, so only known presets are applied
  if (!Object.values(ACCENTS).includes(color)) { s.removeProperty('--color-accent'); s.removeProperty('--color-accent-tint'); return; }
  s.setProperty('--color-accent', color);
  s.setProperty('--color-accent-tint', `color-mix(in srgb, ${color} 16%, transparent)`);
}

// called by the lab and topology pages on a solve; nextStreak and dayKey come from streak.js
// topic and level (labs only) are also saved as done
async function recordStreakDay(topic, level) {
  const { data } = await sb.auth.getSession();
  if (!data.session) return;
  const meta = data.session.user.user_metadata || {};
  await sb.auth.updateUser({ data: { ...nextStreak(meta, dayKey()), ...withDone(meta, topic, level) } });
}

sb.auth.onAuthStateChange((_event, session) => {
  const meta = session?.user.user_metadata || {};
  const streak = liveStreak(meta, dayKey());
  authBtn.textContent = session ? (meta.display_name || session.user.email) + (streak ? ` · 🔥 ${streak}` : '') : L('Log in', 'Přihlásit se');
  applyAccent(meta.accent);
  if (!session) return;
  const sync = langSync(meta, localStorage.getItem('langPending'));
  // the flag goes first, so the USER_UPDATED event this push fires finds nothing to push; Supabase calls are deferred out of
  // its own callback; a failed push sets the flag again for the next page
  if (sync === 'push') {
    localStorage.removeItem('langPending');
    setTimeout(() => sb.auth.updateUser({data: {lang: LANG}}).then(({error}) => { if (error) localStorage.setItem('langPending', '1'); }));
  }
  if (sync === 'pull') { localStorage.setItem('lang', meta.lang); location.reload(); }
});
