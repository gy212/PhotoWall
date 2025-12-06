//! 标签数据模型

use serde::{Deserialize, Serialize};

/// 标签
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    /// 标签ID
    pub tag_id: i64,
    /// 标签名
    pub tag_name: String,
    /// 标签颜色 (十六进制，如 #FF5733)
    pub color: Option<String>,
    /// 创建时间
    pub date_created: String,
}

impl Tag {
    /// 创建新标签
    pub fn new(tag_name: String, color: Option<String>) -> Self {
        Self {
            tag_id: 0,
            tag_name,
            color,
            date_created: crate::models::photo::chrono_now_pub(),
        }
    }
}

/// 用于创建新标签的输入结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTag {
    pub tag_name: String,
    pub color: Option<String>,
}

/// 用于更新标签的输入结构
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTag {
    pub tag_name: Option<String>,
    pub color: Option<String>,
}

/// 照片-标签关联
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhotoTag {
    /// 照片ID
    pub photo_id: i64,
    /// 标签ID
    pub tag_id: i64,
    /// 关联创建时间
    pub date_created: String,
}

impl PhotoTag {
    pub fn new(photo_id: i64, tag_id: i64) -> Self {
        Self {
            photo_id,
            tag_id,
            date_created: crate::models::photo::chrono_now_pub(),
        }
    }
}

/// 带照片数量的标签
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagWithCount {
    #[serde(flatten)]
    pub tag: Tag,
    /// 照片数量
    pub photo_count: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tag_new() {
        let tag = Tag::new("风景".to_string(), Some("#4CAF50".to_string()));
        assert_eq!(tag.tag_id, 0);
        assert_eq!(tag.tag_name, "风景");
        assert_eq!(tag.color, Some("#4CAF50".to_string()));
    }

    #[test]
    fn test_photo_tag_new() {
        let pt = PhotoTag::new(1, 2);
        assert_eq!(pt.photo_id, 1);
        assert_eq!(pt.tag_id, 2);
    }
}
