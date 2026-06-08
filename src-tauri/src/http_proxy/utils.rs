use crate::utils::query::percent_decode;

/// Remove `_pt` from query string; return `(cleaned_path, decoded_pt_value)`.
///
/// The other params are forwarded **verbatim** — no percent-decode. The
/// proxy hands the rebuilt path straight to reqwest, which re-encodes
/// the URL when it talks to the upstream device. Decoding here would
/// turn `+` into a space and corrupt opaque values such as the
/// base64-encrypted `id` parameter used by `/fs` (see
/// `lib/api/file.ts::getFileUrl` and `local/server/file_server.rs`).
///
/// Iteration order over the remaining params is preserved so the
/// returned path is byte-for-byte stable when `_pt` is absent.
pub(crate) fn extract_pt(path: &str) -> (String, String) {
    let (base, query) = match path.split_once('?') {
        Some((b, q)) => (b, q),
        None => return (path.to_owned(), String::new()),
    };
    let mut rest: Vec<&str> = Vec::new();
    let mut pt = String::new();
    for param in query.split('&') {
        if param.is_empty() {
            continue;
        }
        if let Some(val) = param.strip_prefix("_pt=") {
            pt = percent_decode(val);
        } else {
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
