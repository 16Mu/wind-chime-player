// 通用元数据提取器 - 单一职责：从音频文件提取元数据
use anyhow::Result;
use lofty::prelude::*;
use lofty::probe::Probe;
use std::path::Path;

/// 音乐元数据
#[derive(Debug, Clone, Default)]
pub struct MusicMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub track_number: Option<u32>,
    pub disc_number: Option<u32>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub duration_ms: Option<u64>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u16>,
    pub bit_rate: Option<u32>,
    pub format: Option<String>,
    pub album_cover_data: Option<Vec<u8>>,
    pub album_cover_mime: Option<String>,
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

            // 提取专辑封面
            if let Some(picture) = tag.pictures().first() {
                metadata.album_cover_data = Some(picture.data().to_vec());
                // mime_type() 返回 Option<&MimeType>
                if let Some(mime) = picture.mime_type() {
                    metadata.album_cover_mime = Some(mime.as_str().to_string());
                }
            }

            // 提取嵌入的歌词
            metadata.embedded_lyrics = tag.get_string(&ItemKey::Lyrics)
                .or_else(|| tag.get_string(&ItemKey::Comment))
                .map(|s| s.to_string())
                .filter(|s| !s.trim().is_empty());
        }

        Ok(metadata)
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

            // 提取专辑封面
            if let Some(picture) = tag.pictures().first() {
                metadata.album_cover_data = Some(picture.data().to_vec());
                // mime_type() 返回 Option<&MimeType>
                if let Some(mime) = picture.mime_type() {
                    metadata.album_cover_mime = Some(mime.as_str().to_string());
                }
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

