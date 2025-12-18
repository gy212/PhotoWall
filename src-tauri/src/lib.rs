//! PhotoWall - Windows 照片管理软件
//!
//! 基于 Tauri + React + TypeScript + Rust 构建

pub mod commands;
pub mod db;
pub mod models;
pub mod services;
pub mod utils;

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use tokio::sync::Semaphore;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use commands::{
    // greet
    greet,
    // scanner
    scan_directory, scan_directories, index_directory, index_directories, get_database_stats,
    refresh_photo_metadata,
    // search
    search_photos, search_photos_cursor, search_photos_simple, get_photo, get_photos,
    get_photos_cursor, get_favorite_photos,
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
    generate_thumbnail, enqueue_thumbnail, enqueue_thumbnails_batch, cancel_thumbnail, get_thumbnail_cache_path,
    get_libraw_status, get_thumbnail_stats, check_thumbnails_cached, warm_thumbnail_cache,
    // file_ops
    import_photos, export_photos, delete_photos, move_photo, copy_photo, batch_rename_photos,
    // settings
    get_settings, save_settings, reset_settings,
    // folder_sync
    get_sync_folders, add_sync_folder, remove_sync_folder, set_auto_sync_enabled,
    get_auto_sync_enabled, trigger_sync_now, validate_folder_path,
    // folders
    get_folder_tree, get_folder_children, get_photos_by_folder, get_folder_photo_count,
    // logging
    log_frontend,
};
use db::Database;

/// 应用程序状态
pub struct AppState {
    pub db: Arc<Database>,
    pub thumbnail_service: services::ThumbnailService,
    pub thumbnail_queue: Arc<services::ThumbnailQueue>,
    /// 普通格式（JPEG/PNG/WebP 等）缩略图并发限制
    pub thumbnail_limiter: Arc<Semaphore>,
    /// RAW 格式缩略图并发限制（隔离慢任务，避免堵塞普通缩略图）
    pub thumbnail_limiter_raw: Arc<Semaphore>,
}

/// 获取日志目录路径
pub fn get_log_dir() -> PathBuf {
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("logs")
}

/// 清理超过指定天数的旧日志文件
fn cleanup_old_logs(log_dir: &Path, keep_days: u64) {
    let cutoff = SystemTime::now() - Duration::from_secs(keep_days * 24 * 60 * 60);

    if let Ok(entries) = std::fs::read_dir(log_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "log").unwrap_or(false) {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        if modified < cutoff {
                            let _ = std::fs::remove_file(&path);
                        }
                    }
                }
            }
        }
    }
}

/// 初始化日志系统
fn init_logging() {
    let log_dir = get_log_dir();
    std::fs::create_dir_all(&log_dir).ok();

    // 清理超过 7 天的旧日志
    cleanup_old_logs(&log_dir, 7);

    // 后端日志: backend.YYYY-MM-DD.log
    let backend_appender = RollingFileAppender::new(Rotation::DAILY, &log_dir, "backend.log");

    let env_filter = EnvFilter::from_default_env().add_directive(tracing::Level::INFO.into());

    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt::layer().with_writer(std::io::stdout))
        .with(fmt::layer().with_writer(backend_appender).with_ansi(false))
        .init();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志系统
    init_logging();

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
    let thumbnail_queue = services::ThumbnailQueue::new(thumbnail_service.clone())
        .expect("无法初始化缩略图队列");

    let app_state = AppState {
        db: Arc::new(database),
        thumbnail_service,
        thumbnail_queue: Arc::new(thumbnail_queue),
        // 普通格式并发限制：适当提高到 4，因为 JPEG/PNG 解码较快
        thumbnail_limiter: Arc::new(Semaphore::new(4)),
        // RAW 格式并发限制：只允许 1 个，避免慢任务堵塞整个队列
        thumbnail_limiter_raw: Arc::new(Semaphore::new(1)),
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
            search_photos_cursor,
            search_photos_simple,
            get_photo,
            get_photos,
            get_photos_cursor,
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
            get_thumbnail_cache_path,
            get_libraw_status,
            get_thumbnail_stats,
            check_thumbnails_cached,
            warm_thumbnail_cache,
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
            // logging
            log_frontend,
        ])
        .setup(|app| {
            // 设置全局 AppHandle，用于 thumbnail_queue worker 发送事件
            services::thumbnail_queue::set_app_handle(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
