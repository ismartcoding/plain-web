//! `fileInfo` query — mirrors `plain-app` `web/schemas/FileQueryGraphQL.kt`.
//!
//! Used by the chat lightbox's right-side info panel. In Tauri popup
//! windows the lightbox renders without a device session, so the request
//! lands on the local server. Without this resolver the popup lightbox
//! fails every query with `Unknown field "fileInfo"` and the right-side
//! info button is broken.
//!
//! Scope is intentionally narrower than the Kotlin original:
//! - `path` is resolved through `resolve_uri` (handles `fid:`, `app://`,
//!   relative, and absolute forms), so we can read metadata for files
//!   already in the local content-addressable store.
//! - Image dimensions and EXIF GPS are parsed by hand from the JPEG /
//!   PNG / GIF / WebP / BMP / TIFF headers. We only need width / height
//!   and GPS coordinates, so a hand-rolled EXIF reader keeps us off a
//!   third-party dependency.
//! - Video / audio metadata (width, height, duration) require
//!   `MediaMetadataRetriever` equivalents we don't ship. The desktop
//!   main window still routes through the device server for those
//!   fields; in local mode they read as `0` and the popup's right
//!   panel — collapsed by default — is unaffected.
//! - `tags` is always empty in local mode; plain-web doesn't yet
//!   persist tag relations.

use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::Path;

use async_graphql::{Context, Object, Result as GqlResult};

use crate::local::graphql::context::AppCtx;
use crate::local::graphql::schema::types::{AudioFileInfo, FileInfo, ImageFileInfo, Location, MediaFileInfo, Tag, VideoFileInfo};
use crate::local::server::uri::resolve_uri;

#[derive(Default)]
pub struct FileInfoQuery;

#[Object]
impl FileInfoQuery {
    /// Mirrors `plain-app` `query("fileInfo") { id path fileName }` —
    /// `id` and `fileName` are accepted for schema parity but only `path`
    /// is used to locate the file.
    async fn file_info(
        &self,
        ctx: &Context<'_>,
        id: String,
        path: String,
        file_name: String,
    ) -> GqlResult<FileInfo> {
        let _ = (id, file_name);
        let c = ctx.data_unchecked::<std::sync::Arc<AppCtx>>();

        let real = resolve_uri(&path, &c.data_dir);
        let (updated_at, size) = read_file_meta(&real);
        let data = classify_and_load(&real);

        Ok(FileInfo {
            path,
            updated_at,
            size,
            tags: Vec::<Tag>::new(),
            data,
        })
    }
}

fn read_file_meta(path: &Path) -> (String, i64) {
    let Ok(meta) = std::fs::metadata(path) else {
        return (String::new(), 0);
    };
    let updated_at = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| unix_secs_to_iso8601(d.as_secs() as i64))
        .unwrap_or_default();
    (updated_at, meta.len() as i64)
}

/// Format a unix-second timestamp as `YYYY-MM-DDTHH:MM:SSZ` without
/// pulling in `chrono`. Local mode timestamps are best-effort (UTC).
fn unix_secs_to_iso8601(secs: i64) -> String {
    if secs <= 0 {
        return String::new();
    }
    let days = secs.div_euclid(86_400);
    let mut year: i64 = 1970;
    let mut remaining = days;
    loop {
        let leap = is_leap(year);
        let dy = if leap { 366 } else { 365 };
        if remaining < dy {
            break;
        }
        remaining -= dy;
        year += 1;
    }
    let leap = is_leap(year);
    let md: [i64; 12] = if leap {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut month: i64 = 1;
    for &dm in md.iter() {
        if remaining < dm {
            break;
        }
        remaining -= dm;
        month += 1;
    }
    let day = remaining + 1;
    let tod = secs.rem_euclid(86_400);
    let hh = tod / 3600;
    let mm = (tod % 3600) / 60;
    let ss = tod % 60;
    format!("{year:04}-{month:02}-{day:02}T{hh:02}:{mm:02}:{ss:02}Z")
}

fn is_leap(y: i64) -> bool {
    y % 4 == 0 && (y % 100 != 0 || y % 400 == 0)
}

fn classify_and_load(path: &Path) -> Option<MediaFileInfo> {
    if !path.is_file() {
        return None;
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)?;
    if is_image_ext(&ext) {
        load_image(path, &ext).map(MediaFileInfo::Image)
    } else if is_video_ext(&ext) {
        // No video decoder in local mode — return zeros so the union
        // variant is still selectable on the client.
        Some(MediaFileInfo::Video(VideoFileInfo {
            width: 0,
            height: 0,
            duration: 0,
            location: None,
        }))
    } else if is_audio_ext(&ext) {
        Some(MediaFileInfo::Audio(AudioFileInfo {
            duration: 0,
            location: None,
        }))
    } else {
        None
    }
}

fn is_image_ext(ext: &str) -> bool {
    matches!(
        ext,
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp" | "tif" | "tiff"
    )
}

fn is_video_ext(ext: &str) -> bool {
    matches!(
        ext,
        "mp4" | "m4v" | "mov" | "mkv" | "webm" | "avi" | "3gp"
    )
}

fn is_audio_ext(ext: &str) -> bool {
    matches!(ext, "mp3" | "m4a" | "aac" | "wav" | "flac" | "ogg" | "opus")
}

// ── Image dimensions (hand-rolled) ───────────────────────────────────────────

fn load_image(path: &Path, ext: &str) -> Option<ImageFileInfo> {
    let (w, h) = match ext {
        "jpg" | "jpeg" => jpeg_dimensions(path)?,
        "png" => png_dimensions(path)?,
        "gif" => gif_dimensions(path)?,
        "webp" => webp_dimensions(path)?,
        "bmp" => bmp_dimensions(path)?,
        "tif" | "tiff" => tiff_dimensions(path)?,
        _ => return None,
    };
    let location = if matches!(ext, "jpg" | "jpeg" | "tif" | "tiff") {
        read_exif_gps(path)
    } else {
        None
    };
    Some(ImageFileInfo {
        width: w,
        height: h,
        location,
    })
}

fn jpeg_dimensions(path: &Path) -> Option<(i32, i32)> {
    let mut r = BufReader::new(File::open(path).ok()?);
    let mut marker = [0u8; 2];
    if r.read_exact(&mut marker).is_err() || marker != [0xFF, 0xD8] {
        return None;
    }
    loop {
        if r.read_exact(&mut marker).is_err() {
            return None;
        }
        while marker[0] != 0xFF {
            // Skip stray fill bytes.
            marker[0] = marker[1];
            marker[1] = 0;
            if r.read_exact(&mut marker[1..]).is_err() {
                return None;
            }
        }
        // Markers can be repeated (0xFF 0xFF) — skip padding.
        while marker[1] == 0xFF {
            if r.read_exact(&mut marker[1..]).is_err() {
                return None;
            }
        }
        let m = marker[1];
        // SOF markers (Start Of Frame), except 0xC4 (DHT) and 0xC8 (JPG).
        if (0xC0..=0xCF).contains(&m) && m != 0xC4 && m != 0xC8 {
            // Skip 2-byte segment length.
            r.seek(SeekFrom::Current(2)).ok()?;
            // 1 byte precision, then height (2) + width (2).
            let mut buf = [0u8; 5];
            r.read_exact(&mut buf).ok()?;
            let h = u16::from_be_bytes([buf[1], buf[2]]) as i32;
            let w = u16::from_be_bytes([buf[3], buf[4]]) as i32;
            return Some((w, h));
        }
        // SOS (0xDA) or EOI (0xD9) — no more dimension markers ahead.
        if m == 0xDA || m == 0xD9 {
            return None;
        }
        // Skip segment: read 2-byte length and seek past it.
        let mut len = [0u8; 2];
        r.read_exact(&mut len).ok()?;
        let seg_len = u16::from_be_bytes(len) as i64;
        if seg_len < 2 {
            return None;
        }
        r.seek(SeekFrom::Current(seg_len - 2)).ok()?;
    }
}

fn png_dimensions(path: &Path) -> Option<(i32, i32)> {
    let mut r = BufReader::new(File::open(path).ok()?);
    let mut sig = [0u8; 8];
    r.read_exact(&mut sig).ok()?;
    if &sig != b"\x89PNG\r\n\x1a\n" {
        return None;
    }
    // IHDR chunk: 4-byte length, 4-byte type, then data.
    let mut head = [0u8; 8];
    r.read_exact(&mut head).ok()?;
    if &head[4..] != b"IHDR" {
        return None;
    }
    let mut dims = [0u8; 8];
    r.read_exact(&mut dims).ok()?;
    let w = u32::from_be_bytes([dims[0], dims[1], dims[2], dims[3]]) as i32;
    let h = u32::from_be_bytes([dims[4], dims[5], dims[6], dims[7]]) as i32;
    Some((w, h))
}

fn gif_dimensions(path: &Path) -> Option<(i32, i32)> {
    let mut r = BufReader::new(File::open(path).ok()?);
    let mut sig = [0u8; 6];
    r.read_exact(&mut sig).ok()?;
    if &sig != b"GIF87a" && &sig != b"GIF89a" {
        return None;
    }
    let mut dims = [0u8; 4];
    r.read_exact(&mut dims).ok()?;
    let w = u16::from_le_bytes([dims[0], dims[1]]) as i32;
    let h = u16::from_le_bytes([dims[2], dims[3]]) as i32;
    Some((w, h))
}

fn bmp_dimensions(path: &Path) -> Option<(i32, i32)> {
    let mut r = BufReader::new(File::open(path).ok()?);
    let mut sig = [0u8; 2];
    r.read_exact(&mut sig).ok()?;
    if &sig != b"BM" {
        return None;
    }
    r.seek(SeekFrom::Start(18)).ok()?;
    let mut dims = [0u8; 8];
    r.read_exact(&mut dims).ok()?;
    let w = i32::from_le_bytes(dims[0..4].try_into().ok()?);
    let h = i32::from_le_bytes(dims[4..8].try_into().ok()?);
    Some((w.abs(), h.abs()))
}

fn webp_dimensions(path: &Path) -> Option<(i32, i32)> {
    let mut r = BufReader::new(File::open(path).ok()?);
    let mut head = [0u8; 12];
    r.read_exact(&mut head).ok()?;
    if &head[0..4] != b"RIFF" || &head[8..12] != b"WEBP" {
        return None;
    }
    let mut fourcc = [0u8; 4];
    r.read_exact(&mut fourcc).ok()?;
    match &fourcc {
        b"VP8 " => {
            // Lossy: skip 10 bytes (frame tag + start code), then 3 bytes
            // of scale, then 2 bytes width + 2 bytes height (LE).
            r.seek(SeekFrom::Current(10)).ok()?;
            let mut dims = [0u8; 4];
            r.read_exact(&mut dims).ok()?;
            let w = u16::from_le_bytes([dims[0], dims[1]]) as i32 & 0x3FFF;
            let h = u16::from_le_bytes([dims[2], dims[3]]) as i32 & 0x3FFF;
            Some((w, h))
        }
        b"VP8L" => {
            // Lossless: 1 byte signature, then 4 bytes packed (LE).
            r.seek(SeekFrom::Current(1)).ok()?;
            let mut dims = [0u8; 4];
            r.read_exact(&mut dims).ok()?;
            let w = 1 + (((dims[1] & 0x3F) as i32) << 8 | dims[0] as i32);
            let h = 1 + (((dims[3] & 0x0F) as i32) << 10 | (dims[2] as i32) << 2 | ((dims[1] & 0xC0) as i32) >> 6);
            Some((w, h))
        }
        b"VP8X" => {
            // Extended: 8 bytes flags, then 3 bytes width-1, 3 bytes height-1.
            r.seek(SeekFrom::Current(8)).ok()?;
            let mut dims = [0u8; 6];
            r.read_exact(&mut dims).ok()?;
            let w = (dims[0] as i32) | ((dims[1] as i32) << 8) | (((dims[2] as i32) << 16) + 1);
            let h = (dims[3] as i32) | ((dims[4] as i32) << 8) | (((dims[5] as i32) << 16) + 1);
            Some((w, h))
        }
        _ => None,
    }
}

fn tiff_dimensions(path: &Path) -> Option<(i32, i32)> {
    let mut r = BufReader::new(File::open(path).ok()?);
    let mut head = [0u8; 8];
    r.read_exact(&mut head).ok()?;
    let (le, ifd_offset) = parse_tiff_header(&head)?;
    let (w, h) = tiff_image_width_height(&mut r, le, ifd_offset)?;
    Some((w, h))
}

// ── EXIF GPS extraction (hand-rolled, JPEG + TIFF) ───────────────────────────

fn read_exif_gps(path: &Path) -> Option<Location> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)?;
    let bytes = std::fs::read(path).ok()?;
    let tiff = match ext.as_str() {
        "jpg" | "jpeg" => exif_tiff_from_jpeg(&bytes)?,
        "tif" | "tiff" => &bytes[..],
        _ => return None,
    };
    let (le, ifd0_off) = parse_tiff_header(tiff)?;
    let gps_off = tiff_find_sub_ifd(tiff, ifd0_off, le, 0x8825)?;
    let lat = tiff_read_dms(tiff, gps_off, le, 0x0002, 0x0001)?;
    let lon = tiff_read_dms(tiff, gps_off, le, 0x0004, 0x0003)?;
    Some(Location {
        latitude: lat,
        longitude: lon,
    })
}

/// Find the `Exif\0\0` marker in a JPEG's APP1 segment and return the
/// TIFF payload that follows it. Returns `None` if there is no EXIF.
fn exif_tiff_from_jpeg(jpeg: &[u8]) -> Option<&[u8]> {
    if jpeg.len() < 4 || jpeg[0..2] != [0xFF, 0xD8] {
        return None;
    }
    let mut i = 2;
    while i + 4 <= jpeg.len() {
        if jpeg[i] != 0xFF {
            return None;
        }
        // Skip 0xFF padding.
        let mut marker = jpeg[i + 1];
        while marker == 0xFF && i + 2 < jpeg.len() {
            i += 1;
            marker = jpeg[i + 1];
        }
        i += 2;
        if marker == 0xD9 || marker == 0xDA {
            return None;
        }
        if i + 2 > jpeg.len() {
            return None;
        }
        let seg_len = u16::from_be_bytes([jpeg[i], jpeg[i + 1]]) as usize;
        if seg_len < 2 || i + seg_len > jpeg.len() {
            return None;
        }
        let payload = &jpeg[i + 2..i + seg_len];
        if marker == 0xE1 && payload.starts_with(b"Exif\0\0") {
            return Some(&payload[6..]);
        }
        i += seg_len;
    }
    None
}

fn parse_tiff_header(tiff: &[u8]) -> Option<(bool, u32)> {
    if tiff.len() < 8 {
        return None;
    }
    let (le, magic) = match &tiff[0..2] {
        b"II" => (true, 0x002A),
        b"MM" => (false, 0x002A),
        _ => return None,
    };
    let expected = if le {
        u16::from_le_bytes([tiff[2], tiff[3]])
    } else {
        u16::from_be_bytes([tiff[2], tiff[3]])
    };
    if expected != magic {
        return None;
    }
    let off = if le {
        u32::from_le_bytes([tiff[4], tiff[5], tiff[6], tiff[7]])
    } else {
        u32::from_be_bytes([tiff[4], tiff[5], tiff[6], tiff[7]])
    };
    Some((le, off))
}

fn tiff_read_u16(tiff: &[u8], off: usize, le: bool) -> Option<u16> {
    let b = tiff.get(off..off + 2)?;
    Some(if le { u16::from_le_bytes([b[0], b[1]]) } else { u16::from_be_bytes([b[0], b[1]]) })
}

fn tiff_read_u32(tiff: &[u8], off: usize, le: bool) -> Option<u32> {
    let b = tiff.get(off..off + 4)?;
    Some(if le { u32::from_le_bytes([b[0], b[1], b[2], b[3]]) } else { u32::from_be_bytes([b[0], b[1], b[2], b[3]]) })
}

/// Read tag `tag_id` (image width / image height) from the IFD at `ifd_off`.
/// Returns `(width, height)`. Only handles SHORT/LONG types stored inline.
fn tiff_image_width_height(r: &mut BufReader<File>, le: bool, ifd_off: u32) -> Option<(i32, i32)> {
    let mut hdr = [0u8; 2];
    r.seek(SeekFrom::Start(ifd_off as u64)).ok()?;
    r.read_exact(&mut hdr).ok()?;
    let count = tiff_read_u16_from_slice(&hdr, 0, le)?;
    let mut entry = [0u8; 12];
    let mut width: Option<i32> = None;
    let mut height: Option<i32> = None;
    for _ in 0..count {
        r.read_exact(&mut entry).ok()?;
        let tag = tiff_read_u16_from_slice(&entry, 0, le)?;
        if tag == 0x0100 {
            width = tiff_ifd_value_i32(&entry, le);
        } else if tag == 0x0101 {
            height = tiff_ifd_value_i32(&entry, le);
        }
        if width.is_some() && height.is_some() {
            break;
        }
    }
    Some((width?, height?))
}

fn tiff_read_u16_from_slice(s: &[u8], off: usize, le: bool) -> Option<u16> {
    tiff_read_u16(s, off, le)
}

/// Decode a SHORT (type 3) or LONG (type 4) value that fits in 4 bytes.
fn tiff_ifd_value_i32(entry: &[u8; 12], le: bool) -> Option<i32> {
    let typ = tiff_read_u16_from_slice(entry, 2, le)?;
    // value field is 4 bytes at entry[8..12].
    match typ {
        3 => Some(tiff_read_u16_from_slice(entry, 8, le)? as i32),
        4 => Some(tiff_read_u32_from_slice(entry, 8, le)? as i32),
        _ => None,
    }
}

fn tiff_read_u32_from_slice(s: &[u8], off: usize, le: bool) -> Option<u32> {
    tiff_read_u32(s, off, le)
}

/// Find a sub-IFD (e.g. GPS IFD) by tag id in the IFD at `ifd_off`. Returns
/// the offset of the sub-IFD's first entry.
fn tiff_find_sub_ifd(tiff: &[u8], ifd_off: u32, le: bool, sub_tag: u16) -> Option<u32> {
    let count = tiff_read_u16(tiff, ifd_off as usize, le)? as usize;
    let base = ifd_off as usize + 2;
    for i in 0..count {
        let entry = base + i * 12;
        if entry + 12 > tiff.len() {
            return None;
        }
        let tag = tiff_read_u16(tiff, entry, le)?;
        if tag == sub_tag {
            // Type 4 (LONG) value is stored inline in the 4-byte value field.
            return tiff_read_u32(tiff, entry + 8, le);
        }
    }
    None
}

/// Read a GPS DMS coordinate (RATIONAL × 3) and apply the matching
/// `*Ref` (ASCII "N"/"S"/"E"/"W") tag to derive a signed decimal.
fn tiff_read_dms(
    tiff: &[u8],
    ifd_off: u32,
    le: bool,
    dms_tag: u16,
    ref_tag: u16,
) -> Option<f64> {
    let (dms, ref_marker) = tiff_find_dms_and_ref(tiff, ifd_off, le, dms_tag, ref_tag)?;
    let mut iter = dms.iter();
    let d = iter.next()?.to_f64();
    let m = iter.next()?.to_f64();
    let s = iter.next()?.to_f64();
    let mut decimal = d + m / 60.0 + s / 3600.0;
    if ref_marker.contains('S') || ref_marker.contains('W') {
        decimal = -decimal;
    }
    Some(decimal)
}

fn tiff_find_dms_and_ref(
    tiff: &[u8],
    ifd_off: u32,
    le: bool,
    dms_tag: u16,
    ref_tag: u16,
) -> Option<(Vec<TiffRational>, String)> {
    let count = tiff_read_u16(tiff, ifd_off as usize, le)? as usize;
    let base = ifd_off as usize + 2;
    let mut dms: Option<Vec<TiffRational>> = None;
    let mut ref_marker: Option<String> = None;
    for i in 0..count {
        let entry = base + i * 12;
        if entry + 12 > tiff.len() {
            return None;
        }
        let tag = tiff_read_u16(tiff, entry, le)?;
        let typ = tiff_read_u16(tiff, entry + 2, le)?;
        if tag == dms_tag && typ == 5 {
            let off = tiff_read_u32(tiff, entry + 8, le)? as usize;
            dms = Some(tiff_read_rationals(tiff, off, le, 3)?);
        } else if tag == ref_tag && typ == 2 {
            // ASCII: value is N bytes starting at `off` (or inline if
            // count ≤ 4). Use whichever is shorter.
            let count_bytes = tiff_read_u32(tiff, entry + 4, le)? as usize;
            let buf: &[u8] = if count_bytes <= 4 {
                &tiff[entry + 8..entry + 8 + count_bytes]
            } else {
                let off = tiff_read_u32(tiff, entry + 8, le)? as usize;
                tiff.get(off..off + count_bytes)?
            };
            ref_marker = Some(String::from_utf8_lossy(buf).trim_end_matches('\0').to_string());
        }
        if dms.is_some() && ref_marker.is_some() {
            break;
        }
    }
    Some((dms?, ref_marker.unwrap_or_default()))
}

fn tiff_read_rationals(tiff: &[u8], off: usize, le: bool, count: usize) -> Option<Vec<TiffRational>> {
    let mut out = Vec::with_capacity(count);
    for i in 0..count {
        let p = off + i * 8;
        if p + 8 > tiff.len() {
            return None;
        }
        let n = tiff_read_u32(tiff, p, le)?;
        let d = tiff_read_u32(tiff, p + 4, le)?;
        out.push(TiffRational { n, d });
    }
    Some(out)
}

/// Hand-rolled RATIONAL: 32-bit unsigned numerator / denominator.
#[derive(Clone, Copy)]
struct TiffRational {
    n: u32,
    d: u32,
}

impl TiffRational {
    fn to_f64(self) -> f64 {
        if self.d == 0 {
            0.0
        } else {
            (self.n as f64) / (self.d as f64)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_tiff_header_le() {
        let h = [b'I', b'I', 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00];
        let (le, off) = parse_tiff_header(&h).unwrap();
        assert!(le);
        assert_eq!(off, 8);
    }

    #[test]
    fn parse_tiff_header_be() {
        let h = [b'M', b'M', 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08];
        let (le, off) = parse_tiff_header(&h).unwrap();
        assert!(!le);
        assert_eq!(off, 8);
    }

    #[test]
    fn leap_year() {
        assert!(is_leap(2000));
        assert!(is_leap(2024));
        assert!(!is_leap(2023));
        assert!(!is_leap(1900));
    }

    #[test]
    fn dms_decimal() {
        // 40° 26' 46" N
        let dms = [
            TiffRational { n: 40, d: 1 },
            TiffRational { n: 26, d: 1 },
            TiffRational { n: 46, d: 1 },
        ];
        let mut decimal = dms[0].to_f64() + dms[1].to_f64() / 60.0 + dms[2].to_f64() / 3600.0;
        if "N".contains('S') || "N".contains('W') {
            decimal = -decimal;
        }
        assert!((decimal - 40.4461).abs() < 0.001);
    }
}
