use tokio::io::{AsyncWrite, AsyncWriteExt};

pub(super) const APP_ID: &str = "com.ismartcoding.plainapp";

pub(super) const CORS: &[u8] = b"access-control-allow-origin: *\r\n\
                       access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS\r\n\
                       access-control-allow-headers: *\r\n";

pub(super) async fn respond<W: AsyncWrite + Unpin>(
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
