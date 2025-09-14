# WindChime Player 仓库手册快照

生成时间: 2025-09-14

本文件用于记录当前仓库的重要信息（结构、依赖、配置、关键接口等），便于后续更新后进行差异对比。

## 基本信息

- 名称: WindChime Player
- 版本: 0.1.0
- 标识: com.ggbond.windchime
- 技术栈: Tauri 2 · Rust · React 19 · TypeScript · Tailwind CSS · Vite 6

## 脚本与构建

- 前端脚本（package.json）
  - dev: vite
  - build: tsc && vite build
  - preview: vite preview
  - tauri: tauri
- Tauri 构建（src-tauri/tauri.conf.json）
  - beforeDevCommand: pnpm run dev
  - devUrl: http://localhost:1420
  - beforeBuildCommand: pnpm run build
  - frontendDist: ../dist

## 目录结构（关键）

```
wind-chime-player/
├── dist/                     # 前端构建产物
├── src/                      # 前端源码（React + TS）
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   └── components/
│       ├── LibraryPage.tsx
│       ├── PlaylistPlayer.tsx
│       ├── PlaylistManager.tsx
│       ├── MusicFolderManager.tsx
│       ├── FavoritesView.tsx
│       ├── ExplorePage.tsx
│       ├── ImmersiveLyricsView.tsx
│       ├── LyricsDisplay.tsx
│       ├── LyricsManager.tsx
│       ├── Sidebar.tsx
│       ├── AlbumsView.tsx
│       ├── ArtistsView.tsx
│       └── TracksView.tsx
├── src-tauri/                # Rust 后端 + Tauri 配置
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── player.rs
│       ├── library.rs
│       ├── lyrics.rs
│       └── db.rs
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

## 前端依赖（package.json）

- dependencies
  - @tauri-apps/api ^2
  - @tauri-apps/plugin-dialog ^2.4.0
  - @tauri-apps/plugin-opener ^2
  - @types/react ^19.1.12
  - @types/react-dom ^19.1.9
  - @vitejs/plugin-react ^5.0.2
  - autoprefixer ^10.4.0
  - postcss ^8.4.0
  - react ^19.1.1
  - react-dom ^19.1.1
  - tailwindcss ^3.4.0
- devDependencies
  - @tauri-apps/cli ^2
  - @types/node ^22.18.1
  - typescript ~5.6.2
  - vite ^6.0.3

## Rust 依赖（src-tauri/Cargo.toml）

- build-dependencies
  - tauri-build = "2"
- dependencies
  - tauri = "2"
  - tauri-plugin-opener = "2"
  - tauri-plugin-dialog = "2"
  - serde = "1" （features: derive）
  - serde_json = "1"
  - symphonia = "0.5" （features: all-formats, all-codecs）
  - rodio = "0.19" （features: flac, wav, vorbis, mp3, symphonia-all）
  - cpal = "0.15"
  - rusqlite = "0.32" （features: bundled）
  - crossbeam-channel = "0.5"
  - tokio = "1" （features: full）
  - lofty = "0.21"
  - anyhow = "1.0"
  - log = "0.4"
  - env_logger = "0.11"
  - regex = "1.10"
  - encoding_rs = "0.8"

## Tauri 配置摘要（src-tauri/tauri.conf.json）

- $schema: https://schema.tauri.app/config/2
- productName: windchime
- version: 0.1.0
- identifier: com.ggbond.windchime
- app.windows[0]
  - title: "WindChime Player"
  - width: 1200, height: 800, minWidth: 800, minHeight: 600
  - decorations: false, resizable: true, transparent: false, dragDropEnabled: false
- app.security.csp: null
- bundle.targets: all
- bundle.icon: icons/32x32.png, 128x128.png, 128x128@2x.png, icon.icns, icon.ico

## 前端入口与主要页面

- 入口: `index.html` → `src/main.tsx` → `src/App.tsx`
- 页面/视图（通过 `App.tsx` 切换）
  - explore: `ExplorePage`
  - library: `LibraryPage`
  - playlist: `PlaylistManager`
  - favorite: `FavoritesView`
  - genres: 预留
  - settings: 设置页（含音乐库管理、调试工具、动画与可访问性等）

## Tauri 后端指令（invoke handlers 分类）

- 播放器 Player
  - player_play, player_pause, player_resume, player_stop
  - player_next, player_previous, player_seek
  - player_set_volume, player_set_repeat, player_set_shuffle
  - player_load_playlist
- 播放列表生成
  - generate_sequential_playlist, generate_random_playlist, load_playlist_by_mode
- 音乐库 Library
  - library_scan, library_get_tracks, library_search, library_get_stats, library_rescan_covers
  - library_get_music_folders, library_delete_folder
- 歌词 Lyrics
  - lyrics_get, lyrics_parse, lyrics_save, lyrics_delete
  - lyrics_search_file, lyrics_load_file, lyrics_extract_from_metadata
  - lyrics_search_comprehensive, lyrics_validate
  - lyrics_parse_srt, lyrics_parse_ass, lyrics_parse_vtt, lyrics_auto_detect
- 收藏 Favorites
  - favorites_add, favorites_remove, favorites_is_favorite, favorites_get_all
  - favorites_toggle, favorites_get_count
- 播放列表 Playlists
  - playlists_list, playlists_create, playlists_delete
  - playlists_add_track, playlists_remove_track, playlists_get_tracks
- 窗口控制
  - minimize_window, toggle_maximize, close_window
- 音频调试
  - check_audio_devices, debug_audio_system
- 其他
  - get_album_cover, test_library_stats

合计命令数（近似）: 50+

## 关键模块职责（Rust）

- player.rs: 播放器核心（Rodio/CPAL），播放控制、进度更新、音量/循环/随机、seek 与播放列表管理
- library.rs: 音乐库扫描（Lofty 提取元数据、封面），数据库读写，搜索与统计
- lyrics.rs: 歌词解析（LRC/SRT/ASS/VTT/纯文本/编码识别），文件与元数据检索
- db.rs: SQLite 数据访问层（曲目、封面、歌词、收藏、播放列表等）
- lib.rs: Tauri 命令聚合、全局状态、事件分发、初始化流程
- main.rs: 启动入口（调用 `windchime_lib::run()`）

## Vite 与 TS 配置要点

- Vite: 端口 1420（严格），HMR 在 devhost 存在时使用 ws:1421，忽略监视 `src-tauri/**`
- TypeScript: strict 打开，`noUnusedLocals/Parameters` 打开，`moduleResolution: bundler`，`include: src`，排除 `src-tauri`

## Tailwind 配置要点

- 扫描路径: `index.html`, `src/**/*.{js,ts,jsx,tsx}`
- 自定义主题: 颜色（accent、text-*、surface-*、border-*），字体（primary/mono），字号与行高，backdropBlur、shadow、动画（fade-in/slide-up）

## 截图与文档

- README.md 包含两张界面截图与详细功能说明
- 图像: 顶部两张 PNG（主界面、歌词视图）

## 其他备注

- `src-tauri/capabilities/default.json` 存在，权限策略遵循最小化原则（详见 README 合规章节）
- `dist/` 产物与 `node_modules/` 已存在（当前快照时）
- git 状态（初始会话快照）显示存在未跟踪文件：`tatus --porcelain` 与 `设定.md`

---

以上为当前仓库的基线快照。后续如有修改，将以本文件为参照进行差异对比与更新记录。


