// 播放历史模块类型定义
//
// 设计原则：
// - 数据聚合：将曲目信息和播放统计聚合在一起
// - 类型安全：明确的类型定义，避免混淆

use serde::{Deserialize, Serialize};
use crate::player::Track;

/// 播放历史条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayHistoryEntry {
    pub track: Track,
    pub play_count: i64,
    pub last_played_at: i64,
    pub first_played_at: i64,
}

/// 播放统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayStatistics {
    pub total_plays: i64,
    pub unique_tracks: i64,
    pub total_duration_ms: i64,
}

