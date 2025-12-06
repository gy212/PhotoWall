//! PhotoWall 数据模型模块
//!
//! 包含所有数据结构定义

pub mod photo;
pub mod tag;
pub mod album;
pub mod settings;

// 重新导出常用类型
pub use photo::{Photo, CreatePhoto, UpdatePhoto};
pub use tag::{Tag, CreateTag, UpdateTag, PhotoTag, TagWithCount};
pub use album::{Album, CreateAlbum, UpdateAlbum, AlbumPhoto, AlbumWithCount};
pub use settings::{
    AppSettings, ThemeMode, ScanSettings, ThumbnailSettings, PerformanceSettings,
};

/// 分页参数
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginationParams {
    pub page: u32,
    pub page_size: u32,
}

impl Default for PaginationParams {
    fn default() -> Self {
        Self {
            page: 1,
            page_size: 50,
        }
    }
}

/// 分页结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedResult<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
    pub total_pages: u32,
}

impl<T> PaginatedResult<T> {
    pub fn new(items: Vec<T>, total: i64, pagination: &PaginationParams) -> Self {
        let total_pages = ((total as f64) / (pagination.page_size as f64)).ceil() as u32;
        Self {
            items,
            total,
            page: pagination.page,
            page_size: pagination.page_size,
            total_pages,
        }
    }
}

/// 排序方向
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum SortOrder {
    #[default]
    Asc,
    Desc,
}

impl SortOrder {
    pub fn as_sql(&self) -> &'static str {
        match self {
            SortOrder::Asc => "ASC",
            SortOrder::Desc => "DESC",
        }
    }
}

/// 照片排序字段
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum PhotoSortField {
    #[default]
    DateTaken,
    DateAdded,
    FileName,
    FileSize,
    Rating,
}

impl PhotoSortField {
    pub fn as_column(&self) -> &'static str {
        match self {
            PhotoSortField::DateTaken => "date_taken",
            PhotoSortField::DateAdded => "date_added",
            PhotoSortField::FileName => "file_name",
            PhotoSortField::FileSize => "file_size",
            PhotoSortField::Rating => "rating",
        }
    }
}

/// 照片排序选项
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PhotoSortOptions {
    pub field: PhotoSortField,
    pub order: SortOrder,
}

/// 搜索过滤器
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SearchFilters {
    /// 搜索查询（文件名、相机型号等）
    pub query: Option<String>,
    /// 开始日期 (ISO 8601)
    pub date_from: Option<String>,
    /// 结束日期 (ISO 8601)
    pub date_to: Option<String>,
    /// 标签ID列表
    pub tag_ids: Option<Vec<i64>>,
    /// 相册ID
    pub album_id: Option<i64>,
    /// 相机型号
    pub camera_model: Option<String>,
    /// 镜头型号
    pub lens_model: Option<String>,
    /// 最低评分
    pub min_rating: Option<i32>,
    /// 最高评分
    pub max_rating: Option<i32>,
    /// 仅收藏
    pub favorites_only: Option<bool>,
    /// 有 GPS 信息
    pub has_gps: Option<bool>,
}

/// 搜索结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub photos: PaginatedResult<Photo>,
    /// 搜索耗时（毫秒）
    pub elapsed_ms: u64,
}
