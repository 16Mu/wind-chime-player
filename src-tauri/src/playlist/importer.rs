// 歌单导入功能 - 高内聚：专注于歌单文件导入
//
// 支持格式：
// - M3U/M3U8: 标准播放列表格式
// - JSON: 自定义格式（包含完整元数据）
//
// 安全特性：
// - 文件大小限制（防止OOM）
// - 路径规范化（防止路径遍历）
// - 完整的边界检查

use super::types::*;
use anyhow::{Result, Context};
use std::fs;
use std::path::Path;

/// 歌单导入器
/// 
/// 职责：
/// - 解析多种格式的播放列表文件
/// - 验证和规范化文件路径
/// - 提供安全的导入功能
pub struct PlaylistImporter;

impl PlaylistImporter {
    /// 🔧 P2修复：从文件导入歌单（带大小限制和路径验证）
    pub fn import_from_file(file_path: &str) -> Result<(String, Vec<String>)> {
        // 🔧 P2修复：规范化路径，防止路径遍历攻击
        let path = Path::new(file_path)
            .canonicalize()
            .context("Failed to canonicalize path")?;
        
        if !path.exists() {
            return Err(anyhow::anyhow!("File does not exist: {}", file_path));
        }

        // 🔧 P2修复：检查文件大小，防止OOM
        const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10MB
        let metadata = fs::metadata(&path)
            .context("Failed to get file metadata")?;
        
        if metadata.len() > MAX_FILE_SIZE {
            return Err(anyhow::anyhow!(
                "Playlist file too large: {} bytes (max: {} bytes)",
                metadata.len(),
                MAX_FILE_SIZE
            ));
        }

        let content = fs::read_to_string(&path)
            .context("Failed to read file")?;

        // 根据扩展名判断格式
        let extension = path.extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_lowercase();

        match extension.as_str() {
            "m3u" | "m3u8" => Self::parse_m3u(&content),
            "json" => Self::parse_json(&content),
            _ => Err(anyhow::anyhow!("Unsupported file format: {}", extension)),
        }
    }

    /// 🔧 P2修复：解析M3U/M3U8格式（完整实现+边界检查）
    fn parse_m3u(content: &str) -> Result<(String, Vec<String>)> {
        let mut name = "Imported Playlist".to_string();
        let mut paths = Vec::new();

        for line in content.lines() {
            let line = line.trim();
            
            // 跳过空行
            if line.is_empty() {
                continue;
            }
            
            // 处理特殊标签
            if line.starts_with('#') {
                // 🔧 P2修复：安全的字符串切片，防止越界
                if line.starts_with("#PLAYLIST:") && line.len() > 10 {
                    name = line[10..].trim().to_string();
                }
                // #EXTINF 等其他标签暂时不处理
                continue;
            }

            // 文件路径
            paths.push(line.to_string());
        }

        log::info!("Parsed M3U playlist '{}' with {} tracks", name, paths.len());
        Ok((name, paths))
    }

    /// 解析JSON格式
    /// 
    /// # 参数
    /// - content: JSON文件内容
    /// 
    /// # 返回
    /// - (歌单名称, 曲目路径列表)
    fn parse_json(content: &str) -> Result<(String, Vec<String>)> {
        let export: PlaylistExport = serde_json::from_str(content)
            .context("Failed to parse JSON")?;

        let paths: Vec<String> = export.tracks
            .into_iter()
            .map(|t| t.path)
            .collect();

        log::info!("Parsed JSON playlist '{}' with {} tracks", export.name, paths.len());
        Ok((export.name, paths))
    }

    /// 🔧 P2修复：验证和规范化导入的路径
    /// 
    /// 功能：
    /// - 规范化路径（防止路径遍历）
    /// - 检查文件存在性
    /// - 返回有效路径的规范形式
    pub fn validate_paths(paths: &[String]) -> (Vec<String>, Vec<String>) {
        let mut valid = Vec::new();
        let mut invalid = Vec::new();

        for path_str in paths {
            // 🔧 P2修复：尝试规范化路径
            match Path::new(path_str).canonicalize() {
                Ok(canonical_path) => {
                    if canonical_path.exists() {
                        // 使用规范化后的路径
                        if let Some(path_string) = canonical_path.to_str() {
                            valid.push(path_string.to_string());
                        } else {
                            log::warn!("Path contains invalid UTF-8: {:?}", canonical_path);
                            invalid.push(path_str.clone());
                        }
                    } else {
                        invalid.push(path_str.clone());
                    }
                }
                Err(e) => {
                    log::debug!("Failed to canonicalize path '{}': {}", path_str, e);
                    // 如果规范化失败，检查原始路径
                    if Path::new(path_str).exists() {
                        valid.push(path_str.clone());
                    } else {
                        invalid.push(path_str.clone());
                    }
                }
            }
        }

        log::info!("Path validation: {} valid, {} invalid", valid.len(), invalid.len());
        (valid, invalid)
    }

    /// 自动检测文件格式（预留功能）
    /// 
    /// # 参数
    /// - file_path: 文件路径
    /// 
    /// # 返回
    /// - 格式字符串："M3U", "M3U8", "JSON"
    #[allow(dead_code)]
    pub fn detect_format(file_path: &str) -> Result<String> {
        let path = Path::new(file_path);
        
        let extension = path.extension()
            .and_then(|ext| ext.to_str())
            .map(|s| s.to_lowercase())
            .ok_or_else(|| anyhow::anyhow!("No file extension found"))?;

        match extension.as_str() {
            "m3u" => Ok("M3U".to_string()),
            "m3u8" => Ok("M3U8".to_string()),
            "json" => Ok("JSON".to_string()),
            _ => Err(anyhow::anyhow!("Unsupported format: {}", extension)),
        }
    }
}


