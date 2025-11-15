// HTTP streaming reader
// Single GET request with chunked transfer encoding

use bytes::Bytes;
use reqwest::Client;
use std::collections::VecDeque;
use std::io::{self, Read, Seek, SeekFrom};
use std::sync::Arc;
use parking_lot::Mutex;
use std::thread;
use futures::StreamExt;

/// Buffer state
struct BufferState {
    chunks: VecDeque<Bytes>,
    current_chunk_pos: usize,
    total_buffered: usize,
    eof: bool,
    should_exit: bool,
    error: Option<String>,
    file_size: Option<u64>,  // Total file size if known
    current_offset: u64,  // Current file offset for seek support
    seek_requested: Option<u64>,  // Seek position requested
}

impl BufferState {
    fn new() -> Self {
        Self {
            chunks: VecDeque::new(),
            current_chunk_pos: 0,
            total_buffered: 0,
            eof: false,
            should_exit: false,
            error: None,
            file_size: None,
            current_offset: 0,
            seek_requested: None,
        }
    }
    
    fn available(&self) -> usize {
        self.total_buffered
    }
    
    /// 256MB buffer limit (increased to support large lossless files 200MB+)
    fn add_chunk(&mut self, chunk: Bytes) -> bool {
        const MAX_BUFFER_SIZE: usize = 256 * 1024 * 1024;
        
        if self.total_buffered + chunk.len() > MAX_BUFFER_SIZE {
            return false;
        }
        
        self.total_buffered += chunk.len();
        self.chunks.push_back(chunk);
        true
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
            self.current_offset += to_read as u64;
            
            if self.current_chunk_pos >= chunk.len() {
                self.chunks.pop_front();
                self.current_chunk_pos = 0;
            }
        }
        
        total_read
    }
    
    fn handle_seek(&mut self, offset: u64) {
        // Clear buffers
        self.chunks.clear();
        self.current_chunk_pos = 0;
        self.total_buffered = 0;
        self.eof = false;
        
        // Set new offset and mark seek requested
        self.current_offset = offset;
        self.seek_requested = Some(offset);
    }
}

/// HTTP streaming reader
pub struct SimpleHttpReader {
    state: Arc<Mutex<BufferState>>,
    downloader_thread: Option<thread::JoinHandle<()>>,
    url: String,
    username: String,
    password: String,
}

impl SimpleHttpReader {
    /// Get file size if known
    pub fn get_file_size(&self) -> Option<u64> {
        self.state.lock().file_size
    }
    
    /// Get currently buffered size in bytes
    pub fn get_buffered_size(&self) -> usize {
        self.state.lock().available()
    }
    
    /// Create new HTTP stream reader
    pub async fn new(url: String, username: String, password: String) -> io::Result<Self> {
        use base64::Engine;
        
        let mut client_builder = Client::builder()
            .pool_max_idle_per_host(5)
            .pool_idle_timeout(Some(std::time::Duration::from_secs(90)))
            // Increased timeout from 30s to 60s for large files and slow networks
            .timeout(std::time::Duration::from_secs(60));
        
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
            url.clone(),
            state.clone(),
        )?;
        
        log::info!("HTTP stream reader created");
        println!("[HttpReader] Streaming download started");
        
        Ok(Self {
            state,
            downloader_thread: Some(downloader_thread),
            url,
            username,
            password,
        })
    }
    
    /// Start downloader thread
    fn start_downloader(
        client: Arc<Client>,
        url: String,
        state: Arc<Mutex<BufferState>>,
    ) -> io::Result<thread::JoinHandle<()>> {
        thread::Builder::new()
            .name("http-downloader".to_string())
            .spawn(move || {
                let rt = match tokio::runtime::Runtime::new() {
                    Ok(rt) => rt,
                    Err(e) => {
                        let error_msg = format!("Failed to create tokio runtime: {}", e);
                        log::error!("{}", error_msg);
                        
                        let mut s = state.lock();
                        s.eof = true;
                        s.error = Some(error_msg);
                        return;
                    }
                };
                
                rt.block_on(async {
                    Self::download_stream(client, url, state).await;
                });
            })
            .map_err(|e| io::Error::new(io::ErrorKind::Other, format!("Failed to spawn downloader thread: {}", e)))
    }
    
    /// Stream download
    async fn download_stream(
        client: Arc<Client>,
        url: String,
        state: Arc<Mutex<BufferState>>,
    ) {
        use std::time::Duration;
        
        println!("[HttpReader] Starting streaming download");
        
        // Increased max retries from 3 to 10 for better resilience to network issues
        const MAX_RETRIES: u32 = 10;
        const INITIAL_RETRY_DELAY: Duration = Duration::from_millis(500);
        
        let mut retry_count = 0u32;
        let mut retry_delay = INITIAL_RETRY_DELAY;
        let mut current_download_offset = 0u64;
        
        loop {
            // Check for seek requests
            let seek_offset = {
                let mut s = state.lock();
                if let Some(offset) = s.seek_requested.take() {
                    log::info!("[HttpReader] Processing seek request to offset {}", offset);
                    current_download_offset = offset;
                    Some(offset)
                } else {
                    None
                }
            };
            
            // Build request with optional Range header
            let mut request = client.get(&url);
            if current_download_offset > 0 || seek_offset.is_some() {
                let range_header = format!("bytes={}-", current_download_offset);
                log::info!("[HttpReader] Using Range header: {}", range_header);
                request = request.header("Range", range_header);
            }
            
            match request.send().await {
                Ok(response) => {
                    let status = response.status();
                    
                    if !status.is_success() {
                        let error_msg = format!("HTTP error: {}", status);
                        log::error!("{}", error_msg);
                        
                        let mut s = state.lock();
                        s.eof = true;
                        s.error = Some(error_msg);
                        return;
                    }
                    
                    if let Some(content_length) = response.headers()
                        .get("content-length")
                        .and_then(|v| v.to_str().ok())
                        .and_then(|s| s.parse::<u64>().ok())
                    {
                        log::info!("File size: {:.2}MB", content_length as f64 / 1024.0 / 1024.0);
                        state.lock().file_size = Some(content_length);
                    }
                    
                    retry_count = 0;  // 重置重试计数
                    retry_delay = INITIAL_RETRY_DELAY;
                    
                    let mut stream = response.bytes_stream();
                    let mut total = 0u64;
                    let mut chunk_count = 0u64;
                    
                    while let Some(chunk_result) = stream.next().await {
                        let s = state.lock();
                        let should_exit = s.should_exit;
                        let has_seek = s.seek_requested.is_some();
                        drop(s);
                        
                        if should_exit {
                            println!("[HttpReader] Downloader thread exiting");
                            return;
                        }
                        
                        // If seek was requested, abort current download and restart
                        if has_seek {
                            log::info!("[HttpReader] Seek requested, restarting download");
                            break;
                        }
                        
                        match chunk_result {
                            Ok(chunk) => {
                                let chunk_len = chunk.len() as u64;
                                total += chunk_len;
                                current_download_offset += chunk_len;
                                chunk_count += 1;
                                
                                while !state.lock().add_chunk(chunk.clone()) {
                                    tokio::time::sleep(Duration::from_millis(50)).await;
                                }
                                
                                if chunk_count % 100 == 0 {
                                    println!("[HttpReader] Received: {:.2}MB", total as f64 / 1024.0 / 1024.0);
                                }
                            }
                            Err(e) => {
                                retry_count += 1;
                                
                                if retry_count > MAX_RETRIES {
                                    let error_msg = format!("Data receive failed, max retries reached: {}", e);
                                    log::error!("{}", error_msg);
                                    
                                    let mut s = state.lock();
                                    s.eof = true;
                                    s.error = Some(error_msg);
                                    return;
                                }
                                
                                // Improved error handling with exponential backoff (max 5s)
                                let delay = retry_delay.min(Duration::from_secs(5));
                                log::warn!("Data receive failed (attempt {}/{}), retrying in {}ms: {}", 
                                    retry_count, MAX_RETRIES, delay.as_millis(), e);
                                
                                tokio::time::sleep(delay).await;
                                retry_delay = (retry_delay * 2).min(Duration::from_secs(5));
                                break;
                            }
                        }
                    }
                    
                    if retry_count == 0 {
                        state.lock().eof = true;
                        println!("[HttpReader] Download complete: {:.2}MB", total as f64 / 1024.0 / 1024.0);
                        return;
                    }
                }
                Err(e) => {
                    retry_count += 1;
                    
                    if retry_count > MAX_RETRIES {
                        let error_msg = format!("HTTP request failed, max retries reached: {}", e);
                        log::error!("{}", error_msg);
                        
                        let mut s = state.lock();
                        s.eof = true;
                        s.error = Some(error_msg);
                        return;
                    }
                    
                    log::warn!("HTTP request failed (attempt {}), retrying in {}ms: {}", 
                        retry_count, retry_delay.as_millis(), e);
                    
                    tokio::time::sleep(retry_delay).await;
                    retry_delay = retry_delay * 2;
                }
            }
        }
    }
}

impl Read for SimpleHttpReader {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        loop {
            let state = self.state.lock();
            
            if state.available() > 0 {
                drop(state);
                let n = self.state.lock().read_bytes(buf);
                return Ok(n);
            }
            
            if state.eof {
                if let Some(error) = &state.error {
                    return Err(io::Error::new(
                        io::ErrorKind::Other,
                        error.clone()
                    ));
                }
                return Ok(0);
            }
            
            drop(state);
            // Optimized polling wait time (increased from 1ms to 10ms to reduce CPU usage)
            thread::sleep(std::time::Duration::from_millis(10));
        }
    }
}

impl Seek for SimpleHttpReader {
    fn seek(&mut self, pos: SeekFrom) -> io::Result<u64> {
        let state = self.state.lock();
        let file_size = state.file_size;
        let current_offset = state.current_offset;
        drop(state);
        
        // Calculate target position
        let target_offset = match pos {
            SeekFrom::Start(offset) => offset as i64,
            SeekFrom::End(offset) => {
                if let Some(size) = file_size {
                    size as i64 + offset
                } else {
                    log::warn!("Seek from end requested but file size unknown");
                    return Err(io::Error::new(
                        io::ErrorKind::Unsupported,
                        "Cannot seek from end: file size unknown"
                    ));
                }
            }
            SeekFrom::Current(offset) => current_offset as i64 + offset,
        };
        
        if target_offset < 0 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "Seek position is negative"
            ));
        }
        
        let target_offset = target_offset as u64;
        
        if let Some(size) = file_size {
            if target_offset > size {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "Seek position exceeds file size"
                ));
            }
        }
        
        log::info!("Seek requested: {:?} -> offset {}", pos, target_offset);
        println!("[HttpReader] Seek to offset: {}", target_offset);
        
        // Handle the seek
        self.state.lock().handle_seek(target_offset);
        
        // Wait a bit for buffer to refill
        thread::sleep(std::time::Duration::from_millis(100));
        
        Ok(target_offset)
    }
}

impl symphonia::core::io::MediaSource for SimpleHttpReader {
    fn is_seekable(&self) -> bool {
        // Now we support seek via HTTP Range requests
        self.state.lock().file_size.is_some()
    }
    
    fn byte_len(&self) -> Option<u64> {
        // Return file size if known from Content-Length header
        self.state.lock().file_size
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

