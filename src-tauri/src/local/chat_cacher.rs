//! Direct translation of plain-app `ChatCacher.kt`.
//!
//! Maintains an in-memory cache of the latest chat per conversation,
//! keyed by chat ID (channel ID, peer ID, or "local").
//!
//! ```kotlin
//! object ChatCacher {
//!     val latestChatMap = MutableStateFlow<Map<String, DChat>>(emptyMap())
//!     fun getLatestChat(chatId: String): DChat? = latestChatMap.value[chatId]
//!     suspend fun load() = withIO { ... }
//! }
//! ```

use std::collections::{HashMap, HashSet};
use std::sync::RwLock;

use crate::local::db::{ChatDb, DChat};

pub struct ChatCacher {
    latest_chat_map: RwLock<HashMap<String, DChat>>,
}

impl ChatCacher {
    pub fn new() -> Self {
        Self {
            latest_chat_map: RwLock::new(HashMap::new()),
        }
    }

    /// `fun getLatestChat(chatId: String): DChat?`
    pub fn get_latest_chat(&self, chat_id: &str) -> Option<DChat> {
        self.latest_chat_map.read().unwrap().get(chat_id).cloned()
    }

    /// `suspend fun load() = withIO { ... }`
    ///
    /// Rebuild the cache from the database:
    /// 1. Fetch all peers and channels to build ID sets.
    /// 2. Fetch latest chats per conversation via `getAllLatestChats()`.
    /// 3. Map each chat to its conversation ID (channel / peer / "local").
    /// 4. Keep the most recently updated chat per conversation ID.
    pub fn load(&self, db: &ChatDb) {
        let peer_ids: HashSet<String> = db.get_peers().iter().map(|p| p.id.clone()).collect();
        let channel_ids: HashSet<String> = db.get_all_channels().iter().map(|c| c.id.clone()).collect();
        let latest_chats = db.get_all_latest_chats();

        let mut chat_cache: HashMap<String, DChat> = HashMap::new();
        for chat in latest_chats {
            let chat_id = if !chat.channel_id.is_empty() && channel_ids.contains(&chat.channel_id) {
                Some(chat.channel_id.clone())
            } else if (chat.from_id == "me" && chat.to_id == "local")
                || (chat.from_id == "local" && chat.to_id == "me")
            {
                Some("local".to_string())
            } else if chat.from_id == "me" && peer_ids.contains(&chat.to_id) {
                Some(chat.to_id.clone())
            } else if chat.to_id == "me" && peer_ids.contains(&chat.from_id) {
                Some(chat.from_id.clone())
            } else {
                None
            };

            if let Some(chat_id) = chat_id {
                let should_replace = match chat_cache.get(&chat_id) {
                    None => true,
                    Some(existing) => chat.updated_at > existing.updated_at,
                };
                if should_replace {
                    chat_cache.insert(chat_id, chat);
                }
            }
        }

        let mut map = self.latest_chat_map.write().unwrap();
        *map = chat_cache;
    }
}

impl Default for ChatCacher {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::local::db::{ChatDb, DChannel};
    use crate::local::enums::ChannelStatus;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_tmp_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let pid = std::process::id();
        std::env::temp_dir().join(format!("plainapp-cacher-{label}-{pid}-{nanos}"))
    }

    fn seed_chat(db: &ChatDb, id: &str, from_id: &str, to_id: &str, channel_id: &str) {
        let mut chat = DChat::new(from_id, to_id, channel_id, "{}");
        chat.id = id.to_string();
        db.insert_chat(&chat);
    }

    fn seed_peer(db: &ChatDb, id: &str) {
        use crate::local::db::DPeer;
        use crate::local::enums::DeviceType;
        let now = crate::local::db::now_iso();
        let peer = DPeer {
            id: id.to_string(),
            name: id.to_string(),
            ip: String::new(),
            key: String::new(),
            public_key: String::new(),
            status: crate::local::enums::PeerStatus::Paired,
            port: 0,
            device_type: DeviceType::Unknown,
            token: String::new(),
            created_at: now.clone(),
            updated_at: now,
        };
        db.upsert_peer(&peer);
    }

    fn seed_channel(db: &ChatDb, id: &str) {
        let mut ch = DChannel::new(id, "me");
        ch.id = id.to_string();
        ch.status = ChannelStatus::Joined;
        db.insert_channel(&ch);
    }

    #[test]
    fn load_caches_local_chat() {
        let db = ChatDb::open(&unique_tmp_dir("local").join("local_chat.db")).expect("open db");
        seed_chat(&db, "a", "me", "local", "");

        let cacher = ChatCacher::new();
        cacher.load(&db);

        assert!(cacher.get_latest_chat("local").is_some());
    }

    #[test]
    fn load_caches_peer_chat() {
        let db = ChatDb::open(&unique_tmp_dir("peer").join("local_chat.db")).expect("open db");
        seed_peer(&db, "peer1");
        seed_chat(&db, "a", "me", "peer1", "");

        let cacher = ChatCacher::new();
        cacher.load(&db);

        assert!(cacher.get_latest_chat("peer1").is_some());
    }

    #[test]
    fn load_caches_channel_chat() {
        let db = ChatDb::open(&unique_tmp_dir("chan").join("local_chat.db")).expect("open db");
        seed_channel(&db, "ch1");
        seed_chat(&db, "a", "me", "", "ch1");

        let cacher = ChatCacher::new();
        cacher.load(&db);

        assert!(cacher.get_latest_chat("ch1").is_some());
    }

    #[test]
    fn load_skips_chats_for_unknown_peer() {
        let db = ChatDb::open(&unique_tmp_dir("unknown").join("local_chat.db")).expect("open db");
        seed_chat(&db, "a", "me", "ghost", "");

        let cacher = ChatCacher::new();
        cacher.load(&db);

        assert!(cacher.get_latest_chat("ghost").is_none());
    }

    #[test]
    fn load_keeps_most_recent_for_same_conversation() {
        let db = ChatDb::open(&unique_tmp_dir("latest").join("local_chat.db")).expect("open db");
        // now_iso() has seconds resolution, so manually set timestamps
        // to guarantee ordering.
        let mut old = DChat::new("me", "local", "", "{}");
        old.id = "old".to_string();
        old.created_at = "2026-01-01T00:00:01Z".to_string();
        old.updated_at = "2026-01-01T00:00:01Z".to_string();
        db.insert_chat(&old);

        let mut new = DChat::new("me", "local", "", "{}");
        new.id = "new".to_string();
        new.created_at = "2026-01-01T00:00:02Z".to_string();
        new.updated_at = "2026-01-01T00:00:02Z".to_string();
        db.insert_chat(&new);

        let cacher = ChatCacher::new();
        cacher.load(&db);

        let latest = cacher.get_latest_chat("local").unwrap();
        assert_eq!(latest.id, "new");
    }
}
