// 播放器状态定义

use serde::{Deserialize, Serialize};
use super::track::Track;

/// 播放器状态
#[derive(Debug, Clone, Serialize)]
pub struct PlayerState {
    /// 是否正在播放
    pub is_playing: bool,
    
    /// 当前曲目
    pub current_track: Option<Track>,
    
    /// 播放位置（毫秒）
    pub position_ms: u64,
    
    /// 音量（0.0 - 1.0）
    pub volume: f32,
    
    /// 重复模式
    pub repeat_mode: RepeatMode,
    
    /// 随机播放
    pub shuffle: bool,
}

impl PlayerState {
    /// 创建默认状态
    pub fn new() -> Self {
        Self {
            is_playing: false,
            current_track: None,
            position_ms: 0,
            volume: 1.0,
            repeat_mode: RepeatMode::Off,
            shuffle: false,
        }
    }
}

impl Default for PlayerState {
    fn default() -> Self {
        Self::new()
    }
}

/// 重复模式
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RepeatMode {
    /// 关闭重复
    Off,
    /// 重复整个列表
    All,
    /// 重复单曲
    One,
}

impl RepeatMode {
    /// 切换到下一个模式（仅测试使用）
    #[cfg(test)]
    pub fn next(self) -> Self {
        match self {
            RepeatMode::Off => RepeatMode::All,
            RepeatMode::All => RepeatMode::One,
            RepeatMode::One => RepeatMode::Off,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_repeat_mode_cycle() {
        let mut mode = RepeatMode::Off;
        mode = mode.next();
        assert_eq!(mode, RepeatMode::All);
        mode = mode.next();
        assert_eq!(mode, RepeatMode::One);
        mode = mode.next();
        assert_eq!(mode, RepeatMode::Off);
    }
    
    #[test]
    fn test_player_state_default() {
        let state = PlayerState::default();
        assert!(!state.is_playing);
        assert!(state.current_track.is_none());
        assert_eq!(state.position_ms, 0);
        assert_eq!(state.volume, 1.0);
    }
}







