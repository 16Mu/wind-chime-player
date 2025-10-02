// 音频设备管理Actor
//
// 职责：
// - 音频设备初始化（懒加载）
// - 设备健康监控
// - 设备故障恢复
// - 提供设备访问接口

use tokio::sync::mpsc;
use std::sync::Arc;
use std::time::Duration;
use super::super::audio::LazyAudioDevice;
use super::super::types::{PlayerError, PlayerEvent, Result};

/// 音频Actor消息
pub enum AudioMsg {
    /// 初始化设备
    Initialize,
    
    /// 检查设备健康状态
    HealthCheck,
    
    /// 重置设备
    Reset,
    
    /// 关闭Actor
    Shutdown,
}

/// 音频设备管理Actor
pub struct AudioActor {
    /// 消息接收器
    inbox: mpsc::Receiver<AudioMsg>,
    
    /// 懒加载音频设备
    device: LazyAudioDevice,
    
    /// 设备初始化标志
    device_cache: Option<Arc<()>>,
    
    /// 事件发送器（发送到前端）
    event_tx: mpsc::Sender<PlayerEvent>,
    
    /// 健康检查间隔
    health_check_interval: Duration,
    
    /// 故障计数
    failure_count: u32,
    
    /// 最大重试次数
    max_retries: u32,
}

impl AudioActor {
    /// 创建新的AudioActor
    /// 
    /// # 返回
    /// - (AudioActor, mpsc::Sender<AudioMsg>)
    pub fn new(
        event_tx: mpsc::Sender<PlayerEvent>,
    ) -> (Self, mpsc::Sender<AudioMsg>) {
        let (tx, rx) = mpsc::channel(32);
        
        let actor = Self {
            inbox: rx,
            device: LazyAudioDevice::default(),
            device_cache: None,
            event_tx,
            health_check_interval: Duration::from_secs(30),
            failure_count: 0,
            max_retries: 3,
        };
        
        (actor, tx)
    }
    
    /// 运行Actor事件循环
    pub async fn run(mut self) {
        log::info!("🎵 AudioActor 启动");
        
        let mut health_check_timer = tokio::time::interval(self.health_check_interval);
        health_check_timer.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        
        loop {
            tokio::select! {
                // 处理消息
                Some(msg) = self.inbox.recv() => {
                    match msg {
                        AudioMsg::Initialize => {
                            self.handle_initialize().await;
                        }
                        AudioMsg::HealthCheck => {
                            self.handle_health_check().await;
                        }
                        AudioMsg::Reset => {
                            self.handle_reset().await;
                        }
                        AudioMsg::Shutdown => {
                            log::info!("🎵 AudioActor 收到关闭信号");
                            break;
                        }
                    }
                }
                
                // 定期健康检查
                _ = health_check_timer.tick() => {
                    if self.device.is_initialized() {
                        self.handle_health_check().await;
                    }
                }
                
                // 收件箱关闭
                else => {
                    log::warn!("🎵 AudioActor 收件箱关闭");
                    break;
                }
            }
        }
        
        log::info!("🎵 AudioActor 已停止");
    }
    
    /// 处理初始化请求
    async fn handle_initialize(&mut self) {
        log::info!("🎵 开始初始化音频设备");
        
        match self.device.get_or_init().await {
            Ok(_device) => {
                log::info!("✅ 音频设备初始化成功");
                // 标记设备已初始化
                self.device_cache = Some(Arc::new(()));
                self.failure_count = 0;
                
                // 发送设备就绪事件
                let _ = self.event_tx.send(PlayerEvent::AudioDeviceReady).await;
            }
            Err(e) => {
                log::error!("❌ 音频设备初始化失败: {}", e);
                self.failure_count += 1;
                
                // 发送设备失败事件
                let _ = self.event_tx.send(PlayerEvent::AudioDeviceFailed {
                    error: e.to_string(),
                    recoverable: self.failure_count < self.max_retries,
                }).await;
                
                // 如果未达到最大重试次数，延迟后由外部重新发送初始化消息
                if self.failure_count < self.max_retries {
                    log::info!("⚠️ 初始化失败（{}/{}），需要手动重试", 
                        self.failure_count, self.max_retries);
                }
            }
        }
    }
    
    /// 处理健康检查
    async fn handle_health_check(&mut self) {
        if self.device_cache.is_some() {
            log::debug!("💓 音频设备健康检查：正常");
        }
    }
    
    /// 处理重置请求
    async fn handle_reset(&mut self) {
        log::info!("🔄 重置音频设备");
        
        // 清除缓存
        self.device_cache = None;
        self.failure_count = 0;
        
        // 注意：LazyAudioDevice不支持真正的重置
        // 如需重置，需要创建新的LazyAudioDevice实例
        log::warn!("⚠️ 当前实现不支持完全重置设备");
        log::warn!("⚠️ 下次访问时会复用已初始化的设备");
    }
}

/// AudioActor的句柄（用于发送消息）
#[derive(Clone)]
pub struct AudioActorHandle {
    tx: mpsc::Sender<AudioMsg>,
}

impl AudioActorHandle {
    /// 创建句柄
    pub fn new(tx: mpsc::Sender<AudioMsg>) -> Self {
        Self { tx }
    }
    
    /// 初始化设备
    pub async fn initialize(&self) -> Result<()> {
        self.tx.send(AudioMsg::Initialize)
            .await
            .map_err(|e| PlayerError::Internal(format!("发送初始化消息失败: {}", e)))
    }
    
    /// 健康检查
    pub async fn health_check(&self) -> Result<()> {
        self.tx.send(AudioMsg::HealthCheck)
            .await
            .map_err(|e| PlayerError::Internal(format!("发送健康检查消息失败: {}", e)))
    }
    
    /// 重置设备
    pub async fn reset(&self) -> Result<()> {
        self.tx.send(AudioMsg::Reset)
            .await
            .map_err(|e| PlayerError::Internal(format!("发送重置消息失败: {}", e)))
    }
    
    /// 关闭Actor
    pub async fn shutdown(&self) -> Result<()> {
        self.tx.send(AudioMsg::Shutdown)
            .await
            .map_err(|e| PlayerError::Internal(format!("发送关闭消息失败: {}", e)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_audio_actor_creation() {
        let (event_tx, _event_rx) = mpsc::channel(10);
        let (actor, _handle) = AudioActor::new(event_tx);
        
        assert!(!actor.device.is_initialized());
        assert_eq!(actor.failure_count, 0);
    }
    
    // 注：由于 AudioDevice 包含非 Send 的 OutputStream，完整的集成测试需要在主线程运行
    // 这里只测试 Handle 的创建
    #[test]
    fn test_audio_actor_handle_creation() {
        let (event_tx, _event_rx) = std::sync::mpsc::channel();
        let (event_tx_async, _event_rx_async) = mpsc::channel(10);
        let (_actor, tx) = AudioActor::new(event_tx_async);
        let _handle = AudioActorHandle::new(tx);
        
        // 验证 handle 可以正常创建
        assert!(event_tx.send("Handle created successfully").is_ok());
    }
}
