//! IPC fetch command (bypasses WKWebView TLS validation).
//!
//! JS passes: raw request body as ArrayBuffer IPC body, plus IPC headers:
//!   x-url     — target URL
//!   x-method  — HTTP method
//!   x-headers — JSON-encoded extra request headers (Record<string,string>)
//!
//! Response: tauri::ipc::Response whose bytes are [status_hi, status_lo, ...body]
//! No base64 — bytes flow through the proxy untouched.
//!
//! A single HttpClient is shared across all requests (Tauri state) so that
//! TCP connections and TLS sessions are reused — this is critical for latency.
//! reqwest::Client is internally an Arc, so cloning is cheap.

use std::collections::HashMap;

pub struct HttpClient(pub reqwest::Client);

impl HttpClient {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .danger_accept_invalid_hostnames(true)
            .tcp_keepalive(std::time::Duration::from_secs(30))
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("reqwest client init failed");
        HttpClient(client)
    }
}

#[tauri::command]
pub async fn http_request(
    http: tauri::State<'_, HttpClient>,
    request: tauri::ipc::Request<'_>,
) -> Result<tauri::ipc::Response, String> {
    let hdrs = request.headers();
    let url = hdrs
        .get("x-url")
        .and_then(|v| v.to_str().ok())
        .ok_or("missing x-url header")?
        .to_string();
    let method: reqwest::Method = hdrs
        .get("x-method")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("POST")
        .parse()
        .map_err(|_| "invalid method")?;
    let extra_headers: HashMap<String, String> = hdrs
        .get("x-headers")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    let body = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.clone(),
        tauri::ipc::InvokeBody::Json(_) => vec![],
    };

    let mut builder = http.0.request(method, &url);
    for (k, v) in extra_headers {
        builder = builder.header(&k, &v);
    }
    if !body.is_empty() {
        builder = builder.body(body);
    }

    let resp = builder.send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let resp_bytes = resp.bytes().await.map_err(|e| e.to_string())?;

    // Prepend 2 bytes (big-endian u16) for the HTTP status code so JS can read it.
    let mut out = Vec::with_capacity(2 + resp_bytes.len());
    out.push((status >> 8) as u8);
    out.push((status & 0xff) as u8);
    out.extend_from_slice(&resp_bytes);
    Ok(tauri::ipc::Response::new(out))
}
