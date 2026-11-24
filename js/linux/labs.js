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

const lxIsDir = (path, cmds) => ({text: L(`The directory ${lxShown(path)} exists`, `Adresář ${lxShown(path)} existuje`), ok: s => lxNodeAt(s, path)?.type === 'dir', hint: {cmds}});
// content: null (any file), a text, or s => text
const lxIsFile = (path, content, cmds, what) => ({
  text: what ? `${lxShown(path)} ${what}` : content === null ? L(`The file ${lxShown(path)} exists`, `Soubor ${lxShown(path)} existuje`)
    : L(`${lxShown(path)} has the right content`, `${lxShown(path)} má správný obsah`),
  ok: s => {
    const n = lxNodeAt(s, path);
    return n?.type === 'file' && (content === null || lxContent(lxHost(s), n) === (typeof content === 'function' ? content(s) : content));
  },
  hint: {cmds},
});
const lxGone = (path, cmds) => ({text: L(`${lxShown(path)} no longer exists`, `${lxShown(path)} už neexistuje`), ok: s => !lxNodeAt(s, path), hint: {cmds}});
const lxModeIs = (path, mode, cmds) => ({
  text: L(`${lxShown(path)} has mode ${mode.toString(8)} (${lxModeString({type: 'file', mode}).slice(1)})`,
    `${lxShown(path)} má režim ${mode.toString(8)} (${lxModeString({type: 'file', mode}).slice(1)})`),
  ok: s => (lxNodeAt(s, path)?.mode & 0o7777) === mode, hint: {cmds},
});
const lxOwner = (path, user, group, cmds) => ({
  text: L(`${lxShown(path)} is owned by ${group ? `${user}:${group}` : user}`, `${lxShown(path)} vlastní ${group ? `${user}:${group}` : user}`),
  ok: s => lxNodeAt(s, path)?.owner === user && (!group || lxNodeAt(s, path).group === group), hint: {cmds},
});
const lxCwd = (path, cmds) => ({text: L(`You finish in ${lxShown(path)}`, `Skončíš v ${lxShown(path)}`), ok: s => lxHost(s).cwd === path, hint: {cmds}});
const lxUser = (name, want, cmds) => ({
  text: L(`User ${name} exists`, `Uživatel ${name} existuje`) + [want.home && L(' with a home directory', ' s domovským adresářem'),
    want.shell && L(` with the shell ${want.shell}`, ` se shellem ${want.shell}`),
    want.groups && L(` in the group${want.groups.length > 1 ? 's' : ''} ${want.groups.join(', ')}`, ` ve ${want.groups.length > 1 ? 'skupinách' : 'skupině'} ${want.groups.join(', ')}`),
    want.pw && L(' with a password set', ' s nastaveným heslem')].filter(Boolean).join(','),
  ok: s => {
    const st = lxHost(s), u = st.users[name];
    return !!u && (!want.home || lxFind(st, u.home)?.type === 'dir') && (!want.shell || u.shell === want.shell) &&
      (!want.groups || want.groups.every(g => lxInGroup(st, name, g))) && (!want.pw || !!u.pw);
  },
  hint: {cmds},
});
const lxGroup = (name, cmds) => ({text: L(`The group ${name} exists`, `Skupina ${name} existuje`), ok: s => !!lxHost(s).groups[name], hint: {cmds}});
const lxPkg = (name, installed, cmds) => ({
  text: L(`The package ${name} is ${installed ? '' : 'not '}installed`, `Balíček ${name} ${installed ? 'je' : 'není'} nainstalovaný`), ok: s => !!lxHost(s).packages[name] === installed, hint: {cmds},
});
const lxNoProc = (match, cmds) => ({text: L(`No ${match} process is running`, `Neběží žádný proces ${match}`), ok: s => !lxHost(s).procs.some(p => p.cmd.includes(match)), hint: {cmds}});
const lxJob = (match, cmds) => ({text: L(`A background job runs ${match}`, `Na pozadí běží úloha ${match}`), ok: s => lxHost(s).jobs.some(j => j.cmd.includes(match)), hint: {cmds}});
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
      sub: L(`Look around ~/${proj}: find its hidden file and the full path of ${sub}.`, `Rozhlédni se v ~/${proj}: najdi jeho skrytý soubor a celou cestu k ${sub}.`),
      lead: L(`Your home directory holds the project ${proj}.`, `Ve tvém domovském adresáři je projekt ${proj}.`),
      steps: [L(`List everything in ~/${proj}, hidden files too.`, `Vypiš všechno v ~/${proj}, i skryté soubory.`), L(`Go into ~/${proj}/${sub} and print the directory you are in.`, `Přejdi do ~/${proj}/${sub} a vypiš adresář, ve kterém jsi.`), L('Type both answers next to the requirements.', 'Napiš obě odpovědi k požadavkům.')],
      init: {dirs: [[`${dir}/${sub}`]], files: [[`${dir}/.${hidden}`, 'secret\n'], [`${dir}/${a}.txt`, ''], [`${dir}/${b}.md`, '']]},
      reqs: [
        lxAsk(L(`The hidden file in ~/${proj} (with its dot)`, `Skrytý soubor v ~/${proj} (i s tečkou)`), () => `.${hidden}`, [`ls -a ~/${proj}`]),
        lxAsk(L(`The absolute path of ~/${proj}/${sub}`, `Absolutní cesta k ~/${proj}/${sub}`), () => `${dir}/${sub}`, [`cd ~/${proj}/${sub}`, 'pwd']),
      ],
      solution: [`ls -a ~/${proj}`, `cd ~/${proj}/${sub}`, 'pwd'],
    };
  },
  intermediate: x => {
    const r = lxRandom(x), app = r.pick(LX_APPS), owner = r.pick(LX_PEOPLE), kb = r.int(12, 90), dir = `/var/log/${app}`;
    const text = lxLogText(r, kb * 1024, app);
    return {
      sub: L(`Go to the log directory of ${app} and read the size and owner of its log.`, `Přejdi do adresáře s logy služby ${app} a zjisti velikost a vlastníka jejího logu.`),
      lead: L(`The ${app} service writes its log under /var/log.`, `Služba ${app} zapisuje svůj log pod /var/log.`),
      steps: [L(`Go to /var/log/${app}.`, `Přejdi do /var/log/${app}.`), L(`List it with sizes a person can read.`, `Vypiš ho s velikostmi čitelnými pro člověka.`), L(`Note the size and the owner of ${app}.log.`, `Zjisti velikost a vlastníka ${app}.log.`)],
      init: {
        users: {[owner]: {uid: 1001, gid: 1001, home: `/home/${owner}`}}, groups: {[owner]: {gid: 1001, members: []}},
        dirs: [[dir, {mode: 0o755, owner: 'root'}]], files: [[`${dir}/${app}.log`, text, {mode: 0o644, owner, group: owner}], [`${dir}/${app}.log.1`, 'rotated\n', {mode: 0o644, owner, group: owner}]],
      },
      reqs: [
        lxCwd(dir, [`cd ${dir}`]),
        lxAsk(L(`The size of ${app}.log as ls -lh shows it`, `Velikost ${app}.log, jak ji ukazuje ls -lh`), () => lxHuman(text.length), ['ls -lh']),
        lxAsk(L(`The owner of ${app}.log`, `Vlastník ${app}.log`), () => owner, ['ls -l']),
      ],
      solution: [`cd ${dir}`, 'ls -lh'],
    };
  },
  advanced: x => {
    const r = lxRandom(x), proj = r.pick(LX_PROJECTS), sub = r.pick(['api', 'web', 'cli', 'core']), files = r.some(LX_WORDS, r.int(2, 4));
    const hidden = r.some(['.env', '.gitignore', '.editorconfig'], r.int(1, 2)), base = `${LX_HOME}/${proj}`;
    return {
      sub: L(`Move between directories of ${proj} with relative paths, and count what is in docs.`, `Pohybuj se mezi adresáři projektu ${proj} relativními cestami a spočítej, co je v docs.`),
      lead: L(`You start deep inside the project, in ~/${proj}/src/${sub}.`, `Začínáš hluboko v projektu, v ~/${proj}/src/${sub}.`),
      steps: [L(`From ~/${proj}/src/${sub}, go to ~/${proj}/docs with a relative path (..).`, `Z ~/${proj}/src/${sub} přejdi do ~/${proj}/docs relativní cestou (..).`), L('Count every entry in docs, hidden ones too, but not . and ..', 'Spočítej všechny položky v docs, i skryté, ale ne . a ..')],
      init: {
        cwd: `${base}/src/${sub}`, dirs: [[`${base}/src/${sub}`], [`${base}/docs`]],
        files: [[`${base}/src/${sub}/main.c`, 'int main(void) { return 0; }\n'], ...files.map(f => [`${base}/docs/${f}.md`, `# ${f}\n`]), ...hidden.map(h => [`${base}/docs/${h}`, ''])],
      },
      reqs: [
        lxCwd(`${base}/docs`, ['cd ../../docs']),
        lxAsk(L('How many entries are in docs (hidden ones included)?', 'Kolik položek je v docs (včetně skrytých)?'), () => String(files.length + hidden.length), ['ls -A']),
      ],
      solution: ['cd ../../docs', 'ls -A'],
    };
  },
  expert: x => {
    const r = lxRandom(x), user = r.pick(LX_PEOPLE), app = r.pick(LX_APPS), [big, ...rest] = r.some(LX_WORDS, 4);
    const home = `/home/${user}`, dir = `${home}/reports`, sizes = rest.map(() => r.int(200, 1800)), bigSize = r.int(2500, 6000);
    return {
      sub: L(`Visit ${user}'s reports with ~${user}, find the largest file (hidden ones too), and come back with cd -.`, `Navštiv reporty uživatele ${user} přes ~${user}, najdi největší soubor (i mezi skrytými) a vrať se zpět pomocí cd -.`),
      lead: L(`You start in /srv/${app}. ${user} keeps reports in a home directory you may read.`, `Začínáš v /srv/${app}. Uživatel ${user} má reporty v domovském adresáři, který smíš číst.`),
      steps: [L(`Go to ~${user}/reports.`, `Přejdi do ~${user}/reports.`), L('Find the largest file there; a hidden file counts too.', 'Najdi tam největší soubor; skrytý soubor se počítá taky.'), L('Go to /tmp, then come back to the reports with cd -.', 'Přejdi do /tmp a pak se vrať k reportům pomocí cd -.')],
      init: {
        cwd: `/srv/${app}`, users: {[user]: {uid: 1001, gid: 1001, home}}, groups: {[user]: {gid: 1001, members: []}},
        dirs: [[`/srv/${app}`, {owner: 'root', mode: 0o755}], [home, {owner: user, mode: 0o755}], [dir, {owner: user, mode: 0o755}]],
        files: [[`${dir}/.${big}.bak`, 'x'.repeat(bigSize), {owner: user, mode: 0o644}], ...rest.map((f, i) => [`${dir}/${f}.csv`, 'y'.repeat(sizes[i]), {owner: user, mode: 0o644}])],
      },
      reqs: [
        lxCwd(dir, [`cd ~${user}/reports`, 'cd /tmp', 'cd -']),
        lxAsk(L(`The largest file in ~${user}/reports`, `Největší soubor v ~${user}/reports`), () => `.${big}.bak`, ['ls -lah']),
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
      sub: L(`Make a project directory ${proj} with two empty files in it.`, `Vytvoř adresář projektu ${proj} se dvěma prázdnými soubory.`),
      lead: L('You start in your home directory.', 'Začínáš ve svém domovském adresáři.'),
      steps: [L(`Create the directory ~/${proj}.`, `Vytvoř adresář ~/${proj}.`), L(`Create the empty files ${a}.txt and ${b}.txt inside it.`, `Vytvoř v něm prázdné soubory ${a}.txt a ${b}.txt.`)],
      init: {},
      reqs: [lxIsDir(dir, [`mkdir ${proj}`]), lxIsFile(`${dir}/${a}.txt`, null, [`touch ${proj}/${a}.txt`]), lxIsFile(`${dir}/${b}.txt`, null, [`touch ${proj}/${b}.txt`])],
      solution: [`mkdir ${proj}`, `touch ${proj}/${a}.txt ${proj}/${b}.txt`],
    };
  },
  intermediate: x => {
    const r = lxRandom(x), proj = r.pick(LX_PROJECTS), file = r.pick(['hosts', 'hostname', 'os-release']), logs = `${LX_HOME}/${proj}/logs`;
    return {
      sub: L(`Set up ~/${proj}/logs and keep a copy of /etc/${file} there as ${file}.bak.`, `Připrav ~/${proj}/logs a ulož tam kopii /etc/${file} jako ${file}.bak.`),
      lead: L('You start in your home directory.', 'Začínáš ve svém domovském adresáři.'),
      steps: [L(`Create ~/${proj}/logs in one command.`, `Vytvoř ~/${proj}/logs jedním příkazem.`), L(`Copy /etc/${file} into it.`, `Zkopíruj do něj /etc/${file}.`), L(`Rename the copy to ${file}.bak.`, `Přejmenuj kopii na ${file}.bak.`)],
      init: {},
      reqs: [
        lxIsDir(logs, [`mkdir -p ${proj}/logs`]),
        lxIsFile(`${logs}/${file}.bak`, s => lxContent(lxHost(s), lxFind(lxHost(s), `/etc/${file}`)),
          [`cp /etc/${file} ${proj}/logs/`, `mv ${proj}/logs/${file} ${proj}/logs/${file}.bak`], L(`is a copy of /etc/${file}`, `je kopie /etc/${file}`)),
        lxGone(`${logs}/${file}`, [`mv ${proj}/logs/${file} ${proj}/logs/${file}.bak`]),
      ],
      solution: [`mkdir -p ${proj}/logs`, `cp /etc/${file} ${proj}/logs/`, `mv ${proj}/logs/${file} ${proj}/logs/${file}.bak`],
    };
  },
  advanced: x => {
    const r = lxRandom(x), proj = r.pick(LX_PROJECTS), [a, b] = r.some(['main', 'util', 'parser', 'server', 'client', 'config'], 2);
    const base = `${LX_HOME}/${proj}`, backup = `${LX_HOME}/${proj}-backup`, codeA = `/* ${a}.c */\nint ${a}(void);\n`, codeB = `/* ${b}.c */\nint ${b}(void);\n`;
    return {
      sub: L(`Back up the sources of ${proj}, then clean up the project.`, `Zálohuj zdrojáky projektu ${proj} a pak projekt ukliď.`),
      lead: L(`~/${proj} has a src directory, an empty old directory and a stray build.log.`, `~/${proj} má adresář src, prázdný adresář old a zatoulaný build.log.`),
      steps: [L(`Copy the whole ~/${proj}/src directory to ~/${proj}-backup.`, `Zkopíruj celý adresář ~/${proj}/src do ~/${proj}-backup.`), L(`Delete ~/${proj}/build.log.`, `Smaž ~/${proj}/build.log.`), L(`Remove the empty directory ~/${proj}/old.`, `Odeber prázdný adresář ~/${proj}/old.`)],
      init: {dirs: [[`${base}/src`], [`${base}/old`]], files: [[`${base}/src/${a}.c`, codeA], [`${base}/src/${b}.c`, codeB], [`${base}/build.log`, 'make: *** [all] Error 2\n']]},
      reqs: [
        lxIsFile(`${backup}/${a}.c`, codeA, [`cp -r ${proj}/src ${proj}-backup`], L('is in the backup', 'je v záloze')),
        lxIsFile(`${backup}/${b}.c`, codeB, [`cp -r ${proj}/src ${proj}-backup`], L('is in the backup', 'je v záloze')),
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
      sub: L('Sort the files in ~/inbox by type, then delete the inbox.', 'Roztřiď soubory v ~/inbox podle typu a pak inbox smaž.'),
      lead: L('~/inbox is full of pictures, PDFs and notes, plus a hidden file nobody needs.', '~/inbox je plný obrázků, PDF a poznámek, k tomu skrytý soubor, který nikdo nepotřebuje.'),
      steps: [L('Create ~/sorted/images and ~/sorted/docs in one command.', 'Vytvoř ~/sorted/images a ~/sorted/docs jedním příkazem.'), L('Move every .jpg into images and every .pdf into docs, using globs.', 'Přesuň každý .jpg do images a každý .pdf do docs pomocí globů.'),
        L('Move the .txt files into ~/sorted itself.', 'Přesuň soubory .txt přímo do ~/sorted.'), L('Delete ~/inbox with everything still in it.', 'Smaž ~/inbox se vším, co v něm zůstalo.')],
      init: {dirs: [[inbox]], files: [...all.map(f => [`${inbox}/${f}`, `${f}\n`]), [`${inbox}/.DS_Store`, 'junk\n']]},
      reqs: [
        ...images.map(f => lxIsFile(`${sorted}/images/${f}`, `${f}\n`, ['mkdir -p sorted/images sorted/docs', 'mv inbox/*.jpg sorted/images/'], L('is in images', 'je v images'))),
        ...docs.map(f => lxIsFile(`${sorted}/docs/${f}`, `${f}\n`, ['mkdir -p sorted/images sorted/docs', 'mv inbox/*.pdf sorted/docs/'], L('is in docs', 'je v docs'))),
        ...texts.map(f => lxIsFile(`${sorted}/${f}`, `${f}\n`, ['mv inbox/*.txt sorted/'], L('is in ~/sorted', 'je v ~/sorted'))),
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
      sub: L(`Write a note with echo, then count the lines of the ${app} log.`, `Napiš poznámku pomocí echo a pak spočítej řádky logu služby ${app}.`),
      lead: L(`The ${app} service logs to ${dir}/${app}.log.`, `Služba ${app} loguje do ${dir}/${app}.log.`),
      steps: [L(`Write the line "${phrase}" into a new file ~/${word}.txt.`, `Zapiš řádek "${phrase}" do nového souboru ~/${word}.txt.`), L(`Count the lines of ${dir}/${app}.log.`, `Spočítej řádky ${dir}/${app}.log.`)],
      init: {dirs: [[dir, {owner: 'root', mode: 0o755}]], files: [[`${dir}/${app}.log`, lxEventLines(r, n, app).join('\n') + '\n', {owner: 'root', mode: 0o644}]]},
      reqs: [
        lxIsFile(`${LX_HOME}/${word}.txt`, `${phrase}\n`, [`echo "${phrase}" > ${word}.txt`], L(`holds the line "${phrase}"`, `obsahuje řádek "${phrase}"`)),
        lxAsk(L(`How many lines does ${app}.log have?`, `Kolik řádků má ${app}.log?`), () => String(n), [`wc -l ${dir}/${app}.log`]),
      ],
      solution: [`echo "${phrase}" > ${word}.txt`, `wc -l ${dir}/${app}.log`],
    };
  },
  intermediate: x => {
    const r = lxRandom(x), app = r.pick(LX_APPS), lines = lxEventLines(r, r.int(25, 50), app), k = r.int(2, 6), path = `/var/log/${app}/events.log`;
    return {
      sub: L(`Read the start and the end of the ${app} event log.`, `Přečti začátek a konec logu událostí služby ${app}.`),
      lead: L(`${path} grows all day; you only need its first lines and its newest one.`, `${path} roste celý den; potřebuješ jen jeho první řádky a ten nejnovější.`),
      steps: [L(`Show the first ${k} lines of ${path}.`, `Ukaž prvních ${k} řádků ${path}.`), L('Show only its last line.', 'Ukaž jen jeho poslední řádek.'), L('Type the answers next to the requirements.', 'Napiš odpovědi k požadavkům.')],
      init: {dirs: [[`/var/log/${app}`, {owner: 'root', mode: 0o755}]], files: [[path, lines.join('\n') + '\n', {owner: 'root', mode: 0o644}]]},
      reqs: [
        lxAsk(L(`Line ${k} of events.log`, `Řádek ${k} souboru events.log`), () => lines[k - 1], [`head -n ${k} ${path}`]),
        lxAsk(L('The last line of events.log', 'Poslední řádek events.log'), () => lines.at(-1), [`tail -n 1 ${path}`]),
      ],
      solution: [`head -n ${k} ${path}`, `tail -n 1 ${path}`],
    };
  },
  advanced: x => {
    const r = lxRandom(x), app = r.pick(LX_APPS), port = r.int(2000, 9999), word = r.pick(LX_WORDS);
    const conf = `/etc/${app}/${app}.conf`, text = `# ${app} settings\nname = ${app}\nport = ${port}\nworkers = ${r.int(2, 16)}\nlog = /var/log/${app}\n`;
    const note = `${LX_HOME}/${word}.txt`, first = `${app} notes\n`, line = `port ${port} checked`;
    return {
      sub: L(`Read the ${app} settings, count a file, and add a line to your notes.`, `Přečti nastavení služby ${app}, spočítej soubor a přidej řádek do svých poznámek.`),
      lead: L(`The settings of ${app} are in ${conf}; your notes are in ~/${word}.txt.`, `Nastavení služby ${app} je v ${conf}; tvoje poznámky jsou v ~/${word}.txt.`),
      steps: [L(`Open ${conf} with less and find the port.`, `Otevři ${conf} pomocí less a najdi port.`), L(`Count the words and the bytes of ${conf}.`, `Spočítej slova a bajty ${conf}.`), L(`Add the line "${line}" to the end of ~/${word}.txt.`, `Přidej řádek "${line}" na konec ~/${word}.txt.`)],
      init: {dirs: [[`/etc/${app}`, {owner: 'root', mode: 0o755}]], files: [[conf, text, {owner: 'root', mode: 0o644}], [note, first]]},
      reqs: [
        lxAsk(L(`The port in ${app}.conf`, `Port v ${app}.conf`), () => String(port), [`less ${conf}`]),
        lxAsk(L(`How many words are in ${app}.conf?`, `Kolik slov je v ${app}.conf?`), () => String(text.split(/\s+/).filter(Boolean).length), [`wc -w ${conf}`]),
        lxAsk(L(`How many bytes is ${app}.conf?`, `Kolik bajtů má ${app}.conf?`), () => String(text.length), [`wc -c ${conf}`]),
        lxIsFile(note, first + line + '\n', [`echo "${line}" >> ${word}.txt`], L(`ends with the line "${line}"`, `končí řádkem "${line}"`)),
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
      sub: L(`Collect three facts about ${app} from its files.`, `Zjisti ze souborů služby ${app} tři údaje.`),
      lead: L(`${app} keeps a user list in ${csv} and three logs in ${dir}.`, `${app} má seznam uživatelů v ${csv} a tři logy v ${dir}.`),
      steps: [L('Find the first user in users.csv (the line after the header).', 'Najdi prvního uživatele v users.csv (řádek za hlavičkou).'), L('Find the code of the newest error in error.log.', 'Najdi kód nejnovější chyby v error.log.'), L(`Count the lines of all the .log files in ${dir} together.`, `Spočítej řádky všech souborů .log v ${dir} dohromady.`)],
      init: {
        dirs: [[dir, {owner: 'root', mode: 0o755}], [`/srv/${app}`, {owner: 'root', mode: 0o755}]],
        files: [[csv, 'name,role\n' + people.map((p, i) => `${p},${i ? 'user' : 'admin'}`).join('\n') + '\n', {owner: 'root', mode: 0o644}],
          ...Object.keys(logs).map(k => [`${dir}/${k}.log`, text[k].join('\n') + '\n', {owner: 'root', mode: 0o644}])],
      },
      reqs: [
        lxAsk(L('The first user in users.csv', 'První uživatel v users.csv'), () => people[0], [`head -n 2 ${csv}`]),
        lxAsk(L('The code of the newest error', 'Kód nejnovější chyby'), () => String(codes.at(-1)), [`tail -n 1 ${dir}/error.log`]),
        lxAsk(L(`The total number of lines in ${dir}/*.log`, `Celkový počet řádků v ${dir}/*.log`), () => String(logs.access + logs.error + logs.worker), [`wc -l ${dir}/*.log`]),
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
      sub: L(`Count how often ${word} appears in the ${app} log.`, `Spočítej, kolikrát se v logu služby ${app} objeví ${word}.`),
      lead: L(`Something is wrong with ${app}; its log is ${path}.`, `Se službou ${app} něco není v pořádku; její log je ${path}.`),
      steps: [L(`Search ${path} for ${word}.`, `Prohledej ${path} kvůli ${word}.`), L('Count the matching lines.', 'Spočítej odpovídající řádky.')],
      init: {dirs: [[`/var/log/${app}`, {owner: 'root', mode: 0o755}]], files: [[path, lines.join('\n') + '\n', {owner: 'root', mode: 0o644}]]},
      reqs: [lxAsk(L(`How many lines of ${app}.log contain ${word}?`, `Kolik řádků ${app}.log obsahuje ${word}?`), () => String(hits), [`grep -c ${word} ${path}`])],
      solution: [`grep ${word} ${path}`, `grep -c ${word} ${path}`],
    };
  },
  intermediate: x => {
    const r = lxRandom(x), app = r.pick(LX_APPS), path = `/var/log/${app}/${app}.log`, lines = lxEventLines(r, r.int(30, 60), app);
    const at = r.int(5, lines.length - 1), spelled = r.pick(['TIMEOUT', 'Timeout', 'TimeOut']);
    lines[at - 1] = `2026-11-24 13:37 ${app} ${spelled} waiting for the database`;
    return {
      sub: L(`Find on which line of the ${app} log the timeout is, whatever its case.`, `Najdi, na kterém řádku logu služby ${app} je timeout, bez ohledu na velikost písmen.`),
      lead: L(`${path} has one timeout in it, but nobody knows how it is spelled.`, `V ${path} je jeden timeout, ale nikdo neví, jak je napsaný.`),
      steps: [L('Search for timeout, ignoring upper and lower case.', 'Hledej timeout bez ohledu na velká a malá písmena.'), L('Show line numbers with the matches.', 'Ukaž u shod čísla řádků.')],
      init: {dirs: [[`/var/log/${app}`, {owner: 'root', mode: 0o755}]], files: [[path, lines.join('\n') + '\n', {owner: 'root', mode: 0o644}]]},
      reqs: [lxAsk(L('The line number of the timeout', 'Číslo řádku s timeoutem'), () => String(at), [`grep -in timeout ${path}`])],
      solution: [`grep -in timeout ${path}`],
    };
  },
  advanced: x => {
    const r = lxRandom(x), app = r.pick(LX_APPS), key = r.pick(['db_password', 'api_token', 'smtp_host', 'cache_ttl']), dir = `/etc/${app}`;
    const names = r.some(['main', 'db', 'mail', 'cache', 'auth', 'extra', 'local'], 5), withKey = names.slice(0, r.int(2, 3));
    const files = names.map((n, i) => [`${dir}/${i % 2 ? 'conf.d/' : ''}${n}${i === 4 ? '.ini' : '.conf'}`, `# ${n}\n${withKey.includes(n) ? `${key} = x${r.int(10, 99)}\n` : ''}enabled = yes\n`]);
    return {
      sub: L(`Find which ${app} settings files mention ${key}, and list its .conf files.`, `Zjisti, které soubory s nastavením služby ${app} zmiňují ${key}, a vypiš její soubory .conf.`),
      lead: L(`${dir} holds the settings of ${app}, some of them in conf.d.`, `V ${dir} je nastavení služby ${app}, část v conf.d.`),
      steps: [L(`List the files under ${dir} that contain ${key}.`, `Vypiš soubory pod ${dir}, které obsahují ${key}.`), L(`List every .conf file under ${dir} with find.`, `Vypiš pomocí find každý soubor .conf pod ${dir}.`), L('Type full paths, separated by spaces.', 'Napiš celé cesty oddělené mezerami.')],
      init: {dirs: [[`${dir}/conf.d`, {owner: 'root', mode: 0o755}]], files: files.map(([p, t]) => [p, t, {owner: 'root', mode: 0o644}])},
      reqs: [
        lxAsk(L(`The files that contain ${key}`, `Soubory, které obsahují ${key}`), () => files.filter(([, t]) => t.includes(key)).map(([p]) => p), [`grep -rl ${key} ${dir}`]),
        lxAsk(L(`The .conf files under ${dir}`, `Soubory .conf pod ${dir}`), () => files.map(([p]) => p).filter(p => p.endsWith('.conf')), [`find ${dir} -name '*.conf'`]),
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
      sub: L(`Free space in ${dir}: delete the files over ${limit} KiB, keep the rest. Then count the real settings in ${conf}.`, `Uvolni místo v ${dir}: smaž soubory nad ${limit} KiB, zbytek nech. Pak spočítej skutečná nastavení v ${conf}.`),
      lead: L(`${dir} is full of temporary files of ${app}, some of them large.`, `${dir} je plný dočasných souborů služby ${app}, některé jsou velké.`),
      steps: [L(`Find the files in ${dir} bigger than ${limit}k.`, `Najdi v ${dir} soubory větší než ${limit}k.`), L('Delete those, and only those.', 'Smaž je, a jen je.'), L(`Count the lines of ${conf} that are not comments (comments start with #).`, `Spočítej řádky ${conf}, které nejsou komentáře (komentáře začínají #).`)],
      init: {
        dirs: [[dir]],
        files: [...big.map(n => [`${dir}/${n}.tmp`, 'z'.repeat((limit + r.int(5, 200)) * 1024)]), ...small.map(n => [`${dir}/${n}.tmp`, 'z'.repeat(r.int(1, limit - 5) * 1024)]),
          [conf, confText, {owner: 'root', mode: 0o644}]],
      },
      reqs: [
        ...big.map(n => lxGone(`${dir}/${n}.tmp`, [`find ${dir} -type f -size +${limit}k -delete`])),
        {
          text: L(`Only the ${small.length} small files are left in ${dir}`, `V ${dir} zůstaly jen ${small.length} malé soubory`), hint: {cmds: [`find ${dir} -type f -size +${limit}k -delete`]},
          ok: s => Object.keys(lxNodeAt(s, dir)?.children || {}).sort().join() === small.map(n => `${n}.tmp`).sort().join(),
        },
        lxAsk(L(`How many lines of ${conf} are not comments?`, `Kolik řádků ${conf} nejsou komentáře?`), () => String(settings.length), [`grep -vc '^#' ${conf}`]),
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
      sub: L(`Build the file ~/${word}.txt line by line with > and >>.`, `Postav soubor ~/${word}.txt řádek po řádku pomocí > a >>.`),
      lead: L('You start in your home directory.', 'Začínáš ve svém domovském adresáři.'),
      steps: [L(`Write the line "${a}" into ~/${word}.txt with >.`, `Zapiš řádek "${a}" do ~/${word}.txt pomocí >.`), L(`Add the line "${b}" to it with >>.`, `Přidej do něj řádek "${b}" pomocí >>.`)],
      init: {},
      reqs: [lxIsFile(file, `${a}\n${b}\n`, [`echo ${a} > ${word}.txt`, `echo ${b} >> ${word}.txt`], L(`holds the two lines ${a} and ${b}`, `obsahuje dva řádky ${a} a ${b}`))],
      solution: [`echo ${a} > ${word}.txt`, `echo ${b} >> ${word}.txt`],
    };
  },
  intermediate: x => {
    const r = lxRandom(x), proj = r.pick(LX_PROJECTS), names = r.some(LX_PEOPLE, 5);
    const visits = r.shuffle([...names, ...r.some(names, 3), ...r.some(names, 2)]), dir = `${LX_HOME}/${proj}`;
    return {
      sub: L(`Turn the visitor list of ${proj} into a sorted list of unique names.`, `Udělej ze seznamu návštěvníků projektu ${proj} seřazený seznam jedinečných jmen.`),
      lead: L(`~/${proj}/visitors.txt has one name per visit, so most names repeat.`, `~/${proj}/visitors.txt má jedno jméno na každou návštěvu, takže se většina jmen opakuje.`),
      steps: [L('Sort visitors.txt and drop the repeated names in one pipeline.', 'Seřaď visitors.txt a zahoď opakovaná jména jednou rourou.'), L(`Save the result as ~/${proj}/unique.txt.`, `Ulož výsledek jako ~/${proj}/unique.txt.`)],
      init: {files: [[`${dir}/visitors.txt`, visits.join('\n') + '\n']]},
      reqs: [lxIsFile(`${dir}/unique.txt`, [...new Set(names)].sort(lxCollate).join('\n') + '\n', [`sort ${proj}/visitors.txt | uniq > ${proj}/unique.txt`], L('lists every visitor once, sorted', 'uvádí každého návštěvníka jednou, seřazeně'))],
      solution: [`sort ${proj}/visitors.txt | uniq > ${proj}/unique.txt`],
    };
  },
  advanced: x => {
    const r = lxRandom(x), user = r.pick(LX_PEOPLE), missing = `/srv/${r.pick(LX_PROJECTS)}`;
    return {
      sub: L('Save a sorted list of the system\'s user names, and save an error message.', 'Ulož seřazený seznam uživatelských jmen systému a ulož chybovou hlášku.'),
      lead: L(`The user ${user} was added to this system today. The directory ${missing} was not.`, `Uživatel ${user} byl do systému přidán dnes. Adresář ${missing} ne.`),
      steps: [L('Take the first field of /etc/passwd (fields are split by :), sort it, and save it as ~/users.txt.', 'Vezmi první pole /etc/passwd (pole jsou oddělená :), seřaď ho a ulož jako ~/users.txt.'),
        L(`Run ls ${missing} and save only its error message in ~/errors.txt.`, `Spusť ls ${missing} a do ~/errors.txt ulož jen jeho chybovou hlášku.`)],
      init: {users: {[user]: {uid: 1001, gid: 1001, home: `/home/${user}`, shell: '/bin/bash'}}, groups: {[user]: {gid: 1001, members: []}}},
      reqs: [
        lxIsFile(`${LX_HOME}/users.txt`, s => lxLines(lxContent(lxHost(s), lxFind(lxHost(s), '/etc/passwd'))).map(l => l.split(':')[0]).sort(lxCollate).join('\n') + '\n',
          ['cut -d: -f1 /etc/passwd | sort > users.txt'], L('lists the user names, sorted', 'uvádí uživatelská jména, seřazená')),
        lxIsFile(`${LX_HOME}/errors.txt`, `ls: cannot access '${missing}': No such file or directory\n`, [`ls ${missing} 2> errors.txt`], L('holds the error message of ls', 'obsahuje chybovou hlášku ls')),
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
      sub: L(`Find the three addresses that visited ${app} most, with a pipeline.`, `Najdi rourou tři adresy, které službu ${app} navštívily nejčastěji.`),
      lead: L(`${log} has one line per request; the client address is the first field (fields are split by spaces).`, `${log} má jeden řádek na každý požadavek; adresa klienta je první pole (pole jsou oddělená mezerami).`),
      steps: [L('Cut out the address of every line.', 'Vyřízni adresu z každého řádku.'), L('Sort them, count them with uniq -c, and sort the counts from the highest.', 'Seřaď je, spočítej pomocí uniq -c a seřaď počty od nejvyššího.'), L('Keep the top three lines and save them as ~/top.txt.', 'Nech první tři řádky a ulož je jako ~/top.txt.')],
      init: {dirs: [[`/var/log/${app}`, {owner: 'root', mode: 0o755}]], files: [[log, lines.join('\n') + '\n', {owner: 'root', mode: 0o644}]]},
      reqs: [lxIsFile(`${LX_HOME}/top.txt`, top.map(([n, ip]) => `${String(n).padStart(7)} ${ip}`).join('\n') + '\n',
        [`cut -d' ' -f1 ${log} | sort | uniq -c | sort -rn | head -n 3 > top.txt`], L('holds the top three addresses with their counts', 'obsahuje tři nejčastější adresy s počty'))],
      solution: [`cut -d' ' -f1 ${log} | sort | uniq -c | sort -rn | head -n 3 > top.txt`],
    };
  },
};

// ---- Permissions and ownership ----

const LX_PERMS = {
  beginner: x => {
    const r = lxRandom(x), proj = r.pick(LX_PROJECTS), key = `id_${r.pick(['deploy', 'backup', 'github', 'server'])}`, dir = `${LX_HOME}/${proj}`;
    return {
      sub: L(`Lock down the key of ${proj} and make its deploy script runnable, with octal modes.`, `Zabezpeč klíč projektu ${proj} a udělej jeho deploy skript spustitelný, osmičkovými režimy.`),
      lead: L(`~/${proj} has a private key ${key} that anyone may read, and a deploy.sh nobody may run.`, `~/${proj} má privátní klíč ${key}, který si může přečíst kdokoli, a deploy.sh, který nikdo nesmí spustit.`),
      steps: [L(`Give ${key} mode 600: only you may read and write it.`, `Dej ${key} režim 600: číst a zapisovat ho smíš jen ty.`), L('Give deploy.sh mode 755: everyone may read and run it, only you may change it.', 'Dej deploy.sh režim 755: číst a spouštět ho smí každý, měnit jen ty.')],
      init: {files: [[`${dir}/${key}`, '-----BEGIN OPENSSH PRIVATE KEY-----\n', {mode: 0o664}], [`${dir}/deploy.sh`, '#!/bin/bash\necho deploying\n', {mode: 0o664}]]},
      reqs: [lxModeIs(`${dir}/${key}`, 0o600, [`chmod 600 ${proj}/${key}`]), lxModeIs(`${dir}/deploy.sh`, 0o755, [`chmod 755 ${proj}/deploy.sh`])],
      solution: [`chmod 600 ${proj}/${key}`, `chmod 755 ${proj}/deploy.sh`],
    };
  },
  intermediate: x => {
    const r = lxRandom(x), proj = r.pick(LX_PROJECTS), [run, shared, secret] = r.some(['start', 'build', 'notes', 'plan', 'keys', 'tokens', 'test'], 3), dir = `${LX_HOME}/${proj}`;
    return {
      sub: L('Fix three files with symbolic chmod modes, one change each.', 'Oprav tři soubory symbolickými režimy chmod, každý jednou změnou.'),
      lead: L(`In ~/${proj}: ${run}.sh can't be run, the group may change ${shared}.txt, and others may read ${secret}.txt.`, `V ~/${proj}: ${run}.sh nejde spustit, skupina smí měnit ${shared}.txt a ostatní smějí číst ${secret}.txt.`),
      steps: [L(`Let the owner run ${run}.sh (u+x).`, `Dovol vlastníkovi spouštět ${run}.sh (u+x).`), L(`Take write away from the group on ${shared}.txt (g-w).`, `Vezmi skupině zápis do ${shared}.txt (g-w).`), L(`Take every permission away from others on ${secret}.txt (o=).`, `Vezmi ostatním všechna oprávnění k ${secret}.txt (o=).`)],
      init: {files: [[`${dir}/${run}.sh`, '#!/bin/bash\n', {mode: 0o644}], [`${dir}/${shared}.txt`, 'shared\n', {mode: 0o664}], [`${dir}/${secret}.txt`, 'secret\n', {mode: 0o664}]]},
      reqs: [
        lxModeIs(`${dir}/${run}.sh`, 0o744, [`chmod u+x ${proj}/${run}.sh`]),
        lxModeIs(`${dir}/${shared}.txt`, 0o644, [`chmod g-w ${proj}/${shared}.txt`]),
        lxModeIs(`${dir}/${secret}.txt`, 0o660, [`chmod o= ${proj}/${secret}.txt`]),
      ],
      solution: [`chmod u+x ${proj}/${run}.sh`, `chmod g-w ${proj}/${shared}.txt`, `chmod o= ${proj}/${secret}.txt`],
    };
  },
  advanced: x => {
    const r = lxRandom(x), app = r.pick(LX_APPS), user = r.pick(LX_PEOPLE), team = r.pick(LX_TEAMS), word = r.pick(LX_WORDS), db = `/srv/${app}/data.db`;
    return {
      sub: L(`Hand the ${app} database to ${user} and the ${team} team, share your ${word} with the team, and check your umask.`, `Předej databázi služby ${app} uživateli ${user} a týmu ${team}, nasdílej s týmem svůj ${word} a zkontroluj svůj umask.`),
      lead: L(`${db} still belongs to root. You and ${user} are both in the group ${team}.`, `${db} pořád patří rootovi. Ty i ${user} jste oba ve skupině ${team}.`),
      steps: [L(`Make ${user} the owner and ${team} the group of ${db} (this needs sudo).`, `Nastav ${user} jako vlastníka a ${team} jako skupinu ${db} (potřebuje to sudo).`), L(`Give ~/${word}.txt to the group ${team}.`, `Dej ~/${word}.txt skupině ${team}.`), L('Show your umask.', 'Ukaž svůj umask.')],
      init: {
        users: {[user]: {uid: 1001, gid: 1001, home: `/home/${user}`}}, groups: {[user]: {gid: 1001, members: []}, [team]: {gid: 1010, members: ['student', user]}},
        dirs: [[`/srv/${app}`, {owner: 'root', mode: 0o755}]], files: [[db, 'SQLite format 3\n', {owner: 'root', mode: 0o640}], [`${LX_HOME}/${word}.txt`, `${word}\n`]],
      },
      reqs: [
        lxOwner(db, user, team, [`sudo chown ${user}:${team} ${db}`]),
        lxOwner(`${LX_HOME}/${word}.txt`, 'student', team, [`chgrp ${team} ${word}.txt`]),
        lxAsk(L('Your umask, as umask prints it', 'Tvůj umask, jak ho vypíše umask'), () => '0002', ['umask']),
      ],
      solution: [`sudo chown ${user}:${team} ${db}`, `chgrp ${team} ${word}.txt`, 'umask'],
    };
  },
  expert: x => {
    const r = lxRandom(x), team = r.pick(LX_TEAMS), user = r.pick(LX_PEOPLE), dir = `/srv/${team}`;
    return {
      sub: L(`Set up a shared directory for the ${team} team where every new file belongs to the team.`, `Připrav sdílený adresář pro tým ${team}, kde každý nový soubor patří týmu.`),
      lead: L(`You and ${user} are in the group ${team}. /srv belongs to root.`, `Ty i ${user} jste ve skupině ${team}. /srv patří rootovi.`),
      steps: [L(`Create ${dir} (sudo).`, `Vytvoř ${dir} (sudo).`), L(`Make ${team} its group.`, `Nastav mu skupinu ${team}.`), L('Give it mode 2770: the team may do everything, others nothing, and setgid passes the group on.', 'Dej mu režim 2770: tým smí všechno, ostatní nic a setgid předává skupinu dál.'),
        L(`Create ${dir}/hello.txt as yourself and check that its group is ${team}.`, `Vytvoř ${dir}/hello.txt jako ty sám a zkontroluj, že jeho skupina je ${team}.`)],
      init: {users: {[user]: {uid: 1001, gid: 1001, home: `/home/${user}`}}, groups: {[user]: {gid: 1001, members: []}, [team]: {gid: 1010, members: ['student', user]}}},
      reqs: [
        lxIsDir(dir, [`sudo mkdir ${dir}`]),
        lxOwner(dir, 'root', team, [`sudo chgrp ${team} ${dir}`]),
        lxModeIs(dir, 0o2770, [`sudo chmod 2770 ${dir}`]),
        lxOwner(`${dir}/hello.txt`, 'student', team, [`touch ${dir}/hello.txt`]),
      ],
      solution: [`sudo mkdir ${dir}`, `sudo chgrp ${team} ${dir}`, `sudo chmod 2770 ${dir}`, `touch ${dir}/hello.txt`, `ls -l ${dir}`],
    };
  },
};

// ---- Users, groups and sudo ----

const LX_USERS_LABS = {
  beginner: x => {
    const r = lxRandom(x), team = r.pick(LX_TEAMS), gid = r.int(1001, 1099);
    return {
      sub: L('Find out who you are on this system: your uid, your groups, and the gid of your team.', 'Zjisti, kdo jsi v tomto systému: své uid, své skupiny a gid svého týmu.'),
      lead: L(`Your account is student. You were also added to the group ${team}.`, `Tvůj účet je student. Byl jsi přidán také do skupiny ${team}.`),
      steps: [L('Show your uid and your groups.', 'Ukaž své uid a své skupiny.'), L(`Find the number (gid) of the group ${team} in /etc/group.`, `Najdi číslo (gid) skupiny ${team} v /etc/group.`)],
      init: {groups: {[team]: {gid, members: ['student']}}},
      reqs: [
        lxAsk(L('Your uid', 'Tvoje uid'), () => '1000', ['id']),
        lxAsk(L('The names of all your groups', 'Názvy všech tvých skupin'), () => ['student', 'sudo', team], ['id -nG']),
        lxAsk(L(`The gid of ${team}`, `Gid skupiny ${team}`), () => String(gid), [`grep ${team} /etc/group`]),
      ],
      solution: ['id', 'id -nG', `grep ${team} /etc/group`],
    };
  },
  intermediate: x => {
    const r = lxRandom(x), user = r.pick(LX_PEOPLE), team = r.pick(LX_TEAMS);
    return {
      sub: L(`Create the account ${user} with a home directory, and the group ${team}.`, `Vytvoř účet ${user} s domovským adresářem a skupinu ${team}.`),
      lead: L(`${user} starts work today. Creating accounts needs root, so use sudo.`, `Uživatel ${user} dnes nastupuje. Vytváření účtů potřebuje roota, takže použij sudo.`),
      steps: [L(`Create the user ${user} with a home directory.`, `Vytvoř uživatele ${user} s domovským adresářem.`), L(`Create the group ${team}.`, `Vytvoř skupinu ${team}.`)],
      init: {},
      reqs: [lxUser(user, {home: true}, [`sudo useradd -m ${user}`]), lxGroup(team, [`sudo groupadd ${team}`])],
      solution: [`sudo useradd -m ${user}`, `sudo groupadd ${team}`, `id ${user}`],
    };
  },
  advanced: x => {
    const r = lxRandom(x), user = r.pick(LX_PEOPLE), team = r.pick(LX_TEAMS), pw = `${r.pick(['Spring', 'River', 'Cloud', 'Maple'])}${r.int(10, 99)}!`;
    return {
      sub: L(`Add ${user} to the ${team} group and give the account a password.`, `Přidej uživatele ${user} do skupiny ${team} a nastav účtu heslo.`),
      lead: L(`${user} has an account but no password, and is not in ${team} yet.`, `Uživatel ${user} má účet, ale bez hesla, a ještě není ve skupině ${team}.`),
      steps: [L(`Add ${user} to ${team}, keeping the groups ${user} already has.`, `Přidej uživatele ${user} do skupiny ${team} a zachovej skupiny, které už má.`), L(`Set ${user}'s password to ${pw} (passwd asks for it twice).`, `Nastav heslo uživatele ${user} na ${pw} (passwd se na něj zeptá dvakrát).`)],
      init: {users: {[user]: {uid: 1001, gid: 1001, home: `/home/${user}`}}, groups: {[user]: {gid: 1001, members: []}, [team]: {gid: 1010, members: []}},
        dirs: [[`/home/${user}`, {owner: user, mode: 0o750}]]},
      reqs: [lxUser(user, {groups: [team]}, [`sudo usermod -aG ${team} ${user}`]), lxUser(user, {pw: true}, [`sudo passwd ${user}`])],
      solution: [`sudo usermod -aG ${team} ${user}`, `sudo passwd ${user}`, pw, pw],
    };
  },
  expert: x => {
    const r = lxRandom(x), [a, b, old] = r.some(LX_PEOPLE, 3), shell = r.pick(['/bin/sh', '/usr/sbin/nologin', '/bin/dash', '/bin/bash']);
    return {
      sub: L(`Create ${a} and ${b} with bash as their shell, make ${b} an admin, and check ${old}'s shell.`, `Vytvoř uživatele ${a} a ${b} s bashem jako shellem, udělej z uživatele ${b} admina a zjisti shell uživatele ${old}.`),
      lead: L(`${old} already has an account. ${a} and ${b} need new ones; ${b} will run sudo.`, `Uživatel ${old} už účet má. Uživatelé ${a} a ${b} potřebují nové; ${b} bude používat sudo.`),
      steps: [L(`Create ${a} and ${b}, each with a home directory and /bin/bash as the shell.`, `Vytvoř uživatele ${a} a ${b}, každého s domovským adresářem a /bin/bash jako shellem.`), L(`Put ${b} in the group sudo.`, `Dej uživatele ${b} do skupiny sudo.`), L(`Find ${old}'s login shell in /etc/passwd.`, `Najdi přihlašovací shell uživatele ${old} v /etc/passwd.`)],
      init: {users: {[old]: {uid: 1001, gid: 1001, home: `/home/${old}`, shell}}, groups: {[old]: {gid: 1001, members: []}}},
      reqs: [
        lxUser(a, {home: true, shell: '/bin/bash'}, [`sudo useradd -m -s /bin/bash ${a}`]),
        lxUser(b, {home: true, shell: '/bin/bash', groups: ['sudo']}, [`sudo useradd -m -s /bin/bash -G sudo ${b}`]),
        lxAsk(L(`${old}'s login shell`, `Přihlašovací shell uživatele ${old}`), () => shell, [`grep ${old} /etc/passwd`]),
      ],
      solution: [`sudo useradd -m -s /bin/bash ${a}`, `sudo useradd -m -s /bin/bash -G sudo ${b}`, `grep ${old} /etc/passwd`],
    };
  },
};

// ---- Processes ----

const LX_PROCS_LABS = {
  beginner: x => {
    const r = lxRandom(x), app = r.pick(LX_APPS), pid = r.int(2000, 3999), cmd = `/usr/bin/python3 /opt/${app}/worker.py`;
    return {
      sub: L(`Find the PID of the ${app} worker.`, `Najdi PID workeru služby ${app}.`),
      lead: L(`A worker of ${app} runs as www-data. You need its process number.`, `Worker služby ${app} běží jako www-data. Potřebuješ číslo jeho procesu.`),
      steps: [L('List every process on the system.', 'Vypiš všechny procesy v systému.'), L(`Find the line of ${app}/worker.py and read its PID.`, `Najdi řádek ${app}/worker.py a přečti jeho PID.`)],
      init: {procs: [{pid, user: 'www-data', cmd, cpu: 1.2, mem: 2.4, tty: '?', stat: 'S', start: '07:45'}]},
      reqs: [lxAsk(L(`The PID of the ${app} worker`, `PID workeru služby ${app}`), () => String(pid), ['ps aux'])],
      solution: ['ps aux'],
    };
  },
  intermediate: x => {
    const r = lxRandom(x), app = r.pick(LX_APPS), pid = r.int(2000, 3999), cmd = `python3 ${app}-loop.py`;
    return {
      sub: L(`Stop your own runaway ${app}-loop.py.`, `Zastav svůj vlastní splašený ${app}-loop.py.`),
      lead: L(`You started ${app}-loop.py earlier in another terminal and it now takes all the CPU.`, `${app}-loop.py jsi dřív spustil v jiném terminálu a teď bere celé CPU.`),
      steps: [L('Find its PID.', 'Najdi jeho PID.'), L('Stop it with kill.', 'Zastav ho pomocí kill.')],
      init: {procs: [{pid, user: 'student', cmd, cpu: 98.7, mem: 1.1, tty: 'pts/1', stat: 'R', start: '09:12'}]},
      reqs: [lxNoProc(`${app}-loop.py`, ['ps aux', `kill ${pid}`])],
      solution: ['ps aux', `kill ${pid}`],
    };
  },
  advanced: x => {
    const r = lxRandom(x), [a, b] = r.some([60, 120, 300, 600, 900, 1800], 2);
    return {
      sub: L('Run two jobs in the background and stop the first one.', 'Spusť dvě úlohy na pozadí a zastav tu první.'),
      lead: L('sleep N waits N seconds; it stands in for any long task.', 'sleep N čeká N sekund; zastupuje jakoukoli dlouhou úlohu.'),
      steps: [L(`Start sleep ${a} in the background.`, `Spusť sleep ${a} na pozadí.`), L(`Start sleep ${b} in the background.`, `Spusť sleep ${b} na pozadí.`), L('List the jobs.', 'Vypiš úlohy.'), L('Stop job 1 by its job number.', 'Zastav úlohu 1 podle jejího čísla úlohy.')],
      init: {},
      reqs: [
        lxJob(`sleep ${b}`, [`sleep ${b} &`]),
        {text: L(`Only the sleep ${b} job is left`, `Zbývá jen úloha sleep ${b}`), ok: s => lxHost(s).jobs.length === 1 && lxHost(s).jobs[0].cmd === `sleep ${b}`, hint: {cmds: [`sleep ${a} &`, 'jobs', 'kill %1']}},
      ],
      solution: [`sleep ${a} &`, `sleep ${b} &`, 'jobs', 'kill %1', 'jobs'],
    };
  },
  expert: x => {
    const r = lxRandom(x), app = r.pick(LX_APPS), owner = r.pick(['www-data', ...LX_PEOPLE.slice(0, 3)]), pid = r.int(2000, 3999), cmd = `/usr/local/bin/${app}-indexer --full`;
    const people = owner === 'www-data' ? {} : {users: {[owner]: {uid: 1001, gid: 1001, home: `/home/${owner}`}}, groups: {[owner]: {gid: 1001, members: []}}};
    return {
      sub: L('Something is eating all the CPU. Find it with top and stop it for good.', 'Něco žere celé CPU. Najdi to pomocí top a zastav to natrvalo.'),
      lead: L('The machine is slow. The busy process belongs to another user and ignores a normal kill.', 'Stroj je pomalý. Vytížený proces patří jinému uživateli a normální kill ignoruje.'),
      steps: [L('Find the busiest process with top.', 'Najdi nejvytíženější proces pomocí top.'), L('Note its owner and PID.', 'Zapamatuj si jeho vlastníka a PID.'), L('Stop it: try a normal kill as root first; if it is still there, force it with -9.', 'Zastav ho: nejdřív zkus normální kill jako root; když tam pořád je, vynuť to pomocí -9.')],
      init: {...people, procs: [{pid, user: owner, cmd, cpu: 96.4, mem: 7.8, tty: '?', stat: 'R', start: '06:30', ignoresTerm: true}]},
      reqs: [
        lxNoProc(`${app}-indexer`, ['top', `sudo kill ${pid}`, `sudo kill -9 ${pid}`]),
        lxAsk(L('Who owned the busy process?', 'Kdo vlastnil vytížený proces?'), () => owner, ['top']),
      ],
      solution: ['top', `sudo kill ${pid}`, `sudo kill -9 ${pid}`],
    };
  },
};

// ---- Packages ----

const LX_EXTRA_PKGS = ['tree', 'htop', 'curl', 'git', 'jq', 'zip', 'unzip', 'ncdu', 'tmux', 'figlet', 'cowsay', 'sl'];

const LX_APT = {
  beginner: x => {
    const r = lxRandom(x), pkg = r.pick(LX_EXTRA_PKGS);
    return {
      sub: L(`Find out which version of ${pkg} is installed.`, `Zjisti, která verze ${pkg} je nainstalovaná.`),
      lead: L(`${pkg} was installed on this machine some time ago.`, `${pkg} byl na tento stroj nainstalován před nějakou dobou.`),
      steps: [L('List the installed packages.', 'Vypiš nainstalované balíčky.'), L(`Find ${pkg} and read its version.`, `Najdi ${pkg} a přečti jeho verzi.`)],
      init: {packages: [pkg]},
      reqs: [lxAsk(L(`The installed version of ${pkg}`, `Nainstalovaná verze ${pkg}`), () => LX_REPO[pkg].version, ['apt list --installed'])],
      solution: ['apt list --installed'],
    };
  },
  intermediate: x => {
    const r = lxRandom(x), pkg = r.pick(LX_EXTRA_PKGS);
    return {
      sub: L(`Refresh the package lists and install ${pkg}.`, `Obnov seznamy balíčků a nainstaluj ${pkg}.`),
      lead: L(`You need ${pkg} on this machine.`, `Potřebuješ na tomto stroji ${pkg}.`),
      steps: [L('Update the package lists (with sudo).', 'Aktualizuj seznamy balíčků (se sudo).'), L(`Install ${pkg}.`, `Nainstaluj ${pkg}.`)],
      init: {},
      reqs: [{text: L('The package lists are updated', 'Seznamy balíčků jsou aktualizované'), ok: s => lxHost(s).aptUpdated, hint: {cmds: ['sudo apt update']}}, lxPkg(pkg, true, [`sudo apt install ${pkg}`])],
      solution: ['sudo apt update', `sudo apt install ${pkg}`],
    };
  },
  advanced: x => {
    const r = lxRandom(x), [a, b, old] = r.some(LX_EXTRA_PKGS, 3);
    return {
      sub: L(`Install ${a} and ${b}, and remove ${old}.`, `Nainstaluj ${a} a ${b} a odeber ${old}.`),
      lead: L(`${old} is installed but nobody uses it any more.`, `${old} je nainstalovaný, ale už ho nikdo nepoužívá.`),
      steps: [L(`Install ${a} and ${b} in one command.`, `Nainstaluj ${a} a ${b} jedním příkazem.`), L(`Remove ${old}.`, `Odeber ${old}.`)],
      init: {packages: [old]},
      reqs: [lxPkg(a, true, [`sudo apt install ${a} ${b}`]), lxPkg(b, true, [`sudo apt install ${a} ${b}`]), lxPkg(old, false, [`sudo apt remove ${old}`])],
      solution: [`sudo apt install -y ${a} ${b}`, `sudo apt remove -y ${old}`],
    };
  },
  expert: x => {
    const r = lxRandom(x), [cmd, pkg] = r.pick([['ifconfig', 'net-tools'], ['htpasswd', 'apache2-utils'], ['mkpasswd', 'whois'], ['htop', 'htop'], ['jq', 'jq']]);
    const old = r.pick(LX_EXTRA_PKGS.filter(p => p !== pkg));
    return {
      sub: L(`The command ${cmd} is missing. Install the package that provides it, and clean up ${old}.`, `Chybí příkaz ${cmd}. Nainstaluj balíček, který ho obsahuje, a ukliď ${old}.`),
      lead: L(`A script needs ${cmd}, but typing it says the command is not found. ${old} is no longer needed.`, `Skript potřebuje ${cmd}, ale když ho napíšeš, příkaz se nenajde. ${old} už není potřeba.`),
      steps: [L(`Type ${cmd} and read which package Ubuntu suggests.`, `Napiš ${cmd} a přečti, který balíček Ubuntu navrhuje.`), L('Install that package.', 'Nainstaluj ten balíček.'), L(`Remove ${old}.`, `Odeber ${old}.`), L('Check the version you installed.', 'Zkontroluj verzi, kterou jsi nainstaloval.')],
      init: {packages: [old]},
      reqs: [
        lxPkg(pkg, true, [cmd, `sudo apt install ${pkg}`]),
        lxPkg(old, false, [`sudo apt remove ${old}`]),
        lxAsk(L(`The installed version of ${pkg}`, `Nainstalovaná verze ${pkg}`), () => LX_REPO[pkg].version, ['apt list --installed']),
      ],
      solution: [`sudo apt install -y ${pkg}`, `sudo apt remove -y ${old}`, 'apt list --installed'],
    };
  },
};

const LINUX_LABS = {
  'lx-nav': {levels: LX_NAV},
  'lx-files': {levels: LX_FILES},
  'lx-view': {levels: LX_VIEW},
  'lx-search': {levels: LX_SEARCH},
  'lx-pipes': {levels: LX_PIPES},
  'lx-perms': {levels: LX_PERMS},
  'lx-users': {levels: LX_USERS_LABS},
  'lx-procs': {levels: LX_PROCS_LABS},
  'lx-apt': {levels: LX_APT},
};

// a level of a Linux topic built for the random number x, in the shape createSession (js/session.js) expects
function lxLab(T, level, x) {
  const lv = level(x);
  return {
    sub: lv.sub, lead: lv.lead + L(` You are logged in as student (password: ${LX_PASSWORD}).`, ` Jsi přihlášený jako student (heslo: ${LX_PASSWORD}).`),
    steps: lv.steps, reqs: lv.reqs, solution: [['lab', lv.solution]], home: 'lab', links: [],
    nodes: [{id: 'lab', type: 'linux', sub: 'Ubuntu 24.04', init: lv.init}],
  };
}
