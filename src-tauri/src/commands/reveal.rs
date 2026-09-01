use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

/// Resolve a chat file URI (`fid:`, `app://`, relative or absolute path)
/// to a local on-disk path, returning `None` when the file does not exist.
fn local_file_path(uri: &str, data_dir: &Path) -> Option<PathBuf> {
    let path = crate::local::server::uri::resolve_uri(uri, data_dir);
    path.is_file().then_some(path)
}

/// Reveal a chat file in the platform file manager (Finder on macOS).
#[tauri::command]
pub fn reveal_chat_file(app: AppHandle, uri: String) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = local_file_path(&uri, &data_dir)
        .ok_or_else(|| format!("File not found: {uri}"))?;
    tauri_plugin_opener::reveal_item_in_dir(path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("plain_reveal_{}_{}", std::process::id(), tag));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn existing_fid_file_resolves() {
        let dir = temp_root("exists");
        std::fs::create_dir_all(dir.join("files/ab/cd")).unwrap();
        let f = dir.join("files/ab/cd/abcdef.jpg");
        std::fs::write(&f, b"x").unwrap();
        assert_eq!(local_file_path("fid:abcdef.jpg", &dir), Some(f));
    }

    #[test]
    fn missing_file_returns_none() {
        let dir = temp_root("missing");
        assert_eq!(local_file_path("fid:abcdef.jpg", &dir), None);
        assert_eq!(local_file_path("app://Pictures/test.png", &dir), None);
    }
}
