//! 前端日志命令

use chrono::Local;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;

const MAX_LOG_FIELD_LEN: usize = 16 * 1024;

fn clamp_log_field(mut s: String) -> String {
    if s.len() > MAX_LOG_FIELD_LEN {
        s.truncate(MAX_LOG_FIELD_LEN);
        s.push_str("…[truncated]");
    }
    s
}

/// 获取前端日志文件路径
fn get_frontend_log_path() -> PathBuf {
    let log_dir = crate::get_log_dir();
    std::fs::create_dir_all(&log_dir).ok();

    let date = Local::now().format("%Y-%m-%d");
    log_dir.join(format!("frontend.{}.log", date))
}

/// 前端日志写入命令
#[tauri::command]
pub fn log_frontend(level: String, message: String, context: Option<serde_json::Value>) {
    let timestamp = Local::now().format("%Y-%m-%dT%H:%M:%S%.3f");

    let level = match level.to_ascii_lowercase().as_str() {
        "debug" | "info" | "warn" | "error" => level,
        _ => "info".to_string(),
    };

    let message = clamp_log_field(message);
    let context_str = context
        .map(|c| clamp_log_field(format!(" {}", c)))
        .unwrap_or_default();
    let log_line = format!(
        "{} [{}] {}{}\n",
        timestamp,
        level.to_uppercase(),
        message,
        context_str
    );

    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(get_frontend_log_path())
    {
        let _ = file.write_all(log_line.as_bytes());
    }
}
