//! Job cancellation API.

use crate::error::{clear_last_error, set_last_error};
use crate::handle::PhotowallHandle;
use std::panic::{catch_unwind, AssertUnwindSafe};

/// Cancel a running job.
///
/// # Returns
/// - `1` if job was cancelled
/// - `0` if job not found
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_cancel_job(handle: *mut PhotowallHandle, job_id: u64) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() {
            set_last_error("handle is null");
            return -1;
        }

        let handle = &*handle;

        if handle.core.jobs().cancel_job(job_id) {
            1 // Cancelled
        } else {
            0 // Not found
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_cancel_job");
        -1
    })
}

/// Get the number of active jobs.
///
/// # Returns
/// - Number of active jobs (>= 0)
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_get_active_job_count(handle: *mut PhotowallHandle) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() {
            set_last_error("handle is null");
            return -1;
        }

        let handle = &*handle;
        handle.core.jobs().active_job_count() as i32
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_get_active_job_count");
        -1
    })
}

/// Check if a job is active.
///
/// # Returns
/// - `1` if job is active
/// - `0` if job is not active
/// - `-1` on error
#[no_mangle]
pub unsafe extern "C" fn photowall_is_job_active(handle: *mut PhotowallHandle, job_id: u64) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() {
            set_last_error("handle is null");
            return -1;
        }

        let handle = &*handle;

        if handle.core.jobs().is_job_active(job_id) {
            1
        } else {
            0
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_is_job_active");
        -1
    })
}
