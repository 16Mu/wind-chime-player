# 文件审查：src-tauri/src/playlist (4个剩余文件)

## mod.rs

### 简单导出模块，有良好的文档注释

**优点**: 设计原则清晰

无问题

---

## smart_playlist.rs

### 轮次1 - 架构

1. **部分字段功能未实现** (P1)
   - 位置: lines 65-80
   - 原因: DateAdded, LastPlayed, PlayCount, IsFavorite 都返回true
   - 影响: 智能歌单功能不完整，用户期望的功能不工作
   - 建议: 要么实现，要么从RuleField枚举中移除
   - 优先级: P1

2. **filter_tracks完整克隆所有曲目** (P1)
   - 位置: lines 22-38
   - 原因: .cloned().collect()克隆所有筛选的Track
   - 影响: 大库性能差
   - 建议: 返回Vec<&Track>或Vec<Arc<Track>>
   - 优先级: P1

### 轮次2 - 安全

无问题

### 轮次3 - 性能

1. **build_sql_where_clause未被使用** (P2)
   - 位置: lines 135-160
   - 原因: 定义了SQL查询优化但代码中未调用
   - 影响: 数据库层面的优化机会浪费
   - 建议: 集成到manager.rs的refresh_smart_playlist中
   - 优先级: P2

2. **filter_tracks对每个track重复计算** (P2)
   - 位置: lines 24-37
   - 原因: 两次迭代+filter，可以合并
   - 建议: 统一为一次迭代
   - 优先级: P2

3. **to_lowercase每次都调用** (P3)
   - 位置: lines 91, 94
   - 原因: 每次匹配都转换
   - 建议: 缓存小写版本或使用case-insensitive比较
   - 优先级: P3

### 轮次4 - 代码质量

1. **rule_to_sql返回Option<(String, Option<String>)>** (P3)
   - 位置: line 163
   - 原因: 嵌套Option不清晰
   - 建议: 定义struct SqlCondition { query: String, param: Option<String> }
   - 优先级: P3

2. **测试覆盖不全** (P3)
   - 位置: lines 204-286
   - 原因: 只测试了基本功能，未测试边界情况
   - 建议: 添加空规则、None值、SQL注入等测试
   - 优先级: P3

### 轮次5 - Bug

1. **limit为0时的处理逻辑** (P3)
   - 位置: lines 41-45
   - 原因: limit == 0时跳过truncate，但0应该表示"不限制"还是"清空"？
   - 影响: 语义不清
   - 建议: 文档注释明确或用Option<NonZeroU32>
   - 优先级: P3

2. **parse错误返回false可能掩盖问题** (P2)
   - 位置: lines 118-121
   - 原因: 数值解析失败默默返回false
   - 建议: 至少log warning
   - 优先级: P2

**总问题数**: 9

---

## importer.rs

### 轮次1 - 架构

1. **导入格式有限** (P2)
   - 位置: lines 34-37
   - 原因: 只支持M3U和JSON，缺少PLS, XSPF等
   - 影响: 用户导入其他格式失败
   - 建议: 添加更多格式支持或文档说明限制
   - 优先级: P2

### 轮次2 - 安全

1. **文件大小未限制** (P1)
   - 位置: line 24
   - 原因: fs::read_to_string可能读取几GB的文件
   - 影响: OOM或hang
   - 建议: 检查文件大小，限制最大10MB
   - 优先级: P1

2. **路径未规范化** (P1)
   - 位置: lines 58, 86
   - 原因: 直接使用用户输入的路径，可能包含../等
   - 影响: 路径遍历风险
   - 建议: 规范化路径或验证
   - 优先级: P1

### 轮次3 - 性能

1. **validate_paths串行检查** (P2)
   - 位置: lines 80-94
   - 原因: 大量路径检查很慢
   - 建议: 批量检查或异步
   - 优先级: P2

2. **Path::new().exists()多次调用** (P3)
   - 位置: lines 20, 85
   - 原因: exists()是IO操作
   - 建议: 缓存结果
   - 优先级: P3

### 轮次4 - 代码质量

1. **parse_m3u简单skip注释** (P2)
   - 位置: lines 48-55
   - 原因: M3U格式复杂，只支持#PLAYLIST标签
   - 影响: 丢失#EXTINF等元数据
   - 建议: 完整解析M3U规范
   - 优先级: P2

2. **错误消息混合英文中文** (P3)
   - 位置: lines 21, 61等
   - 原因: 不一致
   - 建议: 统一语言
   - 优先级: P3

### 轮次5 - Bug

1. **#PLAYLIST:解析可能越界** (P2)
   - 位置: line 52
   - 原因: line[10..]未检查长度
   - 影响: 如果line == "#PLAYLIST:"会panic
   - 建议: 使用get(10..)或检查长度
   - 优先级: P2

2. **detect_format与import_from_file重复逻辑** (P3)
   - 位置: lines 28-31, 97-111
   - 原因: 扩展名解析重复
   - 建议: DRY原则，提取公共函数
   - 优先级: P3

**总问题数**: 9

---

## exporter.rs

### 轮次1 - 架构

良好的导出器设计

### 轮次2 - 安全

1. **文件覆盖无警告** (P2)
   - 位置: line 39
   - 原因: File::create直接覆盖已存在文件
   - 影响: 用户数据丢失
   - 建议: 检查文件存在并提示
   - 优先级: P2

### 轮次3 - 性能

1. **export_to_string使用String拼接** (P2)
   - 位置: lines 121-133
   - 原因: 多次push_str效率低
   - 建议: 预估容量或使用format!宏
   - 优先级: P2

### 轮次4 - 代码质量

1. **M3U和M3U8的utf8参数未使用** (P1)
   - 位置: lines 37, 43-46
   - 原因: utf8参数传入但写入逻辑完全相同
   - 影响: M3U8应该是UTF-8编码，M3U是Latin-1，但代码未区分
   - 建议: M3U使用特定编码写入或文档说明
   - 优先级: P1

2. **validate_export_path只warning不阻止** (P3)
   - 位置: lines 158-162
   - 原因: 扩展名不匹配只log，不返回错误
   - 建议: 根据需求决定是否应该是错误
   - 优先级: P3

### 轮次5 - Bug

1. **duration_ms除以1000可能丢失精度** (P3)
   - 位置: lines 60, 127
   - 原因: M3U格式只支持秒，但丢失毫秒信息
   - 影响: 不影响功能，但信息丢失
   - 建议: 文档说明或四舍五入
   - 优先级: P3

**总问题数**: 5

---

## 📊 Playlist剩余模块总结

**审查的文件数**: 4个  
**发现的总问题**: 23个

**按优先级分布**:
- P0 (严重): 0个

- P1 (重要): 5个
  1. smart_playlist.rs: 部分字段功能未实现
  2. smart_playlist.rs: filter_tracks完整克隆
  3. importer.rs: 文件大小未限制
  4. importer.rs: 路径未规范化
  5. exporter.rs: M3U和M3U8编码未区分

- P2 (计划): 11个
- P3 (可选): 7个

**按问题类型**:
- 架构问题: 4个
- 安全问题: 3个
- 性能问题: 7个
- 代码质量: 6个
- Bug/细节: 3个

---

## 🎯 优先修复建议

### 本周修复
1. **实现智能歌单缺失字段** - 功能完整性
2. **文件大小限制** - 安全性
3. **路径规范化** - 安全性
4. **M3U8编码正确处理** - 功能正确性

### 下周修复
5. 优化filter_tracks避免克隆
6. 集成SQL查询优化
7. 完善M3U解析

---

**审查耗时**: 约1小时  
**审查人**: AI Code Reviewer  
**审查日期**: 2025-10-04


