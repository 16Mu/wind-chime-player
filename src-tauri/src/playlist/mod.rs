// 歌单模块 - 模块化、高内聚设计
//
// 设计原则：
// - 单一职责：每个子模块负责独立功能
// - 依赖倒置：Manager依赖Database trait，而非具体实现
// - 接口隔离：清晰的公共API

pub mod types;
pub mod smart_playlist;
pub mod manager;
pub mod exporter;
pub mod importer;

// Re-exports for convenience
pub use types::*;
// SmartPlaylistEngine 仅内部使用，不导出
pub use manager::PlaylistManager;
pub use exporter::PlaylistExporter;
pub use importer::PlaylistImporter;


