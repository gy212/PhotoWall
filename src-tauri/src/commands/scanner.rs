//! 扫描和索引相关 Tauri 命令

use std::path::PathBuf;

use regex::Regex;
use tauri::{AppHandle, Emitter, State};

use crate::models::{PaginationParams, PhotoSortOptions};
use crate::services::{
    IndexOptions, IndexResult, PhotoIndexer, ScanOptions, ScanResult, Scanner,
    ThumbnailSize, ThumbnailTask,
};
use crate::utils::error::CommandError;
use crate::AppState;

/// 后台预生成缩略图的优先级（负数表示低优先级）
/// 预生成优先级：tiny + small 使用中等优先级，medium + large 使用低优先级
const PREGENERATE_PRIORITY_HIGH: i32 = 0;   // tiny + small
const PREGENERATE_PRIORITY_LOW: i32 = -10;  // medium + large (保留用于未来)

/// 扫描目录命令
#[tauri::command]
pub async fn scan_directory(
    path: String,
    options: Option<ScanOptions>,
) -> Result<ScanResult, CommandError> {
    let path = PathBuf::from(&path);
    let options = options.unwrap_or_else(ScanOptions::new);

    let scanner = Scanner::new(options);
    scanner
        .scan_directory(&path)
        .map_err(|e| CommandError::from(e))
}

/// 扫描多个目录命令
#[tauri::command]
pub async fn scan_directories(
    paths: Vec<String>,
    options: Option<ScanOptions>,
) -> Result<ScanResult, CommandError> {
    let paths: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    let options = options.unwrap_or_else(ScanOptions::new);

    let scanner = Scanner::new(options);
    scanner
        .scan_directories(&paths)
        .map_err(|e| CommandError::from(e))
}

/// 索引目录命令
#[tauri::command]
pub async fn index_directory(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
    options: Option<IndexOptions>,
) -> Result<IndexResult, CommandError> {
    let path_clone = path.clone();
    let path = PathBuf::from(&path);
    let options = options.unwrap_or_default();
    let db = state.db.clone();

    let app_handle = app.clone();

    // 在后台线程执行索引
    let result = tokio::task::spawn_blocking(move || {
        let indexer = PhotoIndexer::new(db, options);

        indexer.index_directory_with_progress(&path, |progress| {
            // 发送进度事件
            let _ = app_handle.emit("index-progress", progress);
        })
    })
    .await
    .map_err(|e| CommandError {
        code: "E_TASK_FAILED".to_string(),
        message: format!("索引任务失败: {}", e),
    })?
    .map_err(|e| CommandError::from(e))?;

    // 发送完成事件
    let _ = app.emit("index-finished", &result);

    // 后台预生成缩略图
    if result.indexed > 0 {
        trigger_thumbnail_pregeneration(&app, &state, &[path_clone]).await;
    }

    Ok(result)
}

/// 索引多个目录命令
#[tauri::command]
pub async fn index_directories(
    app: AppHandle,
    state: State<'_, AppState>,
    paths: Vec<String>,
    options: Option<IndexOptions>,
) -> Result<IndexResult, CommandError> {
    let paths_clone = paths.clone();
    let paths: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    let options = options.unwrap_or_default();
    let db = state.db.clone();

    let app_handle = app.clone();

    let result = tokio::task::spawn_blocking(move || {
        let indexer = PhotoIndexer::new(db, options);

        indexer.index_directories_with_progress(&paths, |progress| {
            let _ = app_handle.emit("index-progress", progress);
        })
    })
    .await
    .map_err(|e| CommandError {
        code: "E_TASK_FAILED".to_string(),
        message: format!("索引任务失败: {}", e),
    })?
    .map_err(|e| CommandError::from(e))?;

    let _ = app.emit("index-finished", &result);

    // 后台预生成缩略图
    if result.indexed > 0 {
        trigger_thumbnail_pregeneration(&app, &state, &paths_clone).await;
    }

    Ok(result)
}

/// 获取数据库统计信息
#[tauri::command]
pub async fn get_database_stats(
    state: State<'_, AppState>,
) -> Result<crate::db::DatabaseStats, CommandError> {
    state.db.stats().map_err(|e| CommandError::from(e))
}

/// 刷新照片元数据（重新解析日期）
#[tauri::command]
pub async fn refresh_photo_metadata(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<RefreshMetadataResult, CommandError> {
    let db = state.db.clone();
    let app_handle = app.clone();

    let result = tokio::task::spawn_blocking(move || {
        refresh_all_photo_dates(&db, move |progress| {
            let _ = app_handle.emit("refresh-progress", progress);
        })
    })
    .await
    .map_err(|e| CommandError {
        code: "E_TASK_FAILED".to_string(),
        message: format!("刷新任务失败: {}", e),
    })?
    .map_err(|e| CommandError::from(e))?;

    let _ = app.emit("refresh-finished", &result);

    Ok(result)
}

/// 刷新元数据结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshMetadataResult {
    pub total: usize,
    pub updated: usize,
    pub skipped: usize,
    pub failed: usize,
}

/// 刷新所有照片的日期
fn refresh_all_photo_dates<F>(
    db: &std::sync::Arc<crate::db::Database>,
    progress_callback: F,
) -> Result<RefreshMetadataResult, crate::utils::error::AppError>
where
    F: Fn(String),
{
    use crate::models::{PaginationParams, PhotoSortOptions};
    use std::path::Path;

    let mut result = RefreshMetadataResult {
        total: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
    };

    // 获取所有照片
    let pagination = PaginationParams { page: 1, page_size: 10000 };
    let sort = PhotoSortOptions::default();
    let photos = db.get_photos(&pagination, &sort)?.items;
    result.total = photos.len();

    progress_callback(format!("开始刷新 {} 张照片的元数据...", result.total));

    for (i, photo) in photos.iter().enumerate() {
        // 如果已经有 date_taken，跳过
        if photo.date_taken.is_some() {
            result.skipped += 1;
            continue;
        }

        // 尝试从文件名解析日期
        let new_date = parse_date_from_filename(&photo.file_name)
            .or_else(|| {
                // 尝试从文件修改时间获取
                let path = Path::new(&photo.file_path);
                if let Ok(metadata) = std::fs::metadata(path) {
                    if let Ok(modified) = metadata.modified() {
                        if let Ok(duration) = modified.duration_since(std::time::UNIX_EPOCH) {
                            return Some(timestamp_to_iso8601(duration.as_secs() as i64));
                        }
                    }
                }
                None
            });

        if let Some(date) = new_date {
            // 更新数据库
            let update = crate::models::photo::UpdatePhoto {
                date_taken: Some(date),
                ..Default::default()
            };
            if db.update_photo(photo.photo_id, &update).is_ok() {
                result.updated += 1;
            } else {
                result.failed += 1;
            }
        } else {
            result.skipped += 1;
        }

        // 每 50 张发送进度
        if (i + 1) % 50 == 0 {
            progress_callback(format!("已处理 {}/{} 张照片...", i + 1, result.total));
        }
    }

    progress_callback(format!(
        "刷新完成: {} 张更新, {} 张跳过, {} 张失败",
        result.updated, result.skipped, result.failed
    ));

    Ok(result)
}

/// 从文件名解析日期
fn parse_date_from_filename(filename: &str) -> Option<String> {
    
    // 模式1: 屏幕截图 2025-12-03 170003 或 2025-12-03 17.00.03
    if let Ok(re1) = Regex::new(r"(\d{4})-(\d{2})-(\d{2})[\s_](\d{2})[.:](\d{2})[.:](\d{2})") {
        if let Some(caps) = re1.captures(filename) {
            return Some(format!(
                "{}-{}-{}T{}:{}:{}Z",
                &caps[1], &caps[2], &caps[3], &caps[4], &caps[5], &caps[6]
            ));
        }
    }
    
    // 模式2: 屏幕截图 2025-12-03 170003 (时间无分隔符)
    if let Ok(re2) = Regex::new(r"(\d{4})-(\d{2})-(\d{2})[\s_](\d{2})(\d{2})(\d{2})") {
        if let Some(caps) = re2.captures(filename) {
            return Some(format!(
                "{}-{}-{}T{}:{}:{}Z",
                &caps[1], &caps[2], &caps[3], &caps[4], &caps[5], &caps[6]
            ));
        }
    }
    
    // 模式3: IMG_20251203_170003 或 20251203_170003
    if let Ok(re3) = Regex::new(r"(\d{4})(\d{2})(\d{2})[_\-](\d{2})(\d{2})(\d{2})") {
        if let Some(caps) = re3.captures(filename) {
            return Some(format!(
                "{}-{}-{}T{}:{}:{}Z",
                &caps[1], &caps[2], &caps[3], &caps[4], &caps[5], &caps[6]
            ));
        }
    }
    
    // 模式4: 仅日期 2025-12-03
    if let Ok(re4) = Regex::new(r"(\d{4})-(\d{2})-(\d{2})") {
        if let Some(caps) = re4.captures(filename) {
            return Some(format!(
                "{}-{}-{}T00:00:00Z",
                &caps[1], &caps[2], &caps[3]
            ));
        }
    }
    
    None
}

/// 将 Unix 时间戳转换为 ISO 8601 格式
fn timestamp_to_iso8601(secs: i64) -> String {
    let days = secs / 86400;
    let remaining = secs % 86400;
    let hours = remaining / 3600;
    let minutes = (remaining % 3600) / 60;
    let seconds = remaining % 60;
    
    let mut year = 1970i64;
    let mut days_remaining = days;
    
    loop {
        let days_in_year = if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
            366
        } else {
            365
        };
        if days_remaining < days_in_year {
            break;
        }
        days_remaining -= days_in_year;
        year += 1;
    }
    
    let is_leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
    let days_in_months: [i64; 12] = if is_leap {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    
    let mut month = 1;
    for &dim in &days_in_months {
        if days_remaining < dim {
            break;
        }
        days_remaining -= dim;
        month += 1;
    }
    
    let day = days_remaining + 1;
    
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hours, minutes, seconds
    )
}

/// 预生成进度事件
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ThumbnailPregenerateProgress {
    total: usize,
    queued: usize,
}

/// 触发后台预生成缩略图
pub(crate) async fn trigger_thumbnail_pregeneration(
    app: &AppHandle,
    state: &State<'_, AppState>,
    folder_paths: &[String],
) {
    let db = state.db.clone();
    let queue = state.thumbnail_queue.clone();
    let app_handle = app.clone();
    let folder_paths = folder_paths.to_vec(); // 克隆以获取所有权

    // 在后台线程执行，不阻塞索引返回
    tokio::task::spawn_blocking(move || {
        let mut total_queued = 0usize;
        let mut total_photos = 0usize;

        for folder_path in &folder_paths {
            // 获取该文件夹下所有照片（包括子文件夹）
            let pagination = PaginationParams { page: 1, page_size: 50000 };
            let sort = PhotoSortOptions::default();

            let photos = match db.get_photos_by_folder(folder_path, true, &pagination, &sort) {
                Ok(result) => result.items,
                Err(e) => {
                    tracing::warn!("获取文件夹照片失败: {} -> {}", folder_path, e);
                    continue;
                }
            };

            total_photos += photos.len();

            // 构建缩略图任务：tiny + small 使用中等优先级（用户最常看到的尺寸）
            let mut tasks: Vec<ThumbnailTask> = Vec::with_capacity(photos.len() * 2);
            for photo in photos {
                let path = PathBuf::from(&photo.file_path);
                // tiny 尺寸（用于渐进式加载的模糊占位图）
                tasks.push(ThumbnailTask::new(
                    path.clone(),
                    photo.file_hash.clone(),
                    ThumbnailSize::Tiny,
                    PREGENERATE_PRIORITY_HIGH,
                ));
                // small 尺寸（网格视图主要使用）
                tasks.push(ThumbnailTask::new(
                    path,
                    photo.file_hash,
                    ThumbnailSize::Small,
                    PREGENERATE_PRIORITY_HIGH,
                ));
            }

            total_queued += tasks.len();

            // 批量入队
            queue.enqueue_batch(tasks);
        }

        if total_queued > 0 {
            tracing::info!(
                "后台预生成缩略图: {} 张照片已入队 (来自 {} 个文件夹)",
                total_queued,
                folder_paths.len()
            );

            // 发送预生成开始事件
            let _ = app_handle.emit(
                "thumbnail-pregenerate-started",
                ThumbnailPregenerateProgress {
                    total: total_photos,
                    queued: total_queued,
                },
            );
        }
    });
}
