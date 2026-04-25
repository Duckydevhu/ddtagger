/**
 * ============================================================================
 * DUCKYTAGGER - FRONTEND LOGIKA (JavaScript)
 * ============================================================================
 * Ez a fájl felel a felhasználói felület (UI) működéséért, és ez tartja a 
 * kapcsolatot a villámgyors Rust backenddel a Tauri keretrendszeren keresztül.
 */

// A 'DOMContentLoaded' biztosítja, hogy a JavaScript csak azután induljon el, 
// miután a teljes HTML betöltődött. Ha ezt nem tennénk, a JS nem találná meg a gombokat.
document.addEventListener("DOMContentLoaded", () => {

    /**
     * 1. TAURI API BEKÖTÉSE
     * Itt hidaljuk át a szakadékot a webes felület (JS) és a gépi kód (Rust) között.
     * A "fallback" (azaz a '? :' operátor) azért van benne, mert a Tauri különböző 
     * verzióiban máshol lehetnek ezek a függvények.
     */
    // 'invoke': Ezzel tudunk parancsokat küldeni a Rust-nak (pl. "Keresd meg ezt!").
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
    // 'listen': Ezzel tudunk "hallgatózni", ha a Rust küldene nekünk valamit (pl. Progress bar állása).
    const listen = window.__TAURI__.event ? window.__TAURI__.event.listen : window.__TAURI__.tauri.listen;

    /**
     * 2. TÖBBNYELVŰSÉGI (i18n) SZÓTÁR
     * Ez a "Lokalizáció". Egyetlen hatalmas objektumban tároljuk az összes szöveget.
     * Ha a jövőben hozzá akarsz adni egy német (de) verziót, csak be kell másolnod 
     * ide egy új blokkot, és a kód automatikusan kezelni fogja!
     */
    const translations = {
        hu: {
            appTitle: "DuckyTagger",
            searchTitle: "🔍 Gyorskereső:",
            searchInput: "Gépelj szavakat... (pl. rendezett ducky 2024)",
            extFilter: "Kit. (pl. pdf)",
            searchBtn: "Keresés",
            settingsTitle: "⚙️ Beállítások",
            dbPathLabel: "Index fájl (JSON) mentési helye:",
            dbPathPlaceholder: "Alapértelmezett: program mappája",
            folderPlaceholder: "Szkennelendő mappák (soronként egyet adj meg!)",
            scanBtn: "▶ Szinkronizálás Indítása",
            autoSync: "Automatikus háttérszinkronizálás",
            interval: "Gyakoriság:",
            resultsTitle: "Eredmények:",
            noResults: "Nincs találat.",
            loading: "Szkennelés folyamatban...",
            success: "✅ Szinkronizáció sikeres!",
            error: "Hiba történt:",
            open: "▶ Megnyitás",
            jump: "📍 Ugrás",
            created: "📅 Létrehozva:",
            modified: "🕒 Módosítva:",
            dbDefault: "(Adatbázis: A program mappájában)",
            sort_mod_desc: "Legújabb (Módosítás)",
            sort_mod_asc: "Legrégebbi (Módosítás)",
            sort_cre_desc: "Legújabb (Létrehozás)",
            sort_name_asc: "Név (A-Z)",
            sort_name_desc: "Név (Z-A)",
            syncOffline: "⚠️ A NAS nem elérhető, szinkronizálás kihagyva.",
            progressText: "⏳ Adatok olvasása a lemezről...",
            filesWord: " elem",
            selectedText: "elem kijelölve",
            newTagsPlaceholder: "Címkék (vesszővel elválasztva...)",
            applyTags: "Hozzáadás",
            removeTags: "Törlés",
            tagsSuccess: "✅ Címkék sikeresen módosítva!",
            removeSuccess: "✅ Címkék sikeresen eltávolítva (hierarchikusan is)!",
            fileNotFound: "❌ Ez a fájl vagy mappa már nem létezik (valószínűleg törölték).",
            selectAll: "☑ Mind kijelölése",
            deselectAll: "☐ Kijelölés törlése",
            autoSyncOn: "AutoSync: BE",
            autoSyncOff: "AutoSync: KI",
            lastSync: "Utolsó szink.: ",
            never: "Soha"
        },
        en: {
            appTitle: "DuckyTagger",
            searchTitle: "🔍 Quick Search:",
            searchInput: "Type keywords... (e.g. ducky sorted 2024)",
            extFilter: "Ext. (e.g. pdf)",
            searchBtn: "Search",
            settingsTitle: "⚙️ Settings",
            dbPathLabel: "Index file (JSON) storage path:",
            dbPathPlaceholder: "Default: application folder",
            folderPlaceholder: "Folders to scan (one per line!)",
            scanBtn: "▶ Start Sync",
            autoSync: "Enable background auto-sync",
            interval: "Frequency:",
            resultsTitle: "Results:",
            noResults: "No results found.",
            loading: "Scanning in progress...",
            success: "✅ Sync successful!",
            error: "An error occurred:",
            open: "▶ Open",
            jump: "📍 Jump",
            created: "📅 Created:",
            modified: "🕒 Modified:",
            dbDefault: "(Database: In program folder)",
            sort_mod_desc: "Newest (Modified)",
            sort_mod_asc: "Oldest (Modified)",
            sort_cre_desc: "Newest (Created)",
            sort_name_asc: "Name (A-Z)",
            sort_name_desc: "Name (Z-A)",
            syncOffline: "⚠️ NAS unreachable, sync skipped.",
            progressText: "⏳ Reading data from disk...",
            filesWord: " items",
            selectedText: "items selected",
            newTagsPlaceholder: "Tags (comma separated...)",
            applyTags: "Add Tags",
            removeTags: "Remove Tags",
            tagsSuccess: "✅ Tags successfully modified!",
            removeSuccess: "✅ Tags successfully removed (hierarchically)!",
            fileNotFound: "❌ This file or folder no longer exists (likely deleted).",
            selectAll: "☑ Select All",
            deselectAll: "☐ Deselect All",
            autoSyncOn: "AutoSync: ON",
            autoSyncOff: "AutoSync: OFF",
            lastSync: "Last sync: ",
            never: "Never"
        }
    };

    /**
     * 3. ÁLLAPOT (STATE) VÁLTOZÓK
     * Ezek azok az adatok, amik a program futása közben változnak.
     */
    // Megnézzük, van-e elmentett nyelv a böngésző helyi memóriájában, ha nincs, magyar lesz.
    let currentLang = localStorage.getItem("ducky_lang") || "hu";

    // A 'Set' egy speciális tömb, ami garantálja, hogy egy elem csak egyszer szerepelhet benne.
    // Így ha kétszer kattintasz egy checkboxra, nem kerül be kétszer ugyanaz az útvonal!
    let selectedPaths = new Set();

    // Itt tároljuk a jelenleg a képernyőn látható (leszűrt) fájlokat a "Mind kijelölése" funkcióhoz.
    let currentVisiblePaths = [];

    /**
     * 4. UI ELEMEK CACHE-ELÉSE
     * Teljesítmény-optimalizáció: Ahelyett, hogy minden egyes kattintáskor 
     * lefutna a lassú 'document.getElementById', az induláskor egyszer 
     * kikeresünk mindent, és eltároljuk ebbe az 'ui' nevű objektumba.
     */
    const ui = {
        appTitle: document.getElementById("appTitle"),
        searchTitle: document.getElementById("searchTitle"),
        searchInput: document.getElementById("searchInput"),
        extFilter: document.getElementById("extFilter"),
        executeSearchBtn: document.getElementById("executeSearchBtn"),
        settingsTitle: document.getElementById("settingsTitle"),
        dbPathLabel: document.getElementById("dbPathLabel"),
        dbPathInput: document.getElementById("dbPathInput"),
        folderInput: document.getElementById("folderInput"),
        scanBtn: document.getElementById("scanBtn"),
        autoSyncLabel: document.getElementById("autoSyncLabel"),
        intervalLabel: document.getElementById("intervalLabel"),
        resultsTitle: document.getElementById("resultsTitle"),
        sortBy: document.getElementById("sortBy"),
        fileList: document.getElementById("fileList"),
        dbPathDisplay: document.getElementById("dbPathDisplay"),
        langHu: document.getElementById("langHu"),
        langEn: document.getElementById("langEn"),
        settingsToggle: document.getElementById("settingsToggle"),
        settingsContent: document.getElementById("settingsContent"),
        settingsArrow: document.getElementById("settingsArrow"),
        autoSyncCheck: document.getElementById("autoSyncCheck"),
        autoSyncInterval: document.getElementById("autoSyncInterval"),
        progressContainer: document.getElementById("progressContainer"),
        progressTextLabel: document.getElementById("progressTextLabel"),
        progressCount: document.getElementById("progressCount"),
        bulkEditPanel: document.getElementById("bulkEditPanel"),
        selectedCountDisplay: document.getElementById("selectedCountDisplay"),
        selectedCountText: document.getElementById("selectedCountText"),
        newTagsInput: document.getElementById("newTagsInput"),
        applyTagsBtn: document.getElementById("applyTagsBtn"),
        removeTagsBtn: document.getElementById("removeTagsBtn"),
        selectAllBtn: document.getElementById("selectAllBtn"),
        autoSyncBadge: document.getElementById("autoSyncBadge"),
        lastSyncBadge: document.getElementById("lastSyncBadge")
    };

    /**
     * 5. SEGÉDFÜGGVÉNYEK (HELPER FUNCTIONS)
     */

    // Frissíti a "Beállítások" felirat melletti kis jelvényeket (AutoSync BE/KI, és a dátum).
    function updateSyncBadges() {
        const t = translations[currentLang];

        // Ellenőrizzük, hogy be van-e pipálva az AutoSync
        const isOn = ui.autoSyncCheck.checked;
        ui.autoSyncBadge.textContent = isOn ? t.autoSyncOn : t.autoSyncOff;
        ui.autoSyncBadge.className = isOn ? "badge-on" : "badge-off"; // A CSS osztály cseréjével változik a szín (zöld/piros)

        // Timestamp (időbélyeg) formázása olvasható dátummá.
        const ts = localStorage.getItem("ducky_last_sync_ts");
        let syncTimeStr = t.never;
        if (ts) {
            const dateObj = new Date(parseInt(ts));
            // A toLocaleString automatikusan igazodik a választott nyelvhez! (AM/PM vs. 24h formátum)
            syncTimeStr = dateObj.toLocaleString(currentLang === 'hu' ? 'hu-HU' : 'en-US');
        }
        ui.lastSyncBadge.textContent = `${t.lastSync} ${syncTimeStr}`;
    }

    // Végigmegy az összes UI elemen, és lecseréli a szövegüket a kiválasztott nyelv alapján.
    function applyLanguage() {
        const t = translations[currentLang];

        // Feliratok és Placeholderek (háttérszövegek) cseréje
        ui.appTitle.textContent = t.appTitle;
        ui.searchTitle.textContent = t.searchTitle;
        ui.searchInput.placeholder = t.searchInput;
        ui.extFilter.placeholder = t.extFilter;
        ui.executeSearchBtn.textContent = t.searchBtn;
        ui.settingsTitle.textContent = t.settingsTitle;
        ui.dbPathLabel.textContent = t.dbPathLabel;
        ui.dbPathInput.placeholder = t.dbPathPlaceholder;
        ui.folderInput.placeholder = t.folderPlaceholder;
        ui.scanBtn.textContent = t.scanBtn;
        ui.autoSyncLabel.textContent = t.autoSync;
        ui.intervalLabel.textContent = t.interval;
        ui.resultsTitle.textContent = t.resultsTitle;
        ui.progressTextLabel.textContent = t.progressText;
        ui.selectedCountText.textContent = t.selectedText;
        ui.newTagsInput.placeholder = t.newTagsPlaceholder;
        ui.applyTagsBtn.textContent = t.applyTags;
        ui.removeTagsBtn.textContent = t.removeTags;

        // A legördülő menüt (Select) teljesen újraépítjük, megtartva a jelenleg kiválasztott értéket.
        const currentSort = ui.sortBy.value || "modified_desc";
        ui.sortBy.innerHTML = `<option value="modified_desc">${t.sort_mod_desc}</option><option value="modified_asc">${t.sort_mod_asc}</option><option value="created_desc">${t.sort_cre_desc}</option><option value="name_asc">${t.sort_name_asc}</option><option value="name_desc">${t.sort_name_desc}</option>`;
        ui.sortBy.value = currentSort;

        // Gombok "aktív" stílusának váltása (ami mutatja, melyik nyelv van kiválasztva)
        ui.langHu.classList.toggle("active", currentLang === "hu");
        ui.langEn.classList.toggle("active", currentLang === "en");

        // UI részegységek frissítése az új nyelvvel
        updateSelectAllButtonState();
        updateDbPathDisplay();
        updateSyncBadges();
        updateBulkPanel();
        performSearch();
    }

    // Nyelvválasztó gombok eseménykezelői
    ui.langHu.addEventListener("click", () => { currentLang = "hu"; localStorage.setItem("ducky_lang", "hu"); applyLanguage(); });
    ui.langEn.addEventListener("click", () => { currentLang = "en"; localStorage.setItem("ducky_lang", "en"); applyLanguage(); });

    // A több soros (textarea) mappalistát szétdarabolja egy tömbbé a sortöréseknél (\n)
    function getFolderPaths() {
        return ui.folderInput.value.split('\n').map(p => p.trim()).filter(p => p !== "");
    }

    // Megjeleníti vagy elrejti a képernyő alján lévő "Címke szerkesztő" lebegő panelt.
    function updateBulkPanel() {
        ui.bulkEditPanel.style.display = selectedPaths.size > 0 ? "flex" : "none";
        ui.selectedCountDisplay.textContent = selectedPaths.size;
    }

    // Okos funkció: Megvizsgálja, hogy a látható elemek közül MIND ki van-e jelölve.
    // Ha igen, a gomb felirata "Kijelölés törlése" lesz, különben "Mind kijelölése".
    function updateSelectAllButtonState() {
        if (currentVisiblePaths.length === 0) return;
        const t = translations[currentLang];

        // Az 'every' egy tömbfüggvény, ami csak akkor 'true', ha a feltétel minden elemre igaz.
        const allSelected = currentVisiblePaths.every(p => selectedPaths.has(p));

        if (allSelected) {
            ui.selectAllBtn.textContent = t.deselectAll;
            ui.selectAllBtn.dataset.state = "all"; // A 'dataset' html 'data-state' attribútumot módosít.
        } else {
            ui.selectAllBtn.textContent = t.selectAll;
            ui.selectAllBtn.dataset.state = "none";
        }
    }

    /**
     * 6. FŐ MEGJELENÍTŐ (RENDERER) FUNKCIÓ
     * Ez a függvény kapja meg a Rusttól a találatok tömbjét, és építi fel belőlük a HTML listát.
     */
    function renderFiles(files) {
        const t = translations[currentLang];
        ui.fileList.innerHTML = ""; // Kiürítjük az előző találatokat

        // Eltároljuk, hogy mik vannak most a képernyőn (a Mind kijelölése gomb miatt)
        currentVisiblePaths = files.map(file => file.path);

        // Ha nincs találat, elrejtjük a gombokat, és kiírjuk, hogy "Nincs találat".
        if (files.length === 0) {
            ui.selectAllBtn.style.display = "none";
            ui.fileList.innerHTML = `<li>${t.noResults}</li>`;
            return;
        }

        ui.selectAllBtn.style.display = "block";

        // Végigmegyünk minden egyes fájlon/mappán, amit a Rust visszaküldött
        files.forEach(file => {
            const li = document.createElement("li"); // Létrehozunk egy lista elemet
            li.style.cssText = "margin-bottom: 12px; padding: 12px; background: #fff; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); display: flex; align-items: flex-start;";

            // Unix időbélyeget (másodperc) Date objektummá alakítunk (ezermásodperc)
            const c = file.created_at ? new Date(file.created_at * 1000).toLocaleString(currentLang === 'hu' ? 'hu-HU' : 'en-US') : '-';
            const m = file.modified_at ? new Date(file.modified_at * 1000).toLocaleString(currentLang === 'hu' ? 'hu-HU' : 'en-US') : '-';

            // A tageket (címkéket) cuki kis "pirulákká" (bubbly spanekké) formázzuk
            const tags = file.tags.map(tag => `<span style="background: #e9ecef; color: #495057; padding: 3px 8px; border-radius: 10px; font-size: 12px; margin-right: 6px; font-weight: bold; display: inline-block; margin-top: 4px;">#${tag}</span>`).join('');

            const icon = file.is_dir ? "📁" : "📄";

            // Megnézzük az adatbázisunkban (Set), hogy ez a fájl be volt-e már pipálva
            const isChecked = selectedPaths.has(file.path) ? "checked" : "";

            // XSS VÉDELEM ÉS STRING ESCAPE: Mivel a fájl elérési utakat HTML attribútumokba tesszük,
            // védenünk kell az idézőjelektől és a Windowsos '\' jelektől, nehogy eltörjék a szintaxist!
            const escapedAttr = file.path.replace(/"/g, '&quot;');

            // A HTML sablon felépítése (Template Literals)
            li.innerHTML = `
          <input type="checkbox" class="item-checkbox" data-path="${escapedAttr}" ${isChecked}>
          <div style="flex: 1; display: flex; flex-direction: column;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                  <strong style="font-size: 15px; color: #2c3e50;">${icon} ${file.name}</strong>
                  <div style="font-size: 11px; color: #888; text-align: right;">
                      <div>${t.created} ${c}</div>
                      <div>${t.modified} ${m}</div>
                  </div>
              </div>
              <div style="margin-bottom: 12px;">${tags}</div>
              <div style="display: flex; gap: 8px;">
                  <button onclick="openFile('${file.path.replace(/\\/g, '\\\\')}')" style="padding: 6px 14px; background: #2a9d8f; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">${t.open}</button>
                  <button onclick="jumpToFile('${file.path.replace(/\\/g, '\\\\')}')" style="padding: 6px 14px; background: #e9c46a; color: #333; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">${t.jump}</button>
              </div>
          </div>`;

            // Hozzáadjuk a listához a megépített elemet
            ui.fileList.appendChild(li);

            // ESEMÉNYFIGYELŐ: Ha rákattint a checkboxra, frissítjük a memóriát (Set)
            li.querySelector('.item-checkbox').addEventListener('change', (e) => {
                if (e.target.checked) selectedPaths.add(file.path);
                else selectedPaths.delete(file.path);

                // Mivel változott a kijelölés, frissíteni kell a gombokat és a panelt!
                updateSelectAllButtonState();
                updateBulkPanel();
            });
        });

        updateSelectAllButtonState();
    }

    /**
     * 7. TÖMEGES MŰVELETEK (MIND KIJELÖLÉSE)
     */
    ui.selectAllBtn.addEventListener("click", () => {
        const isAllSelected = ui.selectAllBtn.dataset.state === "all";

        // Végigmegyünk a szűrt, képernyőn látható elemeken
        currentVisiblePaths.forEach(path => {
            if (isAllSelected) selectedPaths.delete(path);
            else selectedPaths.add(path);
        });

        // Vizuálisan is átkapcsoljuk a DOM-ban lévő kis pipákat
        const checkboxes = ui.fileList.querySelectorAll('.item-checkbox');
        checkboxes.forEach(cb => { cb.checked = selectedPaths.has(cb.dataset.path); });

        updateSelectAllButtonState();
        updateBulkPanel();
    });

    /**
     * 8. A RUST MOTOR MEGHÍVÁSAI (Keresés és Címkézés)
     */
    function performSearch() {
        const t = translations[currentLang];
        // Aszinkron hívás a Rust felé ('invoke'). A válasz egy Promise (.then / .catch).
        invoke("search_index", { query: ui.searchInput.value, extFilter: ui.extFilter.value, sortBy: ui.sortBy.value, dbPath: ui.dbPathInput.value.trim() })
            .then(renderFiles) // Ha sikeres, lefuttatja a renderFiles függvényt a kapott adattal
            .catch(err => { ui.fileList.innerHTML = `<li style="color: red;">${t.noResults} (${err})</li>`; }); // Ha hiba van, kiírja pirossal
    }

    ui.applyTagsBtn.addEventListener("click", () => {
        const t = translations[currentLang];
        // A beírt szöveget szétvágjuk a vesszőknél, és kidobjuk az üres szóközöket.
        const newTags = ui.newTagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag !== "");
        if (newTags.length === 0) return; // Ha nem írt be semmit, ne terheljük a Rust-ot

        // Az 'Array.from' egy sima tömböt csinál a speciális 'Set' objektumunkból, amit a Rust már megért.
        invoke("add_tags", { targetPaths: Array.from(selectedPaths), newTags, dbPath: ui.dbPathInput.value.trim() })
            .then(() => { alert(t.tagsSuccess); selectedPaths.clear(); updateBulkPanel(); performSearch(); })
            .catch(err => alert(t.error + " " + err));
    });

    ui.removeTagsBtn.addEventListener("click", () => {
        const t = translations[currentLang];
        const tagsToRemove = ui.newTagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag !== "");
        if (tagsToRemove.length === 0) return;

        invoke("remove_tags", { targetPaths: Array.from(selectedPaths), tagsToRemove, dbPath: ui.dbPathInput.value.trim() })
            .then(() => { alert(t.removeSuccess); selectedPaths.clear(); updateBulkPanel(); performSearch(); })
            .catch(err => alert(t.error + " " + err));
    });

    /**
     * 9. BEÁLLÍTÁSOK ÉS HELYI TÁROLÁS (LocalStorage)
     * Itt töltjük vissza a felhasználó előző beállításait a böngésző memóriájából.
     */
    ui.dbPathInput.value = localStorage.getItem("ducky_db_path") || "";
    ui.folderInput.value = localStorage.getItem("ducky_folder_path") || "";
    ui.autoSyncCheck.checked = localStorage.getItem("ducky_auto_sync") === "true";
    ui.autoSyncInterval.value = localStorage.getItem("ducky_sync_interval") || "60";

    // Ha a felhasználó módosítja a mappákat, azonnal elmentjük.
    ui.folderInput.addEventListener("change", () => { localStorage.setItem("ducky_folder_path", ui.folderInput.value); });

    function updateDbPathDisplay() {
        const t = translations[currentLang];
        ui.dbPathDisplay.textContent = ui.dbPathInput.value.trim() === "" ? t.dbDefault : `(DB: ${ui.dbPathInput.value.trim()})`;
    }

    // Animált/lenyíló (Accordion) beállítások panel logikája
    const toggleSettings = () => {
        const isHidden = ui.settingsContent.style.display === "none";
        ui.settingsContent.style.display = isHidden ? "block" : "none";
        ui.settingsArrow.textContent = isHidden ? "▲" : "▼";
    };
    ui.settingsToggle.addEventListener("click", toggleSettings);
    ui.settingsArrow.addEventListener("click", toggleSettings);

    /**
     * 10. ESEMÉNYFIGYELÉS A RUST-TÓL (Progress Bar)
     * Ez a blokk várja a Rust 'scan-progress' üzeneteit, hogy tudja frissíteni a UI-t.
     */
    if (listen) {
        listen("scan-progress", (event) => {
            const t = translations[currentLang];
            // A payload tartalmazza az eddig beolvasott fájlok számát. Ezt formázzuk szépen, ezreselválasztókkal.
            ui.progressCount.textContent = `${event.payload.toLocaleString(currentLang === 'hu' ? 'hu-HU' : 'en-US')}${t.filesWord}`;
        });
    }

    /**
     * 11. KÉZI SZINKRONIZÁLÁS (GOMB)
     */
    ui.scanBtn.addEventListener("click", () => {
        const t = translations[currentLang];
        const paths = getFolderPaths();
        if (paths.length === 0) return alert("Path?"); // Ha nincs mit szkennelni, leállítjuk.

        // Vizuális visszajelzés a felhasználónak (gomb letiltása a dupla kattintás ellen)
        ui.fileList.innerHTML = `<b>⏳ ${t.loading}</b>`;
        ui.scanBtn.disabled = true;
        ui.progressContainer.style.display = "block";

        invoke("scan_directory", { paths, dbPath: ui.dbPathInput.value.trim() })
            .then(() => {
                alert(t.success);
                ui.progressContainer.style.display = "none";
                ui.scanBtn.disabled = false;

                // Eltároljuk az utolsó SIKERES szinkronizáció idejét, majd frissítjük a fejlécet
                localStorage.setItem("ducky_last_sync_ts", Date.now().toString());
                updateSyncBadges();

                performSearch(); // Újra betöltjük a listát a friss adatokkal
            })
            .catch(err => {
                alert(t.error + " " + err);
                ui.progressContainer.style.display = "none";
                ui.scanBtn.disabled = false;
            });
    });

    /**
     * 12. KERESÉSI ESEMÉNYEK
     * Ezek biztosítják, hogy akár gombnyomásra, akár "Enter"-re reagáljon a kereső.
     */
    ui.executeSearchBtn.addEventListener("click", performSearch);
    ui.searchInput.addEventListener("keydown", e => { if (e.key === "Enter") performSearch(); });
    ui.extFilter.addEventListener("keydown", e => { if (e.key === "Enter") performSearch(); });
    ui.sortBy.addEventListener("change", performSearch); // Ha változik a sorrend, azonnal keresünk

    /**
     * 13. AUTOMATIKUS HÁTTÉRSZINKRONIZÁLÁS (CRON JOB)
     */
    let syncTimer = null; // Ez tartja memóriában a futó időzítőt

    function setupAutoSync() {
        if (syncTimer) clearInterval(syncTimer); // Ha volt előző időzítő, megöljük.

        if (ui.autoSyncCheck.checked) {
            // A setInterval X időközönként lefuttatja a benne lévő kódot.
            syncTimer = setInterval(() => {
                const paths = getFolderPaths();
                if (paths.length > 0) {
                    invoke("scan_directory", { paths, dbPath: ui.dbPathInput.value.trim() })
                        .then(() => {
                            localStorage.setItem("ducky_last_sync_ts", Date.now().toString());
                            updateSyncBadges();
                            performSearch();
                        }).catch(err => console.warn("Auto-sync skipped:", err)); // Hiba esetén itt csak némán logolunk (Nincs alert ablak)
                }
            }, parseInt(ui.autoSyncInterval.value) * 60000); // Percből milliszekundumot csinálunk (* 60000)
        }
    }

    // Ha a felhasználó kattintgat a beállításokban, elmentjük és újraindítjuk a motort.
    ui.autoSyncCheck.addEventListener("change", () => {
        localStorage.setItem("ducky_auto_sync", ui.autoSyncCheck.checked);
        updateSyncBadges(); // Frissül a piros/zöld jelvény azonnal a fejlécen
        setupAutoSync();
    });

    ui.autoSyncInterval.addEventListener("change", () => {
        localStorage.setItem("ducky_sync_interval", ui.autoSyncInterval.value);
        setupAutoSync();
    });

    /**
     * 14. INICIALIZÁLÁS (Induláskori hívások)
     */
    applyLanguage();  // Beállítjuk a nyelvet
    setupAutoSync();  // Elindítjuk a háttérszinkronizálást, ha be van kapcsolva

    /**
     * 15. GLOBÁLIS FÜGGVÉNYEK (WINDOW)
     * Mivel a "Megnyitás" és "Ugrás" gombokat HTML stringként (innerHTML) generáltuk le
     * fentebb, és ott inline 'onclick' eseményt használtunk, a függvényeket
     * ki kell emelnünk a globális 'window' objektumba, hogy a HTML elérje őket.
     */
    window.openFile = path => {
        const t = translations[currentLang];
        invoke("open_file", { path })
            .catch(err => {
                // Ha a Rustból "NOT_FOUND" jön vissza, kiírjuk a saját hibaüzenetünket
                if (err === "NOT_FOUND") alert(t.fileNotFound);
                else alert(t.error + " " + err);
            });
    };

    window.jumpToFile = path => {
        const t = translations[currentLang];
        invoke("jump_to_file", { path })
            .catch(err => {
                if (err === "NOT_FOUND") alert(t.fileNotFound);
                else alert(t.error + " " + err);
            });
    };
});