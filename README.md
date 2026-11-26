🇬🇧 English · [🇨🇿 Čeština](README.cs.md)

# ls-labbing
 
A web-based virtual lab for practising the command line. It has two tracks: **Switching & Routing** in the style of Cisco labs, and **Linux** on a simulated Ubuntu terminal. Pick a difficulty, start a lab and work right in your browser. The lab is graded as you type.
 
🔗 **Live version:** https://switching-lab.netlify.app/
 
<img width="1877" height="957" alt="image" src="https://github.com/user-attachments/assets/8a31d814-0a5e-4f49-908d-466597cb847e" />

## 🌐 Language
The site is in English and Czech. The **CZ / EN** switch is in the top bar of every page. On your first visit the language follows your browser; after that it follows your choice (saved to your account when you are logged in). Device output, commands and the CCNA questions stay in English, as on real devices and in the official courses.

## 🐧 Linux
The bash command line on a simulated Ubuntu 24.04: **13 topics** at **4 difficulties**.
- **Topics:** navigation, files and directories, viewing files, searching, pipes and redirection, permissions and ownership, users, groups and sudo, processes, packages (apt), wildcards and quoting, editing text (`sed`, `tr`, `tee`), services (`systemctl`, `journalctl`), and a broken system to fix (on its own **Troubleshooting** page)
- **Terminal:** Tab completes commands and paths, Up/Down walk the history, `help` lists every command the terminal knows
- Error messages match the real GNU tools and bash
- Its own **Reference** with the commands and their options

## 🧪 Labs
Practise switching and routing along the CCNA syllabus: **38 topics** at **4 difficulties** (Beginner, Intermediate, Advanced, Expert).
- **Hints** – up to 3 per requirement: the first points to the device and mode, the second shows the syntax, the third the remaining commands. Hints react to what you have already typed
- **Hint cost** – each hint used lowers the score by 2 / 4 / 6 / 8 percentage points by difficulty
- **Check** – shows the score, time, hints used, the state of every requirement and the reference solution

## 🛠️ Troubleshooting
Broken networks for you to fix. There are **7** topics, each at **4 difficulties**:
- Interface troubleshooting
- Trunk troubleshooting
- VLAN troubleshooting
- Inter-VLAN troubleshooting
- OSPF troubleshooting
- DHCP troubleshooting
- ACL troubleshooting

Every level starts with a faulty configuration, and your commands are the fix.

The Linux track has its own Troubleshooting page with **Broken system** at 4 difficulties: a web page that cannot be read, team directory access, a refused SSH key and an app that is down.
 
## 🔌 Topology
Learn to build a network and pick the right cabling between devices.
- **Devices:** router, switch, multilayer switch, DHCP server, PC, notebook, printer, access point, WLC
- **Cables:** straight-through, crossover; some tasks also need fiber, serial or console
- **Tasks:** at 4 difficulties, each says what to connect and how (for example a router to a switch, two routers over a serial link, a WLC with access points)
- **Controls:** drag devices onto the canvas, drag them to move them, and make a cable by clicking one device and then the other

## 🧰 Sandbox
A free space where you build your own topology and configure it from the console.
- **My workspace**: an empty canvas. Add devices (router, switch, multilayer switch, PC, up to 30), cable them, and configure each one from its console
- **Guided labs**: the labs from the Labs section, opened straight from the Sandbox
- **Packet test**: sends a ping between devices, so you can check the network works
- **Saving**: up to 20 named saves in the browser, plus **Export** and **Import** to a file, or **Copy share link** for a link (use Export for big networks)
- Saves live in this browser, not in your account

## 📝 Mock exam *(beta)*
A test made of random labs (at least one lab from each chosen topic): by difficulty, or your own mix (number of labs, difficulty, topics).
- The **time limit** is optional: 5, 8, 12 or 15 minutes per lab by difficulty (Beginner to Expert)
- **No help** – the test has no hints, command list or solutions
- **Grading:** you pass at 80%

## 🎓 CCNA
Multiple-choice tests following the official CCNA courses. Currently **CCNA 2 v7 (SRWE) Modules 1-4 Checkpoint Exam** with a bank of 75 questions, and the Modules 5-6 Redundant Networks Exam:
- **Start exam** – 33 random questions, you pass at 80%
- **Practice** – all 75 questions one by one; after **Check** you see the correct answer and move on
- **See questions** – browse all questions with their correct answers
- **Question types** – one or several correct answers, and matching or ordering with drop-down menus; some questions have a picture

## 📖 Reference
Stuck on a lab? The **CCNA command reference** has the commands, the mode each one is typed in, what it does, some theory and the most common mistakes. Topics are grouped by CCNA area, and all commands can be searched in one list. It also covers Structured troubleshooting: how to hunt down faults.
 
## 👤 Account
Log in to track your progress:
- **Progress**: the labs you have solved, by topic
- **Day streak**: a day counts when you solve 3 labs or topology tasks in it
- **Profile**: name, accent colour and password change
- Progress is saved to your account, so it is there on other devices after you log in

## 🎨 Styles
All styling is **Tailwind CSS** (v4, CLI). The source is `css/input.css`; the pages load only `css/output.css`.
- Colours and fonts are theme tokens in `@theme` (`--color-*`, `--font-*`), so you write `bg-surface`, `text-muted`, `border-border`, `text-accent`
- Static markup and JS templates both use utility classes
- `@layer components` in `css/input.css` is only for pieces JS builds over and over, or things utilities can't do (keyframes, `::before`, SVG, `details`)
- No new `.css` files, no `<style>` blocks and no inline `style`, except values JS computes at run time
- Netlify builds nothing, so after any change to styles, markup or classes in JS, run `npm run build:css` and commit `css/output.css` too

## 🌍 Translations
Each text sits next to its Czech version: `L('English', 'Česky')` in JS and data files, and `data-i18n` on markup with the Czech in `CS` in `js/i18n.js`. Missing Czech falls back to English. `npm test` checks that every page text has its Czech and that every lab passes in both languages.

## 📋 Plans and fixes
The current to-do list, fixes and QOL changes are on the [Milanote board](https://app.milanote.com/1XlAZz1AkO2qfh?p=MziMUNwVsQF). Finished items are marked done there and deleted at the end of the day. The change history is in the [commits](https://github.com/S1miDev/Switching-Lab/commits/main).
 
## 💬 Feedback
Found a bug, have an idea for a task or an improvement? Message me on Discord!
