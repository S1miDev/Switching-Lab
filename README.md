# Switching-Lab

Webové virtuální prostředí na switching a routing ve stylu Cisco labů. Vybereš si obtížnost, spustíš lab a konfiguruješ síť přímo v prohlížeči přes konzoli zařízení.

🔗 **Živá verze:** https://switching-lab.netlify.app/

<img width="1866" height="966" alt="Snímek obrazovky 2026-11-03 191754" src="https://github.com/user-attachments/assets/cde79d8f-6506-464f-ba29-fb2e44ba1cb3" />

## 🧪 Labs
Procvičování switchingu a routingu podle osnovy CCNA: **37 témat** ve **4 obtížnostech** (Beginner, Intermediate, Advanced, Expert).

Každý lab obsahuje:
- **Requirements** – seznam zadání s počítadlem splněných bodů (např. 0/5), podle kterého ověříš, že máš hotovo
- **Topologii** – kliknutím na zařízení otevřeš jeho **konzoli** a zadáváš příkazy
- **Commands you'll need** – nápověda k příkazům, které se v úloze hodí
- **Check** – zkontroluje všechny požadavky; po kontrole se konzole zamkne až do resetu
- **Časovač** – počítá čas od otevření labu
- **Reset** – vrátí lab do výchozího stavu
- **New network** – vygeneruje novou náhodnou úlohu
- **Referenční řešení** – v okně výsledku po kontrole zobrazí řešení po jednotlivých zařízeních, u nesplněných požadavků nápovědu

## 🛠️ Troubleshooting
Najdeš tu rozbité sítě, které musíš opravit. Témata jsou **5** a každé je ve **4 obtížnostech**:
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

## 📝 Mock exam *(beta)*
Test sestavený z náhodných labů (alespoň jeden lab z každého zvoleného tématu): podle obtížnosti, nebo vlastní (počet úloh, obtížnost, témata nebo mix).
- **Časový limit** je volitelný a roste s obtížností
- **Hodnocení:** test je splněný od 80 %

## 📖 Reference
Nevíš si rady s labem? Najdeš tu příkazy, v jakém módu se zadávají, k čemu slouží, trochu teorie a nejčastější chyby. Součástí je i téma Structured troubleshooting, tedy postupy hledání závad.

## 👤 Účet
Po přihlášení si můžeš trackovat svůj progress:
- **Progress** – přehled splněných úloh po tématech
- **Day streak** – den se počítá, když v něm vyřešíš 3 labs nebo topology úlohy
- **Profil** – jméno, barva zvýraznění a změna hesla
- Postup se ukládá k účtu, takže je po přihlášení dostupný i na jiných zařízeních

## 🚧 Ve vývoji
- [ ] **Sandbox**: volné prostředí pro vlastní topologii a konfiguraci

Hotovo:
- [x] **Progress** a day streak na profilu
- [x] Synchronizace postupu mezi zařízeními (přes účet)

📋 Aktuální to-do list, opravy a QOL změny najdeš na [Milanote boardu](https://app.milanote.com/1XlAZz1AkO2qfh?p=MziMUNwVsQF). Dokončené úkoly jsou tam označené jako hotové a na konci dne se smažou. Historii změn najdeš v [commitech](https://github.com/S1miDev/Switching-Lab/commits/main).

## 💬 Zpětná vazba
Našel jsi chybu, máš nápad na úlohu nebo zlepšení? Napiš mi na discord!
