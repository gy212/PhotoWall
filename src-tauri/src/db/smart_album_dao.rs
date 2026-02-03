//! 智能相册数据访问层
//!
//! 智能相册是保存的搜索条件，可以动态显示匹配的照片

use rusqlite::{params, OptionalExtension};

use crate::models::SearchFilters;
use crate::utils::error::{AppError, AppResult};

use super::connection::Database;

/// 智能相册
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartAlbum {
    pub smart_album_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub filters: SearchFilters,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub date_created: String,
    pub date_modified: String,
    pub sort_order: i32,
}

/// 创建智能相册参数
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSmartAlbum {
    pub name: String,
    pub description: Option<String>,
    pub filters: SearchFilters,
    pub icon: Option<String>,
    pub color: Option<String>,
}

/// 更新智能相册参数
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSmartAlbum {
    pub name: Option<String>,
    pub description: Option<String>,
    pub filters: Option<SearchFilters>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub sort_order: Option<i32>,
}

impl Database {
    /// 创建智能相册
    pub fn create_smart_album(&self, album: &CreateSmartAlbum) -> AppResult<i64> {
        let conn = self.connection()?;

        let filters_json = serde_json::to_string(&album.filters)
            .map_err(|e| AppError::General(format!("序列化过滤器失败: {}", e)))?;

        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

        conn.execute(
            r#"
            INSERT INTO smart_albums (name, description, filters, icon, color, date_created, date_modified)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
            "#,
            params![
                album.name,
                album.description,
                filters_json,
                album.icon,
                album.color,
                now
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// 获取智能相册
    pub fn get_smart_album(&self, id: i64) -> AppResult<Option<SmartAlbum>> {
        let conn = self.connection()?;

        let mut stmt = conn.prepare(
            "SELECT * FROM smart_albums WHERE smart_album_id = ?1"
        )?;

        let album = stmt
            .query_row(params![id], |row| {
                let filters_json: String = row.get("filters")?;
                let filters: SearchFilters = serde_json::from_str(&filters_json)
                    .unwrap_or_default();

                Ok(SmartAlbum {
                    smart_album_id: row.get("smart_album_id")?,
                    name: row.get("name")?,
                    description: row.get("description")?,
                    filters,
                    icon: row.get("icon")?,
                    color: row.get("color")?,
                    date_created: row.get("date_created")?,
                    date_modified: row.get("date_modified")?,
                    sort_order: row.get("sort_order")?,
                })
            })
            .optional()?;

        Ok(album)
    }

    /// 获取所有智能相册
    pub fn get_all_smart_albums(&self) -> AppResult<Vec<SmartAlbum>> {
        let conn = self.connection()?;

        let mut stmt = conn.prepare(
            "SELECT * FROM smart_albums ORDER BY sort_order ASC, date_created DESC"
        )?;

        let albums = stmt
            .query_map([], |row| {
                let filters_json: String = row.get("filters")?;
                let filters: SearchFilters = serde_json::from_str(&filters_json)
                    .unwrap_or_default();

                Ok(SmartAlbum {
                    smart_album_id: row.get("smart_album_id")?,
                    name: row.get("name")?,
                    description: row.get("description")?,
                    filters,
                    icon: row.get("icon")?,
                    color: row.get("color")?,
                    date_created: row.get("date_created")?,
                    date_modified: row.get("date_modified")?,
                    sort_order: row.get("sort_order")?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(albums)
    }

    /// 更新智能相册
    pub fn update_smart_album(&self, id: i64, update: &UpdateSmartAlbum) -> AppResult<bool> {
        let conn = self.connection()?;

        let mut updates = Vec::new();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref name) = update.name {
            updates.push("name = ?");
            params_vec.push(Box::new(name.clone()));
        }
        if let Some(ref description) = update.description {
            updates.push("description = ?");
            params_vec.push(Box::new(description.clone()));
        }
        if let Some(ref filters) = update.filters {
            let filters_json = serde_json::to_string(filters)
                .map_err(|e| AppError::General(format!("序列化过滤器失败: {}", e)))?;
            updates.push("filters = ?");
            params_vec.push(Box::new(filters_json));
        }
        if let Some(ref icon) = update.icon {
            updates.push("icon = ?");
            params_vec.push(Box::new(icon.clone()));
        }
        if let Some(ref color) = update.color {
            updates.push("color = ?");
            params_vec.push(Box::new(color.clone()));
        }
        if let Some(sort_order) = update.sort_order {
            updates.push("sort_order = ?");
            params_vec.push(Box::new(sort_order));
        }

        if updates.is_empty() {
            return Ok(false);
        }

        // 更新修改时间
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        updates.push("date_modified = ?");
        params_vec.push(Box::new(now));

        // 添加 ID 参数
        params_vec.push(Box::new(id));

        let sql = format!(
            "UPDATE smart_albums SET {} WHERE smart_album_id = ?",
            updates.join(", ")
        );

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let rows = conn.execute(&sql, params_refs.as_slice())?;

        Ok(rows > 0)
    }

    /// 删除智能相册
    pub fn delete_smart_album(&self, id: i64) -> AppResult<bool> {
        let conn = self.connection()?;
        let rows = conn.execute(
            "DELETE FROM smart_albums WHERE smart_album_id = ?1",
            params![id],
        )?;
        Ok(rows > 0)
    }
}
