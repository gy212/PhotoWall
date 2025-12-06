//! 缩略图生成服务
//!
//! 负责生成、缓存和管理照片缩略图

use std::fs;
use std::path::{Path, PathBuf};
use image::{DynamicImage, ImageFormat, imageops::FilterType, RgbImage};
use crate::utils::error::{AppError, AppResult};

/// 缩略图尺寸
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ThumbnailSize {
    /// 小缩略图 (150x150)
    Small,
    /// 中缩略图 (300x300)
    Medium,
    /// 大缩略图 (600x600)
    Large,
}

impl ThumbnailSize {
    /// 获取缩略图尺寸（像素）
    /// 为了支持高 DPI 屏幕，尺寸已经提高
    pub fn dimensions(&self) -> u32 {
        match self {
            ThumbnailSize::Small => 300,   // 提高到 300，支持 2x DPI
            ThumbnailSize::Medium => 500,  // 提高到 500，支持高清显示
            ThumbnailSize::Large => 800,   // 提高到 800，大图预览
        }
    }

    /// 获取尺寸名称
    pub fn name(&self) -> &'static str {
        match self {
            ThumbnailSize::Small => "small",
            ThumbnailSize::Medium => "medium",
            ThumbnailSize::Large => "large",
        }
    }

    /// 从字符串解析
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "small" => Some(ThumbnailSize::Small),
            "medium" => Some(ThumbnailSize::Medium),
            "large" => Some(ThumbnailSize::Large),
            _ => None,
        }
    }
}

/// 缩略图生成结果
#[derive(Debug, Clone)]
pub struct ThumbnailResult {
    /// 缩略图路径
    pub path: PathBuf,
    /// 是否命中缓存
    pub hit_cache: bool,
    /// 生成耗时（毫秒）
    pub generation_time_ms: Option<u64>,
}

/// 缩略图服务
#[derive(Clone)]
pub struct ThumbnailService {
    /// 缓存根目录
    cache_dir: PathBuf,
}

/// CFA 信息结构（用于 Bayer 去马赛克）
#[allow(dead_code)]
struct CfaInfo {
    r_pos: usize,      // R 像素位置
    b_pos: usize,      // B 像素位置
    gr_pos: usize,     // 与 R 同行的 G 像素位置
    gb_pos: usize,     // 与 B 同行的 G 像素位置
}

/// 像素颜色类型
#[derive(Debug, Clone, Copy, PartialEq)]
enum PixelColor {
    Red,
    Blue,
    GreenR,  // 与 R 同行的 G
    GreenB,  // 与 B 同行的 G
}

impl ThumbnailService {
    /// 创建缩略图服务
    pub fn new(cache_dir: PathBuf) -> AppResult<Self> {
        // 确保缓存目录存在
        Self::ensure_cache_dirs(&cache_dir)?;
        Ok(Self { cache_dir })
    }

    /// 确保缓存目录结构存在
    fn ensure_cache_dirs(cache_dir: &Path) -> AppResult<()> {
        for size in [ThumbnailSize::Small, ThumbnailSize::Medium, ThumbnailSize::Large] {
            let dir = cache_dir.join(size.name());
            if !dir.exists() {
                fs::create_dir_all(&dir)?;
                tracing::info!("创建缩略图缓存目录: {:?}", dir);
            }
        }
        Ok(())
    }

    /// 获取默认缓存目录
    pub fn default_cache_dir() -> PathBuf {
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("PhotoWall")
            .join("Thumbnails")
    }

    /// 获取缩略图缓存路径
    pub fn get_cache_path(&self, file_hash: &str, size: ThumbnailSize) -> PathBuf {
        self.cache_dir
            .join(size.name())
            .join(format!("{}.webp", file_hash))
    }

    /// 检查缩略图是否存在于缓存中
    pub fn is_cached(&self, file_hash: &str, size: ThumbnailSize) -> bool {
        self.get_cache_path(file_hash, size).exists()
    }

    /// 生成或获取缩略图
    ///
    /// 如果缓存中存在，直接返回缓存路径；否则生成新的缩略图
    pub fn get_or_generate(
        &self,
        source_path: &Path,
        file_hash: &str,
        size: ThumbnailSize,
    ) -> AppResult<ThumbnailResult> {
        let cache_path = self.get_cache_path(file_hash, size);

        // 检查缓存
        if cache_path.exists() {
            tracing::debug!("缩略图缓存命中: {:?}", cache_path);
            return Ok(ThumbnailResult {
                path: cache_path,
                hit_cache: true,
                generation_time_ms: None,
            });
        }

        // 生成缩略图
        let start = std::time::Instant::now();
        self.generate(source_path, file_hash, size)?;
        let elapsed = start.elapsed().as_millis() as u64;

        tracing::info!(
            "生成缩略图: {:?} -> {:?} ({}ms)",
            source_path,
            cache_path,
            elapsed
        );

        Ok(ThumbnailResult {
            path: cache_path,
            hit_cache: false,
            generation_time_ms: Some(elapsed),
        })
    }

    /// 生成缩略图
    pub fn generate(
        &self,
        source_path: &Path,
        file_hash: &str,
        size: ThumbnailSize,
    ) -> AppResult<PathBuf> {
        // 检查源文件是否存在
        if !source_path.exists() {
            return Err(AppError::FileNotFound(source_path.display().to_string()));
        }

        // 根据文件类型选择不同的加载方式
        let img = if self.is_jpeg(source_path) {
            // JPEG: 尝试快速提取 EXIF 缩略图
            if let Some(thumb) = self.extract_jpeg_thumbnail(source_path) {
                tracing::debug!("使用 JPEG 快速缩略图提取");
                thumb
            } else {
                image::open(source_path)?
            }
        } else if self.is_raw(source_path) {
            // RAW 格式: 提取嵌入的预览图或解码
            self.extract_raw_preview(source_path)
                .ok_or_else(|| AppError::UnsupportedFormat(format!(
                    "无法解码 RAW 文件: {}",
                    source_path.display()
                )))?
        } else {
            // 其他格式: 正常加载
            image::open(source_path)?
        };

        // 应用 EXIF 方向校正
        let img = self.apply_orientation(source_path, img);

        // 生成缩略图（保持宽高比）
        let dim = size.dimensions();
        let thumbnail = img.resize(dim, dim, FilterType::Lanczos3);

        // 保存为 WebP 格式
        let cache_path = self.get_cache_path(file_hash, size);

        // 确保父目录存在
        if let Some(parent) = cache_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // 保存缩略图
        thumbnail.save_with_format(&cache_path, ImageFormat::WebP)?;

        Ok(cache_path)
    }

    /// 判断文件是否为 JPEG 格式
    fn is_jpeg(&self, path: &Path) -> bool {
        if let Some(ext) = path.extension() {
            let ext = ext.to_string_lossy().to_lowercase();
            matches!(ext.as_str(), "jpg" | "jpeg")
        } else {
            false
        }
    }

    /// 判断文件是否为 RAW 格式
    fn is_raw(&self, path: &Path) -> bool {
        if let Some(ext) = path.extension() {
            let ext = ext.to_string_lossy().to_lowercase();
            matches!(ext.as_str(), 
                "dng" | "cr2" | "cr3" | "nef" | "nrw" | "arw" | "srf" | "sr2" |
                "orf" | "raf" | "rw2" | "pef" | "srw" | "raw" | "rwl" | "3fr" |
                "erf" | "kdc" | "dcr" | "x3f"
            )
        } else {
            false
        }
    }

    /// 从 RAW 文件中提取嵌入的预览图
    /// 
    /// 大多数 RAW 文件内嵌了一个 JPEG 预览图，我们优先使用它
    fn extract_raw_preview(&self, path: &Path) -> Option<DynamicImage> {
        // 方法1: 扫描文件查找嵌入的 JPEG 预览图（最可靠）
        if let Some(img) = self.scan_embedded_jpeg(path) {
            tracing::debug!("从 RAW 文件中扫描到嵌入的 JPEG 预览");
            return Some(img);
        }

        // 方法2: 尝试从 EXIF 中提取嵌入的 JPEG 缩略图
        if let Some(img) = self.extract_raw_embedded_jpeg(path) {
            tracing::debug!("从 RAW EXIF 中提取到嵌入的 JPEG 预览");
            return Some(img);
        }

        // 方法3: 使用 rawloader 解码 RAW 数据（带 Bayer 去马赛克）
        if let Some(img) = self.decode_raw_image(path) {
            tracing::debug!("使用 rawloader 解码 RAW 图像");
            return Some(img);
        }

        None
    }

    /// 尝试从 RAW 文件的 EXIF 中提取嵌入的 JPEG 预览
    fn extract_raw_embedded_jpeg(&self, path: &Path) -> Option<DynamicImage> {
        let file = std::fs::File::open(path).ok()?;
        let mut bufreader = std::io::BufReader::new(file);
        let exifreader = exif::Reader::new();
        let exif = exifreader.read_from_container(&mut bufreader).ok()?;

        // 查找嵌入的缩略图 (在 THUMBNAIL IFD 中查找)
        let thumb_field = exif.get_field(exif::Tag::JPEGInterchangeFormat, exif::In::THUMBNAIL)?;
        let thumb_offset = thumb_field.value.get_uint(0)? as u64;

        let thumb_len_field = exif.get_field(exif::Tag::JPEGInterchangeFormatLength, exif::In::THUMBNAIL)?;
        let thumb_len = thumb_len_field.value.get_uint(0)? as u64;

        if thumb_len == 0 {
            return None;
        }

        let mut file = std::fs::File::open(path).ok()?;
        use std::io::{Seek, SeekFrom, Read};
        file.seek(SeekFrom::Start(thumb_offset)).ok()?;

        let mut thumb_data = vec![0u8; thumb_len as usize];
        file.read_exact(&mut thumb_data).ok()?;

        image::load_from_memory(&thumb_data).ok()
    }

    /// 扫描 RAW 文件中嵌入的 JPEG 预览图
    /// 
    /// 大多数相机 RAW 文件（NEF、CR2、DNG 等）都会嵌入一个或多个 JPEG 预览图。
    /// 此方法扫描文件寻找最大的 JPEG 图像。
    fn scan_embedded_jpeg(&self, path: &Path) -> Option<DynamicImage> {
        use std::io::Read;
        
        let mut file = std::fs::File::open(path).ok()?;
        let mut data = Vec::new();
        file.read_to_end(&mut data).ok()?;
        
        // 查找所有 JPEG 数据块 (FFD8 开头, FFD9 结尾)
        let mut jpegs: Vec<&[u8]> = Vec::new();
        let mut i = 0;
        
        while i < data.len().saturating_sub(2) {
            // 查找 JPEG 开始标记 (SOI: FF D8)
            if data[i] == 0xFF && data[i + 1] == 0xD8 {
                let start = i;
                // 查找 JPEG 结束标记 (EOI: FF D9)
                let mut j = i + 2;
                while j < data.len().saturating_sub(1) {
                    if data[j] == 0xFF && data[j + 1] == 0xD9 {
                        let end = j + 2;
                        let jpeg_data = &data[start..end];
                        // 只保留较大的 JPEG（至少 10KB，排除小缩略图）
                        if jpeg_data.len() > 10 * 1024 {
                            jpegs.push(jpeg_data);
                        }
                        i = end;
                        break;
                    }
                    j += 1;
                }
                if j >= data.len().saturating_sub(1) {
                    break;
                }
            } else {
                i += 1;
            }
        }
        
        // 选择最大的 JPEG （通常是全尺寸预览）
        let largest_jpeg = jpegs.iter().max_by_key(|j| j.len())?;
        
        tracing::debug!("找到 {} 个嵌入 JPEG，使用最大的 ({} KB)", jpegs.len(), largest_jpeg.len() / 1024);
        
        image::load_from_memory(largest_jpeg).ok()
    }

    /// 使用 rawloader 解码 RAW 图像（带 Bayer 去马赛克处理）
    fn decode_raw_image(&self, path: &Path) -> Option<DynamicImage> {
        use rawloader::RawLoader;

        let loader = RawLoader::new();
        let raw = loader.decode_file(path).ok()?;

        let width = raw.width;
        let height = raw.height;
        
        // 获取 CFA 模式（Bayer 排列）
        let cfa_pattern = &raw.cfa.name;
        tracing::debug!("RAW CFA 模式: {}, 尺寸: {}x{}", cfa_pattern, width, height);

        match &raw.data {
            rawloader::RawImageData::Integer(data) => {
                self.demosaic_bayer_integer(data, width, height, cfa_pattern)
            }
            rawloader::RawImageData::Float(data) => {
                self.demosaic_bayer_float(data, width, height, cfa_pattern)
            }
        }
    }
    
    /// 整数 RAW 数据的 Bayer 去马赛克处理
    fn demosaic_bayer_integer(&self, data: &[u16], width: usize, height: usize, cfa_str: &str) -> Option<DynamicImage> {
        // 计算缩放因子
        let max_val = data.iter().max().copied().unwrap_or(65535) as f32;
        let scale = 255.0 / max_val.max(1.0);
        
        let mut rgb_data = vec![0u8; width * height * 3];
        let cfa = self.parse_cfa_info(cfa_str);
        
        for y in 1..height.saturating_sub(1) {
            for x in 1..width.saturating_sub(1) {
                let idx = y * width + x;
                let rgb_idx = idx * 3;
                
                let color = self.get_pixel_color(x, y, &cfa);
                
                let (r, g, b) = match color {
                    PixelColor::Red => {
                        // 当前是 R 像素：G 在上下左右，B 在对角
                        let r = data[idx] as f32;
                        let g = (data[idx - 1] as f32 + data[idx + 1] as f32 + 
                                 data[idx - width] as f32 + data[idx + width] as f32) / 4.0;
                        let b = (data[idx - width - 1] as f32 + data[idx - width + 1] as f32 +
                                 data[idx + width - 1] as f32 + data[idx + width + 1] as f32) / 4.0;
                        (r, g, b)
                    }
                    PixelColor::Blue => {
                        // 当前是 B 像素：G 在上下左右，R 在对角
                        let b = data[idx] as f32;
                        let g = (data[idx - 1] as f32 + data[idx + 1] as f32 + 
                                 data[idx - width] as f32 + data[idx + width] as f32) / 4.0;
                        let r = (data[idx - width - 1] as f32 + data[idx - width + 1] as f32 +
                                 data[idx + width - 1] as f32 + data[idx + width + 1] as f32) / 4.0;
                        (r, g, b)
                    }
                    PixelColor::GreenR => {
                        // Gr 像素（与 R 同行）：R 在左右，B 在上下
                        let g = data[idx] as f32;
                        let r = (data[idx - 1] as f32 + data[idx + 1] as f32) / 2.0;
                        let b = (data[idx - width] as f32 + data[idx + width] as f32) / 2.0;
                        (r, g, b)
                    }
                    PixelColor::GreenB => {
                        // Gb 像素（与 B 同行）：B 在左右，R 在上下
                        let g = data[idx] as f32;
                        let b = (data[idx - 1] as f32 + data[idx + 1] as f32) / 2.0;
                        let r = (data[idx - width] as f32 + data[idx + width] as f32) / 2.0;
                        (r, g, b)
                    }
                };
                
                rgb_data[rgb_idx] = ((r * scale) as u8).min(255);
                rgb_data[rgb_idx + 1] = ((g * scale) as u8).min(255);
                rgb_data[rgb_idx + 2] = ((b * scale) as u8).min(255);
            }
        }
        
        RgbImage::from_raw(width as u32, height as u32, rgb_data)
            .map(DynamicImage::ImageRgb8)
    }
    
    /// 浮点 RAW 数据的 Bayer 去马赛克处理
    fn demosaic_bayer_float(&self, data: &[f32], width: usize, height: usize, cfa_str: &str) -> Option<DynamicImage> {
        let max_val = data.iter().cloned().fold(0.0f32, f32::max);
        let scale = if max_val > 0.0 { 255.0 / max_val } else { 1.0 };
        
        let mut rgb_data = vec![0u8; width * height * 3];
        let cfa = self.parse_cfa_info(cfa_str);
        
        for y in 1..height.saturating_sub(1) {
            for x in 1..width.saturating_sub(1) {
                let idx = y * width + x;
                let rgb_idx = idx * 3;
                
                let color = self.get_pixel_color(x, y, &cfa);
                
                let (r, g, b) = match color {
                    PixelColor::Red => {
                        let r = data[idx];
                        let g = (data[idx - 1] + data[idx + 1] + data[idx - width] + data[idx + width]) / 4.0;
                        let b = (data[idx - width - 1] + data[idx - width + 1] + data[idx + width - 1] + data[idx + width + 1]) / 4.0;
                        (r, g, b)
                    }
                    PixelColor::Blue => {
                        let b = data[idx];
                        let g = (data[idx - 1] + data[idx + 1] + data[idx - width] + data[idx + width]) / 4.0;
                        let r = (data[idx - width - 1] + data[idx - width + 1] + data[idx + width - 1] + data[idx + width + 1]) / 4.0;
                        (r, g, b)
                    }
                    PixelColor::GreenR => {
                        let g = data[idx];
                        let r = (data[idx - 1] + data[idx + 1]) / 2.0;
                        let b = (data[idx - width] + data[idx + width]) / 2.0;
                        (r, g, b)
                    }
                    PixelColor::GreenB => {
                        let g = data[idx];
                        let b = (data[idx - 1] + data[idx + 1]) / 2.0;
                        let r = (data[idx - width] + data[idx + width]) / 2.0;
                        (r, g, b)
                    }
                };
                
                rgb_data[rgb_idx] = ((r * scale) as u8).min(255);
                rgb_data[rgb_idx + 1] = ((g * scale) as u8).min(255);
                rgb_data[rgb_idx + 2] = ((b * scale) as u8).min(255);
            }
        }
        
        RgbImage::from_raw(width as u32, height as u32, rgb_data)
            .map(DynamicImage::ImageRgb8)
    }
    
    /// 解析 CFA 模式，返回各像素在 2x2 模式中的位置
    /// 位置布局: 0=左上, 1=右上, 2=左下, 3=右下
    fn parse_cfa_info(&self, cfa: &str) -> CfaInfo {
        // 标准化 CFA 字符串
        let cfa_upper = cfa.to_uppercase();
        let cfa_normalized = cfa_upper.trim();
        
        tracing::debug!("解析 CFA 模式: '{}' -> '{}'", cfa, cfa_normalized);
        
        match cfa_normalized {
            "RGGB" => CfaInfo {
                // R  Gr    位置 0  1
                // Gb B     位置 2  3
                r_pos: 0,
                gr_pos: 1,  // Gr 与 R 同行，R 在左侧
                gb_pos: 2,  // Gb 与 B 同行，B 在右侧
                b_pos: 3,
            },
            "BGGR" => CfaInfo {
                // B  Gb    位置 0  1
                // Gr R     位置 2  3
                b_pos: 0,
                gb_pos: 1,  // Gb 与 B 同行，B 在左侧
                gr_pos: 2,  // Gr 与 R 同行，R 在右侧
                r_pos: 3,
            },
            "GRBG" => CfaInfo {
                // Gr R     位置 0  1
                // B  Gb    位置 2  3
                gr_pos: 0,  // Gr 与 R 同行，R 在右侧
                r_pos: 1,
                b_pos: 2,
                gb_pos: 3,  // Gb 与 B 同行，B 在左侧
            },
            "GBRG" => CfaInfo {
                // Gb B     位置 0  1
                // R  Gr    位置 2  3
                gb_pos: 0,  // Gb 与 B 同行，B 在右侧
                b_pos: 1,
                r_pos: 2,
                gr_pos: 3,  // Gr 与 R 同行，R 在左侧
            },
            _ => {
                tracing::warn!("未知 CFA 模式: '{}'，使用默认 RGGB", cfa);
                CfaInfo {
                    r_pos: 0,
                    gr_pos: 1,
                    gb_pos: 2,
                    b_pos: 3,
                }
            }
        }
    }
    
    /// 获取 Bayer 位置的颜色类型
    fn get_pixel_color(&self, x: usize, y: usize, cfa: &CfaInfo) -> PixelColor {
        let bayer_x = x % 2;
        let bayer_y = y % 2;
        let pos = bayer_y * 2 + bayer_x;
        
        if pos == cfa.r_pos {
            PixelColor::Red
        } else if pos == cfa.b_pos {
            PixelColor::Blue
        } else if pos == cfa.gr_pos {
            PixelColor::GreenR  // 与 R 同行的 G
        } else {
            PixelColor::GreenB  // 与 B 同行的 G
        }
    }

    /// 从 JPEG 文件中提取嵌入的缩略图（如果存在）
    ///
    /// 许多相机会在 JPEG 的 EXIF 数据中存储一个预生成的缩略图，
    /// 提取它比重新解码整个图像要快得多。
    fn extract_jpeg_thumbnail(&self, path: &Path) -> Option<DynamicImage> {
        // 打开文件
        let file = std::fs::File::open(path).ok()?;
        let mut bufreader = std::io::BufReader::new(file);

        // 读取 EXIF 数据
        let exifreader = exif::Reader::new();
        let exif = exifreader.read_from_container(&mut bufreader).ok()?;

        // 查找 EXIF 缩略图
        let thumb_field = exif.get_field(exif::Tag::JPEGInterchangeFormat, exif::In::PRIMARY)?;
        let thumb_offset = thumb_field.value.get_uint(0)? as u64;

        let thumb_len_field = exif.get_field(exif::Tag::JPEGInterchangeFormatLength, exif::In::PRIMARY)?;
        let thumb_len = thumb_len_field.value.get_uint(0)? as u64;

        // 重新打开文件并seek到缩略图位置
        let mut file = std::fs::File::open(path).ok()?;
        use std::io::{Seek, SeekFrom, Read};
        file.seek(SeekFrom::Start(thumb_offset)).ok()?;

        // 读取缩略图数据
        let mut thumb_data = vec![0u8; thumb_len as usize];
        file.read_exact(&mut thumb_data).ok()?;

        // 从缩略图数据加载图像
        image::load_from_memory(&thumb_data).ok()
    }

    /// 应用 EXIF 方向校正
    fn apply_orientation(&self, source_path: &Path, img: DynamicImage) -> DynamicImage {
        // 尝试读取 EXIF 方向信息
        let orientation = self.read_exif_orientation(source_path).unwrap_or(1);

        match orientation {
            1 => img, // 正常
            2 => img.fliph(), // 水平翻转
            3 => img.rotate180(), // 旋转 180°
            4 => img.flipv(), // 垂直翻转
            5 => img.rotate90().fliph(), // 旋转 90° 顺时针 + 水平翻转
            6 => img.rotate90(), // 旋转 90° 顺时针
            7 => img.rotate270().fliph(), // 旋转 270° 顺时针 + 水平翻转
            8 => img.rotate270(), // 旋转 270° 顺时针
            _ => img,
        }
    }

    /// 读取 EXIF 方向信息
    fn read_exif_orientation(&self, path: &Path) -> Option<u32> {
        let file = std::fs::File::open(path).ok()?;
        let mut bufreader = std::io::BufReader::new(file);
        let exifreader = exif::Reader::new();
        let exif = exifreader.read_from_container(&mut bufreader).ok()?;

        exif.get_field(exif::Tag::Orientation, exif::In::PRIMARY)
            .and_then(|f| f.value.get_uint(0))
    }

    /// 批量生成缩略图
    pub fn generate_batch(
        &self,
        items: &[(PathBuf, String)], // (source_path, file_hash)
        size: ThumbnailSize,
    ) -> Vec<AppResult<ThumbnailResult>> {
        use rayon::prelude::*;

        items
            .par_iter()
            .map(|(path, hash)| self.get_or_generate(path, hash, size))
            .collect()
    }

    /// 删除照片的所有缩略图
    pub fn delete_thumbnails(&self, file_hash: &str) -> AppResult<()> {
        for size in [ThumbnailSize::Small, ThumbnailSize::Medium, ThumbnailSize::Large] {
            let path = self.get_cache_path(file_hash, size);
            if path.exists() {
                fs::remove_file(&path)?;
                tracing::debug!("删除缩略图: {:?}", path);
            }
        }
        Ok(())
    }

    /// 清理过期缩略图（超过指定天数未访问）
    pub fn cleanup_old_thumbnails(&self, max_age_days: u64) -> AppResult<CleanupStats> {
        let mut stats = CleanupStats::default();
        let max_age = std::time::Duration::from_secs(max_age_days * 24 * 60 * 60);
        let now = std::time::SystemTime::now();

        for size in [ThumbnailSize::Small, ThumbnailSize::Medium, ThumbnailSize::Large] {
            let dir = self.cache_dir.join(size.name());
            if !dir.exists() {
                continue;
            }

            for entry in fs::read_dir(&dir)? {
                let entry = entry?;
                let path = entry.path();

                if path.is_file() {
                    stats.total_files += 1;

                    if let Ok(metadata) = entry.metadata() {
                        // 使用修改时间作为最后访问时间的近似值
                        if let Ok(modified) = metadata.modified() {
                            if let Ok(age) = now.duration_since(modified) {
                                if age > max_age {
                                    if fs::remove_file(&path).is_ok() {
                                        stats.deleted_files += 1;
                                        stats.freed_bytes += metadata.len();
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        tracing::info!(
            "缩略图清理完成: 删除 {} 个文件，释放 {} 字节",
            stats.deleted_files,
            stats.freed_bytes
        );

        Ok(stats)
    }

    /// 获取缓存统计信息
    pub fn get_cache_stats(&self) -> AppResult<CacheStats> {
        let mut stats = CacheStats::default();

        for size in [ThumbnailSize::Small, ThumbnailSize::Medium, ThumbnailSize::Large] {
            let dir = self.cache_dir.join(size.name());
            if !dir.exists() {
                continue;
            }

            for entry in fs::read_dir(&dir)? {
                let entry = entry?;
                if entry.path().is_file() {
                    stats.total_files += 1;
                    if let Ok(metadata) = entry.metadata() {
                        stats.total_bytes += metadata.len();
                    }
                }
            }
        }

        Ok(stats)
    }
}

/// 清理统计
#[derive(Debug, Default)]
pub struct CleanupStats {
    pub total_files: usize,
    pub deleted_files: usize,
    pub freed_bytes: u64,
}

/// 缓存统计
#[derive(Debug, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheStats {
    pub total_files: usize,
    pub total_bytes: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_image(path: &Path) {
        let img = DynamicImage::new_rgb8(100, 100);
        img.save(path).unwrap();
    }

    #[test]
    fn test_thumbnail_size() {
        // 更新后的高 DPI 支持尺寸
        assert_eq!(ThumbnailSize::Small.dimensions(), 300);
        assert_eq!(ThumbnailSize::Medium.dimensions(), 500);
        assert_eq!(ThumbnailSize::Large.dimensions(), 800);

        assert_eq!(ThumbnailSize::from_str("small"), Some(ThumbnailSize::Small));
        assert_eq!(ThumbnailSize::from_str("MEDIUM"), Some(ThumbnailSize::Medium));
        assert_eq!(ThumbnailSize::from_str("invalid"), None);
    }

    #[test]
    fn test_thumbnail_generation() {
        let temp_dir = TempDir::new().unwrap();
        let cache_dir = temp_dir.path().join("cache");
        let source_path = temp_dir.path().join("test.jpg");

        // 创建测试图片
        create_test_image(&source_path);

        // 创建服务
        let service = ThumbnailService::new(cache_dir.clone()).unwrap();

        // 生成缩略图
        let result = service
            .get_or_generate(&source_path, "testhash123", ThumbnailSize::Small)
            .unwrap();

        assert!(!result.hit_cache);
        assert!(result.path.exists());
        assert!(result.generation_time_ms.is_some());

        // 再次获取应该命中缓存
        let result2 = service
            .get_or_generate(&source_path, "testhash123", ThumbnailSize::Small)
            .unwrap();

        assert!(result2.hit_cache);
    }

    #[test]
    fn test_cache_path() {
        let temp_dir = TempDir::new().unwrap();
        let service = ThumbnailService::new(temp_dir.path().to_path_buf()).unwrap();

        let path = service.get_cache_path("abc123", ThumbnailSize::Medium);
        assert!(path.to_string_lossy().contains("medium"));
        assert!(path.to_string_lossy().contains("abc123.webp"));
    }

    #[test]
    fn test_delete_thumbnails() {
        let temp_dir = TempDir::new().unwrap();
        let cache_dir = temp_dir.path().join("cache");
        let source_path = temp_dir.path().join("test.jpg");

        create_test_image(&source_path);

        let service = ThumbnailService::new(cache_dir).unwrap();

        // 生成所有尺寸的缩略图
        for size in [ThumbnailSize::Small, ThumbnailSize::Medium, ThumbnailSize::Large] {
            service.generate(&source_path, "deletehash", size).unwrap();
        }

        // 确认缩略图存在
        assert!(service.is_cached("deletehash", ThumbnailSize::Small));
        assert!(service.is_cached("deletehash", ThumbnailSize::Medium));
        assert!(service.is_cached("deletehash", ThumbnailSize::Large));

        // 删除缩略图
        service.delete_thumbnails("deletehash").unwrap();

        // 确认已删除
        assert!(!service.is_cached("deletehash", ThumbnailSize::Small));
        assert!(!service.is_cached("deletehash", ThumbnailSize::Medium));
        assert!(!service.is_cached("deletehash", ThumbnailSize::Large));
    }
}
