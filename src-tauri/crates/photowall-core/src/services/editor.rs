//! 照片编辑服务
//!
//! 提供非 RAW 格式照片的编辑功能

use std::path::Path;
use image::{DynamicImage, ImageFormat, imageops::FilterType};
use serde::{Deserialize, Serialize};
use crate::utils::error::{AppError, AppResult};

/// 翻转方向
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FlipDirection {
    Horizontal,
    Vertical,
}

/// 裁剪区域
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CropRect {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

/// 编辑操作
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum EditOperation {
    /// 旋转 (90, 180, 270 度)
    Rotate { degrees: i32 },
    /// 翻转
    Flip { direction: FlipDirection },
    /// 裁剪
    Crop { rect: CropRect },
    /// 亮度调整 (-100 to 100)
    Brightness { value: i32 },
    /// 对比度调整 (-100 to 100)
    Contrast { value: i32 },
    /// 饱和度调整 (-100 to 100)
    Saturation { value: i32 },
    /// 曝光调整 (-200 to 200, 代表 -2.0 到 +2.0 EV)
    Exposure { value: i32 },
    /// 锐化 (0 to 100)
    Sharpen { value: i32 },
    /// 模糊 (0 to 100)
    Blur { value: i32 },
    /// 高光调整 (-100 to 100)
    Highlights { value: i32 },
    /// 阴影调整 (-100 to 100)
    Shadows { value: i32 },
    /// 色温调整 (-100 to 100, 负值偏冷，正值偏暖)
    Temperature { value: i32 },
    /// 色调调整 (-100 to 100, 负值偏绿，正值偏品红)
    Tint { value: i32 },
    /// 暗角 (0 to 100)
    Vignette { value: i32 },
    /// 一键优化
    AutoEnhance,
}

/// 编辑参数
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditParams {
    pub operations: Vec<EditOperation>,
}

/// 照片编辑服务
pub struct EditorService;

impl EditorService {
    /// 应用编辑操作到图像
    pub fn apply_edits(img: DynamicImage, params: &EditParams) -> AppResult<DynamicImage> {
        let mut result = img;

        for op in &params.operations {
            result = Self::apply_operation(result, op)?;
        }

        Ok(result)
    }

    /// 应用单个编辑操作
    fn apply_operation(img: DynamicImage, op: &EditOperation) -> AppResult<DynamicImage> {
        match op {
            EditOperation::Rotate { degrees } => Ok(Self::rotate(img, *degrees)),
            EditOperation::Flip { direction } => Ok(Self::flip(img, *direction)),
            EditOperation::Crop { rect } => Self::crop(img, rect),
            EditOperation::Brightness { value } => Ok(Self::adjust_brightness(img, *value)),
            EditOperation::Contrast { value } => Ok(Self::adjust_contrast(img, *value)),
            EditOperation::Saturation { value } => Ok(Self::adjust_saturation(img, *value)),
            EditOperation::Exposure { value } => Ok(Self::adjust_exposure(img, *value)),
            EditOperation::Sharpen { value } => Ok(Self::sharpen(img, *value)),
            EditOperation::Blur { value } => Ok(Self::blur(img, *value)),
            EditOperation::Highlights { value } => Ok(Self::adjust_highlights(img, *value)),
            EditOperation::Shadows { value } => Ok(Self::adjust_shadows(img, *value)),
            EditOperation::Temperature { value } => Ok(Self::adjust_temperature(img, *value)),
            EditOperation::Tint { value } => Ok(Self::adjust_tint(img, *value)),
            EditOperation::Vignette { value } => Ok(Self::apply_vignette(img, *value)),
            EditOperation::AutoEnhance => Ok(Self::auto_enhance(img)),
        }
    }

    /// 旋转图像
    fn rotate(img: DynamicImage, degrees: i32) -> DynamicImage {
        match degrees.rem_euclid(360) {
            90 => img.rotate90(),
            180 => img.rotate180(),
            270 => img.rotate270(),
            _ => img,
        }
    }

    /// 翻转图像
    fn flip(img: DynamicImage, direction: FlipDirection) -> DynamicImage {
        match direction {
            FlipDirection::Horizontal => img.fliph(),
            FlipDirection::Vertical => img.flipv(),
        }
    }

    /// 裁剪图像
    fn crop(img: DynamicImage, rect: &CropRect) -> AppResult<DynamicImage> {
        let (w, h) = (img.width(), img.height());

        if rect.x >= w || rect.y >= h {
            return Err(AppError::General("裁剪区域超出图像边界".to_string()));
        }

        let crop_w = rect.width.min(w - rect.x);
        let crop_h = rect.height.min(h - rect.y);

        if crop_w == 0 || crop_h == 0 {
            return Err(AppError::General("裁剪区域无效".to_string()));
        }

        Ok(img.crop_imm(rect.x, rect.y, crop_w, crop_h))
    }

    /// 调整亮度 (-100 to 100)
    fn adjust_brightness(img: DynamicImage, value: i32) -> DynamicImage {
        let value = value.clamp(-100, 100);
        let factor = value as f32 / 100.0;

        let mut rgba = img.to_rgba8();
        for pixel in rgba.pixels_mut() {
            for i in 0..3 {
                let v = pixel[i] as f32;
                let new_v = if factor >= 0.0 {
                    v + (255.0 - v) * factor
                } else {
                    v * (1.0 + factor)
                };
                pixel[i] = new_v.clamp(0.0, 255.0) as u8;
            }
        }
        DynamicImage::ImageRgba8(rgba)
    }

    /// 调整对比度 (-100 to 100)
    fn adjust_contrast(img: DynamicImage, value: i32) -> DynamicImage {
        let value = value.clamp(-100, 100);
        let factor = if value >= 0 {
            1.0 + value as f32 / 50.0
        } else {
            1.0 + value as f32 / 100.0
        };

        let mut rgba = img.to_rgba8();
        for pixel in rgba.pixels_mut() {
            for i in 0..3 {
                let v = pixel[i] as f32 / 255.0;
                let new_v = ((v - 0.5) * factor + 0.5) * 255.0;
                pixel[i] = new_v.clamp(0.0, 255.0) as u8;
            }
        }
        DynamicImage::ImageRgba8(rgba)
    }

    /// 调整饱和度 (-100 to 100)
    fn adjust_saturation(img: DynamicImage, value: i32) -> DynamicImage {
        let value = value.clamp(-100, 100);
        let factor = 1.0 + value as f32 / 100.0;

        let mut rgba = img.to_rgba8();
        for pixel in rgba.pixels_mut() {
            let r = pixel[0] as f32;
            let g = pixel[1] as f32;
            let b = pixel[2] as f32;

            let gray = 0.299 * r + 0.587 * g + 0.114 * b;

            pixel[0] = (gray + (r - gray) * factor).clamp(0.0, 255.0) as u8;
            pixel[1] = (gray + (g - gray) * factor).clamp(0.0, 255.0) as u8;
            pixel[2] = (gray + (b - gray) * factor).clamp(0.0, 255.0) as u8;
        }
        DynamicImage::ImageRgba8(rgba)
    }

    /// 调整曝光 (-200 to 200, 代表 -2.0 到 +2.0 EV)
    /// 使用 filmic 曲线保护高光
    fn adjust_exposure(img: DynamicImage, value: i32) -> DynamicImage {
        use super::colorspace::{srgb_to_linear, linear_to_srgb};

        let value = value.clamp(-200, 200);
        if value == 0 {
            return img;
        }

        let ev = value as f32 / 100.0;
        let factor = 2.0_f32.powf(ev);

        let mut rgba = img.to_rgba8();
        for pixel in rgba.pixels_mut() {
            for i in 0..3 {
                // 转到线性空间
                let linear = srgb_to_linear(pixel[i] as f32 / 255.0);
                // 应用曝光
                let exposed = linear * factor;
                // Filmic 高光保护
                let protected = if exposed > 1.0 {
                    1.0 - (-(exposed - 1.0) * 2.0).exp() * 0.5
                } else {
                    exposed
                };
                // 转回 sRGB
                let result = linear_to_srgb(protected.clamp(0.0, 1.0));
                pixel[i] = (result * 255.0).clamp(0.0, 255.0) as u8;
            }
        }
        DynamicImage::ImageRgba8(rgba)
    }

    /// 锐化 (0 to 100)
    fn sharpen(img: DynamicImage, value: i32) -> DynamicImage {
        let value = value.clamp(0, 100);
        if value == 0 {
            return img;
        }

        let sigma = 1.0;
        let amount = value as f32 / 50.0;

        let blurred = img.blur(sigma);
        let mut rgba = img.to_rgba8();
        let blurred_rgba = blurred.to_rgba8();

        for (pixel, blurred_pixel) in rgba.pixels_mut().zip(blurred_rgba.pixels()) {
            for i in 0..3 {
                let original = pixel[i] as f32;
                let blur = blurred_pixel[i] as f32;
                let sharpened = original + (original - blur) * amount;
                pixel[i] = sharpened.clamp(0.0, 255.0) as u8;
            }
        }
        DynamicImage::ImageRgba8(rgba)
    }

    /// 模糊 (0 to 100)
    fn blur(img: DynamicImage, value: i32) -> DynamicImage {
        let value = value.clamp(0, 100);
        if value == 0 {
            return img;
        }

        let sigma = value as f32 / 10.0;
        img.blur(sigma)
    }

    /// 调整高光 (-100 to 100)
    /// 使用亮度感知的 sigmoid 软过渡，保持色彩比例
    fn adjust_highlights(img: DynamicImage, value: i32) -> DynamicImage {
        use super::colorspace::{srgb_to_linear, linear_to_srgb, luminance};

        let value = value.clamp(-100, 100);
        if value == 0 {
            return img;
        }

        let strength = value as f32 / 100.0;
        let pivot = 0.5; // 高光区域起点

        let mut rgba = img.to_rgba8();
        for pixel in rgba.pixels_mut() {
            // 转到线性空间
            let r = srgb_to_linear(pixel[0] as f32 / 255.0);
            let g = srgb_to_linear(pixel[1] as f32 / 255.0);
            let b = srgb_to_linear(pixel[2] as f32 / 255.0);

            // 计算亮度
            let lum = luminance(r, g, b);

            // 只处理高光区域 (亮度 > pivot)
            if lum > pivot {
                // Sigmoid 软过渡
                let k = 6.0;
                let blend = 1.0 / (1.0 + (-k * (lum - pivot)).exp());

                // 计算调整量
                let adjustment = if strength > 0.0 {
                    // 提亮高光
                    (1.0 - lum) * blend * strength * 0.5
                } else {
                    // 压暗高光
                    -lum * blend * strength.abs() * 0.5
                };

                // 保持色彩比例调整
                let scale = if lum > 0.001 { (lum + adjustment) / lum } else { 1.0 };

                let new_r = linear_to_srgb((r * scale).clamp(0.0, 1.0));
                let new_g = linear_to_srgb((g * scale).clamp(0.0, 1.0));
                let new_b = linear_to_srgb((b * scale).clamp(0.0, 1.0));

                pixel[0] = (new_r * 255.0) as u8;
                pixel[1] = (new_g * 255.0) as u8;
                pixel[2] = (new_b * 255.0) as u8;
            }
        }
        DynamicImage::ImageRgba8(rgba)
    }

    /// 调整阴影 (-100 to 100)
    /// 使用亮度感知的 sigmoid 软过渡，保持色彩比例
    fn adjust_shadows(img: DynamicImage, value: i32) -> DynamicImage {
        use super::colorspace::{srgb_to_linear, linear_to_srgb, luminance};

        let value = value.clamp(-100, 100);
        if value == 0 {
            return img;
        }

        let strength = value as f32 / 100.0;
        let pivot = 0.3; // 阴影区域终点

        let mut rgba = img.to_rgba8();
        for pixel in rgba.pixels_mut() {
            // 转到线性空间
            let r = srgb_to_linear(pixel[0] as f32 / 255.0);
            let g = srgb_to_linear(pixel[1] as f32 / 255.0);
            let b = srgb_to_linear(pixel[2] as f32 / 255.0);

            // 计算亮度
            let lum = luminance(r, g, b);

            // 只处理阴影区域 (亮度 < pivot)
            if lum < pivot {
                // Sigmoid 软过渡 (反向)
                let k = 6.0;
                let blend = 1.0 / (1.0 + (k * (lum - pivot)).exp());

                // 计算调整量
                let adjustment = if strength > 0.0 {
                    // 提亮阴影
                    (pivot - lum) * blend * strength * 0.8
                } else {
                    // 压暗阴影
                    -lum * blend * strength.abs() * 0.5
                };

                // 保持色彩比例调整
                let new_lum = (lum + adjustment).clamp(0.001, 1.0);
                let scale = new_lum / lum.max(0.001);

                let new_r = linear_to_srgb((r * scale).clamp(0.0, 1.0));
                let new_g = linear_to_srgb((g * scale).clamp(0.0, 1.0));
                let new_b = linear_to_srgb((b * scale).clamp(0.0, 1.0));

                pixel[0] = (new_r * 255.0) as u8;
                pixel[1] = (new_g * 255.0) as u8;
                pixel[2] = (new_b * 255.0) as u8;
            }
        }
        DynamicImage::ImageRgba8(rgba)
    }

    /// 调整色温 (-100 to 100)
    /// 使用 Bradford 色彩适应矩阵，基于开尔文温度
    fn adjust_temperature(img: DynamicImage, value: i32) -> DynamicImage {
        use super::colorspace::{srgb_to_linear, linear_to_srgb, adjust_temperature_value};

        let value = value.clamp(-100, 100);
        if value == 0 {
            return img;
        }

        let mut rgba = img.to_rgba8();
        for pixel in rgba.pixels_mut() {
            // 转到线性空间
            let r = srgb_to_linear(pixel[0] as f32 / 255.0);
            let g = srgb_to_linear(pixel[1] as f32 / 255.0);
            let b = srgb_to_linear(pixel[2] as f32 / 255.0);

            // 应用 Bradford 色温调整
            let [new_r, new_g, new_b] = adjust_temperature_value([r, g, b], value);

            // 转回 sRGB
            pixel[0] = (linear_to_srgb(new_r.clamp(0.0, 1.0)) * 255.0) as u8;
            pixel[1] = (linear_to_srgb(new_g.clamp(0.0, 1.0)) * 255.0) as u8;
            pixel[2] = (linear_to_srgb(new_b.clamp(0.0, 1.0)) * 255.0) as u8;
        }
        DynamicImage::ImageRgba8(rgba)
    }

    /// 调整色调 (-100 to 100)
    /// 在 Lab 色彩空间调整 a 通道（绿-品红轴）
    fn adjust_tint(img: DynamicImage, value: i32) -> DynamicImage {
        use super::colorspace::{srgb_to_lab, lab_to_srgb};

        let value = value.clamp(-100, 100);
        if value == 0 {
            return img;
        }

        // 映射到 Lab a 通道调整量 (-30 到 +30)
        let adjustment = value as f32 / 100.0 * 30.0;

        let mut rgba = img.to_rgba8();
        for pixel in rgba.pixels_mut() {
            let r = pixel[0] as f32 / 255.0;
            let g = pixel[1] as f32 / 255.0;
            let b = pixel[2] as f32 / 255.0;

            // 转到 Lab
            let (l, a, b_lab) = srgb_to_lab(r, g, b);

            // 调整 a 通道 (绿-品红)
            let new_a = a + adjustment;

            // 转回 sRGB
            let (new_r, new_g, new_b) = lab_to_srgb(l, new_a, b_lab);

            pixel[0] = (new_r.clamp(0.0, 1.0) * 255.0) as u8;
            pixel[1] = (new_g.clamp(0.0, 1.0) * 255.0) as u8;
            pixel[2] = (new_b.clamp(0.0, 1.0) * 255.0) as u8;
        }
        DynamicImage::ImageRgba8(rgba)
    }

    /// 应用暗角 (0 to 100)
    fn apply_vignette(img: DynamicImage, value: i32) -> DynamicImage {
        let value = value.clamp(0, 100);
        if value == 0 {
            return img;
        }

        let strength = value as f32 / 100.0;
        let (w, h) = (img.width() as f32, img.height() as f32);
        let cx = w / 2.0;
        let cy = h / 2.0;
        let max_dist = (cx * cx + cy * cy).sqrt();

        let mut rgba = img.to_rgba8();
        for (x, y, pixel) in rgba.enumerate_pixels_mut() {
            let dx = x as f32 - cx;
            let dy = y as f32 - cy;
            let dist = (dx * dx + dy * dy).sqrt() / max_dist;
            let vignette = 1.0 - (dist * dist * strength);

            for i in 0..3 {
                let v = pixel[i] as f32 * vignette;
                pixel[i] = v.clamp(0.0, 255.0) as u8;
            }
        }
        DynamicImage::ImageRgba8(rgba)
    }

    /// 一键优化
    fn auto_enhance(img: DynamicImage) -> DynamicImage {
        let rgba = img.to_rgba8();

        let mut min_v = 255u8;
        let mut max_v = 0u8;
        let mut sum: u64 = 0;
        let pixel_count = rgba.width() as u64 * rgba.height() as u64;

        for pixel in rgba.pixels() {
            let luminance = ((pixel[0] as u32 * 299 + pixel[1] as u32 * 587 + pixel[2] as u32 * 114) / 1000) as u8;
            min_v = min_v.min(luminance);
            max_v = max_v.max(luminance);
            sum += luminance as u64;
        }

        let avg = (sum / pixel_count) as f32;
        let range = (max_v - min_v) as f32;

        let brightness_adj = if avg < 100.0 { ((128.0 - avg) / 2.0) as i32 } else if avg > 156.0 { ((128.0 - avg) / 2.0) as i32 } else { 0 };
        let contrast_adj = if range < 200.0 { ((200.0 - range) / 4.0) as i32 } else { 0 };
        let saturation_adj = 10;

        let mut result = img;
        if brightness_adj != 0 {
            result = Self::adjust_brightness(result, brightness_adj);
        }
        if contrast_adj != 0 {
            result = Self::adjust_contrast(result, contrast_adj);
        }
        result = Self::adjust_saturation(result, saturation_adj);

        result
    }

    /// 加载图像
    pub fn load_image(path: &Path) -> AppResult<DynamicImage> {
        if !path.exists() {
            return Err(AppError::FileNotFound(path.display().to_string()));
        }

        let ext = path.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();

        if matches!(ext.as_str(), "dng" | "cr2" | "cr3" | "nef" | "nrw" | "arw" | "srf" | "sr2" |
            "orf" | "raf" | "rw2" | "pef" | "srw" | "raw" | "rwl" | "3fr" | "erf" | "kdc" | "dcr" | "x3f") {
            return Err(AppError::UnsupportedFormat("RAW 格式不支持编辑".to_string()));
        }

        image::open(path).map_err(AppError::from)
    }

    /// 保存图像
    pub fn save_image(img: &DynamicImage, path: &Path, quality: Option<u8>) -> AppResult<()> {
        let ext = path.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_else(|| "jpg".to_string());

        let format = match ext.as_str() {
            "jpg" | "jpeg" => ImageFormat::Jpeg,
            "png" => ImageFormat::Png,
            "webp" => ImageFormat::WebP,
            "bmp" => ImageFormat::Bmp,
            "tif" | "tiff" => ImageFormat::Tiff,
            _ => ImageFormat::Jpeg,
        };

        if format == ImageFormat::Jpeg {
            let quality = quality.unwrap_or(92);
            let rgb = img.to_rgb8();
            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
                std::fs::File::create(path)?,
                quality,
            );
            encoder.encode_image(&rgb)?;
        } else {
            img.save_with_format(path, format)?;
        }

        Ok(())
    }

    /// 生成预览（缩小尺寸以加快处理）
    pub fn generate_preview(img: &DynamicImage, max_size: u32) -> DynamicImage {
        let (w, h) = (img.width(), img.height());
        if w <= max_size && h <= max_size {
            return img.clone();
        }

        img.resize(max_size, max_size, FilterType::Triangle)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::RgbImage;

    fn create_test_image() -> DynamicImage {
        let img = RgbImage::from_fn(100, 100, |x, y| {
            image::Rgb([
                ((x * 255) / 100) as u8,
                ((y * 255) / 100) as u8,
                128,
            ])
        });
        DynamicImage::ImageRgb8(img)
    }

    #[test]
    fn test_rotate() {
        let img = create_test_image();
        let rotated = EditorService::rotate(img.clone(), 90);
        assert_eq!(rotated.width(), 100);
        assert_eq!(rotated.height(), 100);
    }

    #[test]
    fn test_flip() {
        let img = create_test_image();
        let flipped = EditorService::flip(img.clone(), FlipDirection::Horizontal);
        assert_eq!(flipped.width(), 100);
    }

    #[test]
    fn test_crop() {
        let img = create_test_image();
        let rect = CropRect { x: 10, y: 10, width: 50, height: 50 };
        let cropped = EditorService::crop(img, &rect).unwrap();
        assert_eq!(cropped.width(), 50);
        assert_eq!(cropped.height(), 50);
    }

    #[test]
    fn test_brightness() {
        let img = create_test_image();
        let brightened = EditorService::adjust_brightness(img, 50);
        assert_eq!(brightened.width(), 100);
    }

    #[test]
    fn test_auto_enhance() {
        let img = create_test_image();
        let enhanced = EditorService::auto_enhance(img);
        assert_eq!(enhanced.width(), 100);
    }
}
