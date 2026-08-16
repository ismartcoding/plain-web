use tokio::io::{AsyncWrite, AsyncWriteExt};

use plain_rs::http::CORS;

pub(super) const APP_ID: &str = "com.ismartcoding.plain.desktop";

/// Public to the crate so sibling modules (e.g. `peer_graphql`) can write
/// HTTP responses without duplicating the framing logic.
pub(crate) async fn respond<W: AsyncWrite + Unpin>(
    wr: &mut W,
    status: u16,
    reason: &str,
    body: &[u8],
    content_type: &str,
) {
    let head = format!(
        "HTTP/1.1 {status} {reason}\r\ncontent-type: {content_type}\r\ncontent-length: {}\r\nconnection: close\r\n",
        body.len()
    );
    let _ = wr.write_all(head.as_bytes()).await;
    let _ = wr.write_all(CORS).await;
    let _ = wr.write_all(b"\r\n").await;
    let _ = wr.write_all(body).await;
}
