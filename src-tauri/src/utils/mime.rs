/// Best-effort MIME type guess from a filename extension. Returns
/// `application/octet-stream` for unknown / extensionless inputs.
pub(crate) fn mime_from_ext(filename: &str) -> &'static str {
    match filename
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        // Images
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "tif" | "tiff" => "image/tiff",
        "heic" | "heif" => "image/heic",
        "avif" => "image/avif",
        // Videos
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mov" => "video/quicktime",
        "mkv" => "video/x-matroska",
        "3gp" => "video/3gpp",
        // Audio
        "mp3" => "audio/mpeg",
        "m4a" => "audio/mp4",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        // Documents
        "pdf" => "application/pdf",
        "zip" => "application/zip",
        "json" => "application/json",
        // Text
        "txt" => "text/plain",
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "js" => "application/javascript",
        "md" => "text/markdown",
        // Default
        _ => "application/octet-stream",
    }
}

/// Reverse of `mime_from_ext`: pick a reasonable file extension for a
/// given MIME type. Returns `"bin"` for unknown / opaque types — the
/// caller can decide whether to surface a generic name.
pub(crate) fn mime_extension(mime: &str) -> &'static str {
    match mime {
        // Images
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/svg+xml" => "svg",
        "image/bmp" => "bmp",
        "image/tiff" => "tif",
        "image/heic" => "heic",
        "image/avif" => "avif",
        // Videos
        "video/mp4" => "mp4",
        "video/webm" => "webm",
        "video/quicktime" => "mov",
        "video/x-matroska" => "mkv",
        "video/3gpp" => "3gp",
        // Audio
        "audio/mpeg" => "mp3",
        "audio/mp4" => "m4a",
        "audio/wav" => "wav",
        "audio/ogg" => "ogg",
        // Documents / data
        "application/pdf" => "pdf",
        "application/zip" => "zip",
        "application/json" => "json",
        "application/x-rar-compressed" => "rar",
        "application/x-7z-compressed" => "7z",
        "application/x-tar" => "tar",
        "application/gzip" => "gz",
        "application/vnd.android.package-archive" => "apk",
        // Text
        "text/plain" => "txt",
        "text/html" => "html",
        "text/csv" => "csv",
        "text/xml" => "xml",
        "text/markdown" => "md",
        // Fonts
        "font/ttf" => "ttf",
        "font/otf" => "otf",
        "font/woff" => "woff",
        "font/woff2" => "woff2",
        // Unknown / opaque
        _ => "bin",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mime_guesses() {
        assert_eq!(mime_from_ext("cat.jpg"), "image/jpeg");
        assert_eq!(mime_from_ext("cat.JPG"), "image/jpeg");
        assert_eq!(mime_from_ext("movie.mp4"), "video/mp4");
        assert_eq!(mime_from_ext("thing.unknown"), "application/octet-stream");
    }

    #[test]
    fn mime_handles_no_extension() {
        assert_eq!(mime_from_ext("README"), "application/octet-stream");
    }

    #[test]
    fn mime_handles_empty() {
        assert_eq!(mime_from_ext(""), "application/octet-stream");
    }

    #[test]
    fn ext_roundtrips_through_mime() {
        for ext in [
            "jpg", "png", "gif", "webp", "svg", "bmp", "tif", "heic", "avif", "mp4", "webm", "mov",
            "mkv", "3gp", "mp3", "m4a", "wav", "ogg", "pdf", "zip", "json", "txt", "html", "md",
        ] {
            assert_eq!(mime_extension(mime_from_ext(&format!("f.{ext}"))), ext);
        }
    }

    #[test]
    fn ext_falls_back_to_bin() {
        assert_eq!(mime_extension("application/x-totally-made-up"), "bin");
        assert_eq!(mime_extension(""), "bin");
    }
}
