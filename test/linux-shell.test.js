// The Linux track's bash parser, word expansion, filesystem permissions and modes.
const test = require('node:test');
const assert = require('node:assert');
const get = require('./linux-load');

const lxParse = get('lxParse'), lxExpand = get('lxExpand'), lxState = get('lxState'), lxRun = get('lxRun');
const lxMay = get('lxMay'), lxFind = get('lxFind'), lxApplyMode = get('lxApplyMode'), lxModeString = get('lxModeString');
const plain = v => JSON.parse(JSON.stringify(v)); // values from the test context, as plain data
const text = word => word.map(s => s.text).join('');

// run one line as the shell, returns the printed lines as "text" or "ERR text"
function sh(st, line) {
  const lines = [];
  lxRun(st, line, (t, cls) => lines.push(cls === 'ln-err' ? 'ERR ' + t : t));
  return lines;
}

test('quotes and backslashes make one word each, and keep how they were quoted', () => {
  const p = lxParse(`echo 'a b' "c $HOME" d\\ e`);
  const words = p.list[0].pipeline[0].words;
  assert.deepStrictEqual(plain(words.map(text)), ['echo', 'a b', 'c $HOME', 'd e']);
  assert.deepStrictEqual(plain(words[1]), [{text: 'a b', q: "'"}]);
  assert.deepStrictEqual(plain(words[2]), [{text: 'c $HOME', q: '"'}]);
});

test('pipes, redirects and list operators split the line', () => {
  const p = plain(lxParse('a | b > f 2> e && c; d &'));
  assert.deepStrictEqual(p.list.map(i => i.then), ['&&', ';', '&']);
  const [a, b] = p.list[0].pipeline;
  assert.deepStrictEqual(a.words.map(text), ['a']);
  assert.deepStrictEqual(b.redirects.map(r => [r.fd, r.op, text(r.target)]), [[1, '>', 'f'], [2, '>', 'e']]);
  assert.deepStrictEqual(p.list[1].pipeline[0].words.map(text), ['c']);
  assert.deepStrictEqual(p.list[2].pipeline[0].words.map(text), ['d']);
  assert.deepStrictEqual(plain(lxParse('sort < in >> out 2>&1')).list[0].pipeline[0].redirects.map(r => r.op), ['<', '>>', '2>&1']);
});

test('shell syntax that is not simulated says so', () => {
  assert.match(lxParse('echo $(ls)').error, /command substitution is not available in this lab/);
  assert.match(lxParse('echo `ls`').error, /command substitution is not available in this lab/);
  assert.match(lxParse('cat <<EOF').error, /not available in this lab/);
  assert.match(lxParse("echo 'oops").error, /unexpected EOF/);
  assert.match(lxParse('ls |').error, /syntax error/);
});

test('globs, tilde, braces and variables expand like bash', () => {
  const st = lxState({files: [['/home/student/a.txt', ''], ['/home/student/b.txt', ''], ['/home/student/.h.txt', '']]});
  const ex = line => plain(lxExpand(st, lxParse(line).list[0].pipeline[0].words[0]));
  assert.deepStrictEqual(ex('*.txt'), ['a.txt', 'b.txt']);
  assert.deepStrictEqual(ex('.*.txt'), ['.h.txt']);
  assert.deepStrictEqual(ex('?.txt'), ['a.txt', 'b.txt']);
  assert.deepStrictEqual(ex('[a].txt'), ['a.txt']);
  assert.deepStrictEqual(ex('*.zip'), ['*.zip'], 'no match stays literal');
  assert.deepStrictEqual(ex("'*.txt'"), ['*.txt'], 'quoted globs do not expand');
  assert.deepStrictEqual(ex('~/*.txt'), ['/home/student/a.txt', '/home/student/b.txt']);
  assert.deepStrictEqual(ex('~/x'), ['/home/student/x']);
  assert.deepStrictEqual(ex('~root'), ['/root']);
  assert.deepStrictEqual(ex('p/{a,b}'), ['p/a', 'p/b']);
  assert.deepStrictEqual(ex('f{1..3}'), ['f1', 'f2', 'f3']);
  assert.deepStrictEqual(ex('"c $HOME"'), ['c /home/student']);
  assert.deepStrictEqual(ex("'$HOME'"), ['$HOME']);
  assert.deepStrictEqual(ex('/etc/host*'), ['/etc/host.conf', '/etc/hostname', '/etc/hosts']);
});

test('a file name with a space survives quoting and escaping', () => {
  const st = lxState({});
  sh(st, 'echo hi > "my file"');
  assert.equal(lxFind(st, '/home/student/my file').content, 'hi\n');
  sh(st, 'echo there >> my\\ file');
  assert.equal(lxFind(st, '/home/student/my file').content, 'hi\nthere\n');
});

test('permissions: student reads but cannot write /etc, root may do anything', () => {
  const st = lxState({files: [['/var/log/app.log', 'x', {mode: 0o640, owner: 'root', group: 'adm'}]]});
  assert.equal(lxMay(st, 'student', lxFind(st, '/etc/hosts'), 'r'), true);
  assert.equal(lxMay(st, 'student', lxFind(st, '/etc/hosts'), 'w'), false);
  assert.equal(lxMay(st, 'student', lxFind(st, '/root'), 'x'), false);
  assert.equal(lxMay(st, 'root', lxFind(st, '/etc/hosts'), 'w'), true);
  assert.equal(lxMay(st, 'student', lxFind(st, '/var/log/app.log'), 'r'), false);
  st.groups.adm.members.push('student');
  assert.equal(lxMay(st, 'student', lxFind(st, '/var/log/app.log'), 'r'), true);
});

test('chmod modes: octal, symbolic, umask on a bare +x, setgid and sticky', () => {
  assert.equal(lxApplyMode('u+x,g-w', 0o664, false, 0o002), 0o744);
  assert.equal(lxApplyMode('755', 0o644, false, 0o002), 0o755);
  assert.equal(lxApplyMode('+x', 0o644, false, 0o022), 0o755);
  assert.equal(lxApplyMode('o=', 0o664, false, 0o002), 0o660);
  assert.equal(lxApplyMode('g+s', 0o775, true, 0o002), 0o2775);
  assert.equal(lxApplyMode('2770', 0o755, true, 0o002), 0o2770);
  assert.equal(lxApplyMode('770', 0o2775, true, 0o002), 0o2770, 'a 3-digit mode keeps a directory\'s setgid bit');
  assert.equal(lxApplyMode('a+X', 0o644, false, 0), 0o644, 'X adds x only to directories or files already executable');
  assert.equal(lxApplyMode('q+r', 0o644, false, 0), null);
  const st = lxState({});
  assert.equal(lxModeString({type: 'dir', mode: 0o2775}), 'drwxrwsr-x');
  assert.equal(lxModeString(lxFind(st, '/tmp')), 'drwxrwxrwt');
  assert.equal(lxModeString({type: 'file', mode: 0o600}), '-rw-------');
});

test('the shell runs lists, redirects and builtins with bash messages', () => {
  const st = lxState({});
  assert.deepStrictEqual(sh(st, 'pwd'), ['/home/student']);
  assert.deepStrictEqual(sh(st, 'cd /nope'), ['ERR bash: cd: /nope: No such file or directory']);
  assert.deepStrictEqual(sh(st, 'cd /etc/hosts'), ['ERR bash: cd: /etc/hosts: Not a directory']);
  assert.deepStrictEqual(sh(st, 'cd /root'), ['ERR bash: cd: /root: Permission denied']);
  sh(st, 'cd /tmp');
  assert.equal(st.cwd, '/tmp');
  assert.deepStrictEqual(sh(st, 'cd -'), ['/home/student']);
  assert.deepStrictEqual(sh(st, 'echo x > /etc/hosts'), ['ERR bash: /etc/hosts: Permission denied']);
  assert.deepStrictEqual(sh(st, 'echo a && echo b || echo c; echo d'), ['a', 'b', 'd']);
  assert.deepStrictEqual(sh(st, 'cd /nope || echo failed'), ['ERR bash: cd: /nope: No such file or directory', 'failed']);
  assert.deepStrictEqual(sh(st, 'echo $?'), ['0']);
  assert.deepStrictEqual(sh(st, 'nosuchcmd'), ['ERR nosuchcmd: command not found']);
  assert.deepStrictEqual(sh(st, 'echo $?'), ['127']);
  assert.deepStrictEqual(sh(st, 'ping 1.1.1.1'), ['ERR ping: not available in this lab (type help for the commands you can use)']);
  assert.deepStrictEqual(sh(st, 'tree'), ["ERR Command 'tree' not found, but can be installed with:", 'ERR sudo apt install tree']);
  assert.deepStrictEqual(sh(st, 'echo -n x > n.txt; echo y 2> /dev/null'), ['y']);
  assert.equal(lxFind(st, '/home/student/n.txt').content, 'x');
  assert.deepStrictEqual(sh(st, 'umask'), ['0002']);
  assert.deepStrictEqual(sh(st, 'umask -S'), ['u=rwx,g=rwx,o=rx']);
  sh(st, 'umask 027');
  assert.equal(st.umask, 0o027);
  assert.deepStrictEqual(sh(st, '# a comment'), []);
});

test('new files take the umask, the owner and a setgid parent\'s group', () => {
  const st = lxState({dirs: [['/srv/team', {mode: 0o2775, owner: 'root', group: 'sudo'}]]});
  sh(st, 'echo a > a.txt');
  const a = lxFind(st, '/home/student/a.txt');
  assert.deepStrictEqual([a.mode, a.owner, a.group], [0o664, 'student', 'student']);
  sh(st, 'echo b > /srv/team/b.txt');
  assert.equal(lxFind(st, '/srv/team/b.txt').group, 'sudo');
});
