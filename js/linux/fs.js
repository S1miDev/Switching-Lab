// Linux track: the simulated system a Linux lab host runs on: a filesystem tree, users and groups, packages and processes.
// A lab host's device state (js/devices/linux.js) is one lxState; the lab requirements read it through lxFind and the
// user and package maps. Ubuntu 24.04 is the model: what is here, its owners and modes, follow a fresh install.
//
// A node is {type: 'file'|'dir', mode, owner, group, mtime, content (file) | children {name: node} (dir), gen?}:
//   mode     the permission bits as a number, with setuid 0o4000, setgid 0o2000 and sticky 0o1000
//   gen(st)  for files generated from the state (/etc/passwd, /etc/group, /etc/shadow): their content on every read
// A file's size is its content length (the labs use plain ASCII text).

const LX_ERR = {
  ENOENT: 'No such file or directory', ENOTDIR: 'Not a directory', EACCES: 'Permission denied', EISDIR: 'Is a directory',
  EEXIST: 'File exists', ENOTEMPTY: 'Directory not empty', EPERM: 'Operation not permitted',
};
const LX_PASSWORD = 'student'; // student's password, shown in every lab's text
const LX_INSTALLED = new Date('2026-09-14T10:21:00').getTime(); // when the system files were written
const LX_LOGIN = new Date('2026-11-24T08:02:00').getTime();      // when the lab's own files were written

const lxDir = (mode = 0o755, owner = 'root', group = owner, mtime = LX_INSTALLED) => ({type: 'dir', mode, owner, group, mtime, children: {}});
const lxFile = (content = '', mode = 0o644, owner = 'root', group = owner, mtime = LX_INSTALLED) => ({type: 'file', mode, owner, group, mtime, content});
const lxCopy = v => JSON.parse(JSON.stringify(v)); // plain data only
const lxContent = (st, node) => (node.gen ? node.gen(st) : node.content);
const lxSize = (st, node) => (node.type === 'dir' ? 4096 : lxContent(st, node).length);

// ---- users and groups ----

const LX_USERS = {
  root: {uid: 0, gid: 0, gecos: 'root', home: '/root', shell: '/bin/bash', pw: null},
  daemon: {uid: 1, gid: 1, gecos: 'daemon', home: '/usr/sbin', shell: '/usr/sbin/nologin', pw: null},
  bin: {uid: 2, gid: 2, gecos: 'bin', home: '/bin', shell: '/usr/sbin/nologin', pw: null},
  sys: {uid: 3, gid: 3, gecos: 'sys', home: '/dev', shell: '/usr/sbin/nologin', pw: null},
  'www-data': {uid: 33, gid: 33, gecos: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin', pw: null},
  nobody: {uid: 65534, gid: 65534, gecos: 'nobody', home: '/nonexistent', shell: '/usr/sbin/nologin', pw: null},
  syslog: {uid: 102, gid: 102, gecos: '', home: '/nonexistent', shell: '/usr/sbin/nologin', pw: null},
  student: {uid: 1000, gid: 1000, gecos: 'Student,,,', home: '/home/student', shell: '/bin/bash', pw: LX_PASSWORD},
};
const LX_GROUPS = {
  root: {gid: 0, members: []}, daemon: {gid: 1, members: []}, bin: {gid: 2, members: []}, sys: {gid: 3, members: []},
  adm: {gid: 4, members: ['syslog']}, tty: {gid: 5, members: []}, sudo: {gid: 27, members: ['student']},
  'www-data': {gid: 33, members: []}, shadow: {gid: 42, members: []}, users: {gid: 100, members: []},
  syslog: {gid: 102, members: []}, student: {gid: 1000, members: []}, nogroup: {gid: 65534, members: []},
};

const lxGroupOfGid = (st, gid) => Object.keys(st.groups).find(g => st.groups[g].gid === gid);
// a user's groups: the primary one first, then the ones that list the user as a member
const lxUserGroups = (st, user) => {
  const primary = lxGroupOfGid(st, st.users[user].gid);
  return [primary, ...Object.keys(st.groups).filter(g => g !== primary && st.groups[g].members.includes(user))];
};
const lxInGroup = (st, user, group) => lxUserGroups(st, user).includes(group);

// ---- packages and processes ----

// the packages apt knows, with the commands each one adds; LX_BASE are installed on a fresh system
const LX_REPO = {
  bash: {version: '5.2.21-2ubuntu4', cmds: ['bash']}, coreutils: {version: '9.4-3ubuntu6', cmds: []},
  grep: {version: '3.11-4build1', cmds: []}, findutils: {version: '4.9.0-5build1', cmds: []},
  sudo: {version: '1.9.15p5-3ubuntu5', cmds: []}, apt: {version: '2.7.14build2', cmds: []},
  passwd: {version: '1:4.13+dfsg1-4ubuntu3', cmds: []}, procps: {version: '2:4.0.4-4ubuntu3', cmds: []},
  nano: {version: '7.2-2build1', cmds: ['nano']}, 'vim-tiny': {version: '2:9.1.0016-1ubuntu7', cmds: ['vi']},
  'openssh-server': {version: '1:9.6p1-3ubuntu13.5', cmds: ['sshd']}, cron: {version: '3.0pl1-184ubuntu2', cmds: ['crontab']},
  tree: {version: '2.1.1-2ubuntu3', cmds: ['tree']}, htop: {version: '3.3.0-4build1', cmds: ['htop']},
  curl: {version: '8.5.0-2ubuntu10.4', cmds: ['curl']}, git: {version: '1:2.43.0-1ubuntu7.1', cmds: ['git']},
  nginx: {version: '1.24.0-2ubuntu7.1', cmds: ['nginx']}, 'net-tools': {version: '2.10-0.1ubuntu4', cmds: ['ifconfig', 'netstat']},
  jq: {version: '1.7.1-3build1', cmds: ['jq']}, zip: {version: '3.0-13build1', cmds: ['zip']},
  unzip: {version: '6.0-28ubuntu4', cmds: ['unzip']}, ncdu: {version: '1.19-0.1', cmds: ['ncdu']},
  figlet: {version: '2.2.5-3', cmds: ['figlet']}, cowsay: {version: '3.03+dfsg2-8', cmds: ['cowsay']},
  sl: {version: '5.02-1', cmds: ['sl']}, tmux: {version: '3.4-1build1', cmds: ['tmux']},
  mc: {version: '3:4.8.30-1ubuntu0.1', cmds: ['mc']}, neofetch: {version: '7.1.0-4', cmds: ['neofetch']},
  'apache2-utils': {version: '2.4.58-1ubuntu8.4', cmds: ['ab', 'htpasswd']}, whois: {version: '5.5.22', cmds: ['whois', 'mkpasswd']},
};
const LX_BASE = ['bash', 'coreutils', 'grep', 'findutils', 'sudo', 'apt', 'passwd', 'procps', 'nano', 'vim-tiny', 'openssh-server', 'cron'];

// {pid, user, cmd, cpu, mem, tty, stat, start, ignoresTerm}; the student's own shell is on pts/0
const LX_PROCS = [
  {pid: 1, user: 'root', cmd: '/sbin/init', cpu: 0.0, mem: 0.3, tty: '?', stat: 'Ss', start: '08:01'},
  {pid: 412, user: 'root', cmd: '/usr/lib/systemd/systemd-journald', cpu: 0.0, mem: 0.4, tty: '?', stat: 'Ss', start: '08:01'},
  {pid: 601, user: 'syslog', cmd: '/usr/sbin/rsyslogd -n -iNONE', cpu: 0.0, mem: 0.2, tty: '?', stat: 'Ssl', start: '08:01'},
  {pid: 640, user: 'root', cmd: '/usr/sbin/cron -f -P', cpu: 0.0, mem: 0.1, tty: '?', stat: 'Ss', start: '08:01'},
  {pid: 812, user: 'root', cmd: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups', cpu: 0.0, mem: 0.3, tty: '?', stat: 'Ss', start: '08:01'},
  {pid: 4101, user: 'student', cmd: '-bash', cpu: 0.0, mem: 0.1, tty: 'pts/0', stat: 'Ss', start: '08:02'},
];

// ---- the filesystem of a fresh system ----

const LX_BASE_FILES = {
  '/etc/hostname': 'lab\n',
  '/etc/hosts': '127.0.0.1 localhost\n127.0.1.1 lab\n\n# The following lines are desirable for IPv6 capable hosts\n' +
    '::1     ip6-localhost ip6-loopback\nfe00::0 ip6-localnet\nff00::0 ip6-mcastprefix\nff02::1 ip6-allnodes\nff02::2 ip6-allrouters\n',
  '/etc/os-release': 'PRETTY_NAME="Ubuntu 24.04.1 LTS"\nNAME="Ubuntu"\nVERSION_ID="24.04"\nVERSION="24.04.1 LTS (Noble Numbat)"\n' +
    'VERSION_CODENAME=noble\nID=ubuntu\nID_LIKE=debian\nHOME_URL="https://www.ubuntu.com/"\nUBUNTU_CODENAME=noble\n',
  '/etc/resolv.conf': 'nameserver 127.0.0.53\noptions edns0 trust-ad\nsearch .\n',
  '/etc/host.conf': 'multi on\n',
  '/etc/ld.so.conf': 'include /etc/ld.so.conf.d/*.conf\n',
  '/etc/sysctl.conf': '# /etc/sysctl.conf - Configuration file for setting system variables\n#net.ipv4.ip_forward=1\n',
  '/etc/adduser.conf': '# /etc/adduser.conf: `adduser\' configuration.\nDSHELL=/bin/bash\nDHOME=/home\nUSERGROUPS=yes\n',
  '/etc/shells': '# /etc/shells: valid login shells\n/bin/sh\n/usr/bin/sh\n/bin/bash\n/usr/bin/bash\n/bin/dash\n/usr/bin/dash\n',
  '/etc/motd': '',
  '/etc/fstab': '# /etc/fstab: static file system information.\nLABEL=cloudimg-rootfs\t/\text4\tdiscard,errors=remount-ro\t0 1\n',
  '/etc/ssh/sshd_config': 'Include /etc/ssh/sshd_config.d/*.conf\nKbdInteractiveAuthentication no\nUsePAM yes\nX11Forwarding yes\n',
  '/home/student/.bash_logout': '# ~/.bash_logout: executed by bash(1) when login shell exits.\n',
  '/home/student/.profile': '# ~/.profile: executed by the command interpreter for login shells.\nif [ -n "$BASH_VERSION" ]; then\n' +
    '    if [ -f "$HOME/.bashrc" ]; then\n\t. "$HOME/.bashrc"\n    fi\nfi\n',
  '/home/student/.bashrc': '# ~/.bashrc: executed by bash(1) for non-login shells.\ncase $- in\n    *i*) ;;\n      *) return;;\nesac\n' +
    'HISTCONTROL=ignoreboth\nHISTSIZE=1000\nalias ll=\'ls -alF\'\n',
};

// the whole base tree, then the lab's own files on top
function lxBaseTree(st) {
  st.root = lxDir();
  for (const d of ['/bin', '/boot', '/dev', '/etc', '/etc/ssh', '/home', '/opt', '/srv', '/usr', '/usr/bin', '/usr/sbin', '/usr/share',
    '/var', '/var/lib', '/var/log', '/var/www', '/mnt', '/media']) lxPut(st, d, lxDir());
  lxPut(st, '/root', lxDir(0o700));
  lxPut(st, '/tmp', lxDir(0o1777));
  lxPut(st, '/var/tmp', lxDir(0o1777));
  lxPut(st, '/home/student', lxDir(0o750, 'student'));
  for (const [path, content] of Object.entries(LX_BASE_FILES)) {
    const home = path.startsWith('/home/student/');
    lxPut(st, path, lxFile(content, 0o644, home ? 'student' : 'root'));
  }
  lxPut(st, '/etc/sudoers', lxFile('Defaults\tenv_reset\nroot\tALL=(ALL:ALL) ALL\n%sudo\tALL=(ALL:ALL) ALL\n', 0o440));
  lxPut(st, '/dev/null', {...lxFile('', 0o666), dev: 'null'});
  lxPut(st, '/var/log/syslog', lxFile('Nov 24 08:01:12 lab systemd[1]: Started cron.service - Regular background program processing daemon.\n', 0o640, 'syslog', 'adm'));
  lxPut(st, '/var/log/auth.log', lxFile('Nov 24 08:02:05 lab sshd[4098]: Accepted publickey for student from 10.0.2.2 port 51022 ssh2\n', 0o640, 'syslog', 'adm'));
  lxPut(st, '/etc/passwd', {...lxFile(), gen: s => Object.entries(s.users)
    .map(([n, u]) => `${n}:x:${u.uid}:${u.gid}:${u.gecos}:${u.home}:${u.shell}\n`).join('')});
  lxPut(st, '/etc/group', {...lxFile(), gen: s => Object.entries(s.groups)
    .map(([n, g]) => `${n}:x:${g.gid}:${g.members.join(',')}\n`).join('')});
  lxPut(st, '/etc/shadow', {...lxFile('', 0o640, 'root', 'shadow'), gen: s => Object.entries(s.users)
    .map(([n, u]) => `${n}:${u.pw ? '$y$j9T$' + 'Q'.repeat(22) : n === 'root' || u.uid >= 1000 ? '!' : '*'}:20010:0:99999:7:::\n`).join('')});
}

// put a node at an absolute path whose parent exists (set-up only: no permission checks)
function lxPut(st, abs, node) {
  const i = abs.lastIndexOf('/'), parent = lxFind(st, abs.slice(0, i) || '/');
  parent.children[abs.slice(i + 1)] = node;
  return node;
}

// put a node, making its missing parent directories first (owned like the node, as if its owner had made them)
function lxPutDeep(st, abs, node) {
  const parts = abs.split('/').filter(Boolean);
  let dir = st.root;
  for (const p of parts.slice(0, -1)) dir = dir.children[p] ||= lxDir(node.owner === 'root' ? 0o755 : 0o775, node.owner, node.group, node.mtime);
  dir.children[parts.at(-1)] = node;
  return node;
}

// A fresh system with a lab's own set-up on top. init (all optional):
//   dirs     [[path, {mode, owner, group}]]           files  [[path, content, {mode, owner, group}]]
//   users    {name: {uid, gid, gecos, home, shell, pw}} groups {name: {gid, members}}
//   procs    [{pid, user, cmd, cpu, mem, tty, stat, start, ignoresTerm}]   packages [names installed besides the base]   cwd
//   services [{name, desc, cmd, user, enabled, failed, active, pid (needed when active), config, log}]
function lxState(init = {}) {
  const st = {
    host: 'lab', user: 'student', cwd: init.cwd || '/home/student', oldpwd: null, root: null,
    users: lxCopy(LX_USERS), groups: lxCopy(LX_GROUPS),
    packages: Object.fromEntries([...LX_BASE, ...(init.packages || [])].map(p => [p, LX_REPO[p].version])),
    repo: LX_REPO, aptUpdated: false,
    procs: lxCopy([...LX_PROCS, ...(init.procs || [])]), jobs: [], nextPid: 4210,
    umask: 0o002, status: 0, sudoOk: false, askPw: null, shells: [],
    services: {}, // {name: {desc, cmd, user, enabled, failed, pid, config: {path, line, error} or null, log: []}}
    ifs: [], // network interfaces: none in version 1 (room for Linux hosts in the network labs later)
  };
  for (const {name, pid = null, active, ...s} of init.services || []) {
    st.services[name] = {desc: name, cmd: `/usr/sbin/${name}`, user: 'root', enabled: false, failed: false, config: null, log: [], ...lxCopy(s), pid: active ? pid : null};
    if (active) st.procs.push({pid, user: st.services[name].user, cmd: st.services[name].cmd, cpu: 0, mem: 0.5, tty: '?', stat: 'Ss', start: '08:01'});
  }
  for (const [name, u] of Object.entries(init.users || {})) st.users[name] = {gecos: '', shell: '/bin/bash', pw: null, ...lxCopy(u)};
  for (const [name, g] of Object.entries(init.groups || {})) st.groups[name] = lxCopy(g);
  lxBaseTree(st);
  const opts = (o = {}) => [o.mode, o.owner || 'student', o.group || o.owner || 'student', LX_LOGIN];
  for (const [path, o] of init.dirs || []) lxPutDeep(st, path, lxDir(...opts({mode: 0o775, ...o})));
  for (const [path, content, o] of init.files || []) lxPutDeep(st, path, lxFile(content, ...opts({mode: 0o664, ...o})));
  return st;
}

// ---- paths and lookups ----

// an absolute, normalised path: relative to the cwd, with . and .. resolved (~ is expanded by the shell before this)
function lxPath(st, path) {
  const out = [];
  for (const p of (path.startsWith('/') ? path : st.cwd + '/' + path).split('/')) {
    if (p === '..') out.pop();
    else if (p && p !== '.') out.push(p);
  }
  return '/' + out.join('/');
}

const lxParent = abs => abs.slice(0, abs.lastIndexOf('/')) || '/';
const lxBase = abs => abs.slice(abs.lastIndexOf('/') + 1);

// the node at an absolute path, or null; no permission checks (the requirements use this)
function lxFind(st, abs) {
  let node = st.root;
  for (const p of abs.split('/').filter(Boolean)) {
    if (node?.type !== 'dir') return null;
    node = node.children[p];
  }
  return node || null;
}

// Walk to an absolute path as a user: every directory on the way needs x. Returns {node, parent, name, error}:
// node is null when the last part is missing (error ENOENT, parent set); error ENOENT/ENOTDIR/EACCES when the way there fails.
function lxWalk(st, user, abs) {
  const parts = abs.split('/').filter(Boolean);
  let dir = st.root;
  for (const p of parts.slice(0, -1)) {
    if (!lxMay(st, user, dir, 'x')) return {node: null, parent: null, name: p, error: 'EACCES'};
    const next = dir.children[p];
    if (!next) return {node: null, parent: null, name: p, error: 'ENOENT'};
    if (next.type !== 'dir') return {node: null, parent: null, name: p, error: 'ENOTDIR'};
    dir = next;
  }
  if (!parts.length) return {node: st.root, parent: null, name: '/', error: null};
  if (!lxMay(st, user, dir, 'x')) return {node: null, parent: null, name: parts.at(-1), error: 'EACCES'};
  const node = dir.children[parts.at(-1)] || null;
  return {node, parent: dir, name: parts.at(-1), error: node ? null : 'ENOENT'};
}

// may this user read (r), write (w) or execute/enter (x) the node? Root may always read and write, and execute when any
// x bit is set; anyone else gets the owner bits, else the group bits (primary group or member), else the other bits
function lxMay(st, user, node, perm) {
  if (user === 'root') return perm !== 'x' || node.type === 'dir' || (node.mode & 0o111) !== 0;
  const shift = node.owner === user ? 6 : lxInGroup(st, user, node.group) ? 3 : 0;
  return ((node.mode >> shift) & {r: 4, w: 2, x: 1}[perm]) !== 0;
}

// may this user delete or rename the entry name in dir? (w and x on the dir; in a sticky dir only the owners may)
const lxMayUnlink = (st, user, dir, node) => lxMay(st, user, dir, 'w') && lxMay(st, user, dir, 'x') &&
  (!(dir.mode & 0o1000) || user === 'root' || node.owner === user || dir.owner === user);

// A new file or directory in an existing parent, owned by the user, with the umask applied. A setgid parent passes on
// its group (and, to a new directory, its setgid bit), as on Linux.
function lxMake(st, user, abs, type, content = '') {
  const parent = lxFind(st, lxParent(abs)), sgid = (parent.mode & 0o2000) !== 0;
  const group = sgid ? parent.group : lxGroupOfGid(st, st.users[user].gid);
  const mode = ((type === 'dir' ? 0o777 : 0o666) & ~st.umask) | (type === 'dir' && sgid ? 0o2000 : 0);
  const node = type === 'dir' ? lxDir(mode, user, group, Date.now()) : lxFile(content, mode, user, group, Date.now());
  parent.children[lxBase(abs)] = node;
  parent.mtime = Date.now();
  return node;
}

// ---- modes ----

// the ls -l mode column, e.g. drwxrwsr-x
function lxModeString(node) {
  const m = node.mode, bit = (b, ch) => (m & b ? ch : '-');
  const spec = (x, special, on, off) => (m & special ? (m & x ? on : off) : bit(x, 'x'));
  return (node.type === 'dir' ? 'd' : '-') +
    bit(0o400, 'r') + bit(0o200, 'w') + spec(0o100, 0o4000, 's', 'S') +
    bit(0o040, 'r') + bit(0o020, 'w') + spec(0o010, 0o2000, 's', 'S') +
    bit(0o004, 'r') + bit(0o002, 'w') + spec(0o001, 0o1000, 't', 'T');
}

// A chmod mode applied to a current mode: octal (a directory keeps its setuid/setgid bits unless 5 digits say otherwise,
// as GNU chmod does) or symbolic clauses like u+x,g-w,o= (no who means all, masked by the umask). null when invalid.
function lxApplyMode(spec, mode, isDir, umask = 0) {
  if (/^[0-7]{1,5}$/.test(spec)) {
    const n = parseInt(spec, 8);
    return isDir && spec.length < 5 ? n | (mode & 0o6000) : n;
  }
  for (const clause of spec.split(',')) {
    const m = /^([ugoa]*)((?:[-+=][rwxXst]*)+)$/.exec(clause);
    if (!m) return null;
    const who = m[1].replace(/a/g, 'ugo') || 'ugo', masked = !m[1];
    for (const [, op, perms] of m[2].matchAll(/([-+=])([rwxXst]*)/g)) {
      let bits = 0, clear = 0;
      for (const c of new Set(who)) {
        const shift = {u: 6, g: 3, o: 0}[c];
        let b = (perms.includes('r') ? 4 : 0) | (perms.includes('w') ? 2 : 0) | (perms.includes('x') ? 1 : 0);
        if (perms.includes('X') && (isDir || mode & 0o111)) b |= 1;
        bits |= b << shift;
        clear |= 7 << shift;
        if (perms.includes('s') && c === 'u') bits |= 0o4000;
        if (perms.includes('s') && c === 'g') bits |= 0o2000;
        if (perms.includes('t') && c === 'o') bits |= 0o1000;
        if (!isDir) clear |= {u: 0o4000, g: 0o2000, o: 0o1000}[c];
      }
      if (masked) bits &= ~umask;
      mode = op === '+' ? mode | bits : op === '-' ? mode & ~bits : (mode & ~clear) | bits;
    }
  }
  return mode;
}
