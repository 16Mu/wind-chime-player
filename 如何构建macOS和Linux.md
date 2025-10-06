# 🚀 如何构建 macOS 和 Linux 版本

## ⚠️ 重要提示

从 Windows 无法直接构建 macOS 和 Linux 版本（技术限制）。

**解决方案：使用 GitHub Actions 自动构建** ✅

---

## 📋 步骤 1: 手动触发测试构建（推荐）

### 1.1 访问 GitHub Actions
打开浏览器，访问：
```
https://github.com/16Mu/wind-chime-player/actions
```

### 1.2 选择 Workflow
在左侧列表中，点击 **"Test Build (All Platforms)"**

### 1.3 运行构建
1. 点击右上角的 **"Run workflow"** 按钮
2. 确认分支选择为 **master**
3. 点击绿色的 **"Run workflow"** 确认

### 1.4 等待构建
- 构建时间：约 15-30 分钟
- 会同时构建 3 个平台：Windows、macOS、Linux
- 可以实时查看构建日志

### 1.5 下载安装包
构建完成后：
1. 点击刚才的 workflow 运行记录
2. 滚动到页面底部，找到 **"Artifacts"** 区域
3. 下载：
   - **macOS-build-xxxxx** - 包含 .dmg 和 .app
   - **Linux-build-xxxxx** - 包含 .deb 和 .AppImage
   - **Windows-build-xxxxx** - 包含 .msi 和 .exe

---

## 📋 步骤 2: 推送标签自动发布（正式版）

当测试构建成功后，可以创建正式发布：

### 2.1 创建标签（在本地 Windows 上）

打开 PowerShell，运行：

```powershell
# 创建版本标签
git tag v0.4.1

# 推送标签到 GitHub
git push origin v0.4.1
```

### 2.2 自动触发构建
- 推送标签后会自动触发 "Build and Release" workflow
- 同时构建所有平台
- 构建完成后自动创建 GitHub Release
- 所有安装包会自动上传到 Release

### 2.3 查看 Release
访问：
```
https://github.com/16Mu/wind-chime-player/releases
```

找到 v0.4.1，下载对应平台的安装包。

---

## 📦 生成的安装包

### macOS
- ✅ `WindChime Player_0.4.1_x64.dmg` - DMG 安装镜像
- ✅ `WindChime Player.app.tar.gz` - APP 应用包
- 📌 Universal Binary（同时支持 Intel 和 Apple Silicon）

### Linux
- ✅ `windchime_0.4.1_amd64.deb` - Debian/Ubuntu 安装包
- ✅ `WindChime_Player_0.4.1_amd64.AppImage` - 通用 AppImage
- 📌 支持大多数 Linux 发行版

### Windows
- ✅ `WindChime Player_0.4.1_x64_en-US.msi` - MSI 安装包
- ✅ `WindChime Player_0.4.1_x64-setup.exe` - NSIS 安装程序

---

## 🔍 查看构建进度

### 实时监控
1. 访问 Actions 页面
2. 点击正在运行的 workflow
3. 展开各个平台的构建日志
4. 查看实时输出

### 构建状态
- 🟡 **黄色** - 构建中
- ✅ **绿色** - 构建成功
- ❌ **红色** - 构建失败（查看日志排查）

---

## ❓ 常见问题

### Q: 为什么不能在 Windows 上直接构建 macOS？
A: Tauri 使用平台原生组件，macOS 需要 WebKit，Linux 需要 GTK，这些只能在对应系统上编译。

### Q: 构建需要多长时间？
A: 首次构建约 20-30 分钟（需要下载依赖），后续构建 10-15 分钟（有缓存）。

### Q: 构建失败怎么办？
A: 
1. 查看构建日志找到错误信息
2. 常见问题通常是依赖版本不兼容
3. 可以在 GitHub Issues 中提问

### Q: 如何测试构建的应用？
A: 
- **macOS**: 需要 Mac 电脑下载安装包测试
- **Linux**: 可以使用虚拟机或 WSL2 测试
- **Windows**: 可以直接在本地测试

### Q: 构建产物保留多久？
A: 
- **Artifacts**: 保留 7 天
- **Release**: 永久保留

---

## 🎯 推荐流程

### 开发阶段
1. 在本地 Windows 上开发和测试
2. 推送代码到 GitHub
3. 手动触发 "Test Build" 验证所有平台

### 发布阶段
1. 确认测试构建成功
2. 更新版本号
3. 创建并推送标签
4. 等待自动发布到 Releases

---

## 📝 下一步

1. ✅ 访问 https://github.com/16Mu/wind-chime-player/actions
2. ✅ 运行 "Test Build (All Platforms)"
3. ✅ 等待构建完成
4. ✅ 下载并测试安装包
5. ✅ 成功后创建正式版本标签

---

**就是这样！通过 GitHub Actions，您可以轻松构建所有平台的版本！** 🎉

有任何问题，请查看 `docs/BUILD-MULTI-PLATFORM.md` 获取更详细的说明。

