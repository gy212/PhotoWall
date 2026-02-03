//! Tauri-specific adapters for photowall-core traits
//!
//! This module provides implementations of photowall-core traits
//! that integrate with Tauri's runtime.

use std::path::PathBuf;
use std::sync::Arc;

use tauri::{AppHandle, Emitter, Manager};

use photowall_core::events::EventSink;
use photowall_core::paths::PathProvider;

/// Tauri-specific EventSink implementation.
///
/// Wraps a Tauri AppHandle to emit events to the frontend.
#[derive(Clone)]
pub struct TauriEventSink {
    app_handle: AppHandle,
}

impl TauriEventSink {
    /// Create a new TauriEventSink from an AppHandle.
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    /// Create a shared EventSink from an AppHandle.
    pub fn shared(app_handle: AppHandle) -> Arc<dyn EventSink> {
        Arc::new(Self::new(app_handle))
    }
}

impl EventSink for TauriEventSink {
    fn emit(&self, event_name: &str, payload_json: &str) {
        // Parse the JSON and emit as a raw value to preserve structure
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(payload_json) {
            let _ = self.app_handle.emit(event_name, value);
        } else {
            // Fallback: emit as string if JSON parsing fails
            let _ = self.app_handle.emit(event_name, payload_json);
        }
    }
}

/// Tauri-specific PathProvider implementation.
///
/// Uses Tauri's path resolver to get application directories.
pub struct TauriPathProviderAdapter {
    app_data_dir: PathBuf,
}

impl TauriPathProviderAdapter {
    /// Create a new TauriPathProviderAdapter from an AppHandle.
    pub fn new(app_handle: &AppHandle) -> Self {
        let app_data_dir = app_handle
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        Self { app_data_dir }
    }
}

impl PathProvider for TauriPathProviderAdapter {
    fn app_data_dir(&self) -> PathBuf {
        self.app_data_dir.clone()
    }
}
