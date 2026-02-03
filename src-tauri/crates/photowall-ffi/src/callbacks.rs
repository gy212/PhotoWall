//! Event callback registration API.

use crate::error::{clear_last_error, set_last_error};
use crate::handle::{EventCallback, PhotowallHandle};
use std::ffi::c_void;
use std::panic::{catch_unwind, AssertUnwindSafe};

/// Register an event callback.
///
/// # Safety
/// - `handle` must be a valid pointer from `photowall_init`.
/// - `callback` must be a valid function pointer.
/// - `user_data` must remain valid for the lifetime of the callback registration.
///
/// # Returns
/// - `0` on success
/// - `-1` on error (call `photowall_last_error` for details)
#[no_mangle]
pub unsafe extern "C" fn photowall_set_event_callback(
    handle: *mut PhotowallHandle,
    callback: EventCallback,
    user_data: *mut c_void,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() {
            set_last_error("handle is null");
            return -1;
        }

        let handle = &*handle;
        handle.event_sink.set_callback(callback, user_data);
        tracing::debug!("Event callback registered");
        0
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_set_event_callback");
        -1
    })
}

/// Clear the event callback.
///
/// # Safety
/// - `handle` must be a valid pointer from `photowall_init`.
///
/// # Returns
/// - `0` on success
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_clear_event_callback(handle: *mut PhotowallHandle) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() {
            set_last_error("handle is null");
            return -1;
        }

        let handle = &*handle;
        handle.event_sink.clear_callback();
        tracing::debug!("Event callback cleared");
        0
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_clear_event_callback");
        -1
    })
}
