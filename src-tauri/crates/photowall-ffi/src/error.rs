//! Thread-local error handling for FFI.
//!
//! Uses the "last error" pattern common in C APIs.

use parking_lot::RwLock;
use std::cell::RefCell;
use std::ffi::CString;
use std::os::raw::c_char;

thread_local! {
    static LAST_ERROR: RefCell<Option<CString>> = const { RefCell::new(None) };
}

/// Set the last error message for the current thread.
pub fn set_last_error(msg: impl Into<String>) {
    let msg = msg.into();
    tracing::error!("FFI error: {}", msg);
    LAST_ERROR.with(|e| {
        *e.borrow_mut() = CString::new(msg).ok();
    });
}

/// Clear the last error for the current thread.
pub fn clear_last_error() {
    LAST_ERROR.with(|e| {
        *e.borrow_mut() = None;
    });
}

/// Get a pointer to the last error message.
/// Returns null if no error is set.
/// The pointer is valid until the next FFI call on this thread.
pub fn get_last_error_ptr() -> *const c_char {
    LAST_ERROR.with(|e| {
        e.borrow()
            .as_ref()
            .map(|s| s.as_ptr())
            .unwrap_or(std::ptr::null())
    })
}

/// Global error for cross-thread scenarios (e.g., init failures).
static GLOBAL_ERROR: RwLock<Option<CString>> = RwLock::new(None);

pub fn set_global_error(msg: impl Into<String>) {
    let msg = msg.into();
    tracing::error!("FFI global error: {}", msg);
    *GLOBAL_ERROR.write() = CString::new(msg).ok();
}
