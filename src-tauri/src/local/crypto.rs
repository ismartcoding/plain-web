use chacha20poly1305::{
    aead::{Aead, KeyInit},
    ChaCha20Poly1305, Nonce as ChaNonce,
    XChaCha20Poly1305, XNonce,
};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use p256::{
    ecdh::EphemeralSecret,
    pkcs8::{DecodePublicKey, EncodePublicKey},
    PublicKey as P256PublicKey,
};
use rand::rngs::OsRng;
use sha2::{Digest, Sha256};
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

// ── Android-compatible ChaCha20Poly1305 (12-byte nonce) ───────────────────────
//
// Android `CryptoHelper.chaCha20Encrypt/Decrypt` uses standard ChaCha20-Poly1305
// with a 12-byte random nonce prepended to the ciphertext.
// This is used for peer-to-peer `/peer_graphql` payloads.
// The local-server ↔ JS channel continues to use XChaCha20 (24-byte nonce).

/// Encrypt `plaintext` with a 32-byte key (raw bytes) using ChaCha20-Poly1305.
/// Returns `nonce (12 bytes) || ciphertext` or `None` on failure.
pub fn chacha20_encrypt(key: &[u8], plaintext: &[u8]) -> Option<Vec<u8>> {
    let cipher = ChaCha20Poly1305::new_from_slice(key).ok()?;
    let mut nonce_bytes = [0u8; 12];
    gen_random(&mut nonce_bytes);
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

// ── ECDH P-256 ───────────────────────────────────────────────────────────────
//
// Matches Android `CryptoHelper.generateECDHKeyPair()` (secp256r1),
// `getPublicKeyBytes()` (`keyPair.public.encoded`, X.509/SPKI DER), and
// `computeECDHSharedKey()` (SHA-256 of the raw shared secret).

/// ECDH session — holds the ephemeral secret until shared key is computed.
pub struct EcdhSession {
    secret: EphemeralSecret,
    /// X.509 SubjectPublicKeyInfo DER public key bytes for transmitting to peer.
    pub public_key_bytes: Vec<u8>,
}

impl EcdhSession {
    /// Generate a new ephemeral P-256 ECDH key pair.
    pub fn generate() -> Self {
        let secret = EphemeralSecret::random(&mut OsRng);
        let public_key = P256PublicKey::from(&secret);
        let public_key_bytes = public_key.to_public_key_der()
            .map(|der| der.as_bytes().to_vec())
            .unwrap_or_default();
        EcdhSession { secret, public_key_bytes }
    }

    /// Compute SHA-256(ECDH raw shared secret) from the peer's X.509/SPKI DER public key bytes.
    /// Returns `None` if the peer public key is malformed.
    pub fn compute_shared_key(self, peer_pub_bytes: &[u8]) -> Option<[u8; 32]> {
        let peer_pub = P256PublicKey::from_public_key_der(peer_pub_bytes).ok()?;
        let shared = self.secret.diffie_hellman(&peer_pub);
        let digest = Sha256::digest(shared.raw_secret_bytes());
        let mut out = [0u8; 32];
        out.copy_from_slice(&digest);
        Some(out)
    }
}

// ── Ed25519 signing ───────────────────────────────────────────────────────────
//
// Android uses Google Tink `Ed25519Verify` with raw 32-byte public keys.
// ed25519-dalek `VerifyingKey` also stores 32 raw bytes.

/// Generate a new Ed25519 signing key.  Returns (signing_key_64_bytes, verifying_key_32_bytes).
pub fn ed25519_generate() -> ([u8; 64], [u8; 32]) {
    let signing_key = SigningKey::generate(&mut OsRng);
    let verifying_key = signing_key.verifying_key();
    let sk_bytes = signing_key.to_keypair_bytes();
    let vk_bytes = verifying_key.to_bytes();
    (sk_bytes, vk_bytes)
}

/// Sign `message` with the 64-byte Ed25519 keypair bytes.  Returns Base64 signature or empty string on error.
pub fn ed25519_sign(keypair_bytes: &[u8], message: &[u8]) -> String {
    if keypair_bytes.len() != 64 { return String::new(); }
    let mut arr = [0u8; 64];
    arr.copy_from_slice(keypair_bytes);
    let signing_key = match SigningKey::from_keypair_bytes(&arr) {
        Ok(k) => k,
        Err(_) => return String::new(),
    };
    let sig: Signature = signing_key.sign(message);
    base64_encode(sig.to_bytes().as_ref())
}

/// Verify `signature_b64` against `message` using the raw 32-byte `public_key_b64`.
pub fn ed25519_verify(public_key_b64: &str, message: &[u8], signature_b64: &str) -> bool {
    let pk_bytes = base64_decode(public_key_b64);
    let sig_bytes = base64_decode(signature_b64);
    if pk_bytes.len() != 32 || sig_bytes.len() != 64 { return false; }
    let mut pk_arr = [0u8; 32];
    pk_arr.copy_from_slice(&pk_bytes);
    let mut sig_arr = [0u8; 64];
    sig_arr.copy_from_slice(&sig_bytes);
    let vk = match VerifyingKey::from_bytes(&pk_arr) {
        Ok(k) => k,
        Err(_) => return false,
    };
    let sig = Signature::from_bytes(&sig_arr);
    vk.verify(message, &sig).is_ok()
}

// ── Device identity bootstrap ─────────────────────────────────────────────────

use super::db::{ChatDb, DDeviceIdentity};

/// Ensure device identity exists in `db`.  Creates it on first call using a
/// UUID v4 client-id and a fresh Ed25519 key pair.  Returns the identity.
pub fn ensure_identity(db: &ChatDb) -> DDeviceIdentity {
    if let Some(id) = db.get_identity() {
        return id;
    }
    let client_id = uuid::Uuid::new_v4().to_string();
    let (kp, _vk) = ed25519_generate();
    let identity = DDeviceIdentity {
        client_id,
        device_name: default_device_name(),
        ed25519_keypair: base64_encode(&kp),
        created_at: super::db::now_iso(),
    };
    db.insert_identity(&identity);
    identity
}

fn default_device_name() -> String {
    std::process::Command::new("hostname")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "PlainApp Desktop".to_string())
}
