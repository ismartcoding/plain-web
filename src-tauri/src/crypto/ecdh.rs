use p256::{
    ecdh::EphemeralSecret,
    pkcs8::{DecodePublicKey, EncodePublicKey},
    PublicKey as P256PublicKey,
};
use rand::rngs::OsRng;
use sha2::{Digest, Sha256};

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
