// 曲目数据结构定义

use serde::{Deserialize, Serialize};
use std::fmt;

/// 曲目信息
#[derive(Clone, Serialize, Deserialize)]
pub struct Track {
    /// 曲目ID（数据库主键）
    pub id: i64,
    
    /// 文件路径
    pub path: String,
    
    /// 曲目标题
    pub title: Option<String>,
    
    /// 艺术家
    pub artist: Option<String>,
    
    /// 专辑名称
    pub album: Option<String>,
    
    /// 时长（毫秒）
    pub duration_ms: Option<i64>,
    
    /// 专辑封面数据（可选，用于缓存）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub album_cover_data: Option<Vec<u8>>,
    
    /// 专辑封面MIME类型
    #[serde(skip_serializing_if = "Option::is_none")]
    pub album_cover_mime: Option<String>,
    
    /// 艺术家照片数据（可选，用于缓存）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artist_photo_data: Option<Vec<u8>>,
    
    /// 艺术家照片MIME类型
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artist_photo_mime: Option<String>,
    
    /// 嵌入的歌词（来自元数据或外部.lrc文件）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embedded_lyrics: Option<String>,
}

// 🔧 修复：自定义Debug实现，避免输出大量封面二进制数据
impl fmt::Debug for Track {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Track")
            .field("id", &self.id)
            .field("title", &self.title)
            .field("artist", &self.artist)
            .field("album", &self.album)
            .field("duration_ms", &self.duration_ms)
            .field("has_cover", &self.album_cover_data.as_ref().map(|d| d.len()))
            .field("cover_mime", &self.album_cover_mime)
            .finish()
    }
}

impl Track {
    /// 创建新曲目
    #[cfg(test)]
    pub fn new(id: i64, path: String) -> Self {
        Self {
            id,
            path,
            title: None,
            artist: None,
            album: None,
            duration_ms: None,
            album_cover_data: None,
            album_cover_mime: None,
            artist_photo_data: None,
            artist_photo_mime: None,
            embedded_lyrics: None,
        }
    }
    
    /// 获取显示名称（标题或文件名）- UI显示用
    #[allow(dead_code)]
    pub fn display_name(&self) -> String {
        if let Some(title) = &self.title {
            if !title.trim().is_empty() {
                return title.clone();
            }
        }
        
        // 如果没有标题，从路径提取文件名（不含扩展名）
        std::path::Path::new(&self.path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown")
            .to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_track_display_name() {
        let track = Track::new(1, "/path/to/song.mp3".to_string());
        assert_eq!(track.display_name(), "song");
        
        let mut track_with_title = track.clone();
        track_with_title.title = Some("Beautiful Song".to_string());
        assert_eq!(track_with_title.display_name(), "Beautiful Song");
    }
}







