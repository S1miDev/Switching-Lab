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
    const many = targets.length > 1 || rec;
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

// the lines of a filter's inputs (files or standard input), or null when one could not be read
function lxFilterLines(ctx, files) {
  let failed = false;
  const inputs = lxInputs(ctx, files, (f, c) => { failed = true; ctx.err(`${ctx.name}: ${f}: ${LX_ERR[c]}`); });
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
