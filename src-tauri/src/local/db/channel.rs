use rusqlite::params;

use super::utils::now_iso;
use super::ChatDb;
use crate::local::enums::{ChannelStatus, MemberStatus};
use crate::utils::short_uuid::short_uuid;

#[derive(Clone, Debug)]
pub struct DChannel {
    pub id: String,
    pub name: String,
    pub owner: String,
    pub members: String,
    pub key: String,
    pub version: i64,
    pub status: ChannelStatus,
    pub created_at: String,
    pub updated_at: String,
}

impl DChannel {
    pub fn new(name: &str, owner: &str) -> Self {
        let now = now_iso();
        Self {
            id: short_uuid(),
            name: name.to_string(),
            owner: owner.to_string(),
            members: "[]".to_string(),
            key: String::new(),
            version: 1,
            status: ChannelStatus::Joined,
            created_at: now.clone(),
            updated_at: now,
        }
    }

    pub fn joined_member_ids(&self) -> Vec<String> {
        let members: Vec<serde_json::Value> =
            serde_json::from_str(&self.members).unwrap_or_default();
        let joined = MemberStatus::Joined.to_string();
        members
            .into_iter()
            .filter(|m| m["status"].as_str() == Some(&joined))
            .filter_map(|m| m["id"].as_str().map(String::from))
            .collect()
    }

    pub fn elect_leader(&self, online_ids: &std::collections::HashSet<String>, my_id: &str) -> Option<String> {
        online_ids
            .iter()
            .filter(|id| id.as_str() != my_id)
            .min()
            .cloned()
    }
}

impl ChatDb {
    pub fn get_channels(&self, status: ChannelStatus) -> Vec<DChannel> {
        let conn = self.0.lock().unwrap();
        let mut stmt = match conn.prepare(
            "SELECT id,name,owner,members,key,version,status,created_at,updated_at \
             FROM chat_channels WHERE status=? ORDER BY name ASC",
        ) {
            Ok(s) => s,
            Err(_) => return vec![],
        };
        stmt.query_map(params![status], |row| {
            Ok(DChannel {
                id: row.get(0)?,
                name: row.get(1)?,
                owner: row.get(2)?,
                members: row.get(3)?,
                key: row.get(4)?,
                version: row.get::<_, i64>(5)?,
                status: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .ok()
        .map(|iter| iter.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
    }

    pub fn get_channels_with_key(&self) -> Vec<DChannel> {
        let conn = self.0.lock().unwrap();
        let mut stmt = match conn.prepare(
            "SELECT id,name,owner,members,key,version,status,created_at,updated_at \
             FROM chat_channels WHERE key != ''",
        ) {
            Ok(s) => s,
            Err(_) => return vec![],
        };
        stmt.query_map([], |row| {
            Ok(DChannel {
                id: row.get(0)?,
                name: row.get(1)?,
                owner: row.get(2)?,
                members: row.get(3)?,
                key: row.get(4)?,
                version: row.get::<_, i64>(5)?,
                status: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .ok()
        .map(|iter| iter.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
    }

    pub fn get_channel_by_id(&self, id: &str) -> Option<DChannel> {
        let conn = self.0.lock().unwrap();
        conn.query_row(
            "SELECT id,name,owner,members,key,version,status,created_at,updated_at \
             FROM chat_channels WHERE id=?",
            params![id],
            |row| {
                Ok(DChannel {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    owner: row.get(2)?,
                    members: row.get(3)?,
                    key: row.get(4)?,
                    version: row.get::<_, i64>(5)?,
                    status: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            },
        )
        .ok()
    }

    pub fn insert_channel(&self, channel: &DChannel) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute(
            "INSERT INTO chat_channels (id,name,owner,members,key,version,status,created_at,updated_at) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                channel.id, channel.name, channel.owner, channel.members,
                channel.key, channel.version, channel.status,
                channel.created_at, channel.updated_at
            ],
        );
    }

    pub fn update_channel(&self, channel: &DChannel) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute(
            "UPDATE chat_channels SET name=?1,owner=?2,members=?3,key=?4,version=?5,status=?6,updated_at=?7 WHERE id=?8",
            params![
                channel.name, channel.owner, channel.members, channel.key,
                channel.version, channel.status, channel.updated_at, channel.id
            ],
        );
    }

    #[allow(dead_code)]
    pub fn upsert_channel(&self, channel: &DChannel) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute(
            "INSERT INTO chat_channels (id,name,owner,members,key,version,status,created_at,updated_at) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9) \
             ON CONFLICT(id) DO UPDATE SET \
               name=excluded.name, owner=excluded.owner, members=excluded.members, \
               key=excluded.key, version=excluded.version, status=excluded.status, \
               updated_at=excluded.updated_at",
            params![
                channel.id, channel.name, channel.owner, channel.members,
                channel.key, channel.version, channel.status,
                channel.created_at, channel.updated_at
            ],
        );
    }

    pub fn delete_channel(&self, id: &str) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute("DELETE FROM chat_channels WHERE id=?", params![id]);
    }

    pub fn any_channel_has_member(&self, peer_id: &str) -> bool {
        let conn = self.0.lock().unwrap();
        let mut stmt = match conn.prepare(
            "SELECT members FROM chat_channels WHERE status=?",
        ) {
            Ok(s) => s,
            Err(_) => return false,
        };
        let mut rows = match stmt.query(params![ChannelStatus::Joined]) {
            Ok(r) => r,
            Err(_) => return false,
        };
        while let Ok(Some(row)) = rows.next() {
            let members_json: String = row.get(0).unwrap_or_default();
            if let Ok(members) = serde_json::from_str::<Vec<serde_json::Value>>(&members_json) {
                if members.iter().any(|m| m["id"].as_str() == Some(peer_id)) {
                    return true;
                }
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
        std::env::temp_dir().join(format!("plainapp-channel-{label}-{pid}-{nanos}"))
    }

    fn seed_channel(db: &ChatDb, id: &str, status: ChannelStatus) {
        let mut channel = DChannel::new(id, "me");
        channel.id = id.to_string();
        channel.status = status;
        db.insert_channel(&channel);
    }

    #[test]
    fn get_channels_filters_by_status() {
        let db = ChatDb::open(&unique_tmp_dir("filter-status").join("local_chat.db"))
            .expect("open db");
        seed_channel(&db, "c1", ChannelStatus::Joined);
        seed_channel(&db, "c2", ChannelStatus::Joined);
        seed_channel(&db, "c3", ChannelStatus::Left);

        let joined: Vec<String> = db
            .get_channels(ChannelStatus::Joined)
            .into_iter()
            .map(|c| c.id)
            .collect();
        assert_eq!(joined, vec!["c1".to_string(), "c2".to_string()]);

        let left: Vec<String> = db
            .get_channels(ChannelStatus::Left)
            .into_iter()
            .map(|c| c.id)
            .collect();
        assert_eq!(left, vec!["c3".to_string()]);
    }

    #[test]
    fn joined_member_ids_filters_by_joined_status() {
        let mut ch = DChannel::new("test", "owner");
        ch.members = r#"[{"id":"p1","status":"JOINED"},{"id":"p2","status":"PENDING"},{"id":"p3","status":"JOINED"}]"#.to_string();

        let ids = ch.joined_member_ids();
        assert_eq!(ids, vec!["p1".to_string(), "p3".to_string()]);
    }

    #[test]
    fn any_channel_has_member_returns_true_when_member_found() {
        let db = ChatDb::open(&unique_tmp_dir("has-member").join("local_chat.db"))
            .expect("open db");
        let mut ch = DChannel::new("ch1", "owner");
        ch.members = r#"[{"id":"peer1","status":"JOINED"}]"#.to_string();
        ch.status = ChannelStatus::Joined;
        db.insert_channel(&ch);

        assert!(db.any_channel_has_member("peer1"));
        assert!(!db.any_channel_has_member("peer2"));
    }
}