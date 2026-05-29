//! SQLite-backed storage for local mode chat messages and channels.
//! Wraps a single Connection in Arc<Mutex<>> so it can be shared across
//! the async Tauri runtime without additional cloning.

use rusqlite::Connection;
use std::path::Path;
use std::sync::{Arc, Mutex};

mod app_file;
mod bookmark;
mod channel;
mod chat;
mod peer;
mod utils;

pub use bookmark::{DBookmark, DBookmarkGroup};
pub use channel::DChannel;
pub use chat::DChat;
pub use peer::DPeer;
pub use utils::now_iso;

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
    /// Execute a closure with read/write access to the underlying Connection.
    /// Used by debug GraphQL resolvers (db_tables, db_table_rows, etc.).
    pub fn with_conn<F, T>(&self, f: F) -> T
    where
        F: FnOnce(&Connection) -> T,
    {
        let conn = self.0.lock().unwrap();
        f(&conn)
    }

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
            CREATE INDEX IF NOT EXISTS idx_app_files_weak ON app_files(size, weak_hash);",
        )?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS bookmarks (
                id              TEXT PRIMARY KEY,
                url             TEXT NOT NULL DEFAULT '',
                title           TEXT NOT NULL DEFAULT '',
                favicon_path    TEXT NOT NULL DEFAULT '',
                group_id        TEXT NOT NULL DEFAULT '',
                pinned          INTEGER NOT NULL DEFAULT 0,
                click_count     INTEGER NOT NULL DEFAULT 0,
                last_clicked_at TEXT,
                sort_order      INTEGER NOT NULL DEFAULT 0,
                created_at      TEXT NOT NULL DEFAULT '',
                updated_at      TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS idx_bookmarks_group_id ON bookmarks(group_id);
            CREATE TABLE IF NOT EXISTS bookmark_groups (
                id         TEXT PRIMARY KEY,
                name       TEXT NOT NULL DEFAULT '',
                collapsed  INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT ''
            );",
        )?;
        Ok(ChatDb(Arc::new(Mutex::new(conn))))
    }
}
