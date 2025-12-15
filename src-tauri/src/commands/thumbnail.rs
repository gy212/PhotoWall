//! 缩略图相关 Tauri 命令

use std::path::PathBuf;

use serde::Serialize;
use tauri::State;

use crate::services::{ThumbnailService, ThumbnailSize, ThumbnailTask};
use crate::utils::error::CommandError;
use crate::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailResponse {
    /// 生成的缩略图在磁盘上的绝对路径（WebP）
    pub path: String,
    /// 是否命中缓存
    pub hit_cache: bool,
    /// 本次生成耗时（毫秒，命中缓存时为 null）
    pub generation_time_ms: Option<u64>,
}

/// 生成（或获取缓存中的）缩略图
///
/// - source_path: 源图片绝对路径
/// - file_hash: 该文件的指纹/哈希（用于作为缓存文件名）
/// - size: small | medium | large（默认 medium）
#[tauri::command]
pub async fn generate_thumbnail(
    _state: State<'_, AppState>,
    source_path: String,
    file_hash: String,
    size: Option<String>,
) -> Result<ThumbnailResponse, CommandError> {
    // 解析尺寸（默认 medium）
    let size = size
        .as_deref()
        .and_then(ThumbnailSize::from_str)
        .unwrap_or(ThumbnailSize::Medium);

    let cache_dir = ThumbnailService::default_cache_dir();
    let service = ThumbnailService::new(cache_dir)
        .map_err(|e| CommandError::from(e))?;

    let path_buf = PathBuf::from(&source_path);

    let result = service
        .get_or_generate(&path_buf, &file_hash, size)
        .map_err(|e| CommandError::from(e))?;

    Ok(ThumbnailResponse {
        path: result.path.to_string_lossy().to_string(),
        hit_cache: result.hit_cache,
        generation_time_ms: result.generation_time_ms,
    })
}

/// 将缩略图任务加入优先级队列（用于批量生成）
///
/// - source_path: 源图片绝对路径
/// - file_hash: 文件哈希
/// - size: small | medium | large（默认 medium）
/// - priority: 优先级（数字越大优先级越高，默认 0）
#[tauri::command]
pub async fn enqueue_thumbnail(
    state: State<'_, AppState>,
    source_path: String,
    file_hash: String,
    size: Option<String>,
    priority: Option<i32>,
) -> Result<(), CommandError> {
    let size = size
        .as_deref()
        .and_then(ThumbnailSize::from_str)
        .unwrap_or(ThumbnailSize::Medium);

    let task = ThumbnailTask::new(
        PathBuf::from(source_path),
        file_hash,
        size,
        priority.unwrap_or(0),
    );

    state.thumbnail_queue.enqueue(task);
    Ok(())
}

/// 批量加入缩略图任务
#[tauri::command]
pub async fn enqueue_thumbnails_batch(
    state: State<'_, AppState>,
    tasks: Vec<ThumbnailTaskInput>,
) -> Result<(), CommandError> {
    let thumbnail_tasks: Vec<ThumbnailTask> = tasks
        .into_iter()
        .map(|input| {
            let size = input
                .size
                .as_deref()
                .and_then(ThumbnailSize::from_str)
                .unwrap_or(ThumbnailSize::Medium);
            ThumbnailTask::new(
                PathBuf::from(input.source_path),
                input.file_hash,
                size,
                input.priority.unwrap_or(0),
            )
        })
        .collect();

    state.thumbnail_queue.enqueue_batch(thumbnail_tasks);
    Ok(())
}

/// 取消指定文件的缩略图生成任务
#[tauri::command]
pub async fn cancel_thumbnail(
    state: State<'_, AppState>,
    file_hash: String,
) -> Result<(), CommandError> {
    state.thumbnail_queue.cancel_by_hash(&file_hash);
    Ok(())
}

/// 检查缩略图缓存是否存在，存在则返回路径
#[tauri::command]
pub async fn get_thumbnail_cache_path(
    _state: State<'_, AppState>,
    file_hash: String,
    size: Option<String>,
) -> Result<Option<String>, CommandError> {
    let size = size
        .as_deref()
        .and_then(ThumbnailSize::from_str)
        .unwrap_or(ThumbnailSize::Medium);

    let cache_dir = ThumbnailService::default_cache_dir();
    let service = ThumbnailService::new(cache_dir)
        .map_err(|e| CommandError::from(e))?;

    if service.is_cached(&file_hash, size) {
        Ok(Some(service.get_cache_path(&file_hash, size).to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

/// 缩略图任务输入（用于批量入队）
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailTaskInput {
    pub source_path: String,
    pub file_hash: String,
    pub size: Option<String>,
    pub priority: Option<i32>,
}
