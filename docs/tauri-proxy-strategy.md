# Tauri Proxy Strategy (Performance & Stability)

This document explains whether the current proxy architecture is the best choice for performance and stability in Tauri mode, and how port conflicts are handled.

## Design Principle

**Proxy classes have single responsibility — they always proxy, unconditionally.**
The decision of whether to use a proxy is made at the call site, not inside the proxy.

```
// Call site pattern — scheme check lives here:
(__IS_TAURI__ && url.startsWith('https://')) ? tauriFetch(url, opts) : fetch(url, opts)
(__IS_TAURI__ && wsUrl.startsWith('wss://')) ? new TauriWebSocket(wsUrl) : new WebSocket(wsUrl)
```

`tauriFetch` and `TauriWebSocket` do not inspect the URL scheme.
`getUploadBaseUrl` always returns the proxy address in Tauri mode; callers
(`getUploadUrl` / `getUploadChunkUrl`) decide whether to use it based on `getApiBaseUrl()`.

## Why This Is Fastest

### GraphQL / small API (`tauriFetch`)

- Payloads are usually small JSON.
- IPC overhead is tiny for small messages.
- Shared `reqwest::Client` reuses TCP/TLS sessions; no repeated full handshake cost.
- A local HTTP parser/proxy layer would not improve this path and can be slower.

Conclusion: keep GraphQL and general small API calls on `tauriFetch`.

### WebSocket (local WS proxy)

- Old IPC-event WS bridge incurred per-frame serialization and scheduling overhead.
- New model keeps frame transport on normal loopback TCP WebSocket after initial setup.
- Binary/event throughput and latency are better and steadier under sustained traffic.

Conclusion: local WS proxy is the correct high-performance path.

### Upload (local HTTP proxy)

- Upload requires streaming semantics and browser `XMLHttpRequest` progress events.
- IPC request mode is not suitable for progress-driven large uploads.
- Local HTTP proxy keeps normal XHR flow while bypassing self-signed TLS limitations in WKWebView.

Conclusion: upload must use local HTTP proxy for both functionality and stable throughput.

## Stability Notes

### Connection reuse

- All forwarded HTTPS requests use a shared `reqwest::Client`.
- This enables connection pooling and TLS session reuse.

### Failure isolation

- WS proxy is per-connection: each WebSocket session gets its own local listener/task.
- HTTP proxy is long-lived and accepts many concurrent requests.

### Self-signed certificates

- Rust side handles device TLS with `danger_accept_invalid_certs(true)`.
- WebView never talks directly to device TLS endpoints for WS/upload critical paths.

## Port Conflict Risk

Current implementation binds local listeners with `127.0.0.1:0` (ephemeral port).

- OS chooses a free port at bind time.
- This avoids hardcoded-port collisions.
- Conflict probability is extremely low.

Practical behavior:

- HTTP proxy: binds once at startup and keeps the socket open.
- WS proxy: binds per session, returns that live bound port immediately to JS.

Because the socket is already bound before the port is exposed, another process cannot steal that exact port in between.

## Operational Guidance

- Do not force fixed localhost ports for proxy services.
- Keep `ws_start_proxy` and `http_proxy_port` dynamic.
- Keep upload traffic on local HTTP proxy in Tauri mode.
- Keep GraphQL/small API on `tauriFetch` unless profiling proves a regression.

## Scope

These conclusions apply to Tauri desktop mode in this repository and the current architecture.