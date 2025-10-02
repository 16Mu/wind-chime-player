// 音乐源相关类型定义 - 高内聚：统一管理所有相关数据结构

use serde::{Deserialize, Serialize};

/// 🎵 同步状态 - 单一职责：描述音乐文件的同步状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SyncStatus {
    /// 仅存在于本地
    LocalOnly,
    /// 仅存在于远程
    RemoteOnly,
    /// 已同步，记录最后同步时间
    Synced { last_sync: i64 },
    /// 存在冲突，需要用户决策
    Conflict { 
        local_modified: i64, 
        remote_modified: i64,
        conflict_type: ConflictType,
    },
    /// 正在同步中
    Syncing,
    /// 同步失败
    SyncError(String),
}

/// 🎵 冲突类型 - 单一职责：描述同步冲突的具体类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConflictType {
    /// 两边都被修改
    ModifiedBoth,
    /// 本地删除，远程修改
    LocalDeletedRemoteModified,
    /// 本地修改，远程删除
    LocalModifiedRemoteDeleted,
    /// 文件大小不同
    DifferentSize,
    /// 文件哈希不同
    DifferentHash,
}

/// 🎵 缓存状态 - 单一职责：描述文件的缓存状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CacheStatus {
    /// 未缓存
    None,
    /// 部分缓存（如音频文件的前几秒）
    Partial { 
        cached_bytes: u64,
        total_bytes: u64,
    },
    /// 完全缓存
    Cached {
        cached_at: i64,
        cache_path: String,
    },
    /// 缓存已过期
    Expired,
    /// 缓存中但正在更新
    Updating,
}

/// 🎵 扩展的Track结构 - 整合音乐源信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedTrack {
    pub id: i64,
    pub source: super::MusicSource,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration_ms: Option<i64>,
    pub album_cover_data: Option<Vec<u8>>,
    pub album_cover_mime: Option<String>,
    
    // 新增字段 - 支持混合模式
    pub sync_status: SyncStatus,
    pub cache_status: CacheStatus,
    pub source_capabilities: super::SourceCapabilities,
    
    // 元数据字段
    pub file_size: Option<u64>,
    pub bit_rate: Option<u32>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u16>,
    pub format: Option<String>,
    pub file_hash: Option<String>,
    
    // 时间戳
    pub created_at: i64,
    pub updated_at: i64,
    pub last_played_at: Option<i64>,
}

/// 🎵 音乐源操作结果 - 统一操作结果类型
#[derive(Debug, Clone, Serialize)]
pub enum SourceOperationResult {
    Success,
    Failed(String),
    NetworkError(String),
    AuthenticationRequired,
    FileNotFound,
    InsufficientPermissions,
    CacheExpired,
    Timeout,
}

/// 🎵 音乐源事件 - 事件驱动架构支持
#[derive(Debug, Clone, Serialize)]
pub enum MusicSourceEvent {
    /// 源可用性变化
    SourceAvailabilityChanged {
        source_id: String,
        is_available: bool,
    },
    /// 文件变化
    FileChanged {
        source: super::MusicSource,
        change_type: FileChangeType,
    },
    /// 同步状态变化
    SyncStatusChanged {
        track_id: i64,
        old_status: SyncStatus,
        new_status: SyncStatus,
    },
    /// 缓存状态变化
    CacheStatusChanged {
        track_id: i64,
        old_status: CacheStatus,
        new_status: CacheStatus,
    },
}

/// 🎵 文件变化类型
#[derive(Debug, Clone, Serialize)]
pub enum FileChangeType {
    Created,
    Modified,
    Deleted,
    Moved { old_path: String, new_path: String },
}

/// 🎵 音乐源统计信息
#[derive(Debug, Clone, Serialize)]
pub struct SourceStatistics {
    pub source_type: String,
    pub total_files: usize,
    pub total_size_bytes: u64,
    pub cached_files: usize,
    pub cached_size_bytes: u64,
    pub sync_pending: usize,
    pub sync_conflicts: usize,
    pub last_scan_time: Option<i64>,
    pub is_online: bool,
}

/// 🎵 音乐源配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MusicSourceConfig {
    pub source_id: String,
    pub source_type: String,
    pub display_name: String,
    pub enabled: bool,
    pub auto_sync: bool,
    pub cache_enabled: bool,
    pub cache_max_size_mb: Option<u64>,
    pub network_timeout_seconds: u32,
    pub retry_attempts: u32,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Default for SyncStatus {
    fn default() -> Self {
        SyncStatus::LocalOnly
    }
}

impl Default for CacheStatus {
    fn default() -> Self {
        CacheStatus::None
    }
}

impl SourceOperationResult {
    pub fn is_success(&self) -> bool {
        matches!(self, SourceOperationResult::Success)
    }
    
    pub fn is_network_error(&self) -> bool {
        matches!(self, SourceOperationResult::NetworkError(_))
    }
    
    pub fn requires_retry(&self) -> bool {
        matches!(self, 
            SourceOperationResult::NetworkError(_) | 
            SourceOperationResult::Timeout
        )
    }
}

impl CacheStatus {
    pub fn is_cached(&self) -> bool {
        matches!(self, CacheStatus::Cached { .. } | CacheStatus::Partial { .. })
    }
    
    pub fn cache_percentage(&self) -> f32 {
        match self {
            CacheStatus::Partial { cached_bytes, total_bytes } => {
                if *total_bytes > 0 {
                    (*cached_bytes as f32 / *total_bytes as f32) * 100.0
                } else {
                    0.0
                }
            },
            CacheStatus::Cached { .. } => 100.0,
            _ => 0.0,
        }
    }
}

