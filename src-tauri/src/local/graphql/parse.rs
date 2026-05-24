//! Lightweight GraphQL query string parsing helpers.

/// Extract the operation name from a GraphQL query string.
/// Looks for the first token after `query` or `mutation` keyword.
pub fn operation_name(query: &str) -> String {
    let words: Vec<&str> = query.split_whitespace().collect();
    for i in 0..words.len().saturating_sub(1) {
        if words[i] == "query" || words[i] == "mutation" {
            return words[i + 1]
                .split(['(', '{'])
                .next()
                .unwrap_or_default()
                .to_string();
        }
    }
    String::new()
}

/// Returns true if `field` appears as a whole token in the query string.
pub fn has_field(query: &str, field: &str) -> bool {
    query
        .split(|c: char| !c.is_alphanumeric() && c != '_')
        .any(|tok| tok == field)
}
