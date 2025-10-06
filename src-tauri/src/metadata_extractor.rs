// 通用元数据提取器 - 单一职责：从音频文件提取元数据
use anyhow::Result;
use lofty::prelude::*;
use lofty::probe::Probe;
use std::path::Path;
use std::fs;

/// 音乐元数据
#[derive(Debug, Clone, Default)]
pub struct MusicMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub track_number: Option<u32>,
    #[allow(dead_code)]
    pub disc_number: Option<u32>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub duration_ms: Option<u64>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u16>,
    pub bit_rate: Option<u32>,
    #[allow(dead_code)]
    pub format: Option<String>,
    pub album_cover_data: Option<Vec<u8>>,
    pub album_cover_mime: Option<String>,
    pub artist_photo_data: Option<Vec<u8>>,
    pub artist_photo_mime: Option<String>,
    pub embedded_lyrics: Option<String>,
}

/// 元数据提取器
pub struct MetadataExtractor;

impl MetadataExtractor {
    pub fn new() -> Self {
        Self
    }

    /// 从文件提取元数据
    pub fn extract_from_file(&self, path: &Path) -> Result<MusicMetadata> {
        let tagged_file = lofty::read_from_path(path)?;
        
        let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());
        
        let mut metadata = MusicMetadata {
            format: Some(format!("{:?}", tagged_file.file_type())),
            ..Default::default()
        };

        // 注意: properties() 直接返回 &FileProperties，不是 Option
        let properties = tagged_file.properties();
        metadata.duration_ms = Some((properties.duration().as_millis() as u64).max(1));
        metadata.sample_rate = properties.sample_rate();
        metadata.channels = properties.channels().map(|c| c as u16);
        metadata.bit_rate = properties.audio_bitrate();

        if let Some(tag) = tag {
            metadata.title = tag.title().map(|s| s.to_string());
            metadata.artist = tag.artist().map(|s| s.to_string());
            metadata.album = tag.album().map(|s| s.to_string());
            metadata.album_artist = tag.get_string(&ItemKey::AlbumArtist).map(|s| s.to_string());
            // track() 和 year() 返回的是 Option<u32>，不需要 parse
            metadata.track_number = tag.track();
            metadata.year = tag.year();
            metadata.genre = tag.genre().map(|s| s.to_string());

            // 提取专辑封面 - 优先选择前封面
            let pictures = tag.pictures();
            
            // 优先级：
            // 1. 前封面 (Front Cover)
            // 2. 其他类型的封面 (Other/Media/Artist等)
            // 3. 第一张图片
            
            let cover_picture = pictures.iter()
                .find(|p| matches!(p.pic_type(), lofty::picture::PictureType::CoverFront))
                .or_else(|| pictures.iter().find(|p| {
                    // 也接受其他可能的封面类型
                    matches!(p.pic_type(), 
                        lofty::picture::PictureType::Other |
                        lofty::picture::PictureType::Media |
                        lofty::picture::PictureType::CoverBack
                    )
                }))
                .or_else(|| pictures.first());
            
            if let Some(picture) = cover_picture {
                metadata.album_cover_data = Some(picture.data().to_vec());
                // mime_type() 返回 Option<&MimeType>
                if let Some(mime) = picture.mime_type() {
                    metadata.album_cover_mime = Some(mime.as_str().to_string());
                }
                
                log::info!("✅ 提取到内嵌专辑封面: 类型={:?}, 大小={} 字节, MIME={:?}", 
                    picture.pic_type(), 
                    picture.data().len(),
                    picture.mime_type().map(|m| m.as_str())
                );
            } else {
                log::debug!("❌ 未找到内嵌专辑封面图片");
            }
            
            // 提取艺术家照片 - 查找艺术家或表演者类型的图片
            let artist_picture = pictures.iter()
                .find(|p| matches!(p.pic_type(), 
                    lofty::picture::PictureType::Artist |
                    lofty::picture::PictureType::LeadArtist |
                    lofty::picture::PictureType::Conductor
                ));
            
            if let Some(picture) = artist_picture {
                metadata.artist_photo_data = Some(picture.data().to_vec());
                if let Some(mime) = picture.mime_type() {
                    metadata.artist_photo_mime = Some(mime.as_str().to_string());
                }
                
                log::info!("✅ 提取到内嵌艺术家照片: 类型={:?}, 大小={} 字节, MIME={:?}", 
                    picture.pic_type(), 
                    picture.data().len(),
                    picture.mime_type().map(|m| m.as_str())
                );
            } else {
                log::debug!("❌ 未找到内嵌艺术家照片");
            }

            // 提取嵌入的歌词
            metadata.embedded_lyrics = tag.get_string(&ItemKey::Lyrics)
                .or_else(|| tag.get_string(&ItemKey::Comment))
                .map(|s| s.to_string())
                .filter(|s| !s.trim().is_empty());
        }
        
        // 如果没有内嵌封面，尝试从目录中查找
        if metadata.album_cover_data.is_none() {
            if let Some((cover_data, mime_type)) = Self::find_cover_in_directory(path) {
                metadata.album_cover_data = Some(cover_data);
                metadata.album_cover_mime = Some(mime_type);
            }
        }
        
        // 如果没有内嵌艺术家照片，尝试从目录中查找
        if metadata.artist_photo_data.is_none() {
            if let Some((photo_data, mime_type)) = Self::find_artist_photo_in_directory(path) {
                metadata.artist_photo_data = Some(photo_data);
                metadata.artist_photo_mime = Some(mime_type);
            }
        }
        
        // 如果没有嵌入歌词，尝试从外部文件读取
        if metadata.embedded_lyrics.is_none() {
            metadata.embedded_lyrics = Self::find_lyrics_file(path);
        }

        Ok(metadata)
    }
    
    /// 从音频文件所在目录查找封面图片
    fn find_cover_in_directory(audio_path: &Path) -> Option<(Vec<u8>, String)> {
        let dir = audio_path.parent()?;
        
        // 常见的封面文件名（按优先级排序）
        let cover_names = [
            "cover.jpg", "cover.jpeg", "cover.png",
            "folder.jpg", "folder.jpeg", "folder.png",
            "album.jpg", "album.jpeg", "album.png",
            "front.jpg", "front.jpeg", "front.png",
            "Cover.jpg", "Cover.jpeg", "Cover.png",
            "Folder.jpg", "Folder.jpeg", "Folder.png",
            "Album.jpg", "Album.jpeg", "Album.png",
        ];
        
        for name in &cover_names {
            let cover_path = dir.join(name);
            if cover_path.exists() {
                if let Ok(data) = fs::read(&cover_path) {
                    // 检查文件大小（3MB上限，512字节下限）
                    if data.len() > 3_145_728 || data.len() < 512 {
                        continue;
                    }
                    
                    let mime_type = if name.ends_with(".png") || name.ends_with(".PNG") {
                        "image/png".to_string()
                    } else {
                        "image/jpeg".to_string()
                    };
                    
                    log::info!("✅ 从目录找到封面: {:?}, 大小={} 字节", cover_path.file_name(), data.len());
                    return Some((data, mime_type));
                }
            }
        }
        
        None
    }
    
    /// 从音频文件所在目录查找歌词文件
    fn find_lyrics_file(audio_path: &Path) -> Option<String> {
        let audio_stem = audio_path.file_stem()?.to_str()?;
        let dir = audio_path.parent()?;
        
        // 查找与音频文件同名的 .lrc 文件
        let lrc_path = dir.join(format!("{}.lrc", audio_stem));
        if lrc_path.exists() {
            if let Ok(lyrics) = fs::read_to_string(&lrc_path) {
                if !lyrics.trim().is_empty() {
                    log::info!("✅ 从外部文件读取歌词: {:?}", lrc_path.file_name());
                    return Some(lyrics);
                }
            }
        }
        
        None
    }
    
    /// 从音频文件所在目录查找艺术家照片
    fn find_artist_photo_in_directory(audio_path: &Path) -> Option<(Vec<u8>, String)> {
        let dir = audio_path.parent()?;
        
        // 常见的艺术家照片文件名（按优先级排序）
        let photo_names = [
            "artist.jpg", "artist.jpeg", "artist.png",
            "performer.jpg", "performer.jpeg", "performer.png",
            "Artist.jpg", "Artist.jpeg", "Artist.png",
            "Performer.jpg", "Performer.jpeg", "Performer.png",
        ];
        
        for name in &photo_names {
            let photo_path = dir.join(name);
            if photo_path.exists() {
                if let Ok(data) = fs::read(&photo_path) {
                    // 检查文件大小（3MB上限，512字节下限）
                    if data.len() > 3_145_728 || data.len() < 512 {
                        continue;
                    }
                    
                    let mime_type = if name.ends_with(".png") || name.ends_with(".PNG") {
                        "image/png".to_string()
                    } else {
                        "image/jpeg".to_string()
                    };
                    
                    log::info!("✅ 从目录找到艺术家照片: {:?}, 大小={} 字节", photo_path.file_name(), data.len());
                    return Some((data, mime_type));
                }
            }
        }
        
        None
    }

    /// 从字节流提取元数据
    pub fn extract_from_bytes(&self, data: &[u8], _format_hint: Option<&str>) -> Result<MusicMetadata> {
        use std::io::Cursor;
        
        // 创建一个临时的游标
        let cursor = Cursor::new(data);
        
        // lofty 0.21+ 的 API: Probe 用于从流中读取
        // 注意：lofty 0.21 简化了 API，直接使用 Probe::new().read() 即可
        let tagged_file = Probe::new(cursor).read()?;

        let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());
        
        let mut metadata = MusicMetadata {
            format: Some(format!("{:?}", tagged_file.file_type())),
            ..Default::default()
        };

        // properties() 直接返回 &FileProperties
        let properties = tagged_file.properties();
        metadata.duration_ms = Some((properties.duration().as_millis() as u64).max(1));
        metadata.sample_rate = properties.sample_rate();
        metadata.channels = properties.channels().map(|c| c as u16);
        metadata.bit_rate = properties.audio_bitrate();

        if let Some(tag) = tag {
            metadata.title = tag.title().map(|s| s.to_string());
            metadata.artist = tag.artist().map(|s| s.to_string());
            metadata.album = tag.album().map(|s| s.to_string());
            metadata.album_artist = tag.get_string(&ItemKey::AlbumArtist).map(|s| s.to_string());
            // track() 和 year() 返回 Option<u32>
            metadata.track_number = tag.track();
            metadata.year = tag.year();
            metadata.genre = tag.genre().map(|s| s.to_string());

            // 提取专辑封面 - 优先选择前封面
            let pictures = tag.pictures();
            
            // 优先级：
            // 1. 前封面 (Front Cover)
            // 2. 其他类型的封面 (Other/Media/Artist等)
            // 3. 第一张图片
            
            let cover_picture = pictures.iter()
                .find(|p| matches!(p.pic_type(), lofty::picture::PictureType::CoverFront))
                .or_else(|| pictures.iter().find(|p| {
                    // 也接受其他可能的封面类型
                    matches!(p.pic_type(), 
                        lofty::picture::PictureType::Other |
                        lofty::picture::PictureType::Media |
                        lofty::picture::PictureType::CoverBack
                    )
                }))
                .or_else(|| pictures.first());
            
            if let Some(picture) = cover_picture {
                metadata.album_cover_data = Some(picture.data().to_vec());
                // mime_type() 返回 Option<&MimeType>
                if let Some(mime) = picture.mime_type() {
                    metadata.album_cover_mime = Some(mime.as_str().to_string());
                }
                
                log::info!("✅ 提取到专辑封面: 类型={:?}, 大小={} 字节, MIME={:?}", 
                    picture.pic_type(), 
                    picture.data().len(),
                    picture.mime_type().map(|m| m.as_str())
                );
            } else {
                log::debug!("❌ 未找到专辑封面图片");
            }

            // 提取嵌入的歌词
            metadata.embedded_lyrics = tag.get_string(&ItemKey::Lyrics)
                .or_else(|| tag.get_string(&ItemKey::Comment))
                .map(|s| s.to_string())
                .filter(|s| !s.trim().is_empty());
        }

        Ok(metadata)
    }
}

