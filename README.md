# WindChime Player

> 🎵 现代化跨平台音乐播放器，采用 macOS 风格设计

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/tauri-2.0-blue.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/react-19-blue.svg)](https://reactjs.org/)

## 预览

<div align="center">
  <img src="920830cfa3481de365a0bf420af684df.png" alt="主界面" width="700"/>
  <p><i>主界面</i></p>
  
  <img src="f8103e1ed70f6754d0b16401233eb155.png" alt="沉浸式歌词" width="700"/>
  <p><i>沉浸式歌词</i></p>
</div>

## ✨ 特性

- 🎵 **智能播放** - 双引擎架构，零延迟 seek（< 10ms）
- 🎤 **沉浸式歌词** - 8种滚动动画，自动网络获取
- 📚 **音乐库管理** - 支持多格式，FTS5 全文搜索
- 📋 **智能歌单** - 导入导出（M3U/M3U8/JSON），智能规则
- 🌐 **WebDAV 支持** - 远程音乐流式播放
- 🎨 **macOS 风格** - iOS 蓝主色调，毛玻璃效果
- 🌓 **双主题** - 深色/浅色模式无缝切换
- 🎯 **艺术家封面** - 自动获取，智能缓存

## 🚀 快速开始

### 环境要求

- Node.js 16+
- Rust 1.70+
- pnpm（推荐）或 npm

### 安装

```bash
# 克隆项目
git clone https://github.com/16Mu/wind-chime-player.git
cd wind-chime-player

# 安装依赖
pnpm install

# 开发模式
pnpm tauri dev

# 构建应用
pnpm tauri build
```

## 🛠️ 技术栈

- **前端**: React 19 + TypeScript + Tailwind CSS
- **后端**: Rust + Tauri 2.0
- **音频**: Symphonia + Rodio + Web Audio API
- **数据库**: SQLite (FTS5)

## 📖 使用说明

1. **添加音乐** - 设置 → 音乐库 → 添加文件夹
2. **创建歌单** - 歌单 → 新建 → 添加歌曲
3. **歌词显示** - 点击歌词按钮进入沉浸式模式
4. **WebDAV** - 设置 → WebDAV → 配置服务器

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证

## 🙏 致谢

- [Tauri](https://tauri.app/) - 跨平台应用框架
- [LrcApi](https://github.com/HisAtri/LrcApi) - 歌词 API 服务

---

<div align="center">
  <sub>Built with ❤️ by 16Mu</sub>
</div>
