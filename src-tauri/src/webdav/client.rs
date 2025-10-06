// WebDAV客户端核心实现 - 高内聚：专注于WebDAV协议操作
// 低耦合：通过接口与其他模块通信

use super::{auth::AuthManager, types::*};
// 已删除：旧版 provider trait，现在使用 remote_adapter
use futures::stream::Stream;
use reqwest::{header::*, Client as HttpClient, Response};
use std::{sync::Arc, time::Instant};
use tokio::io::AsyncRead;
use tokio_util::io::ReaderStream;

/// WebDAV客户端 - 单一职责：WebDAV协议实现
pub struct WebDAVClient {
    /// HTTP客户端 - 依赖注入
    http_client: HttpClient,
    
    /// 配置信息
    config: WebDAVConfig,
    
    /// 认证管理器
    auth_manager: AuthManager,
    
    /// 操作统计
    stats: Arc<tokio::sync::RwLock<WebDAVStats>>,
}

impl WebDAVClient {
    /// 创建新的WebDAV客户端
    pub fn new(config: WebDAVConfig) -> WebDAVResult<Self> {
        // 验证配置
        config.validate()?;
        
        // 创建HTTP客户端
        let mut builder = HttpClient::builder()
            .timeout(std::time::Duration::from_secs(config.timeout_seconds))
            .redirect(reqwest::redirect::Policy::limited(config.max_redirects as usize))
            .user_agent(&config.user_agent);
        
        // SSL验证设置
        if !config.verify_ssl {
            builder = builder.danger_accept_invalid_certs(true);
            log::warn!("SSL证书验证已禁用");
        }
        
        let http_client = builder.build()
            .map_err(|e| WebDAVError::ConfigError(format!("HTTP客户端创建失败: {}", e)))?;
        
        // 创建认证管理器
        let auth_manager = AuthManager::from_config(&config);
        auth_manager.validate()?;
        
        let client = Self {
            http_client,
            config,
            auth_manager,
            stats: Arc::new(tokio::sync::RwLock::new(WebDAVStats::default())),
        };
        
        log::info!("WebDAV客户端已创建: {}", client.config.name);
        Ok(client)
    }
    
    /// 测试连接
    pub async fn test_connection(&self) -> WebDAVResult<bool> {
        log::info!("测试WebDAV连接: {}", self.config.url);
        
        let start_time = Instant::now();
        
        // 发送OPTIONS请求
        let result = self.send_request(WebDAVMethod::Options, "/", None, None).await;
        
        // 更新统计信息
        self.update_stats(start_time, result.is_ok()).await;
        
        match result {
            Ok(response) => {
                log::info!("WebDAV连接测试成功: {}", response.status());
                
                // 检查WebDAV支持的方法
                if let Some(allow_header) = response.headers().get("allow") {
                    if let Ok(methods) = allow_header.to_str() {
                        log::debug!("服务器支持的方法: {}", methods);
                    }
                }
                
                Ok(true)
            }
            Err(e) => {
                log::error!("WebDAV连接测试失败: {}", e);
                Err(e)
            }
        }
    }
    
    /// 列出目录内容
    pub async fn list_directory(&self, path: &str) -> WebDAVResult<WebDAVDirectoryListing> {
        log::debug!("列出目录: {}", path);
        
        let start_time = Instant::now();
        
        // 构建PROPFIND请求
        let propfind_body = self.build_propfind_request(&[
            DavProperty::DisplayName,
            DavProperty::ResourceType,
            DavProperty::ContentLength,
            DavProperty::ContentType,
            DavProperty::LastModified,
            DavProperty::ETag,
        ]);
        
        let mut headers = HeaderMap::new();
        headers.insert("Depth", HeaderValue::from_static("1"));
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/xml"));
        
        let response = self.send_request(
            WebDAVMethod::Propfind,
            path,
            Some(headers),
            Some(propfind_body.into_bytes()),
        ).await?;
        
        // 更新统计信息
        self.update_stats(start_time, true).await;
        
        // 解析响应
        let response_text = response.text().await?;
        
        // 🔍 调试：输出原始 XML 响应的前 2000 字符
        if response_text.len() <= 2000 {
            log::info!("📄 WebDAV 原始 XML 响应:\n{}", response_text);
        } else {
            log::info!("📄 WebDAV 原始 XML 响应 (前 2000 字符):\n{}", &response_text[..2000]);
        }
        
        let files = self.parse_propfind_response(&response_text)?;
        
        log::info!("🔍 解析结果：共 {} 个项目", files.len());
        for (idx, file) in files.iter().enumerate() {
            log::info!("  [{}] {} (目录: {}, 大小: {:?})", 
                idx, file.name, file.is_directory, file.size);
        }
        
        let listing = WebDAVDirectoryListing {
            path: path.to_string(),
            total_count: files.len(),
            has_more: false, // 简化实现，不支持分页
            files,
        };
        
        log::info!("✅ 目录列表获取成功，共 {} 个项目", listing.total_count);
        Ok(listing)
    }
    
    /// 获取文件信息
    pub async fn get_file_info(&self, path: &str) -> WebDAVResult<WebDAVFileInfo> {
        log::debug!("获取文件信息: {}", path);
        
        let start_time = Instant::now();
        
        let propfind_body = self.build_propfind_request(&[
            DavProperty::DisplayName,
            DavProperty::ResourceType,
            DavProperty::ContentLength,
            DavProperty::ContentType,
            DavProperty::LastModified,
            DavProperty::ETag,
            DavProperty::CreationDate,
        ]);
        
        let mut headers = HeaderMap::new();
        headers.insert("Depth", HeaderValue::from_static("0"));
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/xml"));
        
        let response = self.send_request(
            WebDAVMethod::Propfind,
            path,
            Some(headers),
            Some(propfind_body.into_bytes()),
        ).await?;
        
        self.update_stats(start_time, true).await;
        
        let response_text = response.text().await?;
        let mut files = self.parse_propfind_response(&response_text)?;
        
        if files.is_empty() {
            return Err(WebDAVError::FileNotFound { 
                path: path.to_string() 
            });
        }
        
        Ok(files.remove(0))
    }
    
    /// 下载文件流
    pub async fn download_stream(&self, path: &str) -> WebDAVResult<impl Stream<Item = WebDAVResult<bytes::Bytes>>> {
        log::debug!("下载文件流: {}", path);
        
        let start_time = Instant::now();
        
        let response = self.send_request(WebDAVMethod::Get, path, None, None).await?;
        self.update_stats(start_time, true).await;
        
        // 返回响应流
        use futures::stream::TryStreamExt;
        Ok(response.bytes_stream().map_err(WebDAVError::from))
    }
    
    /// 下载文件范围（支持断点续传）
    pub async fn download_range(&self, path: &str, range: RangeRequest) -> WebDAVResult<impl Stream<Item = WebDAVResult<bytes::Bytes>>> {
        log::debug!("下载文件范围: {} ({})", path, range);
        
        let start_time = Instant::now();
        
        let mut headers = HeaderMap::new();
        headers.insert(
            "Range",
            HeaderValue::from_str(&range.to_string())
                .map_err(|e| WebDAVError::ConfigError(format!("无效的Range请求: {}", e)))?
        );
        
        let response = self.send_request(WebDAVMethod::Get, path, Some(headers), None).await?;
        self.update_stats(start_time, true).await;
        
        // 检查是否支持范围请求
        if response.status() != reqwest::StatusCode::PARTIAL_CONTENT {
            log::warn!("服务器不支持范围请求，返回完整文件");
        }
        
        use futures::stream::TryStreamExt;
        Ok(response.bytes_stream().map_err(WebDAVError::from))
    }
    
    /// 上传文件
    #[allow(dead_code)]
    pub async fn upload_file<R>(&self, path: &str, reader: R, options: UploadOptions) -> WebDAVResult<()>
    where
        R: AsyncRead + Send + Sync + 'static,
    {
        log::debug!("上传文件: {}", path);
        
        let start_time = Instant::now();
        
        // 如果需要，创建父目录
        if options.create_directories {
            self.ensure_parent_directories(path).await?;
        }
        
        // 构建请求头
        let mut headers = HeaderMap::new();
        if let Some(content_type) = &options.content_type {
            headers.insert(
                CONTENT_TYPE,
                HeaderValue::from_str(content_type)
                    .map_err(|e| WebDAVError::ConfigError(format!("无效的Content-Type: {}", e)))?
            );
        }
        
        if !options.overwrite {
            headers.insert("If-None-Match", HeaderValue::from_static("*"));
        }
        
        // 转换AsyncRead为Stream
        let stream = ReaderStream::new(reader);
        let body = reqwest::Body::wrap_stream(stream);
        
        let response = self.send_request_with_body(WebDAVMethod::Put, path, Some(headers), body).await?;
        self.update_stats(start_time, true).await;
        
        if response.status().is_success() {
            log::info!("文件上传成功: {}", path);
            Ok(())
        } else {
            Err(WebDAVError::HttpStatusError {
                status: response.status().as_u16(),
                message: format!("上传失败: {}", response.status()),
            })
        }
    }
    
    /// 删除文件
    pub async fn delete_file(&self, path: &str) -> WebDAVResult<()> {
        log::debug!("删除文件: {}", path);
        
        let start_time = Instant::now();
        
        let response = self.send_request(WebDAVMethod::Delete, path, None, None).await?;
        self.update_stats(start_time, true).await;
        
        if response.status().is_success() {
            log::info!("文件删除成功: {}", path);
            Ok(())
        } else if response.status() == reqwest::StatusCode::NOT_FOUND {
            Err(WebDAVError::FileNotFound { path: path.to_string() })
        } else {
            Err(WebDAVError::HttpStatusError {
                status: response.status().as_u16(),
                message: format!("删除失败: {}", response.status()),
            })
        }
    }
    
    /// 创建目录
    pub async fn create_directory(&self, path: &str) -> WebDAVResult<()> {
        log::debug!("创建目录: {}", path);
        
        let start_time = Instant::now();
        
        let response = self.send_request(WebDAVMethod::Mkcol, path, None, None).await?;
        self.update_stats(start_time, true).await;
        
        if response.status().is_success() {
            log::info!("目录创建成功: {}", path);
            Ok(())
        } else if response.status() == reqwest::StatusCode::METHOD_NOT_ALLOWED {
            // 目录可能已存在
            log::info!("目录可能已存在: {}", path);
            Ok(())
        } else {
            Err(WebDAVError::HttpStatusError {
                status: response.status().as_u16(),
                message: format!("目录创建失败: {}", response.status()),
            })
        }
    }
    
    /// 检查文件是否存在
    pub async fn file_exists(&self, path: &str) -> WebDAVResult<bool> {
        match self.get_file_info(path).await {
            Ok(_) => Ok(true),
            Err(WebDAVError::FileNotFound { .. }) => Ok(false),
            Err(e) => Err(e),
        }
    }
    
    /// 获取统计信息
    #[allow(dead_code)]
    pub async fn get_stats(&self) -> WebDAVStats {
        self.stats.read().await.clone()
    }
    
    // === 私有辅助方法 ===
    
    /// 发送WebDAV请求
    async fn send_request(
        &self,
        method: WebDAVMethod,
        path: &str,
        additional_headers: Option<HeaderMap>,
        body: Option<Vec<u8>>,
    ) -> WebDAVResult<Response> {
        let url = self.config.build_full_url(path);
        
        // 构建请求头
        let mut headers = HeaderMap::new();
        self.auth_manager.add_auth_headers(&mut headers)?;
        
        if let Some(additional) = additional_headers {
            headers.extend(additional);
        }
        
        // 发送请求
        let request_builder = match method {
            WebDAVMethod::Get => self.http_client.get(&url),
            WebDAVMethod::Put => self.http_client.put(&url),
            WebDAVMethod::Delete => self.http_client.delete(&url),
            WebDAVMethod::Head => self.http_client.head(&url),
            WebDAVMethod::Options => self.http_client.request(reqwest::Method::OPTIONS, &url),
            WebDAVMethod::Propfind => {
                let method = reqwest::Method::from_bytes(b"PROPFIND")
                    .map_err(|e| WebDAVError::HttpMethodError(e))?;
                self.http_client.request(method, &url)
            },
            WebDAVMethod::Mkcol => {
                let method = reqwest::Method::from_bytes(b"MKCOL")
                    .map_err(|e| WebDAVError::HttpMethodError(e))?;
                self.http_client.request(method, &url)
            },
            _ => {
                let method = reqwest::Method::from_bytes(method.to_string().as_bytes())
                    .map_err(|e| WebDAVError::HttpMethodError(e))?;
                self.http_client.request(method, &url)
            },
        };
        
        let mut request = request_builder.headers(headers);
        
        if let Some(body_data) = body {
            request = request.body(body_data);
        }
        
        log::debug!("发送WebDAV请求: {} {}", method, url);
        
        let response = request.send().await?;
        
        // 检查认证状态
        if response.status() == 401 {
            return Err(WebDAVError::AuthenticationFailed("认证失败".to_string()));
        }
        
        Ok(response)
    }
    
    /// 发送带请求体的WebDAV请求
    #[allow(dead_code)]
    async fn send_request_with_body(
        &self,
        method: WebDAVMethod,
        path: &str,
        additional_headers: Option<HeaderMap>,
        body: reqwest::Body,
    ) -> WebDAVResult<Response> {
        let url = self.config.build_full_url(path);
        
        let mut headers = HeaderMap::new();
        self.auth_manager.add_auth_headers(&mut headers)?;
        
        if let Some(additional) = additional_headers {
            headers.extend(additional);
        }
        
        let http_method = reqwest::Method::from_bytes(method.to_string().as_bytes())
            .map_err(|e| WebDAVError::HttpMethodError(e))?;
            
        let request = self.http_client
            .request(http_method, &url)
            .headers(headers)
            .body(body);
        
        log::debug!("发送WebDAV请求(带体): {} {}", method, url);
        
        let response = request.send().await?;
        
        if response.status() == 401 {
            return Err(WebDAVError::AuthenticationFailed("认证失败".to_string()));
        }
        
        Ok(response)
    }
    
    /// 构建PROPFIND请求体
    fn build_propfind_request(&self, properties: &[DavProperty]) -> String {
        let mut props = String::new();
        for prop in properties {
            props.push_str(&prop.to_xml());
        }
        
        format!(
            r#"<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    {}
  </D:prop>
</D:propfind>"#,
            props
        )
    }
    
    /// 解析PROPFIND响应
    fn parse_propfind_response(&self, response_xml: &str) -> WebDAVResult<Vec<WebDAVFileInfo>> {
        use crate::webdav::xml_parser::PropfindParser;
        
        // 自动检测服务器类型
        let server_hints = PropfindParser::detect_server_type(response_xml);
        log::debug!("检测到WebDAV服务器类型: {:?}", server_hints);
        
        // 创建解析器并解析
        let parser = PropfindParser::new(server_hints);
        let files = parser.parse_multistatus(response_xml)?;
        
        log::debug!("成功解析 {} 个文件/目录", files.len());
        Ok(files)
    }
    
    /// 确保父目录存在（迭代实现，避免栈溢出）
    #[allow(dead_code)]
    async fn ensure_parent_directories(&self, path: &str) -> WebDAVResult<()> {
        let mut directories_to_create = Vec::new();
        let mut current_path = path;
        
        // 收集所有需要创建的父目录
        loop {
            let parent_path = std::path::Path::new(current_path).parent()
                .and_then(|p| p.to_str())
                .unwrap_or("");
            
            if parent_path.is_empty() || parent_path == "/" {
                break;
            }
            
            directories_to_create.push(parent_path.to_string());
            current_path = parent_path;
        }
        
        // 从最顶层开始创建目录
        directories_to_create.reverse();
        for dir in directories_to_create {
            self.create_directory(&dir).await?;
        }
        
        Ok(())
    }
    
    /// 更新操作统计
    async fn update_stats(&self, start_time: Instant, success: bool) {
        let mut stats = self.stats.write().await;
        
        stats.total_requests += 1;
        if success {
            stats.successful_requests += 1;
        } else {
            stats.failed_requests += 1;
        }
        
        let duration = start_time.elapsed();
        let response_time = duration.as_millis() as f64;
        
        // 简单的移动平均
        if stats.total_requests == 1 {
            stats.average_response_time_ms = response_time;
        } else {
            stats.average_response_time_ms = (stats.average_response_time_ms * 0.9) + (response_time * 0.1);
        }
        
        stats.last_operation_time = Some(chrono::Utc::now().timestamp());
        stats.connection_status = if success {
            ConnectionStatus::Connected
        } else {
            ConnectionStatus::Error("请求失败".to_string())
        };
    }
}

// 注释：旧版 WebDAVClientTrait 实现已删除
// 现在使用 webdav::remote_adapter::WebDAVAdapter 来提供统一的远程源接口
