//! 标签管理命令

use tauri::State;

use crate::models::{
    tag::{CreateTag, UpdateTag},
    Tag, TagWithCount,
};
use crate::AppState;

/// 创建标签
#[tauri::command]
pub async fn create_tag(
    state: State<'_, AppState>,
    tag_name: String,
    color: Option<String>,
) -> Result<i64, String> {
    let tag = CreateTag { tag_name, color };
    state.db.create_tag(&tag).map_err(|e| e.to_string())
}

/// 获取标签
#[tauri::command]
pub async fn get_tag(
    state: State<'_, AppState>,
    tag_id: i64,
) -> Result<Option<Tag>, String> {
    state.db.get_tag(tag_id).map_err(|e| e.to_string())
}

/// 根据名称获取标签
#[tauri::command]
pub async fn get_tag_by_name(
    state: State<'_, AppState>,
    tag_name: String,
) -> Result<Option<Tag>, String> {
    state.db.get_tag_by_name(&tag_name).map_err(|e| e.to_string())
}

/// 更新标签
#[tauri::command]
pub async fn update_tag(
    state: State<'_, AppState>,
    tag_id: i64,
    tag_name: Option<String>,
    color: Option<String>,
) -> Result<bool, String> {
    let update = UpdateTag { tag_name, color };
    state.db.update_tag(tag_id, &update).map_err(|e| e.to_string())
}

/// 删除标签
#[tauri::command]
pub async fn delete_tag(
    state: State<'_, AppState>,
    tag_id: i64,
) -> Result<bool, String> {
    state.db.delete_tag(tag_id).map_err(|e| e.to_string())
}

/// 获取所有标签
#[tauri::command]
pub async fn get_all_tags(state: State<'_, AppState>) -> Result<Vec<Tag>, String> {
    state.db.get_all_tags().map_err(|e| e.to_string())
}

/// 获取所有标签（带照片数量）
#[tauri::command]
pub async fn get_all_tags_with_count(
    state: State<'_, AppState>,
) -> Result<Vec<TagWithCount>, String> {
    state.db.get_all_tags_with_count().map_err(|e| e.to_string())
}

/// 为照片添加标签
#[tauri::command]
pub async fn add_tag_to_photo(
    state: State<'_, AppState>,
    photo_id: i64,
    tag_id: i64,
) -> Result<bool, String> {
    state
        .db
        .add_tag_to_photo(photo_id, tag_id)
        .map_err(|e| e.to_string())
}

/// 为照片批量添加标签
#[tauri::command]
pub async fn add_tags_to_photo(
    state: State<'_, AppState>,
    photo_id: i64,
    tag_ids: Vec<i64>,
) -> Result<usize, String> {
    state
        .db
        .add_tags_to_photo(photo_id, &tag_ids)
        .map_err(|e| e.to_string())
}

/// 从照片移除标签
#[tauri::command]
pub async fn remove_tag_from_photo(
    state: State<'_, AppState>,
    photo_id: i64,
    tag_id: i64,
) -> Result<bool, String> {
    state
        .db
        .remove_tag_from_photo(photo_id, tag_id)
        .map_err(|e| e.to_string())
}

/// 移除照片的所有标签
#[tauri::command]
pub async fn remove_all_tags_from_photo(
    state: State<'_, AppState>,
    photo_id: i64,
) -> Result<usize, String> {
    state
        .db
        .remove_all_tags_from_photo(photo_id)
        .map_err(|e| e.to_string())
}

/// 获取照片的所有标签
#[tauri::command]
pub async fn get_tags_for_photo(
    state: State<'_, AppState>,
    photo_id: i64,
) -> Result<Vec<Tag>, String> {
    state
        .db
        .get_tags_for_photo(photo_id)
        .map_err(|e| e.to_string())
}

/// 获取或创建标签
#[tauri::command]
pub async fn get_or_create_tag(
    state: State<'_, AppState>,
    tag_name: String,
    color: Option<String>,
) -> Result<Tag, String> {
    state
        .db
        .get_or_create_tag(&tag_name, color)
        .map_err(|e| e.to_string())
}

/// 为多张照片批量添加标签
#[tauri::command]
pub async fn add_tag_to_photos(
    state: State<'_, AppState>,
    photo_ids: Vec<i64>,
    tag_id: i64,
) -> Result<usize, String> {
    let mut count = 0;
    for photo_id in photo_ids {
        if state.db.add_tag_to_photo(photo_id, tag_id).map_err(|e| e.to_string())? {
            count += 1;
        }
    }
    Ok(count)
}

/// 从多张照片批量移除标签
#[tauri::command]
pub async fn remove_tag_from_photos(
    state: State<'_, AppState>,
    photo_ids: Vec<i64>,
    tag_id: i64,
) -> Result<usize, String> {
    let mut count = 0;
    for photo_id in photo_ids {
        if state
            .db
            .remove_tag_from_photo(photo_id, tag_id)
            .map_err(|e| e.to_string())?
        {
            count += 1;
        }
    }
    Ok(count)
}
