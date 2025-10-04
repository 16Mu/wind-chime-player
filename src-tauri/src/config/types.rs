// 配置相关数据类型 - 简化版，只保留实际使用的配置

use serde::{Deserialize, Serialize};

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
        }
    }
}
