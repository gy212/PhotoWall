//! 数据库连接管理
//!
//! 提供 SQLite 数据库连接池和初始化功能

use rusqlite::{Connection, OpenFlags};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::paths::PathProvider;
use crate::utils::error::{AppError, AppResult};

use super::schema::{INIT_SCHEMA, FTS_SCHEMA, SCHEMA_VERSION, MIGRATIONS};

/// 数据库连接管理器
#[derive(Clone)]
pub struct Database {
    /// 数据库连接（使用 Arc<Mutex> 实现线程安全）
    conn: Arc<Mutex<Connection>>,
    /// 数据库文件路径
    path: PathBuf,
}

impl Database {
    /// 打开或创建数据库
    pub fn open(path: PathBuf) -> AppResult<Self> {
        // 确保父目录存在
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open_with_flags(
            &path,
            OpenFlags::SQLITE_OPEN_READ_WRITE
                | OpenFlags::SQLITE_OPEN_CREATE
                | OpenFlags::SQLITE_OPEN_FULL_MUTEX,
        )?;

        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
            path,
        };

        // 配置数据库
        db.configure()?;

        Ok(db)
    }

    /// 使用 PathProvider 打开数据库
    pub fn open_with_provider(provider: &dyn PathProvider) -> AppResult<Self> {
        let path = provider.database_path();
        Self::open(path)
    }

    /// 打开内存数据库（用于测试）
    pub fn open_in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;

        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
            path: PathBuf::from(":memory:"),
        };

        db.configure()?;

        Ok(db)
    }

    /// 配置数据库连接
    fn configure(&self) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| {
            AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
        })?;

        // 启用 WAL 模式（提高并发性能）
        conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA foreign_keys = ON;
            PRAGMA cache_size = -64000;
            PRAGMA temp_store = MEMORY;
            PRAGMA mmap_size = 268435456;
            PRAGMA busy_timeout = 5000;
            "#,
        )?;

        Ok(())
    }

    /// 初始化数据库 Schema
    pub fn init(&self) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| {
            AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
        })?;

        // 检查是否已初始化
        let table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='schema_version'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !table_exists {
            tracing::info!("初始化数据库 Schema...");

            // 创建表结构
            conn.execute_batch(INIT_SCHEMA)?;

            // 创建全文搜索表
            conn.execute_batch(FTS_SCHEMA)?;

            // 记录版本
            let now = crate::models::photo::chrono_now_pub();
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (?1, ?2)",
                rusqlite::params![SCHEMA_VERSION, now],
            )?;

            tracing::info!("数据库 Schema 初始化完成，版本: {}", SCHEMA_VERSION);
        } else {
            // 检查并执行迁移
            self.migrate_internal(&conn)?;
        }

        Ok(())
    }

    /// 执行数据库迁移
    fn migrate_internal(&self, conn: &Connection) -> AppResult<()> {
        let current_version: i32 = conn
            .query_row(
                "SELECT MAX(version) FROM schema_version",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        tracing::info!("当前数据库版本: {}", current_version);

        for migration in MIGRATIONS {
            if migration.version > current_version {
                tracing::info!(
                    "执行迁移 v{}: {}",
                    migration.version,
                    migration.description
                );

                conn.execute_batch(migration.sql)?;

                let now = crate::models::photo::chrono_now_pub();
                conn.execute(
                    "INSERT INTO schema_version (version, applied_at) VALUES (?1, ?2)",
                    rusqlite::params![migration.version, now],
                )?;

                tracing::info!("迁移 v{} 完成", migration.version);
            }
        }

        Ok(())
    }

    /// 获取数据库连接（用于执行查询）
    pub fn connection(&self) -> AppResult<std::sync::MutexGuard<'_, Connection>> {
        self.conn.lock().map_err(|e| {
            AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
        })
    }

    /// 执行事务
    pub fn transaction<F, T>(&self, f: F) -> AppResult<T>
    where
        F: FnOnce(&Connection) -> AppResult<T>,
    {
        let mut conn = self.connection()?;
        let tx = conn.transaction()?;
        let result = f(&tx)?;
        tx.commit()?;
        Ok(result)
    }

    /// 获取数据库文件路径
    pub fn path(&self) -> &PathBuf {
        &self.path
    }

    /// 获取数据库统计信息
    pub fn stats(&self) -> AppResult<DatabaseStats> {
        let conn = self.connection()?;

        let photo_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM photos",
            [],
            |row| row.get(0),
        ).unwrap_or(0);

        let tag_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM tags",
            [],
            |row| row.get(0),
        ).unwrap_or(0);

        let album_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM albums",
            [],
            |row| row.get(0),
        ).unwrap_or(0);

        let db_size = std::fs::metadata(&self.path)
            .map(|m| m.len() as i64)
            .unwrap_or(0);

        Ok(DatabaseStats {
            photo_count,
            tag_count,
            album_count,
            db_size,
        })
    }
}

/// 数据库统计信息
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseStats {
    pub photo_count: i64,
    pub tag_count: i64,
    pub album_count: i64,
    pub db_size: i64,
}

/// 获取默认数据库路径（使用 PathProvider）
pub fn default_db_path_with_provider(provider: &dyn PathProvider) -> PathBuf {
    provider.database_path()
}

/// 获取默认数据库路径（legacy，使用 PhotoWall 目录）
pub fn default_db_path() -> PathBuf {
    let base = dirs_next().unwrap_or_else(|| PathBuf::from("."));
    base.join("PhotoWall").join("Database").join("photowall.db")
}

/// 获取应用数据目录
fn dirs_next() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA")
            .ok()
            .map(PathBuf::from)
    }
    #[cfg(target_os = "macos")]
    {
        std::env::var("HOME")
            .ok()
            .map(|h| PathBuf::from(h).join("Library/Application Support"))
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var("XDG_DATA_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var("HOME")
                    .ok()
                    .map(|h| PathBuf::from(h).join(".local/share"))
            })
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_open_in_memory() {
        let db = Database::open_in_memory().expect("Failed to open in-memory database");
        db.init().expect("Failed to initialize database");

        let stats = db.stats().expect("Failed to get stats");
        assert_eq!(stats.photo_count, 0);
        assert_eq!(stats.tag_count, 0);
        assert_eq!(stats.album_count, 0);
    }

    #[test]
    fn test_schema_creation() {
        let db = Database::open_in_memory().expect("Failed to open database");
        db.init().expect("Failed to initialize");

        let conn = db.connection().expect("Failed to get connection");

        // 验证表存在
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(tables.contains(&"photos".to_string()));
        assert!(tables.contains(&"tags".to_string()));
        assert!(tables.contains(&"albums".to_string()));
        assert!(tables.contains(&"photo_tags".to_string()));
        assert!(tables.contains(&"album_photos".to_string()));
    }

    #[test]
    fn test_transaction() {
        let db = Database::open_in_memory().expect("Failed to open database");
        db.init().expect("Failed to initialize");

        let result = db.transaction(|conn| {
            conn.execute(
                "INSERT INTO tags (tag_name, date_created) VALUES ('test', '2024-01-01')",
                [],
            )?;
            Ok(1)
        });

        assert!(result.is_ok());

        let conn = db.connection().expect("Failed to get connection");
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM tags", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }
}
