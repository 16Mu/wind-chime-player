// WEBDAV流式Reader - 基于HTTP Range的高性能实现
// 
// 核心优势：
// - reqwest自动连接池（消除重连开销）
// - HTTP/2多路复用
// - bytes::Bytes零拷贝
// - 智能预加载
// - 简洁稳定（<300行）

use bytes::Bytes;
use reqwest::Client;
use std::collections::VecDeque;
use std::io::{self, Read, Seek, SeekFrom};
use std::sync::Arc;
use parking_lot::Mutex;
use std::thread;
use symphonia::core::io::MediaSource;
use futures::StreamExt;

/// WEBDAV流式Reader配置
#[derive(Debug, Clone)]
pub struct WebDAVReaderConfig {
    pub chunk_size: u64,
    pub max_buffer_chunks: usize,
    #[allow(dead_code)]
    pub prefetch_threshold: f32,  // 缓冲低于此比例时预加载（预留功能）
}

impl WebDAVReaderConfig {
    /// 根据文件大小智能配置
    pub fn from_file_size(file_size: u64) -> Self {
        let (chunk_size, buffer_chunks) = if file_size < 1 * 1024 * 1024 {
            // <1MB: 512KB chunks（快速启动）
            (512 * 1024, 2)
        } else if file_size < 10 * 1024 * 1024 {
            // 1-10MB: 1MB chunks, 3块缓冲（即点即播）
            (1 * 1024 * 1024, 3)
        } else if file_size < 50 * 1024 * 1024 {
            // 10-50MB: 5MB chunks, 3块缓冲
            (5 * 1024 * 1024, 3)
        } else if file_size < 100 * 1024 * 1024 {
            // 50-100MB: 10MB chunks, 3块缓冲
            (10 * 1024 * 1024, 3)
        } else {
            // >100MB: 15MB chunks, 3块缓冲
            (15 * 1024 * 1024, 3)
        };
        
        log::info!("📊 WEBDAV智能配置: 文件{:.1}MB, chunk={:.1}MB, buffer={}块",
            file_size as f64 / 1024.0 / 1024.0,
            chunk_size as f64 / 1024.0 / 1024.0,
            buffer_chunks);
        
        Self {
            chunk_size,
            max_buffer_chunks: buffer_chunks,
            prefetch_threshold: 0.3,  // 缓冲低于30%时预加载
        }
    }
}

/// 缓冲区状态
struct BufferState {
    chunks: VecDeque<Bytes>,  // 零拷贝缓冲队列
    current_chunk_pos: usize,  // 当前chunk内的读取位置
    total_buffered: usize,     // 总缓冲字节数
    file_offset: u64,          // 下一个要下载的文件偏移
    file_size: u64,
    eof: bool,
    should_exit: bool,
}

impl BufferState {
    fn new(file_size: u64) -> Self {
        log::info!("🔧 BufferState初始化: file_size={} ({:.2}MB)", file_size, file_size as f64 / 1024.0 / 1024.0);
        println!("🔧 [WebDAVReader] BufferState初始化: file_size={} ({:.2}MB)", file_size, file_size as f64 / 1024.0 / 1024.0);
        Self {
            chunks: VecDeque::new(),
            current_chunk_pos: 0,
            total_buffered: 0,
            file_offset: 0,
            file_size,
            eof: false,
            should_exit: false,
        }
    }
    
    fn available(&self) -> usize {
        self.total_buffered
    }
    
    fn chunks_count(&self) -> usize {
        self.chunks.len()
    }
    
    fn add_chunk(&mut self, chunk: Bytes) {
        let chunk_len = chunk.len();
        self.total_buffered += chunk_len;
        self.file_offset += chunk_len as u64;
        self.chunks.push_back(chunk);
        
        // 🔍 检查是否超过文件大小（不应该发生）
        if self.file_offset > self.file_size {
            log::error!("⚠️ file_offset({}) 超过 file_size({}), 差异: {} 字节", 
                self.file_offset, self.file_size, self.file_offset - self.file_size);
            println!("⚠️ [WebDAVReader] file_offset({}) 超过 file_size({}), 差异: {} 字节", 
                self.file_offset, self.file_size, self.file_offset - self.file_size);
        }
        
        if self.file_offset >= self.file_size {
            log::info!("📌 设置EOF: file_offset={} >= file_size={} (差异: {}字节)", 
                self.file_offset, self.file_size, 
                self.file_offset as i64 - self.file_size as i64);
            println!("📌 [WebDAVReader] 设置EOF: file_offset={} >= file_size={} (完全匹配: {})", 
                self.file_offset, self.file_size, self.file_offset == self.file_size);
            self.eof = true;
        }
    }
    
    fn read_bytes(&mut self, buf: &mut [u8]) -> usize {
        let mut total_read = 0;
        
        while total_read < buf.len() && !self.chunks.is_empty() {
            let chunk = &self.chunks[0];
            let available_in_chunk = chunk.len() - self.current_chunk_pos;
            let to_read = (buf.len() - total_read).min(available_in_chunk);
            
            buf[total_read..total_read + to_read].copy_from_slice(
                &chunk[self.current_chunk_pos..self.current_chunk_pos + to_read]
            );
            
            total_read += to_read;
            self.current_chunk_pos += to_read;
            self.total_buffered -= to_read;
            
            // 当前chunk读完，移除
            if self.current_chunk_pos >= chunk.len() {
                self.chunks.pop_front();
                self.current_chunk_pos = 0;
            }
        }
        
        total_read
    }
}

/// WEBDAV流式Reader
pub struct WebDAVStreamReader {
    #[allow(dead_code)]
    client: Arc<Client>,
    #[allow(dead_code)]
    url: String,
    state: Arc<Mutex<BufferState>>,
    #[allow(dead_code)]
    config: WebDAVReaderConfig,
    #[allow(dead_code)]
    downloader_thread: Option<thread::JoinHandle<()>>,
    /// 总读取字节数（用于调试）
    total_read: Arc<std::sync::atomic::AtomicU64>,
    /// 当前读取位置（用于支持seek）
    position: u64,
}

impl WebDAVStreamReader {
    /// 创建新的WEBDAV流式Reader（带认证和HTTP协议偏好）
    pub async fn new_with_auth(
        url: String,
        username: String,
        password: String,
        http_protocol: crate::webdav::types::HttpProtocolPreference,
        config: Option<WebDAVReaderConfig>
    ) -> io::Result<Self> {
        use crate::webdav::types::HttpProtocolPreference;
        
        // 创建reqwest客户端（自带连接池）
        let mut client_builder = Client::builder()
            .pool_max_idle_per_host(5)
            .timeout(std::time::Duration::from_secs(30));
        
        // 根据HTTP协议偏好配置
        client_builder = match http_protocol {
            HttpProtocolPreference::Http1Only => {
                log::info!("🔧 使用HTTP/1.1（提高兼容性）");
                client_builder.http1_only()
            },
            HttpProtocolPreference::Http2Preferred => {
                log::info!("🔧 优先HTTP/2（提高性能）");
                client_builder.http2_prior_knowledge()
            },
            HttpProtocolPreference::Auto => {
                log::info!("🔧 自动协商HTTP版本");
                client_builder // 默认行为：自动协商
            },
        };
        
        // 添加Basic认证（如果提供了凭证）
        if !username.is_empty() {
            use base64::Engine;
            let auth_value = format!("{}:{}", username, password);
            let encoded = base64::engine::general_purpose::STANDARD.encode(auth_value.as_bytes());
            let auth_header = format!("Basic {}", encoded);
            
            let mut default_headers = reqwest::header::HeaderMap::new();
            default_headers.insert(
                reqwest::header::AUTHORIZATION,
                reqwest::header::HeaderValue::from_str(&auth_header)
                    .map_err(|e| io::Error::new(io::ErrorKind::Other, format!("创建认证头失败: {}", e)))?
            );
            client_builder = client_builder.default_headers(default_headers);
        }
        
        let client = client_builder.build()
            .map_err(|e| io::Error::new(io::ErrorKind::Other, format!("创建HTTP客户端失败: {}", e)))?;
        
        let client = Arc::new(client);
        
        // 获取文件大小
        log::info!("📡 WEBDAV: 获取文件信息: {}", url);
        println!("📡 [WebDAVReader] 获取文件大小...");
        let file_size = Self::get_file_size(&client, &url).await?;
        
        log::info!("📊 WEBDAV: 文件大小={:.2}MB", file_size as f64 / 1024.0 / 1024.0);
        println!("📊 [WebDAVReader] 文件大小: {:.2}MB ({} 字节)", file_size as f64 / 1024.0 / 1024.0, file_size);
        
        // 智能配置
        let config = config.unwrap_or_else(|| WebDAVReaderConfig::from_file_size(file_size));
        
        // 创建缓冲状态
        let state = Arc::new(Mutex::new(BufferState::new(file_size)));
        
        // 启动后台下载线程
        let downloader_thread = Self::start_downloader(
            client.clone(),
            url.clone(),
            state.clone(),
            config.clone(),
        )?;
        
        // 🚀 真正的即点即播：不等待任何缓冲！
        // 解码器和播放器会自动等待数据，我们只需确保下载线程已启动
        log::info!("✅ WEBDAV: 下载线程已启动，立即返回（零等待）");
        println!("✅ [WebDAVReader] 下载线程已启动，立即开始播放（零等待）！");
        
        Ok(Self {
            client,
            url,
            state,
            config,
            downloader_thread: Some(downloader_thread),
            total_read: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            position: 0,
        })
    }
    
    /// 获取文件大小（HEAD请求，失败时尝试Range请求）
    async fn get_file_size(client: &Client, url: &str) -> io::Result<u64> {
        // 尝试1：HEAD请求（最快，但有些服务器不支持或返回错误的Content-Length）
        log::info!("📡 WEBDAV: 尝试HEAD请求获取文件大小...");
        if let Ok(response) = client.head(url).send().await {
            log::info!("📡 WEBDAV: HEAD响应状态: {}", response.status());
            
            if response.status().is_success() {
                if let Some(file_size) = response
                    .headers()
                    .get("content-length")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|s| s.parse::<u64>().ok())
                {
                if file_size > 0 {
                    log::info!("✅ WEBDAV: HEAD请求成功，文件大小: {} 字节 ({:.2}MB)", file_size, file_size as f64 / 1024.0 / 1024.0);
                    println!("✅ [WebDAVReader] HEAD成功: {} 字节 ({:.2}MB)", file_size, file_size as f64 / 1024.0 / 1024.0);
                    return Ok(file_size);
                    } else {
                        log::warn!("⚠️ WEBDAV: HEAD请求返回文件大小为0，尝试Range请求...");
                    }
                }
            }
        } else {
            log::warn!("⚠️ WEBDAV: HEAD请求失败，尝试Range请求...");
        }
        
        // 尝试2：使用Range请求获取Content-Range头（更可靠）
        log::info!("📡 WEBDAV: 发送Range请求获取文件大小...");
        let response = client.get(url)
            .header("Range", "bytes=0-0")  // 只请求第一个字节
            .send()
            .await
            .map_err(|e| io::Error::new(io::ErrorKind::Other, format!("Range请求失败: {}", e)))?;
        
        log::info!("📡 WEBDAV: Range响应状态: {}", response.status());
        log::debug!("📡 WEBDAV: Range响应头: {:?}", response.headers());
        
        // 尝试从Content-Range头获取总大小
        // Content-Range: bytes 0-0/12345678
        if let Some(content_range) = response.headers().get("content-range") {
            if let Ok(range_str) = content_range.to_str() {
                log::info!("📊 WEBDAV: Content-Range头: {}", range_str);
                
                // 解析 "bytes 0-0/12345678" 格式
                if let Some(total_size_str) = range_str.split('/').nth(1) {
                    if let Ok(file_size) = total_size_str.parse::<u64>() {
                        if file_size > 0 {
                            log::info!("✅ WEBDAV: Range请求成功，文件大小: {} 字节 ({:.2}MB)", file_size, file_size as f64 / 1024.0 / 1024.0);
                            println!("✅ [WebDAVReader] Range成功: {} 字节 ({:.2}MB)", file_size, file_size as f64 / 1024.0 / 1024.0);
                            return Ok(file_size);
                        }
                    }
                }
            }
        }
        
        // 尝试3：如果Range请求返回200而不是206，尝试从Content-Length获取
        if response.status().as_u16() == 200 {
            if let Some(file_size) = response
                .headers()
                .get("content-length")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<u64>().ok())
            {
                if file_size > 0 {
                    log::info!("✅ WEBDAV: 从200响应获取文件大小: {} 字节 ({:.2}MB)", file_size, file_size as f64 / 1024.0 / 1024.0);
                    return Ok(file_size);
                }
            }
        }
        
        log::error!("❌ WEBDAV: 无法获取文件大小，所有方法都失败了");
        Err(io::Error::new(io::ErrorKind::Other, "无法获取文件大小，服务器可能不支持HEAD或Range请求"))
    }
    
    /// 启动后台下载线程
    fn start_downloader(
        client: Arc<Client>,
        url: String,
        state: Arc<Mutex<BufferState>>,
        config: WebDAVReaderConfig,
    ) -> io::Result<thread::JoinHandle<()>> {
        thread::Builder::new()
            .name("webdav-downloader".to_string())
            .spawn(move || {
                let rt = tokio::runtime::Runtime::new()
                    .expect("无法创建tokio runtime");
                
                rt.block_on(async {
                    Self::download_loop(client, url, state, config).await;
                });
            })
            .map_err(|e| io::Error::new(io::ErrorKind::Other, format!("启动下载线程失败: {}", e)))
    }
    
    /// 后台下载循环
    async fn download_loop(
        client: Arc<Client>,
        url: String,
        state: Arc<Mutex<BufferState>>,
        config: WebDAVReaderConfig,
    ) {
        log::info!("🔄 WEBDAV下载线程开始运行");
        println!("🔄 [WebDAVReader] 下载线程开始运行");
        
        let mut chunk_counter = 0u64;
        let mut total_downloaded = 0u64;
        
        loop {
            // 检查退出信号
            if state.lock().should_exit {
                log::info!("🛑 WEBDAV下载线程退出: 已下载{}个chunk, {}MB", chunk_counter, total_downloaded as f64 / 1024.0 / 1024.0);
                println!("🛑 [WebDAVReader] 下载线程退出: 已下载{}个chunk, {:.2}MB", chunk_counter, total_downloaded as f64 / 1024.0 / 1024.0);
                break;
            }
            
            // 检查是否需要下载
            let (file_offset, file_size, eof, chunks_count) = {
                let s = state.lock();
                (s.file_offset, s.file_size, s.eof, s.chunks_count())
            };
            
            if eof {
                log::info!("✅ WEBDAV下载完成: offset={}/{}, chunks={}", file_offset, file_size, chunk_counter);
                println!("✅ [WebDAVReader] 下载完成: offset={}/{} ({:.2}MB), 总共{}个chunk", 
                    file_offset, file_size, total_downloaded as f64 / 1024.0 / 1024.0, chunk_counter);
                thread::sleep(std::time::Duration::from_millis(100));
                continue;
            }
            
            // 如果缓冲区满，等待消费
            if chunks_count >= config.max_buffer_chunks {
                thread::sleep(std::time::Duration::from_millis(50));
                continue;
            }
            
            // 计算本次下载范围
            let start = file_offset;
            // 🔧 防止减法溢出：确保end至少为start
            let end_exclusive = (start + config.chunk_size).min(file_size);
            if end_exclusive <= start {
                log::error!("❌ WEBDAV: 无效的下载范围 start={} file_size={}", start, file_size);
                println!("❌ [WebDAVReader] 无效的下载范围 start={} file_size={}", start, file_size);
                state.lock().eof = true;
                break;
            }
            let end = end_exclusive - 1;
            let expected_size = end - start + 1;
            
            log::debug!("📥 WEBDAV Range请求: bytes={}-{} (期望{}字节)",
                start, end, expected_size);
            
            // 🚀 关键优化：使用流式接收，边接收边缓存（不等待整个chunk下载完成）
            match client.get(&url)
                .header("Range", format!("bytes={}-{}", start, end))
                .send()
                .await
            {
                Ok(response) => {
                    let mut stream = response.bytes_stream();
                    let mut accumulated = Vec::with_capacity(expected_size as usize);
                    
                    // 边接收边添加到缓冲（实时响应）
                    while let Some(chunk_result) = stream.next().await {
                        match chunk_result {
                            Ok(chunk) => {
                                // 立即添加到缓冲（让解码器能立即开始）
                                state.lock().add_chunk(chunk.clone());
                                accumulated.extend_from_slice(&chunk);
                                
                                // 第一个小块到达就返回，解码器可以开始工作了
                                if accumulated.len() >= 128 * 1024 {
                                    log::debug!("🚀 首个128KB到达，解码器可以开始工作");
                                }
                            }
                            Err(e) => {
                                log::error!("❌ 接收数据流失败: {}", e);
                                break;
                            }
                        }
                    }
                    
                    chunk_counter += 1;
                    total_downloaded += accumulated.len() as u64;
                    
                    log::debug!("✅ WEBDAV chunk#{}: {:.1}MB (总计:{:.2}MB/{:.2}MB)", 
                        chunk_counter, accumulated.len() as f64 / 1024.0 / 1024.0,
                        total_downloaded as f64 / 1024.0 / 1024.0, file_size as f64 / 1024.0 / 1024.0);
                    
                    if chunk_counter % 10 == 0 || accumulated.len() != config.chunk_size as usize {
                        println!("📥 [WebDAVReader] chunk#{}: {}字节 (总计:{:.2}MB/{:.2}MB)", 
                            chunk_counter, accumulated.len(), 
                            total_downloaded as f64 / 1024.0 / 1024.0, file_size as f64 / 1024.0 / 1024.0);
                    }
                }
                Err(e) => {
                    log::error!("❌ WEBDAV Range请求失败: {}", e);
                    thread::sleep(std::time::Duration::from_secs(1));
                }
            }
        }
    }
}

impl Read for WebDAVStreamReader {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let mut wait_count = 0;
        loop {
            let mut state = self.state.lock();
            
            // 🔍 诊断日志（仅在首次调用或等待时打印）
            if wait_count == 0 && state.available() == 0 {
                log::debug!("📖 Read请求: buf_len={}, available={}, eof={}, chunks={}", 
                    buf.len(), state.available(), state.eof, state.chunks_count());
                println!("📖 [WebDAVReader] Read请求等待数据: buf_len={}, available={}, eof={}, chunks={}", 
                    buf.len(), state.available(), state.eof, state.chunks_count());
            }
            
            // 如果有数据，立即读取
            if state.available() > 0 {
                let n = state.read_bytes(buf);
                
                // 更新位置
                self.position += n as u64;
                
                // 累加总读取量
                let total = self.total_read.fetch_add(n as u64, std::sync::atomic::Ordering::Relaxed) + n as u64;
                
                // 每10MB打印一次进度
                let mb_total = (total / (10 * 1024 * 1024)) as u64;
                let mb_prev = ((total - n as u64) / (10 * 1024 * 1024)) as u64;
                if mb_total != mb_prev || total == state.file_size {
                    log::debug!("✅ Read进度: {:.2}MB/{:.2}MB ({:.1}%)", 
                        total as f64 / 1024.0 / 1024.0, 
                        state.file_size as f64 / 1024.0 / 1024.0,
                        (total as f64 / state.file_size as f64) * 100.0);
                    println!("📊 [WebDAVReader] Read进度: {:.2}MB/{:.2}MB ({:.1}%)", 
                        total as f64 / 1024.0 / 1024.0, 
                        state.file_size as f64 / 1024.0 / 1024.0,
                        (total as f64 / state.file_size as f64) * 100.0);
                }
                
                return Ok(n);
            }
            
            // 如果EOF且无数据，返回0
            if state.eof {
                let total = self.total_read.load(std::sync::atomic::Ordering::Relaxed);
                log::warn!("⚠️ Read遇到EOF: available=0, 总读取: {}/{} ({:.1}%)", 
                    total, state.file_size, (total as f64 / state.file_size as f64) * 100.0);
                println!("⚠️ [WebDAVReader] Read遇到EOF: available=0, 总读取: {:.2}MB/{:.2}MB (完整: {})", 
                    total as f64 / 1024.0 / 1024.0, state.file_size as f64 / 1024.0 / 1024.0, total == state.file_size);
                return Ok(0);
            }
            
            // 缓冲区空，等待下载
            drop(state);
            wait_count += 1;
            if wait_count % 100 == 0 {
                log::debug!("⏳ 等待缓冲: {}次", wait_count);
                println!("⏳ [WebDAVReader] 等待缓冲: {}次", wait_count);
            }
            thread::sleep(std::time::Duration::from_millis(10));
        }
    }
}

impl Seek for WebDAVStreamReader {
    fn seek(&mut self, pos: SeekFrom) -> io::Result<u64> {
        use std::io::{Error, ErrorKind};
        
        let file_size = self.state.lock().file_size;
        
        // 计算新位置
        let new_position = match pos {
            SeekFrom::Start(offset) => offset as i64,
            SeekFrom::End(offset) => file_size as i64 + offset,
            SeekFrom::Current(offset) => self.position as i64 + offset,
        };
        
        if new_position < 0 {
            return Err(Error::new(ErrorKind::InvalidInput, "seek 位置为负"));
        }
        
        let new_position = new_position as u64;
        
        if new_position > file_size {
            return Err(Error::new(ErrorKind::InvalidInput, "seek 位置超出文件大小"));
        }
        
        log::info!("🔍 Seek请求: 从 {} 到 {} (文件大小: {})", 
            self.position, new_position, file_size);
        println!("🔍 [WebDAVReader] Seek请求: 从 {} 到 {} (文件大小: {})", 
            self.position, new_position, file_size);
        
        // 🎯 关键：通知下载线程从新位置开始下载
        {
            let mut state = self.state.lock();
            
            // 清空当前缓冲
            state.chunks.clear();
            state.current_chunk_pos = 0;
            state.total_buffered = 0;
            
            // 设置新的下载位置
            state.file_offset = new_position;
            state.eof = false; // 重置 EOF 标志
            
            log::info!("✅ Seek完成: 清空缓冲，设置 file_offset={}", new_position);
            println!("✅ [WebDAVReader] Seek完成: 清空缓冲，从新位置开始下载");
        }
        
        // 更新当前位置
        self.position = new_position;
        
        // 等待一些初始缓冲（避免立即读取空缓冲）
        std::thread::sleep(std::time::Duration::from_millis(100));
        
        Ok(new_position)
    }
}

// Symphonia MediaSource 实现
impl MediaSource for WebDAVStreamReader {
    fn is_seekable(&self) -> bool {
        true // rodio::Decoder需要seek支持
    }
    
    fn byte_len(&self) -> Option<u64> {
        Some(self.state.lock().file_size)
    }
}

impl Drop for WebDAVStreamReader {
    fn drop(&mut self) {
        // 通知下载线程退出
        self.state.lock().should_exit = true;
        
        // 等待线程结束
        if let Some(handle) = self.downloader_thread.take() {
            let _ = handle.join();
        }
        
        log::info!("🗑️ WEBDAV Reader已释放");
    }
}









