//! 照片编辑命令
//!
//! 提供照片编辑相关的 Tauri IPC 命令

use std::path::PathBuf;
use tauri::State;
use crate::AppState;
use crate::services::editor::{EditorService, EditParams};
use crate::services::native_editor::{NativeEditor, PwAdjustments};
use crate::utils::error::CommandError;

/// 将 EditParams 转换为 PwAdjustments
fn params_to_adjustments(params: &EditParams) -> PwAdjustments {
    use crate::services::editor::EditOperation;

    let mut adj = PwAdjustments::default();

    for op in &params.operations {
        match op {
            EditOperation::Brightness { value } => adj.brightness = *value as f32,
            EditOperation::Contrast { value } => adj.contrast = *value as f32,
            EditOperation::Saturation { value } => adj.saturation = *value as f32,
            EditOperation::Exposure { value } => adj.exposure = *value as f32,
            EditOperation::Highlights { value } => adj.highlights = *value as f32,
            EditOperation::Shadows { value } => adj.shadows = *value as f32,
            EditOperation::Temperature { value } => adj.temperature = *value as f32,
            EditOperation::Tint { value } => adj.tint = *value as f32,
            EditOperation::Sharpen { value } => adj.sharpen = *value as f32,
            EditOperation::Blur { value } => adj.blur = *value as f32,
            EditOperation::Vignette { value } => adj.vignette = *value as f32,
            _ => {} // 旋转、翻转、裁剪等由 Rust 处理
        }
    }

    adj
}

/// 检查是否有需要 native editor 处理的调整
fn has_native_adjustments(params: &EditParams) -> bool {
    use crate::services::editor::EditOperation;

    params.operations.iter().any(|op| matches!(op,
        EditOperation::Brightness { .. } |
        EditOperation::Contrast { .. } |
        EditOperation::Saturation { .. } |
        EditOperation::Exposure { .. } |
        EditOperation::Highlights { .. } |
        EditOperation::Shadows { .. } |
        EditOperation::Temperature { .. } |
        EditOperation::Tint { .. } |
        EditOperation::Sharpen { .. } |
        EditOperation::Blur { .. }
    ))
}

/// 应用编辑并保存照片
#[tauri::command]
pub async fn apply_photo_edits(
    state: State<'_, AppState>,
    photo_id: i64,
    params: EditParams,
    save_as_copy: bool,
) -> Result<crate::models::Photo, CommandError> {
    let db = &state.db;

    // 获取照片信息
    let photo = db.get_photo(photo_id)
        .map_err(|e| CommandError { code: "E_DB_ERROR".to_string(), message: e.to_string() })?
        .ok_or_else(|| CommandError { code: "E_NOT_FOUND".to_string(), message: "照片不存在".to_string() })?;

    let source_path = PathBuf::from(&photo.file_path);

    // 确定保存路径
    let save_path = if save_as_copy {
        generate_copy_path(&source_path)
    } else {
        source_path.clone()
    };

    // 尝试使用 native editor (libvips)
    let use_native = has_native_adjustments(&params);
    let native_result = if use_native {
        match NativeEditor::load() {
            Ok(editor) => {
                let adj = params_to_adjustments(&params);
                // 如果不是副本，先复制到临时文件
                let temp_path = if save_as_copy {
                    save_path.clone()
                } else {
                    let temp = source_path.with_extension("tmp.jpg");
                    std::fs::copy(&source_path, &temp).ok();
                    temp
                };

                match editor.apply_adjustments(&source_path, &temp_path, &adj, 92) {
                    Ok(()) => {
                        if !save_as_copy {
                            // 替换原文件
                            std::fs::rename(&temp_path, &save_path).ok();
                        }
                        tracing::info!("使用 native editor (libvips) 处理图像");
                        Some(true)
                    }
                    Err(e) => {
                        tracing::warn!("Native editor 失败，回退到 Rust 实现: {}", e);
                        let _ = std::fs::remove_file(&temp_path);
                        None
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Native editor 不可用，使用 Rust 实现: {}", e);
                None
            }
        }
    } else {
        None
    };

    // 如果 native editor 失败或不可用，使用 Rust 实现
    if native_result.is_none() {
        let img = EditorService::load_image(&source_path)
            .map_err(|e| CommandError { code: "E_IMAGE_ERROR".to_string(), message: e.to_string() })?;

        let edited = EditorService::apply_edits(img, &params)
            .map_err(|e| CommandError { code: "E_EDIT_ERROR".to_string(), message: e.to_string() })?;

        EditorService::save_image(&edited, &save_path, Some(92))
            .map_err(|e| CommandError { code: "E_SAVE_ERROR".to_string(), message: e.to_string() })?;
    }

    // 更新数据库
    let updated_photo = if save_as_copy {
        photo
    } else {
        // 重新读取图像尺寸
        let img = image::open(&save_path)
            .map_err(|e| CommandError { code: "E_IMAGE_ERROR".to_string(), message: e.to_string() })?;
        let (new_width, new_height) = (img.width(), img.height());

        db.update_photo_dimensions(photo_id, new_width, new_height)
            .map_err(|e| CommandError { code: "E_DB_ERROR".to_string(), message: e.to_string() })?;

        // 删除旧缩略图
        state.thumbnail_service.delete_thumbnails(&photo.file_hash)
            .map_err(|e| CommandError { code: "E_THUMBNAIL_ERROR".to_string(), message: e.to_string() })?;

        db.get_photo(photo_id)
            .map_err(|e| CommandError { code: "E_DB_ERROR".to_string(), message: e.to_string() })?
            .ok_or_else(|| CommandError { code: "E_NOT_FOUND".to_string(), message: "照片不存在".to_string() })?
    };

    tracing::info!("照片编辑完成: {} -> {:?}", photo_id, save_path);

    Ok(updated_photo)
}

/// 获取编辑预览（Base64 编码的图像）
#[tauri::command]
pub async fn get_edit_preview(
    source_path: String,
    params: EditParams,
    max_size: Option<u32>,
) -> Result<String, CommandError> {
    let path = PathBuf::from(&source_path);

    // 加载图像
    let img = EditorService::load_image(&path)
        .map_err(|e| CommandError { code: "E_IMAGE_ERROR".to_string(), message: e.to_string() })?;

    // 生成预览尺寸
    let preview = EditorService::generate_preview(&img, max_size.unwrap_or(800));

    // 应用编辑
    let edited = EditorService::apply_edits(preview, &params)
        .map_err(|e| CommandError { code: "E_EDIT_ERROR".to_string(), message: e.to_string() })?;

    // 编码为 Base64 JPEG
    let mut buffer = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut buffer);
    edited.write_to(&mut cursor, image::ImageFormat::Jpeg)
        .map_err(|e| CommandError { code: "E_ENCODE_ERROR".to_string(), message: e.to_string() })?;

    let base64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &buffer);

    Ok(format!("data:image/jpeg;base64,{}", base64))
}

/// 检查照片是否可编辑（非 RAW 格式）
#[tauri::command]
pub fn is_photo_editable(file_path: String) -> bool {
    let path = PathBuf::from(&file_path);
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    // RAW 格式不可编辑
    !matches!(ext.as_str(),
        "dng" | "cr2" | "cr3" | "nef" | "nrw" | "arw" | "srf" | "sr2" |
        "orf" | "raf" | "rw2" | "pef" | "srw" | "raw" | "rwl" | "3fr" |
        "erf" | "kdc" | "dcr" | "x3f"
    )
}

/// 生成副本路径
fn generate_copy_path(original: &PathBuf) -> PathBuf {
    let stem = original.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("photo");
    let ext = original.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg");
    let parent = original.parent().unwrap_or(std::path::Path::new("."));

    let mut counter = 1;
    loop {
        let new_name = format!("{}_edited_{}.{}", stem, counter, ext);
        let new_path = parent.join(&new_name);
        if !new_path.exists() {
            return new_path;
        }
        counter += 1;
    }
}
