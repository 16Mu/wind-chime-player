// 通用元数据提取器 - 单一职责：从音频文件提取元数据
use anyhow::Result;
use lofty::prelude::*;
use lofty::probe::Probe;
use std::path::Path;
use std::fs;

/// 音乐元数据
#[derive(Debug, Clone, Default)]
pub struct MusicMetadata {
    // 基本信息
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub track_number: Option<u32>,
    #[allow(dead_code)]
    pub disc_number: Option<u32>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    
    // 创作信息
    pub composer: Option<String>,          // 作曲家
    pub conductor: Option<String>,         // 指挥
    pub lyricist: Option<String>,          // 作词人
    pub remixer: Option<String>,           // 混音师
    pub arranger: Option<String>,          // 编曲
    
    // 发行信息
    pub publisher: Option<String>,         // 发行商
    pub copyright: Option<String>,         // 版权信息
    pub isrc: Option<String>,              // 国际标准录音代码
    pub label: Option<String>,             // 唱片公司
    pub catalog_number: Option<String>,    // 目录编号
    
    // 音乐属性
    pub bpm: Option<u32>,                  // 节拍（每分钟拍数）
    pub initial_key: Option<String>,       // 调性
    pub language: Option<String>,          // 语言
    pub mood: Option<String>,              // 心情/氛围
    pub grouping: Option<String>,          // 分组/工作组
    
    // 技术信息
    pub duration_ms: Option<u64>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u16>,
    pub bit_rate: Option<u32>,
    #[allow(dead_code)]
    pub format: Option<String>,
    pub encoder: Option<String>,           // 编码器
    pub encoder_settings: Option<String>,  // 编码设置
    
    // 其他信息
    pub comment: Option<String>,           // 评论
    pub description: Option<String>,       // 描述
    pub url: Option<String>,               // 相关URL
    pub rating: Option<u32>,               // 评分 (0-100)
    
    // 图片资源
    pub album_cover_data: Option<Vec<u8>>,
    pub album_cover_mime: Option<String>,
    pub artist_photo_data: Option<Vec<u8>>,
    pub artist_photo_mime: Option<String>,
    
    // 歌词
    pub embedded_lyrics: Option<String>,   // 同步歌词（带时间戳）
    pub unsynchronised_lyrics: Option<String>, // 非同步歌词（纯文本）
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
            // 基本信息
            metadata.title = tag.title().map(|s| s.to_string());
            metadata.artist = tag.artist().map(|s| s.to_string());
            metadata.album = tag.album().map(|s| s.to_string());
            metadata.album_artist = tag.get_string(&ItemKey::AlbumArtist).map(|s| s.to_string());
            metadata.track_number = tag.track();
            metadata.year = tag.year();
            metadata.genre = tag.genre().map(|s| s.to_string());
            
            // 创作信息
            metadata.composer = tag.get_string(&ItemKey::Composer).map(|s| s.to_string());
            metadata.conductor = tag.get_string(&ItemKey::Conductor).map(|s| s.to_string());
            metadata.lyricist = tag.get_string(&ItemKey::Lyricist).map(|s| s.to_string());
            metadata.remixer = tag.get_string(&ItemKey::MixDj).map(|s| s.to_string());
            metadata.arranger = tag.get_string(&ItemKey::Arranger).map(|s| s.to_string());
            
            // 发行信息
            metadata.publisher = tag.get_string(&ItemKey::Publisher).map(|s| s.to_string());
            metadata.copyright = tag.get_string(&ItemKey::CopyrightMessage).map(|s| s.to_string());
            metadata.isrc = tag.get_string(&ItemKey::Isrc).map(|s| s.to_string());
            metadata.label = tag.get_string(&ItemKey::Label).map(|s| s.to_string());
            metadata.catalog_number = tag.get_string(&ItemKey::CatalogNumber).map(|s| s.to_string());
            
            // 音乐属性
            metadata.bpm = tag.get_string(&ItemKey::Bpm)
                .and_then(|s| s.parse::<u32>().ok());
            metadata.initial_key = tag.get_string(&ItemKey::InitialKey).map(|s| s.to_string());
            metadata.language = tag.get_string(&ItemKey::Language).map(|s| s.to_string());
            metadata.mood = tag.get_string(&ItemKey::Mood).map(|s| s.to_string());
            metadata.grouping = tag.get_string(&ItemKey::ContentGroup).map(|s| s.to_string());
            
            // 技术信息
            metadata.encoder = tag.get_string(&ItemKey::EncodedBy).map(|s| s.to_string());
            metadata.encoder_settings = tag.get_string(&ItemKey::EncoderSettings).map(|s| s.to_string());
            
            // 其他信息
            metadata.comment = tag.get_string(&ItemKey::Comment).map(|s| s.to_string());
            metadata.description = tag.get_string(&ItemKey::Description).map(|s| s.to_string());
            // URL信息
            metadata.url = tag.get_string(&ItemKey::AudioFileUrl)
                .map(|s| s.to_string());
            metadata.rating = tag.get_string(&ItemKey::Popularimeter)
                .and_then(|s| s.parse::<u32>().ok());

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

            // 提取歌词 - 区分同步和非同步歌词
            // 同步歌词（LRC格式，带时间戳）
            if let Some(lyrics) = tag.get_string(&ItemKey::Lyrics) {
                let lyrics_str = lyrics.to_string();
                if !lyrics_str.trim().is_empty() {
                    // 判断是否为同步歌词（包含时间戳 [mm:ss]）
                    if lyrics_str.contains("[") && lyrics_str.contains("]") && lyrics_str.contains(":") {
                        metadata.embedded_lyrics = Some(lyrics_str);
                        log::info!("✅ 提取到同步歌词（LRC格式）: {} 字节", lyrics.len());
                    } else {
                        metadata.unsynchronised_lyrics = Some(lyrics_str);
                        log::info!("✅ 提取到非同步歌词: {} 字节", lyrics.len());
                    }
                }
            }
            
            // 如果没有从Lyrics字段找到非同步歌词，尝试从Comment字段获取
            if metadata.unsynchronised_lyrics.is_none() && metadata.embedded_lyrics.is_none() {
                if let Some(comment) = tag.get_string(&ItemKey::Comment) {
                    let comment_str = comment.to_string();
                    if !comment_str.trim().is_empty() && comment_str.len() > 20 {
                        // 如果注释较长，可能是歌词
                        metadata.unsynchronised_lyrics = Some(comment_str);
                        log::info!("✅ 从Comment字段提取到可能的歌词");
                    }
                }
            }
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
    pub fn extract_from_bytes(&self, data: &[u8], format_hint: Option<&str>) -> Result<MusicMetadata> {
        use std::io::Cursor;
        
        // 创建一个临时的游标
        let cursor = Cursor::new(data);
        let probe = Probe::new(cursor);
        
        // 🔥 提示：从不完整的字节流提取元数据时，lofty 可能无法准确识别格式
        if let Some(ext) = format_hint {
            log::debug!("从字节流提取元数据，扩展名提示: {}", ext);
        } else {
            log::debug!("从字节流提取元数据，无扩展名提示");
        }
        
        // 尝试猜测文件类型并读取
        // 注意：当数据不完整时（如只有文件头部），guess_file_type 可能会失败
        let tagged_file = match probe.guess_file_type() {
            Ok(probe_with_type) => {
                log::debug!("成功识别文件类型");
                probe_with_type.read()?
            }
            Err(e) => {
                // 如果猜测失败，返回错误让调用者处理
                log::warn!("无法从字节流识别文件格式: {}", e);
                return Err(anyhow::anyhow!("No format could be determined from the provided file: {}", e));
            }
        };

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
            // 基本信息
            metadata.title = tag.title().map(|s| s.to_string());
            metadata.artist = tag.artist().map(|s| s.to_string());
            metadata.album = tag.album().map(|s| s.to_string());
            metadata.album_artist = tag.get_string(&ItemKey::AlbumArtist).map(|s| s.to_string());
            metadata.track_number = tag.track();
            metadata.year = tag.year();
            metadata.genre = tag.genre().map(|s| s.to_string());
            
            // 创作信息
            metadata.composer = tag.get_string(&ItemKey::Composer).map(|s| s.to_string());
            metadata.conductor = tag.get_string(&ItemKey::Conductor).map(|s| s.to_string());
            metadata.lyricist = tag.get_string(&ItemKey::Lyricist).map(|s| s.to_string());
            metadata.remixer = tag.get_string(&ItemKey::MixDj).map(|s| s.to_string());
            metadata.arranger = tag.get_string(&ItemKey::Arranger).map(|s| s.to_string());
            
            // 发行信息
            metadata.publisher = tag.get_string(&ItemKey::Publisher).map(|s| s.to_string());
            metadata.copyright = tag.get_string(&ItemKey::CopyrightMessage).map(|s| s.to_string());
            metadata.isrc = tag.get_string(&ItemKey::Isrc).map(|s| s.to_string());
            metadata.label = tag.get_string(&ItemKey::Label).map(|s| s.to_string());
            metadata.catalog_number = tag.get_string(&ItemKey::CatalogNumber).map(|s| s.to_string());
            
            // 音乐属性
            metadata.bpm = tag.get_string(&ItemKey::Bpm)
                .and_then(|s| s.parse::<u32>().ok());
            metadata.initial_key = tag.get_string(&ItemKey::InitialKey).map(|s| s.to_string());
            metadata.language = tag.get_string(&ItemKey::Language).map(|s| s.to_string());
            metadata.mood = tag.get_string(&ItemKey::Mood).map(|s| s.to_string());
            metadata.grouping = tag.get_string(&ItemKey::ContentGroup).map(|s| s.to_string());
            
            // 技术信息
            metadata.encoder = tag.get_string(&ItemKey::EncodedBy).map(|s| s.to_string());
            metadata.encoder_settings = tag.get_string(&ItemKey::EncoderSettings).map(|s| s.to_string());
            
            // 其他信息
            metadata.comment = tag.get_string(&ItemKey::Comment).map(|s| s.to_string());
            metadata.description = tag.get_string(&ItemKey::Description).map(|s| s.to_string());
            // URL信息
            metadata.url = tag.get_string(&ItemKey::AudioFileUrl)
                .map(|s| s.to_string());
            metadata.rating = tag.get_string(&ItemKey::Popularimeter)
                .and_then(|s| s.parse::<u32>().ok());

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

            // 提取歌词 - 区分同步和非同步歌词
            if let Some(lyrics) = tag.get_string(&ItemKey::Lyrics) {
                let lyrics_str = lyrics.to_string();
                if !lyrics_str.trim().is_empty() {
                    // 判断是否为同步歌词（包含时间戳 [mm:ss]）
                    if lyrics_str.contains("[") && lyrics_str.contains("]") && lyrics_str.contains(":") {
                        metadata.embedded_lyrics = Some(lyrics_str);
                        log::info!("✅ 从字节流提取到同步歌词（LRC格式）");
                    } else {
                        metadata.unsynchronised_lyrics = Some(lyrics_str);
                        log::info!("✅ 从字节流提取到非同步歌词");
                    }
                }
            }
            
            // 如果没有从Lyrics字段找到非同步歌词，尝试从Comment字段获取
            if metadata.unsynchronised_lyrics.is_none() && metadata.embedded_lyrics.is_none() {
                if let Some(comment) = tag.get_string(&ItemKey::Comment) {
                    let comment_str = comment.to_string();
                    if !comment_str.trim().is_empty() && comment_str.len() > 20 {
                        // 如果注释较长，可能是歌词
                        metadata.unsynchronised_lyrics = Some(comment_str);
                        log::info!("✅ 从字节流的Comment字段提取到可能的歌词");
                    }
                }
            }
        }

        Ok(metadata)
    }
}

