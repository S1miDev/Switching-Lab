// The simulated commands print what GNU coreutils, procps, shadow-utils and apt print on Ubuntu 24.04.
const test = require('node:test');
const assert = require('node:assert');
const get = require('./linux-load');

const DEVICE_TYPES = get('DEVICE_TYPES'), runOn = get('runOn'), lxFind = get('lxFind');
const DATE = '[A-Z][a-z]{2} [ \\d]\\d (\\d\\d:\\d\\d| \\d{4})';

// a lab host; run(line) returns its lines as "text", or "ERR text" for errors
function host(init = {}) {
  const session = {typed: {}, devices: {}};
  const dev = session.devices.lab = DEVICE_TYPES.linux({id: 'lab', init}, session);
  const run = line => runOn(session, 'lab', line).map(l => (l.cls === 'ln-err' ? 'ERR ' : '') + l.text);
  const sudo = line => { const out = run('sudo ' + line); return dev.asksPassword() ? run('student') : out; };
  return {dev, st: dev.state, run, sudo};
}
const files = () => host({
  dirs: [['/home/student/t/logs']],
  files: [['/home/student/t/a.txt', 'hello\n'], ['/home/student/t/logs/x.log', 'one\nhello world\n'],
    ['/home/student/b.txt', ''], ['/home/student/my file', '']],
});

test('ls: one line on the terminal (quoted names aligned), one per line into a pipe, . and .. first with -a', () => {
  const {run} = files();
  assert.deepEqual(run('ls'), [" b.txt  'my file'   t"]);
  assert.deepEqual(run('ls | cat'), ['b.txt', 'my file', 't']);
  assert.deepEqual(run('ls -A | cat'), ['.bash_logout', '.bashrc', 'b.txt', 'my file', '.profile', 't']);
  assert.deepEqual(run('ls -a t | cat'), ['.', '..', 'a.txt', 'logs']);
  assert.deepEqual(run('ls t/a.txt /etc/hostname'), ['/etc/hostname  t/a.txt']);
  assert.deepEqual(run('ls -d t'), ['t']);
  assert.deepEqual(run('ls nope'), ["ERR ls: cannot access 'nope': No such file or directory"]);
  assert.deepEqual(run('ls /root'), ["ERR ls: cannot open directory '/root': Permission denied"]);
  assert.deepEqual(run('ls *.zip'), ["ERR ls: cannot access '*.zip': No such file or directory"]);
  assert.deepEqual(run('ls -Z'), ["ERR ls: option '-Z' is not available in this lab"]);
  assert.deepEqual(run('ls t nope 2>/dev/null'), ['t:', 'a.txt  logs']);
});

test('ls lays many names out in columns, filled top to bottom, within 80 characters', () => {
  const names = Array.from({length: 24}, (_, i) => `file-number-${String(i + 1).padStart(2, '0')}.txt`);
  const {run} = host({files: names.map(n => [`/home/student/d/${n}`, ''])});
  const lines = run('ls d');
  assert.ok(lines.length > 1 && lines.every(l => l.length <= 80), lines.join('\n'));
  assert.ok(lines[0].startsWith('file-number-01.txt  file-number-'));
  assert.ok(lines[1].startsWith('file-number-02.txt'), 'columns run top to bottom');
});

test('ls -l and -h: the mode, links, owner, size, date and name columns, with a total', () => {
  const {run} = host({dirs: [['/home/student/t/logs']], files: [['/home/student/t/a.txt', 'hello\n'], ['/home/student/t/big', 'x'.repeat(15000)],
    ['/home/student/t/k', 'x'.repeat(4096)]]});
  const l = run('ls -l t');
  assert.equal(l[0], 'total 28');
  assert.match(l[1], new RegExp(`^-rw-rw-r-- 1 student student     6 ${DATE} a\\.txt$`));
  assert.match(l[2], new RegExp(`^-rw-rw-r-- 1 student student 15000 ${DATE} big$`));
  assert.match(l[4], new RegExp(`^drwxrwxr-x 2 student student  4096 ${DATE} logs$`));
  const h = run('ls -lh t');
  assert.match(h[2], new RegExp(`^-rw-rw-r-- 1 student student  15K ${DATE} big$`));
  assert.match(h[3], new RegExp(`^-rw-rw-r-- 1 student student 4\\.0K ${DATE} k$`));
  assert.match(run('ls -ld /tmp')[0], new RegExp(`^drwxrwxrwt \\d+ root root 4096 ${DATE} /tmp$`));
  assert.match(run('ls -l /etc/shadow')[0], /^-rw-r----- 1 root shadow +\d+ .* \/etc\/shadow$/);
});

test('files: touch, mkdir, cp, mv, rm and rmdir, with their GNU errors', () => {
  const {run, st} = files();
  assert.deepEqual(run('touch c.txt; mkdir -p p/q/r; mkdir d'), []);
  assert.equal(lxFind(st, '/home/student/p/q/r').type, 'dir');
  assert.deepEqual(run('mkdir t'), ['ERR mkdir: cannot create directory ‘t’: File exists']);
  assert.deepEqual(run('mkdir a/b'), ['ERR mkdir: cannot create directory ‘a/b’: No such file or directory']);
  assert.deepEqual(run('mkdir /etc/x'), ['ERR mkdir: cannot create directory ‘/etc/x’: Permission denied']);
  assert.deepEqual(run('touch nope/x'), ["ERR touch: cannot touch 'nope/x': No such file or directory"]);
  assert.deepEqual(run('touch /etc/x'), ["ERR touch: cannot touch '/etc/x': Permission denied"]);
  assert.deepEqual(run('cp t/a.txt t/b.txt; cp /etc/hosts .'), []);
  assert.equal(lxFind(st, '/home/student/t/b.txt').content, 'hello\n');
  const hosts = lxFind(st, '/home/student/hosts');
  assert.deepEqual([hosts.owner, hosts.mode], ['student', 0o644 & ~0o002]);
  assert.deepEqual(run('cp nope x'), ["ERR cp: cannot stat 'nope': No such file or directory"]);
  assert.deepEqual(run('cp t u'), ["ERR cp: -r not specified; omitting directory 't'"]);
  assert.deepEqual(run('cp -r t u'), []);
  assert.equal(lxFind(st, '/home/student/u/logs/x.log').content, 'one\nhello world\n');
  assert.deepEqual(run('cp t/a.txt t/logs'), []);
  assert.ok(lxFind(st, '/home/student/t/logs/a.txt'));
  assert.deepEqual(run('mv t/b.txt t/c.txt; mv c.txt d'), []);
  assert.ok(lxFind(st, '/home/student/t/c.txt') && !lxFind(st, '/home/student/t/b.txt') && lxFind(st, '/home/student/d/c.txt'));
  assert.deepEqual(run('mv nope x'), ["ERR mv: cannot stat 'nope': No such file or directory"]);
  assert.deepEqual(run('rm nope'), ["ERR rm: cannot remove 'nope': No such file or directory"]);
  assert.deepEqual(run('rm t'), ["ERR rm: cannot remove 't': Is a directory"]);
  assert.deepEqual(run('rm /etc/hosts'), ["ERR rm: cannot remove '/etc/hosts': Permission denied"]);
  assert.deepEqual(run('rm -f nope'), []);
  assert.deepEqual(run('rmdir nope'), ["ERR rmdir: failed to remove 'nope': No such file or directory"]);
  assert.deepEqual(run('rmdir t'), ["ERR rmdir: failed to remove 't': Directory not empty"]);
  assert.deepEqual(run('rm -r u; rm "my file"; rmdir p/q/r'), []);
  assert.ok(!lxFind(st, '/home/student/u') && !lxFind(st, '/home/student/my file') && !lxFind(st, '/home/student/p/q/r'));
});

test('rm -rf / is refused even as root', () => {
  const {sudo} = files();
  assert.deepEqual(sudo('rm -rf /'), ["ERR rm: it is dangerous to operate recursively on '/'", 'ERR rm: use --no-preserve-root to override this failsafe']);
});

test('viewing: cat, less, head, tail and wc', () => {
  const lines = Array.from({length: 12}, (_, i) => `l${i + 1}`).join('\n') + '\n';
  const {run} = host({files: [['/home/student/f', lines], ['/home/student/a', 'one two\nthree\n']]});
  assert.deepEqual(run('cat a'), ['one two', 'three']);
  assert.deepEqual(run('cat -n a'), ['     1\tone two', '     2\tthree']);
  assert.deepEqual(run('cat nope'), ['ERR cat: nope: No such file or directory']);
  assert.deepEqual(run('cat /tmp'), ['ERR cat: /tmp: Is a directory']);
  assert.deepEqual(run('cat /etc/shadow'), ['ERR cat: /etc/shadow: Permission denied']);
  assert.deepEqual(run('less a'), ['one two', 'three', '(END)']);
  assert.equal(run('head f').length, 10);
  assert.deepEqual(run('head -n 3 f'), ['l1', 'l2', 'l3']);
  assert.deepEqual(run('head -2 f'), ['l1', 'l2']);
  assert.deepEqual(run('tail -n 2 f'), ['l11', 'l12']);
  assert.deepEqual(run('tail -1 f'), ['l12']);
  assert.deepEqual(run('cat f | tail -n 1'), ['l12']);
  assert.deepEqual(run('head nope'), ["ERR head: cannot open 'nope' for reading: No such file or directory"]);
  assert.deepEqual(run('wc -l a'), ['2 a']);
  assert.deepEqual(run('wc a'), [' 2  3 14 a']);
  assert.deepEqual(run('wc a a'), [' 2  3 14 a', ' 2  3 14 a', ' 4  6 28 total']);
  assert.deepEqual(run('cat a | wc -l'), ['2']);
  assert.deepEqual(run('cat a | wc'), ['      2       3      14']);
  assert.deepEqual(run('wc -w -c a'), [' 3 14 a']);
  assert.deepEqual(run('wc nope'), ['ERR wc: nope: No such file or directory']);
});

test('searching: grep and find', () => {
  const {run} = host({dirs: [['/home/student/t/logs']], files: [['/home/student/t/a.txt', 'hello\nHello again\nbye\n'],
    ['/home/student/t/logs/x.log', 'one\nhello world\n'], ['/home/student/t/logs/big.log', 'x'.repeat(12000)]]});
  assert.deepEqual(run('grep hello t/a.txt'), ['hello']);
  assert.deepEqual(run('grep -i hello t/a.txt'), ['hello', 'Hello again']);
  assert.deepEqual(run('grep -in again t/a.txt'), ['2:Hello again']);
  assert.deepEqual(run('grep -v hello t/a.txt'), ['Hello again', 'bye']);
  assert.deepEqual(run('grep -c -i hello t/a.txt'), ['2']);
  assert.deepEqual(run('grep -rn hello t'), ['t/a.txt:1:hello', 't/logs/x.log:2:hello world']);
  assert.deepEqual(run('grep -rl hello t'), ['t/a.txt', 't/logs/x.log']);
  assert.deepEqual(run('grep -E "^(one|bye)$" t/a.txt t/logs/x.log'), ['t/a.txt:bye', 't/logs/x.log:one']);
  assert.deepEqual(run('grep "hel\\+o" t/a.txt'), ['hello'], 'basic regex: \\+ means one or more');
  assert.deepEqual(run('grep x nope'), ['ERR grep: nope: No such file or directory']);
  assert.deepEqual(run('grep x t'), ['ERR grep: t: Is a directory']);
  assert.deepEqual(run('cd t; grep -r hello'), ['a.txt:hello', 'logs/x.log:hello world']);
  run('cd');
  assert.deepEqual(run("find t -name '*.log' -type f"), ['t/logs/big.log', 't/logs/x.log']);
  assert.deepEqual(run('find t -type d'), ['t', 't/logs']);
  assert.deepEqual(run('find . -name a.txt'), ['./t/a.txt']);
  assert.deepEqual(run('find t -size +10k'), ['t/logs/big.log']);
  assert.deepEqual(run('find t -user root'), []);
  assert.deepEqual(run('find nope'), ['ERR find: ‘nope’: No such file or directory']);
  assert.ok(run('find /root /etc -name hosts').includes('ERR find: ‘/root’: Permission denied'));
});

test('pipes and text: sort, uniq, cut', () => {
  const {run} = host({files: [['/home/student/n', '10\n9\n100\n9\n'], ['/home/student/c', 'b,2\na,10\nc,1\n']]});
  assert.deepEqual(run('sort n'), ['10', '100', '9', '9']);
  assert.deepEqual(run('sort -n n'), ['9', '9', '10', '100']);
  assert.deepEqual(run('sort -rn n'), ['100', '10', '9', '9']);
  assert.deepEqual(run('sort -u n'), ['10', '100', '9']);
  assert.deepEqual(run('sort -t, -k2 -n c'), ['c,1', 'b,2', 'a,10']);
  assert.deepEqual(run('sort n | uniq'), ['10', '100', '9']);
  assert.deepEqual(run('sort n | uniq -c'), ['      1 10', '      1 100', '      2 9']);
  assert.deepEqual(run('sort n | uniq -d'), ['9']);
  assert.deepEqual(run('cut -d, -f1 c'), ['b', 'a', 'c']);
  assert.deepEqual(run('cut -c1-3 c'), ['b,2', 'a,1', 'c,1']);
  assert.equal(run('cut -d: -f1 /etc/passwd')[0], 'root');
  assert.deepEqual(run('echo hi > o; echo there >> o; cat o'), ['hi', 'there']);
  assert.deepEqual(run('cat nope 2> e; cat e'), ['cat: nope: No such file or directory']);
});

test('permissions: chmod, chown, chgrp, and the setgid bit on directories', () => {
  const {run, sudo, st} = files();
  assert.deepEqual(run('chmod 600 t/a.txt'), []);
  assert.match(run('ls -l t/a.txt')[0], /^-rw------- /);
  run('chmod u+x,go-r t/a.txt');
  assert.equal(lxFind(st, '/home/student/t/a.txt').mode, 0o700);
  run('chmod -R o-rwx t');
  assert.equal(lxFind(st, '/home/student/t/logs/x.log').mode & 0o007, 0);
  assert.deepEqual(run('chmod 600 nope'), ["ERR chmod: cannot access 'nope': No such file or directory"]);
  assert.deepEqual(run('chmod 600 /etc/hosts'), ["ERR chmod: changing permissions of '/etc/hosts': Operation not permitted"]);
  assert.deepEqual(run('chmod q+r b.txt'), ["ERR chmod: invalid mode: ‘q+r’", "ERR Try 'chmod --help' for more information."]);
  assert.deepEqual(run('chown root t/a.txt'), ["ERR chown: changing ownership of 't/a.txt': Operation not permitted"]);
  assert.deepEqual(run('chown nobodyx t/a.txt'), ['ERR chown: invalid user: ‘nobodyx’']);
  assert.deepEqual(run('chgrp sudo b.txt'), []);
  assert.equal(lxFind(st, '/home/student/b.txt').group, 'sudo');
  assert.deepEqual(run('chgrp adm b.txt'), ["ERR chgrp: changing group of 'b.txt': Operation not permitted"]);
  assert.deepEqual(sudo('chown -R root:adm t'), []);
  assert.deepEqual([lxFind(st, '/home/student/t/logs/x.log').owner, lxFind(st, '/home/student/t/logs/x.log').group], ['root', 'adm']);
  sudo('mkdir /srv/team');
  run('sudo chgrp sudo /srv/team; sudo chmod 2775 /srv/team');
  assert.match(run('ls -ld /srv/team')[0], /^drwxrwsr-x 2 root sudo /);
  run('touch /srv/team/notes; mkdir /srv/team/sub');
  assert.equal(lxFind(st, '/srv/team/notes').group, 'sudo');
  assert.equal(lxFind(st, '/srv/team/sub').mode, 0o2775);
});

test('users and groups: whoami, id, groups, useradd, usermod, groupadd, passwd', () => {
  const {run, sudo, dev, st} = host();
  assert.deepEqual(run('whoami'), ['student']);
  assert.deepEqual(run('id'), ['uid=1000(student) gid=1000(student) groups=1000(student),27(sudo)']);
  assert.deepEqual(run('groups'), ['student sudo']);
  assert.deepEqual(run('useradd -m bob'), ['ERR useradd: Permission denied.', 'ERR useradd: cannot lock /etc/passwd; try again later.']);
  assert.deepEqual(sudo('useradd -m bob'), []);
  assert.equal(lxFind(st, '/home/bob').owner, 'bob');
  assert.ok(lxFind(st, '/home/bob/.bashrc'));
  assert.deepEqual(run('id bob'), ['uid=1001(bob) gid=1001(bob) groups=1001(bob)']);
  assert.ok(run('cat /etc/passwd').includes('bob:x:1001:1001::/home/bob:/bin/sh'));
  assert.deepEqual(run('sudo useradd bob'), ["ERR useradd: user 'bob' already exists"]);
  assert.deepEqual(run('sudo groupadd dev'), []);
  assert.deepEqual(run('sudo groupadd dev'), ["ERR groupadd: group 'dev' already exists"]);
  assert.deepEqual(run('sudo useradd -s /bin/bash -G dev,sudo -m carol'), []);
  assert.deepEqual(run('id carol'), ['uid=1002(carol) gid=1003(carol) groups=1003(carol),27(sudo),1002(dev)']);
  assert.deepEqual(run('sudo usermod -aG dev bob'), []);
  assert.deepEqual(run('id -nG bob'), ['bob dev']);
  assert.deepEqual(run('sudo usermod -s /bin/bash bob'), []);
  assert.equal(st.users.bob.shell, '/bin/bash');
  assert.deepEqual(run('sudo usermod -aG dev zed'), ["ERR usermod: user 'zed' does not exist"]);
  assert.deepEqual(run('sudo passwd bob'), []);
  assert.equal(dev.prompt(), 'New password:');
  assert.ok(dev.asksPassword());
  run('s3cret');
  assert.equal(dev.prompt(), 'Retype new password:');
  assert.deepEqual(run('s3cret'), ['passwd: password updated successfully']);
  assert.equal(st.users.bob.pw, 's3cret');
  run('sudo passwd bob');
  run('a');
  assert.deepEqual(run('b'), ['ERR Sorry, passwords do not match.', 'ERR passwd: Authentication token manipulation error', 'ERR passwd: password unchanged']);
  assert.deepEqual(run('passwd bob'), ['ERR passwd: You may not view or modify password information for bob.']);
});

test('processes: ps, top, kill and jobs', () => {
  const {run, st} = host({procs: [{pid: 2001, user: 'student', cmd: 'python3 backup.py', cpu: 87.5, mem: 3.1, tty: 'pts/1', stat: 'R', start: '09:12'}]});
  const ps = run('ps');
  assert.deepEqual(ps[0], '    PID TTY          TIME CMD');
  assert.match(ps[1], /^ {3}4101 pts\/0 {4}00:00:00 bash$/);
  assert.match(ps.at(-1), /^ +\d+ pts\/0 {4}00:00:00 ps$/);
  const aux = run('ps aux');
  assert.equal(aux[0], 'USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND');
  assert.ok(aux.some(l => /^student +2001 87\.5 +3\.1 .* python3 backup\.py$/.test(l)));
  assert.equal(run('ps -ef')[0], 'UID          PID    PPID  C STIME TTY          TIME CMD');
  const top = run('top');
  assert.match(top[0], /^top - \d\d:\d\d:\d\d up /);
  assert.ok(top.some(l => /python3/.test(l)));
  assert.match(top.at(-1), /one snapshot/);
  assert.deepEqual(run('kill 2001'), []);
  assert.ok(!st.procs.some(p => p.pid === 2001));
  assert.deepEqual(run('kill 2001'), ['ERR bash: kill: (2001) - No such process']);
  assert.match(run('sleep 100 &')[0], /^\[1\] \d+$/);
  assert.match(run('sleep 200 &')[0], /^\[2\] \d+$/);
  assert.deepEqual(run('jobs'), ['[1]-  Running                 sleep 100 &', '[2]+  Running                 sleep 200 &']);
  assert.ok(run('ps').some(l => / sleep$/.test(l)));
  assert.deepEqual(run('kill %1'), ['[1]-  Terminated              sleep 100']);
  assert.deepEqual(run('jobs'), ['[2]+  Running                 sleep 200 &']);
  assert.deepEqual(run('sleep 1'), []);
});

test('a process that ignores TERM needs kill -9', () => {
  const {run, sudo, st} = host({procs: [{pid: 3001, user: 'www-data', cmd: 'php-fpm: pool www', cpu: 99, mem: 2, tty: '?', stat: 'R', start: '07:00', ignoresTerm: true}]});
  assert.deepEqual(run('kill 3001'), ['ERR bash: kill: (3001) - Operation not permitted']);
  sudo('kill 3001');
  assert.ok(st.procs.some(p => p.pid === 3001), 'TERM is ignored');
  assert.deepEqual(run('sudo kill -9 3001'), []);
  assert.ok(!st.procs.some(p => p.pid === 3001));
});

test('apt: update, install, remove and list, root only for changes', () => {
  const {run, sudo, st} = host();
  assert.deepEqual(run('apt install tree'), ['ERR E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)',
    'ERR E: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?']);
  const upd = sudo('apt update');
  assert.ok(upd.includes('Reading package lists... Done') && st.aptUpdated);
  const inst = run('sudo apt install -y tree');
  assert.ok(inst.includes('Setting up tree (2.1.1-2ubuntu3) ...'), inst.join('\n'));
  assert.equal(st.packages.tree, '2.1.1-2ubuntu3');
  assert.deepEqual(run('tree'), ['ERR tree: not available in this lab (type help for the commands you can use)']);
  assert.ok(run('apt list --installed').includes('tree/noble,now 2.1.1-2ubuntu3 amd64 [installed]'));
  assert.deepEqual(run('sudo apt install nosuch'), ['Reading package lists... Done', 'Building dependency tree... Done',
    'Reading state information... Done', 'ERR E: Unable to locate package nosuch']);
  assert.ok(run('sudo apt install tree').includes('tree is already the newest version (2.1.1-2ubuntu3).'));
  run('sudo apt remove -y tree');
  assert.equal(st.packages.tree, undefined);
});

test('review: rm asks before removing a write-protected file, unless -f', () => {
  const {run, dev, st} = host({files: [['/home/student/p', 'x\n', {mode: 0o444}], ['/home/student/q', '', {mode: 0o444}], ['/home/student/r', 'x\n', {mode: 0o444}]]});
  assert.deepEqual(run('rm p'), []);
  assert.equal(dev.prompt(), "rm: remove write-protected regular file 'p'?");
  assert.equal(dev.asksPassword(), false, 'the answer is shown');
  run('n');
  assert.ok(lxFind(st, '/home/student/p'), 'n keeps it');
  run('rm p q');
  assert.equal(dev.prompt(), "rm: remove write-protected regular file 'p'?");
  run('y');
  assert.equal(dev.prompt(), "rm: remove write-protected regular empty file 'q'?");
  run('yes');
  assert.ok(!lxFind(st, '/home/student/p') && !lxFind(st, '/home/student/q'));
  assert.deepEqual(run('rm -f r'), []);
  assert.ok(!lxFind(st, '/home/student/r'));
});

test('review: smaller GNU and bash details', () => {
  const {run, dev} = host({files: [['/home/student/a', 'one two\nthree\n'], ['/home/student/t/x', 'hello\n']], users: {zed: {uid: 1005, gid: 1005, home: '/home/zed'}}, groups: {zed: {gid: 1005, members: []}}});
  assert.deepEqual(run('kill -l'), ["ERR kill: option '-l' is not available in this lab"]);
  assert.deepEqual(run('kill -s KILL 1'), ["ERR kill: option '-s' is not available in this lab"]);
  assert.deepEqual(run('cd -P /tmp; pwd'), ['/tmp']);
  run('cd');
  assert.deepEqual(run('wc -l a nothere'), [' 2 a', 'ERR wc: nothere: No such file or directory', ' 2 total']);
  assert.match(run('ls -ld /var/tmp')[0], /^drwxrwxrwt \d+ root root /);
  assert.deepEqual(run('grep -r hello t/x'), ['hello']);
  assert.deepEqual(run('sort nothere'), ['ERR sort: cannot read: nothere: No such file or directory']);
  assert.deepEqual(run('help cd'), ['ERR bash: help: help for one command is not available in this lab (type help for the list)']);
  run('sudo true');
  run('student');
  run('sudo useradd newbie');
  assert.deepEqual(run('id -u newbie'), ['1006'], 'useradd takes the highest uid plus one');
  run('sudo ls');
  run('sudo -k');
  run('sudo ls');
  assert.deepEqual(dev.help('?', () => {}), undefined);
  assert.equal(dev.prompt(), '[sudo] password for student:', 'a ? typed at a password prompt is an attempt, not help');
});

test('every command has a synopsis for the hints', () => {
  for (const [name, c] of Object.entries(get('LINUX_CMDS'))) assert.match(c.synopsis, new RegExp(`^${name}\\b`), name);
});

test('tr swaps, repeats the last character of a short SET2, deletes, and reports bad operands', () => {
  const {run} = host();
  assert.deepEqual(run('echo abc-12 | tr a-c A-C'), ['ABC-12']);
  assert.deepEqual(run("echo abcd | tr '[:lower:]' x"), ['xxxx']);
  assert.deepEqual(run('echo a-b-c | tr -d -'), ['abc']);
  assert.deepEqual(run('echo a | tr a'), ['ERR tr: missing operand after ‘a’', "ERR Try 'tr --help' for more information."]);
});

test('tee writes and appends, and only sudo tee writes a root file', () => {
  const {run, sudo} = host();
  assert.deepEqual(run('echo one | tee n'), ['one']);
  run('echo two | tee -a n');
  assert.deepEqual(run('cat n'), ['one', 'two']);
  assert.deepEqual(run('echo x | tee /etc/hostname'), ['ERR tee: /etc/hostname: Permission denied', 'x']);
  assert.deepEqual(run('cat /etc/hostname'), ['lab']);
  sudo('true');
  run('echo x | sudo tee -a /etc/hostname');
  assert.deepEqual(run('cat /etc/hostname'), ['lab', 'x']);
});

test('sed substitutes, deletes and prints lines; other scripts say so', () => {
  const {run} = host({files: [['/home/student/f', 'aa 80\nbb 8080\n']]});
  assert.deepEqual(run("sed 's/a/X/' f"), ['Xa 80', 'bb 8080']);
  assert.deepEqual(run("sed 's/A/X/gi' f"), ['XX 80', 'bb 8080']);
  assert.deepEqual(run("sed 's|\\(b*\\) 80|& \\1|' f"), ['aa 80 ', 'bb 80 bb80']);
  assert.deepEqual(run("sed 1d f"), ['bb 8080']);
  assert.deepEqual(run("sed '/^bb/d' f"), ['aa 80']);
  assert.deepEqual(run("sed -n 2p f"), ['bb 8080']);
  assert.deepEqual(run("echo a/b | sed 's/\\//-/'"), ['a-b']);
  assert.match(run("sed 'y/a/b/' f")[0], /^ERR sed: this script is not available/);
  assert.match(run("sed 's/a/b' f")[0], /unterminated/);
  assert.deepEqual(run('cat f'), ['aa 80', 'bb 8080']);
});

test('sed -i edits in place, needs write access to the directory, and takes a file it replaces', () => {
  const {st, run, sudo} = host({dirs: [['/srv/app', {owner: 'root', mode: 0o755}], ['/home/student/d']],
    files: [['/srv/app/a.conf', 'port = 1\n', {owner: 'root', mode: 0o666}], ['/home/student/d/b', 'x\n', {owner: 'root', mode: 0o644}]]});
  assert.deepEqual(run("sed -i 's/1/2/' /srv/app/a.conf"), ["ERR sed: couldn't open temporary file /srv/app/sedXXXXXX: Permission denied"]);
  assert.deepEqual(sudo("sed -i 's/1/2/' /srv/app/a.conf"), []);
  assert.equal(lxFind(st, '/srv/app/a.conf').content, 'port = 2\n');
  assert.equal(lxFind(st, '/srv/app/a.conf').owner, 'root');
  st.sudoOk = false;
  assert.deepEqual(run("sed -i 's/x/y/' d/b"), []);
  assert.equal(lxFind(st, '/home/student/d/b').owner, 'student');
});
