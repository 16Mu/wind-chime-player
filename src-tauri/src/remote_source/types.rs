use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncRead;
use anyhow::Result;

/// 远程源类型 (仅支持WebDAV)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RemoteSourceType {
    WebDAV,
}

impl std::fmt::Display for RemoteSourceType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RemoteSourceType::WebDAV => write!(f, "webdav"),
        }
    }
}

/// 统一的远程文件信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteFileInfo {
    pub path: String,
    pub name: String,
    pub is_directory: bool,
    pub size: Option<u64>,
    pub mime_type: Option<String>,
    pub last_modified: Option<i64>,
    pub etag: Option<String>,
    pub source_type: RemoteSourceType,
}

/// 连接状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConnectionStatus {
    Unknown,
    Connecting,
    Connected,
    Disconnected,
    Error(String),
}

/// 健康状态
#[derive(Debug, Clone, Serialize)]
pub struct HealthStatus {
    pub is_healthy: bool,
    pub last_check: i64,
    pub error_count: u32,
    pub connection_status: ConnectionStatus,
}

/// 远程源客户端统一接口
#[async_trait]
pub trait RemoteSourceClient: Send + Sync {
    /// 测试连接
    async fn test_connection(&self) -> Result<ConnectionStatus>;
    
    /// 列出目录
    async fn list_directory(&self, path: &str) -> Result<Vec<RemoteFileInfo>>;
    
    /// 获取文件信息
    async fn get_file_info(&self, path: &str) -> Result<RemoteFileInfo>;
    
    /// 下载文件流
    async fn download_stream(&self, path: &str) -> Result<Box<dyn AsyncRead + Send + Unpin>>;
    
    /// 范围下载
    async fn download_range(&self, path: &str, start: u64, end: Option<u64>) 
        -> Result<Box<dyn AsyncRead + Send + Unpin>>;
    
    /// 获取健康状态
    fn get_health(&self) -> HealthStatus;
    
    /// 获取源类型
    fn get_source_type(&self) -> RemoteSourceType;
}











