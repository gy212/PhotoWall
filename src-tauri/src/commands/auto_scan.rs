//! 自动扫描 Tauri 命令
//!
//! 提供启动、停止、查询自动扫描服务的功能

use tauri::{AppHandle, State};

use crate::db::ScanDirectoryState;
use crate::services::{AutoScanStatus, StepScanConfig};
use crate::services::indexer::IndexOptions;
use crate::services::scanner::ScanOptions;
use crate::utils::error::CommandError;
use crate::AppState;

/// 启动自动扫描服务
#[tauri::command]
pub async fn start_auto_scan(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    // 获取监控文件夹列表
    let manager = crate::services::SettingsManager::new(&app).map_err(CommandError::from)?;
    let settings = manager.load().map_err(CommandError::from)?;

    if settings.scan.watched_folders.is_empty() {
        return Err(CommandError {
            code: "E_NO_FOLDERS".to_string(),
            message: "没有配置监控文件夹".to_string(),
        });
    }

    let mut step_config = StepScanConfig::default();
    step_config.base_interval_secs = settings.scan.scan_interval.max(60);

    let mut scan_options = ScanOptions::new();
    scan_options.recursive = settings.scan.recursive;
    if !settings.scan.excluded_patterns.is_empty() {
        scan_options.exclude_dirs = settings.scan.excluded_patterns.clone();
    }

    let mut index_options = IndexOptions::default();
    index_options.scan_options = scan_options;

    let watched_folders = settings.scan.watched_folders.clone();
    let realtime_watch = settings.scan.realtime_watch;

    // 启动自动扫描
    let mut auto_scan = state.auto_scan_manager.lock().await;
    if let Some(ref mut manager) = *auto_scan {
        manager
            .start(
                app.clone(),
                watched_folders,
                step_config,
                index_options,
                realtime_watch,
            )
            .await
            .map_err(CommandError::from)?;
    }

    tracing::info!("自动扫描服务已启动");
    Ok(())
}

/// 停止自动扫描服务
#[tauri::command]
pub async fn stop_auto_scan(state: State<'_, AppState>) -> Result<(), CommandError> {
    let mut auto_scan = state.auto_scan_manager.lock().await;
    if let Some(ref mut manager) = *auto_scan {
        manager.stop();
    }

    tracing::info!("自动扫描服务已停止");
    Ok(())
}

/// 获取自动扫描状态
#[tauri::command]
pub async fn get_auto_scan_status(
    state: State<'_, AppState>,
) -> Result<AutoScanStatus, CommandError> {
    let auto_scan = state.auto_scan_manager.lock().await;
    match &*auto_scan {
        Some(manager) => Ok(manager.status()),
        None => Ok(AutoScanStatus {
            running: false,
            scanning: false,
            watched_paths: vec![],
        }),
    }
}

/// 获取所有目录扫描状态
#[tauri::command]
pub async fn get_directory_scan_states(
    state: State<'_, AppState>,
) -> Result<Vec<ScanDirectoryState>, CommandError> {
    let states = state
        .db
        .get_all_scan_directories()
        .map_err(CommandError::from)?;
    Ok(states)
}

/// 重置目录扫描频率为 x1
#[tauri::command]
pub async fn reset_directory_scan_frequency(
    state: State<'_, AppState>,
    dir_path: String,
) -> Result<bool, CommandError> {
    let result = state
        .db
        .reset_scan_frequency(&dir_path)
        .map_err(CommandError::from)?;
    Ok(result)
}

/// 手动触发目录扫描
#[tauri::command]
pub async fn trigger_directory_scan(
    state: State<'_, AppState>,
    dir_path: String,
) -> Result<(), CommandError> {
    let auto_scan = state.auto_scan_manager.lock().await;
    if let Some(ref manager) = *auto_scan {
        manager
            .trigger_scan(&dir_path)
            .await
            .map_err(CommandError::from)?;
    } else {
        return Err(CommandError {
            code: "E_NOT_RUNNING".to_string(),
            message: "自动扫描服务未运行".to_string(),
        });
    }
    Ok(())
}
