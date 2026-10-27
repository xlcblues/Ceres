use std::io::BufRead;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::db;

const SETTING_KEY: &str = "ai_config";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub provider: String,
    #[serde(alias = "baseUrl")]
    pub base_url: String,
    pub model: String,
    #[serde(alias = "apiKey")]
    pub api_key: String,
}

pub fn get_config(conn: &Connection) -> Result<Option<AiConfig>, String> {
    let value: Option<String> = conn
        .query_row(
            "SELECT value FROM setting WHERE key = ?1",
            params![SETTING_KEY],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    value
        .map(|json| {
            serde_json::from_str(&json).map_err(|error| format!("AI 配置解析失败：{error}"))
        })
        .transpose()
}

pub fn save_config(conn: &Connection, config: &AiConfig) -> Result<AiConfig, String> {
    validate_config(config)?;
    let json = serde_json::to_string(config).map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT INTO setting (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![SETTING_KEY, json],
    )
    .map_err(|error| error.to_string())?;
    Ok(config.clone())
}

fn validate_config(config: &AiConfig) -> Result<(), String> {
    if config.provider.trim().is_empty() {
        return Err("请选择 AI 服务商".to_string());
    }
    if !config.base_url.trim().starts_with("http") {
        return Err("Base URL 无效".to_string());
    }
    if config.model.trim().is_empty() {
        return Err("请填写模型名称".to_string());
    }
    if config.api_key.trim().is_empty() {
        return Err("请填写 API Key".to_string());
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

pub fn chat_content(config: &AiConfig, messages: &[ChatMessage]) -> Result<String, String> {
    let base = config.base_url.trim().trim_end_matches('/');
    let url = format!("{base}/chat/completions");
    let payload = serde_json::json!({
        "model": config.model,
        "messages": messages,
        "temperature": 0.3,
    });
    let agent = ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(30))
        .timeout_read(Duration::from_secs(120))
        .timeout_write(Duration::from_secs(60))
        .build();
    let auth = format!("Bearer {}", config.api_key.trim());
    match agent
        .post(&url)
        .set("Authorization", &auth)
        .set("Content-Type", "application/json")
        .send_json(payload)
    {
        Ok(response) => {
            let status = response.status();
            let json: Value = response
                .into_json()
                .map_err(|error| format!("解析 AI 响应失败：{error}"))?;
            if !(200..300).contains(&status) {
                let hint = if status == 401 {
                    "API Key 无效或已过期"
                } else {
                    "AI 服务错误"
                };
                return Err(format!("{hint}（{status}）：{json}"));
            }
            let content = json
                .get("choices")
                .and_then(|value| value.get(0))
                .and_then(|value| value.get("message"))
                .and_then(|value| value.get("content"))
                .and_then(|value| value.as_str())
                .ok_or_else(|| "AI 响应中缺少内容".to_string())?
                .trim()
                .to_string();
            if content.is_empty() {
                return Err("AI 返回了空内容".to_string());
            }
            Ok(content)
        }
        Err(ureq::Error::Status(status, response)) => {
            let body = response.into_string().unwrap_or_default();
            let hint = if status == 401 {
                "API Key 无效或已过期，请检查设置中的 Key"
            } else {
                "AI 服务返回错误"
            };
            Err(format!("{hint}（{status}）：{body}"))
        }
        Err(error) => Err(format!("AI 请求失败：{error}")),
    }
}

pub fn chat_content_stream(
    config: &AiConfig,
    messages: &[ChatMessage],
    on_delta: &mut dyn FnMut(&str) -> Result<(), String>,
) -> Result<String, String> {
    let base = config.base_url.trim().trim_end_matches('/');
    let url = format!("{base}/chat/completions");
    let payload = serde_json::json!({
        "model": config.model,
        "messages": messages,
        "temperature": 0.3,
        "stream": true,
    });
    let agent = ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(30))
        .timeout_read(Duration::from_secs(300))
        .timeout_write(Duration::from_secs(60))
        .build();
    let auth = format!("Bearer {}", config.api_key.trim());
    match agent
        .post(&url)
        .set("Authorization", &auth)
        .set("Content-Type", "application/json")
        .send_json(payload)
    {
        Ok(response) => {
            let status = response.status();
            if !(200..300).contains(&status) {
                let body = response.into_string().unwrap_or_default();
                let hint = if status == 401 {
                    "API Key 无效或已过期"
                } else {
                    "AI 服务错误"
                };
                return Err(format!("{hint}（{status}）：{body}"));
            }
            let reader = response.into_reader();
            let mut buffered = std::io::BufReader::new(reader);
            let mut full = String::new();
            let mut line = String::new();
            loop {
                line.clear();
                let bytes = buffered
                    .read_line(&mut line)
                    .map_err(|error| format!("读取 AI 流失败：{error}"))?;
                if bytes == 0 {
                    break;
                }
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                let data = if let Some(rest) = trimmed.strip_prefix("data:") {
                    rest.trim()
                } else if trimmed.starts_with('{') {
                    trimmed
                } else {
                    continue;
                };
                if data == "[DONE]" {
                    break;
                }
                let value: Value = serde_json::from_str(data)
                    .map_err(|error| format!("解析 AI 流数据失败：{error}"))?;
                if let Some(text) = value
                    .get("choices")
                    .and_then(|choices| choices.get(0))
                    .and_then(|choice| {
                        choice
                            .get("delta")
                            .and_then(|delta| delta.get("content"))
                            .or_else(|| {
                                choice
                                    .get("message")
                                    .and_then(|message| message.get("content"))
                            })
                    })
                    .and_then(|content| content.as_str())
                {
                    full.push_str(text);
                    on_delta(text)?;
                }
            }
            let content = full.trim().to_string();
            if content.is_empty() {
                return Err("AI 返回了空内容".to_string());
            }
            Ok(content)
        }
        Err(ureq::Error::Status(status, response)) => {
            let body = response.into_string().unwrap_or_default();
            let hint = if status == 401 {
                "API Key 无效或已过期，请检查设置中的 Key"
            } else {
                "AI 服务返回错误"
            };
            Err(format!("{hint}（{status}）：{body}"))
        }
        Err(error) => Err(format!("AI 请求失败：{error}")),
    }
}

pub fn test_connection(config: &AiConfig) -> Result<String, String> {
    let base = config.base_url.trim().trim_end_matches('/');
    let url = format!("{base}/models");
    let agent = ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(20))
        .timeout_read(Duration::from_secs(30))
        .timeout_write(Duration::from_secs(20))
        .build();
    let auth = format!("Bearer {}", config.api_key.trim());
    match agent.get(&url).set("Authorization", &auth).call() {
        Ok(response) => {
            let status = response.status();
            if (200..300).contains(&status) {
                Ok("连接成功，API Key 有效".to_string())
            } else {
                Err(format!("AI 服务错误（{status}）"))
            }
        }
        Err(ureq::Error::Status(status, response)) => {
            let body = response.into_string().unwrap_or_default();
            let hint = if status == 401 {
                "API Key 无效或已过期，请检查设置中的 Key"
            } else if status == 404 {
                "接口不支持模型列表，可尝试直接对话"
            } else {
                "连接失败，请检查接口地址与 Key"
            };
            Err(format!("{hint}（{status}）：{body}"))
        }
        Err(error) => Err(format!("连接失败：{error}")),
    }
}

fn days_from_civil(year: i32, month: u32, day: u32) -> i64 {
    let year = if month <= 2 { year - 1 } else { year };
    let era = (if year >= 0 { year } else { year - 399 }) / 400;
    let yoe = year - era * 400;
    let mp = (month + 9) % 12;
    let doy = (153 * mp + 2) / 5 + day - 1;
    let yoe64 = i64::from(yoe);
    let doe = yoe64 * 365 + yoe64 / 4 - yoe64 / 100 + i64::from(doy);
    i64::from(era) * 146097 + doe - 719468
}

fn civil_from_days(days: i64) -> (i32, u32, u32) {
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if month <= 2 { year + 1 } else { year };
    (year as i32, month as u32, day as u32)
}

pub fn today() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0);
    let (year, month, day) = civil_from_days((seconds + 8 * 3600) / 86400);
    format!("{year:04}-{month:02}-{day:02}")
}

fn shift_date(date: &str, offset: i64) -> String {
    let parts: Vec<&str> = date.split('-').collect();
    if parts.len() != 3 {
        return date.to_string();
    }
    let year: i32 = parts[0].parse().unwrap_or(2000);
    let month: u32 = parts[1].parse().unwrap_or(1);
    let day: u32 = parts[2].parse().unwrap_or(1);
    let (year, month, day) = civil_from_days(days_from_civil(year, month, day) + offset);
    format!("{year:04}-{month:02}-{day:02}")
}

fn round1(value: f64) -> String {
    format!("{value:.1}")
}

fn opt_f64(value: Option<f64>) -> String {
    value
        .map(|item| format!("{item:.1}"))
        .unwrap_or_else(|| "未设置".to_string())
}

fn opt_int(value: Option<i64>) -> String {
    value
        .map(|item| item.to_string())
        .unwrap_or_else(|| "未设置".to_string())
}

fn opt_text(value: Option<&str>) -> String {
    value
        .filter(|item| !item.is_empty())
        .map(|item| item.to_string())
        .unwrap_or_else(|| "未设置".to_string())
}

pub fn build_context(conn: &Connection, date: &str) -> Result<String, String> {
    let mut lines = vec![format!("=== Ceres 系统数据（{date}） ===")];

    match db::get_goal(conn) {
        Ok(Some(goal)) => lines.push(format!(
            "减肥目标：目标体重 {} kg，起始体重 {} kg，开始日期 {}，目标日期 {}。",
            round1(goal.target_weight),
            opt_f64(goal.start_weight),
            opt_text(goal.start_date.as_deref()),
            opt_text(goal.target_date.as_deref()),
        )),
        Ok(None) => lines.push("减肥目标：尚未设置。".to_string()),
        Err(error) => lines.push(format!("减肥目标：读取失败（{error}）。")),
    }

    match db::get_profile(conn) {
        Ok(Some(profile)) => lines.push(format!(
            "身体参数：身高 {} cm，年龄 {} 岁，性别 {}，活动水平 {}。",
            opt_f64(profile.height_cm),
            opt_int(profile.age),
            opt_text(profile.sex.as_deref()),
            opt_f64(profile.activity_level),
        )),
        Ok(None) => lines.push("身体参数：尚未设置。".to_string()),
        Err(error) => lines.push(format!("身体参数：读取失败（{error}）。")),
    }

    match db::list_entries(conn, 30) {
        Ok(entries) if entries.is_empty() => lines.push("体重记录：暂无。".to_string()),
        Ok(entries) => {
            lines.push("最近体重记录（日期：体重 kg / 体脂 % / 备注）：".to_string());
            for entry in entries {
                lines.push(format!(
                    "- {}：{} kg / {} / {}",
                    entry.date,
                    round1(entry.weight),
                    opt_f64(entry.body_fat),
                    entry
                        .note
                        .clone()
                        .filter(|note| !note.is_empty())
                        .unwrap_or_else(|| "无".to_string()),
                ));
            }
        }
        Err(error) => lines.push(format!("体重记录：读取失败（{error}）。")),
    }

    let yesterday = shift_date(date, -1);
    for day in [date.to_string(), yesterday] {
        match db::get_day_logs(conn, &day) {
            Ok(logs) => {
                lines.push(format!(
                    "{day} 饮食运动：摄入 {} kcal，运动消耗 {} kcal，饮水 {} ml。",
                    round1(logs.food_kcal),
                    round1(logs.exercise_kcal),
                    round1(logs.water_ml.unwrap_or(0.0)),
                ));
                for food in &logs.foods {
                    lines.push(format!(
                        "- 食物：{} {} 克（{}），约 {} kcal",
                        food.name,
                        round1(food.grams),
                        food.category,
                        round1(food.kcal),
                    ));
                }
                for exercise in &logs.exercises {
                    lines.push(format!(
                        "- 运动：{} {} 分钟（{}），约消耗 {} kcal",
                        exercise.name,
                        round1(exercise.minutes),
                        exercise.category,
                        round1(exercise.kcal),
                    ));
                }
                if logs.foods.is_empty() && logs.exercises.is_empty() && logs.water_ml.is_none() {
                    lines.push("- 暂无记录。".to_string());
                }
            }
            Err(error) => lines.push(format!("{day} 饮食运动：读取失败（{error}）。")),
        }
    }

    match db::list_food_catalog(conn) {
        Ok(foods) => lines.push(format!(
            "食物库（{} 项）：{}",
            foods.len(),
            foods
                .iter()
                .map(|item| item.name.as_str())
                .collect::<Vec<_>>()
                .join("、"),
        )),
        Err(error) => lines.push(format!("食物库：读取失败（{error}）。")),
    }

    match db::list_exercise_catalog(conn) {
        Ok(exercises) => lines.push(format!(
            "运动库（{} 项）：{}",
            exercises.len(),
            exercises
                .iter()
                .map(|item| item.name.as_str())
                .collect::<Vec<_>>()
                .join("、"),
        )),
        Err(error) => lines.push(format!("运动库：读取失败（{error}）。")),
    }

    Ok(lines.join("\n"))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatResponse {
    pub text: String,
    pub actions: Vec<AiAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AiAction {
    #[serde(rename = "weight")]
    Weight {
        date: String,
        #[serde(rename = "weightKg")]
        weight_kg: f64,
        #[serde(rename = "bodyFat", default)]
        body_fat: Option<f64>,
        #[serde(default)]
        note: Option<String>,
    },
    #[serde(rename = "food")]
    Food {
        date: String,
        name: String,
        #[serde(default)]
        category: String,
        grams: f64,
        #[serde(rename = "kcalPer100g")]
        kcal_per_100g: f64,
        #[serde(default)]
        protein: Option<f64>,
        #[serde(default)]
        carbs: Option<f64>,
        #[serde(default)]
        fat: Option<f64>,
        #[serde(rename = "unitName", default)]
        unit_name: Option<String>,
        #[serde(rename = "unitGrams", default)]
        unit_grams: Option<f64>,
    },
    #[serde(rename = "exercise")]
    Exercise {
        date: String,
        name: String,
        #[serde(default)]
        category: String,
        minutes: f64,
        met: f64,
    },
    #[serde(rename = "water")]
    Water { date: String, ml: f64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredChatMessage {
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub actions: Vec<AiAction>,
    #[serde(rename = "appliedSummary", default)]
    pub applied_summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSessionMeta {
    pub id: i64,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSession {
    pub id: i64,
    pub title: String,
    pub messages: Vec<StoredChatMessage>,
    pub created_at: String,
    pub updated_at: String,
}

pub fn list_sessions(conn: &Connection) -> Result<Vec<AiSessionMeta>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, created_at, updated_at
             FROM ai_session
             ORDER BY updated_at DESC, id DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(AiSessionMeta {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

pub fn get_session(conn: &Connection, id: i64) -> Result<Option<AiSession>, String> {
    let row: Option<(i64, String, String, String, String)> = conn
        .query_row(
            "SELECT id, title, messages_json, created_at, updated_at
             FROM ai_session WHERE id = ?1",
            params![id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;
    match row {
        Some((session_id, title, messages_json, created_at, updated_at)) => {
            let messages: Vec<StoredChatMessage> =
                serde_json::from_str(&messages_json).map_err(|error| error.to_string())?;
            Ok(Some(AiSession {
                id: session_id,
                title,
                messages,
                created_at,
                updated_at,
            }))
        }
        None => Ok(None),
    }
}

pub fn save_session(
    conn: &Connection,
    id: Option<i64>,
    title: &str,
    messages: &[StoredChatMessage],
) -> Result<AiSession, String> {
    let messages_json = serde_json::to_string(messages).map_err(|error| error.to_string())?;
    let title = title.trim().to_string();
    let session = match id {
        Some(session_id) => {
            let updated = conn
                .execute(
                    "UPDATE ai_session
                     SET title = ?1, messages_json = ?2, updated_at = datetime('now')
                     WHERE id = ?3",
                    params![title, messages_json, session_id],
                )
                .map_err(|error| error.to_string())?;
            if updated == 0 {
                return Err("会话不存在".to_string());
            }
            let (created_at, updated_at): (String, String) = conn
                .query_row(
                    "SELECT created_at, updated_at FROM ai_session WHERE id = ?1",
                    params![session_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .map_err(|error| error.to_string())?;
            AiSession {
                id: session_id,
                title,
                messages: messages.to_vec(),
                created_at,
                updated_at,
            }
        }
        None => {
            conn.execute(
                "INSERT INTO ai_session (title, messages_json) VALUES (?1, ?2)",
                params![title, messages_json],
            )
            .map_err(|error| error.to_string())?;
            let session_id = conn.last_insert_rowid();
            let (created_at, updated_at): (String, String) = conn
                .query_row(
                    "SELECT created_at, updated_at FROM ai_session WHERE id = ?1",
                    params![session_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .map_err(|error| error.to_string())?;
            AiSession {
                id: session_id,
                title,
                messages: messages.to_vec(),
                created_at,
                updated_at,
            }
        }
    };
    Ok(session)
}

pub fn delete_session(conn: &Connection, id: i64) -> Result<bool, String> {
    let removed = conn
        .execute("DELETE FROM ai_session WHERE id = ?1", params![id])
        .map_err(|error| error.to_string())?;
    Ok(removed > 0)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiApplyResult {
    pub applied: usize,
    pub created_foods: Vec<String>,
    pub created_exercises: Vec<String>,
    pub message: String,
}

fn ensure_date(date: &str) -> Result<(), String> {
    if !db::is_valid_date(date) {
        return Err(format!("日期无效：{date}"));
    }
    Ok(())
}

fn latest_weight(conn: &Connection) -> Result<f64, String> {
    if let Ok(entries) = db::list_entries(conn, 1) {
        if let Some(entry) = entries.first() {
            return Ok(entry.weight);
        }
    }
    if let Ok(Some(goal)) = db::get_goal(conn) {
        if let Some(start_weight) = goal.start_weight.filter(|value| *value > 0.0) {
            return Ok(start_weight);
        }
    }
    Ok(60.0)
}

pub fn apply_actions(conn: &Connection, actions: &[AiAction]) -> Result<AiApplyResult, String> {
    let mut applied = 0usize;
    let mut created_foods: Vec<String> = Vec::new();
    let mut created_exercises: Vec<String> = Vec::new();

    for action in actions {
        match action {
            AiAction::Weight {
                date,
                weight_kg,
                body_fat,
                note,
            } => {
                ensure_date(date)?;
                if *weight_kg <= 0.0 || !weight_kg.is_finite() {
                    return Err(format!("体重数值无效：{weight_kg}"));
                }
                let note_text = note
                    .as_deref()
                    .map(str::trim)
                    .filter(|item| !item.is_empty());
                db::upsert_entry(conn, date, *weight_kg, *body_fat, note_text)
                    .map_err(|error| format!("录入体重失败：{error}"))?;
            }
            AiAction::Food {
                date,
                name,
                category,
                grams,
                kcal_per_100g,
                protein,
                carbs,
                fat,
                unit_name,
                unit_grams,
            } => {
                ensure_date(date)?;
                let name = name.trim().to_string();
                if name.is_empty() {
                    return Err("食物名称不能为空".to_string());
                }
                if *grams <= 0.0 || *grams > 5000.0 || !grams.is_finite() {
                    return Err(format!("食物重量无效：{grams}"));
                }
                if *kcal_per_100g <= 0.0 || !kcal_per_100g.is_finite() {
                    return Err(format!("食物热量无效：{kcal_per_100g}"));
                }
                for macro_value in [*protein, *carbs, *fat].into_iter().flatten() {
                    if macro_value < 0.0 || !macro_value.is_finite() {
                        return Err("营养成分不能为负数".to_string());
                    }
                }
                let category = if category.trim().is_empty() {
                    "其他".to_string()
                } else {
                    category.trim().to_string()
                };
                let foods = db::list_food_catalog(conn).map_err(|error| error.to_string())?;
                let food_id = match foods.iter().find(|item| item.name == name) {
                    Some(item) => item.id,
                    None => {
                        let unit_name = unit_name
                            .as_deref()
                            .filter(|value| !value.trim().is_empty())
                            .unwrap_or("克");
                        let unit_grams = unit_grams.unwrap_or(100.0);
                        if unit_grams <= 0.0 || !unit_grams.is_finite() {
                            return Err("计量单位克数必须大于 0".to_string());
                        }
                        let item = db::create_food_catalog_item(
                            conn,
                            &name,
                            &category,
                            *kcal_per_100g,
                            *protein,
                            *carbs,
                            *fat,
                            unit_name,
                            unit_grams,
                        )
                        .map_err(|error| format!("新建食物失败：{error}"))?;
                        created_foods.push(item.name.clone());
                        item.id
                    }
                };
                db::log_food(conn, date, food_id, *grams)
                    .map_err(|error| format!("录入食物失败：{error}"))?;
            }
            AiAction::Exercise {
                date,
                name,
                category,
                minutes,
                met,
            } => {
                ensure_date(date)?;
                let name = name.trim().to_string();
                if name.is_empty() {
                    return Err("运动名称不能为空".to_string());
                }
                if *minutes <= 0.0 || *minutes > 600.0 || !minutes.is_finite() {
                    return Err(format!("运动时长无效：{minutes}"));
                }
                if *met <= 0.0 || *met > 20.0 || !met.is_finite() {
                    return Err(format!("MET 值无效：{met}"));
                }
                let category = if category.trim().is_empty() {
                    "其他".to_string()
                } else {
                    category.trim().to_string()
                };
                let exercises =
                    db::list_exercise_catalog(conn).map_err(|error| error.to_string())?;
                let exercise_id = match exercises.iter().find(|item| item.name == name) {
                    Some(item) => item.id,
                    None => {
                        let item = db::create_exercise_catalog_item(
                            conn,
                            &name,
                            &category,
                            *met,
                        )
                        .map_err(|error| format!("新建运动失败：{error}"))?;
                        created_exercises.push(item.name.clone());
                        item.id
                    }
                };
                let weight_kg = latest_weight(conn)?;
                db::log_exercise(conn, date, exercise_id, *minutes, weight_kg)
                    .map_err(|error| format!("录入运动失败：{error}"))?;
            }
            AiAction::Water { date, ml } => {
                ensure_date(date)?;
                if *ml < 0.0 || *ml > 10_000.0 || !ml.is_finite() {
                    return Err(format!("饮水量无效：{ml}"));
                }
                db::upsert_water(conn, date, *ml)
                    .map_err(|error| format!("录入饮水失败：{error}"))?;
            }
        }
        applied += 1;
    }

    let message = format!("已录入 {applied} 条记录");
    Ok(AiApplyResult {
        applied,
        created_foods,
        created_exercises,
        message,
    })
}

const SYSTEM_PROMPT: &str = r#"你是 Ceres 减肥记录应用的 AI 助手。请基于下面的系统数据分析用户的减重进展，指出问题并给出简洁、具体、可执行的中文建议。回复正文请使用 Markdown 格式排版，可以包含标题、列表、粗体、引用、表格等，保持清晰易读。没有提供的数据不要编造，必要时建议用户补充记录。

系统数据：
{context}

回复规则：
- 先用 Markdown 输出完整的回复正文，正文中不要出现 JSON。
- 当用户要求录入数据（例如报告今天或某天的体重、吃了什么食物、做了什么运动、喝了多少水）时，在 Markdown 正文末尾再输出一个 JSON 对象，不要用 markdown 代码块包裹，格式如下：
{"actions": [{"type": "weight", "date": "YYYY-MM-DD", "weightKg": 65.5, "bodyFat": null, "note": null}, {"type": "food", "date": "YYYY-MM-DD", "name": "食物名", "category": "主食|蛋白质|蔬菜|水果|饮品|零食|其他", "grams": 150, "kcalPer100g": 116, "protein": 2.6, "carbs": 25.9, "fat": 0.3, "unitName": "克", "unitGrams": 100}, {"type": "exercise", "date": "YYYY-MM-DD", "name": "运动名", "category": "有氧|力量|身心|球类|户外|器械|日常|其他", "minutes": 30, "met": 7.0}, {"type": "water", "date": "YYYY-MM-DD", "ml": 500}]}
- 没有需要录入的数据时，不要输出 JSON。
- 食物或运动不在库中时，仍然输出完整 action，系统会自动新建并录入。
- 日期使用 YYYY-MM-DD 格式，默认今天。
- JSON 必须放在回复最末尾，正文与 JSON 之间可以换行，JSON 后面不要再输出任何文字。"#;

const FOOD_ESTIMATE_SYSTEM: &str = r#"你是食物营养估算助手。根据食物名称和食用量描述估算每 100 克营养成分，数值必须合理。
只输出一个 JSON 对象，不要 markdown 代码块，不要额外文字。格式：
{"name": "食物名称", "category": "主食|蛋白质|蔬菜|水果|饮品|零食|其他", "kcalPer100g": 每100克千卡, "protein": 每100克蛋白质克数, "carbs": 每100克碳水化合物克数, "fat": 每100克脂肪克数, "unitName": "常用单位，如克、个、碗、杯", "unitGrams": 该常用单位的克数}
示例：{"name": "鸡蛋", "category": "蛋白质", "kcalPer100g": 144, "protein": 13.3, "carbs": 2.8, "fat": 8.8, "unitName": "个", "unitGrams": 50}"#;

const EXERCISE_ESTIMATE_SYSTEM: &str = r#"你是运动强度估算专家。根据运动名称和时长描述估算 MET 代谢当量，数值必须合理。
只输出一个 JSON 对象，不要 markdown 代码块，不要额外文字。格式：
{"name": "运动名称", "category": "有氧|力量|身心|球类|户外|器械|日常|其他", "met": 数值}
参考值：散步 2.8、快走 4.3、慢跑 7、快跑 10、骑行 6.8、游泳 8、跳绳 11、瑜伽 2.5、力量训练 5、羽毛球 5.5。MET 必须在 1-16 之间。
示例：{"name": "快走", "category": "有氧", "met": 4.3}"#;

fn parse_json(text: &str) -> Result<Value, String> {
    let trimmed = text.trim();
    let candidate = if trimmed.starts_with("```") {
        trimmed
            .lines()
            .filter(|line| !line.trim_start().starts_with("```"))
            .collect::<Vec<_>>()
            .join("\n")
            .trim()
            .to_string()
    } else {
        match (trimmed.find('{'), trimmed.rfind('}')) {
            (Some(start), Some(end)) if end > start => trimmed[start..=end].to_string(),
            _ => trimmed.to_string(),
        }
    };
    serde_json::from_str(&candidate).map_err(|error| format!("AI 返回的 JSON 无法解析：{error}"))
}

fn reply_and_actions(raw: &str) -> (String, Vec<AiAction>) {
    if let Ok(value) = parse_json(raw) {
        let actions = value
            .get("actions")
            .and_then(|item| item.as_array())
            .cloned()
            .map(|array| serde_json::from_value(Value::Array(array)).unwrap_or_default())
            .unwrap_or_default();
        if let Some(reply) = value.get("reply").and_then(|item| item.as_str()) {
            return (reply.trim().to_string(), actions);
        }
        let trimmed = raw.trim();
        if let (Some(start), Some(end)) = (trimmed.find('{'), trimmed.rfind('}')) {
            if end > start {
                let text = trimmed[..start].trim().to_string();
                if !text.is_empty() {
                    return (text, actions);
                }
            }
        }
        return (String::new(), actions);
    }
    (raw.trim().to_string(), Vec::new())
}

pub fn chat_with_context(
    config: &AiConfig,
    context: &str,
    prompt: &str,
    history: &[ChatMessage],
) -> Result<AiChatResponse, String> {
    let system = SYSTEM_PROMPT.replace("{context}", context);
    let mut messages = vec![ChatMessage {
        role: "system".to_string(),
        content: system,
    }];
    messages.extend_from_slice(history);
    messages.push(ChatMessage {
        role: "user".to_string(),
        content: prompt.trim().to_string(),
    });
    let raw = chat_content(config, &messages)?;
    let (text, actions) = reply_and_actions(&raw);
    Ok(AiChatResponse { text, actions })
}

pub fn chat_with_context_stream(
    config: &AiConfig,
    context: &str,
    prompt: &str,
    history: &[ChatMessage],
    mut on_delta: impl FnMut(&str) -> Result<(), String>,
) -> Result<AiChatResponse, String> {
    let system = SYSTEM_PROMPT.replace("{context}", context);
    let mut messages = vec![ChatMessage {
        role: "system".to_string(),
        content: system,
    }];
    messages.extend_from_slice(history);
    messages.push(ChatMessage {
        role: "user".to_string(),
        content: prompt.trim().to_string(),
    });
    let raw = chat_content_stream(config, &messages, &mut on_delta)?;
    let (text, actions) = reply_and_actions(&raw);
    Ok(AiChatResponse { text, actions })
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AiStreamEvent {
    Delta { text: String },
    Done { actions: Vec<AiAction> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoodEstimate {
    pub name: String,
    pub category: String,
    #[serde(rename = "kcal_per_100g", alias = "kcalPer100g")]
    pub kcal_per_100g: f64,
    #[serde(default)]
    pub protein: Option<f64>,
    #[serde(default)]
    pub carbs: Option<f64>,
    #[serde(default)]
    pub fat: Option<f64>,
    #[serde(rename = "unit_name", alias = "unitName", default)]
    pub unit_name: Option<String>,
    #[serde(rename = "unit_grams", alias = "unitGrams", default)]
    pub unit_grams: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExerciseEstimate {
    pub name: String,
    pub category: String,
    pub met: f64,
}

pub fn estimate_food(
    config: &AiConfig,
    name: &str,
    amount_text: Option<&str>,
) -> Result<FoodEstimate, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("食物名称不能为空".to_string());
    }
    let mut user = format!("食物名称：{name}");
    if let Some(amount) = amount_text.filter(|text| !text.trim().is_empty()) {
        user.push_str(&format!("；食用量描述：{}", amount.trim()));
    }
    let messages = [
        ChatMessage {
            role: "system".to_string(),
            content: FOOD_ESTIMATE_SYSTEM.to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: user,
        },
    ];
    let raw = chat_content(config, &messages)?;
    let value = parse_json(&raw)?;
    let mut estimate: FoodEstimate = serde_json::from_value(value)
        .map_err(|error| format!("AI 返回的食物数据不完整：{error}"))?;
    if estimate.name.trim().is_empty() {
        estimate.name = name.to_string();
    }
    if estimate.category.trim().is_empty() {
        estimate.category = "其他".to_string();
    }
    if estimate.kcal_per_100g <= 0.0 || !estimate.kcal_per_100g.is_finite() {
        return Err("AI 返回的热量数值无效".to_string());
    }
    Ok(estimate)
}

pub fn estimate_exercise(
    config: &AiConfig,
    name: &str,
    duration_text: Option<&str>,
) -> Result<ExerciseEstimate, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("运动名称不能为空".to_string());
    }
    let mut user = format!("运动名称：{name}");
    if let Some(duration) = duration_text.filter(|text| !text.trim().is_empty()) {
        user.push_str(&format!("；时长描述：{}", duration.trim()));
    }
    let messages = [
        ChatMessage {
            role: "system".to_string(),
            content: EXERCISE_ESTIMATE_SYSTEM.to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: user,
        },
    ];
    let raw = chat_content(config, &messages)?;
    let value = parse_json(&raw)?;
    let mut estimate: ExerciseEstimate = serde_json::from_value(value)
        .map_err(|error| format!("AI 返回的运动数据不完整：{error}"))?;
    if estimate.name.trim().is_empty() {
        estimate.name = name.to_string();
    }
    if estimate.category.trim().is_empty() {
        estimate.category = "其他".to_string();
    }
    if estimate.met <= 0.0 || estimate.met > 20.0 || !estimate.met.is_finite() {
        return Err("AI 返回的 MET 数值无效".to_string());
    }
    Ok(estimate)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ai_config_round_trips_snake_case() {
        let config = AiConfig {
            provider: "siliconflow".into(),
            base_url: "https://api.siliconflow.cn/v1".into(),
            model: "deepseek-ai/DeepSeek-V3".into(),
            api_key: "sk-test".into(),
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"base_url\":"));
        assert!(json.contains("\"api_key\":"));
        let parsed: AiConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.base_url, config.base_url);
        assert_eq!(parsed.api_key, config.api_key);
    }

    #[test]
    fn ai_config_accepts_legacy_camel_case() {
        let json = r#"{"provider":"openai","baseUrl":"https://api.openai.com/v1","model":"gpt-4o-mini","apiKey":"sk-old"}"#;
        let config: AiConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.base_url, "https://api.openai.com/v1");
        assert_eq!(config.api_key, "sk-old");
    }

    #[test]
    fn food_estimate_serializes_snake_case_for_frontend() {
        let estimate = FoodEstimate {
            name: "鸡胸肉".into(),
            category: "蛋白质".into(),
            kcal_per_100g: 144.0,
            protein: Some(24.0),
            carbs: None,
            fat: Some(3.0),
            unit_name: Some("个".into()),
            unit_grams: Some(50.0),
        };
        let json = serde_json::to_string(&estimate).unwrap();
        assert!(json.contains("\"kcal_per_100g\":144.0"));
        assert!(json.contains("\"unit_name\":\"个\""));
        assert!(json.contains("\"unit_grams\":50.0"));
        assert!(!json.contains("kcalPer100g"));
        assert!(!json.contains("unitName"));
    }

    #[test]
    fn food_estimate_accepts_ai_camel_case_json() {
        let json = r#"{"name":"苹果","category":"水果","kcalPer100g":52.0,"protein":0.3,"unitName":"个","unitGrams":180.0}"#;
        let estimate: FoodEstimate = serde_json::from_str(json).unwrap();
        assert_eq!(estimate.kcal_per_100g, 52.0);
        assert_eq!(estimate.unit_name.as_deref(), Some("个"));
        assert_eq!(estimate.unit_grams, Some(180.0));
    }
}


