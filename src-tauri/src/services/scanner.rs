//! 文件扫描服务
//!
//! 负责扫描目录、过滤图片文件

use std::path::{Path, PathBuf};
use rayon::prelude::*;
use walkdir::WalkDir;

use crate::utils::error::{AppError, AppResult};

/// 支持的图片格式
pub const SUPPORTED_FORMATS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff", "tif",
    "heic", "heif", "raw", "cr2", "cr3", "nef", "arw", "dng",
    "orf", "rw2", "pef", "srw", "raf",
];

/// 扫描结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    /// 找到的图片文件路径列表
    pub files: Vec<PathBuf>,
    /// 扫描的目录数
    pub dirs_scanned: usize,
    /// 跳过的文件数
    pub files_skipped: usize,
}

/// 扫描进度信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    /// 当前正在扫描的目录
    pub current_dir: String,
    /// 已扫描的文件数
    pub scanned_count: usize,
    /// 已找到的图片数
    pub found_count: usize,
}

/// 扫描选项
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScanOptions {
    /// 是否递归扫描子目录
    pub recursive: bool,
    /// 排除的目录名（如 .git, node_modules）
    pub exclude_dirs: Vec<String>,
    /// 最大扫描深度（0 表示无限制）
    pub max_depth: usize,
}

impl ScanOptions {
    pub fn new() -> Self {
        Self {
            recursive: true,
            exclude_dirs: vec![
                ".git".to_string(),
                "node_modules".to_string(),
                ".cache".to_string(),
                "$RECYCLE.BIN".to_string(),
                "System Volume Information".to_string(),
            ],
            max_depth: 0,
        }
    }
}

/// 文件扫描器
pub struct Scanner {
    options: ScanOptions,
}

impl Scanner {
    /// 创建新的扫描器
    pub fn new(options: ScanOptions) -> Self {
        Self { options }
    }

    /// 使用默认选项创建扫描器
    pub fn with_defaults() -> Self {
        Self::new(ScanOptions::new())
    }

    /// 扫描单个目录
    pub fn scan_directory(&self, path: &Path) -> AppResult<ScanResult> {
        if !path.exists() {
            return Err(AppError::InvalidPath(format!(
                "目录不存在: {}",
                path.display()
            )));
        }

        if !path.is_dir() {
            return Err(AppError::InvalidPath(format!(
                "路径不是目录: {}",
                path.display()
            )));
        }

        let mut walker = WalkDir::new(path);

        // 设置最大深度
        if !self.options.recursive {
            // 非递归模式：max_depth(1) 只访问根目录和直接子文件
            walker = walker.max_depth(1);
        } else if self.options.max_depth > 0 {
            walker = walker.max_depth(self.options.max_depth);
        }

        let base_path = path.to_path_buf();
        let base_depth = path.components().count();
        let mut files = Vec::new();
        let mut dirs_scanned = 0usize;
        let mut files_skipped = 0usize;

        for entry in walker.into_iter().filter_entry(|e| self.should_include_entry(e, &base_path)) {
            match entry {
                Ok(entry) => {
                    let entry_path = entry.path();
                    let entry_depth = entry_path.components().count();

                    if entry_path.is_dir() {
                        dirs_scanned += 1;
                    } else if self.is_supported_image(entry_path) {
                        // 在非递归模式下，只包含根目录中的文件
                        if !self.options.recursive && entry_depth > base_depth + 1 {
                            files_skipped += 1;
                        } else {
                            files.push(entry_path.to_path_buf());
                        }
                    } else {
                        files_skipped += 1;
                    }
                }
                Err(e) => {
                    tracing::warn!("扫描错误: {}", e);
                    files_skipped += 1;
                }
            }
        }

        tracing::info!(
            "扫描完成: {} 个目录, {} 个图片文件, {} 个跳过",
            dirs_scanned,
            files.len(),
            files_skipped
        );

        Ok(ScanResult {
            files,
            dirs_scanned,
            files_skipped,
        })
    }

    /// 并行扫描多个目录
    pub fn scan_directories(&self, paths: &[PathBuf]) -> AppResult<ScanResult> {
        let results: Vec<AppResult<ScanResult>> = paths
            .par_iter()
            .map(|path| self.scan_directory(path))
            .collect();

        let mut combined = ScanResult {
            files: Vec::new(),
            dirs_scanned: 0,
            files_skipped: 0,
        };

        for result in results {
            match result {
                Ok(scan_result) => {
                    combined.files.extend(scan_result.files);
                    combined.dirs_scanned += scan_result.dirs_scanned;
                    combined.files_skipped += scan_result.files_skipped;
                }
                Err(e) => {
                    tracing::error!("扫描目录失败: {}", e);
                }
            }
        }

        Ok(combined)
    }

    /// 检查是否应该包含此条目（返回 true 表示包含）
    fn should_include_entry(&self, entry: &walkdir::DirEntry, base_path: &Path) -> bool {
        // 文件总是包含，由后续逻辑判断是否是图片
        if !entry.file_type().is_dir() {
            return true;
        }

        // 根目录本身总是包含
        if entry.path() == base_path {
            return true;
        }

        let name = entry.file_name().to_string_lossy();

        // 跳过隐藏目录（以 . 开头，但不是 . 或 ..）
        if name.starts_with('.') && name != "." && name != ".." {
            return false;
        }

        // 跳过排除列表中的目录
        if self.options.exclude_dirs.iter().any(|d| d == &*name) {
            return false;
        }

        true
    }

    /// 检查文件是否是支持的图片格式
    fn is_supported_image(&self, path: &Path) -> bool {
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| {
                let ext_lower = ext.to_lowercase();
                SUPPORTED_FORMATS.contains(&ext_lower.as_str())
            })
            .unwrap_or(false)
    }
}

/// 快速检查文件是否是支持的图片格式
pub fn is_image_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            let ext_lower = ext.to_lowercase();
            SUPPORTED_FORMATS.contains(&ext_lower.as_str())
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_is_image_file() {
        assert!(is_image_file(Path::new("photo.jpg")));
        assert!(is_image_file(Path::new("photo.JPG")));
        assert!(is_image_file(Path::new("photo.png")));
        assert!(is_image_file(Path::new("photo.heic")));
        assert!(is_image_file(Path::new("photo.CR2")));
        assert!(!is_image_file(Path::new("document.txt")));
        assert!(!is_image_file(Path::new("video.mp4")));
    }

    #[test]
    fn test_scan_directory() {
        let temp_dir = TempDir::new().unwrap();
        let base_path = temp_dir.path();

        // 创建测试文件
        fs::write(base_path.join("photo1.jpg"), b"fake jpg").unwrap();
        fs::write(base_path.join("photo2.png"), b"fake png").unwrap();
        fs::write(base_path.join("document.txt"), b"text file").unwrap();

        // 创建子目录
        let sub_dir = base_path.join("subdir");
        fs::create_dir(&sub_dir).unwrap();
        fs::write(sub_dir.join("photo3.heic"), b"fake heic").unwrap();

        // 使用无排除目录的选项进行测试
        let options = ScanOptions {
            recursive: true,
            exclude_dirs: vec![],  // 清空排除列表，避免 Temp 目录被意外排除
            max_depth: 0,
        };
        let scanner = Scanner::new(options);
        let result = scanner.scan_directory(base_path).unwrap();

        assert_eq!(result.files.len(), 3, "应该找到 3 个图片文件");
        assert_eq!(result.files_skipped, 1, "应该跳过 1 个非图片文件 (document.txt)");
    }

    #[test]
    fn test_scan_non_recursive() {
        let temp_dir = TempDir::new().unwrap();
        let base_path = temp_dir.path();

        fs::write(base_path.join("photo1.jpg"), b"fake jpg").unwrap();

        let sub_dir = base_path.join("subdir");
        fs::create_dir(&sub_dir).unwrap();
        fs::write(sub_dir.join("photo2.jpg"), b"fake jpg").unwrap();

        let options = ScanOptions {
            recursive: false,
            exclude_dirs: vec![],
            max_depth: 0,
        };
        let scanner = Scanner::new(options);
        let result = scanner.scan_directory(base_path).unwrap();

        assert_eq!(result.files.len(), 1, "非递归模式应该只找到根目录的 photo1.jpg");
    }

    #[test]
    fn test_skip_hidden_dirs() {
        let temp_dir = TempDir::new().unwrap();
        let base_path = temp_dir.path();

        // 创建隐藏目录
        let hidden_dir = base_path.join(".hidden");
        fs::create_dir(&hidden_dir).unwrap();
        fs::write(hidden_dir.join("photo.jpg"), b"fake jpg").unwrap();

        // 创建普通文件
        fs::write(base_path.join("visible.jpg"), b"fake jpg").unwrap();

        let options = ScanOptions {
            recursive: true,
            exclude_dirs: vec![],  // 测试隐藏目录功能
            max_depth: 0,
        };
        let scanner = Scanner::new(options);
        let result = scanner.scan_directory(base_path).unwrap();

        assert_eq!(result.files.len(), 1, "应该只找到 visible.jpg，隐藏目录中的文件应该被跳过");
    }

    #[test]
    fn test_exclude_dirs() {
        let temp_dir = TempDir::new().unwrap();
        let base_path = temp_dir.path();

        // 创建要排除的目录
        let excluded_dir = base_path.join("node_modules");
        fs::create_dir(&excluded_dir).unwrap();
        fs::write(excluded_dir.join("photo.jpg"), b"fake jpg").unwrap();

        // 创建普通文件
        fs::write(base_path.join("normal.jpg"), b"fake jpg").unwrap();

        let options = ScanOptions {
            recursive: true,
            exclude_dirs: vec!["node_modules".to_string()],
            max_depth: 0,
        };
        let scanner = Scanner::new(options);
        let result = scanner.scan_directory(base_path).unwrap();

        assert_eq!(result.files.len(), 1, "应该只找到 normal.jpg，node_modules 中的文件应该被跳过");
    }
}
