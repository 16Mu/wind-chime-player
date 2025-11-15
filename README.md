# WindChime Player

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.4.1-blue.svg)](https://github.com/16Mu/wind-chime-player)
[![Tauri](https://img.shields.io/badge/tauri-2.0-blue.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/react-19-blue.svg)](https://reactjs.org/)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue.svg)](https://github.com/16Mu/wind-chime-player)

> 🎵 现代化 Windows 与 macOS 音乐播放器，采用 macOS 风格设计，支持本地与 WebDAV 音乐库，提供沉浸式歌词体验。

## ✨ 特性

WindChime Player 是一款 Windows 与 macOS 桌面音乐播放器，延续 macOS 风格与细腻动效。支持本地与 WebDAV 音乐库，内置高性能播放引擎与沉浸式歌词，专注稳定、轻快、好用。

### 🎨 视觉体验
- **Apple Music 风格背景**：动态流动的 FBM 波浪背景，自动提取专辑封面主色调
- **多种沉浸式歌词模式**：
  - 🎵 黑胶唱片模式 - 旋转专辑封面 + 垂直滚动歌词
  - 🌊 曲线流动模式 - 可调曲率的弧形歌词展示
  - 🎬 电影模式、卡片模式、极简模式等
- **深浅色主题**：自适应系统主题，毛玻璃效果
- **流畅动画**：60fps 丝滑过渡，Apple Music 级推挤动画

### 🎵 播放功能
- **高性能引擎**：基于 Rust Symphonia + Rodio，启动迅速
- **格式支持**：FLAC、MP3、WAV、AAC、OGG 等常见格式
- **精准定位**：滑动进度条流畅无卡顿
- **智能歌词**：自动匹配网络歌词，支持原文+译文双语显示

### 📚 音乐管理
- **本地音乐库**：快速扫描、专辑封面自动提取
- **WebDAV 支持**：远程音乐库，渐进式下载播放
- **智能搜索**：全文搜索歌曲、艺术家、专辑
- **播放历史**：记录播放轨迹，快速回放

## Build & Run

当前支持 Windows 与 macOS 构建与运行。

**环境要求**
- Node.js 18+、PNPM
- Rust 工具链（Tauri CLI 会自动安装依赖）

**本地开发**
```bash
pnpm install
pnpm tauri dev
```

**生产构建**
```bash
pnpm tauri build
```

## 📖 文档

- **更新日志**：`CHANGELOG.md` - 版本更新记录
- **构建说明**：`BUILD.md` - 详细的构建步骤
- **特性说明**：
  - `FBM-WAVE-IMPLEMENTATION.md` - Apple Music 风格动态背景实现
  - `CURVED-LYRICS-FEATURE.md` - 曲线歌词功能说明
- **Issues & 计划**：<https://github.com/16Mu/wind-chime-player>

## Contributing

欢迎通过 Issue / PR 参与改进：
1. Fork 仓库并创建功能分支
2. 安装依赖：`pnpm install`
3. 开发调试：`pnpm tauri dev`
4. 提交 PR 并说明测试情况

代码规范：Rust 使用 `cargo fmt` / `cargo clippy`，前端使用 Prettier。

## Acknowledgements

感谢以下社区与贡献者提供支持：
- **Tauri 社区**：跨平台桌面应用框架
- **Rust 音频生态**：Symphonia、Rodio 等音频处理库
- **MDN Web Audio**：Web Audio API 技术文档
- **[LrcApi](https://github.com/HisAtri/LrcApi)**：歌词与封面网络服务
- **January**：UI/UX 审查与视觉优化建议

## License

WindChime Player 采用 MIT License，详见 `LICENSE`。
