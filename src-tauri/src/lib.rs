//! PhotoWall - Windows 照片管理软件
//!
//! 基于 Tauri + React + TypeScript + Rust 构建

pub mod commands;
pub mod db;
pub mod models;
pub mod services;
pub mod utils;

use std::sync::Arc;

use commands::{
    // greet
    greet,
    // scanner
    scan_directory, scan_directories, index_directory, index_directories, get_database_stats,
    refresh_photo_metadata,
    // search
    search_photos, search_photos_simple, get_photo, get_photos, get_favorite_photos,
    get_photos_by_tag, get_photos_by_album, set_photo_rating, set_photo_favorite,
    set_photos_favorite, get_camera_models, get_lens_models, get_photo_stats,
    // trash
    get_deleted_photos, soft_delete_photos, restore_photos, permanent_delete_photos,
    empty_trash, get_trash_stats,
    // tags
    create_tag, get_tag, get_tag_by_name, update_tag, delete_tag, get_all_tags,
    get_all_tags_with_count, add_tag_to_photo, add_tags_to_photo, remove_tag_from_photo,
    remove_all_tags_from_photo, get_tags_for_photo, get_or_create_tag, add_tag_to_photos,
    remove_tag_from_photos,
    // albums
    create_album, get_album, get_album_by_name, update_album, delete_album, get_all_albums,
    get_all_albums_with_count, add_photo_to_album, add_photos_to_album, remove_photo_from_album,
    remove_all_photos_from_album, get_photo_ids_in_album, get_albums_for_photo, set_album_cover,
    reorder_album_photos, remove_photos_from_album,
    // thumbnails
    generate_thumbnail, enqueue_thumbnail, enqueue_thumbnails_batch, cancel_thumbnail,
    // file_ops
    import_photos, export_photos, delete_photos, move_photo, copy_photo, batch_rename_photos,
    // settings
    get_settings, save_settings, reset_settings,
    // folder_sync
    get_sync_folders, add_sync_folder, remove_sync_folder, set_auto_sync_enabled,
    get_auto_sync_enabled, trigger_sync_now, validate_folder_path,
    // folders
    get_folder_tree, get_folder_children, get_photos_by_folder, get_folder_photo_count,
};
use db::Database;

/// 应用程序状态
pub struct AppState {
    pub db: Arc<Database>,
    pub thumbnail_queue: Arc<services::ThumbnailQueue>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志系统
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    tracing::info!("PhotoWall 启动中...");

    // 初始化数据库
    let db_path = db::default_db_path();
    tracing::info!("数据库路径: {:?}", db_path);

    let database = Database::open(db_path).expect("无法打开数据库");
    database.init().expect("无法初始化数据库");

    // 初始化缩略图队列
    let thumbnail_cache_dir = services::ThumbnailService::default_cache_dir();
    let thumbnail_service = services::ThumbnailService::new(thumbnail_cache_dir)
        .expect("无法初始化缩略图服务");
    let thumbnail_queue = services::ThumbnailQueue::new(thumbnail_service)
        .expect("无法初始化缩略图队列");

    let app_state = AppState {
        db: Arc::new(database),
        thumbnail_queue: Arc::new(thumbnail_queue),
    };

    tracing::info!("数据库初始化完成");

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // greet
            greet,
            // scanner
            scan_directory,
            scan_directories,
            index_directory,
            index_directories,
            get_database_stats,
            refresh_photo_metadata,
            // search
            search_photos,
            search_photos_simple,
            get_photo,
            get_photos,
            get_favorite_photos,
            get_photos_by_tag,
            get_photos_by_album,
            set_photo_rating,
            set_photo_favorite,
            set_photos_favorite,
            get_camera_models,
            get_lens_models,
            get_photo_stats,
            // trash
            get_deleted_photos,
            soft_delete_photos,
            restore_photos,
            permanent_delete_photos,
            empty_trash,
            get_trash_stats,
            // tags
            create_tag,
            get_tag,
            get_tag_by_name,
            update_tag,
            delete_tag,
            get_all_tags,
            get_all_tags_with_count,
            add_tag_to_photo,
            add_tags_to_photo,
            remove_tag_from_photo,
            remove_all_tags_from_photo,
            get_tags_for_photo,
            get_or_create_tag,
            add_tag_to_photos,
            remove_tag_from_photos,
            // albums
            create_album,
            get_album,
            get_album_by_name,
            update_album,
            delete_album,
            get_all_albums,
            get_all_albums_with_count,
            add_photo_to_album,
            add_photos_to_album,
            remove_photo_from_album,
            remove_all_photos_from_album,
            get_photo_ids_in_album,
            get_albums_for_photo,
            set_album_cover,
            reorder_album_photos,
            remove_photos_from_album,
            // thumbnails
            generate_thumbnail,
            enqueue_thumbnail,
            enqueue_thumbnails_batch,
            cancel_thumbnail,
            // file_ops
            import_photos,
            export_photos,
            delete_photos,
            move_photo,
            copy_photo,
            batch_rename_photos,
            // settings
            get_settings,
            save_settings,
            reset_settings,
            // folder_sync
            get_sync_folders,
            add_sync_folder,
            remove_sync_folder,
            set_auto_sync_enabled,
            get_auto_sync_enabled,
            trigger_sync_now,
            validate_folder_path,
            // folders
            get_folder_tree,
            get_folder_children,
            get_photos_by_folder,
            get_folder_photo_count,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
