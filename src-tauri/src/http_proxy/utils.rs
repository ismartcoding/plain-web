use crate::utils::query::percent_decode;

/// Remove `_pt` from query string; return `(cleaned_path, decoded_pt_value)`.
///
/// Iteration order over the remaining params is preserved so the
/// returned path is byte-for-byte stable when `_pt` is absent.
pub(crate) fn extract_pt(path: &str) -> (String, String) {
    let (base, query) = match path.split_once('?') {
        Some((b, q)) => (b, q),
        None => return (path.to_owned(), String::new()),
    };
    let mut rest: Vec<String> = Vec::new();
    let mut pt = String::new();
    for param in query.split('&') {
        if param.is_empty() {
            continue;
        }
        if let Some(val) = param.strip_prefix("_pt=") {
            pt = percent_decode(val);
        } else if let Some((k, v)) = param.split_once('=') {
            rest.push(format!("{}={}", percent_decode(k), percent_decode(v)));
        } else {
            rest.push(percent_decode(param));
        }
    }
    let cleaned = if rest.is_empty() {
        base.to_owned()
    } else {
        format!("{}?{}", base, rest.join("&"))
    };
    (cleaned, pt)
}
