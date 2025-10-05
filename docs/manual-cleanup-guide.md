# 🔧 手动清理指南

本指南包含需要手动执行的代码清理步骤（阶段2和4）

---

## 📋 清理前检查清单

- [ ] 已执行阶段1（删除配置系统）
- [ ] 已执行阶段3（标记允许）
- [ ] 已创建 git 备份
- [ ] 应用功能测试通过

---

## 🔴 阶段2：删除 WebDAV 写操作

### 文件1: src-tauri/src/webdav/types.rs

#### 删除 WebDAVMethod 的写操作变体

找到 `WebDAVMethod` 枚举（约 Line 163），删除以下变体：

```rust
pub enum WebDAVMethod {
    GET,
    HEAD,
    PROPFIND,
    // 🔴 删除以下几行：
    PUT,
    POST,
    DELETE,
    COPY,
    MOVE,
    MKCOL,
    LOCK,
    UNLOCK,
}
```

保留后应该只有：
```rust
pub enum WebDAVMethod {
    GET,
    HEAD,
    PROPFIND,
}
```

#### 删除 DavProperty 未使用变体

找到 `DavProperty` 枚举（约 Line 136），删除：

```rust
pub enum DavProperty {
    GetContentType,
    GetContentLength,
    GetLastModified,
    // 🔴 删除以下几行：
    GetContentLanguage,
    GetContentEncoding,
    Custom(String),
}
```

#### 删除上传相关类型

删除以下整块代码（约 Line 249-260）：

```rust
// 🔴 删除这两个类型定义：
pub type ProgressCallback = Arc<dyn Fn(u64, u64) + Send + Sync>;

pub struct UploadOptions {
    pub progress_callback: Option<ProgressCallback>,
    pub chunk_size: usize,
}
```

---

### 文件2: src-tauri/src/webdav/client.rs

#### 删除 upload_file 方法

找到 `upload_file` 方法（约 Line 235-335），删除整个方法：

```rust
// 🔴 删除从这里开始到方法结束的所有代码
pub async fn upload_file(
    &self,
    local_path: &Path,
    remote_path: &str,
    options: Option<UploadOptions>,
) -> Result<(), WebDAVError> {
    // ... 整个方法体
}
```

#### 删除 send_request_with_body 方法

找到并删除（约 Line 336-402）：

```rust
// 🔴 删除整个方法
async fn send_request_with_body(
    &self,
    url: &str,
    method: WebDAVMethod,
    body: Vec<u8>,
) -> Result<Response, WebDAVError> {
    // ... 整个方法体
}
```

#### 删除 ensure_parent_directories 方法

找到并删除（约 Line 403-472）：

```rust
// 🔴 删除整个方法
async fn ensure_parent_directories(
    &self,
    path: &str,
) -> Result<(), WebDAVError> {
    // ... 整个方法体
}
```

---

## 🔴 阶段2：删除健康检查系统

### 文件3: src-tauri/src/player/actors/audio_actor.rs

#### 删除 HealthCheck 消息变体

找到 `AudioMsg` 枚举（约 Line 21），删除：

```rust
pub enum AudioMsg {
    Initialize,
    Play(PathBuf),
    // ... 其他变体
    // 🔴 删除这一行：
    HealthCheck,
}
```

#### 删除结构体中的健康检查字段

找到 `AudioActor` 结构体（约 Line 33），删除字段：

```rust
pub struct AudioActor {
    inbox: mpsc::Receiver<AudioMsg>,
    device_cache: Arc<RwLock<Option<AudioDevice>>>,
    event_tx: broadcast::Sender<PlayerEvent>,
    // 🔴 删除以下两个字段：
    health_check_interval: Duration,
    max_retries: u32,
}
```

#### 删除健康检查方法

找到并删除以下方法（约 Line 78-197）：

```rust
// 🔴 删除整个方法
async fn handle_health_check(&mut self) {
    // ... 整个方法体
}

// 🔴 删除整个方法
async fn health_check(&self) -> bool {
    // ... 整个方法体
}
```

#### 更新 new() 构造函数

移除健康检查相关参数：

```rust
// 修改前：
impl AudioActor {
    pub fn new(
        inbox: mpsc::Receiver<AudioMsg>,
        event_tx: broadcast::Sender<PlayerEvent>,
        health_check_interval: Duration,  // 🔴 删除这个参数
        max_retries: u32,                 // 🔴 删除这个参数
    ) -> Self {
        Self {
            inbox,
            device_cache: Arc::new(RwLock::new(None)),
            event_tx,
            health_check_interval,  // 🔴 删除这个赋值
            max_retries,           // 🔴 删除这个赋值
        }
    }
}

// 修改后：
impl AudioActor {
    pub fn new(
        inbox: mpsc::Receiver<AudioMsg>,
        event_tx: broadcast::Sender<PlayerEvent>,
    ) -> Self {
        Self {
            inbox,
            device_cache: Arc::new(RwLock::new(None)),
            event_tx,
        }
    }
}
```

#### 更新 run() 方法

移除健康检查消息处理：

```rust
// 在 run() 方法的 match 语句中，删除：
match msg {
    AudioMsg::Initialize => { ... }
    AudioMsg::Play(path) => { ... }
    // 🔴 删除这个分支：
    AudioMsg::HealthCheck => {
        self.handle_health_check().await;
    }
}
```

---

### 文件4: src-tauri/src/player/audio/sink_pool.rs

#### 删除 utilization 方法

找到并删除（约 Line 235）：

```rust
// 🔴 删除整个方法
pub fn utilization(&self) -> f32 {
    let active = self.active_sinks.load(Ordering::Relaxed);
    let capacity = self.capacity;
    active as f32 / capacity as f32
}
```

---

### 文件5: src-tauri/src/webdav/safe_stream.rs

#### 删除 BufferStats 统计字段

找到 `BufferStats` 结构体（约 Line 193），删除字段：

```rust
#[derive(Debug, Clone)]
pub struct BufferStats {
    pub active_streams: usize,  // ✅ 保留
    // 🔴 删除以下字段：
    pub current_size: usize,
    pub max_size: usize,
    pub allocation_count: usize,
    pub utilization_percent: f32,
}
```

保留后：
```rust
#[derive(Debug, Clone)]
pub struct BufferStats {
    pub active_streams: usize,
}
```

#### 更新 get_stats() 方法

找到 `get_stats()` 方法，更新返回值：

```rust
// 修改前：
pub fn get_stats(&self) -> BufferStats {
    BufferStats {
        active_streams: self.active_streams.load(Ordering::Relaxed),
        current_size: self.current_size.load(Ordering::Relaxed),
        max_size: self.max_size,
        allocation_count: self.allocation_count.load(Ordering::Relaxed),
        utilization_percent: self.utilization(),
    }
}

// 修改后：
pub fn get_stats(&self) -> BufferStats {
    BufferStats {
        active_streams: self.active_streams.load(Ordering::Relaxed),
    }
}
```

#### 删除 remaining_time 方法

找到并删除（约 Line 247）：

```rust
// 🔴 删除整个方法
pub fn remaining_time(&self) -> Option<Duration> {
    // ... 整个方法体
}
```

#### 删除 start_time 字段

找到 `StreamStats` 结构体（约 Line 281），删除：

```rust
pub struct StreamStats {
    pub bytes_read: u64,
    pub read_speed: f64,
    // 🔴 删除这个字段：
    pub start_time: Instant,
}
```

---

## 🔴 阶段4：删除其他未使用功能

### 文件6: src-tauri/src/remote_source/types.rs

#### 删除 HealthStatus 结构体

找到并删除（约 Line 45）：

```rust
// 🔴 删除整个结构体定义
pub struct HealthStatus {
    pub is_healthy: bool,
    pub last_check: SystemTime,
    pub error_count: u32,
}
```

#### 删除 get_health 方法

在 trait 定义中删除：

```rust
#[async_trait]
pub trait RemoteSource {
    async fn list_files(&self, path: &str) -> Result<Vec<FileInfo>>;
    async fn download_file(&self, path: &str) -> Result<Vec<u8>>;
    // 🔴 删除这个方法：
    async fn get_health(&self) -> HealthStatus;
    
    // ✅ 保留这些：
    fn get_file_info(&self, path: &str) -> Result<FileInfo>;
    fn get_source_type(&self) -> String;
}
```

---

### 文件7: src-tauri/src/lyrics.rs

#### 删除 get_lines_around 方法

找到并删除（约 Line 655）：

```rust
// 🔴 删除整个方法
pub fn get_lines_around(&self, index: usize, context: usize) -> Vec<&LyricLine> {
    // ... 整个方法体
}
```

---

### 文件8: src-tauri/src/playlist/importer.rs

#### 删除 detect_format 方法

找到并删除（约 Line 166）：

```rust
// 🔴 删除整个方法
fn detect_format(path: &Path) -> Option<PlaylistFormat> {
    // ... 整个方法体
}
```

---

### 文件9: src-tauri/src/playlist/exporter.rs

#### 删除 validate_export_path 方法

找到并删除（约 Line 183）：

```rust
// 🔴 删除整个方法
fn validate_export_path(path: &Path) -> Result<(), ExportError> {
    // ... 整个方法体
}
```

---

### 文件10: src-tauri/src/player/audio/decoder.rs

#### 删除 AsyncAudioDecoder

找到并删除整个异步解码器（约 Line 136-200）：

```rust
// 🔴 删除从这里开始的所有相关代码
pub struct AsyncAudioDecoder {
    // ... 整个结构体和实现
}

impl AsyncAudioDecoder {
    // ... 所有方法
}
```

---

## ✅ 清理后验证

每个文件修改后，执行以下验证：

```bash
# 1. 检查语法错误
cd src-tauri
cargo check

# 2. 检查警告数量
cargo clippy 2>&1 | grep "warning:" | wc -l

# 3. 运行测试（如果有）
cargo test

# 4. 编译发布版本
cargo build --release
```

---

## 📊 预期结果

| 文件 | 删除内容 | 消除警告 |
|------|---------|---------|
| webdav/types.rs | 枚举变体、类型定义 | ~8个 |
| webdav/client.rs | 3个方法 | ~12个 |
| audio_actor.rs | 健康检查系统 | ~15个 |
| sink_pool.rs | 统计方法 | ~1个 |
| safe_stream.rs | 统计字段和方法 | ~8个 |
| remote_source/types.rs | 健康检查 | ~3个 |
| lyrics.rs | 上下文查询 | ~1个 |
| playlist/*.rs | 验证方法 | ~2个 |
| decoder.rs | 异步解码器 | ~8个 |
| **总计** | | **~58个** |

---

## ⚠️ 注意事项

### 删除前必须确认：

1. **WebDAV 功能**：确保应用不需要上传功能
2. **健康检查**：确保没有依赖健康检查的监控代码
3. **统计功能**：确保前端不显示这些统计信息

### 如果编译失败：

1. 检查是否有其他文件调用了被删除的方法
2. 使用 `cargo check` 查看具体错误
3. 使用 `git diff` 查看改动
4. 必要时回滚：`git checkout -- <file>`

---

## 🎯 完成清单

- [ ] 删除 WebDAV 写操作（文件1-2）
- [ ] 删除健康检查系统（文件3-5）
- [ ] 删除其他功能（文件6-10）
- [ ] 验证编译通过
- [ ] 验证功能正常
- [ ] 提交更改

---

## 📝 提交信息建议

```bash
git add -A
git commit -m "chore: remove unused code (WebDAV write, health check, etc)

- Remove WebDAV write operations (upload, COPY, MOVE, etc)
- Remove health check system
- Remove unused statistics methods
- Remove async decoder (not implemented)
- Remove unused playlist validation methods

This cleanup removes ~58 dead code warnings while preserving
all active functionality.
"
```

---

**提示**: 如果不确定某个方法是否被使用，可以先不删除，使用 grep 搜索：

```bash
# 检查方法是否被调用
rg "method_name" src-tauri/src --type rust
```

