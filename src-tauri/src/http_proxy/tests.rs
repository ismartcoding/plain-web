use super::utils::extract_pt;

#[test]
fn extract_pt_no_query() {
    let (p, pt) = extract_pt("/fs");
    assert_eq!(p, "/fs");
    assert_eq!(pt, "");
}

#[test]
fn extract_pt_only_pt() {
    let (p, pt) = extract_pt("/fs?_pt=https%3A%2F%2F192.168.1.1%3A8443");
    assert_eq!(p, "/fs");
    assert_eq!(pt, "https://192.168.1.1:8443");
}

#[test]
fn extract_pt_pt_with_other_params() {
    let (p, pt) = extract_pt("/fs?id=abc&_pt=https%3A%2F%2F192.168.1.1%3A8443&w=50");
    assert_eq!(p, "/fs?id=abc&w=50");
    assert_eq!(pt, "https://192.168.1.1:8443");
}

#[test]
fn extract_pt_no_pt_param() {
    let (p, pt) = extract_pt("/fs?id=abc&w=50");
    assert_eq!(p, "/fs?id=abc&w=50");
    assert_eq!(pt, "");
}

#[test]
fn extract_pt_pt_first() {
    let (p, pt) = extract_pt("/fs?_pt=https%3A%2F%2F10.0.0.1%3A443&id=xyz");
    assert_eq!(p, "/fs?id=xyz");
    assert_eq!(pt, "https://10.0.0.1:443");
}

#[test]
fn extract_pt_pt_middle() {
    let (p, pt) = extract_pt("/fs?id=abc&_pt=https%3A%2F%2F10.0.0.1%3A443&w=50");
    assert_eq!(p, "/fs?id=abc&w=50");
    assert_eq!(pt, "https://10.0.0.1:443");
}

#[test]
fn extract_pt_pt_last() {
    let (p, pt) = extract_pt("/fs?id=abc&w=50&_pt=https%3A%2F%2F10.0.0.1%3A443");
    assert_eq!(p, "/fs?id=abc&w=50");
    assert_eq!(pt, "https://10.0.0.1:443");
}

#[test]
fn extract_pt_preserves_empty_segments() {
    // Empty segments (consecutive `&`) are skipped on re-join, matching
    // the standard `parse_query` semantics used elsewhere in the server.
    let (p, pt) = extract_pt("/fs?&&id=abc&&&_pt=x&&");
    assert_eq!(p, "/fs?id=abc");
    assert_eq!(pt, "x");
}

#[test]
fn extract_pt_preserves_base64_plus_and_slash_and_equals() {
    // The `id` is base64-encrypted ciphertext from `bitArrayToBase64`.
    // encodeURIComponent on the frontend turns `+` -> `%2B`, `/` -> `%2F`,
    // `=` -> `%3D`. The proxy must pass these percent-triplets through
    // untouched; decoding here would turn `%2B` into a space and break
    // base64 decoding on the device side, surfacing as a 403.
    let raw = "/fs?id=abc%2Bdef%2Fghi%3D%3D&w=512&h=512&_pt=https%3A%2F%2F192.168.123.23%3A8643";
    let (p, pt) = extract_pt(raw);
    assert_eq!(p, "/fs?id=abc%2Bdef%2Fghi%3D%3D&w=512&h=512");
    assert_eq!(pt, "https://192.168.123.23:8643");
}

#[test]
fn extract_pt_preserves_plain_plus_in_id() {
    // If a caller ever sends an *unencoded* `+` in `id` (defensive case),
    // the proxy must not turn it into a space either.
    let (p, pt) = extract_pt("/fs?id=abc+def&_pt=x");
    assert_eq!(p, "/fs?id=abc+def");
    assert_eq!(pt, "x");
}

#[test]
fn extract_pt_preserves_percent_triplets_in_values() {
    let (p, pt) = extract_pt("/fs?id=hello%20world%26more&_pt=x");
    assert_eq!(p, "/fs?id=hello%20world%26more");
    assert_eq!(pt, "x");
}

#[test]
fn extract_pt_valueless_param_kept_verbatim() {
    let (p, pt) = extract_pt("/fs?flag&_pt=x");
    assert_eq!(p, "/fs?flag");
    assert_eq!(pt, "x");
}
