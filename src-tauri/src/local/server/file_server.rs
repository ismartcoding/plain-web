use tokio::io::AsyncWrite;

use super::response::respond;

pub(super) async fn serve_file<W: AsyncWrite + Unpin>(
    wr: &mut W,
    query_str: &str,
    data_dir: &std::path::Path,
) {
    // Parse `id` query param from `id=abc123.jpg&...`
    let file_id = query_str
        .split('&')
        .find_map(|kv| kv.strip_prefix("id="))
        .unwrap_or_default();
    if file_id.is_empty() {
        respond(wr, 400, "Bad Request", b"missing id", "text/plain").await;
        return;
    }
    // Path layout: {data_dir}/files/{hash[0:2]}/{hash[2:4]}/{id}
    let hash = file_id.split('.').next().unwrap_or(file_id);
    if hash.len() < 4 {
        respond(wr, 400, "Bad Request", b"invalid id", "text/plain").await;
        return;
    }
    let file_path = data_dir
        .join("files")
        .join(&hash[..2])
        .join(&hash[2..4])
        .join(file_id);
    match tokio::fs::read(&file_path).await {
        Ok(data) => {
            let mime = mime_from_ext(file_id);
            respond(wr, 200, "OK", &data, mime).await;
        }
        Err(_) => respond(wr, 404, "Not Found", b"", "text/plain").await,
    }
}

fn mime_from_ext(filename: &str) -> &'static str {
    match filename
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "mp4" => "video/mp4",
        "mp3" => "audio/mpeg",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
}
