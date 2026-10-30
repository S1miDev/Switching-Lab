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
const authClose = el('button', 'ghost wide', 'Cancel');
let authSignup = false;

authEmail.type = 'email';
authEmail.autocomplete = 'email';
authEmail.placeholder = 'Email';
authEmail.required = true;
authPass.type = 'password';
authPass.placeholder = 'Password (8+ characters)';
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
  authTitle.textContent = signup ? 'Create account' : 'Log in';
  authGo.textContent = signup ? 'Sign up' : 'Log in';
  authSwap.textContent = signup ? 'I already have an account' : 'Create an account';
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
  if (authSignup && !data.session) { authMsg.textContent = 'Check your inbox to confirm your email, then log in.'; return; }
  authPass.value = '';
  authDlg.close();
});

// logged in: the button opens the profile page, which has Log out
authBtn.addEventListener('click', async () => {
  const { data } = await sb.auth.getSession();
  if (data.session) { location.href = 'profile.html'; return; }
  authMode(false);
  authDlg.showModal();
});

// accent presets for the profile page; all are light enough for the dark --accent-ink text
const ACCENTS = { Blue: '#4C8DFF', Green: '#4FA88A', Amber: '#d9a441', Pink: '#f472b6', Purple: '#a78bfa', Teal: '#2dd4bf' };

function applyAccent(color) {
  const s = document.documentElement.style;
  // user_metadata is user-editable, so only known presets are applied
  if (!Object.values(ACCENTS).includes(color)) { s.removeProperty('--accent'); s.removeProperty('--accent-tint'); return; }
  s.setProperty('--accent', color);
  s.setProperty('--accent-tint', `color-mix(in srgb, ${color} 16%, transparent)`);
}

// called by the lab and topology pages on a solve; nextStreak and dayKey come from streak.js
async function recordStreakDay() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return;
  await sb.auth.updateUser({ data: nextStreak(data.session.user.user_metadata || {}, dayKey()) });
}

sb.auth.onAuthStateChange((_event, session) => {
  const meta = session?.user.user_metadata || {};
  const streak = liveStreak(meta, dayKey());
  authBtn.textContent = session ? (meta.display_name || session.user.email) + (streak ? ` · 🔥 ${streak}` : '') : 'Log in';
  applyAccent(meta.accent);
});
