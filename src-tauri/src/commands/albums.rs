//! 相册管理命令

use tauri::State;

use crate::models::{
    album::{CreateAlbum, UpdateAlbum},
    Album, AlbumWithCount, RecentlyEditedAlbum,
};
use crate::AppState;

/// 创建相册
#[tauri::command]
pub async fn create_album(
    state: State<'_, AppState>,
    album_name: String,
    description: Option<String>,
) -> Result<i64, String> {
    let album = CreateAlbum {
        album_name,
        description,
    };
    state.db.create_album(&album).map_err(|e| e.to_string())
}

/// 获取相册
#[tauri::command]
pub async fn get_album(
    state: State<'_, AppState>,
    album_id: i64,
) -> Result<Option<Album>, String> {
    state.db.get_album(album_id).map_err(|e| e.to_string())
}

/// 根据名称获取相册
#[tauri::command]
pub async fn get_album_by_name(
    state: State<'_, AppState>,
    album_name: String,
) -> Result<Option<Album>, String> {
    state
        .db
        .get_album_by_name(&album_name)
        .map_err(|e| e.to_string())
}

/// 更新相册
#[tauri::command]
pub async fn update_album(
    state: State<'_, AppState>,
    album_id: i64,
    album_name: Option<String>,
    description: Option<String>,
    cover_photo_id: Option<i64>,
    sort_order: Option<i32>,
) -> Result<bool, String> {
    let update = UpdateAlbum {
        album_name,
        description,
        cover_photo_id,
        sort_order,
    };
    state
        .db
        .update_album(album_id, &update)
        .map_err(|e| e.to_string())
}

/// 删除相册
#[tauri::command]
pub async fn delete_album(
    state: State<'_, AppState>,
    album_id: i64,
) -> Result<bool, String> {
    state.db.delete_album(album_id).map_err(|e| e.to_string())
}

/// 获取所有相册
#[tauri::command]
pub async fn get_all_albums(state: State<'_, AppState>) -> Result<Vec<Album>, String> {
    state.db.get_all_albums().map_err(|e| e.to_string())
}

/// 获取所有相册（带照片数量）
#[tauri::command]
pub async fn get_all_albums_with_count(
    state: State<'_, AppState>,
) -> Result<Vec<AlbumWithCount>, String> {
    state
        .db
        .get_all_albums_with_count()
        .map_err(|e| e.to_string())
}

/// 添加照片到相册
#[tauri::command]
pub async fn add_photo_to_album(
    state: State<'_, AppState>,
    album_id: i64,
    photo_id: i64,
) -> Result<bool, String> {
    state
        .db
        .add_photo_to_album(album_id, photo_id)
        .map_err(|e| e.to_string())
}

/// 批量添加照片到相册
#[tauri::command]
pub async fn add_photos_to_album(
    state: State<'_, AppState>,
    album_id: i64,
    photo_ids: Vec<i64>,
) -> Result<usize, String> {
    state
        .db
        .add_photos_to_album(album_id, &photo_ids)
        .map_err(|e| e.to_string())
}

/// 从相册移除照片
#[tauri::command]
pub async fn remove_photo_from_album(
    state: State<'_, AppState>,
    album_id: i64,
    photo_id: i64,
) -> Result<bool, String> {
    state
        .db
        .remove_photo_from_album(album_id, photo_id)
        .map_err(|e| e.to_string())
}

/// 从相册移除所有照片
#[tauri::command]
pub async fn remove_all_photos_from_album(
    state: State<'_, AppState>,
    album_id: i64,
) -> Result<usize, String> {
    state
        .db
        .remove_all_photos_from_album(album_id)
        .map_err(|e| e.to_string())
}

/// 获取相册中的照片 ID 列表
#[tauri::command]
pub async fn get_photo_ids_in_album(
    state: State<'_, AppState>,
    album_id: i64,
) -> Result<Vec<i64>, String> {
    state
        .db
        .get_photo_ids_in_album(album_id)
        .map_err(|e| e.to_string())
}

/// 获取照片所属的相册列表
#[tauri::command]
pub async fn get_albums_for_photo(
    state: State<'_, AppState>,
    photo_id: i64,
) -> Result<Vec<Album>, String> {
    state
        .db
        .get_albums_for_photo(photo_id)
        .map_err(|e| e.to_string())
}

/// 设置相册封面
#[tauri::command]
pub async fn set_album_cover(
    state: State<'_, AppState>,
    album_id: i64,
    photo_id: i64,
) -> Result<bool, String> {
    state
        .db
        .set_album_cover(album_id, photo_id)
        .map_err(|e| e.to_string())
}

/// 重新排序相册内的照片
#[tauri::command]
pub async fn reorder_album_photos(
    state: State<'_, AppState>,
    album_id: i64,
    photo_ids: Vec<i64>,
) -> Result<(), String> {
    state
        .db
        .reorder_album_photos(album_id, &photo_ids)
        .map_err(|e| e.to_string())
}

/// 从多张照片中移除指定相册
#[tauri::command]
pub async fn remove_photos_from_album(
    state: State<'_, AppState>,
    album_id: i64,
    photo_ids: Vec<i64>,
) -> Result<usize, String> {
    let mut count = 0;
    for photo_id in photo_ids {
        if state
            .db
            .remove_photo_from_album(album_id, photo_id)
            .map_err(|e| e.to_string())?
        {
            count += 1;
        }
    }
    Ok(count)
}

/// 获取最近编辑的相册
#[tauri::command]
pub async fn get_recently_edited_album(
    state: State<'_, AppState>,
) -> Result<Option<RecentlyEditedAlbum>, String> {
    state
        .db
        .get_recently_edited_album()
        .map_err(|e| e.to_string())
}
