// WebDAV client core implementation
// Focused on WebDAV protocol operations

use super::{auth::AuthManager, types::*};
// 已删除：旧版 provider trait，现在使用 remote_adapter
use futures::stream::Stream;
use reqwest::{header::*, Client as HttpClient, Response};
use std::{sync::Arc, time::Instant};
use tokio::io::AsyncRead;
use tokio_util::io::ReaderStream;

/// WebDAV client for protocol operations
pub struct WebDAVClient {
    http_client: HttpClient,
    config: WebDAVConfig,
    auth_manager: AuthManager,
    stats: Arc<tokio::sync::RwLock<WebDAVStats>>,
}

impl WebDAVClient {
    /// Create new WebDAV client
    pub fn new(config: WebDAVConfig) -> WebDAVResult<Self> {
        config.validate()?;
        
        let mut builder = HttpClient::builder()
            .pool_max_idle_per_host(5)
            .pool_idle_timeout(Some(std::time::Duration::from_secs(90)))
            .timeout(std::time::Duration::from_secs(config.timeout_seconds))
            .redirect(reqwest::redirect::Policy::limited(config.max_redirects as usize))
            .user_agent(&config.user_agent);
        
        builder = match config.http_protocol {
            super::types::HttpProtocolPreference::Http1Only => {
                log::info!("Using HTTP/1.1");
                builder.http1_only()
            },
            super::types::HttpProtocolPreference::Http2Preferred => {
                log::info!("Preferring HTTP/2");
                builder.http2_prior_knowledge()
            },
            super::types::HttpProtocolPreference::Auto => {
                log::info!("Auto HTTP version negotiation");
                builder
            },
        };
        
        if !config.verify_ssl {
            builder = builder.danger_accept_invalid_certs(true);
            log::warn!("SSL certificate verification disabled");
        }
        
        let http_client = builder.build()
            .map_err(|e| WebDAVError::ConfigError(format!("HTTP client creation failed: {}", e)))?;
        
        let auth_manager = AuthManager::from_config(&config);
        auth_manager.validate()?;
        
        let client = Self {
            http_client,
            config,
            auth_manager,
            stats: Arc::new(tokio::sync::RwLock::new(WebDAVStats::default())),
        };
        
        log::info!("WebDAV client created: {}", client.config.name);
        Ok(client)
    }
    
    /// Test connection
    pub async fn test_connection(&self) -> WebDAVResult<bool> {
        log::info!("Testing WebDAV connection: {}", self.config.url);
        
        let start_time = Instant::now();
        
        let result = self.send_request(WebDAVMethod::Options, "/", None, None).await;
        
        self.update_stats(start_time, result.is_ok()).await;
        
        match result {
            Ok(response) => {
                log::info!("WebDAV connection test successful: {}", response.status());
                
                if let Some(allow_header) = response.headers().get("allow") {
                    if let Ok(methods) = allow_header.to_str() {
                        log::debug!("Server supported methods: {}", methods);
                    }
                }
                
                Ok(true)
            }
            Err(e) => {
                log::error!("WebDAV connection test failed: {}", e);
                Err(e)
            }
        }
    }
    
    /// List directory contents
    pub async fn list_directory(&self, path: &str) -> WebDAVResult<WebDAVDirectoryListing> {
        log::debug!("Listing directory: {}", path);
        
        let start_time = Instant::now();
        
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
        
        self.update_stats(start_time, true).await;
        
        let response_text = response.text().await?;
        
        if response_text.len() <= 2000 {
            log::info!("WebDAV XML response:\n{}", response_text);
        } else {
            log::info!("WebDAV XML response (first 2000 chars):\n{}", &response_text[..2000]);
        }
        
        let files = self.parse_propfind_response(&response_text)?;
        
        log::info!("Parse result: {} items", files.len());
        for (idx, file) in files.iter().enumerate() {
            log::info!("  [{}] {} (dir: {}, size: {:?})", 
                idx, file.name, file.is_directory, file.size);
        }
        
        let listing = WebDAVDirectoryListing {
            path: path.to_string(),
            total_count: files.len(),
            has_more: false,
            files,
        };
        
        log::info!("Directory listing success: {} items", listing.total_count);
        Ok(listing)
    }
    
    /// Get file info
    pub async fn get_file_info(&self, path: &str) -> WebDAVResult<WebDAVFileInfo> {
        log::debug!("Getting file info: {}", path);
        
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
    
    /// Download file stream
    pub async fn download_stream(&self, path: &str) -> WebDAVResult<impl Stream<Item = WebDAVResult<bytes::Bytes>>> {
        log::debug!("Downloading file stream: {}", path);
        
        let start_time = Instant::now();
        
        let response = self.send_request(WebDAVMethod::Get, path, None, None).await?;
        self.update_stats(start_time, true).await;
        
        // 返回响应流
        use futures::stream::TryStreamExt;
        Ok(response.bytes_stream().map_err(WebDAVError::from))
    }
    
    /// Download file range (resumable)
    pub async fn download_range(&self, path: &str, range: RangeRequest) -> WebDAVResult<impl Stream<Item = WebDAVResult<bytes::Bytes>>> {
        log::debug!("Downloading file range: {} ({})", path, range);
        
        let start_time = Instant::now();
        
        let mut headers = HeaderMap::new();
        headers.insert(
            "Range",
            HeaderValue::from_str(&range.to_string())
                .map_err(|e| WebDAVError::ConfigError(format!("无效的Range请求: {}", e)))?
        );
        
        let response = self.send_request(WebDAVMethod::Get, path, Some(headers), None).await?;
        self.update_stats(start_time, true).await;
        
        if response.status() != reqwest::StatusCode::PARTIAL_CONTENT {
            log::warn!("Server doesn't support range requests, returning full file");
        }
        
        use futures::stream::TryStreamExt;
        Ok(response.bytes_stream().map_err(WebDAVError::from))
    }
    
    /// Upload file
    #[allow(dead_code)]
    pub async fn upload_file<R>(&self, path: &str, reader: R, options: UploadOptions) -> WebDAVResult<()>
    where
        R: AsyncRead + Send + Sync + 'static,
    {
        log::debug!("Uploading file: {}", path);
        
        let start_time = Instant::now();
        
        if options.create_directories {
            self.ensure_parent_directories(path).await?;
        }
        
        let mut headers = HeaderMap::new();
        if let Some(content_type) = &options.content_type {
            headers.insert(
                CONTENT_TYPE,
                HeaderValue::from_str(content_type)
                    .map_err(|e| WebDAVError::ConfigError(format!("Invalid Content-Type: {}", e)))?
            );
        }
        
        if !options.overwrite {
            headers.insert("If-None-Match", HeaderValue::from_static("*"));
        }
        
        let stream = ReaderStream::new(reader);
        let body = reqwest::Body::wrap_stream(stream);
        
        let response = self.send_request_with_body(WebDAVMethod::Put, path, Some(headers), body).await?;
        self.update_stats(start_time, true).await;
        
        if response.status().is_success() {
            log::info!("File upload successful: {}", path);
            Ok(())
        } else {
            Err(WebDAVError::HttpStatusError {
                status: response.status().as_u16(),
                message: format!("Upload failed: {}", response.status()),
            })
        }
    }
    
    /// Delete file
    pub async fn delete_file(&self, path: &str) -> WebDAVResult<()> {
        log::debug!("Deleting file: {}", path);
        
        let start_time = Instant::now();
        
        let response = self.send_request(WebDAVMethod::Delete, path, None, None).await?;
        self.update_stats(start_time, true).await;
        
        if response.status().is_success() {
            log::info!("File deleted successfully: {}", path);
            Ok(())
        } else if response.status() == reqwest::StatusCode::NOT_FOUND {
            Err(WebDAVError::FileNotFound { path: path.to_string() })
        } else {
            Err(WebDAVError::HttpStatusError {
                status: response.status().as_u16(),
                message: format!("Delete failed: {}", response.status()),
            })
        }
    }
    
    /// Create directory
    pub async fn create_directory(&self, path: &str) -> WebDAVResult<()> {
        log::debug!("Creating directory: {}", path);
        
        let start_time = Instant::now();
        
        let response = self.send_request(WebDAVMethod::Mkcol, path, None, None).await?;
        self.update_stats(start_time, true).await;
        
        if response.status().is_success() {
            log::info!("Directory created successfully: {}", path);
            Ok(())
        } else if response.status() == reqwest::StatusCode::METHOD_NOT_ALLOWED {
            log::info!("Directory may already exist: {}", path);
            Ok(())
        } else {
            Err(WebDAVError::HttpStatusError {
                status: response.status().as_u16(),
                message: format!("Directory creation failed: {}", response.status()),
            })
        }
    }
    
    /// Check if file exists
    pub async fn file_exists(&self, path: &str) -> WebDAVResult<bool> {
        match self.get_file_info(path).await {
            Ok(_) => Ok(true),
            Err(WebDAVError::FileNotFound { .. }) => Ok(false),
            Err(e) => Err(e),
        }
    }
    
    /// Get statistics
    #[allow(dead_code)]
    pub async fn get_stats(&self) -> WebDAVStats {
        self.stats.read().await.clone()
    }
    
    /// Get configuration
    pub fn get_config(&self) -> &WebDAVConfig {
        &self.config
    }
    
    /// Send WebDAV request
    async fn send_request(
        &self,
        method: WebDAVMethod,
        path: &str,
        additional_headers: Option<HeaderMap>,
        body: Option<Vec<u8>>,
    ) -> WebDAVResult<Response> {
        let url = self.config.build_full_url(path);
        
        let mut headers = HeaderMap::new();
        self.auth_manager.add_auth_headers(&mut headers)?;
        
        if let Some(additional) = additional_headers {
            headers.extend(additional);
        }
        
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
        
        log::debug!("Sending WebDAV request: {} {}", method, url);
        
        let response = request.send().await?;
        
        if response.status() == 401 {
            return Err(WebDAVError::AuthenticationFailed("Authentication failed".to_string()));
        }
        
        Ok(response)
    }
    
    /// Send WebDAV request with body
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
        
        log::debug!("Sending WebDAV request with body: {} {}", method, url);
        
        let response = request.send().await?;
        
        if response.status() == 401 {
            return Err(WebDAVError::AuthenticationFailed("Authentication failed".to_string()));
        }
        
        Ok(response)
    }
    
    /// Build PROPFIND request body
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
    
    /// Parse PROPFIND response
    fn parse_propfind_response(&self, response_xml: &str) -> WebDAVResult<Vec<WebDAVFileInfo>> {
        use crate::webdav::xml_parser::PropfindParser;
        
        let server_hints = PropfindParser::detect_server_type(response_xml);
        log::debug!("Detected WebDAV server type: {:?}", server_hints);
        
        let parser = PropfindParser::new(server_hints);
        let files = parser.parse_multistatus(response_xml)?;
        
        log::debug!("Successfully parsed {} files/directories", files.len());
        Ok(files)
    }
    
    /// Ensure parent directories exist
    #[allow(dead_code)]
    async fn ensure_parent_directories(&self, path: &str) -> WebDAVResult<()> {
        let mut directories_to_create = Vec::new();
        let mut current_path = path;
        
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
        
        directories_to_create.reverse();
        for dir in directories_to_create {
            self.create_directory(&dir).await?;
        }
        
        Ok(())
    }
    
    /// Update operation statistics
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
        
        if stats.total_requests == 1 {
            stats.average_response_time_ms = response_time;
        } else {
            stats.average_response_time_ms = (stats.average_response_time_ms * 0.9) + (response_time * 0.1);
        }
        
        stats.last_operation_time = Some(chrono::Utc::now().timestamp());
        stats.connection_status = if success {
            ConnectionStatus::Connected
        } else {
            ConnectionStatus::Error("Request failed".to_string())
        };
    }
}

impl Drop for WebDAVClient {
    fn drop(&mut self) {
        log::debug!("WebDAV client dropped: {}", self.config.name);
    }
}
