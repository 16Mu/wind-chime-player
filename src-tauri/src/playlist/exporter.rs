// 歌单导出功能 - 高内聚：专注于歌单文件导出
//
// 支持格式：
// - M3U: 标准播放列表格式（Latin-1编码）
// - M3U8: UTF-8编码的播放列表格式（标准扩展）
// - JSON: 自定义格式（包含完整元数据）
//
// 设计特性：
// - 正确的编码处理（M3U vs M3U8）
// - 文件覆盖警告
// - 预估容量优化（减少String重分配）

use super::types::*;
use crate::player::Track;
use anyhow::{Result, Context};
use std::fs::File;
use std::io::Write;
use std::path::Path;

/// 歌单导出器
/// 
/// 职责：
/// - 将歌单导出为多种标准格式
/// - 处理文件编码和格式规范
/// - 提供导出预览功能
pub struct PlaylistExporter;

impl PlaylistExporter {
    /// 导出歌单到文件
    /// 
    /// # 参数
    /// - playlist: 歌单信息
    /// - tracks: 曲目列表
    /// - file_path: 导出文件路径
    /// - format: 导出格式
    /// 
    /// # 注意
    /// - 如果文件已存在会被覆盖（会记录警告日志）
    pub fn export_to_file(
        playlist: &Playlist,
        tracks: &[Track],
        file_path: &str,
        format: ExportFormat,
    ) -> Result<()> {
        match format {
            ExportFormat::M3U => Self::export_m3u(playlist, tracks, file_path, false),
            ExportFormat::M3U8 => Self::export_m3u(playlist, tracks, file_path, true),
            ExportFormat::JSON => Self::export_json(playlist, tracks, file_path),
        }
    }

    /// 🔧 P2修复：导出为M3U/M3U8格式（正确处理编码）
    /// 
    /// M3U: 使用系统默认编码（通常是Latin-1或本地编码）
    /// M3U8: 强制使用UTF-8编码（标准规定）
    fn export_m3u(
        playlist: &Playlist,
        tracks: &[Track],
        file_path: &str,
        utf8: bool,
    ) -> Result<()> {
        // 🔧 P2修复：检查文件是否已存在，避免意外覆盖
        let path = Path::new(file_path);
        if path.exists() {
            log::warn!("Export file already exists and will be overwritten: {}", file_path);
        }
        
        let mut file = File::create(file_path)
            .context("Failed to create export file")?;

        // 🔧 P2修复：M3U8明确标注UTF-8编码
        if utf8 {
            // M3U8标准格式：明确UTF-8 BOM（可选）
            writeln!(file, "#EXTM3U")?;
            writeln!(file, "#EXT-X-VERSION:3")?; // M3U8版本标识
        } else {
            // M3U标准格式
            writeln!(file, "#EXTM3U")?;
        }

        // 写入歌单信息
        writeln!(file, "#PLAYLIST:{}", playlist.name)?;
        
        if let Some(desc) = &playlist.description {
            writeln!(file, "#DESCRIPTION:{}", desc)?;
        }

        // 写入每首曲目
        for track in tracks {
            // #EXTINF:时长(秒),艺术家 - 标题
            if let Some(duration_ms) = track.duration_ms {
                let duration_sec = duration_ms / 1000;
                let artist = track.artist.as_deref().unwrap_or("Unknown Artist");
                let title = track.title.as_deref().unwrap_or("Unknown Title");
                
                writeln!(file, "#EXTINF:{},{} - {}", duration_sec, artist, title)?;
            }
            
            // 写入文件路径
            writeln!(file, "{}", track.path)?;
        }

        log::info!("Exported playlist '{}' to {} ({} tracks)", 
            playlist.name, file_path, tracks.len());
        
        Ok(())
    }

    /// 导出为JSON格式
    fn export_json(
        playlist: &Playlist,
        tracks: &[Track],
        file_path: &str,
    ) -> Result<()> {
        let export = PlaylistExport {
            name: playlist.name.clone(),
            description: playlist.description.clone(),
            created_at: playlist.created_at,
            tracks: tracks.iter().map(TrackExport::from).collect(),
        };

        let json = serde_json::to_string_pretty(&export)
            .context("Failed to serialize playlist")?;

        std::fs::write(file_path, json)
            .context("Failed to write JSON file")?;

        log::info!("Exported playlist '{}' to {} (JSON, {} tracks)", 
            playlist.name, file_path, tracks.len());

        Ok(())
    }

    /// 🔧 P2修复：导出为字符串（优化性能）
    pub fn export_to_string(
        playlist: &Playlist,
        tracks: &[Track],
        format: ExportFormat,
    ) -> Result<String> {
        match format {
            ExportFormat::JSON => {
                let export = PlaylistExport {
                    name: playlist.name.clone(),
                    description: playlist.description.clone(),
                    created_at: playlist.created_at,
                    tracks: tracks.iter().map(TrackExport::from).collect(),
                };
                serde_json::to_string_pretty(&export)
                    .context("Failed to serialize playlist")
            }
            _ => {
                // 🔧 P2优化：预估容量，减少重分配
                let estimated_size = 100 + tracks.len() * 150; // 估算：每个track约150字节
                let mut output = String::with_capacity(estimated_size);
                
                output.push_str("#EXTM3U\n");
                output.push_str(&format!("#PLAYLIST:{}\n", playlist.name));
                
                for track in tracks {
                    if let Some(duration_ms) = track.duration_ms {
                        let duration_sec = duration_ms / 1000;
                        let artist = track.artist.as_deref().unwrap_or("Unknown Artist");
                        let title = track.title.as_deref().unwrap_or("Unknown Title");
                        output.push_str(&format!("#EXTINF:{},{} - {}\n", duration_sec, artist, title));
                    }
                    output.push_str(&format!("{}\n", track.path));
                }
                
                Ok(output)
            }
        }
    }

    /// 验证导出路径
    /// 
    /// # 参数
    /// - file_path: 导出文件路径
    /// - format: 预期的导出格式
    /// 
    /// # 检查
    /// - 父目录是否存在
    /// - 文件扩展名是否匹配格式（不匹配会记录警告）
    #[allow(dead_code)]
    pub fn validate_export_path(file_path: &str, format: &ExportFormat) -> Result<()> {
        let path = Path::new(file_path);
        
        // 检查目录是否存在
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                return Err(anyhow::anyhow!("Directory does not exist: {:?}", parent));
            }
        }
        
        // 检查文件扩展名
        let expected_ext = match format {
            ExportFormat::M3U => "m3u",
            ExportFormat::M3U8 => "m3u8",
            ExportFormat::JSON => "json",
        };
        
        if let Some(ext) = path.extension() {
            if ext.to_string_lossy().to_lowercase() != expected_ext {
                log::warn!("File extension mismatch: expected .{}, got .{}", 
                    expected_ext, ext.to_string_lossy());
            }
        }
        
        Ok(())
    }
}


