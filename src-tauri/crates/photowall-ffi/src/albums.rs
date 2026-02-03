//! Album API.

use crate::error::{clear_last_error, set_last_error};
use crate::handle::PhotowallHandle;
use photowall_core::models::{CreateAlbum, PaginationParams, PhotoSortOptions};
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

/// Get all albums as JSON.
#[no_mangle]
pub unsafe extern "C" fn photowall_albums_get_all_json(
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

        match db.get_all_albums_with_count() {
            Ok(albums) => {
                let json = serde_json::to_string(&albums).unwrap_or_else(|_| "[]".to_string());
                *out_json = string_to_cstr(&json);
                0
            }
            Err(e) => {
                set_last_error(format!("get_all_albums failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_albums_get_all_json");
        -1
    })
}

/// Add a photo to an album.
#[no_mangle]
pub unsafe extern "C" fn photowall_albums_add_photo(
    handle: *mut PhotowallHandle,
    album_id: i64,
    photo_id: i64,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() {
            set_last_error("handle is null");
            return -1;
        }

        let handle = &*handle;
        let db = handle.core.database();

        match db.add_photo_to_album(album_id, photo_id) {
            Ok(true) => 0,
            Ok(false) => 1, // Already in album
            Err(e) => {
                set_last_error(format!("add_photo_to_album failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_albums_add_photo");
        -1
    })
}

/// Remove a photo from an album.
#[no_mangle]
pub unsafe extern "C" fn photowall_albums_remove_photo(
    handle: *mut PhotowallHandle,
    album_id: i64,
    photo_id: i64,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() {
            set_last_error("handle is null");
            return -1;
        }

        let handle = &*handle;
        let db = handle.core.database();

        match db.remove_photo_from_album(album_id, photo_id) {
            Ok(true) => 0,
            Ok(false) => 1, // Not in album
            Err(e) => {
                set_last_error(format!("remove_photo_from_album failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_albums_remove_photo");
        -1
    })
}

/// Create a new album.
#[no_mangle]
pub unsafe extern "C" fn photowall_albums_create_json(
    handle: *mut PhotowallHandle,
    name: *const c_char,
    description: *const c_char,
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

        let desc_str = cstr_to_str(description).map(|s| s.to_string());

        let create_album = CreateAlbum {
            album_name: name_str,
            description: desc_str,
        };

        match db.create_album(&create_album) {
            Ok(album_id) => {
                match db.get_album(album_id) {
                    Ok(Some(album)) => {
                        let json = serde_json::to_string(&album).unwrap_or_else(|_| "{}".to_string());
                        *out_json = string_to_cstr(&json);
                        0
                    }
                    _ => {
                        set_last_error("failed to fetch created album");
                        -1
                    }
                }
            }
            Err(e) => {
                set_last_error(format!("create_album failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_albums_create_json");
        -1
    })
}

/// Delete an album.
#[no_mangle]
pub unsafe extern "C" fn photowall_albums_delete(handle: *mut PhotowallHandle, album_id: i64) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() {
            set_last_error("handle is null");
            return -1;
        }

        let handle = &*handle;
        let db = handle.core.database();

        match db.delete_album(album_id) {
            Ok(true) => 0,
            Ok(false) => 1, // Not found
            Err(e) => {
                set_last_error(format!("delete_album failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_albums_delete");
        -1
    })
}

/// Get photos in an album with pagination.
#[no_mangle]
pub unsafe extern "C" fn photowall_albums_get_photos_json(
    handle: *mut PhotowallHandle,
    album_id: i64,
    page: u32,
    page_size: u32,
    sort_json: *const c_char,
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

        // Note: sort_json is currently unused as get_photos_by_album doesn't support sorting
        let _sort: PhotoSortOptions = cstr_to_str(sort_json)
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        match db.get_photos_by_album(album_id, &pagination) {
            Ok(result) => {
                let json = serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string());
                *out_json = string_to_cstr(&json);
                0
            }
            Err(e) => {
                set_last_error(format!("get_photos_by_album failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_albums_get_photos_json");
        -1
    })
}
