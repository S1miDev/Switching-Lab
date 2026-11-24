// Linux track: permissions and ownership (chmod chown chgrp), users and groups (whoami id groups useradd usermod groupadd
// passwd), processes (ps top sleep) and packages (apt), with the output of Ubuntu 24.04's coreutils, shadow-utils, procps
// and apt. kill, jobs and umask are shell builtins (js/linux/bash.js).

// ---- permissions ----

// apply fn(node, shown) to each operand (and, with -R, everything under it); missing operands print cmd's message
function lxEachFile(ctx, files, recursive, fn) {
  let code = 0;
  const visit = (node, shown) => {
    if (fn(node, shown)) code = 1;
    if (recursive && node.type === 'dir') for (const [n, c] of Object.entries(node.children)) visit(c, shown.replace(/\/$/, '') + '/' + n);
  };
  for (const f of files) {
    const w = lxAt(ctx, f);
    if (!w.node) { code = lxErr(ctx, `${ctx.name}: cannot access '${f}': ${LX_ERR[w.error]}`); continue; }
    visit(w.node, f);
  }
  return code;
}

const lxMayChange = (ctx, node) => ctx.user === 'root' || node.owner === ctx.user;

LINUX_CMDS.chmod = {
  synopsis: 'chmod [-R] MODE FILE...',
  run(ctx) {
    // a mode may start with - (chmod -x f), so only -R and --recursive are options here
    const rec = ctx.args.some(a => a === '-R' || a === '--recursive');
    const [mode, ...files] = ctx.args.filter(a => a !== '-R' && a !== '--recursive');
    if (mode === undefined) return lxErr(ctx, 'chmod: missing operand');
    if (lxApplyMode(mode, 0, false) === null) { ctx.err(`chmod: invalid mode: ‘${mode}’`); return lxErr(ctx, "Try 'chmod --help' for more information."); }
    if (!files.length) return lxErr(ctx, `chmod: missing operand after ‘${mode}’`);
    return lxEachFile(ctx, files, rec, (node, shown) => {
      if (!lxMayChange(ctx, node)) return lxErr(ctx, `chmod: changing permissions of '${shown}': ${LX_ERR.EPERM}`);
      node.mode = lxApplyMode(mode, node.mode, node.type === 'dir', ctx.st.umask);
    });
  },
};

// OWNER[:GROUP], OWNER:, :GROUP → {user, group} (null parts are left alone), or null after printing why
function lxOwnerSpec(ctx, spec) {
  const {st} = ctx, [u, g] = spec.split(/[:.]/);
  if (u && !st.users[u]) return ctx.err(`chown: invalid user: ‘${spec}’`), null;
  let group = g || null;
  if (spec.includes(':') && !g && u) group = lxGroupOfGid(st, st.users[u].gid);
  if (group && !st.groups[group]) return ctx.err(`chown: invalid group: ‘${spec}’`), null;
  return {user: u || null, group};
}

LINUX_CMDS.chown = {
  synopsis: 'chown [-R] OWNER[:GROUP] FILE...',
  run(ctx) {
    const p = lxOpts(ctx, ctx.args, 'R', '', {recursive: 'R'});
    if (!p) return 1;
    const [spec, ...files] = p.rest;
    if (!files.length) return lxErr(ctx, spec ? `chown: missing operand after ‘${spec}’` : 'chown: missing operand');
    const to = lxOwnerSpec(ctx, spec);
    if (!to) return 1;
    return lxEachFile(ctx, files, p.o.R, (node, shown) => {
      // only root gives files away; an owner may only change the group, to one of their own
      const ok = ctx.user === 'root' || (!to.user || to.user === node.owner) && node.owner === ctx.user && (!to.group || lxInGroup(ctx.st, ctx.user, to.group));
      if (!ok) return lxErr(ctx, `chown: changing ownership of '${shown}': ${LX_ERR.EPERM}`);
      if (to.user) node.owner = to.user;
      if (to.group) node.group = to.group;
    });
  },
};

LINUX_CMDS.chgrp = {
  synopsis: 'chgrp [-R] GROUP FILE...',
  run(ctx) {
    const p = lxOpts(ctx, ctx.args, 'R', '', {recursive: 'R'});
    if (!p) return 1;
    const [group, ...files] = p.rest;
    if (!files.length) return lxErr(ctx, group ? `chgrp: missing operand after ‘${group}’` : 'chgrp: missing operand');
    if (!ctx.st.groups[group]) return lxErr(ctx, `chgrp: invalid group: ‘${group}’`);
    return lxEachFile(ctx, files, p.o.R, (node, shown) => {
      if (ctx.user !== 'root' && (node.owner !== ctx.user || !lxInGroup(ctx.st, ctx.user, group))) return lxErr(ctx, `chgrp: changing group of '${shown}': ${LX_ERR.EPERM}`);
      node.group = group;
    });
  },
};

// ---- users and groups ----

LINUX_CMDS.whoami = {synopsis: 'whoami', run(ctx) { ctx.out(ctx.user); return 0; }};

LINUX_CMDS.id = {
  synopsis: 'id [-u|-g|-G] [-n] [USER]',
  run(ctx) {
    const {st} = ctx, p = lxOpts(ctx, ctx.args, 'ugGn');
    if (!p) return 1;
    const user = p.rest[0] ?? ctx.user;
    if (!st.users[user]) return lxErr(ctx, `id: ‘${user}’: no such user`);
    const u = st.users[user], groups = lxUserGroups(st, user), {o} = p;
    const g = name => (o.n ? name : String(st.groups[name].gid));
    if (o.u) ctx.out(o.n ? user : String(u.uid));
    else if (o.g) ctx.out(g(groups[0]));
    else if (o.G) ctx.out(groups.map(g).join(' '));
    else ctx.out(`uid=${u.uid}(${user}) gid=${u.gid}(${groups[0]}) groups=${groups.map(n => `${st.groups[n].gid}(${n})`).join(',')}`);
    return 0;
  },
};

LINUX_CMDS.groups = {
  synopsis: 'groups [USER]...',
  run(ctx) {
    const {st} = ctx;
    if (!ctx.args.length) { ctx.out(lxUserGroups(st, ctx.user).join(' ')); return 0; }
    let code = 0;
    for (const u of ctx.args) {
      if (!st.users[u]) code = lxErr(ctx, `groups: ‘${u}’: no such user`);
      else ctx.out(`${u} : ${lxUserGroups(st, u).join(' ')}`);
    }
    return code;
  },
};

// shadow-utils refuse anyone but root before doing anything
function lxNeedRoot(ctx, file = '/etc/passwd') {
  if (ctx.user === 'root') return false;
  ctx.err(`${ctx.name}: Permission denied.`);
  ctx.err(`${ctx.name}: cannot lock ${file}; try again later.`);
  return true;
}
// a new uid or gid as shadow-utils picks it: one above the highest in use from 1000 up
const lxFreeId = (taken, from = 1000) => Math.max(from - 1, ...taken.filter(n => n >= from && n < 60000)) + 1;

LINUX_CMDS.useradd = {
  synopsis: 'useradd [-m] [-s SHELL] [-g GROUP] [-G GROUP,...] [-d HOME] [-c COMMENT] USER',
  run(ctx) {
    const {st} = ctx, p = lxOpts(ctx, ctx.args, 'mM', 'sgGdc', {'create-home': 'm', shell: 's', gid: 'g', groups: 'G', home: 'd', comment: 'c'});
    if (!p) return 2;
    if (lxNeedRoot(ctx)) return 1;
    const {o} = p, name = p.rest[0];
    if (!name || p.rest.length > 1) return lxErr(ctx, 'Usage: useradd [options] LOGIN') * 2;
    if (!/^[a-z_][a-z0-9_-]*\$?$/.test(name)) return lxErr(ctx, `useradd: invalid user name '${name}': use --badname to ignore`) * 3;
    if (st.users[name]) return lxErr(ctx, `useradd: user '${name}' already exists`) * 9;
    if (o.g && !st.groups[o.g]) return lxErr(ctx, `useradd: group '${o.g}' does not exist`) * 6;
    const extra = o.G ? o.G.split(',') : [];
    const missing = extra.find(g => !st.groups[g]);
    if (missing) return lxErr(ctx, `useradd: group '${missing}' does not exist`) * 6;
    if (!o.g && st.groups[name]) return lxErr(ctx, `useradd: group ${name} exists - if you want to add this user to that group, use -g.`) * 9;
    const uid = lxFreeId(Object.values(st.users).map(u => u.uid));
    let gid;
    if (o.g) gid = st.groups[o.g].gid;
    else {
      const gids = Object.values(st.groups).map(g => g.gid);
      gid = gids.includes(uid) ? lxFreeId(gids) : uid;
      st.groups[name] = {gid, members: []};
    }
    const home = o.d || `/home/${name}`;
    st.users[name] = {uid, gid, gecos: o.c || '', home, shell: o.s || '/bin/sh', pw: null};
    for (const g of extra) st.groups[g].members.push(name);
    if (o.m) {
      if (lxFind(st, home)) ctx.err(`useradd: warning: the home directory ${home} already exists.`);
      else if (lxFind(st, lxParent(home))?.type === 'dir') {
        const group = lxGroupOfGid(st, gid);
        lxPut(st, home, lxDir(0o750, name, group, Date.now()));
        for (const f of ['.bash_logout', '.bashrc', '.profile']) lxPut(st, `${home}/${f}`, lxFile(LX_BASE_FILES['/home/student/' + f], 0o644, name, group, Date.now()));
      }
    }
    return 0;
  },
};

LINUX_CMDS.usermod = {
  synopsis: 'usermod [-aG GROUP,...] [-g GROUP] [-s SHELL] USER',
  run(ctx) {
    const {st} = ctx, p = lxOpts(ctx, ctx.args, 'a', 'Ggs', {append: 'a', groups: 'G', gid: 'g', shell: 's'});
    if (!p) return 2;
    if (lxNeedRoot(ctx)) return 1;
    const {o} = p, name = p.rest[0];
    if (!name) return lxErr(ctx, 'Usage: usermod [options] LOGIN') * 2;
    if (o.a && !o.G) { ctx.err('usermod: -a flag is ONLY allowed with the -G flag'); return lxErr(ctx, 'Usage: usermod [options] LOGIN') * 2; }
    if (!st.users[name]) return lxErr(ctx, `usermod: user '${name}' does not exist`) * 6;
    const groups = o.G ? o.G.split(',') : [];
    const missing = [...groups, ...(o.g ? [o.g] : [])].find(g => !st.groups[g]);
    if (missing) return lxErr(ctx, `usermod: group '${missing}' does not exist`) * 6;
    if (o.g) st.users[name].gid = st.groups[o.g].gid;
    if (o.s) st.users[name].shell = o.s;
    if (o.G) {
      if (!o.a) for (const g of Object.values(st.groups)) g.members = g.members.filter(m => m !== name);
      for (const g of groups) if (!st.groups[g].members.includes(name)) st.groups[g].members.push(name);
    }
    return 0;
  },
};

LINUX_CMDS.groupadd = {
  synopsis: 'groupadd GROUP',
  run(ctx) {
    const {st} = ctx, p = lxOpts(ctx, ctx.args, '');
    if (!p) return 2;
    if (lxNeedRoot(ctx, '/etc/group')) return 10;
    const name = p.rest[0];
    if (!name) return lxErr(ctx, 'Usage: groupadd [options] GROUP') * 2;
    if (!/^[a-z_][a-z0-9_-]*$/.test(name)) return lxErr(ctx, `groupadd: '${name}' is not a valid group name`) * 3;
    if (st.groups[name]) return lxErr(ctx, `groupadd: group '${name}' already exists`) * 9;
    st.groups[name] = {gid: lxFreeId(Object.values(st.groups).map(g => g.gid)), members: []};
    return 0;
  },
};

// passwd [USER]: root sets anyone's password; others change their own after giving the current one
LINUX_CMDS.passwd = {
  synopsis: 'passwd [USER]',
  run(ctx) {
    const {st} = ctx, p = lxOpts(ctx, ctx.args, '');
    if (!p) return 1;
    const name = p.rest[0] ?? ctx.user;
    if (!st.users[name]) return lxErr(ctx, `passwd: user '${name}' does not exist`);
    if (ctx.user !== 'root' && name !== ctx.user) return lxErr(ctx, `passwd: You may not view or modify password information for ${name}.`);
    const unchanged = (print, why) => {
      if (why) print(why, 'ln-err');
      print('passwd: Authentication token manipulation error', 'ln-err');
      print('passwd: password unchanged', 'ln-err');
      st.status = 10;
    };
    const ask = (prompt, then) => ({prompt, tries: 1, check: () => true, then, fail: () => {}});
    const retype = first => ask('Retype new password:', (print, again) => {
      if (again !== first) return unchanged(print, 'Sorry, passwords do not match.');
      st.users[name].pw = first;
      print('passwd: password updated successfully');
      st.status = 0;
    });
    const fresh = ask('New password:', (print, pw) => {
      if (!pw) return unchanged(print, 'No password has been supplied.');
      st.askPw = retype(pw);
    });
    if (ctx.user === 'root') { st.askPw = fresh; return 0; }
    ctx.out(`Changing password for ${name}.`);
    st.askPw = ask('Current password:', (print, pw) => {
      if (pw !== st.users[name].pw) return unchanged(print);
      st.askPw = fresh;
    });
    return 0;
  },
};

// ---- processes ----

const lxComm = cmd => lxBase(cmd.split(' ')[0]).replace(/^-/, '').replace(/:$/, '');
const lxRss = p => Math.round(p.mem * 40300); // KiB, on a machine with about 4 GiB of memory
const lxCpuTime = (p, long) => {
  const s = Math.round(p.cpu * 6);
  return long ? `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const lxPpid = (st, p) => (p.pid === 1 ? 0 : p.tty === 'pts/0' && p.pid !== 4101 ? 4101 : p.user === 'student' && p.pid === 4101 ? 4098 : 1);

LINUX_CMDS.ps = {
  synopsis: 'ps [aux | -ef]',
  run(ctx) {
    const {st} = ctx, style = ctx.args.join(' ');
    const self = {pid: st.nextPid++, user: ctx.user, cmd: ['ps', ...ctx.args].join(' '), cpu: 0, mem: 0.1, tty: 'pts/0', stat: 'R+', start: lxClock()};
    const all = [...st.procs, self];
    if (style === '' || style === '-e' || style === '-A') {
      ctx.out('    PID TTY          TIME CMD');
      for (const p of style ? all : all.filter(x => x.tty === 'pts/0' && x.user === ctx.user || x === self)) {
        ctx.out(`${String(p.pid).padStart(7)} ${p.tty.padEnd(8)} ${lxCpuTime(p, true)} ${lxComm(p.cmd)}`);
      }
    } else if (style === 'aux' || style === '-aux' || style === 'ax' || style === 'au') {
      ctx.out('USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND');
      for (const p of all) {
        ctx.out(`${p.user.slice(0, 8).padEnd(8)} ${String(p.pid).padStart(7)} ${p.cpu.toFixed(1).padStart(4)} ${p.mem.toFixed(1).padStart(4)} ` +
          `${String(lxRss(p) * 3 + 5000).padStart(6)} ${String(lxRss(p)).padStart(5)} ${p.tty.padEnd(8)} ${p.stat.padEnd(4)} ${p.start.padStart(5)} ` +
          `${lxCpuTime(p, false).padStart(6)} ${p.cmd}`);
      }
    } else if (style === '-ef') {
      ctx.out('UID          PID    PPID  C STIME TTY          TIME CMD');
      for (const p of all) {
        ctx.out(`${p.user.slice(0, 8).padEnd(8)} ${String(p.pid).padStart(7)} ${String(lxPpid(st, p)).padStart(7)} ${String(Math.round(p.cpu)).padStart(2)} ` +
          `${p.start.padStart(5)} ${p.tty.padEnd(8)} ${lxCpuTime(p, true)} ${p.cmd}`);
      }
    } else return lxErr(ctx, `ps: '${style}' is not available in this lab (use ps, ps aux or ps -ef)`);
    return 0;
  },
};

// shortcut: top prints one snapshot (like top -b -n 1); it does not refresh or take keys
LINUX_CMDS.top = {
  synopsis: 'top',
  run(ctx) {
    const {st} = ctx, p = lxOpts(ctx, ctx.args, 'b', 'n');
    if (!p) return 1;
    const procs = st.procs.slice().sort((a, b) => b.cpu - a.cpu || a.pid - b.pid);
    const running = procs.filter(x => x.stat.startsWith('R')).length, cpu = Math.min(99.9, procs.reduce((a, x) => a + x.cpu, 0) / 2);
    const f = (n, w) => n.toFixed(1).padStart(w);
    ctx.out(`top - ${new Date().toTimeString().slice(0, 8)} up  2:14,  1 user,  load average: ${(cpu / 50).toFixed(2)}, 0.31, 0.12`);
    ctx.out(`Tasks: ${String(procs.length).padStart(3)} total, ${String(running).padStart(3)} running, ${String(procs.length - running).padStart(3)} sleeping,   0 stopped,   0 zombie`);
    ctx.out(`%Cpu(s): ${f(cpu, 4)} us,  0.7 sy,  0.0 ni, ${f(Math.max(0, 99.3 - cpu), 4)} id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st`);
    ctx.out('MiB Mem :   3936.2 total,   2410.5 free,    612.3 used,    913.4 buff/cache');
    ctx.out('MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   3062.8 avail Mem');
    ctx.out('');
    ctx.out('    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND');
    for (const x of procs.slice(0, 15)) {
      const res = lxRss(x);
      ctx.out(`${String(x.pid).padStart(7)} ${x.user.slice(0, 8).padEnd(8)}  20   0 ${String(res * 3 + 5000).padStart(7)} ${String(res).padStart(6)} ` +
        `${String(Math.round(res / 3)).padStart(6)} ${x.stat[0]} ${f(x.cpu, 5)} ${f(x.mem, 5)} ${(lxCpuTime(x, false) + '.00').padStart(9)} ${lxComm(x.cmd)}`);
    }
    ctx.note('top shows one snapshot here; in a real terminal it refreshes until you press q');
    return 0;
  },
};

// shortcut: sleep returns at once in the foreground; with & it stays as a job (js/linux/bash.js)
LINUX_CMDS.sleep = {
  synopsis: 'sleep NUMBER[smhd]',
  run(ctx) {
    if (!ctx.args.length) { ctx.err('sleep: missing operand'); return lxErr(ctx, "Try 'sleep --help' for more information."); }
    const bad = ctx.args.find(a => !/^\d+(\.\d+)?[smhd]?$/.test(a));
    if (bad) { ctx.err(`sleep: invalid time interval ‘${bad}’`); return lxErr(ctx, "Try 'sleep --help' for more information."); }
    return 0;
  },
};

// ---- packages ----

// the Essential: yes packages apt refuses to remove (nano, cron, openssh-server and the like are ordinary packages)
const LX_ESSENTIAL = ['bash', 'coreutils', 'grep', 'findutils'];
const LX_APT_READ =['Reading package lists... Done', 'Building dependency tree... Done', 'Reading state information... Done'];
const lxKb = pkg => 20 + (pkg.length * 37) % 400; // a believable download size in kB

LINUX_CMDS.apt = {
  synopsis: 'apt update | apt install PACKAGE... | apt remove PACKAGE... | apt list --installed',
  run(ctx) {
    const {st} = ctx, p = lxOpts(ctx, ctx.args, 'y', '', {yes: 'y', installed: 'I'});
    if (!p) return 100;
    const [sub, ...pkgs] = p.rest, out = l => ctx.out(l), done = () => out('0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.');
    const lock = () => {
      ctx.err('E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)');
      ctx.err('E: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?');
      return 100;
    };
    if (!sub) { out('apt 2.7.14 (amd64)'); out('Usage: apt [options] command'); return 1; }
    if (sub === 'list') {
      if (!p.o.I) return lxErr(ctx, "apt: list without --installed is not available in this lab") * 100;
      if (!ctx.tty) { ctx.err('WARNING: apt does not have a stable CLI interface. Use with caution in scripts.'); ctx.err(''); }
      out('Listing... Done');
      for (const name of Object.keys(st.packages).sort()) out(`${name}/noble,now ${st.packages[name]} amd64 [installed]`);
      return 0;
    }
    if (sub === 'update') {
      if (ctx.user !== 'root') {
        out('Reading package lists... Done');
        ctx.err('E: Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)');
        return lxErr(ctx, 'E: Unable to lock directory /var/lib/apt/lists/') * 100;
      }
      ['Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease', 'Get:2 http://archive.ubuntu.com/ubuntu noble-updates InRelease [126 kB]',
        'Hit:3 http://archive.ubuntu.com/ubuntu noble-backports InRelease', 'Hit:4 http://security.ubuntu.com/ubuntu noble-security InRelease',
        'Fetched 126 kB in 1s (183 kB/s)', ...LX_APT_READ, 'All packages are up to date.'].forEach(out);
      st.aptUpdated = true;
      return 0;
    }
    if (sub === 'upgrade') {
      if (ctx.user !== 'root') return lock();
      ['Reading package lists... Done', 'Building dependency tree... Done', 'Reading state information... Done', 'Calculating upgrade... Done'].forEach(out);
      done();
      return 0;
    }
    if (sub !== 'install' && sub !== 'remove' && sub !== 'purge') return lxErr(ctx, `apt: '${sub}' is not available in this lab`) * 100;
    if (ctx.user !== 'root') return lock();
    LX_APT_READ.forEach(out);
    if (!pkgs.length) { done(); return 0; }
    const unknown = pkgs.find(n => !st.repo[n]);
    if (unknown) return lxErr(ctx, `E: Unable to locate package ${unknown}`) * 100;
    if (sub === 'install') {
      const fresh = pkgs.filter(n => !st.packages[n]);
      pkgs.filter(n => st.packages[n]).forEach(n => out(`${n} is already the newest version (${st.packages[n]}).`));
      if (!fresh.length) { done(); return 0; }
      const kb = fresh.reduce((a, n) => a + lxKb(n), 0);
      out('The following NEW packages will be installed:');
      out('  ' + fresh.join(' '));
      out(`0 upgraded, ${fresh.length} newly installed, 0 to remove and 0 not upgraded.`);
      out(`Need to get ${kb} kB of archives.`);
      out(`After this operation, ${kb * 3} kB of additional disk space will be used.`);
      fresh.forEach((n, i) => out(`Get:${i + 1} http://archive.ubuntu.com/ubuntu noble/universe amd64 ${n} amd64 ${st.repo[n].version} [${lxKb(n)} kB]`));
      out(`Fetched ${kb} kB in 0s (${kb * 2} kB/s)`);
      for (const n of fresh) {
        out(`Selecting previously unselected package ${n}.`);
        out('(Reading database ... 74533 files and directories currently installed.)');
        out(`Preparing to unpack .../${n}_${st.repo[n].version.replace(/^\d+:/, '')}_amd64.deb ...`);
        out(`Unpacking ${n} (${st.repo[n].version}) ...`);
      }
      for (const n of fresh) { out(`Setting up ${n} (${st.repo[n].version}) ...`); st.packages[n] = st.repo[n].version; }
      out('Processing triggers for man-db (2.12.0-4build2) ...');
      return 0;
    }
    // remove / purge: asks first, like apt, unless -y
    if (pkgs.some(n => LX_ESSENTIAL.includes(n))) {
      ctx.err('W: Removing essential system-critical packages is not permitted. This might break the system.');
      return lxErr(ctx, 'E: Removing essential system-critical packages is not permitted. This might break the system.') * 100;
    }
    pkgs.filter(n => !st.packages[n]).forEach(n => out(`Package '${n}' is not installed, so not removed`));
    const gone = pkgs.filter(n => st.packages[n]);
    if (!gone.length) { done(); return 0; }
    const kb = gone.reduce((a, n) => a + lxKb(n) * 3, 0);
    out(`The following packages will be REMOVED:`);
    out('  ' + gone.join(' '));
    out(`0 upgraded, 0 newly installed, ${gone.length} to remove and 0 not upgraded.`);
    out(`After this operation, ${kb} kB disk space will be freed.`);
    const remove = print => {
      print('(Reading database ... 74533 files and directories currently installed.)');
      for (const n of gone) { print(`Removing ${n} (${st.packages[n]}) ...`); delete st.packages[n]; }
      print('Processing triggers for man-db (2.12.0-4build2) ...');
    };
    if (p.o.y) { remove(out); return 0; }
    st.askPw = {
      prompt: 'Do you want to continue? [Y/n]', hidden: false, tries: 1, check: () => true, fail: () => {},
      then: (print, yes) => (/^(y|yes)?$/i.test(yes.trim()) ? remove(print) : print('Abort.')),
    };
    return 0;
  },
};
