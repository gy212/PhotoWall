//! PhotoWall FFI - C ABI interface for Qt frontend.
//!
//! This crate provides a C-compatible interface to the photowall-core library,
//! enabling integration with Qt or other non-Rust frontends.
//!
//! # Usage
//!
//! 1. Call `photowall_init()` to create a handle
//! 2. Optionally register an event callback with `photowall_set_event_callback()`
//! 3. Use the various API functions
//! 4. Call `photowall_shutdown()` to clean up
//!
//! # Error Handling
//!
//! Most functions return `0` on success, `-1` on error.
//! Call `photowall_last_error()` to get the error message.
//!
//! # Memory Management
//!
//! - Strings returned via `out_json` must be freed with `photowall_free_string()`
//! - The handle must be freed with `photowall_shutdown()`

mod albums;
mod callbacks;
mod error;
mod folders;
mod handle;
mod indexer;
mod jobs;
mod photo_ops;
mod photos;
mod settings;
mod tags;
mod thumbnail;
mod trash;

use error::{clear_last_error, get_last_error_ptr, set_global_error, set_last_error};
use handle::PhotowallHandle;
use std::ffi::{c_char, CString};
use std::panic::{catch_unwind, AssertUnwindSafe};

// Re-export all public FFI functions
pub use albums::*;
pub use callbacks::*;
pub use folders::*;
pub use indexer::*;
pub use jobs::*;
pub use photo_ops::*;
pub use photos::*;
pub use settings::*;
pub use tags::*;
pub use thumbnail::*;
pub use trash::*;

/// Initialize the PhotoWall library.
///
/// # Returns
/// - Valid handle pointer on success
/// - `NULL` on error (call `photowall_last_error()` for details)
///
/// # Safety
/// The returned handle must be freed with `photowall_shutdown()`.
#[no_mangle]
pub extern "C" fn photowall_init() -> *mut PhotowallHandle {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        match PhotowallHandle::new() {
            Ok(handle) => {
                tracing::info!("PhotoWall FFI initialized");
                Box::into_raw(Box::new(handle))
            }
            Err(e) => {
                set_global_error(format!("initialization failed: {}", e));
                std::ptr::null_mut()
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_global_error("panic during initialization");
        std::ptr::null_mut()
    })
}

/// Shutdown the PhotoWall library and free resources.
///
/// # Safety
/// - `handle` must be a valid pointer from `photowall_init()`
/// - After calling this function, the handle is invalid
#[no_mangle]
pub unsafe extern "C" fn photowall_shutdown(handle: *mut PhotowallHandle) {
    clear_last_error();

    if handle.is_null() {
        return;
    }

    let result = catch_unwind(AssertUnwindSafe(|| {
        let _ = Box::from_raw(handle);
        tracing::info!("PhotoWall FFI shutdown");
    }));

    if result.is_err() {
        set_last_error("panic during shutdown");
    }
}

/// Get the last error message.
///
/// # Returns
/// - Pointer to error message (valid until next FFI call on this thread)
/// - `NULL` if no error
///
/// # Safety
/// The returned pointer is only valid until the next FFI call on this thread.
#[no_mangle]
pub extern "C" fn photowall_last_error() -> *const c_char {
    get_last_error_ptr()
}

/// Free a string allocated by the library.
///
/// # Safety
/// - `s` must be a pointer returned by a photowall function
/// - After calling this function, the pointer is invalid
#[no_mangle]
pub unsafe extern "C" fn photowall_free_string(s: *mut c_char) {
    if !s.is_null() {
        let _ = CString::from_raw(s);
    }
}

/// Get the library version.
///
/// # Returns
/// - Version string (must be freed with `photowall_free_string()`)
#[no_mangle]
pub extern "C" fn photowall_version() -> *mut c_char {
    CString::new(env!("CARGO_PKG_VERSION"))
        .map(|cs| cs.into_raw())
        .unwrap_or(std::ptr::null_mut())
}
