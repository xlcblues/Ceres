mod ai;
mod commands;
mod db;

use std::sync::Mutex;

use tauri::Manager;

use db::Db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
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
            commands::delete_entry,
            commands::export_entries,
            commands::get_profile,
            commands::save_profile,
            commands::list_food_catalog,
            commands::create_food_catalog_item,
            commands::list_exercise_catalog,
            commands::create_exercise_catalog_item,
            commands::log_food,
            commands::log_exercise,
            commands::delete_food_log,
            commands::delete_exercise_log,
            commands::upsert_water,
            commands::get_day_logs,
            commands::get_ai_config,
            commands::save_ai_config,
            commands::ai_chat,
            commands::ai_chat_stream,
            commands::ai_estimate_food,
            commands::ai_estimate_exercise,
            commands::ai_apply_actions,
            commands::test_ai_connection,
            commands::list_ai_sessions,
            commands::get_ai_session,
            commands::save_ai_session,
            commands::delete_ai_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
