// 播放器事件定义

use serde::Serialize;
use super::{track::Track, state::PlayerState};

/// 播放器事件
/// 播放器事件 - 公共API
/// 用于前端监听播放器状态变化和事件通知
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data")]
#[allow(dead_code)]  // 公共API，保留所有变体
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
    
    /// 跳转完成（位置，耗时ms）
    SeekCompleted {
        position: u64,
        elapsed_ms: u64,
    },
    
    /// 音频设备就绪
    AudioDeviceReady,
    
    /// 音频设备失败
    AudioDeviceFailed {
        error: String,
        recoverable: bool,
    },
}

impl PlayerEvent {
    /// 判断是否为错误事件（仅测试使用）
    #[cfg(test)]
    pub fn is_error(&self) -> bool {
        matches!(
            self,
            PlayerEvent::PlaybackError(_)
                | PlayerEvent::AudioDeviceFailed { .. }
        )
    }
    
    /// 判断是否为状态更新事件（仅测试使用）
    #[cfg(test)]
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
        
        let device_error = PlayerEvent::AudioDeviceFailed {
            error: "test".to_string(),
            recoverable: true,
        };
        assert!(device_error.is_error());
    }
}

