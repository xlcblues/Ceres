use tauri::{AppHandle, Manager, State};

use crate::ai;
use crate::db::{
    self, Db, DayLogs, Entry, ExerciseCatalogItem, ExerciseLogItem, FoodCatalogItem, FoodLogItem,
    Goal, Profile, WaterLog,
};

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
pub fn get_profile(state: State<'_, Db>) -> Result<Option<Profile>, String> {
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    db::get_profile(&conn).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_profile(state: State<'_, Db>, profile: Profile) -> Result<Profile, String> {
    validate_profile(&profile)?;
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    db::save_profile(&conn, &profile).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_food_catalog(state: State<'_, Db>) -> Result<Vec<FoodCatalogItem>, String> {
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    db::list_food_catalog(&conn).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_food_catalog_item(
    state: State<'_, Db>,
    name: String,
    category: Option<String>,
    kcal_per_100g: f64,
    protein: Option<f64>,
    carbs: Option<f64>,
    fat: Option<f64>,
    unit_name: Option<String>,
    unit_grams: Option<f64>,
) -> Result<FoodCatalogItem, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("食物名称不能为空".to_string());
    }
    if kcal_per_100g <= 0.0 || !kcal_per_100g.is_finite() {
        return Err("每 100g 热量必须大于 0".to_string());
    }
    for macro_value in [protein, carbs, fat].into_iter().flatten() {
        if macro_value < 0.0 || !macro_value.is_finite() {
            return Err("营养成分不能为负数".to_string());
        }
    }
    let unit_grams = unit_grams.unwrap_or(100.0);
    if unit_grams <= 0.0 || !unit_grams.is_finite() {
        return Err("计量单位克数必须大于 0".to_string());
    }
    let category = category
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "其他".to_string());
    let unit_name = unit_name
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "克".to_string());
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    db::create_food_catalog_item(
        &conn,
        &name,
        &category,
        kcal_per_100g,
        protein,
        carbs,
        fat,
        &unit_name,
        unit_grams,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_exercise_catalog(state: State<'_, Db>) -> Result<Vec<ExerciseCatalogItem>, String> {
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    db::list_exercise_catalog(&conn).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_exercise_catalog_item(
    state: State<'_, Db>,
    name: String,
    category: Option<String>,
    met: f64,
) -> Result<ExerciseCatalogItem, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("运动名称不能为空".to_string());
    }
    if met <= 0.0 || !met.is_finite() || met > 20.0 {
        return Err("MET 值应在 0-20 之间".to_string());
    }
    let category = category
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "其他".to_string());
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    db::create_exercise_catalog_item(&conn, &name, &category, met)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn log_food(
    state: State<'_, Db>,
    date: String,
    food_id: i64,
    grams: f64,
) -> Result<FoodLogItem, String> {
    if !db::is_valid_date(&date) {
        return Err("日期格式无效".to_string());
    }
    if food_id <= 0 {
        return Err("食物不存在".to_string());
    }
    if grams <= 0.0 || !grams.is_finite() || grams > 5000.0 {
        return Err("食物重量应在 0-5000 克之间".to_string());
    }
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    db::log_food(&conn, &date, food_id, grams).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn log_exercise(
    state: State<'_, Db>,
    date: String,
    exercise_id: i64,
    minutes: f64,
    weight_kg: f64,
) -> Result<ExerciseLogItem, String> {
    if !db::is_valid_date(&date) {
        return Err("日期格式无效".to_string());
    }
    if exercise_id <= 0 {
        return Err("运动不存在".to_string());
    }
    if minutes <= 0.0 || !minutes.is_finite() || minutes > 600.0 {
        return Err("运动时长应在 0-600 分钟之间".to_string());
    }
    if weight_kg <= 0.0 || !weight_kg.is_finite() {
        return Err("体重参数无效".to_string());
    }
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    db::log_exercise(&conn, &date, exercise_id, minutes, weight_kg)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_food_log(state: State<'_, Db>, id: i64) -> Result<bool, String> {
    if id <= 0 {
        return Err("记录不存在".to_string());
    }
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    db::delete_food_log(&conn, id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_exercise_log(state: State<'_, Db>, id: i64) -> Result<bool, String> {
    if id <= 0 {
        return Err("记录不存在".to_string());
    }
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    db::delete_exercise_log(&conn, id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn upsert_water(
    state: State<'_, Db>,
    date: String,
    water_ml: f64,
) -> Result<WaterLog, String> {
    if !db::is_valid_date(&date) {
        return Err("日期格式无效".to_string());
    }
    if water_ml < 0.0 || !water_ml.is_finite() || water_ml > 10_000.0 {
        return Err("饮水量应在 0-10000 毫升之间".to_string());
    }
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    db::upsert_water(&conn, &date, water_ml).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_day_logs(state: State<'_, Db>, date: String) -> Result<DayLogs, String> {
    if !db::is_valid_date(&date) {
        return Err("日期格式无效".to_string());
    }
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    db::get_day_logs(&conn, &date).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_ai_config(state: State<'_, Db>) -> Result<Option<ai::AiConfig>, String> {
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    ai::get_config(&conn)
}

#[tauri::command]
pub fn save_ai_config(state: State<'_, Db>, config: ai::AiConfig) -> Result<ai::AiConfig, String> {
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    ai::save_config(&conn, &config)
}

#[tauri::command]
pub fn ai_chat(
    state: State<'_, Db>,
    prompt: String,
    history: Vec<ai::ChatMessage>,
) -> Result<ai::AiChatResponse, String> {
    let trimmed = prompt.trim();
    if trimmed.is_empty() {
        return Err("请输入消息".to_string());
    }
    let (config, context) = {
        let conn = state.0.lock().map_err(|error| error.to_string())?;
        let config = ai::get_config(&conn)?
            .ok_or_else(|| "请先在设置中配置 AI".to_string())?;
        let context = ai::build_context(&conn, &ai::today())?;
        (config, context)
    };
    ai::chat_with_context(&config, &context, trimmed, &history)
}

#[tauri::command]
pub fn ai_chat_stream(
    state: State<'_, Db>,
    prompt: String,
    history: Vec<ai::ChatMessage>,
    channel: tauri::ipc::Channel<ai::AiStreamEvent>,
) -> Result<ai::AiChatResponse, String> {
    let trimmed = prompt.trim();
    if trimmed.is_empty() {
        return Err("请输入消息".to_string());
    }
    let (config, context) = {
        let conn = state.0.lock().map_err(|error| error.to_string())?;
        let config = ai::get_config(&conn)?
            .ok_or_else(|| "请先在设置中配置 AI".to_string())?;
        let context = ai::build_context(&conn, &ai::today())?;
        (config, context)
    };
    let response = ai::chat_with_context_stream(&config, &context, trimmed, &history, |delta| {
        channel
            .send(ai::AiStreamEvent::Delta {
                text: delta.to_string(),
            })
            .map_err(|error| error.to_string())
    })?;
    channel
        .send(ai::AiStreamEvent::Done {
            actions: response.actions.clone(),
        })
        .map_err(|error| error.to_string())?;
    Ok(response)
}

#[tauri::command]
pub fn ai_estimate_food(
    state: State<'_, Db>,
    name: String,
    amount_text: Option<String>,
) -> Result<ai::FoodEstimate, String> {
    let config = ai_config_from_state(&state)?;
    ai::estimate_food(&config, &name, amount_text.as_deref())
}

#[tauri::command]
pub fn ai_estimate_exercise(
    state: State<'_, Db>,
    name: String,
    duration_text: Option<String>,
) -> Result<ai::ExerciseEstimate, String> {
    let config = ai_config_from_state(&state)?;
    ai::estimate_exercise(&config, &name, duration_text.as_deref())
}

#[tauri::command]
pub fn ai_apply_actions(
    state: State<'_, Db>,
    actions: Vec<ai::AiAction>,
) -> Result<ai::AiApplyResult, String> {
    if actions.is_empty() {
        return Err("没有可录入的数据".to_string());
    }
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    ai::apply_actions(&conn, &actions)
}

#[tauri::command]
pub fn test_ai_connection(state: State<'_, Db>) -> Result<String, String> {
    let config = ai_config_from_state(&state)?;
    ai::test_connection(&config)
}

#[tauri::command]
pub fn list_ai_sessions(state: State<'_, Db>) -> Result<Vec<ai::AiSessionMeta>, String> {
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    ai::list_sessions(&conn)
}

#[tauri::command]
pub fn get_ai_session(state: State<'_, Db>, id: i64) -> Result<Option<ai::AiSession>, String> {
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    ai::get_session(&conn, id)
}

#[tauri::command]
pub fn save_ai_session(
    state: State<'_, Db>,
    id: Option<i64>,
    title: String,
    messages: Vec<ai::StoredChatMessage>,
) -> Result<ai::AiSession, String> {
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    ai::save_session(&conn, id, &title, &messages)
}

#[tauri::command]
pub fn delete_ai_session(state: State<'_, Db>, id: i64) -> Result<bool, String> {
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    ai::delete_session(&conn, id)
}

fn ai_config_from_state(state: &State<'_, Db>) -> Result<ai::AiConfig, String> {
    let conn = state.0.lock().map_err(|error| error.to_string())?;
    ai::get_config(&conn)?.ok_or_else(|| "请先在设置中配置 AI".to_string())
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
    if let Some(date) = &goal.target_date {
        if !db::is_valid_date(date) {
            return Err("目标日期格式无效".to_string());
        }
    }
    if let (Some(start), Some(target)) = (&goal.start_date, &goal.target_date) {
        if target < start {
            return Err("目标日期不能早于起始日期".to_string());
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

fn validate_profile(profile: &Profile) -> Result<(), String> {
    if let Some(height) = profile.height_cm {
        if !height.is_finite() || !(80.0..=250.0).contains(&height) {
            return Err("身高应在 80-250 cm 之间".to_string());
        }
    }
    if let Some(age) = profile.age {
        if !(10..=100).contains(&age) {
            return Err("年龄应在 10-100 之间".to_string());
        }
    }
    if let Some(sex) = &profile.sex {
        if sex != "male" && sex != "female" {
            return Err("性别参数无效".to_string());
        }
    }
    if let Some(level) = profile.activity_level {
        if !level.is_finite() || !(1.0..=2.5).contains(&level) {
            return Err("活动系数应在 1-2.5 之间".to_string());
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
