use rusqlite::params;

use super::utils::{now_iso, short_id};
use super::ChatDb;

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
    pub fn new(name: &str, client_id: &str) -> Self {
        let now = now_iso();
        let members = format!(r#"[{{"id":"{}","status":"joined"}}]"#, client_id);
        Self {
            id: short_id(),
            name: name.to_string(),
            owner: "me".to_string(),
            members,
            version: 1,
            status: "joined".to_string(),
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

impl ChatDb {
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
            |row| {
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
            },
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
