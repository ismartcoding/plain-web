# Tauri Proxy Strategy (Performance & Stability)

This document explains whether the current proxy architecture is the best choice for performance and stability in Tauri mode, and how port conflicts are handled.

## `http_client` vs `http_proxy` — 两者的区别

### `commands/http_client.rs` — Tauri IPC 主动请求

| 项目 | 说明 |
|---|---|
| **入口** | JS 代码主动调用 `invoke('http_request', …)` |
| **用途** | GraphQL、REST API 等程序性网络请求 |
| **传输** | Tauri IPC → Rust → device HTTPS → IPC 返回 JS |
| **响应体** | 全量缓冲后再返回给 JS |
| **超时** | 30 秒 |
| **CORS** | 不需要（IPC 不走浏览器安全模型） |
| **实现文件** | `src-tauri/src/commands/http_client.rs` |

### `http_proxy/mod.rs` — 本地 HTTP 代理服务器

| 项目 | 说明 |
|---|---|
| **入口** | 浏览器原生资源加载（`<img>`、`<video>`、`<audio>`、XHR 上传） |
| **用途** | 缩略图、视频/音频流、文件上传进度 |
| **传输** | 浏览器 HTTP → 本地回环 TCP `127.0.0.1:N` → Rust → device HTTPS |
| **响应体** | 逐 chunk 流式转发，**从不整体缓冲** |
| **超时** | 无（视频播放是长连接） |
| **CORS** | 自动注入 `access-control-allow-*` 头 |
| **实现文件** | `src-tauri/src/http_proxy/mod.rs` |

### 为什么 `http_client` 不能替代 `http_proxy`

1. **浏览器标签无法使用 IPC** — `<img src="…">` / `<video src="…">` 只认 URL，不会调用 `invoke()`。
2. **视频流无法缓冲** — 一段 500 MB 的视频如果等到全部缓冲后才播放，体验不可接受；`http_proxy` 的 chunk 流式转发让播放可以立即开始。
3. **Range 请求** — `<video>` 会发送 `Range: bytes=N-M` 做 seek；`http_proxy` 原样转发该头，`http_client` 无此机制。
4. **并发缩略图** — 浏览器原生并行发起多个 `<img>` 请求，`http_proxy` 的连接池（20 idle/host）复用 TLS session；通过 IPC 串行处理则显著更慢。
5. **上传进度** — XHR `progress` 事件依赖真实 HTTP 连接，IPC 无法触发浏览器原生进度回调。

**结论：两者互补，不可互换。** JS 代码主动发起的 API 调用走 `http_client`；浏览器标签/上传走 `http_proxy`。

### 能否全部走 `http_proxy`，性能差距多大？

技术上可行（JS 改用 `fetch('http://127.0.0.1:N/...')` 并附 `x-proxy-target` 头），但**没有实际意义**。

逐步骤延迟对比（每次请求）：

| 步骤 | `http_client` IPC | `http_proxy` 本地 TCP |
|---|---|---|
| JS → Rust | IPC 共享内存，~0.01 ms | TCP connect + HTTP 行解析，~0.2–0.5 ms |
| Rust → device | reqwest 连接池（两者相同） | reqwest 连接池（两者相同） |
| Device → Rust | 相同 | 相同 |
| Rust → JS | IPC 返回 | HTTP 响应序列化 + TCP write |

**最关键的限制：`connection: close`**

`http_proxy` 每个响应都发送 `connection: close`，浏览器不能复用 loopback TCP 连接。10 次 GraphQL 调用 = 10 次 TCP connect to `127.0.0.1`。`http_client` 则是 10 次 IPC，零 TCP 开销。

实际感知：设备 LAN RTT 通常 5–50 ms，本地多出 ~0.3 ms 约占 1–5%，**单次请求人眼察觉不到**。但实时聊天、密集轮询等场景下 TCP churn 会持续累积 CPU 和内存压力。

切换还需要额外成本：修改所有 JS 调用方从 `invoke` 改为 `fetch`、处理 2-byte status prefix 协议差异、修复 `connection: close` 问题。换来的只是路径统一，无性能收益。

**保持现有分工是最优解。**

---

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