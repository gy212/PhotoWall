//! Photo query API.

use crate::error::{clear_last_error, set_last_error};
use crate::handle::PhotowallHandle;
use photowall_core::models::{Photo, PhotoCursor, PhotoSortField, PhotoSortOptions, SearchFilters};
use std::ffi::{c_char, CStr, CString};
use std::panic::{catch_unwind, AssertUnwindSafe};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CursorResponse<T> {
    photos: Vec<T>,
    next_cursor: Option<PhotoCursor>,
    total: Option<i64>,
    has_more: bool,
}

fn photo_sort_value(photo: &Photo, field: PhotoSortField) -> serde_json::Value {
    match field {
        PhotoSortField::DateTaken => photo
            .date_taken
            .as_ref()
            .map(|v| serde_json::Value::String(v.clone()))
            .unwrap_or(serde_json::Value::Null),
        PhotoSortField::DateAdded => serde_json::Value::String(photo.date_added.clone()),
        PhotoSortField::FileName => serde_json::Value::String(photo.file_name.clone()),
        PhotoSortField::FileSize => serde_json::Value::Number(serde_json::Number::from(photo.file_size)),
        PhotoSortField::Rating => serde_json::Value::Number(serde_json::Number::from(photo.rating as i64)),
    }
}

fn build_next_cursor(photos: &[Photo], sort: &PhotoSortOptions, has_more: bool) -> Option<PhotoCursor> {
    if !has_more {
        return None;
    }

    photos.last().map(|photo| PhotoCursor {
        sort_value: photo_sort_value(photo, sort.field),
        photo_id: photo.photo_id,
    })
}

/// Helper to convert C string to Rust string.
unsafe fn cstr_to_string(ptr: *const c_char) -> Option<String> {
    if ptr.is_null() {
        return None;
    }
    CStr::from_ptr(ptr).to_str().ok().map(|s| s.to_string())
}

/// Helper to allocate a C string from Rust string.
fn string_to_cstr(s: &str) -> *mut c_char {
    CString::new(s)
        .map(|cs| cs.into_raw())
        .unwrap_or(std::ptr::null_mut())
}

/// Get photos with cursor-based pagination.
///
/// # Parameters
/// - `handle`: Valid handle from `photowall_init`
/// - `limit`: Maximum number of photos to return
/// - `cursor_json`: JSON cursor from previous call (null for first page)
/// - `sort_json`: JSON sort options (null for defaults)
/// - `out_json`: Output pointer for result JSON (must be freed with `photowall_free_string`)
///
/// # Returns
/// - `0` on success
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_get_photos_cursor_json(
    handle: *mut PhotowallHandle,
    limit: u32,
    cursor_json: *const c_char,
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

        // Parse cursor if provided
        let cursor: Option<PhotoCursor> = cstr_to_string(cursor_json)
            .and_then(|s| serde_json::from_str(&s).ok());

        // Parse sort options
        let sort: PhotoSortOptions = cstr_to_string(sort_json)
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();

        let total = match db.count_photos() {
            Ok(count) => count,
            Err(e) => {
                set_last_error(format!("count_photos failed: {}", e));
                return -1;
            }
        };

        match db.get_photos_cursor(limit, cursor.as_ref(), &sort) {
            Ok(photos) => {
                let has_more = photos.len() as u32 >= limit;
                let next_cursor = build_next_cursor(&photos, &sort, has_more);
                let response = CursorResponse {
                    photos,
                    next_cursor,
                    total: Some(total),
                    has_more,
                };
                let json = serde_json::to_string(&response).unwrap_or_else(|_| "{}".to_string());
                *out_json = string_to_cstr(&json);
                0
            }
            Err(e) => {
                set_last_error(format!("get_photos_cursor failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_get_photos_cursor_json");
        -1
    })
}

/// Search photos with filters and cursor-based pagination.
///
/// # Parameters
/// - `handle`: Valid handle from `photowall_init`
/// - `filters_json`: JSON search filters
/// - `limit`: Maximum number of photos to return
/// - `cursor_json`: JSON cursor from previous call (null for first page)
/// - `sort_json`: JSON sort options (null for defaults)
/// - `include_total`: Whether to include total count (slower)
/// - `out_json`: Output pointer for result JSON
///
/// # Returns
/// - `0` on success
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_search_photos_cursor_json(
    handle: *mut PhotowallHandle,
    filters_json: *const c_char,
    limit: u32,
    cursor_json: *const c_char,
    sort_json: *const c_char,
    include_total: i32,
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

        // Parse filters
        let filters: SearchFilters = cstr_to_string(filters_json)
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();

        // Parse cursor
        let cursor: Option<PhotoCursor> = cstr_to_string(cursor_json)
            .and_then(|s| serde_json::from_str(&s).ok());

        // Parse sort options
        let sort: PhotoSortOptions = cstr_to_string(sort_json)
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();

        match db.search_photos_cursor(&filters, limit, cursor.as_ref(), &sort, include_total != 0) {
            Ok((photos, total)) => {
                let has_more = photos.len() as u32 >= limit;
                let next_cursor = build_next_cursor(&photos, &sort, has_more);
                let response = CursorResponse {
                    photos,
                    next_cursor,
                    total,
                    has_more,
                };
                let json = serde_json::to_string(&response).unwrap_or_else(|_| "{}".to_string());
                *out_json = string_to_cstr(&json);
                0
            }
            Err(e) => {
                set_last_error(format!("search_photos_cursor failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_search_photos_cursor_json");
        -1
    })
}

/// Get a single photo by ID.
///
/// # Returns
/// - `0` on success (photo found)
/// - `1` if photo not found
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_get_photo_json(
    handle: *mut PhotowallHandle,
    photo_id: i64,
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

        match db.get_photo(photo_id) {
            Ok(Some(photo)) => {
                let json = serde_json::to_string(&photo).unwrap_or_else(|_| "{}".to_string());
                *out_json = string_to_cstr(&json);
                0
            }
            Ok(None) => {
                *out_json = std::ptr::null_mut();
                1 // Not found
            }
            Err(e) => {
                set_last_error(format!("get_photo failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_get_photo_json");
        -1
    })
}
