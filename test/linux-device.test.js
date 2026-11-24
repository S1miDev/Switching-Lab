// The Linux lab host as the console uses it: prompt, sudo and its password, help, Tab and the root shell.
const test = require('node:test');
const assert = require('node:assert');
const get = require('./linux-load');

const DEVICE_TYPES = get('DEVICE_TYPES'), runOn = get('runOn'), lxFind = get('lxFind');

// a lab host in a minimal session; run(line) types a line the way the console does and returns "text" / "ERR text"
function host(init = {}) {
  const session = {typed: {}, devices: {}};
  const dev = session.devices.lab = DEVICE_TYPES.linux({id: 'lab', init}, session);
  const run = line => runOn(session, 'lab', line).map(l => (l.cls === 'ln-err' ? 'ERR ' : '') + l.text);
  return {session, dev, st: dev.state, run};
}

test('the prompt shows the user, host and directory with ~', () => {
  const {dev, run} = host();
  assert.equal(dev.prompt(), 'student@lab:~$');
  run('cd /tmp');
  assert.equal(dev.prompt(), 'student@lab:/tmp$');
  assert.equal(dev.questionHelp, false);
  assert.ok(dev.configurable);
});

test('unknown and not simulated commands say so', () => {
  const {run} = host();
  assert.deepEqual(run('foo'), ['ERR foo: command not found']);
  assert.deepEqual(run('ping 1.1.1.1'), ['ERR ping: not available in this lab (type help for the commands you can use)']);
});

test('sudo asks for the password once, hides it, and runs the command as root', () => {
  const {dev, st, run, session} = host();
  assert.deepEqual(run('sudo echo hi > /dev/null'), []);
  assert.equal(dev.asksPassword(), true);
  assert.equal(dev.prompt(), '[sudo] password for student:');
  assert.deepEqual(run('student'), []);
  assert.equal(dev.asksPassword(), false);
  assert.ok(!(session.typed.lab || []).includes('student'), 'the password is not kept for the hints');
  assert.deepEqual(run('kill 640'), ['ERR bash: kill: (640) - Operation not permitted']);
  assert.deepEqual(run('sudo kill 640'), [], 'a second sudo does not ask again, and runs as root');
  assert.equal(dev.asksPassword(), false);
  assert.ok(!st.procs.some(p => p.pid === 640));
});

test('three wrong sudo passwords give up', () => {
  const {dev, st, run} = host();
  run('sudo kill 640');
  assert.deepEqual(run('nope'), ['ERR Sorry, try again.']);
  assert.deepEqual(run('nope'), ['ERR Sorry, try again.']);
  assert.deepEqual(run('nope'), ['ERR sudo: 3 incorrect password attempts']);
  assert.equal(dev.asksPassword(), false);
  assert.ok(st.procs.some(p => p.pid === 640), 'the command did not run');
  assert.equal(dev.prompt(), 'student@lab:~$');
});

test('sudo does not cover a redirect: the shell opens the file as student', () => {
  const {run} = host();
  run('sudo true');
  run('student');
  assert.deepEqual(run('sudo echo hi > /etc/motd'), ['ERR bash: /etc/motd: Permission denied']);
  assert.deepEqual(run('sudo cd /root'), ['ERR sudo: cd: command not found']);
});

test('a line ending in ? is bash, not help; help lists the commands', () => {
  const {run} = host({files: [['/home/student/a1.txt', '']]});
  assert.deepEqual(run('echo hi?'), ['hi?']);
  assert.deepEqual(run('echo a?.txt'), ['a1.txt']);
  const help = run('help').join('\n');
  assert.match(help, /\bls\b/);
  assert.match(help, /\bcd\b/);
  assert.deepEqual(run('?'), run('help'));
});

test('Tab completes commands and paths, escaping spaces', () => {
  const {dev, run} = host({files: [['/home/student/my file', ''], ['/home/student/notes.txt', ''], ['/home/student/notes.md', '']]});
  assert.equal(dev.complete('ls /et').value, 'ls /etc/');
  assert.equal(dev.complete('cat my').value, 'cat my\\ file ');
  assert.equal(dev.complete('pw').value, 'pwd ');
  const both = dev.complete('cat no');
  assert.equal(both.value, 'cat notes.');
  assert.equal(dev.complete('cat notes.').list, 'notes.md  notes.txt');
  run('cd /');
  assert.equal(dev.complete('ls tm').value, 'ls tmp/');
});

test('review fixes: no Tab at a password prompt, real commands are never "not found", ordinary packages can be removed', () => {
  const {dev, st, run} = host();
  run('sudo ls');
  assert.deepEqual(dev.complete('pw'), {value: 'pw'}, 'Tab must not complete a hidden password');
  run('student');
  assert.deepEqual(run('ll'), ['ERR ll: not available in this lab (type help for the commands you can use)']);
  assert.deepEqual(run('printf hi'), ['ERR printf: not available in this lab (type help for the commands you can use)']);
  run('sudo apt remove -y nano');
  assert.equal(st.packages.nano, undefined);
  assert.match(run('sudo apt remove -y coreutils').join('\n'), /essential/);
});

test('Tab completes inside an open quote, closing it after a file', () => {
  const {dev} = host({files: [['/home/student/my file', ''], ['/home/student/my notes.txt', '']], dirs: [['/home/student/docs']]});
  assert.equal(dev.complete('cat "my f').value, 'cat "my file" ');
  assert.equal(dev.complete("cat 'my").value, "cat 'my ", 'the common prefix, still inside the quote');
  assert.equal(dev.complete('ls "/et').value, 'ls "/etc/', 'a directory leaves the quote open');
  assert.equal(dev.complete('ls "do').value, 'ls "docs/');
  assert.equal(dev.complete('cat my').value, 'cat my\\ ', 'without a quote, spaces are escaped as before');
});

test('sudo -i opens a root shell and exit goes back', () => {
  const {dev, run} = host();
  run('sudo -i');
  run('student');
  assert.equal(dev.prompt(), 'root@lab:~#');
  assert.deepEqual(run('pwd'), ['/root']);
  run('exit');
  assert.equal(dev.prompt(), 'student@lab:~$');
});

test('su fails: Ubuntu locks the root password', () => {
  const {dev, run} = host();
  run('su');
  assert.equal(dev.prompt(), 'Password:');
  assert.equal(dev.asksPassword(), true);
  assert.deepEqual(run('anything'), ['ERR su: Authentication failure']);
  assert.equal(dev.prompt(), 'student@lab:~$');
});

test('the device has hints and a banner, and no ports yet', () => {
  const {dev} = host();
  assert.match(dev.hints.nudge('sudo useradd -m bob'), /You are student in ~.*"sudo".*needs root/);
  assert.match(dev.hints.syntax('kill 640'), /^kill \[/);
  assert.match(dev.hints.syntax('sudo kill 640'), /^kill \[/);
  assert.match(dev.hints.syntax("cut -d' ' -f1 log | sort | uniq -c > top.txt"), /^cut .* \| sort .* \| uniq /, 'a pipeline shows every command');
  assert.equal(dev.hints.syntax('Spring72!'), null, 'a line that is not a command (a typed password) has no syntax');
  assert.match(dev.banner()[0], /^Welcome to Ubuntu 24\.04/);
  assert.deepEqual(dev.ports(), []);
});
