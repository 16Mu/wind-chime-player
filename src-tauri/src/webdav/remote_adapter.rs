// WebDAV远程源适配器 - 实现RemoteSourceClient trait
use super::{WebDAVClient, types::*};
use crate::remote_source::{RemoteSourceClient, RemoteFileInfo, RemoteSourceType, ConnectionStatus, HealthStatus};
use async_trait::async_trait;
use anyhow::Result;
use tokio::io::AsyncRead;

/// WebDAV远程源适配器
pub struct WebDAVRemoteAdapter {
    client: WebDAVClient,
}

impl WebDAVRemoteAdapter {
    pub fn new(client: WebDAVClient) -> Self {
        Self { client }
    }
}

#[async_trait]
impl RemoteSourceClient for WebDAVRemoteAdapter {
    async fn test_connection(&self) -> Result<ConnectionStatus> {
        match self.client.test_connection().await {
            Ok(_) => Ok(ConnectionStatus::Connected),
            Err(e) => Ok(ConnectionStatus::Error(e.to_string())),
        }
    }

    async fn list_directory(&self, path: &str) -> Result<Vec<RemoteFileInfo>> {
        let listing = self.client.list_directory(path).await?;
        
        log::info!("🔍 WebDAV 返回 {} 个原始项目用于路径: '{}'", listing.files.len(), path);
        
        // 规范化路径用于比较（去除末尾斜杠）
        let normalized_request_path = path.trim_end_matches('/');
        
        // 过滤掉父目录本身（WebDAV PROPFIND 通常会返回当前目录）
        let files: Vec<RemoteFileInfo> = listing.files.into_iter()
            .filter_map(|f| {
                let file_path_normalized = f.path.trim_end_matches('/');
                
                log::info!("  📄 检查项目: name='{}', path='{}', is_dir={}, size={:?}", 
                    f.name, f.path, f.is_directory, f.size);
                
                // 跳过父目录本身
                if file_path_normalized == normalized_request_path {
                    log::info!("    ✂️ 这是父目录本身，过滤掉");
                    return None;
                }
                
                log::info!("    ✅ 保留此项目");
                
                Some(RemoteFileInfo {
                    path: f.path,
                    name: f.name,
                    is_directory: f.is_directory,
                    size: f.size,
                    mime_type: f.content_type,
                    last_modified: f.last_modified,
                    etag: f.etag,
                    source_type: RemoteSourceType::WebDAV,
                })
            })
            .collect();
        
        log::info!("📁 目录 '{}' 最终结果: {} 个项目", path, files.len());
        Ok(files)
    }

    async fn get_file_info(&self, path: &str) -> Result<RemoteFileInfo> {
        let info = self.client.get_file_info(path).await?;
        
        Ok(RemoteFileInfo {
            path: info.path,
            name: info.name,
            is_directory: info.is_directory,
            size: info.size,
            mime_type: info.content_type,
            last_modified: info.last_modified,
            etag: info.etag,
            source_type: RemoteSourceType::WebDAV,
        })
    }

    async fn download_stream(&self, path: &str) -> Result<Box<dyn AsyncRead + Send + Unpin>> {
        let stream = self.client.download_stream(path).await?;
        
        use crate::webdav::safe_stream::{SafeWebDAVStream, SafeStreamConfig};
        let safe_stream = SafeWebDAVStream::from_webdav_stream(stream, SafeStreamConfig::default());
        
        Ok(Box::new(safe_stream))
    }

    async fn download_range(&self, path: &str, start: u64, end: Option<u64>) 
        -> Result<Box<dyn AsyncRead + Send + Unpin>> {
        let range = RangeRequest { start, end };
        let stream = self.client.download_range(path, range).await?;
        
        use crate::webdav::safe_stream::{SafeWebDAVStream, SafeStreamConfig};
        let safe_stream = SafeWebDAVStream::from_webdav_stream(stream, SafeStreamConfig::default());
        
        Ok(Box::new(safe_stream))
    }

    fn get_health(&self) -> HealthStatus {
        HealthStatus {
            is_healthy: true,
            last_check: chrono::Utc::now().timestamp(),
            error_count: 0,
            connection_status: ConnectionStatus::Connected,
        }
    }

    fn get_source_type(&self) -> RemoteSourceType {
        RemoteSourceType::WebDAV
    }
}




