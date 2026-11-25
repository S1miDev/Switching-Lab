// Language (Czech or English): chosen once per page load, before the data files build their texts with L().
// The switch stores the choice and reloads, so nothing has to re-render. Console and terminal output stays English.
// Logged in, auth.js keeps the choice in user_metadata.lang (langSync).

const LANGS = ['en', 'cs'];
const LANG = (() => {
  let saved = null;
  try { saved = typeof localStorage !== 'undefined' && localStorage.getItem('lang'); } catch {} // storage may be blocked
  if (LANGS.includes(saved)) return saved;
  return typeof navigator !== 'undefined' && /^cs\b/i.test(navigator.language || '') ? 'cs' : 'en';
})();

// a text in the page's language: L('Start lab', 'Spustit lab'); without Czech, the English
const L = (en, cs) => (LANG === 'cs' && cs ? cs : en);

// Czech for the markup (elements marked data-i18n) and for display-only keys such as domain and group names, by English text
const CS = {
  // every page
  'Main': 'Hlavní menu',
  'Log in': 'Přihlásit se',
  'Switching & Routing': 'Switching a routing',
  'Troubleshooting': 'Řešení problémů',
  'Beginner': 'Začátečník',
  'Intermediate': 'Mírně pokročilý',
  'Advanced': 'Pokročilý',
  'Labs': 'Laby',
  'Reference': 'Přehled',
  'Sandbox': 'Sandbox',
  'Topology': 'Topologie',
  'Mock exam': 'Cvičný test',
  'Difficulty': 'Obtížnost',
  'Search topics': 'Hledat témata',
  'Choose a difficulty, then start a lab.': 'Zvol obtížnost a spusť lab.',
  // the lab page (both tracks)
  'Back to labs': 'Zpět na laby',
  'New network': 'Nová síť',
  'New lab': 'Nový lab',
  'Reset': 'Od začátku',
  'Check': 'Zkontrolovat',
  'Scenario': 'Scénář',
  'Requirements': 'Požadavky',
  "Commands you'll need": 'Příkazy, které budeš potřebovat',
  'CLI input': 'Vstup příkazového řádku',
  'Short forms work: en, conf t, int g0/0, sh ip int br, no sh.': 'Fungují i zkratky: en, conf t, int g0/0, sh ip int br, no sh.',
  'Click a device to open its console.': 'Klikni na zařízení a otevře se jeho konzole.',
  // the Reference page (both tracks)
  'Topics': 'Témata',
  'Commands': 'Příkazy',
  'Search topics and commands': 'Hledat témata a příkazy',
  'Search the topics': 'Hledat v tématech',
  'No topics match.': 'Žádné téma neodpovídá.',
  'No commands match.': 'Žádný příkaz neodpovídá.',
  'Command': 'Příkaz',
  'Mode': 'Režim',
  'Purpose': 'Účel',
  'Topic': 'Téma',
  // Switching page
  'Build network topologies straight from your browser.': 'Stavěj síťové topologie přímo v prohlížeči.',
  'Sandbox sections': 'Části sandboxu',
  'My workspace': 'Můj prostor',
  'Guided labs': 'Laby s vedením',
  'Build and share from your browser': 'Stavěj a sdílej z prohlížeče',
  'An empty canvas: add devices, cable them, and configure each one from its console. Your work is saved in this browser.':
    'Prázdné plátno: přidej zařízení, propoj je kabely a každé nastav z jeho konzole. Práce se ukládá v tomto prohlížeči.',
  'Open my workspace →': 'Otevřít můj prostor →',
  'Practise guided labs': 'Procvič si laby s vedením',
  'Pick a topic and difficulty, follow the lab, and configure each device from its console.':
    'Vyber téma a obtížnost, postupuj podle labu a každé zařízení nastav z jeho konzole.',
  'Browse labs →': 'Procházet laby →',
  'Find and fix faults in a broken network.': 'Najdi a oprav chyby v rozbité síti.',
  'Cable the devices together to match each task.': 'Propoj zařízení kabely tak, aby odpovídala zadání.',
  'New task': 'Nové zadání',
  'Task': 'Zadání',
  'Drag the devices you need from the bar onto the canvas, then cable them.': 'Přetáhni potřebná zařízení z lišty na plátno a propoj je.',
  'Remove selected': 'Odebrat vybrané',
  'Clear all': 'Vymazat vše',
  'Drag onto the canvas:': 'Přetáhni na plátno:',
  'Multilayer switch': 'Multilayer switch',
  'Notebook': 'Notebook',
  'Printer': 'Tiskárna',
  'Access point': 'Přístupový bod',
  'Cable:': 'Kabel:',
  'Straight-through': 'Přímý',
  'Crossover': 'Křížený',
  'Fiber': 'Optický',
  'Coaxial': 'Koaxiální',
  'Straight-through for unlike devices · Crossover for like devices · Fiber for long links · Serial for WAN · Console for management · Coaxial for cable broadband':
    'Přímý pro různá zařízení · Křížený pro stejná zařízení · Optický pro dlouhé linky · Serial pro WAN · Console pro správu · Koaxiální pro kabelový internet',
  'Drag a device to move it. Click one device, then another, to cable them.': 'Zařízení přesuneš tažením. Kabel vedeš kliknutím na jedno zařízení a pak na druhé.',
  'A set of labs at one difficulty, with or without a time limit. Pass mark 80%.': 'Sada labů v jedné obtížnosti, s časovým limitem nebo bez něj. Na úspěch je potřeba 80 %.',
  'CCNA exams': 'Testy CCNA',
  'Choose an exam. Questions are drawn at random from its pool.': 'Vyber test. Otázky se losují z jeho sady.',
  'CCNA command reference': 'Přehled příkazů CCNA',
  'Each topic covered by the labs, grouped by CCNA area, plus every console command in one searchable list.':
    'Všechna témata z labů podle oblastí CCNA a k tomu všechny příkazy konzole v jednom prohledávatelném seznamu.',
  'Search commands, e.g. vlan, ospf, show ip': 'Hledat příkazy, např. vlan, ospf, show ip',
  'Search console commands': 'Hledat příkazy konzole',
  // Linux page
  'Choose a difficulty, then start a lab on a simulated Ubuntu terminal.': 'Zvol obtížnost a spusť lab na simulovaném terminálu Ubuntu.',
  'Terminal': 'Terminál',
  'Terminal input': 'Vstup terminálu',
  'Tab completes commands and paths. Up/Down for history. Type help for every command this terminal knows.':
    'Tab doplní příkazy a cesty. Šipky nahoru a dolů procházejí historii. Příkaz help vypíše všechny příkazy, které terminál zná.',
  'Linux command reference': 'Přehled příkazů Linuxu',
  'Each topic covered by the labs, with its commands and options, plus every command in one searchable list.':
    'Všechna témata z labů s jejich příkazy a volbami a k tomu všechny příkazy v jednom prohledávatelném seznamu.',
  'Search commands, e.g. chmod, grep -r, ls -l': 'Hledat příkazy, např. chmod, grep -r, ls -l',
  'Search the commands': 'Hledat v příkazech',
  'Options': 'Volby',
  // sandbox page
  'Sandbox files': 'Soubory sandboxu',
  'Name this sandbox': 'Pojmenuj tento sandbox',
  'Undo (Ctrl+Z)': 'Zpět (Ctrl+Z)',
  'Undo': 'Zpět',
  'Export': 'Exportovat',
  'Import': 'Importovat',
  'Copy share link': 'Kopírovat odkaz pro sdílení',
  'Tools': 'Nástroje',
  'Canvas tools': 'Nástroje plátna',
  'Tool': 'Nástroj',
  'Select': 'Vybrat',
  'Cable': 'Kabel',
  'Copy': 'Kopírovat',
  'Delete': 'Smazat',
  'Cancel': 'Zrušit',
  'Device garage': 'Garáž zařízení',
  'Reset view': 'Obnovit pohled',
  'Clear canvas': 'Vymazat plátno',
  'Add a device to begin.': 'Začni přidáním zařízení.',
  'Hide console': 'Skrýt konzoli',
  'Packet test': 'Test paketu',
  'Send a ping from a PC. The answer comes from the real configuration of the devices on the way.':
    'Pošli ping z PC. Odpověď vychází ze skutečné konfigurace zařízení na cestě.',
  'Source PC': 'Zdrojové PC',
  'Destination IP address': 'Cílová IP adresa',
  'Destination IP, e.g. 192.168.20.10': 'Cílová IP, např. 192.168.20.10',
  'Send ping': 'Poslat ping',
  'Presets and saved sandboxes': 'Předvolby a uložené sandboxy',
  'Search presets': 'Hledat předvolby',
  'Saved sandboxes': 'Uložené sandboxy',
  // Reference groups (REF_GROUPS in js/topics.js; Troubleshooting and Switching are above or read the same)
  'Core': 'Základ',
  'IP & routing': 'IP a routing',
  'Services': 'Služby',
  'Security': 'Zabezpečení',
  'Wireless': 'Bezdrátové sítě',
  'Management': 'Správa',
  // Linux Reference groups (LINUX_REF_GROUPS)
  'Files and navigation': 'Soubory a navigace',
  'Text and search': 'Text a hledání',
  'Permissions and users': 'Oprávnění a uživatelé',
  'Processes and packages': 'Procesy a balíčky',
  // landing page and Profile
  'Pick what to practise: random labs on a simulated command line, graded as you type.':
    'Vyber si, co chceš procvičit: náhodné laby na simulovaném příkazovém řádku, hodnocené už během psaní.',
  'Cisco IOS labs: VLANs, trunks, routing, services and security, plus the sandbox and mock exams.':
    'Laby v Cisco IOS: VLANy, trunky, routing, služby a zabezpečení, k tomu sandbox a cvičné testy.',
  'The bash command line: files, text, permissions, users, processes and packages on Ubuntu.':
    'Příkazový řádek bash: soubory, text, oprávnění, uživatelé, procesy a balíčky na Ubuntu.',
  'Open →': 'Otevřít →',
  'Profile': 'Profil',
  'Your account and how ls-labbing looks for you.': 'Tvůj účet a to, jak pro tebe ls-labbing vypadá.',
  'Log in to see your profile.': 'Pro zobrazení profilu se přihlas.',
  'Account': 'Účet',
  'Email': 'E-mail',
  'Member since': 'Členem od',
  'Last login': 'Poslední přihlášení',
  'Log out': 'Odhlásit se',
  'Change password': 'Změna hesla',
  'New password (8+ characters)': 'Nové heslo (aspoň 8 znaků)',
  'New password': 'Nové heslo',
  'Confirm new password': 'Nové heslo znovu',
  'Update password': 'Změnit heslo',
  'Customize': 'Přizpůsobení',
  'Nickname': 'Přezdívka',
  'Shown on the site instead of your email': 'Zobrazí se na webu místo e-mailu',
  'Accent colour': 'Barva zvýraznění',
  'Save': 'Uložit',
  'Day streak': 'Denní série',
  'day streak': 'dní v řadě',
  'Best': 'Nejlepší',
  'Resets in': 'Vyprší za',
  'Progress': 'Postup',
  // the accent colour names (keys of ACCENTS in auth.js)
  'Blue': 'Modrá', 'Green': 'Zelená', 'Amber': 'Jantarová', 'Pink': 'Růžová', 'Purple': 'Fialová', 'Teal': 'Tyrkysová',
};
const tr = en => (LANG === 'cs' && CS[en]) || en;

// the Czech plural: 1 host, 2-4 hosty, 0 or 5+ hostů
const cz = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

// what auth.js does with the account's saved language: push a choice made on this device (pending), pull a different
// valid saved one (then reload once), else nothing. user_metadata is user-editable, so only known languages count.
const langSync = (meta, pending) => (pending ? 'push' : LANGS.includes(meta.lang) && meta.lang !== LANG ? 'pull' : null);

function setLang(lang) {
  localStorage.setItem('lang', lang);
  localStorage.setItem('langPending', '1');
  location.reload();
}

if (typeof document !== 'undefined') {
  document.documentElement.lang = LANG;
  // own text nodes only, so a <label>'s <input> survives
  document.querySelectorAll('[data-i18n]').forEach(e => {
    // looked up with runs of whitespace as one space, as test/i18n.test.js checks the markup
    for (const n of e.childNodes) if (n.nodeType === 3 && n.data.trim()) n.data = n.data.replace(n.data.trim(), tr(n.data.trim().replace(/\s+/g, ' ')));
    for (const a of ['placeholder', 'aria-label', 'title']) if (e.hasAttribute(a)) e.setAttribute(a, tr(e.getAttribute(a)));
  });
  const other = LANG === 'cs' ? 'en' : 'cs';
  const sw = document.createElement('button');
  sw.type = 'button';
  sw.className = document.querySelector('nav.side') ? 'nav-item' : 'ghost';
  sw.textContent = other.toUpperCase().replace('CS', 'CZ');
  sw.setAttribute('aria-label', other === 'cs' ? 'Čeština' : 'English');
  sw.lang = other;
  sw.addEventListener('click', () => setLang(other));
  (document.querySelector('nav.side') || document.querySelector('.sb-bar')).append(sw);
}
