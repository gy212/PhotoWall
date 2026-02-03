//! 元数据提取服务
//!
//! 负责从图片文件中提取 EXIF 等元数据

use std::fs::File;
use std::io::BufReader;
use std::path::Path;

use exif::{In, Reader, Tag, Value};

use crate::models::photo::CreatePhoto;
use crate::utils::error::AppResult;

/// 图片元数据
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageMetadata {
    /// 图片宽度
    pub width: Option<u32>,
    /// 图片高度
    pub height: Option<u32>,
    /// 拍摄时间 (ISO 8601 格式)
    pub date_taken: Option<String>,
    /// 相机型号
    pub camera_model: Option<String>,
    /// 相机制造商
    pub camera_make: Option<String>,
    /// 镜头型号
    pub lens_model: Option<String>,
    /// 焦距 (mm)
    pub focal_length: Option<f64>,
    /// 光圈值
    pub aperture: Option<f64>,
    /// ISO 感光度
    pub iso: Option<u32>,
    /// 快门速度
    pub shutter_speed: Option<String>,
    /// GPS 纬度
    pub gps_latitude: Option<f64>,
    /// GPS 经度
    pub gps_longitude: Option<f64>,
    /// 图片方向 (EXIF Orientation)
    pub orientation: Option<u32>,
}

/// 元数据提取器
pub struct MetadataExtractor;

impl MetadataExtractor {
    /// 从图片文件提取元数据
    pub fn extract(path: &Path) -> AppResult<ImageMetadata> {
        let mut metadata = ImageMetadata::default();

        // 尝试读取 EXIF 数据
        if let Ok(file) = File::open(path) {
            let reader = BufReader::new(file);
            if let Ok(exif) = Reader::new().read_from_container(&mut std::io::BufReader::new(reader)) {
                metadata = Self::parse_exif(&exif);
            }
        }

        // 如果没有从 EXIF 获取尺寸，尝试从图片解码获取
        if metadata.width.is_none() || metadata.height.is_none() {
            if let Ok((width, height)) = Self::get_image_dimensions(path) {
                metadata.width = Some(width);
                metadata.height = Some(height);
            }
        }

        Ok(metadata)
    }

    /// 从 EXIF 数据解析元数据
    fn parse_exif(exif: &exif::Exif) -> ImageMetadata {
        let mut metadata = ImageMetadata::default();

        // 图片尺寸
        if let Some(field) = exif.get_field(Tag::PixelXDimension, In::PRIMARY) {
            metadata.width = Self::get_u32_value(&field.value);
        }
        if let Some(field) = exif.get_field(Tag::PixelYDimension, In::PRIMARY) {
            metadata.height = Self::get_u32_value(&field.value);
        }

        // 也尝试 ImageWidth/ImageLength
        if metadata.width.is_none() {
            if let Some(field) = exif.get_field(Tag::ImageWidth, In::PRIMARY) {
                metadata.width = Self::get_u32_value(&field.value);
            }
        }
        if metadata.height.is_none() {
            if let Some(field) = exif.get_field(Tag::ImageLength, In::PRIMARY) {
                metadata.height = Self::get_u32_value(&field.value);
            }
        }

        // 拍摄时间
        if let Some(field) = exif.get_field(Tag::DateTimeOriginal, In::PRIMARY) {
            metadata.date_taken = Self::parse_datetime(&field.display_value().to_string());
        } else if let Some(field) = exif.get_field(Tag::DateTime, In::PRIMARY) {
            metadata.date_taken = Self::parse_datetime(&field.display_value().to_string());
        }

        // 相机信息
        if let Some(field) = exif.get_field(Tag::Model, In::PRIMARY) {
            metadata.camera_model = Some(field.display_value().to_string().trim_matches('"').to_string());
        }
        if let Some(field) = exif.get_field(Tag::Make, In::PRIMARY) {
            metadata.camera_make = Some(field.display_value().to_string().trim_matches('"').to_string());
        }

        // 镜头
        if let Some(field) = exif.get_field(Tag::LensModel, In::PRIMARY) {
            metadata.lens_model = Some(field.display_value().to_string().trim_matches('"').to_string());
        }

        // 焦距
        if let Some(field) = exif.get_field(Tag::FocalLength, In::PRIMARY) {
            metadata.focal_length = Self::get_rational_value(&field.value);
        }

        // 光圈
        if let Some(field) = exif.get_field(Tag::FNumber, In::PRIMARY) {
            metadata.aperture = Self::get_rational_value(&field.value);
        }

        // ISO
        if let Some(field) = exif.get_field(Tag::PhotographicSensitivity, In::PRIMARY) {
            metadata.iso = Self::get_u32_value(&field.value);
        }

        // 快门速度
        if let Some(field) = exif.get_field(Tag::ExposureTime, In::PRIMARY) {
            metadata.shutter_speed = Some(field.display_value().to_string());
        }

        // 方向
        if let Some(field) = exif.get_field(Tag::Orientation, In::PRIMARY) {
            metadata.orientation = Self::get_u32_value(&field.value);
        }

        // GPS 坐标
        metadata.gps_latitude = Self::get_gps_coordinate(exif, Tag::GPSLatitude, Tag::GPSLatitudeRef);
        metadata.gps_longitude = Self::get_gps_coordinate(exif, Tag::GPSLongitude, Tag::GPSLongitudeRef);

        metadata
    }

    /// 获取 u32 值
    fn get_u32_value(value: &Value) -> Option<u32> {
        match value {
            Value::Short(v) if !v.is_empty() => Some(v[0] as u32),
            Value::Long(v) if !v.is_empty() => Some(v[0]),
            _ => None,
        }
    }

    /// 获取有理数值 (如焦距、光圈)
    fn get_rational_value(value: &Value) -> Option<f64> {
        match value {
            Value::Rational(v) if !v.is_empty() => {
                let r = &v[0];
                if r.denom != 0 {
                    Some(r.num as f64 / r.denom as f64)
                } else {
                    None
                }
            }
            _ => None,
        }
    }

    /// 解析日期时间字符串为 ISO 8601 格式
    fn parse_datetime(dt_str: &str) -> Option<String> {
        // EXIF 日期格式: "2024:01:15 10:30:45" 或 "2024:01:15 10:30:45"
        let dt_str = dt_str.trim_matches('"');

        // 尝试解析 "YYYY:MM:DD HH:MM:SS" 格式
        let parts: Vec<&str> = dt_str.split_whitespace().collect();
        if parts.len() >= 2 {
            let date_parts: Vec<&str> = parts[0].split(':').collect();
            let time_parts: Vec<&str> = parts[1].split(':').collect();

            if date_parts.len() == 3 && time_parts.len() >= 2 {
                let year = date_parts[0];
                let month = date_parts[1];
                let day = date_parts[2];
                let hour = time_parts[0];
                let minute = time_parts[1];
                let second = if time_parts.len() > 2 { time_parts[2] } else { "00" };

                return Some(format!(
                    "{}-{}-{}T{}:{}:{}Z",
                    year, month, day, hour, minute, second
                ));
            }
        }

        None
    }

    /// 获取 GPS 坐标
    fn get_gps_coordinate(exif: &exif::Exif, coord_tag: Tag, ref_tag: Tag) -> Option<f64> {
        let coord_field = exif.get_field(coord_tag, In::PRIMARY)?;
        let ref_field = exif.get_field(ref_tag, In::PRIMARY)?;

        let degrees = match &coord_field.value {
            Value::Rational(v) if v.len() >= 3 => {
                let d = v[0].num as f64 / v[0].denom as f64;
                let m = v[1].num as f64 / v[1].denom as f64;
                let s = v[2].num as f64 / v[2].denom as f64;
                d + m / 60.0 + s / 3600.0
            }
            _ => return None,
        };

        let ref_str = ref_field.display_value().to_string();
        let ref_str = ref_str.trim_matches('"');

        // 南纬和西经为负
        let sign = if ref_str == "S" || ref_str == "W" { -1.0 } else { 1.0 };

        Some(degrees * sign)
    }

    /// 获取图片尺寸（通过解码图片头部）
    fn get_image_dimensions(path: &Path) -> Result<(u32, u32), image::ImageError> {
        let dimensions = image::image_dimensions(path)?;
        Ok(dimensions)
    }

    /// 将元数据填充到 CreatePhoto 结构
    pub fn fill_create_photo(photo: &mut CreatePhoto, metadata: &ImageMetadata) {
        if let Some(w) = metadata.width {
            photo.width = Some(w as i32);
        }
        if let Some(h) = metadata.height {
            photo.height = Some(h as i32);
        }
        photo.date_taken = metadata.date_taken.clone();
        photo.camera_model = metadata.camera_model.clone();
        photo.lens_model = metadata.lens_model.clone();
        photo.focal_length = metadata.focal_length;
        photo.aperture = metadata.aperture;
        photo.iso = metadata.iso.map(|v| v as i32);
        photo.shutter_speed = metadata.shutter_speed.clone();
        photo.gps_latitude = metadata.gps_latitude;
        photo.gps_longitude = metadata.gps_longitude;
        photo.orientation = metadata.orientation.map(|v| v as i32);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_datetime() {
        let dt = MetadataExtractor::parse_datetime("2024:01:15 10:30:45");
        assert_eq!(dt, Some("2024-01-15T10:30:45Z".to_string()));

        let dt = MetadataExtractor::parse_datetime("\"2024:01:15 10:30:45\"");
        assert_eq!(dt, Some("2024-01-15T10:30:45Z".to_string()));
    }

    #[test]
    fn test_extract_empty_file() {
        // 测试不存在的文件
        let result = MetadataExtractor::extract(Path::new("/nonexistent/file.jpg"));
        assert!(result.is_ok()); // 应该返回空的 metadata 而不是错误
    }
}
