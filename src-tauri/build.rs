fn main() {
    tauri_build::build();

    // On macOS debug builds, ad-hoc sign the binary with the multicast
    // entitlement so that UDP multicast probes are not silently dropped by
    // the OS. Production (release) builds are signed by `tauri bundle`.
    #[cfg(all(target_os = "macos", debug_assertions))]
    sign_debug_binary_macos();
}

#[cfg(all(target_os = "macos", debug_assertions))]
fn sign_debug_binary_macos() {
    use std::path::PathBuf;

    // Resolve entitlements.plist relative to this build script (src-tauri/).
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let entitlements = PathBuf::from(&manifest_dir).join("entitlements.plist");

    // OUT_DIR is inside target/…/build/PlainApp-<hash>/out; walk up to find
    // the profile directory (target/debug or target/release).
    let out_dir = std::env::var("OUT_DIR").unwrap();
    let profile = std::env::var("PROFILE").unwrap_or_else(|_| "debug".to_string());

    // target/{profile}/PlainApp  (binary name = package name from Cargo.toml)
    // We locate `target/` by stripping everything after it in OUT_DIR.
    let target_dir = PathBuf::from(&out_dir)
        .ancestors()
        .find(|p| p.ends_with(&profile))
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from(&manifest_dir).join("target").join(&profile));

    let binary = target_dir.join("PlainApp");

    if !binary.exists() || !entitlements.exists() {
        // Binary not yet built on this pass — the linker runs after build
        // scripts; a subsequent build invocation will sign it.
        return;
    }

    let status = std::process::Command::new("codesign")
        .args([
            "--force",
            "--entitlements",
            entitlements.to_str().unwrap(),
            "--sign",
            "-", // ad-hoc
            binary.to_str().unwrap(),
        ])
        .status();

    match status {
        Ok(s) if s.success() => {}
        Ok(s) => {
            println!("cargo:warning=codesign: exited with status {s} for {}", binary.display());
        }
        Err(e) => {
            println!("cargo:warning=codesign: failed to run: {e}");
        }
    }
}
