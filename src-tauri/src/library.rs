use crate::db::Database;
use crate::player::Track;
use anyhow::Result;
use crossbeam_channel::{unbounded, Receiver, Sender};
use lofty::{probe::Probe, prelude::*};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

#[derive(Debug, Clone, Serialize)]
pub struct ScanProgress {
    pub current_file: String,
    pub processed: usize,
    pub total: usize,
    pub errors: Vec<String>,
}

#[derive(Debug)]
pub enum LibraryCommand {
    Scan(Vec<String>),      // paths to scan
    RescanAll,
    GetTracks,
    SearchTracks(String),   // search query
    GetStats,
}

#[derive(Debug, Clone, Serialize)]
pub enum LibraryEvent {
    ScanStarted {
        total_paths: usize,
    },
    ScanProgress(ScanProgress),
    ScanComplete {
        tracks_added: usize,
        tracks_updated: usize,
        errors: Vec<String>,
    },
    TracksLoaded(Vec<Track>),
    SearchResults(Vec<Track>),
    LibraryStats {
        total_tracks: i64,
        total_artists: i64,
        total_albums: i64,
    },
    Error(String),
}

pub struct Library {
    db: Arc<Mutex<Database>>,
    command_rx: Receiver<LibraryCommand>,
    event_tx: Sender<LibraryEvent>,
    is_scanning: Arc<Mutex<bool>>,
}

impl Library {
    pub fn new(db: Arc<Mutex<Database>>) -> Result<(Self, Sender<LibraryCommand>, Receiver<LibraryEvent>)> {
        let (command_tx, command_rx) = unbounded();
        let (event_tx, event_rx) = unbounded();

        let library = Library {
            db,
            command_rx,
            event_tx,
            is_scanning: Arc::new(Mutex::new(false)),
        };

        Ok((library, command_tx, event_rx))
    }

    pub fn run(self) {
        thread::spawn(move || {
            log::info!("Library thread started");

            loop {
                match self.command_rx.recv() {
                    Ok(command) => {
                        if let Err(e) = self.handle_command(command) {
                            log::error!("Error handling library command: {}", e);
                            let _ = self.event_tx.send(LibraryEvent::Error(e.to_string()));
                        }
                    }
                    Err(_) => {
                        log::info!("Library command channel disconnected, stopping library thread");
                        break;
                    }
                }
            }
        });
    }

    fn handle_command(&self, command: LibraryCommand) -> Result<()> {
        match command {
            LibraryCommand::Scan(paths) => {
                self.scan_paths(paths)?;
            }
            LibraryCommand::RescanAll => {
                self.rescan_all_tracks()?;
            }
            LibraryCommand::GetTracks => {
                let tracks = self.get_all_tracks()?;
                let _ = self.event_tx.send(LibraryEvent::TracksLoaded(tracks));
            }
            LibraryCommand::SearchTracks(query) => {
                let tracks = self.search_tracks(&query)?;
                let _ = self.event_tx.send(LibraryEvent::SearchResults(tracks));
            }
            LibraryCommand::GetStats => {
                let stats = self.get_library_stats()?;
                let _ = self.event_tx.send(stats);
            }
        }
        Ok(())
    }

    fn scan_paths(&self, paths: Vec<String>) -> Result<()> {
        // Check if already scanning
        {
            let mut is_scanning = self.is_scanning.lock().unwrap();
            if *is_scanning {
                return Err(anyhow::anyhow!("Scan already in progress"));
            }
            *is_scanning = true;
        }

        log::info!("Starting library scan of {} paths", paths.len());
        let _ = self.event_tx.send(LibraryEvent::ScanStarted {
            total_paths: paths.len(),
        });

        // Collect all audio files
        let mut audio_files = Vec::new();
        let mut scan_errors = Vec::new();

        for path_str in &paths {
            let path = PathBuf::from(path_str);
            match self.collect_audio_files(&path) {
                Ok(mut files) => audio_files.append(&mut files),
                Err(e) => {
                    let error_msg = format!("Error scanning path {}: {}", path_str, e);
                    log::error!("{}", error_msg);
                    scan_errors.push(error_msg);
                }
            }
        }

        log::info!("Found {} audio files to process", audio_files.len());

        // Process files
        let mut tracks_added = 0;
        let mut tracks_updated = 0;
        let mut process_errors = Vec::new();

        for (index, file_path) in audio_files.iter().enumerate() {
            let progress = ScanProgress {
                current_file: file_path.to_string_lossy().to_string(),
                processed: index,
                total: audio_files.len(),
                errors: process_errors.clone(),
            };

            let _ = self.event_tx.send(LibraryEvent::ScanProgress(progress));

            match self.process_audio_file(file_path) {
                Ok(was_new) => {
                    if was_new {
                        tracks_added += 1;
                    } else {
                        tracks_updated += 1;
                    }
                }
                Err(e) => {
                    let error_msg = format!("Error processing {}: {}", file_path.display(), e);
                    log::error!("{}", error_msg);
                    process_errors.push(error_msg);
                }
            }

            // Small delay to prevent overwhelming the system
            thread::sleep(Duration::from_millis(1));
        }

        // Combine all errors
        scan_errors.extend(process_errors);

        // Mark scanning as complete
        {
            let mut is_scanning = self.is_scanning.lock().unwrap();
            *is_scanning = false;
        }

        let _ = self.event_tx.send(LibraryEvent::ScanComplete {
            tracks_added,
            tracks_updated,
            errors: scan_errors,
        });

        log::info!(
            "Library scan complete: {} added, {} updated",
            tracks_added,
            tracks_updated
        );

        Ok(())
    }

    fn collect_audio_files(&self, path: &Path) -> Result<Vec<PathBuf>> {
        let mut files = Vec::new();

        if path.is_file() {
            if self.is_audio_file(path) {
                files.push(path.to_path_buf());
            }
        } else if path.is_dir() {
            self.scan_directory_recursive(path, &mut files)?;
        }

        Ok(files)
    }

    fn scan_directory_recursive(&self, dir: &Path, files: &mut Vec<PathBuf>) -> Result<()> {
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                // Skip hidden directories
                if let Some(name) = path.file_name() {
                    if name.to_string_lossy().starts_with('.') {
                        continue;
                    }
                }
                self.scan_directory_recursive(&path, files)?;
            } else if self.is_audio_file(&path) {
                files.push(path);
            }
        }
        Ok(())
    }

    fn is_audio_file(&self, path: &Path) -> bool {
        if let Some(extension) = path.extension() {
            let ext = extension.to_string_lossy().to_lowercase();
            // 支持的音频格式 - 与播放器保持一致
            matches!(
                ext.as_str(),
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
        } else {
            false
        }
    }

    fn process_audio_file(&self, path: &Path) -> Result<bool> {
        // Check if file already exists in database
        let path_str = path.to_string_lossy().to_string();
        let db = self.db.lock().unwrap();
        let existing_track = db.get_track_by_path(&path_str)?;

        // Read metadata
        let tagged_file = Probe::open(path)?.read()?;
        let tag = tagged_file.primary_tag();
        let properties = tagged_file.properties();

        let title = tag.and_then(|t| t.title().map(|s| s.to_string()));
        let artist = tag.and_then(|t| t.artist().map(|s| s.to_string()));
        let album = tag.and_then(|t| t.album().map(|s| s.to_string()));
        let duration_ms = properties.duration().as_millis() as i64;
        
        // 提取专辑封面
        let (album_cover_data, album_cover_mime) = self.extract_album_cover(&tagged_file, tag);

        let track = Track {
            id: existing_track.as_ref().map(|t| t.id).unwrap_or(0),
            path: path_str,
            title,
            artist,
            album,
            duration_ms: Some(duration_ms),
            album_cover_data,
            album_cover_mime,
        };

        db.insert_track(&track)?;

        Ok(existing_track.is_none()) // true if new track, false if updated
    }

    fn get_all_tracks(&self) -> Result<Vec<Track>> {
        let db = self.db.lock().unwrap();
        db.get_all_tracks()
    }

    fn search_tracks(&self, query: &str) -> Result<Vec<Track>> {
        let db = self.db.lock().unwrap();
        db.search_tracks(query)
    }

    fn get_library_stats(&self) -> Result<LibraryEvent> {
        log::info!("开始获取库统计数据");
        let db = self.db.lock().unwrap();
        let total_tracks = db.get_track_count()?;
        let total_artists = db.get_artist_count()?;
        let total_albums = db.get_album_count()?;
        
        log::info!("统计数据: {} 首歌曲, {} 位艺术家, {} 张专辑", 
                  total_tracks, total_artists, total_albums);

        Ok(LibraryEvent::LibraryStats {
            total_tracks,
            total_artists,
            total_albums,
        })
    }
    
    /// 从音频文件中提取专辑封面
    fn extract_album_cover(&self, tagged_file: &lofty::file::TaggedFile, tag: Option<&lofty::tag::Tag>) -> (Option<Vec<u8>>, Option<String>) {
        use lofty::picture::PictureType;
        
        // 收集所有标签的图片
        let mut all_pictures = Vec::new();
        
        // 优先使用主标签的图片
        if let Some(tag) = tag {
            all_pictures.extend(tag.pictures().into_iter());
        }
        
        // 如果主标签没有图片或图片不足，继续收集其他标签
        if all_pictures.is_empty() {
            all_pictures.extend(
                tagged_file.tags()
                    .into_iter()
                    .flat_map(|tag| tag.pictures())
            );
        }

        if all_pictures.is_empty() {
            log::warn!("❌ 未找到任何专辑封面");
            return (None, None);
        }

        // 按优先级排序：CoverFront > Other > Icon，同时考虑大小
        let mut sorted_pictures = all_pictures.clone();
        sorted_pictures.sort_by(|a, b| {
            // 1. 按图片类型优先级排序
            let type_priority_a = match a.pic_type() {
                PictureType::CoverFront => 0,
                PictureType::Other => 1,
                PictureType::Icon => 3,
                _ => 2,
            };
            let type_priority_b = match b.pic_type() {
                PictureType::CoverFront => 0,
                PictureType::Other => 1,
                PictureType::Icon => 3,
                _ => 2,
            };
            
            match type_priority_a.cmp(&type_priority_b) {
                std::cmp::Ordering::Equal => {
                    // 2. 类型相同时，按大小排序（大图优先，但排除过大的图）
                    let size_a = a.data().len();
                    let size_b = b.data().len();
                    
                    // 排除过大的图片（>2MB）和过小的图片（<1KB）
                    let valid_a = size_a >= 1024 && size_a <= 2_097_152;
                    let valid_b = size_b >= 1024 && size_b <= 2_097_152;
                    
                    match (valid_a, valid_b) {
                        (true, false) => std::cmp::Ordering::Less,
                        (false, true) => std::cmp::Ordering::Greater,
                        (true, true) => size_b.cmp(&size_a), // 大图优先
                        (false, false) => size_b.cmp(&size_a), // 都不合适时还是按大小
                    }
                }
                other => other,
            }
        });

        if let Some(best_picture) = sorted_pictures.first() {
            let data = best_picture.data().to_vec();
            let size = data.len();
            
            // 检查图片大小限制
            if size > 3_145_728 { // 3MB
                log::warn!("专辑封面过大 ({} 字节), 跳过", size);
                return (None, None);
            }
            
            if size < 512 { // 512 bytes
                log::warn!("专辑封面过小 ({} 字节), 跳过", size);
                return (None, None);
            }
            
            // 宽松处理MIME类型：有图就返回，MIME为空时使用默认值
            let mime_type = best_picture.mime_type()
                .map(|mime| mime.to_string())
                .or_else(|| {
                    // 根据数据头判断图片格式
                    if data.len() >= 4 {
                        if &data[0..4] == b"\xFF\xD8\xFF\xE0" || &data[0..4] == b"\xFF\xD8\xFF\xE1" {
                            Some("image/jpeg".to_string())
                        } else if &data[0..4] == b"\x89PNG" {
                            Some("image/png".to_string())
                        } else {
                            Some("image/jpeg".to_string()) // 默认JPEG
                        }
                    } else {
                        Some("image/jpeg".to_string())
                    }
                });
                
            log::info!("✅ 提取到专辑封面: {} 字节, 类型: {:?}, MIME: {:?}", 
                      size, best_picture.pic_type(), mime_type);
            return (Some(data), mime_type);
        }

        log::warn!("❌ 未找到合适的专辑封面 - 共 {} 张图片", all_pictures.len());
        (None, None)
    }

    /// 重新扫描所有现有曲目，更新封面数据
    fn rescan_all_tracks(&self) -> Result<()> {
        log::info!("开始重新扫描所有曲目以更新封面数据");
        
        // 获取所有现有曲目
        let tracks = self.get_all_tracks()?;
        
        let _ = self.event_tx.send(LibraryEvent::ScanStarted {
            total_paths: tracks.len(),
        });

        let mut updated_count = 0;
        let mut errors = Vec::new();

        for (index, track) in tracks.iter().enumerate() {
            let progress = ScanProgress {
                current_file: track.path.clone(),
                processed: index,
                total: tracks.len(),
                errors: errors.clone(),
            };
            let _ = self.event_tx.send(LibraryEvent::ScanProgress(progress));

            // 重新处理音频文件（这会更新封面数据）
            match self.process_audio_file(Path::new(&track.path)) {
                Ok(_) => {
                    updated_count += 1;
                    log::info!("更新封面数据: {}", track.path);
                }
                Err(e) => {
                    let error_msg = format!("重新扫描失败 {}: {}", track.path, e);
                    log::error!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        let _ = self.event_tx.send(LibraryEvent::ScanComplete {
            tracks_added: 0,
            tracks_updated: updated_count,
            errors,
        });

        log::info!("重新扫描完成，更新了 {} 个曲目的封面数据", updated_count);
        Ok(())
    }
}
