// FTP类型定义
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// FTP操作结果类型
pub type FTPResult<T> = Result<T, FTPError>;

/// FTP错误类型
#[derive(Debug, Error)]
pub enum FTPError {
    #[error("连接错误: {0}")]
    ConnectionError(String),
    
    #[error("认证失败: {0}")]
    AuthenticationFailed(String),
    
    #[error("文件未找到: {path}")]
    FileNotFound { path: String },
    
    #[error("权限不足")]
    PermissionDenied,
    
    #[error("超时")]
    Timeout,
    
    #[error("IO错误: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("FTP错误: {0}")]
    FtpError(String),
}

/// FTP服务器配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FTPConfig {
    pub server_id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub use_tls: bool,
    pub timeout_seconds: u64,
}

impl Default for FTPConfig {
    fn default() -> Self {
        Self {
            server_id: String::new(),
            name: String::new(),
            host: String::new(),
            port: 21,
            username: String::new(),
            password: String::new(),
            use_tls: false,
            timeout_seconds: 30,
        }
    }
}

/// FTP文件信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FTPFileInfo {
    pub path: String,
    pub name: String,
    pub is_directory: bool,
    pub size: Option<u64>,
    pub modified: Option<i64>,
}

/// FTP目录列表
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FTPDirectoryListing {
    pub path: String,
    pub files: Vec<FTPFileInfo>,
    pub total_count: usize,
}

impl FTPConfig {
    pub fn validate(&self) -> FTPResult<()> {
        if self.host.is_empty() {
            return Err(FTPError::ConnectionError("主机地址不能为空".to_string()));
        }
        if self.username.is_empty() {
            return Err(FTPError::AuthenticationFailed("用户名不能为空".to_string()));
        }
        Ok(())
    }
}

