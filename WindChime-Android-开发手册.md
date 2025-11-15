# WindChime Player Android 开发手册

> **版本**: v1.0  
> **创建日期**: 2025-10-07  
> **项目类型**: 音乐播放器 Android 原生应用  
> **目标平台**: Android 8.0+ (API 26+)

---

## 📑 目录

1. [项目概述](#项目概述)
2. [技术栈说明](#技术栈说明)
3. [项目结构](#项目结构)
4. [架构设计](#架构设计)
5. [开发路线图](#开发路线图)
6. [关键模块实现](#关键模块实现)
7. [团队协作](#团队协作)
8. [质量保证](#质量保证)

---

## 📖 项目概述

### 项目背景

WindChime Player 原为跨平台桌面应用（Windows/macOS/Linux），采用 Tauri + React + Rust 技术栈。现需移植到 Android 平台，提供原生移动端体验。

### 核心需求

| 需求类别 | 具体要求 |
|---------|---------|
| **性能要求** | Seek 延迟 < 50ms，UI 60fps+ |
| **动画要求** | 一镜到底，共享元素转场 |
| **音频引擎** | 支持 MP3/FLAC/WAV/AAC/OGG |
| **主题系统** | Material You + 深浅色切换 |
| **后台播放** | 锁屏控制、通知栏媒体控制 |

### 项目目标

- ✅ **性能**：完全解决桌面版的 Seek 延迟问题（800ms → 50ms）
- ✅ **体验**：现代化 Material Design 3 UI
- ✅ **稳定**：无崩溃、无内存泄漏
- ✅ **美观**：一镜到底动画，流畅过渡

---

## 🛠 技术栈说明

### 完整技术栈

```
┌─────────────────────────────────────────┐
│          技术栈配置                      │
├─────────────────────────────────────────┤
│ 语言:    Kotlin 100%                    │
│ UI:      Jetpack Compose 1.6.0+        │
│ 设计:    Material Design 3              │
│ 架构:    MVVM + Clean Architecture      │
│ 音频:    ExoPlayer + Media3             │
│ 数据库:  Room + SQLite                  │
│ 网络:    Retrofit + OkHttp              │
│ 图片:    Coil                           │
│ DI:      Hilt                           │
│ 并发:    Kotlin Coroutines + Flow       │
└─────────────────────────────────────────┘
```

### 核心库版本

```gradle
// app/build.gradle.kts
dependencies {
    // Compose
    implementation("androidx.compose.ui:ui:1.6.0")
    implementation("androidx.compose.material3:material3:1.2.0")
    implementation("androidx.compose.animation:animation:1.6.0")
    
    // Architecture Components
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation("androidx.navigation:navigation-compose:2.7.0")
    
    // ExoPlayer (音频引擎)
    implementation("androidx.media3:media3-exoplayer:1.2.0")
    implementation("androidx.media3:media3-session:1.2.0")
    implementation("androidx.media3:media3-ui:1.2.0")
    
    // Room (数据库)
    implementation("androidx.room:room-runtime:2.6.0")
    implementation("androidx.room:room-ktx:2.6.0")
    kapt("androidx.room:room-compiler:2.6.0")
    
    // Retrofit (网络)
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    
    // Coil (图片加载)
    implementation("io.coil-kt:coil-compose:2.5.0")
    
    // Hilt (依赖注入)
    implementation("com.google.dagger:hilt-android:2.48")
    kapt("com.google.dagger:hilt-compiler:2.48")
    implementation("androidx.hilt:hilt-navigation-compose:1.1.0")
    
    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    
    // DataStore
    implementation("androidx.datastore:datastore-preferences:1.0.0")
}
```

### 为什么选择这个技术栈？

| 技术 | 选择理由 | 替代方案 |
|------|---------|---------|
| **Kotlin** | Google 官方首选，简洁现代 | Java（过时）|
| **Jetpack Compose** | 声明式 UI，开发效率高 5 倍 | XML（繁琐）|
| **ExoPlayer** | Google 官方音频引擎，性能最优 | MediaPlayer（功能受限）|
| **Hilt** | Google 官方 DI，集成简单 | Dagger 2（复杂）|
| **Coil** | Kotlin 原生，Compose 友好 | Glide（Java 风格）|

---

## 📂 项目结构

### 完整目录结构

```
WindChimeAndroid/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/windchime/player/
│   │   │   │   │
│   │   │   │   ├── presentation/              # UI 层
│   │   │   │   │   ├── screens/              # 页面
│   │   │   │   │   │   ├── library/          # 音乐库模块
│   │   │   │   │   │   │   ├── LibraryScreen.kt
│   │   │   │   │   │   │   ├── LibraryViewModel.kt
│   │   │   │   │   │   │   ├── LibraryUiState.kt
│   │   │   │   │   │   │   └── LibraryEvent.kt
│   │   │   │   │   │   │
│   │   │   │   │   │   ├── player/           # 播放器模块
│   │   │   │   │   │   │   ├── PlayerScreen.kt
│   │   │   │   │   │   │   ├── MiniPlayer.kt
│   │   │   │   │   │   │   ├── FullScreenPlayer.kt
│   │   │   │   │   │   │   └── PlayerViewModel.kt
│   │   │   │   │   │   │
│   │   │   │   │   │   ├── playlist/         # 歌单模块
│   │   │   │   │   │   │   ├── PlaylistListScreen.kt
│   │   │   │   │   │   │   ├── PlaylistDetailScreen.kt
│   │   │   │   │   │   │   └── PlaylistViewModel.kt
│   │   │   │   │   │   │
│   │   │   │   │   │   ├── albums/           # 专辑模块
│   │   │   │   │   │   │   ├── AlbumsScreen.kt
│   │   │   │   │   │   │   ├── AlbumDetailScreen.kt
│   │   │   │   │   │   │   └── AlbumsViewModel.kt
│   │   │   │   │   │   │
│   │   │   │   │   │   ├── artists/          # 艺术家模块
│   │   │   │   │   │   ├── lyrics/           # 歌词模块
│   │   │   │   │   │   └── settings/         # 设置模块
│   │   │   │   │   │
│   │   │   │   │   ├── components/           # 可复用组件
│   │   │   │   │   │   ├── TrackListItem.kt
│   │   │   │   │   │   ├── AlbumCard.kt
│   │   │   │   │   │   ├── PlayerControls.kt
│   │   │   │   │   │   └── SearchBar.kt
│   │   │   │   │   │
│   │   │   │   │   ├── theme/                # 主题系统
│   │   │   │   │   │   ├── Color.kt
│   │   │   │   │   │   ├── Theme.kt
│   │   │   │   │   │   ├── Type.kt
│   │   │   │   │   │   └── Shape.kt
│   │   │   │   │   │
│   │   │   │   │   └── navigation/           # 导航管理
│   │   │   │   │       ├── NavGraph.kt
│   │   │   │   │       ├── NavigationRoute.kt
│   │   │   │   │       └── AnimatedTransitions.kt
│   │   │   │   │
│   │   │   │   ├── domain/                   # 领域层
│   │   │   │   │   ├── model/               # 领域模型
│   │   │   │   │   │   ├── Track.kt
│   │   │   │   │   │   ├── Album.kt
│   │   │   │   │   │   ├── Artist.kt
│   │   │   │   │   │   ├── Playlist.kt
│   │   │   │   │   │   └── Lyrics.kt
│   │   │   │   │   │
│   │   │   │   │   ├── repository/          # 仓库接口
│   │   │   │   │   │   ├── MusicRepository.kt
│   │   │   │   │   │   ├── PlaylistRepository.kt
│   │   │   │   │   │   ├── LyricsRepository.kt
│   │   │   │   │   │   └── SettingsRepository.kt
│   │   │   │   │   │
│   │   │   │   │   └── usecase/             # 用例
│   │   │   │   │       ├── music/
│   │   │   │   │       │   ├── GetTracksUseCase.kt
│   │   │   │   │       │   ├── SearchTracksUseCase.kt
│   │   │   │   │       │   └── GetAlbumsUseCase.kt
│   │   │   │   │       ├── player/
│   │   │   │   │       │   ├── PlayTrackUseCase.kt
│   │   │   │   │       │   ├── PausePlaybackUseCase.kt
│   │   │   │   │       │   └── SeekToPositionUseCase.kt
│   │   │   │   │       └── playlist/
│   │   │   │   │           ├── CreatePlaylistUseCase.kt
│   │   │   │   │           └── AddTrackToPlaylistUseCase.kt
│   │   │   │   │
│   │   │   │   ├── data/                     # 数据层
│   │   │   │   │   ├── repository/          # 仓库实现
│   │   │   │   │   │   ├── MusicRepositoryImpl.kt
│   │   │   │   │   │   ├── PlaylistRepositoryImpl.kt
│   │   │   │   │   │   └── LyricsRepositoryImpl.kt
│   │   │   │   │   │
│   │   │   │   │   ├── source/              # 数据源
│   │   │   │   │   │   ├── local/          # 本地数据源
│   │   │   │   │   │   │   ├── MusicDatabase.kt
│   │   │   │   │   │   │   ├── dao/
│   │   │   │   │   │   │   │   ├── TrackDao.kt
│   │   │   │   │   │   │   │   ├── AlbumDao.kt
│   │   │   │   │   │   │   │   └── PlaylistDao.kt
│   │   │   │   │   │   │   ├── entity/
│   │   │   │   │   │   │   │   ├── TrackEntity.kt
│   │   │   │   │   │   │   │   ├── AlbumEntity.kt
│   │   │   │   │   │   │   │   └── PlaylistEntity.kt
│   │   │   │   │   │   │   └── LocalMusicDataSource.kt
│   │   │   │   │   │   │
│   │   │   │   │   │   └── remote/         # 远程数据源
│   │   │   │   │   │       ├── api/
│   │   │   │   │   │       │   ├── LrcApiService.kt
│   │   │   │   │   │       │   └── WebDavService.kt
│   │   │   │   │   │       ├── dto/
│   │   │   │   │   │       │   ├── LyricsDto.kt
│   │   │   │   │   │       │   └── AlbumCoverDto.kt
│   │   │   │   │   │       └── RemoteMusicDataSource.kt
│   │   │   │   │   │
│   │   │   │   │   └── mapper/              # 数据转换器
│   │   │   │   │       ├── TrackMapper.kt
│   │   │   │   │       ├── AlbumMapper.kt
│   │   │   │   │       └── PlaylistMapper.kt
│   │   │   │   │
│   │   │   │   ├── player/                   # 播放器模块
│   │   │   │   │   ├── ExoPlayerManager.kt
│   │   │   │   │   ├── PlaybackService.kt
│   │   │   │   │   ├── MediaSessionManager.kt
│   │   │   │   │   ├── NotificationManager.kt
│   │   │   │   │   └── PlayerState.kt
│   │   │   │   │
│   │   │   │   ├── di/                       # 依赖注入
│   │   │   │   │   ├── AppModule.kt
│   │   │   │   │   ├── DatabaseModule.kt
│   │   │   │   │   ├── NetworkModule.kt
│   │   │   │   │   ├── RepositoryModule.kt
│   │   │   │   │   └── PlayerModule.kt
│   │   │   │   │
│   │   │   │   ├── util/                     # 工具类
│   │   │   │   │   ├── Constants.kt
│   │   │   │   │   ├── Extensions.kt
│   │   │   │   │   ├── FileUtils.kt
│   │   │   │   │   └── PermissionUtils.kt
│   │   │   │   │
│   │   │   │   └── MainActivity.kt           # 主活动
│   │   │   │
│   │   │   ├── res/                          # 资源文件
│   │   │   │   ├── drawable/
│   │   │   │   ├── mipmap/
│   │   │   │   ├── values/
│   │   │   │   │   ├── colors.xml
│   │   │   │   │   ├── strings.xml
│   │   │   │   │   └── themes.xml
│   │   │   │   └── xml/
│   │   │   │
│   │   │   └── AndroidManifest.xml
│   │   │
│   │   └── test/                             # 测试
│   │       ├── java/
│   │       └── resources/
│   │
│   └── build.gradle.kts                      # 模块构建配置
│
├── gradle/                                    # Gradle 配置
├── build.gradle.kts                          # 项目构建配置
├── settings.gradle.kts                       # 项目设置
└── gradle.properties                         # Gradle 属性
```

### 模块职责说明

| 模块 | 职责 | 依赖方向 |
|------|------|---------|
| **presentation** | UI 展示、用户交互 | → domain |
| **domain** | 业务逻辑、用例 | 独立（不依赖其他层）|
| **data** | 数据访问、存储 | → domain（实现接口）|
| **player** | 音频播放控制 | → domain |
| **di** | 依赖注入配置 | → 所有模块 |

---

## 🏗 架构设计

### Clean Architecture 分层

```
┌─────────────────────────────────────────────┐
│         Presentation Layer (UI 层)          │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Screen  │  │ViewModel │  │  Theme   │  │
│  └─────────┘  └──────────┘  └──────────┘  │
└──────────────────┬──────────────────────────┘
                   │ StateFlow / Events
┌──────────────────▼──────────────────────────┐
│          Domain Layer (领域层)               │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  │
│  │ UseCase │  │  Model   │  │Repository│  │
│  │         │  │          │  │Interface │  │
│  └─────────┘  └──────────┘  └──────────┘  │
└──────────────────┬──────────────────────────┘
                   │ Business Logic
┌──────────────────▼──────────────────────────┐
│           Data Layer (数据层)                │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  │
│  │Repository  │ Local    │  │ Remote   │  │
│  │   Impl  │  │DataSource│  │DataSource│  │
│  └─────────┘  └──────────┘  └──────────┘  │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│        Platform Layer (平台层)               │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  │
│  │ExoPlayer│  │  Room    │  │ Retrofit │  │
│  └─────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────┘
```

### 数据流向

```
用户操作 → Screen → Event → ViewModel → UseCase → Repository → DataSource
                     ↓                              ↓              ↓
                   State ← ViewModel ← Flow ← Repository ← Database/API
                     ↓
                  Screen (UI更新)
```

### 关键设计原则

1. **依赖倒置**：内层定义接口，外层实现
2. **单一职责**：每个类只做一件事
3. **开闭原则**：对扩展开放，对修改关闭
4. **接口隔离**：使用小而专注的接口
5. **依赖注入**：通过 Hilt 管理依赖

---

## 🗺 开发路线图

### 总体时间规划

```
总计：14-18 周（3.5-4.5 个月）

Phase 1: 基础框架       2 周
Phase 2: 核心功能       4-5 周
Phase 3: 高级功能       3-4 周
Phase 4: UI/动画        3-4 周
Phase 5: 测试优化       2-3 周
```

---

### Phase 1: 基础框架搭建（Week 1-2）

#### 目标
建立项目基础架构，配置开发环境

#### 任务清单

**Week 1: 项目初始化**

- [ ] **Day 1-2: 环境配置**
  ```bash
  # 1. 创建 Android 项目
  - 安装 Android Studio
  - 创建 Empty Compose Activity 项目
  - 配置 Gradle
  
  # 2. 添加依赖
  - 配置 Compose
  - 配置 Hilt
  - 配置 Room
  - 配置 Retrofit
  ```

- [ ] **Day 3-4: 基础架构**
  ```kotlin
  // 创建目录结构
  - presentation/
  - domain/
  - data/
  - di/
  
  // 配置依赖注入
  @HiltAndroidApp
  class WindChimeApp : Application()
  ```

- [ ] **Day 5: 主题系统**
  ```kotlin
  // 实现 Material Design 3 主题
  - Color.kt
  - Theme.kt
  - Type.kt
  ```

**Week 2: 导航和数据库**

- [ ] **Day 1-2: 导航系统**
  ```kotlin
  // 实现 Navigation Compose
  @Composable
  fun NavGraph(navController: NavHostController) {
      NavHost(
          navController = navController,
          startDestination = "library"
      ) {
          composable("library") { LibraryScreen() }
          composable("player") { PlayerScreen() }
      }
  }
  ```

- [ ] **Day 3-5: 数据库设计**
  ```kotlin
  // Room 数据库
  @Database(entities = [TrackEntity::class, AlbumEntity::class], version = 1)
  abstract class MusicDatabase : RoomDatabase() {
      abstract fun trackDao(): TrackDao
      abstract fun albumDao(): AlbumDao
  }
  
  // DAO 接口
  @Dao
  interface TrackDao {
      @Query("SELECT * FROM tracks")
      fun getAllTracks(): Flow<List<TrackEntity>>
  }
  ```

**交付物：**
- ✅ 可运行的空白应用
- ✅ 基础架构完成
- ✅ 导航系统就绪
- ✅ 数据库配置完成

---

### Phase 2: 核心功能实现（Week 3-7）

#### 目标
实现音频播放、音乐库管理等核心功能

#### Week 3-4: 音频播放引擎

- [ ] **ExoPlayer 集成**
  ```kotlin
  // PlayerManager 实现
  @Singleton
  class ExoPlayerManager @Inject constructor(
      @ApplicationContext private val context: Context
  ) {
      private val player = ExoPlayer.Builder(context)
          .setAudioAttributes(audioAttributes, true)
          .build()
      
      fun play(track: Track) {
          val mediaItem = MediaItem.fromUri(track.path)
          player.setMediaItem(mediaItem)
          player.prepare()
          player.play()
      }
  }
  ```

- [ ] **MediaService 实现**
  ```kotlin
  @AndroidEntryPoint
  class PlaybackService : MediaLibraryService() {
      @Inject lateinit var playerManager: PlayerManager
      
      override fun onGetSession(
          controllerInfo: MediaSession.ControllerInfo
      ): MediaSession = mediaSession
  }
  ```

- [ ] **播放控制 UseCase**
  ```kotlin
  class PlayTrackUseCase @Inject constructor(
      private val playerManager: PlayerManager,
      private val repository: MusicRepository
  ) {
      suspend operator fun invoke(track: Track) {
          playerManager.play(track)
          repository.recordPlayHistory(track)
      }
  }
  ```

**交付物：**
- ✅ 基础音频播放功能
- ✅ 后台播放服务
- ✅ MediaSession 集成

#### Week 5: 音乐库管理

- [ ] **文件扫描**
  ```kotlin
  class ScanMusicFilesUseCase @Inject constructor(
      private val repository: MusicRepository
  ) {
      suspend operator fun invoke(directory: String): Result<List<Track>> {
          // 扫描指定目录的音频文件
          // 提取元数据（标题、艺术家、专辑等）
          // 保存到数据库
      }
  }
  ```

- [ ] **音乐库 UI**
  ```kotlin
  @Composable
  fun LibraryScreen(viewModel: LibraryViewModel = hiltViewModel()) {
      val tracks by viewModel.tracks.collectAsState()
      
      LazyColumn {
          items(tracks) { track ->
              TrackListItem(
                  track = track,
                  onClick = { viewModel.onTrackClick(track) }
              )
          }
      }
  }
  ```

**交付物：**
- ✅ 音频文件扫描功能
- ✅ 音乐库列表展示
- ✅ 基础播放控制

#### Week 6-7: 专辑和艺术家

- [ ] **专辑视图**
  ```kotlin
  @Composable
  fun AlbumsScreen() {
      LazyVerticalGrid(columns = GridCells.Fixed(2)) {
          items(albums) { album ->
              AlbumCard(album = album)
          }
      }
  }
  ```

- [ ] **艺术家视图**
  ```kotlin
  @Composable
  fun ArtistsScreen() {
      // 艺术家列表
      // 点击进入艺术家详情
  }
  ```

**交付物：**
- ✅ 专辑网格视图
- ✅ 艺术家列表视图
- ✅ 详情页面

---

### Phase 3: 高级功能（Week 8-11）

#### Week 8-9: 歌单系统

- [ ] **歌单 CRUD**
  ```kotlin
  class CreatePlaylistUseCase @Inject constructor(
      private val repository: PlaylistRepository
  ) {
      suspend operator fun invoke(name: String): Playlist {
          return repository.createPlaylist(name)
      }
  }
  ```

- [ ] **歌单 UI**
  ```kotlin
  @Composable
  fun PlaylistListScreen() {
      // 歌单列表
  }
  
  @Composable
  fun PlaylistDetailScreen(playlistId: String) {
      // 歌单详情
      // 歌曲列表
      // 添加/删除歌曲
  }
  ```

**交付物：**
- ✅ 创建/编辑/删除歌单
- ✅ 添加/移除歌曲
- ✅ 播放歌单

#### Week 10: 歌词功能

- [ ] **歌词解析**
  ```kotlin
  class ParseLyricsUseCase {
      fun invoke(lrcContent: String): List<LyricLine> {
          // 解析 LRC 格式歌词
      }
  }
  ```

- [ ] **歌词显示**
  ```kotlin
  @Composable
  fun LyricsView(
      lyrics: List<LyricLine>,
      currentPosition: Long
  ) {
      LazyColumn {
          items(lyrics) { line ->
              LyricText(
                  text = line.text,
                  isActive = line.time == currentPosition
              )
          }
      }
  }
  ```

**交付物：**
- ✅ LRC 歌词解析
- ✅ 歌词滚动显示
- ✅ 歌词高亮

#### Week 11: 搜索和设置

- [ ] **搜索功能**
  ```kotlin
  class SearchTracksUseCase @Inject constructor(
      private val repository: MusicRepository
  ) {
      fun invoke(query: String): Flow<List<Track>> {
          return repository.searchTracks(query)
      }
  }
  ```

- [ ] **设置页面**
  ```kotlin
  @Composable
  fun SettingsScreen() {
      // 主题设置
      // 音频设置
      // 存储设置
  }
  ```

**交付物：**
- ✅ 全局搜索功能
- ✅ 设置页面
- ✅ 偏好设置存储

---

### Phase 4: UI 和动画（Week 12-15）

#### Week 12-13: 一镜到底动画

- [ ] **共享元素转场**
  ```kotlin
  @Composable
  fun AlbumCard(album: Album) {
      Card(
          modifier = Modifier.sharedElement(
              key = "album_${album.id}",
              screenKey = "album_list"
          )
      ) {
          AsyncImage(model = album.coverUrl)
      }
  }
  ```

- [ ] **播放器展开动画**
  ```kotlin
  @Composable
  fun MiniPlayerToFullScreen() {
      var isExpanded by remember { mutableStateOf(false) }
      
      val height by animateDpAsState(
          targetValue = if (isExpanded) 
              LocalConfiguration.current.screenHeightDp.dp 
          else 
              64.dp
      )
      
      Surface(modifier = Modifier.height(height)) {
          PlayerContent(isExpanded)
      }
  }
  ```

**交付物：**
- ✅ 专辑 → 详情页动画
- ✅ 迷你播放器 → 全屏动画
- ✅ 列表项进入动画

#### Week 14: UI 优化

- [ ] **主题切换动画**
  ```kotlin
  @Composable
  fun AnimatedTheme(isDark: Boolean, content: @Composable () -> Unit) {
      val backgroundColor by animateColorAsState(
          targetValue = if (isDark) Color(0xFF121212) else Color(0xFFFFFBFE)
      )
      
      MaterialTheme(
          colorScheme = animatedColorScheme,
          content = content
      )
  }
  ```

- [ ] **Material You 动态颜色**
  ```kotlin
  @Composable
  fun DynamicColorTheme(content: @Composable () -> Unit) {
      val colorScheme = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          dynamicColorScheme(LocalContext.current)
      } else {
          lightColorScheme()
      }
      
      MaterialTheme(colorScheme = colorScheme, content = content)
  }
  ```

**交付物：**
- ✅ 主题切换流畅过渡
- ✅ Material You 支持
- ✅ 响应式布局

#### Week 15: 细节打磨

- [ ] **微交互动画**
  - 按钮点击反馈
  - 喜欢/收藏动画
  - 加载动画

- [ ] **手势支持**
  - 上滑展开播放器
  - 下滑收起播放器
  - 左右滑动切歌

**交付物：**
- ✅ 所有微交互动画
- ✅ 手势操作流畅
- ✅ UI 细节完善

---

### Phase 5: 测试和优化（Week 16-18）

#### Week 16: 单元测试

```kotlin
@Test
fun `test play track updates state correctly`() = runTest {
    val mockRepo = mock<MusicRepository>()
    val mockPlayer = mock<PlayerManager>()
    
    val useCase = PlayTrackUseCase(mockPlayer, mockRepo)
    val testTrack = Track(id = "1", title = "Test")
    
    useCase(testTrack)
    
    verify(mockPlayer).play(testTrack)
    verify(mockRepo).recordPlayHistory(testTrack)
}
```

**测试覆盖目标：**
- ✅ UseCase 测试覆盖率 > 80%
- ✅ ViewModel 测试覆盖率 > 70%
- ✅ Repository 测试覆盖率 > 80%

#### Week 17: 性能优化

- [ ] **内存优化**
  ```kotlin
  // 使用 Coil 的内存缓存
  AsyncImage(
      model = ImageRequest.Builder(LocalContext.current)
          .data(coverUrl)
          .memoryCacheKey(coverUrl)
          .diskCacheKey(coverUrl)
          .build()
  )
  ```

- [ ] **启动优化**
  ```kotlin
  // 懒加载非必要组件
  // 使用 Baseline Profiles
  // 优化 Application 初始化
  ```

- [ ] **滚动性能**
  ```kotlin
  // 使用 LazyColumn 的 key
  LazyColumn {
      items(items = tracks, key = { it.id }) { track ->
          TrackItem(track)
      }
  }
  ```

**性能目标：**
- ✅ 冷启动 < 1 秒
- ✅ UI 60fps+
- ✅ 内存占用 < 80MB

#### Week 18: 多设备测试

**测试设备：**
- ✅ 旗舰机（Pixel 8）
- ✅ 中端机（Pixel 6a）
- ✅ 低端机（Android 8.0, 2GB RAM）

**测试项目：**
- [ ] 功能完整性
- [ ] 动画流畅度
- [ ] 内存稳定性
- [ ] 电池消耗
- [ ] 边缘情况处理

---

## 🔑 关键模块实现

### 1. ExoPlayer 音频引擎

```kotlin
// PlayerManager.kt
interface PlayerManager {
    val playbackState: StateFlow<PlaybackState>
    val currentTrack: StateFlow<Track?>
    val currentPosition: StateFlow<Long>
    
    suspend fun play(track: Track)
    suspend fun pause()
    suspend fun seekTo(position: Long)
}

// ExoPlayerManager.kt
@Singleton
class ExoPlayerManager @Inject constructor(
    @ApplicationContext private val context: Context
) : PlayerManager {
    
    private val player: ExoPlayer = ExoPlayer.Builder(context)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(C.USAGE_MEDIA)
                .build(),
            true
        )
        .setHandleAudioBecomingNoisy(true)
        .setWakeMode(C.WAKE_MODE_LOCAL)
        .build()
    
    private val _playbackState = MutableStateFlow<PlaybackState>(PlaybackState.Idle)
    override val playbackState = _playbackState.asStateFlow()
    
    private val _currentTrack = MutableStateFlow<Track?>(null)
    override val currentTrack = _currentTrack.asStateFlow()
    
    private val _currentPosition = MutableStateFlow(0L)
    override val currentPosition = _currentPosition.asStateFlow()
    
    init {
        setupPlayerListener()
        startPositionUpdate()
    }
    
    override suspend fun play(track: Track) {
        val mediaItem = MediaItem.fromUri(track.path)
        player.setMediaItem(mediaItem)
        player.prepare()
        player.play()
        
        _currentTrack.value = track
        _playbackState.value = PlaybackState.Playing
    }
    
    override suspend fun pause() {
        player.pause()
        _playbackState.value = PlaybackState.Paused
    }
    
    override suspend fun seekTo(position: Long) {
        player.seekTo(position)
    }
    
    private fun setupPlayerListener() {
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                _playbackState.value = when (state) {
                    Player.STATE_READY -> PlaybackState.Ready
                    Player.STATE_BUFFERING -> PlaybackState.Buffering
                    Player.STATE_ENDED -> PlaybackState.Ended
                    else -> PlaybackState.Idle
                }
            }
        })
    }
    
    private fun startPositionUpdate() {
        // 每 100ms 更新一次播放位置
        CoroutineScope(Dispatchers.Main).launch {
            while (true) {
                _currentPosition.value = player.currentPosition
                delay(100)
            }
        }
    }
}
```

### 2. Room 数据库

```kotlin
// TrackEntity.kt
@Entity(tableName = "tracks")
data class TrackEntity(
    @PrimaryKey val id: String,
    val title: String,
    val artist: String,
    val album: String,
    val duration: Long,
    val path: String,
    @ColumnInfo(name = "cover_url") val coverUrl: String?,
    @ColumnInfo(name = "added_at") val addedAt: Long
)

// TrackDao.kt
@Dao
interface TrackDao {
    @Query("SELECT * FROM tracks ORDER BY title ASC")
    fun getAllTracks(): Flow<List<TrackEntity>>
    
    @Query("SELECT * FROM tracks WHERE id = :id")
    fun getTrackById(id: String): Flow<TrackEntity?>
    
    @Query("""
        SELECT * FROM tracks 
        WHERE title LIKE '%' || :query || '%' 
           OR artist LIKE '%' || :query || '%'
           OR album LIKE '%' || :query || '%'
    """)
    fun searchTracks(query: String): Flow<List<TrackEntity>>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(tracks: List<TrackEntity>)
    
    @Delete
    suspend fun delete(track: TrackEntity)
}

// MusicDatabase.kt
@Database(
    entities = [TrackEntity::class, AlbumEntity::class, PlaylistEntity::class],
    version = 1
)
abstract class MusicDatabase : RoomDatabase() {
    abstract fun trackDao(): TrackDao
    abstract fun albumDao(): AlbumDao
    abstract fun playlistDao(): PlaylistDao
}
```

### 3. MVVM 实现示例

```kotlin
// LibraryUiState.kt
sealed interface LibraryUiState {
    object Loading : LibraryUiState
    data class Success(val tracks: List<Track>) : LibraryUiState
    data class Error(val message: String) : LibraryUiState
}

// LibraryEvent.kt
sealed interface LibraryEvent {
    data class TrackClicked(val track: Track) : LibraryEvent
    data class SearchQueryChanged(val query: String) : LibraryEvent
    object RefreshRequested : LibraryEvent
}

// LibraryViewModel.kt
@HiltViewModel
class LibraryViewModel @Inject constructor(
    private val getTracksUseCase: GetTracksUseCase,
    private val searchTracksUseCase: SearchTracksUseCase,
    private val playTrackUseCase: PlayTrackUseCase
) : ViewModel() {
    
    private val _uiState = MutableStateFlow<LibraryUiState>(LibraryUiState.Loading)
    val uiState: StateFlow<LibraryUiState> = _uiState.asStateFlow()
    
    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()
    
    init {
        loadTracks()
    }
    
    fun onEvent(event: LibraryEvent) {
        when (event) {
            is LibraryEvent.TrackClicked -> handleTrackClick(event.track)
            is LibraryEvent.SearchQueryChanged -> handleSearch(event.query)
            is LibraryEvent.RefreshRequested -> loadTracks()
        }
    }
    
    private fun loadTracks() {
        viewModelScope.launch {
            getTracksUseCase()
                .catch { exception ->
                    _uiState.value = LibraryUiState.Error(
                        exception.message ?: "Unknown error"
                    )
                }
                .collect { tracks ->
                    _uiState.value = LibraryUiState.Success(tracks)
                }
        }
    }
    
    private fun handleTrackClick(track: Track) {
        viewModelScope.launch {
            playTrackUseCase(track)
        }
    }
    
    private fun handleSearch(query: String) {
        _searchQuery.value = query
        
        viewModelScope.launch {
            searchTracksUseCase(query)
                .collect { tracks ->
                    _uiState.value = LibraryUiState.Success(tracks)
                }
        }
    }
}

// LibraryScreen.kt
@Composable
fun LibraryScreen(
    viewModel: LibraryViewModel = hiltViewModel(),
    onNavigateToPlayer: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    
    Column(modifier = Modifier.fillMaxSize()) {
        SearchBar(
            query = searchQuery,
            onQueryChange = { 
                viewModel.onEvent(LibraryEvent.SearchQueryChanged(it))
            }
        )
        
        when (val state = uiState) {
            is LibraryUiState.Loading -> {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                )
            }
            
            is LibraryUiState.Success -> {
                TrackList(
                    tracks = state.tracks,
                    onTrackClick = { track ->
                        viewModel.onEvent(LibraryEvent.TrackClicked(track))
                        onNavigateToPlayer()
                    }
                )
            }
            
            is LibraryUiState.Error -> {
                ErrorMessage(
                    message = state.message,
                    onRetry = {
                        viewModel.onEvent(LibraryEvent.RefreshRequested)
                    }
                )
            }
        }
    }
}
```

---

## 👥 团队协作

### Git 工作流

```bash
# 主分支
main              # 生产代码
develop           # 开发分支

# 功能分支
feature/player    # 播放器功能
feature/playlist  # 歌单功能
feature/lyrics    # 歌词功能

# 修复分支
fix/crash-issue   # 修复崩溃
fix/ui-bug        # 修复 UI 问题
```

### 提交规范

```bash
# 格式
<type>(<scope>): <subject>

# 示例
feat(player): 添加播放控制功能
fix(ui): 修复专辑列表显示问题
refactor(data): 重构 Repository 层
docs(readme): 更新文档
test(player): 添加播放器单元测试
```

### Code Review 检查清单

- [ ] 代码符合 Kotlin 规范
- [ ] 遵循 MVVM 架构
- [ ] 有适当的注释
- [ ] 单元测试覆盖核心逻辑
- [ ] UI 符合 Material Design 3
- [ ] 动画流畅（60fps+）
- [ ] 无内存泄漏
- [ ] 无性能问题

---

## 🧪 质量保证

### 测试策略

```
测试金字塔：

        /\
       /  \  UI 测试 (10%)
      /────\
     /      \  集成测试 (30%)
    /────────\
   /          \  单元测试 (60%)
  /────────────\
```

### 单元测试示例

```kotlin
@Test
fun `getTracksUseCase returns sorted tracks`() = runTest {
    // Given
    val mockTracks = listOf(
        Track(id = "1", title = "B Song"),
        Track(id = "2", title = "A Song")
    )
    val mockRepo = mock<MusicRepository> {
        on { getTracks() } doReturn flowOf(mockTracks)
    }
    val useCase = GetTracksUseCase(mockRepo)
    
    // When
    val result = useCase().first()
    
    // Then
    assertEquals("A Song", result[0].title)
    assertEquals("B Song", result[1].title)
}
```

### 性能基准

| 指标 | 目标值 | 测试方法 |
|------|--------|---------|
| **冷启动** | < 1秒 | App Startup Library |
| **热启动** | < 300ms | App Startup Library |
| **内存占用** | < 80MB | Android Profiler |
| **帧率** | ≥ 60fps | GPU Rendering Profiler |
| **Seek 延迟** | < 50ms | 手动测试 + 日志 |
| **电池消耗** | < 5%/小时 | Battery Historian |

---

## 📚 参考资源

### 官方文档
- [Jetpack Compose](https://developer.android.com/jetpack/compose)
- [ExoPlayer](https://developer.android.com/guide/topics/media/exoplayer)
- [Room](https://developer.android.com/training/data-storage/room)
- [Hilt](https://developer.android.com/training/dependency-injection/hilt-android)

### 最佳实践
- [Android Architecture Guide](https://developer.android.com/topic/architecture)
- [Material Design 3](https://m3.material.io/)
- [Kotlin Coroutines](https://kotlinlang.org/docs/coroutines-overview.html)

---

## 📋 附录

### A. 开发环境要求

```
必需软件：
- Android Studio Hedgehog | 2023.1.1+
- JDK 17+
- Android SDK 26+（目标 SDK 34）
- Gradle 8.0+

推荐配置：
- RAM: 16GB+
- SSD: 100GB+ 可用空间
- CPU: 多核处理器
```

### B. 常用命令

```bash
# 构建
./gradlew assembleDebug
./gradlew assembleRelease

# 测试
./gradlew test
./gradlew connectedAndroidTest

# 代码检查
./gradlew ktlintCheck
./gradlew detekt

# 清理
./gradlew clean
```

### C. 故障排查

| 问题 | 解决方案 |
|------|---------|
| **构建失败** | 清理缓存：`./gradlew clean` |
| **依赖冲突** | 检查 `build.gradle.kts` 版本号 |
| **Room 编译错误** | 确保 kapt 插件已添加 |
| **Compose 预览不显示** | 重启 Android Studio |

---

**版权声明**: © 2025 WindChime Player 团队  
**最后更新**: 2025-10-07  
**文档维护**: 开发团队

---

*本文档将随项目进展持续更新*



