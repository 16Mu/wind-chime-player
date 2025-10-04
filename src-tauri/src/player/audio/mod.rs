// 音频处理层模块
//
// 提供音频设备管理、音频解码、Sink池化等核心功能

pub mod device;
pub mod decoder;
pub mod sink_pool;
pub mod arc_source;

// 公开导出常用类型
pub use device::{AudioDevice, LazyAudioDevice};
pub use decoder::{AudioFormat, AudioDecoder};
pub use sink_pool::{SinkPool, PooledSink};
pub use arc_source::ArcSliceSource;
