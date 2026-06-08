use std::io::{BufRead, BufReader};

/// Validate that a string is a safe SQL identifier (table/column name).
pub fn is_safe_identifier(s: &str) -> bool {
    let mut chars = s.chars();
    match chars.next() {
        Some(first) if first.is_ascii_alphabetic() || first == '_' => {
            chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
        }
        _ => false,
    }
}

/// Read `limit` lines from `path` starting at `offset`.
pub fn read_log_lines(path: &std::path::Path, offset: i32, limit: i32) -> Vec<String> {
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return vec![],
    };
    BufReader::new(file)
        .lines()
        .map_while(Result::ok)
        .skip(offset.max(0) as usize)
        .take(limit.max(0) as usize)
        .collect()
}
