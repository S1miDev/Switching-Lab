// Reference page: what to know about each CCNA topic, its commands, and a link to its lab if it has one.
// The rows and topic pages are built from CATALOGUE (js/topics.js), looked up by id.

// One group per refGroup, in REF_GROUPS order; the first group starts open
function renderReference() {
  document.getElementById('ref-groups').innerHTML = REF_GROUPS.map((group, g) => {
    const ids = Object.keys(CATALOGUE).filter(id => CATALOGUE[id].refGroup === group);
    return `<details class="domain"${g ? '' : ' open'}>` +
      `<summary><span class="dom-title">${esc(group)}</span><span class="dom-meta">${topicCount(ids.length)}</span></summary>` +
      '<div class="rows">' +
      ids.map(id => `<div class="row ref-item" role="button" tabindex="0" data-topic="${id}">` +
        `<div class="row-title">${esc(CATALOGUE[id].name)}</div><div class="row-desc">${esc(CATALOGUE[id].ref.summary)}</div></div>`).join('') +
      '</div></details>';
  }).join('');
}
renderReference();

// Shows one topic. `card` is its row in the list; Previous/Next step through the rows in page order.
function showRef(card) {
  const id = card.dataset.topic, topic = CATALOGUE[id], info = topic.ref;
  const cards = [...document.querySelectorAll('#ref .ref-item')];
  const i = cards.indexOf(card);
  const code = text => `<code>${esc(text)}</code>`;
  const items = (list, show = esc) => list.map(text => `<li>${show(text)}</li>`).join('');
  const commandRows = info.commands.map(([cmd, mode, purpose]) => `<tr><td>${code(cmd)}</td><td>${esc(mode)}</td><td>${esc(purpose)}</td></tr>`);

  $('ref-detail').innerHTML =
    '<button class="ghost" id="ref-back">Back to reference</button>' +
    '<span class="ref-nav">' +
      `<button class="ghost" data-ref="${i - 1}"${i > 0 ? '' : ' disabled'}>← Previous</button>` +
      `<button class="ghost" data-ref="${i + 1}"${i < cards.length - 1 ? '' : ' disabled'}>Next →</button>` +
    '</span>' +
    `<p class="ref-eyebrow">${esc(topic.refGroup)}</p><h2>${esc(topic.name)}</h2><p class="ref-intro">${esc(info.intro)}</p>` +
    `<h3 class="ref-h">What you need to know</h3><ul class="ref-list">${items(info.know)}</ul>` +
    '<h3 class="ref-h">Configuration commands</h3>' +
    '<table class="ref-table"><thead><tr><th>Command</th><th>Mode</th><th>Purpose</th></tr></thead>' +
      `<tbody>${commandRows.join('')}</tbody>` +
    '</table>' +
    '<div class="ref-two">' +
      `<div><h3 class="ref-h">Verify it</h3><ul class="ref-list ref-verify">${items(info.verify, code)}</ul></div>` +
      `<div><h3 class="ref-h">Common mistakes</h3><ul class="ref-list ref-warn">${items(info.mistakes)}</ul></div>` +
    '</div>' +
    (topic.labLevels.length
      ? '<div class="ref-cta">' +
          `<div><strong>${esc(info.cta)}</strong><p>Generated labs, graded against the simulated network state.</p></div>` +
          `<button data-start="${esc(id)}">Start lab →</button>` +
        '</div>'
      : '<p class="note">No lab for this topic yet.</p>');
  document.querySelector('#ref .domains').hidden = true;
  $('ref-detail').hidden = false;
  window.scrollTo(0, 0);
}

// Back to the list of topics
function refHome() {
  $('ref-detail').hidden = true;
  document.querySelector('#ref .domains').hidden = false;
}

// Filter the list by name, keywords, summary or any command/verify line; groups with a match are opened
document.getElementById('ref-search').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  let shown = 0;
  document.querySelectorAll('#ref .domain').forEach(group => {
    let hits = 0;
    group.querySelectorAll('.ref-item').forEach(card => {
      const info = CATALOGUE[card.dataset.topic].ref;
      const text = (searchText(card.dataset.topic) + ' ' + info.summary + ' ' + info.commands.map(c => c[0]).join(' ') + ' ' + info.verify.join(' ')).toLowerCase();
      card.hidden = !text.includes(q);
      hits += !card.hidden;
    });
    group.hidden = !hits;
    if (q && hits) group.open = true;
    shown += hits;
  });
  document.getElementById('ref-empty').hidden = !!shown;
});

// Sub-tabs: Topics (the grouped list above) and Commands (every command from the catalogue, searchable)
document.getElementById('ref-tabs').addEventListener('click', e => {
  const tab = e.target.closest('[data-reftab]');
  if (!tab) return;
  document.querySelectorAll('#ref-tabs .tab').forEach(t => {
    t.classList.toggle('active', t === tab);
    t.setAttribute('aria-selected', t === tab);
  });
  $('ref-topics').hidden = tab.dataset.reftab !== 'topics';
  $('ref-commands').hidden = tab.dataset.reftab !== 'commands';
});

// Mode depth: the mode you must be in to type the command. exec < global config < sub-config < nested sub-config; non-CLI entries (gui, wireless) last
function modeRank(mode) {
  if (/exec/.test(mode)) return 0;
  if (mode === 'config') return 1;
  if (mode === 'config-pmap-c') return 3;
  if (/^config-/.test(mode)) return 2;
  return 4;
}

// One row per command: configuration commands and verify (show) commands, with the topic each comes from.
// Ordered by mode, lowest to highest; commands in the same mode level keep catalogue order.
function commandIndex() {
  const rows = [];
  Object.keys(CATALOGUE).forEach(id => {
    const topic = CATALOGUE[id];
    topic.ref.commands.forEach(([cmd, mode, purpose]) => rows.push({id, cmd, mode, purpose, topic: topic.name}));
    topic.ref.verify.forEach(cmd => rows.push({id, cmd, mode: 'privileged exec', purpose: 'Verify the configuration.', topic: topic.name}));
  });
  return rows.sort((a, b) => modeRank(a.mode) - modeRank(b.mode));
}

const COMMANDS = commandIndex();
$('cmd-rows').innerHTML = COMMANDS.map((c, i) =>
  `<tr data-i="${i}"><td><code>${esc(c.cmd)}</code></td><td>${esc(c.mode)}</td><td>${esc(c.purpose)}</td><td>${esc(c.topic)}</td></tr>`).join('');

// Filter by every word typed, against the command, mode, purpose and topic
$('cmd-search').addEventListener('input', e => {
  const words = e.target.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  [...$('cmd-rows').rows].forEach(row => {
    const c = COMMANDS[row.dataset.i];
    const text = (c.cmd + ' ' + c.mode + ' ' + c.purpose + ' ' + c.topic).toLowerCase();
    row.hidden = !words.every(w => text.includes(w));
    shown += !row.hidden;
  });
  $('cmd-empty').hidden = !!shown;
  $('cmd-table').hidden = !shown;
  $('cmd-count').textContent = `${shown} of ${COMMANDS.length} commands`;
});
$('cmd-count').textContent = `${COMMANDS.length} commands`;

// Open a topic by click, Enter or Space. (The lab button inside a topic is handled in script.js.)
const refPage = document.getElementById('ref');
refPage.addEventListener('click', e => {
  const card = e.target.closest('.ref-item');
  if (card) showRef(card);
});
refPage.addEventListener('keydown', e => {
  const card = e.target.closest?.('.ref-item');
  if (card && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    showRef(card);
  }
});
document.getElementById('ref-detail').addEventListener('click', e => {
  if (e.target.closest('#ref-back')) refHome();
  const step = e.target.closest('[data-ref]');
  if (step) showRef(document.querySelectorAll('#ref .ref-item')[step.dataset.ref]);
});
