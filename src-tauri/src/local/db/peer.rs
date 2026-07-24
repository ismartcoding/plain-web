use rusqlite::params;

use super::utils::now_iso;
use super::ChatDb;

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

    pub fn is_paired(&self) -> bool {
        self.status == "paired"
    }

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

impl ChatDb {
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
            |row| {
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
            },
        )
        .ok()
    }

    pub fn upsert_peer(&self, peer: &DPeer) {
        let conn = self.0.lock().unwrap();
        let result = conn.execute(
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
        if let Err(e) = result {
            log::error!("upsert_peer failed id={} err={e}", peer.id);
        } else {
            log::info!("upsert_peer ok id={} name={} status={}", peer.id, peer.name, peer.status);
        }
    }

    #[allow(dead_code)]
    pub fn delete_peer(&self, id: &str) {
        let conn = self.0.lock().unwrap();
        let _ = conn.execute("DELETE FROM peers WHERE id=?", params![id]);
    }

    /// Mirrors plain-app `peerDao.update(peer)` for the
    /// `PeerManager.markUnpaired` flow — only flips `status` and
    /// `updated_at`, leaving the key intact so a future re-pair can
    /// reuse the stored credentials.
    pub fn update_peer_status(&self, id: &str, status: &str) {
        let now = now_iso();
        let conn = self.0.lock().unwrap();
        let _ = conn.execute(
            "UPDATE peers SET status=?1, updated_at=?2 WHERE id=?3",
            params![status, now, id],
        );
    }

    /// Mirrors plain-app `peerDao.update(peer)` for the
    /// `PeerManager.deletePeer` "channel member" branch — clears the
    /// shared key and flips `status` to "channel" so the peer row
    /// stays around for channel routing without holding a paired key.
    pub fn update_peer_status_and_key(&self, id: &str, status: &str, key: &str) {
        let now = now_iso();
        let conn = self.0.lock().unwrap();
        let _ = conn.execute(
            "UPDATE peers SET status=?1, key=?2, updated_at=?3 WHERE id=?4",
            params![status, key, now, id],
        );
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
        std::env::temp_dir().join(format!("plainapp-peer-{label}-{pid}-{nanos}"))
    }

    fn seed_peer(db: &ChatDb, id: &str, status: &str, key: &str) {
        let mut peer = DPeer::new(id, id, "10.0.0.1", 12345, "phone");
        peer.status = status.to_string();
        peer.key = key.to_string();
        db.upsert_peer(&peer);
    }

    #[test]
    fn update_peer_status_flips_status_and_bumps_updated_at() {
        let db =
            ChatDb::open(&unique_tmp_dir("status-flip").join("local_chat.db")).expect("open db");
        seed_peer(&db, "p1", "paired", "k");
        let before = db.get_peer_by_id("p1").expect("peer exists");
        assert_eq!(before.status, "paired");

        db.update_peer_status("p1", "unpaired");

        let after = db.get_peer_by_id("p1").expect("peer still exists");
        assert_eq!(after.status, "unpaired");
        // Key must be preserved — markUnpaired keeps it so a re-pair
        // can reuse the stored credentials.
        assert_eq!(after.key, "k");
        assert!(after.updated_at >= before.updated_at);
    }

    #[test]
    fn update_peer_status_and_key_clears_key_for_channel_demotion() {
        let db =
            ChatDb::open(&unique_tmp_dir("key-clear").join("local_chat.db")).expect("open db");
        seed_peer(&db, "p1", "paired", "secret-key");

        db.update_peer_status_and_key("p1", "channel", "");

        let after = db.get_peer_by_id("p1").expect("peer demoted, not deleted");
        assert_eq!(after.status, "channel");
        assert_eq!(after.key, "");
    }

    #[test]
    fn delete_peer_removes_row() {
        let db =
            ChatDb::open(&unique_tmp_dir("delete").join("local_chat.db")).expect("open db");
        seed_peer(&db, "p1", "paired", "k");
        assert!(db.get_peer_by_id("p1").is_some());

        db.delete_peer("p1");
        assert!(db.get_peer_by_id("p1").is_none());
    }
}
