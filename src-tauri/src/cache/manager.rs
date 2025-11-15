// 智能缓存管理器

use super::{CacheConfig, CachePriority, CacheStats};
use super::lru::LruCache;
use std::path::PathBuf;
use std::sync::Arc;
use parking_lot::Mutex;
use tokio::fs;
use tokio::io::AsyncWriteExt;

/// 缓存管理器
pub struct CacheManager {
    config: Arc<Mutex<CacheConfig>>,
    lru: Arc<Mutex<LruCache>>,
    stats: Arc<Mutex<CacheStats>>,
}

impl CacheManager {
    /// 创建新的缓存管理器
    pub fn new(config: CacheConfig) -> Result<Self, String> {
        config.validate()?;
        
        let cache_dir = config.ensure_cache_dir()
            .map_err(|e| format!("创建缓存目录失败: {}", e))?;
        
        let mut lru = LruCache::new(cache_dir, config.max_size_mb);
        lru.load_existing()
            .map_err(|e| format!("加载现有缓存失败: {}", e))?;
        
        Ok(Self {
            config: Arc::new(Mutex::new(config)),
            lru: Arc::new(Mutex::new(lru)),
            stats: Arc::new(Mutex::new(CacheStats::default())),
        })
    }
    
    /// 更新配置
    pub fn update_config(&self, new_config: CacheConfig) -> Result<(), String> {
        new_config.validate()?;
        
        let mut config = self.config.lock();
        let mut lru = self.lru.lock();
        
        // 如果缓存路径变化，需要迁移
        if config.cache_path != new_config.cache_path {
            log::info!("缓存路径变化，需要迁移: {:?} -> {:?}", 
                config.cache_path, new_config.cache_path);
            // TODO: 实现缓存迁移
        }
        
        // 如果最大大小变小，需要清理
        if new_config.max_size_mb < config.max_size_mb {
            log::info!("缓存大小限制变小: {} MB -> {} MB", 
                config.max_size_mb, new_config.max_size_mb);
            // LRU会自动清理
        }
        
        *config = new_config;
        
        Ok(())
    }
    
    /// 获取配置
    pub fn get_config(&self) -> CacheConfig {
        self.config.lock().clone()
    }
    
    /// 检查是否已缓存
    pub fn is_cached(&self, track_id: i64) -> bool {
        self.lru.lock().contains(track_id)
    }
    
    /// 获取缓存文件路径
    pub fn get_cached_path(&self, track_id: i64) -> Option<PathBuf> {
        self.lru.lock().get_path(track_id)
    }
    
    /// 判断是否应该缓存此曲目
    pub fn should_cache(
        &self,
        _track_id: i64,
        is_favorite: bool,
        play_count: u32,
        last_played_days_ago: u32,
    ) -> (bool, CachePriority) {
        let config = self.config.lock();
        
        if !config.enabled {
            return (false, CachePriority::Low);
        }
        
        // 规则1：收藏的歌曲 → 高优先级，必定缓存
        if config.auto_cache_favorites && is_favorite {
            return (true, CachePriority::High);
        }
        
        // 规则2：播放次数 >= min_play_count → 中优先级，缓存
        if play_count >= config.min_play_count {
            return (true, CachePriority::Medium);
        }
        
        // 规则3：最近N天播放过 → 中优先级，缓存
        if last_played_days_ago <= config.cache_recent_days {
            return (true, CachePriority::Medium);
        }
        
        // 规则4：第一次播放 → 不缓存，流式播放
        (false, CachePriority::Low)
    }
    
    /// 添加缓存文件
    pub async fn add_cache(
        &self,
        track_id: i64,
        data: Vec<u8>,
        extension: &str,
        priority: CachePriority,
    ) -> Result<PathBuf, String> {
        let config = self.config.lock();
        
        if !config.enabled {
            return Err("缓存已禁用".to_string());
        }
        
        drop(config);
        
        let file_size = data.len() as u64;
        
        // 生成缓存文件路径
        let cache_path = {
            let lru = self.lru.lock();
            lru.generate_cache_path(track_id, extension)
        };
        
        // 写入文件
        let mut file = fs::File::create(&cache_path).await
            .map_err(|e| format!("创建缓存文件失败: {}", e))?;
        
        file.write_all(&data).await
            .map_err(|e| format!("写入缓存文件失败: {}", e))?;
        
        file.sync_all().await
            .map_err(|e| format!("同步缓存文件失败: {}", e))?;
        
        // 添加到LRU
        {
            let mut lru = self.lru.lock();
            lru.add(track_id, cache_path.clone(), file_size, priority)?;
        }
        
        // 更新统计
        self.update_stats();
        
        log::info!("缓存文件已添加: track_id={}, size={:.2} MB, priority={:?}",
            track_id,
            file_size as f64 / 1024.0 / 1024.0,
            priority
        );
        
        Ok(cache_path)
    }
    
    /// 标记缓存访问（更新LRU）
    pub fn touch_cache(&self, track_id: i64) {
        let mut lru = self.lru.lock();
        lru.touch(track_id);
    }
    
    /// 设置缓存优先级
    pub fn set_priority(&self, track_id: i64, priority: CachePriority) {
        let mut lru = self.lru.lock();
        lru.set_priority(track_id, priority);
    }
    
    /// 删除缓存
    pub fn remove_cache(&self, track_id: i64) -> Result<(), String> {
        let mut lru = self.lru.lock();
        lru.remove(track_id)?;
        
        self.update_stats();
        
        Ok(())
    }
    
    /// 自动清理过期缓存
    pub fn auto_cleanup(&self) -> Result<u32, String> {
        let config = self.config.lock();
        let days = config.cleanup_policy.auto_cleanup_days;
        drop(config);
        
        let mut lru = self.lru.lock();
        let count = lru.cleanup_old(days)?;
        drop(lru);
        
        self.update_stats();
        
        log::info!("自动清理完成: 删除 {} 个过期缓存", count);
        
        Ok(count)
    }
    
    /// 清空所有缓存
    pub fn clear_all(&self) -> Result<(), String> {
        let mut lru = self.lru.lock();
        lru.clear_all()?;
        drop(lru);
        
        self.update_stats();
        
        Ok(())
    }
    
    /// 更新统计信息
    fn update_stats(&self) {
        let lru = self.lru.lock();
        let (file_count, total_bytes, high_count, medium_count, low_count) = lru.get_stats();
        drop(lru);
        
        let config = self.config.lock();
        let max_size_mb = config.max_size_mb;
        drop(config);
        
        let total_size_mb = total_bytes as f64 / 1024.0 / 1024.0;
        
        let mut stats = self.stats.lock();
        stats.file_count = file_count;
        stats.total_size_mb = total_size_mb;
        stats.high_priority_count = high_count;
        stats.medium_priority_count = medium_count;
        stats.low_priority_count = low_count;
        stats.calculate_usage(max_size_mb);
    }
    
    /// 获取统计信息
    pub fn get_stats(&self) -> CacheStats {
        self.stats.lock().clone()
    }
}

// TODO: 添加单元测试

