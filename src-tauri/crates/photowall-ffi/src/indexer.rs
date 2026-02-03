//! Index API - async directory indexing.

use crate::error::{clear_last_error, set_last_error};
use crate::handle::PhotowallHandle;
use photowall_core::events::EventSinkExt;
use photowall_core::services::{IndexOptions, IndexProgress, PhotoIndexer, ScanOptions};
use serde::Serialize;
use std::ffi::{c_char, CStr};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::PathBuf;
use std::thread;

/// Index finished event payload.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct IndexFinishedPayload {
    job_id: u64,
    indexed: usize,
    skipped: usize,
    failed: usize,
    failed_files: Vec<String>,
}

/// Index cancelled event payload.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct IndexCancelledPayload {
    job_id: u64,
}

/// Start indexing a directory asynchronously.
///
/// # Parameters
/// - `handle`: Valid handle from `photowall_init`
/// - `path_utf8`: UTF-8 encoded directory path
///
/// # Returns
/// - Job ID (> 0) on success
/// - `0` on error (call `photowall_last_error` for details)
///
/// # Events emitted
/// - `index-progress`: Progress updates during indexing
/// - `index-finished`: When indexing completes
/// - `index-cancelled`: If job is cancelled
#[no_mangle]
pub unsafe extern "C" fn photowall_index_directory_async(
    handle: *mut PhotowallHandle,
    path_utf8: *const c_char,
) -> u64 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() || path_utf8.is_null() {
            set_last_error("handle or path is null");
            return 0;
        }

        let handle = &*handle;

        // Parse path
        let path_str = match CStr::from_ptr(path_utf8).to_str() {
            Ok(s) => s,
            Err(_) => {
                set_last_error("invalid UTF-8 in path");
                return 0;
            }
        };
        let path = PathBuf::from(path_str);

        if !path.exists() {
            set_last_error(format!("path does not exist: {}", path_str));
            return 0;
        }

        // Start a job for cancellation support
        let cancel_token = handle.core.jobs().start_job();
        let job_id = cancel_token.job_id();

        // Clone what we need for the background thread
        let db = handle.core.database().clone();
        let event_sink = handle.event_sink.clone();
        let job_manager = handle.core.jobs().clone();

        // Spawn background thread
        thread::spawn(move || {
            let options = IndexOptions {
                scan_options: ScanOptions::default(),
                skip_existing: true,
                detect_duplicates: true,
                batch_size: 50,
            };

            let indexer = PhotoIndexer::with_cancel_flag(db, options, cancel_token.flag());

            // Progress callback
            let sink_for_progress = event_sink.clone();
            let progress_callback = move |progress: &IndexProgress| {
                sink_for_progress.emit_typed("index-progress", progress);
            };

            // Run indexing
            let result = indexer.index_directory_with_progress(&path, progress_callback);

            // Complete the job
            job_manager.complete_job(job_id);

            // Emit result event
            match result {
                Ok(index_result) => {
                    if cancel_token.is_cancelled() {
                        event_sink.emit_typed(
                            "index-cancelled",
                            &IndexCancelledPayload { job_id },
                        );
                    } else {
                        event_sink.emit_typed(
                            "index-finished",
                            &IndexFinishedPayload {
                                job_id,
                                indexed: index_result.indexed,
                                skipped: index_result.skipped,
                                failed: index_result.failed,
                                failed_files: index_result.failed_files,
                            },
                        );
                    }
                }
                Err(e) => {
                    tracing::error!("Indexing failed: {}", e);
                    event_sink.emit_typed(
                        "index-cancelled",
                        &IndexCancelledPayload { job_id },
                    );
                }
            }
        });

        job_id
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_index_directory_async");
        0
    })
}
