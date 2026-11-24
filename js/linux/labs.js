// Linux labs: one build per topic and difficulty. A level is a function of the lab's random number x (0-255) that
// returns {sub, lead, steps, init, reqs, solution}; lxRandom(x) picks the names and values, so the task text, the
// system's set-up (init, see lxState), the requirements and the solution always agree, and Reset gives the same system.
// Requirements read the lab host's state; an answer requirement (lxAsk) is graded from what the student types.

// a seeded random source (mulberry32): the same x gives the same picks
function lxRandom(x) {
  let a = (x + 1) * 0x9E3779B9 >>> 0;
  const next = () => {
    a = a + 0x6D2B79F5 >>> 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const r = {
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: list => list[Math.floor(next() * list.length)],
    shuffle: list => list.map(v => [next(), v]).sort((p, q) => p[0] - q[0]).map(([, v]) => v),
    // n different items of a list
    some: (list, n) => r.shuffle(list).slice(0, n),
  };
  return r;
}

const LX_PROJECTS = ['atlas', 'beacon', 'comet', 'delta', 'ember', 'falcon', 'granite', 'harbor', 'iris', 'juniper'];
const LX_APPS = ['billing', 'reports', 'backup', 'mailer', 'metrics', 'gateway', 'scheduler', 'invoices'];
const LX_PEOPLE = ['anna', 'ben', 'carla', 'david', 'ema', 'filip', 'greta', 'hugo', 'iva', 'jonas'];
const LX_TEAMS = ['devs', 'ops', 'web', 'finance', 'qa', 'design', 'support', 'research'];
const LX_WORDS = ['notes', 'todo', 'budget', 'report', 'draft', 'plan', 'ideas', 'summary', 'agenda', 'contacts'];

const LX_HOME = '/home/student';
const lxShown = path => (path === LX_HOME ? '~' : path.startsWith(LX_HOME + '/') ? '~' + path.slice(LX_HOME.length) : path);
const lxHost = s => s.config('lab');
const lxNodeAt = (s, path) => lxFind(lxHost(s), path);

// ---- requirement helpers: {text, ok, hint: {cmds}}; the last argument is always the hint commands ----

const lxIsDir = (path, cmds) => ({text: `The directory ${lxShown(path)} exists`, ok: s => lxNodeAt(s, path)?.type === 'dir', hint: {cmds}});
// content: null (any file), a text, or s => text
const lxIsFile = (path, content, cmds, what) => ({
  text: what ? `${lxShown(path)} ${what}` : content === null ? `The file ${lxShown(path)} exists` : `${lxShown(path)} has the right content`,
  ok: s => {
    const n = lxNodeAt(s, path);
    return n?.type === 'file' && (content === null || lxContent(lxHost(s), n) === (typeof content === 'function' ? content(s) : content));
  },
  hint: {cmds},
});
const lxGone = (path, cmds) => ({text: `${lxShown(path)} no longer exists`, ok: s => !lxNodeAt(s, path), hint: {cmds}});
const lxModeIs = (path, mode, cmds) => ({
  text: `${lxShown(path)} has mode ${mode.toString(8)} (${lxModeString({type: 'file', mode}).slice(1)})`,
  ok: s => (lxNodeAt(s, path)?.mode & 0o7777) === mode, hint: {cmds},
});
const lxOwner = (path, user, group, cmds) => ({
  text: `${lxShown(path)} is owned by ${group ? `${user}:${group}` : user}`,
  ok: s => lxNodeAt(s, path)?.owner === user && (!group || lxNodeAt(s, path).group === group), hint: {cmds},
});
const lxCwd = (path, cmds) => ({text: `You finish in ${lxShown(path)}`, ok: s => lxHost(s).cwd === path, hint: {cmds}});
const lxUser = (name, want, cmds) => ({
  text: `User ${name} exists` + [want.home && ' with a home directory', want.shell && ` with the shell ${want.shell}`,
    want.groups && ` in the group${want.groups.length > 1 ? 's' : ''} ${want.groups.join(', ')}`, want.pw && ' with a password set'].filter(Boolean).join(','),
  ok: s => {
    const st = lxHost(s), u = st.users[name];
    return !!u && (!want.home || lxFind(st, u.home)?.type === 'dir') && (!want.shell || u.shell === want.shell) &&
      (!want.groups || want.groups.every(g => lxInGroup(st, name, g))) && (!want.pw || !!u.pw);
  },
  hint: {cmds},
});
const lxGroup = (name, cmds) => ({text: `The group ${name} exists`, ok: s => !!lxHost(s).groups[name], hint: {cmds}});
const lxPkg = (name, installed, cmds) => ({
  text: `The package ${name} is ${installed ? '' : 'not '}installed`, ok: s => !!lxHost(s).packages[name] === installed, hint: {cmds},
});
const lxNoProc = (match, cmds) => ({text: `No ${match} process is running`, ok: s => !lxHost(s).procs.some(p => p.cmd.includes(match)), hint: {cmds}});
const lxJob = (match, cmds) => ({text: `A background job runs ${match}`, ok: s => lxHost(s).jobs.some(j => j.cmd.includes(match)), hint: {cmds}});
// an answer requirement: the student finds the value in the terminal and types it (answer: a text, or a list for a set)
const lxAsk = (text, answer, cmds) => ({text, answer, hint: {cmds}});

// lines of believable log text, about bytes long
function lxLogText(r, bytes, app) {
  const lines = [];
  for (let n = 0, size = 0; size < bytes; n++) {
    const l = `Nov 24 ${String(6 + Math.floor(n / 60) % 12).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}:${String(r.int(10, 59))} lab ${app}[${r.int(900, 999)}]: ` +
      r.pick(['request served', 'job finished', 'cache refreshed', 'connection closed', 'worker started', 'config reloaded']) + ` id=${r.int(1000, 9999)}`;
    lines.push(l);
    size += l.length + 1;
  }
  return lines.join('\n') + '\n';
}

// ---- Navigation ----

const LX_NAV = {
  beginner: x => {
    const r = lxRandom(x), proj = r.pick(LX_PROJECTS), [hidden, a, b] = r.some(LX_WORDS, 3), sub = r.pick(['src', 'docs', 'config', 'assets', 'data']);
    const dir = `${LX_HOME}/${proj}`;
    return {
      sub: `Look around ~/${proj}: find its hidden file and the full path of ${sub}.`,
      lead: `Your home directory holds the project ${proj}.`,
      steps: [`List everything in ~/${proj}, hidden files too.`, `Go into ~/${proj}/${sub} and print the directory you are in.`, 'Type both answers next to the requirements.'],
      init: {dirs: [[`${dir}/${sub}`]], files: [[`${dir}/.${hidden}`, 'secret\n'], [`${dir}/${a}.txt`, ''], [`${dir}/${b}.md`, '']]},
      reqs: [
        lxAsk(`The hidden file in ~/${proj} (with its dot)`, () => `.${hidden}`, [`ls -a ~/${proj}`]),
        lxAsk(`The absolute path of ~/${proj}/${sub}`, () => `${dir}/${sub}`, [`cd ~/${proj}/${sub}`, 'pwd']),
      ],
      solution: [`ls -a ~/${proj}`, `cd ~/${proj}/${sub}`, 'pwd'],
    };
  },
  intermediate: x => {
    const r = lxRandom(x), app = r.pick(LX_APPS), owner = r.pick(LX_PEOPLE), kb = r.int(12, 90), dir = `/var/log/${app}`;
    const text = lxLogText(r, kb * 1024, app);
    return {
      sub: `Go to the log directory of ${app} and read the size and owner of its log.`,
      lead: `The ${app} service writes its log under /var/log.`,
      steps: [`Go to /var/log/${app}.`, `List it with sizes a person can read.`, `Note the size and the owner of ${app}.log.`],
      init: {
        users: {[owner]: {uid: 1001, gid: 1001, home: `/home/${owner}`}}, groups: {[owner]: {gid: 1001, members: []}},
        dirs: [[dir, {mode: 0o755, owner: 'root'}]], files: [[`${dir}/${app}.log`, text, {mode: 0o644, owner, group: owner}], [`${dir}/${app}.log.1`, 'rotated\n', {mode: 0o644, owner, group: owner}]],
      },
      reqs: [
        lxCwd(dir, [`cd ${dir}`]),
        lxAsk(`The size of ${app}.log as ls -lh shows it`, () => lxHuman(text.length), ['ls -lh']),
        lxAsk(`The owner of ${app}.log`, () => owner, ['ls -l']),
      ],
      solution: [`cd ${dir}`, 'ls -lh'],
    };
  },
  advanced: x => {
    const r = lxRandom(x), proj = r.pick(LX_PROJECTS), sub = r.pick(['api', 'web', 'cli', 'core']), files = r.some(LX_WORDS, r.int(2, 4));
    const hidden = r.some(['.env', '.gitignore', '.editorconfig'], r.int(1, 2)), base = `${LX_HOME}/${proj}`;
    return {
      sub: `Move between directories of ${proj} with relative paths, and count what is in docs.`,
      lead: `You start deep inside the project, in ~/${proj}/src/${sub}.`,
      steps: [`From ~/${proj}/src/${sub}, go to ~/${proj}/docs with a relative path (..).`, 'Count every entry in docs, hidden ones too, but not . and ..'],
      init: {
        cwd: `${base}/src/${sub}`, dirs: [[`${base}/src/${sub}`], [`${base}/docs`]],
        files: [[`${base}/src/${sub}/main.c`, 'int main(void) { return 0; }\n'], ...files.map(f => [`${base}/docs/${f}.md`, `# ${f}\n`]), ...hidden.map(h => [`${base}/docs/${h}`, ''])],
      },
      reqs: [
        lxCwd(`${base}/docs`, ['cd ../../docs']),
        lxAsk('How many entries are in docs (hidden ones included)?', () => String(files.length + hidden.length), ['ls -A']),
      ],
      solution: ['cd ../../docs', 'ls -A'],
    };
  },
  expert: x => {
    const r = lxRandom(x), user = r.pick(LX_PEOPLE), app = r.pick(LX_APPS), [big, ...rest] = r.some(LX_WORDS, 4);
    const home = `/home/${user}`, dir = `${home}/reports`, sizes = rest.map(() => r.int(200, 1800)), bigSize = r.int(2500, 6000);
    return {
      sub: `Visit ${user}'s reports with ~${user}, find the largest file (hidden ones too), and come back with cd -.`,
      lead: `You start in /srv/${app}. ${user} keeps reports in a home directory you may read.`,
      steps: [`Go to ~${user}/reports.`, 'Find the largest file there; a hidden file counts too.', 'Go to /tmp, then come back to the reports with cd -.'],
      init: {
        cwd: `/srv/${app}`, users: {[user]: {uid: 1001, gid: 1001, home}}, groups: {[user]: {gid: 1001, members: []}},
        dirs: [[`/srv/${app}`, {owner: 'root', mode: 0o755}], [home, {owner: user, mode: 0o755}], [dir, {owner: user, mode: 0o755}]],
        files: [[`${dir}/.${big}.bak`, 'x'.repeat(bigSize), {owner: user, mode: 0o644}], ...rest.map((f, i) => [`${dir}/${f}.csv`, 'y'.repeat(sizes[i]), {owner: user, mode: 0o644}])],
      },
      reqs: [
        lxCwd(dir, [`cd ~${user}/reports`, 'cd /tmp', 'cd -']),
        lxAsk(`The largest file in ~${user}/reports`, () => `.${big}.bak`, ['ls -lah']),
      ],
      solution: [`cd ~${user}/reports`, 'ls -lah', 'cd /tmp', 'cd -'],
    };
  },
};

// ---- Files and directories ----

const LX_FILES = {
  beginner: x => {
    const r = lxRandom(x), proj = r.pick(LX_PROJECTS), [a, b] = r.some(LX_WORDS, 2), dir = `${LX_HOME}/${proj}`;
    return {
      sub: `Make a project directory ${proj} with two empty files in it.`,
      lead: 'You start in your home directory.',
      steps: [`Create the directory ~/${proj}.`, `Create the empty files ${a}.txt and ${b}.txt inside it.`],
      init: {},
      reqs: [lxIsDir(dir, [`mkdir ${proj}`]), lxIsFile(`${dir}/${a}.txt`, null, [`touch ${proj}/${a}.txt`]), lxIsFile(`${dir}/${b}.txt`, null, [`touch ${proj}/${b}.txt`])],
      solution: [`mkdir ${proj}`, `touch ${proj}/${a}.txt ${proj}/${b}.txt`],
    };
  },
  intermediate: x => {
    const r = lxRandom(x), proj = r.pick(LX_PROJECTS), file = r.pick(['hosts', 'hostname', 'os-release']), logs = `${LX_HOME}/${proj}/logs`;
    return {
      sub: `Set up ~/${proj}/logs and keep a copy of /etc/${file} there as ${file}.bak.`,
      lead: 'You start in your home directory.',
      steps: [`Create ~/${proj}/logs in one command.`, `Copy /etc/${file} into it.`, `Rename the copy to ${file}.bak.`],
      init: {},
      reqs: [
        lxIsDir(logs, [`mkdir -p ${proj}/logs`]),
        lxIsFile(`${logs}/${file}.bak`, s => lxContent(lxHost(s), lxFind(lxHost(s), `/etc/${file}`)),
          [`cp /etc/${file} ${proj}/logs/`, `mv ${proj}/logs/${file} ${proj}/logs/${file}.bak`], `is a copy of /etc/${file}`),
        lxGone(`${logs}/${file}`, [`mv ${proj}/logs/${file} ${proj}/logs/${file}.bak`]),
      ],
      solution: [`mkdir -p ${proj}/logs`, `cp /etc/${file} ${proj}/logs/`, `mv ${proj}/logs/${file} ${proj}/logs/${file}.bak`],
    };
  },
  advanced: x => {
    const r = lxRandom(x), proj = r.pick(LX_PROJECTS), [a, b] = r.some(['main', 'util', 'parser', 'server', 'client', 'config'], 2);
    const base = `${LX_HOME}/${proj}`, backup = `${LX_HOME}/${proj}-backup`, codeA = `/* ${a}.c */\nint ${a}(void);\n`, codeB = `/* ${b}.c */\nint ${b}(void);\n`;
    return {
      sub: `Back up the sources of ${proj}, then clean up the project.`,
      lead: `~/${proj} has a src directory, an empty old directory and a stray build.log.`,
      steps: [`Copy the whole ~/${proj}/src directory to ~/${proj}-backup.`, `Delete ~/${proj}/build.log.`, `Remove the empty directory ~/${proj}/old.`],
      init: {dirs: [[`${base}/src`], [`${base}/old`]], files: [[`${base}/src/${a}.c`, codeA], [`${base}/src/${b}.c`, codeB], [`${base}/build.log`, 'make: *** [all] Error 2\n']]},
      reqs: [
        lxIsFile(`${backup}/${a}.c`, codeA, [`cp -r ${proj}/src ${proj}-backup`], `is in the backup`),
        lxIsFile(`${backup}/${b}.c`, codeB, [`cp -r ${proj}/src ${proj}-backup`], `is in the backup`),
        lxGone(`${base}/build.log`, [`rm ${proj}/build.log`]),
        lxGone(`${base}/old`, [`rmdir ${proj}/old`]),
      ],
      solution: [`cp -r ${proj}/src ${proj}-backup`, `rm ${proj}/build.log`, `rmdir ${proj}/old`],
    };
  },
  expert: x => {
    const r = lxRandom(x), images = r.some(['beach', 'team', 'logo', 'office', 'party', 'cat', 'map'], 3).map(n => `${n}.jpg`);
    const docs = r.some(['invoice', 'contract', 'manual', 'cv', 'offer'], 2).map(n => `${n}.pdf`), texts = r.some(LX_WORDS, 2).map(n => `${n}.txt`);
    const inbox = `${LX_HOME}/inbox`, sorted = `${LX_HOME}/sorted`;
    const all = [...images, ...docs, ...texts];
    return {
      sub: 'Sort the files in ~/inbox by type, then delete the inbox.',
      lead: '~/inbox is full of pictures, PDFs and notes, plus a hidden file nobody needs.',
      steps: ['Create ~/sorted/images and ~/sorted/docs in one command.', 'Move every .jpg into images and every .pdf into docs, using globs.',
        'Move the .txt files into ~/sorted itself.', 'Delete ~/inbox with everything still in it.'],
      init: {dirs: [[inbox]], files: [...all.map(f => [`${inbox}/${f}`, `${f}\n`]), [`${inbox}/.DS_Store`, 'junk\n']]},
      reqs: [
        ...images.map(f => lxIsFile(`${sorted}/images/${f}`, `${f}\n`, ['mkdir -p sorted/images sorted/docs', 'mv inbox/*.jpg sorted/images/'], 'is in images')),
        ...docs.map(f => lxIsFile(`${sorted}/docs/${f}`, `${f}\n`, ['mkdir -p sorted/images sorted/docs', 'mv inbox/*.pdf sorted/docs/'], 'is in docs')),
        ...texts.map(f => lxIsFile(`${sorted}/${f}`, `${f}\n`, ['mv inbox/*.txt sorted/'], 'is in ~/sorted')),
        lxGone(inbox, ['rm -rf inbox']),
      ],
      solution: ['mkdir -p sorted/images sorted/docs', 'mv inbox/*.jpg sorted/images/', 'mv inbox/*.pdf sorted/docs/', 'mv inbox/*.txt sorted/', 'rm -rf inbox'],
    };
  },
};

const LINUX_LABS = {
  'lx-nav': {levels: LX_NAV},
  'lx-files': {levels: LX_FILES},
};

// a level of a Linux topic built for the random number x, in the shape createSession (js/session.js) expects
function lxLab(T, level, x) {
  const L = level(x);
  return {
    sub: L.sub, lead: `${L.lead} You are logged in as student (password: ${LX_PASSWORD}).`, steps: L.steps, reqs: L.reqs,
    solution: [['lab', L.solution]], home: 'lab', links: [],
    nodes: [{id: 'lab', type: 'linux', sub: 'Ubuntu 24.04', init: L.init}],
  };
}
