// Profile page: account details plus settings kept in Supabase user_metadata. Uses sb, ACCENTS and applyAccent from auth.js.

const pfForm = $('pf-form');
const pfName = $('pf-name');
const pfMsg = $('pf-msg');
const pfDate = iso => iso ? new Date(iso).toLocaleString(LANG) : '—';

for (const [name, color] of Object.entries(ACCENTS)) {
  const label = el('label', 'pf-swatch');
  const radio = el('input');
  radio.type = 'radio';
  radio.name = 'accent';
  radio.value = color;
  radio.setAttribute('aria-label', tr(name));
  radio.addEventListener('change', () => applyAccent(color)); // live preview before saving
  label.style.setProperty('--swatch', color);
  label.title = tr(name);
  label.append(radio);
  $('pf-accents').append(label);
}

// every track with its catalogue and domains; the Linux one only once js/linux/topics.js is loaded (a const is not on globalThis)
const TRACKS = [[tr('Switching & Routing'), CATALOGUE, DOMAINS]];
if (typeof LINUX_CATALOGUE !== 'undefined') TRACKS.push(['Linux', LINUX_CATALOGUE, LINUX_DOMAINS]);

// one card per track and domain; each topic gets a bar with a segment per difficulty level
function renderProgress(done) {
  // card order: each track's domains in number order, then its Troubleshooting card
  const groups = Object.fromEntries(TRACKS.flatMap(([track, , domains]) =>
    [...Object.entries(domains).map(([d, name]) => `${track} · ${d}.0 ${name}`), `${track} · ${tr('Troubleshooting')}`].map(t => [t, []])));
  let have = 0, total = 0, segIndex = 0;
  for (const [track, catalogue, domains] of TRACKS) for (const [id, c] of Object.entries(catalogue)) {
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
      seg.title = `${tr(l[0].toUpperCase() + l.slice(1))}${on ? L(' · done', ' · hotovo') : ''}`;
      segs.append(seg);
    }
    row.append(head, segs);
    const title = c.refGroup === 'Troubleshooting' ? `${track} · ${tr('Troubleshooting')}` : `${track} · ${c.domain}.0 ${domains[c.domain]}`;
    groups[title].push(row);
  }
  const pct = total ? Math.round(100 * have / total) : 0;
  $('pf-ring').style.setProperty('--pct', pct);
  $('pf-ring').setAttribute('aria-label', L(`${pct}% complete`, `hotovo ${pct} %`));
  $('pf-pct').textContent = pct + '%';
  $('pf-sum-text').textContent = L(`${have} of ${total} labs solved`, `Vyřešeno ${have} z ${total} labů`);
  $('pf-progress').replaceChildren(...Object.entries(groups).filter(([, rows]) => rows.length).map(([title, rows]) => {
    const g = el('div', 'pf-domain');
    g.append(el('h3', '', title), ...rows);
    return g;
  }));
}

// counts down to the start of the day the streak breaks: tomorrow if not solved yet today, else the day after
let resetTimer;
function showReset(meta) {
  clearInterval(resetTimer);
  const out = $('pf-reset');
  if (!liveStreak(meta, dayKey())) return void (out.textContent = '–');
  let d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + (meta.last_day === dayKey() ? 2 : 1));
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
  const days = n => L(n === 1 ? '1 day' : `${n} days`, `${n} ${cz(n, 'den', 'dny', 'dní')}`);
  const today = Math.min(solvesToday(meta, dayKey()), LABS_PER_DAY);
  const live = liveStreak(meta, dayKey());
  $('pf-streak').textContent = live;
  $('pf-streak').nextElementSibling.textContent = L('day streak', cz(live, 'den v řadě', 'dny v řadě', 'dní v řadě'));
  $('pf-today').setAttribute('aria-label', L(`Today: ${today} of ${LABS_PER_DAY} labs`, `Dnes: ${today} z ${LABS_PER_DAY} labů`));
  $('pf-today').replaceChildren(
    ...Array.from({ length: LABS_PER_DAY }, (_, i) => el('span', i < today ? 'on' : '')),
    el('small', '', L(`${today}/${LABS_PER_DAY} labs today`, `${today}/${LABS_PER_DAY} labů dnes`)));
  $('pf-best').textContent = days(meta.best || 0);
  showReset(meta);
  renderProgress(meta.done || {});
  pfName.value = meta.display_name || '';
  const accent = Object.values(ACCENTS).includes(meta.accent) ? meta.accent : ACCENTS.Green;
  pfForm.querySelector(`input[value="${accent}"]`).checked = true;
});

pfForm.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = pfForm.querySelector('button');
  btn.disabled = true;
  const accent = pfForm.querySelector('input[name="accent"]:checked')?.value;
  const { error } = await sb.auth.updateUser({ data: { display_name: pfName.value.trim(), accent } });
  btn.disabled = false;
  pfMsg.textContent = error ? error.message : L('Saved.', 'Uloženo.');
});

$('pf-pass-form').addEventListener('submit', async e => {
  e.preventDefault();
  const pass = $('pf-pass');
  const pass2 = $('pf-pass2');
  if (pass.value !== pass2.value) return void ($('pf-pass-msg').textContent = L('Passwords do not match.', 'Hesla se neshodují.'));
  const { error } = await sb.auth.updateUser({ password: pass.value });
  $('pf-pass-msg').textContent = error ? error.message : L('Password updated.', 'Heslo změněno.');
  if (!error) pass.value = pass2.value = '';
});

$('pf-logout').addEventListener('click', async () => {
  await sb.auth.signOut();
  location.href = 'index.html';
});
