//! 相册数据模型

use serde::{Deserialize, Serialize};

/// 相册
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Album {
    /// 相册ID
    pub album_id: i64,
    /// 相册名
    pub album_name: String,
    /// 描述
    pub description: Option<String>,
    /// 封面照片ID
    pub cover_photo_id: Option<i64>,
    /// 创建时间
    pub date_created: String,
    /// 排序序号
    pub sort_order: i32,
}

impl Album {
    /// 创建新相册
    pub fn new(album_name: String, description: Option<String>) -> Self {
        Self {
            album_id: 0,
            album_name,
            description,
            cover_photo_id: None,
            date_created: crate::models::photo::chrono_now_pub(),
            sort_order: 0,
        }
    }
}

/// 用于创建新相册的输入结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAlbum {
    pub album_name: String,
    pub description: Option<String>,
}

/// 用于更新相册的输入结构
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAlbum {
    pub album_name: Option<String>,
    pub description: Option<String>,
    pub cover_photo_id: Option<i64>,
    pub sort_order: Option<i32>,
}

/// 相册-照片关联
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumPhoto {
    /// 相册ID
    pub album_id: i64,
    /// 照片ID
    pub photo_id: i64,
    /// 排序序号
    pub sort_order: i32,
    /// 添加时间
    pub date_added: String,
}

impl AlbumPhoto {
    pub fn new(album_id: i64, photo_id: i64, sort_order: i32) -> Self {
        Self {
            album_id,
            photo_id,
            sort_order,
            date_added: crate::models::photo::chrono_now_pub(),
        }
    }
}

/// 带照片数量的相册
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumWithCount {
    #[serde(flatten)]
    pub album: Album,
    /// 照片数量
    pub photo_count: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_album_new() {
        let album = Album::new(
            "旅行照片".to_string(),
            Some("2024年夏季旅行".to_string()),
        );
        assert_eq!(album.album_id, 0);
        assert_eq!(album.album_name, "旅行照片");
        assert_eq!(album.description, Some("2024年夏季旅行".to_string()));
    }

    #[test]
    fn test_album_photo_new() {
        let ap = AlbumPhoto::new(1, 2, 0);
        assert_eq!(ap.album_id, 1);
        assert_eq!(ap.photo_id, 2);
        assert_eq!(ap.sort_order, 0);
    }
}
