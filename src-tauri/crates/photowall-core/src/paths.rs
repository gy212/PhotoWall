//! Path provider abstraction for decoupling from Tauri.
//!
//! This module provides traits and implementations for resolving
//! application data paths without depending on Tauri directly.

use std::path::PathBuf;
use std::sync::Arc;

/// Trait for providing application data paths.
///
/// Implementations can target different frontends (Tauri, Qt, etc.)
/// with different data directory conventions.
pub trait PathProvider: Send + Sync {
    /// Get the root application data directory.
    fn app_data_dir(&self) -> PathBuf;

    /// Get the database directory.
    fn database_dir(&self) -> PathBuf {
        self.app_data_dir().join("Database")
    }

    /// Get the thumbnails directory.
    fn thumbnails_dir(&self) -> PathBuf {
        self.app_data_dir().join("Thumbnails")
    }

    /// Get the settings file path.
    fn settings_path(&self) -> PathBuf {
        self.app_data_dir().join("Config").join("settings.json")
    }

    /// Get the logs directory.
    fn logs_dir(&self) -> PathBuf {
        self.app_data_dir().join("Logs")
    }

    /// Get the database file path.
    fn database_path(&self) -> PathBuf {
        self.database_dir().join("photowall.db")
    }
}

/// Shared reference to a PathProvider implementation.
pub type SharedPathProvider = Arc<dyn PathProvider>;

/// Qt path provider using %APPDATA%/PhotoWallQt/.
///
/// This is the default path provider for the Qt frontend,
/// keeping data separate from the Tauri version.
#[derive(Debug, Clone)]
pub struct QtPathProvider {
    app_data_dir: PathBuf,
}

impl QtPathProvider {
    /// Create a new QtPathProvider.
    ///
    /// Uses %APPDATA%/PhotoWallQt/ on Windows.
    pub fn new() -> Self {
        let app_data_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("PhotoWallQt");
        Self { app_data_dir }
    }

    /// Create a QtPathProvider with a custom base directory.
    ///
    /// Useful for testing.
    pub fn with_base_dir(base_dir: PathBuf) -> Self {
        Self {
            app_data_dir: base_dir,
        }
    }
}

impl Default for QtPathProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl PathProvider for QtPathProvider {
    fn app_data_dir(&self) -> PathBuf {
        self.app_data_dir.clone()
    }
}

/// Legacy Tauri path provider for backward compatibility.
///
/// Wraps an existing app data directory path, typically obtained
/// from Tauri's `app.path().app_data_dir()`.
#[derive(Debug, Clone)]
pub struct TauriPathProvider {
    app_data_dir: PathBuf,
}

impl TauriPathProvider {
    /// Create a new TauriPathProvider with the given app data directory.
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self { app_data_dir }
    }
}

impl PathProvider for TauriPathProvider {
    fn app_data_dir(&self) -> PathBuf {
        self.app_data_dir.clone()
    }
}
