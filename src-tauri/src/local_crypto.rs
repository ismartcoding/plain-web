use chacha20poly1305::{
    aead::{Aead, KeyInit},
    XChaCha20Poly1305, XNonce,
};
use std::io::Read;

fn gen_random(buf: &mut [u8]) {
    #[cfg(unix)]
    if let Ok(mut f) = std::fs::File::open("/dev/urandom") {
        let _ = f.read_exact(buf);
    }
    // On non-unix platforms buf stays zero — acceptable for a localhost-only token.
}

/// Generate a random 32-byte token encoded as standard base64.
pub fn gen_token() -> String {
    let mut bytes = [0u8; 32];
    gen_random(&mut bytes);
    base64_encode(&bytes)
}

/// Encrypt `plaintext` using XChaCha20-Poly1305 with the key derived from a base64 token.
/// Returns `nonce (24 bytes) || ciphertext` as raw bytes, or `None` if the token is invalid.
pub fn xchacha_encrypt(token_b64: &str, plaintext: &[u8]) -> Option<Vec<u8>> {
    let key_bytes = base64_decode(token_b64);
    let cipher = XChaCha20Poly1305::new_from_slice(&key_bytes).ok()?;
    let mut nonce_bytes = [0u8; 24];
    gen_random(&mut nonce_bytes);
    let nonce = XNonce::from_slice(&nonce_bytes);
    let ciphertext = cipher.encrypt(nonce, plaintext).ok()?;
    let mut result = Vec::with_capacity(24 + ciphertext.len());
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);
    Some(result)
}

/// Decrypt `data` (nonce || ciphertext) using XChaCha20-Poly1305.
/// Returns the plaintext bytes or `None` on auth failure / bad token.
pub fn xchacha_decrypt(token_b64: &str, data: &[u8]) -> Option<Vec<u8>> {
    if data.len() < 24 {
        return None;
    }
    let key_bytes = base64_decode(token_b64);
    let cipher = XChaCha20Poly1305::new_from_slice(&key_bytes).ok()?;
    let nonce = XNonce::from_slice(&data[..24]);
    cipher.decrypt(nonce, &data[24..]).ok()
}

/// Standard base64 encoder (RFC 4648, with `+` and `/`, padded with `=`).
pub fn base64_encode(bytes: &[u8]) -> String {
    const T: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 { chunk[1] as usize } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as usize } else { 0 };
        out.push(T[b0 >> 2] as char);
        out.push(T[((b0 & 3) << 4) | (b1 >> 4)] as char);
        out.push(if chunk.len() > 1 { T[((b1 & 0xf) << 2) | (b2 >> 6)] as char } else { '=' });
        out.push(if chunk.len() > 2 { T[b2 & 0x3f] as char } else { '=' });
    }
    out
}

/// Standard base64 decoder. Ignores `=` padding; returns an empty Vec on empty input.
pub fn base64_decode(s: &str) -> Vec<u8> {
    let val = |c: u8| -> u8 {
        match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => 0,
        }
    };
    let cleaned: Vec<u8> = s.bytes().filter(|&c| c != b'=').collect();
    let mut out = Vec::with_capacity(cleaned.len() * 3 / 4 + 1);
    for chunk in cleaned.chunks(4) {
        let v0 = val(chunk[0]);
        let v1 = if chunk.len() > 1 { val(chunk[1]) } else { 0 };
        let v2 = if chunk.len() > 2 { val(chunk[2]) } else { 0 };
        let v3 = if chunk.len() > 3 { val(chunk[3]) } else { 0 };
        out.push((v0 << 2) | (v1 >> 4));
        if chunk.len() > 2 { out.push(((v1 & 0xf) << 4) | (v2 >> 2)); }
        if chunk.len() > 3 { out.push(((v2 & 3) << 6) | v3); }
    }
    out
}
