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
