//! Hand-rolled image dimension parsing from raw bytes.
//!
//! Extracted from `graphql/schema/file_query.rs` so both the local
//! `fileInfo` resolver and async link-preview generation can share one
//! parser (mirrors plain-app's `platform/getImageDimensions`). We
//! detect the format by magic bytes and return `(width, height)` for
//! JPEG / PNG / GIF / BMP / WebP / ICO. Anything undecodable yields `None`.

/// Returns `(width, height)` for the image in `bytes`, or `None` when
/// `bytes` is not one of the supported formats.
pub fn dimensions(bytes: &[u8]) -> Option<(i32, i32)> {
    if bytes.len() >= 2 && bytes[0] == 0xFF && bytes[1] == 0xD8 {
        return jpeg(bytes);
    }
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return png(bytes);
    }
    if bytes.len() >= 6 && (&bytes[..6] == b"GIF87a" || &bytes[..6] == b"GIF89a") {
        return gif(bytes);
    }
    if bytes.starts_with(b"BM") {
        return bmp(bytes);
    }
    if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return webp(bytes);
    }
    // ICO/CUR container: reserved(0,0) + type(1=icon) + image count (>0).
    if bytes.len() >= 8 && bytes[0] == 0 && bytes[1] == 0 && bytes[2] == 1 {
        return ico(bytes);
    }
    None
}

/// JPEG dimensions from the first SOF marker. Returns `None` when no
/// SOF marker is found before SOS / EOI.
fn jpeg(b: &[u8]) -> Option<(i32, i32)> {
    let mut i = 2usize;
    while i + 1 < b.len() {
        if b[i] != 0xFF {
            i += 1;
            continue;
        }
        // Markers can be repeated (0xFF 0xFF) — skip padding fills.
        while i < b.len() && b[i] == 0xFF {
            i += 1;
        }
        if i >= b.len() {
            return None;
        }
        let m = b[i];
        i += 1;
        // SOF markers (Start Of Frame), except 0xC4 (DHT) and 0xC8 (JPG).
        if (0xC0..=0xCF).contains(&m) && m != 0xC4 && m != 0xC8 {
            if i + 7 > b.len() {
                return None;
            }
            // Precision (1) + height (2) + width (2) follow the segment length.
            let h = u16::from_be_bytes([b[i + 3], b[i + 4]]) as i32;
            let w = u16::from_be_bytes([b[i + 5], b[i + 6]]) as i32;
            return Some((w, h));
        }
        // SOS (0xDA) or EOI (0xD9) — no more dimension markers ahead.
        if m == 0xDA || m == 0xD9 {
            return None;
        }
        if i + 2 > b.len() {
            return None;
        }
        let seg = u16::from_be_bytes([b[i], b[i + 1]]) as usize;
        if seg < 2 {
            return None;
        }
        i += 2 + (seg - 2);
    }
    None
}

/// PNG dimensions from the IHDR chunk.
fn png(b: &[u8]) -> Option<(i32, i32)> {
    if b.len() < 24 {
        return None;
    }
    if &b[12..16] != b"IHDR" {
        return None;
    }
    let w = u32::from_be_bytes(b[16..20].try_into().ok()?) as i32;
    let h = u32::from_be_bytes(b[20..24].try_into().ok()?) as i32;
    Some((w, h))
}

/// GIF dimensions (logical screen descriptor width/height).
fn gif(b: &[u8]) -> Option<(i32, i32)> {
    if b.len() < 10 {
        return None;
    }
    let w = u16::from_le_bytes([b[6], b[7]]) as i32;
    let h = u16::from_le_bytes([b[8], b[9]]) as i32;
    Some((w, h))
}

/// BMP dimensions (width / height at the DIB header offsets 18 / 22).
fn bmp(b: &[u8]) -> Option<(i32, i32)> {
    if b.len() < 26 {
        return None;
    }
    let w = i32::from_le_bytes(b[18..22].try_into().ok()?);
    let h = i32::from_le_bytes(b[22..26].try_into().ok()?);
    Some((w.abs(), h.abs()))
}

/// WebP dimensions across the three chunk types (`VP8 `, `VP8L`, `VP8X`).
fn webp(b: &[u8]) -> Option<(i32, i32)> {
    if b.len() < 16 {
        return None;
    }
    match &b[12..16] {
        b"VP8 " => {
            if b.len() < 30 {
                return None;
            }
            // Frame tag + start code (10 bytes), scale (3), width + height (4).
            let i = 16 + 10;
            let w = u16::from_le_bytes([b[i], b[i + 1]]) as i32 & 0x3FFF;
            let h = u16::from_le_bytes([b[i + 2], b[i + 3]]) as i32 & 0x3FFF;
            Some((w, h))
        }
        b"VP8L" => {
            if b.len() < 21 {
                return None;
            }
            let i = 16 + 1;
            let d = &b[i..i + 4];
            let w = 1 + (((d[1] & 0x3F) as i32) << 8 | d[0] as i32);
            let h = 1 + ((((d[3] & 0x0F) as i32) << 10) | ((d[2] as i32) << 2) | ((d[1] & 0xC0) as i32) >> 6);
            Some((w, h))
        }
        b"VP8X" => {
            if b.len() < 30 {
                return None;
            }
            let i = 16 + 8;
            let d = &b[i..i + 6];
            let w = (d[0] as i32) | ((d[1] as i32) << 8) | ((d[2] as i32) << 16) + 1;
            let h = (d[3] as i32) | ((d[4] as i32) << 8) | ((d[5] as i32) << 16) + 1;
            Some((w, h))
        }
        _ => None,
    }
}

/// ICO dimensions from the first `ICONDIRENTRY` (`0` encodes 256).
/// Matches Android's `BitmapFactory` result for `.ico` favicons.
fn ico(b: &[u8]) -> Option<(i32, i32)> {
    let count = u16::from_le_bytes([b[4], b[5]]);
    if count == 0 {
        return None;
    }
    // First entry starts at offset 6; width / height are its first two bytes.
    let w = b[6] as i32;
    let h = b[7] as i32;
    Some((if w == 0 { 256 } else { w }, if h == 0 { 256 } else { h }))
}

#[cfg(test)]
mod tests {
    use super::dimensions;

    #[test]
    fn ico_dimensions_parse() {
        // ICONDIR: reserved(0,0) | type(1) | count(2) | first entry w/h.
        let mut b = Vec::new();
        b.extend_from_slice(&[0x00, 0x00, 0x01, 0x00, 0x03, 0x00]); // header, 3 images
        b.extend_from_slice(&[0x10, 0x10]); // first entry: w=16, h=16
        assert_eq!(dimensions(&b), Some((16, 16)));
    }

    #[test]
    fn ico_zero_width_means_256() {
        let mut b = Vec::new();
        b.extend_from_slice(&[0x00, 0x00, 0x01, 0x00, 0x01, 0x00]);
        b.extend_from_slice(&[0x00, 0x00]); // 0 => 256
        assert_eq!(dimensions(&b), Some((256, 256)));
    }

    #[test]
    fn png_dimensions_parse() {
        let mut b = Vec::new();
        b.extend_from_slice(b"\x89PNG\r\n\x1a\n");
        b.extend_from_slice(&[0x00, 0x00, 0x00, 0x0D]); // IHDR length
        b.extend_from_slice(b"IHDR");
        b.extend_from_slice(&[0x00, 0x00, 0x01, 0x00]); // width = 256
        b.extend_from_slice(&[0x00, 0x00, 0x00, 0x40]); // height = 64
        assert_eq!(dimensions(&b), Some((256, 64)));
    }

    #[test]
    fn jpeg_dimensions_parse() {
        // FF D8 | FF C0 | seg(2) | precis(1) | h(2) | w(2)
        let b = [0xFF, 0xD8, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x20, 0x01, 0x00];
        assert_eq!(dimensions(&b), Some((256, 32)));
    }

    #[test]
    fn gif_dimensions_parse() {
        let mut b = Vec::new();
        b.extend_from_slice(b"GIF89a");
        b.extend_from_slice(&[0xFF, 0x00, 0x40, 0x00]); // w=255, h=64 (LE)
        assert_eq!(dimensions(&b), Some((255, 64)));
    }

    #[test]
    fn bmp_dimensions_parse() {
        let mut b = Vec::new();
        b.extend_from_slice(b"BM");
        b.resize(18, 0);
        b.extend_from_slice(&[0x00, 0x02, 0x00, 0x00]); // width = 512 (LE)
        b.extend_from_slice(&[0x64, 0x00, 0x00, 0x00]); // height = 100 (LE)
        assert_eq!(dimensions(&b), Some((512, 100)));
    }

    #[test]
    fn webp_vp8l_dimensions_parse() {
        // RIFF | size | WEBP | VP8L | signature | packed dims (zeros => 1x1)
        let mut b = Vec::new();
        b.extend_from_slice(b"RIFF");
        b.extend_from_slice(&[0, 0, 0, 0]);
        b.extend_from_slice(b"WEBP");
        b.extend_from_slice(b"VP8L");
        b.extend_from_slice(&[0x2F, 0x00, 0x00, 0x00, 0x00]);
        assert_eq!(dimensions(&b), Some((1, 1)));
    }

    #[test]
    fn unknown_format_is_none() {
        assert_eq!(dimensions(b"not an image at all"), None);
        assert_eq!(dimensions(&[]), None);
    }
}