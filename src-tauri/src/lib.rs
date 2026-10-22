mod commands;
mod db;

use std::sync::Mutex;

use tauri::Manager;

use db::Db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let conn = db::init(app.handle())
                .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            app.manage(Db(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_goal,
            commands::save_goal,
            commands::list_entries,
            commands::upsert_entry,
            commands::delete_entry
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
