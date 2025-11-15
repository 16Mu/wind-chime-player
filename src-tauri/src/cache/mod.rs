// 智能音频缓存模块
// 支持：LRU策略、自定义路径、自动清理、智能预测

#![allow(dead_code)]  // 新模块，部分功能未使用

pub mod config;
pub mod manager;
pub mod lru;
pub mod stats;
pub mod progressive;

pub use config::CacheConfig;
pub use stats::CacheStats;

use serde::{Deserialize, Serialize};

/// 缓存策略
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CacheStrategy {
    /// 仅流式播放，不缓存
    StreamOnly,
    /// 智能缓存（推荐）
    Smart,
    /// 全部缓存
    CacheAll,
}

/// 缓存优先级
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum CachePriority {
    /// 低优先级：流式播放，不缓存
    Low = 0,
    /// 中优先级：根据播放频率决定
    Medium = 1,
    /// 高优先级：收藏、常听歌曲，始终缓存
    High = 2,
}

/// 缓存条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub track_id: i64,
    pub file_path: String,
    pub file_size: u64,
    pub priority: CachePriority,
    pub play_count: u32,
    pub last_played: i64,  // timestamp
    pub created_at: i64,
    pub last_accessed: i64,
}

impl CacheEntry {
    /// 计算缓存得分（用于LRU排序）
    pub fn score(&self) -> i64 {
        let now = chrono::Utc::now().timestamp();
        let age_days = (now - self.last_accessed) / 86400;
        
        // 得分 = 优先级权重 + 播放次数权重 - 时间惩罚
        let priority_score = (self.priority as i64) * 1000;
        let play_score = (self.play_count as i64) * 100;
        let age_penalty = age_days * 10;
        
        priority_score + play_score - age_penalty
    }
}

