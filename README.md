# 🦆 DuckyTagger

A **DuckyTagger** egy villámgyors, pehelysúlyú asztali fájlkereső és dokumentumkezelő (DMS) rendszer, amelyet kifejezetten nagy méretű hálózati meghajtók (NAS) és lokális mappák kezelésére fejlesztettünk ki. 

A modern **Rust + Tauri** architektúrának köszönhetően a program drasztikusan kevesebb memóriát és processzoridőt használ (üresjáratban mindössze ~4 MB RAM, 0% CPU), mint a hagyományos Electron alapú alkalmazások.

---

## ✨ Fő funkciók

* **🚀 Villámgyors Keresés:** O(1) komplexitású JSON indexelés, amivel több százezer fájlban is milliszekundumok alatt kereshetsz (többszavas `AND` logikával és kiterjesztés szűréssel).
* **🏷️ Hierarchikus Tömeges Címkézés:** Kijelölhetsz mappákat vagy fájlokat, és tömegesen adhatsz hozzájuk (vagy törölhetsz róluk) egyedi címkéket (Tageket). A mappára alkalmazott címkét az összes benne lévő almappa és fájl is megörökli!
* **🔄 Automatikus Háttérszinkronizálás (AutoSync):** Beállítható időközönként (pl. 15 perc, 1 óra) a háttérben, némán szkenneli a NAS tartalmát, és frissíti az adatbázist.
* **🛡️ Címke-Túlélés (Tag Persistence):** Fájlmódosítás vagy újraszinkronizálás esetén az egyedileg felvitt címkék nem vesznek el.
* **🌙 Rendszertálca (System Tray) Integráció:** Bezáráskor nem áll le, hanem a Windows óra mellé rejti magát, így a szinkronizáció zavartalanul fut a háttérben.
* **🌍 Többnyelvű Felület (i18n):** Beépített magyar és angol nyelv, amely azonnal, újraindítás nélkül váltható.
* **📁 Natív Rendszerhívások:** Közvetlen gombok a fájlok megnyitására a Windows alapértelmezett programjaival, vagy "ugrás" a fájlhoz az Intézőben (kijelöléssel).

---

## 🛠️ Technológiai Stack

* **Backend / Motor:** [Rust](https://www.rust-lang.org/) (Villámgyors, memóriabiztos fájlrendszer-bejárás és adatbázis-kezelés)
* **Frontend:** Tiszta HTML5, CSS3, és Vanilla JavaScript (Nincs React/Vue overhead)
* **Keretrendszer:** [Tauri](https://tauri.app/) (A Chromium/WebView2 motort használja a vizuális megjelenítéshez, natív Windows API hívásokkal)

---

## 📦 Telepítés és Futtatás (Fejlesztőknek)

### Előfeltételek
Győződj meg róla, hogy a gépeden telepítve vannak a következők:
1. **Node.js** (és npm)
2. **Rust** (rustup)
3. Windows esetén a **C++ Build Tools** (Visual Studio-n keresztül)

### Projekt klónozása és indítása
1. Telepítsd a webes függőségeket:
   ```bash
   npm install
Futtasd a programot fejlesztői módban (Hot-Reload funkcióval):

Bash
npm run tauri dev
🏗️ Build / Végleges verzió elkészítése
Ha elkészültél a fejlesztéssel, és szeretnéd legenerálni a hordozható .exe és a telepíthető .msi fájlokat, használd a build parancsot:

Bash
npm run tauri build
A kész telepítőt a src-tauri/target/release/bundle/msi/ mappában, a hordozható .exe-t pedig a src-tauri/target/release/ mappában találod.

Tipp tárhely felszabadításához: A Rust rengeteg átmeneti fájlt generál a fordítás során. Ha le szeretnéd takarítani a projektet (akár 10+ GB helyet felszabadítva):

Bash
cd src-tauri
cargo clean
📖 Használati útmutató
Adatbázis és Mappák: A fejlécben nyisd le a Beállítások panelt. Add meg a NAS vagy a lokális géped mappáit (soronként egyet).

Első Szinkronizáció: Nyomj rá a Szinkronizálás Indítása gombra. Várd meg, amíg a folyamatjelző végez.

AutoSync: Pipáld be az Automatikus háttérszinkronizálás opciót, válaszd ki a gyakoriságot, és onnantól a DuckyTagger magától intézi a frissítéseket.

Címkézés: Keress rá valamire, pipáld be a bal oldali checkboxokat (vagy használd a Mind kijelölése gombot). Alul felugrik a Tömeges Szerkesztő panel, ahol vesszővel elválasztva adhatsz hozzá új tageket!
