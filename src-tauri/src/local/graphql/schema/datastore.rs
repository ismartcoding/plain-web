use async_graphql::{Context, Object};
use std::sync::Arc;

use super::super::context::AppCtx;
use super::types::KeyValuePair;

#[derive(Default)]
pub struct DataStoreQuery;

#[Object]
impl DataStoreQuery {
    async fn data_store_path(&self, ctx: &Context<'_>) -> String {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        c.data_dir.join("prefs.json").to_string_lossy().into_owned()
    }

    async fn data_store_entries(&self, ctx: &Context<'_>) -> Vec<KeyValuePair> {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        let text = match std::fs::read_to_string(c.data_dir.join("prefs.json")) {
            Ok(t) => t,
            Err(_) => return vec![],
        };
        let obj: serde_json::Map<String, serde_json::Value> = match serde_json::from_str(&text) {
            Ok(m) => m,
            Err(_) => return vec![],
        };
        let mut entries: Vec<KeyValuePair> = obj
            .into_iter()
            .map(|(k, v)| KeyValuePair { key: k, value: v.to_string() })
            .collect();
        entries.sort_by(|a, b| a.key.cmp(&b.key));
        entries
    }
}

#[derive(Default)]
pub struct DataStoreMutation;

#[Object]
impl DataStoreMutation {
    async fn delete_data_store_entry(&self, ctx: &Context<'_>, key: String) -> bool {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        let prefs_path = c.data_dir.join("prefs.json");
        let text = match std::fs::read_to_string(&prefs_path) {
            Ok(t) => t,
            Err(_) => return false,
        };
        let mut obj: serde_json::Map<String, serde_json::Value> =
            match serde_json::from_str(&text) {
                Ok(m) => m,
                Err(_) => return false,
            };
        obj.remove(&key);
        std::fs::write(&prefs_path, serde_json::to_string(&obj).unwrap_or_default()).is_ok()
    }
}
