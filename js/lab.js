// Lab page: shows one lab session (session.js) with its scenario, diagram, requirements, hints and solution, and tells the console
// (script.js) to open its devices. The mock exam shows its labs through the same page, in 'exam' mode.
//
//   labPage.open(session, {mode, crumb, bar})  show a session; mode 'exam' leaves out the hints, expected texts, command list, solution,
//                                              Back and New network, crumb replaces the breadcrumb, bar is an element for the exam bar slot
//   labPage.shows(session)                     whether the page currently shows that session
//   labPage.afterCommand()                     update the requirements after a typed command
const labPage = (() => {
  let shown = null;      // the session on the page
  let exam = false;      // the page is in exam mode
  let reqHints = [];     // how many hints each requirement has shown
  let solved = false;    // all requirements met (the automatic check runs once per solve)

  // results has one true/false/null per requirement (null = not judged), or is null for "none judged"
  function renderReqs(results) {
    const reqs = shown.reqs;
    const done = results ? results.filter(Boolean).length : 0;
    $('req-count').textContent = `${done}/${reqs.length}`;
    $('req-bar').style.width = reqs.length ? `${100 * done / reqs.length}%` : '0';
    let current = false; // the first unfinished requirement gets the "current" highlight
    $('reqs').replaceChildren(...reqs.map((r, i) => {
      const res = results ? results[i] : null;
      const li = el('li');
      if (res !== null) li.className = res ? 'ok' : 'bad';
      if (res !== true && !current) {
        current = true;
        li.classList.add('cur');
      }
      li.append(el('span', 'mark', res === null ? '○' : res ? '✓' : '✗'));
      li.append(el('span', 'rtext', r.text + (res === false && !exam ? ` — expected: ${r.hint}` : '')));
      const used = reqHints[i] || 0;
      if (res !== true && used < 3 && !exam) {
        const b = el('button', 'ghost rhint-btn', `Hint (${3 - used} left)`);
        b.dataset.i = i;
        li.append(b);
      }
      for (let k = 0; k < used; k++) li.append(el('div', 'rhint', `Hint ${k + 1}/3: ` + hintLines(r, k)));
      return li;
    }));
  }

  // the requirements that are met show as ticks, the others stay neutral
  const renderMet = () => renderReqs(shown.grade().map(ok => ok || null));

  function check() {
    const results = shown.grade();
    renderReqs(results);
    const failed = results.filter(ok => !ok).length;
    print(failed ? `[lab] ${failed} requirement(s) not met.` : '[lab] All requirements met.', failed ? 'ln-err' : 'ln-ok');
  }

  // After every command: tick what is already met (the rest stays neutral, without hints),
  // and run the full check once, automatically, when the last requirement is met.
  function afterCommand() {
    const met = shown.grade();
    renderReqs(met.map(ok => ok || null));
    const all = shown.reqs.length > 0 && met.every(Boolean);
    if (all && !solved) check();
    solved = all;
  }

  // "vlan 10, name Sales" and "a, then b" hold several commands
  const HINT_SPLIT = /,\s*(?:then\s+)?(?=[a-z])/i;

  // Hint 1 names the command to think about, hint 2 shows its syntax, hint 3 gives the exact commands
  function hintLines(r, k) {
    const raw = /^[\d.]+ /.test(r.hint) ? 'ip address ' + r.hint     // addressing labs keep just "ip mask"
      : /^[0-9a-f:]+\/\d+$/i.test(r.hint) ? 'ipv6 address ' + r.hint // or just the IPv6 address
      : r.hint;
    const cmds = raw.split(HINT_SPLIT);
    if (k === 0) return `Think about which mode you need, then the command "${cmdSyntax(cmds[0]).split(' ').slice(0, 2).join(' ')} ..."`;
    if (k === 1) return 'Syntax: ' + cmds.map(cmdSyntax).join(' → ');
    const port = r.text.match(/^(?:[RS]\d )?((?:Gi|Fa|Po|Port-channel|Vlan)\S*)/i);
    return 'Commands: ' + [port ? 'interface ' + port[1] : '', ...cmds].filter(Boolean).join(' → ');
  }

  // a command with its values replaced by placeholders, so the card does not give the answers away
  function cmdSyntax(c) {
    return c
      .replace(/\(.*?\)/g, '')                          // notes such as "(on Gi0/0)"
      .replace(/\s+on\s+\S*\d\S*$/i, '')               // a trailing "on Gi0/0"
      .trim()
      .replace(/^conf t$/, 'configure terminal')
      .replace(/^int \S+$/, 'interface <name>')
      .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '<ip>')
      .replace(/\S*:\S*:\S*/g, '<addr/len>')           // IPv6 addresses
      .replace(/^(name|description) .+/, '$1 <text>')
      .replace(/^hostname .+/, 'hostname <name>')
      .replace(/^domain-name .+/, 'domain-name <name>')
      .replace(/^(banner \w+) .+/, '$1 #text#')
      .replace(/(?<=\s)\d+(,\d+)*(?=\s|$)/g, '<n>');   // numbers and lists such as 10,20
  }

  // only the commands the open lab uses
  function renderCmds() {
    const used = shown.solution.length ? shown.solution : shown.reqs.flatMap(r => r.hint.split(HINT_SPLIT));
    const list = ['enable', 'configure terminal', ...used.map(cmdSyntax).filter(c => c && c !== 'enable'), 'show running-config', 'exit', 'end'];
    $('cmds').replaceChildren(...[...new Set(list)].map(c => el('code', 'cmd', c)));
  }

  // devices are 150x52 boxes; each link runs from the right edge of one box to the left edge of the other
  function drawTopo(nodes, links, height) {
    const at = id => nodes.find(n => n.id === id);
    let svg = `<svg viewBox="0 0 528 ${height}" role="img" aria-label="Lab topology. Click a device to open its console.">`;
    for (const l of links) {
      const a = at(l.a), b = at(l.b);
      const x1 = a.x + 150, y1 = a.y + 26, x2 = b.x, y2 = b.y + 26;
      svg += `<line class="link" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>` +
        `<text class="port" x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 7}">${l.port}</text>`;
    }
    for (const n of nodes) {
      svg += `<g data-dev="${n.id}">` +
        `<rect class="box" x="${n.x}" y="${n.y}" width="150" height="52" rx="12"/>` +
        `<circle class="ico-bg" cx="${n.x + 26}" cy="${n.y + 26}" r="20"/>` +
        `<g class="icon" transform="translate(${n.x + 14} ${n.y + 14})">${TOPO_ICONS[n.type]}</g>` +
        `<text class="name" x="${n.x + 54}" y="${n.y + 23}">${n.id}</text>` +
        `<text class="sub" x="${n.x + 54}" y="${n.y + 39}">${n.sub}</text></g>`;
    }
    return svg + '</svg>';
  }

  // an empty console, no hints and a clean requirement list (the session's devices stay as they are)
  function clearPage() {
    reqHints = [];
    solved = false;
    $('solution').hidden = true;
    $('cmds-card').open = false;
    $('show-solution').textContent = 'Show solution';
    resetConsole(shown.home);
    renderReqs(null);
  }

  function open(session, {mode = 'lab', crumb, bar} = {}) {
    shown = session;
    exam = mode === 'exam';
    activeSession = session;
    const C = CATALOGUE[session.topic];
    $('crumb').textContent = crumb || `Labs / ${C.domain}.0 ${DOMAINS[C.domain]} / ${C.name}`;
    $('lab-title').textContent = C.name;
    $('lab-level').textContent = session.level;
    $('lab-sub').textContent = session.sub;
    $('scenario-lead').textContent = session.lead;
    $('steps').replaceChildren(...session.steps.map(step => el('li', '', step)));
    $('topo').innerHTML = drawTopo(session.nodes, session.links, session.height);
    renderTabs(session.nodes.map(n => n.id));
    renderCmds();
    $('lab-bar').replaceChildren(...(exam && bar ? [bar] : []));
    for (const id of ['back', 'cmds-card', 'show-solution', 'new-net']) $(id).hidden = exam;
    clearPage();
  }

  document.getElementById('reset').addEventListener('click', () => {
    shown.reset();
    clearPage();
  });
  // a lab with a known-good config shows that; the others show the exact commands of every requirement's last hint
  document.getElementById('show-solution').addEventListener('click', e => {
    const box = $('solution');
    box.hidden = !box.hidden;
    e.target.textContent = box.hidden ? 'Show solution' : 'Hide solution';
    box.textContent = shown.solution.length ? shown.solution.join('\n')
      : [...new Set(shown.reqs.map(r => hintLines(r, 2).replace('Commands: ', '')))].join('\n');
  });
  document.getElementById('reqs').addEventListener('click', e => {
    const b = e.target.closest('.rhint-btn');
    if (!b) return;
    const i = Number(b.dataset.i);
    reqHints[i] = (reqHints[i] || 0) + 1;
    renderMet();
  });

  return {open, shows: session => shown === session, afterCommand};
})();
