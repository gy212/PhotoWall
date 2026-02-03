//! 数据库 Schema 定义
//!
//! 包含所有表的 CREATE 语句和迁移脚本

/// 数据库版本
pub const SCHEMA_VERSION: i32 = 7;

/// 初始化 Schema SQL
pub const INIT_SCHEMA: &str = r#"
-- 照片表
CREATE TABLE IF NOT EXISTS photos (
    photo_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path       TEXT NOT NULL UNIQUE,
    file_name       TEXT NOT NULL,
    file_size       INTEGER NOT NULL,
    file_hash       TEXT NOT NULL,
    width           INTEGER,
    height          INTEGER,
    format          TEXT,
    date_taken      TEXT,
    date_added      TEXT NOT NULL,
    date_modified   TEXT,
    camera_model    TEXT,
    lens_model      TEXT,
    focal_length    REAL,
    aperture        REAL,
    iso             INTEGER,
    shutter_speed   TEXT,
    gps_latitude    REAL,
    gps_longitude   REAL,
    orientation     INTEGER DEFAULT 1,
    rating          INTEGER DEFAULT 0 CHECK(rating >= 0 AND rating <= 5),
    is_favorite     INTEGER DEFAULT 0,
    is_deleted      INTEGER DEFAULT 0,
    ocr_text        TEXT,
    ocr_status      INTEGER DEFAULT 0,
    ocr_processed_at TEXT,
    deleted_at      TEXT
);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
    tag_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_name        TEXT NOT NULL UNIQUE,
    color           TEXT,
    date_created    TEXT NOT NULL
);

-- 相册表
CREATE TABLE IF NOT EXISTS albums (
    album_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    album_name      TEXT NOT NULL UNIQUE,
    description     TEXT,
    cover_photo_id  INTEGER REFERENCES photos(photo_id) ON DELETE SET NULL,
    date_created    TEXT NOT NULL,
    sort_order      INTEGER DEFAULT 0
);

-- 智能相册表
CREATE TABLE IF NOT EXISTS smart_albums (
    smart_album_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    description     TEXT,
    filters         TEXT NOT NULL,
    icon            TEXT,
    color           TEXT,
    date_created    TEXT NOT NULL DEFAULT (datetime('now')),
    date_modified   TEXT NOT NULL DEFAULT (datetime('now')),
    sort_order      INTEGER NOT NULL DEFAULT 0
);

-- 照片-标签关联表
CREATE TABLE IF NOT EXISTS photo_tags (
    photo_id        INTEGER NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    tag_id          INTEGER NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
    date_created    TEXT NOT NULL,
    PRIMARY KEY (photo_id, tag_id)
);

-- 相册-照片关联表
CREATE TABLE IF NOT EXISTS album_photos (
    album_id        INTEGER NOT NULL REFERENCES albums(album_id) ON DELETE CASCADE,
    photo_id        INTEGER NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    sort_order      INTEGER DEFAULT 0,
    date_added      TEXT NOT NULL,
    PRIMARY KEY (album_id, photo_id)
);

-- 扫描目录表（记录已扫描的目录）
CREATE TABLE IF NOT EXISTS scan_directories (
    dir_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    dir_path        TEXT NOT NULL UNIQUE,
    last_scan       TEXT,
    is_active       INTEGER DEFAULT 1,
    last_change_time TEXT,
    no_change_count  INTEGER DEFAULT 0,
    scan_multiplier  INTEGER DEFAULT 1,
    next_scan_time   TEXT,
    file_count       INTEGER DEFAULT 0
);

-- 数据库版本表
CREATE TABLE IF NOT EXISTS schema_version (
    version         INTEGER PRIMARY KEY,
    applied_at      TEXT NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_photos_file_hash ON photos(file_hash);
CREATE INDEX IF NOT EXISTS idx_photos_date_taken ON photos(date_taken);
CREATE INDEX IF NOT EXISTS idx_photos_date_added ON photos(date_added);
CREATE INDEX IF NOT EXISTS idx_photos_rating ON photos(rating);
CREATE INDEX IF NOT EXISTS idx_photos_is_favorite ON photos(is_favorite);
CREATE INDEX IF NOT EXISTS idx_photos_camera_model ON photos(camera_model);
CREATE INDEX IF NOT EXISTS idx_photos_is_deleted ON photos(is_deleted);
CREATE INDEX IF NOT EXISTS idx_photos_ocr_status ON photos(ocr_status);

CREATE INDEX IF NOT EXISTS idx_tags_tag_name ON tags(tag_name);

CREATE INDEX IF NOT EXISTS idx_albums_album_name ON albums(album_name);

CREATE INDEX IF NOT EXISTS idx_smart_albums_sort_order ON smart_albums(sort_order);

CREATE INDEX IF NOT EXISTS idx_photo_tags_photo_id ON photo_tags(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_tags_tag_id ON photo_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_album_photos_album_id ON album_photos(album_id);
CREATE INDEX IF NOT EXISTS idx_album_photos_photo_id ON album_photos(photo_id);
CREATE INDEX IF NOT EXISTS idx_scan_directories_next_scan ON scan_directories(next_scan_time);
"#;

/// 全文搜索表 Schema (FTS5)
pub const FTS_SCHEMA: &str = r#"
-- 全文搜索虚拟表
CREATE VIRTUAL TABLE IF NOT EXISTS photos_fts USING fts5(
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

-- 触发器：插入时同步 FTS
CREATE TRIGGER IF NOT EXISTS photos_fts_insert AFTER INSERT ON photos BEGIN
    INSERT INTO photos_fts(rowid, file_name, file_path, camera_model, lens_model, format, shutter_speed, ocr_text)
    VALUES (NEW.photo_id, NEW.file_name, NEW.file_path, NEW.camera_model, NEW.lens_model, NEW.format, NEW.shutter_speed, NEW.ocr_text);
END;

-- 触发器：删除时同步 FTS
CREATE TRIGGER IF NOT EXISTS photos_fts_delete AFTER DELETE ON photos BEGIN
    INSERT INTO photos_fts(photos_fts, rowid, file_name, file_path, camera_model, lens_model, format, shutter_speed, ocr_text)
    VALUES ('delete', OLD.photo_id, OLD.file_name, OLD.file_path, OLD.camera_model, OLD.lens_model, OLD.format, OLD.shutter_speed, OLD.ocr_text);
END;

-- 触发器：更新时同步 FTS
CREATE TRIGGER IF NOT EXISTS photos_fts_update AFTER UPDATE ON photos BEGIN
    INSERT INTO photos_fts(photos_fts, rowid, file_name, file_path, camera_model, lens_model, format, shutter_speed, ocr_text)
    VALUES ('delete', OLD.photo_id, OLD.file_name, OLD.file_path, OLD.camera_model, OLD.lens_model, OLD.format, OLD.shutter_speed, OLD.ocr_text);
    INSERT INTO photos_fts(rowid, file_name, file_path, camera_model, lens_model, format, shutter_speed, ocr_text)
    VALUES (NEW.photo_id, NEW.file_name, NEW.file_path, NEW.camera_model, NEW.lens_model, NEW.format, NEW.shutter_speed, NEW.ocr_text);
END;
"#;

/// 迁移脚本
pub struct Migration {
    pub version: i32,
    pub description: &'static str,
    pub sql: &'static str,
}

/// 所有迁移脚本列表
pub const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 2,
        description: "Add soft delete columns for trash feature",
        sql: r#"
            ALTER TABLE photos ADD COLUMN is_deleted INTEGER DEFAULT 0;
            ALTER TABLE photos ADD COLUMN deleted_at TEXT;
            CREATE INDEX IF NOT EXISTS idx_photos_is_deleted ON photos(is_deleted);
        "#,
    },
    Migration {
        version: 3,
        description: "Add file_path index and composite photo_tags index for better query performance",
        sql: r#"
            CREATE INDEX IF NOT EXISTS idx_photos_file_path ON photos(file_path);
            CREATE INDEX IF NOT EXISTS idx_photo_tags_composite ON photo_tags(photo_id, tag_id);
        "#,
    },
    Migration {
        version: 4,
        description: "Extend scan_directories table for stepped scan frequency",
        sql: r#"
            ALTER TABLE scan_directories ADD COLUMN last_change_time TEXT;
            ALTER TABLE scan_directories ADD COLUMN no_change_count INTEGER DEFAULT 0;
            ALTER TABLE scan_directories ADD COLUMN scan_multiplier INTEGER DEFAULT 1;
            ALTER TABLE scan_directories ADD COLUMN next_scan_time TEXT;
            ALTER TABLE scan_directories ADD COLUMN file_count INTEGER DEFAULT 0;
            CREATE INDEX IF NOT EXISTS idx_scan_directories_next_scan ON scan_directories(next_scan_time);
        "#,
    },
    Migration {
        version: 5,
        description: "Add smart albums table for saved search filters",
        sql: r#"
            CREATE TABLE IF NOT EXISTS smart_albums (
                smart_album_id  INTEGER PRIMARY KEY AUTOINCREMENT,
                name            TEXT NOT NULL UNIQUE,
                description     TEXT,
                filters         TEXT NOT NULL,
                icon            TEXT,
                color           TEXT,
                date_created    TEXT NOT NULL DEFAULT (datetime('now')),
                date_modified   TEXT NOT NULL DEFAULT (datetime('now')),
                sort_order      INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_smart_albums_sort_order ON smart_albums(sort_order);
        "#,
    },
    Migration {
        version: 6,
        description: "Extend FTS5 index with more searchable fields (format, shutter_speed)",
        sql: r#"
            -- 删除旧的触发器
            DROP TRIGGER IF EXISTS photos_fts_insert;
            DROP TRIGGER IF EXISTS photos_fts_delete;
            DROP TRIGGER IF EXISTS photos_fts_update;

            -- 删除旧的 FTS 表
            DROP TABLE IF EXISTS photos_fts;

            -- 创建扩展的 FTS5 表
            CREATE VIRTUAL TABLE photos_fts USING fts5(
                file_name,
                file_path,
                camera_model,
                lens_model,
                format,
                shutter_speed,
                content='photos',
                content_rowid='photo_id',
                tokenize='unicode61 remove_diacritics 2'
            );

            -- 重建索引数据
            INSERT INTO photos_fts(rowid, file_name, file_path, camera_model, lens_model, format, shutter_speed)
            SELECT photo_id, file_name, file_path, camera_model, lens_model, format, shutter_speed FROM photos;

            -- 创建新的触发器：插入时同步 FTS
            CREATE TRIGGER photos_fts_insert AFTER INSERT ON photos BEGIN
                INSERT INTO photos_fts(rowid, file_name, file_path, camera_model, lens_model, format, shutter_speed)
                VALUES (NEW.photo_id, NEW.file_name, NEW.file_path, NEW.camera_model, NEW.lens_model, NEW.format, NEW.shutter_speed);
            END;

            -- 触发器：删除时同步 FTS
            CREATE TRIGGER photos_fts_delete AFTER DELETE ON photos BEGIN
                INSERT INTO photos_fts(photos_fts, rowid, file_name, file_path, camera_model, lens_model, format, shutter_speed)
                VALUES ('delete', OLD.photo_id, OLD.file_name, OLD.file_path, OLD.camera_model, OLD.lens_model, OLD.format, OLD.shutter_speed);
            END;

            -- 触发器：更新时同步 FTS
            CREATE TRIGGER photos_fts_update AFTER UPDATE ON photos BEGIN
                INSERT INTO photos_fts(photos_fts, rowid, file_name, file_path, camera_model, lens_model, format, shutter_speed)
                VALUES ('delete', OLD.photo_id, OLD.file_name, OLD.file_path, OLD.camera_model, OLD.lens_model, OLD.format, OLD.shutter_speed);
                INSERT INTO photos_fts(rowid, file_name, file_path, camera_model, lens_model, format, shutter_speed)
                VALUES (NEW.photo_id, NEW.file_name, NEW.file_path, NEW.camera_model, NEW.lens_model, NEW.format, NEW.shutter_speed);
            END;
        "#,
    },
    Migration {
        version: 7,
        description: "Add OCR text fields and extend FTS5 index with ocr_text",
        sql: r#"
            -- 添加 OCR 相关字段
            ALTER TABLE photos ADD COLUMN ocr_text TEXT;
            ALTER TABLE photos ADD COLUMN ocr_status INTEGER DEFAULT 0;
            ALTER TABLE photos ADD COLUMN ocr_processed_at TEXT;

            -- 创建 OCR 状态索引
            CREATE INDEX IF NOT EXISTS idx_photos_ocr_status ON photos(ocr_status);

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
    },
];
