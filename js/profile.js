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

// one card per exam domain; each topic gets a bar with a segment per difficulty level
function renderProgress(done) {
  const groups = {};
  let have = 0, total = 0, segIndex = 0;
  for (const [id, c] of Object.entries(CATALOGUE)) {
    if (!c.labLevels?.length) continue; // reference-only topics have an empty list
    const mine = c.labLevels.filter(l => done[id]?.includes(l));
    have += mine.length;
    total += c.labLevels.length;
    const row = el('div', 'pf-topic' + (mine.length === c.labLevels.length ? ' full' : ''));
    const head = el('div', 'pf-topic-head');
    head.append(el('span', 'pf-topic-name', c.name), el('span', 'count', `${mine.length}/${c.labLevels.length}`));
    const segs = el('div', 'pf-segs');
    for (const l of c.labLevels) {
      const on = mine.includes(l);
      const seg = el('span', on ? 'on' : '');
      seg.style.setProperty('--i', segIndex++); // staggers the fill-in animation
      seg.title = `${l[0].toUpperCase() + l.slice(1)}${on ? ' · done' : ''}`;
      segs.append(seg);
    }
    row.append(head, segs);
    (groups[c.domain] ||= []).push(row);
  }
  const pct = total ? Math.round(100 * have / total) : 0;
  $('pf-ring').style.setProperty('--pct', pct);
  $('pf-ring').setAttribute('aria-label', `${pct}% complete`);
  $('pf-pct').textContent = pct + '%';
  $('pf-sum-text').textContent = `${have} of ${total} labs solved`;
  $('pf-progress').replaceChildren(...Object.entries(groups).map(([d, rows]) => {
    const g = el('div', 'pf-domain');
    g.append(el('h3', '', `${d}.0 ${DOMAINS[d]}`), ...rows);
    return g;
  }));
}

// counts down 24h from the solve that extended the streak (fallback: end of today, or of tomorrow once solved today)
let resetTimer;
function showReset(meta) {
  clearInterval(resetTimer);
  const out = $('pf-reset');
  if (!liveStreak(meta, dayKey())) return void (out.textContent = '–');
  let d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + (meta.last_day === dayKey() ? 2 : 1));
  if (meta.last_at) d = meta.last_at + 864e5; // 24h after the streak was extended; older accounts have no last_at
  const tick = () => {
    const s = Math.max(0, Math.floor((d - Date.now()) / 1000));
    const p = n => String(n).padStart(2, '0');
    out.textContent = `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
  };
  tick();
  resetTimer = setInterval(tick, 1000);
}

sb.auth.onAuthStateChange((_event, session) => {
  $('pf-out').hidden = !!session;
  $('pf-in').hidden = !session;
  if (!session) return clearInterval(resetTimer);
  const u = session.user;
  const meta = u.user_metadata || {};
  $('pf-email').textContent = u.email;
  $('pf-since').textContent = pfDate(u.created_at);
  $('pf-last').textContent = pfDate(u.last_sign_in_at);
  const days = n => n === 1 ? '1 day' : `${n} days`;
  const today = Math.min(solvesToday(meta, dayKey()), LABS_PER_DAY);
  const live = liveStreak(meta, dayKey());
  $('pf-streak').textContent = live;
  $('pf-today').setAttribute('aria-label', `Today: ${today} of ${LABS_PER_DAY} labs`);
  $('pf-today').replaceChildren(
    ...Array.from({ length: LABS_PER_DAY }, (_, i) => el('span', i < today ? 'on' : '')),
    el('small', '', `${today}/${LABS_PER_DAY} labs today`));
  $('pf-best').textContent = days(meta.best || 0);
  showReset(meta);
  renderProgress(meta.done || {});
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
  const pass2 = $('pf-pass2');
  if (pass.value !== pass2.value) return void ($('pf-pass-msg').textContent = 'Passwords do not match.');
  const { error } = await sb.auth.updateUser({ password: pass.value });
  $('pf-pass-msg').textContent = error ? error.message : 'Password updated.';
  if (!error) pass.value = pass2.value = '';
});

$('pf-logout').addEventListener('click', async () => {
  await sb.auth.signOut();
  location.href = 'index.html';
});
