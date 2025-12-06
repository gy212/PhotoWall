//! 相册数据访问层

use rusqlite::{params, Row};

use crate::models::{
    album::{CreateAlbum, UpdateAlbum},
    Album, AlbumWithCount,
};
use crate::utils::error::{AppError, AppResult};

use super::connection::Database;

/// 从数据库行映射到 Album 结构
fn row_to_album(row: &Row<'_>) -> rusqlite::Result<Album> {
    Ok(Album {
        album_id: row.get("album_id")?,
        album_name: row.get("album_name")?,
        description: row.get("description")?,
        cover_photo_id: row.get("cover_photo_id")?,
        date_created: row.get("date_created")?,
        sort_order: row.get("sort_order")?,
    })
}

impl Database {
    // ==================== Album CRUD ====================

    /// 创建相册
    pub fn create_album(&self, album: &CreateAlbum) -> AppResult<i64> {
        let conn = self.connection()?;
        let now = crate::models::photo::chrono_now_pub();

        // 获取最大排序号
        let max_order: i32 = conn
            .query_row("SELECT COALESCE(MAX(sort_order), 0) FROM albums", [], |row| {
                row.get(0)
            })
            .unwrap_or(0);

        conn.execute(
            "INSERT INTO albums (album_name, description, date_created, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![album.album_name, album.description, now, max_order + 1],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// 根据 ID 获取相册
    pub fn get_album(&self, album_id: i64) -> AppResult<Option<Album>> {
        let conn = self.connection()?;

        let result = conn.query_row(
            "SELECT * FROM albums WHERE album_id = ?1",
            params![album_id],
            row_to_album,
        );

        match result {
            Ok(album) => Ok(Some(album)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e)),
        }
    }

    /// 根据名称获取相册
    pub fn get_album_by_name(&self, album_name: &str) -> AppResult<Option<Album>> {
        let conn = self.connection()?;

        let result = conn.query_row(
            "SELECT * FROM albums WHERE album_name = ?1",
            params![album_name],
            row_to_album,
        );

        match result {
            Ok(album) => Ok(Some(album)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e)),
        }
    }

    /// 更新相册
    pub fn update_album(&self, album_id: i64, update: &UpdateAlbum) -> AppResult<bool> {
        let conn = self.connection()?;

        let mut updates = Vec::new();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref album_name) = update.album_name {
            updates.push("album_name = ?");
            params_vec.push(Box::new(album_name.clone()));
        }
        if let Some(ref description) = update.description {
            updates.push("description = ?");
            params_vec.push(Box::new(description.clone()));
        }
        if let Some(cover_photo_id) = update.cover_photo_id {
            updates.push("cover_photo_id = ?");
            params_vec.push(Box::new(cover_photo_id));
        }
        if let Some(sort_order) = update.sort_order {
            updates.push("sort_order = ?");
            params_vec.push(Box::new(sort_order));
        }

        if updates.is_empty() {
            return Ok(false);
        }

        params_vec.push(Box::new(album_id));

        let sql = format!("UPDATE albums SET {} WHERE album_id = ?", updates.join(", "));

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let rows = conn.execute(&sql, params_refs.as_slice())?;

        Ok(rows > 0)
    }

    /// 删除相册
    pub fn delete_album(&self, album_id: i64) -> AppResult<bool> {
        let conn = self.connection()?;
        let rows = conn.execute("DELETE FROM albums WHERE album_id = ?1", params![album_id])?;
        Ok(rows > 0)
    }

    /// 获取所有相册
    pub fn get_all_albums(&self) -> AppResult<Vec<Album>> {
        let conn = self.connection()?;

        let mut stmt = conn.prepare("SELECT * FROM albums ORDER BY sort_order, album_name")?;
        let albums: Vec<Album> = stmt
            .query_map([], row_to_album)?
            .filter_map(|r| r.ok())
            .collect();

        Ok(albums)
    }

    /// 获取所有相册（带照片数量）
    pub fn get_all_albums_with_count(&self) -> AppResult<Vec<AlbumWithCount>> {
        let conn = self.connection()?;

        let mut stmt = conn.prepare(
            r#"
            SELECT a.*, COUNT(ap.photo_id) as photo_count
            FROM albums a
            LEFT JOIN album_photos ap ON a.album_id = ap.album_id
            GROUP BY a.album_id
            ORDER BY a.sort_order, a.album_name
            "#,
        )?;

        let albums: Vec<AlbumWithCount> = stmt
            .query_map([], |row| {
                Ok(AlbumWithCount {
                    album: row_to_album(row)?,
                    photo_count: row.get("photo_count")?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(albums)
    }

    // ==================== AlbumPhoto 关联操作 ====================

    /// 添加照片到相册
    pub fn add_photo_to_album(&self, album_id: i64, photo_id: i64) -> AppResult<bool> {
        let conn = self.connection()?;
        let now = crate::models::photo::chrono_now_pub();

        // 获取最大排序号
        let max_order: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(sort_order), 0) FROM album_photos WHERE album_id = ?1",
                params![album_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let result = conn.execute(
            "INSERT OR IGNORE INTO album_photos (album_id, photo_id, sort_order, date_added) VALUES (?1, ?2, ?3, ?4)",
            params![album_id, photo_id, max_order + 1, now],
        );

        match result {
            Ok(rows) => Ok(rows > 0),
            Err(e) => Err(AppError::Database(e)),
        }
    }

    /// 批量添加照片到相册
    pub fn add_photos_to_album(&self, album_id: i64, photo_ids: &[i64]) -> AppResult<usize> {
        if photo_ids.is_empty() {
            return Ok(0);
        }

        self.transaction(|conn| {
            let now = crate::models::photo::chrono_now_pub();

            // 获取当前最大排序号
            let mut max_order: i32 = conn
                .query_row(
                    "SELECT COALESCE(MAX(sort_order), 0) FROM album_photos WHERE album_id = ?1",
                    params![album_id],
                    |row| row.get(0),
                )
                .unwrap_or(0);

            let mut count = 0;
            let mut stmt = conn.prepare(
                "INSERT OR IGNORE INTO album_photos (album_id, photo_id, sort_order, date_added) VALUES (?1, ?2, ?3, ?4)",
            )?;

            for photo_id in photo_ids {
                max_order += 1;
                count += stmt.execute(params![album_id, photo_id, max_order, now])?;
            }

            Ok(count)
        })
    }

    /// 从相册移除照片
    pub fn remove_photo_from_album(&self, album_id: i64, photo_id: i64) -> AppResult<bool> {
        let conn = self.connection()?;
        let rows = conn.execute(
            "DELETE FROM album_photos WHERE album_id = ?1 AND photo_id = ?2",
            params![album_id, photo_id],
        )?;
        Ok(rows > 0)
    }

    /// 从相册移除所有照片
    pub fn remove_all_photos_from_album(&self, album_id: i64) -> AppResult<usize> {
        let conn = self.connection()?;
        let rows = conn.execute(
            "DELETE FROM album_photos WHERE album_id = ?1",
            params![album_id],
        )?;
        Ok(rows)
    }

    /// 获取相册中的所有照片 ID
    pub fn get_photo_ids_in_album(&self, album_id: i64) -> AppResult<Vec<i64>> {
        let conn = self.connection()?;

        let mut stmt = conn.prepare(
            "SELECT photo_id FROM album_photos WHERE album_id = ?1 ORDER BY sort_order",
        )?;

        let ids: Vec<i64> = stmt
            .query_map(params![album_id], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(ids)
    }

    /// 获取照片所属的所有相册
    pub fn get_albums_for_photo(&self, photo_id: i64) -> AppResult<Vec<Album>> {
        let conn = self.connection()?;

        let mut stmt = conn.prepare(
            r#"
            SELECT a.* FROM albums a
            INNER JOIN album_photos ap ON a.album_id = ap.album_id
            WHERE ap.photo_id = ?1
            ORDER BY a.sort_order, a.album_name
            "#,
        )?;

        let albums: Vec<Album> = stmt
            .query_map(params![photo_id], row_to_album)?
            .filter_map(|r| r.ok())
            .collect();

        Ok(albums)
    }

    /// 设置相册封面
    pub fn set_album_cover(&self, album_id: i64, photo_id: i64) -> AppResult<bool> {
        let conn = self.connection()?;
        let rows = conn.execute(
            "UPDATE albums SET cover_photo_id = ?1 WHERE album_id = ?2",
            params![photo_id, album_id],
        )?;
        Ok(rows > 0)
    }

    /// 更新相册内照片排序
    pub fn update_album_photo_order(
        &self,
        album_id: i64,
        photo_id: i64,
        new_order: i32,
    ) -> AppResult<bool> {
        let conn = self.connection()?;
        let rows = conn.execute(
            "UPDATE album_photos SET sort_order = ?1 WHERE album_id = ?2 AND photo_id = ?3",
            params![new_order, album_id, photo_id],
        )?;
        Ok(rows > 0)
    }

    /// 重新排序相册内的照片
    pub fn reorder_album_photos(&self, album_id: i64, photo_ids: &[i64]) -> AppResult<()> {
        self.transaction(|conn| {
            let mut stmt = conn.prepare(
                "UPDATE album_photos SET sort_order = ?1 WHERE album_id = ?2 AND photo_id = ?3",
            )?;

            for (index, photo_id) in photo_ids.iter().enumerate() {
                stmt.execute(params![index as i32, album_id, photo_id])?;
            }

            Ok(())
        })
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
    fn test_create_and_get_album() {
        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();

        let album = CreateAlbum {
            album_name: "旅行照片".to_string(),
            description: Some("2024年夏季旅行".to_string()),
        };

        let id = db.create_album(&album).unwrap();
        assert!(id > 0);

        let retrieved = db.get_album(id).unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().album_name, "旅行照片");
    }

    #[test]
    fn test_album_photo_relationship() {
        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();

        // 创建相册
        let album = CreateAlbum {
            album_name: "测试相册".to_string(),
            description: None,
        };
        let album_id = db.create_album(&album).unwrap();

        // 创建照片
        let photo = create_test_photo("test.jpg");
        let photo_id = db.create_photo(&photo).unwrap();

        // 添加到相册
        let added = db.add_photo_to_album(album_id, photo_id).unwrap();
        assert!(added);

        // 获取相册中的照片
        let photo_ids = db.get_photo_ids_in_album(album_id).unwrap();
        assert_eq!(photo_ids.len(), 1);
        assert_eq!(photo_ids[0], photo_id);

        // 获取照片所属的相册
        let albums = db.get_albums_for_photo(photo_id).unwrap();
        assert_eq!(albums.len(), 1);
        assert_eq!(albums[0].album_id, album_id);
    }

    #[test]
    fn test_albums_with_count() {
        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();

        // 创建相册
        let album = CreateAlbum {
            album_name: "测试".to_string(),
            description: None,
        };
        let album_id = db.create_album(&album).unwrap();

        // 创建照片并添加到相册
        for i in 0..3 {
            let photo = create_test_photo(&format!("photo_{}.jpg", i));
            let photo_id = db.create_photo(&photo).unwrap();
            db.add_photo_to_album(album_id, photo_id).unwrap();
        }

        let albums_with_count = db.get_all_albums_with_count().unwrap();
        assert_eq!(albums_with_count.len(), 1);
        assert_eq!(albums_with_count[0].photo_count, 3);
    }

    #[test]
    fn test_batch_add_photos() {
        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();

        // 创建相册
        let album = CreateAlbum {
            album_name: "批量测试".to_string(),
            description: None,
        };
        let album_id = db.create_album(&album).unwrap();

        // 创建多个照片
        let mut photo_ids = Vec::new();
        for i in 0..5 {
            let photo = create_test_photo(&format!("photo_{}.jpg", i));
            photo_ids.push(db.create_photo(&photo).unwrap());
        }

        // 批量添加
        let count = db.add_photos_to_album(album_id, &photo_ids).unwrap();
        assert_eq!(count, 5);

        let photos_in_album = db.get_photo_ids_in_album(album_id).unwrap();
        assert_eq!(photos_in_album.len(), 5);
    }
}
