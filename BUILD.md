# WindChime Player 构建指南

本文档详细说明如何构建和打包 WindChime Player。

## 📋 环境要求

### 必需工具

| 工具 | 最低版本 | 推荐版本 | 说明 |
|------|---------|---------|------|
| **Node.js** | 16.x | 20.x LTS | JavaScript 运行时 |
| **pnpm** | 8.x | 最新版 | 包管理器 |
| **Rust** | 1.70+ | 最新稳定版 | Rust 工具链 |
| **Tauri CLI** | 2.0+ | 最新版 | 自动安装 |

### 平台特定要求

#### Windows
- **WebView2**: 自动下载安装（首次运行时）
- **Visual Studio**: 推荐安装 Visual Studio 2022 或 Build Tools
  - 必需组件：C++ 构建工具、Windows 10/11 SDK
- **NSIS**: 用于创建安装程序（可选，Tauri 会自动处理）

#### macOS
- **Xcode**: 最新版本
- **Xcode Command Line Tools**: `xcode-select --install`

#### Linux
- **依赖包**（以 Ubuntu/Debian 为例）：
  ```bash
  sudo apt update
  sudo apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
  ```

## 🚀 安装依赖

### 1. 克隆项目

```bash
git clone https://github.com/16Mu/wind-chime-player.git
cd wind-chime-player
```

### 2. 安装 pnpm（如果未安装）

```bash
# 使用 npm 安装
npm install -g pnpm

# 或使用 Corepack（Node.js 16.13+）
corepack enable
corepack prepare pnpm@latest --activate
```

### 3. 安装项目依赖

```bash
# 安装前端依赖
pnpm install

# Rust 依赖会在首次构建时自动安装
```

## 🛠️ 开发构建

### 启动开发服务器

```bash
# 开发模式（热重载）
pnpm tauri dev

# 或使用
pnpm tauri:dev
```

开发服务器启动后：
- 前端：`http://localhost:1420`
- 热重载：自动检测文件更改
- DevTools：自动打开

### 仅前端开发

```bash
# 只启动 Vite 开发服务器
pnpm dev
```

## 📦 生产构建

### Windows 平台

#### 标准构建

```bash
# 构建生产版本
pnpm tauri build

# 或使用
pnpm tauri:build
```

构建输出位置：
```
src-tauri/target/release/
├── WindChime Player.exe           # 可执行文件
└── bundle/
    ├── nsis/
    │   └── WindChime Player_0.4.1_x64-setup.exe  # NSIS 安装程序
    └── msi/
        └── WindChime Player_0.4.1_x64_en-US.msi  # MSI 安装程序
```

#### 自定义构建选项

```bash
# 调试构建（包含调试符号）
pnpm tauri build --debug

# 指定目标架构
pnpm tauri build --target x86_64-pc-windows-msvc

# 只构建 exe，不打包安装程序
pnpm tauri build --bundles none
```

#### 安装程序特性

**NSIS 安装程序** 包含：
- ✅ 中文/英文双语界面
- ✅ 用户级安装（无需管理员权限）
- ✅ 自动创建桌面快捷方式
- ✅ 开始菜单快捷方式
- ✅ 自动下载 WebView2 运行时
- ✅ 卸载程序

**MSI 安装程序** 包含：
- ✅ 企业部署支持
- ✅ 静默安装选项
- ✅ 完整的卸载支持

### macOS 平台

```bash
# 构建 DMG 安装包
pnpm tauri build

# 构建 App Bundle
pnpm tauri build --bundles app

# 签名和公证（需要 Apple Developer 账号）
pnpm tauri build --bundles dmg --sign
```

构建输出：
```
src-tauri/target/release/bundle/
├── dmg/
│   └── WindChime Player_0.4.1_x64.dmg
└── macos/
    └── WindChime Player.app
```

#### 代码签名

1. **配置签名证书**：
   ```bash
   # 在 src-tauri/tauri.conf.json 中配置
   {
     "bundle": {
       "macOS": {
         "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)"
       }
     }
   }
   ```

2. **公证应用**：
   ```bash
   # 需要配置 Apple ID 和应用专用密码
   xcrun notarytool submit "WindChime Player_0.4.1_x64.dmg" \
     --apple-id "your@email.com" \
     --password "app-specific-password" \
     --team-id "TEAM_ID"
   ```

### Linux 平台

```bash
# 构建 DEB 包（Debian/Ubuntu）
pnpm tauri build --bundles deb

# 构建 AppImage
pnpm tauri build --bundles appimage

# 构建 RPM 包（Fedora/RHEL）
pnpm tauri build --bundles rpm
```

构建输出：
```
src-tauri/target/release/bundle/
├── deb/
│   └── wind-chime-player_0.4.1_amd64.deb
├── appimage/
│   └── wind-chime-player_0.4.1_amd64.AppImage
└── rpm/
    └── wind-chime-player-0.4.1-1.x86_64.rpm
```

## 🔧 构建配置

### 修改应用版本

1. **更新 package.json**：
   ```json
   {
     "version": "0.4.1"
   }
   ```

2. **更新 src-tauri/tauri.conf.json**：
   ```json
   {
     "version": "0.4.1"
   }
   ```

3. **更新 src-tauri/Cargo.toml**：
   ```toml
   [package]
   version = "0.4.1"
   ```

### 自定义图标

替换以下文件：
```
src-tauri/icons/
├── 32x32.png       # Windows 任务栏图标
├── 128x128.png     # Windows 应用图标
├── icon.icns       # macOS 图标
├── icon.ico        # Windows 图标
└── icon.png        # Linux 图标
```

### 修改安装程序

编辑 `src-tauri/tauri.conf.json`：

```json
{
  "bundle": {
    "identifier": "com.windchime.player",
    "publisher": "WindChime Team",
    "shortDescription": "现代化音乐播放器",
    "longDescription": "WindChime Player 是一款现代化的跨平台音乐播放器...",
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "",
      "wix": {
        "language": "zh-CN"
      }
    }
  }
}
```

## 🐛 常见问题

### Windows

#### 问题：构建失败，提示缺少 MSVC

**解决方案**：
```bash
# 安装 Visual Studio Build Tools
# https://visualstudio.microsoft.com/downloads/
# 选择"使用 C++ 的桌面开发"工作负载
```

#### 问题：WebView2 未安装

**解决方案**：
安装程序会自动下载。手动安装：
```bash
# 下载 WebView2 Runtime
# https://developer.microsoft.com/microsoft-edge/webview2/
```

### macOS

#### 问题：无法打开应用（"已损坏"提示）

**解决方案**：
```bash
# 移除隔离属性
xattr -cr "WindChime Player.app"

# 或在系统偏好设置中允许"任何来源"
sudo spctl --master-disable
```

### Linux

#### 问题：缺少依赖库

**解决方案**：
```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.0-dev

# Fedora
sudo dnf install webkit2gtk4.0-devel

# Arch Linux
sudo pacman -S webkit2gtk
```

### 所有平台

#### 问题：Rust 编译错误

**解决方案**：
```bash
# 更新 Rust 工具链
rustup update stable

# 清理构建缓存
cd src-tauri
cargo clean
cd ..
pnpm tauri build
```

#### 问题：前端构建失败

**解决方案**：
```bash
# 清理依赖
rm -rf node_modules pnpm-lock.yaml

# 重新安装
pnpm install

# 清理 Vite 缓存
rm -rf .vite
```

## 📊 构建优化

### 减小包体积

1. **启用 Rust 优化**（已在 Cargo.toml 中配置）：
   ```toml
   [profile.release]
   opt-level = "z"     # 优化体积
   lto = true          # 链接时优化
   codegen-units = 1   # 单线程编译
   strip = true        # 移除调试符号
   ```

2. **Tree-shaking**（Vite 自动处理）

3. **压缩资源**

### 加速构建

```bash
# 使用增量编译
export CARGO_INCREMENTAL=1

# 使用并行编译
export CARGO_BUILD_JOBS=8

# 使用缓存
export CARGO_TARGET_DIR=~/.cargo-target
```

## 🚢 发布流程

### 1. 更新版本号

```bash
# 同时更新所有版本号
npm version patch  # 或 minor, major
```

### 2. 构建所有平台

```bash
# Windows
pnpm tauri build

# macOS
pnpm tauri build --target universal-apple-darwin

# Linux
pnpm tauri build --bundles deb,appimage
```

### 3. 创建 Release

```bash
# 创建 Git 标签
git tag v0.4.1
git push origin v0.4.1

# 上传到 GitHub Releases
# 附上所有平台的安装包
```

### 4. 自动化构建（GitHub Actions）

参考 `.github/workflows/build.yml`（待创建）

## 📝 构建日志

构建日志位置：
- **Windows**: `src-tauri/target/release/build/`
- **macOS**: `src-tauri/target/release/build/`
- **Linux**: `src-tauri/target/release/build/`

## 🔗 相关资源

- [Tauri 官方文档](https://tauri.app/v1/guides/)
- [Vite 构建指南](https://vitejs.dev/guide/build.html)
- [Rust 构建优化](https://doc.rust-lang.org/cargo/reference/profiles.html)

---

如有问题，请提交 [Issue](https://github.com/16Mu/wind-chime-player/issues)


