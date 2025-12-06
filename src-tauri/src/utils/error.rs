//! PhotoWall 错误处理模块
//!
//! 定义应用程序错误类型

use serde::Serialize;
use thiserror::Error;

/// 应用程序错误类型
#[derive(Debug, Error)]
pub enum AppError {
    /// 数据库错误
    #[error("数据库错误: {0}")]
    Database(#[from] rusqlite::Error),

    /// IO 错误
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),

    /// 图像处理错误
    #[error("图像处理错误: {0}")]
    Image(#[from] image::ImageError),

    /// 路径无效
    #[error("路径无效: {0}")]
    InvalidPath(String),

    /// 文件未找到
    #[error("文件未找到: {0}")]
    FileNotFound(String),

    /// 不支持的格式
    #[error("不支持的格式: {0}")]
    UnsupportedFormat(String),

    /// 权限错误
    #[error("权限错误: {0}")]
    Permission(String),

    /// 配置错误
    #[error("配置错误: {0}")]
    Config(String),

    /// 通用错误
    #[error("{0}")]
    General(String),
}

/// 用于 Tauri 命令返回的错误包装
#[derive(Debug, Serialize)]
pub struct CommandError {
    pub code: String,
    pub message: String,
}

impl From<AppError> for CommandError {
    fn from(err: AppError) -> Self {
        let code = match &err {
            AppError::Database(_) => "E_DB_ERROR",
            AppError::Io(_) => "E_IO_ERROR",
            AppError::Image(_) => "E_IMAGE_ERROR",
            AppError::InvalidPath(_) => "E_PATH_INVALID",
            AppError::FileNotFound(_) => "E_FILE_NOT_FOUND",
            AppError::UnsupportedFormat(_) => "E_UNSUPPORTED_FORMAT",
            AppError::Permission(_) => "E_PERMISSION",
            AppError::Config(_) => "E_CONFIG",
            AppError::General(_) => "E_GENERAL",
        };

        CommandError {
            code: code.to_string(),
            message: err.to_string(),
        }
    }
}

// 实现 Serialize 以便可以通过 Tauri 命令返回
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let cmd_error = CommandError::from(AppError::General(self.to_string()));
        cmd_error.serialize(serializer)
    }
}

/// 应用程序结果类型别名
pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = AppError::FileNotFound("test.jpg".to_string());
        assert_eq!(err.to_string(), "文件未找到: test.jpg");
    }

    #[test]
    fn test_command_error_conversion() {
        let err = AppError::InvalidPath("/invalid/path".to_string());
        let cmd_err: CommandError = err.into();
        assert_eq!(cmd_err.code, "E_PATH_INVALID");
    }
}
