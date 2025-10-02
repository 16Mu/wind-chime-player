// 音频处理层模块
//
// 提供音频设备管理、音频解码、Sink池化等核心功能
//
// 模块结构：
// - device: 懒加载音频设备管理（带超时保护）
// - stream: 音频流生命周期管理和监控
// - decoder: 音频解码器封装
// - sink_pool: Sink资源池（复用机制）

pub mod device;
pub mod stream;
pub mod decoder;
pub mod sink_pool;

// 公开导出常用类型
pub use device::{AudioDevice, LazyAudioDevice};
pub use stream::{StreamState, StreamMonitor};
pub use decoder::{AudioFormat, AudioDecoder};
pub use sink_pool::{SinkPool, PooledSink};

/// 音频模块版本
#[allow(dead_code)]
pub const AUDIO_MODULE_VERSION: &str = "1.0.0";

/// 音频处理层配置
#[derive(Debug, Clone)]
pub struct AudioConfig {
    /// 设备初始化超时（秒）
    pub device_timeout_secs: u64,
    /// Sink池最大容量
    pub sink_pool_max_size: usize,
    /// 是否启用音频流监控
    pub enable_stream_monitoring: bool,
}

impl AudioConfig {
    /// 创建默认配置
    pub fn default() -> Self {
        Self {
            device_timeout_secs: 3,
            sink_pool_max_size: 8,
            enable_stream_monitoring: true,
        }
    }
    
    /// 创建高性能配置（更大的池）
    pub fn high_performance() -> Self {
        Self {
            device_timeout_secs: 3,
            sink_pool_max_size: 16,
            enable_stream_monitoring: true,
        }
    }
    
    /// 创建低资源配置（更小的池）
    pub fn low_resource() -> Self {
        Self {
            device_timeout_secs: 5,
            sink_pool_max_size: 4,
            enable_stream_monitoring: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_audio_config() {
        let config = AudioConfig::default();
        assert_eq!(config.device_timeout_secs, 3);
        assert_eq!(config.sink_pool_max_size, 8);
        assert!(config.enable_stream_monitoring);
    }
    
    #[test]
    fn test_module_version() {
        assert!(!AUDIO_MODULE_VERSION.is_empty());
    }
}
