//! PhotoWall 命令模块
//!
//! 包含所有 Tauri 命令的定义

pub mod greet;
pub mod scanner;
pub mod search;
pub mod tags;
pub mod albums;
pub mod thumbnail;
pub mod file_ops;
pub mod settings;
pub mod folder_sync;
pub mod folders;
pub mod logging;
pub mod window_effects;

pub use greet::*;
pub use scanner::*;
pub use search::*;
pub use tags::*;
pub use albums::*;
pub use thumbnail::*;
pub use file_ops::*;
pub use settings::*;
pub use folder_sync::*;
pub use folders::*;
pub use logging::*;
pub use window_effects::*;
