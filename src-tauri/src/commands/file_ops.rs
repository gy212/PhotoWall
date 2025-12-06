//! 文件操作相关 Tauri 命令
//!
//! 包含导入、导出、移动、复制、删除、重命名等文件操作

use std::path::{Path, PathBuf};
use std::fs;

use tauri::{AppHandle, Emitter, State};

use crate::services::{IndexOptions, IndexResult, PhotoIndexer};
use crate::utils::error::{AppError, CommandError};
use crate::AppState;

/// 导入选项
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportOptions {
    /// 要导入的目录列表
    pub paths: Vec<String>,
    /// 是否递归扫描子目录
    pub recursive: bool,
    /// 是否跳过已存在的文件
    pub skip_existing: bool,
    /// 是否检测重复文件（基于哈希）
    pub detect_duplicates: bool,
}

impl Default for ImportOptions {
    fn default() -> Self {
        Self {
            paths: Vec::new(),
            recursive: true,
            skip_existing: true,
            detect_duplicates: true,
        }
    }
}

/// 导入照片命令
///
/// 注意：根据用户选择，采用"就地索引"方式，不复制文件，仅索引到数据库
#[tauri::command]
pub async fn import_photos(
    app: AppHandle,
    state: State<'_, AppState>,
    options: ImportOptions,
) -> Result<IndexResult, CommandError> {
    if options.paths.is_empty() {
        return Err(CommandError {
            code: "E_INVALID_PARAMS".to_string(),
            message: "至少需要提供一个导入路径".to_string(),
        });
    }

    let paths: Vec<PathBuf> = options.paths.into_iter().map(PathBuf::from).collect();
    let db = state.db.clone();
    let app_handle = app.clone();

    // 构建索引选项
    let index_options = IndexOptions {
        scan_options: crate::services::ScanOptions {
            recursive: options.recursive,
            ..Default::default()
        },
        skip_existing: options.skip_existing,
        detect_duplicates: options.detect_duplicates,
        batch_size: 100,
    };

    // 在后台线程执行导入
    let result = tokio::task::spawn_blocking(move || {
        let indexer = PhotoIndexer::new(db, index_options);

        indexer.index_directories_with_progress(&paths, |progress| {
            // 发送进度事件
            let _ = app_handle.emit("import-progress", progress);
        })
    })
    .await
    .map_err(|e| CommandError {
        code: "E_TASK_FAILED".to_string(),
        message: format!("导入任务失败: {}", e),
    })?
    .map_err(CommandError::from)?;

    // 发送完成事件
    let _ = app.emit("import-finished", &result);

    Ok(result)
}

/// 导出选项
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
    /// 照片ID列表
    pub photo_ids: Vec<i64>,
    /// 导出目标目录
    pub destination: String,
    /// 是否保留目录结构
    pub preserve_structure: bool,
    /// 是否覆盖已存在的文件
    pub overwrite: bool,
}

/// 导出结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    /// 成功导出的文件数
    pub exported: usize,
    /// 跳过的文件数
    pub skipped: usize,
    /// 失败的文件数
    pub failed: usize,
    /// 失败的文件列表
    pub failed_files: Vec<String>,
}

/// 导出照片命令
#[tauri::command]
pub async fn export_photos(
    app: AppHandle,
    state: State<'_, AppState>,
    options: ExportOptions,
) -> Result<ExportResult, CommandError> {
    if options.photo_ids.is_empty() {
        return Err(CommandError {
            code: "E_INVALID_PARAMS".to_string(),
            message: "至少需要提供一个照片ID".to_string(),
        });
    }

    let destination = PathBuf::from(&options.destination);
    if !destination.exists() {
        fs::create_dir_all(&destination).map_err(|e| CommandError {
            code: "E_IO_ERROR".to_string(),
            message: format!("无法创建目标目录: {}", e),
        })?;
    }

    let db = state.db.clone();
    let app_handle = app.clone();

    let result = tokio::task::spawn_blocking(move || {
        let mut exported = 0;
        let mut skipped = 0;
        let mut failed = 0;
        let mut failed_files = Vec::new();
        let total = options.photo_ids.len();

        for (index, photo_id) in options.photo_ids.iter().enumerate() {
            // 发送进度
            let _ = app_handle.emit("export-progress", serde_json::json!({
                "current": index + 1,
                "total": total,
                "percentage": ((index + 1) as f32 / total as f32) * 100.0,
            }));

            // 获取照片信息
            let photo = match db.get_photo(*photo_id) {
                Ok(Some(p)) => p,
                Ok(None) => {
                    failed += 1;
                    failed_files.push(format!("照片ID {} 不存在", photo_id));
                    continue;
                }
                Err(e) => {
                    failed += 1;
                    failed_files.push(format!("照片ID {}: {}", photo_id, e));
                    continue;
                }
            };

            let source = PathBuf::from(&photo.file_path);
            if !source.exists() {
                failed += 1;
                failed_files.push(format!("{}: 源文件不存在", photo.file_path));
                continue;
            }

            // 确定目标路径
            let target = if options.preserve_structure {
                // 保留目录结构：尝试保留相对路径
                let file_name = source.file_name().unwrap_or_default();
                destination.join(file_name)
            } else {
                // 扁平导出
                let file_name = source.file_name().unwrap_or_default();
                destination.join(file_name)
            };

            // 检查目标文件是否已存在
            if target.exists() && !options.overwrite {
                skipped += 1;
                continue;
            }

            // 复制文件
            match fs::copy(&source, &target) {
                Ok(_) => exported += 1,
                Err(e) => {
                    failed += 1;
                    failed_files.push(format!("{}: {}", photo.file_path, e));
                }
            }
        }

        ExportResult {
            exported,
            skipped,
            failed,
            failed_files,
        }
    })
    .await
    .map_err(|e| CommandError {
        code: "E_TASK_FAILED".to_string(),
        message: format!("导出任务失败: {}", e),
    })?;

    let _ = app.emit("export-finished", &result);

    Ok(result)
}

/// 删除照片命令（移动到回收站）
#[tauri::command]
pub async fn delete_photos(
    state: State<'_, AppState>,
    photo_ids: Vec<i64>,
    permanent: bool,
) -> Result<usize, CommandError> {
    if photo_ids.is_empty() {
        return Ok(0);
    }

    let db = state.db.clone();

    tokio::task::spawn_blocking(move || {
        let mut deleted = 0;

        for photo_id in &photo_ids {
            // 获取照片信息
            let photo = match db.get_photo(*photo_id) {
                Ok(Some(p)) => p,
                Ok(None) => continue,
                Err(e) => {
                    tracing::warn!("获取照片失败 {}: {}", photo_id, e);
                    continue;
                }
            };

            let file_path = PathBuf::from(&photo.file_path);

            // 删除文件
            if file_path.exists() {
                let delete_result = if permanent {
                    // 永久删除
                    fs::remove_file(&file_path)
                        .map_err(|e| format!("永久删除失败: {}", e))
                } else {
                    // 移动到回收站
                    trash::delete(&file_path)
                        .map_err(|e| format!("移动到回收站失败: {}", e))
                };

                if let Err(e) = delete_result {
                    tracing::warn!("删除文件失败 {}: {}", photo.file_path, e);
                    continue;
                }
            }

            // 从数据库删除记录
            if let Err(e) = db.delete_photo(*photo_id) {
                tracing::warn!("从数据库删除照片失败 {}: {}", photo_id, e);
                continue;
            }

            deleted += 1;
        }

        Ok(deleted)
    })
    .await
    .map_err(|e| CommandError {
        code: "E_TASK_FAILED".to_string(),
        message: format!("删除任务失败: {}", e),
    })?
}

/// 移动照片命令
#[tauri::command]
pub async fn move_photo(
    state: State<'_, AppState>,
    photo_id: i64,
    new_path: String,
) -> Result<bool, CommandError> {
    let db = state.db.clone();
    let new_path = PathBuf::from(&new_path);

    tokio::task::spawn_blocking(move || {
        // 获取照片信息
        let photo = db.get_photo(photo_id)?
            .ok_or_else(|| crate::utils::error::AppError::General("照片不存在".to_string()))?;

        let old_path = PathBuf::from(&photo.file_path);

        // 移动文件
        fs::rename(&old_path, &new_path)
            .map_err(|e| crate::utils::error::AppError::Io(e))?;

        // 更新数据库中的路径
        let conn = db.connection()?;
        conn.execute(
            "UPDATE photos SET file_path = ?1, date_modified = ?2 WHERE photo_id = ?3",
            rusqlite::params![
                new_path.to_string_lossy().to_string(),
                crate::models::photo::chrono_now_pub(),
                photo_id
            ],
        )?;

        Ok::<bool, AppError>(true)
    })
    .await
    .map_err(|e| CommandError {
        code: "E_TASK_FAILED".to_string(),
        message: format!("移动任务失败: {}", e),
    })?
    .map_err(CommandError::from)
}

/// 复制照片命令
#[tauri::command]
pub async fn copy_photo(
    state: State<'_, AppState>,
    photo_id: i64,
    new_path: String,
) -> Result<i64, CommandError> {
    let db = state.db.clone();
    let new_path = PathBuf::from(&new_path);

    tokio::task::spawn_blocking(move || {
        // 获取照片信息
        let photo = db.get_photo(photo_id)?
            .ok_or_else(|| crate::utils::error::AppError::General("照片不存在".to_string()))?;

        let old_path = PathBuf::from(&photo.file_path);

        // 复制文件
        fs::copy(&old_path, &new_path)
            .map_err(|e| crate::utils::error::AppError::Io(e))?;

        // 创建新的照片记录
        let new_file_name = new_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        // 计算新文件的哈希
        let new_hash = crate::services::FileHasher::hash_file(&new_path)?;

        let create_photo = crate::models::photo::CreatePhoto {
            file_path: new_path.to_string_lossy().to_string(),
            file_name: new_file_name,
            file_size: photo.file_size,
            file_hash: new_hash,
            width: photo.width,
            height: photo.height,
            format: photo.format,
            date_taken: photo.date_taken,
            camera_model: photo.camera_model,
            lens_model: photo.lens_model,
            focal_length: photo.focal_length,
            aperture: photo.aperture,
            iso: photo.iso,
            shutter_speed: photo.shutter_speed,
            gps_latitude: photo.gps_latitude,
            gps_longitude: photo.gps_longitude,
            orientation: photo.orientation,
        };

        let new_id = db.create_photo(&create_photo)?;
        Ok::<i64, AppError>(new_id)
    })
    .await
    .map_err(|e| CommandError {
        code: "E_TASK_FAILED".to_string(),
        message: format!("复制任务失败: {}", e),
    })?
    .map_err(CommandError::from)
}

/// 批量重命名选项
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchRenameOptions {
    /// 照片ID列表
    pub photo_ids: Vec<i64>,
    /// 命名模式（支持变量: {index}, {name}, {date}）
    pub pattern: String,
    /// 起始索引
    pub start_index: usize,
}

/// 批量重命名结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchRenameResult {
    pub renamed: usize,
    pub failed: usize,
    pub failed_files: Vec<String>,
}

/// 批量重命名照片命令
#[tauri::command]
pub async fn batch_rename_photos(
    state: State<'_, AppState>,
    options: BatchRenameOptions,
) -> Result<BatchRenameResult, CommandError> {
    if options.photo_ids.is_empty() {
        return Ok(BatchRenameResult {
            renamed: 0,
            failed: 0,
            failed_files: Vec::new(),
        });
    }

    let db = state.db.clone();

    tokio::task::spawn_blocking(move || {
        let mut renamed = 0;
        let mut failed = 0;
        let mut failed_files = Vec::new();

        for (offset, photo_id) in options.photo_ids.iter().enumerate() {
            let photo = match db.get_photo(*photo_id) {
                Ok(Some(p)) => p,
                Ok(None) => {
                    failed += 1;
                    failed_files.push(format!("照片ID {} 不存在", photo_id));
                    continue;
                }
                Err(e) => {
                    failed += 1;
                    failed_files.push(format!("照片ID {}: {}", photo_id, e));
                    continue;
                }
            };

            let old_path = PathBuf::from(&photo.file_path);
            if !old_path.exists() {
                failed += 1;
                failed_files.push(format!("{}: 文件不存在", photo.file_path));
                continue;
            }

            // 解析命名模式
            let index = options.start_index + offset;
            let date = photo.date_taken.as_deref().unwrap_or("unknown");
            let old_name = old_path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("photo");
            let extension = old_path.extension()
                .and_then(|e| e.to_str())
                .unwrap_or("jpg");

            let new_name = options.pattern
                .replace("{index}", &format!("{:04}", index))
                .replace("{name}", old_name)
                .replace("{date}", date);

            let new_file_name = format!("{}.{}", new_name, extension);
            let new_path = old_path.parent()
                .unwrap_or_else(|| Path::new(""))
                .join(&new_file_name);

            // 重命名文件
            if let Err(e) = fs::rename(&old_path, &new_path) {
                failed += 1;
                failed_files.push(format!("{}: {}", photo.file_path, e));
                continue;
            }

            // 更新数据库
            let conn = match db.connection() {
                Ok(c) => c,
                Err(e) => {
                    failed += 1;
                    failed_files.push(format!("{}: {}", photo.file_path, e));
                    // 尝试回滚文件重命名
                    let _ = fs::rename(&new_path, &old_path);
                    continue;
                }
            };

            if let Err(e) = conn.execute(
                "UPDATE photos SET file_path = ?1, file_name = ?2, date_modified = ?3 WHERE photo_id = ?4",
                rusqlite::params![
                    new_path.to_string_lossy().to_string(),
                    new_file_name,
                    crate::models::photo::chrono_now_pub(),
                    photo_id
                ],
            ) {
                failed += 1;
                failed_files.push(format!("{}: {}", photo.file_path, e));
                // 尝试回滚文件重命名
                let _ = fs::rename(&new_path, &old_path);
                continue;
            }

            renamed += 1;
        }

        Ok(BatchRenameResult {
            renamed,
            failed,
            failed_files,
        })
    })
    .await
    .map_err(|e| CommandError {
        code: "E_TASK_FAILED".to_string(),
        message: format!("批量重命名任务失败: {}", e),
    })?
}
