use async_graphql::{Context, Object};
use std::sync::Arc;

use super::super::context::AppCtx;
use super::types::{App, ChatChannel, ChatItem, Mount, Peer};

pub struct QueryRoot;

#[Object]
impl QueryRoot {
    async fn app(&self, ctx: &Context<'_>) -> App {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        App {
            usb_connected: false,
            url_token: c.token.clone(),
            http_port: c.port as i32,
            https_port: c.https_port as i32,
            app_dir: String::new(),
            device_name: c.identity.device_name.clone(),
            battery: String::new(),
            app_version: String::new(),
            os_version: String::new(),
            channel: "LOCAL".to_string(),
            permissions: vec![],
            audios: vec![],
            audio_current: String::new(),
            audio_mode: String::new(),
            sdcard_path: String::new(),
            usb_disk_paths: vec![],
            internal_storage_path: String::new(),
            downloads_dir: String::new(),
            developer_mode: false,
            favorite_folders: vec![],
        }
    }

    async fn chat_items(&self, ctx: &Context<'_>, id: String) -> Vec<ChatItem> {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        c.db.get_chats(&id).into_iter().map(ChatItem::from).collect()
    }

    async fn peers(&self, ctx: &Context<'_>) -> Vec<Peer> {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        c.db.get_peers().into_iter().map(Peer::from).collect()
    }

    async fn chat_channels(&self, ctx: &Context<'_>) -> Vec<ChatChannel> {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        c.db.get_channels().into_iter().map(ChatChannel::from).collect()
    }

    async fn latest_chat_items(&self, _ctx: &Context<'_>) -> Vec<ChatItem> {
        vec![]
    }

    // ── homeStats + count query stubs (always 0 / empty in local mode) ────────

    async fn sms_count(&self, _query: Option<String>) -> i32 { 0 }
    async fn contact_count(&self, _query: Option<String>) -> i32 { 0 }
    async fn call_count(&self, _query: Option<String>) -> i32 { 0 }
    async fn image_count(&self, _query: Option<String>) -> i32 { 0 }
    async fn audio_count(&self, _query: Option<String>) -> i32 { 0 }
    async fn video_count(&self, _query: Option<String>) -> i32 { 0 }
    async fn package_count(&self, _query: Option<String>) -> i32 { 0 }
    async fn note_count(&self, _query: Option<String>) -> i32 { 0 }
    async fn doc_count(&self, _query: Option<String>) -> i32 { 0 }
    async fn feed_entry_count(&self, _query: Option<String>) -> i32 { 0 }
    async fn mounts(&self) -> Vec<Mount> { vec![] }
}
