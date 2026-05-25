use chacha20poly1305::{
    aead::{Aead, KeyInit},
    ChaCha20Poly1305, Nonce as ChaNonce,
    XChaCha20Poly1305, XNonce,
};

use crate::utils::base64::base64_decode;

// ── XChaCha20-Poly1305 (24-byte nonce) — local-server ↔ JS channel ───────────

/// Encrypt `plaintext` using XChaCha20-Poly1305 with the key derived from a base64 token.
/// Returns `nonce (24 bytes) || ciphertext` as raw bytes, or `None` if the token is invalid.
pub fn xchacha_encrypt(token_b64: &str, plaintext: &[u8]) -> Option<Vec<u8>> {
    let key_bytes = base64_decode(token_b64);
    let cipher = XChaCha20Poly1305::new_from_slice(&key_bytes).ok()?;
    let mut nonce_bytes = [0u8; 24];
    super::gen_random(&mut nonce_bytes);
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

// ── ChaCha20-Poly1305 (12-byte nonce) — peer-to-peer /peer_graphql ───────────
//
// Android `CryptoHelper.chaCha20Encrypt/Decrypt` uses standard ChaCha20-Poly1305
// with a 12-byte random nonce prepended to the ciphertext.

/// Encrypt `plaintext` with a 32-byte key (raw bytes) using ChaCha20-Poly1305.
/// Returns `nonce (12 bytes) || ciphertext` or `None` on failure.
pub fn chacha20_encrypt(key: &[u8], plaintext: &[u8]) -> Option<Vec<u8>> {
    let cipher = ChaCha20Poly1305::new_from_slice(key).ok()?;
    let mut nonce_bytes = [0u8; 12];
    super::gen_random(&mut nonce_bytes);
    let nonce = ChaNonce::from_slice(&nonce_bytes);
    let ciphertext = cipher.encrypt(nonce, plaintext).ok()?;
    let mut result = Vec::with_capacity(12 + ciphertext.len());
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);
    Some(result)
}

/// Decrypt `data` (nonce || ciphertext) with a 32-byte key using ChaCha20-Poly1305.
/// Returns plaintext or `None` on auth failure.
pub fn chacha20_decrypt(key: &[u8], data: &[u8]) -> Option<Vec<u8>> {
    if data.len() < 12 { return None; }
    let cipher = ChaCha20Poly1305::new_from_slice(key).ok()?;
    let nonce = ChaNonce::from_slice(&data[..12]);
    cipher.decrypt(nonce, &data[12..]).ok()
}
