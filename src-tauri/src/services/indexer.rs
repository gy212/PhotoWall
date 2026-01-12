//! 索引服务
//!
//! 整合扫描、元数据提取、哈希计算，提供完整的照片索引功能

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;

use rayon::prelude::*;

use crate::db::Database;
use crate::models::photo::CreatePhoto;
use crate::utils::error::{AppError, AppResult};

use super::hasher::FileHasher;
use super::metadata::MetadataExtractor;
use super::scanner::{ScanOptions, Scanner};

/// 索引进度
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexProgress {
    /// 总文件数
    pub total: usize,
    /// 已处理数
    pub processed: usize,
    /// 成功索引数
    pub indexed: usize,
    /// 跳过数（已存在）
    pub skipped: usize,
    /// 失败数
    pub failed: usize,
    /// 当前处理的文件
    pub current_file: Option<String>,
    /// 完成百分比
    pub percentage: f32,
}

impl IndexProgress {
    pub fn new(total: usize) -> Self {
        Self {
            total,
            processed: 0,
            indexed: 0,
            skipped: 0,
            failed: 0,
            current_file: None,
            percentage: 0.0,
        }
    }

    pub fn update_percentage(&mut self) {
        if self.total > 0 {
            self.percentage = (self.processed as f32 / self.total as f32) * 100.0;
        }
    }
}

/// 索引结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexResult {
    /// 成功索引的照片数
    pub indexed: usize,
    /// 跳过的照片数（已存在）
    pub skipped: usize,
    /// 失败的照片数
    pub failed: usize,
    /// 失败的文件列表
    pub failed_files: Vec<String>,
}

/// 索引选项
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexOptions {
    /// 扫描选项
    pub scan_options: ScanOptions,
    /// 是否跳过已存在的文件（基于路径）
    pub skip_existing: bool,
    /// 是否检测重复文件（基于哈希）
    pub detect_duplicates: bool,
    /// 批量插入大小
    pub batch_size: usize,
}

impl Default for IndexOptions {
    fn default() -> Self {
        Self {
            scan_options: ScanOptions::new(),
            skip_existing: true,
            detect_duplicates: true,
            batch_size: 100,
        }
    }
}

/// 照片索引器
pub struct PhotoIndexer {
    db: Arc<Database>,
    options: IndexOptions,
    cancelled: Arc<AtomicBool>,
}

impl PhotoIndexer {
    /// 创建新的索引器
    pub fn new(db: Arc<Database>, options: IndexOptions) -> Self {
        Self {
            db,
            options,
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    /// 获取取消标志
    pub fn cancel_flag(&self) -> Arc<AtomicBool> {
        self.cancelled.clone()
    }

    /// 取消索引
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    /// 检查是否已取消
    fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }

    /// 索引单个目录
    pub fn index_directory(&self, path: &Path) -> AppResult<IndexResult> {
        self.index_directory_with_progress(path, |_| {})
    }

    /// 索引单个目录（带进度回调）
    pub fn index_directory_with_progress<F>(
        &self,
        path: &Path,
        progress_callback: F,
    ) -> AppResult<IndexResult>
    where
        F: Fn(&IndexProgress) + Send + Sync,
    {
        // 1. 扫描目录
        tracing::info!("开始扫描目录: {}", path.display());
        let scanner = Scanner::new(self.options.scan_options.clone());
        let scan_result = scanner.scan_directory(path)?;

        tracing::info!("扫描完成，找到 {} 个图片文件", scan_result.files.len());

        // 2. 索引文件
        self.index_files(&scan_result.files, progress_callback)
    }

    /// 索引多个目录
    pub fn index_directories(&self, paths: &[PathBuf]) -> AppResult<IndexResult> {
        self.index_directories_with_progress(paths, |_| {})
    }

    /// 索引多个目录（带进度回调）
    pub fn index_directories_with_progress<F>(
        &self,
        paths: &[PathBuf],
        progress_callback: F,
    ) -> AppResult<IndexResult>
    where
        F: Fn(&IndexProgress) + Send + Sync,
    {
        // 扫描所有目录
        let scanner = Scanner::new(self.options.scan_options.clone());
        let scan_result = scanner.scan_directories(paths)?;

        // 索引所有文件
        self.index_files(&scan_result.files, progress_callback)
    }

    /// 索引文件列表
    fn index_files<F>(&self, files: &[PathBuf], progress_callback: F) -> AppResult<IndexResult>
    where
        F: Fn(&IndexProgress) + Send + Sync,
    {
        let total = files.len();
        let indexed = AtomicUsize::new(0);
        let skipped = AtomicUsize::new(0);
        let failed = AtomicUsize::new(0);
        let processed = AtomicUsize::new(0);

        let failed_files = std::sync::Mutex::new(Vec::new());

        // 并行处理文件
        let photo_data: Vec<Option<CreatePhoto>> = files
            .par_iter()
            .map(|file_path| {
                // 检查是否取消
                if self.is_cancelled() {
                    return None;
                }

                let result = self.process_single_file(file_path);

                // 更新进度
                let _proc = processed.fetch_add(1, Ordering::SeqCst) + 1;

                match result {
                    Ok(Some(photo)) => {
                        indexed.fetch_add(1, Ordering::SeqCst);
                        Some(photo)
                    }
                    Ok(None) => {
                        skipped.fetch_add(1, Ordering::SeqCst);
                        None
                    }
                    Err(e) => {
                        failed.fetch_add(1, Ordering::SeqCst);
                        if let Ok(mut files) = failed_files.lock() {
                            files.push(format!("{}: {}", file_path.display(), e));
                        }
                        tracing::warn!("处理文件失败 {}: {}", file_path.display(), e);
                        None
                    }
                }
            })
            .collect();

        // 检查是否取消
        if self.is_cancelled() {
            return Err(AppError::General("索引已取消".to_string()));
        }

        // 批量插入数据库
        let photos_to_insert: Vec<CreatePhoto> = photo_data.into_iter().flatten().collect();

        if !photos_to_insert.is_empty() {
            tracing::info!("批量插入 {} 条照片记录", photos_to_insert.len());

            // 分批插入
            for chunk in photos_to_insert.chunks(self.options.batch_size) {
                if self.is_cancelled() {
                    return Err(AppError::General("索引已取消".to_string()));
                }

                if let Err(e) = self.db.create_photos_batch(chunk) {
                    tracing::error!("批量插入失败: {}", e);
                }
            }
        }

        // 发送最终进度
        let final_progress = IndexProgress {
            total,
            processed: processed.load(Ordering::SeqCst),
            indexed: indexed.load(Ordering::SeqCst),
            skipped: skipped.load(Ordering::SeqCst),
            failed: failed.load(Ordering::SeqCst),
            current_file: None,
            percentage: 100.0,
        };
        progress_callback(&final_progress);

        let failed_files = failed_files.into_inner().unwrap_or_default();

        Ok(IndexResult {
            indexed: indexed.load(Ordering::SeqCst),
            skipped: skipped.load(Ordering::SeqCst),
            failed: failed.load(Ordering::SeqCst),
            failed_files,
        })
    }

    /// 处理单个文件
    fn process_single_file(&self, path: &Path) -> AppResult<Option<CreatePhoto>> {
        let path_str = path.to_string_lossy().to_string();

        // 检查文件是否已存在（基于路径）
        if self.options.skip_existing {
            if self.db.photo_exists_by_path(&path_str)? {
                return Ok(None);
            }
        }

        // 获取文件信息
        let file_metadata = std::fs::metadata(path)?;
        let file_size = file_metadata.len() as i64;
        let file_name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        // 计算文件哈希
        let file_hash = FileHasher::hash_file(path)?;

        // 检查是否重复（基于哈希）
        if self.options.detect_duplicates {
            if self.db.photo_exists_by_hash(&file_hash)? {
                tracing::debug!("跳过重复文件: {}", path.display());
                return Ok(None);
            }
        }

        // 提取元数据
        let image_metadata = MetadataExtractor::extract(path)?;

        // 确定格式
        let format = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_lowercase());

        // 构建 CreatePhoto
        let mut photo = CreatePhoto {
            file_path: path_str,
            file_name,
            file_size,
            file_hash,
            width: None,
            height: None,
            format,
            date_taken: None,
            camera_model: None,
            lens_model: None,
            focal_length: None,
            aperture: None,
            iso: None,
            shutter_speed: None,
            gps_latitude: None,
            gps_longitude: None,
            orientation: None,
        };

        // 填充元数据
        MetadataExtractor::fill_create_photo(&mut photo, &image_metadata);

        // 如果没有从 EXIF 获取到拍摄时间，尝试其他方式
        if photo.date_taken.is_none() {
            // 1. 尝试从文件名解析日期
            if let Some(date) = Self::parse_date_from_filename(&photo.file_name) {
                photo.date_taken = Some(date);
            } 
            // 2. 使用文件修改时间作为备选
            else if let Ok(modified) = file_metadata.modified() {
                if let Ok(duration) = modified.duration_since(std::time::UNIX_EPOCH) {
                    let secs = duration.as_secs() as i64;
                    photo.date_taken = Some(Self::timestamp_to_iso8601(secs));
                }
            }
        }

        Ok(Some(photo))
    }

    /// 从文件名解析日期
    /// 支持格式: 
    /// - "屏幕截图 2025-12-03 170003.png" -> 2025-12-03T17:00:03
    /// - "IMG_20251203_170003.jpg" -> 2025-12-03T17:00:03
    /// - "2025-12-03 17.00.03.png" -> 2025-12-03T17:00:03
    /// - "20251203_170003.jpg" -> 2025-12-03T17:00:03
    fn parse_date_from_filename(filename: &str) -> Option<String> {
        use regex::Regex;
        
        // 模式1: 屏幕截图 2025-12-03 170003 或 2025-12-03 17.00.03
        let re1 = Regex::new(r"(\d{4})-(\d{2})-(\d{2})[\s_](\d{2})[.:](\d{2})[.:](\d{2})").ok()?;
        if let Some(caps) = re1.captures(filename) {
            return Some(format!(
                "{}-{}-{}T{}:{}:{}Z",
                &caps[1], &caps[2], &caps[3], &caps[4], &caps[5], &caps[6]
            ));
        }
        
        // 模式2: 屏幕截图 2025-12-03 170003 (时间无分隔符)
        let re2 = Regex::new(r"(\d{4})-(\d{2})-(\d{2})[\s_](\d{2})(\d{2})(\d{2})").ok()?;
        if let Some(caps) = re2.captures(filename) {
            return Some(format!(
                "{}-{}-{}T{}:{}:{}Z",
                &caps[1], &caps[2], &caps[3], &caps[4], &caps[5], &caps[6]
            ));
        }
        
        // 模式3: IMG_20251203_170003 或 20251203_170003
        let re3 = Regex::new(r"(\d{4})(\d{2})(\d{2})[_\-](\d{2})(\d{2})(\d{2})").ok()?;
        if let Some(caps) = re3.captures(filename) {
            return Some(format!(
                "{}-{}-{}T{}:{}:{}Z",
                &caps[1], &caps[2], &caps[3], &caps[4], &caps[5], &caps[6]
            ));
        }
        
        // 模式4: 仅日期 2025-12-03
        let re4 = Regex::new(r"(\d{4})-(\d{2})-(\d{2})").ok()?;
        if let Some(caps) = re4.captures(filename) {
            return Some(format!(
                "{}-{}-{}T00:00:00Z",
                &caps[1], &caps[2], &caps[3]
            ));
        }
        
        None
    }

    /// 将 Unix 时间戳转换为 ISO 8601 格式
    fn timestamp_to_iso8601(secs: i64) -> String {
        let days = secs / 86400;
        let remaining = secs % 86400;
        let hours = remaining / 3600;
        let minutes = (remaining % 3600) / 60;
        let seconds = remaining % 60;
        
        // 简单计算年月日 (从 1970-01-01 开始)
        let mut year = 1970;
        let mut days_remaining = days;
        
        loop {
            let days_in_year = if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
                366
            } else {
                365
            };
            if days_remaining < days_in_year {
                break;
            }
            days_remaining -= days_in_year;
            year += 1;
        }
        
        let is_leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
        let days_in_months = if is_leap {
            [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        } else {
            [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        };
        
        let mut month = 1;
        for &dim in &days_in_months {
            if days_remaining < dim {
                break;
            }
            days_remaining -= dim;
            month += 1;
        }
        
        let day = days_remaining + 1;
        
        format!(
            "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
            year, month, day, hours, minutes, seconds
        )
    }

    /// 索引单个文件（用于实时监控）
    pub fn index_single_file(&self, path: &Path) -> AppResult<bool> {
        match self.process_single_file(path) {
            Ok(Some(photo)) => {
                self.db.create_photo(&photo)?;
                Ok(true)
            }
            Ok(None) => Ok(false), // 跳过（已存在或重复）
            Err(e) => Err(e),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_index_empty_directory() {
        let temp_dir = TempDir::new().unwrap();
        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();

        let indexer = PhotoIndexer::new(Arc::new(db), IndexOptions::default());
        let result = indexer.index_directory(temp_dir.path()).unwrap();

        assert_eq!(result.indexed, 0);
        assert_eq!(result.skipped, 0);
        assert_eq!(result.failed, 0);
    }

    #[test]
    fn test_index_with_files() {
        let temp_dir = TempDir::new().unwrap();
        let base_path = temp_dir.path();

        // 创建测试图片文件
        fs::write(base_path.join("photo1.jpg"), b"fake jpg content").unwrap();
        fs::write(base_path.join("photo2.png"), b"fake png content").unwrap();
        fs::write(base_path.join("document.txt"), b"text file").unwrap();

        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();

        let indexer = PhotoIndexer::new(Arc::new(db), IndexOptions::default());
        let result = indexer.index_directory(base_path).unwrap();

        // 应该索引 2 个图片文件
        assert_eq!(result.indexed, 2);
        assert_eq!(result.failed, 0);
    }

    #[test]
    fn test_skip_existing() {
        let temp_dir = TempDir::new().unwrap();
        let base_path = temp_dir.path();

        fs::write(base_path.join("photo.jpg"), b"fake jpg").unwrap();

        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();

        let indexer = PhotoIndexer::new(Arc::new(db), IndexOptions::default());

        // 第一次索引
        let result1 = indexer.index_directory(base_path).unwrap();
        assert_eq!(result1.indexed, 1);

        // 第二次索引应该跳过
        let result2 = indexer.index_directory(base_path).unwrap();
        assert_eq!(result2.indexed, 0);
        assert_eq!(result2.skipped, 1);
    }

    #[test]
    fn test_cancel_indexing() {
        let temp_dir = TempDir::new().unwrap();
        let base_path = temp_dir.path();

        // 创建多个文件
        for i in 0..10 {
            fs::write(base_path.join(format!("photo{}.jpg", i)), b"fake").unwrap();
        }

        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();

        let indexer = PhotoIndexer::new(Arc::new(db), IndexOptions::default());

        // 立即取消
        indexer.cancel();

        let result = indexer.index_directory(base_path);
        assert!(result.is_err());
    }
}
