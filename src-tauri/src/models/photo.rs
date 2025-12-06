//! 照片数据模型

use serde::{Deserialize, Serialize};

/// 照片信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Photo {
    /// 照片ID
    pub photo_id: i64,
    /// 文件路径
    pub file_path: String,
    /// 文件名
    pub file_name: String,
    /// 文件大小（字节）
    pub file_size: i64,
    /// 文件哈希
    pub file_hash: String,
    /// 宽度
    pub width: Option<i32>,
    /// 高度
    pub height: Option<i32>,
    /// 格式
    pub format: Option<String>,
    /// 拍摄时间
    pub date_taken: Option<String>,
    /// 添加时间
    pub date_added: String,
    /// 修改时间
    pub date_modified: Option<String>,
    /// 相机型号
    pub camera_model: Option<String>,
    /// 镜头型号
    pub lens_model: Option<String>,
    /// 焦距
    pub focal_length: Option<f64>,
    /// 光圈
    pub aperture: Option<f64>,
    /// ISO
    pub iso: Option<i32>,
    /// 快门速度
    pub shutter_speed: Option<String>,
    /// GPS 纬度
    pub gps_latitude: Option<f64>,
    /// GPS 经度
    pub gps_longitude: Option<f64>,
    /// 方向
    pub orientation: Option<i32>,
    /// 评分 (0-5)
    pub rating: i32,
    /// 是否收藏
    pub is_favorite: bool,
    /// 是否已删除（软删除）
    pub is_deleted: bool,
    /// 删除时间
    pub deleted_at: Option<String>,
}

impl Photo {
    /// 创建新照片记录（用于插入前）
    pub fn new(
        file_path: String,
        file_name: String,
        file_size: i64,
        file_hash: String,
    ) -> Self {
        Self {
            photo_id: 0, // 插入后由数据库分配
            file_path,
            file_name,
            file_size,
            file_hash,
            width: None,
            height: None,
            format: None,
            date_taken: None,
            date_added: chrono_now(),
            date_modified: None,
            camera_model: None,
            lens_model: None,
            focal_length: None,
            aperture: None,
            iso: None,
            shutter_speed: None,
            gps_latitude: None,
            gps_longitude: None,
            orientation: None,
            rating: 0,
            is_favorite: false,
            is_deleted: false,
            deleted_at: None,
        }
    }
}

/// 用于创建新照片的输入结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePhoto {
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub file_hash: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub format: Option<String>,
    pub date_taken: Option<String>,
    pub camera_model: Option<String>,
    pub lens_model: Option<String>,
    pub focal_length: Option<f64>,
    pub aperture: Option<f64>,
    pub iso: Option<i32>,
    pub shutter_speed: Option<String>,
    pub gps_latitude: Option<f64>,
    pub gps_longitude: Option<f64>,
    pub orientation: Option<i32>,
}

/// 用于更新照片的输入结构
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePhoto {
    pub rating: Option<i32>,
    pub is_favorite: Option<bool>,
    pub date_taken: Option<String>,
    pub camera_model: Option<String>,
    pub lens_model: Option<String>,
}

/// 获取当前 ISO 8601 时间字符串
pub fn chrono_now_pub() -> String {
    chrono_now()
}

/// 获取当前 ISO 8601 时间字符串（内部使用）
fn chrono_now() -> String {
    use std::time::SystemTime;
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    // 简单格式化为 ISO 8601
    let secs = now.as_secs();
    let datetime = time_to_iso8601(secs as i64);
    datetime
}

/// 将 Unix 时间戳转换为 ISO 8601 格式
fn time_to_iso8601(timestamp: i64) -> String {
    // 简单实现，实际项目可使用 chrono crate
    let secs_per_day = 86400i64;
    let secs_per_hour = 3600i64;
    let secs_per_min = 60i64;

    // 计算自 1970-01-01 的天数
    let days = timestamp / secs_per_day;
    let remaining = timestamp % secs_per_day;

    let hours = remaining / secs_per_hour;
    let remaining = remaining % secs_per_hour;
    let minutes = remaining / secs_per_min;
    let seconds = remaining % secs_per_min;

    // 计算年月日（简化算法）
    let (year, month, day) = days_to_ymd(days);

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hours, minutes, seconds
    )
}

/// 将天数转换为年月日
fn days_to_ymd(days: i64) -> (i32, u32, u32) {
    // 简化算法，从 1970-01-01 开始计算
    let mut remaining_days = days;
    let mut year = 1970i32;

    loop {
        let days_in_year = if is_leap_year(year) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        year += 1;
    }

    let days_in_months: [i64; 12] = if is_leap_year(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut month = 1u32;
    for &days_in_month in &days_in_months {
        if remaining_days < days_in_month {
            break;
        }
        remaining_days -= days_in_month;
        month += 1;
    }

    let day = (remaining_days + 1) as u32;
    (year, month, day)
}

/// 判断是否为闰年
fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_photo_new() {
        let photo = Photo::new(
            "/path/to/photo.jpg".to_string(),
            "photo.jpg".to_string(),
            1024,
            "abc123".to_string(),
        );
        assert_eq!(photo.photo_id, 0);
        assert_eq!(photo.file_path, "/path/to/photo.jpg");
        assert_eq!(photo.rating, 0);
        assert!(!photo.is_favorite);
    }

    #[test]
    fn test_time_to_iso8601() {
        // 2024-01-01 00:00:00 UTC
        let timestamp = 1704067200i64;
        let result = time_to_iso8601(timestamp);
        assert!(result.starts_with("2024-01-01"));
    }
}
