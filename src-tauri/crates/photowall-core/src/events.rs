//! Event emission abstraction for decoupling from Tauri.
//!
//! This module provides traits and implementations for emitting events
//! to the frontend without depending on Tauri directly.

use std::sync::Arc;

/// Trait for emitting events to the frontend.
///
/// Implementations can target different frontends (Tauri, Qt, etc.)
/// or be used for testing purposes.
pub trait EventSink: Send + Sync {
    /// Emit an event with the given name and JSON payload.
    ///
    /// # Arguments
    /// * `event_name` - The name of the event (e.g., "thumbnail-ready")
    /// * `payload_json` - JSON-serialized payload string
    fn emit(&self, event_name: &str, payload_json: &str);
}

/// Extension trait for EventSink that provides typed emit functionality.
pub trait EventSinkExt {
    /// Emit an event with a typed payload that will be serialized to JSON.
    fn emit_typed<T: serde::Serialize>(&self, event_name: &str, payload: &T);
}

impl<S: EventSink + ?Sized> EventSinkExt for S {
    fn emit_typed<T: serde::Serialize>(&self, event_name: &str, payload: &T) {
        match serde_json::to_string(payload) {
            Ok(json) => self.emit(event_name, &json),
            Err(e) => {
                tracing::error!("Failed to serialize event payload: {}", e);
            }
        }
    }
}

/// Shared reference to an EventSink implementation.
pub type SharedEventSink = Arc<dyn EventSink>;

/// No-op event sink for testing or when events are not needed.
#[derive(Debug, Clone, Default)]
pub struct NoOpEventSink;

impl EventSink for NoOpEventSink {
    fn emit(&self, _event_name: &str, _payload_json: &str) {
        // Do nothing
    }
}

/// Logging event sink for debugging purposes.
#[derive(Debug, Clone, Default)]
pub struct LoggingEventSink;

impl EventSink for LoggingEventSink {
    fn emit(&self, event_name: &str, payload_json: &str) {
        tracing::debug!(event = event_name, payload = payload_json, "Event emitted");
    }
}
