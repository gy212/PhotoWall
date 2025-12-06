//! 问候命令示例

use tracing::info;

/// 问候命令
///
/// # Arguments
/// * `name` - 要问候的名字
///
/// # Returns
/// 返回问候字符串
#[tauri::command]
pub fn greet(name: &str) -> String {
    info!("Greeting: {}", name);
    format!("Hello, {}! You've been greeted from Rust!", name)
}
