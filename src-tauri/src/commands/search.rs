//! 搜索相关命令

use std::time::Instant;

use tauri::State;

use crate::db::photo_dao::{PhotoStats, TrashStats};
use crate::models::{
    PaginatedResult, PaginationParams, Photo, PhotoSortOptions, SearchFilters, SearchResult,
};
use crate::AppState;

/// 搜索照片
#[tauri::command]
pub async fn search_photos(
    state: State<'_, AppState>,
    filters: SearchFilters,
    pagination: PaginationParams,
    sort: PhotoSortOptions,
) -> Result<SearchResult, String> {
    let start = Instant::now();

    let result = state
        .db
        .search_photos(&filters, &pagination, &sort)
        .map_err(|e| e.to_string())?;

    let elapsed_ms = start.elapsed().as_millis() as u64;

    Ok(SearchResult {
        photos: result,
        elapsed_ms,
    })
}

/// 简单文本搜索
#[tauri::command]
pub async fn search_photos_simple(
    state: State<'_, AppState>,
    query: String,
    pagination: PaginationParams,
) -> Result<PaginatedResult<Photo>, String> {
    state
        .db
        .search_photos_simple(&query, &pagination)
        .map_err(|e| e.to_string())
}

/// 获取照片详情
#[tauri::command]
pub async fn get_photo(
    state: State<'_, AppState>,
    photo_id: i64,
) -> Result<Option<Photo>, String> {
    state.db.get_photo(photo_id).map_err(|e| e.to_string())
}

/// 获取照片列表（分页）
#[tauri::command]
pub async fn get_photos(
    state: State<'_, AppState>,
    pagination: PaginationParams,
    sort: PhotoSortOptions,
) -> Result<PaginatedResult<Photo>, String> {
    state
        .db
        .get_photos(&pagination, &sort)
        .map_err(|e| e.to_string())
}

/// 获取收藏的照片
#[tauri::command]
pub async fn get_favorite_photos(
    state: State<'_, AppState>,
    pagination: PaginationParams,
) -> Result<PaginatedResult<Photo>, String> {
    state
        .db
        .get_favorite_photos(&pagination)
        .map_err(|e| e.to_string())
}

/// 根据标签获取照片
#[tauri::command]
pub async fn get_photos_by_tag(
    state: State<'_, AppState>,
    tag_id: i64,
    pagination: PaginationParams,
    sort: PhotoSortOptions,
) -> Result<PaginatedResult<Photo>, String> {
    state
        .db
        .get_photos_by_tag(tag_id, &pagination, &sort)
        .map_err(|e| e.to_string())
}

/// 根据相册获取照片
#[tauri::command]
pub async fn get_photos_by_album(
    state: State<'_, AppState>,
    album_id: i64,
    pagination: PaginationParams,
) -> Result<PaginatedResult<Photo>, String> {
    state
        .db
        .get_photos_by_album(album_id, &pagination)
        .map_err(|e| e.to_string())
}

/// 设置照片评分
#[tauri::command]
pub async fn set_photo_rating(
    state: State<'_, AppState>,
    photo_id: i64,
    rating: i32,
) -> Result<bool, String> {
    state
        .db
        .set_photo_rating(photo_id, rating)
        .map_err(|e| e.to_string())
}

/// 设置照片收藏状态
#[tauri::command]
pub async fn set_photo_favorite(
    state: State<'_, AppState>,
    photo_id: i64,
    is_favorite: bool,
) -> Result<bool, String> {
    state
        .db
        .set_photo_favorite(photo_id, is_favorite)
        .map_err(|e| e.to_string())
}

/// 批量设置照片收藏状态
#[tauri::command]
pub async fn set_photos_favorite(
    state: State<'_, AppState>,
    photo_ids: Vec<i64>,
    is_favorite: bool,
) -> Result<usize, String> {
    state
        .db
        .set_photos_favorite(&photo_ids, is_favorite)
        .map_err(|e| e.to_string())
}

/// 获取相机型号列表
#[tauri::command]
pub async fn get_camera_models(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    state.db.get_camera_models().map_err(|e| e.to_string())
}

/// 获取镜头型号列表
#[tauri::command]
pub async fn get_lens_models(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    state.db.get_lens_models().map_err(|e| e.to_string())
}

/// 获取照片统计信息
#[tauri::command]
pub async fn get_photo_stats(state: State<'_, AppState>) -> Result<PhotoStats, String> {
    state.db.get_photo_stats().map_err(|e| e.to_string())
}

// ==================== 回收站功能 ====================

/// 获取已删除的照片（回收站）
#[tauri::command]
pub async fn get_deleted_photos(
    state: State<'_, AppState>,
    pagination: PaginationParams,
) -> Result<PaginatedResult<Photo>, String> {
    state
        .db
        .get_deleted_photos(&pagination)
        .map_err(|e| e.to_string())
}

/// 软删除照片（移入回收站）
#[tauri::command]
pub async fn soft_delete_photos(
    state: State<'_, AppState>,
    photo_ids: Vec<i64>,
) -> Result<usize, String> {
    state
        .db
        .soft_delete_photos(&photo_ids)
        .map_err(|e| e.to_string())
}

/// 恢复照片（从回收站恢复）
#[tauri::command]
pub async fn restore_photos(
    state: State<'_, AppState>,
    photo_ids: Vec<i64>,
) -> Result<usize, String> {
    state
        .db
        .restore_photos(&photo_ids)
        .map_err(|e| e.to_string())
}

/// 永久删除照片（彻底删除）
#[tauri::command]
pub async fn permanent_delete_photos(
    state: State<'_, AppState>,
    photo_ids: Vec<i64>,
) -> Result<usize, String> {
    state
        .db
        .permanent_delete_photos(&photo_ids)
        .map_err(|e| e.to_string())
}

/// 清空回收站
#[tauri::command]
pub async fn empty_trash(state: State<'_, AppState>) -> Result<usize, String> {
    state.db.empty_trash().map_err(|e| e.to_string())
}

/// 获取回收站统计信息
#[tauri::command]
pub async fn get_trash_stats(state: State<'_, AppState>) -> Result<TrashStats, String> {
    state.db.get_trash_stats().map_err(|e| e.to_string())
}
