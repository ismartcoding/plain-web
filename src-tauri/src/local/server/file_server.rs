use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWrite, AsyncWriteExt};

use super::super::graphql::context::AppCtx;
use super::response::respond;
use super::uri::{parse_decrypted_id, resolve_uri};
use crate::crypto::xchacha_decrypt;
use crate::utils::base64::base64_decode;
use crate::utils::mime::mime_from_ext;
use crate::utils::query::parse_query;

/// Serve a file via the local server's `/fs` endpoint.
///
/// Mirrors `plain-app` `web/routes/Files.kt::addFiles().get("/fs")`:
///   1. URL-decode the `id` query param.
///   2. Base64-decode + XChaCha20-decrypt with the local server's URL
///      token (this is how the web client delivers the path — see
///      `getFileId` in `lib/api/file.ts`).
///   3. Parse the decrypted payload: either a JSON object
///      `{"path":"…","mediaId":"…","name":"…"}` or a plain URI string
///      such as `fid:{sha256}.{ext}` / `app://…` / absolute path.
///   4. Resolve to a real on-disk path. For `fid:` the resolution is
///      `{data_dir}/files/{aa}/{bb}/{hash}.{ext}` — matches what
///      `app_file_store::import_file` writes.
///   5. Stream the file body (don't buffer the whole file in memory).
pub(super) async fn serve_file<W: AsyncWrite + Unpin>(
    wr: &mut W,
    query_str: &str,
    ctx: &Arc<AppCtx>,
) {
    // 1. Parse query params.
    let params = parse_query(query_str);
    let id_encoded = match params.get("id") {
        Some(s) if !s.is_empty() => s.clone(),
        _ => {
            respond(wr, 400, "Bad Request", b"missing id", "text/plain").await;
            return;
        }
    };

    // 2. Decrypt the id.
    let id_bytes = base64_decode(&id_encoded);
    let Some(plaintext) = xchacha_decrypt(&ctx.token, &id_bytes) else {
        respond(wr, 401, "Unauthorized", b"", "text/plain").await;
        return;
    };
    let plaintext = match std::str::from_utf8(&plaintext) {
        Ok(s) => s.to_string(),
        Err(_) => {
            respond(
                &mut *wr,
                400,
                "Bad Request",
                b"decrypted id is not valid utf-8",
                "text/plain",
            )
            .await;
            return;
        }
    };

    // 3. Parse the decrypted payload.
    let (path, json_name) = parse_decrypted_id(&plaintext);

    // 4. Resolve to a real path.
    let resolved = resolve_uri(&path, &ctx.data_dir);

    // 5. Sanity-check the file is on disk and is a file.
    let metadata = match tokio::fs::metadata(&resolved).await {
        Ok(m) => m,
        Err(_) => {
            respond(wr, 404, "Not Found", b"", "text/plain").await;
            return;
        }
    };
    if !metadata.is_file() {
        respond(wr, 400, "Bad Request", b"not a file", "text/plain").await;
        return;
    }

    // 6. Decide display filename + MIME + Content-Disposition.
    let display_name = if !json_name.is_empty() {
        json_name
    } else {
        resolved
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("file")
            .to_string()
    };
    let mime = mime_from_ext(&display_name);
    let is_download = params.get("dl").map(|s| s.as_str()) == Some("1");

    // 7. Stream the response. We bypass `respond()` so the body can be
    //    streamed in 64 KB chunks instead of buffered.
    let disposition = if is_download {
        format!("attachment; filename=\"{}\"", display_name)
    } else {
        format!("inline; filename=\"{}\"", display_name)
    };
    let file_size = metadata.len();
    let head = format!(
        "HTTP/1.1 200 OK\r\n\
         content-type: {mime}\r\n\
         content-length: {file_size}\r\n\
         content-disposition: {disposition}\r\n\
         access-control-expose-headers: content-disposition\r\n\
         access-control-allow-origin: *\r\n\
         access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS\r\n\
         access-control-allow-headers: *\r\n\
         connection: close\r\n\
         \r\n"
    );
    if wr.write_all(head.as_bytes()).await.is_err() {
        return;
    }

    let mut file = match tokio::fs::File::open(&resolved).await {
        Ok(f) => f,
        Err(_) => return, // headers already sent
    };
    let mut buf = vec![0u8; 64 * 1024];
    loop {
        let n = match file.read(&mut buf).await {
            Ok(0) => break,
            Ok(n) => n,
            Err(_) => break,
        };
        if wr.write_all(&buf[..n]).await.is_err() {
            break;
        }
    }
    let _ = wr.flush().await;
}
