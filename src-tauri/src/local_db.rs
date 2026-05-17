//! SQLite-backed storage for local mode chat messages and channels.
//! Wraps a single Connection in Arc<Mutex<>> so it can be shared across
//! the async Tauri runtime without additional cloning.

use rusqlite::{params, Connection};
use std::io::Read;
use std::path::Path;
use std::sync::{Arc, Mutex};

// ---------------------------------------------------------------------------
// Time helpers (no chrono — std only)
// ---------------------------------------------------------------------------

pub fn now_iso() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    unix_secs_to_iso8601(secs)
}

fn is_leap(y: u64) -> bool {
    y % 4 == 0 && (y % 100 != 0 || y % 400 == 0)
}

fn unix_secs_to_iso8601(secs: u64) -> String {
    let ss = secs % 60;
    let t = secs / 60;
    let mm = t % 60;
    let t = t / 60;
    let hh = t % 24;
    let mut days = t / 24;
    let mut year = 1970u64;
    loop {
        let dy = if is_leap(year) { 366u64 } else { 365u64 };
        if days < dy {
            break;
        }
        days -= dy;
        year += 1;
    }
    let md: [u64; 12] = if is_leap(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut month = 1u64;
    for &dm in md.iter() {
        if days < dm {
            break;
        }
        days -= dm;
        month += 1;
    }
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year,
        month,
        days + 1,
        hh,
        mm,
        ss
    )
}

// ---------------------------------------------------------------------------
// ID generation (8 random bytes from /dev/urandom, hex-encoded)
// ---------------------------------------------------------------------------

pub fn short_id() -> String {
    let mut buf = [0u8; 8];
    if let Ok(mut f) = std::fs::File::open("/dev/urandom") {
        let _ = f.read_exact(&mut buf);
    }
    buf.iter().map(|b| format!("{b:02x}")).collect()
}

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub struct DChat {
    pub id: String,
    pub from_id: String,
    pub to_id: String,
    pub channel_id: String,
    pub content: String,
    pub status: String,
    pub status_data: String,
    pub created_at: String,
    pub updated_at: String,
}

impl DChat {
    pub fn new(from_id: &str, to_id: &str, channel_id: &str, content: &str) -> Self {
        let now = now_iso();
        Self {
            id: short_id(),
            from_id: from_id.to_string(),
            to_id: to_id.to_string(),
            channel_id: channel_id.to_string(),
            content: content.to_string(),
            status: "sent".to_string(),
            status_data: String::new(),
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

#[derive(Clone, Debug)]
pub struct DChannel {
    pub id: String,
    pub name: String,
    pub owner: String,
    pub members: String,
    pub version: i64,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

impl DChannel {
    pub fn new(name: &str) -> Self {
        let now = now_iso();
        Self {
            id: short_id(),
            name: name.to_string(),
            owner: "me".to_string(),
            members: r#"[{"id":"__local__","status":"joined"}]"#.to_string(),
            version: 1,
            status: "joined".to_string(),
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

// ---------------------------------------------------------------------------
// ChatDb — SQLite wrapper
// ---------------------------------------------------------------------------

pub struct ChatDb(Arc<Mutex<Connection>>);

impl Clone for ChatDb {
    fn clone(&self) -> Self {
        ChatDb(Arc::clone(&self.0))
    }
}

impl ChatDb {
    pub fn open(db_path: &Path) -> rusqlite::Result<Self> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS chats (
                id          TEXT PRIMARY KEY,
                from_id     TEXT NOT NULL DEFAULT '',
                to_id       TEXT NOT NULL DEFAULT '',
                channel_id  TEXT NOT NULL DEFAULT '',
                content     TEXT NOT NULL DEFAULT '{}',
                status      TEXT NOT NULL DEFAULT 'sent',
                status_data TEXT NOT NULL DEFAULT '',
                created_at  TEXT NOT NULL DEFAULT '',
                updated_at  TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS idx_chats_to_id      ON chats(to_id);
            CREATE INDEX IF NOT EXISTS idx_chats_channel_id ON chats(channel_id);
            CREATE TABLE IF NOT EXISTS chat_channels (
                id         TEXT PRIMARY KEY,
                name       TEXT NOT NULL DEFAULT '',
                owner      TEXT NOT NULL DEFAULT 'me',
                members    TEXT NOT NULL DEFAULT '[]',
                version    INTEGER NOT NULL DEFAULT 1,
                status     TEXT NOT NULL DEFAULT 'joined',
                created_at TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT ''
            );",
        )?;
        Ok(ChatDb(Arc::new(Mutex::new(conn))))
    }

    // ── Chat queries ─────────────────────────────────────────────────────────

    pub fn get_chats(&self, id: &str) -> Vec<DChat> {
        let conn = self.0.lock().unwrap();
        let (sql, p1, p2): (&str, &str, &str) = if let Some(cid) = id.strip_prefix("channel:") {
            (
                "SELECT id,from_id,to_id,channel_id,content,status,status_data,created_at,updated_at \
                 FROM chats WHERE channel_id=? ORDER BY created_at ASC",
                cid,
                "",
            )
        } else {
            let pid = id.strip_prefix("peer:").unwrap_or(id);
            (
                "SELECT id,from_id,to_id,channel_id,content,status,status_data,created_at,updated_at \
                 FROM chats WHERE channel_id='' AND (to_id=? OR from_id=?) ORDER BY created_at ASC",
                pid,
                pid,
            )
        };

        let mut stmt = match conn.prepare(sql) {
            Ok(s) => s,
            Err(_) => return vec![],
        };

        let row_to_chat = |row: &rusqlite::Row<'_>| -> rusqlite::Result<DChat> {
            Ok(DChat {
                id: row.get(0)?,
                from_id: row.get(1)?,
                to_id: row.get(2)?,
                channel_id: row.get(3)?,
                content: row.get(4)?,
                status: row.get(5)?,
                status_data: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        };

        let rows = if p2.is_empty() {
            stmt.query_map(params![p1], row_to_chat)
        } else {
            stmt.query_map(params![p1, p2], row_to_chat)
        };

        rows.ok()
            .map(|iter| iter.filter_map(|r| r.ok()).collect())
            .unwrap_or_default()
    }

    pub fn insert_chat(&self, chat: &DChat) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute(
            "INSERT INTO chats (id,from_id,to_id,channel_id,content,status,status_data,created_at,updated_at) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                chat.id, chat.from_id, chat.to_id, chat.channel_id,
                chat.content, chat.status, chat.status_data,
                chat.created_at, chat.updated_at
            ],
        );
    }

    pub fn delete_chat(&self, id: &str) -> bool {
        let conn = self.0.lock().unwrap();
        conn.execute("DELETE FROM chats WHERE id=?", params![id])
            .map(|n| n > 0)
            .unwrap_or(false)
    }

    pub fn update_chat_status(&self, id: &str, status: &str) -> Option<DChat> {
        let now = now_iso();
        {
            let conn = self.0.lock().unwrap();
            let _ = conn.execute(
                "UPDATE chats SET status=?1, updated_at=?2 WHERE id=?3",
                params![status, now, id],
            );
        }
        self.get_chat_by_id(id)
    }

    pub fn get_chat_by_id(&self, id: &str) -> Option<DChat> {
        let conn = self.0.lock().unwrap();
        conn.query_row(
            "SELECT id,from_id,to_id,channel_id,content,status,status_data,created_at,updated_at \
             FROM chats WHERE id=?",
            params![id],
            |row| Ok(DChat {
                id: row.get(0)?,
                from_id: row.get(1)?,
                to_id: row.get(2)?,
                channel_id: row.get(3)?,
                content: row.get(4)?,
                status: row.get(5)?,
                status_data: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            }),
        )
        .ok()
    }

    pub fn delete_chats_by_channel(&self, channel_id: &str) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute("DELETE FROM chats WHERE channel_id=?", params![channel_id]);
    }

    // ── Channel queries ───────────────────────────────────────────────────────

    pub fn get_channels(&self) -> Vec<DChannel> {
        let conn = self.0.lock().unwrap();
        let mut stmt = match conn.prepare(
            "SELECT id,name,owner,members,version,status,created_at,updated_at \
             FROM chat_channels ORDER BY name ASC",
        ) {
            Ok(s) => s,
            Err(_) => return vec![],
        };
        stmt.query_map(params![], |row| {
            Ok(DChannel {
                id: row.get(0)?,
                name: row.get(1)?,
                owner: row.get(2)?,
                members: row.get(3)?,
                version: row.get(4)?,
                status: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .ok()
        .map(|iter| iter.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
    }

    pub fn get_channel_by_id(&self, id: &str) -> Option<DChannel> {
        let conn = self.0.lock().unwrap();
        conn.query_row(
            "SELECT id,name,owner,members,version,status,created_at,updated_at \
             FROM chat_channels WHERE id=?",
            params![id],
            |row| Ok(DChannel {
                id: row.get(0)?,
                name: row.get(1)?,
                owner: row.get(2)?,
                members: row.get(3)?,
                version: row.get(4)?,
                status: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            }),
        )
        .ok()
    }

    pub fn insert_channel(&self, ch: &DChannel) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute(
            "INSERT INTO chat_channels (id,name,owner,members,version,status,created_at,updated_at) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![ch.id, ch.name, ch.owner, ch.members, ch.version, ch.status, ch.created_at, ch.updated_at],
        );
    }

    pub fn update_channel(&self, ch: &DChannel) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute(
            "UPDATE chat_channels SET name=?1,members=?2,version=?3,status=?4,updated_at=?5 WHERE id=?6",
            params![ch.name, ch.members, ch.version, ch.status, ch.updated_at, ch.id],
        );
    }

    pub fn delete_channel(&self, id: &str) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute("DELETE FROM chat_channels WHERE id=?", params![id]);
    }
}
