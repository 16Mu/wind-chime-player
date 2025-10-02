// 播放器类型定义模块

mod track;
mod state;
mod commands;
mod events;
mod errors;

// 公开导出所有类型
pub use track::Track;
pub use state::{PlayerState, RepeatMode};
pub use commands::PlayerCommand;
pub use events::PlayerEvent;
pub use errors::{PlayerError, ErrorSeverity};

// 类型别名
pub type Result<T> = std::result::Result<T, PlayerError>;



