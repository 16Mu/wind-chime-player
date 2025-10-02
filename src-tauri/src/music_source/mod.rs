// 音乐源抽象层 - 高内聚：统一管理所有音乐源类型和操作
// 低耦合：通过trait定义清晰的接口边界

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
// use std::io::Result as IoResult; // 暂时未使用
use tokio::io::AsyncRead;
use anyhow::Result;

pub mod types;
pub mod provider;
pub mod manager;

pub use types::*;
// pub use provider::*; // 暂时注释，避免未使用警告
// pub use manager::*; // 暂时注释，避免未使用警告

/// 🎵 音乐源类型定义 - 单一职责：定义音乐来源
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MusicSource {
    /// 本地文件系统
    Local { 
        path: String 
    },
    /// WebDAV远程源
    WebDAV { 
        server_id: String,
        remote_path: String,
        url: String 
    },
    /// 缓存源（本地缓存的远程文件）
    Cached { 
        original_source: Box<MusicSource>,
        local_cache_path: String,
        cache_expiry: Option<i64>,
    },
}

/// 🎵 音频元数据 - 单一职责：音频文件信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration_ms: Option<u64>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u16>,
    pub bit_rate: Option<u32>,
    pub file_size: Option<u64>,
    pub format: Option<String>,
    pub last_modified: Option<i64>,
    pub file_hash: Option<String>,
}

/// 🎵 音乐源提供器接口 - 低耦合：清晰的抽象接口
#[async_trait]
pub trait MusicSourceProvider: Send + Sync {
    /// 创建音频流
    async fn create_stream(&self, source: &MusicSource) -> Result<Box<dyn AsyncRead + Send + Unpin>>;
    
    /// 获取音频元数据
    async fn get_metadata(&self, source: &MusicSource) -> Result<AudioMetadata>;
    
    /// 检查文件是否存在
    async fn exists(&self, source: &MusicSource) -> Result<bool>;
    
    /// 获取文件大小
    async fn get_file_size(&self, source: &MusicSource) -> Result<u64>;
    
    /// 检查是否支持范围请求（streaming）
    fn supports_range_requests(&self) -> bool;
    
    /// 创建范围流（用于seek支持）
    async fn create_range_stream(
        &self, 
        source: &MusicSource, 
        start: u64, 
        end: Option<u64>
    ) -> Result<Box<dyn AsyncRead + Send + Unpin>>;
}

/// 🎵 音乐源能力标识 - 单一职责：描述音乐源的能力
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceCapabilities {
    pub can_stream: bool,
    pub can_seek: bool,
    pub can_cache: bool,
    pub requires_network: bool,
    pub supports_metadata: bool,
}

impl MusicSource {
    /// 获取音乐源的类型标识
    pub fn source_type(&self) -> &'static str {
        match self {
            MusicSource::Local { .. } => "local",
            MusicSource::WebDAV { .. } => "webdav", 
            MusicSource::Cached { .. } => "cached",
        }
    }
    
    /// 获取音乐源的唯一标识
    pub fn get_unique_id(&self) -> String {
        match self {
            MusicSource::Local { path } => format!("local:{}", path),
            MusicSource::WebDAV { server_id, remote_path, .. } => {
                format!("webdav:{}:{}", server_id, remote_path)
            },
            MusicSource::Cached { original_source, .. } => {
                format!("cached:{}", original_source.get_unique_id())
            },
        }
    }
    
    /// 获取音乐源能力
    pub fn get_capabilities(&self) -> SourceCapabilities {
        match self {
            MusicSource::Local { .. } => SourceCapabilities {
                can_stream: true,
                can_seek: true,
                can_cache: false, // 已经是本地
                requires_network: false,
                supports_metadata: true,
            },
            MusicSource::WebDAV { .. } => SourceCapabilities {
                can_stream: true,
                can_seek: true, // 通过Range请求
                can_cache: true,
                requires_network: true,
                supports_metadata: true,
            },
            MusicSource::Cached { .. } => SourceCapabilities {
                can_stream: true,
                can_seek: true,
                can_cache: false, // 已经缓存
                requires_network: false, // 使用本地缓存
                supports_metadata: true,
            },
        }
    }
}
