# Seek 功能测试指南

> 测试 Seek 修复是否生效

---

## 🎯 快速测试步骤

### 测试 1：早期 Seek（预期：提示等待）

1. **打开应用**，点击播放任意歌曲
2. **立即点击进度条**（在播放开始后 0-1 秒内）
3. **查看结果**：
   - ✅ 应该看到提示："正在加载高速跳转功能，请稍候..."
   - ✅ 控制台应该有日志：
     ```
     🔍 [HybridPlayer] Seek 请求: X.XXs { currentEngine: 'rust', isWebAudioReady: false, willUse: 'Rust' }
     ⚠️ [HybridPlayer] 使用 Rust seek（流式播放模式下可能失败）
     ❌ [HybridPlayer] Rust seek 失败（预期的 - 流式播放不支持）
     💡 [HybridPlayer] 等待 Web Audio 引擎就绪后再尝试 seek
     💡 [Seek] 提示：Web Audio 引擎正在后台加载，稍后即可支持快速跳转
     ```

### 测试 2：Web Audio 就绪后 Seek（预期：快速跳转）

1. **继续播放**，等待 1-2 秒
2. **再次点击进度条**
3. **查看结果**：
   - ✅ 应该立即跳转到新位置（< 10ms）
   - ✅ 控制台应该有日志：
     ```
     🔍 [HybridPlayer] Seek 请求: X.XXs { currentEngine: 'webaudio', isWebAudioReady: true, willUse: 'Web Audio' }
     ⚡ [WebAudioPlayer] Seek 到 X.XXs (0 延迟)
     ⚡ [HybridPlayer] Seek → X.XXs [引擎: Web Audio] [耗时: 3ms] ✨ 0 延迟!
     ✅ [Seek] 跳转完成
     ```

### 测试 3：引擎切换日志（验证混合播放器）

1. **播放任意歌曲**
2. **查看控制台**，应该看到完整的引擎切换过程：
   ```
   🎵 [HybridPlayer] 播放: 歌曲名
   ⚡ Rust 播放器启动 (~100ms)
   💾 Web Audio 后台加载...
   ✅ Web Audio 后台加载完成 (~800ms)
   🔄 准备切换引擎...
   ⏹️ Rust 播放器已停止
   ✅ Web Audio 播放启动
   🎉 引擎切换完成！ Rust → Web Audio
   🎯 ⚡ 现在支持 0 延迟 seek (<10ms)！
   ```

---

## 🐛 如果出现问题

### 问题 1：没有任何 [HybridPlayer] 日志

**可能原因**：混合播放器未初始化

**检查**：
1. 打开浏览器控制台
2. 搜索 `[HybridPlayer] 初始化`
3. 应该看到：`✅ [HybridPlayer] 初始化完成`

**解决**：重启应用

### 问题 2：一直显示 "正在加载高速跳转功能"

**可能原因**：Web Audio 加载失败

**检查**：
1. 搜索控制台日志：`Web Audio 后台加载失败`
2. 查看错误详情

**解决**：
- 检查音频文件是否存在
- 检查文件权限
- 重新播放歌曲

### 问题 3：Seek 后没有任何反应

**可能原因**：混合播放器未被使用

**检查**：
1. 在 `src/App.tsx` 中搜索 `hybridPlayer.play`
2. 确认 handleTrackSelect 使用了混合播放器

---

## 📊 预期行为总结

| 时间 | 引擎 | Seek 可用 | 响应时间 |
|------|------|----------|---------|
| 0-100ms | Rust 启动中 | ❌ | - |
| 100-800ms | Rust 流式播放 | ❌ (提示等待) | - |
| 800ms+ | Web Audio | ✅ | < 10ms |

---

## ✅ 测试完成检查清单

- [ ] 早期 Seek 显示提示（0-800ms）
- [ ] 晚期 Seek 快速响应（800ms+）
- [ ] 看到完整的引擎切换日志
- [ ] 看到详细的 Seek 调试日志
- [ ] 没有控制台错误（除了预期的 Rust seek 失败）

---

**所有测试通过？恭喜！Seek 功能正常工作！** 🎉




