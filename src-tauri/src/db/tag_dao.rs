//! 标签数据访问层

use rusqlite::{params, Row};

use crate::models::{
    tag::{CreateTag, UpdateTag},
    Tag, TagWithCount,
};
use crate::utils::error::{AppError, AppResult};

use super::connection::Database;

/// 从数据库行映射到 Tag 结构
fn row_to_tag(row: &Row<'_>) -> rusqlite::Result<Tag> {
    Ok(Tag {
        tag_id: row.get("tag_id")?,
        tag_name: row.get("tag_name")?,
        color: row.get("color")?,
        date_created: row.get("date_created")?,
    })
}

impl Database {
    // ==================== Tag CRUD ====================

    /// 创建标签
    pub fn create_tag(&self, tag: &CreateTag) -> AppResult<i64> {
        let conn = self.connection()?;
        let now = crate::models::photo::chrono_now_pub();

        conn.execute(
            "INSERT INTO tags (tag_name, color, date_created) VALUES (?1, ?2, ?3)",
            params![tag.tag_name, tag.color, now],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// 根据 ID 获取标签
    pub fn get_tag(&self, tag_id: i64) -> AppResult<Option<Tag>> {
        let conn = self.connection()?;

        let result = conn.query_row(
            "SELECT * FROM tags WHERE tag_id = ?1",
            params![tag_id],
            row_to_tag,
        );

        match result {
            Ok(tag) => Ok(Some(tag)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e)),
        }
    }

    /// 根据名称获取标签
    pub fn get_tag_by_name(&self, tag_name: &str) -> AppResult<Option<Tag>> {
        let conn = self.connection()?;

        let result = conn.query_row(
            "SELECT * FROM tags WHERE tag_name = ?1",
            params![tag_name],
            row_to_tag,
        );

        match result {
            Ok(tag) => Ok(Some(tag)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e)),
        }
    }

    /// 更新标签
    pub fn update_tag(&self, tag_id: i64, update: &UpdateTag) -> AppResult<bool> {
        let conn = self.connection()?;

        let mut updates = Vec::new();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref tag_name) = update.tag_name {
            updates.push("tag_name = ?");
            params_vec.push(Box::new(tag_name.clone()));
        }
        if let Some(ref color) = update.color {
            updates.push("color = ?");
            params_vec.push(Box::new(color.clone()));
        }

        if updates.is_empty() {
            return Ok(false);
        }

        params_vec.push(Box::new(tag_id));

        let sql = format!("UPDATE tags SET {} WHERE tag_id = ?", updates.join(", "));

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let rows = conn.execute(&sql, params_refs.as_slice())?;

        Ok(rows > 0)
    }

    /// 删除标签
    pub fn delete_tag(&self, tag_id: i64) -> AppResult<bool> {
        let conn = self.connection()?;
        let rows = conn.execute("DELETE FROM tags WHERE tag_id = ?1", params![tag_id])?;
        Ok(rows > 0)
    }

    /// 获取所有标签
    pub fn get_all_tags(&self) -> AppResult<Vec<Tag>> {
        let conn = self.connection()?;

        let mut stmt = conn.prepare("SELECT * FROM tags ORDER BY tag_name")?;
        let tags: Vec<Tag> = stmt
            .query_map([], row_to_tag)?
            .filter_map(|r| r.ok())
            .collect();

        Ok(tags)
    }

    /// 获取所有标签（带照片数量）
    pub fn get_all_tags_with_count(&self) -> AppResult<Vec<TagWithCount>> {
        let conn = self.connection()?;

        let mut stmt = conn.prepare(
            r#"
            SELECT t.*, COUNT(pt.photo_id) as photo_count
            FROM tags t
            LEFT JOIN photo_tags pt ON t.tag_id = pt.tag_id
            GROUP BY t.tag_id
            ORDER BY t.tag_name
            "#,
        )?;

        let tags: Vec<TagWithCount> = stmt
            .query_map([], |row| {
                Ok(TagWithCount {
                    tag: row_to_tag(row)?,
                    photo_count: row.get("photo_count")?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(tags)
    }

    // ==================== PhotoTag 关联操作 ====================

    /// 为照片添加标签
    pub fn add_tag_to_photo(&self, photo_id: i64, tag_id: i64) -> AppResult<bool> {
        let conn = self.connection()?;
        let now = crate::models::photo::chrono_now_pub();

        let result = conn.execute(
            "INSERT OR IGNORE INTO photo_tags (photo_id, tag_id, date_created) VALUES (?1, ?2, ?3)",
            params![photo_id, tag_id, now],
        );

        match result {
            Ok(rows) => Ok(rows > 0),
            Err(e) => Err(AppError::Database(e)),
        }
    }

    /// 为照片批量添加标签
    pub fn add_tags_to_photo(&self, photo_id: i64, tag_ids: &[i64]) -> AppResult<usize> {
        if tag_ids.is_empty() {
            return Ok(0);
        }

        self.transaction(|conn| {
            let now = crate::models::photo::chrono_now_pub();
            let mut count = 0;

            let mut stmt = conn.prepare(
                "INSERT OR IGNORE INTO photo_tags (photo_id, tag_id, date_created) VALUES (?1, ?2, ?3)",
            )?;

            for tag_id in tag_ids {
                count += stmt.execute(params![photo_id, tag_id, now])?;
            }

            Ok(count)
        })
    }

    /// 从照片移除标签
    pub fn remove_tag_from_photo(&self, photo_id: i64, tag_id: i64) -> AppResult<bool> {
        let conn = self.connection()?;
        let rows = conn.execute(
            "DELETE FROM photo_tags WHERE photo_id = ?1 AND tag_id = ?2",
            params![photo_id, tag_id],
        )?;
        Ok(rows > 0)
    }

    /// 移除照片的所有标签
    pub fn remove_all_tags_from_photo(&self, photo_id: i64) -> AppResult<usize> {
        let conn = self.connection()?;
        let rows = conn.execute(
            "DELETE FROM photo_tags WHERE photo_id = ?1",
            params![photo_id],
        )?;
        Ok(rows)
    }

    /// 获取照片的所有标签
    pub fn get_tags_for_photo(&self, photo_id: i64) -> AppResult<Vec<Tag>> {
        let conn = self.connection()?;

        let mut stmt = conn.prepare(
            r#"
            SELECT t.* FROM tags t
            INNER JOIN photo_tags pt ON t.tag_id = pt.tag_id
            WHERE pt.photo_id = ?1
            ORDER BY t.tag_name
            "#,
        )?;

        let tags: Vec<Tag> = stmt
            .query_map(params![photo_id], row_to_tag)?
            .filter_map(|r| r.ok())
            .collect();

        Ok(tags)
    }

    /// 获取标签下的所有照片 ID
    pub fn get_photo_ids_for_tag(&self, tag_id: i64) -> AppResult<Vec<i64>> {
        let conn = self.connection()?;

        let mut stmt = conn.prepare(
            "SELECT photo_id FROM photo_tags WHERE tag_id = ?1",
        )?;

        let ids: Vec<i64> = stmt
            .query_map(params![tag_id], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(ids)
    }

    /// 获取或创建标签（如果不存在则创建）
    pub fn get_or_create_tag(&self, tag_name: &str, color: Option<String>) -> AppResult<Tag> {
        if let Some(tag) = self.get_tag_by_name(tag_name)? {
            return Ok(tag);
        }

        let create_tag = CreateTag {
            tag_name: tag_name.to_string(),
            color,
        };

        let tag_id = self.create_tag(&create_tag)?;
        self.get_tag(tag_id)?.ok_or_else(|| AppError::General("创建标签失败".to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::photo::CreatePhoto;

    fn create_test_photo(name: &str) -> CreatePhoto {
        CreatePhoto {
            file_path: format!("/test/{}", name),
            file_name: name.to_string(),
            file_size: 1024,
            file_hash: format!("hash_{}", name),
            width: None,
            height: None,
            format: None,
            date_taken: None,
            camera_model: None,
            lens_model: None,
            focal_length: None,
            aperture: None,
            iso: None,
            shutter_speed: None,
            gps_latitude: None,
            gps_longitude: None,
            orientation: None,
        }
    }

    #[test]
    fn test_create_and_get_tag() {
        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();

        let tag = CreateTag {
            tag_name: "风景".to_string(),
            color: Some("#4CAF50".to_string()),
        };

        let id = db.create_tag(&tag).unwrap();
        assert!(id > 0);

        let retrieved = db.get_tag(id).unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().tag_name, "风景");
    }

    #[test]
    fn test_tag_photo_relationship() {
        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();

        // 创建照片
        let photo = create_test_photo("test.jpg");
        let photo_id = db.create_photo(&photo).unwrap();

        // 创建标签
        let tag = CreateTag {
            tag_name: "旅行".to_string(),
            color: None,
        };
        let tag_id = db.create_tag(&tag).unwrap();

        // 添加关联
        let added = db.add_tag_to_photo(photo_id, tag_id).unwrap();
        assert!(added);

        // 获取照片的标签
        let tags = db.get_tags_for_photo(photo_id).unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].tag_name, "旅行");

        // 获取标签下的照片
        let photo_ids = db.get_photo_ids_for_tag(tag_id).unwrap();
        assert_eq!(photo_ids.len(), 1);
        assert_eq!(photo_ids[0], photo_id);
    }

    #[test]
    fn test_tags_with_count() {
        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();

        // 创建标签
        let tag = CreateTag {
            tag_name: "测试".to_string(),
            color: None,
        };
        let tag_id = db.create_tag(&tag).unwrap();

        // 创建照片并添加标签
        for i in 0..5 {
            let photo = create_test_photo(&format!("photo_{}.jpg", i));
            let photo_id = db.create_photo(&photo).unwrap();
            db.add_tag_to_photo(photo_id, tag_id).unwrap();
        }

        let tags_with_count = db.get_all_tags_with_count().unwrap();
        assert_eq!(tags_with_count.len(), 1);
        assert_eq!(tags_with_count[0].photo_count, 5);
    }
}
