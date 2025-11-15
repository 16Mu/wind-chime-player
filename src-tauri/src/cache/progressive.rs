// 渐进式下载器
// 支持边下边播 + 智能缓存决策

use reqwest::Client;
use std::sync::Arc;
use parking_lot::Mutex;
use bytes::Bytes;
use tokio::io::AsyncWriteExt;
use std::path::PathBuf;

/// 下载状态
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DownloadState {
    /// 未开始
    Idle,
    /// 下载中
    Downloading,
    /// 已完成
    Completed,
    /// 失败
    Failed,
}

/// 下载进度
#[derive(Debug, Clone)]
pub struct DownloadProgress {
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub state: DownloadState,
}

/// 渐进式下载器
pub struct ProgressiveDownloader {
    url: String,
    username: Option<String>,
    password: Option<String>,
    client: Client,
    progress: Arc<Mutex<DownloadProgress>>,
}

impl ProgressiveDownloader {
    /// 创建新的下载器
    pub fn new(url: String, username: Option<String>, password: Option<String>) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .unwrap();
        
        Self {
            url,
            username,
            password,
            client,
            progress: Arc::new(Mutex::new(DownloadProgress {
                downloaded_bytes: 0,
                total_bytes: None,
                state: DownloadState::Idle,
            })),
        }
    }
    
    /// 获取下载进度
    pub fn get_progress(&self) -> DownloadProgress {
        self.progress.lock().clone()
    }
    
    /// 下载指定范围的数据
    pub async fn download_range(&self, start: u64, end: u64) -> Result<Bytes, String> {
        let mut request = self.client.get(&self.url);
        
        // 添加认证
        if let (Some(username), Some(password)) = (&self.username, &self.password) {
            request = request.basic_auth(username, Some(password));
        }
        
        // Range请求
        request = request.header("Range", format!("bytes={}-{}", start, end));
        
        // 发送请求
        let response = request.send().await
            .map_err(|e| format!("请求失败: {}", e))?;
        
        if !response.status().is_success() {
            return Err(format!("HTTP错误: {}", response.status()));
        }
        
        // 读取数据
        let bytes = response.bytes().await
            .map_err(|e| format!("读取数据失败: {}", e))?;
        
        Ok(bytes)
    }
    
    /// 下载完整文件（保存到指定路径）
    pub async fn download_full(&self, output_path: PathBuf) -> Result<u64, String> {
        {
            let mut progress = self.progress.lock();
            progress.state = DownloadState::Downloading;
            progress.downloaded_bytes = 0;
        }
        
        let mut request = self.client.get(&self.url);
        
        // 添加认证
        if let (Some(username), Some(password)) = (&self.username, &self.password) {
            request = request.basic_auth(username, Some(password));
        }
        
        // 发送请求
        let response = request.send().await
            .map_err(|e| {
                self.progress.lock().state = DownloadState::Failed;
                format!("请求失败: {}", e)
            })?;
        
        if !response.status().is_success() {
            self.progress.lock().state = DownloadState::Failed;
            return Err(format!("HTTP错误: {}", response.status()));
        }
        
        // 获取文件大小
        let total_bytes = response.content_length();
        {
            let mut progress = self.progress.lock();
            progress.total_bytes = total_bytes;
        }
        
        // 创建文件
        let mut file = tokio::fs::File::create(&output_path).await
            .map_err(|e| {
                self.progress.lock().state = DownloadState::Failed;
                format!("创建文件失败: {}", e)
            })?;
        
        // 分块下载并写入
        let mut stream = response.bytes_stream();
        let mut downloaded = 0u64;
        
        use futures::StreamExt;
        
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| {
                self.progress.lock().state = DownloadState::Failed;
                format!("读取数据失败: {}", e)
            })?;
            
            file.write_all(&chunk).await.map_err(|e| {
                self.progress.lock().state = DownloadState::Failed;
                format!("写入文件失败: {}", e)
            })?;
            
            downloaded += chunk.len() as u64;
            
            // 更新进度
            {
                let mut progress = self.progress.lock();
                progress.downloaded_bytes = downloaded;
            }
        }
        
        // 同步文件
        file.sync_all().await.map_err(|e| {
            self.progress.lock().state = DownloadState::Failed;
            format!("同步文件失败: {}", e)
        })?;
        
        // 完成
        {
            let mut progress = self.progress.lock();
            progress.state = DownloadState::Completed;
            progress.downloaded_bytes = downloaded;
        }
        
        log::info!("下载完成: {} -> {:.2} MB", 
            self.url, 
            downloaded as f64 / 1024.0 / 1024.0
        );
        
        Ok(downloaded)
    }
    
    /// 取消下载
    pub fn cancel(&self) {
        // 实现取消逻辑
        let mut progress = self.progress.lock();
        progress.state = DownloadState::Failed;
    }
}

/// 智能下载策略
pub struct SmartDownloadStrategy {
    /// 初始下载大小（字节）- 用于立即播放
    pub initial_chunk_size: u64,
    
    /// 是否后台下载完整文件
    pub download_full: bool,
}

impl Default for SmartDownloadStrategy {
    fn default() -> Self {
        Self {
            initial_chunk_size: 1_000_000,  // 1MB，约30秒音乐
            download_full: false,
        }
    }
}

impl SmartDownloadStrategy {
    /// 根据条件决定下载策略
    pub fn decide(
        &mut self,
        is_wifi: bool,
        is_favorite: bool,
        play_count: u32,
        storage_available: bool,
    ) {
        // WiFi + (收藏 or 播放2次以上) + 存储充足 → 下载完整文件
        if is_wifi && (is_favorite || play_count >= 2) && storage_available {
            self.download_full = true;
        } else {
            self.download_full = false;
        }
    }
}






