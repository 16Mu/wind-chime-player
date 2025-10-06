// Sink资源池模块
//
// 核心功能：
// - 复用Sink对象，减少创建开销（每次50-100ms）
// - 池大小管理，避免资源浪费
// - RAII自动归还，避免资源泄漏
// - 线程安全

use rodio::{OutputStreamHandle, Sink};
use std::collections::VecDeque;
use std::sync::Arc;
use parking_lot::Mutex;
use super::super::types::{PlayerError, Result};

/// Sink唯一标识
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct SinkId(u64);

impl SinkId {
    fn new() -> Self {
        use std::sync::atomic::{AtomicU64, Ordering};
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        Self(COUNTER.fetch_add(1, Ordering::SeqCst))
    }
}

/// Sink资源池
/// 
/// 管理Sink对象的生命周期，实现复用机制
pub struct SinkPool {
    inner: Arc<Mutex<SinkPoolInner>>,
}

struct SinkPoolInner {
    /// 可用的Sink队列
    available: VecDeque<Sink>,
    /// 正在使用的Sink数量
    in_use_count: usize,
    /// 音频输出句柄
    handle: OutputStreamHandle,
    /// 池容量限制
    max_size: usize,
    /// 创建统计
    total_created: u64,
    /// 复用统计
    total_reused: u64,
}

impl SinkPool {
    /// 创建Sink资源池
    /// 
    /// # 参数
    /// - `handle`: 音频输出句柄
    /// - `max_size`: 池最大容量
    pub fn new(handle: OutputStreamHandle, max_size: usize) -> Self {
        log::info!("📦 创建Sink资源池（容量: {}）", max_size);
        
        Self {
            inner: Arc::new(Mutex::new(SinkPoolInner {
                available: VecDeque::new(),
                in_use_count: 0,
                handle,
                max_size,
                total_created: 0,
                total_reused: 0,
            })),
        }
    }
    
    /// 创建默认容量的池（容量8）
    pub fn with_default_capacity(handle: OutputStreamHandle) -> Self {
        Self::new(handle, 8)
    }
    
    /// 获取一个Sink（复用或创建）
    /// 
    /// # 返回
    /// - `Ok(PooledSink)`: 成功获取Sink
    /// - `Err(PlayerError)`: 池已满或创建失败
    pub fn acquire(&self) -> Result<PooledSink> {
        let mut inner = self.inner.lock();
        
        let sink = if let Some(sink) = inner.available.pop_front() {
            // 复用已有Sink
            inner.total_reused += 1;
            log::debug!("♻️ 复用现有Sink (复用次数: {})", inner.total_reused);
            sink
        } else if inner.in_use_count + inner.available.len() < inner.max_size {
            // 创建新Sink
            log::debug!("🆕 创建新Sink (总创建数: {})", inner.total_created + 1);
            let sink = Sink::try_new(&inner.handle)
                .map_err(|e| PlayerError::device_error(
                    format!("创建Sink失败: {}", e)
                ))?;
            inner.total_created += 1;
            sink
        } else {
            // 池已满
            log::warn!("⚠️ Sink池已满（使用中: {}, 可用: {}, 最大: {}）",
                inner.in_use_count,
                inner.available.len(),
                inner.max_size
            );
            return Err(PlayerError::resource_exhausted(
                "Sink池已满，请等待释放"
            ));
        };
        
        inner.in_use_count += 1;
        
        let id = SinkId::new();
        
        Ok(PooledSink {
            sink: Some(sink),
            id,
            pool: Arc::clone(&self.inner),
        })
    }
    
    /// 预热池（预先创建Sink）
    pub fn warm_up(&self, count: usize) -> Result<()> {
        let mut inner = self.inner.lock();
        let to_create = count.min(inner.max_size - inner.available.len());
        
        log::info!("🔥 预热Sink池：创建{}个Sink", to_create);
        
        for i in 0..to_create {
            match Sink::try_new(&inner.handle) {
                Ok(sink) => {
                    inner.available.push_back(sink);
                    inner.total_created += 1;
                    log::debug!("✅ 预创建Sink {}/{}", i + 1, to_create);
                }
                Err(e) => {
                    log::error!("❌ 预创建Sink失败: {}", e);
                    return Err(PlayerError::device_error(
                        format!("预创建Sink失败: {}", e)
                    ));
                }
            }
        }
        
        log::info!("✅ Sink池预热完成");
        Ok(())
    }
}

impl Clone for SinkPool {
    fn clone(&self) -> Self {
        Self {
            inner: Arc::clone(&self.inner),
        }
    }
}

/// 池化的Sink（RAII自动归还）
/// 
/// 当PooledSink被drop时，会自动将Sink归还到池中
pub struct PooledSink {
    sink: Option<Sink>,
    id: SinkId,
    pool: Arc<Mutex<SinkPoolInner>>,
}

impl PooledSink {
    /// 获取Sink引用
    pub fn sink(&self) -> &Sink {
        self.sink.as_ref().expect("Sink已被移出")
    }
    
    /// 获取Sink可变引用
    pub fn sink_mut(&mut self) -> &mut Sink {
        self.sink.as_mut().expect("Sink已被移出")
    }
}

impl Drop for PooledSink {
    fn drop(&mut self) {
        if let Some(sink) = self.sink.take() {
            // 🔧 修复：只清理状态，不调用stop()
            // 因为使用者可能已经调用了stop()，避免重复操作
            // 只在归还前清空队列，为下次复用做准备
            sink.clear();
            
            // 归还到池中
            let mut inner = self.pool.lock();
            inner.in_use_count = inner.in_use_count.saturating_sub(1);
            
            // 只有在池未满时才归还
            if inner.available.len() < inner.max_size {
                inner.available.push_back(sink);
                log::debug!("♻️ Sink已归还到池（ID: {:?}, 池大小: {}）", 
                    self.id, inner.available.len());
            } else {
                log::debug!("🗑️ 池已满，丢弃Sink（ID: {:?}）", self.id);
            }
        }
    }
}

impl std::ops::Deref for PooledSink {
    type Target = Sink;
    
    fn deref(&self) -> &Self::Target {
        self.sink()
    }
}

impl std::ops::DerefMut for PooledSink {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.sink_mut()
    }
}

/// Sink池统计信息
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct SinkPoolStats {
    /// 可用Sink数量
    pub available_count: usize,
    /// 使用中Sink数量
    pub in_use_count: usize,
    /// 最大容量
    pub max_size: usize,
    /// 总创建数
    pub total_created: u64,
    /// 总复用数
    pub total_reused: u64,
    /// 复用率
    pub reuse_rate: f64,
}

impl SinkPoolStats {
    /// 获取池使用率（监控功能预留）
    #[allow(dead_code)]
    pub fn utilization(&self) -> f64 {
        if self.max_size > 0 {
            (self.in_use_count + self.available_count) as f64 / self.max_size as f64
        } else {
            0.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    // 注意：这些测试需要有效的音频设备
    // 在CI环境或无音频设备的环境中可能失败
    
    #[test]
    fn test_sink_id_generation() {
        let id1 = SinkId::new();
        let id2 = SinkId::new();
        assert_ne!(id1, id2);
    }
    
    #[test]
    fn test_pool_stats() {
        // 这个测试不需要实际的音频设备
        // 只测试统计信息的计算
        let stats = SinkPoolStats {
            available_count: 3,
            in_use_count: 2,
            max_size: 8,
            total_created: 10,
            total_reused: 40,
            reuse_rate: 0.8,
        };
        
        assert_eq!(stats.utilization(), 5.0 / 8.0);
    }
}
