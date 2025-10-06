// 歌单模块类型定义
//
// 设计原则：
// - 单一职责：每个类型专注于一个概念
// - 类型安全：使用枚举而非字符串
// - 可序列化：所有类型都支持Serialize/Deserialize

use serde::{Deserialize, Serialize};
use crate::player::Track;

// ==================== 核心类型 ====================

/// 歌单信息（扩展版）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub cover_path: Option<String>,
    pub color_theme: Option<String>,
    pub is_smart: bool,
    pub smart_rules: Option<String>, // JSON格式的智能规则
    pub is_favorite: bool,
    pub is_pinned: bool,
    pub track_count: i64,
    pub total_duration_ms: i64,
    pub created_at: i64,
    pub updated_at: Option<i64>,
    pub last_played: Option<i64>,
    pub play_count: i64,
}

/// 歌单项（扩展版）- 预留类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct PlaylistItem {
    pub id: i64,
    pub playlist_id: i64,
    pub track_id: i64,
    pub order_index: i64,
    pub added_at: i64,
}

/// 歌单详情（包含曲目列表）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistWithTracks {
    pub playlist: Playlist,
    pub tracks: Vec<Track>,
}

// ==================== 智能歌单规则 ====================

/// 智能歌单规则集合
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartRules {
    pub rules: Vec<SmartRule>,
    pub match_all: bool, // true=AND, false=OR
    pub limit: Option<i64>, // 最大曲目数量
}

/// 单条智能规则
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartRule {
    pub field: RuleField,
    pub operator: RuleOperator,
    pub value: String,
}

/// 规则字段
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuleField {
    Title,
    Artist,
    Album,
    Duration,      // 时长（毫秒）
    DateAdded,     // 添加日期（时间戳）
    LastPlayed,    // 最后播放时间
    PlayCount,     // 播放次数
    IsFavorite,    // 是否收藏
}

/// 规则操作符
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuleOperator {
    // 字符串操作
    Equals,
    NotEquals,
    Contains,
    NotContains,
    StartsWith,
    EndsWith,
    
    // 数值操作
    GreaterThan,
    LessThan,
    GreaterOrEqual,
    LessOrEqual,
    
    // 时间操作
    WithinDays,      // 最近N天
    NotWithinDays,   // 不在最近N天
    Before,          // 早于某个日期
    After,           // 晚于某个日期
    
    // 布尔操作
    IsTrue,
    IsFalse,
}

// ==================== 导入导出格式 ====================

/// 导出格式
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    M3U,
    M3U8,
    JSON,
}

/// JSON导出格式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistExport {
    pub name: String,
    pub description: Option<String>,
    pub created_at: i64,
    pub tracks: Vec<TrackExport>,
}

/// 导出的曲目信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackExport {
    pub path: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration_ms: Option<i64>,
}

impl From<&Track> for TrackExport {
    fn from(track: &Track) -> Self {
        TrackExport {
            path: track.path.clone(),
            title: track.title.clone(),
            artist: track.artist.clone(),
            album: track.album.clone(),
            duration_ms: track.duration_ms,
        }
    }
}

// ==================== 创建/更新选项 ====================

/// 创建歌单选项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePlaylistOptions {
    pub name: String,
    pub description: Option<String>,
    pub color_theme: Option<String>,
    pub is_smart: bool,
    pub smart_rules: Option<SmartRules>,
}

/// 更新歌单选项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePlaylistOptions {
    pub name: Option<String>,
    pub description: Option<String>,
    pub cover_path: Option<String>,
    pub color_theme: Option<String>,
    pub is_favorite: Option<bool>,
}

// ==================== 统计信息 ====================

/// 歌单统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistStats {
    pub total_playlists: i64,
    pub total_smart_playlists: i64,
    pub total_favorite_playlists: i64,
    pub total_tracks_in_playlists: i64,
}


