// LRU缓存管理器

use super::{CacheEntry, CachePriority};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use chrono::Utc;

/// LRU缓存管理器
pub struct LruCache {
    /// 缓存条目映射
    entries: HashMap<i64, CacheEntry>,
    
    /// 缓存目录
    cache_dir: PathBuf,
    
    /// 最大缓存大小（字节）
    max_size_bytes: u64,
    
    /// 当前缓存大小（字节）
    current_size_bytes: u64,
}

impl LruCache {
    /// 创建新的LRU缓存
    pub fn new(cache_dir: PathBuf, max_size_mb: u64) -> Self {
        Self {
            entries: HashMap::new(),
            cache_dir,
            max_size_bytes: max_size_mb * 1024 * 1024,
            current_size_bytes: 0,
        }
    }
    
    /// 加载现有缓存（从磁盘扫描）
    pub fn load_existing(&mut self) -> Result<(), std::io::Error> {
        if !self.cache_dir.exists() {
            std::fs::create_dir_all(&self.cache_dir)?;
            return Ok(());
        }
        
        self.current_size_bytes = 0;
        
        for entry in std::fs::read_dir(&self.cache_dir)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_file() {
                if let Some(track_id) = Self::extract_track_id(&path) {
                    let metadata = std::fs::metadata(&path)?;
                    let file_size = metadata.len();
                    
                    self.current_size_bytes += file_size;
                    
                    // 创建缓存条目
                    let cache_entry = CacheEntry {
                        track_id,
                        file_path: path.to_string_lossy().to_string(),
                        file_size,
                        priority: CachePriority::Medium,  // 默认中优先级
                        play_count: 0,
                        last_played: Utc::now().timestamp(),
                        created_at: Utc::now().timestamp(),
                        last_accessed: Utc::now().timestamp(),
                    };
                    
                    self.entries.insert(track_id, cache_entry);
                }
            }
        }
        
        log::info!("加载现有缓存: {} 个文件, {:.2} MB", 
            self.entries.len(),
            self.current_size_bytes as f64 / 1024.0 / 1024.0
        );
        
        Ok(())
    }
    
    /// 从文件名提取track ID
    fn extract_track_id(path: &Path) -> Option<i64> {
        path.file_stem()
            .and_then(|s| s.to_str())
            .and_then(|s| s.split('_').next())
            .and_then(|s| s.parse::<i64>().ok())
    }
    
    /// 检查是否已缓存
    pub fn contains(&self, track_id: i64) -> bool {
        self.entries.contains_key(&track_id)
    }
    
    /// 获取缓存文件路径
    pub fn get_path(&self, track_id: i64) -> Option<PathBuf> {
        self.entries.get(&track_id)
            .map(|entry| PathBuf::from(&entry.file_path))
    }
    
    /// 添加缓存条目
    pub fn add(&mut self, track_id: i64, file_path: PathBuf, file_size: u64, priority: CachePriority) -> Result<(), String> {
        // 检查空间
        if self.current_size_bytes + file_size > self.max_size_bytes {
            // 需要清理空间
            self.make_space(file_size)?;
        }
        
        let entry = CacheEntry {
            track_id,
            file_path: file_path.to_string_lossy().to_string(),
            file_size,
            priority,
            play_count: 1,
            last_played: Utc::now().timestamp(),
            created_at: Utc::now().timestamp(),
            last_accessed: Utc::now().timestamp(),
        };
        
        self.current_size_bytes += file_size;
        self.entries.insert(track_id, entry);
        
        Ok(())
    }
    
    /// 更新访问时间和播放次数
    pub fn touch(&mut self, track_id: i64) {
        if let Some(entry) = self.entries.get_mut(&track_id) {
            entry.last_accessed = Utc::now().timestamp();
            entry.last_played = Utc::now().timestamp();
            entry.play_count += 1;
        }
    }
    
    /// 更新优先级
    pub fn set_priority(&mut self, track_id: i64, priority: CachePriority) {
        if let Some(entry) = self.entries.get_mut(&track_id) {
            entry.priority = priority;
        }
    }
    
    /// 腾出空间（LRU清理）
    fn make_space(&mut self, needed_bytes: u64) -> Result<(), String> {
        let mut sorted_entries: Vec<_> = self.entries.values().collect();
        
        // 按得分排序（低分优先删除）
        sorted_entries.sort_by_key(|entry| entry.score());
        
        let mut freed_bytes = 0u64;
        let mut to_remove = Vec::new();
        
        for entry in sorted_entries {
            // 高优先级的不删除
            if entry.priority == CachePriority::High {
                continue;
            }
            
            to_remove.push(entry.track_id);
            freed_bytes += entry.file_size;
            
            if freed_bytes >= needed_bytes {
                break;
            }
        }
        
        if freed_bytes < needed_bytes {
            return Err(format!("无法腾出足够空间: 需要 {} MB，仅能释放 {} MB",
                needed_bytes / 1024 / 1024,
                freed_bytes / 1024 / 1024
            ));
        }
        
        // 删除文件
        for track_id in to_remove {
            self.remove(track_id)?;
        }
        
        log::info!("腾出空间: {:.2} MB", freed_bytes as f64 / 1024.0 / 1024.0);
        
        Ok(())
    }
    
    /// 删除缓存条目
    pub fn remove(&mut self, track_id: i64) -> Result<(), String> {
        if let Some(entry) = self.entries.remove(&track_id) {
            // 删除文件
            if let Err(e) = std::fs::remove_file(&entry.file_path) {
                log::warn!("删除缓存文件失败: {} - {:?}", entry.file_path, e);
            }
            
            self.current_size_bytes = self.current_size_bytes.saturating_sub(entry.file_size);
        }
        
        Ok(())
    }
    
    /// 清理过期缓存（N天未播放）
    pub fn cleanup_old(&mut self, days: u32) -> Result<u32, String> {
        let now = Utc::now().timestamp();
        let threshold = now - (days as i64 * 86400);
        
        let mut to_remove = Vec::new();
        
        for (track_id, entry) in &self.entries {
            // 高优先级的不清理
            if entry.priority == CachePriority::High {
                continue;
            }
            
            if entry.last_played < threshold {
                to_remove.push(*track_id);
            }
        }
        
        let count = to_remove.len() as u32;
        
        for track_id in to_remove {
            self.remove(track_id)?;
        }
        
        log::info!("清理过期缓存: {} 个文件", count);
        
        Ok(count)
    }
    
    /// 获取统计信息
    pub fn get_stats(&self) -> (u32, u64, u32, u32, u32) {
        let mut high_count = 0u32;
        let mut medium_count = 0u32;
        let mut low_count = 0u32;
        
        for entry in self.entries.values() {
            match entry.priority {
                CachePriority::High => high_count += 1,
                CachePriority::Medium => medium_count += 1,
                CachePriority::Low => low_count += 1,
            }
        }
        
        (
            self.entries.len() as u32,
            self.current_size_bytes,
            high_count,
            medium_count,
            low_count,
        )
    }
    
    /// 清空所有缓存
    pub fn clear_all(&mut self) -> Result<(), String> {
        let track_ids: Vec<_> = self.entries.keys().copied().collect();
        
        for track_id in track_ids {
            self.remove(track_id)?;
        }
        
        log::info!("清空所有缓存");
        
        Ok(())
    }
    
    /// 获取缓存文件路径（生成）
    pub fn generate_cache_path(&self, track_id: i64, extension: &str) -> PathBuf {
        self.cache_dir.join(format!("{}_{}.{}", track_id, Utc::now().timestamp(), extension))
    }
}






