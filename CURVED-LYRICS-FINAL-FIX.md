# 曲线歌词 - 最终修复

## 修复时间
2025-11-16 02:21

## 问题汇总与解决

### 1. ✅ 默认参数调整

根据用户测试确认的最佳参数：

| 参数 | 旧值 | 新值 | 说明 |
|------|------|------|------|
| **专辑封面左边距** | 12vh | **25vh** | 用户测试确认的最佳位置 |
| **歌词水平偏移** | 0vw | **+17vw** | 用户测试确认的最佳偏移 |

#### 代码更新

```typescript
const DEFAULT_SETTINGS = {
  curvature: -0.4,
  lineRadius: 6,
  spacingFactor: 0.10,
  glowStrength: 0.50,
  maxWidthPercent: 0.65,
  albumPositionX: 25, // ← 改为 25vh
  lyricsOffsetX: 17,  // ← 改为 +17vw
};
```

### 2. ✅ 封面显示修复

**问题根源**：  
CurvedLyricsPanel 直接使用 `invoke('get_album_cover')`，未使用缓存系统。

**解决方案**：  
改用 `useCoverCache` hook，与 VinylLyricsCircular 保持一致。

#### 修复前
```typescript
// ❌ 直接调用 Tauri 命令
const coverUrl = await invoke<string | null>('get_album_cover', {
  trackId: currentTrack.id,
  track_id: currentTrack.id,
});
```

#### 修复后
```typescript
// ✅ 使用缓存系统
const { getAlbumCover, loadAlbumCover } = useCoverCache();

useEffect(() => {
  const albumKey = `${track.album}-${track.artist}`;
  const cachedCover = getAlbumCover(albumKey);
  
  if (cachedCover) {
    setAlbumCoverUrl(cachedCover);
    return;
  }

  loadAlbumCover(track.id, albumKey).then(url => {
    if (url) setAlbumCoverUrl(url);
  });
}, [track?.id, track?.album, track?.artist]);
```

### 3. ✅ 调试日志优化

添加了完整的封面加载日志链：

```
[CurvedLyricsPanel] 专辑Key: Album-Artist
[CurvedLyricsPanel] 缓存封面: null/data:image...
[CurvedLyricsPanel] 加载封面结果: data:image...
✅ 封面加载成功: data:image...
```

## 用户界面效果

### 默认布局（25vh + 17vw）

```
┌────────────────────────────────────────┐
│                                        │
│         🎵                             │
│      (25vh左)      歌词1               │
│                    歌词2 (17vw右偏)    │
│     专辑封面        歌词3              │
│                    ...                 │
│                                        │
└────────────────────────────────────────┘
```

### 设置侧边栏

```
┌──────────────────────────┬─────────────┐
│                          │ 设置侧边栏  │
│ 🎵 专辑封面              │             │
│                          │ 专辑左边距  │
│ 歌词1 (黄线显示)         │ [25vh] ←──┐ │
│ 歌词2                    │             │ │
│ 歌词3                    │ 歌词偏移    │ │
│                          │ [+17vw] ←─┘ │
│                          │             │
│                          │[恢复][完成] │
└──────────────────────────┴─────────────┘
```

## 封面缓存系统原理

### 工作流程

1. **检查缓存**
   ```typescript
   const albumKey = `${album}-${artist}`;
   const cached = getAlbumCover(albumKey);
   ```

2. **缓存命中** → 立即显示

3. **缓存未命中** → 加载并缓存
   ```typescript
   loadAlbumCover(trackId, albumKey).then(url => {
     // 自动存入缓存
     setAlbumCoverUrl(url);
   });
   ```

### 优势

- ✅ 避免重复请求
- ✅ 提升加载速度
- ✅ 减少后端压力
- ✅ 多组件共享缓存

## 验证步骤

### 1. 检查默认布局

1. 切换到曲线歌词模式
2. 专辑封面应该在屏幕左侧 **25vh** 处
3. 歌词应该向右偏移 **+17vw**

### 2. 检查封面显示

1. 打开开发者工具控制台
2. 查看日志：
   ```
   [CurvedLyricsPanel] 专辑Key: XXX-XXX
   [CurvedLyricsPanel] 缓存封面: data:image/...
   ✅ 封面加载成功: data:image/...
   ```
3. 封面应该正常显示，不再是纯黑

### 3. 检查设置调节

1. 移动鼠标 → 齿轮按钮出现
2. 点击齿轮 → 侧边栏滑出
3. 调节参数 → 实时预览
4. 黄线在侧边栏打开时显示

## 技术细节

### 封面URL格式

通常为 Base64 编码的 data URL：
```
data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA...
```

或文件路径（如果使用本地文件系统）：
```
asset://localhost/album_covers/...
```

### 缓存Key生成

```typescript
const albumKey = `${track.album || 'Unknown'}-${track.artist || 'Unknown'}`;
```

相同专辑+艺术家 = 相同Key = 共享缓存

## 已知问题

如果封面仍然不显示，可能原因：

1. **后端未返回封面数据**
   - 检查音频文件是否包含封面
   - 验证 Tauri 命令是否正常工作

2. **缓存系统未初始化**
   - 确保 `CoverCacheContext` 已在根组件提供

3. **图片格式不支持**
   - 检查控制台是否有图片加载错误
   - 验证Base64编码是否完整

## 下一步优化

- [ ] 添加封面加载失败的友好提示
- [ ] 支持自定义占位图
- [ ] 优化大封面的加载性能
- [ ] 添加封面缓存清理机制

---

**总结**：本次修复解决了默认布局参数和封面显示两个核心问题，使用户能够获得最佳的视觉体验。
