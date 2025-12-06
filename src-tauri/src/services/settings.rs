//! 应用程序设置服务
//!
//! 负责设置的读取、保存和管理

use crate::models::AppSettings;
use crate::utils::error::AppError;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// 设置管理器
pub struct SettingsManager {
    settings_path: PathBuf,
}

impl SettingsManager {
    /// 创建新的设置管理器
    pub fn new(app: &AppHandle) -> Result<Self, AppError> {
        // 获取应用数据目录
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| AppError::Config(format!("无法获取应用数据目录: {}", e)))?;

        // 确保目录存在
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| AppError::Config(format!("无法创建应用数据目录: {}", e)))?;

        let settings_path = app_data_dir.join("settings.json");

        Ok(Self { settings_path })
    }

    /// 加载设置
    pub fn load(&self) -> Result<AppSettings, AppError> {
        // 如果文件不存在，返回默认设置
        if !self.settings_path.exists() {
            tracing::info!("设置文件不存在，使用默认设置");
            return Ok(AppSettings::default());
        }

        // 读取文件
        let content = fs::read_to_string(&self.settings_path)
            .map_err(|e| AppError::Config(format!("无法读取设置文件: {}", e)))?;

        // 解析 JSON
        let settings: AppSettings = serde_json::from_str(&content)
            .map_err(|e| AppError::Config(format!("设置文件格式错误: {}", e)))?;

        tracing::info!("成功加载设置: {:?}", self.settings_path);
        Ok(settings)
    }

    /// 保存设置
    pub fn save(&self, settings: &AppSettings) -> Result<(), AppError> {
        // 序列化为 JSON（格式化输出）
        let content = serde_json::to_string_pretty(settings)
            .map_err(|e| AppError::Config(format!("无法序列化设置: {}", e)))?;

        // 写入文件
        fs::write(&self.settings_path, content)
            .map_err(|e| AppError::Config(format!("无法保存设置文件: {}", e)))?;

        tracing::info!("成功保存设置: {:?}", self.settings_path);
        Ok(())
    }

    /// 重置为默认设置
    pub fn reset(&self) -> Result<AppSettings, AppError> {
        let default_settings = AppSettings::default();
        self.save(&default_settings)?;
        Ok(default_settings)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ThemeMode;
    use std::env;

    #[test]
    fn test_default_settings() {
        let settings = AppSettings::default();
        assert_eq!(settings.theme, ThemeMode::System);
        assert_eq!(settings.language, "zh-CN");
        assert!(settings.thumbnail.auto_cleanup);
    }

    #[test]
    fn test_settings_serialization() {
        let settings = AppSettings::default();
        let json = serde_json::to_string(&settings).unwrap();
        let deserialized: AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(settings.theme, deserialized.theme);
    }
}
