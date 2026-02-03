//! Thumbnail API.

use crate::error::{clear_last_error, set_last_error};
use crate::handle::PhotowallHandle;
use photowall_core::services::{ThumbnailSize, ThumbnailTask};
use serde::Deserialize;
use std::ffi::{c_char, CStr, CString};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::PathBuf;

/// Thumbnail request from JSON.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThumbnailRequest {
    file_path: String,
    file_hash: String,
    size: String,
    #[serde(default)]
    priority: i32,
    width: Option<u32>,
    height: Option<u32>,
}

fn parse_size(s: &str) -> ThumbnailSize {
    match s.to_lowercase().as_str() {
        "tiny" => ThumbnailSize::Tiny,
        "small" => ThumbnailSize::Small,
        "medium" => ThumbnailSize::Medium,
        "large" => ThumbnailSize::Large,
        _ => ThumbnailSize::Small,
    }
}

/// Enqueue multiple thumbnail generation requests.
///
/// # Parameters
/// - `handle`: Valid handle from `photowall_init`
/// - `requests_json`: JSON array of thumbnail requests
///
/// # Request format
/// ```json
/// [{"filePath": "...", "fileHash": "...", "size": "small", "priority": 10, "width": 1920, "height": 1080}]
/// ```
///
/// # Returns
/// - Number of requests enqueued (>= 0)
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_enqueue_thumbnails_batch(
    handle: *mut PhotowallHandle,
    requests_json: *const c_char,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() || requests_json.is_null() {
            set_last_error("handle or requests_json is null");
            return -1;
        }

        let handle = &*handle;

        let json_str = match CStr::from_ptr(requests_json).to_str() {
            Ok(s) => s,
            Err(_) => {
                set_last_error("invalid UTF-8 in requests_json");
                return -1;
            }
        };

        let requests: Vec<ThumbnailRequest> = match serde_json::from_str(json_str) {
            Ok(r) => r,
            Err(e) => {
                set_last_error(format!("invalid JSON: {}", e));
                return -1;
            }
        };

        let tasks: Vec<ThumbnailTask> = requests
            .into_iter()
            .map(|r| {
                ThumbnailTask::with_dimensions(
                    PathBuf::from(r.file_path),
                    r.file_hash,
                    parse_size(&r.size),
                    r.priority,
                    r.width,
                    r.height,
                )
            })
            .collect();

        let count = tasks.len() as i32;
        handle.thumbnail_queue.enqueue_batch(tasks);
        count
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_enqueue_thumbnails_batch");
        -1
    })
}

/// Get the path to a cached thumbnail.
///
/// # Parameters
/// - `handle`: Valid handle from `photowall_init`
/// - `file_hash`: File hash
/// - `size`: Size name ("tiny", "small", "medium", "large")
///
/// # Returns
/// - Path string (must be freed with `photowall_free_string`)
/// - `NULL` if not cached or on error
#[no_mangle]
pub unsafe extern "C" fn photowall_get_thumbnail_path_utf8(
    handle: *mut PhotowallHandle,
    file_hash: *const c_char,
    size: *const c_char,
) -> *mut c_char {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() || file_hash.is_null() || size.is_null() {
            set_last_error("handle, file_hash, or size is null");
            return std::ptr::null_mut();
        }

        let handle = &*handle;

        let hash_str = match CStr::from_ptr(file_hash).to_str() {
            Ok(s) => s,
            Err(_) => {
                set_last_error("invalid UTF-8 in file_hash");
                return std::ptr::null_mut();
            }
        };

        let size_str = match CStr::from_ptr(size).to_str() {
            Ok(s) => s,
            Err(_) => {
                set_last_error("invalid UTF-8 in size");
                return std::ptr::null_mut();
            }
        };

        let thumb_size = parse_size(size_str);
        let path = handle.core.thumbnails().get_cache_path(hash_str, thumb_size);

        if path.exists() {
            CString::new(path.to_string_lossy().as_ref())
                .map(|cs| cs.into_raw())
                .unwrap_or(std::ptr::null_mut())
        } else {
            std::ptr::null_mut()
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_get_thumbnail_path_utf8");
        std::ptr::null_mut()
    })
}

/// Check if a thumbnail is cached.
///
/// # Returns
/// - `1` if cached
/// - `0` if not cached
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_is_thumbnail_cached(
    handle: *mut PhotowallHandle,
    file_hash: *const c_char,
    size: *const c_char,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() || file_hash.is_null() || size.is_null() {
            set_last_error("handle, file_hash, or size is null");
            return -1;
        }

        let handle = &*handle;

        let hash_str = match CStr::from_ptr(file_hash).to_str() {
            Ok(s) => s,
            Err(_) => {
                set_last_error("invalid UTF-8 in file_hash");
                return -1;
            }
        };

        let size_str = match CStr::from_ptr(size).to_str() {
            Ok(s) => s,
            Err(_) => {
                set_last_error("invalid UTF-8 in size");
                return -1;
            }
        };

        let thumb_size = parse_size(size_str);
        if handle.core.thumbnails().is_cached(hash_str, thumb_size) {
            1
        } else {
            0
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_is_thumbnail_cached");
        -1
    })
}
