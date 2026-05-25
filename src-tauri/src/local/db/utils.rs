// ---------------------------------------------------------------------------
// Time helpers (no chrono — std only)
// ---------------------------------------------------------------------------

pub fn now_iso() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    unix_secs_to_iso8601(secs)
}

fn is_leap(y: u64) -> bool {
    y % 4 == 0 && (y % 100 != 0 || y % 400 == 0)
}

fn unix_secs_to_iso8601(secs: u64) -> String {
    let ss = secs % 60;
    let t = secs / 60;
    let mm = t % 60;
    let t = t / 60;
    let hh = t % 24;
    let mut days = t / 24;
    let mut year = 1970u64;
    loop {
        let dy = if is_leap(year) { 366u64 } else { 365u64 };
        if days < dy {
            break;
        }
        days -= dy;
        year += 1;
    }
    let md: [u64; 12] = if is_leap(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut month = 1u64;
    for &dm in md.iter() {
        if days < dm {
            break;
        }
        days -= dm;
        month += 1;
    }
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, days + 1, hh, mm, ss
    )
}

// ---------------------------------------------------------------------------
// ID generation (8 random bytes from /dev/urandom, hex-encoded)
// ---------------------------------------------------------------------------

pub fn short_id() -> String {
    use std::io::Read;
    let mut buf = [0u8; 8];
    if let Ok(mut f) = std::fs::File::open("/dev/urandom") {
        let _ = f.read_exact(&mut buf);
    }
    buf.iter().map(|b| format!("{b:02x}")).collect()
}
