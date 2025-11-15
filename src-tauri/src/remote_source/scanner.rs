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

/// 元数据提取策略
#[derive(Debug, Clone)]
enum MetadataStrategy {
    /// 只读取文件头部（字节数）
    HeaderOnly(u64),
    /// 读取文件头部+尾部（头部字节数，尾部字节数）
    HeaderAndFooter(u64, u64),
    /// 下载完整文件
    FullDownload,
    /// 跳过提取（原因）
    Skip(String),
}

#[derive(Debug, Clone, Serialize)]
#[allow(dead_code)]
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
        println!("📊 [Scanner] 提取元数据: {} ({})", file.name, file.size.unwrap_or(0));
        let metadata = match self.download_and_extract_metadata(file).await {
            Ok(meta) => {
                println!("✅ [Scanner] 元数据提取成功: duration={:?}ms", meta.duration_ms);
                meta
            },
            Err(e) => {
                log::warn!("提取元数据失败 ({}): {}, 使用文件名解析", file.path, e);
                println!("⚠️ [Scanner] 元数据提取失败: {}, 使用文件名", e);
                // 如果下载失败，回退到文件名解析
                let (title, artist) = self.parse_filename(&file.name);
                crate::metadata_extractor::MusicMetadata {
                    title: Some(title),
                    artist,
                    ..Default::default()
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
            artist_photo_data: metadata.artist_photo_data,
            artist_photo_mime: metadata.artist_photo_mime,
            embedded_lyrics: metadata.embedded_lyrics,
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
        // 🎯 智能元数据提取策略：根据文件格式选择最优方案
        let file_size = file.size.unwrap_or(0);
        let file_ext = file.name.to_lowercase();
        let format_strategy = self.get_format_strategy(&file_ext, file_size);
        
        log::debug!("文件: {}, 大小: {:.2}MB, 策略: {:?}", 
            file.name, 
            file_size as f64 / 1024.0 / 1024.0,
            format_strategy
        );
        
        match format_strategy {
            MetadataStrategy::HeaderOnly(chunk_size) => {
                // 策略1: 只读取头部（适用于FLAC、M4A等）
                self.extract_from_header(file, chunk_size).await
            }
            MetadataStrategy::HeaderAndFooter(header_size, footer_size) => {
                // 策略2: 读取头部+尾部（适用于MP3）
                self.extract_from_header_footer(file, header_size, footer_size).await
            }
            MetadataStrategy::FullDownload => {
                // 策略3: 下载完整文件（文件较小）
                self.download_full_and_extract(file).await
            }
            MetadataStrategy::Skip(reason) => {
                // 策略4: 跳过（文件太大或格式不支持）
                Err(anyhow::anyhow!("{}", reason))
            }
        }
    }
    
    /// 根据文件格式和大小决定元数据提取策略
    fn get_format_strategy(&self, filename: &str, file_size: u64) -> MetadataStrategy {
        // 文件格式检测
        let ext = filename.rsplit('.').next().unwrap_or("");
        
        // 如果文件大小未知，使用保守策略
        if file_size == 0 {
            return MetadataStrategy::Skip("文件大小未知".to_string());
        }
        
        // 超小文件（<5MB）：直接完整下载
        if file_size < 5 * 1024 * 1024 {
            return MetadataStrategy::FullDownload;
        }
        
        // 根据格式选择策略
        match ext {
            // FLAC: 元数据在STREAMINFO和VORBIS_COMMENT块中，位于文件头部
            // FLAC 文件结构：fLaC标记(4字节) + METADATA_BLOCK_STREAMINFO + VORBIS_COMMENT等
            // 实际测试：99%的FLAC文件，512KB就包含了所有元数据（包括封面）
            // 渐进式策略：512KB→1MB→2MB（如果需要的话）
            "flac" => {
                if file_size < 200 * 1024 * 1024 { // <200MB
                    MetadataStrategy::HeaderOnly(512 * 1024) // 512KB（快速首次尝试）
                } else {
                    MetadataStrategy::Skip(format!("FLAC文件过大 ({:.2}MB)", file_size as f64 / 1024.0 / 1024.0))
                }
            }
            
            // M4A/AAC: 元数据在moov atom中，通常在文件头部
            // moov atom通常在前256KB-512KB，很少超过1MB
            "m4a" | "aac" | "mp4" => {
                if file_size < 150 * 1024 * 1024 { // <150MB
                    MetadataStrategy::HeaderOnly(512 * 1024) // 512KB（快速首次尝试）
                } else {
                    MetadataStrategy::Skip(format!("M4A文件过大 ({:.2}MB)", file_size as f64 / 1024.0 / 1024.0))
                }
            }
            
            // MP3: ID3v2在头部，ID3v1可能在尾部
            // ID3v2通常在前128KB-256KB，ID3v1固定在最后128字节
            "mp3" => {
                if file_size < 100 * 1024 * 1024 { // <100MB
                    MetadataStrategy::HeaderAndFooter(256 * 1024, 128 * 1024) // 256KB头+128KB尾
                } else {
                    MetadataStrategy::Skip(format!("MP3文件过大 ({:.2}MB)", file_size as f64 / 1024.0 / 1024.0))
                }
            }
            
            // OGG/OPUS: 元数据在Vorbis Comment中，位于头部
            "ogg" | "opus" => {
                if file_size < 100 * 1024 * 1024 { // <100MB
                    MetadataStrategy::HeaderOnly(256 * 1024) // 256KB（快速首次尝试）
                } else {
                    MetadataStrategy::Skip(format!("OGG文件过大 ({:.2}MB)", file_size as f64 / 1024.0 / 1024.0))
                }
            }
            
            // WAV: 元数据可能分散，但通常在头部
            "wav" => {
                if file_size < 50 * 1024 * 1024 { // <50MB，WAV文件通常不压缩
                    MetadataStrategy::FullDownload
                } else {
                    MetadataStrategy::HeaderOnly(512 * 1024) // 512KB
                }
            }
            
            // APE: 元数据在APEv2 tag中，可能在头部或尾部
            "ape" => {
                if file_size < 100 * 1024 * 1024 { // <100MB
                    MetadataStrategy::HeaderAndFooter(256 * 1024, 256 * 1024)
                } else {
                    MetadataStrategy::Skip(format!("APE文件过大 ({:.2}MB)", file_size as f64 / 1024.0 / 1024.0))
                }
            }
            
            // 其他格式：使用通用策略
            _ => {
                if file_size < 50 * 1024 * 1024 { // <50MB
                    MetadataStrategy::FullDownload
                } else {
                    MetadataStrategy::HeaderOnly(256 * 1024) // 256KB
                }
            }
        }
    }
    
    /// 从文件头部提取元数据（渐进式增加读取大小）
    async fn extract_from_header(&self, file: &RemoteFileInfo, initial_chunk_size: u64) -> Result<crate::metadata_extractor::MusicMetadata> {
        let file_size = file.size.unwrap_or(0);
        
        // 🎯 渐进式策略：逐步增加读取大小
        // 参考业界做法：music-metadata、TagLib等库的处理方式
        let chunk_sizes = vec![
            initial_chunk_size,           // 第1次尝试：初始大小（如4MB）
            initial_chunk_size * 2,       // 第2次尝试：8MB
            initial_chunk_size * 4,       // 第3次尝试：16MB
        ];
        
        for (attempt, &chunk_size) in chunk_sizes.iter().enumerate() {
            // 如果文件比chunk_size小，直接用文件大小
            let download_size = if file_size > 0 && file_size < chunk_size {
                file_size
            } else {
                chunk_size
            };
            
            log::debug!("📥 尝试 #{}: 从头部读取 {:.2}MB", 
                attempt + 1, 
                download_size as f64 / 1024.0 / 1024.0
            );
            
            match self.client.download_range(&file.path, 0, Some(download_size)).await {
                Ok(mut stream) => {
                    let mut buffer = Vec::new();
                    if stream.read_to_end(&mut buffer).await.is_ok() {
                        let ext = file.name.rsplit('.').next();
                        match self.metadata_extractor.extract_from_bytes(&buffer, ext) {
                            Ok(metadata) => {
                                log::info!("✅ 成功提取元数据（尝试 #{}, {:.2}MB）: {}", 
                                    attempt + 1,
                                    buffer.len() as f64 / 1024.0 / 1024.0,
                                    file.name
                                );
                                return Ok(metadata);
                            }
                            Err(e) => {
                                log::debug!("⚠️ 尝试 #{} 失败: {}", attempt + 1, e);
                                // 继续下一次尝试
                            }
                        }
                    }
                }
                Err(e) => {
                    log::debug!("⚠️ 下载失败: {}", e);
                }
            }
            
            // 如果已经读取了完整文件，不再尝试
            if file_size > 0 && download_size >= file_size {
                log::warn!("已读取完整文件但仍无法提取元数据");
                break;
            }
        }
        
        // 所有尝试都失败，返回错误（使用文件名fallback）
        Err(anyhow::anyhow!(
            "无法从头部提取元数据（已尝试 {} 次，最大 {:.2}MB）",
            chunk_sizes.len(),
            *chunk_sizes.last().unwrap() as f64 / 1024.0 / 1024.0
        ))
    }
    
    /// 从文件头部+尾部提取元数据（适用于MP3等格式，渐进式增加）
    async fn extract_from_header_footer(&self, file: &RemoteFileInfo, initial_header_size: u64, initial_footer_size: u64) -> Result<crate::metadata_extractor::MusicMetadata> {
        log::debug!("📥 从头部+尾部提取元数据: {} (初始头{}KB+尾{}KB)", 
            file.name, initial_header_size / 1024, initial_footer_size / 1024);
        
        let file_size = file.size.unwrap_or(0);
        let ext = file.name.rsplit('.').next();
        
        // 🎯 渐进式策略：逐步增加头部读取大小
        let header_sizes = vec![
            initial_header_size,           // 第1次：1MB
            initial_header_size * 2,       // 第2次：2MB
            initial_header_size * 4,       // 第3次：4MB
        ];
        
        for (attempt, &header_size) in header_sizes.iter().enumerate() {
            log::debug!("📥 尝试 #{}: 头部{:.2}MB + 尾部{:.2}MB", 
                attempt + 1,
                header_size as f64 / 1024.0 / 1024.0,
                initial_footer_size as f64 / 1024.0 / 1024.0
            );
            
            // 下载头部
            match self.client.download_range(&file.path, 0, Some(header_size)).await {
                Ok(mut stream) => {
                    let mut buffer = Vec::new();
                    if stream.read_to_end(&mut buffer).await.is_err() {
                        continue;
                    }
                    
                    // 先尝试只用头部
                    if let Ok(metadata) = self.metadata_extractor.extract_from_bytes(&buffer, ext) {
                        log::info!("✅ 从头部成功提取元数据（尝试 #{}）: {}", attempt + 1, file.name);
                        return Ok(metadata);
                    }
                    
                    // 头部不够，添加尾部
                    if file_size > header_size + initial_footer_size {
                        let footer_start = file_size - initial_footer_size;
                        if let Ok(mut footer_stream) = self.client.download_range(&file.path, footer_start, Some(initial_footer_size)).await {
                            let mut footer_buffer = Vec::new();
                            if footer_stream.read_to_end(&mut footer_buffer).await.is_ok() {
                                buffer.extend_from_slice(&footer_buffer);
                                
                                if let Ok(metadata) = self.metadata_extractor.extract_from_bytes(&buffer, ext) {
                                    log::info!("✅ 从头尾合并成功提取元数据（尝试 #{}）: {}", attempt + 1, file.name);
                                    return Ok(metadata);
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    log::debug!("⚠️ 下载失败: {}", e);
                }
            }
        }
        
        // 所有尝试都失败
        Err(anyhow::anyhow!(
            "无法从头尾提取元数据（已尝试 {} 次）",
            header_sizes.len()
        ))
    }

    /// 下载完整文件并提取元数据（仅用于小文件<5MB）
    async fn download_full_and_extract(&self, file: &RemoteFileInfo) -> Result<crate::metadata_extractor::MusicMetadata> {
        let file_size = file.size.unwrap_or(0);
        log::info!("📦 完整下载小文件提取元数据: {} ({:.2}MB)", 
            file.name, 
            file_size as f64 / 1024.0 / 1024.0
        );
        
        let mut stream = self.client.download_stream(&file.path).await?;
        let mut buffer = Vec::new();
        stream.read_to_end(&mut buffer).await?;
        
        log::debug!("✅ 下载了 {:.2}MB", buffer.len() as f64 / 1024.0 / 1024.0);
        
        let ext = file.name.rsplit('.').next();
        let metadata = self.metadata_extractor.extract_from_bytes(&buffer, ext)?;
        
        log::info!("✅ 从完整文件成功提取元数据: {}", file.name);
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