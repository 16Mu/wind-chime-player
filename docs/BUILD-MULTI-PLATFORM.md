# WindChime Player - 多平台构建指南

本文档详细说明如何为 macOS、Linux 和 Windows 构建 WindChime Player。

## 📋 目录

- [快速开始](#快速开始)
- [自动化构建 (推荐)](#自动化构建-推荐)
- [本地构建](#本地构建)
- [平台特定说明](#平台特定说明)
- [常见问题](#常见问题)

---

## 🚀 快速开始

### 方式 1: GitHub Actions (推荐)

最简单的方式是使用 GitHub Actions 自动构建所有平台：

```bash
# 推送标签触发正式发布
git tag v0.4.1
git push origin v0.4.1

# 或在 GitHub 网页上手动触发测试构建
```

### 方式 2: 本地构建

在对应的操作系统上运行构建脚本：

**macOS / Linux:**
```bash
chmod +x scripts/build-all-platforms.sh
./scripts/build-all-platforms.sh
```

**Windows:**
```powershell
.\scripts\build-all-platforms.ps1
```

---

## 🤖 自动化构建 (推荐)

### GitHub Actions Workflows

我们提供了两个 workflow：

#### 1. `build.yml` - 正式发布构建

触发条件：
- 推送以 `v` 开头的标签 (如 `v0.4.1`)
- 手动触发

功能：
- 同时构建 macOS、Linux、Windows 三个平台
- 自动创建 GitHub Release
- 上传所有平台的安装包

使用方法：
```bash
# 1. 更新版本号
# - package.json
# - src-tauri/tauri.conf.json
# - src-tauri/Cargo.toml

# 2. 提交更改
git add .
git commit -m "chore: bump version to 0.4.1"

# 3. 创建并推送标签
git tag v0.4.1
git push origin v0.4.1

# 4. 等待 GitHub Actions 完成构建
# 5. 在 Releases 页面查看并下载构建产物
```

#### 2. `test-build.yml` - 测试构建

触发条件：
- 仅手动触发

功能：
- 测试所有平台的构建是否正常
- 上传构建产物为 artifacts (保留 7 天)
- 不创建 Release

使用方法：
1. 访问 GitHub 仓库的 Actions 页面
2. 选择 "Test Build (All Platforms)"
3. 点击 "Run workflow"
4. 等待构建完成
5. 在 workflow 运行页面下载 artifacts

### 构建产物

各平台生成的文件：

| 平台 | 文件类型 | 位置 |
|------|---------|------|
| **macOS** | `.dmg` | `src-tauri/target/release/bundle/dmg/` |
| **macOS** | `.app` | `src-tauri/target/release/bundle/macos/` |
| **Linux** | `.deb` | `src-tauri/target/release/bundle/deb/` |
| **Linux** | `.AppImage` | `src-tauri/target/release/bundle/appimage/` |
| **Windows** | `.msi` | `src-tauri/target/release/bundle/msi/` |
| **Windows** | `.exe` (NSIS) | `src-tauri/target/release/bundle/nsis/` |

---

## 💻 本地构建

### 前置要求

所有平台都需要：
- **Node.js** 20+
- **pnpm** 8+
- **Rust** (通过 [rustup](https://rustup.rs/) 安装)

### macOS 构建

#### 系统要求
- macOS 10.13+ (High Sierra 或更高)
- Xcode Command Line Tools

#### 安装依赖
```bash
# 安装 Xcode Command Line Tools (如果还没有)
xcode-select --install

# 安装 pnpm (如果还没有)
npm install -g pnpm
```

#### 构建步骤
```bash
# 1. 安装依赖
pnpm install

# 2. 构建 (Universal Binary - 同时支持 Intel 和 Apple Silicon)
pnpm run tauri:build:macos

# 3. 查看构建产物
ls -lh src-tauri/target/release/bundle/dmg/
ls -lh src-tauri/target/release/bundle/macos/
```

#### macOS 特定配置

**代码签名 (可选):**
```bash
# 如果有 Apple Developer 账号，可以签名应用
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
pnpm run tauri:build:macos
```

**公证 (可选):**
```bash
# 需要 Apple ID 和应用专用密码
export APPLE_ID="your@email.com"
export APPLE_PASSWORD="app-specific-password"
pnpm run tauri:build:macos
```

### Linux 构建

#### 系统要求
- Ubuntu 20.04+ / Debian 10+ / 或其他主流 Linux 发行版
- 需要安装系统开发库

#### 安装依赖
```bash
# Ubuntu / Debian
sudo apt-get update
sudo apt-get install -y \
    libgtk-3-dev \
    libwebkit2gtk-4.0-dev \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf \
    libasound2-dev \
    libssl-dev \
    pkg-config

# Fedora / RHEL
sudo dnf install \
    gtk3-devel \
    webkit2gtk4.0-devel \
    libappindicator-gtk3-devel \
    librsvg2-devel \
    patchelf \
    alsa-lib-devel \
    openssl-devel

# Arch Linux
sudo pacman -S \
    gtk3 \
    webkit2gtk \
    libappindicator-gtk3 \
    librsvg \
    patchelf \
    alsa-lib \
    openssl
```

#### 构建步骤
```bash
# 1. 安装 pnpm (如果还没有)
npm install -g pnpm

# 2. 安装依赖
pnpm install

# 3. 构建
pnpm run tauri:build:linux

# 4. 查看构建产物
ls -lh src-tauri/target/release/bundle/deb/
ls -lh src-tauri/target/release/bundle/appimage/
```

#### 使 AppImage 可执行
```bash
chmod +x src-tauri/target/release/bundle/appimage/*.AppImage
```

### Windows 构建

#### 系统要求
- Windows 10/11
- Visual Studio 2019+ 或 Build Tools for Visual Studio (需要 C++ 工作负载)

#### 安装依赖
```powershell
# 1. 安装 Visual Studio Build Tools (如果还没有)
# 下载地址: https://visualstudio.microsoft.com/downloads/
# 安装时选择 "Desktop development with C++" 工作负载

# 2. 安装 Rust (如果还没有)
# 下载地址: https://rustup.rs/

# 3. 安装 pnpm (如果还没有)
npm install -g pnpm
```

#### 构建步骤
```powershell
# 1. 安装依赖
pnpm install

# 2. 构建
pnpm run tauri:build:windows

# 3. 查看构建产物
dir src-tauri\target\release\bundle\msi\
dir src-tauri\target\release\bundle\nsis\
```

---

## 🔧 平台特定说明

### macOS

#### Universal Binary
默认构建 Universal Binary，同时支持 Intel 和 Apple Silicon (M1/M2/M3)：
```bash
pnpm run tauri:build:macos
```

#### 仅构建特定架构
```bash
# 仅 Intel (x86_64)
tauri build --target x86_64-apple-darwin

# 仅 Apple Silicon (ARM64)
tauri build --target aarch64-apple-darwin
```

#### 绕过 Gatekeeper
用户首次打开未签名的应用时：
1. 右键点击应用
2. 选择"打开"
3. 在弹窗中点击"打开"

或者在终端中：
```bash
xattr -cr "/Applications/WindChime Player.app"
```

### Linux

#### 发行版兼容性

**DEB 包:**
- ✅ Ubuntu 20.04+
- ✅ Debian 10+
- ✅ Linux Mint 20+
- ✅ Pop!_OS 20.04+

**AppImage:**
- ✅ 几乎所有现代 Linux 发行版
- 需要 FUSE (通常已预装)

#### 桌面集成
```bash
# DEB 包会自动集成，AppImage 需要手动：
./WindChime_Player-*.AppImage --appimage-extract
sudo cp squashfs-root/usr/share/applications/*.desktop /usr/share/applications/
sudo cp squashfs-root/usr/share/icons/hicolor/256x256/apps/*.png /usr/share/icons/hicolor/256x256/apps/
```

### Windows

#### 安装器类型

**MSI (推荐用于企业部署):**
- Windows Installer 标准格式
- 支持静默安装
- 易于通过 GPO 部署

**NSIS (推荐用于个人用户):**
- 更小的文件大小
- 更友好的安装向导
- 自定义选项更多

#### 静默安装
```powershell
# MSI
msiexec /i "WindChime Player_0.4.1_x64_en-US.msi" /quiet

# NSIS
"WindChime Player_0.4.1_x64-setup.exe" /S
```

#### WebView2
Windows 版本依赖 Microsoft Edge WebView2：
- 安装器会自动下载 (如果不存在)
- 或手动安装：https://developer.microsoft.com/microsoft-edge/webview2/

---

## ❓ 常见问题

### Q: 为什么在 Windows 上无法构建 macOS/Linux 版本？

A: Tauri 使用平台原生组件，无法直接交叉编译。推荐使用 GitHub Actions 或在对应平台上构建。

### Q: 构建失败，提示缺少依赖？

A: 
- **Linux**: 确保安装了所有系统库 (见上方 Linux 安装依赖部分)
- **Windows**: 确保安装了 Visual Studio Build Tools
- **macOS**: 确保安装了 Xcode Command Line Tools

### Q: 构建很慢怎么办？

A: 
```bash
# 使用 debug 模式快速测试
pnpm run tauri:build:debug

# 首次构建会慢，之后 Rust 会缓存依赖
```

### Q: 如何减小安装包大小？

A: Release 构建已经优化过了。进一步优化：
```toml
# src-tauri/Cargo.toml
[profile.release]
opt-level = "z"     # 优化大小
lto = true          # 链接时优化
codegen-units = 1   # 最大化优化
strip = true        # 剥离符号
```

### Q: macOS 应用显示"已损坏"？

A: 这是因为未签名。解决方法：
```bash
xattr -cr "/Applications/WindChime Player.app"
```

### Q: Linux AppImage 无法运行？

A: 
```bash
# 添加执行权限
chmod +x WindChime_Player-*.AppImage

# 如果缺少 FUSE
sudo apt-get install fuse
```

### Q: 如何自定义应用图标？

A: 替换 `src-tauri/icons/` 目录下的图标文件，然后重新构建。

---

## 📚 更多资源

- [Tauri 官方文档](https://tauri.app/)
- [Tauri 构建指南](https://tauri.app/v1/guides/building/)
- [WindChime Player 项目主页](https://github.com/yourusername/wind-chime-player)

---

## 📝 版本历史

- **0.4.1** - 添加多平台构建支持
- **0.4.0** - 初始版本

---

**构建遇到问题？** 请在 [GitHub Issues](https://github.com/yourusername/wind-chime-player/issues) 提问。

