// 配置相关数据类型 - 高内聚：统一管理所有配置相关的类型定义

use serde::{Deserialize, Serialize};

/// 🔧 加密相关配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionConfig {
    /// 加密算法
    pub algorithm: String,
    
    /// 密钥派生函数
    pub key_derivation: String,
    
    /// 盐值长度
    pub salt_length: usize,
    
    /// 迭代次数
    pub iterations: u32,
}

/// 🔧 网络相关配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConfig {
    /// 连接超时（秒）
    pub connection_timeout_seconds: u64,
    
    /// 读取超时（秒）
    pub read_timeout_seconds: u64,
    
    /// 最大重定向次数
    pub max_redirects: u32,
    
    /// 用户代理
    pub user_agent: String,
    
    /// 是否验证SSL证书
    pub verify_ssl: bool,
    
    /// 代理配置
    pub proxy: Option<ProxyConfig>,
}

/// 🔧 代理配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    /// 代理类型 (http, socks5)
    pub proxy_type: String,
    
    /// 代理地址
    pub host: String,
    
    /// 代理端口
    pub port: u16,
    
    /// 代理用户名
    pub username: Option<String>,
    
    /// 代理密码
    pub password: Option<String>,
}

/// 🔧 重试配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryConfig {
    /// 最大重试次数
    pub max_retries: u32,
    
    /// 初始重试延迟（毫秒）
    pub initial_delay_ms: u64,
    
    /// 最大重试延迟（毫秒）
    pub max_delay_ms: u64,
    
    /// 延迟倍增因子
    pub backoff_multiplier: f64,
    
    /// 重试的错误类型
    pub retry_on: Vec<String>,
}

/// 🔧 缓存配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    /// 是否启用缓存
    pub enabled: bool,
    
    /// 最大缓存大小（字节）
    pub max_size_bytes: u64,
    
    /// 缓存过期时间（秒）
    pub expire_seconds: u64,
    
    /// 清理间隔（秒）
    pub cleanup_interval_seconds: u64,
    
    /// 缓存策略
    pub strategy: CacheStrategy,
    
    /// 预取配置
    pub prefetch: PrefetchConfig,
}

/// 🔧 缓存策略
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CacheStrategy {
    /// 最近最少使用
    LRU,
    /// 最近最不常用
    LFU,
    /// 先进先出
    FIFO,
    /// 时间感知最近最少使用
    TimedLRU,
}

/// 🔧 预取配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrefetchConfig {
    /// 是否启用预取
    pub enabled: bool,
    
    /// 预取队列大小
    pub queue_size: usize,
    
    /// 预取触发阈值（剩余时间百分比）
    pub trigger_threshold: f64,
    
    /// 预取并发数
    pub concurrent_downloads: usize,
}

/// 🔧 配置验证结果
#[derive(Debug, Clone)]
pub struct ConfigValidationResult {
    /// 是否有效
    pub valid: bool,
    
    /// 错误信息
    pub errors: Vec<String>,
    
    /// 警告信息
    pub warnings: Vec<String>,
}

/// 🔧 配置迁移信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigMigration {
    /// 源版本
    pub from_version: String,
    
    /// 目标版本
    pub to_version: String,
    
    /// 迁移描述
    pub description: String,
    
    /// 迁移时间
    pub migrated_at: i64,
}

impl Default for EncryptionConfig {
    fn default() -> Self {
        Self {
            algorithm: "AES-256-GCM".to_string(),
            key_derivation: "PBKDF2".to_string(),
            salt_length: 32,
            iterations: 100000,
        }
    }
}

impl Default for NetworkConfig {
    fn default() -> Self {
        Self {
            connection_timeout_seconds: 30,
            read_timeout_seconds: 60,
            max_redirects: 5,
            user_agent: format!("WindChime/{}", env!("CARGO_PKG_VERSION")),
            verify_ssl: true,
            proxy: None,
        }
    }
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            initial_delay_ms: 1000,
            max_delay_ms: 30000,
            backoff_multiplier: 2.0,
            retry_on: vec![
                "connection_timeout".to_string(),
                "read_timeout".to_string(),
                "server_error".to_string(),
            ],
        }
    }
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            max_size_bytes: 1024 * 1024 * 1024, // 1GB
            expire_seconds: 24 * 60 * 60, // 24小时
            cleanup_interval_seconds: 60 * 60, // 1小时
            strategy: CacheStrategy::LRU,
            prefetch: PrefetchConfig::default(),
        }
    }
}

impl Default for PrefetchConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            queue_size: 5,
            trigger_threshold: 0.8, // 80%
            concurrent_downloads: 2,
        }
    }
}

impl ConfigValidationResult {
    pub fn new() -> Self {
        Self {
            valid: true,
            errors: Vec::new(),
            warnings: Vec::new(),
        }
    }
    
    pub fn add_error(&mut self, error: String) {
        self.valid = false;
        self.errors.push(error);
    }
    
    pub fn add_warning(&mut self, warning: String) {
        self.warnings.push(warning);
    }
    
    pub fn has_errors(&self) -> bool {
        !self.errors.is_empty()
    }
    
    pub fn has_warnings(&self) -> bool {
        !self.warnings.is_empty()
    }
}

