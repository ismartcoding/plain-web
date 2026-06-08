// TLS certificate management for the local HTTPS server.
// Uses rcgen to generate a self-signed EC P-256 certificate and persists it to disk.
// On startup, if cert.pem / key.pem are missing they are auto-generated.

use rcgen::{generate_simple_self_signed, CertifiedKey};
use rustls_pemfile::{certs, private_key};
use std::io::BufReader;
use std::path::Path;
use std::sync::Arc;
use tokio_rustls::rustls::pki_types::{CertificateDer, PrivateKeyDer};
use tokio_rustls::rustls::ServerConfig;
use tokio_rustls::TlsAcceptor;

const CERT_FILE: &str = "local_server_cert.pem";
const KEY_FILE: &str = "local_server_key.pem";

/// Ensure a self-signed certificate exists at `dir`. Generate one if not found.
/// Returns `(cert_pem_bytes, key_pem_bytes)`.
pub fn ensure_cert(dir: &Path) -> std::io::Result<(Vec<u8>, Vec<u8>)> {
    let cert_path = dir.join(CERT_FILE);
    let key_path = dir.join(KEY_FILE);

    if cert_path.exists() && key_path.exists() {
        let cert_pem = std::fs::read(&cert_path)?;
        let key_pem = std::fs::read(&key_path)?;
        log::info!(
            "local_tls: loaded existing cert from {}",
            cert_path.display()
        );
        return Ok((cert_pem, key_pem));
    }

    log::info!(
        "local_tls: generating new self-signed certificate in {}",
        dir.display()
    );
    std::fs::create_dir_all(dir)?;

    let subject_alt_names = vec!["localhost".to_string(), "127.0.0.1".to_string()];
    let CertifiedKey { cert, key_pair } = generate_simple_self_signed(subject_alt_names)
        .map_err(std::io::Error::other)?;

    let cert_pem = cert.pem().into_bytes();
    let key_pem = key_pair.serialize_pem().into_bytes();

    std::fs::write(&cert_path, &cert_pem)?;
    std::fs::write(&key_path, &key_pem)?;
    log::info!("local_tls: certificate written to {}", dir.display());

    Ok((cert_pem, key_pem))
}

/// Build a `TlsAcceptor` from PEM-encoded cert + key bytes.
pub fn build_acceptor(cert_pem: &[u8], key_pem: &[u8]) -> std::io::Result<TlsAcceptor> {
    let certs: Vec<CertificateDer<'static>> = {
        let mut r = BufReader::new(cert_pem);
        certs(&mut r)
            .collect::<Result<Vec<_>, _>>()
            .map_err(std::io::Error::other)?
    };

    let key: PrivateKeyDer<'static> = {
        let mut r = BufReader::new(key_pem);
        private_key(&mut r)
            .map_err(std::io::Error::other)?
            .ok_or_else(|| std::io::Error::other("no private key found"))?
    };

    let config = ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(certs, key)
        .map_err(std::io::Error::other)?;

    Ok(TlsAcceptor::from(Arc::new(config)))
}
