use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Goal {
    pub target_weight: f64,
    pub start_weight: Option<f64>,
    pub start_date: Option<String>,
    pub target_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    pub id: i64,
    pub date: String,
    pub weight: f64,
    pub body_fat: Option<f64>,
    pub note: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub height_cm: Option<f64>,
    pub age: Option<i64>,
    pub sex: Option<String>,
    pub activity_level: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoodCatalogItem {
    pub id: i64,
    pub name: String,
    pub category: String,
    pub kcal_per_100g: f64,
    pub protein: Option<f64>,
    pub carbs: Option<f64>,
    pub fat: Option<f64>,
    pub unit_name: String,
    pub unit_grams: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExerciseCatalogItem {
    pub id: i64,
    pub name: String,
    pub category: String,
    pub met: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoodLogItem {
    pub id: i64,
    pub date: String,
    pub food_id: i64,
    pub name: String,
    pub category: String,
    pub grams: f64,
    pub kcal: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExerciseLogItem {
    pub id: i64,
    pub date: String,
    pub exercise_id: i64,
    pub name: String,
    pub category: String,
    pub minutes: f64,
    pub kcal: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaterLog {
    pub date: String,
    pub water_ml: f64,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayLogs {
    pub date: String,
    pub foods: Vec<FoodLogItem>,
    pub exercises: Vec<ExerciseLogItem>,
    pub water_ml: Option<f64>,
    pub food_kcal: f64,
    pub exercise_kcal: f64,
}

pub struct Db(pub Mutex<Connection>);

pub fn init(app: &tauri::AppHandle) -> Result<Connection, String> {
    use tauri::Manager;

    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let conn = Connection::open(dir.join("ceres.db")).map_err(|error| error.to_string())?;
    migrate(&conn).map_err(|error| error.to_string())?;
    Ok(conn)
}

pub fn migrate(conn: &Connection) -> Result<(), rusqlite::Error> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    if version < 1 {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS goal (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              target_weight REAL NOT NULL,
              start_weight REAL,
              start_date TEXT,
              created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS entry (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              date TEXT NOT NULL UNIQUE,
              weight REAL NOT NULL,
              body_fat REAL,
              note TEXT,
              created_at TEXT DEFAULT (datetime('now')),
              updated_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS setting (
              key TEXT PRIMARY KEY,
              value TEXT
            );
            PRAGMA user_version = 1;
            ",
        )?;
    }
    if version < 2 {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS profile (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              height_cm REAL,
              age INTEGER,
              sex TEXT,
              activity_level REAL,
              updated_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS food_catalog (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL UNIQUE,
              category TEXT NOT NULL DEFAULT '其他',
              kcal_per_100g REAL NOT NULL,
              protein REAL,
              carbs REAL,
              fat REAL,
              unit_name TEXT NOT NULL DEFAULT '克',
              unit_grams REAL NOT NULL DEFAULT 100
            );
            CREATE TABLE IF NOT EXISTS exercise_catalog (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL UNIQUE,
              category TEXT NOT NULL DEFAULT '其他',
              met REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS food_log (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              date TEXT NOT NULL,
              food_id INTEGER NOT NULL REFERENCES food_catalog(id) ON DELETE CASCADE,
              grams REAL NOT NULL,
              kcal REAL NOT NULL,
              created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS exercise_log (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              date TEXT NOT NULL,
              exercise_id INTEGER NOT NULL REFERENCES exercise_catalog(id) ON DELETE CASCADE,
              minutes REAL NOT NULL,
              kcal REAL NOT NULL,
              created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS water_log (
              date TEXT PRIMARY KEY,
              water_ml REAL NOT NULL,
              updated_at TEXT DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_food_log_date ON food_log(date);
            CREATE INDEX IF NOT EXISTS idx_exercise_log_date ON exercise_log(date);
            PRAGMA user_version = 2;
            ",
        )?;
        seed_catalogs(conn)?;
    }
    if version < 3 {
        conn.execute_batch(
            "
            ALTER TABLE goal ADD COLUMN target_date TEXT;
            PRAGMA user_version = 3;
            ",
        )?;
    }
    if version < 4 {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS ai_session (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL DEFAULT '',
              messages_json TEXT NOT NULL DEFAULT '[]',
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_ai_session_updated_at
              ON ai_session(updated_at DESC);
            PRAGMA user_version = 4;
            ",
        )?;
    }
    Ok(())
}

const FOOD_SEEDS: &[(i64, &str, &str, f64, f64, f64, f64)] = &[
    (1, "米饭", "主食", 116.0, 2.6, 25.9, 0.3),
    (2, "白粥", "主食", 46.0, 1.1, 9.9, 0.3),
    (3, "馒头", "主食", 223.0, 7.0, 47.0, 1.1),
    (4, "面条", "主食", 110.0, 3.9, 22.8, 0.4),
    (5, "全麦面包", "主食", 246.0, 9.0, 41.0, 3.4),
    (6, "燕麦片", "主食", 367.0, 15.0, 61.0, 6.0),
    (7, "玉米", "主食", 112.0, 4.0, 22.8, 1.2),
    (8, "红薯", "主食", 86.0, 1.6, 20.1, 0.1),
    (9, "土豆", "主食", 77.0, 2.0, 17.0, 0.2),
    (10, "意面", "主食", 131.0, 5.0, 25.0, 1.1),
    (11, "油条", "主食", 388.0, 6.9, 51.0, 17.6),
    (12, "包子", "主食", 227.0, 7.6, 38.0, 5.6),
    (13, "饺子", "主食", 240.0, 8.5, 29.0, 10.0),
    (14, "鸡蛋", "蛋白质", 144.0, 13.3, 2.8, 8.8),
    (15, "鸡胸肉", "蛋白质", 133.0, 24.6, 0.0, 5.0),
    (16, "鸡腿", "蛋白质", 181.0, 16.0, 0.0, 13.0),
    (17, "瘦牛肉", "蛋白质", 125.0, 20.2, 1.2, 4.2),
    (18, "瘦猪肉", "蛋白质", 143.0, 20.3, 1.5, 6.2),
    (19, "三文鱼", "蛋白质", 208.0, 20.4, 0.0, 13.4),
    (20, "虾", "蛋白质", 93.0, 18.6, 2.8, 0.8),
    (21, "豆腐", "蛋白质", 82.0, 8.1, 4.2, 4.2),
    (22, "牛奶", "饮品", 54.0, 3.0, 4.5, 3.2),
    (23, "无糖酸奶", "饮品", 72.0, 3.5, 5.0, 4.0),
    (24, "豆浆", "饮品", 31.0, 3.0, 1.2, 1.6),
    (25, "豆干", "蛋白质", 142.0, 16.2, 4.0, 7.0),
    (26, "西兰花", "蔬菜", 34.0, 2.8, 6.6, 0.4),
    (27, "番茄", "蔬菜", 20.0, 0.9, 3.9, 0.2),
    (28, "黄瓜", "蔬菜", 16.0, 0.8, 2.9, 0.2),
    (29, "生菜", "蔬菜", 15.0, 1.3, 2.0, 0.3),
    (30, "菠菜", "蔬菜", 28.0, 2.6, 4.5, 0.3),
    (31, "胡萝卜", "蔬菜", 39.0, 0.9, 8.8, 0.2),
    (32, "蘑菇", "蔬菜", 24.0, 2.7, 4.4, 0.1),
    (33, "苹果", "水果", 53.0, 0.4, 13.7, 0.2),
    (34, "香蕉", "水果", 93.0, 1.4, 22.0, 0.2),
    (35, "橙子", "水果", 47.0, 0.8, 11.1, 0.1),
    (36, "葡萄", "水果", 45.0, 0.4, 11.6, 0.2),
    (37, "西瓜", "水果", 31.0, 0.5, 6.8, 0.3),
    (38, "草莓", "水果", 32.0, 0.7, 7.1, 0.3),
    (39, "可乐", "饮品", 43.0, 0.0, 10.8, 0.0),
    (40, "奶茶", "饮品", 65.0, 0.7, 11.5, 2.0),
    (41, "黑咖啡", "饮品", 2.0, 0.1, 0.3, 0.1),
    (42, "鲜榨橙汁", "饮品", 45.0, 0.7, 10.4, 0.2),
    (43, "巧克力", "零食", 589.0, 7.6, 51.9, 37.6),
    (44, "薯片", "零食", 536.0, 7.0, 49.0, 35.0),
    (45, "花生", "零食", 567.0, 25.2, 20.6, 44.3),
    (46, "核桃", "零食", 654.0, 14.9, 13.7, 58.8),
    (47, "蛋糕", "零食", 348.0, 6.0, 56.0, 12.0),
    (48, "冰淇淋", "零食", 207.0, 3.5, 24.0, 11.0),
];

const EXERCISE_SEEDS: &[(i64, &str, &str, f64)] = &[
    (1, "散步", "有氧", 2.8),
    (2, "快走", "有氧", 4.3),
    (3, "慢跑", "有氧", 7.0),
    (4, "快跑", "有氧", 10.0),
    (5, "骑行", "有氧", 6.8),
    (6, "游泳", "有氧", 8.0),
    (7, "跳绳", "有氧", 11.0),
    (8, "瑜伽", "身心", 2.5),
    (9, "普拉提", "身心", 3.8),
    (10, "力量训练", "力量", 5.0),
    (11, "高强度间歇", "力量", 8.0),
    (12, "羽毛球", "球类", 5.5),
    (13, "篮球", "球类", 6.5),
    (14, "足球", "球类", 7.0),
    (15, "网球", "球类", 7.3),
    (16, "乒乓球", "球类", 4.0),
    (17, "登山", "户外", 7.5),
    (18, "爬楼梯", "户外", 8.0),
    (19, "椭圆机", "器械", 5.0),
    (20, "划船机", "器械", 7.0),
    (21, "舞蹈", "有氧", 4.8),
    (22, "太极", "身心", 3.3),
    (23, "拉伸", "身心", 2.3),
    (24, "家务", "日常", 3.0),
    (25, "平板支撑", "力量", 4.0),
];

fn seed_catalogs(conn: &Connection) -> Result<(), rusqlite::Error> {
    for (id, name, category, kcal, protein, carbs, fat) in FOOD_SEEDS {
        conn.execute(
            "INSERT OR IGNORE INTO food_catalog
             (id, name, category, kcal_per_100g, protein, carbs, fat, unit_name, unit_grams)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, '克', 100)",
            params![id, name, category, kcal, protein, carbs, fat],
        )?;
    }
    for (id, name, category, met) in EXERCISE_SEEDS {
        conn.execute(
            "INSERT OR IGNORE INTO exercise_catalog (id, name, category, met)
             VALUES (?1, ?2, ?3, ?4)",
            params![id, name, category, met],
        )?;
    }
    Ok(())
}

pub fn is_valid_date(value: &str) -> bool {
    let parts: Vec<&str> = value.split('-').collect();
    if parts.len() != 3
        || parts[0].len() != 4
        || parts[1].len() != 2
        || parts[2].len() != 2
        || !parts.iter().all(|part| part.chars().all(|c| c.is_ascii_digit()))
    {
        return false;
    }

    let year: i32 = parts[0].parse().unwrap_or(0);
    let month: u32 = parts[1].parse().unwrap_or(0);
    let day: u32 = parts[2].parse().unwrap_or(0);
    if !(1..=12).contains(&month) {
        return false;
    }

    let max_day = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 {
                29
            } else {
                28
            }
        }
        _ => 0,
    };
    (1..=max_day).contains(&day)
}

pub fn get_goal(conn: &Connection) -> Result<Option<Goal>, rusqlite::Error> {
    conn.query_row(
        "SELECT target_weight, start_weight, start_date, target_date FROM goal WHERE id = 1",
        [],
        |row| {
            Ok(Goal {
                target_weight: row.get(0)?,
                start_weight: row.get(1)?,
                start_date: row.get(2)?,
                target_date: row.get(3)?,
            })
        },
    )
    .optional()
}

pub fn save_goal(conn: &Connection, goal: &Goal) -> Result<Goal, rusqlite::Error> {
    conn.execute(
        "INSERT INTO goal (id, target_weight, start_weight, start_date, target_date, created_at)
         VALUES (1, ?1, ?2, ?3, ?4, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           target_weight = excluded.target_weight,
           start_weight = excluded.start_weight,
           start_date = excluded.start_date,
           target_date = excluded.target_date",
        params![
            goal.target_weight,
            goal.start_weight,
            goal.start_date,
            goal.target_date
        ],
    )?;
    get_goal(conn)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
}

fn get_entry(conn: &Connection, date: &str) -> Result<Option<Entry>, rusqlite::Error> {
    conn.query_row(
        "SELECT id, date, weight, body_fat, note, created_at, updated_at
         FROM entry WHERE date = ?1",
        params![date],
        |row| {
            Ok(Entry {
                id: row.get(0)?,
                date: row.get(1)?,
                weight: row.get(2)?,
                body_fat: row.get(3)?,
                note: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .optional()
}

pub fn list_entries(conn: &Connection, limit: u32) -> Result<Vec<Entry>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, date, weight, body_fat, note, created_at, updated_at
         FROM entry ORDER BY date DESC LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![limit], |row| {
        Ok(Entry {
            id: row.get(0)?,
            date: row.get(1)?,
            weight: row.get(2)?,
            body_fat: row.get(3)?,
            note: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn upsert_entry(
    conn: &Connection,
    date: &str,
    weight: f64,
    body_fat: Option<f64>,
    note: Option<&str>,
) -> Result<Entry, rusqlite::Error> {
    conn.execute(
        "INSERT INTO entry (date, weight, body_fat, note, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'), datetime('now'))
         ON CONFLICT(date) DO UPDATE SET
           weight = excluded.weight,
           body_fat = excluded.body_fat,
           note = excluded.note,
           updated_at = datetime('now')",
        params![date, weight, body_fat, note],
    )?;
    get_entry(conn, date)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
}

pub fn delete_entry(conn: &Connection, date: &str) -> Result<bool, rusqlite::Error> {
    let affected = conn.execute("DELETE FROM entry WHERE date = ?1", params![date])?;
    Ok(affected > 0)
}

pub fn get_profile(conn: &Connection) -> Result<Option<Profile>, rusqlite::Error> {
    conn.query_row(
        "SELECT height_cm, age, sex, activity_level FROM profile WHERE id = 1",
        [],
        |row| {
            Ok(Profile {
                height_cm: row.get(0)?,
                age: row.get(1)?,
                sex: row.get(2)?,
                activity_level: row.get(3)?,
            })
        },
    )
    .optional()
}

pub fn save_profile(conn: &Connection, profile: &Profile) -> Result<Profile, rusqlite::Error> {
    conn.execute(
        "INSERT INTO profile (id, height_cm, age, sex, activity_level, updated_at)
         VALUES (1, ?1, ?2, ?3, ?4, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           height_cm = excluded.height_cm,
           age = excluded.age,
           sex = excluded.sex,
           activity_level = excluded.activity_level,
           updated_at = datetime('now')",
        params![
            profile.height_cm,
            profile.age,
            profile.sex,
            profile.activity_level
        ],
    )?;
    get_profile(conn)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
}

pub fn list_food_catalog(conn: &Connection) -> Result<Vec<FoodCatalogItem>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, category, kcal_per_100g, protein, carbs, fat, unit_name, unit_grams
         FROM food_catalog
         ORDER BY category, id",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(FoodCatalogItem {
            id: row.get(0)?,
            name: row.get(1)?,
            category: row.get(2)?,
            kcal_per_100g: row.get(3)?,
            protein: row.get(4)?,
            carbs: row.get(5)?,
            fat: row.get(6)?,
            unit_name: row.get(7)?,
            unit_grams: row.get(8)?,
        })
    })?;
    rows.collect()
}

pub fn create_food_catalog_item(
    conn: &Connection,
    name: &str,
    category: &str,
    kcal_per_100g: f64,
    protein: Option<f64>,
    carbs: Option<f64>,
    fat: Option<f64>,
    unit_name: &str,
    unit_grams: f64,
) -> Result<FoodCatalogItem, rusqlite::Error> {
    conn.execute(
        "INSERT INTO food_catalog
         (name, category, kcal_per_100g, protein, carbs, fat, unit_name, unit_grams)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            name,
            category,
            kcal_per_100g,
            protein,
            carbs,
            fat,
            unit_name,
            unit_grams
        ],
    )?;
    Ok(FoodCatalogItem {
        id: conn.last_insert_rowid(),
        name: name.to_string(),
        category: category.to_string(),
        kcal_per_100g,
        protein,
        carbs,
        fat,
        unit_name: unit_name.to_string(),
        unit_grams,
    })
}

pub fn list_exercise_catalog(conn: &Connection) -> Result<Vec<ExerciseCatalogItem>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, category, met FROM exercise_catalog ORDER BY category, id",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ExerciseCatalogItem {
            id: row.get(0)?,
            name: row.get(1)?,
            category: row.get(2)?,
            met: row.get(3)?,
        })
    })?;
    rows.collect()
}

pub fn create_exercise_catalog_item(
    conn: &Connection,
    name: &str,
    category: &str,
    met: f64,
) -> Result<ExerciseCatalogItem, rusqlite::Error> {
    conn.execute(
        "INSERT INTO exercise_catalog (name, category, met) VALUES (?1, ?2, ?3)",
        params![name, category, met],
    )?;
    Ok(ExerciseCatalogItem {
        id: conn.last_insert_rowid(),
        name: name.to_string(),
        category: category.to_string(),
        met,
    })
}

pub fn log_food(
    conn: &Connection,
    date: &str,
    food_id: i64,
    grams: f64,
) -> Result<FoodLogItem, rusqlite::Error> {
    let food: (String, String, f64) = conn.query_row(
        "SELECT name, category, kcal_per_100g FROM food_catalog WHERE id = ?1",
        params![food_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;
    let kcal = ((food.2 * grams / 100.0) * 10.0).round() / 10.0;
    conn.execute(
        "INSERT INTO food_log (date, food_id, grams, kcal, created_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))",
        params![date, food_id, grams, kcal],
    )?;
    Ok(FoodLogItem {
        id: conn.last_insert_rowid(),
        date: date.to_string(),
        food_id,
        name: food.0,
        category: food.1,
        grams,
        kcal,
    })
}

pub fn log_exercise(
    conn: &Connection,
    date: &str,
    exercise_id: i64,
    minutes: f64,
    weight_kg: f64,
) -> Result<ExerciseLogItem, rusqlite::Error> {
    let exercise: (String, String, f64) = conn.query_row(
        "SELECT name, category, met FROM exercise_catalog WHERE id = ?1",
        params![exercise_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;
    let kcal = ((exercise.2 * weight_kg * minutes / 60.0) * 10.0).round() / 10.0;
    conn.execute(
        "INSERT INTO exercise_log (date, exercise_id, minutes, kcal, created_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))",
        params![date, exercise_id, minutes, kcal],
    )?;
    Ok(ExerciseLogItem {
        id: conn.last_insert_rowid(),
        date: date.to_string(),
        exercise_id,
        name: exercise.0,
        category: exercise.1,
        minutes,
        kcal,
    })
}

pub fn delete_food_log(conn: &Connection, id: i64) -> Result<bool, rusqlite::Error> {
    let affected = conn.execute("DELETE FROM food_log WHERE id = ?1", params![id])?;
    Ok(affected > 0)
}

pub fn delete_exercise_log(conn: &Connection, id: i64) -> Result<bool, rusqlite::Error> {
    let affected = conn.execute("DELETE FROM exercise_log WHERE id = ?1", params![id])?;
    Ok(affected > 0)
}

pub fn upsert_water(
    conn: &Connection,
    date: &str,
    water_ml: f64,
) -> Result<WaterLog, rusqlite::Error> {
    conn.execute(
        "INSERT INTO water_log (date, water_ml, updated_at)
         VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(date) DO UPDATE SET
           water_ml = excluded.water_ml,
           updated_at = datetime('now')",
        params![date, water_ml],
    )?;
    conn.query_row(
        "SELECT date, water_ml, updated_at FROM water_log WHERE date = ?1",
        params![date],
        |row| {
            Ok(WaterLog {
                date: row.get(0)?,
                water_ml: row.get(1)?,
                updated_at: row.get(2)?,
            })
        },
    )
    .optional()?
    .ok_or(rusqlite::Error::QueryReturnedNoRows)
}

pub fn get_day_logs(conn: &Connection, date: &str) -> Result<DayLogs, rusqlite::Error> {
    let mut foods_stmt = conn.prepare(
        "SELECT fl.id, fl.date, fl.food_id, fc.name, fc.category, fl.grams, fl.kcal
         FROM food_log fl
         JOIN food_catalog fc ON fc.id = fl.food_id
         WHERE fl.date = ?1
         ORDER BY fl.id",
    )?;
    let foods = foods_stmt
        .query_map(params![date], |row| {
            Ok(FoodLogItem {
                id: row.get(0)?,
                date: row.get(1)?,
                food_id: row.get(2)?,
                name: row.get(3)?,
                category: row.get(4)?,
                grams: row.get(5)?,
                kcal: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut exercises_stmt = conn.prepare(
        "SELECT el.id, el.date, el.exercise_id, ec.name, ec.category, el.minutes, el.kcal
         FROM exercise_log el
         JOIN exercise_catalog ec ON ec.id = el.exercise_id
         WHERE el.date = ?1
         ORDER BY el.id",
    )?;
    let exercises = exercises_stmt
        .query_map(params![date], |row| {
            Ok(ExerciseLogItem {
                id: row.get(0)?,
                date: row.get(1)?,
                exercise_id: row.get(2)?,
                name: row.get(3)?,
                category: row.get(4)?,
                minutes: row.get(5)?,
                kcal: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let water_ml = conn
        .query_row(
            "SELECT water_ml FROM water_log WHERE date = ?1",
            params![date],
            |row| row.get(0),
        )
        .optional()?;

    let food_kcal = foods.iter().map(|item| item.kcal).sum();
    let exercise_kcal = exercises.iter().map(|item| item.kcal).sum();

    Ok(DayLogs {
        date: date.to_string(),
        foods,
        exercises,
        water_ml,
        food_kcal,
        exercise_kcal,
    })
}
