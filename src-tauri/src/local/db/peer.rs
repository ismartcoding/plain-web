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
}
