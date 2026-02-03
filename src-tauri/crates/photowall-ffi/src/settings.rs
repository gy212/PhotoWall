//! Settings API.

use crate::error::{clear_last_error, set_last_error};
use crate::handle::PhotowallHandle;
use photowall_core::events::EventSinkExt;
use photowall_core::models::AppSettings;
use photowall_core::services::SettingsManager;
use std::ffi::{c_char, CStr, CString};
use std::panic::{catch_unwind, AssertUnwindSafe};

fn string_to_cstr(s: &str) -> *mut c_char {
    CString::new(s)
        .map(|cs| cs.into_raw())
        .unwrap_or(std::ptr::null_mut())
}

/// Get current settings as JSON.
#[no_mangle]
pub unsafe extern "C" fn photowall_get_settings_json(
    handle: *mut PhotowallHandle,
    out_json: *mut *mut c_char,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() || out_json.is_null() {
            set_last_error("handle or out_json is null");
            return -1;
        }

        let handle = &*handle;

        match SettingsManager::new(handle.core.paths().as_ref()) {
            Ok(manager) => match manager.load() {
                Ok(settings) => {
                    let json = serde_json::to_string(&settings).unwrap_or_else(|_| "{}".to_string());
                    *out_json = string_to_cstr(&json);
                    0
                }
                Err(e) => {
                    set_last_error(format!("load settings failed: {}", e));
                    -1
                }
            },
            Err(e) => {
                set_last_error(format!("create settings manager failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_get_settings_json");
        -1
    })
}

/// Save settings from JSON.
#[no_mangle]
pub unsafe extern "C" fn photowall_save_settings_json(
    handle: *mut PhotowallHandle,
    settings_json: *const c_char,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() || settings_json.is_null() {
            set_last_error("handle or settings_json is null");
            return -1;
        }

        let handle = &*handle;

        let json_str = match CStr::from_ptr(settings_json).to_str() {
            Ok(s) => s,
            Err(_) => {
                set_last_error("invalid UTF-8 in settings_json");
                return -1;
            }
        };

        let settings: AppSettings = match serde_json::from_str(json_str) {
            Ok(s) => s,
            Err(e) => {
                set_last_error(format!("invalid settings JSON: {}", e));
                return -1;
            }
        };

        match SettingsManager::new(handle.core.paths().as_ref()) {
            Ok(manager) => match manager.save(&settings) {
                Ok(()) => {
                    // Emit settings-changed event
                    handle.event_sink.emit_typed("settings-changed", &settings);
                    0
                }
                Err(e) => {
                    set_last_error(format!("save settings failed: {}", e));
                    -1
                }
            },
            Err(e) => {
                set_last_error(format!("create settings manager failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_save_settings_json");
        -1
    })
}
