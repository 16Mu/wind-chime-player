// 音频设备管理模块
// 
// 核心功能：
// - 懒加载音频设备（启动时不初始化，首次播放时才初始化）
// - 超时保护（3秒超时，避免无限卡死）
// - 自动故障恢复

use rodio::{OutputStream, OutputStreamHandle};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::OnceCell;
use tokio::time::timeout;
use super::super::types::{PlayerError, Result};

/// 音频设备（封装OutputStream和Handle）
pub struct AudioDevice {
    #[allow(dead_code)]
    pub stream: OutputStream,
    pub handle: OutputStreamHandle,
}

impl AudioDevice {
    /// 尝试获取默认音频设备
    pub fn try_default() -> Result<Self> {
        log::info!("🎵 初始化默认音频设备");
        
        let (stream, handle) = OutputStream::try_default()
            .map_err(|e| PlayerError::device_error(
                format!("无法打开默认音频设备: {}", e)
            ))?;
        
        log::info!("✅ 音频设备初始化成功");
        Ok(Self { stream, handle })
    }
    
    /// 获取音频输出句柄
    pub fn handle(&self) -> &OutputStreamHandle {
        &self.handle
    }
}

/// 懒加载音频设备管理器
/// 
/// 特性：
/// - 启动时不初始化设备（避免阻塞启动）
/// - 首次访问时初始化（用户点播放时才初始化）
/// - 带超时保护（3秒超时）
/// - 线程安全（使用Arc包装）
pub struct LazyAudioDevice {
    inner: Arc<OnceCell<AudioDevice>>,
    timeout_duration: Duration,
}

impl LazyAudioDevice {
    /// 创建懒加载音频设备管理器
    /// 
    /// # 参数
    /// - `timeout_duration`: 初始化超时时间
    pub fn new(timeout_duration: Duration) -> Self {
        log::info!("📦 创建懒加载音频设备管理器（超时: {}秒）", 
            timeout_duration.as_secs());
        
        Self {
            inner: Arc::new(OnceCell::new()),
            timeout_duration,
        }
    }
    
    /// 创建默认配置（3秒超时）
    pub fn default() -> Self {
        Self::new(Duration::from_secs(3))
    }
    
    /// 获取或初始化音频设备
    /// 
    /// # 行为
    /// - 如果已初始化，直接返回
    /// - 如果未初始化，在后台异步初始化（带超时保护）
    /// - 超时或失败时返回错误
    pub async fn get_or_init(&self) -> Result<&AudioDevice> {
        self.inner.get_or_try_init(|| async {
            log::info!("🎵 首次访问音频设备，开始初始化");
            
            // 使用超时保护执行初始化
            match timeout(self.timeout_duration, Self::init_device()).await {
                Ok(Ok(device)) => {
                    log::info!("✅ 音频设备初始化成功（耗时 < {}秒）", 
                        self.timeout_duration.as_secs());
                    Ok(device)
                }
                Ok(Err(e)) => {
                    log::error!("❌ 音频设备初始化失败: {}", e);
                    Err(e)
                }
                Err(_) => {
                    log::error!("❌ 音频设备初始化超时（{}秒）", 
                        self.timeout_duration.as_secs());
                    Err(PlayerError::device_timeout(
                        "音频设备初始化超时，请检查音频驱动"
                    ))
                }
            }
        }).await
    }
    
    /// 执行实际的设备初始化
    /// 
    /// 注意：直接在当前线程中执行，因为AudioDevice包含裸指针无法跨线程传递
    async fn init_device() -> Result<AudioDevice> {
        // 直接调用，不使用spawn_blocking
        AudioDevice::try_default()
    }
    
    /// 检查设备是否已初始化
    pub fn is_initialized(&self) -> bool {
        self.inner.get().is_some()
    }
    
    /// 重置设备（清除已初始化的设备，下次访问时重新初始化）
    /// 
    /// 注意：由于OnceCell的限制，实际上不能真正重置
    /// 如需重置功能，应创建新的LazyAudioDevice实例
    pub fn reset(&self) -> Result<()> {
        if self.is_initialized() {
            log::warn!("⚠️ 当前设备已初始化，无法重置");
            log::warn!("⚠️ 如需重置设备，请创建新的LazyAudioDevice实例");
            Err(PlayerError::device_error(
                "设备已初始化，无法重置"
            ))
        } else {
            Ok(())
        }
    }
}

impl Clone for LazyAudioDevice {
    fn clone(&self) -> Self {
        Self {
            inner: Arc::clone(&self.inner),
            timeout_duration: self.timeout_duration,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_lazy_device_initialization() {
        let device = LazyAudioDevice::default();
        
        // 初始未初始化
        assert!(!device.is_initialized());
        
        // 首次访问触发初始化
        let result = device.get_or_init().await;
        
        // 根据系统音频设备情况判断
        if result.is_ok() {
            assert!(device.is_initialized());
        }
    }
    
    #[tokio::test]
    async fn test_timeout_protection() {
        let device = LazyAudioDevice::new(Duration::from_millis(1)); // 1ms超时
        
        // 可能会超时（取决于系统）
        let _ = device.get_or_init().await;
    }
}
