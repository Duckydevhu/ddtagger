/**
 * ============================================================================
 * DUCKYTAGGER - BACKEND MOTOR (Rust)
 * ============================================================================
 * Ez a fájl az alkalmazás "agya". Közvetlenül a hardverrel és a Windows 
 * operációs rendszerrel kommunikál. Elvégzi a nehéz fájlrendszer-műveleteket, 
 * és JSON formátumban tálalja az eredményt a JavaScript (frontend) számára.
 */

// Ez a varázssor mondja meg a fordítónak, hogy ha "Release" (végleges) módban 
// fordítjuk a programot, akkor NE nyisson mellé egy fekete parancssor (cmd) ablakot.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// 1. KÖNYVTÁRAK IMPORTÁLÁSA (Imports)
use std::process::Command; // Operációs rendszeri parancsok futtatásához (pl. fájl megnyitása)
use std::fs::File; // Fájlkezelés (olvasás/írás)
use std::io::{Write, BufReader}; // 'BufReader': Memória-pufferelt olvasás, ami gigantikus JSON-öknél is villámgyors!
use serde::{Serialize, Deserialize}; // 'Serde': A Rust legnépszerűbb "varázslója", ami Rust struktúrákat alakít JSON-né és vissza.
use walkdir::WalkDir; // Külső csomag: Rekurzívan bejárja a mappákat (almappák almappáit is).
use std::time::UNIX_EPOCH; // Dátumok kezeléséhez (az 1970-es kezdőpont)
use std::env; // Környezeti változók (pl. hol fut most a program)
use std::path::{PathBuf, Path}; // Útvonalak (C:\...) operációs rendszer-független kezelése
use std::collections::{HashMap, HashSet}; // Villámgyors adatstruktúrák (Szótár és Halmaz)
use tauri::{Window, Emitter, Manager}; // Tauri specifikus eszközök (Ablakkezelés, eseményküldés a JS-nek)

/**
 * 2. ADATSTRUKTÚRA DEFINIÁLÁSA
 * Ezt az adatot fogjuk kimenteni a JSON-be, és ezt fogja megkapni a JS is.
 * A '#[derive(Serialize, Deserialize, Clone)]' automatikusan megírja nekünk a 
 * JSON átalakító kódot és a memóriában való másolhatóságot (Clone).
 */
#[derive(Serialize, Deserialize, Clone)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool, // Igaz, ha mappa, Hamis, ha fájl
    tags: Vec<String>, // A címkék listája (pl. ["pdf", "számla", "2024"])
    created_at: u64, // Létrehozás ideje másodpercben
    modified_at: u64, // Módosítás ideje másodpercben
}

/**
 * 3. SEGÉDFÜGGVÉNY: ADATBÁZIS ÚTVONALA
 * Okos függvény: Ha a felhasználó megadott egy egyedi útvonalat a beállításokban, 
 * akkor azt használja. Ha nem, akkor a program saját '.exe' fájlja mellé teszi a JSON-t.
 */
fn get_index_path(custom_path: &str) -> PathBuf {
    if !custom_path.trim().is_empty() {
        return PathBuf::from(custom_path.trim());
    }
    // Megkeressük, honnan fut a program, és mellétesszük a fájlt
    let mut path = env::current_exe().unwrap_or_else(|_| env::current_dir().unwrap());
    path.pop(); // Levágjuk a "DuckyTagger.exe"-t az útvonal végéről
    path.push("nas_index.json"); // Hozzáadjuk a DB nevét
    path
}

/**
 * ============================================================================
 * 4. TAURI PARANCSOK (Ezeket hívja meg a JS az 'invoke' paranccsal)
 * ============================================================================
 * A Rust hibakezelése zseniális: A 'Result<(), String>' azt jelenti, hogy 
 * vagy sikeresen lefut (Ok), vagy visszaad egy szöveges hibaüzenetet (Err). 
 * Nincs váratlan programösszeomlás!
 */

// Ugrás a fájlhoz az Intézőben
#[tauri::command]
fn jump_to_file(path: String) -> Result<(), String> {
    if !Path::new(&path).exists() { return Err("NOT_FOUND".to_string()); } // Biztonsági ellenőrzés
    showfile::show_path_in_file_manager(&path); // A showfile csomag kijelöli az Intézőben
    Ok(())
}

// Fájl/Mappa megnyitása az alapértelmezett Windows programmal
#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    if !Path::new(&path).exists() { return Err("NOT_FOUND".to_string()); }
    // Kiadjuk a Windows 'cmd /C start "" "C:\Útvonal"' parancsát, ami megnyitja a fájlt
    Command::new("cmd")
        .args(["/C", "start", "", &path])
        .spawn()
        .map_err(|e| e.to_string())?; // Ha hiba van a Windowsban, stringként küldjük a JS-nek
    Ok(())
}

// CÍMKÉK HOZZÁADÁSA (Hierarchikusan)
#[tauri::command]
fn add_tags(target_paths: Vec<String>, new_tags: Vec<String>, db_path: String) -> Result<(), String> {
    let index_path = get_index_path(&db_path);
    let file = File::open(&index_path).map_err(|_| format!("Nem található adatbázis!"))?;
    let reader = BufReader::new(file);
    let mut all_entries: Vec<FileEntry> = serde_json::from_reader(reader).map_err(|e| e.to_string())?;

    // Megtisztítjuk a bejövő új címkéket (kisbetűsítés, szóközök levágása)
    let processed_new_tags: Vec<String> = new_tags.into_iter()
        .map(|t| t.trim().to_lowercase())
        .filter(|t| !t.is_empty())
        .collect();

    if processed_new_tags.is_empty() { return Ok(()); }
    let mut modified = false; // Flag, hogy történt-e egyáltalán változás

    // Végigmegyünk az adatbázis MINDEN elemén
    for entry in &mut all_entries {
        let mut should_modify = false;
        
        for target in &target_paths {
            // Hozzáadjuk a Windows perjelet (\), hogy biztosan az almappákat találjuk meg
            let target_with_sep = format!("{}{}", target, std::path::MAIN_SEPARATOR);
            
            // ⭐ A HIERARCHIA TITKA: Ha a fájl útja PONTOSAN egyezik, VAGY az útvonala 
            // a célmappával kezdődik, akkor a fájl a célmappában (vagy alatta) van!
            if entry.path == *target || entry.path.starts_with(&target_with_sep) {
                should_modify = true;
                break;
            }
        }
        
        if should_modify {
            entry.tags.extend(processed_new_tags.clone()); // Hozzáadjuk az új taget
            entry.tags.sort(); // ABC sorrendbe rakjuk
            entry.tags.dedup(); // Eltávolítjuk a duplikációkat (ha véletlen kétszer adnák hozzá)
            modified = true;
        }
    }

    // Csak akkor írjuk felül a JSON-t a merevlemezen, ha tényleg változtattunk is valamit
    if modified {
        let json_data = serde_json::to_string_pretty(&all_entries).map_err(|e| e.to_string())?;
        let mut file = File::create(&index_path).map_err(|e| e.to_string())?;
        file.write_all(json_data.as_bytes()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// CÍMKÉK TÖRLÉSE (Hierarchikusan)
#[tauri::command]
fn remove_tags(target_paths: Vec<String>, tags_to_remove: Vec<String>, db_path: String) -> Result<(), String> {
    let index_path = get_index_path(&db_path);
    let file = File::open(&index_path).map_err(|_| format!("Nem található adatbázis!"))?;
    let reader = BufReader::new(file);
    let mut all_entries: Vec<FileEntry> = serde_json::from_reader(reader).map_err(|e| e.to_string())?;

    let processed_rem_tags: Vec<String> = tags_to_remove.into_iter()
        .map(|t| t.trim().to_lowercase())
        .filter(|t| !t.is_empty())
        .collect();

    if processed_rem_tags.is_empty() { return Ok(()); }
    let mut modified = false;

    for entry in &mut all_entries {
        let mut should_modify = false;
        for target in &target_paths {
            let target_with_sep = format!("{}{}", target, std::path::MAIN_SEPARATOR);
            if entry.path == *target || entry.path.starts_with(&target_with_sep) {
                should_modify = true;
                break;
            }
        }
        if should_modify {
            let initial_len = entry.tags.len();
            // A 'retain' csak azokat a tageket tartja meg, amik nincsenek benne a törlendők listájában
            entry.tags.retain(|t| !processed_rem_tags.contains(t));
            if entry.tags.len() != initial_len {
                modified = true;
            }
        }
    }

    if modified {
        let json_data = serde_json::to_string_pretty(&all_entries).map_err(|e| e.to_string())?;
        let mut file = File::create(&index_path).map_err(|e| e.to_string())?;
        file.write_all(json_data.as_bytes()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/**
 * ============================================================================
 * 5. A SZKENNER MOTOR (A DuckyTagger lelke)
 * ============================================================================
 */
#[tauri::command]
fn scan_directory(window: Window, paths: Vec<String>, db_path: String) -> Result<Vec<FileEntry>, String> {
    
    // OFFLINE VÉDELEM: Ha akár egyetlen mappa is hiányzik a beállítottak közül, 
    // a szkennelés megszakad. Így nem törlődik a DB, ha épp nincs VPN/Hálózat.
    for path in &paths {
        if !Path::new(path).exists() {
            return Err(format!("Hiba: A megadott mappa nem elérhető! (Mappa: {})", path));
        }
    }

    let index_path = get_index_path(&db_path);
    // HashMap (Szótár): Ez teszi lehetővé, hogy O(1) sebességgel (azonnal) megtaláljunk egy fájlt!
    let mut db_map: HashMap<String, FileEntry> = HashMap::new();
    
    // Betöltjük a korábbi állapotot a memóriába (ha létezik a JSON)
    if let Ok(file) = File::open(&index_path) {
        let reader = BufReader::new(file);
        if let Ok(entries) = serde_json::from_reader::<_, Vec<FileEntry>>(reader) {
            for entry in entries {
                db_map.insert(entry.path.clone(), entry);
            }
        }
    }

    // A 'HashSet' egy olyan lista, amibe belerakjuk az összes *most* megtalált fájlt.
    // Ami a szkennelés végén nincs benne ebben a set-ben, azt letörölték a gépről!
    let mut seen_paths = HashSet::new();
    let mut scanned_count = 0;

    // Végigmegyünk az összes megadott gyökérkönyvtáron
    for base_path in &paths {
        // WalkDir: Végigmászik a teljes mappafán
        for entry in WalkDir::new(base_path).into_iter().filter_map(|e| e.ok()) {
            scanned_count += 1;
            
            // ÉLŐ PROGRESSZ: Minden 500. fájlnál rászól a JS-re, hogy frissítse a csíkot!
            if scanned_count % 500 == 0 { let _ = window.emit("scan-progress", scanned_count); }

            let path_buf = entry.path();
            let is_dir = path_buf.is_dir(); 
            let full_path = path_buf.to_string_lossy().to_string();
            seen_paths.insert(full_path.clone()); // Feljegyezzük, hogy ez a fájl megvan!
            
            // Fájl módosítási idejének lekérése
            let metadata = entry.metadata().ok();
            let m_time = metadata.as_ref().and_then(|m| m.modified().ok()).and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);
            
            // CÍMKE-TÚLÉLÉS: Ebbe a tömbbe mentjük át a felhasználó által korábban felvitt egyedi címkéket.
            let mut existing_tags_to_preserve = Vec::new();

            if let Some(existing_entry) = db_map.get(&full_path) {
                existing_tags_to_preserve = existing_entry.tags.clone();
                // Ha a módosítási idő megegyezik, akkor a fájl érintetlen, átugorjuk a feldolgozását (Ettől ilyen villámgyors!)
                if existing_entry.modified_at == m_time { continue; }
            }

            let name = entry.file_name().to_string_lossy().to_string();
            let c_time = metadata.as_ref().and_then(|m| m.created().ok()).and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);
            
            let mut tags = Vec::new();
            
            // AUTOMATIKUS CÍMKÉZÉS 1: Az útvonal (almappák) szavainak bedarabolása
            if let Some(parent) = path_buf.parent() {
                for comp in parent.iter() {
                    let mut comp_str = comp.to_string_lossy().to_string().to_lowercase();
                    comp_str = comp_str.replace(":\\", "").replace(":", "").replace("\\", "");
                    if !comp_str.is_empty() { tags.push(comp_str); }
                }
            }
            
            // AUTOMATIKUS CÍMKÉZÉS 2: Fájlnév, vagy Kiterjesztés alapján
            if is_dir { 
                tags.push(name.to_lowercase()); 
            } else {
                if let Some(stem) = path_buf.file_stem() { tags.push(stem.to_string_lossy().to_string().to_lowercase()); }
                if let Some(ext) = path_buf.extension() { tags.push(ext.to_string_lossy().to_string().to_lowercase()); }
            }
            
            // Visszatöltjük a felhasználó korábbi (mentett) címkéit az automatikusak mellé
            tags.extend(existing_tags_to_preserve);
            tags.sort();
            tags.dedup();
            
            // Bedobjuk az elemet a memóriába (ha már ott volt, ez frissíti/felülírja)
            db_map.insert(full_path.clone(), FileEntry { name, path: full_path, is_dir, tags, created_at: c_time, modified_at: m_time });
        }
    }

    // Küldjük a végső számot a felületnek
    let _ = window.emit("scan-progress", scanned_count);
    
    // ⭐ GARBAGE COLLECTOR: Kirúgunk a memóriából (db_map) MINDEN olyan bejegyzést, 
    // aminek az útvonala nem szerepel a frissen látott fájlok (seen_paths) között!
    db_map.retain(|k, _| seen_paths.contains(k));
    
    // Átalakítjuk a Szótárat egy egyszerű Listává, és kimentjük a JSON-ba
    let entries_list: Vec<FileEntry> = db_map.into_values().collect();
    let json_data = serde_json::to_string_pretty(&entries_list).map_err(|e| e.to_string())?;
    let mut file = File::create(&index_path).map_err(|e| e.to_string())?;
    file.write_all(json_data.as_bytes()).map_err(|e| e.to_string())?;

    Ok(entries_list)
}

/**
 * ============================================================================
 * 6. KERESŐ MOTOR
 * ============================================================================
 */
#[tauri::command]
fn search_index(query: String, ext_filter: String, sort_by: String, db_path: String) -> Result<Vec<FileEntry>, String> {
    let index_path = get_index_path(&db_path);
    let file = File::open(&index_path).map_err(|_| format!("Error"))?;
    let reader = BufReader::new(file);
    let all_entries: Vec<FileEntry> = serde_json::from_reader(reader).map_err(|e| e.to_string())?;

    // A beírt keresőszavakat szétszedjük egy listába
    let query_words: Vec<String> = query.trim().to_lowercase().split_whitespace().map(|s| s.to_string()).collect();
    let ext = ext_filter.trim().to_lowercase().replace(".", ""); 
    let mut results = Vec::new();

    // Végigpörgetjük az összes fájlt (100.000 fájlon is kb. 50-100 milliszekundum alatt!)
    for entry in all_entries {
        // Szűrünk kiterjesztésre (ha be van írva valami)
        let ext_match = ext.is_empty() || entry.tags.contains(&ext);
        if !ext_match { continue; }
        
        let name_lower = entry.name.to_lowercase();
        let mut all_words_match = true;
        
        // Logikai ÉS (AND) keresés: A felhasználó TÖBB szavára is egyszerre keresünk
        for word in &query_words {
            let word_in_name = name_lower.contains(word);
            let word_in_tags = entry.tags.iter().any(|tag| tag.contains(word));
            
            // Ha akár EGYIK szó hiányzik a névből is ÉS a címkék közül is, eldobjuk a találatot
            if !word_in_name && !word_in_tags { 
                all_words_match = false; 
                break; 
            }
        }
        
        if all_words_match { results.push(entry.clone()); }
    }

    // Sorba rendezés a JS-től kapott feltétel ('sort_by') alapján
    match sort_by.as_str() {
        "name_asc" => results.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase())),
        "name_desc" => results.sort_by(|a, b| b.name.to_lowercase().cmp(&a.name.to_lowercase())),
        "created_desc" => results.sort_by(|a, b| b.created_at.cmp(&a.created_at)), 
        "created_asc" => results.sort_by(|a, b| a.created_at.cmp(&b.created_at)),  
        "modified_desc" => results.sort_by(|a, b| b.modified_at.cmp(&a.modified_at)),
        "modified_asc" => results.sort_by(|a, b| a.modified_at.cmp(&b.modified_at)),
        _ => {} 
    }
    
    // A memóriakímélés miatt maximum az első 500 találatot küldjük le a felületnek
    Ok(results.into_iter().take(500).collect())
}

/**
 * ============================================================================
 * 7. FŐPROGRAM (MAIN) - A Tauri applikáció belépési pontja
 * ============================================================================
 */
fn main() {
    tauri::Builder::default()
        // BEÉPÜLŐ MODUL: Automatikusan elmenti az ablak méretét és pozícióját bezáráskor!
        .plugin(tauri_plugin_window_state::Builder::default().build())
        
        // RENDSZERTÁLCA (System Tray) ÉPÍTÉSE
        .setup(|app| {
            use tauri::menu::{Menu, MenuItemBuilder};
            use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

            // Menüelemek létrehozása a tálca ikon jobb klikkes menüjéhez
            let show_i = MenuItemBuilder::with_id("show", "DuckyTagger Megnyitása").build(app)?;
            let quit_i = MenuItemBuilder::with_id("quit", "Teljes Kilépés").build(app)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let mut tray_builder = TrayIconBuilder::new().menu(&menu);
            
            // Ha van beállított logó a tauri.conf.json-ben (npm run tauri icon után), azt betölti ide
            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }

            tray_builder
                // Mit csináljunk, ha rákattint a menü gombjaira?
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0); // Tisztán leállítja a folyamatot
                        }
                        "show" => {
                            // Megkeresi a fő ablakot, felhozza és fókuszt ad neki
                            if let Some(window) = app.get_webview_window("main") {
                                window.show().unwrap();
                                window.set_focus().unwrap();
                            }
                        }
                        _ => {}
                    }
                })
                // Mit csináljunk, ha magára a tálca ikonra kattint (bal gombbal)?
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            window.show().unwrap();
                            window.set_focus().unwrap();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        
        // ABLAK ESEMÉNYEK: Elkapjuk a "Bezárás" (X) gombot
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                // Ahelyett, hogy leállna a program, csak némán elrejtjük a tálcára!
                window.hide().unwrap(); 
                api.prevent_close(); // Blokkoljuk az OS szintű bezárást
            }
            _ => {}
        })
        
        // REGISZTRÁCIÓ: Ezeket a függvényeket érheti el a JavaScript biztonságosan.
        .invoke_handler(tauri::generate_handler![
            jump_to_file, open_file, scan_directory, search_index, add_tags, remove_tags
        ])
        
        // A motor beindítása
        .run(tauri::generate_context!())
        .expect("Hiba");
}