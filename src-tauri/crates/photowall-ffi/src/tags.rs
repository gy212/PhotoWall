//! Tag API.

use crate::error::{clear_last_error, set_last_error};
use crate::handle::PhotowallHandle;
use photowall_core::models::{CreateTag, UpdateTag};
use std::ffi::{c_char, CStr, CString};
use std::panic::{catch_unwind, AssertUnwindSafe};

/// Helper to convert C string to Rust string.
unsafe fn cstr_to_str(ptr: *const c_char) -> Option<&'static str> {
    if ptr.is_null() {
        return None;
    }
    CStr::from_ptr(ptr).to_str().ok()
}

/// Helper to allocate a C string from Rust string.
fn string_to_cstr(s: &str) -> *mut c_char {
    CString::new(s)
        .map(|cs| cs.into_raw())
        .unwrap_or(std::ptr::null_mut())
}

/// Get all tags as JSON.
///
/// # Returns
/// - `0` on success
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_tags_get_all_json(
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

        match db.get_all_tags_with_count() {
            Ok(tags) => {
                let json = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string());
                *out_json = string_to_cstr(&json);
                0
            }
            Err(e) => {
                set_last_error(format!("get_all_tags failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_tags_get_all_json");
        -1
    })
}

/// Add a tag to a photo.
///
/// # Returns
/// - `0` on success
/// - `1` if already tagged
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_tags_add_to_photo(
    handle: *mut PhotowallHandle,
    photo_id: i64,
    tag_id: i64,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() {
            set_last_error("handle is null");
            return -1;
        }

        let handle = &*handle;
        let db = handle.core.database();

        match db.add_tag_to_photo(photo_id, tag_id) {
            Ok(true) => 0,
            Ok(false) => 1, // Already tagged
            Err(e) => {
                set_last_error(format!("add_tag_to_photo failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_tags_add_to_photo");
        -1
    })
}

/// Remove a tag from a photo.
///
/// # Returns
/// - `0` on success
/// - `1` if not tagged
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_tags_remove_from_photo(
    handle: *mut PhotowallHandle,
    photo_id: i64,
    tag_id: i64,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() {
            set_last_error("handle is null");
            return -1;
        }

        let handle = &*handle;
        let db = handle.core.database();

        match db.remove_tag_from_photo(photo_id, tag_id) {
            Ok(true) => 0,
            Ok(false) => 1, // Not tagged
            Err(e) => {
                set_last_error(format!("remove_tag_from_photo failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_tags_remove_from_photo");
        -1
    })
}

/// Create a new tag.
///
/// # Parameters
/// - `name`: Tag name (required)
/// - `color`: Tag color (optional, can be null)
/// - `out_json`: Output JSON with created tag
///
/// # Returns
/// - `0` on success
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_tags_create_json(
    handle: *mut PhotowallHandle,
    name: *const c_char,
    color: *const c_char,
    out_json: *mut *mut c_char,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() || name.is_null() || out_json.is_null() {
            set_last_error("handle, name, or out_json is null");
            return -1;
        }

        let handle = &*handle;
        let db = handle.core.database();

        let name_str = match CStr::from_ptr(name).to_str() {
            Ok(s) => s.to_string(),
            Err(_) => {
                set_last_error("invalid UTF-8 in name");
                return -1;
            }
        };

        let color_str = cstr_to_str(color).map(|s| s.to_string());

        let create_tag = CreateTag {
            tag_name: name_str,
            color: color_str,
        };

        match db.create_tag(&create_tag) {
            Ok(tag_id) => {
                // Fetch the created tag
                match db.get_tag(tag_id) {
                    Ok(Some(tag)) => {
                        let json = serde_json::to_string(&tag).unwrap_or_else(|_| "{}".to_string());
                        *out_json = string_to_cstr(&json);
                        0
                    }
                    _ => {
                        set_last_error("failed to fetch created tag");
                        -1
                    }
                }
            }
            Err(e) => {
                set_last_error(format!("create_tag failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_tags_create_json");
        -1
    })
}

/// Delete a tag.
///
/// # Returns
/// - `0` on success
/// - `1` if tag not found
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_tags_delete(handle: *mut PhotowallHandle, tag_id: i64) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() {
            set_last_error("handle is null");
            return -1;
        }

        let handle = &*handle;
        let db = handle.core.database();

        match db.delete_tag(tag_id) {
            Ok(true) => 0,
            Ok(false) => 1, // Not found
            Err(e) => {
                set_last_error(format!("delete_tag failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_tags_delete");
        -1
    })
}

/// Update a tag.
///
/// # Returns
/// - `0` on success
/// - `1` if tag not found
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_tags_update_json(
    handle: *mut PhotowallHandle,
    tag_id: i64,
    name: *const c_char,
    color: *const c_char,
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

        let name_str = cstr_to_str(name).map(|s| s.to_string());
        let color_str = cstr_to_str(color).map(|s| s.to_string());

        let update_tag = UpdateTag {
            tag_name: name_str,
            color: color_str,
        };

        match db.update_tag(tag_id, &update_tag) {
            Ok(true) => {
                // Fetch the updated tag
                match db.get_tag(tag_id) {
                    Ok(Some(tag)) => {
                        let json = serde_json::to_string(&tag).unwrap_or_else(|_| "{}".to_string());
                        *out_json = string_to_cstr(&json);
                        0
                    }
                    _ => {
                        set_last_error("failed to fetch updated tag");
                        -1
                    }
                }
            }
            Ok(false) => 1, // Not found
            Err(e) => {
                set_last_error(format!("update_tag failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_tags_update_json");
        -1
    })
}
