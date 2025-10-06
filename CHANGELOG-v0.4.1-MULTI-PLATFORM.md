# WindChime Player v0.4.1 - 多平台支持更新

## 📅 发布日期
2025-10-06

## 🎉 新增功能

### 🌍 跨平台构建支持

WindChime Player 现已全面支持 **Windows、macOS 和 Linux** 三大主流平台！

#### ✨ 主要特性

1. **完整的平台支持**
   - ✅ Windows (x64) - MSI + NSIS 安装包
   - ✅ macOS (Universal Binary) - DMG + APP，同时支持 Intel 和 Apple Silicon
   - ✅ Linux (x64) - DEB + AppImage，支持主流发行版

2. **自动化构建系统**
   - ✅ GitHub Actions workflow 自动化构建
   - ✅ 一键构建所有平台
   - ✅ 自动发布到 GitHub Releases
   - ✅ 测试构建和正式发布分离

3. **本地构建工具**
   - ✅ 平台特定构建脚本
   - ✅ 自动依赖检查
   - ✅ 详细的构建日志
   - ✅ Windows PowerShell 和 Bash 脚本支持

4. **完善的文档**
   - ✅ 详细的多平台构建指南
   - ✅ 各平台特定说明
   - ✅ 常见问题解答
   - ✅ 故障排除指南

## 📦 生成的安装包

### Windows
- **MSI 安装包** - 企业级部署，支持静默安装
- **NSIS 安装包** - 用户友好的安装向导
- 自动下载 WebView2 运行时
- 支持中文/英文安装界面

### macOS
- **DMG 磁盘映像** - 标准 macOS 安装方式
- **APP 应用包** - 可直接拖放到应用程序文件夹
- Universal Binary - 同时支持 Intel 和 Apple Silicon (M1/M2/M3)
- 最低系统要求: macOS 10.13 (High Sierra)

### Linux
- **DEB 包** - 适用于 Ubuntu、Debian、Linux Mint 等
- **AppImage** - 开箱即用，兼容所有现代 Linux 发行版
- 自动打包所有依赖
- 支持桌面集成

## 🚀 使用方法

### 方式 1: GitHub Actions 自动构建 (推荐)

```bash
# 创建并推送标签
git tag v0.4.1
git push origin v0.4.1

# GitHub Actions 会自动构建所有平台并发布
```

### 方式 2: 手动触发测试构建

1. 访问 GitHub 仓库的 Actions 页面
2. 选择 "Test Build (All Platforms)"
3. 点击 "Run workflow"
4. 下载构建产物

### 方式 3: 本地构建

**Windows:**
```powershell
.\scripts\build-all-platforms.ps1
```

**macOS / Linux:**
```bash
chmod +x scripts/build-all-platforms.sh
./scripts/build-all-platforms.sh
```

## 📁 新增文件

```
wind-chime-player/
├── .github/
│   └── workflows/
│       ├── build.yml              # 正式发布 workflow
│       └── test-build.yml         # 测试构建 workflow
├── scripts/
│   ├── build-all-platforms.sh    # macOS/Linux 构建脚本
│   └── build-all-platforms.ps1   # Windows 构建脚本
├── docs/
│   └── BUILD-MULTI-PLATFORM.md   # 详细构建文档
├── BUILD.yml                      # 快速构建说明
└── CHANGELOG-v0.4.1-MULTI-PLATFORM.md  # 本文档
```

## 🔧 技术实现

### Tauri 配置更新

在 `src-tauri/tauri.conf.json` 中添加了平台特定配置：

```json
{
  "bundle": {
    "macOS": {
      "minimumSystemVersion": "10.13",
      "frameworks": [],
      "entitlements": null
    },
    "linux": {
      "deb": {
        "depends": []
      },
      "appimage": {
        "bundleMediaFramework": true
      }
    }
  }
}
```

### 构建脚本

- **Bash 脚本**: 支持 macOS 和 Linux，自动检测系统依赖
- **PowerShell 脚本**: Windows 专用，自动检查 Node.js、Rust 等依赖
- **GitHub Actions**: 矩阵构建策略，并行构建三个平台

### 平台特定优化

#### macOS
- Universal Binary 构建 - 单个安装包支持所有 Mac
- 使用 `universal-apple-darwin` target
- 包含 `.icns` 图标

#### Linux
- 使用 `x86_64-unknown-linux-gnu` target
- AppImage 内置媒体框架
- DEB 自动处理依赖关系

#### Windows
- 保持现有配置不变
- 使用 `x86_64-pc-windows-msvc` target
- 支持 MSI 和 NSIS 双格式

## 📖 文档更新

### README.md
- ✅ 添加跨平台支持说明
- ✅ 更新构建与打包章节
- ✅ 添加平台徽章
- ✅ 链接到详细文档

### BUILD-MULTI-PLATFORM.md (新增)
- ✅ 完整的构建指南
- ✅ 平台特定说明
- ✅ 常见问题解答
- ✅ 故障排除

### package.json
- ✅ 添加平台特定构建命令
  - `tauri:build:macos`
  - `tauri:build:linux`
  - `tauri:build:windows`

## 🎯 构建产物位置

### macOS
```
src-tauri/target/release/bundle/dmg/*.dmg
src-tauri/target/release/bundle/macos/*.app
```

### Linux
```
src-tauri/target/release/bundle/deb/*.deb
src-tauri/target/release/bundle/appimage/*.AppImage
```

### Windows
```
src-tauri/target/release/bundle/msi/*.msi
src-tauri/target/release/bundle/nsis/*.exe
```

## ⚠️ 注意事项

### 交叉编译限制
- **不支持**从 Windows 构建 macOS/Linux 版本
- **不支持**从 Linux 构建 macOS 版本
- **推荐**使用 GitHub Actions 进行多平台构建

### 系统依赖

**Linux 构建需要:**
```bash
sudo apt-get install -y \
  libgtk-3-dev \
  libwebkit2gtk-4.0-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libasound2-dev
```

**macOS 构建需要:**
- Xcode Command Line Tools

**Windows 构建需要:**
- Visual Studio Build Tools (C++ 工作负载)

## 🐛 已知问题

暂无

## 🔜 未来计划

- [ ] ARM Linux 支持
- [ ] 32位系统支持
- [ ] Flatpak 和 Snap 包
- [ ] macOS 代码签名和公证
- [ ] Windows 代码签名

## 📊 兼容性

### Windows
- ✅ Windows 10 (x64)
- ✅ Windows 11 (x64)

### macOS
- ✅ macOS 10.13 High Sierra 及更高版本
- ✅ Intel Mac
- ✅ Apple Silicon (M1/M2/M3)

### Linux
- ✅ Ubuntu 20.04+
- ✅ Debian 10+
- ✅ Linux Mint 20+
- ✅ Pop!_OS 20.04+
- ✅ Fedora 35+
- ✅ Arch Linux (最新版)
- ✅ 其他现代发行版 (通过 AppImage)

## 💡 使用建议

1. **个人用户**: 推荐使用 GitHub Actions 自动构建
2. **开发者**: 在本地对应平台进行测试构建
3. **企业部署**: 使用 MSI (Windows) 或 DEB (Linux) 进行批量部署
4. **便携使用**: 使用 AppImage (Linux) 无需安装

## 🙏 致谢

感谢 Tauri 社区提供的优秀跨平台框架，使得多平台支持变得如此简单！

---

**WindChime Player** - 真正的跨平台音乐播放器 🎵

