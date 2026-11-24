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

// ---- Viewing files ----

const lxEventLines = (r, n, app) => Array.from({length: n}, (_, i) =>
  `2026-11-24 ${String(8 + Math.floor(i / 30)).padStart(2, '0')}:${String((i * 2) % 60).padStart(2, '0')} ${app} ${r.pick(['started', 'stopped', 'retry', 'ok', 'queued'])} job=${r.int(100, 999)}`);

const LX_VIEW = {
  beginner: x => {
    const r = lxRandom(x), word = r.pick(LX_WORDS), app = r.pick(LX_APPS), n = r.int(14, 60), dir = `/var/log/${app}`;
    const phrase = `${r.pick(['deploy', 'backup', 'meeting', 'release', 'update'])} at ${r.int(8, 19)}:${r.pick(['00', '15', '30', '45'])}`;
    return {
      sub: `Write a note with echo, then count the lines of the ${app} log.`,
      lead: `The ${app} service logs to ${dir}/${app}.log.`,
      steps: [`Write the line "${phrase}" into a new file ~/${word}.txt.`, `Count the lines of ${dir}/${app}.log.`],
      init: {dirs: [[dir, {owner: 'root', mode: 0o755}]], files: [[`${dir}/${app}.log`, lxEventLines(r, n, app).join('\n') + '\n', {owner: 'root', mode: 0o644}]]},
      reqs: [
        lxIsFile(`${LX_HOME}/${word}.txt`, `${phrase}\n`, [`echo "${phrase}" > ${word}.txt`], `holds the line "${phrase}"`),
        lxAsk(`How many lines does ${app}.log have?`, () => String(n), [`wc -l ${dir}/${app}.log`]),
      ],
      solution: [`echo "${phrase}" > ${word}.txt`, `wc -l ${dir}/${app}.log`],
    };
  },
  intermediate: x => {
    const r = lxRandom(x), app = r.pick(LX_APPS), lines = lxEventLines(r, r.int(25, 50), app), k = r.int(2, 6), path = `/var/log/${app}/events.log`;
    return {
      sub: `Read the start and the end of the ${app} event log.`,
      lead: `${path} grows all day; you only need its first lines and its newest one.`,
      steps: [`Show the first ${k} lines of ${path}.`, 'Show only its last line.', 'Type the answers next to the requirements.'],
      init: {dirs: [[`/var/log/${app}`, {owner: 'root', mode: 0o755}]], files: [[path, lines.join('\n') + '\n', {owner: 'root', mode: 0o644}]]},
      reqs: [
        lxAsk(`Line ${k} of events.log`, () => lines[k - 1], [`head -n ${k} ${path}`]),
        lxAsk('The last line of events.log', () => lines.at(-1), [`tail -n 1 ${path}`]),
      ],
      solution: [`head -n ${k} ${path}`, `tail -n 1 ${path}`],
    };
  },
  advanced: x => {
    const r = lxRandom(x), app = r.pick(LX_APPS), port = r.int(2000, 9999), word = r.pick(LX_WORDS);
    const conf = `/etc/${app}/${app}.conf`, text = `# ${app} settings\nname = ${app}\nport = ${port}\nworkers = ${r.int(2, 16)}\nlog = /var/log/${app}\n`;
    const note = `${LX_HOME}/${word}.txt`, first = `${app} notes\n`, line = `port ${port} checked`;
    return {
      sub: `Read the ${app} settings, count a file, and add a line to your notes.`,
      lead: `The settings of ${app} are in ${conf}; your notes are in ~/${word}.txt.`,
      steps: [`Open ${conf} with less and find the port.`, `Count the words and the bytes of ${conf}.`, `Add the line "${line}" to the end of ~/${word}.txt.`],
      init: {dirs: [[`/etc/${app}`, {owner: 'root', mode: 0o755}]], files: [[conf, text, {owner: 'root', mode: 0o644}], [note, first]]},
      reqs: [
        lxAsk(`The port in ${app}.conf`, () => String(port), [`less ${conf}`]),
        lxAsk(`How many words are in ${app}.conf?`, () => String(text.split(/\s+/).filter(Boolean).length), [`wc -w ${conf}`]),
        lxAsk(`How many bytes is ${app}.conf?`, () => String(text.length), [`wc -c ${conf}`]),
        lxIsFile(note, first + line + '\n', [`echo "${line}" >> ${word}.txt`], `ends with the line "${line}"`),
      ],
      solution: [`less ${conf}`, `wc -w ${conf}`, `wc -c ${conf}`, `echo "${line}" >> ${word}.txt`],
    };
  },
  expert: x => {
    const r = lxRandom(x), app = r.pick(LX_APPS), people = r.some(LX_PEOPLE, 4), codes = Array.from({length: r.int(4, 9)}, () => r.int(400, 599));
    const dir = `/var/log/${app}`, csv = `/srv/${app}/users.csv`, logs = {access: r.int(10, 40), error: codes.length, worker: r.int(5, 25)};
    const text = {
      access: lxEventLines(r, logs.access, app), error: codes.map((c, i) => `2026-11-24 09:${String(i * 3).padStart(2, '0')} error code=${c}`),
      worker: lxEventLines(r, logs.worker, app + '-worker'),
    };
    return {
      sub: `Collect three facts about ${app} from its files.`,
      lead: `${app} keeps a user list in ${csv} and three logs in ${dir}.`,
      steps: ['Find the first user in users.csv (the line after the header).', 'Find the code of the newest error in error.log.', `Count the lines of all the .log files in ${dir} together.`],
      init: {
        dirs: [[dir, {owner: 'root', mode: 0o755}], [`/srv/${app}`, {owner: 'root', mode: 0o755}]],
        files: [[csv, 'name,role\n' + people.map((p, i) => `${p},${i ? 'user' : 'admin'}`).join('\n') + '\n', {owner: 'root', mode: 0o644}],
          ...Object.keys(logs).map(k => [`${dir}/${k}.log`, text[k].join('\n') + '\n', {owner: 'root', mode: 0o644}])],
      },
      reqs: [
        lxAsk('The first user in users.csv', () => people[0], [`head -n 2 ${csv}`]),
        lxAsk('The code of the newest error', () => String(codes.at(-1)), [`tail -n 1 ${dir}/error.log`]),
        lxAsk(`The total number of lines in ${dir}/*.log`, () => String(logs.access + logs.error + logs.worker), [`wc -l ${dir}/*.log`]),
      ],
      solution: [`head -n 2 ${csv}`, `tail -n 1 ${dir}/error.log`, `wc -l ${dir}/*.log`],
    };
  },
};

// ---- Searching ----

const LX_SEARCH = {
  beginner: x => {
    const r = lxRandom(x), app = r.pick(LX_APPS), word = r.pick(['ERROR', 'WARNING', 'denied', 'timeout']), path = `/var/log/${app}/${app}.log`;
    const lines = lxEventLines(r, r.int(30, 60), app), hits = r.int(3, 9);
    for (const i of r.some(lines.map((_, i) => i), hits)) lines[i] += ` ${word} ${r.pick(['disk full', 'no reply', 'bad token', 'retry later'])}`;
    return {
      sub: `Count how often ${word} appears in the ${app} log.`,
      lead: `Something is wrong with ${app}; its log is ${path}.`,
      steps: [`Search ${path} for ${word}.`, 'Count the matching lines.'],
      init: {dirs: [[`/var/log/${app}`, {owner: 'root', mode: 0o755}]], files: [[path, lines.join('\n') + '\n', {owner: 'root', mode: 0o644}]]},
      reqs: [lxAsk(`How many lines of ${app}.log contain ${word}?`, () => String(hits), [`grep -c ${word} ${path}`])],
      solution: [`grep ${word} ${path}`, `grep -c ${word} ${path}`],
    };
  },
  intermediate: x => {
    const r = lxRandom(x), app = r.pick(LX_APPS), path = `/var/log/${app}/${app}.log`, lines = lxEventLines(r, r.int(30, 60), app);
    const at = r.int(5, lines.length - 1), spelled = r.pick(['TIMEOUT', 'Timeout', 'TimeOut']);
    lines[at - 1] = `2026-11-24 13:37 ${app} ${spelled} waiting for the database`;
    return {
      sub: `Find on which line of the ${app} log the timeout is, whatever its case.`,
      lead: `${path} has one timeout in it, but nobody knows how it is spelled.`,
      steps: ['Search for timeout, ignoring upper and lower case.', 'Show line numbers with the matches.'],
      init: {dirs: [[`/var/log/${app}`, {owner: 'root', mode: 0o755}]], files: [[path, lines.join('\n') + '\n', {owner: 'root', mode: 0o644}]]},
      reqs: [lxAsk('The line number of the timeout', () => String(at), [`grep -in timeout ${path}`])],
      solution: [`grep -in timeout ${path}`],
    };
  },
  advanced: x => {
    const r = lxRandom(x), app = r.pick(LX_APPS), key = r.pick(['db_password', 'api_token', 'smtp_host', 'cache_ttl']), dir = `/etc/${app}`;
    const names = r.some(['main', 'db', 'mail', 'cache', 'auth', 'extra', 'local'], 5), withKey = names.slice(0, r.int(2, 3));
    const files = names.map((n, i) => [`${dir}/${i % 2 ? 'conf.d/' : ''}${n}${i === 4 ? '.ini' : '.conf'}`, `# ${n}\n${withKey.includes(n) ? `${key} = x${r.int(10, 99)}\n` : ''}enabled = yes\n`]);
    return {
      sub: `Find which ${app} settings files mention ${key}, and list its .conf files.`,
      lead: `${dir} holds the settings of ${app}, some of them in conf.d.`,
      steps: [`List the files under ${dir} that contain ${key}.`, `List every .conf file under ${dir} with find.`, 'Type full paths, separated by spaces.'],
      init: {dirs: [[`${dir}/conf.d`, {owner: 'root', mode: 0o755}]], files: files.map(([p, t]) => [p, t, {owner: 'root', mode: 0o644}])},
      reqs: [
        lxAsk(`The files that contain ${key}`, () => files.filter(([, t]) => t.includes(key)).map(([p]) => p), [`grep -rl ${key} ${dir}`]),
        lxAsk(`The .conf files under ${dir}`, () => files.map(([p]) => p).filter(p => p.endsWith('.conf')), [`find ${dir} -name '*.conf'`]),
      ],
      solution: [`grep -rl ${key} ${dir}`, `find ${dir} -name '*.conf'`],
    };
  },
  expert: x => {
    const r = lxRandom(x), app = r.pick(LX_APPS), dir = `/var/tmp/${app}`, limit = r.pick([20, 50, 100]);
    const names = r.some(['cache', 'dump', 'core', 'export', 'session', 'thumb', 'index', 'old'], 6);
    const big = names.slice(0, 3), small = names.slice(3);
    const conf = `/etc/${app}.conf`, settings = r.some(['port = 8080', 'workers = 4', 'debug = no', 'timeout = 30', 'user = www-data', 'log = on'], r.int(3, 6));
    const confText = `# ${app}\n` + settings.flatMap(s => [`# ${s.split(' ')[0]}`, s]).join('\n') + '\n';
    return {
      sub: `Free space in ${dir}: delete the files over ${limit} KiB, keep the rest. Then count the real settings in ${conf}.`,
      lead: `${dir} is full of temporary files of ${app}, some of them large.`,
      steps: [`Find the files in ${dir} bigger than ${limit}k.`, 'Delete those, and only those.', `Count the lines of ${conf} that are not comments (comments start with #).`],
      init: {
        dirs: [[dir]],
        files: [...big.map(n => [`${dir}/${n}.tmp`, 'z'.repeat((limit + r.int(5, 200)) * 1024)]), ...small.map(n => [`${dir}/${n}.tmp`, 'z'.repeat(r.int(1, limit - 5) * 1024)]),
          [conf, confText, {owner: 'root', mode: 0o644}]],
      },
      reqs: [
        ...big.map(n => lxGone(`${dir}/${n}.tmp`, [`find ${dir} -type f -size +${limit}k -delete`])),
        ...small.map(n => lxIsFile(`${dir}/${n}.tmp`, null, [`find ${dir} -type f -size +${limit}k`], 'is kept')),
        lxAsk(`How many lines of ${conf} are not comments?`, () => String(settings.length), [`grep -vc '^#' ${conf}`]),
      ],
      solution: [`find ${dir} -type f -size +${limit}k`, `find ${dir} -type f -size +${limit}k -delete`, `grep -vc '^#' ${conf}`],
    };
  },
};

// ---- Pipes and redirection ----

const LX_PIPES = {
  beginner: x => {
    const r = lxRandom(x), word = r.pick(LX_WORDS), [a, b] = r.some(['milk', 'bread', 'coffee', 'apples', 'rice', 'tea', 'cheese'], 2), file = `${LX_HOME}/${word}.txt`;
    return {
      sub: `Build the file ~/${word}.txt line by line with > and >>.`,
      lead: 'You start in your home directory.',
      steps: [`Write the line "${a}" into ~/${word}.txt with >.`, `Add the line "${b}" to it with >>.`],
      init: {},
      reqs: [lxIsFile(file, `${a}\n${b}\n`, [`echo ${a} > ${word}.txt`, `echo ${b} >> ${word}.txt`], `holds the two lines ${a} and ${b}`)],
      solution: [`echo ${a} > ${word}.txt`, `echo ${b} >> ${word}.txt`],
    };
  },
  intermediate: x => {
    const r = lxRandom(x), proj = r.pick(LX_PROJECTS), names = r.some(LX_PEOPLE, 5);
    const visits = r.shuffle([...names, ...r.some(names, 3), ...r.some(names, 2)]), dir = `${LX_HOME}/${proj}`;
    return {
      sub: `Turn the visitor list of ${proj} into a sorted list of unique names.`,
      lead: `~/${proj}/visitors.txt has one name per visit, so most names repeat.`,
      steps: ['Sort visitors.txt and drop the repeated names in one pipeline.', `Save the result as ~/${proj}/unique.txt.`],
      init: {files: [[`${dir}/visitors.txt`, visits.join('\n') + '\n']]},
      reqs: [lxIsFile(`${dir}/unique.txt`, [...new Set(names)].sort(lxCollate).join('\n') + '\n', [`sort ${proj}/visitors.txt | uniq > ${proj}/unique.txt`], 'lists every visitor once, sorted')],
      solution: [`sort ${proj}/visitors.txt | uniq > ${proj}/unique.txt`],
    };
  },
  advanced: x => {
    const r = lxRandom(x), user = r.pick(LX_PEOPLE), missing = `/srv/${r.pick(LX_PROJECTS)}`;
    return {
      sub: 'Save a sorted list of the system\'s user names, and save an error message.',
      lead: `The user ${user} was added to this system today. The directory ${missing} was not.`,
      steps: ['Take the first field of /etc/passwd (fields are split by :), sort it, and save it as ~/users.txt.',
        `Run ls ${missing} and save only its error message in ~/errors.txt.`],
      init: {users: {[user]: {uid: 1001, gid: 1001, home: `/home/${user}`, shell: '/bin/bash'}}, groups: {[user]: {gid: 1001, members: []}}},
      reqs: [
        lxIsFile(`${LX_HOME}/users.txt`, s => lxLines(lxContent(lxHost(s), lxFind(lxHost(s), '/etc/passwd'))).map(l => l.split(':')[0]).sort(lxCollate).join('\n') + '\n',
          ['cut -d: -f1 /etc/passwd | sort > users.txt'], 'lists the user names, sorted'),
        lxIsFile(`${LX_HOME}/errors.txt`, `ls: cannot access '${missing}': No such file or directory\n`, [`ls ${missing} 2> errors.txt`], 'holds the error message of ls'),
      ],
      solution: ['cut -d: -f1 /etc/passwd | sort > users.txt', `ls ${missing} 2> errors.txt`],
    };
  },
  expert: x => {
    const r = lxRandom(x), app = r.pick(LX_APPS), log = `/var/log/${app}/access.log`;
    const ips = r.some(['10.0.0.5', '10.0.0.17', '10.0.3.2', '192.168.1.20', '192.168.1.44', '172.16.0.9', '172.16.4.1'], 5);
    const counts = r.shuffle([2, 3, 5, 8, 12, 13, 20]).slice(0, 5); // all different, so the order of the top 3 is clear
    const lines = r.shuffle(ips.flatMap((ip, i) => Array.from({length: counts[i]}, () =>
      `${ip} - - [24/Nov/2026:10:${String(r.int(0, 59)).padStart(2, '0')}:00 +0000] "GET /${r.pick(['', 'login', 'api/items', 'img/logo.png'])} HTTP/1.1" 200 ${r.int(200, 9000)}`)));
    const top = ips.map((ip, i) => [counts[i], ip]).sort((p, q) => q[0] - p[0]).slice(0, 3);
    return {
      sub: `Find the three addresses that visited ${app} most, with a pipeline.`,
      lead: `${log} has one line per request; the client address is the first field (fields are split by spaces).`,
      steps: ['Cut out the address of every line.', 'Sort them, count them with uniq -c, and sort the counts from the highest.', 'Keep the top three lines and save them as ~/top.txt.'],
      init: {dirs: [[`/var/log/${app}`, {owner: 'root', mode: 0o755}]], files: [[log, lines.join('\n') + '\n', {owner: 'root', mode: 0o644}]]},
      reqs: [lxIsFile(`${LX_HOME}/top.txt`, top.map(([n, ip]) => `${String(n).padStart(7)} ${ip}`).join('\n') + '\n',
        [`cut -d' ' -f1 ${log} | sort | uniq -c | sort -rn | head -n 3 > top.txt`], 'holds the top three addresses with their counts')],
      solution: [`cut -d' ' -f1 ${log} | sort | uniq -c | sort -rn | head -n 3 > top.txt`],
    };
  },
};

const LINUX_LABS = {
  'lx-nav': {levels: LX_NAV},
  'lx-files': {levels: LX_FILES},
  'lx-view': {levels: LX_VIEW},
  'lx-search': {levels: LX_SEARCH},
  'lx-pipes': {levels: LX_PIPES},
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
