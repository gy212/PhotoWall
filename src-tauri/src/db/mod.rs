//! PhotoWall 数据库模块
//!
//! 包含数据库连接管理和数据访问层

pub mod schema;
pub mod connection;
pub mod photo_dao;
pub mod tag_dao;
pub mod album_dao;
pub mod scan_dir_dao;
pub mod smart_album_dao;

// 重新导出常用类型
pub use connection::{Database, DatabaseStats, default_db_path};
pub use scan_dir_dao::ScanDirectoryState;
pub use smart_album_dao::{SmartAlbum, CreateSmartAlbum, UpdateSmartAlbum};
