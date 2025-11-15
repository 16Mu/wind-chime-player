use anyhow::Result;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

use crate::db::LyricLine;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedLyrics {
    pub lines: Vec<LyricLine>,
    pub metadata: HashMap<String, String>,
}

pub struct LyricsParser;

impl LyricsParser {
    pub fn new() -> Self {
        Self
    }

    /// 解析LRC格式歌词文件（支持双语歌词）
    pub fn parse_lrc(&self, content: &str) -> Result<ParsedLyrics> {
        let mut lines = Vec::new();
        let mut metadata = HashMap::new();
        
        // LRC时间戳正则表达式: [mm:ss.xx] 或 [mm:ss]
        let time_regex = Regex::new(r"\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)").unwrap();
        
        // 元数据正则表达式: [ar:Artist] [ti:Title] [al:Album] 等
        let meta_regex = Regex::new(r"\[(\w+):([^\]]*)\]").unwrap();

        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            // 尝试解析时间戳行
            if let Some(captures) = time_regex.captures(line) {
                let minutes: u64 = captures.get(1).unwrap().as_str().parse().unwrap_or(0);
                let seconds: u64 = captures.get(2).unwrap().as_str().parse().unwrap_or(0);
                let milliseconds: u64 = if let Some(ms_match) = captures.get(3) {
                    let ms_str = ms_match.as_str();
                    // 补齐到3位数（毫秒）
                    let ms_str = if ms_str.len() == 1 {
                        format!("{}00", ms_str)
                    } else if ms_str.len() == 2 {
                        format!("{}0", ms_str)
                    } else {
                        ms_str.to_string()
                    };
                    ms_str.parse().unwrap_or(0)
                } else {
                    0
                };

                let timestamp_ms = (minutes * 60 + seconds) * 1000 + milliseconds;
                let text = captures.get(4).unwrap().as_str().trim().to_string();

                lines.push(LyricLine {
                    timestamp_ms,
                    text,
                    translation: None, // 稍后会处理翻译
                });
            }
            // 尝试解析元数据
            else if let Some(captures) = meta_regex.captures(line) {
                let key = captures.get(1).unwrap().as_str().to_lowercase();
                let value = captures.get(2).unwrap().as_str().trim();
                metadata.insert(key, value.to_string());
            }
        }

        // 按时间戳排序
        lines.sort_by_key(|line| line.timestamp_ms);
        
        // 🌐 处理双语歌词（网易云/QQ音乐格式）
        // 如果两行有相同的时间戳，第二行作为翻译
        let mut merged_lines = Vec::new();
        let mut i = 0;
        while i < lines.len() {
            let mut current = lines[i].clone();
            
            // 检查下一行是否有相同时间戳
            if i + 1 < lines.len() && lines[i + 1].timestamp_ms == current.timestamp_ms {
                // 下一行作为翻译
                current.translation = Some(lines[i + 1].text.clone());
                i += 2; // 跳过下一行
            } else {
                i += 1;
            }
            
            merged_lines.push(current);
        }

        Ok(ParsedLyrics { lines: merged_lines, metadata })
    }

    /// 从音频文件同目录查找歌词文件
    pub fn find_lyrics_file(&self, audio_path: &str) -> Option<String> {
        let audio_path = Path::new(audio_path);
        let parent_dir = audio_path.parent()?;
        let stem = audio_path.file_stem()?;

        // 尝试多种歌词文件扩展名
        let extensions = ["lrc", "txt", "srt", "ass", "ssa", "vtt", "kar", "krc"];
        
        for ext in &extensions {
            let lyrics_path = parent_dir.join(format!("{}.{}", stem.to_string_lossy(), ext));
            if lyrics_path.exists() {
                return Some(lyrics_path.to_string_lossy().to_string());
            }
        }

        None
    }

    /// 读取文件并尝试多种编码
    fn read_file_with_encoding_detection(&self, file_path: &str) -> Result<String> {
        use std::fs;
        
        // 首先尝试UTF-8
        match fs::read_to_string(file_path) {
            Ok(content) => return Ok(content),
            Err(_) => {
                // UTF-8 失败，尝试读取原始字节并处理编码
                println!("UTF-8读取失败，尝试其他编码...");
            }
        }
        
        // 读取原始字节
        let bytes = fs::read(file_path)?;
        
        // 尝试常见的中文编码
        let encodings = [
            "GBK",
            "GB2312", 
            "Big5",
            "UTF-8",
            "UTF-16LE",
            "UTF-16BE",
        ];
        
        for encoding_name in &encodings {
            if let Ok(content) = self.try_decode_with_encoding(&bytes, encoding_name) {
                if !content.trim().is_empty() && self.is_valid_text(&content) {
                    println!("成功使用 {} 编码读取文件", encoding_name);
                    return Ok(content);
                }
            }
        }
        
        // 如果所有编码都失败，最后尝试lossy UTF-8解析
        match String::from_utf8_lossy(&bytes).into_owned() {
            content if !content.trim().is_empty() => {
                println!("使用lossy UTF-8解析");
                Ok(content)
            },
            _ => Err(anyhow::anyhow!("无法以任何已知编码读取文件"))
        }
    }
    
    /// 尝试用指定编码解码字节
    fn try_decode_with_encoding(&self, bytes: &[u8], encoding_name: &str) -> Result<String> {
        use encoding_rs::*;
        
        match encoding_name {
            "UTF-8" => String::from_utf8(bytes.to_vec()).map_err(|e| anyhow::anyhow!(e)),
            "UTF-16LE" => {
                if bytes.len() % 2 != 0 {
                    return Err(anyhow::anyhow!("Invalid UTF-16LE byte length"));
                }
                let utf16_chars: Vec<u16> = bytes
                    .chunks_exact(2)
                    .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
                    .collect();
                String::from_utf16(&utf16_chars).map_err(|e| anyhow::anyhow!(e))
            },
            "UTF-16BE" => {
                if bytes.len() % 2 != 0 {
                    return Err(anyhow::anyhow!("Invalid UTF-16BE byte length"));
                }
                let utf16_chars: Vec<u16> = bytes
                    .chunks_exact(2)
                    .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
                    .collect();
                String::from_utf16(&utf16_chars).map_err(|e| anyhow::anyhow!(e))
            },
            "GBK" => {
                let (decoded, _, had_errors) = GBK.decode(bytes);
                if had_errors {
                    Err(anyhow::anyhow!("GBK解码出现错误"))
                } else {
                    Ok(decoded.into_owned())
                }
            },
            "GB2312" => {
                // GB2312是GBK的子集，可以用GBK解码
                let (decoded, _, had_errors) = GBK.decode(bytes);
                if had_errors {
                    Err(anyhow::anyhow!("GB2312解码出现错误"))
                } else {
                    Ok(decoded.into_owned())
                }
            },
            "Big5" => {
                let (decoded, _, had_errors) = BIG5.decode(bytes);
                if had_errors {
                    Err(anyhow::anyhow!("Big5解码出现错误"))
                } else {
                    Ok(decoded.into_owned())
                }
            },
            _ => Err(anyhow::anyhow!("不支持的编码: {}", encoding_name))
        }
    }
    
    /// 检查文本是否看起来是有效的
    fn is_valid_text(&self, content: &str) -> bool {
        // 基本的文本有效性检查
        let non_control_chars = content.chars()
            .filter(|c| !c.is_control() || *c == '\n' || *c == '\r' || *c == '\t')
            .count();
        
        let total_chars = content.chars().count();
        
        // 如果大部分字符都是可打印的，认为是有效文本
        total_chars > 0 && (non_control_chars as f64 / total_chars as f64) > 0.8
    }

    /// 从文件读取并解析歌词，支持多种编码
    pub fn load_from_file(&self, file_path: &str) -> Result<ParsedLyrics> {
        let content = self.read_file_with_encoding_detection(file_path)?;
        let file_path_lower = file_path.to_lowercase();
        
        // 根据文件扩展名选择解析方式
        if file_path_lower.ends_with(".lrc") || file_path_lower.ends_with(".krc") {
            self.parse_lrc(&content)
        } else if file_path_lower.ends_with(".srt") {
            self.parse_srt(&content)
        } else if file_path_lower.ends_with(".ass") || file_path_lower.ends_with(".ssa") {
            self.parse_ass(&content)
        } else if file_path_lower.ends_with(".vtt") {
            self.parse_vtt(&content)
        } else if file_path_lower.ends_with(".kar") {
            self.parse_kar(&content)
        } else {
            // 对于其他文件，尝试智能识别格式
            self.auto_detect_format(&content)
        }
    }

    /// 解析纯文本歌词（无时间戳）
    pub fn parse_plain_text(&self, content: &str) -> Result<ParsedLyrics> {
        let mut lines = Vec::new();
        let metadata = HashMap::new();

        for (index, line) in content.lines().enumerate() {
            let line = line.trim();
            if !line.is_empty() {
                lines.push(LyricLine {
                    timestamp_ms: (index as u64) * 3000, // 假设每行3秒
                    text: line.to_string(),
                    translation: None,
                });
            }
        }

        Ok(ParsedLyrics { lines, metadata })
    }

    /// 解析SRT字幕格式
    pub fn parse_srt(&self, content: &str) -> Result<ParsedLyrics> {
        let mut lines = Vec::new();
        let metadata = HashMap::new();
        
        // SRT格式正则: 时:分:秒,毫秒 --> 时:分:秒,毫秒
        let time_regex = Regex::new(r"(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})").unwrap();
        
        let blocks: Vec<&str> = content.split("\n\n").collect();
        
        for block in blocks {
            let block_lines: Vec<&str> = block.lines().collect();
            if block_lines.len() >= 3 {
                // 跳过序号行，解析时间行
                if let Some(captures) = time_regex.captures(block_lines[1]) {
                    let start_h: u64 = captures.get(1).unwrap().as_str().parse().unwrap_or(0);
                    let start_m: u64 = captures.get(2).unwrap().as_str().parse().unwrap_or(0);
                    let start_s: u64 = captures.get(3).unwrap().as_str().parse().unwrap_or(0);
                    let start_ms: u64 = captures.get(4).unwrap().as_str().parse().unwrap_or(0);
                    
                    let timestamp_ms = ((start_h * 3600 + start_m * 60 + start_s) * 1000) + start_ms;
                    
                    // 合并所有文本行
                    let text = block_lines[2..].join(" ").trim().to_string();
                    
                    if !text.is_empty() {
                        lines.push(LyricLine {
                            timestamp_ms,
                            text,
                            translation: None,
                        });
                    }
                }
            }
        }
        
        lines.sort_by_key(|line| line.timestamp_ms);
        Ok(ParsedLyrics { lines, metadata })
    }

    /// 解析ASS/SSA字幕格式
    pub fn parse_ass(&self, content: &str) -> Result<ParsedLyrics> {
        let mut lines = Vec::new();
        let mut metadata = HashMap::new();
        
        let mut in_events = false;
        
        for line in content.lines() {
            let line = line.trim();
            
            if line.starts_with("[Events]") {
                in_events = true;
                continue;
            }
            
            if line.starts_with("[") && line.ends_with("]") {
                in_events = false;
                continue;
            }
            
            // 解析元数据
            if !in_events && line.contains(":") {
                let parts: Vec<&str> = line.splitn(2, ':').collect();
                if parts.len() == 2 {
                    metadata.insert(parts[0].trim().to_lowercase(), parts[1].trim().to_string());
                }
            }
            
            // 解析事件行
            if in_events && line.starts_with("Dialogue:") {
                let parts: Vec<&str> = line.splitn(10, ',').collect();
                if parts.len() >= 10 {
                    // 解析开始时间 (格式: H:MM:SS.CC)
                    if let Ok(timestamp_ms) = self.parse_ass_time(parts[1].trim()) {
                        let text = parts[9].trim();
                        
                        // 清理ASS格式标签
                        let clean_text = self.clean_ass_tags(text);
                        
                        if !clean_text.is_empty() {
                            lines.push(LyricLine {
                                timestamp_ms,
                                text: clean_text,
                                translation: None,
                            });
                        }
                    }
                }
            }
        }
        
        lines.sort_by_key(|line| line.timestamp_ms);
        Ok(ParsedLyrics { lines, metadata })
    }

    /// 解析VTT字幕格式
    pub fn parse_vtt(&self, content: &str) -> Result<ParsedLyrics> {
        let mut lines = Vec::new();
        let metadata = HashMap::new();
        
        // VTT时间格式: MM:SS.mmm 或 HH:MM:SS.mmm
        let time_regex = Regex::new(r"(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\.(\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\.(\d{3})").unwrap();
        
        let blocks: Vec<&str> = content.split("\n\n").collect();
        
        for block in blocks {
            let block_lines: Vec<&str> = block.lines().collect();
            if block_lines.len() >= 2 {
                let mut time_line_idx = 0;
                
                // 跳过可能的标识符行
                if block_lines[0] == "WEBVTT" {
                    continue;
                }
                
                // 查找时间行
                for (i, line) in block_lines.iter().enumerate() {
                    if time_regex.is_match(line) {
                        time_line_idx = i;
                        break;
                    }
                }
                
                if let Some(captures) = time_regex.captures(block_lines[time_line_idx]) {
                    let start_h = captures.get(1).map_or(0, |m| m.as_str().parse().unwrap_or(0));
                    let start_m: u64 = captures.get(2).unwrap().as_str().parse().unwrap_or(0);
                    let start_s: u64 = captures.get(3).unwrap().as_str().parse().unwrap_or(0);
                    let start_ms: u64 = captures.get(4).unwrap().as_str().parse().unwrap_or(0);
                    
                    let timestamp_ms = ((start_h * 3600 + start_m * 60 + start_s) * 1000) + start_ms;
                    
                    // 合并文本行
                    let text_lines = &block_lines[(time_line_idx + 1)..];
                    let text = text_lines.join(" ").trim().to_string();
                    
                    if !text.is_empty() {
                        lines.push(LyricLine {
                            timestamp_ms,
                            text,
                            translation: None,
                        });
                    }
                }
            }
        }
        
        lines.sort_by_key(|line| line.timestamp_ms);
        Ok(ParsedLyrics { lines, metadata })
    }

    /// 解析KAR卡拉OK格式
    pub fn parse_kar(&self, content: &str) -> Result<ParsedLyrics> {
        // KAR格式通常是MIDI文件，这里简化处理为类似LRC格式
        // 实际应用中可能需要专门的MIDI解析库
        self.parse_lrc(content)
    }

    /// 智能识别歌词格式
    pub fn auto_detect_format(&self, content: &str) -> Result<ParsedLyrics> {
        // 按优先级尝试不同格式
        
        // 检查是否为LRC格式
        if content.contains("[") && (content.contains(":") || content.contains(".")) {
            if let Ok(parsed) = self.parse_lrc(content) {
                if !parsed.lines.is_empty() {
                    return Ok(parsed);
                }
            }
        }
        
        // 检查是否为SRT格式
        if content.contains("-->") && content.contains(",") {
            if let Ok(parsed) = self.parse_srt(content) {
                if !parsed.lines.is_empty() {
                    return Ok(parsed);
                }
            }
        }
        
        // 检查是否为VTT格式
        if content.contains("WEBVTT") || (content.contains("-->") && content.contains(".")) {
            if let Ok(parsed) = self.parse_vtt(content) {
                if !parsed.lines.is_empty() {
                    return Ok(parsed);
                }
            }
        }
        
        // 检查是否为ASS格式
        if content.contains("[Events]") || content.contains("Dialogue:") {
            if let Ok(parsed) = self.parse_ass(content) {
                if !parsed.lines.is_empty() {
                    return Ok(parsed);
                }
            }
        }
        
        // 默认作为纯文本处理
        self.parse_plain_text(content)
    }

    /// 辅助函数：解析ASS时间格式
    fn parse_ass_time(&self, time_str: &str) -> Result<u64> {
        // ASS时间格式: H:MM:SS.CC
        let time_regex = Regex::new(r"(\d+):(\d{2}):(\d{2})\.(\d{2})").unwrap();
        
        if let Some(captures) = time_regex.captures(time_str) {
            let hours: u64 = captures.get(1).unwrap().as_str().parse().unwrap_or(0);
            let minutes: u64 = captures.get(2).unwrap().as_str().parse().unwrap_or(0);
            let seconds: u64 = captures.get(3).unwrap().as_str().parse().unwrap_or(0);
            let centiseconds: u64 = captures.get(4).unwrap().as_str().parse().unwrap_or(0);
            
            Ok(((hours * 3600 + minutes * 60 + seconds) * 1000) + (centiseconds * 10))
        } else {
            Err(anyhow::anyhow!("Invalid ASS time format: {}", time_str))
        }
    }

    /// 辅助函数：清理ASS格式标签
    fn clean_ass_tags(&self, text: &str) -> String {
        // 移除ASS样式标签 {\tag...}
        let tag_regex = Regex::new(r"\{[^}]*\}").unwrap();
        let clean = tag_regex.replace_all(text, "");
        
        // 移除换行标记
        clean.replace("\\N", " ").replace("\\n", " ").trim().to_string()
    }

    /// 从音频文件元数据中提取歌词
    pub fn extract_from_audio_metadata(&self, audio_path: &str) -> Result<Option<ParsedLyrics>> {
        use lofty::prelude::*;
        
        let tagged_file = lofty::read_from_path(audio_path)?;
        
        let tag = match tagged_file.primary_tag() {
            Some(primary_tag) => primary_tag,
            None => {
                if let Some(first_tag) = tagged_file.first_tag() {
                    first_tag
                } else {
                    return Ok(None);
                }
            }
        };

        // 尝试从不同的标签字段获取歌词
        let lyrics_content = [
            tag.get_string(&ItemKey::Lyrics),
            tag.get_string(&ItemKey::Comment),
        ]
        .iter()
        .find_map(|&content| content)
        .map(|s| s.to_string());

        if let Some(content) = lyrics_content {
            if !content.trim().is_empty() {
                // 尝试解析嵌入的歌词
                match self.auto_detect_format(&content) {
                    Ok(parsed) if !parsed.lines.is_empty() => return Ok(Some(parsed)),
                    _ => {
                        // 如果解析失败，作为纯文本处理
                        match self.parse_plain_text(&content) {
                            Ok(parsed) => return Ok(Some(parsed)),
                            Err(_) => {}
                        }
                    }
                }
            }
        }

        Ok(None)
    }

    /// 综合搜索歌词（文件 + 元数据）
    pub fn search_lyrics_comprehensive(&self, audio_path: &str) -> Result<Option<ParsedLyrics>> {
        // 1. 首先尝试从同目录查找歌词文件
        if let Some(lyrics_file) = self.find_lyrics_file(audio_path) {
            match self.load_from_file(&lyrics_file) {
                Ok(parsed) if !parsed.lines.is_empty() => return Ok(Some(parsed)),
                _ => {}
            }
        }

        // 2. 尝试从音频文件元数据提取
        if let Ok(Some(parsed)) = self.extract_from_audio_metadata(audio_path) {
            return Ok(Some(parsed));
        }

        Ok(None)
    }

    /// 验证歌词格式是否有效
    pub fn validate_lyrics(&self, content: &str) -> (bool, String, Vec<String>) {
        let mut errors = Vec::new();
        let mut format_detected;
        
        // 尝试检测格式
        if content.contains("[") && content.contains(":") {
            format_detected = "lrc".to_string();
            match self.parse_lrc(content) {
                Ok(parsed) => {
                    if parsed.lines.is_empty() {
                        errors.push("No valid timestamp lines found".to_string());
                    }
                    return (errors.is_empty(), format_detected, errors);
                }
                Err(e) => errors.push(format!("LRC parsing error: {}", e)),
            }
        }
        
        if content.contains("-->") {
            if content.contains(",") {
                format_detected = "srt".to_string();
                match self.parse_srt(content) {
                    Ok(parsed) => {
                        if parsed.lines.is_empty() {
                            errors.push("No valid SRT blocks found".to_string());
                        }
                        return (errors.is_empty(), format_detected, errors);
                    }
                    Err(e) => errors.push(format!("SRT parsing error: {}", e)),
                }
            } else if content.contains(".") {
                format_detected = "vtt".to_string();
                match self.parse_vtt(content) {
                    Ok(parsed) => {
                        if parsed.lines.is_empty() {
                            errors.push("No valid VTT blocks found".to_string());
                        }
                        return (errors.is_empty(), format_detected, errors);
                    }
                    Err(e) => errors.push(format!("VTT parsing error: {}", e)),
                }
            }
        }
        
        if content.contains("[Events]") || content.contains("Dialogue:") {
            format_detected = "ass".to_string();
            match self.parse_ass(content) {
                Ok(parsed) => {
                    if parsed.lines.is_empty() {
                        errors.push("No valid dialogue lines found".to_string());
                    }
                    return (errors.is_empty(), format_detected, errors);
                }
                Err(e) => errors.push(format!("ASS parsing error: {}", e)),
            }
        }
        
        // 如果都不是，作为纯文本
        format_detected = "plain_text".to_string();
        match self.parse_plain_text(content) {
            Ok(parsed) => {
                if parsed.lines.is_empty() {
                    errors.push("No text content found".to_string());
                }
            }
            Err(e) => errors.push(format!("Plain text parsing error: {}", e)),
        }
        
        (errors.is_empty(), format_detected, errors)
    }

    /// 格式化歌词为LRC格式
    pub fn format_as_lrc(&self, parsed: &ParsedLyrics) -> String {
        let mut result = String::new();

        // 添加元数据
        for (key, value) in &parsed.metadata {
            result.push_str(&format!("[{}:{}]\n", key, value));
        }

        if !parsed.metadata.is_empty() {
            result.push('\n');
        }

        // 添加歌词行
        for line in &parsed.lines {
            let minutes = line.timestamp_ms / 60000;
            let seconds = (line.timestamp_ms % 60000) / 1000;
            let milliseconds = line.timestamp_ms % 1000;
            
            result.push_str(&format!(
                "[{:02}:{:02}.{:02}]{}\n",
                minutes,
                seconds,
                milliseconds / 10, // 转换为厘秒
                line.text
            ));
        }

        result
    }

    /// 获取指定时间点应该显示的歌词行
    pub fn get_current_line(&self, lines: &[LyricLine], position_ms: u64) -> Option<usize> {
        // 找到最后一个时间戳小于等于当前位置的行
        lines
            .iter()
            .enumerate()
            .rev()
            .find(|(_, line)| line.timestamp_ms <= position_ms)
            .map(|(index, _)| index)
    }

}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_lrc() {
        let parser = LyricsParser::new();
        let content = r#"
[ar:Artist Name]
[ti:Song Title]
[al:Album Name]

[00:12.34]First line of lyrics
[00:15.67]Second line of lyrics
[01:23.45]Another line
"#;

        let result = parser.parse_lrc(content).unwrap();
        
        assert_eq!(result.metadata.get("ar"), Some(&"Artist Name".to_string()));
        assert_eq!(result.metadata.get("ti"), Some(&"Song Title".to_string()));
        assert_eq!(result.lines.len(), 3);
        assert_eq!(result.lines[0].timestamp_ms, 12340);
        assert_eq!(result.lines[0].text, "First line of lyrics");
    }

    #[test]
    fn test_get_current_line() {
        let parser = LyricsParser::new();
        let lines = vec![
            LyricLine { timestamp_ms: 1000, text: "Line 1".to_string(), translation: None },
            LyricLine { timestamp_ms: 3000, text: "Line 2".to_string(), translation: None },
            LyricLine { timestamp_ms: 5000, text: "Line 3".to_string(), translation: None },
        ];

        assert_eq!(parser.get_current_line(&lines, 500), None);
        assert_eq!(parser.get_current_line(&lines, 1500), Some(0));
        assert_eq!(parser.get_current_line(&lines, 4000), Some(1));
        assert_eq!(parser.get_current_line(&lines, 6000), Some(2));
    }
}