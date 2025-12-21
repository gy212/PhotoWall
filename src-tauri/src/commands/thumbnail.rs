//! 缩略图相关 Tauri 命令

use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::services::{ThumbnailSize, ThumbnailTask};
use crate::utils::error::{AppError, CommandError};
use crate::AppState;

// ============ 全局统计 ============
static CACHE_HITS: AtomicU64 = AtomicU64::new(0);
static CACHE_MISSES: AtomicU64 = AtomicU64::new(0);
static TOTAL_GEN_TIME_MS: AtomicU64 = AtomicU64::new(0);
static GEN_COUNT: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailResponse {
    /// 生成的缩略图在磁盘上的绝对路径（WebP，占位图时为空字符串）
    pub path: String,
    /// 是否命中缓存
    pub hit_cache: bool,
    /// 本次生成耗时（毫秒，命中缓存时为 null）
    pub generation_time_ms: Option<u64>,
    /// 是否为占位图（RAW 提取失败时生成，不缓存到磁盘）
    pub is_placeholder: bool,
    /// 占位图 Base64 编码（WebP 格式，仅占位图时有值）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub placeholder_base64: Option<String>,
    /// 是否直接使用原图（小图跳过缩略图生成）
    pub use_original: bool,
}

// ============ 统计相关结构体和命令 ============

/// 缩略图统计信息
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailStats {
    /// 缓存命中次数
    pub cache_hits: u64,
    /// 缓存未命中次数
    pub cache_misses: u64,
    /// 缓存命中率 (0.0 - 1.0)
    pub hit_rate: f64,
    /// 平均生成耗时（毫秒）
    pub avg_generation_time_ms: f64,
    /// 当前队列深度
    pub queue_depth: usize,
}

/// 获取缩略图统计信息
#[tauri::command]
pub async fn get_thumbnail_stats(state: State<'_, AppState>) -> Result<ThumbnailStats, CommandError> {
    let hits = CACHE_HITS.load(Ordering::Relaxed);
    let misses = CACHE_MISSES.load(Ordering::Relaxed);
    let total = hits + misses;
    let hit_rate = if total > 0 {
        hits as f64 / total as f64
    } else {
        0.0
    };

    let gen_count = GEN_COUNT.load(Ordering::Relaxed);
    let total_time = TOTAL_GEN_TIME_MS.load(Ordering::Relaxed);
    let avg_time = if gen_count > 0 {
        total_time as f64 / gen_count as f64
    } else {
        0.0
    };

    let queue_depth = state.thumbnail_queue.len();

    Ok(ThumbnailStats {
        cache_hits: hits,
        cache_misses: misses,
        hit_rate,
        avg_generation_time_ms: avg_time,
        queue_depth,
    })
}

// ============ 批量缓存检查 ============

/// 批量缓存检查输入
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckCacheInput {
    pub file_hash: String,
    pub size: Option<String>,
}

/// 批量缓存检查结果
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckCacheResult {
    pub file_hash: String,
    pub size: String,
    pub cached: bool,
    pub path: Option<String>,
}

/// 批量检查缩略图缓存是否存在
#[tauri::command]
pub async fn check_thumbnails_cached(
    state: State<'_, AppState>,
    items: Vec<CheckCacheInput>,
) -> Result<Vec<CheckCacheResult>, CommandError> {
    let service = &state.thumbnail_service;
    let results: Vec<CheckCacheResult> = items
        .into_iter()
        .map(|input| {
            let size = input
                .size
                .as_deref()
                .and_then(ThumbnailSize::from_str)
                .unwrap_or(ThumbnailSize::Small);
            let cached = service.is_cached(&input.file_hash, size);
            let path = if cached {
                Some(service.get_cache_path(&input.file_hash, size).to_string_lossy().to_string())
            } else {
                None
            };
            CheckCacheResult {
                file_hash: input.file_hash,
                size: size.name().to_string(),
                cached,
                path,
            }
        })
        .collect();
    Ok(results)
}

// ============ 工具函数 ============

/// 判断文件是否为 RAW 格式
pub fn is_raw_file(path: &str) -> bool {
    let path = std::path::Path::new(path);
    if let Some(ext) = path.extension() {
        let ext = ext.to_string_lossy().to_lowercase();
        matches!(
            ext.as_str(),
            "dng" | "cr2" | "cr3" | "nef" | "nrw" | "arw" | "srf" | "sr2"
                | "orf" | "raf" | "rw2" | "pef" | "srw" | "raw" | "rwl" | "3fr"
                | "erf" | "kdc" | "dcr" | "x3f"
        )
    } else {
        false
    }
}

/// 生成（或获取缓存中的）缩略图
///
/// - source_path: 源图片绝对路径
/// - file_hash: 该文件的指纹/哈希（用于作为缓存文件名）
/// - size: small | medium | large（默认 medium）
/// - width/height: 原图尺寸（可选，用于小图跳过逻辑）
#[tauri::command]
pub async fn generate_thumbnail(
    state: State<'_, AppState>,
    source_path: String,
    file_hash: String,
    size: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
) -> Result<ThumbnailResponse, CommandError> {
    // 解析尺寸（默认 medium）
    let size = size
        .as_deref()
        .and_then(ThumbnailSize::from_str)
        .unwrap_or(ThumbnailSize::Medium);

    // 构建原图尺寸参数
    let original_dimensions = match (width, height) {
        (Some(w), Some(h)) => Some((w, h)),
        _ => None,
    };

    // 根据文件类型选择不同的 limiter：RAW 和普通格式隔离，避免 RAW 慢任务堵塞队列
    // Fast path: cache hit should return immediately.
    //
    // Otherwise cached thumbnails still need to wait for the limiter + spawn_blocking scheduling,
    // which makes "already generated" thumbnails feel slow when some other thumbnails are being
    // generated at the same time.
    let cache_path = state.thumbnail_service.get_cache_path(&file_hash, size);
    if cache_path.exists() {
        CACHE_HITS.fetch_add(1, Ordering::Relaxed);
        return Ok(ThumbnailResponse {
            path: cache_path.to_string_lossy().to_string(),
            hit_cache: true,
            generation_time_ms: None,
            is_placeholder: false,
            placeholder_base64: None,
            use_original: false,
        });
    }

    // 缓存未命中
    CACHE_MISSES.fetch_add(1, Ordering::Relaxed);

    let is_raw = is_raw_file(&source_path);
    let limiter = if is_raw {
        state.thumbnail_limiter_raw.clone()
    } else {
        state.thumbnail_limiter.clone()
    };

    let _permit = limiter
        .acquire_owned()
        .await
        .map_err(|_| CommandError::from(AppError::General("Thumbnail limiter closed".into())))?;

    let service = state.thumbnail_service.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let path_buf = PathBuf::from(&source_path);
        service.get_or_generate(&path_buf, &file_hash, size, original_dimensions)
    })
    .await
    .map_err(|e| CommandError::from(AppError::General(e.to_string())))??;

    // 累加生成时间统计
    if let Some(gen_time) = result.generation_time_ms {
        TOTAL_GEN_TIME_MS.fetch_add(gen_time, Ordering::Relaxed);
        GEN_COUNT.fetch_add(1, Ordering::Relaxed);
    }

    // 处理占位图：将字节转换为 Base64
    let placeholder_base64 = result.placeholder_bytes.as_ref().map(|bytes| {
        use base64::{Engine as _, engine::general_purpose::STANDARD};
        STANDARD.encode(bytes)
    });

    Ok(ThumbnailResponse {
        path: result.path.to_string_lossy().to_string(),
        hit_cache: result.hit_cache,
        generation_time_ms: result.generation_time_ms,
        is_placeholder: result.is_placeholder,
        placeholder_base64,
        use_original: result.use_original,
    })
}

/// 将缩略图任务加入优先级队列（用于批量生成）
///
/// - source_path: 源图片绝对路径
/// - file_hash: 文件哈希
/// - size: small | medium | large（默认 medium）
/// - priority: 优先级（数字越大优先级越高，默认 0）
/// - width/height: 原图尺寸（可选，用于小图跳过逻辑）
#[tauri::command]
pub async fn enqueue_thumbnail(
    state: State<'_, AppState>,
    source_path: String,
    file_hash: String,
    size: Option<String>,
    priority: Option<i32>,
    width: Option<u32>,
    height: Option<u32>,
) -> Result<(), CommandError> {
    let size = size
        .as_deref()
        .and_then(ThumbnailSize::from_str)
        .unwrap_or(ThumbnailSize::Medium);

    let task = ThumbnailTask::with_dimensions(
        PathBuf::from(source_path),
        file_hash,
        size,
        priority.unwrap_or(0),
        width,
        height,
    );

    state.thumbnail_queue.enqueue(task);
    Ok(())
}

/// 批量加入缩略图任务
#[tauri::command]
pub async fn enqueue_thumbnails_batch(
    state: State<'_, AppState>,
    tasks: Vec<ThumbnailTaskInput>,
) -> Result<(), CommandError> {
    let thumbnail_tasks: Vec<ThumbnailTask> = tasks
        .into_iter()
        .map(|input| {
            let size = input
                .size
                .as_deref()
                .and_then(ThumbnailSize::from_str)
                .unwrap_or(ThumbnailSize::Medium);
            ThumbnailTask::with_dimensions(
                PathBuf::from(input.source_path),
                input.file_hash,
                size,
                input.priority.unwrap_or(0),
                input.width,
                input.height,
            )
        })
        .collect();

    state.thumbnail_queue.enqueue_batch(thumbnail_tasks);
    Ok(())
}

/// 取消指定文件的缩略图生成任务
#[tauri::command]
pub async fn cancel_thumbnail(
    state: State<'_, AppState>,
    file_hash: String,
) -> Result<(), CommandError> {
    state.thumbnail_queue.cancel_by_hash(&file_hash);
    Ok(())
}

/// 检查缩略图缓存是否存在，存在则返回路径
#[tauri::command]
pub async fn get_thumbnail_cache_path(
    state: State<'_, AppState>,
    file_hash: String,
    size: Option<String>,
) -> Result<Option<String>, CommandError> {
    let size = size
        .as_deref()
        .and_then(ThumbnailSize::from_str)
        .unwrap_or(ThumbnailSize::Medium);

    let service = &state.thumbnail_service;
    if service.is_cached(&file_hash, size) {
        Ok(Some(
            service
                .get_cache_path(&file_hash, size)
                .to_string_lossy()
                .to_string(),
        ))
    } else {
        Ok(None)
    }
}

/// 缩略图任务输入（用于批量入队）
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailTaskInput {
    pub source_path: String,
    pub file_hash: String,
    pub size: Option<String>,
    pub priority: Option<i32>,
    /// 原图宽度（用于小图跳过逻辑）
    pub width: Option<u32>,
    /// 原图高度（用于小图跳过逻辑）
    pub height: Option<u32>,
}

/// LibRaw 状态信息
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrawStatus {
    /// LibRaw 是否可用
    pub available: bool,
}

/// 获取 LibRaw 状态
#[tauri::command]
pub fn get_libraw_status() -> LibrawStatus {
    LibrawStatus {
        available: crate::services::libraw::is_available(),
    }
}

/// RAW 预览响应
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RawPreviewResponse {
    /// Base64 编码的 JPEG 数据
    pub data: String,
    /// 图像宽度
    pub width: u32,
    /// 图像高度
    pub height: u32,
}

/// 获取 RAW 图像的预览（用于查看器显示）
///
/// 使用多策略提取高分辨率预览：
/// 1. LibRaw 提取嵌入预览（如果分辨率足够）
/// 2. 扫描嵌入的大尺寸 JPEG
/// 3. RAW 硬解码（全分辨率）
#[tauri::command]
pub async fn get_raw_preview(
    source_path: String,
    state: State<'_, AppState>,
) -> Result<RawPreviewResponse, CommandError> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    use image::codecs::jpeg::JpegEncoder;

    let path = PathBuf::from(&source_path);
    let service = state.thumbnail_service.clone();

    // 在阻塞线程中提取预览
    let result = tauri::async_runtime::spawn_blocking(move || {
        // 策略 1: LibRaw 提取嵌入预览
        if crate::services::libraw::is_available() {
            if let Some(img) = crate::services::libraw::extract_preview_image_with_timeout(&path, 10000) {
                // 检查分辨率是否足够（至少 1920px）
                if img.width() >= 1920 || img.height() >= 1920 {
                    tracing::debug!("LibRaw 提取到高分辨率预览: {}x{}", img.width(), img.height());
                    return Some(img);
                }
                tracing::debug!("LibRaw 预览分辨率不足: {}x{}, 尝试其他方法", img.width(), img.height());
            }
        }

        // 策略 2: 扫描嵌入的大尺寸 JPEG
        if let Some(img) = service.scan_embedded_jpeg_limited(&path, 64 * 1024 * 1024, 100 * 1024) {
            if img.width() >= 1920 || img.height() >= 1920 {
                tracing::debug!("扫描到高分辨率嵌入 JPEG: {}x{}", img.width(), img.height());
                return Some(img);
            }
        }

        // 策略 3: RAW 硬解码（全分辨率）
        if let Some(img) = service.decode_raw_image(&path) {
            tracing::debug!("RAW 硬解码成功: {}x{}", img.width(), img.height());
            return Some(img);
        }

        None
    })
    .await
    .map_err(|e| CommandError::from(AppError::General(e.to_string())))?;

    let img = result.ok_or_else(|| {
        CommandError::from(AppError::General("无法提取 RAW 预览图".into()))
    })?;

    let width = img.width();
    let height = img.height();

    // 编码为高质量 JPEG (质量 92)
    let mut jpeg_data = Vec::new();
    {
        let mut encoder = JpegEncoder::new_with_quality(&mut jpeg_data, 92);
        encoder.encode_image(&img)
            .map_err(|e| CommandError::from(AppError::General(format!("JPEG 编码失败: {}", e))))?;
    }

    tracing::info!("RAW 预览生成完成: {}x{}, {} bytes", width, height, jpeg_data.len());

    Ok(RawPreviewResponse {
        data: STANDARD.encode(&jpeg_data),
        width,
        height,
    })
}

// ============ 暖缓存 ============

/// 暖缓存策略
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WarmCacheStrategy {
    /// 最近 N 张照片
    Recent,
    /// 首屏分页的照片
    FirstPage,
}

/// 暖缓存结果
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WarmCacheResult {
    /// 入队的任务数量
    pub queued: usize,
    /// 已有缓存的数量
    pub already_cached: usize,
}

/// 启动暖缓存：预生成最可能被看到的缩略图
///
/// - strategy: 暖缓存策略
/// - limit: 最多处理的照片数量
#[tauri::command]
pub async fn warm_thumbnail_cache(
    state: State<'_, AppState>,
    strategy: WarmCacheStrategy,
    limit: Option<usize>,
) -> Result<WarmCacheResult, CommandError> {
    use crate::models::{PaginationParams, PhotoSortOptions, PhotoSortField, SortOrder};
    use std::path::PathBuf;

    let limit = limit.unwrap_or(100).min(500) as u32; // 最多 500 张
    let db = state.db.clone();
    let queue = state.thumbnail_queue.clone();
    let service = state.thumbnail_service.clone();

    let result = tokio::task::spawn_blocking(move || {
        // 根据策略获取照片
        let pagination = PaginationParams { page: 1, page_size: limit };
        let sort = match strategy {
            WarmCacheStrategy::Recent => PhotoSortOptions {
                field: PhotoSortField::DateTaken,
                order: SortOrder::Desc,
            },
            WarmCacheStrategy::FirstPage => PhotoSortOptions::default(),
        };

        let photos = db.get_photos(&pagination, &sort)
            .map_err(|e| CommandError::from(e))?
            .items;

        let mut queued = 0usize;
        let mut already_cached = 0usize;
        let mut tasks = Vec::with_capacity(photos.len() * 2);

        for photo in photos {
            let path = PathBuf::from(&photo.file_path);

            // 检查 tiny 是否已缓存
            if service.is_cached(&photo.file_hash, ThumbnailSize::Tiny) {
                already_cached += 1;
            } else {
                tasks.push(ThumbnailTask::new(
                    path.clone(),
                    photo.file_hash.clone(),
                    ThumbnailSize::Tiny,
                    10, // 暖缓存优先级略高于普通预生成
                ));
                queued += 1;
            }

            // 检查 small 是否已缓存
            if service.is_cached(&photo.file_hash, ThumbnailSize::Small) {
                already_cached += 1;
            } else {
                tasks.push(ThumbnailTask::new(
                    path,
                    photo.file_hash,
                    ThumbnailSize::Small,
                    10,
                ));
                queued += 1;
            }
        }

        if !tasks.is_empty() {
            queue.enqueue_batch(tasks);
        }

        Ok::<WarmCacheResult, CommandError>(WarmCacheResult { queued, already_cached })
    })
    .await
    .map_err(|e| CommandError::from(AppError::General(e.to_string())))??;

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_raw_file() {
        assert!(is_raw_file("C:\\a\\b.CR2"));
        assert!(is_raw_file("d:/a/b.nef"));
        assert!(!is_raw_file("C:\\a\\b.jpg"));
        assert!(!is_raw_file("C:\\a\\b.jpeg"));
        assert!(!is_raw_file("C:\\a\\b.png"));
    }
}
