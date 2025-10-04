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

/// WEBDAV流式Reader配置
#[derive(Debug, Clone)]
pub struct WebDAVReaderConfig {
    pub chunk_size: u64,
    pub max_buffer_chunks: usize,
    pub prefetch_threshold: f32,  // 缓冲低于此比例时预加载
}

impl WebDAVReaderConfig {
    /// 根据文件大小智能配置
    pub fn from_file_size(file_size: u64) -> Self {
        let (chunk_size, buffer_chunks) = if file_size < 10 * 1024 * 1024 {
            // <10MB: 一次性加载
            (file_size, 1)
        } else if file_size < 50 * 1024 * 1024 {
            // 10-50MB: 10MB chunks, 3块缓冲
            (10 * 1024 * 1024, 3)
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
        self.total_buffered += chunk.len();
        self.file_offset += chunk.len() as u64;
        self.chunks.push_back(chunk);
        
        if self.file_offset >= self.file_size {
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
    client: Arc<Client>,
    url: String,
    state: Arc<Mutex<BufferState>>,
    config: WebDAVReaderConfig,
    #[allow(dead_code)]
    downloader_thread: Option<thread::JoinHandle<()>>,
}

impl WebDAVStreamReader {
    /// 创建新的WEBDAV流式Reader
    pub async fn new(url: String, config: Option<WebDAVReaderConfig>) -> io::Result<Self> {
        // 创建reqwest客户端（自带连接池）
        let client = Client::builder()
            .pool_max_idle_per_host(5)
            .timeout(std::time::Duration::from_secs(30))
            .http2_prior_knowledge()  // 优先HTTP/2
            .build()
            .map_err(|e| io::Error::new(io::ErrorKind::Other, format!("创建HTTP客户端失败: {}", e)))?;
        
        let client = Arc::new(client);
        
        // 获取文件大小
        log::info!("📡 WEBDAV: 获取文件信息: {}", url);
        let file_size = Self::get_file_size(&client, &url).await?;
        
        log::info!("📊 WEBDAV: 文件大小={:.2}MB", file_size as f64 / 1024.0 / 1024.0);
        
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
        
        // 等待初始缓冲
        let min_bytes = (file_size / 10).max(5 * 1024 * 1024).min(file_size) as usize;
        log::info!("⏳ WEBDAV: 等待初始缓冲 {:.1}MB", min_bytes as f64 / 1024.0 / 1024.0);
        
        let start = std::time::Instant::now();
        loop {
            let (available, eof) = {
                let s = state.lock();
                (s.available(), s.eof)
            };
            
            if available >= min_bytes || eof {
                log::info!("✅ WEBDAV: 初始缓冲完成 {:.1}MB", available as f64 / 1024.0 / 1024.0);
                break;
            }
            
            if start.elapsed().as_secs() > 10 {
                return Err(io::Error::new(io::ErrorKind::TimedOut, "初始缓冲超时"));
            }
            
            thread::sleep(std::time::Duration::from_millis(100));
        }
        
        Ok(Self {
            client,
            url,
            state,
            config,
            downloader_thread: Some(downloader_thread),
        })
    }
    
    /// 获取文件大小（HEAD请求）
    async fn get_file_size(client: &Client, url: &str) -> io::Result<u64> {
        let response = client.head(url)
            .send()
            .await
            .map_err(|e| io::Error::new(io::ErrorKind::Other, format!("HEAD请求失败: {}", e)))?;
        
        let file_size = response
            .headers()
            .get("content-length")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or_else(|| io::Error::new(io::ErrorKind::Other, "无法获取文件大小"))?;
        
        Ok(file_size)
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
        
        loop {
            // 检查退出信号
            if state.lock().should_exit {
                log::info!("🛑 WEBDAV下载线程退出");
                break;
            }
            
            // 检查是否需要下载
            let (file_offset, file_size, eof, chunks_count) = {
                let s = state.lock();
                (s.file_offset, s.file_size, s.eof, s.chunks_count())
            };
            
            if eof {
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
            let end = (start + config.chunk_size).min(file_size) - 1;
            
            log::debug!("📥 WEBDAV Range请求: bytes={}-{} ({:.1}MB)",
                start, end, (end - start + 1) as f64 / 1024.0 / 1024.0);
            
            // HTTP Range请求（连接自动复用）
            match client.get(&url)
                .header("Range", format!("bytes={}-{}", start, end))
                .send()
                .await
            {
                Ok(response) => {
                    match response.bytes().await {
                        Ok(bytes) => {
                            log::debug!("✅ WEBDAV下载完成: {:.1}MB", bytes.len() as f64 / 1024.0 / 1024.0);
                            
                            // 添加到缓冲队列（零拷贝）
                            state.lock().add_chunk(bytes);
                        }
                        Err(e) => {
                            log::error!("❌ WEBDAV读取响应失败: {}", e);
                            thread::sleep(std::time::Duration::from_secs(1));
                        }
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
        loop {
            let mut state = self.state.lock();
            
            // 如果有数据，立即读取
            if state.available() > 0 {
                let n = state.read_bytes(buf);
                return Ok(n);
            }
            
            // 如果EOF且无数据，返回0
            if state.eof {
                return Ok(0);
            }
            
            // 缓冲区空，等待下载
            drop(state);
            thread::sleep(std::time::Duration::from_millis(10));
        }
    }
}

impl Seek for WebDAVStreamReader {
    fn seek(&mut self, _pos: SeekFrom) -> io::Result<u64> {
        // 流式播放不支持seek
        Err(io::Error::new(io::ErrorKind::Unsupported, "流式播放不支持seek"))
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









