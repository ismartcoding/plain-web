use rusqlite::params;

use super::utils::{now_iso, short_id};
use super::ChatDb;

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

impl ChatDb {
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
            |row| {
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
            },
        )
        .ok()
    }

    pub fn delete_chats_by_channel(&self, channel_id: &str) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute("DELETE FROM chats WHERE channel_id=?", params![channel_id]);
    }
}
