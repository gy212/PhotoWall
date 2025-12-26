use std::sync::{Mutex, OnceLock};

use crate::models::settings::WindowSettings;
use tauri::WebviewWindow;

static LAST_WINDOW_SETTINGS: OnceLock<Mutex<WindowSettings>> = OnceLock::new();

fn window_settings_store() -> &'static Mutex<WindowSettings> {
    LAST_WINDOW_SETTINGS.get_or_init(|| Mutex::new(WindowSettings::default()))
}

fn remember_window_settings(settings: &WindowSettings) {
    if let Ok(mut guard) = window_settings_store().lock() {
        *guard = settings.clone();
    }
}

fn load_last_window_settings() -> WindowSettings {
    window_settings_store()
        .lock()
        .map(|s| s.clone())
        .unwrap_or_default()
}

pub fn apply_window_settings(window: &WebviewWindow, settings: WindowSettings) {
    remember_window_settings(&settings);
    apply_platform_effects(window, &settings);
}

pub fn reapply_last_window_settings(window: &WebviewWindow) {
    let settings = load_last_window_settings();
    apply_platform_effects(window, &settings);
}

fn apply_platform_effects(window: &WebviewWindow, settings: &WindowSettings) {
    #[cfg(target_os = "windows")]
    apply_windows_effects(window, settings);

    #[cfg(target_os = "macos")]
    apply_macos_effects(window, settings);
}

#[cfg(target_os = "windows")]
fn clear_all_effects(window: &WebviewWindow) {
    use window_vibrancy::{clear_acrylic, clear_blur, clear_mica, clear_tabbed};

    let _ = clear_tabbed(window);
    let _ = clear_mica(window);
    let _ = clear_acrylic(window);
    let _ = clear_blur(window);
}

#[cfg(target_os = "windows")]
fn apply_windows_effects(window: &WebviewWindow, settings: &WindowSettings) {
    use window_vibrancy::apply_acrylic;

    // 清除旧效果
    clear_all_effects(window);

    // 使用 transparency 参数 (0-100)
    // 0 = 不透明 (alpha=240), 100 = 高度透明 (alpha=20)
    let transparency = settings.transparency.min(100);
    let alpha = (240.0 - (transparency as f64 * 2.2)).round().clamp(20.0, 240.0) as u8;

    // 固定深色 tint 颜色
    let tint = (15, 23, 42, alpha);

    // 始终应用 Acrylic 效果
    let _ = apply_acrylic(window, Some(tint));
}

#[cfg(target_os = "macos")]
fn apply_macos_effects(window: &WebviewWindow, settings: &WindowSettings) {
    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

    // macOS 使用 transparency 作为模糊强度
    let transparency = settings.transparency.min(100) as f64;
    let radius = if transparency <= 0.0 { None } else { Some(transparency / 2.0) };
    let _ = apply_vibrancy(window, NSVisualEffectMaterial::HudWindow, None, radius);
}
