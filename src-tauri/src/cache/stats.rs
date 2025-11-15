// 缓存统计

use serde::{Deserialize, Serialize};

/// 缓存统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    /// 缓存文件数量
    pub file_count: u32,
    
    /// 总缓存大小（MB）
    pub total_size_mb: f64,
    
    /// 已使用空间百分比
    pub usage_percent: f64,
    
    /// 命中率（最近100次播放）
    pub hit_rate: f64,
    
    /// 节省的流量（MB）
    pub saved_bandwidth_mb: f64,
    
    /// 高优先级缓存数量
    pub high_priority_count: u32,
    
    /// 中优先级缓存数量
    pub medium_priority_count: u32,
    
    /// 低优先级缓存数量
    pub low_priority_count: u32,
}

impl Default for CacheStats {
    fn default() -> Self {
        Self {
            file_count: 0,
            total_size_mb: 0.0,
            usage_percent: 0.0,
            hit_rate: 0.0,
            saved_bandwidth_mb: 0.0,
            high_priority_count: 0,
            medium_priority_count: 0,
            low_priority_count: 0,
        }
    }
}

impl CacheStats {
    /// 计算使用百分比
    pub fn calculate_usage(&mut self, max_size_mb: u64) {
        if max_size_mb > 0 {
            self.usage_percent = (self.total_size_mb / max_size_mb as f64) * 100.0;
        }
    }
}






