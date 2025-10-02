// 音频流管理模块
//
// 职责：
// - 管理音频流的生命周期
// - 跟踪音频流状态
// - 提供音频流健康检查

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

/// 音频流状态
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamState {
    /// 未初始化
    Uninitialized,
    /// 就绪
    Ready,
    /// 播放中
    Playing,
    /// 暂停
    Paused,
    /// 错误
    Error,
}

/// 音频流统计信息
#[derive(Debug, Clone)]
pub struct StreamStats {
    /// 总播放时间（毫秒）
    pub total_play_time_ms: u64,
    /// 缓冲不足次数
    pub underrun_count: u64,
    /// 创建时间
    pub created_at: Instant,
    /// 最后活动时间
    pub last_activity: Instant,
}

impl StreamStats {
    pub fn new() -> Self {
        let now = Instant::now();
        Self {
            total_play_time_ms: 0,
            underrun_count: 0,
            created_at: now,
            last_activity: now,
        }
    }
    
    /// 获取运行时长
    pub fn uptime(&self) -> Duration {
        self.created_at.elapsed()
    }
    
    /// 获取空闲时长
    pub fn idle_time(&self) -> Duration {
        self.last_activity.elapsed()
    }
}

/// 音频流监控器
/// 
/// 跟踪音频流的运行状态和性能指标
pub struct StreamMonitor {
    state: Arc<AtomicU64>, // 使用u64存储StreamState
    is_active: Arc<AtomicBool>,
    stats: Arc<parking_lot::Mutex<StreamStats>>,
}

impl StreamMonitor {
    pub fn new() -> Self {
        Self {
            state: Arc::new(AtomicU64::new(StreamState::Uninitialized as u64)),
            is_active: Arc::new(AtomicBool::new(false)),
            stats: Arc::new(parking_lot::Mutex::new(StreamStats::new())),
        }
    }
    
    /// 设置流状态
    pub fn set_state(&self, state: StreamState) {
        self.state.store(state as u64, Ordering::SeqCst);
        
        // 更新活动状态
        let active = matches!(state, StreamState::Playing);
        self.is_active.store(active, Ordering::SeqCst);
        
        // 更新统计信息
        let mut stats = self.stats.lock();
        stats.last_activity = Instant::now();
    }
    
    /// 获取流状态
    pub fn get_state(&self) -> StreamState {
        match self.state.load(Ordering::SeqCst) {
            0 => StreamState::Uninitialized,
            1 => StreamState::Ready,
            2 => StreamState::Playing,
            3 => StreamState::Paused,
            4 => StreamState::Error,
            _ => StreamState::Uninitialized,
        }
    }
    
    /// 检查流是否活跃
    pub fn is_active(&self) -> bool {
        self.is_active.load(Ordering::SeqCst)
    }
    
    /// 记录播放时间
    pub fn add_play_time(&self, duration_ms: u64) {
        let mut stats = self.stats.lock();
        stats.total_play_time_ms += duration_ms;
        stats.last_activity = Instant::now();
    }
    
    /// 记录缓冲不足
    pub fn record_underrun(&self) {
        let mut stats = self.stats.lock();
        stats.underrun_count += 1;
        log::warn!("⚠️ 音频缓冲不足（累计{}次）", stats.underrun_count);
    }
    
    /// 获取统计信息
    pub fn get_stats(&self) -> StreamStats {
        self.stats.lock().clone()
    }
    
    /// 重置统计信息
    pub fn reset_stats(&self) {
        let mut stats = self.stats.lock();
        *stats = StreamStats::new();
    }
    
    /// 健康检查
    pub fn health_check(&self) -> StreamHealthStatus {
        let stats = self.stats.lock();
        let state = self.get_state();
        
        // 检查是否长时间空闲
        let idle_too_long = stats.idle_time() > Duration::from_secs(300); // 5分钟
        
        // 检查缓冲不足率
        let uptime_secs = stats.uptime().as_secs();
        let underrun_rate = if uptime_secs > 0 {
            stats.underrun_count as f64 / uptime_secs as f64
        } else {
            0.0
        };
        
        let high_underrun_rate = underrun_rate > 0.1; // 每10秒超过1次
        
        StreamHealthStatus {
            state,
            is_healthy: !idle_too_long && !high_underrun_rate && state != StreamState::Error,
            idle_too_long,
            high_underrun_rate,
            underrun_count: stats.underrun_count,
            uptime: stats.uptime(),
        }
    }
}

impl Clone for StreamMonitor {
    fn clone(&self) -> Self {
        Self {
            state: Arc::clone(&self.state),
            is_active: Arc::clone(&self.is_active),
            stats: Arc::clone(&self.stats),
        }
    }
}

impl Default for StreamMonitor {
    fn default() -> Self {
        Self::new()
    }
}

/// 音频流健康状态
#[derive(Debug, Clone)]
pub struct StreamHealthStatus {
    pub state: StreamState,
    pub is_healthy: bool,
    pub idle_too_long: bool,
    pub high_underrun_rate: bool,
    pub underrun_count: u64,
    pub uptime: Duration,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_stream_monitor_state() {
        let monitor = StreamMonitor::new();
        
        assert_eq!(monitor.get_state(), StreamState::Uninitialized);
        assert!(!monitor.is_active());
        
        monitor.set_state(StreamState::Playing);
        assert_eq!(monitor.get_state(), StreamState::Playing);
        assert!(monitor.is_active());
        
        monitor.set_state(StreamState::Paused);
        assert_eq!(monitor.get_state(), StreamState::Paused);
        assert!(!monitor.is_active());
    }
    
    #[test]
    fn test_stream_stats() {
        let monitor = StreamMonitor::new();
        
        monitor.add_play_time(1000);
        monitor.add_play_time(2000);
        
        let stats = monitor.get_stats();
        assert_eq!(stats.total_play_time_ms, 3000);
        
        monitor.record_underrun();
        monitor.record_underrun();
        
        let stats = monitor.get_stats();
        assert_eq!(stats.underrun_count, 2);
    }
    
    #[test]
    fn test_health_check() {
        let monitor = StreamMonitor::new();
        monitor.set_state(StreamState::Playing);
        
        let health = monitor.health_check();
        assert!(health.is_healthy);
        assert_eq!(health.state, StreamState::Playing);
    }
}
