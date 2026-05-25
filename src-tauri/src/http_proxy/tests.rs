use super::utils::{extract_pt, url_decode};

#[test]
fn url_decode_plain() {
    assert_eq!(url_decode("hello"), "hello");
}
#[test]
fn url_decode_percent() {
    assert_eq!(url_decode("hello%20world"), "hello world");
}
#[test]
fn url_decode_plus() {
    assert_eq!(url_decode("hello+world"), "hello world");
}
#[test]
fn url_decode_full_url() {
    assert_eq!(
        url_decode("https%3A%2F%2F192.168.1.1%3A8443"),
        "https://192.168.1.1:8443"
    );
}
#[test]
fn url_decode_hex_upper() {
    assert_eq!(url_decode("%41%42%43"), "ABC");
}

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
