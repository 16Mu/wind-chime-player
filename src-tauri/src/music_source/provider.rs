// 音乐源提供器实现 - 高内聚：专注于不同类型音乐源的具体实现

use super::*;
use std::path::Path;
use tokio::fs::File;
use tokio::io::BufReader;
use std::sync::Arc;
use lofty::prelude::*; // 导入lofty的prelude以获取必要的trait

/// 🎵 本地音乐源提供器 - 单一职责：处理本地文件
pub struct LocalMusicProvider;

#[async_trait]
impl MusicSourceProvider for LocalMusicProvider {
    async fn create_stream(&self, source: &MusicSource) -> Result<Box<dyn AsyncRead + Send + Unpin>> {
        match source {
            MusicSource::Local { path } => {
                let file = File::open(path).await?;
                Ok(Box::new(BufReader::new(file)))
            },
            MusicSource::Cached { local_cache_path, .. } => {
                let file = File::open(local_cache_path).await?;
                Ok(Box::new(BufReader::new(file)))
            },
            _ => Err(anyhow::anyhow!("LocalMusicProvider只支持本地和缓存源")),
        }
    }

    async fn get_metadata(&self, source: &MusicSource) -> Result<AudioMetadata> {
        let file_path = match source {
            MusicSource::Local { path } => path,
            MusicSource::Cached { local_cache_path, .. } => local_cache_path,
            _ => return Err(anyhow::anyhow!("不支持的音乐源类型")),
        };

        // 使用lofty库提取音频元数据 - 基于现有代码的正确模式
        let tagged_file = lofty::read_from_path(file_path)?;
        let properties = tagged_file.properties();
        let tag = tagged_file.primary_tag();

        let metadata = AudioMetadata {
            title: tag.and_then(|t| t.title().map(|s| s.to_string())),
            artist: tag.and_then(|t| t.artist().map(|s| s.to_string())),
            album: tag.and_then(|t| t.album().map(|s| s.to_string())),
            duration_ms: Some(properties.duration().as_millis() as u64),
            sample_rate: properties.sample_rate(),
            channels: properties.channels().map(|c| c as u16),
            bit_rate: properties.overall_bitrate(),
            file_size: std::fs::metadata(file_path).ok().map(|m| m.len()),
            format: Some(format!("{:?}", tagged_file.file_type())),
            last_modified: std::fs::metadata(file_path).ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64),
            file_hash: None, // 按需计算
        };

        Ok(metadata)
    }

    async fn exists(&self, source: &MusicSource) -> Result<bool> {
        let path = match source {
            MusicSource::Local { path } => path,
            MusicSource::Cached { local_cache_path, .. } => local_cache_path,
            _ => return Ok(false),
        };
        
        Ok(Path::new(path).exists())
    }

    async fn get_file_size(&self, source: &MusicSource) -> Result<u64> {
        let path = match source {
            MusicSource::Local { path } => path,
            MusicSource::Cached { local_cache_path, .. } => local_cache_path,
            _ => return Err(anyhow::anyhow!("不支持的音乐源类型")),
        };
        
        let metadata = std::fs::metadata(path)?;
        Ok(metadata.len())
    }

    fn supports_range_requests(&self) -> bool {
        true // 本地文件支持范围读取
    }

    async fn create_range_stream(
        &self,
        source: &MusicSource,
        start: u64,
        end: Option<u64>
    ) -> Result<Box<dyn AsyncRead + Send + Unpin>> {
        // 本地文件的范围读取实现
        match source {
            MusicSource::Local { path } | MusicSource::Cached { local_cache_path: path, .. } => {
                let mut file = File::open(path).await?;
                use tokio::io::{AsyncSeekExt, SeekFrom};
                
                file.seek(SeekFrom::Start(start)).await?;
                
                if let Some(end_pos) = end {
                    let length = end_pos.saturating_sub(start) + 1;
                    use tokio::io::AsyncReadExt;
                    Ok(Box::new(file.take(length)))
                } else {
                    Ok(Box::new(file))
                }
            },
            _ => Err(anyhow::anyhow!("不支持的音乐源类型")),
        }
    }
}

/// 🎵 WebDAV音乐源提供器 - 单一职责：处理WebDAV远程文件
pub struct WebDAVMusicProvider {
    // 注入WebDAV客户端依赖 - 低耦合设计
    webdav_client: Arc<dyn WebDAVClientTrait>,
}

// WebDAV客户端trait - 低耦合：定义清晰接口边界
#[async_trait]
pub trait WebDAVClientTrait: Send + Sync {
    async fn download_stream(&self, url: &str) -> Result<Box<dyn AsyncRead + Send + Unpin>>;
    async fn download_range(&self, url: &str, start: u64, end: Option<u64>) -> Result<Box<dyn AsyncRead + Send + Unpin>>;
    async fn get_file_info(&self, url: &str) -> Result<RemoteFileInfo>;
    async fn file_exists(&self, url: &str) -> Result<bool>;
}

#[derive(Debug, Clone)]
pub struct RemoteFileInfo {
    pub size: u64,
    pub last_modified: i64,
    pub content_type: Option<String>,
    pub etag: Option<String>,
}

impl WebDAVMusicProvider {
    pub fn new(webdav_client: Arc<dyn WebDAVClientTrait>) -> Self {
        Self { webdav_client }
    }
}

#[async_trait]
impl MusicSourceProvider for WebDAVMusicProvider {
    async fn create_stream(&self, source: &MusicSource) -> Result<Box<dyn AsyncRead + Send + Unpin>> {
        match source {
            MusicSource::WebDAV { url, .. } => {
                self.webdav_client.download_stream(url).await
            },
            _ => Err(anyhow::anyhow!("WebDAVMusicProvider只支持WebDAV源")),
        }
    }

    async fn get_metadata(&self, source: &MusicSource) -> Result<AudioMetadata> {
        match source {
            MusicSource::WebDAV { url, .. } => {
                let file_info = self.webdav_client.get_file_info(url).await?;
                
                // 对于远程文件，我们只能获取基本信息
                // 详细的音频元数据需要下载部分文件来解析
                Ok(AudioMetadata {
                    title: None, // 需要下载文件头来获取
                    artist: None,
                    album: None,
                    duration_ms: None,
                    sample_rate: None,
                    channels: None,
                    bit_rate: None,
                    file_size: Some(file_info.size),
                    format: file_info.content_type,
                    last_modified: Some(file_info.last_modified),
                    file_hash: file_info.etag,
                })
            },
            _ => Err(anyhow::anyhow!("不支持的音乐源类型")),
        }
    }

    async fn exists(&self, source: &MusicSource) -> Result<bool> {
        match source {
            MusicSource::WebDAV { url, .. } => {
                self.webdav_client.file_exists(url).await
            },
            _ => Ok(false),
        }
    }

    async fn get_file_size(&self, source: &MusicSource) -> Result<u64> {
        match source {
            MusicSource::WebDAV { url, .. } => {
                let file_info = self.webdav_client.get_file_info(url).await?;
                Ok(file_info.size)
            },
            _ => Err(anyhow::anyhow!("不支持的音乐源类型")),
        }
    }

    fn supports_range_requests(&self) -> bool {
        true // WebDAV支持Range请求
    }

    async fn create_range_stream(
        &self,
        source: &MusicSource,
        start: u64,
        end: Option<u64>
    ) -> Result<Box<dyn AsyncRead + Send + Unpin>> {
        match source {
            MusicSource::WebDAV { url, .. } => {
                self.webdav_client.download_range(url, start, end).await
            },
            _ => Err(anyhow::anyhow!("不支持的音乐源类型")),
        }
    }
}
