// Linux track: searching (grep, find) and text filters for pipes (sort, uniq, cut), with GNU output and messages.

// a grep basic regular expression as a JS one: in BRE, \( \) \{ \} \| \+ \? are the operators and ( ) { } | + ? plain
function lxBre(pattern) {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\' && i + 1 < pattern.length) {
      const n = pattern[++i];
      out += '(){}|+?'.includes(n) ? n : n === '<' || n === '>' ? '\\b' : '\\' + n;
    } else out += '(){}|+?'.includes(c) ? '\\' + c : c;
  }
  return out;
}

LINUX_CMDS.grep = {
  synopsis: 'grep [-irnvclEw] PATTERN [FILE]...',
  run(ctx) {
    const {st} = ctx, p = lxOpts(ctx, ctx.args, 'irRnvclEwh', '', {'ignore-case': 'i', recursive: 'r', 'line-number': 'n', 'invert-match': 'v', count: 'c', 'files-with-matches': 'l'});
    if (!p) return 2;
    const {o} = p, [pattern, ...files] = p.rest;
    if (pattern === undefined) { ctx.err('Usage: grep [OPTION]... PATTERNS [FILE]...'); ctx.err("Try 'grep --help' for more information."); return 2; }
    let re;
    try {
      const src = o.E ? pattern.replace(/\\[<>]/g, '\\b') : lxBre(pattern);
      re = new RegExp(o.w ? `(?<![\\w])(?:${src})(?![\\w])` : src, o.i ? 'i' : '');
    } catch { return lxErr(ctx, 'grep: Invalid regular expression') * 2; }
    const rec = o.r || o.R;
    let code = 1, failed = false;
    const fail = (f, c) => { failed = true; ctx.err(`grep: ${f}: ${LX_ERR[c]}`); };
    // the files to search: operands, everything under them with -r (in directory order), or standard input
    const targets = [];
    const walk = (shown, node) => {
      if (node.type !== 'dir') return targets.push({name: shown, node});
      if (!lxMay(st, ctx.user, node, 'r') || !lxMay(st, ctx.user, node, 'x')) return fail(shown, 'EACCES');
      // shortcut: names in sorted order; real grep and find go in directory order, which is not defined
      for (const n of Object.keys(node.children).sort(lxCollate)) walk(shown === '.' && !files.length ? n : shown.replace(/\/$/, '') + '/' + n, node.children[n]);
    };
    for (const f of files.length ? files : rec ? ['.'] : ['-']) {
      if (f === '-') { targets.push({name: '(standard input)', text: ctx.stdin ?? ''}); continue; }
      const w = lxAt(ctx, f);
      if (!w.node) fail(f, w.error);
      else if (w.node.type === 'dir' && !rec) fail(f, 'EISDIR');
      else walk(f, w.node);
    }
    // file names in front when there are several files, or when -r went into a directory
    const many = targets.length > 1 || (rec && (!files.length || files.some(f => lxAt(ctx, f).node?.type === 'dir')));
    for (const t of targets) {
      let text = t.text;
      if (text === undefined) {
        if (!lxMay(st, ctx.user, t.node, 'r')) { fail(t.name, 'EACCES'); continue; }
        text = lxContent(st, t.node);
      }
      const hits = lxLines(text).map((l, k) => [k + 1, l]).filter(([, l]) => re.test(l) !== !!o.v);
      if (hits.length) code = 0;
      const prefix = many && !o.h ? t.name + ':' : '';
      if (o.l) { if (hits.length) ctx.out(t.name); }
      else if (o.c) ctx.out(prefix + hits.length);
      else for (const [n, l] of hits) ctx.out(prefix + (o.n ? n + ':' : '') + l);
    }
    return failed ? 2 : code;
  },
};

// find's -name: a shell pattern on the base name (here * also matches a leading dot, as in find)
function lxNamePattern(pattern, ignoreCase) {
  const re = pattern.split('').map(c => (c === '*' ? '.*' : c === '?' ? '.' : c === '[' || c === ']' ? c : c.replace(/[.+^${}()|\\]/g, '\\$&'))).join('');
  return new RegExp(`^${re}$`, ignoreCase ? 'i' : '');
}

LINUX_CMDS.find = {
  synopsis: 'find [PATH]... [-name PATTERN] [-type f|d] [-size [+-]N[ckMG]] [-user NAME] [-delete]',
  run(ctx) {
    const {st} = ctx, a = ctx.args;
    let k = 0;
    const paths = [];
    while (k < a.length && !a[k].startsWith('-')) paths.push(a[k++]);
    // the tests, all of which must hold; -maxdepth limits the depth; -delete deletes instead of printing
    const tests = [];
    let maxDepth = Infinity, del = false;
    for (; k < a.length; k++) {
      const t = a[k], v = a[k + 1];
      const need = () => { if (v === undefined) throw `find: missing argument to \`${t}'`; k++; return v; };
      try {
        if (t === '-name' || t === '-iname') { const re = lxNamePattern(need(), t === '-iname'); tests.push(e => re.test(e.base)); }
        else if (t === '-type') {
          const ty = need();
          if (!['f', 'd'].includes(ty)) throw `find: -type ${ty} is not available in this lab`;
          tests.push(e => (e.node.type === 'dir') === (ty === 'd'));
        } else if (t === '-size') {
          const m = /^([+-]?)(\d+)([ckMG]?)$/.exec(need());
          if (!m) throw `find: invalid argument \`${v}' to \`-size'`;
          const unit = {'': 512, c: 1, k: 1024, M: 1048576, G: 1073741824}[m[3]], n = +m[2];
          tests.push(e => {
            const units = Math.ceil(lxSize(st, e.node) / unit);
            return m[1] === '+' ? units > n : m[1] === '-' ? units < n : units === n;
          });
        } else if (t === '-user') {
          const u = need();
          if (!st.users[u]) throw `find: ‘${u}’ is not the name of a known user`;
          tests.push(e => e.node.owner === u);
        } else if (t === '-maxdepth') maxDepth = +need();
        else if (t === '-print') { /* the default */ }
        else if (t === '-delete') del = true;
        else throw `find: ${t} is not available in this lab`;
      } catch (text) { return lxErr(ctx, text); }
    }
    let code = 0;
    const found = [];
    const visit = (shown, node, depth) => {
      const e = {shown, node, base: depth ? lxBase(shown) : lxBase(shown) || shown};
      if (tests.every(test => test(e))) found.push(e);
      if (node.type !== 'dir' || depth >= maxDepth) return;
      if (!lxMay(st, ctx.user, node, 'r') || !lxMay(st, ctx.user, node, 'x')) { code = lxErr(ctx, `find: ‘${shown}’: ${LX_ERR.EACCES}`); return; }
      for (const n of Object.keys(node.children).sort(lxCollate)) visit((shown.endsWith('/') ? shown : shown + '/') + n, node.children[n], depth + 1);
    };
    for (const p of paths.length ? paths : ['.']) {
      const w = lxAt(ctx, p);
      if (!w.node) { code = lxErr(ctx, `find: ‘${p}’: ${LX_ERR[w.error]}`); continue; }
      visit(p, w.node, 0);
    }
    if (!del) { found.forEach(e => ctx.out(e.shown)); return code; }
    for (const e of found.reverse()) { // deepest first, as -delete implies -depth
      const w = lxAt(ctx, e.shown);
      if (!w.parent) continue;
      if (e.node.type === 'dir' && Object.keys(e.node.children).length) code = lxErr(ctx, `find: cannot delete ‘${e.shown}’: ${LX_ERR.ENOTEMPTY}`);
      else if (!lxMayUnlink(st, ctx.user, w.parent, e.node)) code = lxErr(ctx, `find: cannot delete ‘${e.shown}’: ${LX_ERR.EACCES}`);
      else delete w.parent.children[w.name];
    }
    return code;
  },
};

// a tr set as a list of characters: ranges (a-z), the common classes and \n \t \\
const LX_TR_CLASSES = {'[:lower:]': 'a-z', '[:upper:]': 'A-Z', '[:digit:]': '0-9', '[:alpha:]': 'A-Za-z', '[:alnum:]': '0-9A-Za-z', '[:space:]': ' \\t\\n'};
function lxTrSet(set) {
  const chars = [...set.replace(/\[:[a-z]+:\]/g, c => LX_TR_CLASSES[c] ?? c)
    .replace(/\\(.)/g, (m, c) => ({n: '\n', t: '\t'}[c] ?? c))];
  const out = [];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i + 1] === '-' && i + 2 < chars.length) {
      const a = chars[i].charCodeAt(0), b = chars[i + 2].charCodeAt(0);
      if (b < a) return null;
      for (let c = a; c <= b; c++) out.push(String.fromCharCode(c));
      i += 2;
    } else out.push(chars[i]);
  }
  return out;
}

LINUX_CMDS.tr = {
  synopsis: 'tr SET1 SET2  (or -d SET1), reading standard input',
  run(ctx) {
    const p = lxOpts(ctx, ctx.args, 'd', '', {delete: 'd'});
    if (!p) return 1;
    const {o, rest} = p, want = o.d ? 1 : 2;
    const usage = text => { ctx.err(`tr: ${text}`); return lxErr(ctx, "Try 'tr --help' for more information."); };
    if (rest.length < want) return usage(rest.length ? `missing operand after ‘${rest[0]}’` : 'missing operand');
    if (rest.length > want) return usage(`extra operand ‘${rest[want]}’`);
    const [from, to] = rest.map(lxTrSet);
    if (!from || (!o.d && !to)) return lxErr(ctx, 'tr: range-endpoints are in reverse collating sequence order');
    if (!o.d && !to.length) return lxErr(ctx, 'tr: when not truncating set1, string2 must be non-empty');
    // a shorter SET2 repeats its last character, as GNU tr does
    ctx.write([...ctx.stdin ?? ''].map(c => {
      const i = from.lastIndexOf(c);
      return i < 0 ? c : o.d ? '' : to[Math.min(i, to.length - 1)];
    }).join(''));
    return 0;
  },
};

LINUX_CMDS.tee = {
  synopsis: 'tee [-a] [FILE]...',
  run(ctx) {
    const p = lxOpts(ctx, ctx.args, 'a', '', {append: 'a'});
    if (!p) return 1;
    const {st} = ctx, text = ctx.stdin ?? '';
    let code = 0;
    for (const f of p.rest) {
      const w = lxAt(ctx, f), fail = c => { code = lxErr(ctx, `tee: ${f}: ${LX_ERR[c]}`); };
      let node = w.node;
      if (!node) {
        if (!w.parent) { fail(w.error); continue; }
        if (!lxMay(st, ctx.user, w.parent, 'w')) { fail('EACCES'); continue; }
        node = lxMake(st, ctx.user, w.abs, 'file');
      } else if (node.type === 'dir') { fail('EISDIR'); continue; }
      else if (node.gen || !lxMay(st, ctx.user, node, 'w')) { fail('EACCES'); continue; }
      if (!p.o.a && !node.dev) node.content = '';
      lxWriteTo(node, text);
    }
    ctx.write(text);
    return code;
  },
};

// ---- sed: one command, [N or /RE/] then s/RE/NEW/[gi], d or p ----

// {test(line, number), cmd: 's'|'d'|'p', re, to} or {error}
function lxSedScript(script) {
  const na = {error: `sed: this script is not available in this lab (use s/old/new/g, Nd, /re/d, or -n with p)`};
  // the part from at up to the next unescaped delimiter: [text, index after it], or null
  const part = (at, d) => {
    let text = '';
    for (let i = at; i < script.length; i++) {
      if (script[i] === '\\' && i + 1 < script.length) text += script[i + 1] === d ? script[++i] : script[i] + script[++i];
      else if (script[i] === d) return [text, i + 1];
      else text += script[i];
    }
    return null;
  };
  const regex = (src, flags) => {
    try { return src ? new RegExp(lxBre(src), flags) : null; } catch { return null; }
  };
  let i = 0, test = () => true;
  const num = /^\d+/.exec(script);
  if (num) { test = (l, n) => n === +num[0]; i = num[0].length; }
  else if (script[0] === '/') {
    const got = part(1, '/'), re = got && regex(got[0], '');
    if (!re) return na;
    test = l => re.test(l);
    i = got[1];
  }
  const cmd = script[i];
  if ((cmd === 'd' || cmd === 'p') && i + 1 === script.length) return i ? {test, cmd} : na;
  const d = script[i + 1];
  if (cmd !== 's' || !d || d === '\\') return na;
  const pattern = part(i + 2, d), repl = pattern && part(pattern[1], d);
  if (!repl) return {error: `sed: -e expression #1, char ${script.length}: unterminated \`s' command`};
  const flags = script.slice(repl[1]);
  if (!/^[gi]*$/.test(flags)) return na;
  const re = regex(pattern[0], flags);
  if (!re) return na;
  // in the replacement, & is the match, \1 to \9 are groups, and a backslash makes anything else plain
  const to = (...m) => repl[0].replace(/\\(.)|&/g, (all, c) => (all === '&' ? m[0] : /\d/.test(c) ? m[+c] ?? '' : {n: '\n', t: '\t'}[c] ?? c));
  return {test, cmd, re, to};
}

LINUX_CMDS.sed = {
  synopsis: "sed [-n] [-i] 's/OLD/NEW/g' [FILE]...  (or Nd, /RE/d, Np)",
  run(ctx) {
    const p = lxOpts(ctx, ctx.args, 'ni', '', {quiet: 'n', silent: 'n', 'in-place': 'i'});
    if (!p) return 1;
    const {o} = p, [script, ...files] = p.rest, {st} = ctx;
    if (script === undefined) return lxErr(ctx, 'Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...');
    const s = lxSedScript(script);
    if (s.error) return lxErr(ctx, s.error);
    const edit = text => {
      const out = lxLines(text).flatMap((line, k) => {
        const hit = s.test(line, k + 1);
        if (hit && s.cmd === 'd') return [];
        const next = hit && s.cmd === 's' ? line.replace(s.re, s.to) : line;
        return [...(hit && s.cmd === 'p' ? [next] : []), ...(o.n ? [] : [next])];
      });
      return out.join('\n') + (out.length && text.endsWith('\n') ? '\n' : '');
    };
    let code = 0;
    if (!o.i) {
      // several files are one stream, so line numbers run on
      const inputs = lxInputs(ctx, files, (f, c) => { code = 2; ctx.err(`sed: can't read ${f}: ${LX_ERR[c]}`); });
      ctx.write(edit(inputs.map(x => x.text ?? '').join('')));
      return code;
    }
    if (!files.length) return lxErr(ctx, 'sed: no input files');
    for (const f of files) {
      const w = lxAt(ctx, f);
      if (!w.node) { ctx.err(`sed: can't read ${f}: ${LX_ERR[w.error]}`); code = 2; continue; }
      if (w.node.type !== 'file' || w.node.dev) { code = lxErr(ctx, `sed: couldn't edit ${f}: not a regular file`); continue; }
      if (!lxMay(st, ctx.user, w.node, 'r')) { code = lxErr(ctx, `sed: can't read ${f}: ${LX_ERR.EACCES}`); continue; }
      // like GNU sed, -i writes a new file beside the old one, so it needs write access to the directory
      if (w.node.gen || !lxMay(st, ctx.user, w.parent, 'w')) { code = lxErr(ctx, `sed: couldn't open temporary file ${lxParent(w.abs)}/sedXXXXXX: ${LX_ERR.EACCES}`); continue; }
      w.node.content = edit(w.node.content);
      w.node.mtime = Date.now();
      if (ctx.user !== 'root') w.node.owner = ctx.user;
    }
    return code;
  },
};

// the lines of a filter's inputs (files or standard input), or null when one could not be read
function lxFilterLines(ctx, files) {
  let failed = false;
  const inputs = lxInputs(ctx, files, (f, c) => {
    failed = true;
    ctx.err(ctx.name === 'sort' ? `sort: cannot read: ${f}: ${LX_ERR[c]}` : `${ctx.name}: ${f}: ${LX_ERR[c]}`);
  });
  return {lines: inputs.flatMap(i => (i.text === null ? [] : lxLines(i.text))), failed};
}

LINUX_CMDS.sort = {
  synopsis: 'sort [-nru] [-t SEP] [-k FIELD] [FILE]...',
  run(ctx) {
    const p = lxOpts(ctx, ctx.args, 'nru', 'tk', {'numeric-sort': 'n', reverse: 'r', unique: 'u'});
    if (!p) return 2;
    const {o} = p, {lines, failed} = lxFilterLines(ctx, p.rest);
    if (failed) return 2;
    const field = o.k ? parseInt(o.k, 10) : 0;
    if (o.k && !(field >= 1)) return lxErr(ctx, `sort: invalid number at field start: invalid count at start of ‘${o.k}’`) * 2;
    // the key: the whole line, or from field N to the end (fields split by -t, else at blanks)
    const key = line => {
      if (!field) return line;
      if (o.t) return line.split(o.t).slice(field - 1).join(o.t);
      const parts = line.match(/\s*\S+/g) || [];
      return parts.slice(field - 1).join('');
    };
    const num = s => parseFloat(/^\s*-?\d*\.?\d+/.exec(s)?.[0] ?? '0');
    const cmp = (a, b) => (o.n ? num(key(a)) - num(key(b)) : lxCollate(key(a).trim(), key(b).trim()));
    let out = lines.slice().sort((a, b) => cmp(a, b) || (o.u ? 0 : lxCollate(a, b)));
    if (o.r) out.reverse();
    if (o.u) out = out.filter((l, i) => !i || cmp(out[i - 1], l) !== 0);
    out.forEach(l => ctx.out(l));
    return 0;
  },
};

LINUX_CMDS.uniq = {
  synopsis: 'uniq [-cdu] [FILE]',
  run(ctx) {
    const p = lxOpts(ctx, ctx.args, 'cdu', '', {count: 'c', repeated: 'd', unique: 'u'});
    if (!p) return 1;
    const {o} = p, {lines, failed} = lxFilterLines(ctx, p.rest.slice(0, 1));
    if (failed) return 1;
    const groups = [];
    for (const l of lines) if (groups.length && groups.at(-1).line === l) groups.at(-1).n++; else groups.push({line: l, n: 1});
    for (const g of groups) {
      if ((o.d && g.n < 2) || (o.u && g.n > 1)) continue;
      ctx.out(o.c ? `${String(g.n).padStart(7)} ${g.line}` : g.line);
    }
    return 0;
  },
};

// a cut list such as 1,3 or 2-4 or 3- or -2, as a test on a 1-based position
function lxCutList(list) {
  const ranges = list.split(',').map(r => {
    const m = /^(\d*)-?(\d*)$/.exec(r), dash = r.includes('-');
    return m && (m[1] || m[2]) ? [m[1] ? +m[1] : 1, dash ? (m[2] ? +m[2] : Infinity) : +m[1]] : null;
  });
  return ranges.includes(null) ? null : n => ranges.some(([a, b]) => n >= a && n <= b);
}

LINUX_CMDS.cut = {
  synopsis: 'cut -d SEP -f FIELDS [FILE]...  (or -c CHARS)',
  run(ctx) {
    const p = lxOpts(ctx, ctx.args, 's', 'dfc', {delimiter: 'd', fields: 'f', characters: 'c'});
    if (!p) return 1;
    const {o} = p;
    if (!o.f && !o.c) { ctx.err('cut: you must specify a list of bytes, characters, or fields'); return lxErr(ctx, "Try 'cut --help' for more information."); }
    const pick = lxCutList(o.f || o.c);
    if (!pick) return lxErr(ctx, `cut: invalid field range`);
    const sep = o.d ?? '\t';
    if (sep.length !== 1) return lxErr(ctx, 'cut: the delimiter must be a single character');
    const {lines, failed} = lxFilterLines(ctx, p.rest);
    for (const l of lines) {
      if (o.c) ctx.out([...l].filter((_, i) => pick(i + 1)).join(''));
      else if (!l.includes(sep)) { if (!o.s) ctx.out(l); }
      else ctx.out(l.split(sep).filter((_, i) => pick(i + 1)).join(sep));
    }
    return failed ? 1 : 0;
  },
};
