# WebDAV 功能开发说明

## 📋 当前状态

WebDAV 远程音乐源功能暂时隐藏，显示"正在开发"占位页面。

## 🔧 如何恢复功能

### 1. 恢复 WebDAVSettings 组件

**文件**: `src/components/settings/WebDAVSettings.tsx`

**操作**: 
- 删除当前的占位代码（第1-48行）
- 取消注释完整功能代码（第50行之后的注释块）

或者直接从 Git 历史记录恢复：
```bash
git checkout HEAD~1 -- src/components/settings/WebDAVSettings.tsx
```

### 2. 更新设置页面标签

**文件**: `src/components/SettingsPageNew.tsx`

**操作**: 
- 找到第58行的注释 `// 🚧 WebDAV 功能开发中，暂时注释`
- 移除第61行标签中的 ` 🚧` 标记

**修改前**:
```typescript
{ 
  id: 'webdav', 
  label: '远程音乐源 🚧',  // <- 移除 🚧
  emoji: '📻',
  icon: '...' 
},
```

**修改后**:
```typescript
{ 
  id: 'webdav', 
  label: '远程音乐源',
  emoji: '📻',
  icon: '...' 
},
```

### 3. 相关文件清单

以下文件包含 WebDAV 功能，已保持不变，无需修改：

- ✅ `src/contexts/RemoteSourceContext.tsx` - 远程源上下文
- ✅ `src/components/remote/FileBrowser.tsx` - 文件浏览器
- ✅ `src/components/RemoteScanButton.tsx` - 扫描按钮
- ✅ `src-tauri/src/webdav/` - 后端 WebDAV 实现

## 📦 后端配置

后端配置已大幅简化：

**文件**: `src-tauri/src/config/webdav_config.rs`

```rust
pub struct WebDAVServerConfig {
    pub name: String,
    pub url: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub enabled: bool,
}
```

已删除的复杂配置：
- ❌ 认证类型枚举
- ❌ 网络配置
- ❌ 重试配置
- ❌ 缓存配置
- ❌ 同步配置
- ❌ 文件过滤配置
- ❌ 服务器类型枚举

## 🎯 开发优先级

1. **核心功能** (必须)
   - [ ] WebDAV 连接和认证
   - [ ] 文件列表获取
   - [ ] 流式播放

2. **辅助功能** (可选)
   - [ ] 连接状态检查
   - [ ] 缓存管理
   - [ ] 自动同步

3. **高级功能** (后期)
   - [ ] 多服务器支持
   - [ ] 离线缓存
   - [ ] 智能预加载

## 💡 提示

- 所有被注释的代码都保留在文件中，确保不丢失
- 前端组件保持完整，只是显示占位页面
- 后端 API 已简化，减少过度设计
- Git 历史记录中保留了所有原始代码

## 📞 联系方式

如有问题，请查阅：
- Git 提交历史
- 备份文件
- 本文档的更新日志

---

**最后更新**: 2025-10-04
**修改人**: AI Assistant
**版本**: v1.0


