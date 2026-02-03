//! OCR 命令模块
//!
//! 提供 OCR 文字识别相关的 Tauri 命令

use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;
use tracing::{error, info};

use crate::db::Database;
use crate::services::{OcrService, OcrProgress, OcrStatus};

/// OCR 服务状态
pub struct OcrState {
    pub service: Arc<Mutex<OcrService>>,
}

impl OcrState {
    pub fn new() -> Self {
        Self {
            service: Arc::new(Mutex::new(OcrService::default())),
        }
    }
}

impl Default for OcrState {
    fn default() -> Self {
        Self::new()
    }
}

/// 检查 Tesseract OCR 是否可用
#[tauri::command]
pub async fn check_ocr_available() -> Result<bool, String> {
    Ok(OcrService::is_available())
}

/// 获取可用的 OCR 语言列表
#[tauri::command]
pub async fn get_ocr_languages() -> Result<Vec<String>, String> {
    OcrService::get_available_languages()
        .map_err(|e| e.to_string())
}

/// 获取 OCR 统计信息
#[tauri::command]
pub async fn get_ocr_stats(
    db: State<'_, Arc<Database>>,
) -> Result<crate::db::photo_dao::OcrStats, String> {
    db.get_ocr_stats().map_err(|e| e.to_string())
}

/// 获取 OCR 处理进度
#[tauri::command]
pub async fn get_ocr_progress(
    ocr_state: State<'_, OcrState>,
) -> Result<OcrProgress, String> {
    let service = ocr_state.service.lock().await;
    Ok(service.get_progress())
}

/// 启动 OCR 后台处理
#[tauri::command]
pub async fn start_ocr_processing(
    db: State<'_, Arc<Database>>,
    ocr_state: State<'_, OcrState>,
    batch_size: Option<u32>,
    language: Option<String>,
) -> Result<OcrProgress, String> {
    let batch_size = batch_size.unwrap_or(10).max(1);
    let language = language.unwrap_or_else(|| "chi_sim+eng".to_string());

    // 检查是否已在运行
    {
        let service = ocr_state.service.lock().await;
        if service.is_running() {
            return Ok(service.get_progress());
        }
    }

    // 检查 Tesseract 是否可用
    if !OcrService::is_available() {
        return Err("Tesseract OCR 未安装或不可用".to_string());
    }

    let stats = db.get_ocr_stats().map_err(|e| e.to_string())?;
    let total = stats.pending;

    if total == 0 {
        return Ok(OcrProgress {
            total: 0,
            processed: 0,
            failed: 0,
            is_running: false,
        });
    }

    // 设置运行状态
    {
        let mut service = ocr_state.service.lock().await;
        service.set_language(&language);
        service.reset_counters(total);
        service.set_running(true);
    }

    // 克隆需要的状态
    let db_clone = db.inner().clone();
    let ocr_service = ocr_state.service.clone();
    let language = Arc::new(language);

    // 在后台任务中处理
    tokio::spawn(async move {
        info!("开始 OCR 处理，共 {} 张照片", total);

        loop {
            // 检查是否应该停止
            {
                let service = ocr_service.lock().await;
                if !service.is_running() {
                    info!("OCR 处理被停止");
                    break;
                }
            }

            let pending_photos = match db_clone.get_photos_pending_ocr(batch_size) {
                Ok(photos) => photos,
                Err(e) => {
                    error!("获取待处理照片失败: {}", e);
                    break;
                }
            };

            if pending_photos.is_empty() {
                break;
            }

            let mut handles = Vec::with_capacity(pending_photos.len());
            for photo in pending_photos {
                let db_task = db_clone.clone();
                let ocr_service_task = ocr_service.clone();
                let language = language.clone();
                handles.push(tokio::spawn(async move {
                    {
                        let service = ocr_service_task.lock().await;
                        if !service.is_running() {
                            return;
                        }
                    }

                    let path = photo.file_path.clone();
                    let photo_id = photo.photo_id;
                    let result = tokio::task::spawn_blocking(move || {
                        OcrService::recognize_with_language(language.as_str(), &path)
                    })
                    .await;

                    let result = match result {
                        Ok(result) => result,
                        Err(e) => {
                            error!("OCR 任务异常: {} - {}", photo_id, e);
                            if let Err(e) = db_task.update_photo_ocr(
                                photo_id,
                                None,
                                OcrStatus::Failed as i32,
                            ) {
                                error!("更新 OCR 结果失败: {} - {}", photo_id, e);
                            }

                            let service = ocr_service_task.lock().await;
                            service.increment_failed();
                            service.increment_processed();
                            return;
                        }
                    };

                    let (ocr_text, status) = if result.status == OcrStatus::Processed as i32 {
                        (Some(result.text.as_str()), OcrStatus::Processed as i32)
                    } else if result.status == OcrStatus::NoText as i32 {
                        (None, OcrStatus::NoText as i32)
                    } else {
                        (None, OcrStatus::Failed as i32)
                    };

                    if let Err(e) = db_task.update_photo_ocr(photo_id, ocr_text, status) {
                        error!("更新 OCR 结果失败: {} - {}", photo_id, e);
                    }

                    let service = ocr_service_task.lock().await;
                    if status == OcrStatus::Failed as i32 {
                        service.increment_failed();
                    }
                    service.increment_processed();
                }));
            }

            for handle in handles {
                if let Err(e) = handle.await {
                    error!("OCR 任务失败: {}", e);
                }
            }
        }

        // 完成处理
        {
            let service = ocr_service.lock().await;
            service.set_running(false);
        }

        info!("OCR 处理完成");
    });

    // 返回初始进度
    let service = ocr_state.service.lock().await;
    Ok(service.get_progress())
}

/// 停止 OCR 处理
#[tauri::command]
pub async fn stop_ocr_processing(
    ocr_state: State<'_, OcrState>,
) -> Result<(), String> {
    let service = ocr_state.service.lock().await;
    service.set_running(false);
    info!("OCR 处理已停止");
    Ok(())
}

/// 对单张照片执行 OCR
#[tauri::command]
pub async fn ocr_single_photo(
    db: State<'_, Arc<Database>>,
    ocr_state: State<'_, OcrState>,
    photo_id: i64,
) -> Result<String, String> {
    // 获取照片信息
    let photo = db.get_photo(photo_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "照片不存在".to_string())?;

    // 检查 Tesseract 是否可用
    if !OcrService::is_available() {
        return Err("Tesseract OCR 未安装或不可用".to_string());
    }

    // 执行 OCR
    let language = {
        let service = ocr_state.service.lock().await;
        service.get_language()
    };

    let path = photo.file_path.clone();
    let result = tokio::task::spawn_blocking(move || {
        OcrService::recognize_with_language(&language, &path)
    })
    .await
    .map_err(|e| e.to_string())?;

    // 更新数据库
    let (ocr_text, status) = if result.status == OcrStatus::Processed as i32 {
        (Some(result.text.as_str()), OcrStatus::Processed as i32)
    } else if result.status == OcrStatus::NoText as i32 {
        (None, OcrStatus::NoText as i32)
    } else {
        (None, OcrStatus::Failed as i32)
    };

    db.update_photo_ocr(photo_id, ocr_text, status)
        .map_err(|e| e.to_string())?;

    if let Some(error) = result.error {
        Err(error)
    } else {
        Ok(result.text)
    }
}

/// 重置所有照片的 OCR 状态
#[tauri::command]
pub async fn reset_ocr_status(
    db: State<'_, Arc<Database>>,
) -> Result<usize, String> {
    db.reset_ocr_status().map_err(|e| e.to_string())
}

/// 重置失败的 OCR 状态（用于重试）
#[tauri::command]
pub async fn reset_failed_ocr(
    db: State<'_, Arc<Database>>,
) -> Result<usize, String> {
    db.reset_failed_ocr().map_err(|e| e.to_string())
}
