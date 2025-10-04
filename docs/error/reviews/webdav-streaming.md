# WebDAV流式播放功能 - 实战问题深度审查

**审查时间**: 2025-10-04  
**审查重点**: 从实战角度找出可能导致崩溃、卡死、内存泄漏的真实问题

---

## 🔥 严重问题（P0 - 立即修复）

### 1. 【性能杀手】流式服务在持锁状态下执行网络IO

**文件**: `src-tauri/src/streaming/service.rs:142-201`

**问题描述**:
```rust
pub async fn get_chunk(&self, request: ChunkRequest) -> StreamResult<ChunkResponse> {
    // 获取会话 - 注意这里是 write() 锁！
    let mut sessions = self.sessions.write().await;  // 🔥 锁定整个会话表
    let state = sessions.get_mut(&request.session_id)
        .ok_or_else(|| StreamError::SessionNotFound(request.session_id.clone()))?;
    
    // ... 验证代码 ...
    
    // 🔥 致命问题：在持有写锁的情况下执行网络请求！
    let mut data_stream = state.client
        .download_range(&remote_path, request.offset, Some(end_offset))
        .await  // 这可能需要几秒钟！
        .map_err(|e| StreamError::RangeRequestFailed(e.to_string()))?;
    
    // 🔥 更致命：在持锁状态下读取完整数据到内存
    let mut data = Vec::with_capacity(actual_length as usize);
    data_stream.read_to_end(&mut data).await  // 可能需要几秒到几十秒！
        .map_err(|e| StreamError::IoError(e.to_string()))?;
    
    // ... 锁一直持有到这里才释放
}
```

**实际影响**:
- 多个客户端同时请求chunk时，所有请求串行化，第二个请求要等第一个下载完成
- 如果网络慢，一个512KB的chunk下载需要5秒，其他请求都等待5秒
- 多个播放会话互相阻塞，用户体验极差

**复现场景**:
```
用户A正在播放文件1，正在下载chunk（网络慢，需要3秒）
  ↓ [持有write锁3秒]
用户B也想播放文件2，调用create_session -> 阻塞等待
用户A想获取下一个chunk -> 阻塞等待自己的前一个请求
  ↓ 死锁或严重卡顿
```

**修复方案**:
```rust
pub async fn get_chunk(&self, request: ChunkRequest) -> StreamResult<ChunkResponse> {
    // 1. 先获取必要信息（短暂持锁）
    let (client, remote_path, total_size, actual_length) = {
        let sessions = self.sessions.read().await;  // 读锁，允许并发
        let state = sessions.get(&request.session_id)
            .ok_or_else(|| StreamError::SessionNotFound(request.session_id.clone()))?;
        
        // 验证
        if request.offset >= state.info.total_size {
            return Err(StreamError::InvalidOffset(request.offset));
        }
        
        let actual_length = request.length.min(state.info.total_size - request.offset);
        let (_server_id, remote_path) = self.parse_remote_path(&state.info.file_path)
            .map_err(|e| StreamError::SourceUnavailable(e))?;
        
        (state.client.clone(), remote_path, state.info.total_size, actual_length)
    }; // 锁在这里释放
    
    // 2. 执行网络IO（无锁状态）
    let end_offset = request.offset + actual_length - 1;
    let mut data_stream = client
        .download_range(&remote_path, request.offset, Some(end_offset))
        .await
        .map_err(|e| StreamError::RangeRequestFailed(e.to_string()))?;
    
    let mut data = Vec::with_capacity(actual_length as usize);
    data_stream.read_to_end(&mut data).await
        .map_err(|e| StreamError::IoError(e.to_string()))?;
    
    // 3. 更新统计（短暂持锁）
    {
        let mut sessions = self.sessions.write().await;
        if let Some(state) = sessions.get_mut(&request.session_id) {
            state.stats.bytes_transferred += data.len() as u64;
            state.stats.request_count += 1;
            state.info.last_accessed_at = chrono::Utc::now().timestamp();
        }
    }
    
    // ... 返回数据
}
```

---

### 2. 【内存炸弹】服务器不支持Range时返回完整文件

**文件**: `src-tauri/src/webdav/client.rs:198-220`

**问题描述**:
```rust
pub async fn download_range(&self, path: &str, range: RangeRequest) -> WebDAVResult<impl Stream<...>> {
    // ... 发送Range请求 ...
    
    let response = self.send_request(WebDAVMethod::Get, path, Some(headers), None).await?;
    
    // 🔥 只是警告，但继续返回流！
    if response.status() != reqwest::StatusCode::PARTIAL_CONTENT {
        log::warn!("服务器不支持范围请求，返回完整文件");
    }
    
    // 🔥 问题：即使服务器返回200（完整文件），也当作成功返回
    Ok(response.bytes_stream().map_err(WebDAVError::from))
}
```

**实际影响**:
- 用户请求512KB的chunk，服务器不支持Range，返回5GB的完整文件
- `read_to_end()` 会尝试读取整个5GB到内存
- 应用崩溃或OOM

**复现场景**:
```
服务器: nginx但没配置range支持
客户端: 请求 bytes=0-524287 (512KB)
服务器: 返回 200 OK，Content-Length: 5368709120 (5GB)
客户端: read_to_end尝试读取5GB -> 内存爆炸 -> 崩溃
```

**修复方案**:
```rust
pub async fn download_range(&self, path: &str, range: RangeRequest) -> WebDAVResult<impl Stream<...>> {
    let mut headers = HeaderMap::new();
    headers.insert(
        "Range",
        HeaderValue::from_str(&range.to_string())
            .map_err(|e| WebDAVError::ConfigError(format!("无效的Range请求: {}", e)))?
    );
    
    let response = self.send_request(WebDAVMethod::Get, path, Some(headers), None).await?;
    
    // 🔥 严格检查：必须返回206，否则拒绝
    if response.status() != reqwest::StatusCode::PARTIAL_CONTENT {
        return Err(WebDAVError::RangeNotSupported {
            server_status: response.status().as_u16(),
            message: "服务器不支持范围请求，无法流式播放".to_string()
        });
    }
    
    // 验证Content-Length是否符合预期
    let content_length = response.content_length().unwrap_or(0);
    let expected_length = range.end.map(|e| e - range.start + 1).unwrap_or(u64::MAX);
    
    if content_length > expected_length * 2 {  // 允许一定误差
        log::warn!("响应大小({})远超请求大小({})", content_length, expected_length);
    }
    
    Ok(response.bytes_stream().map_err(WebDAVError::from))
}
```

---

### 3. 【数据不一致】下载的数据大小未验证

**文件**: `src-tauri/src/streaming/service.rs:172-176`

**问题描述**:
```rust
// 读取数据到内存
use tokio::io::AsyncReadExt;
let mut data = Vec::with_capacity(actual_length as usize);
data_stream.read_to_end(&mut data).await  // 🔥 实际读取可能小于expected
    .map_err(|e| StreamError::IoError(e.to_string()))?;

// 🔥 没有验证 data.len() == actual_length
// 直接返回给客户端
Ok(ChunkResponse {
    session_id: request.session_id,
    offset: request.offset,
    length: data.len() as u64,  // 可能不等于请求的length
    data: data_base64,
    is_last,
})
```

**实际影响**:
- 网络中断导致只读取了一部分数据，但返回成功
- 前端MediaSource收到不完整的数据块，解码失败
- 播放卡住或花屏

**修复方案**:
```rust
let mut data = Vec::with_capacity(actual_length as usize);
let bytes_read = data_stream.read_to_end(&mut data).await
    .map_err(|e| StreamError::IoError(e.to_string()))?;

// 验证数据完整性
if data.len() != actual_length as usize {
    log::error!(
        "数据大小不匹配：期望 {} bytes，实际 {} bytes",
        actual_length,
        data.len()
    );
    
    // 如果差距很大，返回错误
    if data.len() < actual_length as usize / 2 {
        return Err(StreamError::IncompleteData {
            expected: actual_length,
            actual: data.len() as u64,
        });
    }
}
```

---

## ⚠️ 重要问题（P1 - 本周修复）

### 4. 【功能缺陷】Seek功能实现完全错误

**文件**: `src/hooks/useStreamPlayer.ts:253-273`

**问题描述**:
```typescript
const seek = useCallback(async (time: number) => {
    // 🔥 致命错误：假设视频数据均匀分布
    const estimatedOffset = Math.floor((time / duration) * session.total_size);
    currentOffsetRef.current = estimatedOffset;
    
    // 🔥 问题：
    // 1. 视频数据不是均匀的（I帧、P帧大小不同）
    // 2. 不能从任意字节位置开始解码
    // 3. 需要从关键帧开始
```

**实际影响**:
- 用户拖动进度条到50%，计算出的字节偏移落在某个P帧中间
- MediaSource无法解码，报错或花屏
- Seek功能完全不可用

**正确实现**:
```typescript
// 方案1：使用HTTP Range + Accept-Ranges时间范围（如果服务器支持）
// 方案2：预先获取视频的关键帧索引（moov atom）
// 方案3：对于MP4，先下载moov atom，解析关键帧位置

// 临时方案：禁用seek或只支持播放完的部分seek
const seek = useCallback(async (time: number) => {
    if (!session || !videoRef.current) {
        return;
    }
    
    // 只允许在已缓冲的范围内seek
    const buffered = videoRef.current.buffered;
    if (buffered.length === 0) {
        console.warn('无可用缓冲区，无法seek');
        return;
    }
    
    const bufferStart = buffered.start(0);
    const bufferEnd = buffered.end(buffered.length - 1);
    
    if (time < bufferStart || time > bufferEnd) {
        console.warn(`Seek位置(${time}s)超出缓冲范围(${bufferStart}-${bufferEnd})`);
        // 显示提示：请等待缓冲或从头播放
        return;
    }
    
    // 在缓冲范围内，直接修改currentTime
    videoRef.current.currentTime = time;
}, [session]);
```

---

### 5. 【并发Bug】loadNextChunk可能被并发调用

**文件**: `src/hooks/useStreamPlayer.ts:140-179`

**问题描述**:
```typescript
const loadNextChunk = useCallback(async () => {
    if (!session || isLoadingChunkRef.current) {
        return;  // 🔥 这里检查了，但有race condition
    }
    
    isLoadingChunkRef.current = true;  // 🔥 这行和上面之间有时间差
    
    // ... 网络请求 ...
}, [session, config.chunkSize, appendChunkToBuffer]);

// 在 timeupdate 事件中调用
const handleTimeUpdate = () => {
    // ...
    if (timeUntilBufferEnd < config.bufferAhead) {
        loadNextChunk();  // 🔥 事件可能快速触发多次
    }
};
```

**实际影响**:
```
时刻T0: timeupdate触发 -> 调用loadNextChunk -> 检查flag=false -> 继续
时刻T1: timeupdate再次触发 -> 调用loadNextChunk -> 检查flag=false (还没设置) -> 继续
时刻T2: 第一个请求设置flag=true
时刻T3: 第二个请求也设置flag=true
结果: 同一个chunk被请求两次，浪费带宽，数据重复添加到buffer
```

**修复方案**:
```typescript
const loadNextChunk = useCallback(async () => {
    if (!session) {
        return;
    }
    
    // 🔥 使用原子操作检查并设置
    if (isLoadingChunkRef.current) {
        return;
    }
    isLoadingChunkRef.current = true;
    
    // 立即检查offset，避免重复请求
    const requestOffset = currentOffsetRef.current;
    
    try {
        if (requestOffset >= session.total_size) {
            console.log('📺 已到达文件末尾');
            return;
        }
        
        const chunk = await streamingService.getChunk({
            session_id: session.session_id,
            offset: requestOffset,  // 🔥 使用快照值
            length: config.chunkSize,
        });
        
        // 🔥 检查是否已过期（可能在等待期间offset被修改）
        if (requestOffset !== currentOffsetRef.current) {
            console.warn('Chunk请求已过期，丢弃');
            return;
        }
        
        // 更新偏移量
        currentOffsetRef.current += chunk.length;
        
        appendChunkToBuffer(chunk);
        
        if (chunk.is_last && mediaSourceRef.current?.readyState === 'open') {
            mediaSourceRef.current.endOfStream();
        }
    } catch (err) {
        console.error('❌ 加载数据块失败:', err);
        setState('error');
        setError(`加载数据失败: ${err}`);
    } finally {
        isLoadingChunkRef.current = false;
    }
}, [session, config.chunkSize, appendChunkToBuffer]);
```

---

### 6. 【资源泄漏】SourceBuffer remove操作失败后不重试

**文件**: `src/hooks/useStreamPlayer.ts:119-129`

**问题描述**:
```typescript
// 清理已播放的数据（节省内存）
if (videoRef.current && videoRef.current.currentTime > 30) {
    const removeEnd = videoRef.current.currentTime - 20;
    if (sourceBuffer.buffered.length > 0 && removeEnd > 0) {
        try {
            sourceBuffer.remove(0, removeEnd);  // 🔥 可能抛异常
        } catch (err) {
            console.warn('⚠️ 清理缓冲区失败:', err);  // 🔥 只是warn，不重试
        }
    }
}
```

**实际影响**:
- SourceBuffer在updating状态时调用remove会抛异常
- 缓冲区永远不被清理，内存持续增长
- 长时间播放后内存占用几GB，浏览器崩溃

**修复方案**:
```typescript
// 维护一个待清理队列
const pendingRemovalsRef = useRef<Array<{start: number, end: number}>>([]);

const tryRemoveBufferedData = useCallback(() => {
    const sourceBuffer = sourceBufferRef.current;
    const video = videoRef.current;
    
    if (!sourceBuffer || !video) return;
    
    // 不在updating状态时才尝试清理
    if (!sourceBuffer.updating) {
        // 1. 处理待清理队列
        if (pendingRemovalsRef.current.length > 0) {
            const removal = pendingRemovalsRef.current.shift();
            if (removal) {
                try {
                    sourceBuffer.remove(removal.start, removal.end);
                    return; // 成功，等待updateend
                } catch (err) {
                    console.error('清理缓冲区失败:', err);
                }
            }
        }
        
        // 2. 检查是否需要新的清理
        if (video.currentTime > 30) {
            const removeEnd = video.currentTime - 20;
            if (sourceBuffer.buffered.length > 0 && removeEnd > 0) {
                const bufferStart = sourceBuffer.buffered.start(0);
                if (bufferStart < removeEnd) {
                    try {
                        sourceBuffer.remove(bufferStart, removeEnd);
                    } catch (err) {
                        // 如果失败，加入队列
                        pendingRemovalsRef.current.push({
                            start: bufferStart,
                            end: removeEnd
                        });
                    }
                }
            }
        }
    }
}, []);

// 在sourceBuffer的updateend事件中调用
sourceBuffer.addEventListener('updateend', () => {
    // 处理待添加的chunk
    if (pendingChunksRef.current.length > 0) {
        const chunk = pendingChunksRef.current.shift();
        if (chunk) {
            appendChunkToBuffer(chunk);
        }
    } else {
        // 没有待添加的chunk时，尝试清理
        tryRemoveBufferedData();
    }
});
```

---

## 🐛 一般问题（P2 - 下周修复）

### 7. 【竞态条件】组件卸载时的cleanup race condition

**文件**: `src/hooks/useStreamPlayer.ts:334-343`

**问题描述**:
```typescript
useEffect(() => {
    return () => {
        if (session) {
            streamingService.closeSession(session.session_id);  // 🔥 异步调用
        }
        // ... 但组件已经卸载，状态更新会报错
    };
}, [session]);
```

**修复方案**:
```typescript
useEffect(() => {
    let isMounted = true;
    
    return () => {
        isMounted = false;
        
        if (session) {
            // 使用Promise.catch避免unhandled rejection
            streamingService.closeSession(session.session_id)
                .catch(err => {
                    console.error('关闭会话失败:', err);
                });
        }
        
        // 清理MediaSource
        if (mediaSourceRef.current && mediaSourceRef.current.readyState === 'open') {
            try {
                mediaSourceRef.current.endOfStream();
            } catch (err) {
                console.warn('MediaSource cleanup失败:', err);
            }
        }
        
        // 清理video element
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.src = '';
            videoRef.current.load();
        }
    };
}, [session]);
```

---

### 8. 【性能】Base64编码导致内存和CPU开销

**文件**: `src-tauri/src/streaming/service.rs:178-179`

**问题描述**:
- 每个chunk都要Base64编码，增加33%内存占用
- CPU浪费在编码/解码上

**更好的方案**:
使用Tauri的二进制传输：
```rust
// 后端返回二进制
#[tauri::command]
async fn streaming_get_chunk_binary(
    request: ChunkRequest,
    state: State<'_, AppState>,
) -> Result<Vec<u8>, String> {  // 直接返回Vec<u8>
    let response = state.streaming_service.get_chunk(request).await
        .map_err(|e| e.to_string())?;
    
    // 解码Base64（临时过渡）
    let data = base64::decode(&response.data)
        .map_err(|e| format!("解码失败: {}", e))?;
    
    Ok(data)
}

// 前端接收
const chunk = await invoke<Uint8Array>('streaming_get_chunk_binary', { request });
// 直接是二进制，无需解码
sourceBuffer.appendBuffer(chunk.buffer);
```

---

## 📊 测试建议

### 关键测试场景

1. **并发压力测试**:
```rust
#[tokio::test]
async fn test_concurrent_chunk_requests() {
    // 同时发起10个chunk请求，验证不会死锁
    // 验证性能不会线性下降
}
```

2. **服务器不支持Range测试**:
```rust
#[tokio::test]
async fn test_no_range_support() {
    // Mock服务器返回200而非206
    // 验证返回明确错误而不是尝试下载完整文件
}
```

3. **网络中断测试**:
```typescript
test('网络中断时正确处理', async () => {
    // 模拟下载一半时网络断开
    // 验证错误处理和重试机制
});
```

4. **内存泄漏测试**:
```typescript
test('长时间播放不泄漏内存', async () => {
    // 播放1小时，监控内存占用
    // 验证缓冲区被正确清理
});
```

---

## 🎯 优先级修复路线图

### 今天（必须）
1. 修复持锁网络IO问题（问题1）
2. 修复Range不支持时的内存炸弹（问题2）

### 本周
3. 验证下载数据大小（问题3）
4. 修复并发chunk请求（问题5）
5. 实现SourceBuffer清理重试（问题6）

### 下周
6. 禁用或正确实现seek（问题4）
7. 优化Base64传输（问题8）
8. 完善cleanup逻辑（问题7）

---

## 总结

当前的流式播放实现有**严重的性能和稳定性问题**，主要集中在：

1. **锁管理不当** - 导致性能崩塌
2. **错误处理不足** - 导致崩溃和内存泄漏  
3. **并发控制缺失** - 导致竞态条件
4. **功能实现错误** - seek完全不可用

**建议先修复P0问题，再逐步优化其他部分。**


