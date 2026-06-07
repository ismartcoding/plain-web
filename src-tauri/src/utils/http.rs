/// CORS preflight headers. Same on the local server and the upstream
/// HTTP proxy — both surfaces serve the web UI, so the policy is
/// identical.
pub(crate) const CORS: &[u8] = b"access-control-allow-origin: *\r\n\
                       access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS\r\n\
                       access-control-allow-headers: *\r\n";
