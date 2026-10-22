use tauri::State;

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
