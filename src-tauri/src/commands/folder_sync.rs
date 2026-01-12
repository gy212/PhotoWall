//! 文件夹同步管理 Tauri 命令
//!
//! 提供添加、删除、获取同步文件夹以及启动/停止自动同步的功能

use crate::services::SettingsManager;
use crate::utils::error::CommandError;
use crate::AppState;
use std::path::Path;
use tauri::{AppHandle, Emitter, State};

/// 同步文件夹信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncFolder {
    /// 文件夹路径
    pub path: String,
    /// 是否有效（路径存在）
    pub is_valid: bool,
    /// 是否启用同步
    pub enabled: bool,
}

/// 获取所有同步文件夹
#[tauri::command]
pub async fn get_sync_folders(app: AppHandle) -> Result<Vec<SyncFolder>, CommandError> {
    let manager = SettingsManager::new(&app).map_err(CommandError::from)?;
    let settings = manager.load().map_err(CommandError::from)?;

    let folders: Vec<SyncFolder> = settings
        .scan
        .watched_folders
        .iter()
        .map(|path| {
            let is_valid = Path::new(path).exists();
            SyncFolder {
                path: path.clone(),
                is_valid,
                enabled: true,
            }
        })
        .collect();

    Ok(folders)
}

/// 添加同步文件夹
#[tauri::command]
pub async fn add_sync_folder(
    app: AppHandle,
    state: State<'_, AppState>,
    folder_path: String,
) -> Result<bool, CommandError> {
    // 验证路径是否存在
    if !Path::new(&folder_path).exists() {
        return Err(CommandError {
            code: "E_PATH_NOT_FOUND".to_string(),
            message: format!("文件夹不存在: {}", folder_path),
        });
    }

    // 验证是否是目录
    if !Path::new(&folder_path).is_dir() {
        return Err(CommandError {
            code: "E_NOT_DIRECTORY".to_string(),
            message: format!("路径不是文件夹: {}", folder_path),
        });
    }

    let manager = SettingsManager::new(&app).map_err(CommandError::from)?;
    let mut settings = manager.load().map_err(CommandError::from)?;

    // 检查是否已存在
    if settings.scan.watched_folders.contains(&folder_path) {
        return Err(CommandError {
            code: "E_ALREADY_EXISTS".to_string(),
            message: "该文件夹已在同步列表中".to_string(),
        });
    }

    // 添加到同步列表
    settings.scan.watched_folders.push(folder_path.clone());
    manager.save(&settings).map_err(CommandError::from)?;

    if settings.scan.auto_scan {
        let mut auto_scan = state.auto_scan_manager.lock().await;
        if let Some(ref mut manager) = *auto_scan {
            manager
                .apply_settings(app.clone(), &settings)
                .await
                .map_err(CommandError::from)?;
        }
    }

    // 发送设置变更事件
    app.emit("sync-folders-changed", &settings.scan.watched_folders)
        .map_err(|e| CommandError {
            code: "E_EVENT".to_string(),
            message: format!("发送事件失败: {}", e),
        })?;

    tracing::info!("已添加同步文件夹: {}", folder_path);
    Ok(true)
}

/// 删除同步文件夹
#[tauri::command]
pub async fn remove_sync_folder(
    app: AppHandle,
    state: State<'_, AppState>,
    folder_path: String,
) -> Result<bool, CommandError> {
    let manager = SettingsManager::new(&app).map_err(CommandError::from)?;
    let mut settings = manager.load().map_err(CommandError::from)?;

    // 查找并删除
    let original_len = settings.scan.watched_folders.len();
    settings
        .scan
        .watched_folders
        .retain(|p| p != &folder_path);

    if settings.scan.watched_folders.len() == original_len {
        return Err(CommandError {
            code: "E_NOT_FOUND".to_string(),
            message: "该文件夹不在同步列表中".to_string(),
        });
    }

    manager.save(&settings).map_err(CommandError::from)?;

    if settings.scan.auto_scan {
        let mut auto_scan = state.auto_scan_manager.lock().await;
        if let Some(ref mut manager) = *auto_scan {
            manager
                .apply_settings(app.clone(), &settings)
                .await
                .map_err(CommandError::from)?;
        }
    }

    // 发送设置变更事件
    app.emit("sync-folders-changed", &settings.scan.watched_folders)
        .map_err(|e| CommandError {
            code: "E_EVENT".to_string(),
            message: format!("发送事件失败: {}", e),
        })?;

    tracing::info!("已移除同步文件夹: {}", folder_path);
    Ok(true)
}

/// 设置自动同步开关
#[tauri::command]
pub async fn set_auto_sync_enabled(app: AppHandle, enabled: bool) -> Result<bool, CommandError> {
    let manager = SettingsManager::new(&app).map_err(CommandError::from)?;
    let mut settings = manager.load().map_err(CommandError::from)?;

    settings.scan.auto_scan = enabled;
    manager.save(&settings).map_err(CommandError::from)?;

    // 发送设置变更事件
    app.emit("auto-sync-changed", enabled).map_err(|e| CommandError {
        code: "E_EVENT".to_string(),
        message: format!("发送事件失败: {}", e),
    })?;

    tracing::info!("自动同步已{}", if enabled { "启用" } else { "禁用" });
    Ok(enabled)
}

/// 获取自动同步状态
#[tauri::command]
pub async fn get_auto_sync_enabled(app: AppHandle) -> Result<bool, CommandError> {
    let manager = SettingsManager::new(&app).map_err(CommandError::from)?;
    let settings = manager.load().map_err(CommandError::from)?;
    Ok(settings.scan.auto_scan)
}

/// 立即触发同步（手动扫描所有同步文件夹）
#[tauri::command]
pub async fn trigger_sync_now(app: AppHandle) -> Result<u32, CommandError> {
    let manager = SettingsManager::new(&app).map_err(CommandError::from)?;
    let settings = manager.load().map_err(CommandError::from)?;

    if settings.scan.watched_folders.is_empty() {
        return Err(CommandError {
            code: "E_NO_FOLDERS".to_string(),
            message: "没有配置同步文件夹".to_string(),
        });
    }

    // 发送同步开始事件
    app.emit("sync-started", &settings.scan.watched_folders)
        .map_err(|e| CommandError {
            code: "E_EVENT".to_string(),
            message: format!("发送事件失败: {}", e),
        })?;

    tracing::info!(
        "开始同步 {} 个文件夹",
        settings.scan.watched_folders.len()
    );

    Ok(settings.scan.watched_folders.len() as u32)
}

/// 验证文件夹路径是否有效
#[tauri::command]
pub async fn validate_folder_path(folder_path: String) -> Result<bool, CommandError> {
    let path = Path::new(&folder_path);
    Ok(path.exists() && path.is_dir())
}
