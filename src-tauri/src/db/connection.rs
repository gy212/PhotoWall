//! 数据库连接管理
//!
//! 提供 SQLite 数据库连接池和初始化功能

use rusqlite::{Connection, OpenFlags};
use std::path::PathBuf;
use std::collections::HashSet;
use std::sync::{Arc, Mutex};

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

        // 修复历史版本可能缺失的字段（例如 scan_directories 扩展列）
        self.ensure_scan_directories_schema(&conn)?;
        self.ensure_ocr_schema(&conn)?;

        Ok(())
    }

    /// 确保 scan_directories 表包含所有需要的列（兼容旧数据库）
    fn ensure_scan_directories_schema(&self, conn: &Connection) -> AppResult<()> {
        let table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='scan_directories'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !table_exists {
            return Ok(());
        }

        let mut stmt = conn.prepare("PRAGMA table_info(scan_directories)")?;
        let columns_iter = stmt.query_map([], |row| row.get::<_, String>(1))?;
        let mut columns = HashSet::new();
        for col in columns_iter {
            if let Ok(name) = col {
                columns.insert(name);
            }
        }

        let mut statements: Vec<&'static str> = Vec::new();
        if !columns.contains("last_change_time") {
            statements.push("ALTER TABLE scan_directories ADD COLUMN last_change_time TEXT");
        }
        if !columns.contains("no_change_count") {
            statements.push("ALTER TABLE scan_directories ADD COLUMN no_change_count INTEGER DEFAULT 0");
        }
        if !columns.contains("scan_multiplier") {
            statements.push("ALTER TABLE scan_directories ADD COLUMN scan_multiplier INTEGER DEFAULT 1");
        }
        if !columns.contains("next_scan_time") {
            statements.push("ALTER TABLE scan_directories ADD COLUMN next_scan_time TEXT");
        }
        if !columns.contains("file_count") {
            statements.push("ALTER TABLE scan_directories ADD COLUMN file_count INTEGER DEFAULT 0");
        }

        for sql in statements {
            conn.execute(sql, [])?;
        }

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_scan_directories_next_scan ON scan_directories(next_scan_time)",
            [],
        )?;

        Ok(())
    }

    /// 确保 photos 表包含 OCR 相关字段，并同步 FTS 索引
    fn ensure_ocr_schema(&self, conn: &Connection) -> AppResult<()> {
        let table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='photos'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !table_exists {
            return Ok(());
        }

        let mut stmt = conn.prepare("PRAGMA table_info(photos)")?;
        let columns_iter = stmt.query_map([], |row| row.get::<_, String>(1))?;
        let mut columns = HashSet::new();
        for col in columns_iter {
            if let Ok(name) = col {
                columns.insert(name);
            }
        }

        let mut statements: Vec<&'static str> = Vec::new();
        if !columns.contains("ocr_text") {
            statements.push("ALTER TABLE photos ADD COLUMN ocr_text TEXT");
        }
        if !columns.contains("ocr_status") {
            statements.push("ALTER TABLE photos ADD COLUMN ocr_status INTEGER DEFAULT 0");
        }
        if !columns.contains("ocr_processed_at") {
            statements.push("ALTER TABLE photos ADD COLUMN ocr_processed_at TEXT");
        }

        for sql in statements {
            conn.execute(sql, [])?;
        }

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_photos_ocr_status ON photos(ocr_status)",
            [],
        )?;

        let fts_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='photos_fts'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        let needs_fts_rebuild = if !fts_exists {
            true
        } else {
            let mut stmt = conn.prepare("PRAGMA table_info(photos_fts)")?;
            let columns_iter = stmt.query_map([], |row| row.get::<_, String>(1))?;
            let mut fts_columns = HashSet::new();
            for col in columns_iter {
                if let Ok(name) = col {
                    fts_columns.insert(name);
                }
            }
            !fts_columns.contains("ocr_text")
        };

        if needs_fts_rebuild {
            conn.execute_batch(
                r#"
                -- 删除旧的触发器
                DROP TRIGGER IF EXISTS photos_fts_insert;
                DROP TRIGGER IF EXISTS photos_fts_delete;
                DROP TRIGGER IF EXISTS photos_fts_update;

                -- 删除旧的 FTS 表
                DROP TABLE IF EXISTS photos_fts;

                -- 创建包含 OCR 文字的 FTS5 表
                CREATE VIRTUAL TABLE photos_fts USING fts5(
                    file_name,
                    file_path,
                    camera_model,
                    lens_model,
                    format,
                    shutter_speed,
                    ocr_text,
                    content='photos',
                    content_rowid='photo_id',
                    tokenize='unicode61 remove_diacritics 2'
                );

                -- 重建索引数据
                INSERT INTO photos_fts(rowid, file_name, file_path, camera_model, lens_model, format, shutter_speed, ocr_text)
                SELECT photo_id, file_name, file_path, camera_model, lens_model, format, shutter_speed, ocr_text FROM photos;

                -- 创建新的触发器：插入时同步 FTS
                CREATE TRIGGER photos_fts_insert AFTER INSERT ON photos BEGIN
                    INSERT INTO photos_fts(rowid, file_name, file_path, camera_model, lens_model, format, shutter_speed, ocr_text)
                    VALUES (NEW.photo_id, NEW.file_name, NEW.file_path, NEW.camera_model, NEW.lens_model, NEW.format, NEW.shutter_speed, NEW.ocr_text);
                END;

                -- 触发器：删除时同步 FTS
                CREATE TRIGGER photos_fts_delete AFTER DELETE ON photos BEGIN
                    INSERT INTO photos_fts(photos_fts, rowid, file_name, file_path, camera_model, lens_model, format, shutter_speed, ocr_text)
                    VALUES ('delete', OLD.photo_id, OLD.file_name, OLD.file_path, OLD.camera_model, OLD.lens_model, OLD.format, OLD.shutter_speed, OLD.ocr_text);
                END;

                -- 触发器：更新时同步 FTS
                CREATE TRIGGER photos_fts_update AFTER UPDATE ON photos BEGIN
                    INSERT INTO photos_fts(photos_fts, rowid, file_name, file_path, camera_model, lens_model, format, shutter_speed, ocr_text)
                    VALUES ('delete', OLD.photo_id, OLD.file_name, OLD.file_path, OLD.camera_model, OLD.lens_model, OLD.format, OLD.shutter_speed, OLD.ocr_text);
                    INSERT INTO photos_fts(rowid, file_name, file_path, camera_model, lens_model, format, shutter_speed, ocr_text)
                    VALUES (NEW.photo_id, NEW.file_name, NEW.file_path, NEW.camera_model, NEW.lens_model, NEW.format, NEW.shutter_speed, NEW.ocr_text);
                END;
                "#,
            )?;
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

/// 获取默认数据库路径
pub fn default_db_path() -> PathBuf {
    // Windows: %APPDATA%/PhotoWall/photowall.db
    // macOS: ~/Library/Application Support/PhotoWall/photowall.db
    // Linux: ~/.local/share/PhotoWall/photowall.db
    let base = dirs_next().unwrap_or_else(|| PathBuf::from("."));
    base.join("PhotoWall").join("photowall.db")
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
