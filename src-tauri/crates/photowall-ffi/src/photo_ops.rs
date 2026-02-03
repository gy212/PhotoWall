//! Photo batch operations API.

use crate::error::{clear_last_error, set_last_error};
use crate::handle::PhotowallHandle;
use photowall_core::models::UpdatePhoto;
use std::ffi::{c_char, CStr};
use std::panic::{catch_unwind, AssertUnwindSafe};

/// Set favorite status for multiple photos.
///
/// # Returns
/// - Number of photos updated (>= 0)
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_set_photos_favorite(
    handle: *mut PhotowallHandle,
    photo_ids_json: *const c_char,
    is_favorite: i32,
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

        match db.set_photos_favorite(&photo_ids, is_favorite != 0) {
            Ok(count) => count as i32,
            Err(e) => {
                set_last_error(format!("set_photos_favorite failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_set_photos_favorite");
        -1
    })
}

/// Set rating for a single photo.
///
/// # Returns
/// - `0` on success
/// - `1` if photo not found
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_set_photo_rating(
    handle: *mut PhotowallHandle,
    photo_id: i64,
    rating: i32,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() {
            set_last_error("handle is null");
            return -1;
        }

        let handle = &*handle;
        let db = handle.core.database();

        match db.set_photo_rating(photo_id, rating) {
            Ok(true) => 0,
            Ok(false) => 1, // Not found
            Err(e) => {
                set_last_error(format!("set_photo_rating failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_set_photo_rating");
        -1
    })
}

/// Soft delete multiple photos.
///
/// # Returns
/// - Number of photos deleted (>= 0)
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_soft_delete_photos(
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
        set_last_error("panic in photowall_soft_delete_photos");
        -1
    })
}

/// Update a photo's metadata.
///
/// # Parameters
/// - `updates_json`: JSON object with optional fields to update
///
/// # Returns
/// - `0` on success
/// - `1` if photo not found
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_update_photo_json(
    handle: *mut PhotowallHandle,
    photo_id: i64,
    updates_json: *const c_char,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() || updates_json.is_null() {
            set_last_error("handle or updates_json is null");
            return -1;
        }

        let handle = &*handle;
        let db = handle.core.database();

        let json_str = match CStr::from_ptr(updates_json).to_str() {
            Ok(s) => s,
            Err(_) => {
                set_last_error("invalid UTF-8 in updates_json");
                return -1;
            }
        };

        let updates: UpdatePhoto = match serde_json::from_str(json_str) {
            Ok(u) => u,
            Err(e) => {
                set_last_error(format!("invalid updates JSON: {}", e));
                return -1;
            }
        };

        match db.update_photo(photo_id, &updates) {
            Ok(true) => 0,
            Ok(false) => 1, // Not found
            Err(e) => {
                set_last_error(format!("update_photo failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_update_photo_json");
        -1
    })
}
