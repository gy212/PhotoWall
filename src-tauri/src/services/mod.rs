//! PhotoWall 服务模块
//!
//! 包含所有业务逻辑服务

pub mod scanner;
pub mod metadata;
pub mod hasher;
pub mod indexer;
pub mod thumbnail;
pub mod thumbnail_queue;
pub mod watcher;
pub mod settings;
pub mod libraw;
pub mod wic;
pub mod desktop_blur;
#[cfg(target_os = "windows")]
pub mod composition_backdrop;

// 重新导出常用类型
pub use scanner::{Scanner, ScanOptions, ScanResult, ScanProgress, is_image_file, SUPPORTED_FORMATS};
pub use metadata::{MetadataExtractor, ImageMetadata};
pub use hasher::{FileHasher, HashOptions};
pub use indexer::{PhotoIndexer, IndexOptions, IndexProgress, IndexResult};
pub use thumbnail::{ThumbnailService, ThumbnailSize, ThumbnailResult, CacheStats};
pub use thumbnail_queue::{ThumbnailQueue, ThumbnailTask};
pub use watcher::{FileWatcher, WatcherConfig, FileChangeEvent, FileChangeType};
pub use settings::SettingsManager;
pub use desktop_blur::DesktopBlurService;
