//! 路径和日志净化工具

pub fn sanitize_file_hash(input: &str) -> String {
    let mut out = String::with_capacity(input.len().min(128));
    for c in input.trim().chars() {
        if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
            out.push(c);
        }
        if out.len() >= 128 {
            break;
        }
    }
    if out.is_empty() {
        "unknown".to_string()
    } else {
        out
    }
}

pub fn sanitize_filename_component(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return "photo".to_string();
    }

    let mut out = String::with_capacity(trimmed.len().min(180));
    for c in trimmed.chars() {
        let forbidden = matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')
            || c.is_control();
        out.push(if forbidden { '_' } else { c });
        if out.len() >= 180 {
            break;
        }
    }

    let out = out.trim_matches([' ', '.']).to_string();
    if out.is_empty() {
        "photo".to_string()
    } else {
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_file_hash_removes_path_chars() {
        let s = sanitize_file_hash("../..\\evil:hash");
        assert!(!s.contains('/'));
        assert!(!s.contains('\\'));
        assert!(!s.contains(':'));
        assert!(!s.contains('.'));
        assert!(!s.is_empty());
    }

    #[test]
    fn sanitize_filename_component_never_empty() {
        assert_eq!(sanitize_filename_component("   "), "photo");
        assert_eq!(sanitize_filename_component(".."), "photo");
    }
}
