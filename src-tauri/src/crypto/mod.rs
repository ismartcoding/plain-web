use std::io::Read;

mod ecdh;
mod ed25519;
mod symmetric;

pub use crate::utils::base64::{base64_decode, base64_encode};
pub use ecdh::EcdhSession;
pub use ed25519::{ed25519_generate, ed25519_sign, ed25519_verify};
pub use symmetric::{chacha20_decrypt, chacha20_encrypt, xchacha_decrypt, xchacha_encrypt, xchacha_decrypt_raw, xchacha_encrypt_raw};

pub(crate) fn gen_random(buf: &mut [u8]) {
    #[cfg(unix)]
    if let Ok(mut f) = std::fs::File::open("/dev/urandom") {
        let _ = f.read_exact(buf);
    }
}

pub fn random_bytes(len: usize) -> Vec<u8> {
    let mut buf = vec![0u8; len];
    gen_random(&mut buf);
    buf
}

pub fn gen_token() -> String {
    let mut bytes = [0u8; 32];
    gen_random(&mut bytes);
    base64_encode(&bytes)
}
