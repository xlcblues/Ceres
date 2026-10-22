use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Goal {
    pub target_weight: f64,
    pub start_weight: Option<f64>,
    pub start_date: Option<String>,
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
        "SELECT target_weight, start_weight, start_date FROM goal WHERE id = 1",
        [],
        |row| {
            Ok(Goal {
                target_weight: row.get(0)?,
                start_weight: row.get(1)?,
                start_date: row.get(2)?,
            })
        },
    )
    .optional()
}

pub fn save_goal(conn: &Connection, goal: &Goal) -> Result<Goal, rusqlite::Error> {
    conn.execute(
        "INSERT INTO goal (id, target_weight, start_weight, start_date, created_at)
         VALUES (1, ?1, ?2, ?3, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           target_weight = excluded.target_weight,
           start_weight = excluded.start_weight,
           start_date = excluded.start_date",
        params![goal.target_weight, goal.start_weight, goal.start_date],
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

#[cfg(test)]
mod tests {
    use super::*;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        conn
    }

    #[test]
    fn migration_creates_core_tables() {
        let conn = test_conn();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master
                 WHERE type = 'table' AND name IN ('goal', 'entry', 'setting')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 3);
    }

    #[test]
    fn goal_upsert_keeps_single_row() {
        let conn = test_conn();
        save_goal(
            &conn,
            &Goal {
                target_weight: 68.0,
                start_weight: Some(75.6),
                start_date: Some("2026-10-01".into()),
            },
        )
        .unwrap();
        save_goal(
            &conn,
            &Goal {
                target_weight: 66.5,
                start_weight: Some(76.0),
                start_date: Some("2026-10-02".into()),
            },
        )
        .unwrap();

        let goal = get_goal(&conn).unwrap().unwrap();
        assert_eq!(goal.target_weight, 66.5);
        assert_eq!(goal.start_weight, Some(76.0));
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM goal", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn entry_upsert_and_list_are_date_ordered() {
        let conn = test_conn();
        upsert_entry(&conn, "2026-10-20", 72.6, None, None).unwrap();
        upsert_entry(&conn, "2026-10-22", 72.4, Some(24.5), Some("晚")).unwrap();
        upsert_entry(&conn, "2026-10-21", 72.5, None, None).unwrap();

        let entries = list_entries(&conn, 10).unwrap();
        let dates: Vec<&str> = entries.iter().map(|entry| entry.date.as_str()).collect();
        assert_eq!(dates, vec!["2026-10-22", "2026-10-21", "2026-10-20"]);

        upsert_entry(&conn, "2026-10-21", 72.3, Some(24.0), Some("早")).unwrap();
        let entries = list_entries(&conn, 10).unwrap();
        assert_eq!(entries.len(), 3);
        let updated = entries.iter().find(|entry| entry.date == "2026-10-21").unwrap();
        assert_eq!(updated.weight, 72.3);
        assert_eq!(updated.note.as_deref(), Some("早"));
    }

    #[test]
    fn delete_entry_removes_only_matching_row() {
        let conn = test_conn();
        upsert_entry(&conn, "2026-10-20", 72.6, None, None).unwrap();
        upsert_entry(&conn, "2026-10-21", 72.5, None, None).unwrap();

        assert!(delete_entry(&conn, "2026-10-20").unwrap());
        assert!(!delete_entry(&conn, "2026-10-20").unwrap());
        let entries = list_entries(&conn, 10).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].date, "2026-10-21");
    }

    #[test]
    fn date_validation_accepts_real_dates_only() {
        assert!(is_valid_date("2026-10-22"));
        assert!(is_valid_date("2024-02-29"));
        assert!(!is_valid_date("2023-02-29"));
        assert!(!is_valid_date("2026-13-01"));
        assert!(!is_valid_date("2026-10-32"));
        assert!(!is_valid_date("26-10-22"));
        assert!(!is_valid_date("2026/10/22"));
        assert!(!is_valid_date(""));
    }
}
