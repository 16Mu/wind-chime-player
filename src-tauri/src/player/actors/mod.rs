// Actor模块
//
// 基于Actor模型的播放器架构：
// - AudioActor: 音频设备管理
// - PlaybackActor: 播放控制
// - PlaylistActor: 播放列表管理
// - StateActor: 状态同步
//
// Actor模式优势：
// - 独立消息队列，无锁通信
// - 故障隔离，单个Actor崩溃不影响其他
// - 异步并发，提升响应速度

pub mod audio_actor;
pub mod playback_actor;
pub mod playlist_actor;
pub mod preload_actor;
pub mod state_actor;

// 公开导出Actor类型
pub use audio_actor::{AudioActor, AudioActorHandle};
pub use playback_actor::{PlaybackActor, PlaybackActorHandle};
pub use playlist_actor::{PlaylistActor, PlaylistActorHandle};
pub use preload_actor::{
    PreloadActor, PreloadActorHandle,
};
pub use state_actor::{StateActor, StateActorHandle};

/// Actor模块版本
#[allow(dead_code)]
pub const ACTORS_MODULE_VERSION: &str = "1.0.0";

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_module_version() {
        assert!(!ACTORS_MODULE_VERSION.is_empty());
    }
}
