// 缓存配置

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// 音频质量
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum CacheQuality {
    /// 源质量（无损）
    Source,
    /// 高质量（320kbps）
    High,
    /// 中等质量（192kbps，节省空间）
    Medium,
}

/// 清理策略
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupPolicy {
    /// 自动清理N天未播放的缓存
    pub auto_cleanup_days: u32,
    /// 存储不足时自动清理
    pub cleanup_on_low_storage: bool,
    /// 低存储阈值（百分比）
    pub low_storage_threshold: u8,
}

impl Default for CleanupPolicy {
    fn default() -> Self {
        Self {
            auto_cleanup_days: 30,
            cleanup_on_low_storage: true,
            low_storage_threshold: 90,
        }
    }
}

/// 缓存配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    /// 是否启用缓存
    pub enabled: bool,
    
    /// 缓存路径（用户可自定义）
    pub cache_path: PathBuf,
    
    /// 最大缓存大小（MB）
    pub max_size_mb: u64,
    
    /// 自动缓存收藏的歌曲
    pub auto_cache_favorites: bool,
    
    /// 仅在WiFi下缓存
    pub wifi_only_cache: bool,
    
    /// 缓存音质
    pub cache_quality: CacheQuality,
    
    /// 播放N次后缓存（智能缓存）
    pub min_play_count: u32,
    
    /// 缓存最近N天播放的歌曲
    pub cache_recent_days: u32,
    
    /// 清理策略
    pub cleanup_policy: CleanupPolicy,
    
    /// 预加载下一首
    pub preload_next: bool,
}

impl Default for CacheConfig {
    fn default() -> Self {
        // 默认缓存路径：应用数据目录/cache
        let cache_path = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("WindChimePlayer")
            .join("cache");
        
        Self {
            enabled: true,
            cache_path,
            max_size_mb: 2048,  // 默认2GB
            auto_cache_favorites: true,
            wifi_only_cache: false,
            cache_quality: CacheQuality::Source,
            min_play_count: 2,
            cache_recent_days: 7,
            cleanup_policy: CleanupPolicy::default(),
            preload_next: true,
        }
    }
}

impl CacheConfig {
    /// 从JSON字符串加载配置
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
    
    /// 转换为JSON字符串
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }
    
    /// 验证配置
    pub fn validate(&self) -> Result<(), String> {
        if self.max_size_mb < 100 {
            return Err("缓存大小至少100MB".to_string());
        }
        
        if self.max_size_mb > 100_000 {
            return Err("缓存大小不能超过100GB".to_string());
        }
        
        Ok(())
    }
    
    /// 获取缓存路径（确保目录存在）
    pub fn ensure_cache_dir(&self) -> Result<PathBuf, std::io::Error> {
        std::fs::create_dir_all(&self.cache_path)?;
        Ok(self.cache_path.clone())
    }
}






