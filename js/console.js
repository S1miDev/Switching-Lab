// Console: shows one lab session's devices as tabs, each with its own output, and types into them through session.run.
// It owns the session it shows and the open device; nobody else reaches into it.
//
//   labConsole.show(session, onCommand)  show a session with empty consoles, opened on session.home; after every typed
//                                        command onCommand() runs and may return more lines [{text, cls}] to print
const labConsole = (() => {
  const term = $('term'), input = $('cmd'), promptEl = $('prompt');
  let session = null;       // the session shown
  let onCommand = () => {};
  let dev = null;           // the device whose console is open
  let log = null;           // that device's console output
  const logs = {};          // console output per device, made when first opened
  const cmdHistory = [];    // typed commands, for Up/Down
  let historyPos = 0;

  const active = () => session.devices[dev];

  function print(text, cls = '') {
    log.append(el('div', cls, text));
    term.scrollTop = term.scrollHeight;
  }
  const printAll = lines => lines.forEach(l => print(l.text, l.cls));

  // a typed command, after the prompt it was typed at
  function echo(text) {
    const line = el('div');
    line.append(el('span', 'ps', active().prompt() + ' '), text);
    log.append(line);
    term.scrollTop = term.scrollHeight;
  }

  const renderPrompt = () => { promptEl.textContent = active().prompt(); };

  // open a device's console: its own output, its tab and its box in the diagram
  function showDevice(name) {
    dev = name;
    if (!logs[name]) {
      logs[name] = el('div');
      term.insertBefore(logs[name], input.parentNode);
    }
    for (const [n, out] of Object.entries(logs)) out.hidden = n !== name;
    log = logs[name];
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.dev === name));
    document.querySelectorAll('#topo [data-dev]').forEach(g => g.classList.toggle('sel', g.dataset.dev === name));
    renderPrompt();
    if (!log.textContent) active().banner().forEach(line => print(line));
    input.focus();
  }

  function show(s, callback = () => {}) {
    session = s;
    onCommand = callback;
    document.querySelector('.tabs').replaceChildren(...s.nodes.map(n => {
      const tab = el('button', 'tab', n.id);
      tab.dataset.dev = n.id;
      return tab;
    }));
    for (const out of Object.values(logs)) out.textContent = '';
    cmdHistory.length = 0;
    historyPos = 0;
    showDevice(s.home);
  }

  // Tab asks the open device to complete the input (it knows its commands and ports). When several ports match, the device
  // says so (cycle) and each further Tab moves on to the next one.
  let tabCycle = null; // {value, hits, i} while stepping through matching ports
  function complete() {
    if (tabCycle && input.value === tabCycle.value) {
      tabCycle.i = (tabCycle.i + 1) % tabCycle.hits.length;
      input.value = tabCycle.value = tabCycle.hits[tabCycle.i];
      return;
    }
    const done = active().complete(input.value);
    tabCycle = done.cycle ? {value: done.value, hits: done.cycle, i: 0} : null;
    if (done.list) print(done.list);
    input.value = done.value;
  }

  input.addEventListener('keydown', e => {
    if (e.key === '?' && active().configurable) { // like IOS: show the options at once and keep what was typed
      e.preventDefault();
      const typed = input.value;
      echo(typed + '?');
      printAll(session.run(dev, typed + '?'));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const line = input.value.trim();
      if (line) cmdHistory.push(line);
      historyPos = cmdHistory.length;
      echo(line);
      printAll(session.run(dev, line));
      renderPrompt();
      input.value = '';
      printAll(onCommand() || []);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (active().configurable) complete();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyPos > 0) input.value = cmdHistory[--historyPos];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyPos < cmdHistory.length - 1) {
        input.value = cmdHistory[++historyPos];
      } else {
        historyPos = cmdHistory.length;
        input.value = '';
      }
    }
  });

  // a device's console opens from its tab or its box in the diagram
  $('lab').addEventListener('click', e => {
    const device = e.target.closest('[data-dev]');
    if (device && session) showDevice(device.dataset.dev);
  });
  term.addEventListener('click', () => input.focus());

  return {show};
})();
