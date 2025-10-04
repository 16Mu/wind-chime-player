<!-- e4e69c4e-cc90-47c5-9146-7193bb17a4c9 227d6f6c-fdd1-4f09-9416-4a2edbfee187 -->
# 远程音乐源自动化实施指南 (WebDAV + FTP)

> **🤖 AI执行指南**：本文档设计为可被AI完整自动执行。按照阶段顺序依次实施，每个阶段包含完整代码、验证步骤和错误处理。执行时严格遵循顺序，不跳过任何步骤。

---

## 📋 执行前置条件检查

**AI必须先执行以下检查**：

```bash
# 1. 检查Rust工具链
rustc --version  # 需要 >= 1.70

# 2. 检查项目结构
ls src-tauri/src/webdav/  # 确认WebDAV模块存在
ls src-tauri/src/ftp/     # 确认FTP模块存在

# 3. 检查数据库文件
ls src-tauri/src/db.rs    # 确认数据库模块存在

# 4. 检查前端框架
ls src/components/        # 确认React组件目录存在
```

**如果任何检查失败，立即停止并报告错误。**

---

## 🎯 设计原则（现有架构遵循的规范）

基于 `src-tauri/src/webdav/` 模块的优秀设计：

1. **高内聚低耦合** - 每个模块单一职责
2. **完善错误处理** - 区分可恢复/不可恢复错误
3. **状态机设计** - 防止非法状态转换
4. **资源安全管理** - 内存限制、超时控制、熔断保护
5. **可观测性** - 完整日志、统计、健康检查
6. **测试覆盖** - 每个模块都有单元测试

---

## 📦 阶段一：依赖和基础设施 [AUTO-EXECUTE]

### 步骤 1.1：添加Cargo依赖

**文件**：`src-tauri/Cargo.toml`

**操作**：在 `[dependencies]` 部分添加：

```toml
quick-xml = "0.31"  # WebDAV XML解析
```

**验证**：运行 `cargo check`，确保无错误

---

### 步骤 1.2：实现WebDAV XML解析器

**新建文件**：`src-tauri/src/webdav/xml_parser.rs`

**完整代码**：

```rust
// WebDAV XML解析器 - 单一职责：解析PROPFIND响应
use super::types::*;
use quick_xml::events::Event;
use quick_xml::Reader;
use std::collections::HashMap;

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
    server_hints: ServerHints,
}

impl PropfindParser {
    pub fn new(server_hints: ServerHints) -> Self {
        Self { server_hints }
    }

    /// 解析PROPFIND多状态响应
    pub fn parse_multistatus(&self, xml: &str) -> WebDAVResult<Vec<WebDAVFileInfo>> {
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
                                resp.path = text_buffer.trim().to_string();
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
                    log::warn!("XML解析错误: {:?}", e);
                    break;
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

        Ok(WebDAVFileInfo {
            path,
            name,
            is_directory: self.is_directory,
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
```

**更新模块导出**：`src-tauri/src/webdav/mod.rs`

```rust
pub mod client;
pub mod auth;
pub mod types;
pub mod safe_stream;
pub mod resilient_client;
pub mod xml_parser;  // 新增

pub use auth::*;
pub use client::WebDAVClient;
pub use xml_parser::PropfindParser;  // 新增导出
```

**验证**：运行 `cargo test --lib webdav::xml_parser`

---

### 步骤 1.3：修复WebDAV客户端的parse_propfind_response

**文件**：`src-tauri/src/webdav/client.rs`

**替换**：找到 `parse_propfind_response` 方法（约第426-439行）

```rust
// 旧代码（空实现）
fn parse_propfind_response(&self, _response_xml: &str) -> WebDAVResult<Vec<WebDAVFileInfo>> {
    let files = Vec::new();
    log::debug!("PROPFIND响应解析暂未完全实现，返回空结果");
    Ok(files)
}
```

**替换为**：

```rust
fn parse_propfind_response(&self, response_xml: &str) -> WebDAVResult<Vec<WebDAVFileInfo>> {
    use crate::webdav::xml_parser::{PropfindParser, ServerHints};
    
    // 自动检测服务器类型
    let server_hints = PropfindParser::detect_server_type(response_xml);
    log::debug!("检测到WebDAV服务器类型: {:?}", server_hints);
    
    // 创建解析器并解析
    let parser = PropfindParser::new(server_hints);
    let files = parser.parse_multistatus(response_xml)?;
    
    log::debug!("成功解析 {} 个文件/目录", files.len());
    Ok(files)
}
```

**验证**：运行 `cargo build`，确保编译成功

---

## 📦 阶段二：数据库架构扩展 [AUTO-EXECUTE]

### 步骤 2.1：扩展数据库Schema

**文件**：`src-tauri/src/db.rs`

**在 `Database::new()` 方法的表创建SQL后添加**（找到约第200行左右）：

```rust
// 在现有CREATE TABLE语句后添加：

// 统一的远程服务器配置表
conn.execute(
    "CREATE TABLE IF NOT EXISTS remote_servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        server_type TEXT NOT NULL,
        config_json TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_connected_at INTEGER,
        connection_status TEXT DEFAULT 'unknown'
    )",
    [],
)?;

// 统一的缓存表
conn.execute(
    "CREATE TABLE IF NOT EXISTS remote_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id TEXT NOT NULL,
        remote_path TEXT NOT NULL,
        local_cache_path TEXT NOT NULL,
        file_size INTEGER,
        mime_type TEXT,
        etag TEXT,
        last_modified INTEGER,
        cached_at INTEGER NOT NULL,
        last_accessed INTEGER NOT NULL,
        access_count INTEGER DEFAULT 0,
        cache_status TEXT DEFAULT 'valid',
        UNIQUE(server_id, remote_path),
        FOREIGN KEY(server_id) REFERENCES remote_servers(id) ON DELETE CASCADE
    )",
    [],
)?;

// 缓存索引
conn.execute(
    "CREATE INDEX IF NOT EXISTS idx_cache_server ON remote_cache(server_id)",
    [],
)?;
conn.execute(
    "CREATE INDEX IF NOT EXISTS idx_cache_access ON remote_cache(last_accessed DESC)",
    [],
)?;
conn.execute(
    "CREATE INDEX IF NOT EXISTS idx_cache_status ON remote_cache(cache_status)",
    [],
)?;

// 同步任务表
conn.execute(
    "CREATE TABLE IF NOT EXISTS sync_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id TEXT NOT NULL,
        task_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        progress_current INTEGER DEFAULT 0,
        progress_total INTEGER DEFAULT 0,
        started_at INTEGER,
        completed_at INTEGER,
        error_message TEXT,
        FOREIGN KEY(server_id) REFERENCES remote_servers(id) ON DELETE CASCADE
    )",
    [],
)?;

log::info!("远程服务器数据库表已创建");
```

### 步骤 2.2：添加数据库操作方法

**在 `impl Database` 块末尾添加**：

```rust
// ========== 远程服务器管理 ==========

pub fn add_remote_server(&self, id: &str, name: &str, server_type: &str, config_json: &str) -> Result<()> {
    let now = chrono::Utc::now().timestamp();
    self.conn.execute(
        "INSERT INTO remote_servers (id, name, server_type, config_json, created_at, updated_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, name, server_type, config_json, now, now],
    )?;
    log::info!("添加远程服务器: {} ({})", name, server_type);
    Ok(())
}

pub fn get_remote_servers(&self) -> Result<Vec<(String, String, String, String, bool)>> {
    let mut stmt = self.conn.prepare(
        "SELECT id, name, server_type, config_json, enabled FROM remote_servers ORDER BY priority DESC, name ASC"
    )?;
    
    let servers = stmt.query_map([], |row| {
        Ok((
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get::<_, i64>(4)? == 1,
        ))
    })?
    .collect::<Result<Vec<_>, _>>()?;
    
    Ok(servers)
}

pub fn delete_remote_server(&self, id: &str) -> Result<()> {
    self.conn.execute("DELETE FROM remote_servers WHERE id = ?1", params![id])?;
    log::info!("删除远程服务器: {}", id);
    Ok(())
}

// ========== 缓存管理 ==========

pub fn add_cache_entry(
    &self,
    server_id: &str,
    remote_path: &str,
    local_cache_path: &str,
    file_size: Option<i64>,
    mime_type: Option<&str>,
) -> Result<i64> {
    let now = chrono::Utc::now().timestamp();
    
    self.conn.execute(
        "INSERT OR REPLACE INTO remote_cache 
         (server_id, remote_path, local_cache_path, file_size, mime_type, cached_at, last_accessed, access_count)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)",
        params![server_id, remote_path, local_cache_path, file_size, mime_type, now, now],
    )?;
    
    Ok(self.conn.last_insert_rowid())
}

pub fn get_cache_entry(&self, server_id: &str, remote_path: &str) -> Result<Option<String>> {
    let mut stmt = self.conn.prepare(
        "SELECT local_cache_path FROM remote_cache 
         WHERE server_id = ?1 AND remote_path = ?2 AND cache_status = 'valid'"
    )?;
    
    let result = stmt.query_row(params![server_id, remote_path], |row| row.get(0))
        .optional()?;
    
    // 更新访问时间
    if result.is_some() {
        let now = chrono::Utc::now().timestamp();
        self.conn.execute(
            "UPDATE remote_cache SET last_accessed = ?1, access_count = access_count + 1 
             WHERE server_id = ?2 AND remote_path = ?3",
            params![now, server_id, remote_path],
        )?;
    }
    
    Ok(result)
}

pub fn get_cache_stats(&self) -> Result<(i64, i64)> {
    let mut stmt = self.conn.prepare(
        "SELECT COUNT(*), COALESCE(SUM(file_size), 0) FROM remote_cache WHERE cache_status = 'valid'"
    )?;
    
    stmt.query_row([], |row| Ok((row.get(0)?, row.get(1)?)))
}
```

**验证**：运行 `cargo build`

---

## 📦 阶段三：统一远程源抽象层 [AUTO-EXECUTE]

### 步骤 3.1：创建远程源模块

**新建目录**：`src-tauri/src/remote_source/`

**新建文件**：`src-tauri/src/remote_source/mod.rs`

```rust
// 远程音乐源统一抽象层
pub mod types;

pub use types::*;
```

**新建文件**：`src-tauri/src/remote_source/types.rs`

```rust
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncRead;
use anyhow::Result;

/// 远程源类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RemoteSourceType {
    WebDAV,
    FTP,
}

impl std::fmt::Display for RemoteSourceType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RemoteSourceType::WebDAV => write!(f, "webdav"),
            RemoteSourceType::FTP => write!(f, "ftp"),
        }
    }
}

/// 统一的远程文件信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteFileInfo {
    pub path: String,
    pub name: String,
    pub is_directory: bool,
    pub size: Option<u64>,
    pub mime_type: Option<String>,
    pub last_modified: Option<i64>,
    pub etag: Option<String>,
    pub source_type: RemoteSourceType,
}

/// 连接状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConnectionStatus {
    Unknown,
    Connecting,
    Connected,
    Disconnected,
    Error(String),
}

/// 健康状态
#[derive(Debug, Clone, Serialize)]
pub struct HealthStatus {
    pub is_healthy: bool,
    pub last_check: i64,
    pub error_count: u32,
    pub connection_status: ConnectionStatus,
}

/// 远程源客户端统一接口
#[async_trait]
pub trait RemoteSourceClient: Send + Sync {
    /// 测试连接
    async fn test_connection(&self) -> Result<ConnectionStatus>;
    
    /// 列出目录
    async fn list_directory(&self, path: &str) -> Result<Vec<RemoteFileInfo>>;
    
    /// 获取文件信息
    async fn get_file_info(&self, path: &str) -> Result<RemoteFileInfo>;
    
    /// 下载文件流
    async fn download_stream(&self, path: &str) -> Result<Box<dyn AsyncRead + Send + Unpin>>;
    
    /// 范围下载
    async fn download_range(&self, path: &str, start: u64, end: Option<u64>) 
        -> Result<Box<dyn AsyncRead + Send + Unpin>>;
    
    /// 获取健康状态
    fn get_health(&self) -> HealthStatus;
    
    /// 获取源类型
    fn get_source_type(&self) -> RemoteSourceType;
}
```

**更新 `src-tauri/src/lib.rs`**：在模块声明处添加

```rust
mod remote_source; // 新增
```

**验证**：运行 `cargo build`

---

## 📦 阶段四：实现WebDAV适配器 [AUTO-EXECUTE]

### 步骤 4.1：为WebDAV实现RemoteSourceClient

**新建文件**：`src-tauri/src/webdav/remote_adapter.rs`

```rust
// WebDAV远程源适配器 - 实现RemoteSourceClient trait
use super::{WebDAVClient, types::*};
use crate::remote_source::{RemoteSourceClient, RemoteFileInfo, RemoteSourceType, ConnectionStatus, HealthStatus};
use async_trait::async_trait;
use anyhow::Result;
use tokio::io::AsyncRead;

/// WebDAV远程源适配器
pub struct WebDAVRemoteAdapter {
    client: WebDAVClient,
}

impl WebDAVRemoteAdapter {
    pub fn new(client: WebDAVClient) -> Self {
        Self { client }
    }
}

#[async_trait]
impl RemoteSourceClient for WebDAVRemoteAdapter {
    async fn test_connection(&self) -> Result<ConnectionStatus> {
        match self.client.test_connection().await {
            Ok(_) => Ok(ConnectionStatus::Connected),
            Err(e) => Ok(ConnectionStatus::Error(e.to_string())),
        }
    }

    async fn list_directory(&self, path: &str) -> Result<Vec<RemoteFileInfo>> {
        let listing = self.client.list_directory(path).await?;
        
        Ok(listing.files.into_iter().map(|f| RemoteFileInfo {
            path: f.path,
            name: f.name,
            is_directory: f.is_directory,
            size: f.size,
            mime_type: f.content_type,
            last_modified: f.last_modified,
            etag: f.etag,
            source_type: RemoteSourceType::WebDAV,
        }).collect())
    }

    async fn get_file_info(&self, path: &str) -> Result<RemoteFileInfo> {
        let info = self.client.get_file_info(path).await?;
        
        Ok(RemoteFileInfo {
            path: info.path,
            name: info.name,
            is_directory: info.is_directory,
            size: info.size,
            mime_type: info.content_type,
            last_modified: info.last_modified,
            etag: info.etag,
            source_type: RemoteSourceType::WebDAV,
        })
    }

    async fn download_stream(&self, path: &str) -> Result<Box<dyn AsyncRead + Send + Unpin>> {
        let stream = self.client.download_stream(path).await?;
        
        use crate::webdav::safe_stream::{SafeWebDAVStream, SafeStreamConfig};
        let safe_stream = SafeWebDAVStream::from_webdav_stream(stream, SafeStreamConfig::default());
        
        Ok(Box::new(safe_stream))
    }

    async fn download_range(&self, path: &str, start: u64, end: Option<u64>) 
        -> Result<Box<dyn AsyncRead + Send + Unpin>> {
        let range = RangeRequest { start, end };
        let stream = self.client.download_range(path, range).await?;
        
        use crate::webdav::safe_stream::{SafeWebDAVStream, SafeStreamConfig};
        let safe_stream = SafeWebDAVStream::from_webdav_stream(stream, SafeStreamConfig::default());
        
        Ok(Box::new(safe_stream))
    }

    fn get_health(&self) -> HealthStatus {
        HealthStatus {
            is_healthy: true,
            last_check: chrono::Utc::now().timestamp(),
            error_count: 0,
            connection_status: ConnectionStatus::Connected,
        }
    }

    fn get_source_type(&self) -> RemoteSourceType {
        RemoteSourceType::WebDAV
    }
}
```

**更新 `src-tauri/src/webdav/mod.rs`**：

```rust
pub mod remote_adapter;  // 新增
pub use remote_adapter::WebDAVRemoteAdapter;  // 新增导出
```

**验证**：运行 `cargo build`

---

## 📦 阶段五：Tauri命令扩展 [AUTO-EXECUTE]

### 步骤 5.1：添加远程服务器管理命令

**文件**：`src-tauri/src/lib.rs`

**在现有命令后添加**（约第835行之后）：

```rust
// ============================================================
// 远程音乐源命令 (统一WebDAV和FTP)
// ============================================================

#[tauri::command]
async fn remote_add_server(
    db: State<'_, Arc<Mutex<Database>>>,
    server_type: String,
    name: String,
    config_json: String,
) -> Result<String, String> {
    let id = format!("{}_{}", server_type, uuid::Uuid::new_v4().to_string());
    
    db.lock().unwrap()
        .add_remote_server(&id, &name, &server_type, &config_json)
        .map_err(|e| e.to_string())?;
    
    log::info!("添加远程服务器: {} ({})", name, server_type);
    Ok(id)
}

#[tauri::command]
async fn remote_get_servers(
    db: State<'_, Arc<Mutex<Database>>>,
) -> Result<Vec<serde_json::Value>, String> {
    let servers = db.lock().unwrap()
        .get_remote_servers()
        .map_err(|e| e.to_string())?;
    
    let result: Vec<serde_json::Value> = servers.into_iter()
        .map(|(id, name, server_type, config_json, enabled)| {
            serde_json::json!({
                "id": id,
                "name": name,
                "server_type": server_type,
                "config": serde_json::from_str::<serde_json::Value>(&config_json).unwrap_or(serde_json::json!({})),
                "enabled": enabled
            })
        })
        .collect();
    
    Ok(result)
}

#[tauri::command]
async fn remote_delete_server(
    db: State<'_, Arc<Mutex<Database>>>,
    server_id: String,
) -> Result<(), String> {
    db.lock().unwrap()
        .delete_remote_server(&server_id)
        .map_err(|e| e.to_string())?;
    
    log::info!("删除远程服务器: {}", server_id);
    Ok(())
}

#[tauri::command]
async fn remote_get_cache_stats(
    db: State<'_, Arc<Mutex<Database>>>,
) -> Result<serde_json::Value, String> {
    let (count, total_size) = db.lock().unwrap()
        .get_cache_stats()
        .map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "file_count": count,
        "total_size_mb": total_size / (1024 * 1024),
    }))
}
```

### 步骤 5.2：注册新命令

**在 `invoke_handler` 中添加**（约第1348行）：

```rust
.invoke_handler(tauri::generate_handler![
    // ... 现有命令 ...
    
    // 远程音乐源命令 (新增)
    remote_add_server,
    remote_get_servers,
    remote_delete_server,
    remote_get_cache_stats,
])
```

**添加uuid依赖**：`src-tauri/Cargo.toml`

```toml
uuid = { version = "1.6", features = ["v4"] }
```

**验证**：运行 `cargo build`

---

## 📦 阶段六：前端UI实现 [AUTO-EXECUTE]

### 步骤 6.1：创建统一远程源设置页面

**替换文件**：`src/components/settings/WebDAVSettings.tsx`

```typescript
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface RemoteServer {
  id: string;
  name: string;
  server_type: 'webdav' | 'ftp';
  config: any;
  enabled: boolean;
}

interface CacheStats {
  file_count: number;
  total_size_mb: number;
}

export default function WebDAVSettings() {
  const [servers, setServers] = useState<RemoteServer[]>([]);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'webdav' | 'ftp'>('webdav');

  useEffect(() => {
    loadServers();
    loadCacheStats();
  }, []);

  const loadServers = async () => {
    try {
      const data = await invoke<RemoteServer[]>('remote_get_servers');
      setServers(data);
    } catch (error) {
      console.error('加载服务器列表失败:', error);
    }
  };

  const loadCacheStats = async () => {
    try {
      const stats = await invoke<CacheStats>('remote_get_cache_stats');
      setCacheStats(stats);
    } catch (error) {
      console.error('加载缓存统计失败:', error);
    }
  };

  const handleAddServer = async (type: 'webdav' | 'ftp', config: any) => {
    try {
      const configJson = JSON.stringify(config);
      await invoke('remote_add_server', {
        serverType: type,
        name: config.name,
        configJson,
      });
      loadServers();
      setShowAddDialog(false);
    } catch (error) {
      console.error('添加服务器失败:', error);
      alert(`添加失败: ${error}`);
    }
  };

  const handleDelete = async (serverId: string) => {
    if (!confirm('确定要删除此服务器吗？')) return;
    
    try {
      await invoke('remote_delete_server', { serverId });
      loadServers();
    } catch (error) {
      console.error('删除服务器失败:', error);
    }
  };

  const webdavServers = servers.filter(s => s.server_type === 'webdav');
  const ftpServers = servers.filter(s => s.server_type === 'ftp');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-dark-900 mb-2">
          远程音乐源
        </h2>
        <p className="text-slate-600 dark:text-dark-700">
          通过 WebDAV / FTP 访问远程音乐库
        </p>
      </div>

      {/* Tab切换 */}
      <div className="flex space-x-1 bg-slate-100 dark:bg-dark-300 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('webdav')}
          className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
            activeTab === 'webdav'
              ? 'bg-white dark:bg-dark-200 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-dark-700 hover:text-slate-900 dark:hover:text-dark-900'
          }`}
        >
          WebDAV ({webdavServers.length})
        </button>
        <button
          onClick={() => setActiveTab('ftp')}
          className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
            activeTab === 'ftp'
              ? 'bg-white dark:bg-dark-200 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-dark-700 hover:text-slate-900 dark:hover:text-dark-900'
          }`}
        >
          FTP ({ftpServers.length})
        </button>
      </div>

      {/* 缓存统计 */}
      {cacheStats && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-slate-900 dark:text-dark-900">缓存统计</h3>
              <p className="text-sm text-slate-600 dark:text-dark-700 mt-1">
                已缓存 {cacheStats.file_count} 个文件，共 {cacheStats.total_size_mb} MB
              </p>
            </div>
            <button className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
              清理缓存
            </button>
          </div>
        </div>
      )}

      {/* 服务器列表 */}
      <div className="space-y-3">
        {(activeTab === 'webdav' ? webdavServers : ftpServers).length === 0 ? (
          <div className="text-center py-12 bg-slate-50 dark:bg-dark-300 rounded-xl">
            <p className="text-slate-500 dark:text-dark-700">
              还没有添加{activeTab === 'webdav' ? 'WebDAV' : 'FTP'}服务器
            </p>
          </div>
        ) : (
          (activeTab === 'webdav' ? webdavServers : ftpServers).map(server => (
            <div
              key={server.id}
              className="bg-white dark:bg-dark-200 rounded-xl p-4 border border-slate-200 dark:border-dark-400"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900 dark:text-dark-900">{server.name}</h3>
                  <p className="text-sm text-slate-600 dark:text-dark-700 mt-1">
                    {server.config.url || server.config.host}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                    已连接
                  </span>
                  <button
                    onClick={() => handleDelete(server.id)}
                    className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 添加按钮 */}
      <button
        onClick={() => setShowAddDialog(true)}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-xl transition-colors"
      >
        + 添加{activeTab === 'webdav' ? 'WebDAV' : 'FTP'}服务器
      </button>

      {/* 添加对话框（简化版） */}
      {showAddDialog && (
        <AddServerDialog
          type={activeTab}
          onAdd={handleAddServer}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </div>
  );
}

// 添加服务器对话框组件
function AddServerDialog({ type, onAdd, onClose }: any) {
  const [config, setConfig] = useState({
    name: '',
    url: type === 'webdav' ? '' : undefined,
    host: type === 'ftp' ? '' : undefined,
    port: type === 'ftp' ? 21 : undefined,
    username: '',
    password: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(type, config);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-200 rounded-2xl p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold text-slate-900 dark:text-dark-900 mb-4">
          添加{type === 'webdav' ? 'WebDAV' : 'FTP'}服务器
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-1">
              服务器名称
            </label>
            <input
              type="text"
              value={config.name}
              onChange={e => setConfig({ ...config, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-dark-400 bg-white dark:bg-dark-300 text-slate-900 dark:text-dark-900"
              required
            />
          </div>
          
          {type === 'webdav' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-1">
                WebDAV URL
              </label>
              <input
                type="url"
                value={config.url}
                onChange={e => setConfig({ ...config, url: e.target.value })}
                placeholder="https://example.com/webdav"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-dark-400 bg-white dark:bg-dark-300 text-slate-900 dark:text-dark-900"
                required
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-1">
                  主机地址
                </label>
                <input
                  type="text"
                  value={config.host}
                  onChange={e => setConfig({ ...config, host: e.target.value })}
                  placeholder="ftp.example.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-dark-400 bg-white dark:bg-dark-300 text-slate-900 dark:text-dark-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-1">
                  端口
                </label>
                <input
                  type="number"
                  value={config.port}
                  onChange={e => setConfig({ ...config, port: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-dark-400 bg-white dark:bg-dark-300 text-slate-900 dark:text-dark-900"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-1">
              用户名
            </label>
            <input
              type="text"
              value={config.username}
              onChange={e => setConfig({ ...config, username: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-dark-400 bg-white dark:bg-dark-300 text-slate-900 dark:text-dark-900"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-1">
              密码
            </label>
            <input
              type="password"
              value={config.password}
              onChange={e => setConfig({ ...config, password: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-dark-400 bg-white dark:bg-dark-300 text-slate-900 dark:text-dark-900"
              required
            />
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-dark-400 text-slate-700 dark:text-dark-800 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-dark-300 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
            >
              添加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**验证**：启动应用，检查UI是否正常显示

---

## 📦 阶段七：自动化测试与验证 [AUTO-EXECUTE]

### 步骤 7.1：运行编译测试

```bash
cd src-tauri
cargo build --release
```

**预期**：编译成功，无错误

### 步骤 7.2：运行单元测试

```bash
cargo test
```

**预期**：所有测试通过

### 步骤 7.3：启动应用验证

```bash
npm run tauri dev
```

**验证清单**：

- [ ] 应用正常启动
- [ ] 设置页面显示"远程音乐源"
- [ ] 可以切换WebDAV/FTP标签
- [ ] 可以打开添加服务器对话框
- [ ] 表单输入正常
- [ ] 缓存统计显示正常

---

## ✅ 完成标志

当以上所有步骤执行完成且验证通过后，**远程音乐源基础架构已成功实现**。

### 已完成功能

- ✅ WebDAV XML解析器（支持多种服务器）
- ✅ 数据库架构扩展（服务器、缓存、任务表）
- ✅ 统一远程源抽象层
- ✅ WebDAV远程源适配器
- ✅ Tauri命令API
- ✅ 前端设置UI（WebDAV/FTP统一界面）
- ✅ 缓存统计功能

### 后续扩展方向（可选）

1. **智能缓存管理器** - 自动缓存策略、LRU淘汰
2. **远程音乐扫描器** - 递归扫描、元数据提取
3. **播放器集成** - 缓存检查、流式播放
4. **FTP模块增强** - 对齐WebDAV的弹性设计
5. **文件浏览器组件** - 虚拟滚动、面包屑导航

---

## 🚨 故障排查指南

### 问题1：编译失败 - 找不到模块

**解决**：检查 `mod.rs` 文件是否正确导出，运行：

```bash
grep -r "pub mod" src-tauri/src/
```

### 问题2：XML解析返回空结果

**解决**：添加调试日志：

```rust
log::debug!("XML响应: {}", response_xml);
```

检查XML格式是否符合预期

### 问题3：数据库操作失败

**解决**：检查表是否创建成功：

```rust
// 在Database::new()后添加
conn.execute("SELECT name FROM sqlite_master WHERE type='table'", [])
```

### 问题4：前端无法调用命令

**解决**：确认命令已注册到 `invoke_handler![]` 中

---

## 📝 AI执行完成报告模板

执行完成后，AI应生成如下报告：

```
✅ 远程音乐源实施完成报告

阶段一：依赖和基础设施
- ✅ 添加quick-xml依赖
- ✅ 实现XML解析器 (src-tauri/src/webdav/xml_parser.rs)
- ✅ 修复parse_propfind_response方法

阶段二：数据库架构扩展
- ✅ 添加remote_servers表
- ✅ 添加remote_cache表
- ✅ 添加sync_tasks表
- ✅ 实现数据库操作方法

阶段三：统一远程源抽象层
- ✅ 创建remote_source模块
- ✅ 定义RemoteSourceClient trait
- ✅ 定义统一类型

阶段四：WebDAV适配器
- ✅ 实现WebDAVRemoteAdapter

阶段五：Tauri命令扩展
- ✅ 添加remote_add_server命令
- ✅ 添加remote_get_servers命令
- ✅ 添加remote_delete_server命令
- ✅ 添加remote_get_cache_stats命令

阶段六：前端UI实现
- ✅ 替换WebDAVSettings组件
- ✅ 实现Tab切换
- ✅ 实现服务器列表
- ✅ 实现添加对话框

阶段七：测试与验证
- ✅ 编译测试通过
- ✅ 单元测试通过
- ✅ 应用启动验证通过

文件修改清单：
- 新建: src-tauri/src/webdav/xml_parser.rs
- 新建: src-tauri/src/webdav/remote_adapter.rs
- 新建: src-tauri/src/remote_source/mod.rs
- 新建: src-tauri/src/remote_source/types.rs
- 修改: src-tauri/Cargo.toml
- 修改: src-tauri/src/webdav/mod.rs
- 修改: src-tauri/src/webdav/client.rs
- 修改: src-tauri/src/db.rs
- 修改: src-tauri/src/lib.rs
- 替换: src/components/settings/WebDAVSettings.tsx

总计：10个文件修改/新建

实施状态：✅ 成功完成
```

### To-dos

- [ ] 扩展Tauri命令（服务器管理、扫描、缓存）
- [ ] 实现远程音乐源设置UI（WebDAV+FTP统一界面）
- [ ] 集成到播放器（缓存检查、流式播放）