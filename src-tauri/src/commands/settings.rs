//! 设置管理 Tauri 命令

use crate::models::AppSettings;
use crate::services::SettingsManager;
use crate::utils::error::CommandError;
use tauri::{AppHandle, Emitter, Manager};

/// 获取应用程序设置
#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<AppSettings, CommandError> {
    let manager = SettingsManager::new(&app)
        .map_err(CommandError::from)?;

    let settings = manager.load()
        .map_err(CommandError::from)?;

    Ok(settings)
}

/// 保存应用程序设置
#[tauri::command]
pub async fn save_settings(
    app: AppHandle,
    settings: AppSettings,
) -> Result<(), CommandError> {
    let manager = SettingsManager::new(&app)
        .map_err(CommandError::from)?;

    manager.save(&settings)
        .map_err(CommandError::from)?;

    // Apply window appearance changes immediately (native effects).
    if let Some(window) = app.get_webview_window("main") {
        crate::window_effects::apply_window_settings(&window, settings.window.clone());
    }

    // 发送设置变更事件
    app.emit("settings-changed", &settings)
        .map_err(|e| CommandError {
            code: "E_EVENT".to_string(),
            message: format!("发送事件失败: {}", e),
        })?;

    Ok(())
}

/// 重置设置为默认值
#[tauri::command]
pub async fn reset_settings(app: AppHandle) -> Result<AppSettings, CommandError> {
    let manager = SettingsManager::new(&app)
        .map_err(CommandError::from)?;

    let settings = manager.reset()
        .map_err(CommandError::from)?;

    // Apply window appearance changes immediately (native effects).
    if let Some(window) = app.get_webview_window("main") {
        crate::window_effects::apply_window_settings(&window, settings.window.clone());
    }

    // 发送设置变更事件
    app.emit("settings-changed", &settings)
        .map_err(|e| CommandError {
            code: "E_EVENT".to_string(),
            message: format!("发送事件失败: {}", e),
        })?;

    Ok(settings)
}
