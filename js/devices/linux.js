// Linux lab host: an Ubuntu machine with a bash prompt (js/linux/bash.js) on a simulated system (js/linux/fs.js).
// Its node carries the lab's set-up as init, so a Reset builds the same system again. Its state is the system itself,
// which the Linux lab requirements read (js/linux/labs.js).
//
// A password prompt (sudo, su, passwd) is st.askPw = {prompt, tries, check(answer), then(print), fail(print), retry}:
// the next line typed answers it, and the console hides it (asksPassword). sudo asks once per lab, like sudo's
// credential cache.

function createLinux(node, session) {
  const st = lxState(node.init);
  const home = () => st.users[st.user].home;
  const where = () => (st.cwd === home() ? '~' : st.cwd.startsWith(home() + '/') ? '~' + st.cwd.slice(home().length) : st.cwd);

  // sudo's password for the user typing, then the line runs
  function askSudo(line, print) {
    st.askPw = {
      prompt: `[sudo] password for ${st.user}:`, tries: 3, retry: 'Sorry, try again.',
      check: pw => pw === st.users[st.user].pw,
      then: out => { st.sudoOk = true; lxRun(st, line, out); },
      // shortcut: the whole line is dropped after three wrong passwords; real bash carries on after a ; or ||
      fail: out => { out('sudo: 3 incorrect password attempts', 'ln-err'); st.status = 1; },
    };
  }

  // the typed line answers the open password prompt
  function answer(line, print) {
    const ask = st.askPw;
    if (ask.check(line)) { st.askPw = null; return ask.then(print); }
    if (--ask.tries > 0) return print(ask.retry, 'ln-err');
    st.askPw = null;
    ask.fail(print);
  }

  const commandNames = () => [...new Set([...Object.keys(LX_BUILTINS), ...Object.keys(LINUX_CMDS)])].sort();
  const escape = name => name.replace(/([ '"\\$&;|<>()*?[\]#!])/g, '\\$1');

  // Tab: the first word against the commands, later words against the paths (shown with \ before a space, like bash)
  function complete(line) {
    const m = /^(.*?)((?:\\.|[^\s\\])*)$/.exec(line), before = m[1], typed = m[2].replace(/\\(.)/g, '$1');
    const first = !before.trim() || /(?:[|;&]|&&|\|\|)\s*$/.test(before) || /^\s*sudo\s+$/.test(before);
    let hits;
    if (first && !typed.includes('/')) hits = commandNames().filter(n => n.startsWith(typed)).map(n => ({name: n, text: n, dir: false}));
    else {
      const slash = typed.lastIndexOf('/'), dirPart = typed.slice(0, slash + 1), stem = typed.slice(slash + 1);
      const dirAbs = lxPath(st, (dirPart.startsWith('~') ? home() + dirPart.slice(1) : dirPart) || '.');
      const dir = lxFind(st, dirAbs);
      hits = dir?.type === 'dir' && lxMay(st, st.user, dir, 'r')
        ? Object.keys(dir.children).filter(n => n.startsWith(stem) && (stem.startsWith('.') || !n.startsWith('.'))).sort(lxCollate)
          .map(n => ({name: n, text: dirPart + n, dir: dir.children[n].type === 'dir'}))
        : [];
    }
    if (!hits.length) return {value: line};
    if (hits.length === 1) return {value: before + escape(hits[0].text) + (hits[0].dir ? '/' : ' ')};
    let common = hits[0].text;
    for (const h of hits) while (!h.text.startsWith(common)) common = common.slice(0, -1);
    if (common.length > typed.length) return {value: before + escape(common)};
    return {value: line, list: hits.map(h => h.name).join('  ')};
  }

  const self = defineDevice({
    name: node.id, type: node.type, configurable: true, state: st, questionHelp: false,
    asksPassword: () => !!st.askPw,
    prompt: () => (st.askPw ? st.askPw.prompt : `${st.user}@${st.host}:${where()}${st.user === 'root' ? '#' : '$'}`),
    run(line, print) {
      if (st.askPw) return answer(line, print);
      if (lxNeedsSudo(st, line)) return askSudo(line, print);
      lxRun(st, line, print);
    },
    // runOn sends "help", a lone "?" and every line ending in "?" here: in bash "?" is a glob, so only the first two
    // list the commands; any other line runs as bash
    help(line, print) {
      if (line === '?') lxRun(st, 'help', print);
      else self.run(line, print);
    },
    complete,
    hints: {
      nudge(cmd) {
        const first = cmd.split(/\s+/)[0], root = first === 'sudo' && st.user !== 'root';
        return `You are ${st.user} in ${where()}. The command starts with "${first}"${root ? ' and needs root: put sudo in front' : ''}`;
      },
      syntax: cmd => {
        const name = cmd.replace(/^sudo\s+/, '').split(/\s+/)[0];
        return LINUX_CMDS[name]?.synopsis || LX_SYNOPSIS[name] || name;
      },
      recheck: 'You typed all the commands, so check names, paths and values: use ls -l, cat and id.',
    },
    banner: () => [
      'Welcome to Ubuntu 24.04.1 LTS (GNU/Linux 6.8.0-45-generic x86_64)', '',
      ' * This terminal simulates the commands listed by help.',
      ' * Tab completes, Up/Down for history.',
    ],
    ports: () => [], // no network interfaces in version 1
  });
  return self;
}
DEVICE_TYPES.linux = createLinux;

// the synopses of the shell builtins (the commands carry their own)
const LX_SYNOPSIS = {
  cd: 'cd [DIR]', pwd: 'pwd', echo: 'echo [-n] [TEXT]...', umask: 'umask [-S] [MODE]', jobs: 'jobs [-l]',
  kill: 'kill [-SIGNAL] PID|%JOB...', exit: 'exit', help: 'help', sudo: 'sudo COMMAND [ARG]...', su: 'su [-]',
};
