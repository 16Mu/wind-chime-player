# WindChime Player v0.4.1 Release Notes

🎉 **发布日期**: 2025-10-07

## 🌟 主要更新

### 🚀 混合播放引擎
- ✅ **创新架构** - Rust 原生引擎 + Web Audio API 双引擎设计
- ✅ **零延迟 Seek** - Web Audio API 实现内存级 seek（< 10ms）
- ✅ **智能切换** - 自动检测并平滑切换引擎，用户无感知
- ✅ **双层 Ref 模式** - 解决 React 闭包问题，实现稳定的函数引用

### 🎨 macOS 风格设计升级
- ✅ **iOS 蓝主色调** - 完全对齐 Apple Music 视觉语言（#007AFF）
- ✅ **毛玻璃效果** - 标题栏和播放器使用 backdrop-filter 半透明背景
- ✅ **高对比度优化** - 浅色模式采用纯黑文字（#000000），提升可读性
- ✅ **macOS 标准灰度** - 采用 Apple 设计系统标准配色

### 🔍 智能设置搜索
- ✅ **模糊搜索** - 支持多词搜索，智能匹配设置项
- ✅ **实时下拉** - 搜索结果实时显示，关键词高亮
- ✅ **智能跳转** - 点击结果自动切换 Tab 并平滑滚动定位
- ✅ **琥珀色高亮** - 目标设置项琥珀色高亮标记（3秒动画）

### ⚡ 专辑/艺术家视图优化
- ✅ **现代化网格布局** - 参考 Apple Music 设计风格
- ✅ **性能优化** - 虚拟滚动、懒加载、智能预加载
- ✅ **视觉改进** - 优化卡片阴影、间距、悬停效果

### 🐛 播放器核心修复
- ✅ **暂停功能** - 修复点击"下一首"后无法暂停的问题
- ✅ **Seek 功能** - 修复"下一首"后 seek 失效的问题
- ✅ **状态同步** - 播放按钮立即响应，不再延迟
- ✅ **进度条更新** - 使用 requestAnimationFrame，60fps 流畅更新
- ✅ **引擎切换** - 状态平滑过渡，不会出现混乱
- ✅ **播放记录** - 自动刷新、统计数据优化
- ✅ **歌词显示** - 修复 seek 后歌词为空的问题

### 🪟 窗口体验优化
- ✅ **最小尺寸设置** - 防止窗口过小影响使用
- ✅ **响应式宽度** - 侧边栏自适应宽度调整
- ✅ **拖动性能优化** - 减少重绘，提升流畅度

### ⚠️ WebDAV 功能
- ⚠️ **已完整实现** - 前后端功能完整，但未进行完整测试验证
- 📋 **后续版本** - 将进行全面测试和完善

## 📦 下载

### Windows
- [WindChime Player v0.4.1 (NSIS 安装程序)](需要上传安装包)
- [WindChime Player v0.4.1 (MSI 安装程序)](需要上传安装包)

### macOS
- [WindChime Player v0.4.1 (DMG)](需要上传安装包)
- [WindChime Player v0.4.1 (Universal)](需要上传安装包)

### Linux
- [WindChime Player v0.4.1 (DEB)](需要上传安装包)
- [WindChime Player v0.4.1 (AppImage)](需要上传安装包)

## 🛠️ 技术栈

- **前端**: React 19 + TypeScript + Tailwind CSS
- **后端**: Rust + Tauri 2.0
- **音频**: Symphonia + Rodio + Web Audio API
- **数据库**: SQLite (FTS5)

## 📊 代码统计

- **TypeScript**: 56.7%
- **Rust**: 31.3%
- **CSS**: 11.4%
- **Other**: 0.6%

## 🙏 致谢

- **Tauri 社区** - 强大的跨平台应用框架
- **Rust 开源社区** - symphonia, rodio 等优秀的音频处理库
- **MDN Web Audio API 文档** - 详细的技术文档支持
- **[LrcApi](https://github.com/HisAtri/LrcApi)** - 公开的歌词和封面 API 服务
- **January** - UI/UX 审查专家，视觉优化建议

## 📝 完整更新日志

查看 [CHANGELOG](https://github.com/16Mu/wind-chime-player/blob/master/README.md#-更新日志)

## 🐛 已知问题

- WebDAV 功能未进行完整测试

## 🔗 相关链接

- [GitHub 仓库](https://github.com/16Mu/wind-chime-player)
- [构建指南](https://github.com/16Mu/wind-chime-player/blob/master/BUILD.md)
- [问题反馈](https://github.com/16Mu/wind-chime-player/issues)

---

**WindChime Player** - 让音乐如风铃般轻盈悦耳 🎵


