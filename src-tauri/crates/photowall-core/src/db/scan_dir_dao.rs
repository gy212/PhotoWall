//! 扫描目录数据访问层

use rusqlite::{params, Row};

use crate::utils::error::{AppError, AppResult};

use super::connection::Database;

/// 扫描目录状态
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanDirectoryState {
    pub dir_id: i64,
    pub dir_path: String,
    pub last_scan: Option<String>,
    pub is_active: bool,
    pub last_change_time: Option<String>,
    pub no_change_count: i32,
    pub scan_multiplier: i32,
    pub next_scan_time: Option<String>,
    pub file_count: i64,
}

/// 从数据库行映射到 ScanDirectoryState
fn row_to_scan_dir(row: &Row<'_>) -> rusqlite::Result<ScanDirectoryState> {
    Ok(ScanDirectoryState {
        dir_id: row.get("dir_id")?,
        dir_path: row.get("dir_path")?,
        last_scan: row.get("last_scan")?,
        is_active: row.get::<_, i32>("is_active")? != 0,
        last_change_time: row.get("last_change_time")?,
        no_change_count: row.get("no_change_count").unwrap_or(0),
        scan_multiplier: row.get("scan_multiplier").unwrap_or(1),
        next_scan_time: row.get("next_scan_time")?,
        file_count: row.get("file_count").unwrap_or(0),
    })
}

impl Database {
    /// 插入或更新扫描目录
    pub fn upsert_scan_directory(&self, dir_path: &str, file_count: i64) -> AppResult<i64> {
        let conn = self.connection()?;
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            r#"
            INSERT INTO scan_directories (dir_path, last_scan, is_active, file_count, no_change_count, scan_multiplier)
            VALUES (?1, ?2, 1, ?3, 0, 1)
            ON CONFLICT(dir_path) DO UPDATE SET
                last_scan = ?2,
                file_count = ?3,
                is_active = 1
            "#,
            params![dir_path, now, file_count],
        )?;

        // 获取 dir_id
        let dir_id: i64 = conn.query_row(
            "SELECT dir_id FROM scan_directories WHERE dir_path = ?1",
            params![dir_path],
            |row| row.get(0),
        )?;

        Ok(dir_id)
    }

    /// 获取单个扫描目录状态
    pub fn get_scan_directory(&self, dir_path: &str) -> AppResult<Option<ScanDirectoryState>> {
        let conn = self.connection()?;

        let result = conn.query_row(
            "SELECT * FROM scan_directories WHERE dir_path = ?1",
            params![dir_path],
            row_to_scan_dir,
        );

        match result {
            Ok(state) => Ok(Some(state)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e)),
        }
    }

    /// 获取所有活跃的扫描目录
    pub fn get_all_scan_directories(&self) -> AppResult<Vec<ScanDirectoryState>> {
        let conn = self.connection()?;

        let mut stmt = conn.prepare(
            "SELECT * FROM scan_directories WHERE is_active = 1 ORDER BY dir_path",
        )?;

        let dirs = stmt
            .query_map([], row_to_scan_dir)?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(dirs)
    }

    /// 获取需要扫描的目录（next_scan_time <= 当前时间）
    pub fn get_directories_due_for_scan(&self) -> AppResult<Vec<ScanDirectoryState>> {
        let conn = self.connection()?;
        let now = chrono::Utc::now().to_rfc3339();

        let mut stmt = conn.prepare(
            r#"
            SELECT * FROM scan_directories
            WHERE is_active = 1
              AND (next_scan_time IS NULL OR next_scan_time <= ?1)
            ORDER BY next_scan_time ASC
            "#,
        )?;

        let dirs = stmt
            .query_map(params![now], row_to_scan_dir)?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(dirs)
    }

    /// 更新扫描结果（根据是否有变化调整阶梯频率）
    pub fn update_scan_result(
        &self,
        dir_path: &str,
        has_changes: bool,
        new_file_count: i64,
        base_interval_secs: u64,
    ) -> AppResult<i32> {
        let conn = self.connection()?;
        let now = chrono::Utc::now();
        let now_str = now.to_rfc3339();

        // 获取当前状态
        let current: Option<(i32, i32)> = conn
            .query_row(
                "SELECT no_change_count, scan_multiplier FROM scan_directories WHERE dir_path = ?1",
                params![dir_path],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();

        let (no_change_count, _scan_multiplier) = current.unwrap_or((0, 1));

        // 计算新的状态
        let (new_no_change_count, new_multiplier) = if has_changes {
            // 有变化，重置为 x1
            (0, 1)
        } else {
            // 无变化，递增计数并计算新倍率
            let new_count = no_change_count + 1;
            let new_mult = calculate_multiplier(new_count);
            (new_count, new_mult)
        };

        // 计算下次扫描时间
        let interval_secs = base_interval_secs * new_multiplier as u64;
        let next_scan = now + chrono::Duration::seconds(interval_secs as i64);
        let next_scan_str = next_scan.to_rfc3339();

        // 更新数据库
        conn.execute(
            r#"
            UPDATE scan_directories SET
                last_scan = ?1,
                last_change_time = CASE WHEN ?2 THEN ?1 ELSE last_change_time END,
                no_change_count = ?3,
                scan_multiplier = ?4,
                next_scan_time = ?5,
                file_count = ?6
            WHERE dir_path = ?7
            "#,
            params![
                now_str,
                has_changes,
                new_no_change_count,
                new_multiplier,
                next_scan_str,
                new_file_count,
                dir_path
            ],
        )?;

        Ok(new_multiplier)
    }

    /// 重置扫描频率为 x1
    pub fn reset_scan_frequency(&self, dir_path: &str) -> AppResult<bool> {
        let conn = self.connection()?;

        let rows = conn.execute(
            r#"
            UPDATE scan_directories SET
                no_change_count = 0,
                scan_multiplier = 1,
                next_scan_time = NULL
            WHERE dir_path = ?1
            "#,
            params![dir_path],
        )?;

        Ok(rows > 0)
    }

    /// 设置目录的下次扫描时间
    pub fn set_next_scan_time(&self, dir_path: &str, next_scan_time: &str) -> AppResult<bool> {
        let conn = self.connection()?;

        let rows = conn.execute(
            "UPDATE scan_directories SET next_scan_time = ?1 WHERE dir_path = ?2",
            params![next_scan_time, dir_path],
        )?;

        Ok(rows > 0)
    }

    /// 标记目录为非活跃
    pub fn deactivate_scan_directory(&self, dir_path: &str) -> AppResult<bool> {
        let conn = self.connection()?;

        let rows = conn.execute(
            "UPDATE scan_directories SET is_active = 0 WHERE dir_path = ?1",
            params![dir_path],
        )?;

        Ok(rows > 0)
    }
}

/// 根据连续无变化次数计算扫描倍率（保守方案）
/// - 0-4 次: x1
/// - 5-9 次: x2
/// - 10-14 次: x4
/// - 15+ 次: x8 (最大)
fn calculate_multiplier(no_change_count: i32) -> i32 {
    match no_change_count {
        0..=4 => 1,
        5..=9 => 2,
        10..=14 => 4,
        _ => 8,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_multiplier() {
        assert_eq!(calculate_multiplier(0), 1);
        assert_eq!(calculate_multiplier(4), 1);
        assert_eq!(calculate_multiplier(5), 2);
        assert_eq!(calculate_multiplier(9), 2);
        assert_eq!(calculate_multiplier(10), 4);
        assert_eq!(calculate_multiplier(14), 4);
        assert_eq!(calculate_multiplier(15), 8);
        assert_eq!(calculate_multiplier(100), 8);
    }
}
