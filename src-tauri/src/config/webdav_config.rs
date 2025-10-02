// WebDAV配置管理 - 高内聚：专门处理WebDAV服务器的配置
// 低耦合：独立的配置验证和管理逻辑

use super::types::*;
use crate::webdav::AuthType;
use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use url::Url;

/// 🔧 WebDAV服务器配置 - 单一职责：管理单个WebDAV服务器的所有配置项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebDAVServerConfig {
    /// 服务器名称（用户友好的显示名）
    pub name: String,
    
    /// WebDAV服务器URL
    pub url: String,
    
    /// 用户名
    pub username: Option<String>,
    
    /// 密码（加密存储）
    pub password: Option<String>,
    
    /// 认证类型
    pub auth_type: WebDAVAuthType,
    
    /// 是否启用此服务器
    pub enabled: bool,
    
    /// 是否自动同步
    pub auto_sync: bool,
    
    /// 同步方向
    pub sync_direction: SyncDirection,
    
    /// 网络配置
    pub network: NetworkConfig,
    
    /// 重试配置
    pub retry: RetryConfig,
    
    /// 缓存配置
    pub cache: CacheConfig,
    
    /// 根目录路径
    pub root_path: String,
    
    /// 排除的文件模式
    pub exclude_patterns: Vec<String>,
    
    /// 包含的文件模式
    pub include_patterns: Vec<String>,
    
    /// 最大文件大小（字节，0表示无限制）
    pub max_file_size_bytes: u64,
    
    /// 服务器特定选项
    pub server_options: ServerOptions,
}

/// 🔧 WebDAV认证类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WebDAVAuthType {
    /// 无认证
    None,
    /// 基本认证
    Basic,
    /// 摘要认证
    Digest,
    /// Bearer Token
    Bearer { token: String },
    /// 自定义头部认证
    Custom { headers: std::collections::HashMap<String, String> },
}

/// 🔧 同步方向
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncDirection {
    /// 双向同步
    Bidirectional,
    /// 仅从本地到远程
    LocalToRemote,
    /// 仅从远程到本地
    RemoteToLocal,
}

/// 🔧 服务器特定选项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerOptions {
    /// 是否支持分块传输
    pub supports_chunked_transfer: bool,
    
    /// 是否支持Range请求
    pub supports_range_requests: bool,
    
    /// 是否支持并发连接
    pub supports_concurrent_connections: bool,
    
    /// 最大并发连接数
    pub max_concurrent_connections: usize,
    
    /// 服务器类型（用于特定的兼容性处理）
    pub server_type: ServerType,
    
    /// 自定义WebDAV命名空间
    pub custom_namespace: Option<String>,
    
    /// 路径编码方式
    pub path_encoding: PathEncoding,
}

/// 🔧 服务器类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ServerType {
    /// 通用WebDAV服务器
    Generic,
    /// Apache HTTP服务器
    Apache,
    /// Nginx服务器
    Nginx,
    /// NextCloud
    NextCloud,
    /// ownCloud
    OwnCloud,
    /// Synology NAS
    Synology,
    /// 其他指定类型
    Other(String),
}

/// 🔧 路径编码方式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PathEncoding {
    /// UTF-8编码
    UTF8,
    /// URL编码
    UrlEncoded,
    /// 自动检测
    Auto,
}

impl Default for WebDAVServerConfig {
    fn default() -> Self {
        Self {
            name: "新建WebDAV服务器".to_string(),
            url: String::new(),
            username: None,
            password: None,
            auth_type: WebDAVAuthType::Basic,
            enabled: true,
            auto_sync: false,
            sync_direction: SyncDirection::Bidirectional,
            network: NetworkConfig::default(),
            retry: RetryConfig::default(),
            cache: CacheConfig::default(),
            root_path: "/".to_string(),
            exclude_patterns: vec![
                "*.tmp".to_string(),
                "*.bak".to_string(),
                ".DS_Store".to_string(),
                "Thumbs.db".to_string(),
            ],
            include_patterns: vec![
                "*.mp3".to_string(),
                "*.flac".to_string(),
                "*.wav".to_string(),
                "*.ogg".to_string(),
                "*.m4a".to_string(),
                "*.aac".to_string(),
            ],
            max_file_size_bytes: 0, // 无限制
            server_options: ServerOptions::default(),
        }
    }
}

impl Default for ServerOptions {
    fn default() -> Self {
        Self {
            supports_chunked_transfer: true,
            supports_range_requests: true,
            supports_concurrent_connections: true,
            max_concurrent_connections: 4,
            server_type: ServerType::Generic,
            custom_namespace: None,
            path_encoding: PathEncoding::UTF8,
        }
    }
}

impl WebDAVServerConfig {
    /// 创建新的配置实例
    pub fn new(name: String, url: String) -> Self {
        Self {
            name,
            url,
            ..Default::default()
        }
    }
    
    /// 验证配置有效性
    pub fn validate(&self) -> ConfigValidationResult {
        let mut result = ConfigValidationResult::new();
        
        // 验证名称
        if self.name.trim().is_empty() {
            result.add_error("服务器名称不能为空".to_string());
        }
        
        // 验证URL
        if self.url.trim().is_empty() {
            result.add_error("服务器URL不能为空".to_string());
        } else {
            match Url::parse(&self.url) {
                Ok(url) => {
                    if !url.scheme().eq_ignore_ascii_case("http") && !url.scheme().eq_ignore_ascii_case("https") {
                        result.add_error("URL必须是http或https协议".to_string());
                    }
                    
                    if !self.network.verify_ssl && url.scheme().eq_ignore_ascii_case("https") {
                        result.add_warning("HTTPS连接但未启用SSL验证，存在安全风险".to_string());
                    }
                }
                Err(e) => {
                    result.add_error(format!("无效的URL格式: {}", e));
                }
            }
        }
        
        // 验证认证配置
        match &self.auth_type {
            WebDAVAuthType::Basic => {
                if self.username.is_none() || self.password.is_none() {
                    result.add_error("基本认证需要用户名和密码".to_string());
                }
            }
            WebDAVAuthType::Digest => {
                if self.username.is_none() || self.password.is_none() {
                    result.add_error("摘要认证需要用户名和密码".to_string());
                }
            }
            WebDAVAuthType::Bearer { token } => {
                if token.trim().is_empty() {
                    result.add_error("Bearer认证需要token".to_string());
                }
            }
            WebDAVAuthType::Custom { headers } => {
                if headers.is_empty() {
                    result.add_error("自定义认证需要至少一个头部".to_string());
                }
            }
            WebDAVAuthType::None => {
                result.add_warning("未配置认证，可能无法访问受保护的资源".to_string());
            }
        }
        
        // 验证根路径
        if !self.root_path.starts_with('/') {
            result.add_error("根路径必须以'/'开头".to_string());
        }
        
        // 验证网络配置
        if self.network.connection_timeout_seconds == 0 {
            result.add_error("连接超时时间必须大于0".to_string());
        }
        
        if self.network.max_redirects > 10 {
            result.add_warning("重定向次数过多可能导致性能问题".to_string());
        }
        
        // 验证文件大小限制
        if self.max_file_size_bytes > 0 && self.max_file_size_bytes < 1024 * 1024 {
            result.add_warning("文件大小限制过小，可能影响音乐文件同步".to_string());
        }
        
        // 验证并发连接数
        if self.server_options.max_concurrent_connections == 0 {
            result.add_error("最大并发连接数必须大于0".to_string());
        } else if self.server_options.max_concurrent_connections > 20 {
            result.add_warning("并发连接数过多可能对服务器造成压力".to_string());
        }
        
        result
    }
    
    /// 获取有效的WebDAV URL
    pub fn get_webdav_url(&self) -> Result<Url> {
        let mut url = Url::parse(&self.url)
            .context("解析WebDAV URL失败")?;
        
        // 确保路径以根路径开始
        if !self.root_path.is_empty() && self.root_path != "/" {
            let mut path = url.path().to_string();
            if !path.ends_with('/') {
                path.push('/');
            }
            path.push_str(&self.root_path.trim_start_matches('/'));
            url.set_path(&path);
        }
        
        Ok(url)
    }
    
    /// 转换为WebDAV客户端的认证类型
    pub fn to_webdav_auth(&self) -> Result<AuthType> {
        match &self.auth_type {
            WebDAVAuthType::None => Ok(AuthType::None),
            WebDAVAuthType::Basic => {
                match (&self.username, &self.password) {
                    (Some(username), Some(password)) => {
                        Ok(AuthType::Basic {
                            username: username.clone(),
                            password: password.clone(),
                        })
                    }
                    _ => Err(anyhow::anyhow!("基本认证缺少用户名或密码"))
                }
            }
            WebDAVAuthType::Digest => {
                match (&self.username, &self.password) {
                    (Some(username), Some(password)) => {
                        Ok(AuthType::Digest {
                            username: username.clone(),
                            password: password.clone(),
                            realm: Some(String::new()), // 将在实际认证时填充
                            nonce: Some(String::new()), // 将在实际认证时填充
                        })
                    }
                    _ => Err(anyhow::anyhow!("摘要认证缺少用户名或密码"))
                }
            }
            WebDAVAuthType::Bearer { token } => {
                Ok(AuthType::Bearer { token: token.clone() })
            }
            WebDAVAuthType::Custom { .. } => {
                Err(anyhow::anyhow!("自定义认证暂未支持"))
            }
        }
    }
    
    /// 测试服务器连接
    pub async fn test_connection(&self) -> Result<bool> {
        // 这里应该实际测试连接，暂时返回配置验证结果
        let validation = self.validate();
        if validation.has_errors() {
            return Err(anyhow::anyhow!("配置验证失败: {:?}", validation.errors));
        }
        
        log::info!("WebDAV服务器连接测试: {}", self.name);
        // TODO: 实际的连接测试逻辑
        Ok(true)
    }
    
    /// 检查文件是否应该被包含（基于包含/排除模式）
    pub fn should_include_file(&self, file_path: &str) -> bool {
        let file_name = std::path::Path::new(file_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(file_path);
        
        // 先检查排除模式
        for pattern in &self.exclude_patterns {
            if Self::matches_pattern(file_name, pattern) {
                return false;
            }
        }
        
        // 如果没有包含模式，则包含所有文件
        if self.include_patterns.is_empty() {
            return true;
        }
        
        // 检查包含模式
        for pattern in &self.include_patterns {
            if Self::matches_pattern(file_name, pattern) {
                return true;
            }
        }
        
        false
    }
    
    /// 简单的通配符模式匹配
    fn matches_pattern(text: &str, pattern: &str) -> bool {
        // 简化的通配符匹配，支持 * 和 ?
        let pattern_lower = pattern.to_lowercase();
        let text_lower = text.to_lowercase();
        
        if pattern_lower == "*" {
            return true;
        }
        
        if pattern_lower.contains('*') {
            let parts: Vec<&str> = pattern_lower.split('*').collect();
            if parts.len() == 2 {
                let prefix = parts[0];
                let suffix = parts[1];
                return text_lower.starts_with(prefix) && text_lower.ends_with(suffix);
            }
        }
        
        text_lower == pattern_lower
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_config_validation() {
        let mut config = WebDAVServerConfig::default();
        config.name = "Test Server".to_string();
        config.url = "https://example.com/dav".to_string();
        config.username = Some("user".to_string());
        config.password = Some("pass".to_string());
        
        let validation = config.validate();
        assert!(validation.valid, "配置应该有效");
    }
    
    #[test]
    fn test_invalid_url() {
        let mut config = WebDAVServerConfig::default();
        config.url = "invalid-url".to_string();
        
        let validation = config.validate();
        assert!(!validation.valid, "无效URL应该导致验证失败");
        assert!(validation.errors.iter().any(|e| e.contains("无效的URL格式")));
    }
    
    #[test]
    fn test_file_inclusion() {
        let config = WebDAVServerConfig::default();
        
        assert!(config.should_include_file("song.mp3"));
        assert!(config.should_include_file("album/track.flac"));
        assert!(!config.should_include_file("temp.tmp"));
        assert!(!config.should_include_file(".DS_Store"));
    }
    
    #[test]
    fn test_pattern_matching() {
        assert!(WebDAVServerConfig::matches_pattern("test.mp3", "*.mp3"));
        assert!(WebDAVServerConfig::matches_pattern("document.pdf", "*.pdf"));
        assert!(!WebDAVServerConfig::matches_pattern("test.mp3", "*.flac"));
        assert!(WebDAVServerConfig::matches_pattern("anything", "*"));
    }
}
