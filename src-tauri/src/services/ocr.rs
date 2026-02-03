//! OCR 文字识别服务
//!
//! 使用 Tesseract OCR 识别照片中的文字

use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::Arc;

use rusty_tesseract::{Args, Image};
use tracing::{debug, error, info, warn};

use crate::utils::error::{AppError, AppResult};

/// OCR 状态
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(i32)]
pub enum OcrStatus {
    /// 未处理
    Pending = 0,
    /// 已处理
    Processed = 1,
    /// 处理失败
    Failed = 2,
    /// 无文字
    NoText = 3,
}

impl From<i32> for OcrStatus {
    fn from(value: i32) -> Self {
        match value {
            1 => OcrStatus::Processed,
            2 => OcrStatus::Failed,
            3 => OcrStatus::NoText,
            _ => OcrStatus::Pending,
        }
    }
}

/// OCR 识别结果
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrResult {
    /// 文件路径
    pub path: String,
    /// 识别的文字
    pub text: String,
    /// 置信度 (0-100)
    pub confidence: f32,
    /// 错误信息
    pub error: Option<String>,
    /// 状态
    pub status: i32,
}

/// OCR 处理进度
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrProgress {
    /// 总数
    pub total: i64,
    /// 已处理
    pub processed: i64,
    /// 失败数
    pub failed: i64,
    /// 是否正在运行
    pub is_running: bool,
}

/// OCR 统计信息
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrStats {
    /// 总照片数
    pub total_photos: i64,
    /// 待处理数
    pub pending: i64,
    /// 已处理数
    pub processed: i64,
    /// 失败数
    pub failed: i64,
    /// 无文字数
    pub no_text: i64,
}

/// OCR 服务配置
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrConfig {
    /// 是否启用 OCR
    pub enabled: bool,
    /// 语言（如 "chi_sim+eng"）
    pub language: String,
    /// 并行处理数
    pub parallel_count: u32,
}

impl Default for OcrConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            language: "chi_sim+eng".to_string(),
            parallel_count: 2,
        }
    }
}

/// OCR 服务
pub struct OcrService {
    /// 语言配置
    language: String,
    /// 是否正在运行
    is_running: Arc<AtomicBool>,
    /// 已处理数
    processed_count: Arc<AtomicI64>,
    /// 失败数
    failed_count: Arc<AtomicI64>,
    /// 总数
    total_count: Arc<AtomicI64>,
}

impl OcrService {
    /// 创建 OCR 服务
    pub fn new(language: &str) -> Self {
        Self {
            language: language.to_string(),
            is_running: Arc::new(AtomicBool::new(false)),
            processed_count: Arc::new(AtomicI64::new(0)),
            failed_count: Arc::new(AtomicI64::new(0)),
            total_count: Arc::new(AtomicI64::new(0)),
        }
    }

    /// 检查 Tesseract 是否可用
    pub fn is_available() -> bool {
        // 尝试获取 Tesseract 版本来检查是否安装
        match rusty_tesseract::get_tesseract_version() {
            Ok(version) => {
                info!("Tesseract OCR 可用，版本: {}", version);
                true
            }
            Err(e) => {
                warn!("Tesseract OCR 不可用: {}", e);
                false
            }
        }
    }

    /// 获取可用的语言列表
    pub fn get_available_languages() -> AppResult<Vec<String>> {
        rusty_tesseract::get_tesseract_langs()
            .map_err(|e| AppError::General(format!("获取 Tesseract 语言列表失败: {}", e)))
    }

    /// 识别单张图片中的文字
    pub fn recognize(&self, image_path: &str) -> OcrResult {
        Self::recognize_with_language(&self.language, image_path)
    }

    /// 使用指定语言识别单张图片中的文字
    pub fn recognize_with_language(language: &str, image_path: &str) -> OcrResult {
        let path = Path::new(image_path);

        if !path.exists() {
            return OcrResult {
                path: image_path.to_string(),
                text: String::new(),
                confidence: 0.0,
                error: Some("文件不存在".to_string()),
                status: OcrStatus::Failed as i32,
            };
        }

        // 加载图片
        let image = match Image::from_path(image_path) {
            Ok(img) => img,
            Err(e) => {
                return OcrResult {
                    path: image_path.to_string(),
                    text: String::new(),
                    confidence: 0.0,
                    error: Some(format!("加载图片失败: {}", e)),
                    status: OcrStatus::Failed as i32,
                };
            }
        };

        // 配置 Tesseract 参数
        let args = Args {
            lang: language.to_string(),
            config_variables: Default::default(),
            dpi: Some(300),
            psm: Some(3), // 自动页面分割
            oem: Some(3), // 默认 OCR 引擎模式
        };

        // 执行 OCR
        match rusty_tesseract::image_to_string(&image, &args) {
            Ok(text) => {
                let trimmed = text.trim().to_string();
                if trimmed.is_empty() {
                    OcrResult {
                        path: image_path.to_string(),
                        text: String::new(),
                        confidence: 0.0,
                        error: None,
                        status: OcrStatus::NoText as i32,
                    }
                } else {
                    debug!("OCR 识别成功: {} -> {} 字符", image_path, trimmed.len());
                    OcrResult {
                        path: image_path.to_string(),
                        text: trimmed,
                        confidence: 80.0, // rusty-tesseract 不直接返回置信度，使用默认值
                        error: None,
                        status: OcrStatus::Processed as i32,
                    }
                }
            }
            Err(e) => {
                error!("OCR 识别失败: {} - {}", image_path, e);
                OcrResult {
                    path: image_path.to_string(),
                    text: String::new(),
                    confidence: 0.0,
                    error: Some(format!("OCR 识别失败: {}", e)),
                    status: OcrStatus::Failed as i32,
                }
            }
        }
    }

    /// 批量识别图片
    pub fn recognize_batch(&self, paths: &[String]) -> Vec<OcrResult> {
        paths.iter().map(|p| self.recognize(p)).collect()
    }

    /// 获取当前进度
    pub fn get_progress(&self) -> OcrProgress {
        OcrProgress {
            total: self.total_count.load(Ordering::Relaxed),
            processed: self.processed_count.load(Ordering::Relaxed),
            failed: self.failed_count.load(Ordering::Relaxed),
            is_running: self.is_running.load(Ordering::Relaxed),
        }
    }

    /// 设置运行状态
    pub fn set_running(&self, running: bool) {
        self.is_running.store(running, Ordering::Relaxed);
    }

    /// 重置计数器
    pub fn reset_counters(&self, total: i64) {
        self.total_count.store(total, Ordering::Relaxed);
        self.processed_count.store(0, Ordering::Relaxed);
        self.failed_count.store(0, Ordering::Relaxed);
    }

    /// 增加已处理计数
    pub fn increment_processed(&self) {
        self.processed_count.fetch_add(1, Ordering::Relaxed);
    }

    /// 增加失败计数
    pub fn increment_failed(&self) {
        self.failed_count.fetch_add(1, Ordering::Relaxed);
    }

    /// 是否正在运行
    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::Relaxed)
    }

    /// 设置语言
    pub fn set_language(&mut self, language: &str) {
        self.language = language.to_string();
    }

    /// 获取当前语言配置
    pub fn get_language(&self) -> String {
        self.language.clone()
    }
}

impl Default for OcrService {
    fn default() -> Self {
        Self::new("chi_sim+eng")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ocr_status_conversion() {
        assert_eq!(OcrStatus::from(0), OcrStatus::Pending);
        assert_eq!(OcrStatus::from(1), OcrStatus::Processed);
        assert_eq!(OcrStatus::from(2), OcrStatus::Failed);
        assert_eq!(OcrStatus::from(3), OcrStatus::NoText);
        assert_eq!(OcrStatus::from(99), OcrStatus::Pending);
    }

    #[test]
    fn test_ocr_config_default() {
        let config = OcrConfig::default();
        assert!(!config.enabled);
        assert_eq!(config.language, "chi_sim+eng");
        assert_eq!(config.parallel_count, 2);
    }
}
