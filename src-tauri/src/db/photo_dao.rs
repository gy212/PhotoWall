//! 照片数据访问层

use rusqlite::{params, Row};

use crate::models::{
    photo::{CreatePhoto, UpdatePhoto},
    PaginatedResult, PaginationParams, Photo, PhotoCursor, PhotoSortField, PhotoSortOptions,
    SearchFilters, SortOrder,
};
use crate::utils::error::{AppError, AppResult};

use super::connection::Database;

#[derive(Debug)]
enum CursorValue {
    Null,
    Text(String),
    Int(i64),
}

struct CursorCondition {
    sql: String,
    params: Vec<Box<dyn rusqlite::ToSql>>,
}

fn parse_cursor_value(field: PhotoSortField, value: &serde_json::Value) -> AppResult<CursorValue> {
    if value.is_null() {
        return Ok(CursorValue::Null);
    }

    match field {
        PhotoSortField::FileSize | PhotoSortField::Rating => match value {
            serde_json::Value::Number(n) => n
                .as_i64()
                .map(CursorValue::Int)
                .ok_or_else(|| AppError::General("游标值必须是整数".to_string())),
            serde_json::Value::String(s) => s
                .parse::<i64>()
                .map(CursorValue::Int)
                .map_err(|_| AppError::General("游标值必须是整数".to_string())),
            _ => Err(AppError::General("游标值类型不匹配".to_string())),
        },
        _ => match value {
            serde_json::Value::String(s) => Ok(CursorValue::Text(s.clone())),
            serde_json::Value::Number(n) => Ok(CursorValue::Text(n.to_string())),
            _ => Err(AppError::General("游标值类型不匹配".to_string())),
        },
    }
}

fn build_cursor_condition(
    column: &str,
    sort: &PhotoSortOptions,
    cursor: &PhotoCursor,
) -> AppResult<CursorCondition> {
    let cmp_op = match sort.order {
        SortOrder::Asc => ">",
        SortOrder::Desc => "<",
    };

    let cursor_value = parse_cursor_value(sort.field, &cursor.sort_value)?;
    match cursor_value {
        CursorValue::Null => Ok(CursorCondition {
            sql: format!("({} IS NULL AND photo_id {} ?)", column, cmp_op),
            params: vec![Box::new(cursor.photo_id)],
        }),
        CursorValue::Text(v) => Ok(CursorCondition {
            sql: format!(
                "({0} {1} ? OR ({0} = ? AND photo_id {1} ?) OR {0} IS NULL)",
                column, cmp_op
            ),
            params: vec![Box::new(v.clone()), Box::new(v), Box::new(cursor.photo_id)],
        }),
        CursorValue::Int(v) => Ok(CursorCondition {
            sql: format!(
                "({0} {1} ? OR ({0} = ? AND photo_id {1} ?) OR {0} IS NULL)",
                column, cmp_op
            ),
            params: vec![Box::new(v), Box::new(v), Box::new(cursor.photo_id)],
        }),
    }
}

/// 从数据库行映射到 Photo 结构
fn row_to_photo(row: &Row<'_>) -> rusqlite::Result<Photo> {
    Ok(Photo {
        photo_id: row.get("photo_id")?,
        file_path: row.get("file_path")?,
        file_name: row.get("file_name")?,
        file_size: row.get("file_size")?,
        file_hash: row.get("file_hash")?,
        width: row.get("width")?,
        height: row.get("height")?,
        format: row.get("format")?,
        date_taken: row.get("date_taken")?,
        date_added: row.get("date_added")?,
        date_modified: row.get("date_modified")?,
        camera_model: row.get("camera_model")?,
        lens_model: row.get("lens_model")?,
        focal_length: row.get("focal_length")?,
        aperture: row.get("aperture")?,
        iso: row.get("iso")?,
        shutter_speed: row.get("shutter_speed")?,
        gps_latitude: row.get("gps_latitude")?,
        gps_longitude: row.get("gps_longitude")?,
        orientation: row.get("orientation")?,
        rating: row.get("rating")?,
        is_favorite: row.get::<_, i32>("is_favorite")? != 0,
        is_deleted: row.get::<_, i32>("is_deleted").unwrap_or(0) != 0,
        deleted_at: row.get("deleted_at").ok(),
    })
}

impl Database {
    // ==================== Photo CRUD ====================

    /// 创建照片记录
    pub fn create_photo(&self, photo: &CreatePhoto) -> AppResult<i64> {
        let conn = self.connection()?;
        let now = crate::models::photo::chrono_now_pub();

        conn.execute(
            r#"
            INSERT INTO photos (
                file_path, file_name, file_size, file_hash,
                width, height, format, date_taken, date_added,
                camera_model, lens_model, focal_length, aperture,
                iso, shutter_speed, gps_latitude, gps_longitude, orientation
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
                ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18
            )
            "#,
            params![
                photo.file_path,
                photo.file_name,
                photo.file_size,
                photo.file_hash,
                photo.width,
                photo.height,
                photo.format,
                photo.date_taken,
                now,
                photo.camera_model,
                photo.lens_model,
                photo.focal_length,
                photo.aperture,
                photo.iso,
                photo.shutter_speed,
                photo.gps_latitude,
                photo.gps_longitude,
                photo.orientation,
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// 批量创建照片记录
    pub fn create_photos_batch(&self, photos: &[CreatePhoto]) -> AppResult<Vec<i64>> {
        self.transaction(|conn| {
            let mut ids = Vec::with_capacity(photos.len());
            let now = crate::models::photo::chrono_now_pub();

            let mut stmt = conn.prepare(
                r#"
                INSERT INTO photos (
                    file_path, file_name, file_size, file_hash,
                    width, height, format, date_taken, date_added,
                    camera_model, lens_model, focal_length, aperture,
                    iso, shutter_speed, gps_latitude, gps_longitude, orientation
                ) VALUES (
                    ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
                    ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18
                )
                "#,
            )?;

            for photo in photos {
                stmt.execute(params![
                    photo.file_path,
                    photo.file_name,
                    photo.file_size,
                    photo.file_hash,
                    photo.width,
                    photo.height,
                    photo.format,
                    photo.date_taken,
                    now,
                    photo.camera_model,
                    photo.lens_model,
                    photo.focal_length,
                    photo.aperture,
                    photo.iso,
                    photo.shutter_speed,
                    photo.gps_latitude,
                    photo.gps_longitude,
                    photo.orientation,
                ])?;
                ids.push(conn.last_insert_rowid());
            }

            Ok(ids)
        })
    }

    /// 根据 ID 获取照片
    pub fn get_photo(&self, photo_id: i64) -> AppResult<Option<Photo>> {
        let conn = self.connection()?;

        let result = conn.query_row(
            "SELECT * FROM photos WHERE photo_id = ?1",
            params![photo_id],
            row_to_photo,
        );

        match result {
            Ok(photo) => Ok(Some(photo)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e)),
        }
    }

    /// 根据文件路径获取照片
    pub fn get_photo_by_path(&self, file_path: &str) -> AppResult<Option<Photo>> {
        let conn = self.connection()?;

        let result = conn.query_row(
            "SELECT * FROM photos WHERE file_path = ?1",
            params![file_path],
            row_to_photo,
        );

        match result {
            Ok(photo) => Ok(Some(photo)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e)),
        }
    }

    /// 根据哈希获取照片
    pub fn get_photo_by_hash(&self, file_hash: &str) -> AppResult<Option<Photo>> {
        let conn = self.connection()?;

        let result = conn.query_row(
            "SELECT * FROM photos WHERE file_hash = ?1",
            params![file_hash],
            row_to_photo,
        );

        match result {
            Ok(photo) => Ok(Some(photo)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e)),
        }
    }

    /// 更新照片
    pub fn update_photo(&self, photo_id: i64, update: &UpdatePhoto) -> AppResult<bool> {
        let conn = self.connection()?;
        let now = crate::models::photo::chrono_now_pub();

        let mut updates = Vec::new();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(rating) = update.rating {
            updates.push("rating = ?");
            params_vec.push(Box::new(rating));
        }
        if let Some(is_favorite) = update.is_favorite {
            updates.push("is_favorite = ?");
            params_vec.push(Box::new(is_favorite as i32));
        }
        if let Some(ref date_taken) = update.date_taken {
            updates.push("date_taken = ?");
            params_vec.push(Box::new(date_taken.clone()));
        }
        if let Some(ref camera_model) = update.camera_model {
            updates.push("camera_model = ?");
            params_vec.push(Box::new(camera_model.clone()));
        }
        if let Some(ref lens_model) = update.lens_model {
            updates.push("lens_model = ?");
            params_vec.push(Box::new(lens_model.clone()));
        }

        if updates.is_empty() {
            return Ok(false);
        }

        updates.push("date_modified = ?");
        params_vec.push(Box::new(now));
        params_vec.push(Box::new(photo_id));

        let sql = format!(
            "UPDATE photos SET {} WHERE photo_id = ?",
            updates.join(", ")
        );

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let rows = conn.execute(&sql, params_refs.as_slice())?;

        Ok(rows > 0)
    }

    /// 删除照片
    pub fn delete_photo(&self, photo_id: i64) -> AppResult<bool> {
        let conn = self.connection()?;
        let rows = conn.execute("DELETE FROM photos WHERE photo_id = ?1", params![photo_id])?;
        Ok(rows > 0)
    }

    /// 批量删除照片
    pub fn delete_photos_batch(&self, photo_ids: &[i64]) -> AppResult<usize> {
        if photo_ids.is_empty() {
            return Ok(0);
        }

        self.transaction(|conn| {
            let placeholders: Vec<String> = photo_ids.iter().map(|_| "?".to_string()).collect();
            let sql = format!(
                "DELETE FROM photos WHERE photo_id IN ({})",
                placeholders.join(", ")
            );

            let params: Vec<&dyn rusqlite::ToSql> = photo_ids
                .iter()
                .map(|id| id as &dyn rusqlite::ToSql)
                .collect();

            let rows = conn.execute(&sql, params.as_slice())?;
            Ok(rows)
        })
    }

    /// 获取所有照片（分页）
    pub fn get_photos(
        &self,
        pagination: &PaginationParams,
        sort: &PhotoSortOptions,
    ) -> AppResult<PaginatedResult<Photo>> {
        let conn = self.connection()?;

        // 获取总数（排除已删除的照片）
        let total: i64 = conn.query_row("SELECT COUNT(*) FROM photos WHERE is_deleted = 0", [], |row| row.get(0))?;

        // 计算偏移量
        let offset = ((pagination.page - 1) * pagination.page_size) as i64;

        // 构建排序 SQL
        let order_sql = format!(
            "ORDER BY {} {} NULLS LAST",
            sort.field.as_column(),
            sort.order.as_sql()
        );

        let sql = format!(
            "SELECT * FROM photos WHERE is_deleted = 0 {} LIMIT ?1 OFFSET ?2",
            order_sql
        );

        let mut stmt = conn.prepare(&sql)?;
        let photos: Vec<Photo> = stmt
            .query_map(params![pagination.page_size, offset], row_to_photo)?
            .filter_map(|r| r.ok())
            .collect();

        Ok(PaginatedResult::new(photos, total, pagination))
    }

    /// 获取所有照片（游标分页，用于无限滚动）
    pub fn get_photos_cursor(
        &self,
        limit: u32,
        cursor: Option<&PhotoCursor>,
        sort: &PhotoSortOptions,
    ) -> AppResult<Vec<Photo>> {
        let conn = self.connection()?;

        let mut sql = String::from("SELECT * FROM photos WHERE is_deleted = 0");
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(cursor) = cursor {
            let condition = build_cursor_condition(sort.field.as_column(), sort, cursor)?;
            sql.push_str(" AND ");
            sql.push_str(&condition.sql);
            params_vec.extend(condition.params);
        }

        // 稳定排序：在主排序字段后追加 photo_id 作为 tie-breaker
        let order_sql = format!(
            " ORDER BY {} {} NULLS LAST, photo_id {}",
            sort.field.as_column(),
            sort.order.as_sql(),
            sort.order.as_sql()
        );
        sql.push_str(&order_sql);
        sql.push_str(" LIMIT ?");
        params_vec.push(Box::new(limit as i64));

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(&sql)?;
        let photos: Vec<Photo> = stmt
            .query_map(params_refs.as_slice(), row_to_photo)?
            .filter_map(|r| r.ok())
            .collect();

        Ok(photos)
    }

    /// 获取未删除照片总数
    pub fn count_photos(&self) -> AppResult<i64> {
        let conn = self.connection()?;
        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM photos WHERE is_deleted = 0",
            [],
            |row| row.get(0),
        )?;
        Ok(total)
    }

    /// 获取收藏的照片
    pub fn get_favorite_photos(
        &self,
        pagination: &PaginationParams,
    ) -> AppResult<PaginatedResult<Photo>> {
        let conn = self.connection()?;

        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM photos WHERE is_favorite = 1 AND is_deleted = 0",
            [],
            |row| row.get(0),
        )?;

        let offset = ((pagination.page - 1) * pagination.page_size) as i64;

        let mut stmt = conn.prepare(
            "SELECT * FROM photos WHERE is_favorite = 1 AND is_deleted = 0 ORDER BY date_taken DESC NULLS LAST LIMIT ?1 OFFSET ?2",
        )?;

        let photos: Vec<Photo> = stmt
            .query_map(params![pagination.page_size, offset], row_to_photo)?
            .filter_map(|r| r.ok())
            .collect();

        Ok(PaginatedResult::new(photos, total, pagination))
    }

    /// 设置照片评分
    pub fn set_photo_rating(&self, photo_id: i64, rating: i32) -> AppResult<bool> {
        if !(0..=5).contains(&rating) {
            return Err(AppError::General("评分必须在 0-5 之间".to_string()));
        }

        let conn = self.connection()?;
        let rows = conn.execute(
            "UPDATE photos SET rating = ?1, date_modified = ?2 WHERE photo_id = ?3",
            params![rating, crate::models::photo::chrono_now_pub(), photo_id],
        )?;

        Ok(rows > 0)
    }

    /// 设置照片收藏状态
    pub fn set_photo_favorite(&self, photo_id: i64, is_favorite: bool) -> AppResult<bool> {
        let conn = self.connection()?;
        let rows = conn.execute(
            "UPDATE photos SET is_favorite = ?1, date_modified = ?2 WHERE photo_id = ?3",
            params![
                is_favorite as i32,
                crate::models::photo::chrono_now_pub(),
                photo_id
            ],
        )?;

        Ok(rows > 0)
    }

    /// 批量设置照片收藏状态
    pub fn set_photos_favorite(&self, photo_ids: &[i64], is_favorite: bool) -> AppResult<usize> {
        if photo_ids.is_empty() {
            return Ok(0);
        }

        let conn = self.connection()?;
        let now = crate::models::photo::chrono_now_pub();
        let is_fav = is_favorite as i32;

        // 构建占位符
        let placeholders: Vec<&str> = photo_ids.iter().map(|_| "?").collect();
        let sql = format!(
            "UPDATE photos SET is_favorite = ?1, date_modified = ?2 WHERE photo_id IN ({})",
            placeholders.join(", ")
        );

        // 构建参数
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        params_vec.push(Box::new(is_fav));
        params_vec.push(Box::new(now));
        for id in photo_ids {
            params_vec.push(Box::new(*id));
        }

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let rows = conn.execute(&sql, params_refs.as_slice())?;

        Ok(rows)
    }

    /// 检查文件路径是否存在
    pub fn photo_exists_by_path(&self, file_path: &str) -> AppResult<bool> {
        let conn = self.connection()?;
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM photos WHERE file_path = ?1",
            params![file_path],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    /// 检查文件哈希是否存在
    pub fn photo_exists_by_hash(&self, file_hash: &str) -> AppResult<bool> {
        let conn = self.connection()?;
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM photos WHERE file_hash = ?1",
            params![file_hash],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    // ==================== 搜索功能 ====================

    /// 搜索照片（支持多种过滤条件）
    pub fn search_photos(
        &self,
        filters: &SearchFilters,
        pagination: &PaginationParams,
        sort: &PhotoSortOptions,
    ) -> AppResult<PaginatedResult<Photo>> {
        let conn = self.connection()?;

        let mut where_clauses: Vec<String> = Vec::new();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        // 排除已删除的照片
        where_clauses.push("is_deleted = 0".to_string());

        // 全文搜索查询
        if let Some(ref query) = filters.query {
            if !query.trim().is_empty() {
                where_clauses.push(
                    "photo_id IN (SELECT rowid FROM photos_fts WHERE photos_fts MATCH ?)".to_string()
                );
                // 为 FTS5 转义特殊字符，并添加前缀匹配
                let fts_query = format!("{}*", query.replace('"', "\"\""));
                params_vec.push(Box::new(fts_query));
            }
        }

        // 日期范围过滤
        if let Some(ref date_from) = filters.date_from {
            where_clauses.push("date_taken >= ?".to_string());
            params_vec.push(Box::new(date_from.clone()));
        }
        if let Some(ref date_to) = filters.date_to {
            where_clauses.push("date_taken <= ?".to_string());
            params_vec.push(Box::new(date_to.clone()));
        }

        // 相机型号过滤
        if let Some(ref camera_model) = filters.camera_model {
            where_clauses.push("camera_model LIKE ?".to_string());
            params_vec.push(Box::new(format!("%{}%", camera_model)));
        }

        // 镜头型号过滤
        if let Some(ref lens_model) = filters.lens_model {
            where_clauses.push("lens_model LIKE ?".to_string());
            params_vec.push(Box::new(format!("%{}%", lens_model)));
        }

        // 评分过滤
        if let Some(min_rating) = filters.min_rating {
            where_clauses.push("rating >= ?".to_string());
            params_vec.push(Box::new(min_rating));
        }
        if let Some(max_rating) = filters.max_rating {
            where_clauses.push("rating <= ?".to_string());
            params_vec.push(Box::new(max_rating));
        }

        // 收藏过滤
        if filters.favorites_only == Some(true) {
            where_clauses.push("is_favorite = 1".to_string());
        }

        // GPS 过滤
        if filters.has_gps == Some(true) {
            where_clauses.push("gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL".to_string());
        }

        // 文件扩展名过滤（使用 format 字段）
        if let Some(ref extensions) = filters.file_extensions {
            if !extensions.is_empty() {
                let placeholders: Vec<String> = extensions.iter().map(|_| "?".to_string()).collect();
                where_clauses.push(format!(
                    "LOWER(format) IN ({})",
                    placeholders.join(", ")
                ));
                for ext in extensions {
                    params_vec.push(Box::new(ext.to_lowercase()));
                }
            }
        }

        // 标签过滤
        if let Some(ref tag_ids) = filters.tag_ids {
            if !tag_ids.is_empty() {
                let placeholders: Vec<String> = tag_ids.iter().map(|_| "?".to_string()).collect();
                where_clauses.push(format!(
                    "photo_id IN (SELECT DISTINCT photo_id FROM photo_tags WHERE tag_id IN ({}))",
                    placeholders.join(", ")
                ));
                for tag_id in tag_ids {
                    params_vec.push(Box::new(*tag_id));
                }
            }
        }

        // 相册过滤
        if let Some(album_id) = filters.album_id {
            where_clauses.push(
                "photo_id IN (SELECT photo_id FROM album_photos WHERE album_id = ?)".to_string()
            );
            params_vec.push(Box::new(album_id));
        }

        // 构建 WHERE 子句
        let where_sql = format!("WHERE {}", where_clauses.join(" AND "));

        // 构建排序 SQL
        let order_sql = format!(
            "ORDER BY {} {} NULLS LAST",
            sort.field.as_column(),
            sort.order.as_sql()
        );

        // 获取总数
        let count_sql = format!("SELECT COUNT(*) FROM photos {}", where_sql);
        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let total: i64 = conn.query_row(&count_sql, params_refs.as_slice(), |row| row.get(0))?;

        // 计算偏移量
        let offset = ((pagination.page - 1) * pagination.page_size) as i64;

        // 获取数据
        let data_sql = format!(
            "SELECT * FROM photos {} {} LIMIT ? OFFSET ?",
            where_sql, order_sql
        );

        // 添加分页参数
        params_vec.push(Box::new(pagination.page_size as i64));
        params_vec.push(Box::new(offset));

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(&data_sql)?;
        let photos: Vec<Photo> = stmt
            .query_map(params_refs.as_slice(), row_to_photo)?
            .filter_map(|r| r.ok())
            .collect();

        Ok(PaginatedResult::new(photos, total, pagination))
    }

    /// 搜索照片（游标分页，用于无限滚动）
    ///
    /// 返回：(items, total?)。`include_total=false` 时不计算总数。
    pub fn search_photos_cursor(
        &self,
        filters: &SearchFilters,
        limit: u32,
        cursor: Option<&PhotoCursor>,
        sort: &PhotoSortOptions,
        include_total: bool,
    ) -> AppResult<(Vec<Photo>, Option<i64>)> {
        let conn = self.connection()?;

        let mut base_where_clauses: Vec<String> = Vec::new();
        let mut base_params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        // 排除已删除的照片
        base_where_clauses.push("is_deleted = 0".to_string());

        // 全文搜索查询
        if let Some(ref query) = filters.query {
            if !query.trim().is_empty() {
                base_where_clauses.push(
                    "photo_id IN (SELECT rowid FROM photos_fts WHERE photos_fts MATCH ?)".to_string(),
                );
                // 为 FTS5 转义特殊字符，并添加前缀匹配
                let fts_query = format!("{}*", query.replace('\"', "\"\""));
                base_params_vec.push(Box::new(fts_query));
            }
        }

        // 日期范围过滤
        if let Some(ref date_from) = filters.date_from {
            base_where_clauses.push("date_taken >= ?".to_string());
            base_params_vec.push(Box::new(date_from.clone()));
        }
        if let Some(ref date_to) = filters.date_to {
            base_where_clauses.push("date_taken <= ?".to_string());
            base_params_vec.push(Box::new(date_to.clone()));
        }

        // 相机型号过滤
        if let Some(ref camera_model) = filters.camera_model {
            base_where_clauses.push("camera_model LIKE ?".to_string());
            base_params_vec.push(Box::new(format!("%{}%", camera_model)));
        }

        // 镜头型号过滤
        if let Some(ref lens_model) = filters.lens_model {
            base_where_clauses.push("lens_model LIKE ?".to_string());
            base_params_vec.push(Box::new(format!("%{}%", lens_model)));
        }

        // 评分过滤
        if let Some(min_rating) = filters.min_rating {
            base_where_clauses.push("rating >= ?".to_string());
            base_params_vec.push(Box::new(min_rating));
        }
        if let Some(max_rating) = filters.max_rating {
            base_where_clauses.push("rating <= ?".to_string());
            base_params_vec.push(Box::new(max_rating));
        }

        // 收藏过滤
        if filters.favorites_only == Some(true) {
            base_where_clauses.push("is_favorite = 1".to_string());
        }

        // GPS 过滤
        if filters.has_gps == Some(true) {
            base_where_clauses.push(
                "gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL".to_string(),
            );
        }

        // 文件扩展名过滤（使用 format 字段）
        if let Some(ref extensions) = filters.file_extensions {
            if !extensions.is_empty() {
                let placeholders: Vec<String> = extensions.iter().map(|_| "?".to_string()).collect();
                base_where_clauses.push(format!(
                    "LOWER(format) IN ({})",
                    placeholders.join(", ")
                ));
                for ext in extensions {
                    base_params_vec.push(Box::new(ext.to_lowercase()));
                }
            }
        }

        // 标签过滤
        if let Some(ref tag_ids) = filters.tag_ids {
            if !tag_ids.is_empty() {
                let placeholders: Vec<String> = tag_ids.iter().map(|_| "?".to_string()).collect();
                base_where_clauses.push(format!(
                    "photo_id IN (SELECT DISTINCT photo_id FROM photo_tags WHERE tag_id IN ({}))",
                    placeholders.join(", ")
                ));
                for tag_id in tag_ids {
                    base_params_vec.push(Box::new(*tag_id));
                }
            }
        }

        // 相册过滤
        if let Some(album_id) = filters.album_id {
            base_where_clauses.push(
                "photo_id IN (SELECT photo_id FROM album_photos WHERE album_id = ?)".to_string(),
            );
            base_params_vec.push(Box::new(album_id));
        }

        let base_where_sql = format!("WHERE {}", base_where_clauses.join(" AND "));

        // 总数（不包含游标过滤）
        let total: Option<i64> = if include_total {
            let count_sql = format!("SELECT COUNT(*) FROM photos {}", base_where_sql);
            let params_refs: Vec<&dyn rusqlite::ToSql> =
                base_params_vec.iter().map(|p| p.as_ref()).collect();
            Some(conn.query_row(&count_sql, params_refs.as_slice(), |row| row.get(0))?)
        } else {
            None
        };

        // 数据查询：在基础过滤上叠加游标过滤
        let mut data_where_clauses = base_where_clauses;
        let mut data_params_vec = base_params_vec;
        if let Some(cursor) = cursor {
            let condition = build_cursor_condition(sort.field.as_column(), sort, cursor)?;
            data_where_clauses.push(condition.sql);
            data_params_vec.extend(condition.params);
        }
        let data_where_sql = format!("WHERE {}", data_where_clauses.join(" AND "));

        let order_sql = format!(
            "ORDER BY {} {} NULLS LAST, photo_id {}",
            sort.field.as_column(),
            sort.order.as_sql(),
            sort.order.as_sql()
        );

        let data_sql = format!(
            "SELECT * FROM photos {} {} LIMIT ?",
            data_where_sql, order_sql
        );

        data_params_vec.push(Box::new(limit as i64));
        let params_refs: Vec<&dyn rusqlite::ToSql> =
            data_params_vec.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(&data_sql)?;
        let photos: Vec<Photo> = stmt
            .query_map(params_refs.as_slice(), row_to_photo)?
            .filter_map(|r| r.ok())
            .collect();

        Ok((photos, total))
    }

    /// 简单文本搜索（不使用 FTS）
    pub fn search_photos_simple(
        &self,
        query: &str,
        pagination: &PaginationParams,
    ) -> AppResult<PaginatedResult<Photo>> {
        let conn = self.connection()?;
        let search_pattern = format!("%{}%", query);

        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM photos WHERE is_deleted = 0 AND (file_name LIKE ?1 OR camera_model LIKE ?1 OR lens_model LIKE ?1)",
            params![search_pattern],
            |row| row.get(0),
        )?;

        let offset = ((pagination.page - 1) * pagination.page_size) as i64;

        let mut stmt = conn.prepare(
            r#"
            SELECT * FROM photos
            WHERE is_deleted = 0 AND (file_name LIKE ?1 OR camera_model LIKE ?1 OR lens_model LIKE ?1)
            ORDER BY date_taken DESC NULLS LAST
            LIMIT ?2 OFFSET ?3
            "#,
        )?;

        let photos: Vec<Photo> = stmt
            .query_map(params![search_pattern, pagination.page_size, offset], row_to_photo)?
            .filter_map(|r| r.ok())
            .collect();

        Ok(PaginatedResult::new(photos, total, pagination))
    }

    /// 根据标签获取照片
    pub fn get_photos_by_tag(
        &self,
        tag_id: i64,
        pagination: &PaginationParams,
        sort: &PhotoSortOptions,
    ) -> AppResult<PaginatedResult<Photo>> {
        let conn = self.connection()?;

        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM photos p INNER JOIN photo_tags pt ON p.photo_id = pt.photo_id WHERE pt.tag_id = ?1 AND p.is_deleted = 0",
            params![tag_id],
            |row| row.get(0),
        )?;

        let offset = ((pagination.page - 1) * pagination.page_size) as i64;
        let order_sql = format!(
            "ORDER BY p.{} {} NULLS LAST",
            sort.field.as_column(),
            sort.order.as_sql()
        );

        let sql = format!(
            r#"
            SELECT p.* FROM photos p
            INNER JOIN photo_tags pt ON p.photo_id = pt.photo_id
            WHERE pt.tag_id = ?1 AND p.is_deleted = 0
            {} LIMIT ?2 OFFSET ?3
            "#,
            order_sql
        );

        let mut stmt = conn.prepare(&sql)?;
        let photos: Vec<Photo> = stmt
            .query_map(params![tag_id, pagination.page_size, offset], row_to_photo)?
            .filter_map(|r| r.ok())
            .collect();

        Ok(PaginatedResult::new(photos, total, pagination))
    }

    /// 根据相册获取照片
    pub fn get_photos_by_album(
        &self,
        album_id: i64,
        pagination: &PaginationParams,
    ) -> AppResult<PaginatedResult<Photo>> {
        let conn = self.connection()?;

        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM photos p INNER JOIN album_photos ap ON p.photo_id = ap.photo_id WHERE ap.album_id = ?1 AND p.is_deleted = 0",
            params![album_id],
            |row| row.get(0),
        )?;

        let offset = ((pagination.page - 1) * pagination.page_size) as i64;

        let mut stmt = conn.prepare(
            r#"
            SELECT p.* FROM photos p
            INNER JOIN album_photos ap ON p.photo_id = ap.photo_id
            WHERE ap.album_id = ?1 AND p.is_deleted = 0
            ORDER BY ap.sort_order
            LIMIT ?2 OFFSET ?3
            "#,
        )?;

        let photos: Vec<Photo> = stmt
            .query_map(params![album_id, pagination.page_size, offset], row_to_photo)?
            .filter_map(|r| r.ok())
            .collect();

        Ok(PaginatedResult::new(photos, total, pagination))
    }

    /// 获取相机型号列表（用于过滤器）
    pub fn get_camera_models(&self) -> AppResult<Vec<String>> {
        let conn = self.connection()?;

        let mut stmt = conn.prepare(
            "SELECT DISTINCT camera_model FROM photos WHERE camera_model IS NOT NULL AND is_deleted = 0 ORDER BY camera_model",
        )?;

        let models: Vec<String> = stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(models)
    }

    /// 获取镜头型号列表（用于过滤器）
    pub fn get_lens_models(&self) -> AppResult<Vec<String>> {
        let conn = self.connection()?;

        let mut stmt = conn.prepare(
            "SELECT DISTINCT lens_model FROM photos WHERE lens_model IS NOT NULL AND is_deleted = 0 ORDER BY lens_model",
        )?;

        let models: Vec<String> = stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(models)
    }

    /// 获取照片统计信息
    pub fn get_photo_stats(&self) -> AppResult<PhotoStats> {
        let conn = self.connection()?;

        let total_photos: i64 = conn.query_row("SELECT COUNT(*) FROM photos WHERE is_deleted = 0", [], |row| row.get(0))?;
        let total_favorites: i64 = conn.query_row(
            "SELECT COUNT(*) FROM photos WHERE is_favorite = 1 AND is_deleted = 0",
            [],
            |row| row.get(0),
        )?;
        let total_with_gps: i64 = conn.query_row(
            "SELECT COUNT(*) FROM photos WHERE gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL AND is_deleted = 0",
            [],
            |row| row.get(0),
        )?;
        let total_size: i64 = conn.query_row(
            "SELECT COALESCE(SUM(file_size), 0) FROM photos WHERE is_deleted = 0",
            [],
            |row| row.get(0),
        )?;

        Ok(PhotoStats {
            total_photos,
            total_favorites,
            total_with_gps,
            total_size,
        })
    }

    // ==================== 回收站功能 ====================

    /// 获取已删除的照片（回收站）
    pub fn get_deleted_photos(
        &self,
        pagination: &PaginationParams,
    ) -> AppResult<PaginatedResult<Photo>> {
        let conn = self.connection()?;

        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM photos WHERE is_deleted = 1",
            [],
            |row| row.get(0),
        )?;

        let offset = ((pagination.page - 1) * pagination.page_size) as i64;

        let mut stmt = conn.prepare(
            "SELECT * FROM photos WHERE is_deleted = 1 ORDER BY deleted_at DESC NULLS LAST LIMIT ?1 OFFSET ?2",
        )?;

        let photos: Vec<Photo> = stmt
            .query_map(params![pagination.page_size, offset], row_to_photo)?
            .filter_map(|r| r.ok())
            .collect();

        Ok(PaginatedResult::new(photos, total, pagination))
    }

    /// 软删除照片（移入回收站）
    pub fn soft_delete_photos(&self, photo_ids: &[i64]) -> AppResult<usize> {
        if photo_ids.is_empty() {
            return Ok(0);
        }

        let conn = self.connection()?;
        let now = crate::models::photo::chrono_now_pub();

        // 构建占位符
        let placeholders: Vec<&str> = photo_ids.iter().map(|_| "?").collect();
        let sql = format!(
            "UPDATE photos SET is_deleted = 1, deleted_at = ?1, date_modified = ?1 WHERE photo_id IN ({})",
            placeholders.join(", ")
        );

        // 构建参数
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        params_vec.push(Box::new(now));
        for id in photo_ids {
            params_vec.push(Box::new(*id));
        }

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let rows = conn.execute(&sql, params_refs.as_slice())?;

        Ok(rows)
    }

    /// 恢复照片（从回收站恢复）
    pub fn restore_photos(&self, photo_ids: &[i64]) -> AppResult<usize> {
        if photo_ids.is_empty() {
            return Ok(0);
        }

        let conn = self.connection()?;
        let now = crate::models::photo::chrono_now_pub();

        // 构建占位符
        let placeholders: Vec<&str> = photo_ids.iter().map(|_| "?").collect();
        let sql = format!(
            "UPDATE photos SET is_deleted = 0, deleted_at = NULL, date_modified = ?1 WHERE photo_id IN ({})",
            placeholders.join(", ")
        );

        // 构建参数
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        params_vec.push(Box::new(now));
        for id in photo_ids {
            params_vec.push(Box::new(*id));
        }

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let rows = conn.execute(&sql, params_refs.as_slice())?;

        Ok(rows)
    }

    /// 永久删除照片（彻底删除）
    pub fn permanent_delete_photos(&self, photo_ids: &[i64]) -> AppResult<usize> {
        if photo_ids.is_empty() {
            return Ok(0);
        }

        self.transaction(|conn| {
            let placeholders: Vec<String> = photo_ids.iter().map(|_| "?".to_string()).collect();
            let sql = format!(
                "DELETE FROM photos WHERE photo_id IN ({})",
                placeholders.join(", ")
            );

            let params: Vec<&dyn rusqlite::ToSql> = photo_ids
                .iter()
                .map(|id| id as &dyn rusqlite::ToSql)
                .collect();

            let rows = conn.execute(&sql, params.as_slice())?;
            Ok(rows)
        })
    }

    /// 清空回收站（删除所有已删除的照片）
    pub fn empty_trash(&self) -> AppResult<usize> {
        let conn = self.connection()?;
        let rows = conn.execute("DELETE FROM photos WHERE is_deleted = 1", [])?;
        Ok(rows)
    }

    /// 获取回收站统计信息
    pub fn get_trash_stats(&self) -> AppResult<TrashStats> {
        let conn = self.connection()?;

        let total_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM photos WHERE is_deleted = 1",
            [],
            |row| row.get(0),
        )?;
        let total_size: i64 = conn.query_row(
            "SELECT COALESCE(SUM(file_size), 0) FROM photos WHERE is_deleted = 1",
            [],
            |row| row.get(0),
        )?;

        Ok(TrashStats {
            total_count,
            total_size,
        })
    }
}

/// 回收站统计信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashStats {
    pub total_count: i64,
    pub total_size: i64,
}

/// 照片统计信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhotoStats {
    pub total_photos: i64,
    pub total_favorites: i64,
    pub total_with_gps: i64,
    pub total_size: i64,
}

use std::collections::HashMap;

impl Database {
    // ==================== 文件夹视图功能 ====================

    /// 获取所有文件夹及其照片数量
    pub fn get_folder_photo_counts(&self) -> AppResult<HashMap<String, i64>> {
        let conn = self.connection()?;

        let mut stmt = conn.prepare(
            r#"
            SELECT 
                CASE 
                    WHEN instr(file_path, '/') > 0 THEN 
                        substr(file_path, 1, length(file_path) - length(file_name) - 1)
                    ELSE 
                        substr(file_path, 1, length(file_path) - length(file_name) - 1)
                END as folder_path,
                COUNT(*) as photo_count
            FROM photos 
            WHERE is_deleted = 0 AND file_path IS NOT NULL
            GROUP BY folder_path
            ORDER BY folder_path
            "#,
        )?;

        let mut folder_counts: HashMap<String, i64> = HashMap::new();
        let rows = stmt.query_map([], |row| {
            let path: String = row.get(0)?;
            let count: i64 = row.get(1)?;
            Ok((path, count))
        })?;

        for row in rows {
            if let Ok((path, count)) = row {
                if !path.is_empty() {
                    folder_counts.insert(path, count);
                }
            }
        }

        Ok(folder_counts)
    }

    /// 获取指定文件夹的子文件夹及其照片数量
    pub fn get_subfolder_photo_counts(&self, parent_path: &str) -> AppResult<HashMap<String, i64>> {
        let conn = self.connection()?;
        
        // 确保路径以分隔符结尾用于匹配
        let search_pattern = if parent_path.ends_with('\\') || parent_path.ends_with('/') {
            format!("{}%", parent_path)
        } else {
            format!("{}%", parent_path)
        };

        let mut stmt = conn.prepare(
            r#"
            SELECT 
                CASE 
                    WHEN instr(file_path, '/') > 0 THEN 
                        substr(file_path, 1, length(file_path) - length(file_name) - 1)
                    ELSE 
                        substr(file_path, 1, length(file_path) - length(file_name) - 1)
                END as folder_path,
                COUNT(*) as photo_count
            FROM photos 
            WHERE is_deleted = 0 
              AND file_path LIKE ?1
              AND file_path IS NOT NULL
            GROUP BY folder_path
            ORDER BY folder_path
            "#,
        )?;

        let mut folder_counts: HashMap<String, i64> = HashMap::new();
        let rows = stmt.query_map(params![search_pattern], |row| {
            let path: String = row.get(0)?;
            let count: i64 = row.get(1)?;
            Ok((path, count))
        })?;

        let parent_len = parent_path.len();
        for row in rows {
            if let Ok((path, count)) = row {
                // 只包含直接子文件夹
                if path.len() > parent_len && !path.is_empty() {
                    folder_counts.insert(path, count);
                }
            }
        }

        Ok(folder_counts)
    }

    /// 获取指定文件夹中的照片（支持包含子文件夹）
    pub fn get_photos_by_folder(
        &self,
        folder_path: &str,
        include_subfolders: bool,
        pagination: &PaginationParams,
        sort: &PhotoSortOptions,
    ) -> AppResult<PaginatedResult<Photo>> {
        let conn = self.connection()?;

        // 构建路径匹配条件
        let (path_condition, search_pattern) = if include_subfolders {
            // 包含子文件夹：使用 LIKE 前缀匹配
            let pattern = if folder_path.ends_with('\\') || folder_path.ends_with('/') {
                format!("{}%", folder_path)
            } else {
                format!("{}%", folder_path)
            };
            ("file_path LIKE ?1", pattern)
        } else {
            // 仅当前文件夹：精确匹配文件夹路径部分
            let pattern = if folder_path.ends_with('\\') {
                format!("{}%", folder_path)
            } else if folder_path.ends_with('/') {
                format!("{}%", folder_path)
            } else {
                // 添加路径分隔符以精确匹配
                format!("{}\\%", folder_path)
            };
            ("file_path LIKE ?1 AND file_path NOT LIKE ?1 || '%\\%' AND file_path NOT LIKE ?1 || '%/%'", pattern)
        };

        // 获取总数
        let count_sql = if include_subfolders {
            format!(
                "SELECT COUNT(*) FROM photos WHERE is_deleted = 0 AND {}",
                path_condition
            )
        } else {
            // 对于非递归查询，我们需要更精确的匹配
            format!(
                r#"SELECT COUNT(*) FROM photos 
                   WHERE is_deleted = 0 
                   AND (
                       substr(file_path, 1, length(file_path) - length(file_name) - 1) = ?1
                       OR substr(file_path, 1, length(file_path) - length(file_name) - 1) = ?1 || '\'
                       OR substr(file_path, 1, length(file_path) - length(file_name) - 1) = ?1 || '/'
                   )"#
            )
        };

        let total: i64 = if include_subfolders {
            conn.query_row(&count_sql, params![search_pattern], |row| row.get(0))?
        } else {
            conn.query_row(&count_sql, params![folder_path], |row| row.get(0))?
        };

        // 计算偏移量
        let offset = ((pagination.page - 1) * pagination.page_size) as i64;

        // 构建排序 SQL
        let order_sql = format!(
            "ORDER BY {} {} NULLS LAST",
            sort.field.as_column(),
            sort.order.as_sql()
        );

        // 获取数据
        let data_sql = if include_subfolders {
            format!(
                "SELECT * FROM photos WHERE is_deleted = 0 AND {} {} LIMIT ?2 OFFSET ?3",
                path_condition, order_sql
            )
        } else {
            format!(
                r#"SELECT * FROM photos 
                   WHERE is_deleted = 0 
                   AND (
                       substr(file_path, 1, length(file_path) - length(file_name) - 1) = ?1
                       OR substr(file_path, 1, length(file_path) - length(file_name) - 1) = ?1 || '\'
                       OR substr(file_path, 1, length(file_path) - length(file_name) - 1) = ?1 || '/'
                   )
                   {} LIMIT ?2 OFFSET ?3"#,
                order_sql
            )
        };

        let mut stmt = conn.prepare(&data_sql)?;
        let photos: Vec<Photo> = if include_subfolders {
            stmt.query_map(params![search_pattern, pagination.page_size, offset], row_to_photo)?
                .filter_map(|r| r.ok())
                .collect()
        } else {
            stmt.query_map(params![folder_path, pagination.page_size, offset], row_to_photo)?
                .filter_map(|r| r.ok())
                .collect()
        };

        Ok(PaginatedResult::new(photos, total, pagination))
    }

    /// 获取指定文件夹的照片数量
    pub fn get_folder_photo_count(&self, folder_path: &str, include_subfolders: bool) -> AppResult<i64> {
        let conn = self.connection()?;

        let count: i64 = if include_subfolders {
            let pattern = format!("{}%", folder_path);
            conn.query_row(
                "SELECT COUNT(*) FROM photos WHERE is_deleted = 0 AND file_path LIKE ?1",
                params![pattern],
                |row| row.get(0),
            )?
        } else {
            conn.query_row(
                r#"SELECT COUNT(*) FROM photos 
                   WHERE is_deleted = 0 
                   AND (
                       substr(file_path, 1, length(file_path) - length(file_name) - 1) = ?1
                       OR substr(file_path, 1, length(file_path) - length(file_name) - 1) = ?1 || '\'
                       OR substr(file_path, 1, length(file_path) - length(file_name) - 1) = ?1 || '/'
                   )"#,
                params![folder_path],
                |row| row.get(0),
            )?
        };

        Ok(count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_photo(name: &str) -> CreatePhoto {
        CreatePhoto {
            file_path: format!("/test/{}", name),
            file_name: name.to_string(),
            file_size: 1024,
            file_hash: format!("hash_{}", name),
            width: Some(1920),
            height: Some(1080),
            format: Some("jpeg".to_string()),
            date_taken: Some("2024-01-01T12:00:00Z".to_string()),
            camera_model: Some("Canon EOS R5".to_string()),
            lens_model: Some("RF 24-70mm".to_string()),
            focal_length: Some(50.0),
            aperture: Some(2.8),
            iso: Some(100),
            shutter_speed: Some("1/250".to_string()),
            gps_latitude: None,
            gps_longitude: None,
            orientation: Some(1),
        }
    }

    #[test]
    fn test_create_and_get_photo() {
        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();

        let photo = create_test_photo("test.jpg");
        let id = db.create_photo(&photo).unwrap();
        assert!(id > 0);

        let retrieved = db.get_photo(id).unwrap();
        assert!(retrieved.is_some());

        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.file_name, "test.jpg");
        assert_eq!(retrieved.file_size, 1024);
    }

    #[test]
    fn test_update_photo() {
        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();

        let photo = create_test_photo("test.jpg");
        let id = db.create_photo(&photo).unwrap();

        let update = UpdatePhoto {
            rating: Some(5),
            is_favorite: Some(true),
            ..Default::default()
        };

        let updated = db.update_photo(id, &update).unwrap();
        assert!(updated);

        let retrieved = db.get_photo(id).unwrap().unwrap();
        assert_eq!(retrieved.rating, 5);
        assert!(retrieved.is_favorite);
    }

    #[test]
    fn test_delete_photo() {
        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();

        let photo = create_test_photo("test.jpg");
        let id = db.create_photo(&photo).unwrap();

        let deleted = db.delete_photo(id).unwrap();
        assert!(deleted);

        let retrieved = db.get_photo(id).unwrap();
        assert!(retrieved.is_none());
    }

    #[test]
    fn test_batch_operations() {
        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();

        let photos: Vec<CreatePhoto> = (0..10)
            .map(|i| create_test_photo(&format!("photo_{}.jpg", i)))
            .collect();

        let ids = db.create_photos_batch(&photos).unwrap();
        assert_eq!(ids.len(), 10);

        let pagination = PaginationParams { page: 1, page_size: 5 };
        let sort = PhotoSortOptions::default();
        let result = db.get_photos(&pagination, &sort).unwrap();

        assert_eq!(result.items.len(), 5);
        assert_eq!(result.total, 10);
        assert_eq!(result.total_pages, 2);
    }

    #[test]
    fn test_favorite_photos() {
        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();

        let photo = create_test_photo("test.jpg");
        let id = db.create_photo(&photo).unwrap();

        db.set_photo_favorite(id, true).unwrap();

        let pagination = PaginationParams::default();
        let favorites = db.get_favorite_photos(&pagination).unwrap();

        assert_eq!(favorites.total, 1);
        assert!(favorites.items[0].is_favorite);
    }
}
