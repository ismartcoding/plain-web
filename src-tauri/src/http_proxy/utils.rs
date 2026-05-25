// ─── CORS ─────────────────────────────────────────────────────────────────────

pub(crate) const CORS: &[u8] = b"access-control-allow-origin: *\r\n\
                       access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS\r\n\
                       access-control-allow-headers: *\r\n";

// ─── URL helpers ──────────────────────────────────────────────────────────────

/// Percent-decode a URL-encoded string.
pub(crate) fn url_decode(s: &str) -> String {
    let mut out = Vec::with_capacity(s.len());
    let src = s.as_bytes();
    let mut i = 0;
    while i < src.len() {
        if src[i] == b'%' && i + 2 < src.len() {
            let hi = (src[i + 1] as char).to_digit(16).unwrap_or(0) as u8;
            let lo = (src[i + 2] as char).to_digit(16).unwrap_or(0) as u8;
            out.push((hi << 4) | lo);
            i += 3;
        } else if src[i] == b'+' {
            out.push(b' ');
            i += 1;
        } else {
            out.push(src[i]);
            i += 1;
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Remove `_pt` from query string; return `(cleaned_path, decoded_pt_value)`.
pub(crate) fn extract_pt(path: &str) -> (String, String) {
    let (base, query) = match path.split_once('?') {
        Some((b, q)) => (b, q),
        None => return (path.to_owned(), String::new()),
    };
    let mut rest: Vec<&str> = Vec::new();
    let mut pt = String::new();
    for param in query.split('&') {
        if let Some(val) = param.strip_prefix("_pt=") {
            pt = url_decode(val);
        } else if !param.is_empty() {
            rest.push(param);
        }
    }
    let cleaned = if rest.is_empty() {
        base.to_owned()
    } else {
        format!("{}?{}", base, rest.join("&"))
    };
    (cleaned, pt)
}
