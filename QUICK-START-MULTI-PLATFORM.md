# 🚀 多平台构建 - 快速开始

## 方式 1: GitHub Actions 自动构建 (推荐) ⭐

### 测试构建
1. 推送代码到 GitHub
2. 访问 **Actions** 页面
3. 选择 **"Test Build (All Platforms)"**
4. 点击 **"Run workflow"**
5. 等待构建完成，下载 Artifacts

### 正式发布
```bash
# 创建版本标签
git tag v0.4.1
git push origin v0.4.1

# 自动触发构建，产物会发布到 GitHub Releases
```

---

## 方式 2: 本地构建

### Windows
```powershell
.\scripts\build-all-platforms.ps1
```

### macOS / Linux
```bash
chmod +x scripts/build-all-platforms.sh
./scripts/build-all-platforms.sh
```

---

## 构建产物位置

### Windows
```
src-tauri/target/x86_64-pc-windows-msvc/release/bundle/
├── msi/WindChime Player_0.4.1_x64_en-US.msi
└── nsis/WindChime Player_0.4.1_x64-setup.exe
```

### macOS
```
src-tauri/target/release/bundle/
├── dmg/WindChime Player_0.4.1_x64.dmg
└── macos/WindChime Player.app
```

### Linux
```
src-tauri/target/release/bundle/
├── deb/windchime_0.4.1_amd64.deb
└── appimage/WindChime_Player_0.4.1_amd64.AppImage
```

---

## 📖 详细文档

- **完整指南**: [docs/BUILD-MULTI-PLATFORM.md](docs/BUILD-MULTI-PLATFORM.md)
- **配置报告**: [docs/MULTI-PLATFORM-SETUP-COMPLETE.md](docs/MULTI-PLATFORM-SETUP-COMPLETE.md)
- **更新日志**: [CHANGELOG-v0.4.1-MULTI-PLATFORM.md](CHANGELOG-v0.4.1-MULTI-PLATFORM.md)

---

**就这么简单！** 🎉

