use std::collections::HashMap;

/// Percent-decode a string. Replaces every `+` with a space and every
/// `%XX` byte triplet with the matching raw byte. Invalid sequences
/// (truncated `%` or non-hex digits) are passed through verbatim.
///
/// Hand-rolled to avoid pulling in the `percent-encoding` crate just
/// for a few call sites in the local server and HTTP proxy.
pub(crate) fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b'%' if i + 2 < bytes.len() => {
                let hi = hex_nibble(bytes[i + 1]);
                let lo = hex_nibble(bytes[i + 2]);
                match (hi, lo) {
                    (Some(h), Some(l)) => {
                        out.push((h << 4) | l);
                        i += 3;
                    }
                    _ => {
                        out.push(bytes[i]);
                        i += 1;
                    }
                }
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn hex_nibble(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

/// Parse a `key=value&key=value` query string into a `HashMap`. Both
/// keys and values are percent-decoded (so `id=foo%20bar` becomes
/// `foo bar`, and `+` becomes a space).
pub(crate) fn parse_query(q: &str) -> HashMap<String, String> {
    let mut out = HashMap::new();
    for kv in q.split('&') {
        if kv.is_empty() {
            continue;
        }
        let (k, v) = match kv.split_once('=') {
            Some(pair) => pair,
            None => (kv, ""),
        };
        out.insert(percent_decode(k), percent_decode(v));
    }
    out
}

/// Look up a single query parameter from a path like `/foo?a=1&b=2`.
/// Returns the percent-decoded value, or `None` if the key is missing
/// or the path has no query string.
pub(crate) fn query_get(path: &str, key: &str) -> Option<String> {
    let (_, query) = path.split_once('?')?;
    parse_query(query).remove(key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn percent_decode_basic() {
        assert_eq!(percent_decode("hello%20world"), "hello world");
        assert_eq!(percent_decode("a+b"), "a b");
        assert_eq!(percent_decode("plain"), "plain");
    }

    #[test]
    fn percent_decode_case_insensitive_hex() {
        assert_eq!(percent_decode("%2F%2f"), "//");
    }

    #[test]
    fn percent_decode_invalid_passthrough() {
        assert_eq!(percent_decode("100%"), "100%");
        assert_eq!(percent_decode("%zz"), "%zz");
        assert_eq!(percent_decode("%2"), "%2");
    }

    #[test]
    fn percent_decode_non_ascii() {
        assert_eq!(percent_decode("caf%C3%A9"), "café");
    }

    #[test]
    fn parse_query_basic() {
        let p = parse_query("id=foo&dl=1");
        assert_eq!(p.get("id").map(String::as_str), Some("foo"));
        assert_eq!(p.get("dl").map(String::as_str), Some("1"));
    }

    #[test]
    fn parse_query_percent_encoded() {
        let p = parse_query("id=hello%20world&x=y%26z");
        assert_eq!(p.get("id").map(String::as_str), Some("hello world"));
        assert_eq!(p.get("x").map(String::as_str), Some("y&z"));
    }

    #[test]
    fn parse_query_handles_plus() {
        let p = parse_query("id=hello+world");
        assert_eq!(p.get("id").map(String::as_str), Some("hello world"));
    }

    #[test]
    fn parse_query_skips_empty_segments() {
        let p = parse_query("&&id=foo&&");
        assert_eq!(p.len(), 1);
        assert_eq!(p.get("id").map(String::as_str), Some("foo"));
    }

    #[test]
    fn parse_query_valueless_key() {
        let p = parse_query("flag");
        assert_eq!(p.get("flag").map(String::as_str), Some(""));
    }

    #[test]
    fn query_get_basic() {
        assert_eq!(query_get("/foo?a=1&b=2", "a").as_deref(), Some("1"));
        assert_eq!(query_get("/foo?a=1&b=2", "b").as_deref(), Some("2"));
    }

    #[test]
    fn query_get_decodes_value() {
        assert_eq!(query_get("/x?cid=abc%20def", "cid").as_deref(), Some("abc def"));
    }

    #[test]
    fn query_get_missing_key() {
        assert!(query_get("/x?a=1", "b").is_none());
    }

    #[test]
    fn query_get_no_query_string() {
        assert!(query_get("/x", "a").is_none());
    }
}
