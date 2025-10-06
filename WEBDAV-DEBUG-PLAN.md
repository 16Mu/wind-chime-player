# WebDAV 流式播放调试计划

## 当前问题
WebDAV Reader 创建成功，但解码时立即失败 "end of stream"

## 诊断步骤

### 1. 检查文件大小获取
在 `webdav_reader.rs` 的 `get_file_size` 函数中，确认：
- HEAD 或 Range 请求是否返回正确的文件大小
- 文件大小是否 > 0

### 2. 检查初始缓冲
在 `new_with_auth` 函数中，确认：
- 后台下载线程是否启动成功
- 初始缓冲是否真正等待了足够的数据
- 缓冲完成时 `available()` 返回的字节数

### 3. 检查 Read 实现
在 `impl Read for WebDAVStreamReader` 中，确认：
- 第一次 read 调用是否返回 > 0 的字节
- 缓冲区状态是否正确

## 快速修复

### 方案A：增加诊断日志（推荐）
```rust
// 在 webdav_reader.rs 的关键位置添加 println!

// 1. get_file_size 函数
println!("📊 获取到的文件大小: {} 字节", file_size);

// 2. new_with_auth 函数的初始缓冲循环
println!("⏳ 等待缓冲: available={}, eof={}", available, eof);

// 3. impl Read 的 read 函数
println!("📖 Read调用: 请求{}字节, available={}, eof={}", 
    buf.len(), state.available(), state.eof);
```

### 方案B：修复初始缓冲条件
```rust
// 修改初始缓冲条件，不接受 eof 但 available=0 的情况
if available >= min_bytes {
    log::info!("✅ WEBDAV: 初始缓冲完成");
    break;
}
if eof && available == 0 {
    return Err(io::Error::new(
        io::ErrorKind::UnexpectedEof, 
        "文件大小为0或下载失败"
    ));
}
if eof {
    log::warn!("⚠️ WEBDAV: EOF reached, available={}", available);
    break;
}
```

### 方案C：临时使用完整下载（最稳定）
```rust
// 放弃流式播放，先下载完整文件再播放
async fn download_full_webdav(url: &str, auth: &str) -> Result<Vec<u8>> {
    let client = Client::new();
    let response = client.get(url)
        .header("Authorization", auth)
        .send()
        .await?;
    let bytes = response.bytes().await?;
    Ok(bytes.to_vec())
}

// 在 decode_streaming 中使用
let full_data = download_full_webdav(&http_url, &auth_header).await?;
let cursor = std::io::Cursor::new(full_data);
let decoder = rodio::Decoder::new(cursor)?;
```

## 推荐行动

1. **立即尝试方案C** - 完整下载（最稳定，seek也好实现）
2. 如果需要真正的流式播放，再用方案A调试

## 实现方案C的代码位置

文件: `src-tauri/src/player/actors/playback_actor.rs`
函数: `decode_streaming`

```rust
async fn decode_streaming(&self, track_path: &str) -> Result<Box<dyn rodio::Source<Item = i16> + Send>> {
    use tokio::time::{timeout, Duration};
    
    // 解析URL和认证
    let (http_url, username, password, _) = self.parse_webdav_url_with_config(track_path)?;
    
    // 创建HTTP客户端并下载完整文件
    log::info!("🌐 WebDAV: 下载完整文件...");
    let client = reqwest::Client::new();
    
    let mut request = client.get(&http_url);
    if !username.is_empty() {
        use base64::Engine;
        let auth = format!("{}:{}", username, password);
        let encoded = base64::engine::general_purpose::STANDARD.encode(auth);
        request = request.header("Authorization", format!("Basic {}", encoded));
    }
    
    let response = timeout(Duration::from_secs(30), request.send())
        .await
        .map_err(|_| PlayerError::decode_error("下载超时".to_string()))?
        .map_err(|e| PlayerError::decode_error(format!("下载失败: {}", e)))?;
    
    let bytes = timeout(Duration::from_secs(60), response.bytes())
        .await
        .map_err(|_| PlayerError::decode_error("读取超时".to_string()))?
        .map_err(|e| PlayerError::decode_error(format!("读取失败: {}", e)))?;
    
    log::info!("✅ WebDAV: 文件下载完成，大小: {:.2}MB", bytes.len() as f64 / 1024.0 / 1024.0);
    
    // 从内存解码
    let cursor = std::io::Cursor::new(bytes);
    let decoder = rodio::Decoder::new(cursor)
        .map_err(|e| PlayerError::decode_error(format!("解码失败: {}", e)))?;
    
    Ok(Box::new(decoder))
}
```

这样就能同时解决：
1. ✅ 播放问题（完整下载，100%稳定）
2. ✅ Seek问题（内存中的数据，随意seek）
3. ✅ 简单实现（不需要复杂的流式逻辑）

唯一的代价是启动延迟（但对于10-15MB的FLAC文件，只需要3-5秒）



















