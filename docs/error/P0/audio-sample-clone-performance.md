# 文件审查：src-tauri/src/player/actors (5个文件)

## audio_actor.rs

### 轮次1 - 架构
1. **reset方法无法真正重置** (P1)
   - lines 123-133: OnceCell限制无法reset
   - 影响: 音频设备故障后无法恢复
   - 建议: 改用Mutex或重新设计

### 轮次2 - 安全
1. **健康检查无实际检查** (P2)
   - lines 157-161: 只检查是否初始化，不检查设备健康
   - 建议: 添加实际的设备可用性检测

### 轮次3 - 性能
1. **30秒健康检查间隔过长** (P3)
   - line 69: 如果设备掉线，最多30秒才能发现
   - 建议: 缩短到5-10秒

### 轮次4 - 代码质量
无问题

### 轮次5 - 细节
1. **device_cache未实际使用** (P3)
   - line 39: 声明但几乎未使用
   - 建议: 移除或完善使用

**总问题数**: 4

---

## playback_actor.rs

### 轮次1 - 架构
1. **缓存策略hardcoded** (P2)
   - lines 271-359: 缓存逻辑混入播放逻辑
   - 建议: 独立的缓存管理模块

2. **流式播放耦合到playback** (P1)
   - lines 600-669: decode_streaming方法过长，应该独立
   - 建议: 抽取StreamingDecoder

### 轮次2 - 安全
1. **全局DB访问unsafe** (P1)
   - line 612: `crate::DB.get()`使用全局状态
   - 影响: 依赖全局单例，难以测试
   - 建议: 通过依赖注入传递

### 轮次3 - 性能
1. **每次播放都clone samples** (P0)
   - lines 285, 419, 454: Vec<i16> clone非常昂贵
   - 影响: 大文件(如100MB FLAC)clone会卡顿数秒
   - 建议: 使用Arc<[i16]>共享

2. **position_update 100ms间隔不必要** (P2)
   - line 162: 100ms频率过高
   - 建议: 改为200-300ms

3. **后台缓存被禁用导致seek慢** (P1)
   - lines 355-359: 注释掉后台缓存
   - 影响: seek无法使用缓存，每次都重新解码
   - 建议: 修复runtime阻塞问题而非禁用

### 轮次4 - 代码质量
1. **过多println调试输出** (P2)
   - 贯穿整个文件: 应该全部用log宏
   - 影响: 生产环境IO开销

2. **500ms魔法数字** (P3)
   - line 576: 硬编码延迟判断
   - 建议: 提取为常量

### 轮次5 - Bug
1. **empty检查可能误判** (P1)
   - lines 571-589: sink.empty()在流式播放时可能提前触发
   - 影响: 播放未完成就停止
   - 建议: 增加更可靠的完成检测

**总问题数**: 10

---

## playlist_actor.rs

### 轮次1 - 架构
1. **VecDeque滥用** (P2)
   - lines 60, 72: current_queue和history用VecDeque但未充分利用
   - 建议: 评估是否真需要双端队列

### 轮次2 - 安全
未发现问题

### 轮次3 - 性能
1. **rebuild_queue完整clone** (P1)
   - lines 294-308: shuffle时clone整个playlist
   - 影响: 大playlist性能差
   - 建议: 使用索引而非clone Track

2. **history无上限限制实际执行** (P2)
   - line 94: max_history=50设置了但retention逻辑简单
   - 建议: 验证是否正确限制

### 轮次4 - 代码质量
1. **缺少文档注释** (P3)
   - 大部分方法无文档

### 轮次5 - Bug
1. **GetNext在shuffle+RepeatOne组合逻辑错误** (P2)
   - lines 179-184: 单曲循环时仍然检查shuffle
   - 建议: 先检查RepeatOne

**总问题数**: 6

---

## state_actor.rs

### 轮次1 - 架构
1. **状态广播过于频繁** (P2)
   - broadcast_state在每次小变化都触发
   - 建议: 批量更新或去抖

### 轮次2 - 安全
未发现问题

### 轮次3 - 性能
1. **position更新不发送event但仍然lock** (P3)
   - lines 154-163: 每次position update都lock write
   - 建议: 使用Atomic或skip position storage

### 轮次4 - 代码质量
未发现问题

### 轮次5 - Bug
1. **GetState使用clone但可能过大** (P3)
   - line 105: clone整个PlayerState包含Track
   - 建议: 考虑使用Arc

**总问题数**: 3

---

## preload_actor.rs

### 轮次1 - 架构
1. **预加载整个文件到内存** (P0)
   - line 571: `fs::read(path)`加载整个文件
   - 影响: 大文件(如300MB lossless)导致OOM
   - 建议: 限制最大文件大小或流式处理

2. **缓存未实际使用** (P0)
   - 代码中cache.put但没有consumer使用
   - 影响: 浪费内存
   - 建议: 要么完整实现，要么移除

### 轮次2 - 安全
1. **path参数未验证** (P1)
   - load_audio_data可读取任意文件
   - 建议: 验证路径在允许目录

### 轮次3 - 性能
1. **predict_next_tracks每次都计算** (P2)
   - line 490: 曲目变化时重新计算
   - 建议: 缓存预测结果

2. **loading_tasks未清理finished任务** (P2)
   - line 279: HashMap持续增长
   - 影响: 内存泄漏
   - 建议: 定期清理（虽然line 484有但不够）

### 轮次4 - 代码质量
1. **空实现handle_cancel等** (P2)
   - 多个方法只log不做事

### 轮次5 - Bug
1. **current_idx + 2可能越界** (P3)
   - lines 521, 536: 虽然用了%但逻辑不清晰
   - 建议: 添加边界检查注释

**总问题数**: 8

---

**总计**: 31个问题
**审查耗时**: 约45分钟



