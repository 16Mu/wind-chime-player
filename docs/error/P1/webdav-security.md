# 文件审查：src-tauri/src/webdav (client.rs + auth.rs)

## client.rs

### 轮次1 - 架构
1. **过多职责混合** (P2)
   - lines 14-27: 既管理HTTP又管理认证又管理统计
   - 建议: 拆分为独立模块

2. **统计信息使用RwLock可能成为瓶颈** (P2)
   - line 26: 每个操作都write lock stats
   - 建议: 使用原子计数器或批量更新

3. **实现两个trait导致重复代码** (P1)
   - lines 519-598: WebDAVClientTrait实现重复调用自身方法
   - 建议: 重构接口设计

### 轮次2 - 安全
1. **danger_accept_invalid_certs存在中间人攻击风险** (P0)
   - line 43: 允许无效证书
   - 影响: 严重安全漏洞
   - 建议: 默认禁用，添加明确警告

2. **URL拼接可能导致路径遍历** (P1)
   - line 338: build_full_url未验证path
   - 影响: 可能访问非预期路径
   - 建议: 验证和规范化path

3. **认证header可能在日志中泄露** (P1)
   - line 378: log可能包含完整URL（含认证）
   - 建议: 过滤敏感信息

### 轮次3 - 性能
1. **parse_propfind_response每次都解析XML** (P1)
   - line 445: XML解析昂贵
   - 建议: 缓存结果

2. **平均响应时间计算不准确** (P2)
   - line 506: 0.9权重的指数移动平均不合理
   - 建议: 使用标准EMA或简单平均

3. **ensure_parent_directories可能递归创建很多目录** (P2)
   - lines 461-486: 深层路径性能差
   - 建议: 批量创建或缓存已创建

### 轮次4 - 代码质量
1. **错误消息硬编码中文** (P3)
   - 多处: 国际化问题

2. **未处理所有HTTP状态码** (P2)
   - send_request只检查401
   - 建议: 完整处理4xx/5xx

3. **download_stream返回impl trait** (P2)
   - line 184: 难以mock和测试
   - 建议: 使用BoxStream

### 轮次5 - Bug
1. **download_range不检查206状态码** (P1)
   - line 214: 只warn不返回错误
   - 影响: 可能下载完整文件但认为是range
   - 建议: 严格检查206或返回错误

2. **strip_prefix可能失败** (P2)
   - lines 523, 548, 574: unwrap_or可能导致错误路径
   - 建议: 明确处理

**总问题数**: 15

---

## auth.rs

### 轮次1 - 架构
1. **Digest认证未实现** (P2)
   - lines 84-88: 返回错误但已定义类型
   - 建议: 完整实现或移除

2. **AuthType包含password明文** (P0)
   - lines 10-27: String存储密码
   - 影响: 严重安全问题
   - 建议: 使用SecureString或zeroize

### 轮次2 - 安全
1. **base64编码未清理内存** (P1)
   - lines 58-59: 编码后credentials String未清理
   - 影响: 密码残留内存
   - 建议: 使用zeroize清理

2. **create_basic_auth返回String暴露密码** (P1)
   - lines 203-207: 返回包含密码的String
   - 建议: 直接返回HeaderValue

3. **validate_basic_auth返回密码** (P1)
   - lines 210-230: 解码并返回明文密码
   - 影响: 敏感信息暴露
   - 建议: 只验证不返回

### 轮次3 - 性能
1. **每次请求都格式化credentials** (P2)
   - lines 58-60: 可以预计算
   - 建议: 缓存encoded auth header

### 轮次4 - 代码质量
1. **空密码只warn** (P2)
   - lines 119-121: 应该返回错误
   - 建议: 严格验证

### 轮次5 - Bug
1. **handle_auth_challenge未实际更新state** (P2)
   - line 147: mut self但未修改任何字段
   - 建议: 移除mut或实际更新

**总问题数**: 9

---

**WebDAV模块总计**: 24个问题
**严重问题**: 2个P0级别（密码明文、SSL禁用）
**审查耗时**: 约25分钟



