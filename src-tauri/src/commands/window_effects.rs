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
