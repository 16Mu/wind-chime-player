# 文件审查：src-tauri/src/player/audio (4个文件)

## device.rs

### 轮次1 - 架构
1. **LazyAudioDevice无法真正reset** (P1)
   - lines 119-133: OnceCell一旦设置就无法清除
   - 影响: 音频设备故障无法恢复
   - 建议: 使用Mutex<Option<AudioDevice>>

2. **timeout_duration存储但未在clone中复制** (P3)
   - clone实现正确复制了timeout_duration，此问题不存在

### 轮次2 - 安全
无问题

### 轮次3 - 性能
1. **3秒超时可能过长** (P3)
   - line 71: 用户等待3秒体验差
   - 建议: 降至1-2秒

### 轮次4 - 代码质量
1. **init_device是async但不需要** (P2)
   - lines 109-112: 标记async但调用的是同步函数
   - 建议: 移除async

### 轮次5 - Bug
无Bug

**总问题数**: 3

---

## decoder.rs

### 轮次1 - 架构
1. **DecoderFactory未使用** (P3)
   - lines 183-210: 大量dead_code
   - 建议: 移除或启用

### 轮次2 - 安全
1. **validate打开文件但未关闭** (P2)
   - lines 124-127: 打开文件验证但未显式关闭(依赖drop)
   - 建议: 添加注释说明或使用更明确的方式

### 轮次3 - 性能
1. **BufReader硬编码默认buffer** (P3)
   - line 87: 应该用with_capacity优化
   - 建议: `BufReader::with_capacity(64 * 1024, file)`

### 轮次4 - 代码质量
1. **format字段未使用** (P3)
   - AudioDecoder.format提取但从未使用
   - 建议: 移除或实际使用

### 轮次5 - Bug
无Bug

**总问题数**: 4

---

## sink_pool.rs

### 轮次1 - 架构
1. **in_use_count可能不准确** (P2)
   - lines 219: saturating_sub可能掩盖bug
   - 建议: 使用checked_sub并panic

2. **池满时拒绝服务** (P1)
   - lines 98-106: 返回错误而非等待
   - 建议: 实现等待机制或调整pool大小

### 轮次2 - 安全
1. **expect可能panic** (P2)
   - lines 194, 199: expect在Sink被移出时panic
   - 建议: 使用更安全的API

### 轮次3 - 性能
1. **clear()在drop时调用** (P1)
   - line 215: clear可能耗时，阻塞drop
   - 影响: drop慢影响性能
   - 建议: 异步清理或跳过

2. **8个默认容量可能过小** (P2)
   - line 72: 对于多track快速切换可能不够
   - 建议: 增加到16或动态调整

### 轮次4 - 代码质量
1. **stats方法dead_code** (P3)
   - lines 121-136: 未使用
   - 建议: 移除allow(dead_code)并实际使用

### 轮次5 - Bug
1. **reuse_rate计算可能除0** (P3)
   - line 131: total_created可能为0(虽然有检查)
   - 建议: 更明确的处理

**总问题数**: 7

---

## stream.rs

### 轮次1 - 架构
1. **StreamState使用u64存储enum** (P2)
   - lines 66, 94-102: 手动转换容易出错
   - 建议: 使用AtomicEnum crate或其他方案

### 轮次2 - 安全
无问题

### 轮次3 - 性能
1. **每次health_check都lock** (P3)
   - lines 136-161: 频繁lock
   - 建议: 使用原子操作统计

### 轮次4 - 代码质量
1. **magic number 300秒, 0.1** (P3)
   - lines 141, 151: 硬编码阈值
   - 建议: 提取为常量

### 轮次5 - Bug
1. **state enum值未检查范围** (P2)
   - line 101: default返回Uninitialized可能掩盖bug
   - 建议: 使用match exhaustive

**总问题数**: 4

---

**所有audio modules总计**: 18个问题
**审查耗时**: 约30分钟



