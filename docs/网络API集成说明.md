# 网络API集成说明 - LrcApi

## 📝 概述

WindChime Player 现已集成 [LrcApi](https://github.com/HisAtri/LrcApi) 公开API服务，提供歌词和封面的网络获取功能。

## 🌐 API来源

- **项目地址**: https://github.com/HisAtri/LrcApi
- **API端点**: https://api.lrc.cx
- **类型**: 公开API（无需认证）
- **许可**: GPL-3.0
- **使用方式**: 仅调用公开服务，无需遵守GPL协议

## ✨ 功能特性

### 1. 歌词获取

**降级策略**：
1. 优先从音频文件内嵌元数据提取
2. 查找音频文件同目录的 `.lrc` 文件
3. 如果以上都没有，**自动从网络API获取**

**使用方式**：
- 在歌词管理器中点击"从网络获取"按钮
- 系统自动使用歌曲的标题、艺术家、专辑信息查询

### 2. 封面获取

**降级策略**：
1. 优先从音频文件内嵌元数据提取
2. 查找音频文件同目录的封面图片文件
3. 如果以上都没有，**自动从网络API获取**

**使用方式**：
- 系统自动降级，用户无需手动操作
- 使用艺术家和专辑信息查询

## 🔧 技术实现

### 后端 (Rust)

**文件**: `src-tauri/src/network_api.rs`

```rust
// 网络API服务
pub struct NetworkApiService {
    client: reqwest::Client,
    base_url: String,
}

// Tauri命令
network_fetch_lyrics(title, artist, album) -> (String, String)
network_fetch_cover(title, artist, album) -> (Vec<u8>, String, String)
```

### 前端 (TypeScript)

**文件**: `src/services/networkApiService.ts`

```typescript
// 获取歌词
export async function fetchLyricsFromNetwork(
  title: string,
  artist: string,
  album?: string
): Promise<NetworkLyricsResult | null>

// 获取封面
export async function fetchCoverFromNetwork(
  artist: string,
  title?: string,
  album?: string
): Promise<NetworkCoverResult | null>
```

### 封面服务增强

**文件**: `src/services/albumCoverService.ts`

```typescript
// 增强的封面提供者（支持网络API降级）
export class EnhancedAlbumCoverProvider implements AlbumCoverProvider {
  async getCoverData(trackId: number): Promise<CoverData | null> {
    // 1. 本地提取
    // 2. 网络API（如果本地没有）
  }
}
```

## 📊 API使用示例

### 歌词API

**请求**：
```
GET https://api.lrc.cx/lyrics?title=告白气球&artist=周杰伦&album=周杰伦的床边故事
```

**响应**：LRC格式歌词文本

### 封面API

**请求**：
```
GET https://api.lrc.cx/cover?artist=周杰伦&album=周杰伦的床边故事
```

**响应**：图片二进制数据

## ⚠️ 注意事项

### 1. 网络依赖
- 需要互联网连接才能使用网络API
- 离线模式下自动跳过网络查询
- 不会影响本地提取功能

### 2. 速率限制
- 公开API可能存在速率限制
- 建议优先使用本地数据
- 网络API仅作为降级方案

### 3. 数据准确性
- 网络API通过歌曲信息匹配
- 准确性取决于元数据质量
- 建议确保歌曲标题和艺术家信息准确

### 4. 隐私考虑
- 网络查询会发送歌曲信息到第三方服务器
- 不会上传音频文件本身
- 仅发送必要的元数据（标题、艺术家、专辑）

## 🔒 许可声明

### 使用方式
我们**仅调用 LrcApi 的公开API服务**，不涉及源代码的使用、修改或分发。

根据网络服务的使用原则：
- ✅ **无需遵守GPL-3.0协议**（仅适用于源代码）
- ✅ **无需开源WindChime Player**
- ✅ **可自由使用API服务**

### 致谢
在 README.md 中已添加对 LrcApi 项目的致谢：
```markdown
- [LrcApi](https://github.com/HisAtri/LrcApi) - 提供公开的歌词和封面API服务
```

## 🚀 使用指南

### 用户使用

1. **歌词管理**
   - 打开歌词管理器（点击歌词区域）
   - 点击"从网络获取"按钮
   - 系统自动查询并填充歌词

2. **封面获取**
   - 系统自动在后台查询
   - 无需用户手动操作
   - 优先使用本地数据

### 开发者使用

```typescript
// 手动获取歌词
import { fetchLyricsFromNetwork } from '@/services/networkApiService';

const lyrics = await fetchLyricsFromNetwork('告白气球', '周杰伦', '周杰伦的床边故事');
if (lyrics) {
  console.log(lyrics.content); // LRC格式歌词
  console.log(lyrics.source);  // "LrcApi"
}

// 手动获取封面
import { fetchCoverFromNetwork, convertCoverDataToUrl } from '@/services/networkApiService';

const cover = await fetchCoverFromNetwork('周杰伦', '告白气球', '周杰伦的床边故事');
if (cover) {
  const url = convertCoverDataToUrl(cover.data, cover.mimeType);
  // 使用 url 显示封面
}
```

## 📈 未来计划

- [ ] 添加网络API设置开关（允许用户禁用）
- [ ] 支持多个API源（备用API）
- [ ] 缓存网络获取的数据到数据库
- [ ] 添加网络请求重试机制
- [ ] 统计网络API使用情况

## 🤝 贡献

欢迎贡献代码改进网络API集成功能！

---

**更新时间**: 2025-10-06  
**版本**: v0.4.0+






