use rusqlite::params;

use super::utils::{now_iso, short_id};
use super::ChatDb;
use crate::crypto::random_bytes;

#[derive(Clone, Debug)]
pub struct DChannel {
    pub id: String,
    pub name: String,
    pub owner: String,
    pub members: String,
    pub key: String,
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
            owner: client_id.to_string(),
            members,
            key: generate_channel_key(),
            version: 1,
            status: "joined".to_string(),
            created_at: now.clone(),
            updated_at: now,
        }
    }

    pub fn joined_member_ids(&self) -> Vec<String> {
        member_ids_by_status(&self.members, &["joined"])
    }

    #[allow(dead_code)] // helper for legacy paths; not used after helper consolidation
    pub fn member_ids_not_me(&self, my_id: &str) -> Vec<String> {
        self.joined_member_ids()
            .into_iter()
            .filter(|id| id != my_id)
            .collect()
    }

    pub fn elect_leader(&self, online_peer_ids: &std::collections::HashSet<String>, my_id: &str) -> Option<String> {
        let mut candidates: Vec<String> = self
            .joined_member_ids()
            .into_iter()
            .filter(|id| id != my_id && online_peer_ids.contains(id))
            .collect();
        if candidates.is_empty() {
            return None;
        }
        candidates.sort();
        Some(candidates.remove(0))
    }
}

fn generate_channel_key() -> String {
    use crate::crypto::base64_encode;
    base64_encode(&random_bytes(32))
}

fn member_ids_by_status(members_json: &str, statuses: &[&str]) -> Vec<String> {
    let Ok(items) = serde_json::from_str::<Vec<serde_json::Value>>(members_json) else {
        return vec![];
    };
    items
        .into_iter()
        .filter_map(|m| {
            let id = m.get("id").and_then(|v| v.as_str())?.to_string();
            let st = m.get("status").and_then(|v| v.as_str()).unwrap_or("");
            if statuses.contains(&st) {
                Some(id)
            } else {
                None
            }
        })
        .collect()
}

const COLS: &str = "id,name,owner,members,key,version,status,created_at,updated_at";
const COLS_NO_KEY: &str = "id,name,owner,members,version,status,created_at,updated_at";

fn row_to_channel(row: &rusqlite::Row) -> rusqlite::Result<DChannel> {
    let id: String = row.get(0)?;
    let name: String = row.get(1)?;
    let owner: String = row.get(2)?;
    let members: String = row.get(3)?;
    let key_raw: rusqlite::types::Value = row.get(4)?;
    let key = match key_raw {
        rusqlite::types::Value::Text(t) => t,
        _ => String::new(),
    };
    let version: i64 = row.get(5)?;
    let status: String = row.get(6)?;
    let created_at: String = row.get(7)?;
    let updated_at: String = row.get(8)?;
    Ok(DChannel {
        id,
        name,
        owner,
        members,
        key,
        version,
        status,
        created_at,
        updated_at,
    })
}

fn row_to_channel_no_key(row: &rusqlite::Row) -> rusqlite::Result<DChannel> {
    let id: String = row.get(0)?;
    let name: String = row.get(1)?;
    let owner: String = row.get(2)?;
    let members: String = row.get(3)?;
    let version: i64 = row.get(4)?;
    let status: String = row.get(5)?;
    let created_at: String = row.get(6)?;
    let updated_at: String = row.get(7)?;
    Ok(DChannel {
        id,
        name,
        owner,
        members,
        key: String::new(),
        version,
        status,
        created_at,
        updated_at,
    })
}

impl ChatDb {
    pub fn get_channels(&self) -> Vec<DChannel> {
        let conn = self.0.lock().unwrap();
        let sql = format!("SELECT {COLS_NO_KEY} FROM chat_channels ORDER BY name COLLATE NOCASE ASC");
        let mut stmt = match conn.prepare(&sql) {
            Ok(s) => s,
            Err(_) => return vec![],
        };
        stmt.query_map(params![], row_to_channel_no_key)
            .ok()
            .map(|iter| iter.filter_map(|r| r.ok()).collect())
            .unwrap_or_default()
    }

    pub fn get_channel_by_id(&self, id: &str) -> Option<DChannel> {
        let conn = self.0.lock().unwrap();
        let sql = format!("SELECT {COLS_NO_KEY} FROM chat_channels WHERE id=?");
        conn.query_row(&sql, params![id], row_to_channel_no_key).ok()
    }

    #[allow(dead_code)] // kept for parity with Kotlin; unused after helper consolidation
    pub fn get_channel_with_key(&self, id: &str) -> Option<DChannel> {
        let conn = self.0.lock().unwrap();
        let sql = format!("SELECT {COLS} FROM chat_channels WHERE id=?");
        conn.query_row(&sql, params![id], row_to_channel).ok()
    }

    pub fn get_channels_with_key(&self) -> Vec<DChannel> {
        let conn = self.0.lock().unwrap();
        let sql = format!("SELECT {COLS} FROM chat_channels WHERE status='joined' AND key != ''");
        let mut stmt = match conn.prepare(&sql) {
            Ok(s) => s,
            Err(_) => return vec![],
        };
        stmt.query_map(params![], row_to_channel)
            .ok()
            .map(|iter| iter.filter_map(|r| r.ok()).collect())
            .unwrap_or_default()
    }

    pub fn insert_channel(&self, ch: &DChannel) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute(
            "INSERT INTO chat_channels (id,name,owner,members,key,version,status,created_at,updated_at) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                ch.id, ch.name, ch.owner, ch.members, ch.key,
                ch.version, ch.status, ch.created_at, ch.updated_at,
            ],
        );
    }

    pub fn update_channel(&self, ch: &DChannel) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute(
            "UPDATE chat_channels SET name=?1,members=?2,key=?3,version=?4,status=?5,updated_at=?6 WHERE id=?7",
            params![
                ch.name, ch.members, ch.key,
                ch.version, ch.status, ch.updated_at, ch.id,
            ],
        );
    }

    pub fn delete_channel(&self, id: &str) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute("DELETE FROM chat_channels WHERE id=?", params![id]);
    }

    /// Mirrors plain-app `chatChannelDao().getAll().any { it.hasMember(peerId) }`
    /// — returns true if any local channel (regardless of status) still
    /// lists `peer_id` as a member. Used by `PeerManager.deletePeer`
    /// to decide between "demote to channel-only peer" and "delete
    /// the peer row outright".
    pub fn any_channel_has_member(&self, peer_id: &str) -> bool {
        let conn = self.0.lock().unwrap();
        let mut stmt = match conn.prepare("SELECT members FROM chat_channels") {
            Ok(s) => s,
            Err(_) => return false,
        };
        let rows = match stmt.query_map(params![], |row| row.get::<_, String>(0)) {
            Ok(r) => r,
            Err(_) => return false,
        };
        for row in rows {
            let Ok(members_json) = row else { continue };
            let Ok(items) = serde_json::from_str::<Vec<serde_json::Value>>(&members_json) else {
                continue;
            };
            if items.iter().any(|m| m["id"].as_str() == Some(peer_id)) {
                return true;
            }
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_tmp_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let pid = std::process::id();
        std::env::temp_dir().join(format!("plainapp-chan-{label}-{pid}-{nanos}"))
    }

    fn seed_channel_with_members(db: &ChatDb, id: &str, members: &[(&str, &str)]) {
        let members_json = serde_json::to_string(
            &members
                .iter()
                .map(|(mid, status)| serde_json::json!({ "id": mid, "status": status }))
                .collect::<Vec<_>>(),
        )
        .unwrap_or_else(|_| "[]".to_string());
        let now = now_iso();
        let mut ch = DChannel::new("test", "me");
        ch.id = id.to_string();
        ch.members = members_json;
        ch.created_at = now.clone();
        ch.updated_at = now;
        db.insert_channel(&ch);
    }

    #[test]
    fn any_channel_has_member_returns_true_when_member_exists() {
        let db =
            ChatDb::open(&unique_tmp_dir("has-member").join("local_chat.db")).expect("open db");
        seed_channel_with_members(&db, "ch1", &[("me", "joined"), ("p1", "joined")]);

        assert!(db.any_channel_has_member("p1"));
        assert!(!db.any_channel_has_member("p2"));
    }

    #[test]
    fn any_channel_has_member_checks_all_channels() {
        let db =
            ChatDb::open(&unique_tmp_dir("multi-chan").join("local_chat.db")).expect("open db");
        seed_channel_with_members(&db, "ch1", &[("me", "joined")]);
        seed_channel_with_members(&db, "ch2", &[("me", "joined"), ("p2", "pending")]);

        // p2 is only in ch2, but the scan should still find it.
        assert!(db.any_channel_has_member("p2"));
    }

    #[test]
    fn any_channel_has_member_false_for_empty_db() {
        let db = ChatDb::open(&unique_tmp_dir("empty-chan").join("local_chat.db")).expect("open db");
        assert!(!db.any_channel_has_member("anyone"));
    }
}
