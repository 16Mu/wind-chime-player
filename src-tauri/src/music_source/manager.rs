// 音乐源管理器 - 高内聚：统一管理所有音乐源提供器
// 低耦合：通过依赖注入和事件系统与其他模块通信

use super::*;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use anyhow::Result;

/// 🎵 音乐源管理器 - 统一管理所有音乐源
pub struct MusicSourceManager {
    /// 注册的提供器 - 低耦合：通过HashMap管理不同类型的提供器
    providers: HashMap<String, Arc<dyn MusicSourceProvider>>,
    
    /// 配置信息 - 外部化配置
    configs: Arc<RwLock<HashMap<String, MusicSourceConfig>>>,
    
    /// 事件发送器 - 事件驱动架构
    event_sender: Option<tokio::sync::broadcast::Sender<MusicSourceEvent>>,
}

impl MusicSourceManager {
    /// 创建新的管理器实例
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
            configs: Arc::new(RwLock::new(HashMap::new())),
            event_sender: None,
        }
    }
    
    /// 设置事件发送器 - 低耦合：可选的事件系统
    pub fn with_event_sender(mut self, sender: tokio::sync::broadcast::Sender<MusicSourceEvent>) -> Self {
        self.event_sender = Some(sender);
        self
    }
    
    /// 注册音乐源提供器 - 依赖注入模式
    pub fn register_provider(&mut self, source_type: &str, provider: Arc<dyn MusicSourceProvider>) {
        self.providers.insert(source_type.to_string(), provider);
        log::info!("已注册音乐源提供器: {}", source_type);
    }
    
    /// 获取适合的提供器 - 单一职责：根据音乐源类型选择提供器
    fn get_provider(&self, source: &MusicSource) -> Result<&Arc<dyn MusicSourceProvider>> {
        let source_type = match source {
            MusicSource::Local { .. } => "local",
            MusicSource::WebDAV { .. } => "webdav",
            MusicSource::Cached { .. } => {
                // 缓存文件优先使用本地提供器
                return self.providers.get("local")
                    .ok_or_else(|| anyhow::anyhow!("本地提供器未注册"));
            }
        };
        
        self.providers.get(source_type)
            .ok_or_else(|| anyhow::anyhow!("未找到 {} 类型的提供器", source_type))
    }
    
    /// 创建音频流 - 代理模式：统一接口
    pub async fn create_stream(&self, source: &MusicSource) -> Result<Box<dyn AsyncRead + Send + Unpin>> {
        let provider = self.get_provider(source)?;
        provider.create_stream(source).await
    }
    
    /// 获取音频元数据
    pub async fn get_metadata(&self, source: &MusicSource) -> Result<AudioMetadata> {
        let provider = self.get_provider(source)?;
        provider.get_metadata(source).await
    }
    
    /// 检查文件是否存在
    pub async fn exists(&self, source: &MusicSource) -> Result<bool> {
        let provider = self.get_provider(source)?;
        provider.exists(source).await
    }
    
    /// 获取文件大小
    pub async fn get_file_size(&self, source: &MusicSource) -> Result<u64> {
        let provider = self.get_provider(source)?;
        provider.get_file_size(source).await
    }
    
    /// 创建范围流
    pub async fn create_range_stream(
        &self,
        source: &MusicSource,
        start: u64,
        end: Option<u64>
    ) -> Result<Box<dyn AsyncRead + Send + Unpin>> {
        let provider = self.get_provider(source)?;
        provider.create_range_stream(source, start, end).await
    }
    
    /// 检查音乐源能力
    pub fn get_source_capabilities(&self, source: &MusicSource) -> SourceCapabilities {
        source.get_capabilities()
    }
    
    /// 验证音乐源
    pub async fn validate_source(&self, source: &MusicSource) -> SourceOperationResult {
        match self.exists(source).await {
            Ok(true) => SourceOperationResult::Success,
            Ok(false) => SourceOperationResult::FileNotFound,
            Err(e) => {
                let error_msg = e.to_string();
                if error_msg.contains("network") || error_msg.contains("connection") {
                    SourceOperationResult::NetworkError(error_msg)
                } else if error_msg.contains("permission") || error_msg.contains("unauthorized") {
                    SourceOperationResult::InsufficientPermissions
                } else if error_msg.contains("timeout") {
                    SourceOperationResult::Timeout
                } else {
                    SourceOperationResult::Failed(error_msg)
                }
            }
        }
    }
    
    /// 批量验证音乐源
    pub async fn validate_sources(&self, sources: &[MusicSource]) -> Vec<(MusicSource, SourceOperationResult)> {
        let mut results = Vec::new();
        
        for source in sources {
            let result = self.validate_source(source).await;
            results.push((source.clone(), result));
        }
        
        results
    }
    
    /// 获取音乐源统计信息
    pub async fn get_source_statistics(&self, source_type: &str) -> Result<SourceStatistics> {
        // 这里需要与数据库层交互，先返回默认值
        // 在实际实现中，这应该通过依赖注入的方式获取数据库访问
        Ok(SourceStatistics {
            source_type: source_type.to_string(),
            total_files: 0,
            total_size_bytes: 0,
            cached_files: 0,
            cached_size_bytes: 0,
            sync_pending: 0,
            sync_conflicts: 0,
            last_scan_time: None,
            is_online: true,
        })
    }
    
    /// 添加音乐源配置
    pub async fn add_source_config(&self, config: MusicSourceConfig) -> Result<()> {
        let mut configs = self.configs.write().await;
        configs.insert(config.source_id.clone(), config);
        Ok(())
    }
    
    /// 获取音乐源配置
    pub async fn get_source_config(&self, source_id: &str) -> Option<MusicSourceConfig> {
        let configs = self.configs.read().await;
        configs.get(source_id).cloned()
    }
    
    /// 更新音乐源配置
    pub async fn update_source_config(&self, source_id: &str, config: MusicSourceConfig) -> Result<()> {
        let mut configs = self.configs.write().await;
        configs.insert(source_id.to_string(), config);
        Ok(())
    }
    
    /// 删除音乐源配置
    pub async fn remove_source_config(&self, source_id: &str) -> Result<()> {
        let mut configs = self.configs.write().await;
        configs.remove(source_id);
        Ok(())
    }
    
    /// 获取所有配置
    pub async fn get_all_configs(&self) -> HashMap<String, MusicSourceConfig> {
        let configs = self.configs.read().await;
        configs.clone()
    }
    
    /// 发送事件 - 低耦合：可选的事件系统
    fn emit_event(&self, event: MusicSourceEvent) {
        if let Some(sender) = &self.event_sender {
            let _ = sender.send(event); // 忽略发送失败，不应该阻塞主要逻辑
        }
    }
    
    /// 通知源可用性变化
    pub fn notify_source_availability(&self, source_id: &str, is_available: bool) {
        self.emit_event(MusicSourceEvent::SourceAvailabilityChanged {
            source_id: source_id.to_string(),
            is_available,
        });
    }
}

/// 🎵 音乐源工厂 - 工厂模式：创建合适的音乐源实例
pub struct MusicSourceFactory;

impl MusicSourceFactory {
    /// 从路径创建音乐源
    pub fn create_from_path(path: &str) -> MusicSource {
        if path.starts_with("http://") || path.starts_with("https://") {
            // 这里需要更复杂的逻辑来解析WebDAV URL
            // 暂时返回本地源
            MusicSource::Local { 
                path: path.to_string() 
            }
        } else {
            MusicSource::Local { 
                path: path.to_string() 
            }
        }
    }
    
    /// 创建WebDAV音乐源
    pub fn create_webdav_source(server_id: &str, remote_path: &str, base_url: &str) -> MusicSource {
        MusicSource::WebDAV {
            server_id: server_id.to_string(),
            remote_path: remote_path.to_string(),
            url: format!("{}/{}", base_url.trim_end_matches('/'), remote_path.trim_start_matches('/')),
        }
    }
    
    /// 创建缓存音乐源
    pub fn create_cached_source(
        original_source: MusicSource, 
        cache_path: &str,
        cache_expiry: Option<i64>
    ) -> MusicSource {
        MusicSource::Cached {
            original_source: Box::new(original_source),
            local_cache_path: cache_path.to_string(),
            cache_expiry,
        }
    }
}

// 默认实现
impl Default for MusicSourceManager {
    fn default() -> Self {
        Self::new()
    }
}
