// WebDAV XML解析器 - 单一职责：解析PROPFIND响应
use super::types::*;
use quick_xml::events::Event;
use quick_xml::Reader;

/// 服务器类型提示
#[derive(Debug, Clone, PartialEq)]
pub enum ServerHints {
    Apache,
    Nginx,
    Nextcloud,
    OwnCloud,
    Synology,
    Generic,
}

/// PROPFIND响应解析器
pub struct PropfindParser {
    #[allow(dead_code)]
    server_hints: ServerHints,
}

impl PropfindParser {
    pub fn new(server_hints: ServerHints) -> Self {
        Self { server_hints }
    }

    /// 解析PROPFIND多状态响应
    pub fn parse_multistatus(&self, xml: &str) -> WebDAVResult<Vec<WebDAVFileInfo>> {
        // 🔧 P1修复：限制XML输入大小，防止OOM
        const MAX_XML_SIZE: usize = 10 * 1024 * 1024; // 10MB
        if xml.len() > MAX_XML_SIZE {
            return Err(WebDAVError::ServerError(
                format!("XML响应过大: {} bytes (最大 {} bytes)", xml.len(), MAX_XML_SIZE)
            ));
        }
        
        let mut reader = Reader::from_str(xml);
        reader.trim_text(true);
        
        let mut files = Vec::new();
        let mut buf = Vec::new();
        let mut current_response: Option<ResponseBuilder> = None;
        let mut current_prop: Option<String> = None;
        let mut text_buffer = String::new();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => {
                    let tag_name = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                    
                    match tag_name.as_str() {
                        "response" | "D:response" => {
                            current_response = Some(ResponseBuilder::new());
                        }
                        "href" | "D:href" => {
                            text_buffer.clear();
                        }
                        "getcontentlength" | "D:getcontentlength" => {
                            current_prop = Some("size".to_string());
                            text_buffer.clear();
                        }
                        "getcontenttype" | "D:getcontenttype" => {
                            current_prop = Some("content_type".to_string());
                            text_buffer.clear();
                        }
                        "getlastmodified" | "D:getlastmodified" => {
                            current_prop = Some("last_modified".to_string());
                            text_buffer.clear();
                        }
                        "getetag" | "D:getetag" => {
                            current_prop = Some("etag".to_string());
                            text_buffer.clear();
                        }
                        "creationdate" | "D:creationdate" => {
                            current_prop = Some("created_at".to_string());
                            text_buffer.clear();
                        }
                        "displayname" | "D:displayname" => {
                            current_prop = Some("name".to_string());
                            text_buffer.clear();
                        }
                        "collection" | "D:collection" => {
                            if let Some(ref mut resp) = current_response {
                                resp.is_directory = true;
                            }
                        }
                        _ => {}
                    }
                }
                
                Ok(Event::Text(e)) => {
                    text_buffer.push_str(&e.unescape().unwrap_or_default());
                }
                
                Ok(Event::End(e)) => {
                    let tag_name = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                    
                    match tag_name.as_str() {
                        "href" | "D:href" => {
                            if let Some(ref mut resp) = current_response {
                                // 🔧 修复中文文件名问题：对URL编码的路径进行解码
                                let href = text_buffer.trim();
                                resp.path = percent_decode_path(href);
                            }
                        }
                        "getcontentlength" | "D:getcontentlength" |
                        "getcontenttype" | "D:getcontenttype" |
                        "getlastmodified" | "D:getlastmodified" |
                        "getetag" | "D:getetag" |
                        "creationdate" | "D:creationdate" |
                        "displayname" | "D:displayname" => {
                            if let (Some(ref mut resp), Some(ref prop)) = (&mut current_response, &current_prop) {
                                resp.set_property(prop, text_buffer.trim());
                            }
                            current_prop = None;
                        }
                        "response" | "D:response" => {
                            if let Some(builder) = current_response.take() {
                                if let Ok(file_info) = builder.build() {
                                    files.push(file_info);
                                }
                            }
                        }
                        _ => {}
                    }
                }
                
                Ok(Event::Eof) => break,
                Err(e) => {
                    log::error!("XML解析严重错误: {:?}", e);
                    // 返回一个简单的错误，不尝试构造 serde_xml_rs::Error
                    return Err(WebDAVError::ServerError(format!("XML读取失败: {}", e)));
                }
                _ => {}
            }
            buf.clear();
        }

        log::debug!("解析到 {} 个文件/目录", files.len());
        Ok(files)
    }

    /// 自动检测服务器类型
    pub fn detect_server_type(xml: &str) -> ServerHints {
        if xml.contains("Nextcloud") || xml.contains("nextcloud") {
            ServerHints::Nextcloud
        } else if xml.contains("ownCloud") {
            ServerHints::OwnCloud
        } else if xml.contains("Apache") {
            ServerHints::Apache
        } else if xml.contains("nginx") {
            ServerHints::Nginx
        } else if xml.contains("Synology") {
            ServerHints::Synology
        } else {
            ServerHints::Generic
        }
    }
}

/// 响应构建器（辅助类）
#[derive(Debug, Default)]
struct ResponseBuilder {
    path: String,
    name: Option<String>,
    is_directory: bool,
    size: Option<u64>,
    content_type: Option<String>,
    last_modified: Option<i64>,
    etag: Option<String>,
    created_at: Option<i64>,
}

impl ResponseBuilder {
    fn new() -> Self {
        Self::default()
    }

    fn set_property(&mut self, key: &str, value: &str) {
        match key {
            "name" => self.name = Some(value.to_string()),
            "size" => self.size = value.parse().ok(),
            "content_type" => self.content_type = Some(value.to_string()),
            "last_modified" => {
                // 解析HTTP日期格式
                self.last_modified = parse_http_date(value);
            }
            "etag" => self.etag = Some(value.trim_matches('"').to_string()),
            "created_at" => {
                self.created_at = parse_http_date(value);
            }
            _ => {}
        }
    }

    fn build(self) -> WebDAVResult<WebDAVFileInfo> {
        let path = self.path.clone();
        let name = self.name.unwrap_or_else(|| {
            path.trim_end_matches('/').split('/').last().unwrap_or(&path).to_string()
        });

        // 检测文件夹：除了 collection 标签，还通过 content_type 判断
        let is_directory = self.is_directory 
            || self.content_type.as_ref().map_or(false, |ct| {
                ct.contains("directory") || ct.contains("folder")
            })
            || path.ends_with('/');

        Ok(WebDAVFileInfo {
            path,
            name,
            is_directory,
            size: self.size,
            content_type: self.content_type,
            last_modified: self.last_modified,
            etag: self.etag,
            created_at: self.created_at,
        })
    }
}

/// 解析HTTP日期格式
fn parse_http_date(date_str: &str) -> Option<i64> {
    use chrono::DateTime;
    DateTime::parse_from_rfc2822(date_str)
        .or_else(|_| DateTime::parse_from_rfc3339(date_str))
        .ok()
        .map(|dt| dt.timestamp())
}

/// URL解码路径（处理中文文件名等非ASCII字符）
fn percent_decode_path(encoded: &str) -> String {
    use percent_encoding::percent_decode_str;
    
    match percent_decode_str(encoded).decode_utf8() {
        Ok(decoded) => decoded.to_string(),
        Err(e) => {
            log::warn!("URL解码失败: {} - 错误: {}, 使用原始路径", encoded, e);
            encoded.to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_apache_response() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/music/song.mp3</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>song.mp3</D:displayname>
        <D:getcontentlength>5242880</D:getcontentlength>
        <D:getcontenttype>audio/mpeg</D:getcontenttype>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>"#;

        let parser = PropfindParser::new(ServerHints::Apache);
        let files = parser.parse_multistatus(xml).unwrap();
        
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].name, "song.mp3");
        assert_eq!(files[0].size, Some(5242880));
    }
}

















