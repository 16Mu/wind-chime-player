# WindChime Player Android - 一镜到底动画设计规范

> **版本**: v1.0  
> **创建日期**: 2025-10-07  
> **状态**: 强制执行 🔴 MANDATORY

---

## 📋 文档概述

本文档定义 WindChime Player Android 版本的核心 UI/UX 规范：**一镜到底动画系统**（Shared Element Transitions）。

### 核心原则

> **"用户在应用中的每一次交互，都应该是一次流畅的视觉旅程，而不是生硬的页面跳转。"**

所有界面转换必须遵循"一镜到底"原则，禁止出现突兀的页面切换。

---

## 🎯 强制性要求

### 1. 所有页面转换必须有动画

**级别**: 🔴 **MANDATORY（强制）**

| 场景 | 要求 | 违规后果 |
|------|------|---------|
| 页面跳转 | 必须有转场动画 | ❌ 代码审查不通过 |
| 按钮点击 | 必须有反馈动画 | ❌ 代码审查不通过 |
| 列表滚动 | 必须有平滑过渡 | ❌ 代码审查不通过 |
| 主题切换 | 必须有颜色过渡动画 | ❌ 代码审查不通过 |

**禁止行为：**
```kotlin
// ❌ 禁止：直接跳转，无动画
navController.navigate("detail")

// ✅ 必须：带动画的跳转
navController.navigate("detail") {
    // 定义转场动画
}
```

---

## 🎬 一镜到底动画规范

### 2.1 共享元素转场 (Shared Element Transitions)

#### **定义**

当一个 UI 元素在两个页面中都存在时，该元素必须从起始位置平滑移动到目标位置，而不是消失后重新出现。

#### **适用场景**

| 场景 | 共享元素 | 动画描述 |
|------|---------|---------|
| **专辑列表 → 专辑详情** | 专辑封面 | 封面从列表位置放大移动到详情页顶部 |
| **歌曲列表 → 播放器** | 歌曲封面 + 标题 | 封面和标题移动到播放器位置 |
| **迷你播放器 → 全屏播放器** | 封面 + 控制按钮 + 进度条 | 所有元素同步移动和缩放 |
| **艺术家列表 → 艺术家详情** | 艺术家头像 + 名字 | 头像放大，名字移动 |

#### **实现规范**

```kotlin
// ⭐ 标准实现模板

// 1. 定义共享元素键值
object SharedElementKeys {
    const val ALBUM_COVER = "album_cover"
    const val TRACK_TITLE = "track_title"
    const val ARTIST_IMAGE = "artist_image"
    const val PLAY_BUTTON = "play_button"
}

// 2. 起始页面：标记共享元素
@Composable
fun AlbumListItem(album: Album, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .clickable(onClick = onClick)
            .sharedElement(
                key = "${SharedElementKeys.ALBUM_COVER}_${album.id}",
                screenKey = "album_list"
            )
    ) {
        AsyncImage(
            model = album.coverUrl,
            modifier = Modifier
                .size(100.dp)
                .sharedBounds(
                    sharedContentState = rememberSharedContentState(
                        key = "${SharedElementKeys.ALBUM_COVER}_${album.id}"
                    ),
                    animatedVisibilityScope = this
                )
        )
        Text(album.title)
    }
}

// 3. 目标页面：匹配共享元素
@Composable
fun AlbumDetailScreen(album: Album) {
    Column {
        AsyncImage(
            model = album.coverUrl,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .sharedBounds(
                    sharedContentState = rememberSharedContentState(
                        key = "${SharedElementKeys.ALBUM_COVER}_${album.id}"
                    ),
                    animatedVisibilityScope = this
                )
        )
        // 其他内容...
    }
}
```

#### **技术要求**

| 参数 | 要求值 | 说明 |
|------|--------|------|
| **动画时长** | 300-400ms | Material Design 标准 |
| **缓动函数** | `FastOutSlowInEasing` | 自然的加速减速 |
| **帧率** | ≥ 60fps | 保证流畅度 |
| **同步性** | 所有共享元素同时开始和结束 | 避免分裂感 |

---

### 2.2 非共享元素的进出动画

#### **元素出现规则**

对于目标页面中新出现的元素（起始页面没有的），必须遵循以下动画：

```kotlin
// ⭐ 标准进入动画
@Composable
fun DetailPageNewContent() {
    // 方案 A: 淡入 + 上移
    AnimatedVisibility(
        visible = true,
        enter = fadeIn(
            animationSpec = tween(
                durationMillis = 400,
                delayMillis = 150  // 等待共享元素动画完成
            )
        ) + slideInVertically(
            initialOffsetY = { it / 4 }  // 从下方 1/4 处滑入
        )
    ) {
        DetailContent()
    }
    
    // 方案 B: 扩散效果（从封面向外扩散）
    AnimatedVisibility(
        visible = true,
        enter = expandIn(
            expandFrom = Alignment.TopCenter,
            animationSpec = tween(300)
        ) + fadeIn()
    ) {
        DescriptionText()
    }
}
```

**动画时序要求：**
```
时间轴:
0ms                 150ms               400ms
|-------------------|-------------------|
共享元素移动开始 →   新元素开始出现 →   所有动画结束

规则：新元素必须在共享元素移动到一半时开始出现
```

#### **元素消失规则**

对于起始页面中消失的元素（目标页面没有的），必须：

```kotlin
// ⭐ 标准退出动画
@Composable
fun ListPageDisappearingContent() {
    AnimatedVisibility(
        visible = isVisible,
        exit = fadeOut(
            animationSpec = tween(200)
        ) + shrinkVertically()
    ) {
        ListExtraInfo()
    }
}
```

---

### 2.3 迷你播放器 ↔ 全屏播放器转换（核心场景）

#### **场景描述**

这是应用中最重要的动画场景，必须做到极致流畅。

#### **共享元素清单**

| 元素 | 迷你播放器状态 | 全屏播放器状态 | 动画类型 |
|------|---------------|---------------|---------|
| **专辑封面** | 48dp 圆角矩形 | 300dp 圆角矩形 | 位置 + 缩放 + 圆角 |
| **歌曲标题** | 单行，14sp | 居中，20sp 粗体 | 位置 + 字号 + 粗细 |
| **艺术家名** | 单行，12sp | 居中，16sp | 位置 + 字号 |
| **播放按钮** | 40dp | 64dp | 位置 + 缩放 |
| **进度条** | 细线，2dp | 粗线，4dp + 拖动手柄 | 位置 + 粗细 + 形状 |

#### **实现代码示例**

```kotlin
@Composable
fun MiniPlayerToFullScreen() {
    var isExpanded by remember { mutableStateOf(false) }
    
    // 使用 AnimatedContent 实现布局切换
    AnimatedContent(
        targetState = isExpanded,
        transitionSpec = {
            fadeIn(tween(400)) togetherWith 
            fadeOut(tween(400))
        }
    ) { expanded ->
        if (expanded) {
            FullScreenPlayer(
                modifier = Modifier.fillMaxSize()
            )
        } else {
            MiniPlayer(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp)
            )
        }
    }
}

@Composable
fun SharedPlayerElements(track: Track, isExpanded: Boolean) {
    val coverSize by animateDpAsState(
        targetValue = if (isExpanded) 300.dp else 48.dp,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        )
    )
    
    val cornerRadius by animateDpAsState(
        targetValue = if (isExpanded) 16.dp else 8.dp
    )
    
    AsyncImage(
        model = track.coverUrl,
        modifier = Modifier
            .size(coverSize)
            .clip(RoundedCornerShape(cornerRadius))
            .sharedElement(
                key = "player_cover",
                screenKey = if (isExpanded) "full_player" else "mini_player"
            )
    )
}
```

#### **手势交互要求**

```kotlin
// ⭐ 必须支持手势拖动展开/收起

@Composable
fun DraggablePlayer() {
    val offsetY = remember { Animatable(0f) }
    
    Box(
        modifier = Modifier
            .offset { IntOffset(0, offsetY.value.roundToInt()) }
            .pointerInput(Unit) {
                detectVerticalDragGestures(
                    onDragEnd = {
                        // 根据拖动距离决定展开或收起
                        val shouldExpand = offsetY.value < -100f
                        if (shouldExpand) {
                            expandToFullScreen()
                        } else {
                            collapseToMini()
                        }
                    },
                    onVerticalDrag = { change, dragAmount ->
                        change.consume()
                        offsetY.snapTo(offsetY.value + dragAmount)
                    }
                )
            }
    ) {
        PlayerContent()
    }
}
```

**要求：**
- ✅ 支持向上滑动展开
- ✅ 支持向下滑动收起
- ✅ 支持手势跟随（实时响应手指位置）
- ✅ 松手后根据速度和位置自动完成动画

---

### 2.4 列表滚动动画

#### **要求**

列表项必须有进入动画，避免"突然出现"的感觉。

```kotlin
@Composable
fun AnimatedMusicList(tracks: List<Track>) {
    LazyColumn {
        itemsIndexed(tracks) { index, track ->
            // ⭐ 每个列表项带延迟的淡入 + 滑入动画
            val visible = remember { mutableStateOf(false) }
            
            LaunchedEffect(Unit) {
                delay(index * 50L)  // 每项延迟 50ms
                visible.value = true
            }
            
            AnimatedVisibility(
                visible = visible.value,
                enter = fadeIn(tween(300)) + 
                       slideInHorizontally(
                           initialOffsetX = { it / 4 },
                           animationSpec = tween(400)
                       )
            ) {
                TrackListItem(track)
            }
        }
    }
}
```

**效果：** 列表项像波浪一样依次出现，而不是一次性全部显示。

---

## 🎨 主题切换动画规范

### 3.1 颜色过渡要求

**级别**: 🔴 **MANDATORY（强制）**

主题切换时，所有颜色必须平滑过渡，禁止直接切换。

```kotlin
@Composable
fun ThemedComponent(isDarkTheme: Boolean) {
    // ✅ 正确：颜色动画过渡
    val backgroundColor by animateColorAsState(
        targetValue = if (isDarkTheme) {
            Color(0xFF121212)  // 深色背景
        } else {
            Color(0xFFFFFBFE)  // 浅色背景
        },
        animationSpec = tween(
            durationMillis = 400,
            easing = FastOutSlowInEasing
        )
    )
    
    Surface(color = backgroundColor) {
        Content()
    }
}

// ❌ 错误：直接切换颜色
Surface(
    color = if (isDarkTheme) DarkColor else LightColor  // 无动画
) {
    Content()
}
```

### 3.2 Material You 动态取色

```kotlin
@Composable
fun DynamicTheme(content: @Composable () -> Unit) {
    val context = LocalContext.current
    
    // 从专辑封面提取颜色
    val dynamicColor = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        dynamicColorScheme(context)
    } else {
        // 使用自定义颜色提取
        extractColorsFromAlbumCover()
    }
    
    // ⭐ 颜色切换必须有动画
    val animatedColorScheme = animateColorScheme(
        targetColorScheme = dynamicColor,
        animationSpec = tween(500)
    )
    
    MaterialTheme(
        colorScheme = animatedColorScheme,
        content = content
    )
}
```

---

## 🎭 微交互动画规范

### 4.1 按钮点击反馈

**所有可点击元素必须有视觉反馈。**

```kotlin
@Composable
fun AnimatedButton(onClick: () -> Unit) {
    var isPressed by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.95f else 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy
        )
    )
    
    Button(
        onClick = onClick,
        modifier = Modifier
            .scale(scale)
            .pointerInput(Unit) {
                detectTapGestures(
                    onPress = {
                        isPressed = true
                        tryAwaitRelease()
                        isPressed = false
                    }
                )
            }
    ) {
        Text("播放")
    }
}
```

**效果：** 按钮点击时缩小到 95%，松开后弹回，有弹性效果。

### 4.2 加载动画

```kotlin
@Composable
fun LoadingIndicator() {
    val infiniteTransition = rememberInfiniteTransition()
    
    val rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        )
    )
    
    Icon(
        imageVector = Icons.Default.Refresh,
        contentDescription = "加载中",
        modifier = Modifier.rotate(rotation)
    )
}
```

### 4.3 喜欢/收藏动画

```kotlin
@Composable
fun LikeButton(isLiked: Boolean, onToggle: () -> Unit) {
    val scale by animateFloatAsState(
        targetValue = if (isLiked) 1.2f else 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        )
    )
    
    IconButton(
        onClick = onToggle,
        modifier = Modifier.scale(scale)
    ) {
        Icon(
            imageVector = if (isLiked) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
            contentDescription = "喜欢",
            tint = if (isLiked) Color.Red else LocalContentColor.current,
            modifier = Modifier.animateContentSize()
        )
    }
}
```

**效果：** 点击后心形图标放大并变红，有弹跳效果。

---

## 📐 动画参数标准

### 5.1 时长标准

| 动画类型 | 时长 | 说明 |
|---------|------|------|
| **微交互** | 100-200ms | 按钮点击、状态切换 |
| **页面转场** | 300-400ms | 页面间导航 |
| **共享元素** | 400-500ms | 元素在页面间移动 |
| **主题切换** | 400-500ms | 颜色过渡 |
| **手势跟随** | 实时 | 0 延迟响应 |

### 5.2 缓动函数标准

| 场景 | 缓动函数 | 效果 |
|------|---------|------|
| **进入动画** | `FastOutSlowInEasing` | 快速启动，平缓结束 |
| **退出动画** | `FastOutLinearInEasing` | 快速退出 |
| **强调动画** | `Spring(弹性)` | 有弹性，吸引注意 |
| **自然移动** | `EaseInOut` | 平滑自然 |

```kotlin
// ⭐ 预定义动画规格
object AnimationSpecs {
    val MicroInteraction = tween<Float>(
        durationMillis = 150,
        easing = FastOutSlowInEasing
    )
    
    val PageTransition = tween<Float>(
        durationMillis = 400,
        easing = FastOutSlowInEasing
    )
    
    val SharedElement = spring<Float>(
        dampingRatio = Spring.DampingRatioMediumBouncy,
        stiffness = Spring.StiffnessLow
    )
    
    val ThemeChange = tween<Color>(
        durationMillis = 400,
        easing = LinearOutSlowInEasing
    )
}
```

---

## ✅ 验收标准

### 6.1 动画质量检查清单

在提交代码前，必须通过以下检查：

- [ ] **所有页面转换都有动画** - 无突兀跳转
- [ ] **共享元素正确标记** - key 值唯一且匹配
- [ ] **帧率达标** - 使用 GPU 渲染分析工具验证 ≥ 60fps
- [ ] **手势响应流畅** - 无卡顿，实时跟随
- [ ] **主题切换平滑** - 颜色渐变，无闪烁
- [ ] **按钮有反馈** - 点击有缩放或波纹效果
- [ ] **动画时长合理** - 符合规范表中的标准
- [ ] **无过度动画** - 不影响操作效率

### 6.2 性能要求

| 指标 | 要求 | 测试方法 |
|------|------|---------|
| **帧率** | ≥ 60fps | GPU 渲染分析 |
| **卡顿率** | < 1% | 慢速渲染测试 |
| **动画延迟** | < 16ms | Systrace 分析 |
| **过度绘制** | < 2x | 调试 GPU 过度绘制 |

### 6.3 测试设备要求

动画必须在以下设备上流畅运行：

- ✅ **旗舰机** (如 Pixel 8, 小米 14): 60fps+
- ✅ **中端机** (如 Pixel 6a, Redmi Note): 60fps
- ✅ **低端机** (Android 8.0, 2GB RAM): ≥ 30fps

---

## 🚫 禁止行为

### 严格禁止以下做法：

1. **❌ 禁止无动画跳转**
   ```kotlin
   // ❌ 错误
   navController.navigate("detail")
   ```

2. **❌ 禁止突兀的颜色切换**
   ```kotlin
   // ❌ 错误
   Surface(color = if (isDark) Black else White)
   ```

3. **❌ 禁止硬编码动画时长**
   ```kotlin
   // ❌ 错误
   animateDpAsState(targetValue = size, tween(234))
   
   // ✅ 正确
   animateDpAsState(targetValue = size, AnimationSpecs.PageTransition)
   ```

4. **❌ 禁止阻塞主线程的动画**
   ```kotlin
   // ❌ 错误：在主线程执行复杂计算
   val color = extractColorFromBitmap(largeBitmap)  // 阻塞
   
   // ✅ 正确：在后台线程执行
   LaunchedEffect(bitmap) {
       withContext(Dispatchers.Default) {
           val color = extractColorFromBitmap(bitmap)
           _color.value = color
       }
   }
   ```

---

## 📚 参考资源

### 官方文档
- [Jetpack Compose Animation](https://developer.android.com/jetpack/compose/animation)
- [Material Design Motion](https://m3.material.io/styles/motion/overview)
- [Shared Element Transitions](https://developer.android.com/jetpack/compose/animation/shared-elements)

### 最佳实践参考
- **YouTube Music**: 迷你播放器到全屏播放器动画
- **Spotify**: 专辑列表到详情页动画
- **Apple Music**: 列表项进入动画

---

## 📋 代码审查要点

审查者必须检查：

1. ✅ 所有 `navController.navigate()` 调用都有动画配置
2. ✅ 共享元素的 `key` 值在起始和目标页面匹配
3. ✅ 动画时长使用预定义的 `AnimationSpecs`
4. ✅ 颜色变化使用 `animateColorAsState`
5. ✅ 布局变化使用 `animateContentSize` 或 `AnimatedVisibility`
6. ✅ 列表使用 `LazyColumn` 并有进入动画
7. ✅ 按钮有点击反馈动画

**如果发现违规，立即要求修改后才能合并。**

---

## 🎯 总结

### 核心要点

1. **一镜到底是强制要求，不是可选项**
2. **共享元素必须连续移动，不能消失重现**
3. **所有交互必须有视觉反馈**
4. **主题切换必须平滑过渡**
5. **性能和美观缺一不可**

### 开发流程

```
设计阶段 → 确定共享元素
    ↓
开发阶段 → 标记 sharedElement
    ↓
测试阶段 → 验证 60fps + 流畅度
    ↓
审查阶段 → 检查清单 + 性能测试
    ↓
发布准备 → 多设备验证
```

---

**本规范由项目组强制执行，所有开发人员必须严格遵守。**

**违规代码将无法通过代码审查。**

---

*WindChime Player - 让每一次交互都是一次视觉享受* 🎵✨



