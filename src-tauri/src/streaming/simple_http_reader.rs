// 简单HTTP流式Reader - 真正的即点即播
// 
// 原理：
// - 单个HTTP GET请求
// - 服务器使用chunked transfer encoding流式传输
// - 客户端边接收边缓存，解码器边读边播
// - 无需等待下载完成

use bytes::Bytes;
use reqwest::Client;
use std::collections::VecDeque;
use std::io::{self, Read, Seek, SeekFrom};
use std::sync::Arc;
use parking_lot::Mutex;
use std::thread;
use futures::StreamExt;

/// 缓冲状态
struct BufferState {
    chunks: VecDeque<Bytes>,
    current_chunk_pos: usize,
    total_buffered: usize,
    eof: bool,
    should_exit: bool,
}

impl BufferState {
    fn new() -> Self {
        Self {
            chunks: VecDeque::new(),
            current_chunk_pos: 0,
            total_buffered: 0,
            eof: false,
            should_exit: false,
        }
    }
    
    fn available(&self) -> usize {
        self.total_buffered
    }
    
    fn add_chunk(&mut self, chunk: Bytes) {
        self.total_buffered += chunk.len();
        self.chunks.push_back(chunk);
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
            
            if self.current_chunk_pos >= chunk.len() {
                self.chunks.pop_front();
                self.current_chunk_pos = 0;
            }
        }
        
        total_read
    }
}

/// 简单HTTP流式Reader
pub struct SimpleHttpReader {
    state: Arc<Mutex<BufferState>>,
    downloader_thread: Option<thread::JoinHandle<()>>,
}

impl SimpleHttpReader {
    /// 创建新的HTTP流式Reader
    pub async fn new(url: String, username: String, password: String) -> io::Result<Self> {
        use base64::Engine;
        
        // 创建HTTP客户端
        let mut client_builder = Client::builder()
            .timeout(std::time::Duration::from_secs(30));
        
        // 添加Basic认证
        if !username.is_empty() {
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
        let state = Arc::new(Mutex::new(BufferState::new()));
        
        // 启动下载线程
        let downloader_thread = Self::start_downloader(
            client,
            url,
            state.clone(),
        )?;
        
        log::info!("✅ HTTP流式Reader已创建（零等待）");
        println!("✅ [HttpReader] 流式下载已启动，立即开始播放！");
        
        Ok(Self {
            state,
            downloader_thread: Some(downloader_thread),
        })
    }
    
    /// 启动下载线程
    fn start_downloader(
        client: Arc<Client>,
        url: String,
        state: Arc<Mutex<BufferState>>,
    ) -> io::Result<thread::JoinHandle<()>> {
        thread::Builder::new()
            .name("http-downloader".to_string())
            .spawn(move || {
                let rt = tokio::runtime::Runtime::new()
                    .expect("无法创建tokio runtime");
                
                rt.block_on(async {
                    Self::download_stream(client, url, state).await;
                });
            })
            .map_err(|e| io::Error::new(io::ErrorKind::Other, format!("启动下载线程失败: {}", e)))
    }
    
    /// 流式下载
    async fn download_stream(
        client: Arc<Client>,
        url: String,
        state: Arc<Mutex<BufferState>>,
    ) {
        println!("🔄 [HttpReader] 开始流式下载...");
        
        match client.get(&url).send().await {
            Ok(response) => {
                let mut stream = response.bytes_stream();
                let mut total = 0u64;
                let mut chunk_count = 0u64;
                
                // 🚀 关键：边接收边缓存，立即可用
                while let Some(chunk_result) = stream.next().await {
                    // 检查退出信号
                    if state.lock().should_exit {
                        println!("🛑 [HttpReader] 下载线程退出");
                        break;
                    }
                    
                    match chunk_result {
                        Ok(chunk) => {
                            total += chunk.len() as u64;
                            chunk_count += 1;
                            
                            // 立即添加到缓冲
                            state.lock().add_chunk(chunk);
                            
                            // 每10MB打印一次进度
                            if chunk_count % 100 == 0 {
                                println!("📥 [HttpReader] 已接收: {:.2}MB", total as f64 / 1024.0 / 1024.0);
                            }
                        }
                        Err(e) => {
                            log::error!("❌ 接收失败: {}", e);
                            break;
                        }
                    }
                }
                
                // 设置EOF
                state.lock().eof = true;
                println!("✅ [HttpReader] 下载完成: {:.2}MB", total as f64 / 1024.0 / 1024.0);
            }
            Err(e) => {
                log::error!("❌ HTTP请求失败: {}", e);
                state.lock().eof = true;
            }
        }
    }
}

impl Read for SimpleHttpReader {
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

impl Seek for SimpleHttpReader {
    fn seek(&mut self, pos: SeekFrom) -> io::Result<u64> {
        // 🔍 诊断：记录所有seek尝试
        log::warn!("⚠️ Decoder尝试seek: {:?}（流式播放不支持）", pos);
        println!("⚠️ [HttpReader] Decoder尝试seek: {:?}（这会导致失败！）", pos);
        Err(io::Error::new(io::ErrorKind::Unsupported, "流式播放阶段不支持seek"))
    }
}

impl Drop for SimpleHttpReader {
    fn drop(&mut self) {
        self.state.lock().should_exit = true;
        
        if let Some(handle) = self.downloader_thread.take() {
            let _ = handle.join();
        }
    }
}

