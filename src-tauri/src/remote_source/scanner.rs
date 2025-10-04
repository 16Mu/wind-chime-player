// 远程音乐扫描器 - 单一职责：扫描远程音乐库并提取元数据
use crate::remote_source::{RemoteSourceClient, RemoteFileInfo};
use crate::db::Database;
use crate::player::Track;
use crate::metadata_extractor::MetadataExtractor;
use std::sync::Arc;
use std::sync::Mutex;
use anyhow::Result;
use serde::Serialize;
use tokio::io::AsyncReadExt;

#[derive(Debug, Clone, Serialize)]
pub struct ScanProgress {
    pub current_file: String,
    pub files_found: usize,
    pub files_processed: usize,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScanResult {
    pub total_files: usize,
    pub added: usize,
    pub updated: usize,
    pub failed: usize,
    pub errors: Vec<String>,
    pub duration_seconds: u64,
}

pub struct RemoteScanner {
    client: Arc<dyn RemoteSourceClient>,
    db: Arc<Mutex<Database>>,
    server_id: String,
    metadata_extractor: MetadataExtractor,
}

impl RemoteScanner {
    pub fn new(
        client: Arc<dyn RemoteSourceClient>,
        db: Arc<Mutex<Database>>,
        server_id: String,
    ) -> Self {
        Self { 
            client, 
            db, 
            server_id,
            metadata_extractor: MetadataExtractor::new(),
        }
    }

    /// 开始扫描远程音乐库
    pub async fn scan(&self, root_path: &str) -> Result<ScanResult> {
        let start_time = std::time::Instant::now();
        
        log::info!("开始扫描远程音乐库: {}", root_path);
        
        let mut files_found = 0;
        let mut added = 0;
        let mut updated = 0;
        let mut errors = Vec::new();
        
        // 递归扫描目录
        let audio_files = match self.scan_directory_recursive(root_path, &mut files_found).await {
            Ok(files) => files,
            Err(e) => {
                errors.push(format!("扫描目录失败: {}", e));
                return Ok(ScanResult {
                    total_files: 0,
                    added: 0,
                    updated: 0,
                    failed: 1,
                    errors,
                    duration_seconds: start_time.elapsed().as_secs(),
                });
            }
        };
        
        log::info!("找到 {} 个音频文件", audio_files.len());
        
        // 处理音频文件
        for (index, file) in audio_files.iter().enumerate() {
            log::debug!("处理文件 {}/{}: {}", index + 1, audio_files.len(), file.name);
            
            match self.process_audio_file(file).await {
                Ok(is_new) => {
                    if is_new {
                        added += 1;
                    } else {
                        updated += 1;
                    }
                },
                Err(e) => {
                    let error_msg = format!("{}: {}", file.path, e);
                    log::error!("处理文件失败: {}", error_msg);
                    errors.push(error_msg);
                }
            }
        }
        
        let duration = start_time.elapsed();
        log::info!(
            "扫描完成：添加 {} 首，更新 {} 首，失败 {} 个，耗时 {:?}",
            added, updated, errors.len(), duration
        );
        
        Ok(ScanResult {
            total_files: files_found,
            added,
            updated,
            failed: errors.len(),
            errors,
            duration_seconds: duration.as_secs(),
        })
    }

    /// 递归扫描目录
    fn scan_directory_recursive<'a>(
        &'a self,
        path: &'a str,
        counter: &'a mut usize,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Vec<RemoteFileInfo>>> + Send + 'a>> {
        Box::pin(async move {
        let mut audio_files = Vec::new();
        
        log::debug!("扫描目录: {}", path);
        let items = self.client.list_directory(path).await?;
        log::info!("📁 目录 {} 中找到 {} 个项目", path, items.len());
        
        for item in items {
            if item.is_directory {
                log::debug!("  📂 子目录: {}", item.name);
                // 递归扫描子目录
                match self.scan_directory_recursive(&item.path, counter).await {
                    Ok(sub_files) => audio_files.extend(sub_files),
                    Err(e) => {
                        log::warn!("跳过子目录 {}: {}", item.path, e);
                    }
                }
            } else {
                log::debug!("  📄 文件: {} (is_audio: {})", item.name, self.is_audio_file(&item));
                if self.is_audio_file(&item) {
                    log::info!("  ✅ 识别为音频文件: {}", item.name);
                    audio_files.push(item);
                    *counter += 1;
                } else {
                    log::debug!("  ❌ 跳过非音频文件: {}", item.name);
                }
            }
        }
        
        log::info!("📊 目录 {} 扫描完成，找到 {} 个音频文件", path, audio_files.len());
        Ok(audio_files)
        })
    }

    /// 判断是否为音频文件
    fn is_audio_file(&self, file: &RemoteFileInfo) -> bool {
        let name = file.name.to_lowercase();
        let ext = name.rsplit('.').next().unwrap_or("");
        
        // 支持的音频格式 - 与本地扫描保持一致
        matches!(ext,
            // 常见无损格式
            "flac" | "wav" | "aiff" | "aif" | "aifc" |
            // 常见有损格式
            "mp3" | "aac" | "m4a" | "ogg" | "oga" | "opus" |
            // 其他格式
            "wma" | "ape" | "tak" | "tta" | "dsd" | "dsf" | "dff" |
            // 模块音乐格式
            "mod" | "it" | "s3m" | "xm" |
            // 其他无损格式
            "alac" | "wv" | "mka"
        )
    }

    /// 处理单个音频文件
    async fn process_audio_file(&self, file: &RemoteFileInfo) -> Result<bool> {
        let source_type = file.source_type.to_string();
        
        // 构建远程路径标识：webdav://server_id#/path/to/file.mp3
        let track_path = format!("{}://{}#{}", source_type, self.server_id, file.path);
        
        // 检查是否已存在 - 使用块来确保锁立即释放
        let (existing, is_new) = {
            let db = self.db.lock().map_err(|e| anyhow::anyhow!("数据库锁定失败: {}", e))?;
            let existing = db.get_track_by_path(&track_path).ok().flatten();
            let is_new = existing.is_none();
            (existing, is_new)
        }; // db 锁在这里释放
        
        // 下载并提取元数据
        log::debug!("开始下载并提取元数据: {}", file.path);
        let metadata = match self.download_and_extract_metadata(file).await {
            Ok(meta) => meta,
            Err(e) => {
                log::warn!("提取元数据失败 ({}): {}, 使用文件名解析", file.path, e);
                // 如果下载失败，回退到文件名解析
                let (title, artist) = self.parse_filename(&file.name);
                crate::metadata_extractor::MusicMetadata {
                    title: Some(title),
                    artist,
                    album: None,
                    album_artist: None,
                    track_number: None,
                    disc_number: None,
                    year: None,
                    genre: None,
                    duration_ms: None,
                    sample_rate: None,
                    channels: None,
                    bit_rate: None,
                    format: None,
                    album_cover_data: None,
                    album_cover_mime: None,
                    embedded_lyrics: None,
                }
            }
        };
        
        // 保存歌词到数据库（如果有内嵌歌词）
        let track_id = existing.as_ref().map(|t| t.id).unwrap_or(0);
        if let Some(lyrics_content) = &metadata.embedded_lyrics {
            if track_id > 0 {
                // 使用块来确保锁立即释放
                {
                    let db = self.db.lock().map_err(|e| anyhow::anyhow!("数据库锁定失败: {}", e))?;
                    if let Err(e) = db.insert_lyrics(track_id, lyrics_content, "lrc", "embedded") {
                        log::warn!("保存内嵌歌词失败: {}", e);
                    }
                } // db 锁在这里释放
            }
        }
        
        // 构建 Track 对象
        let track = Track {
            id: track_id,
            path: track_path,
            title: metadata.title.or_else(|| Some(self.parse_filename(&file.name).0)),
            artist: metadata.artist,
            album: metadata.album,
            duration_ms: metadata.duration_ms.map(|d| d as i64),
            album_cover_data: metadata.album_cover_data,
            album_cover_mime: metadata.album_cover_mime,
        };
        
        // 使用块来确保锁立即释放
        {
            let db = self.db.lock().map_err(|e| anyhow::anyhow!("数据库锁定失败: {}", e))?;
            db.insert_track(&track)?;
        } // db 锁在这里释放
        
        log::info!("✅ 处理完成: {} (专辑: {:?}, 封面: {}, 时长: {:?}ms)", 
                  file.name, 
                  track.album,
                  if track.album_cover_data.is_some() { "有" } else { "无" },
                  track.duration_ms);
        
        Ok(is_new)
    }

    /// 下载并提取音频文件元数据
    async fn download_and_extract_metadata(&self, file: &RemoteFileInfo) -> Result<crate::metadata_extractor::MusicMetadata> {
        // 策略1: 尝试只下载前面的部分（对于 MP3/FLAC，元数据通常在头部）
        // 先下载前 512KB
        const INITIAL_CHUNK_SIZE: u64 = 512 * 1024; // 512KB
        
        let file_size = file.size.unwrap_or(0);
        let download_size = if file_size > 0 && file_size < INITIAL_CHUNK_SIZE {
            file_size
        } else {
            INITIAL_CHUNK_SIZE
        };
        
        // 尝试部分下载
        match self.client.download_range(&file.path, 0, Some(download_size)).await {
            Ok(mut stream) => {
                let mut buffer = Vec::new();
                stream.read_to_end(&mut buffer).await?;
                
                log::debug!("下载了 {} 字节用于元数据提取", buffer.len());
                
                // 提取文件扩展名
                let ext = file.name.rsplit('.').next();
                
                // 尝试从部分数据提取
                match self.metadata_extractor.extract_from_bytes(&buffer, ext) {
                    Ok(metadata) => {
                        log::info!("✅ 从部分数据成功提取元数据");
                        return Ok(metadata);
                    }
                    Err(e) => {
                        log::debug!("部分数据提取失败: {}, 尝试下载完整文件", e);
                        
                        // 如果文件很小或部分提取失败，下载完整文件
                        // 但限制最大下载大小（例如 50MB）
                        const MAX_DOWNLOAD_SIZE: u64 = 50 * 1024 * 1024; // 50MB
                        
                        if file_size > 0 && file_size <= MAX_DOWNLOAD_SIZE {
                            return self.download_full_and_extract(file).await;
                        } else if file_size == 0 || file_size > MAX_DOWNLOAD_SIZE {
                            log::warn!("文件过大或大小未知 ({}), 跳过完整下载", file_size);
                            return Err(anyhow::anyhow!("文件过大或无法确定大小"));
                        }
                    }
                }
            }
            Err(e) => {
                log::warn!("部分下载失败: {}, 尝试完整下载", e);
                return self.download_full_and_extract(file).await;
            }
        }
        
        Err(anyhow::anyhow!("无法提取元数据"))
    }

    /// 下载完整文件并提取元数据
    async fn download_full_and_extract(&self, file: &RemoteFileInfo) -> Result<crate::metadata_extractor::MusicMetadata> {
        log::debug!("下载完整文件: {}", file.path);
        
        let mut stream = self.client.download_stream(&file.path).await?;
        let mut buffer = Vec::new();
        stream.read_to_end(&mut buffer).await?;
        
        log::debug!("完整下载了 {} 字节", buffer.len());
        
        let ext = file.name.rsplit('.').next();
        let metadata = self.metadata_extractor.extract_from_bytes(&buffer, ext)?;
        
        log::info!("✅ 从完整文件成功提取元数据");
        Ok(metadata)
    }

    /// 从文件名解析标题和艺术家
    fn parse_filename(&self, filename: &str) -> (String, Option<String>) {
        let name_without_ext = filename.rsplit('.').nth(1)
            .or(Some(filename))
            .unwrap_or(filename);
        
        // 尝试解析 "Artist - Title" 格式
        if let Some((artist, title)) = name_without_ext.split_once(" - ") {
            (title.trim().to_string(), Some(artist.trim().to_string()))
        } else {
            (name_without_ext.to_string(), None)
        }
    }
}