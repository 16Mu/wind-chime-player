// WindChime Player 播放器模块
//
// 架构说明：
// - types: 类型定义（Track, State, Commands, Events, Errors）
// - audio: 音频处理层（设备管理、解码、Sink池）
// - actors: Actor模式实现（独立的业务逻辑单元）
// - playback: 播放控制层
// - playlist: 播放列表管理
// - state: 状态管理
// - utils: 工具函数
// - core: PlayerCore核心协调器

// 类型定义模块
pub mod types;

// 音频处理层（已完成）
pub mod audio;

// Actor模块（已完成）
pub mod actors;

// 核心协调器（已完成）
pub mod core;

// 公开导出常用类型
pub use types::{
    Track, RepeatMode,
    PlayerCommand, PlayerEvent,
};

// 内部使用的类型（暂不导出）
#[allow(unused_imports)]
pub(crate) use types::{
    PlayerState, PlayerError, Result,
};

// 内部使用的音频模块类型（暂不导出）
#[allow(unused_imports)]
pub(crate) use audio::{
    AudioDevice, LazyAudioDevice,
    AudioFormat, AudioDecoder,
    SinkPool, PooledSink,
};

// 内部使用的Actor类型（暂不导出）
#[allow(unused_imports)]
pub(crate) use actors::{
    AudioActor, AudioActorHandle,
    PlaybackActor, PlaybackActorHandle,
    PlaylistActor, PlaylistActorHandle,
    StateActor, StateActorHandle,
};

// 公开导出PlayerCore
pub use core::{PlayerCore, PlayerCoreConfig};

// 播放器架构说明：
// - 采用Actor模式实现，各模块通过消息传递协作
// - actors/ 包含所有业务逻辑（AudioActor, PlaybackActor, PlaylistActor, StateActor, PreloadActor）
// - audio/ 包含音频处理层（设备管理、解码、Sink池）
// - types/ 包含类型定义（Track, State, Commands, Events, Errors）
// - core.rs 是核心协调器，负责Actor生命周期管理和命令分发

