//! Trash API.

use crate::error::{clear_last_error, set_last_error};
use crate::handle::PhotowallHandle;
use photowall_core::models::PaginationParams;
use std::ffi::{c_char, CStr, CString};
use std::panic::{catch_unwind, AssertUnwindSafe};

fn string_to_cstr(s: &str) -> *mut c_char {
    CString::new(s)
        .map(|cs| cs.into_raw())
        .unwrap_or(std::ptr::null_mut())
}

/// Soft delete photos (move to trash).
#[no_mangle]
pub unsafe extern "C" fn photowall_trash_soft_delete(
    handle: *mut PhotowallHandle,
    photo_ids_json: *const c_char,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() || photo_ids_json.is_null() {
            set_last_error("handle or photo_ids_json is null");
            return -1;
        }

        let handle = &*handle;
        let db = handle.core.database();

        let json_str = match CStr::from_ptr(photo_ids_json).to_str() {
            Ok(s) => s,
            Err(_) => {
                set_last_error("invalid UTF-8 in photo_ids_json");
                return -1;
            }
        };

        let photo_ids: Vec<i64> = match serde_json::from_str(json_str) {
            Ok(ids) => ids,
            Err(e) => {
                set_last_error(format!("invalid JSON: {}", e));
                return -1;
            }
        };

        match db.soft_delete_photos(&photo_ids) {
            Ok(count) => count as i32,
            Err(e) => {
                set_last_error(format!("soft_delete_photos failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_trash_soft_delete");
        -1
    })
}

/// Restore photos from trash.
#[no_mangle]
pub unsafe extern "C" fn photowall_trash_restore(
    handle: *mut PhotowallHandle,
    photo_ids_json: *const c_char,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() || photo_ids_json.is_null() {
            set_last_error("handle or photo_ids_json is null");
            return -1;
        }

        let handle = &*handle;
        let db = handle.core.database();

        let json_str = match CStr::from_ptr(photo_ids_json).to_str() {
            Ok(s) => s,
            Err(_) => {
                set_last_error("invalid UTF-8 in photo_ids_json");
                return -1;
            }
        };

        let photo_ids: Vec<i64> = match serde_json::from_str(json_str) {
            Ok(ids) => ids,
            Err(e) => {
                set_last_error(format!("invalid JSON: {}", e));
                return -1;
            }
        };

        match db.restore_photos(&photo_ids) {
            Ok(count) => count as i32,
            Err(e) => {
                set_last_error(format!("restore_photos failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_trash_restore");
        -1
    })
}

/// Permanently delete photos.
#[no_mangle]
pub unsafe extern "C" fn photowall_trash_permanent_delete(
    handle: *mut PhotowallHandle,
    photo_ids_json: *const c_char,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() || photo_ids_json.is_null() {
            set_last_error("handle or photo_ids_json is null");
            return -1;
        }

        let handle = &*handle;
        let db = handle.core.database();

        let json_str = match CStr::from_ptr(photo_ids_json).to_str() {
            Ok(s) => s,
            Err(_) => {
                set_last_error("invalid UTF-8 in photo_ids_json");
                return -1;
            }
        };

        let photo_ids: Vec<i64> = match serde_json::from_str(json_str) {
            Ok(ids) => ids,
            Err(e) => {
                set_last_error(format!("invalid JSON: {}", e));
                return -1;
            }
        };

        match db.permanent_delete_photos(&photo_ids) {
            Ok(count) => count as i32,
            Err(e) => {
                set_last_error(format!("permanent_delete_photos failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_trash_permanent_delete");
        -1
    })
}

/// Get deleted photos with pagination.
#[no_mangle]
pub unsafe extern "C" fn photowall_trash_get_photos_json(
    handle: *mut PhotowallHandle,
    page: u32,
    page_size: u32,
    out_json: *mut *mut c_char,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() || out_json.is_null() {
            set_last_error("handle or out_json is null");
            return -1;
        }

        let handle = &*handle;
        let db = handle.core.database();

        let pagination = PaginationParams { page, page_size };

        match db.get_deleted_photos(&pagination) {
            Ok(result) => {
                let json = serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string());
                *out_json = string_to_cstr(&json);
                0
            }
            Err(e) => {
                set_last_error(format!("get_deleted_photos failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_trash_get_photos_json");
        -1
    })
}

/// Empty the trash (permanently delete all trashed photos).
#[no_mangle]
pub unsafe extern "C" fn photowall_trash_empty(handle: *mut PhotowallHandle) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() {
            set_last_error("handle is null");
            return -1;
        }

        let handle = &*handle;
        let db = handle.core.database();

        match db.empty_trash() {
            Ok(count) => count as i32,
            Err(e) => {
                set_last_error(format!("empty_trash failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_trash_empty");
        -1
    })
}

/// Get trash statistics.
#[no_mangle]
pub unsafe extern "C" fn photowall_trash_get_stats_json(
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
        let db = handle.core.database();

        match db.get_trash_stats() {
            Ok(stats) => {
                let json = serde_json::to_string(&stats).unwrap_or_else(|_| "{}".to_string());
                *out_json = string_to_cstr(&json);
                0
            }
            Err(e) => {
                set_last_error(format!("get_trash_stats failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_trash_get_stats_json");
        -1
    })
}
