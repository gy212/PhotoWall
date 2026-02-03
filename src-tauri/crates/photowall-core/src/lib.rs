//! PhotoWall Core Library
//!
//! This crate provides the core business logic for PhotoWall, a Windows desktop
//! photo manager. It is designed to be frontend-agnostic, supporting both
//! Tauri and Qt frontends.
//!
//! # Features
//!
//! - `tokio-runtime`: Enable tokio async runtime for auto-scan functionality
//!
//! # Architecture
//!
//! The crate is organized into the following modules:
//!
//! - `models`: Data structures (Photo, Tag, Album, Settings)
//! - `db`: SQLite database layer with DAOs
//! - `services`: Business logic services (scanner, indexer, thumbnail, etc.)
//! - `events`: Event emission abstraction (EventSink trait)
//! - `paths`: Path provider abstraction (PathProvider trait)
//! - `jobs`: Job management and cancellation system
//! - `utils`: Error handling and utilities
//!
//! # Example
//!
//! ```no_run
//! use photowall_core::{
//!     db::Database,
//!     paths::{PathProvider, QtPathProvider},
//!     services::ThumbnailService,
//! };
//! use std::sync::Arc;
//!
//! // Create path provider for Qt frontend
//! let path_provider = QtPathProvider::new();
//!
//! // Open database
//! let db = Database::open_with_provider(&path_provider).unwrap();
//! db.init().unwrap();
//!
//! // Create thumbnail service
//! let thumbnail_service = ThumbnailService::new(
//!     path_provider.thumbnails_dir()
//! ).unwrap();
//! ```

pub mod db;
pub mod events;
pub mod jobs;
pub mod models;
pub mod paths;
pub mod services;
pub mod utils;

// Re-export commonly used types
pub use db::{Database, DatabaseStats};
pub use events::{EventSink, SharedEventSink, NoOpEventSink, LoggingEventSink};
pub use jobs::{JobId, JobManager, CancelToken};
pub use models::{Photo, Tag, Album, AppSettings};
pub use paths::{PathProvider, SharedPathProvider, QtPathProvider, TauriPathProvider};
pub use services::{
    Scanner, ScanOptions, ScanResult,
    PhotoIndexer, IndexOptions, IndexResult,
    ThumbnailService, ThumbnailSize, ThumbnailQueue, ThumbnailTask,
    SettingsManager,
};
pub use utils::{AppError, AppResult, CommandError};

use std::sync::Arc;

/// PhotoWall core application context.
///
/// This struct holds all the shared resources needed by the application.
/// It can be used by both Tauri and Qt frontends.
pub struct PhotowallCore {
    /// Database connection
    pub db: Arc<Database>,
    /// Path provider for resolving application paths
    pub path_provider: Arc<dyn PathProvider>,
    /// Event sink for emitting events to the frontend
    pub event_sink: SharedEventSink,
    /// Job manager for tracking long-running tasks
    pub job_manager: Arc<JobManager>,
    /// Thumbnail service
    pub thumbnail_service: ThumbnailService,
}

impl PhotowallCore {
    /// Create a new PhotowallCore instance.
    ///
    /// # Arguments
    ///
    /// * `path_provider` - The path provider to use for resolving paths
    /// * `event_sink` - The event sink for emitting events
    ///
    /// # Example
    ///
    /// ```no_run
    /// use photowall_core::{PhotowallCore, paths::QtPathProvider, events::NoOpEventSink};
    /// use std::sync::Arc;
    ///
    /// let path_provider = Arc::new(QtPathProvider::new());
    /// let event_sink = Arc::new(NoOpEventSink);
    ///
    /// let core = PhotowallCore::new(path_provider, event_sink).unwrap();
    /// ```
    pub fn new(
        path_provider: Arc<dyn PathProvider>,
        event_sink: SharedEventSink,
    ) -> AppResult<Self> {
        // Open database
        let db = Database::open_with_provider(path_provider.as_ref())?;
        db.init()?;
        let db = Arc::new(db);

        // Create thumbnail service
        let thumbnail_service = ThumbnailService::new(path_provider.thumbnails_dir())?;

        // Set up event sink for thumbnail queue
        services::set_event_sink(event_sink.clone());

        Ok(Self {
            db,
            path_provider,
            event_sink,
            job_manager: Arc::new(JobManager::new()),
            thumbnail_service,
        })
    }

    /// Get the database reference.
    pub fn database(&self) -> &Arc<Database> {
        &self.db
    }

    /// Get the path provider reference.
    pub fn paths(&self) -> &Arc<dyn PathProvider> {
        &self.path_provider
    }

    /// Get the event sink reference.
    pub fn events(&self) -> &SharedEventSink {
        &self.event_sink
    }

    /// Get the job manager reference.
    pub fn jobs(&self) -> &Arc<JobManager> {
        &self.job_manager
    }

    /// Get the thumbnail service reference.
    pub fn thumbnails(&self) -> &ThumbnailService {
        &self.thumbnail_service
    }
}

impl Drop for PhotowallCore {
    fn drop(&mut self) {
        // Clean up event sink
        services::clear_event_sink();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_photowall_core_creation() {
        let tmp = TempDir::new().unwrap();
        let path_provider = Arc::new(QtPathProvider::with_base_dir(tmp.path().to_path_buf()));
        let event_sink: SharedEventSink = Arc::new(NoOpEventSink);

        let core = PhotowallCore::new(path_provider, event_sink).unwrap();

        // Verify database is initialized
        let stats = core.db.stats().unwrap();
        assert_eq!(stats.photo_count, 0);
    }
}
