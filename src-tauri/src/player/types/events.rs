// 播放器事件定义

use serde::Serialize;
use super::{track::Track, state::PlayerState};

/// 播放器事件
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data")]
pub enum PlayerEvent {
    /// 状态变化
    StateChanged(PlayerState),
    
    /// 曲目变化
    TrackChanged(Option<Track>),
    
    /// 位置更新（毫秒）
    PositionChanged(u64),
    
    /// 播放错误
    PlaybackError(String),
    
    /// 曲目完成
    TrackCompleted(Track),
    
    /// 播放列表完成
    PlaylistCompleted,
    
    /// 跳转开始
    SeekStarted(u64),
    
    /// 跳转完成（位置，耗时ms）
    SeekCompleted {
        position: u64,
        elapsed_ms: u64,
    },
    
    /// 跳转失败
    SeekFailed {
        position: u64,
        error: String,
    },
    
    /// 音频设备就绪
    AudioDeviceReady,
    
    /// 音频设备失败
    AudioDeviceFailed {
        error: String,
        recoverable: bool,
    },
    
    /// 预加载完成
    PreloadCompleted {
        track_id: i64,
    },
}

impl PlayerEvent {
    /// 获取事件名称（用于日志）
    pub fn name(&self) -> &str {
        match self {
            PlayerEvent::StateChanged(_) => "StateChanged",
            PlayerEvent::TrackChanged(_) => "TrackChanged",
            PlayerEvent::PositionChanged(_) => "PositionChanged",
            PlayerEvent::PlaybackError(_) => "PlaybackError",
            PlayerEvent::TrackCompleted(_) => "TrackCompleted",
            PlayerEvent::PlaylistCompleted => "PlaylistCompleted",
            PlayerEvent::SeekStarted(_) => "SeekStarted",
            PlayerEvent::SeekCompleted { .. } => "SeekCompleted",
            PlayerEvent::SeekFailed { .. } => "SeekFailed",
            PlayerEvent::AudioDeviceReady => "AudioDeviceReady",
            PlayerEvent::AudioDeviceFailed { .. } => "AudioDeviceFailed",
            PlayerEvent::PreloadCompleted { .. } => "PreloadCompleted",
        }
    }
    
    /// 判断是否为错误事件
    pub fn is_error(&self) -> bool {
        matches!(
            self,
            PlayerEvent::PlaybackError(_)
                | PlayerEvent::SeekFailed { .. }
                | PlayerEvent::AudioDeviceFailed { .. }
        )
    }
    
    /// 判断是否为状态更新事件
    pub fn is_state_update(&self) -> bool {
        matches!(
            self,
            PlayerEvent::StateChanged(_)
                | PlayerEvent::TrackChanged(_)
                | PlayerEvent::PositionChanged(_)
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_event_classification() {
        let error_event = PlayerEvent::PlaybackError("test".to_string());
        assert!(error_event.is_error());
        assert!(!error_event.is_state_update());
        
        let state_event = PlayerEvent::PositionChanged(1000);
        assert!(!state_event.is_error());
        assert!(state_event.is_state_update());
    }
}

