//! 缩略图生成服务
//!
//! 负责生成、缓存和管理照片缩略图

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, Condvar};
use image::{DynamicImage, ImageFormat, imageops::FilterType, Rgb, RgbImage};
use crate::utils::error::{AppError, AppResult};

// 引入 WIC 服务
use super::wic::WicProcessor;

/// 缩略图尺寸
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ThumbnailSize {
    /// 极小缩略图 (50x50) - 用于渐进式加载的模糊占位图
    Tiny,
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
            ThumbnailSize::Tiny => 50,     // 极小占位图，用于渐进式加载
            ThumbnailSize::Small => 300,   // 提高到 300，支持 2x DPI
            ThumbnailSize::Medium => 500,  // 提高到 500，支持高清显示
            ThumbnailSize::Large => 800,   // 提高到 800，大图预览
        }
    }

    /// 获取尺寸名称
    pub fn name(&self) -> &'static str {
        match self {
            ThumbnailSize::Tiny => "tiny",
            ThumbnailSize::Small => "small",
            ThumbnailSize::Medium => "medium",
            ThumbnailSize::Large => "large",
        }
    }

    /// 从字符串解析
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "tiny" => Some(ThumbnailSize::Tiny),
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
    /// 缩略图路径（占位图时为空）
    pub path: PathBuf,
    /// 是否命中缓存
    pub hit_cache: bool,
    /// 生成耗时（毫秒）
    pub generation_time_ms: Option<u64>,
    /// 是否为占位图（RAW 提取失败时生成）
    pub is_placeholder: bool,
    /// 占位图字节数据（WebP 格式，仅占位图时有值）
    pub placeholder_bytes: Option<Vec<u8>>,
}

/// 正在生成中的缩略图追踪（用于去重）
struct InFlightTracker {
    /// 正在生成的缩略图 key 集合 (file_hash_size)
    in_flight: HashSet<String>,
}

/// 缩略图服务
#[derive(Clone)]
pub struct ThumbnailService {
    /// 缓存根目录
    cache_dir: PathBuf,
    /// 正在生成中的缩略图追踪（全局去重）
    in_flight: Arc<(Mutex<InFlightTracker>, Condvar)>,
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
        Ok(Self {
            cache_dir,
            in_flight: Arc::new((
                Mutex::new(InFlightTracker {
                    in_flight: HashSet::new(),
                }),
                Condvar::new(),
            )),
        })
    }

    /// 生成缓存 key
    fn cache_key(file_hash: &str, size: ThumbnailSize) -> String {
        format!("{}_{}", file_hash, size.name())
    }

    /// 确保缓存目录结构存在
    fn ensure_cache_dirs(cache_dir: &Path) -> AppResult<()> {
        for size in [ThumbnailSize::Tiny, ThumbnailSize::Small, ThumbnailSize::Medium, ThumbnailSize::Large] {
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
    /// 使用去重机制确保同一张图 + 同一尺寸在同一时间只生成一次
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
                is_placeholder: false,
                placeholder_bytes: None,
            });
        }

        let key = Self::cache_key(file_hash, size);
        let (lock, cvar) = &*self.in_flight;

        // 尝试获取生成权限，如果已有其他线程在生成则等待
        {
            let mut tracker = lock.lock().unwrap();
            while tracker.in_flight.contains(&key) {
                // 等待其他线程完成生成
                tracker = cvar.wait(tracker).unwrap();
                // 再次检查缓存（可能已被其他线程生成）
                if cache_path.exists() {
                    return Ok(ThumbnailResult {
                        path: cache_path,
                        hit_cache: true,
                        generation_time_ms: None,
                        is_placeholder: false,
                        placeholder_bytes: None,
                    });
                }
            }
            // 标记为正在生成
            tracker.in_flight.insert(key.clone());
        }

        // 生成缩略图（在锁外执行，避免阻塞其他任务）
        let start = std::time::Instant::now();
        let result = self.generate(source_path, file_hash, size);

        // 生成完成，移除标记并通知等待的线程
        {
            let mut tracker = lock.lock().unwrap();
            tracker.in_flight.remove(&key);
            cvar.notify_all();
        }

        let elapsed = start.elapsed().as_millis() as u64;

        // 处理占位图情况（RAW 提取失败）
        match result {
            Ok(path) => {
                tracing::info!(
                    "生成缩略图: {:?} -> {:?} ({}ms)",
                    source_path,
                    path,
                    elapsed
                );
                Ok(ThumbnailResult {
                    path,
                    hit_cache: false,
                    generation_time_ms: Some(elapsed),
                    is_placeholder: false,
                    placeholder_bytes: None,
                })
            }
            Err(AppError::PlaceholderGenerated(bytes)) => {
                tracing::debug!(
                    "RAW 占位图生成: {:?} ({}ms, {} bytes)",
                    source_path,
                    elapsed,
                    bytes.len()
                );
                Ok(ThumbnailResult {
                    path: PathBuf::new(),
                    hit_cache: false,
                    generation_time_ms: Some(elapsed),
                    is_placeholder: true,
                    placeholder_bytes: Some(bytes),
                })
            }
            Err(e) => Err(e),
        }
    }

    /// 生成缩略图 (优化版: 优先使用 WIC)
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

        let dim = size.dimensions();
        let cache_path = self.get_cache_path(file_hash, size);
        let tmp_path = cache_path.with_extension("webp.tmp");

        // 尝试使用 WIC 加速加载和缩放
        // 注意：WIC 需要 Windows 环境。如果在非 Windows 编译，需要条件编译，但目前需求明确是 Windows。
        let wic_result = (|| -> AppResult<()> {
            let processor = WicProcessor::new()?;
            // 直接加载并缩放到目标尺寸
            let (buffer, w, h) = processor.load_and_resize(source_path, dim, dim)?;
            let img = WicProcessor::buffer_to_dynamic_image(buffer, w, h)?;

            // 确保父目录存在
            if let Some(parent) = cache_path.parent() {
                fs::create_dir_all(parent)?;
            }
            // 保存为 WebP
            img.save_with_format(&tmp_path, ImageFormat::WebP)?;
            Ok(())
        })();

        if let Ok(_) = wic_result {
            tracing::debug!("使用 WIC 成功生成缩略图: {:?}", source_path);
            // 原子重命名
            fs::rename(&tmp_path, &cache_path)?;
            return Ok(cache_path);
        } else {
            if let Err(e) = &wic_result {
                tracing::warn!("WIC 生成失败，回退到 Rust Image: {}", e);
            }
        }

        // WIC 失败或不可用，回退到原有的 Rust image crate 实现
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
            // RAW 格式:
            // - 列表/网格页（Small/Medium）严格禁止 RAW 硬解码（去马赛克），避免滚动卡顿
            // - 优先提取嵌入预览图；失败则生成占位缩略图，保证 UI 稳定
            // - 占位图不缓存到磁盘，下次请求时重试提取
            match self.extract_raw_preview(source_path, size) {
                Some(img) => img,
                None => {
                    tracing::debug!("RAW 预览提取失败，生成临时占位图（不缓存）");
                    let placeholder = self.generate_raw_placeholder(size);
                    // 将占位图编码为 WebP 字节，不保存到磁盘
                    let mut bytes = Vec::new();
                    let mut cursor = std::io::Cursor::new(&mut bytes);
                    if placeholder.write_to(&mut cursor, ImageFormat::WebP).is_ok() {
                        return Err(AppError::PlaceholderGenerated(bytes));
                    }
                    // 编码失败时返回空占位图
                    return Err(AppError::PlaceholderGenerated(Vec::new()));
                }
            }
        } else {
            // 其他格式: 正常加载
            image::open(source_path)?
        };

        // 应用 EXIF 方向校正
        let img = self.apply_orientation(source_path, img);

        // 生成缩略图（保持宽高比）
        // 使用 Triangle 滤波器替代 Lanczos3，性能更好且网格缩略图观感差异很小
        let thumbnail = if img.width() == dim && img.height() == dim {
            img
        } else {
            img.resize(dim, dim, FilterType::Triangle)
        };

        // 确保父目录存在
        if let Some(parent) = cache_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // 先写入临时文件
        thumbnail.save_with_format(&tmp_path, ImageFormat::WebP)?;

        // 原子重命名到最终路径
        fs::rename(&tmp_path, &cache_path)?;

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
    /// 优先级链路：LibRaw -> EXIF -> (仅 Large) 受限扫描 -> (仅 Large) RAW 硬解码
    ///
    /// Phase 3 优化：
    /// - LibRaw 已内置"选最大预览"策略
    /// - Small/Medium 不再使用扫描兜底，避免 IO 开销
    /// - 扫描和硬解码仅在 Large 尺寸时作为最后手段
    /// - 所有 RAW 提取都有超时保护，避免单个文件卡住队列
    fn extract_raw_preview(&self, path: &Path, size: ThumbnailSize) -> Option<DynamicImage> {
        // 超时时间优化：给 RAW 提取更多时间以提高成功率
        // LibRaw 提取嵌入预览通常需要 200-400ms，给足够的余量
        let timeout_ms = match size {
            ThumbnailSize::Tiny => 800,
            ThumbnailSize::Small | ThumbnailSize::Medium => 1500,
            ThumbnailSize::Large => 3000,
        };

        // 方法1: LibRaw 提取 embedded preview（首选，行业级实现，自动选最大预览）
        // 使用带超时的版本，避免单个 RAW 文件卡住整个队列
        if super::libraw::is_available() {
            if let Some(img) = super::libraw::extract_preview_image_with_timeout(path, timeout_ms) {
                tracing::debug!("LibRaw 提取到嵌入预览: {:?}", path);
                return Some(img);
            }
        }

        // 方法2: 尝试从 EXIF 中提取嵌入的 JPEG 缩略图（非常快，但通常较小）
        if let Some(img) = self.extract_raw_embedded_jpeg(path) {
            tracing::debug!("从 RAW EXIF 中提取到嵌入的 JPEG 预览");
            return Some(img);
        }

        // 方法3 & 4: 仅在 Large 尺寸时使用更重的兜底方法
        // Tiny/Small/Medium 直接返回 None，由调用方生成占位图
        if size != ThumbnailSize::Large {
            tracing::debug!("Tiny/Small/Medium RAW 预览提取失败，跳过扫描兜底: {:?}", path);
            return None;
        }

        // 方法3: 扫描文件查找嵌入的 JPEG 预览图（仅 Large）
        // 扫描范围收缩到 32MB，减少 IO 开销
        if let Some(img) = self.scan_embedded_jpeg_limited(path, 32 * 1024 * 1024, 50 * 1024) {
            tracing::debug!("从 RAW 文件中扫描到嵌入的 JPEG 预览");
            return Some(img);
        }

        // 方法4: RAW 硬解码兜底（仅 Large）
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

    /// 扫描 RAW 文件中嵌入的 JPEG 预览图（按字节数限制）
    ///
    /// 大多数相机 RAW 文件（NEF、CR2、DNG 等）都会嵌入一个或多个 JPEG 预览图。
    /// 这里采用流式扫描，避免一次性读入整个文件导致内存和 IO 峰值过高。
    pub fn scan_embedded_jpeg_limited(
        &self,
        path: &Path,
        max_scan_bytes: u64,
        min_jpeg_bytes: usize,
    ) -> Option<DynamicImage> {
        use std::io::Read;

        let file = std::fs::File::open(path).ok()?;
        let mut reader = std::io::BufReader::new(file);

        let mut buf = vec![0u8; 256 * 1024];
        let mut scanned: u64 = 0;

        let mut best: Vec<u8> = Vec::new();
        let mut current: Vec<u8> = Vec::new();
        let mut in_jpeg = false;
        let mut prev: Option<u8> = None;

        let max_jpeg_bytes = (max_scan_bytes.min(64 * 1024 * 1024)) as usize; // 防止异常文件导致超大内存占用

        loop {
            if scanned >= max_scan_bytes {
                break;
            }
            let to_read = (max_scan_bytes - scanned).min(buf.len() as u64) as usize;
            let n = reader.read(&mut buf[..to_read]).ok()?;
            if n == 0 {
                break;
            }

            for &b in &buf[..n] {
                scanned += 1;

                if !in_jpeg {
                    if prev == Some(0xFF) && b == 0xD8 {
                        in_jpeg = true;
                        current.clear();
                        current.reserve(256 * 1024);
                        current.push(0xFF);
                        current.push(0xD8);
                        prev = None;
                        continue;
                    }
                } else {
                    current.push(b);
                    if current.len() > max_jpeg_bytes {
                        // 超出限制，放弃本段，避免内存爆炸
                        in_jpeg = false;
                        current.clear();
                        prev = None;
                        continue;
                    }
                    if prev == Some(0xFF) && b == 0xD9 {
                        if current.len() >= min_jpeg_bytes && current.len() > best.len() {
                            best = current.clone();
                        }
                        in_jpeg = false;
                        current.clear();
                        prev = None;
                        continue;
                    }
                }

                prev = Some(b);
            }
        }

        if best.is_empty() {
            return None;
        }

        image::load_from_memory(&best).ok()
    }

    /// 生成 RAW 占位缩略图（避免在列表页因解码失败出现大量错误卡片）
    fn generate_raw_placeholder(&self, size: ThumbnailSize) -> DynamicImage {
        let dim = size.dimensions();
        let mut img = RgbImage::new(dim, dim);

        let bg = Rgb([236, 240, 243]);
        let border = Rgb([203, 213, 225]);
        let fg = Rgb([100, 116, 139]);

        for pixel in img.pixels_mut() {
            *pixel = bg;
        }

        // 边框
        let border_w = (dim / 96).clamp(2, 10);
        for y in 0..dim {
            for x in 0..dim {
                let is_border = x < border_w || y < border_w || x >= dim - border_w || y >= dim - border_w;
                if is_border {
                    img.put_pixel(x, y, border);
                }
            }
        }

        // 简单 5x7 位图字体绘制 "RAW"
        const GLYPH_W: u32 = 5;
        const GLYPH_H: u32 = 7;
        const SPACING_COLS: u32 = 1;
        const TOTAL_COLS: u32 = GLYPH_W * 3 + SPACING_COLS * 2;

        let scale = (dim / 24).max(6);
        let text_w = TOTAL_COLS * scale;
        let text_h = GLYPH_H * scale;
        let start_x = (dim.saturating_sub(text_w)) / 2;
        let start_y = (dim.saturating_sub(text_h)) / 2;

        let r: [u8; 7] = [
            0b11110,
            0b10001,
            0b10001,
            0b11110,
            0b10100,
            0b10010,
            0b10001,
        ];
        let a: [u8; 7] = [
            0b01110,
            0b10001,
            0b10001,
            0b11111,
            0b10001,
            0b10001,
            0b10001,
        ];
        let w: [u8; 7] = [
            0b10001,
            0b10001,
            0b10001,
            0b10001,
            0b10101,
            0b10101,
            0b01010,
        ];

        fn draw_glyph(
            img: &mut RgbImage,
            glyph: &[u8; 7],
            x0: u32,
            y0: u32,
            scale: u32,
            color: Rgb<u8>,
        ) {
            for (row, mask) in glyph.iter().enumerate() {
                for col in 0..GLYPH_W {
                    let bit = (mask >> (GLYPH_W - 1 - col)) & 1;
                    if bit == 0 {
                        continue;
                    }
                    let px = x0 + col * scale;
                    let py = y0 + row as u32 * scale;
                    for dy in 0..scale {
                        for dx in 0..scale {
                            let x = px + dx;
                            let y = py + dy;
                            if x < img.width() && y < img.height() {
                                img.put_pixel(x, y, color);
                            }
                        }
                    }
                }
            }
        }

        let mut x = start_x;
        draw_glyph(&mut img, &r, x, start_y, scale, fg);
        x += (GLYPH_W + SPACING_COLS) * scale;
        draw_glyph(&mut img, &a, x, start_y, scale, fg);
        x += (GLYPH_W + SPACING_COLS) * scale;
        draw_glyph(&mut img, &w, x, start_y, scale, fg);

        DynamicImage::ImageRgb8(img)
    }

    /// 使用 rawloader 解码 RAW 图像（带 Bayer 去马赛克处理）
    pub fn decode_raw_image(&self, path: &Path) -> Option<DynamicImage> {
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
        for size in [ThumbnailSize::Tiny, ThumbnailSize::Small, ThumbnailSize::Medium, ThumbnailSize::Large] {
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

        for size in [ThumbnailSize::Tiny, ThumbnailSize::Small, ThumbnailSize::Medium, ThumbnailSize::Large] {
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

        for size in [ThumbnailSize::Tiny, ThumbnailSize::Small, ThumbnailSize::Medium, ThumbnailSize::Large] {
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
        assert_eq!(ThumbnailSize::Tiny.dimensions(), 50);
        assert_eq!(ThumbnailSize::Small.dimensions(), 300);
        assert_eq!(ThumbnailSize::Medium.dimensions(), 500);
        assert_eq!(ThumbnailSize::Large.dimensions(), 800);

        assert_eq!(ThumbnailSize::from_str("tiny"), Some(ThumbnailSize::Tiny));
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
