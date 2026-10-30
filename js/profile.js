// Profile page: account details plus settings kept in Supabase user_metadata. Uses sb, ACCENTS and applyAccent from auth.js.

const pfForm = $('pf-form');
const pfName = $('pf-name');
const pfMsg = $('pf-msg');
const pfDate = iso => iso ? new Date(iso).toLocaleString() : '—';

for (const [name, color] of Object.entries(ACCENTS)) {
  const label = el('label', 'pf-swatch');
  const radio = el('input');
  radio.type = 'radio';
  radio.name = 'accent';
  radio.value = color;
  radio.setAttribute('aria-label', name);
  radio.addEventListener('change', () => applyAccent(color)); // live preview before saving
  label.style.setProperty('--swatch', color);
  label.title = name;
  label.append(radio);
  $('pf-accents').append(label);
}

sb.auth.onAuthStateChange((_event, session) => {
  $('pf-out').hidden = !!session;
  $('pf-in').hidden = !session;
  if (!session) return;
  const u = session.user;
  const meta = u.user_metadata || {};
  $('pf-email').textContent = u.email;
  $('pf-since').textContent = pfDate(u.created_at);
  $('pf-last').textContent = pfDate(u.last_sign_in_at);
  const days = n => n === 1 ? '1 day' : `${n} days`;
  const today = Math.min(solvesToday(meta, dayKey()), LABS_PER_DAY);
  $('pf-streak').textContent = `${days(liveStreak(meta, dayKey()))} · today ${today}/${LABS_PER_DAY} labs`;
  $('pf-best').textContent = days(meta.best || 0);
  pfName.value = meta.display_name || '';
  const accent = Object.values(ACCENTS).includes(meta.accent) ? meta.accent : ACCENTS.Blue;
  pfForm.querySelector(`input[value="${accent}"]`).checked = true;
});

pfForm.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = pfForm.querySelector('button');
  btn.disabled = true;
  const accent = pfForm.querySelector('input[name="accent"]:checked')?.value;
  const { error } = await sb.auth.updateUser({ data: { display_name: pfName.value.trim(), accent } });
  btn.disabled = false;
  pfMsg.textContent = error ? error.message : 'Saved.';
});

$('pf-pass-form').addEventListener('submit', async e => {
  e.preventDefault();
  const pass = $('pf-pass');
  const { error } = await sb.auth.updateUser({ password: pass.value });
  $('pf-pass-msg').textContent = error ? error.message : 'Password updated.';
  if (!error) pass.value = '';
});

$('pf-logout').addEventListener('click', async () => {
  await sb.auth.signOut();
  location.href = 'index.html';
});
