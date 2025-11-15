// WebDAV远程源适配器 - 实现RemoteSourceClient trait
use super::{WebDAVClient, types::*};
use crate::remote_source::{RemoteSourceClient, RemoteFileInfo, RemoteSourceType, ConnectionStatus, HealthStatus};
use async_trait::async_trait;
use anyhow::Result;
use tokio::io::AsyncRead;

/// WebDAV远程源适配器
pub struct WebDAVRemoteAdapter {
    client: WebDAVClient,
    config: WebDAVConfig,
}

impl WebDAVRemoteAdapter {
    pub fn new(client: WebDAVClient) -> Self {
        // 获取配置的克隆
        let config = client.get_config().clone();
        Self { client, config }
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
        use percent_encoding::percent_decode_str;
        
        let listing = self.client.list_directory(path).await?;
        
        let original_count = listing.files.len();
        log::info!("🔍 WebDAV 返回 {} 个原始项目用于路径: '{}'", original_count, path);
        
        // 🔧 修复中文路径：对请求路径进行 URL 解码和规范化
        let decoded_path = percent_decode_str(path)
            .decode_utf8()
            .unwrap_or_else(|_| std::borrow::Cow::Borrowed(path));
        
        // 🔧 构建完整的服务器路径用于比较（添加 mount_path）
        // 前端现在只发送相对路径（如 "/音乐测试"），我们需要加上 mount_path 来匹配服务器返回的路径
        let full_request_path = if !self.config.mount_path.is_empty() {
            let mount = self.config.mount_path.trim_matches('/');
            let clean_path = decoded_path.trim_start_matches('/');
            if clean_path.is_empty() {
                // 根目录
                format!("/{}", mount)
            } else {
                // 子目录
                format!("/{}/{}", mount, clean_path)
            }
        } else {
            decoded_path.to_string()
        };
        
        let normalized_request_path = full_request_path.trim_end_matches('/');
        log::info!("🔍 规范化的请求路径: '{}' (原始: '{}', mount_path: '{}')", 
            normalized_request_path, path, self.config.mount_path);
        
        // 过滤掉父目录本身（WebDAV PROPFIND 通常会返回当前目录）
        let files: Vec<RemoteFileInfo> = listing.files.into_iter()
            .filter_map(|f| {
                // 🔧 对文件路径也进行 URL 解码和规范化
                let decoded_file_path = percent_decode_str(&f.path)
                    .decode_utf8()
                    .unwrap_or_else(|_| std::borrow::Cow::Borrowed(&f.path));
                let file_path_normalized = decoded_file_path.trim_end_matches('/');
                
                log::info!("  📄 检查项目: name='{}', path='{}', is_dir={}, size={:?}", 
                    f.name, f.path, f.is_directory, f.size);
                log::info!("     解码后的路径: '{}'", decoded_file_path);
                log::info!("     规范化后的路径: '{}'", file_path_normalized);
                log::info!("     比较: '{}' == '{}' ? {}", file_path_normalized, normalized_request_path, 
                    file_path_normalized == normalized_request_path);
                
                // 跳过父目录本身
                if file_path_normalized == normalized_request_path {
                    log::info!("    ✂️ 这是父目录本身，过滤掉");
                    return None;
                }
                
                log::info!("    ✅ 保留此项目");
                
                // 🔧 去除路径中的 mount_path 前缀，返回相对路径给前端
                // 这样前端在进入子目录时，不会导致路径重复
                let relative_path = if !self.config.mount_path.is_empty() {
                    let mount = format!("/{}", self.config.mount_path.trim_matches('/'));
                    if f.path.starts_with(&mount) {
                        // 去除 mount_path 前缀
                        f.path.strip_prefix(&mount).unwrap_or(&f.path).to_string()
                    } else {
                        f.path.clone()
                    }
                } else {
                    f.path.clone()
                };
                
                log::info!("    📤 返回相对路径: '{}' (原始: '{}')", relative_path, f.path);
                
                Some(RemoteFileInfo {
                    path: relative_path,
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
        
        // 🚨 如果结果为空但原始返回有项目，这是个问题
        if files.is_empty() && original_count > 0 {
            log::error!("⚠️ 警告：WebDAV返回了{}个项目，但过滤后全部被删除！", original_count);
            log::error!("   这可能是路径匹配的bug。请求路径: '{}'", path);
        }
        
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




