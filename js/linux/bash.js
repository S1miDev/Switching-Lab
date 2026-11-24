// Linux track: a small bash. lxParse splits a line into lists, pipelines, words and redirects; lxExpand turns a word into
// strings (braces, ~, $VARS, globs); lxRun runs a line on a system (js/linux/fs.js). The commands live in LINUX_CMDS
// (js/linux/cmds-*.js); the shell builtins are here. What is not simulated says so instead of faking a result.
//
//   LINUX_CMDS[name] = {run(ctx) → exit code, synopsis}. ctx is
//     {st, user (who runs it: root under sudo), name, args, stdin (text or null), tty (stdout is the terminal),
//      out(line), write(text), err(line), note(line) (a muted remark for the terminal only)}

const LINUX_CMDS = {};
const LX_NOT_SIMULATED = new Set(('man nano vi vim ssh scp ping ip ifconfig systemctl service curl wget tar gzip gunzip zip unzip ln ' +
  'df du free history alias export source sed awk tr tee diff file stat which whereis locate more nl xargs crontab journalctl ' +
  'dmesg mount umount uname hostname date clear shutdown reboot pkill killall nohup bg fg apt-get dpkg snap userdel groupdel ' +
  'deluser adduser visudo chpasswd gpasswd watch bash sh env printenv touch2 lsblk lscpu').split(' '));
const lxNotAvailable = name => `${name}: not available in this lab (type help for the commands you can use)`;

// file names sort like GNU ls and sort in an en_US locale
// shortcut: approximates glibc en_US collation (case and punctuation ignored first); exact enough for lab file names
const LX_COLLATOR = new Intl.Collator('en', {sensitivity: 'base', ignorePunctuation: true});
const lxCollate = (a, b) => LX_COLLATOR.compare(a, b) || (a < b ? 1 : a > b ? -1 : 0); // ties: lower case first, as glibc
const lxLines = text => (text === '' ? [] : text.replace(/\n$/, '').split('\n'));
const lxClock = (t = Date.now()) => new Date(t).toTimeString().slice(0, 5);

// ---- parsing ----

const LX_OPS = ['2>&1', '2>>', '&>', '2>', '>&', '>>', '<<', '&&', '||', '|', '&', ';', '>', '<'];
const LX_REDIRECTS = new Set(['>', '>>', '<', '2>', '2>>']);

// A line → {list: [{pipeline: [{words, redirects}], then, text}]} or {error}. A word is a list of segments
// [{text, q}], q being null (unquoted), "'" , '"' or '\\' (one backslash-escaped character). A redirect is
// {fd, op: '>'|'>>'|'<'|'2>&1', target (a word, or null for 2>&1)}. then is how the next item runs: ';', '&&', '||' or '&'.
function lxParse(line) {
  const na = what => ({error: `bash: ${what} is not available in this lab`});
  const toks = [];
  let word = null, i = 0;
  const add = (text, q) => {
    word ||= [];
    const last = word.at(-1);
    if (last && last.q === q && q !== "'" && q !== '\\') last.text += text;
    else word.push({text, q});
  };
  const endWord = () => { if (word) toks.push({word}); word = null; };
  while (i < line.length) {
    const ch = line[i];
    if (line.startsWith('$((', i)) return na('arithmetic expansion');
    if (ch === '`' || line.startsWith('$(', i)) return na('command substitution');
    if (ch === ' ' || ch === '\t') { endWord(); i++; continue; }
    if (ch === '#' && !word) break; // a comment
    if (ch === "'") {
      const j = line.indexOf("'", i + 1);
      if (j < 0) return {error: "bash: unexpected EOF while looking for matching `''"};
      word ||= [];
      word.push({text: line.slice(i + 1, j), q: "'"});
      i = j + 1;
      continue;
    }
    if (ch === '"') {
      word ||= [];
      word.push({text: '', q: '"'}); // keeps "" as an empty word
      let j = i + 1;
      for (; j < line.length && line[j] !== '"'; j++) {
        if (line[j] === '`' || line.startsWith('$(', j)) return na('command substitution');
        if (line[j] === '\\' && '"\\$`'.includes(line[j + 1])) add(line[++j], '\\');
        else add(line[j], '"');
      }
      if (j >= line.length) return {error: 'bash: unexpected EOF while looking for matching `"\''};
      i = j + 1;
      continue;
    }
    if (ch === '\\') {
      if (i + 1 < line.length) add(line[i + 1], '\\');
      i += 2;
      continue;
    }
    const op = '|&;<>'.includes(ch) || (ch === '2' && !word && line[i + 1] === '>') ? LX_OPS.find(o => line.startsWith(o, i)) : null;
    if (op) {
      if (op === '<<') return na('here-documents (<<)');
      if (op === '&>' || op === '>&') return na(`the ${op} redirection`);
      endWord();
      toks.push({op, at: i});
      i += op.length;
      continue;
    }
    add(ch, null);
    i++;
  }
  endWord();

  const list = [];
  let pipeline = [], cmd = {words: [], redirects: []}, start = 0;
  const empty = c => !c.words.length && !c.redirects.length;
  const near = t => ({error: `bash: syntax error near unexpected token \`${t}'`});
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.word) { cmd.words.push(t.word); continue; }
    if (LX_REDIRECTS.has(t.op)) {
      const target = toks[k + 1];
      if (!target?.word) return near(target?.op || 'newline');
      cmd.redirects.push({fd: t.op.startsWith('2') ? 2 : t.op === '<' ? 0 : 1, op: t.op.replace(/^2/, ''), target: target.word});
      k++;
    } else if (t.op === '2>&1') {
      cmd.redirects.push({fd: 2, op: '2>&1', target: null});
    } else {
      if (empty(cmd)) return near(t.op);
      pipeline.push(cmd);
      cmd = {words: [], redirects: []};
      if (t.op === '|') continue;
      list.push({pipeline, then: t.op, text: line.slice(start, t.at).trim()});
      pipeline = [];
      start = t.at + t.op.length;
    }
  }
  if (!empty(cmd)) pipeline.push(cmd);
  else if (pipeline.length || ['&&', '||'].includes(list.at(-1)?.then)) return {error: 'bash: syntax error: unexpected end of file'};
  if (pipeline.length) list.push({pipeline, then: ';', text: line.slice(start).trim()});
  return {list};
}

// ---- expansion ----

// a word → its strings: brace expansion, then ~, then $VARS, then globs (a glob that matches nothing stays as typed)
// shortcut: unquoted $VAR values are not split on spaces nor globbed; add if a lab needs it
function lxExpand(st, word) {
  const chars = word.flatMap(s => [...s.text].map(c => ({c, q: s.q})));
  if (!chars.length) return word.some(s => s.q) ? [''] : [];
  return lxBraces(chars).flatMap(w => lxGlob(st, lxVars(st, lxTilde(st, w))));
}

// {a,b} and {1..3} / {a..c}, unquoted only, nested braces too
function lxBraces(w) {
  for (let i = 0; i < w.length; i++) {
    if (w[i].q || w[i].c !== '{') continue;
    let depth = 0;
    const commas = [];
    for (let j = i; j < w.length; j++) {
      if (w[j].q) continue;
      if (w[j].c === '{') depth++;
      else if (w[j].c === ',' && depth === 1) commas.push(j);
      else if (w[j].c === '}' && --depth === 0) {
        let alts;
        if (commas.length) {
          alts = [...commas, j].map((k, n) => w.slice(n ? commas[n - 1] + 1 : i + 1, k));
        } else {
          const m = /^(-?\d+)\.\.(-?\d+)$|^([a-zA-Z])\.\.([a-zA-Z])$/.exec(w.slice(i + 1, j).map(x => x.c).join(''));
          if (!m) break;
          const [a, b] = m[1] ? [+m[1], +m[2]] : [m[3].charCodeAt(0), m[4].charCodeAt(0)];
          const seq = Array.from({length: Math.abs(b - a) + 1}, (_, n) => a + (b > a ? n : -n));
          alts = seq.map(v => [...(m[1] ? String(v) : String.fromCharCode(v))].map(c => ({c, q: null})));
        }
        return alts.flatMap(alt => lxBraces([...w.slice(0, i), ...alt, ...w.slice(j + 1)]));
      }
    }
  }
  return [w];
}

// a leading unquoted ~ or ~user, up to the first /
function lxTilde(st, w) {
  if (w[0]?.q || w[0]?.c !== '~') return w;
  let end = 1;
  while (end < w.length && !w[end].q && w[end].c !== '/') end++;
  const name = w.slice(1, end).map(x => x.c).join(''), home = st.users[name || st.user]?.home;
  return home ? [...[...home].map(c => ({c, q: '"'})), ...w.slice(end)] : w;
}

const lxVar = (st, name) => ({
  HOME: st.users[st.user].home, USER: st.user, LOGNAME: st.user, PWD: st.cwd, OLDPWD: st.oldpwd || '', SHELL: '/bin/bash',
  HOSTNAME: st.host, '?': String(st.status), PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
}[name] ?? '');

// $NAME, ${NAME} and $? outside single quotes
function lxVars(st, w) {
  const out = [];
  for (let i = 0; i < w.length; i++) {
    const {c, q} = w[i];
    if (c !== '$' || (q && q !== '"')) { out.push(w[i]); continue; }
    let name = '', j = i + 1;
    if (w[j]?.c === '?') name = '?', j++;
    else if (w[j]?.c === '{') {
      for (j++; j < w.length && w[j].c !== '}'; j++) name += w[j].c;
      j++;
    } else for (; j < w.length && /\w/.test(w[j].c) && w[j].q === q; j++) name += w[j].c;
    if (!name) { out.push(w[i]); continue; }
    out.push(...[...lxVar(st, name)].map(ch => ({c: ch, q: '"'})));
    i = j - 1;
  }
  return out;
}

// * ? [abc] on unquoted characters, matched one path component at a time; dotfiles only when the pattern says so
function lxGlob(st, w) {
  const literal = w.map(x => x.c).join('');
  if (!w.some(x => !x.q && '*?['.includes(x.c))) return [literal];
  const parts = [];
  let part = [];
  for (const x of w) if (x.c === '/') { parts.push(part); part = []; } else part.push(x);
  parts.push(part);
  const abs = !parts[0].length;
  let hits = [{path: abs ? '/' : st.cwd, shown: abs ? '/' : ''}];
  parts.forEach((p, n) => {
    if (!p.length) return; // a leading, doubled or trailing /
    const name = p.map(x => x.c).join(''), isGlob = p.some(x => !x.q && '*?['.includes(x.c)), re = isGlob && lxGlobRegex(p);
    const join = (h, child) => ({path: (h.path === '/' ? '' : h.path) + '/' + child, shown: h.shown + (h.shown && !h.shown.endsWith('/') ? '/' : '') + child});
    hits = hits.flatMap(h => {
      const dir = lxFind(st, h.path);
      if (dir?.type !== 'dir' || !lxMay(st, st.user, dir, 'x')) return [];
      if (!isGlob) return dir.children[name] ? [join(h, name)] : [];
      if (!lxMay(st, st.user, dir, 'r')) return [];
      return Object.keys(dir.children).filter(c => re.test(c) && (!c.startsWith('.') || p[0].c === '.')).map(c => join(h, c));
    }).filter(h => n === parts.length - 1 || lxFind(st, h.path)?.type === 'dir');
  });
  if (parts.at(-1).length === 0) hits = hits.map(h => ({...h, shown: h.shown + '/'}));
  return hits.length ? hits.map(h => h.shown).sort(lxCollate) : [literal];
}

function lxGlobRegex(p) {
  let re = '';
  for (let i = 0; i < p.length; i++) {
    const {c, q} = p[i];
    if (q) re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    else if (c === '*') re += '.*';
    else if (c === '?') re += '.';
    else if (c === '[' && p.slice(i + 2).some(x => x.c === ']')) {
      let j = i + 1, cls = '';
      if (p[j].c === '!' || p[j].c === '^') { cls = '^'; j++; }
      for (; p[j].c !== ']' || j === i + 1; j++) cls += p[j].c === '\\' ? '\\\\' : p[j].c;
      re += `[${cls}]`;
      i = j;
    } else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

// ---- options ----

// GNU-style options: combined short flags (-lah), values (-n 5, -n5), long ones (--all, mapped by long to a letter) and --,
// anywhere among the operands. An option that is not simulated says so; returns {o, rest} or null.
function lxOpts(ctx, args, flags, valued = '', long = {}) {
  const o = {}, rest = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { rest.push(...args.slice(i + 1)); break; }
    if (a.startsWith('--')) {
      const [name, value] = a.slice(2).split('=');
      if (!(name in long)) { ctx.err(`${ctx.name}: option '--${name}' is not available in this lab`); return null; }
      o[long[name]] = value ?? true;
    } else if (a.length > 1 && a[0] === '-') {
      for (let k = 1; k < a.length; k++) {
        if (valued.includes(a[k])) {
          const value = a.slice(k + 1) || args[++i];
          if (value === undefined) { ctx.err(`${ctx.name}: option requires an argument -- '${a[k]}'`); return null; }
          o[a[k]] = value;
          break;
        }
        if (!flags.includes(a[k])) { ctx.err(`${ctx.name}: option '-${a[k]}' is not available in this lab`); return null; }
        o[a[k]] = true;
      }
    } else rest.push(a);
  }
  return {o, rest};
}

// ---- running a line ----

// Run one line on the system st as st.user; print(text, cls) takes each line for the terminal
function lxRun(st, line, print) {
  const p = lxParse(line);
  if (p.error) { print(p.error, 'ln-err'); st.status = 2; return; }
  let prev = ';';
  for (const item of p.list) {
    const skip = (prev === '&&' && st.status !== 0) || (prev === '||' && st.status === 0);
    prev = item.then;
    if (skip) continue;
    if (item.then === '&') lxBackground(st, item, print);
    else lxPipeline(st, item.pipeline, print);
  }
}

// cmd &: a sleep stays running as a job; anything else runs now and is reported done
function lxBackground(st, item, print) {
  const id = (st.jobs.at(-1)?.id || 0) + 1, pid = st.nextPid++;
  const args = item.pipeline[0].words.flatMap(w => lxExpand(st, w));
  print(`[${id}] ${pid}`);
  if (item.pipeline.length === 1 && args[0] === 'sleep' && args.length === 2 && /^\d+(\.\d+)?[smhd]?$/.test(args[1])) {
    st.procs.push({pid, user: st.user, cmd: args.join(' '), cpu: 0, mem: 0, tty: 'pts/0', stat: 'S', start: lxClock()});
    st.jobs.push({id, pid, cmd: item.text});
    st.status = 0;
    return;
  }
  lxPipeline(st, item.pipeline, print);
  print(`[${id}]+  ${'Done'.padEnd(24)}${item.text}`);
}

function lxPipeline(st, pipeline, print) {
  let stdin = null, code = 0;
  pipeline.forEach((cmd, i) => {
    const last = i === pipeline.length - 1, io = lxRedirects(st, cmd.redirects, print);
    if (!io) { code = 1; stdin = ''; return; } // bash does not run a command whose redirect failed
    const args = cmd.words.flatMap(w => lxExpand(st, w));
    let out = '';
    const ctx = {
      st, user: st.user, name: args[0], args: args.slice(1), stdin: io.stdin ?? stdin, tty: last && !io.stdout,
      write: text => { out += text; },
      out: line => { out += line + '\n'; },
      // shortcut: 2>&1 sends errors wherever stdout ends up, whatever the order of the redirects
      err: line => { if (io.stderr === 'out') out += line + '\n'; else if (io.stderr) lxWriteTo(io.stderr, line + '\n'); else print(line, 'ln-err'); },
      note: line => { if (last && !io.stdout) print(line, 'text-muted'); },
    };
    code = args.length ? lxCall(ctx) : 0;
    if (io.stdout) lxWriteTo(io.stdout, out);
    else if (last) lxLines(out).forEach(l => print(l));
    stdin = io.stdout ? '' : out;
  });
  st.status = code;
}

const lxWriteTo = (node, text) => { if (!node.dev) { node.content += text; node.mtime = Date.now(); } };

// open a command's redirects as the shell's user (not the sudo user): {stdin, stdout, stderr}, or null after printing why not
function lxRedirects(st, redirects, print) {
  const io = {};
  for (const r of redirects) {
    if (r.op === '2>&1') { io.stderr = 'out'; continue; }
    const names = lxExpand(st, r.target);
    if (names.length !== 1) { print(`bash: ${r.target.map(s => s.text).join('')}: ambiguous redirect`, 'ln-err'); return null; }
    const abs = lxPath(st, names[0]), w = lxWalk(st, st.user, abs);
    const fail = code => { print(`bash: ${names[0]}: ${LX_ERR[code]}`, 'ln-err'); return null; };
    if (r.op === '<') {
      if (!w.node) return fail(w.error);
      if (w.node.type === 'dir') return fail('EISDIR');
      if (!lxMay(st, st.user, w.node, 'r')) return fail('EACCES');
      io.stdin = lxContent(st, w.node);
      continue;
    }
    let node = w.node;
    if (!node) {
      if (!w.parent) return fail(w.error);
      if (!lxMay(st, st.user, w.parent, 'w')) return fail('EACCES');
      node = lxMake(st, st.user, abs, 'file');
    } else if (node.type === 'dir') return fail('EISDIR');
    // shortcut: the generated files (/etc/passwd, /etc/group, /etc/shadow) are changed with the user commands only
    else if (node.gen || !lxMay(st, st.user, node, 'w')) return fail('EACCES');
    if (r.op === '>' && !node.dev) node.content = '';
    if (r.fd === 2) io.stderr = node;
    else io.stdout = node;
  }
  return io;
}

// run a command by name: a path, a builtin, a simulated command, or the reason it can't run
function lxCall(ctx) {
  const {st, name} = ctx;
  if (name.includes('/')) {
    const base = lxBase(name), node = lxFind(st, lxPath(st, name));
    if (/^\/(usr\/)?s?bin\/[^/]+$/.test(name) && LINUX_CMDS[base]) return LINUX_CMDS[base].run({...ctx, name: base});
    const fail = (text, code) => { ctx.err(`bash: ${name}: ${text}`); return code; };
    if (!node) return fail(LX_ERR.ENOENT, 127);
    if (node.type === 'dir') return fail(LX_ERR.EISDIR, 126);
    if (!lxMay(st, ctx.user, node, 'x')) return fail(LX_ERR.EACCES, 126);
    ctx.err('bash: running programs and scripts is not available in this lab');
    return 126;
  }
  if (LX_BUILTINS[name]) return LX_BUILTINS[name](ctx);
  if (LINUX_CMDS[name]) return LINUX_CMDS[name].run(ctx);
  const pkg = Object.keys(st.repo).find(p => st.repo[p].cmds.includes(name));
  if (pkg && !st.packages[pkg]) {
    ctx.err(`Command '${name}' not found, but can be installed with:`);
    ctx.err(`sudo apt install ${pkg}`);
  } else ctx.err(LX_NOT_SIMULATED.has(name) || pkg ? lxNotAvailable(name) : `${name}: command not found`);
  return 127;
}

// ---- shell builtins ----

const lxErr = (ctx, text) => { ctx.err(text); return 1; };
const LX_SHELL_ONLY = new Set(['cd', 'umask', 'jobs', 'exit', 'help', 'su']); // bash builtins with no program of their own

// a root shell from sudo -i / sudo su (-) / sudo -s; exit goes back
function lxRootShell(st, keepCwd) {
  st.shells.push({user: st.user, cwd: st.cwd});
  st.user = 'root';
  if (!keepCwd) st.cwd = '/root';
}

const LX_SIGNALS = {9: 'KILL', 15: 'TERM', 1: 'HUP', 2: 'INT'};

const LX_BUILTINS = {
  cd(ctx) {
    const {st} = ctx;
    if (ctx.args.length > 1) return lxErr(ctx, 'bash: cd: too many arguments');
    let target = ctx.args[0] ?? st.users[st.user].home;
    if (target === '-') {
      if (!st.oldpwd) return lxErr(ctx, 'bash: cd: OLDPWD not set');
      target = st.oldpwd;
      ctx.out(target);
    }
    const abs = lxPath(st, target), w = lxWalk(st, ctx.user, abs);
    if (!w.node) return lxErr(ctx, `bash: cd: ${target}: ${LX_ERR[w.error]}`);
    if (w.node.type !== 'dir') return lxErr(ctx, `bash: cd: ${target}: ${LX_ERR.ENOTDIR}`);
    if (!lxMay(st, ctx.user, w.node, 'x')) return lxErr(ctx, `bash: cd: ${target}: ${LX_ERR.EACCES}`);
    st.oldpwd = st.cwd;
    st.cwd = abs;
    return 0;
  },
  pwd(ctx) { ctx.out(ctx.st.cwd); return 0; },
  echo(ctx) {
    let args = ctx.args, newline = true, escapes = false;
    while (args[0] && /^-[neE]+$/.test(args[0])) {
      if (args[0].includes('n')) newline = false;
      if (args[0].includes('e')) escapes = true;
      if (args[0].includes('E')) escapes = false;
      args = args.slice(1);
    }
    let text = args.join(' ');
    if (escapes) text = text.replace(/\\([ntr\\])/g, (_, c) => ({n: '\n', t: '\t', r: '\r', '\\': '\\'}[c]));
    ctx.write(text + (newline ? '\n' : ''));
    return 0;
  },
  true: () => 0,
  false: () => 1,
  umask(ctx) {
    const {st} = ctx, a = ctx.args[0];
    if (a === undefined) { ctx.out(st.umask.toString(8).padStart(4, '0')); return 0; }
    if (a === '-S') {
      const keep = 0o777 & ~st.umask, sym = shift => 'rwx'.split('').filter((_, k) => keep & (4 >> k) << shift).join('');
      ctx.out(`u=${sym(6)},g=${sym(3)},o=${sym(0)}`);
      return 0;
    }
    if (!/^[0-7]{1,4}$/.test(a)) return lxErr(ctx, `bash: umask: ${a}: octal number out of range`);
    st.umask = parseInt(a, 8) & 0o777;
    return 0;
  },
  jobs(ctx) {
    const {jobs} = ctx.st, long = ctx.args.includes('-l');
    jobs.forEach((j, n) => {
      const mark = n === jobs.length - 1 ? '+' : n === jobs.length - 2 ? '-' : ' ';
      ctx.out(`[${j.id}]${mark}  ${long ? j.pid + ' ' : ''}${'Running'.padEnd(24)}${j.cmd} &`);
    });
    return 0;
  },
  // kill [-9|-15|-KILL|-TERM|-SIGKILL] pid|%job ...: TERM ends a process unless it ignores TERM; KILL always does
  kill(ctx) {
    const {st} = ctx;
    let args = ctx.args, sig = 15;
    if (!args.length) return lxErr(ctx, 'kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]');
    if (args[0].startsWith('-')) {
      const s = args[0].slice(1).toUpperCase().replace(/^SIG/, '');
      sig = /^\d+$/.test(s) ? +s : +Object.keys(LX_SIGNALS).find(n => LX_SIGNALS[n] === s);
      if (!LX_SIGNALS[sig]) return lxErr(ctx, `bash: kill: ${args[0].slice(1)}: invalid signal specification`);
      args = args.slice(1);
    }
    let code = 0;
    for (const a of args) {
      let pid;
      if (a.startsWith('%')) {
        const job = st.jobs.find(j => String(j.id) === a.slice(1));
        if (!job) { code = lxErr(ctx, `bash: kill: ${a}: no such job`); continue; }
        pid = job.pid;
      } else if (/^\d+$/.test(a)) pid = +a;
      else { code = lxErr(ctx, `bash: kill: ${a}: arguments must be process or job IDs`); continue; }
      const proc = st.procs.find(p => p.pid === pid);
      if (!proc) { code = lxErr(ctx, `bash: kill: (${pid}) - No such process`); continue; }
      if (ctx.user !== 'root' && proc.user !== ctx.user) { code = lxErr(ctx, `bash: kill: (${pid}) - Operation not permitted`); continue; }
      if ((sig === 15 || sig === 1 || sig === 2) && proc.ignoresTerm) continue;
      st.procs = st.procs.filter(p => p !== proc);
      const job = st.jobs.find(j => j.pid === pid);
      if (job) {
        ctx.out(`[${job.id}]+  ${(sig === 9 ? 'Killed' : 'Terminated').padEnd(24)}${job.cmd}`);
        st.jobs = st.jobs.filter(j => j !== job);
      }
    }
    return code;
  },
  exit(ctx) {
    const {st} = ctx, back = st.shells.pop();
    if (back) { st.user = back.user; st.cwd = back.cwd; ctx.out('logout'); return 0; }
    ctx.out('exit');
    ctx.note('(this lab terminal stays open)'); // shortcut: the lab terminal can't close
    return 0;
  },
  help(ctx) {
    const names = [...new Set([...Object.keys(LX_BUILTINS), ...Object.keys(LINUX_CMDS)])].filter(n => !['true', 'false'].includes(n)).sort();
    ctx.out('Commands you can use in this lab:');
    for (let i = 0; i < names.length; i += 6) ctx.out(names.slice(i, i + 6).map(n => n.padEnd(12)).join('').trimEnd());
    ctx.out('Type a command with its options, for example: ls -l /etc');
    return 0;
  },
  // su asks for root's password, which Ubuntu locks, so it always fails; sudo su (sudo -i) is the way to a root shell
  su(ctx) {
    const {st} = ctx, a = ctx.args;
    if (a.length && !(a.length === 1 && ['-', 'root', '-l'].includes(a[0]))) return lxErr(ctx, 'su: switching to other users is not available in this lab');
    if (ctx.user === 'root') { lxRootShell(st, !a.length); return 0; }
    st.askPw = {prompt: 'Password:', tries: 1, check: () => false, fail: print => print('su: Authentication failure', 'ln-err')};
    return 1;
  },
  // sudo runs one command as root (the device has asked for the password first), or opens a root shell
  sudo(ctx) {
    const {st} = ctx, a = ctx.args;
    if (!a.length) return lxErr(ctx, 'usage: sudo -h | -K | -k | -V');
    if (ctx.user !== 'root' && !lxInGroup(st, ctx.user, 'sudo')) return lxErr(ctx, `${ctx.user} is not in the sudoers file.`);
    if (a[0] === '-k' && a.length === 1) { st.sudoOk = false; return 0; }
    if ((['-i', '-s'].includes(a[0]) && a.length === 1) || (a[0] === 'su' && (a.length === 1 || (a.length === 2 && ['-', '-l', 'root'].includes(a[1]))))) {
      lxRootShell(st, a[0] === '-s' || (a[0] === 'su' && a[1] !== '-' && a[1] !== '-l'));
      return 0;
    }
    if (a[0].startsWith('-')) return lxErr(ctx, `sudo: option '${a[0]}' is not available in this lab`);
    const name = a[0];
    if (LX_SHELL_ONLY.has(name) || (!LX_BUILTINS[name] && !LINUX_CMDS[name] && !name.includes('/'))) {
      if (!LX_SHELL_ONLY.has(name) && (LX_NOT_SIMULATED.has(name) || Object.values(st.repo).some(p => p.cmds.includes(name)) && Object.keys(st.packages).some(p => st.repo[p].cmds.includes(name))))
        return lxErr(ctx, lxNotAvailable(name));
      return lxErr(ctx, `sudo: ${name}: command not found`);
    }
    return lxCall({...ctx, user: 'root', name, args: a.slice(1)});
  },
};

// does running this line need sudo's password first? (any command of it is sudo, and the user has not given it yet)
function lxNeedsSudo(st, line) {
  if (st.user === 'root' || st.sudoOk) return false;
  const p = lxParse(line);
  return !p.error && p.list.some(item => item.pipeline.some(c => c.words[0] && lxExpand(st, c.words[0])[0] === 'sudo' &&
    !(c.words[1] && lxExpand(st, c.words[1])[0] === '-k')));
}
