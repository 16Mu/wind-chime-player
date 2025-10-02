// 音频解码器封装模块
//
// 职责：
// - 封装rodio的Decoder
// - 提供统一的音频解码接口
// - 支持多种音频格式
// - 错误处理和重试机制

use rodio::Decoder;
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use super::super::types::{PlayerError, Result};

/// 支持的音频格式
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AudioFormat {
    Mp3,
    Flac,
    Wav,
    Ogg,
    M4a,
    Aac,
    Unknown,
}

impl AudioFormat {
    /// 从文件扩展名推断格式
    pub fn from_path(path: &Path) -> Self {
        match path.extension().and_then(|s| s.to_str()) {
            Some("mp3") => AudioFormat::Mp3,
            Some("flac") => AudioFormat::Flac,
            Some("wav") => AudioFormat::Wav,
            Some("ogg") | Some("oga") => AudioFormat::Ogg,
            Some("m4a") | Some("mp4") => AudioFormat::M4a,
            Some("aac") => AudioFormat::Aac,
            _ => AudioFormat::Unknown,
        }
    }
    
    /// 获取格式名称
    pub fn name(&self) -> &str {
        match self {
            AudioFormat::Mp3 => "MP3",
            AudioFormat::Flac => "FLAC",
            AudioFormat::Wav => "WAV",
            AudioFormat::Ogg => "OGG",
            AudioFormat::M4a => "M4A",
            AudioFormat::Aac => "AAC",
            AudioFormat::Unknown => "Unknown",
        }
    }
}

/// 音频解码器包装器
pub struct AudioDecoder {
    path: PathBuf,
    format: AudioFormat,
}

impl AudioDecoder {
    /// 创建音频解码器
    pub fn new(path: impl Into<PathBuf>) -> Self {
        let path = path.into();
        let format = AudioFormat::from_path(&path);
        
        log::debug!("📦 创建解码器: {:?} (格式: {})", path, format.name());
        
        Self { path, format }
    }
    
    /// 解码音频文件
    /// 
    /// # 返回
    /// - `Ok(Decoder)`: 解码成功
    /// - `Err(PlayerError)`: 解码失败
    pub fn decode(&self) -> Result<Decoder<BufReader<File>>> {
        log::debug!("🎵 开始解码: {:?}", self.path);
        
        // 打开文件
        let file = File::open(&self.path)
            .map_err(|e| PlayerError::decode_error(
                format!("无法打开文件: {:?} - {}", self.path, e)
            ))?;
        
        // 创建缓冲读取器
        let buf_reader = BufReader::new(file);
        
        // 解码
        let decoder = Decoder::new(buf_reader)
            .map_err(|e| PlayerError::decode_error(
                format!("解码失败: {:?} - {}", self.path, e)
            ))?;
        
        log::debug!("✅ 解码成功: {:?}", self.path);
        Ok(decoder)
    }
    
    /// 获取文件路径
    pub fn path(&self) -> &Path {
        &self.path
    }
    
    /// 获取音频格式
    pub fn format(&self) -> AudioFormat {
        self.format
    }
    
    /// 验证文件是否存在且可读
    pub fn validate(&self) -> Result<()> {
        if !self.path.exists() {
            return Err(PlayerError::decode_error(
                format!("文件不存在: {:?}", self.path)
            ));
        }
        
        if !self.path.is_file() {
            return Err(PlayerError::decode_error(
                format!("不是有效文件: {:?}", self.path)
            ));
        }
        
        // 尝试打开文件
        File::open(&self.path)
            .map_err(|e| PlayerError::decode_error(
                format!("无法读取文件: {:?} - {}", self.path, e)
            ))?;
        
        Ok(())
    }
}

/// 异步音频解码器
/// 
/// 在后台线程中执行解码，避免阻塞
pub struct AsyncAudioDecoder {
    decoder: AudioDecoder,
}

impl AsyncAudioDecoder {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self {
            decoder: AudioDecoder::new(path),
        }
    }
    
    /// 异步解码音频文件
    pub async fn decode(&self) -> Result<Decoder<BufReader<File>>> {
        let decoder = self.decoder.clone();
        
        tokio::task::spawn_blocking(move || {
            decoder.decode()
        })
        .await
        .map_err(|e| PlayerError::decode_error(
            format!("解码任务失败: {}", e)
        ))?
    }
    
    /// 异步验证文件
    pub async fn validate(&self) -> Result<()> {
        let decoder = self.decoder.clone();
        
        tokio::task::spawn_blocking(move || {
            decoder.validate()
        })
        .await
        .map_err(|e| PlayerError::decode_error(
            format!("验证任务失败: {}", e)
        ))?
    }
}

impl Clone for AudioDecoder {
    fn clone(&self) -> Self {
        Self {
            path: self.path.clone(),
            format: self.format,
        }
    }
}

/// 解码器工厂
/// 
/// 提供便捷的解码器创建方法
/// 解码器工厂（预留接口）
#[allow(dead_code)]
pub struct DecoderFactory;

#[allow(dead_code)]
impl DecoderFactory {
    /// 创建同步解码器
    pub fn create_sync(path: impl Into<PathBuf>) -> AudioDecoder {
        AudioDecoder::new(path)
    }
    
    /// 创建异步解码器
    pub fn create_async(path: impl Into<PathBuf>) -> AsyncAudioDecoder {
        AsyncAudioDecoder::new(path)
    }
    
    /// 批量验证文件
    pub fn validate_batch(paths: &[PathBuf]) -> Vec<(PathBuf, Result<()>)> {
        paths.iter().map(|path| {
            let decoder = AudioDecoder::new(path);
            let result = decoder.validate();
            (path.clone(), result)
        }).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_audio_format_detection() {
        assert_eq!(
            AudioFormat::from_path(Path::new("test.mp3")),
            AudioFormat::Mp3
        );
        assert_eq!(
            AudioFormat::from_path(Path::new("test.flac")),
            AudioFormat::Flac
        );
        assert_eq!(
            AudioFormat::from_path(Path::new("test.unknown")),
            AudioFormat::Unknown
        );
    }
    
    #[test]
    fn test_decoder_creation() {
        let decoder = AudioDecoder::new("test.mp3");
        assert_eq!(decoder.format(), AudioFormat::Mp3);
        assert_eq!(decoder.path(), Path::new("test.mp3"));
    }
    
    #[test]
    fn test_validation_nonexistent_file() {
        let decoder = AudioDecoder::new("nonexistent.mp3");
        assert!(decoder.validate().is_err());
    }
}
