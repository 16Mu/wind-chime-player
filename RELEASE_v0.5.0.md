# WindChime Player v0.5.0 发布说明

## 🎉 重大更新

### ✨ Apple Music 风格动态背景

- **FBM 波浪背景**：基于 Fractional Brownian Motion 算法的动态流动背景
- **智能取色**：自动从专辑封面提取主色调，生成和谐的渐变效果
- **响应播放状态**：播放时动画加速，暂停时减慢
- **性能优化**：流畅的 60fps 动画效果

### 🎵 全新沉浸式歌词模式

#### 黑胶唱片模式
- 圆形旋转专辑封面（播放时自动旋转）
- 垂直滚动歌词显示
- 可调节专辑封面大小
- 支持窗口拖动

#### 曲线流动模式
- 可调节曲率的弧形歌词参考线
- 歌词沿曲线流动，垂直于参考线
- Apple Music 级推挤动画效果
- 支持模糊背景和多项自定义设置：
  - 曲率调节
  - 可见行数
  - 行间距
  - 发光强度
  - 专辑封面位置和大小

#### 其他歌词模式
- 🎬 电影模式 - 宽幅视频背景风格
- 🃏 卡片模式 - 居中卡片布局
- ✨ 极简模式 - 纯背景单行诗意歌词
- 📺 左右分屏模式 - 传统布局

### 🎨 视觉增强

- **动态光斑**：随音乐律动的光斑效果
- **粒子系统**：浮动粒子增强视觉层次感
- **渐变遮罩**：平滑的色彩过渡，消除色彩断层
- **Apple Music 推挤动画**：当前行主动快速进入，上一行延迟退出

### 📦 性能优化

- **音频缓存系统**：
  - LRU 缓存算法
  - 可配置缓存大小（100MB - 2GB）
  - 自动清理过期缓存
  - 缓存统计和监控
  
- **封面加载优化**：
  - 延迟加载专辑封面
  - 虚拟滚动骨架屏
  - 智能预加载机制

### 🔧 WebDAV 改进

- **中文路径支持**：修复中文文件名乱码问题
- **渐进式下载**：边下载边播放
- **连接优化**：更稳定的远程连接

## 🐛 问题修复

- 修复歌词显示偶尔卡顿的问题
- 修复专辑封面加载失败时的白屏问题
- 优化内存使用，减少内存泄漏
- 修复 WebDAV 中文路径无法访问的问题

## 📋 更新内容

- 96 个文件修改
- 新增 12,356 行代码
- 删除 2,478 行代码

## 📖 文档更新

- 新增 `FBM-WAVE-IMPLEMENTATION.md` - 动态背景实现说明
- 新增 `CURVED-LYRICS-FEATURE.md` - 曲线歌词功能说明
- 更新 `README.md` - 添加新功能介绍
- 更新 `BUILD.md` - 完善构建指南

## 🚀 快速开始

### 下载安装

**Windows**:
- `WindChime-Player_0.5.0_x64-setup.exe` - NSIS 安装程序（推荐）
- `WindChime-Player_0.5.0_x64_en-US.msi` - MSI 安装程序

**macOS**:
- `WindChime-Player_0.5.0_x64.dmg` - DMG 安装包

**Linux**:
- `wind-chime-player_0.5.0_amd64.deb` - Debian/Ubuntu
- `wind-chime-player_0.5.0_amd64.AppImage` - AppImage

### 从源码构建

```bash
# 克隆项目
git clone https://github.com/16Mu/wind-chime-player.git
cd wind-chime-player

# 安装依赖
pnpm install

# 开发运行
pnpm tauri dev

# 生产构建
pnpm tauri build
```

## 💡 使用提示

1. **切换歌词模式**：在播放页面点击歌词区域，选择不同的显示模式
2. **调整曲线歌词**：在曲线模式下，点击右下角设置按钮可调节各项参数
3. **启用缓存**：在设置页面启用音频缓存，提升播放流畅度
4. **WebDAV 配置**：支持坚果云、Seafile 等 WebDAV 服务

## 🙏 致谢

感谢以下项目和贡献者：
- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [Symphonia](https://github.com/pdeljanov/Symphonia) - Rust 音频解码库
- [applemusic-like-lyrics](https://github.com/Steve-xmh/applemusic-like-lyrics) - FBM 背景效果参考
- 所有提出建议和反馈的用户

## 📝 下一步计划

- [ ] Android 移动端开发
- [ ] 歌单同步功能
- [ ] 更多歌词动画效果
- [ ] 均衡器和音效
- [ ] 桌面歌词

---

完整更新日志：[CHANGELOG.md](./CHANGELOG.md)

问题反馈：[GitHub Issues](https://github.com/16Mu/wind-chime-player/issues)
