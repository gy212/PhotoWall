//! PhotowallHandle - opaque handle wrapping PhotowallCore.

use parking_lot::RwLock;
use photowall_core::{
    events::{EventSink, SharedEventSink},
    paths::QtPathProvider,
    services::ThumbnailQueue,
    PhotowallCore,
};
use std::ffi::c_void;
use std::os::raw::c_char;
use std::sync::Arc;

/// Callback function type for events.
/// - `name`: event name (null-terminated UTF-8)
/// - `payload`: JSON payload (null-terminated UTF-8)
/// - `user_data`: user-provided context pointer
pub type EventCallback = extern "C" fn(name: *const c_char, payload: *const c_char, user_data: *mut c_void);

/// Stored callback with user data.
pub struct StoredCallback {
    pub callback: EventCallback,
    pub user_data: *mut c_void,
}

// SAFETY: user_data is managed by the caller and must be thread-safe
unsafe impl Send for StoredCallback {}
unsafe impl Sync for StoredCallback {}

/// FFI event sink that forwards events to a C callback.
pub struct FfiEventSink {
    callback: RwLock<Option<StoredCallback>>,
}

impl FfiEventSink {
    pub fn new() -> Self {
        Self {
            callback: RwLock::new(None),
        }
    }

    pub fn set_callback(&self, callback: EventCallback, user_data: *mut c_void) {
        *self.callback.write() = Some(StoredCallback { callback, user_data });
    }

    pub fn clear_callback(&self) {
        *self.callback.write() = None;
    }

    pub fn has_callback(&self) -> bool {
        self.callback.read().is_some()
    }
}

impl Default for FfiEventSink {
    fn default() -> Self {
        Self::new()
    }
}

impl EventSink for FfiEventSink {
    fn emit(&self, event_name: &str, payload_json: &str) {
        let guard = self.callback.read();
        if let Some(ref stored) = *guard {
            // Create null-terminated strings
            if let (Ok(name_cstr), Ok(payload_cstr)) = (
                std::ffi::CString::new(event_name),
                std::ffi::CString::new(payload_json),
            ) {
                (stored.callback)(name_cstr.as_ptr(), payload_cstr.as_ptr(), stored.user_data);
            }
        }
    }
}

/// Opaque handle exposed to C.
/// Contains all state needed for FFI operations.
pub struct PhotowallHandle {
    pub core: PhotowallCore,
    pub thumbnail_queue: ThumbnailQueue,
    pub event_sink: Arc<FfiEventSink>,
}

impl PhotowallHandle {
    pub fn new() -> Result<Self, photowall_core::utils::AppError> {
        let path_provider = Arc::new(QtPathProvider::new());
        let event_sink = Arc::new(FfiEventSink::new());
        let shared_sink: SharedEventSink = event_sink.clone();

        let core = PhotowallCore::new(path_provider.clone(), shared_sink)?;

        // Set global event sink for thumbnail workers
        photowall_core::services::thumbnail_queue::set_event_sink(event_sink.clone());

        let thumbnail_queue = ThumbnailQueue::new(core.thumbnails().clone())?;

        Ok(Self {
            core,
            thumbnail_queue,
            event_sink,
        })
    }
}

impl Drop for PhotowallHandle {
    fn drop(&mut self) {
        // Stop thumbnail queue workers
        self.thumbnail_queue.stop();
        // Clear global event sink
        photowall_core::services::thumbnail_queue::clear_event_sink();
        tracing::info!("PhotowallHandle dropped");
    }
}
