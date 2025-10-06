// 安全的WebDAV流处理 - 解决异步流风险
// 采用状态机 + 资源管理 + 边界检查

use std::pin::Pin;
use std::task::{Context, Poll, Waker};
use std::time::{Duration, Instant};
use tokio::io::{AsyncRead, ReadBuf};
use bytes::Bytes;
use futures::Stream;
use futures::stream::StreamExt;
use thiserror::Error;
use super::types::WebDAVError;

/// 🛡️ 流错误类型 - 明确的错误分类和处理策略
#[derive(Error, Debug, Clone)]
#[allow(dead_code)]
pub enum StreamError {
    #[error("缓冲区溢出: 当前 {current} bytes, 限制 {limit} bytes")]
    BufferOverflow { current: usize, limit: usize },
    
    #[error("读取超时: 操作已超时 {elapsed:?}")]
    ReadTimeout { elapsed: Duration },
    
    #[error("流已关闭: {reason}")]
    StreamClosed { reason: String },
    
    #[error("内存不足: 无法分配 {requested} bytes")]
    OutOfMemory { requested: usize },
    
    #[error("数据损坏: {details}")]
    DataCorruption { details: String },
    
    #[error("网络错误: {message}")]
    NetworkError { message: String },
    
    #[error("流状态错误: 期望 {expected}, 实际 {actual}")]
    InvalidState { expected: String, actual: String },
}

/// WebDAVError 到 StreamError 的转换
impl From<WebDAVError> for StreamError {
    fn from(error: WebDAVError) -> Self {
        match error {
            WebDAVError::NetworkError(e) => {
                StreamError::NetworkError { message: e.to_string() }
            }
            WebDAVError::Timeout => {
                StreamError::ReadTimeout { elapsed: Duration::from_secs(0) }
            }
            WebDAVError::HttpStatusError { status, message } => {
                StreamError::NetworkError { 
                    message: format!("HTTP {}: {}", status, message) 
                }
            }
            WebDAVError::IoError(e) => {
                StreamError::NetworkError { message: e.to_string() }
            }
            _ => {
                StreamError::NetworkError { message: error.to_string() }
            }
        }
    }
}

/// 🛡️ 流状态机 - 防止非法状态转换
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StreamState {
    /// 初始状态，等待开始读取
    Pending,
    /// 正在读取数据
    Reading { bytes_read: u64 },
    /// 读取完成
    Completed { total_bytes: u64 },
    /// 发生错误，流不可用
    Error { error: String },
    /// 流已关闭
    Closed,
}

impl StreamState {
    /// 检查状态转换是否合法
    pub fn can_transition_to(&self, new_state: &StreamState) -> bool {
        use StreamState::*;
        
        match (self, new_state) {
            // 从Pending可以转到任何状态
            (Pending, _) => true,
            
            // Reading只能转到Reading(更多字节)、Completed、Error、Closed
            (Reading { .. }, Reading { .. }) => true,
            (Reading { .. }, Completed { .. }) => true,
            (Reading { .. }, Error { .. }) => true,
            (Reading { .. }, Closed) => true,
            
            // Completed只能转到Closed
            (Completed { .. }, Closed) => true,
            
            // Error只能转到Closed
            (Error { .. }, Closed) => true,
            
            // Closed是终结状态
            (Closed, _) => false,
            
            // 其他转换都不合法
            _ => false,
        }
    }
}

/// 🛡️ 缓冲区管理器 - 防止内存泄漏和溢出
#[derive(Debug)]
#[allow(dead_code)]
pub struct BufferManager {
    /// 当前缓冲区大小
    current_size: usize,
    /// 最大缓冲区大小
    max_size: usize,
    /// 缓冲区块大小
    #[allow(dead_code)]
    chunk_size: usize,
    /// 低水位标记 (暂停读取阈值)
    #[allow(dead_code)]
    low_watermark: usize,
    /// 高水位标记 (恢复读取阈值)
    high_watermark: usize,
    /// 内存使用统计
    peak_usage: usize,
    allocation_count: u64,
}

impl BufferManager {
    pub fn new(max_size: usize, chunk_size: usize) -> Self {
        let low_watermark = max_size / 4;
        let high_watermark = max_size * 3 / 4;
        
        Self {
            current_size: 0,
            max_size,
            chunk_size,
            low_watermark,
            high_watermark,
            peak_usage: 0,
            allocation_count: 0,
        }
    }
    
    /// 检查是否可以分配更多内存
    pub fn can_allocate(&self, size: usize) -> Result<(), StreamError> {
        if self.current_size + size > self.max_size {
            Err(StreamError::BufferOverflow {
                current: self.current_size + size,
                limit: self.max_size,
            })
        } else {
            Ok(())
        }
    }
    
    /// 分配内存
    pub fn allocate(&mut self, size: usize) -> Result<(), StreamError> {
        self.can_allocate(size)?;
        self.current_size += size;
        self.peak_usage = self.peak_usage.max(self.current_size);
        self.allocation_count += 1;
        Ok(())
    }
    
    /// 释放内存
    pub fn deallocate(&mut self, size: usize) {
        self.current_size = self.current_size.saturating_sub(size);
    }
    
    /// 是否应该暂停读取 (背压控制)
    pub fn should_pause_reading(&self) -> bool {
        self.current_size >= self.high_watermark
    }
    
    /// 是否可以恢复读取
    #[allow(dead_code)]
    pub fn can_resume_reading(&self) -> bool {
        self.current_size <= self.low_watermark
    }
    
    /// 获取内存统计
    pub fn get_stats(&self) -> BufferStats {
        BufferStats {
            current_size: self.current_size,
            max_size: self.max_size,
            peak_usage: self.peak_usage,
            allocation_count: self.allocation_count,
            utilization_percent: (self.current_size as f32 / self.max_size as f32 * 100.0),
        }
    }
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct BufferStats {
    #[allow(dead_code)]
    pub current_size: usize,
    #[allow(dead_code)]
    pub max_size: usize,
    #[allow(dead_code)]
    pub peak_usage: usize,
    #[allow(dead_code)]
    pub allocation_count: u64,
    #[allow(dead_code)]
    pub utilization_percent: f32,
}

/// 🛡️ 超时守卫 - 防止死锁和无限等待
#[derive(Debug)]
pub struct TimeoutGuard {
    start_time: Instant,
    timeout: Duration,
    last_activity: Instant,
    activity_timeout: Duration,
}

impl TimeoutGuard {
    pub fn new(timeout: Duration, activity_timeout: Duration) -> Self {
        let now = Instant::now();
        Self {
            start_time: now,
            timeout,
            last_activity: now,
            activity_timeout,
        }
    }
    
    /// 检查是否超时
    pub fn check_timeout(&self) -> Result<(), StreamError> {
        let now = Instant::now();
        
        // 检查总体超时
        if now.duration_since(self.start_time) > self.timeout {
            return Err(StreamError::ReadTimeout {
                elapsed: now.duration_since(self.start_time),
            });
        }
        
        // 检查活动超时
        if now.duration_since(self.last_activity) > self.activity_timeout {
            return Err(StreamError::ReadTimeout {
                elapsed: now.duration_since(self.last_activity),
            });
        }
        
        Ok(())
    }
    
    /// 记录活动
    pub fn record_activity(&mut self) {
        self.last_activity = Instant::now();
    }
    
    /// 获取剩余时间
    #[allow(dead_code)]
    pub fn remaining_time(&self) -> Duration {
        let elapsed = self.start_time.elapsed();
        self.timeout.saturating_sub(elapsed)
    }
}

/// 🛡️ 安全WebDAV流 - 核心结构
pub struct SafeWebDAVStream {
    /// 内部流
    inner: Pin<Box<dyn Stream<Item = Result<Bytes, StreamError>> + Send + Sync>>,
    /// 状态机
    state: StreamState,
    /// 缓冲区管理器
    buffer_manager: BufferManager,
    /// 超时守卫
    timeout_guard: TimeoutGuard,
    /// 读取缓冲区
    read_buffer: Vec<u8>,
    /// 错误计数器
    error_count: u32,
    /// 最大错误数
    max_errors: u32,
    /// Waker管理
    waker: Option<Waker>,
    /// 统计信息
    stats: StreamStats,
}

#[derive(Debug, Clone, Default)]
#[allow(dead_code)]
pub struct StreamStats {
    pub total_bytes_read: u64,
    pub read_operations: u64,
    pub error_count: u32,
    pub average_chunk_size: f32,
    #[allow(dead_code)]
    pub start_time: Option<Instant>,
    pub last_read_time: Option<Instant>,
}

impl SafeWebDAVStream {
    pub fn new<S>(stream: S, config: SafeStreamConfig) -> Self 
    where
        S: Stream<Item = Result<Bytes, StreamError>> + Send + Sync + 'static,
    {
        let buffer_manager = BufferManager::new(
            config.max_buffer_size, 
            config.chunk_size
        );
        
        let timeout_guard = TimeoutGuard::new(
            config.total_timeout,
            config.activity_timeout
        );
        
        Self {
            inner: Box::pin(stream),
            state: StreamState::Pending,
            buffer_manager,
            timeout_guard,
            read_buffer: Vec::with_capacity(config.chunk_size),
            error_count: 0,
            max_errors: config.max_errors,
            waker: None,
            stats: StreamStats {
                start_time: Some(Instant::now()),
                ..Default::default()
            },
        }
    }
    
    /// 从 WebDAV 结果流创建安全流
    pub fn from_webdav_stream<S>(stream: S, config: SafeStreamConfig) -> Self
    where
        S: Stream<Item = Result<Bytes, WebDAVError>> + Send + Sync + 'static,
    {
        // 将 WebDAVError 转换为 StreamError
        let converted_stream = stream.map(|result| {
            result.map_err(|e| e.into())
        });
        
        Self::new(converted_stream, config)
    }
    
    /// 状态转换
    fn transition_state(&mut self, new_state: StreamState) -> Result<(), StreamError> {
        if !self.state.can_transition_to(&new_state) {
            return Err(StreamError::InvalidState {
                expected: format!("可以转换到 {:?}", new_state),
                actual: format!("当前状态 {:?}", self.state),
            });
        }
        
        log::debug!("流状态转换: {:?} -> {:?}", self.state, new_state);
        self.state = new_state;
        Ok(())
    }
    
    /// 错误处理
    fn handle_error(&mut self, error: StreamError) -> std::io::Error {
        self.error_count += 1;
        self.stats.error_count += 1;
        
        log::error!("流错误 (第 {} 次): {}", self.error_count, error);
        
        if self.error_count >= self.max_errors {
            let _ = self.transition_state(StreamState::Error {
                error: "达到最大错误数".to_string()
            });
        }
        
        // 转换为io::Error
        match error {
            StreamError::ReadTimeout { .. } => {
                std::io::Error::new(std::io::ErrorKind::TimedOut, error.to_string())
            }
            StreamError::BufferOverflow { .. } => {
                std::io::Error::new(std::io::ErrorKind::OutOfMemory, error.to_string())
            }
            StreamError::StreamClosed { .. } => {
                std::io::Error::new(std::io::ErrorKind::UnexpectedEof, error.to_string())
            }
            StreamError::DataCorruption { .. } => {
                std::io::Error::new(std::io::ErrorKind::InvalidData, error.to_string())
            }
            StreamError::NetworkError { .. } => {
                std::io::Error::new(std::io::ErrorKind::ConnectionAborted, error.to_string())
            }
            _ => {
                std::io::Error::new(std::io::ErrorKind::Other, error.to_string())
            }
        }
    }
    
    /// 获取统计信息
    pub fn get_stats(&self) -> StreamStats {
        let mut stats = self.stats.clone();
        if stats.read_operations > 0 {
            stats.average_chunk_size = stats.total_bytes_read as f32 / stats.read_operations as f32;
        }
        stats
    }
    
    /// 获取缓冲区统计
    pub fn get_buffer_stats(&self) -> BufferStats {
        self.buffer_manager.get_stats()
    }
}

/// 🛡️ 安全流配置
#[derive(Debug, Clone)]
pub struct SafeStreamConfig {
    /// 最大缓冲区大小
    pub max_buffer_size: usize,
    /// 块大小
    pub chunk_size: usize,
    /// 总体超时时间
    pub total_timeout: Duration,
    /// 活动超时时间
    pub activity_timeout: Duration,
    /// 最大错误数
    pub max_errors: u32,
}

impl Default for SafeStreamConfig {
    fn default() -> Self {
        Self {
            max_buffer_size: 64 * 1024 * 1024, // 64MB
            chunk_size: 64 * 1024,             // 64KB
            total_timeout: Duration::from_secs(300), // 5分钟
            activity_timeout: Duration::from_secs(30), // 30秒无活动
            max_errors: 5,
        }
    }
}

impl AsyncRead for SafeWebDAVStream {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        // 1. 检查状态
        match &self.state {
            StreamState::Completed { .. } => return Poll::Ready(Ok(())),
            StreamState::Error { error } => {
                return Poll::Ready(Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    error.clone()
                )));
            }
            StreamState::Closed => {
                return Poll::Ready(Err(std::io::Error::new(
                    std::io::ErrorKind::UnexpectedEof,
                    "流已关闭"
                )));
            }
            _ => {}
        }
        
        // 2. 检查超时
        if let Err(e) = self.timeout_guard.check_timeout() {
            return Poll::Ready(Err(self.handle_error(e)));
        }
        
        // 3. 检查背压 (暂停读取条件)
        if self.buffer_manager.should_pause_reading() {
            log::debug!("缓冲区接近满载，暂停读取");
            // 只在 waker 不存在时才设置
            if self.waker.is_none() {
                self.waker = Some(cx.waker().clone());
            }
            return Poll::Pending;
        }
        
        // 4. 从内部缓冲区读取数据
        if !self.read_buffer.is_empty() {
            let to_copy = std::cmp::min(buf.remaining(), self.read_buffer.len());
            buf.put_slice(&self.read_buffer[..to_copy]);
            self.read_buffer.drain(..to_copy);
            
            // 更新统计
            self.stats.total_bytes_read += to_copy as u64;
            self.stats.read_operations += 1;
            self.stats.last_read_time = Some(Instant::now());
            self.timeout_guard.record_activity();
            
            // 释放缓冲区内存
            self.buffer_manager.deallocate(to_copy);
            
            return Poll::Ready(Ok(()));
        }
        
        // 5. 从底层流读取数据
        match self.inner.as_mut().poll_next(cx) {
            Poll::Ready(Some(Ok(chunk))) => {
                // 检查缓冲区是否可以容纳新数据
                if let Err(e) = self.buffer_manager.can_allocate(chunk.len()) {
                    return Poll::Ready(Err(self.handle_error(e)));
                }
                
                // 分配内存
                if let Err(e) = self.buffer_manager.allocate(chunk.len()) {
                    return Poll::Ready(Err(self.handle_error(e)));
                }
                
                // 将数据添加到内部缓冲区
                self.read_buffer.extend_from_slice(&chunk);
                
                // 更新状态
                let bytes_read = match &self.state {
                    StreamState::Pending => 0,
                    StreamState::Reading { bytes_read } => *bytes_read,
                    _ => 0,
                };
                
                if let Err(e) = self.transition_state(StreamState::Reading {
                    bytes_read: bytes_read + chunk.len() as u64,
                }) {
                    return Poll::Ready(Err(self.handle_error(e)));
                }
                
                // 递归调用，从缓冲区读取数据
                self.poll_read(cx, buf)
            }
            
            Poll::Ready(Some(Err(e))) => {
                Poll::Ready(Err(self.handle_error(e)))
            }
            
            Poll::Ready(None) => {
                // 流结束
                let total_bytes = match &self.state {
                    StreamState::Reading { bytes_read } => *bytes_read,
                    _ => 0,
                };
                
                if let Err(e) = self.transition_state(StreamState::Completed { total_bytes }) {
                    return Poll::Ready(Err(self.handle_error(e)));
                }
                
                Poll::Ready(Ok(()))
            }
            
            Poll::Pending => {
                // 保存waker以便后续唤醒（避免重复设置）
                if self.waker.is_none() {
                    self.waker = Some(cx.waker().clone());
                }
                Poll::Pending
            }
        }
    }
}

impl Drop for SafeWebDAVStream {
    fn drop(&mut self) {
        // 资源清理
        let _ = self.transition_state(StreamState::Closed);
        
        let stats = self.get_stats();
        let buffer_stats = self.get_buffer_stats();
        
        log::info!(
            "WebDAV流关闭 - 读取 {} bytes, 操作 {} 次, 错误 {} 次, 峰值内存 {} bytes",
            stats.total_bytes_read,
            stats.read_operations,
            stats.error_count,
            buffer_stats.peak_usage
        );
        
        // 唤醒等待的任务
        if let Some(waker) = self.waker.take() {
            waker.wake();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_state_transitions() {
        let state = StreamState::Pending;
        assert!(state.can_transition_to(&StreamState::Reading { bytes_read: 0 }));
        assert!(state.can_transition_to(&StreamState::Error { error: "test".to_string() }));
        
        let reading_state = StreamState::Reading { bytes_read: 100 };
        assert!(reading_state.can_transition_to(&StreamState::Completed { total_bytes: 100 }));
        assert!(!reading_state.can_transition_to(&StreamState::Pending));
        
        let completed_state = StreamState::Completed { total_bytes: 100 };
        assert!(completed_state.can_transition_to(&StreamState::Closed));
        assert!(!completed_state.can_transition_to(&StreamState::Reading { bytes_read: 200 }));
    }
    
    #[test]
    fn test_buffer_manager() {
        let mut manager = BufferManager::new(1000, 100);
        
        // 正常分配
        assert!(manager.allocate(500).is_ok());
        assert_eq!(manager.current_size, 500);
        
        // 超出限制
        assert!(manager.allocate(600).is_err());
        
        // 释放内存
        manager.deallocate(200);
        assert_eq!(manager.current_size, 300);
        
        // 现在可以分配更多
        assert!(manager.allocate(600).is_ok());
    }
    
    #[tokio::test]
    async fn test_timeout_guard() {
        let guard = TimeoutGuard::new(
            Duration::from_millis(100),
            Duration::from_millis(50)
        );
        
        // 初始状态应该正常
        assert!(guard.check_timeout().is_ok());
        
        // 等待超过活动超时时间
        tokio::time::sleep(Duration::from_millis(60)).await;
        assert!(guard.check_timeout().is_err());
    }
}
