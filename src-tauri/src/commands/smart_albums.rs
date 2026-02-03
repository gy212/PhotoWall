//! 智能相册相关命令

use tauri::State;

use crate::db::{SmartAlbum, CreateSmartAlbum, UpdateSmartAlbum};
use crate::AppState;

/// 创建智能相册
#[tauri::command]
pub async fn create_smart_album(
    state: State<'_, AppState>,
    album: CreateSmartAlbum,
) -> Result<i64, String> {
    state
        .db
        .create_smart_album(&album)
        .map_err(|e| e.to_string())
}

/// 获取智能相册
#[tauri::command]
pub async fn get_smart_album(
    state: State<'_, AppState>,
    smart_album_id: i64,
) -> Result<Option<SmartAlbum>, String> {
    state
        .db
        .get_smart_album(smart_album_id)
        .map_err(|e| e.to_string())
}

/// 获取所有智能相册
#[tauri::command]
pub async fn get_all_smart_albums(
    state: State<'_, AppState>,
) -> Result<Vec<SmartAlbum>, String> {
    state
        .db
        .get_all_smart_albums()
        .map_err(|e| e.to_string())
}

/// 更新智能相册
#[tauri::command]
pub async fn update_smart_album(
    state: State<'_, AppState>,
    smart_album_id: i64,
    update: UpdateSmartAlbum,
) -> Result<bool, String> {
    state
        .db
        .update_smart_album(smart_album_id, &update)
        .map_err(|e| e.to_string())
}

/// 删除智能相册
#[tauri::command]
pub async fn delete_smart_album(
    state: State<'_, AppState>,
    smart_album_id: i64,
) -> Result<bool, String> {
    state
        .db
        .delete_smart_album(smart_album_id)
        .map_err(|e| e.to_string())
}
