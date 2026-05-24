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

/// Matches plain-app `DPeer` entity.
#[derive(Clone, Debug)]
pub struct DPeer {
    pub id: String,
    pub name: String,
    pub ip: String,
    /// Base64-encoded XChaCha20 shared key (ECDH-derived). Empty until paired.
    pub key: String,
    /// Base64-encoded raw Ed25519 public key (32 bytes).
    pub public_key: String,
    /// "paired" | "unpaired" | "channel"
    pub status: String,
    pub port: u16,
    /// "phone" | "tablet" | "pc" | "mac"
    pub device_type: String,
    pub created_at: String,
    pub updated_at: String,
}

#[allow(dead_code)]
impl DPeer {
    pub fn new(id: &str, name: &str, ip: &str, port: u16, device_type: &str) -> Self {
        let now = now_iso();
        Self {
            id: id.to_string(),
            name: name.to_string(),
            ip: ip.to_string(),
            key: String::new(),
            public_key: String::new(),
            status: "unpaired".to_string(),
            port,
            device_type: device_type.to_string(),
            created_at: now.clone(),
            updated_at: now,
        }
    }

    pub fn is_paired(&self) -> bool { self.status == "paired" }

    /// Return the best reachable IP (first item — caller should implement LAN preference).
    pub fn best_ip(&self) -> &str {
        self.ip.split(',').next().unwrap_or(&self.ip).trim()
    }

    pub fn base_url(&self) -> String {
        format!("https://{}:{}", self.best_ip(), self.port)
    }

    pub fn peer_graphql_url(&self) -> String {
        format!("{}/peer_graphql", self.base_url())
    }

    pub fn file_url(&self, file_id: &str) -> String {
        format!("{}/fs?id={}", self.base_url(), file_id)
    }
}

/// Content-addressable file store record. Matches plain-app `DAppFile`.
#[allow(dead_code)]
#[derive(Clone, Debug)]
pub struct DAppFile {
    /// Full SHA-256 hex digest (64 chars) — primary key.
    pub id: String,
    pub size: i64,
    pub mime_type: String,
    pub real_path: String,
    pub ref_count: i32,
    /// SHA-256 hex digest of first 4 KB + last 4 KB (fast dedup probe).
    pub weak_hash: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Persistent device identity. Generated once on first startup.
#[derive(Clone, Debug)]
pub struct DDeviceIdentity {
    pub client_id: String,
    pub device_name: String,
    /// Base64-encoded Ed25519 keypair bytes (64 bytes: private || public).
    pub ed25519_keypair: String,
    pub created_at: String,
}

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
            );
            CREATE TABLE IF NOT EXISTS peers (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL DEFAULT '',
                ip          TEXT NOT NULL DEFAULT '',
                key         TEXT NOT NULL DEFAULT '',
                public_key  TEXT NOT NULL DEFAULT '',
                status      TEXT NOT NULL DEFAULT 'unpaired',
                port        INTEGER NOT NULL DEFAULT 0,
                device_type TEXT NOT NULL DEFAULT '',
                created_at  TEXT NOT NULL DEFAULT '',
                updated_at  TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS app_files (
                id          TEXT PRIMARY KEY,
                size        INTEGER NOT NULL DEFAULT 0,
                mime_type   TEXT NOT NULL DEFAULT '',
                real_path   TEXT NOT NULL DEFAULT '',
                ref_count   INTEGER NOT NULL DEFAULT 1,
                weak_hash   TEXT NOT NULL DEFAULT '',
                created_at  TEXT NOT NULL DEFAULT '',
                updated_at  TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS idx_app_files_weak ON app_files(size, weak_hash);
            CREATE TABLE IF NOT EXISTS device_identity (
                client_id       TEXT PRIMARY KEY,
                device_name     TEXT NOT NULL DEFAULT '',
                ed25519_keypair TEXT NOT NULL DEFAULT '',
                created_at      TEXT NOT NULL DEFAULT ''
            );",
        )?;
        Ok(ChatDb(Arc::new(Mutex::new(conn))))
    }

    // ── Device identity ───────────────────────────────────────────────────────

    pub fn get_identity(&self) -> Option<DDeviceIdentity> {
        let conn = self.0.lock().unwrap();
        conn.query_row(
            "SELECT client_id, device_name, ed25519_keypair, created_at FROM device_identity LIMIT 1",
            [],
            |row| Ok(DDeviceIdentity {
                client_id: row.get(0)?,
                device_name: row.get(1)?,
                ed25519_keypair: row.get(2)?,
                created_at: row.get(3)?,
            }),
        )
        .ok()
    }

    pub fn insert_identity(&self, identity: &DDeviceIdentity) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute(
            "INSERT OR IGNORE INTO device_identity (client_id, device_name, ed25519_keypair, created_at) \
             VALUES (?1, ?2, ?3, ?4)",
            params![identity.client_id, identity.device_name, identity.ed25519_keypair, identity.created_at],
        );
    }

    pub fn update_device_name(&self, name: &str) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute("UPDATE device_identity SET device_name=?1", params![name]);
    }

    // ── Peer queries ──────────────────────────────────────────────────────────

    pub fn get_peers(&self) -> Vec<DPeer> {
        let conn = self.0.lock().unwrap();
        let mut stmt = match conn.prepare(
            "SELECT id,name,ip,key,public_key,status,port,device_type,created_at,updated_at \
             FROM peers ORDER BY name ASC",
        ) {
            Ok(s) => s,
            Err(_) => return vec![],
        };
        stmt.query_map(params![], |row| {
            Ok(DPeer {
                id: row.get(0)?,
                name: row.get(1)?,
                ip: row.get(2)?,
                key: row.get(3)?,
                public_key: row.get(4)?,
                status: row.get(5)?,
                port: row.get::<_, i64>(6)? as u16,
                device_type: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .ok()
        .map(|iter| iter.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
    }

    pub fn get_peer_by_id(&self, id: &str) -> Option<DPeer> {
        let conn = self.0.lock().unwrap();
        conn.query_row(
            "SELECT id,name,ip,key,public_key,status,port,device_type,created_at,updated_at \
             FROM peers WHERE id=?",
            params![id],
            |row| Ok(DPeer {
                id: row.get(0)?,
                name: row.get(1)?,
                ip: row.get(2)?,
                key: row.get(3)?,
                public_key: row.get(4)?,
                status: row.get(5)?,
                port: row.get::<_, i64>(6)? as u16,
                device_type: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            }),
        )
        .ok()
    }

    pub fn upsert_peer(&self, peer: &DPeer) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute(
            "INSERT INTO peers (id,name,ip,key,public_key,status,port,device_type,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
             ON CONFLICT(id) DO UPDATE SET
               name=excluded.name, ip=excluded.ip, key=excluded.key,
               public_key=excluded.public_key, status=excluded.status,
               port=excluded.port, device_type=excluded.device_type,
               updated_at=excluded.updated_at",
            params![
                peer.id, peer.name, peer.ip, peer.key, peer.public_key,
                peer.status, peer.port as i64, peer.device_type,
                peer.created_at, peer.updated_at
            ],
        );
    }

    #[allow(dead_code)]
    pub fn delete_peer(&self, id: &str) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute("DELETE FROM peers WHERE id=?", params![id]);
    }

    // ── App-files (content-addressable) ──────────────────────────────────────
    // Wired into createChatItem with file attachments in a follow-up;
    // suppress dead-code warnings until then.

    #[allow(dead_code)]
    pub fn get_app_file(&self, id: &str) -> Option<DAppFile> {
        let conn = self.0.lock().unwrap();
        conn.query_row(
            "SELECT id,size,mime_type,real_path,ref_count,weak_hash,created_at,updated_at \
             FROM app_files WHERE id=?",
            params![id],
            |row| Ok(DAppFile {
                id: row.get(0)?,
                size: row.get(1)?,
                mime_type: row.get(2)?,
                real_path: row.get(3)?,
                ref_count: row.get(4)?,
                weak_hash: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            }),
        )
        .ok()
    }

    #[allow(dead_code)]
    pub fn find_app_files_by_weak(&self, size: i64, weak_hash: &str) -> Vec<DAppFile> {
        let conn = self.0.lock().unwrap();
        let mut stmt = match conn.prepare(
            "SELECT id,size,mime_type,real_path,ref_count,weak_hash,created_at,updated_at \
             FROM app_files WHERE size=? AND weak_hash=?",
        ) {
            Ok(s) => s,
            Err(_) => return vec![],
        };
        stmt.query_map(params![size, weak_hash], |row| {
            Ok(DAppFile {
                id: row.get(0)?,
                size: row.get(1)?,
                mime_type: row.get(2)?,
                real_path: row.get(3)?,
                ref_count: row.get(4)?,
                weak_hash: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .ok()
        .map(|iter| iter.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
    }

    #[allow(dead_code)]
    pub fn insert_app_file(&self, f: &DAppFile) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute(
            "INSERT OR IGNORE INTO app_files \
             (id,size,mime_type,real_path,ref_count,weak_hash,created_at,updated_at) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![f.id, f.size, f.mime_type, f.real_path, f.ref_count, f.weak_hash, f.created_at, f.updated_at],
        );
    }

    #[allow(dead_code)]
    pub fn increment_app_file_ref(&self, id: &str) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute("UPDATE app_files SET ref_count=ref_count+1 WHERE id=?", params![id]);
    }

    #[allow(dead_code)]
    pub fn decrement_app_file_ref(&self, id: &str) -> i32 {
        {
            let conn = self.0.lock().unwrap();
            let _ = conn.execute("UPDATE app_files SET ref_count=ref_count-1 WHERE id=?", params![id]);
        }
        let conn = self.0.lock().unwrap();
        conn.query_row("SELECT ref_count FROM app_files WHERE id=?", params![id], |r| r.get(0))
            .unwrap_or(0)
    }

    #[allow(dead_code)]
    pub fn delete_app_file(&self, id: &str) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute("DELETE FROM app_files WHERE id=?", params![id]);
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
