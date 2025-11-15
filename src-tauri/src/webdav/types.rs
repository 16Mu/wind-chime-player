// WebDAV类型定义 - 高内聚：专注于WebDAV协议相关的数据结构

use serde::{Deserialize, Serialize};
use std::fmt;

/// WebDAV操作结果类型
pub type WebDAVResult<T> = Result<T, WebDAVError>;

/// WebDAV错误类型 - 单一职责：统一错误处理
#[derive(Debug, thiserror::Error)]
#[allow(dead_code)]
pub enum WebDAVError {
    #[error("网络错误: {0}")]
    NetworkError(#[from] reqwest::Error),
    
    #[error("HTTP状态错误: {status}, 消息: {message}")]
    HttpStatusError { status: u16, message: String },
    
    #[error("认证失败: {0}")]
    AuthenticationFailed(String),
    
    #[error("文件未找到: {path}")]
    FileNotFound { path: String },
    
    #[error("权限不足: {operation}")]
    PermissionDenied { operation: String },
    
    #[error("服务器错误: {0}")]
    ServerError(String),
    
    #[error("XML解析错误: {0}")]
    XmlParseError(#[from] serde_xml_rs::Error),
    
    #[error("IO错误: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("超时错误")]
    Timeout,
    
    #[error("不支持的操作: {0}")]
    UnsupportedOperation(String),
    
    #[error("配置错误: {0}")]
    ConfigError(String),
    
    #[error("HTTP方法错误: {0}")]
    HttpMethodError(#[from] http::method::InvalidMethod),
}

/// HTTP协议版本偏好
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HttpProtocolPreference {
    /// 自动协商（默认）
    #[serde(rename = "auto")]
    Auto,
    /// 仅HTTP/1.1（兼容性最好，适合坚果云等）
    #[serde(rename = "http1")]
    Http1Only,
    /// 优先HTTP/2（性能更好，适合现代服务器）
    #[serde(rename = "http2_preferred")]
    Http2Preferred,
}

impl Default for HttpProtocolPreference {
    fn default() -> Self {
        Self::Http1Only // 默认使用HTTP/1.1以提高兼容性
    }
}

/// WebDAV服务器配置 - 单一职责：服务器连接信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebDAVConfig {
    pub server_id: String,
    pub name: String,
    pub url: String,
    /// WebDAV挂载路径（可选，如 /webdav, /dav/ 等）
    #[serde(default)]
    pub mount_path: String,
    pub username: String,
    pub password: String,
    pub timeout_seconds: u64,
    pub max_redirects: u32,
    pub verify_ssl: bool,
    pub user_agent: String,
    /// HTTP协议偏好（可选，默认HTTP/1.1）
    #[serde(default)]
    pub http_protocol: HttpProtocolPreference,
}

impl Default for WebDAVConfig {
    fn default() -> Self {
        Self {
            server_id: String::new(),
            name: String::new(),
            url: String::new(),
            mount_path: String::new(),
            username: String::new(),
            password: String::new(),
            timeout_seconds: 30,
            max_redirects: 5,
            verify_ssl: true,
            user_agent: "WindChimePlayer/1.0".to_string(),
            http_protocol: HttpProtocolPreference::default(),
        }
    }
}

/// WebDAV文件信息 - 单一职责：文件元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebDAVFileInfo {
    pub path: String,
    pub name: String,
    pub is_directory: bool,
    pub size: Option<u64>,
    pub content_type: Option<String>,
    pub last_modified: Option<i64>,
    pub etag: Option<String>,
    pub created_at: Option<i64>,
}

/// WebDAV目录列表响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebDAVDirectoryListing {
    pub path: String,
    pub files: Vec<WebDAVFileInfo>,
    pub total_count: usize,
    pub has_more: bool,
}

/// WebDAV属性请求 - PROPFIND请求体
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct PropfindRequest {
    pub depth: Depth,
    pub properties: Vec<DavProperty>,
}

/// WebDAV深度级别
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub enum Depth {
    Zero,      // 仅当前资源
    One,       // 当前资源和直接子资源
    Infinity,  // 所有子资源（递归）
}

impl fmt::Display for Depth {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Depth::Zero => write!(f, "0"),
            Depth::One => write!(f, "1"),
            Depth::Infinity => write!(f, "infinity"),
        }
    }
}

/// WebDAV属性类型
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum DavProperty {
    DisplayName,
    ContentLength,
    ContentType,
    LastModified,
    CreationDate,
    ResourceType,
    ETag,
    GetContentLanguage,
    GetContentEncoding,
    Custom(String, String), // (namespace, property_name)
}

impl DavProperty {
    pub fn to_xml(&self) -> String {
        match self {
            DavProperty::DisplayName => "<D:displayname/>".to_string(),
            DavProperty::ContentLength => "<D:getcontentlength/>".to_string(),
            DavProperty::ContentType => "<D:getcontenttype/>".to_string(),
            DavProperty::LastModified => "<D:getlastmodified/>".to_string(),
            DavProperty::CreationDate => "<D:creationdate/>".to_string(),
            DavProperty::ResourceType => "<D:resourcetype/>".to_string(),
            DavProperty::ETag => "<D:getetag/>".to_string(),
            DavProperty::GetContentLanguage => "<D:getcontentlanguage/>".to_string(),
            DavProperty::GetContentEncoding => "<D:getcontentencoding/>".to_string(),
            DavProperty::Custom(namespace, name) => format!("<{}:{}/>", namespace, name),
        }
    }
}

/// WebDAV HTTP方法
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum WebDAVMethod {
    Options,
    Propfind,
    Proppatch,
    Mkcol,
    Copy,
    Move,
    Lock,
    Unlock,
    Get,
    Put,
    Delete,
    Head,
}

impl fmt::Display for WebDAVMethod {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            WebDAVMethod::Options => write!(f, "OPTIONS"),
            WebDAVMethod::Propfind => write!(f, "PROPFIND"),
            WebDAVMethod::Proppatch => write!(f, "PROPPATCH"),
            WebDAVMethod::Mkcol => write!(f, "MKCOL"),
            WebDAVMethod::Copy => write!(f, "COPY"),
            WebDAVMethod::Move => write!(f, "MOVE"),
            WebDAVMethod::Lock => write!(f, "LOCK"),
            WebDAVMethod::Unlock => write!(f, "UNLOCK"),
            WebDAVMethod::Get => write!(f, "GET"),
            WebDAVMethod::Put => write!(f, "PUT"),
            WebDAVMethod::Delete => write!(f, "DELETE"),
            WebDAVMethod::Head => write!(f, "HEAD"),
        }
    }
}

/// WebDAV连接状态
#[derive(Debug, Clone, Serialize)]
#[allow(dead_code)]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Error(String),
    Timeout,
}

/// WebDAV操作统计
#[derive(Debug, Clone, Serialize)]
pub struct WebDAVStats {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub average_response_time_ms: f64,
    pub bytes_uploaded: u64,
    pub bytes_downloaded: u64,
    pub last_operation_time: Option<i64>,
    pub connection_status: ConnectionStatus,
}

impl Default for WebDAVStats {
    fn default() -> Self {
        Self {
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            average_response_time_ms: 0.0,
            bytes_uploaded: 0,
            bytes_downloaded: 0,
            last_operation_time: None,
            connection_status: ConnectionStatus::Disconnected,
        }
    }
}

/// Range请求头信息
#[derive(Debug, Clone)]
pub struct RangeRequest {
    pub start: u64,
    pub end: Option<u64>,
}

impl fmt::Display for RangeRequest {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.end {
            Some(end) => write!(f, "bytes={}-{}", self.start, end),
            None => write!(f, "bytes={}-", self.start),
        }
    }
}

/// 文件上传进度回调
#[allow(dead_code)]
pub type ProgressCallback = Box<dyn Fn(u64, u64) + Send + Sync>;

/// WebDAV上传选项
#[allow(dead_code)]
pub struct UploadOptions {
    pub overwrite: bool,
    pub create_directories: bool,
    pub content_type: Option<String>,
    pub progress_callback: Option<ProgressCallback>,
    pub chunk_size: Option<usize>,
}

impl Default for UploadOptions {
    fn default() -> Self {
        Self {
            overwrite: true,
            create_directories: true,
            content_type: None,
            progress_callback: None,
            chunk_size: Some(1024 * 1024), // 1MB chunks
        }
    }
}

/// WebDAV客户端配置验证
impl WebDAVConfig {
    pub fn validate(&self) -> WebDAVResult<()> {
        if self.url.is_empty() {
            return Err(WebDAVError::ConfigError("URL不能为空".to_string()));
        }
        
        if !self.url.starts_with("http://") && !self.url.starts_with("https://") {
            return Err(WebDAVError::ConfigError("URL必须以http://或https://开头".to_string()));
        }
        
        if self.username.is_empty() {
            return Err(WebDAVError::ConfigError("用户名不能为空".to_string()));
        }
        
        if self.timeout_seconds == 0 {
            return Err(WebDAVError::ConfigError("超时时间必须大于0".to_string()));
        }
        
        Ok(())
    }
    
    pub fn get_base_url(&self) -> String {
        self.url.trim_end_matches('/').to_string()
    }
    
    pub fn build_full_url(&self, path: &str) -> String {
        use percent_encoding::{utf8_percent_encode, CONTROLS};
        
        let base = self.get_base_url();
        let clean_path = path.trim_start_matches('/');
        
        // 🔧 组合 base URL + mount_path + path（支持中文文件名）
        // 例如：
        // - base: https://example.com
        // - mount_path: /webdav
        // - path: /音乐/歌曲.mp3
        // - 结果: https://example.com/webdav/%E9%9F%B3%E4%B9%90/%E6%AD%8C%E6%9B%B2.mp3
        
        let mut full_url = base;
        
        // 添加挂载路径（如果有）
        if !self.mount_path.is_empty() {
            let clean_mount_path = self.mount_path.trim_matches('/');
            if !clean_mount_path.is_empty() {
                // 对挂载路径的每个部分进行URL编码（保留斜杠分隔符）
                let encoded_parts: Vec<String> = clean_mount_path
                    .split('/')
                    .map(|part| encode_path_segment(part))
                    .collect();
                full_url = format!("{}/{}", full_url, encoded_parts.join("/"));
            }
        }
        
        // 添加文件路径（对每个路径段进行URL编码，但保留斜杠）
        if !clean_path.is_empty() {
            let encoded_parts: Vec<String> = clean_path
                .split('/')
                .map(|part| encode_path_segment(part))
                .collect();
            full_url = format!("{}/{}", full_url, encoded_parts.join("/"));
        }
        
        full_url
    }
}

/// URL编码路径段（保留点、下划线、连字符等安全字符，但编码空格和非ASCII字符）
fn encode_path_segment(segment: &str) -> String {
    use percent_encoding::{utf8_percent_encode, AsciiSet, CONTROLS};
    
    // 定义需要编码的字符集：控制字符 + 空格 + 一些特殊字符
    // 但保留: 字母、数字、点(.)、连字符(-)、下划线(_)、波浪号(~)
    const FRAGMENT: &AsciiSet = &CONTROLS
        .add(b' ')
        .add(b'"')
        .add(b'<')
        .add(b'>')
        .add(b'`')
        .add(b'#')
        .add(b'?')
        .add(b'{')
        .add(b'}');
    
    utf8_percent_encode(segment, FRAGMENT).to_string()
}
