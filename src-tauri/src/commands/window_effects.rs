//! Window appearance commands (native window effects)

use crate::models::settings::WindowSettings;
use crate::utils::error::CommandError;
use tauri::{AppHandle, Manager};

/// Apply window appearance settings (opacity / blur, etc.) to the native window.
#[tauri::command]
pub async fn apply_window_settings(app: AppHandle, settings: WindowSettings) -> Result<(), CommandError> {
    if let Some(window) = app.get_webview_window("main") {
        crate::window_effects::apply_window_settings(&window, settings);
    }
    Ok(())
}

// === Custom blur / composition blur APIs ===
//
// These commands are called by the frontend for optional effects.
// If an effect is not implemented on the current platform/build, we return a safe no-op
// instead of failing the whole UI with "Command not found".

#[tauri::command]
pub async fn clear_blur_cache() -> Result<(), CommandError> {
    Ok(())
}

#[tauri::command]
pub async fn set_exclude_from_capture(_exclude: bool) -> Result<(), CommandError> {
    Ok(())
}

#[tauri::command]
pub async fn get_blurred_desktop(_blur_radius: u32, _scale_factor: Option<f64>) -> Result<String, CommandError> {
    Ok(String::new())
}

#[tauri::command]
pub async fn is_composition_blur_supported() -> Result<bool, CommandError> {
    Ok(false)
}

#[tauri::command]
pub async fn enable_composition_blur() -> Result<(), CommandError> {
    Ok(())
}

#[tauri::command]
pub async fn disable_composition_blur() -> Result<(), CommandError> {
    Ok(())
}

#[tauri::command]
pub async fn set_composition_blur_radius(_radius: u32, _scale_factor: Option<f64>) -> Result<(), CommandError> {
    Ok(())
}

#[tauri::command]
pub async fn set_composition_tint(_r: u8, _g: u8, _b: u8, _opacity: f64) -> Result<(), CommandError> {
    Ok(())
}
