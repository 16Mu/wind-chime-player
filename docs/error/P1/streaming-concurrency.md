# 文件审查：src-tauri/src/streaming/service.rs

## 轮次 1/5 - 架构与设计层面

1. **parse_remote_path返回Result<(String,String),String>不标准** (P2)
   - lines 253-265: 错误类型应该是Error而非String
   - 影响: 错误处理不规范
   - 建议: 返回StreamError或anyhow::Error

2. **cleanup_oldest_session逻辑简单** (P2)
   - lines 268-276: 只按时间清理，未考虑优先级或大小
   - 建议: 实现更智能的淘汰策略(如LRU)

3. **start_cleanup_task无法停止** (P1)
   - lines 282-291: spawn的task无句柄，无法clean shutdown
   - 影响: 程序退出时task仍运行
   - 建议: 返回JoinHandle或实现shutdown

## 轮次 2/5 - 安全与风险层面

1. **session_id由UUID生成但未验证** (P2)
   - line 96: client可传入任意session_id访问其他会话
   - 影响: 会话劫持风险
   - 建议: 添加会话所有权验证

2. **offset和length未充分验证** (P1)
   - lines 154-160: 只检查offset < total_size
   - 影响: length可能非常大导致OOM
   - 建议: 限制单次request的max length

3. **Base64编码大数据块** (P1)
   - line 179: 编码可能很大的数据块(如5MB)
   - 影响: 内存占用1.33x原始大小，且编码耗时
   - 建议: 使用二进制传输或限制chunk大小

## 轮次 3/5 - 性能与并发层面

1. **每次get_chunk都write().await** (P1)
   - line 149: 写锁阻塞其他并发请求
   - 影响: 并发性能差
   - 建议: 只在更新stats时锁，其他用read lock

2. **read_to_end可能阻塞很久** (P0)
   - line 175: 如果网络慢，会长时间持有write lock
   - 影响: 严重的并发瓶颈
   - 建议: 先释放锁，再读取数据

3. **cleanup_expired每60秒触发但持有write lock** (P2)
   - lines 235-247: retain操作持有写锁
   - 影响: 阻塞所有get_chunk
   - 建议: 先找出expired，再批量删除

4. **平均延迟计算每次都计算** (P2)
   - lines 185-186: 复杂的数学运算
   - 建议: 使用增量平均算法

## 轮次 4/5 - 代码质量与类型安全层面

1. **错误消息硬编码中文** (P3)
   - lines 89, 256等: 国际化困难
   - 建议: 使用英文

2. **StreamConfig未定义但使用** (P1)
   - line 25: StreamConfig::default()但文件中未定义
   - 影响: 编译错误或未展示完整代码
   - 建议: 在types.rs中定义

3. **魔法数字60秒** (P3)
   - line 284: 硬编码清理间隔
   - 建议: 从config读取

## 轮次 5/5 - 细节与Bug层面

1. **actual_length计算可能溢出** (P3)
   - line 159: offset + actual_length理论上可能溢出u64
   - 建议: 使用checked_add

2. **data_stream未设置timeout** (P1)
   - lines 167-176: read_to_end可能永久hang
   - 影响: 会话永久blocked
   - 建议: 添加timeout

3. **sessions.remove返回值未使用** (P3)
   - line 208: 已经检查exists，remove返回值应该unwrap
   - 建议: unwrap或expect

**总问题数**: 18
**审查耗时**: 25分钟



