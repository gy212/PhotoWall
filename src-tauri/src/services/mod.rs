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
pub mod editor;
pub mod colorspace;
pub mod native_editor;
pub mod auto_scan;
pub mod query_parser;
pub mod ocr;

// 重新导出常用类型
pub use scanner::{Scanner, ScanOptions, ScanResult, ScanProgress, is_image_file, SUPPORTED_FORMATS};
pub use metadata::{MetadataExtractor, ImageMetadata};
pub use hasher::{FileHasher, HashOptions};
pub use indexer::{PhotoIndexer, IndexOptions, IndexProgress, IndexResult};
pub use thumbnail::{ThumbnailService, ThumbnailSize, ThumbnailResult, CacheStats};
pub use thumbnail_queue::{ThumbnailQueue, ThumbnailTask};
pub use watcher::{FileWatcher, WatcherConfig, FileChangeEvent, FileChangeType};
pub use settings::SettingsManager;
pub use editor::{EditorService, EditParams, EditOperation, FlipDirection, CropRect};
pub use auto_scan::{AutoScanManager, AutoScanStatus, StepScanConfig};
pub use query_parser::{QueryParser, ParsedQuery, FieldFilter, FieldOperator};
pub use ocr::{OcrService, OcrResult, OcrProgress, OcrStats, OcrConfig, OcrStatus};
