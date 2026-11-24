// Linux track: files and directories (ls touch mkdir cp mv rm rmdir) and viewing them (cat less head tail wc), with GNU
// coreutils' output and messages. Every command runs as ctx.user (root under sudo) and checks permissions as Linux does.

// ---- helpers the command files share ----

// walk to an operand as the command's user: {abs, node, parent, error} (see lxWalk)
const lxAt = (ctx, path) => {
  const abs = lxPath(ctx.st, path);
  return {abs, ...lxWalk(ctx.st, ctx.user, abs)};
};

// the text of a readable file operand, or null after printing the command's message via fail(code)
function lxReadFile(ctx, path, fail) {
  const w = lxAt(ctx, path);
  if (!w.node) return fail(w.error), null;
  if (w.node.type === 'dir') return fail('EISDIR'), null;
  if (!lxMay(ctx.st, ctx.user, w.node, 'r')) return fail('EACCES'), null;
  return lxContent(ctx.st, w.node);
}

// the inputs of a filter: each file operand ({name, text}, null text when unreadable), or stdin when there is none ('-' too)
const lxInputs = (ctx, files, fail) => (files.length ? files : ['-'])
  .map(f => ({name: f, text: f === '-' ? ctx.stdin ?? '' : lxReadFile(ctx, f, code => fail(f, code))}));

const lxBytes = text => encodeURIComponent(text).replace(/%[0-9A-F]{2}/g, '_').length; // UTF-8 length

// ---- ls ----

// a name as ls shows it on a terminal: quoted when it has a space or a character the shell would read
const lxQuoteName = name => (/^[\w.,+@%:=\/-]+$/.test(name) ? name : name.includes("'") ? `"${name}"` : `'${name}'`);

// GNU ls -C: as many columns as fit in 80 characters, names running top to bottom
function lxColumns(names) {
  for (let cols = names.length; cols > 1; cols--) {
    const rows = Math.ceil(names.length / cols);
    if (Math.ceil(names.length / rows) !== cols) continue; // no empty last column
    const widths = Array.from({length: cols}, (_, c) => Math.max(...names.slice(c * rows, (c + 1) * rows).map(n => n.length)));
    if (widths.reduce((a, b) => a + b, 0) + 2 * (cols - 1) > 80) continue;
    return Array.from({length: rows}, (_, r) => widths.map((w, c) => (names[c * rows + r] ?? '').padEnd(w)).join('  ').trimEnd());
  }
  return names;
}

const LX_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// the ls -l date: Mon DD HH:MM, or Mon DD  YYYY for anything more than six months away
function lxDate(t) {
  const d = new Date(t), recent = Math.abs(Date.now() - t) < 182.5 * 864e5;
  const p = n => String(n).padStart(2, '0');
  return `${LX_MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${recent ? `${p(d.getHours())}:${p(d.getMinutes())}` : ' ' + d.getFullYear()}`;
}

// ls -h sizes: whole bytes below 1K, then one decimal under 10 and whole numbers above, always rounded up
function lxHuman(n) {
  if (n < 1024) return String(n);
  let v = n, u = -1;
  do { v /= 1024; u++; } while (v >= 1024 && u < 3);
  const unit = 'KMGT'[u];
  return v < 10 && Math.ceil(v * 10) / 10 < 10 ? (Math.ceil(v * 10) / 10).toFixed(1) + unit : Math.ceil(v) + unit;
}

const lxLinks = node => (node.type === 'dir' ? 2 + Object.values(node.children).filter(c => c.type === 'dir').length : 1);

// print entries [{name, node}] as ls does: long rows (with a total for a directory) or names in columns / one per line
function lxListing(ctx, entries, o, withTotal) {
  const tty = ctx.tty && !o['1'];
  let names = entries.map(e => (tty ? lxQuoteName(e.name) : e.name));
  if (tty && names.some((n, i) => n !== entries[i].name)) names = names.map((n, i) => (n === entries[i].name ? ' ' + n : n));
  if (!o.l) return (tty ? lxColumns(names) : names).forEach(n => ctx.out(n));
  const size = n => (o.h ? lxHuman(lxSize(ctx.st, n)) : String(lxSize(ctx.st, n)));
  const rows = entries.map((e, i) => [lxModeString(e.node), String(lxLinks(e.node)), e.node.owner, e.node.group, size(e.node), lxDate(e.node.mtime), names[i]]);
  const width = k => Math.max(0, ...rows.map(r => r[k].length));
  if (withTotal) {
    const blocks = entries.reduce((a, e) => a + Math.ceil(lxSize(ctx.st, e.node) / 4096) * 4, 0);
    ctx.out(`total ${o.h ? lxHuman(blocks * 1024) : blocks}`);
  }
  for (const r of rows) ctx.out([r[0], r[1].padStart(width(1)), r[2].padEnd(width(2)), r[3].padEnd(width(3)), r[4].padStart(width(4)), r[5], r[6]].join(' '));
}

LINUX_CMDS.ls = {
  synopsis: 'ls [-lahAd1] [FILE]...',
  run(ctx) {
    const {st} = ctx, p = lxOpts(ctx, ctx.args, 'laAhd1', '', {all: 'a', 'almost-all': 'A', 'human-readable': 'h', directory: 'd'});
    if (!p) return 2;
    const {o} = p, ops = p.rest.length ? p.rest : ['.'];
    let code = 0;
    const files = [], dirs = [];
    for (const op of ops.slice().sort(lxCollate)) {
      const w = lxAt(ctx, op);
      if (!w.node) { ctx.err(`ls: cannot access '${op}': ${LX_ERR[w.error]}`); code = 2; continue; }
      (w.node.type === 'dir' && !o.d ? dirs : files).push({name: op, node: w.node, abs: w.abs});
    }
    if (files.length) lxListing(ctx, files, o, false);
    dirs.forEach((d, n) => {
      if (files.length || n) ctx.out('');
      if (ops.length > 1) ctx.out(`${d.name}:`);
      if (!lxMay(st, ctx.user, d.node, 'r')) { ctx.err(`ls: cannot open directory '${d.name}': ${LX_ERR.EACCES}`); code = 2; return; }
      const names = Object.keys(d.node.children).filter(n => o.a || o.A || !n.startsWith('.')).sort(lxCollate);
      const entries = names.map(n => ({name: n, node: d.node.children[n]}));
      if (o.a) entries.unshift({name: '.', node: d.node}, {name: '..', node: lxFind(st, lxParent(d.abs))});
      lxListing(ctx, entries, o, true);
    });
    return code;
  },
};

// ---- creating, copying, moving and removing ----

LINUX_CMDS.touch = {
  synopsis: 'touch FILE...',
  run(ctx) {
    const p = lxOpts(ctx, ctx.args, '');
    if (!p) return 1;
    if (!p.rest.length) return lxErr(ctx, 'touch: missing file operand');
    let code = 0;
    for (const f of p.rest) {
      const w = lxAt(ctx, f), fail = c => { code = lxErr(ctx, `touch: cannot touch '${f}': ${LX_ERR[c]}`); };
      if (w.node) {
        if (w.node.owner !== ctx.user && ctx.user !== 'root' && !lxMay(ctx.st, ctx.user, w.node, 'w')) fail('EACCES');
        else w.node.mtime = Date.now();
      } else if (!w.parent) fail(w.error);
      else if (!lxMay(ctx.st, ctx.user, w.parent, 'w')) fail('EACCES');
      else lxMake(ctx.st, ctx.user, w.abs, 'file');
    }
    return code;
  },
};

LINUX_CMDS.mkdir = {
  synopsis: 'mkdir [-p] DIRECTORY...',
  run(ctx) {
    const p = lxOpts(ctx, ctx.args, 'p', '', {parents: 'p'});
    if (!p) return 1;
    if (!p.rest.length) return lxErr(ctx, 'mkdir: missing operand');
    let code = 0;
    for (const d of p.rest) {
      const fail = (shown, c) => { code = lxErr(ctx, `mkdir: cannot create directory ‘${shown}’: ${LX_ERR[c]}`); };
      if (!p.o.p) {
        const w = lxAt(ctx, d);
        if (w.node) fail(d, 'EEXIST');
        else if (!w.parent) fail(d, w.error);
        else if (!lxMay(ctx.st, ctx.user, w.parent, 'w')) fail(d, 'EACCES');
        else lxMake(ctx.st, ctx.user, w.abs, 'dir');
        continue;
      }
      // -p: make each missing part in turn; parts that exist are fine
      const parts = d.split('/');
      for (let k = 1; k <= parts.length; k++) {
        const shown = parts.slice(0, k).join('/');
        if (!parts[k - 1] && k < parts.length) continue;
        const w = lxAt(ctx, shown || '/');
        if (w.node) {
          if (w.node.type !== 'dir') { fail(d, 'ENOTDIR'); break; }
          continue;
        }
        if (!w.parent) { fail(shown, w.error); break; }
        if (!lxMay(ctx.st, ctx.user, w.parent, 'w')) { fail(shown, 'EACCES'); break; }
        lxMake(ctx.st, ctx.user, w.abs, 'dir');
      }
    }
    return code;
  },
};

// the destination of cp/mv: into DEST when it is a directory, else DEST itself
function lxDest(ctx, dest, src, many) {
  const w = lxAt(ctx, dest);
  if (w.node?.type === 'dir') {
    const shown = (dest.endsWith('/') ? dest : dest + '/') + lxBase(lxPath(ctx.st, src));
    return {shown, ...lxAt(ctx, shown)};
  }
  if (many) return {error: `target '${dest}' is not a directory`};
  return {shown: dest, ...w};
}

const lxInside = (abs, dir) => abs === dir || abs.startsWith(dir === '/' ? '/' : dir + '/');

// copy a node to abs (which does not exist) as the user: cp's mode (the source's, through the umask) and the user as owner
function lxCopyNode(ctx, src, abs) {
  const node = lxMake(ctx.st, ctx.user, abs, src.type, src.type === 'file' ? lxContent(ctx.st, src) : '');
  node.mode = (src.mode & 0o777 & ~ctx.st.umask) | (node.mode & 0o2000);
  if (src.type === 'dir') for (const [name, child] of Object.entries(src.children)) lxCopyNode(ctx, child, abs + '/' + name);
}

LINUX_CMDS.cp = {
  synopsis: 'cp [-r] SOURCE... DEST',
  run(ctx) {
    const {st} = ctx, p = lxOpts(ctx, ctx.args, 'rR', '', {recursive: 'r'});
    if (!p) return 1;
    if (p.rest.length < 2) return lxErr(ctx, p.rest.length ? `cp: missing destination file operand after '${p.rest[0]}'` : 'cp: missing file operand');
    const dest = p.rest.at(-1), srcs = p.rest.slice(0, -1), rec = p.o.r || p.o.R;
    let code = 0;
    const fail = text => { code = lxErr(ctx, 'cp: ' + text); };
    for (const s of srcs) {
      const sw = lxAt(ctx, s);
      if (!sw.node) { fail(`cannot stat '${s}': ${LX_ERR[sw.error]}`); continue; }
      if (sw.node.type === 'dir' && !rec) { fail(`-r not specified; omitting directory '${s}'`); continue; }
      if (!lxMay(st, ctx.user, sw.node, 'r')) { fail(`cannot open '${s}' for reading: ${LX_ERR.EACCES}`); continue; }
      const d = lxDest(ctx, dest, s, srcs.length > 1);
      if (d.error && !d.abs) { fail(d.error); break; }
      if (d.abs === sw.abs) { fail(`'${s}' and '${d.shown}' are the same file`); continue; }
      if (sw.node.type === 'dir' && lxInside(d.abs, sw.abs)) { fail(`cannot copy a directory, '${s}', into itself, '${d.shown}'`); continue; }
      const kind = sw.node.type === 'dir' ? 'directory' : 'regular file';
      if (d.node) {
        if (d.node.type === 'dir' && sw.node.type === 'dir') {
          for (const [name, child] of Object.entries(sw.node.children)) if (!d.node.children[name]) lxCopyNode(ctx, child, d.abs + '/' + name);
        } else if (d.node.type === 'dir') fail(`cannot overwrite directory '${d.shown}' with non-directory`);
        else if (sw.node.type === 'dir') fail(`cannot overwrite non-directory '${d.shown}' with directory '${s}'`);
        else if (!lxMay(st, ctx.user, d.node, 'w')) fail(`cannot create ${kind} '${d.shown}': ${LX_ERR.EACCES}`);
        else { d.node.content = lxContent(st, sw.node); d.node.mtime = Date.now(); }
      } else if (!d.parent) fail(`cannot create ${kind} '${d.shown}': ${LX_ERR[d.error]}`);
      else if (!lxMay(st, ctx.user, d.parent, 'w')) fail(`cannot create ${kind} '${d.shown}': ${LX_ERR.EACCES}`);
      else lxCopyNode(ctx, sw.node, d.abs);
    }
    return code;
  },
};

LINUX_CMDS.mv = {
  synopsis: 'mv SOURCE... DEST',
  run(ctx) {
    const {st} = ctx, p = lxOpts(ctx, ctx.args, '');
    if (!p) return 1;
    if (p.rest.length < 2) return lxErr(ctx, p.rest.length ? `mv: missing destination file operand after '${p.rest[0]}'` : 'mv: missing file operand');
    const dest = p.rest.at(-1), srcs = p.rest.slice(0, -1);
    let code = 0;
    const fail = text => { code = lxErr(ctx, 'mv: ' + text); };
    for (const s of srcs) {
      const sw = lxAt(ctx, s);
      if (!sw.node) { fail(`cannot stat '${s}': ${LX_ERR[sw.error]}`); continue; }
      const d = lxDest(ctx, dest, s, srcs.length > 1);
      if (d.error && !d.abs) { fail(d.error); break; }
      if (d.abs === sw.abs) { fail(`'${s}' and '${d.shown}' are the same file`); continue; }
      if (sw.node.type === 'dir' && lxInside(d.abs, sw.abs)) { fail(`cannot move '${s}' to a subdirectory of itself, '${d.shown}'`); continue; }
      if (!d.node && !d.parent) { fail(`cannot move '${s}' to '${d.shown}': ${LX_ERR[d.error]}`); continue; }
      if (d.node?.type === 'dir') { fail(`cannot overwrite directory '${d.shown}' with non-directory`); continue; }
      if (d.node && sw.node.type === 'dir') { fail(`cannot overwrite non-directory '${d.shown}' with directory '${s}'`); continue; }
      const to = d.parent || lxFind(st, lxParent(d.abs));
      if (!lxMayUnlink(st, ctx.user, sw.parent, sw.node) || !lxMay(st, ctx.user, to, 'w')) { fail(`cannot move '${s}' to '${d.shown}': ${LX_ERR.EACCES}`); continue; }
      delete sw.parent.children[sw.name];
      to.children[lxBase(d.abs)] = sw.node;
      sw.parent.mtime = to.mtime = Date.now();
    }
    return code;
  },
};

// the first path under node (shown as shown) that the user may not empty, or null
function lxStuck(ctx, node, shown) {
  if (node.type !== 'dir' || !Object.keys(node.children).length) return null;
  if (!lxMay(ctx.st, ctx.user, node, 'w') || !lxMay(ctx.st, ctx.user, node, 'x') || !lxMay(ctx.st, ctx.user, node, 'r')) return shown;
  for (const [name, child] of Object.entries(node.children)) {
    const s = lxStuck(ctx, child, shown + '/' + name);
    if (s) return s;
  }
  return null;
}

LINUX_CMDS.rm = {
  synopsis: 'rm [-rf] FILE...',
  run(ctx) {
    const {st} = ctx, p = lxOpts(ctx, ctx.args, 'rRf', '', {recursive: 'r', force: 'f'});
    if (!p) return 1;
    const rec = p.o.r || p.o.R;
    if (!p.rest.length) return p.o.f ? 0 : lxErr(ctx, 'rm: missing operand');
    let code = 0;
    const fail = text => { code = lxErr(ctx, 'rm: ' + text); };
    const remove = w => { delete w.parent.children[w.name]; w.parent.mtime = Date.now(); };
    const ask = []; // write-protected files: rm asks about each when you type at a terminal, unless -f
    for (const f of p.rest) {
      const w = lxAt(ctx, f);
      if (rec && w.abs === '/') { fail("it is dangerous to operate recursively on '/'"); fail('use --no-preserve-root to override this failsafe'); continue; }
      if (rec && /(^|\/)\.\.?\/?$/.test(f)) { fail(`refusing to remove '.' or '..' directory: skipping '${f}'`); continue; }
      if (!w.node) { if (!p.o.f || w.error !== 'ENOENT') fail(`cannot remove '${f}': ${LX_ERR[w.error]}`); continue; }
      if (w.node.type === 'dir' && !rec) { fail(`cannot remove '${f}': ${LX_ERR.EISDIR}`); continue; }
      if (!lxMayUnlink(st, ctx.user, w.parent, w.node)) { fail(`cannot remove '${f}': ${LX_ERR.EACCES}`); continue; }
      // shortcut: a subtree with any part the user may not empty is left whole; rm would remove the rest of it
      const stuck = lxStuck(ctx, w.node, f.replace(/\/$/, ''));
      if (stuck) { fail(`cannot remove '${stuck}': ${LX_ERR.EACCES}`); continue; }
      if (!p.o.f && ctx.stdin === null && ctx.user !== 'root' && w.node.type === 'file' && !lxMay(st, ctx.user, w.node, 'w')) ask.push({f, w});
      else remove(w);
    }
    // one question at a time, each answered on the next line (y or yes removes); shortcut: a write-protected directory is not asked about
    const next = () => {
      const q = ask.shift();
      if (!q) return;
      const kind = lxContent(st, q.w.node) ? 'regular file' : 'regular empty file';
      st.askPw = {
        prompt: `rm: remove write-protected ${kind} '${q.f}'?`, hidden: false, tries: 1, check: () => true, fail: () => {},
        then: (print, answer) => { if (/^y(es)?$/i.test(answer.trim())) remove(q.w); next(); },
      };
    };
    next();
    return code;
  },
};

LINUX_CMDS.rmdir = {
  synopsis: 'rmdir DIRECTORY...',
  run(ctx) {
    const p = lxOpts(ctx, ctx.args, '');
    if (!p) return 1;
    if (!p.rest.length) return lxErr(ctx, 'rmdir: missing operand');
    let code = 0;
    for (const d of p.rest) {
      const w = lxAt(ctx, d), fail = c => { code = lxErr(ctx, `rmdir: failed to remove '${d}': ${LX_ERR[c]}`); };
      if (!w.node) fail(w.error);
      else if (w.node.type !== 'dir') fail('ENOTDIR');
      else if (Object.keys(w.node.children).length) fail('ENOTEMPTY');
      else if (!w.parent || !lxMayUnlink(ctx.st, ctx.user, w.parent, w.node)) fail('EACCES');
      else delete w.parent.children[w.name];
    }
    return code;
  },
};

// ---- viewing ----

LINUX_CMDS.cat = {
  synopsis: 'cat [-n] [FILE]...',
  run(ctx) {
    const p = lxOpts(ctx, ctx.args, 'n', '', {number: 'n'});
    if (!p) return 1;
    let code = 0, text = '';
    for (const i of lxInputs(ctx, p.rest, (f, c) => { code = lxErr(ctx, `cat: ${f}: ${LX_ERR[c]}`); })) if (i.text !== null) text += i.text;
    if (p.o.n) text = lxLines(text).map((l, k) => `${String(k + 1).padStart(6)}\t${l}\n`).join('');
    ctx.write(text);
    return code;
  },
};

// shortcut: less shows the whole file at once; there is no paging or q to press in this terminal
LINUX_CMDS.less = {
  synopsis: 'less FILE',
  run(ctx) {
    const p = lxOpts(ctx, ctx.args, '');
    if (!p) return 1;
    if (!p.rest.length && ctx.stdin === null) return lxErr(ctx, 'Missing filename ("less --help" for help)');
    let code = 0;
    for (const i of lxInputs(ctx, p.rest.slice(0, 1), (f, c) => { code = lxErr(ctx, c === 'ENOENT' ? `${f}: No such file or directory` : `${f}: ${LX_ERR[c]}`); })) {
      if (i.text !== null) ctx.write(i.text);
    }
    if (!code) ctx.note('(END)');
    return code;
  },
};

// head and tail: -n N or -N lines (tail also -n +N: from line N on), with ==> name <== headers for several files
function lxHeadTail(name, ctx) {
  const args = ctx.args.map(a => (/^-\d+$/.test(a) ? '-n' + a.slice(1) : a));
  const p = lxOpts(ctx, args, '', 'n', {lines: 'n'});
  if (!p) return 1;
  const n = p.o.n ?? '10';
  if (!/^[+-]?\d+$/.test(n)) return lxErr(ctx, `${name}: invalid number of lines: ‘${n}’`);
  let code = 0;
  const inputs = lxInputs(ctx, p.rest, (f, c) => {
    code = lxErr(ctx, c === 'EISDIR' ? `${name}: error reading '${f}': ${LX_ERR[c]}` : `${name}: cannot open '${f}' for reading: ${LX_ERR[c]}`);
  });
  inputs.forEach((i, k) => {
    if (i.text === null) return;
    if (inputs.length > 1) ctx.out(`${k ? '\n' : ''}==> ${i.name === '-' ? 'standard input' : i.name} <==`);
    const lines = lxLines(i.text), count = Math.abs(+n);
    const pick = name === 'head' ? lines.slice(0, count) : n.startsWith('+') ? lines.slice(Math.max(0, count - 1)) : lines.slice(-count || lines.length);
    pick.forEach(l => ctx.out(l));
  });
  return code;
}
LINUX_CMDS.head = {synopsis: 'head [-n LINES] [FILE]...', run: ctx => lxHeadTail('head', ctx)};
LINUX_CMDS.tail = {synopsis: 'tail [-n LINES] [FILE]...', run: ctx => lxHeadTail('tail', ctx)};

// wc: lines, words, bytes. One count of one input is not padded; standard input pads to 7; otherwise every column
// is as wide as the total byte count
LINUX_CMDS.wc = {
  synopsis: 'wc [-lwc] [FILE]...',
  run(ctx) {
    const p = lxOpts(ctx, ctx.args, 'lwc', '', {lines: 'l', words: 'w', bytes: 'c'});
    if (!p) return 1;
    const show = p.o.l || p.o.w || p.o.c ? ['l', 'w', 'c'].filter(k => p.o[k]) : ['l', 'w', 'c'];
    // read everything first (the width depends on all of it), then print in operand order, errors in their place
    const inputs = lxInputs(ctx, p.rest, () => {});
    let code = 0;
    const counted = inputs.map(i => {
      const dir = i.text === null && lxAt(ctx, i.name).node?.type === 'dir', t = i.text ?? '';
      return {name: i.name, ok: i.text !== null || dir, l: (t.match(/\n/g) || []).length, w: t.split(/\s+/).filter(Boolean).length, c: lxBytes(t)};
    });
    const good = counted.filter(c => c.ok);
    const width = show.length === 1 && counted.length === 1 ? 1
      : counted.some(i => i.name === '-') ? 7 : String(good.reduce((a, c) => a + c.c, 0)).length;
    const line = c => ctx.out(show.map(k => String(c[k]).padStart(width)).join(' ') + (c.name === '-' ? '' : ' ' + c.name));
    for (const c of counted) {
      const err = lxAt(ctx, c.name).node?.type === 'dir' ? 'EISDIR' : c.ok ? null : lxAt(ctx, c.name).error || 'EACCES';
      if (err) code = lxErr(ctx, `wc: ${c.name}: ${LX_ERR[err]}`);
      if (c.ok) line(c);
    }
    if (counted.length > 1) line(['l', 'w', 'c'].reduce((tot, k) => ({...tot, [k]: good.reduce((a, x) => a + x[k], 0)}), {name: 'total'}));
    return code;
  },
};
