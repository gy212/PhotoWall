//! 应用程序设置数据模型

use serde::{Deserialize, Serialize};

/// 主题模式
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum ThemeMode {
    Light,
    Dark,
    #[default]
    System,
}

/// 扫描设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSettings {
    /// 监控的文件夹列表
    pub watched_folders: Vec<String>,
    /// 排除的文件夹模式
    pub excluded_patterns: Vec<String>,
    /// 是否启用自动扫描
    pub auto_scan: bool,
    /// 扫描间隔（秒）
    pub scan_interval: u64,
    /// 是否递归扫描子文件夹
    pub recursive: bool,
    /// 是否启用实时监控
    #[serde(default = "default_realtime_watch")]
    pub realtime_watch: bool,
}

fn default_realtime_watch() -> bool {
    true
}

impl Default for ScanSettings {
    fn default() -> Self {
        Self {
            watched_folders: Vec::new(),
            excluded_patterns: vec![
                String::from("node_modules"),
                String::from(".git"),
                String::from("$RECYCLE.BIN"),
            ],
            auto_scan: false,
            scan_interval: 300, // 5分钟
            recursive: true,
            realtime_watch: true,
        }
    }
}

/// 缩略图设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailSettings {
    /// 缓存大小限制（MB）
    pub cache_size_mb: u64,
    /// 缩略图质量 (0-100)
    pub quality: u8,
    /// 是否启用自动清理
    pub auto_cleanup: bool,
    /// 清理阈值（当缓存超过此百分比时清理）
    pub cleanup_threshold: u8,
    /// 是否启用 LibRaw 提取 RAW 预览（默认启用）
    #[serde(default = "default_libraw_enabled")]
    pub libraw_enabled: bool,
}

fn default_libraw_enabled() -> bool {
    true
}

impl Default for ThumbnailSettings {
    fn default() -> Self {
        Self {
            cache_size_mb: 1024, // 1GB
            quality: 85,
            auto_cleanup: true,
            cleanup_threshold: 90, // 90%
            libraw_enabled: true,
        }
    }
}

/// 性能设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceSettings {
    /// 扫描线程数（0 = 自动）
    pub scan_threads: usize,
    /// 缩略图生成线程数（0 = 自动）
    pub thumbnail_threads: usize,
    /// 是否启用数据库 WAL 模式
    pub enable_wal: bool,
}

impl Default for PerformanceSettings {
    fn default() -> Self {
        Self {
            scan_threads: 0, // 自动
            thumbnail_threads: 0, // 自动
            enable_wal: true,
        }
    }
}

/// 窗口外观设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowSettings {
    /// 窗口背景不透明度 (0.0 - 1.0) - 保留兼容性
    #[serde(default = "default_opacity")]
    pub opacity: f64,
    /// 窗口透明度 (0-100)，0=不透明，100=高度透明
    #[serde(default = "default_transparency")]
    pub transparency: u32,
    /// 模糊半径 (0-100)，0=不模糊，100=最大模糊
    #[serde(default = "default_blur_radius")]
    pub blur_radius: u32,
    /// 是否启用自定义桌面模糊（而非DWM Acrylic）
    #[serde(default = "default_custom_blur_enabled")]
    pub custom_blur_enabled: bool,
}

fn default_opacity() -> f64 {
    0.3
}

fn default_transparency() -> u32 {
    30
}

fn default_blur_radius() -> u32 {
    20
}

fn default_custom_blur_enabled() -> bool {
    false
}

impl Default for WindowSettings {
    fn default() -> Self {
        Self {
            opacity: 0.3,
            transparency: 30,
            blur_radius: 20,
            custom_blur_enabled: false,
        }
    }
}

/// 应用程序设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// 主题模式
    pub theme: ThemeMode,
    /// 语言（预留，目前只支持中文）
    pub language: String,
    /// 扫描设置
    pub scan: ScanSettings,
    /// 缩略图设置
    pub thumbnail: ThumbnailSettings,
    /// 性能设置
    pub performance: PerformanceSettings,
    /// 窗口设置
    #[serde(default)]
    pub window: WindowSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: ThemeMode::default(),
            language: String::from("zh-CN"),
            scan: ScanSettings::default(),
            thumbnail: ThumbnailSettings::default(),
            performance: PerformanceSettings::default(),
            window: WindowSettings::default(),
        }
    }
}
