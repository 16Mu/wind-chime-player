# 文件审查：React Contexts和主要组件 (5个文件)

## PlaylistContext.tsx

### 轮次1 - 架构
1. **每个操作都调用loadPlaylists** (P0)
   - lines 212, 240, 256, 274, 290等: 频繁刷新整个列表
   - 影响: 性能极差，每次小操作都重新获取所有数据
   - 建议: 乐观更新+后台验证

2. **重复定义Track接口** (P1)
   - lines 34-41: 应该导入统一类型
   - 建议: 从types/music导入

### 轮次2 - 安全
无问题

### 轮次3 - 性能
1. **getSidebarPlaylists每次render都计算** (P1)
   - lines 478-504: 复杂的filter+sort操作
   - 影响: 重渲染卡顿
   - 建议: useMemo

2. **更新操作串行执行** (P1)
   - 如updatePlaylist: loadPlaylists然后getPlaylistDetail
   - 建议: Promise.all并发

### 轮次4 - 代码质量
1. **错误处理不一致** (P2)
   - 有的用handleError，有的console.error
   - 建议: 统一错误处理

### 轮次5 - Bug
1. **loadPlaylists和loadStats无限循环风险** (P0)
   - line 511: effect deps包含这两个函数
   - 影响: 可能无限循环
   - 建议: 使用empty deps或useCallback properly

**总问题数**: 7

---

## PlaylistsPage.tsx

### 轮次1 - 架构
良好的薄控制器设计

### 轮次2 - 安全
1. **confirm使用原生对话框** (P2)
   - line 75: 原生confirm体验差
   - 建议: 自定义确认对话框

### 轮次3 - 性能
无问题

### 轮次4 - 代码质量
1. **alert用于反馈** (P2)
   - lines 95, 98, 81: 应该用toast
   - 建议: 统一使用toast系统

### 轮次5 - Bug
无bug

**总问题数**: 2

---

## TracksView.tsx

### 轮次1 - 架构
1. **重复定义Track接口** (P1)
   - lines 7-14: 应该导入
   - 建议: 统一类型

2. **favoriteStates本地管理但应该全局** (P2)
   - line 37: 收藏状态应该在Context
   - 建议: 移到FavoritesContext

### 轮次2 - 安全
无问题

### 轮次3 - 性能
1. **useAlbumCovers一次性加载所有** (P1)
   - line 45: 可能加载数百张图
   - 影响: 内存和带宽浪费
   - 建议: 虚拟化+懒加载

2. **rowRefs数组持续增长** (P2)
   - line 41: 切换tracks时不清理
   - 建议: 在tracks变化时清理

### 轮次4 - 代码质量
1. **loading dots硬编码样式** (P3)
   - lines 74-78: 应该提取为组件

### 轮次5 - Bug
无bug

**总问题数**: 5

---

## Sidebar.tsx

### 轮次1 - 架构
1. **playlists hardcoded mock数据** (P0)
   - lines 19-44: 不应该有mock数据在生产组件中
   - 影响: 功能未实现
   - 建议: 连接PlaylistContext

2. **过多状态管理** (P1)
   - 10+个useState: 应该拆分子组件
   - 建议: 创建CreatePlaylistModal子组件

### 轮次2 - 安全
无问题

### 轮次3 - 性能
1. **setTimeout(10ms)用于mouseleave** (P2)
   - lines 167-174: querySelector('.sidebar-button:hover')每次查询DOM
   - 建议: 使用state跟踪

2. **700ms动画timeout** (P2)
   - lines 191-195: 硬编码延迟可能不准确
   - 建议: 使用transitionend event

### 轮次4 - 代码质量
1. **Date.now()用作playlistId** (P1)
   - line 206: 不应该前端生成ID
   - 影响: ID冲突风险
   - 建议: 后端生成

2. **大量inline style** (P3)
   - transition样式重复
   - 建议: 提取为CSS classes

3. **navigation items硬编码** (P2)
   - lines 60-115: 应该提取配置
   - 建议: 独立配置文件

### 轮次5 - Bug
1. **handleCreatePlaylist不调用API** (P0)
   - lines 203-220: 只更新本地state
   - 影响: 数据未保存
   - 建议: 调用Context.createPlaylist

2. **indicator计算未考虑scroll** (P2)
   - lines 126-136: getBoundingClientRect不考虑滚动
   - 建议: 加上scrollTop

**总问题数**: 10

---

## cache.ts

### 轮次1 - 架构
1. **CacheManager使用Map但无大小限制** (P1)
   - line 31: Map可能无限增长
   - 影响: 内存泄漏
   - 建议: 实现LRU或maxSize

### 轮次2 - 安全
无问题

### 轮次3 - 性能
1. **cleanExpired遍历所有entries** (P2)
   - lines 100-112: O(n)操作
   - 建议: 使用索引或定期清理

2. **getStats每次计算** (P3)
   - lines 117-135: 应该缓存
   - 建议: lazy计算

### 轮次4 - 代码质量
1. **useCachedData未返回loading状态** (P2)
   - lines 257-290: isLoading局部变量未暴露
   - 建议: 返回{data, isLoading}

2. **dependencies展开语法不安全** (P1)
   - line 287: `...dependencies`可能导致stale closure
   - 建议: 使用useRef或重新设计

### 轮次5 - Bug
1. **startCacheCleanup无法停止多个实例** (P2)
   - lines 196-218: 多次调用会创建多个interval
   - 建议: 使用单例模式

**总问题数**: 7

---

**React Contexts和组件总计**: 31个问题
**严重问题**: 4个P0级别
**审查耗时**: 约40分钟



