use tauri::{AppHandle, Manager, State};

use crate::db::{self, Db, Entry, Goal};

#[tauri::command]
pub fn get_goal(state: State<'_, Db>) -> Result<Option<Goal>, String> {
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    db::get_goal(&conn).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_goal(state: State<'_, Db>, goal: Goal) -> Result<Goal, String> {
    validate_goal(&goal)?;
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    db::save_goal(&conn, &goal).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_entries(
    state: State<'_, Db>,
    limit: Option<u32>,
) -> Result<Vec<Entry>, String> {
    let limit = limit.unwrap_or(100).min(1000);
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    db::list_entries(&conn, limit).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn upsert_entry(
    state: State<'_, Db>,
    date: String,
    weight: f64,
    body_fat: Option<f64>,
    note: Option<String>,
) -> Result<Entry, String> {
    validate_entry(&date, weight, body_fat)?;
    let note = note
        .filter(|value| !value.trim().is_empty())
        .map(|value| value.trim().to_string());
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    db::upsert_entry(&conn, &date, weight, body_fat, note.as_deref())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_entry(state: State<'_, Db>, date: String) -> Result<bool, String> {
    if !db::is_valid_date(&date) {
        return Err("日期格式无效".to_string());
    }
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    db::delete_entry(&conn, &date).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn export_entries(
    app: AppHandle,
    state: State<'_, Db>,
    format: String,
) -> Result<String, String> {
    if format != "csv" && format != "json" {
        return Err("不支持的导出格式".to_string());
    }
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    let mut entries = db::list_entries(&conn, 100_000).map_err(|error| error.to_string())?;
    entries.sort_by(|a, b| a.date.cmp(&b.date));

    let content = if format == "csv" {
        render_csv(&entries)
    } else {
        serde_json::to_string_pretty(&entries).map_err(|error| error.to_string())?
    };

    let from = entries.first().map(|entry| entry.date.as_str()).unwrap_or("empty");
    let to = entries.last().map(|entry| entry.date.as_str()).unwrap_or("empty");
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("exports");
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let path = dir.join(format!("ceres-{from}-{to}.{format}"));
    std::fs::write(&path, content).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

fn csv_field(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

fn render_csv(entries: &[Entry]) -> String {
    let mut lines = vec!["date,weight_kg,body_fat,note,created_at,updated_at".to_string()];
    for entry in entries {
        lines.push(format!(
            "{},{},{},{},{},{}",
            csv_field(&entry.date),
            csv_field(&entry.weight.to_string()),
            csv_field(
                &entry
                    .body_fat
                    .map(|value| value.to_string())
                    .unwrap_or_default(),
            ),
            csv_field(entry.note.as_deref().unwrap_or("")),
            csv_field(&entry.created_at),
            csv_field(&entry.updated_at),
        ));
    }
    lines.join("\n")
}

fn validate_goal(goal: &Goal) -> Result<(), String> {
    if goal.target_weight <= 0.0 || !goal.target_weight.is_finite() {
        return Err("目标体重必须大于 0".to_string());
    }
    if let Some(start) = goal.start_weight {
        if start <= 0.0 || !start.is_finite() {
            return Err("起始体重必须大于 0".to_string());
        }
    }
    if let Some(date) = &goal.start_date {
        if !db::is_valid_date(date) {
            return Err("起始日期格式无效".to_string());
        }
    }
    Ok(())
}

fn validate_entry(date: &str, weight: f64, body_fat: Option<f64>) -> Result<(), String> {
    if !db::is_valid_date(date) {
        return Err("日期格式无效".to_string());
    }
    if weight <= 0.0 || !weight.is_finite() {
        return Err("体重必须大于 0".to_string());
    }
    if let Some(ratio) = body_fat {
        if ratio < 0.0 || ratio > 100.0 || !ratio.is_finite() {
            return Err("体脂率应在 0-100 之间".to_string());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{migrate, upsert_entry};
    use rusqlite::Connection;

    #[test]
    fn csv_escapes_quotes_commas_and_newlines() {
        let entries = vec![Entry {
            id: 1,
            date: "2026-10-22".into(),
            weight: 72.4,
            body_fat: Some(24.5),
            note: Some("a,b \"quoted\"\nnext".into()),
            created_at: "2026-10-22 08:00:00".into(),
            updated_at: "2026-10-22 08:00:00".into(),
        }];
        let csv = render_csv(&entries);
        assert!(csv.starts_with("date,weight_kg,body_fat,note,created_at,updated_at"));
        assert!(csv.contains("\"a,b \"\"quoted\"\"\nnext\""));
    }

    #[test]
    fn csv_orders_entries_by_date() {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        upsert_entry(&conn, "2026-10-22", 72.4, None, None).unwrap();
        upsert_entry(&conn, "2026-10-20", 72.8, None, None).unwrap();

        let mut entries = crate::db::list_entries(&conn, 10).unwrap();
        entries.sort_by(|a, b| a.date.cmp(&b.date));
        let csv = render_csv(&entries);
        let lines: Vec<&str> = csv.lines().collect();
        assert!(lines[1].starts_with("2026-10-20"));
        assert!(lines[2].starts_with("2026-10-22"));
    }
}
