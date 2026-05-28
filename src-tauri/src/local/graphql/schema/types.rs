use async_graphql::{Enum, SimpleObject, Union};

use crate::local::db::{DChannel, DChat, DPeer};

// ── Output types ──────────────────────────────────────────────────────────────

#[derive(Enum, Copy, Clone, Eq, PartialEq)]
#[graphql(name = "DevicePlatform")]
pub enum DevicePlatform {
    Android,
    Ios,
    Macos,
    Windows,
    Linux,
}

#[derive(SimpleObject)]
#[graphql(name = "AndroidDeviceInfo")]
pub struct AndroidDeviceInfo {
    pub sdk_version: i32,
    pub version_code_name: String,
    pub security_patch: String,
    pub bootloader: String,
    pub fingerprint: String,
    pub hardware: String,
    pub radio_version: String,
    pub board: String,
    pub build_brand: String,
    pub build_host: String,
    pub build_user: String,
    pub build_number: String,
    pub product: String,
    pub device: String,
    pub java_vm_version: String,
    pub gl_es_version: String,
    pub serial: String,
    pub build_time: String,
}

#[derive(SimpleObject)]
#[graphql(name = "DesktopDeviceInfo")]
pub struct DesktopDeviceInfo {
    pub hostname: String,
    pub cpu_model: String,
    pub gpu_model: String,
    pub desktop_environment: String,
    pub window_manager: String,
}

#[derive(SimpleObject)]
#[graphql(name = "DisplayInfo")]
pub struct DisplayInfo {
    pub width: i32,
    pub height: i32,
    pub density: String,
}

#[derive(SimpleObject)]
#[graphql(name = "DeviceInfo")]
pub struct DeviceInfo {
    pub name: String,
    pub platform: DevicePlatform,
    pub manufacturer: String,
    pub model: String,
    pub os_name: String,
    pub os_version: String,
    pub kernel_version: String,
    pub app_version: String,
    pub app_build_number: String,
    pub language: String,
    pub uptime: i64,
    pub cpu_arch: String,
    pub total_memory: i64,
    pub total_storage: i64,
    pub display: Option<DisplayInfo>,
    pub android: Option<AndroidDeviceInfo>,
    pub desktop: Option<DesktopDeviceInfo>,
}

#[derive(SimpleObject)]
#[graphql(name = "Sim")]
pub struct Sim {
    pub id: String,
    pub label: String,
    pub number: String,
    pub subscription_id: i32,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq)]
#[graphql(name = "BatteryHealth")]
pub enum BatteryHealth {
    Unknown,
    Good,
    Overheat,
    Dead,
    OverVoltage,
    UnspecifiedFailure,
    Cold,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq)]
#[graphql(name = "BatteryStatus")]
pub enum BatteryStatus {
    Unknown,
    Charging,
    Discharging,
    NotCharging,
    Full,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq)]
#[graphql(name = "BatteryPlugged")]
pub enum BatteryPlugged {
    Unplugged,
    Ac,
    Usb,
    Wireless,
}

#[derive(SimpleObject)]
#[graphql(name = "Battery")]
pub struct BatteryInfo {
    pub level: i32,
    pub voltage: i32,
    pub health: BatteryHealth,
    pub plugged: BatteryPlugged,
    pub temperature: f64,
    pub status: BatteryStatus,
    pub technology: String,
    pub capacity: i32,
}

#[derive(SimpleObject)]
pub struct PlaylistAudio {
    pub title: String,
    pub artist: String,
    pub path: String,
    pub duration: i32,
}

#[derive(SimpleObject)]
pub struct FavoriteFolder {
    pub root_path: String,
    pub full_path: String,
    pub alias: String,
}

#[derive(SimpleObject)]
pub struct KeyValuePair {
    pub key: String,
    pub value: String,
}

#[derive(SimpleObject)]
pub struct App {
    pub usb_connected: bool,
    pub url_token: String,
    pub http_port: i32,
    pub https_port: i32,
    pub app_dir: String,
    pub device_name: String,
    pub battery: String,
    pub app_version: String,
    pub os_version: String,
    pub channel: String,
    pub permissions: Vec<String>,
    pub audios: Vec<PlaylistAudio>,
    pub audio_current: String,
    pub audio_mode: String,
    pub sdcard_path: String,
    pub usb_disk_paths: Vec<String>,
    pub internal_storage_path: String,
    pub downloads_dir: String,
    pub developer_mode: bool,
    pub favorite_folders: Vec<FavoriteFolder>,
    pub debug: bool,
}

/// All fields from both `homeStatsGQL` and the full `mountsGQL` query.
#[derive(SimpleObject)]
pub struct Mount {
    pub id: String,
    pub name: String,
    pub path: String,
    pub mount_point: String,
    pub fs_type: String,
    pub total_bytes: i64,
    pub used_bytes: i64,
    pub free_bytes: i64,
    pub remote: bool,
    pub alias: String,
    pub drive_type: String,
    #[graphql(name = "diskID")]
    pub disk_id: String,
}

/// Union for `ChatItem.data` — always `None` in local mode but schema must match the fragment.
#[derive(Union)]
pub enum ChatItemData {
    MessageImages(MessageImages),
    MessageFiles(MessageFiles),
    MessageText(MessageText),
}

#[derive(SimpleObject)]
pub struct MessageImages {
    pub ids: Vec<String>,
}

#[derive(SimpleObject)]
pub struct MessageFiles {
    pub ids: Vec<String>,
}

#[derive(SimpleObject)]
pub struct MessageText {
    pub ids: Vec<String>,
}

#[derive(SimpleObject)]
pub struct ChatItem {
    pub id: String,
    pub from_id: String,
    pub to_id: String,
    pub channel_id: String,
    pub created_at: String,
    pub content: String,
    pub status: String,
    pub status_data: String,
    pub data: Option<ChatItemData>,
}

impl From<DChat> for ChatItem {
    fn from(c: DChat) -> Self {
        Self {
            id: c.id,
            from_id: c.from_id,
            to_id: c.to_id,
            channel_id: c.channel_id,
            created_at: c.created_at,
            content: c.content,
            status: c.status,
            status_data: c.status_data,
            data: None,
        }
    }
}

#[derive(SimpleObject, Clone)]
pub struct ChatChannelMember {
    pub id: String,
    pub status: String,
}

#[derive(SimpleObject)]
pub struct ChatChannel {
    pub id: String,
    pub name: String,
    pub owner: String,
    pub members: Vec<ChatChannelMember>,
    pub version: i64,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<DChannel> for ChatChannel {
    fn from(ch: DChannel) -> Self {
        let members = serde_json::from_str::<Vec<serde_json::Value>>(&ch.members)
            .unwrap_or_default()
            .into_iter()
            .map(|m| ChatChannelMember {
                id: m["id"].as_str().unwrap_or("").to_string(),
                status: m["status"].as_str().unwrap_or("").to_string(),
            })
            .collect();
        Self {
            id: ch.id,
            name: ch.name,
            owner: ch.owner,
            members,
            version: ch.version,
            status: ch.status,
            created_at: ch.created_at,
            updated_at: ch.updated_at,
        }
    }
}

#[derive(SimpleObject)]
pub struct Peer {
    pub id: String,
    pub name: String,
    pub ip: String,
    pub status: String,
    pub online: bool,
    pub port: i32,
    pub device_type: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<DPeer> for Peer {
    fn from(p: DPeer) -> Self {
        Self {
            id: p.id,
            name: p.name,
            ip: p.ip,
            status: p.status,
            online: false,
            port: p.port as i32,
            device_type: p.device_type,
            created_at: p.created_at,
            updated_at: p.updated_at,
        }
    }
}
