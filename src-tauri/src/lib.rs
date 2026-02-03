//! PhotoWall - Windows 照片管理软件
//!
//! 基于 Tauri + React + TypeScript + Rust 构建

pub mod adapters;
pub mod commands;
pub mod db;
pub mod models;
pub mod services;
pub mod utils;
pub mod window_effects;

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime};

use tokio::sync::Semaphore;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
use tauri::{Listener, Manager};

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
    get_recently_edited_photo,
    // trash
    get_deleted_photos, soft_delete_photos, restore_photos, permanent_delete_photos,
    empty_trash, get_trash_stats,
    // search suggestions
    get_search_suggestions,
    // tags
    create_tag, get_tag, get_tag_by_name, update_tag, delete_tag, get_all_tags,
    get_all_tags_with_count, add_tag_to_photo, add_tags_to_photo, remove_tag_from_photo,
    remove_all_tags_from_photo, get_tags_for_photo, get_or_create_tag, add_tag_to_photos,
    remove_tag_from_photos,
    // albums
    create_album, get_album, get_album_by_name, update_album, delete_album, get_all_albums,
    get_all_albums_with_count, add_photo_to_album, add_photos_to_album, remove_photo_from_album,
    remove_all_photos_from_album, get_photo_ids_in_album, get_albums_for_photo, set_album_cover,
    reorder_album_photos, remove_photos_from_album, get_recently_edited_album,
    // smart albums
    create_smart_album, get_smart_album, get_all_smart_albums, update_smart_album, delete_smart_album,
    // thumbnails
    generate_thumbnail, enqueue_thumbnail, enqueue_thumbnails_batch, cancel_thumbnail, get_thumbnail_cache_path,
    get_libraw_status, get_thumbnail_stats, check_thumbnails_cached, warm_thumbnail_cache, get_raw_preview,
    // file_ops
    import_photos, export_photos, delete_photos, move_photo, copy_photo, batch_rename_photos,
    // settings
    get_settings,
    save_settings,
    reset_settings,
    apply_window_settings,
    clear_blur_cache,
    set_exclude_from_capture,
    get_blurred_desktop,
    is_composition_blur_supported,
    enable_composition_blur,
    disable_composition_blur,
    set_composition_blur_radius,
    set_composition_tint,
    // folder_sync
    get_sync_folders, add_sync_folder, remove_sync_folder, set_auto_sync_enabled,
    get_auto_sync_enabled, trigger_sync_now, validate_folder_path,
    // folders
    get_folder_tree, get_folder_children, get_photos_by_folder, get_folder_photo_count,
    // logging
    log_frontend,
    // edit
    apply_photo_edits, get_edit_preview, is_photo_editable,
    // auto_scan
    start_auto_scan, stop_auto_scan, get_auto_scan_status, get_directory_scan_states,
    reset_directory_scan_frequency, trigger_directory_scan,
    // ocr
    check_ocr_available, get_ocr_languages, get_ocr_stats, get_ocr_progress,
    start_ocr_processing, stop_ocr_processing, ocr_single_photo, reset_ocr_status,
    reset_failed_ocr, OcrState,
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
    /// 自动扫描管理器
    pub auto_scan_manager: tokio::sync::Mutex<Option<services::AutoScanManager>>,
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

    // 初始化缩略图服务（队列在 setup 中根据设置创建）
    let thumbnail_cache_dir = services::ThumbnailService::default_cache_dir();
    let thumbnail_service = services::ThumbnailService::new(thumbnail_cache_dir)
        .expect("无法初始化缩略图服务");
    let db = Arc::new(database);

    tracing::info!("数据库初始化完成");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
            get_recently_edited_photo,
            // trash
            get_deleted_photos,
            soft_delete_photos,
            restore_photos,
            permanent_delete_photos,
            empty_trash,
            get_trash_stats,
            // search suggestions
            get_search_suggestions,
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
            get_recently_edited_album,
            // smart albums
            create_smart_album,
            get_smart_album,
            get_all_smart_albums,
            update_smart_album,
            delete_smart_album,
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
            get_raw_preview,
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
            apply_window_settings,
            clear_blur_cache,
            set_exclude_from_capture,
            get_blurred_desktop,
            is_composition_blur_supported,
            enable_composition_blur,
            disable_composition_blur,
            set_composition_blur_radius,
            set_composition_tint,
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
            // edit
            apply_photo_edits,
            get_edit_preview,
            is_photo_editable,
            // auto_scan
            start_auto_scan,
            stop_auto_scan,
            get_auto_scan_status,
            get_directory_scan_states,
            reset_directory_scan_frequency,
            trigger_directory_scan,
            // ocr
            check_ocr_available,
            get_ocr_languages,
            get_ocr_stats,
            get_ocr_progress,
            start_ocr_processing,
            stop_ocr_processing,
            ocr_single_photo,
            reset_ocr_status,
            reset_failed_ocr,
        ])
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let startup_ready = Arc::new(AtomicBool::new(false));

            // 设置全局 AppHandle，用于 thumbnail_queue worker 发送事件
            // 同时设置 photowall-core 的 EventSink
            services::thumbnail_queue::set_app_handle(app_handle.clone());
            let event_sink = adapters::TauriEventSink::shared(app_handle.clone());
            photowall_core::services::set_event_sink(event_sink);

            let settings = services::SettingsManager::new(&app_handle)
                .and_then(|manager| manager.load())
                .unwrap_or_else(|err| {
                    tracing::warn!("加载设置失败，使用默认设置: {}", err);
                    crate::models::AppSettings::default()
                });

            // Window Effects (sync with settings, and reapply on focus changes)
            if let Some(window) = app.get_webview_window("main") {
                crate::window_effects::apply_window_settings(&window, settings.window.clone());

                let window_for_events = window.clone();
                window.on_window_event(move |event| {
                    use tauri::WindowEvent;
                    match event {
                        WindowEvent::Focused(focused) => {
                            if *focused {
                                crate::window_effects::reapply_last_window_settings(&window_for_events);
                            } else {
                                // 延迟重应用，避免 Windows 状态冲突
                                let window_clone = window_for_events.clone();
                                std::thread::spawn(move || {
                                    std::thread::sleep(std::time::Duration::from_millis(50));
                                    crate::window_effects::reapply_last_window_settings(&window_clone);
                                });
                            }
                        }
                        WindowEvent::Resized(_)
                        | WindowEvent::ScaleFactorChanged { .. }
                        | WindowEvent::ThemeChanged(_) => {
                            crate::window_effects::reapply_last_window_settings(&window_for_events);
                        }
                        _ => {}
                    }
                });
            }

            // Splash：仅在前端确认可用后关闭，并提供超时兜底，避免“卡在加载”或“白屏”。
            if let (Some(main_window), Some(splash_window)) = (
                app.get_webview_window("main"),
                app.get_webview_window("splash"),
            ) {
                let ready_flag = startup_ready.clone();
                let main_for_event = main_window.clone();
                let splash_for_event = splash_window.clone();
                app_handle.listen("photowall://frontend-ready", move |_event| {
                    if ready_flag.swap(true, Ordering::SeqCst) {
                        return;
                    }
                    tracing::info!("frontend-ready received, closing splash");
                    let _ = splash_for_event.close();
                    let _ = main_for_event.show();
                    let _ = main_for_event.set_focus();
                });

                let ready_flag = startup_ready.clone();
                let main_for_event = main_window.clone();
                let splash_for_event = splash_window.clone();
                app_handle.listen("photowall://frontend-fatal", move |_event| {
                    if ready_flag.swap(true, Ordering::SeqCst) {
                        return;
                    }
                    tracing::warn!("frontend-fatal received, closing splash");
                    let _ = splash_for_event.close();
                    let _ = main_for_event.show();
                    let _ = main_for_event.set_focus();
                });

                let ready_flag = startup_ready.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(Duration::from_secs(12)).await;
                    if ready_flag.swap(true, Ordering::SeqCst) {
                        return;
                    }
                    tracing::warn!("frontend-ready timeout, closing splash");
                    let _ = splash_window.close();
                    let _ = main_window.show();
                    let _ = main_window.set_focus();
                });
            }

            let configured_threads = settings.performance.thumbnail_threads;
            let cpu_threads = std::thread::available_parallelism()
                .map(|n| n.get())
                .unwrap_or(4);
            let auto_threads = ((cpu_threads + 1) / 2).clamp(1, 4);
            let thumbnail_threads = (if configured_threads == 0 {
                auto_threads
            } else {
                configured_threads
            })
            .max(1)
            .min(8);

            tracing::info!(
                "缩略图线程数: {} (设置: {}, CPU: {})",
                thumbnail_threads,
                configured_threads,
                cpu_threads
            );

            let thumbnail_queue = services::ThumbnailQueue::with_worker_count(
                thumbnail_service.clone(),
                thumbnail_threads,
            )
            .expect("无法初始化缩略图队列");

            // 创建自动扫描管理器
            let auto_scan_manager = services::AutoScanManager::with_defaults(db.clone());

            let app_state = AppState {
                db: db.clone(),
                thumbnail_service: thumbnail_service.clone(),
                thumbnail_queue: Arc::new(thumbnail_queue),
                thumbnail_limiter: Arc::new(Semaphore::new(thumbnail_threads)),
                thumbnail_limiter_raw: Arc::new(Semaphore::new(1)),
                auto_scan_manager: tokio::sync::Mutex::new(Some(auto_scan_manager)),
            };

            app.manage(app_state);
            app.manage(db.clone()); // For OCR commands
            app.manage(OcrState::new());

            // Start/stop auto-scan service based on persisted settings.
            let app_handle = app.handle().clone();
            let startup_settings = settings.clone();
            tauri::async_runtime::spawn(async move {
                let state = app_handle.state::<AppState>();
                let mut auto_scan = state.auto_scan_manager.lock().await;
                if let Some(ref mut manager) = *auto_scan {
                    if let Err(e) = manager.apply_settings(app_handle.clone(), &startup_settings).await {
                        tracing::error!("apply auto scan settings failed: {}", e);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
