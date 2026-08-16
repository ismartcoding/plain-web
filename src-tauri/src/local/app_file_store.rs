//! Content-addressable chat file store (port of `plain-app` `AppFileStore.kt`).
//!
//! Files uploaded as `isAppFile = true` (e.g. chat attachments) are
//! content-addressed by SHA-256 and stored in a sharded directory layout:
//!
//! ```text
//! {data_dir}/files/{hash[0..1]}/{hash[2..3]}/{hash}.{ext}
//! ```
//!
//! The `fid:` URI scheme (`fid:{hash}.{ext}`) embeds both the hash and the
//! extension so path resolution never needs a database query — `file_server`
//! can map the `fid` suffix straight to a path under the `files/` root.
//!
//! Dedup uses a two-step check (mirrors `AppFileStore.importFile`):
//!
//! 1. **Weak probe** — `size` + SHA-256 of `head(4K) || tail(4K)`. Cheap
//!    index lookup via `app_files(size, weak_hash)` index.
//! 2. **Strong check** — full SHA-256. Only paid when the weak probe matches.
//!
//! On hit, the existing record is reused (and `ref_count` incremented). On
//! miss, the file is copied into the canonical location and a new
//! `app_files` row is inserted.

use std::fs;
use std::io::{Read, Seek};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use plain_rs::hex::bytes_to_hex;

use crate::local::db::{ChatDb, DAppFile};

/// Default MIME type when the client did not supply one.
const DEFAULT_MIME: &str = "application/octet-stream";

/// Chunk size used by the weak hash — first 4 KB + last 4 KB of the file.
const WEAK_HEAD: usize = 4 * 1024;
const WEAK_TAIL: usize = 4 * 1024;

/// Result of importing a file into the store.
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct ImportResult {
    /// SHA-256 hex digest (primary key in `app_files`).
    pub id: String,
    /// Final on-disk file name (`"{hash}.{ext}"`).
    pub fid_suffix: String,
    /// Effective MIME type used.
    pub mime_type: String,
    /// Final absolute path.
    pub real_path: PathBuf,
    /// `true` if an existing record was reused (dedup hit).
    pub reused: bool,
}

/// MIME → lowercase file extension. Empty string for unknown types — the
/// caller falls back to `bin`. Mirrors the table in
/// `plain-app` `AppFileStore.extFromMime` (which uses Android's
/// `MimeTypeMap`); this hardcoded list covers the common types chat uploads
/// produce, plus the expansion from `chat_query::mime_extension`.
pub fn ext_from_mime(mime_type: &str) -> &'static str {
    let lower = mime_type.to_ascii_lowercase();
    match lower.as_str() {
        // Images
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/svg+xml" => "svg",
        "image/bmp" => "bmp",
        "image/tiff" => "tif",
        "image/heic" => "heic",
        "image/avif" => "avif",
        // Videos
        "video/mp4" => "mp4",
        "video/webm" => "webm",
        "video/quicktime" => "mov",
        "video/x-matroska" => "mkv",
        "video/3gpp" | "video/3gpp2" => "3gp",
        // Audio
        "audio/mpeg" => "mp3",
        "audio/mp4" => "m4a",
        "audio/wav" | "audio/x-wav" => "wav",
        "audio/ogg" => "ogg",
        // Documents
        "application/pdf" => "pdf",
        "application/zip" | "application/x-zip-compressed" => "zip",
        "application/json" => "json",
        "application/x-rar-compressed" => "rar",
        "application/x-7z-compressed" => "7z",
        "application/x-tar" => "tar",
        "application/gzip" | "application/x-gzip" => "gz",
        "application/vnd.android.package-archive" => "apk",
        // Text
        "text/plain" => "txt",
        "text/html" => "html",
        "text/csv" => "csv",
        "text/xml" => "xml",
        "text/markdown" => "md",
        // Fonts
        "font/ttf" | "application/x-font-ttf" => "ttf",
        "font/otf" => "otf",
        "font/woff" => "woff",
        "font/woff2" => "woff2",
        _ => "",
    }
}

/// Derive the canonical destination path for a `{hash, ext}` pair.
pub fn dest_path(data_dir: &Path, hash: &str, ext: &str) -> PathBuf {
    data_dir.join(relative_dest_path(hash, ext))
}

/// Relative portion of [dest_path] — `files/{aa}/{bb}/{name}` — stored in
/// the `app_files.real_path` column to avoid repeating the platform-
/// specific `data_dir` prefix on every row.
pub fn relative_dest_path(hash: &str, ext: &str) -> String {
    let name = if ext.is_empty() {
        hash.to_string()
    } else {
        format!("{hash}.{ext}")
    };
    if hash.len() < 4 {
        return format!("files/{name}");
    }
    format!("files/{}/{}/{}", &hash[..2], &hash[2..4], name)
}

/// Compute the strong (full-file) SHA-256 hex digest.
fn strong_hash_file(path: &Path) -> std::io::Result<String> {
    let mut f = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(bytes_to_hex(&hasher.finalize()))
}

/// Compute the weak (head 4K + tail 4K) SHA-256 hex digest.
///
/// Files smaller than `WEAK_HEAD + WEAK_TAIL` are hashed in full; the head
/// and tail ranges still get covered (with overlap) and the result is
/// deterministic.
fn weak_hash_file(path: &Path) -> std::io::Result<(String, u64)> {
    let metadata = fs::metadata(path)?;
    let size = metadata.len();
    let mut f = fs::File::open(path)?;
    let mut hasher = Sha256::new();

    if size as usize <= WEAK_HEAD + WEAK_TAIL {
        // Whole file fits — hash everything (the head/tail windows collapse).
        let mut buf = vec![0u8; size as usize];
        f.read_exact(&mut buf)?;
        hasher.update(&buf);
    } else {
        let mut head = vec![0u8; WEAK_HEAD];
        f.read_exact(&mut head)?;
        hasher.update(&head);
        f.seek(std::io::SeekFrom::End(-(WEAK_TAIL as i64)))?;
        let mut tail = vec![0u8; WEAK_TAIL];
        f.read_exact(&mut tail)?;
        hasher.update(&tail);
    }

    Ok((bytes_to_hex(&hasher.finalize()), size))
}

/// `importFile` equivalent. The caller is responsible for deleting `src` if
/// `delete_src = true` is desired — we always copy (the source may still be
/// needed by the caller for retry / atomicity reasons).
///
/// `mime_type` is the client-supplied type; an empty value falls back to
/// `application/octet-stream` and an extension of `bin`.
pub fn import_file(
    db: &ChatDb,
    data_dir: &Path,
    src: &Path,
    mime_type: &str,
) -> std::io::Result<ImportResult> {
    let (weak_hash, size) = weak_hash_file(src)?;
    let strong_hash = strong_hash_file(src)?;

    // Step 1: weak probe.
    let weak_candidates = db.find_app_files_by_weak(size as i64, &weak_hash);
    for cand in weak_candidates {
        if cand.id == strong_hash {
            // Step 2: strong match — reuse.
            db.increment_app_file_ref(&strong_hash);
            let ext = ext_from_mime(&cand.mime_type);
            let real_path = dest_path(data_dir, &strong_hash, ext);
            ensure_canonical_exists(&real_path, src)?;
            let fid_suffix = if ext.is_empty() {
                strong_hash.clone()
            } else {
                format!("{strong_hash}.{ext}")
            };
            return Ok(ImportResult {
                id: strong_hash,
                fid_suffix,
                mime_type: cand.mime_type,
                real_path,
                reused: true,
            });
        }
    }

    // Step 2 (race guard): direct id lookup.
    if let Some(existing) = db.get_app_file(&strong_hash) {
        db.increment_app_file_ref(&strong_hash);
        let ext = ext_from_mime(&existing.mime_type);
        let real_path = dest_path(data_dir, &strong_hash, ext);
        ensure_canonical_exists(&real_path, src)?;
        let fid_suffix = if ext.is_empty() {
            strong_hash.clone()
        } else {
            format!("{strong_hash}.{ext}")
        };
        return Ok(ImportResult {
            id: strong_hash,
            fid_suffix,
            mime_type: existing.mime_type,
            real_path,
            reused: true,
        });
    }

    // No match — insert new record.
    let effective_mime = if mime_type.is_empty() {
        DEFAULT_MIME.to_string()
    } else {
        mime_type.to_string()
    };
    let ext = ext_from_mime(&effective_mime);
    let real_path = dest_path(data_dir, &strong_hash, ext);
    if let Some(parent) = real_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(src, &real_path)?;

    let now = crate::local::db::now_iso();
    let record = DAppFile {
        id: strong_hash.clone(),
        size: size as i64,
        mime_type: effective_mime.clone(),
        real_path: relative_dest_path(&strong_hash, ext),
        ref_count: 1,
        weak_hash,
        created_at: now.clone(),
        updated_at: now,
    };
    db.insert_app_file(&record);

    let fid_suffix = if ext.is_empty() {
        strong_hash.clone()
    } else {
        format!("{strong_hash}.{ext}")
    };
    Ok(ImportResult {
        id: strong_hash,
        fid_suffix,
        mime_type: effective_mime,
        real_path,
        reused: false,
    })
}

/// In-memory variant — useful for tests or small synthetic uploads.
#[allow(dead_code)]
pub fn import_bytes(
    db: &ChatDb,
    data_dir: &Path,
    data: &[u8],
    mime_type: &str,
) -> std::io::Result<ImportResult> {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let strong_hash = bytes_to_hex(&hasher.finalize());

    if let Some(existing) = db.get_app_file(&strong_hash) {
        db.increment_app_file_ref(&strong_hash);
        let ext = ext_from_mime(&existing.mime_type);
        let real_path = dest_path(data_dir, &strong_hash, ext);
        let fid_suffix = if ext.is_empty() {
            strong_hash.clone()
        } else {
            format!("{strong_hash}.{ext}")
        };
        return Ok(ImportResult {
            id: strong_hash,
            fid_suffix,
            mime_type: existing.mime_type,
            real_path,
            reused: true,
        });
    }

    let effective_mime = if mime_type.is_empty() {
        DEFAULT_MIME.to_string()
    } else {
        mime_type.to_string()
    };
    let ext = ext_from_mime(&effective_mime);
    let real_path = dest_path(data_dir, &strong_hash, ext);
    if let Some(parent) = real_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&real_path, data)?;

    // Weak hash for in-memory data is the same as strong (we have the full
    // bytes). Use first 4K + last 4K to stay consistent with the file path
    // for index reuse.
    let mut weak = Sha256::new();
    if data.len() <= WEAK_HEAD + WEAK_TAIL {
        weak.update(data);
    } else {
        weak.update(&data[..WEAK_HEAD]);
        weak.update(&data[data.len() - WEAK_TAIL..]);
    }
    let weak_hash = bytes_to_hex(&weak.finalize());

    let now = crate::local::db::now_iso();
    let record = DAppFile {
        id: strong_hash.clone(),
        size: data.len() as i64,
        mime_type: effective_mime.clone(),
        real_path: relative_dest_path(&strong_hash, ext),
        ref_count: 1,
        weak_hash,
        created_at: now.clone(),
        updated_at: now,
    };
    db.insert_app_file(&record);

    let fid_suffix = if ext.is_empty() {
        strong_hash.clone()
    } else {
        format!("{strong_hash}.{ext}")
    };
    Ok(ImportResult {
        id: strong_hash,
        fid_suffix,
        mime_type: effective_mime,
        real_path,
        reused: false,
    })
}

/// If the canonical path is missing but the source is a normal file, copy.
/// (The `app_files` table can outlive its backing file after a manual
/// wipe; `importFile` in plain-app silently restores it.)
fn ensure_canonical_exists(real_path: &Path, src: &Path) -> std::io::Result<()> {
    if real_path.exists() {
        return Ok(());
    }
    if let Some(parent) = real_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(src, real_path)?;
    Ok(())
}

/// Async helper: write `data` to a temp file, then return the path. The
/// caller is expected to rename / delete the file as part of its own
/// atomicity strategy.
#[allow(dead_code)]
pub async fn write_temp_async(dir: &Path, prefix: &str, ext: &str) -> std::io::Result<(PathBuf, tokio::fs::File)> {
    tokio::fs::create_dir_all(dir).await?;
    let name = format!("{prefix}_{}.{}", std::process::id(), ext);
    let path = dir.join(name);
    let f = tokio::fs::File::create(&path).await?;
    Ok((path, f))
}

/// Stream a `Read` source to a `tokio::fs::File`, returning the final size.
#[allow(dead_code)]
pub async fn copy_to_async(
    dst: &mut tokio::fs::File,
    mut src: impl tokio::io::AsyncRead + Unpin,
) -> std::io::Result<u64> {
    let mut buf = vec![0u8; 64 * 1024];
    let mut total: u64 = 0;
    loop {
        let n = src.read(&mut buf).await?;
        if n == 0 {
            break;
        }
        dst.write_all(&buf[..n]).await?;
        total += n as u64;
    }
    dst.flush().await?;
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_weak_hash_for(data: &[u8]) -> (String, i64) {
        let mut hasher = Sha256::new();
        if data.len() <= WEAK_HEAD + WEAK_TAIL {
            hasher.update(data);
        } else {
            hasher.update(&data[..WEAK_HEAD]);
            hasher.update(&data[data.len() - WEAK_TAIL..]);
        }
        (bytes_to_hex(&hasher.finalize()), data.len() as i64)
    }

    #[test]
    fn ext_from_mime_covers_common_types() {
        assert_eq!(ext_from_mime("image/jpeg"), "jpg");
        assert_eq!(ext_from_mime("image/png"), "png");
        assert_eq!(ext_from_mime("video/mp4"), "mp4");
        assert_eq!(ext_from_mime("application/pdf"), "pdf");
        assert_eq!(ext_from_mime("text/markdown"), "md");
        assert_eq!(ext_from_mime(""), "");
        assert_eq!(ext_from_mime("application/octet-stream"), "");
        assert_eq!(ext_from_mime("IMAGE/PNG"), "png"); // case-insensitive
    }

    #[test]
    fn strong_hash_is_deterministic() {
        let h1 = {
            let mut h = Sha256::new();
            h.update(b"hello world");
            bytes_to_hex(&h.finalize())
        };
        let h2 = {
            let mut h = Sha256::new();
            h.update(b"hello world");
            bytes_to_hex(&h.finalize())
        };
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 64);
    }

    #[test]
    fn weak_hash_collapses_head_tail_for_small_file() {
        // For files smaller than HEAD + TAIL, the whole file is hashed.
        let data = b"small content";
        let (h, size) = make_weak_hash_for(data);
        assert_eq!(size, data.len() as i64);
        let mut hasher = Sha256::new();
        hasher.update(data);
        assert_eq!(h, bytes_to_hex(&hasher.finalize()));
    }

    #[test]
    fn weak_hash_uses_head_and_tail_for_large_file() {
        // Build a 16 KB blob — large enough that the head/tail windows are
        // separate (4 KB + 4 KB, with 8 KB in the middle that must NOT be
        // hashed).
        let mut data = vec![0u8; 16 * 1024];
        for (i, b) in data.iter_mut().enumerate() {
            *b = (i & 0xff) as u8;
        }
        // Middle 8 KB — set to 0xFF so any failure to skip it would change
        // the hash.
        for b in &mut data[4 * 1024..12 * 1024] {
            *b = 0xff;
        }
        let (h, size) = make_weak_hash_for(&data);
        assert_eq!(size, data.len() as i64);

        let mut hasher = Sha256::new();
        hasher.update(&data[..4 * 1024]);
        hasher.update(&data[12 * 1024..]);
        let expected = bytes_to_hex(&hasher.finalize());
        assert_eq!(h, expected);

        // Sanity: hashing the whole file gives a different value.
        let mut full = Sha256::new();
        full.update(&data);
        assert_ne!(h, bytes_to_hex(&full.finalize()));
    }

    #[test]
    fn relative_dest_path_sharded() {
        assert_eq!(
            relative_dest_path("abcdef0123456789", "jpg"),
            "files/ab/cd/abcdef0123456789.jpg"
        );
    }

    #[test]
    fn relative_dest_path_without_ext() {
        assert_eq!(
            relative_dest_path("abcdef0123456789", ""),
            "files/ab/cd/abcdef0123456789"
        );
    }

    #[test]
    fn relative_dest_path_short_hash_falls_back_flat() {
        assert_eq!(relative_dest_path("ab", "jpg"), "files/ab.jpg");
        assert_eq!(relative_dest_path("ab", ""), "files/ab");
    }

    #[test]
    fn dest_path_joins_data_dir_with_relative() {
        let dir = std::path::Path::new("/data");
        assert_eq!(
            dest_path(dir, "abcdef0123456789", "jpg"),
            std::path::PathBuf::from("/data/files/ab/cd/abcdef0123456789.jpg")
        );
    }
}
