[🇬🇧 English](README.md) · 🇨🇿 Čeština

# ls-labbing
 
Webové virtuální prostředí na procvičování příkazové řádky. Má dvě části: **Switching a routing** ve stylu Cisco labů a **Linux** na simulovaném terminálu Ubuntu. Vybereš si obtížnost, spustíš lab a pracuješ přímo v prohlížeči. Lab se hodnotí už během psaní.
 
🔗 **Živá verze:** https://switching-lab.netlify.app/
 
<img width="1877" height="957" alt="image" src="https://github.com/user-attachments/assets/8a31d814-0a5e-4f49-908d-466597cb847e" />

## 🌐 Jazyk
Web je česky i anglicky. Přepínač **CZ / EN** je v horní liště každé stránky. Při první návštěvě se jazyk řídí prohlížečem, potom tvou volbou (po přihlášení se ukládá k účtu). Výpisy zařízení, příkazy a otázky CCNA zůstávají anglicky, stejně jako na skutečných zařízeních a v oficiálních kurzech.

## 🐧 Linux
Příkazová řádka bash na simulovaném Ubuntu 24.04: **9 témat** ve **4 obtížnostech**.
- **Témata:** navigace, soubory a adresáře, prohlížení souborů, hledání, roury a přesměrování, oprávnění a vlastníci, uživatelé, skupiny a sudo, procesy, balíčky (apt)
- **Terminál:** Tab doplňuje příkazy a cesty, šipky procházejí historii, `help` vypíše všechny příkazy, které terminál zná
- Chybové hlášky odpovídají skutečným GNU nástrojům a bashi
- Vlastní **Reference** s příkazy a jejich volbami

## 🧪 Labs
Procvičování switchingu a routingu podle osnovy CCNA: **38 témat** ve **4 obtížnostech** (Beginner, Intermediate, Advanced, Expert).
- **Nápovědy** – u každého požadavku až 3: první navede k zařízení a režimu, druhá ukáže syntaxi, třetí zbývající příkazy. Nápovědy reagují na to, co jsi už zadal
- **Cena nápovědy** – každá použitá nápověda sníží výsledek o 2 / 4 / 6 / 8 procentních bodů podle obtížnosti
- **Check** – ukáže skóre, čas, počet nápověd, stav každého požadavku a referenční řešení

## 🛠️ Troubleshooting
Najdeš tu rozbité sítě, které musíš opravit. Témat je **6** a každé je ve **4 obtížnostech**:
- VLAN troubleshooting
- Trunk troubleshooting
- Inter-VLAN troubleshooting
- OSPF troubleshooting
- DHCP troubleshooting
- ACL troubleshooting
Každá úroveň začíná s chybnou konfigurací a tvé příkazy jsou oprava.
 
## 🔌 Topology
Nauč se sestavit síť a správně zvolit kabeláž mezi prvky.
- **Prvky:** router, switch, multilayer switch, DHCP server, PC, notebook, tiskárna, access point, WLC
- **Kabely:** straight-through, crossover, některé úlohy vyžadují i fiber, serial nebo console
- **Úlohy:** ve 4 obtížnostech, každá zadá, co a jak zapojit (např. router se switchem, dva routery sériovým spojem, WLC s access pointy)
- **Ovládání:** prvky přetáhneš na plochu, přesouvat je můžeš tažením, kabel vytvoříš kliknutím na jedno zařízení a poté na druhé
## 🧰 Sandbox
Volné prostředí, kde si sestavíš vlastní topologii a nastavíš ji z konzole.
- **My workspace** – prázdné plátno: přidáš zařízení (router, switch, multilayer switch, PC, max. 30), propojíš je kabely a každé nastavíš z konzole
- **Guided labs** – labs z části Labs, otevřené přímo ze Sandboxu
- **Packet test** – pošle ping mezi zařízeními, ověříš tak funkčnost sítě
- **Uložení** – až 20 pojmenovaných uložení v prohlížeči, dále **Export** a **Import** do souboru nebo **Copy share link** pro odkaz (u velkých sítí použij Export)
- Uložení je v tomto prohlížeči, ne v účtu
## 📝 Mock exam *(beta)*
Test sestavený z náhodných labů (alespoň jeden lab z každého zvoleného tématu): podle obtížnosti, nebo vlastní (počet úloh, obtížnost, témata nebo mix).
- **Časový limit** je volitelný: 5, 8, 12 nebo 15 minut na lab podle obtížnosti (Beginner až Expert)
- **Bez pomoci** – v testu nejsou nápovědy, seznam příkazů ani řešení
- **Hodnocení:** test je splněný od 80 %
## 🎓 CCNA
Testy s výběrovými otázkami podle oficiálních CCNA kurzů. Aktuálně **CCNA 2 v7 (SRWE) Modules 1-4 Checkpoint Exam** s bankem 75 otázek a **Modules 5-6 Redundant Networks Exam**:
- **Start exam** – 33 náhodných otázek, test je splněný od 80 %
- **Practice** – všech 75 otázek po jedné, po **Check** uvidíš správnou odpověď a pokračuješ dál
- **See questions** – projdeš všechny otázky se správnými odpověďmi
- **Typy otázek** – výběr jedné nebo více odpovědí a přiřazování nebo řazení přes rozbalovací nabídky; některé otázky mají obrázek
## 📖 Reference
Nevíš si rady s labem? Najdeš tu **CCNA command reference**: příkazy, v jakém módu se zadávají, k čemu slouží, trochu teorie a nejčastější chyby. Témata jsou seřazená podle oblastí CCNA a příkazy jdou prohledat v jednom seznamu. Součástí je i téma Structured troubleshooting, tedy postupy hledání závad.
 
## 👤 Účet
Po přihlášení si můžeš trackovat svůj progress:
- **Progress** – přehled splněných úloh po tématech
- **Day streak** – den se počítá, když v něm vyřešíš 3 labs nebo topology úlohy
- **Profil** – jméno, barva zvýraznění a změna hesla
- Postup se ukládá k účtu, takže je po přihlášení dostupný i na jiných zařízeních
## 🎨 Styly
Všechny styly jsou v **Tailwind CSS** (v4, CLI). Zdroj je `css/input.css`, stránky načítají jen `css/output.css`.
- Barvy a fonty jsou theme tokeny v `@theme` (`--color-*`, `--font-*`), takže se píše `bg-surface`, `text-muted`, `border-border`, `text-accent`
- Statický markup i šablony v JS používají utility třídy
- `@layer components` v `css/input.css` jen pro kusy, které JS opakuje, nebo co utility neumí (keyframes, `::before`, SVG, `details`)
- Žádné nové `.css` soubory, žádné `<style>` bloky a žádné inline `style`, kromě hodnot, které JS spočítá za běhu
- Netlify nic nebuildí, takže po každé změně stylů, markupu nebo tříd v JS spusť `npm run build:css` a commitni i `css/output.css`
## 🌍 Překlady
Každý text je vedle své české verze: `L('English', 'Česky')` v JS a datových souborech a `data-i18n` v markupu, s češtinou v `CS` v `js/i18n.js`. Kde čeština chybí, zobrazí se angličtina. `npm test` kontroluje, že každý text stránky má češtinu a že každý lab projde v obou jazycích.
## 📋 Plány a opravy
Aktuální to-do list, opravy a QOL změny najdeš na [Milanote boardu](https://app.milanote.com/1XlAZz1AkO2qfh?p=MziMUNwVsQF). Dokončené úkoly jsou tam označené jako hotové a na konci dne se smažou. Historii změn najdeš v [commitech](https://github.com/S1miDev/Switching-Lab/commits/main).
 
## 💬 Zpětná vazba
Našel jsi chybu, máš nápad na úlohu nebo zlepšení? Napiš mi na discord!
