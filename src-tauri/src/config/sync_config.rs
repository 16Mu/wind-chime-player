// 同步配置管理 - 高内聚：专门处理同步相关的配置
// 低耦合：独立的同步策略和行为配置

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::Datelike;

/// 🔄 同步配置 - 单一职责：管理所有同步相关的配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    /// 是否启用自动同步
    pub auto_sync_enabled: bool,
    
    /// 自动同步间隔（秒）
    pub auto_sync_interval_seconds: u64,
    
    /// 同步策略
    pub sync_strategy: SyncStrategy,
    
    /// 冲突解决策略
    pub conflict_resolution: ConflictResolution,
    
    /// 批处理配置
    pub batch_processing: BatchProcessingConfig,
    
    /// 带宽限制配置
    pub bandwidth_limits: BandwidthLimitsConfig,
    
    /// 同步优先级配置
    pub priority: PriorityConfig,
    
    /// 健康检查配置
    pub health_check: HealthCheckConfig,
    
    /// 通知配置
    pub notifications: NotificationConfig,
    
    /// 每个服务器的特定配置
    pub server_specific: HashMap<String, ServerSyncConfig>,
}

/// 🔄 同步策略
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncStrategy {
    /// 完全同步（比较所有文件）
    Full,
    /// 增量同步（仅同步修改的文件）
    Incremental,
    /// 快速同步（基于文件大小和修改时间）
    Quick,
    /// 智能同步（基于文件指纹和元数据）
    Smart,
}

/// 🔄 冲突解决策略
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConflictResolution {
    /// 始终使用本地版本
    PreferLocal,
    /// 始终使用远程版本
    PreferRemote,
    /// 使用较新的版本
    PreferNewer,
    /// 使用较大的文件
    PreferLarger,
    /// 手动解决
    Manual,
    /// 保留两个版本
    KeepBoth,
}

/// 🔄 批处理配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessingConfig {
    /// 是否启用批处理
    pub enabled: bool,
    
    /// 批处理大小（文件数量）
    pub batch_size: usize,
    
    /// 批处理超时（秒）
    pub batch_timeout_seconds: u64,
    
    /// 最大并发批次
    pub max_concurrent_batches: usize,
    
    /// 失败重试策略
    pub retry_failed_items: bool,
}

/// 🔄 带宽限制配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BandwidthLimitsConfig {
    /// 是否启用带宽限制
    pub enabled: bool,
    
    /// 上传速度限制（字节/秒，0表示无限制）
    pub upload_limit_bytes_per_sec: u64,
    
    /// 下载速度限制（字节/秒，0表示无限制）
    pub download_limit_bytes_per_sec: u64,
    
    /// 是否在活跃使用时降低速度
    pub throttle_during_active_use: bool,
    
    /// 活跃使用时的速度倍数（0.0-1.0）
    pub active_use_multiplier: f64,
    
    /// 时间段限制
    pub time_based_limits: Vec<TimeBandwidthLimit>,
}

/// 🔄 时间段带宽限制
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeBandwidthLimit {
    /// 开始时间（24小时格式，如 "09:00"）
    pub start_time: String,
    
    /// 结束时间（24小时格式，如 "17:00"）
    pub end_time: String,
    
    /// 星期几（0=周日，1=周一...6=周六）
    pub days_of_week: Vec<u8>,
    
    /// 上传速度限制
    pub upload_limit_bytes_per_sec: u64,
    
    /// 下载速度限制
    pub download_limit_bytes_per_sec: u64,
}

/// 🔄 优先级配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriorityConfig {
    /// 高优先级文件模式
    pub high_priority_patterns: Vec<String>,
    
    /// 低优先级文件模式
    pub low_priority_patterns: Vec<String>,
    
    /// 基于文件大小的优先级
    pub size_based_priority: SizeBasedPriority,
    
    /// 基于文件类型的优先级
    pub type_based_priority: HashMap<String, u8>, // 文件扩展名 -> 优先级(0-2)
}

/// 🔄 基于大小的优先级配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SizeBasedPriority {
    /// 是否启用基于大小的优先级
    pub enabled: bool,
    
    /// 小文件阈值（字节）
    pub small_file_threshold: u64,
    
    /// 大文件阈值（字节）
    pub large_file_threshold: u64,
    
    /// 小文件优先级 (0-2)
    pub small_file_priority: u8,
    
    /// 中等文件优先级 (0-2)
    pub medium_file_priority: u8,
    
    /// 大文件优先级 (0-2)
    pub large_file_priority: u8,
}

/// 🔄 健康检查配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckConfig {
    /// 是否启用健康检查
    pub enabled: bool,
    
    /// 健康检查间隔（秒）
    pub interval_seconds: u64,
    
    /// 连续失败多少次后标记为不健康
    pub failure_threshold: u32,
    
    /// 连续成功多少次后恢复健康状态
    pub success_threshold: u32,
    
    /// 健康检查超时（秒）
    pub timeout_seconds: u64,
    
    /// 不健康时是否暂停同步
    pub pause_sync_when_unhealthy: bool,
}

/// 🔄 通知配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationConfig {
    /// 是否启用桌面通知
    pub desktop_notifications: bool,
    
    /// 是否显示同步开始通知
    pub notify_sync_start: bool,
    
    /// 是否显示同步完成通知
    pub notify_sync_complete: bool,
    
    /// 是否显示同步错误通知
    pub notify_sync_errors: bool,
    
    /// 是否显示冲突通知
    pub notify_conflicts: bool,
    
    /// 通知显示时间（秒）
    pub notification_duration_seconds: u64,
    
    /// 静默时间段
    pub quiet_hours: Option<QuietHours>,
}

/// 🔄 静默时间段配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuietHours {
    /// 开始时间（24小时格式，如 "22:00"）
    pub start_time: String,
    
    /// 结束时间（24小时格式，如 "08:00"）
    pub end_time: String,
    
    /// 应用于星期几（0=周日，1=周一...6=周六）
    pub days_of_week: Vec<u8>,
}

/// 🔄 服务器特定同步配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerSyncConfig {
    /// 是否为此服务器启用同步
    pub enabled: bool,
    
    /// 同步间隔（覆盖全局设置）
    pub sync_interval_seconds: Option<u64>,
    
    /// 冲突解决策略（覆盖全局设置）
    pub conflict_resolution: Option<ConflictResolution>,
    
    /// 带宽限制（覆盖全局设置）
    pub bandwidth_limits: Option<BandwidthLimitsConfig>,
    
    /// 最后同步时间
    pub last_sync_time: Option<i64>,
    
    /// 同步状态
    pub sync_status: ServerSyncStatus,
    
    /// 服务器特定的排除模式
    pub exclude_patterns: Vec<String>,
}

/// 🔄 服务器同步状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ServerSyncStatus {
    /// 从未同步
    Never,
    /// 同步中
    Syncing,
    /// 同步完成
    Complete,
    /// 同步失败
    Failed { error: String, failed_at: i64 },
    /// 已暂停
    Paused,
    /// 不健康（连接问题等）
    Unhealthy,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            auto_sync_enabled: false,
            auto_sync_interval_seconds: 15 * 60, // 15分钟
            sync_strategy: SyncStrategy::Smart,
            conflict_resolution: ConflictResolution::PreferNewer,
            batch_processing: BatchProcessingConfig::default(),
            bandwidth_limits: BandwidthLimitsConfig::default(),
            priority: PriorityConfig::default(),
            health_check: HealthCheckConfig::default(),
            notifications: NotificationConfig::default(),
            server_specific: HashMap::new(),
        }
    }
}

impl Default for BatchProcessingConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            batch_size: 10,
            batch_timeout_seconds: 300, // 5分钟
            max_concurrent_batches: 2,
            retry_failed_items: true,
        }
    }
}

impl Default for BandwidthLimitsConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            upload_limit_bytes_per_sec: 0, // 无限制
            download_limit_bytes_per_sec: 0, // 无限制
            throttle_during_active_use: true,
            active_use_multiplier: 0.5, // 活跃时降低到50%
            time_based_limits: Vec::new(),
        }
    }
}

impl Default for PriorityConfig {
    fn default() -> Self {
        let mut type_based_priority = HashMap::new();
        
        // 音频文件高优先级
        type_based_priority.insert("mp3".to_string(), 2);
        type_based_priority.insert("flac".to_string(), 2);
        type_based_priority.insert("wav".to_string(), 2);
        type_based_priority.insert("m4a".to_string(), 2);
        
        // 元数据文件中等优先级
        type_based_priority.insert("lrc".to_string(), 1);
        type_based_priority.insert("txt".to_string(), 1);
        
        // 临时文件低优先级
        type_based_priority.insert("tmp".to_string(), 0);
        type_based_priority.insert("bak".to_string(), 0);
        
        Self {
            high_priority_patterns: vec![
                "*.mp3".to_string(),
                "*.flac".to_string(),
                "playlist.m3u".to_string(),
            ],
            low_priority_patterns: vec![
                "*.tmp".to_string(),
                "*.log".to_string(),
                ".DS_Store".to_string(),
            ],
            size_based_priority: SizeBasedPriority {
                enabled: true,
                small_file_threshold: 1024 * 1024, // 1MB
                large_file_threshold: 50 * 1024 * 1024, // 50MB
                small_file_priority: 2, // 高优先级
                medium_file_priority: 1, // 中等优先级
                large_file_priority: 0, // 低优先级
            },
            type_based_priority,
        }
    }
}

impl Default for HealthCheckConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            interval_seconds: 5 * 60, // 5分钟
            failure_threshold: 3,
            success_threshold: 2,
            timeout_seconds: 30,
            pause_sync_when_unhealthy: true,
        }
    }
}

impl Default for NotificationConfig {
    fn default() -> Self {
        Self {
            desktop_notifications: true,
            notify_sync_start: false,
            notify_sync_complete: true,
            notify_sync_errors: true,
            notify_conflicts: true,
            notification_duration_seconds: 5,
            quiet_hours: Some(QuietHours {
                start_time: "22:00".to_string(),
                end_time: "08:00".to_string(),
                days_of_week: vec![0, 1, 2, 3, 4, 5, 6], // 每天
            }),
        }
    }
}

impl SyncConfig {
    /// 获取服务器特定配置
    pub fn get_server_config(&self, server_id: &str) -> Option<&ServerSyncConfig> {
        self.server_specific.get(server_id)
    }
    
    /// 获取或创建服务器特定配置
    pub fn get_or_create_server_config(&mut self, server_id: &str) -> &mut ServerSyncConfig {
        self.server_specific.entry(server_id.to_string())
            .or_insert_with(ServerSyncConfig::default)
    }
    
    /// 移除服务器配置
    pub fn remove_server_config(&mut self, server_id: &str) -> bool {
        self.server_specific.remove(server_id).is_some()
    }
    
    /// 获取文件优先级
    pub fn get_file_priority(&self, file_path: &str, file_size: u64) -> u8 {
        // 检查高优先级模式
        for pattern in &self.priority.high_priority_patterns {
            if self.matches_pattern(file_path, pattern) {
                return 2;
            }
        }
        
        // 检查低优先级模式
        for pattern in &self.priority.low_priority_patterns {
            if self.matches_pattern(file_path, pattern) {
                return 0;
            }
        }
        
        // 基于文件扩展名
        if let Some(ext) = std::path::Path::new(file_path).extension() {
            if let Some(ext_str) = ext.to_str() {
                if let Some(&priority) = self.priority.type_based_priority.get(ext_str) {
                    return priority;
                }
            }
        }
        
        // 基于文件大小
        if self.priority.size_based_priority.enabled {
            if file_size <= self.priority.size_based_priority.small_file_threshold {
                return self.priority.size_based_priority.small_file_priority;
            } else if file_size >= self.priority.size_based_priority.large_file_threshold {
                return self.priority.size_based_priority.large_file_priority;
            } else {
                return self.priority.size_based_priority.medium_file_priority;
            }
        }
        
        1 // 默认中等优先级
    }
    
    /// 检查是否在静默时间段
    pub fn is_quiet_hours(&self) -> bool {
        if let Some(quiet_hours) = &self.notifications.quiet_hours {
            let now = chrono::Local::now();
            let current_time = now.format("%H:%M").to_string();
            let current_weekday = now.weekday().num_days_from_sunday() as u8;
            
            if quiet_hours.days_of_week.contains(&current_weekday) {
                // 简单的时间比较，假设不跨天
                return current_time >= quiet_hours.start_time && current_time <= quiet_hours.end_time;
            }
        }
        false
    }
    
    /// 获取当前生效的带宽限制
    pub fn get_current_bandwidth_limits(&self) -> (u64, u64) {
        if !self.bandwidth_limits.enabled {
            return (0, 0); // 无限制
        }
        
        let mut upload_limit = self.bandwidth_limits.upload_limit_bytes_per_sec;
        let mut download_limit = self.bandwidth_limits.download_limit_bytes_per_sec;
        
        // 检查时间段限制
        let now = chrono::Local::now();
        let current_time = now.format("%H:%M").to_string();
        let current_weekday = now.weekday().num_days_from_sunday() as u8;
        
        for time_limit in &self.bandwidth_limits.time_based_limits {
            if time_limit.days_of_week.contains(&current_weekday) &&
               current_time >= time_limit.start_time &&
               current_time <= time_limit.end_time {
                upload_limit = time_limit.upload_limit_bytes_per_sec;
                download_limit = time_limit.download_limit_bytes_per_sec;
                break;
            }
        }
        
        // 活跃使用时的调整（这里需要从其他地方获取活跃状态）
        if self.bandwidth_limits.throttle_during_active_use {
            // TODO: 检查应用是否在活跃使用
            // 暂时假设不在活跃使用中
        }
        
        (upload_limit, download_limit)
    }
    
    /// 简单的通配符模式匹配
    fn matches_pattern(&self, text: &str, pattern: &str) -> bool {
        // 简化的通配符匹配
        let pattern_lower = pattern.to_lowercase();
        let text_lower = text.to_lowercase();
        
        if pattern_lower == "*" {
            return true;
        }
        
        if pattern_lower.contains('*') {
            let parts: Vec<&str> = pattern_lower.split('*').collect();
            if parts.len() == 2 {
                let prefix = parts[0];
                let suffix = parts[1];
                return text_lower.starts_with(prefix) && text_lower.ends_with(suffix);
            }
        }
        
        text_lower == pattern_lower
    }
}

impl Default for ServerSyncConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            sync_interval_seconds: None,
            conflict_resolution: None,
            bandwidth_limits: None,
            last_sync_time: None,
            sync_status: ServerSyncStatus::Never,
            exclude_patterns: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_default_sync_config() {
        let config = SyncConfig::default();
        assert!(!config.auto_sync_enabled);
        assert_eq!(config.auto_sync_interval_seconds, 15 * 60);
        assert!(matches!(config.sync_strategy, SyncStrategy::Smart));
    }
    
    #[test]
    fn test_file_priority() {
        let config = SyncConfig::default();
        
        // 测试基于扩展名的优先级
        assert_eq!(config.get_file_priority("song.mp3", 5000000), 2);
        assert_eq!(config.get_file_priority("temp.tmp", 1000), 0);
        
        // 测试基于大小的优先级
        assert_eq!(config.get_file_priority("small.unknown", 500000), 2); // 小文件
        assert_eq!(config.get_file_priority("large.unknown", 100000000), 0); // 大文件
    }
    
    #[test]
    fn test_server_config_management() {
        let mut config = SyncConfig::default();
        
        // 测试获取或创建配置
        let server_config = config.get_or_create_server_config("test_server");
        assert!(server_config.enabled);
        
        // 测试配置持久性
        assert!(config.get_server_config("test_server").is_some());
        
        // 测试移除配置
        assert!(config.remove_server_config("test_server"));
        assert!(config.get_server_config("test_server").is_none());
    }
}
