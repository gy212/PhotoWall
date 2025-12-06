//! 文件哈希服务
//!
//! 负责计算文件的唯一标识（哈希值）

use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

use xxhash_rust::xxh3::xxh3_64;

use crate::utils::error::{AppError, AppResult};

/// 哈希计算选项
#[derive(Debug, Clone)]
pub struct HashOptions {
    /// 是否使用快速哈希（只读取文件头部）
    pub fast_mode: bool,
    /// 快速模式下读取的字节数
    pub fast_mode_bytes: usize,
}

impl Default for HashOptions {
    fn default() -> Self {
        Self {
            fast_mode: false,
            fast_mode_bytes: 64 * 1024, // 64KB
        }
    }
}

/// 文件哈希计算器
pub struct FileHasher;

impl FileHasher {
    /// 计算文件的完整哈希值
    pub fn hash_file(path: &Path) -> AppResult<String> {
        Self::hash_file_with_options(path, &HashOptions::default())
    }

    /// 使用指定选项计算文件哈希
    pub fn hash_file_with_options(path: &Path, options: &HashOptions) -> AppResult<String> {
        if !path.exists() {
            return Err(AppError::FileNotFound(path.display().to_string()));
        }

        let file = File::open(path).map_err(|e| {
            AppError::Io(std::io::Error::new(
                e.kind(),
                format!("无法打开文件 {}: {}", path.display(), e),
            ))
        })?;

        let mut reader = BufReader::new(file);

        if options.fast_mode {
            Self::hash_partial(&mut reader, options.fast_mode_bytes)
        } else {
            Self::hash_full(&mut reader)
        }
    }

    /// 计算完整文件哈希
    fn hash_full<R: Read>(reader: &mut R) -> AppResult<String> {
        let mut buffer = Vec::new();
        reader.read_to_end(&mut buffer)?;
        let hash = xxh3_64(&buffer);
        Ok(format!("{:016x}", hash))
    }

    /// 计算部分文件哈希（快速模式）
    fn hash_partial<R: Read>(reader: &mut R, bytes: usize) -> AppResult<String> {
        let mut buffer = vec![0u8; bytes];
        let bytes_read = reader.read(&mut buffer)?;
        buffer.truncate(bytes_read);
        let hash = xxh3_64(&buffer);
        Ok(format!("{:016x}", hash))
    }

    /// 计算快速指纹（文件大小 + 修改时间 + 部分哈希）
    /// 用于快速比对文件是否变化
    pub fn quick_fingerprint(path: &Path) -> AppResult<String> {
        let metadata = std::fs::metadata(path).map_err(|e| {
            AppError::Io(std::io::Error::new(
                e.kind(),
                format!("无法读取文件元数据 {}: {}", path.display(), e),
            ))
        })?;

        let size = metadata.len();
        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        // 计算部分哈希
        let partial_hash = Self::hash_file_with_options(
            path,
            &HashOptions {
                fast_mode: true,
                fast_mode_bytes: 8 * 1024, // 8KB for quick fingerprint
            },
        )?;

        // 组合成指纹
        Ok(format!("{}:{}:{}", size, modified, partial_hash))
    }

    /// 比较两个文件是否相同（基于哈希）
    pub fn files_equal(path1: &Path, path2: &Path) -> AppResult<bool> {
        let hash1 = Self::hash_file(path1)?;
        let hash2 = Self::hash_file(path2)?;
        Ok(hash1 == hash2)
    }

    /// 批量计算文件哈希（使用 rayon 并行）
    pub fn hash_files_parallel(paths: &[std::path::PathBuf]) -> Vec<(std::path::PathBuf, AppResult<String>)> {
        use rayon::prelude::*;

        paths
            .par_iter()
            .map(|path| (path.clone(), Self::hash_file(path)))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_hash_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        fs::write(&file_path, b"Hello, World!").unwrap();

        let hash = FileHasher::hash_file(&file_path).unwrap();
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 16); // xxh3_64 produces 16 hex chars

        // 相同内容应该产生相同哈希
        let hash2 = FileHasher::hash_file(&file_path).unwrap();
        assert_eq!(hash, hash2);
    }

    #[test]
    fn test_hash_different_content() {
        let temp_dir = TempDir::new().unwrap();

        let file1 = temp_dir.path().join("file1.txt");
        let file2 = temp_dir.path().join("file2.txt");

        fs::write(&file1, b"Content A").unwrap();
        fs::write(&file2, b"Content B").unwrap();

        let hash1 = FileHasher::hash_file(&file1).unwrap();
        let hash2 = FileHasher::hash_file(&file2).unwrap();

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_quick_fingerprint() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        fs::write(&file_path, b"Test content").unwrap();

        let fingerprint = FileHasher::quick_fingerprint(&file_path).unwrap();
        assert!(!fingerprint.is_empty());

        // 指纹应该包含三部分，用冒号分隔
        let parts: Vec<&str> = fingerprint.split(':').collect();
        assert_eq!(parts.len(), 3);
    }

    #[test]
    fn test_fast_mode() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("large.txt");

        // 创建一个较大的文件
        let content = "A".repeat(100_000);
        fs::write(&file_path, content.as_bytes()).unwrap();

        let full_hash = FileHasher::hash_file(&file_path).unwrap();
        let fast_hash = FileHasher::hash_file_with_options(
            &file_path,
            &HashOptions {
                fast_mode: true,
                fast_mode_bytes: 1024,
            },
        )
        .unwrap();

        // 快速模式和完整模式的哈希应该不同（除非文件很小）
        assert_ne!(full_hash, fast_hash);
    }

    #[test]
    fn test_files_equal() {
        let temp_dir = TempDir::new().unwrap();

        let file1 = temp_dir.path().join("file1.txt");
        let file2 = temp_dir.path().join("file2.txt");
        let file3 = temp_dir.path().join("file3.txt");

        fs::write(&file1, b"Same content").unwrap();
        fs::write(&file2, b"Same content").unwrap();
        fs::write(&file3, b"Different content").unwrap();

        assert!(FileHasher::files_equal(&file1, &file2).unwrap());
        assert!(!FileHasher::files_equal(&file1, &file3).unwrap());
    }

    #[test]
    fn test_nonexistent_file() {
        let result = FileHasher::hash_file(Path::new("/nonexistent/file.txt"));
        assert!(result.is_err());
    }
}
