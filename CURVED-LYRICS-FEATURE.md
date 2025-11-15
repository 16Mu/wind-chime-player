# 曲线歌词模式 - 功能说明

## 概述

全新的沉浸式歌词显示模式，基于**可调节曲率的参考线系统**，歌词垂直于参考线动态排列，带来独特的视觉体验。

## 核心特性

### 1. 曲线参考系统 📐
- **黄色参考线**：可调节曲率的中轴线，歌词沿此滚动
- **曲率调节**：范围 -2 到 +2
  - `0`：直线模式
  - 正值：向右弯曲
  - 负值：向左弯曲
- **抛物线公式**：`x = curvature * (t - 0.5)²`

### 2. 歌词垂直排列 📝
- 每句歌词垂直于参考线（如图3中的绿色线）
- 歌词随曲线变化自动调整角度
- 当前播放行自动高亮并居中

### 3. 圆形专辑封面 🎵
- 左侧显示圆形专辑封面（直径 256px）
- 下方显示歌曲信息：
  - 歌曲标题
  - 艺术家
  - 专辑名称

### 4. 智能控件显示 🖱️
- 曲率控制面板默认隐藏
- 鼠标移动时自动显示
- 3秒无操作后自动隐藏

## 技术实现

### 组件结构

```
CurvedLyricsPanel.tsx          // 面板容器，处理数据加载
  └─ CurvedLyricsFlow.tsx      // 核心渲染组件
       ├─ 专辑封面区域
       ├─ 歌词渲染区域
       └─ 曲率控制面板
```

### 核心算法

#### 曲线位置计算
```typescript
const getCurvePoint = (t: number, curvature: number) => {
  const y = t; // Y坐标 0-1
  const normalizedT = t - 0.5; // 归一化到 [-0.5, 0.5]
  const x = curvature * normalizedT * normalizedT; // 抛物线
  return { x, y };
}
```

#### 垂直角度计算
```typescript
const getPerpedicularAngle = (t: number, curvature: number) => {
  const normalizedT = t - 0.5;
  const tangentSlope = 2 * curvature * normalizedT; // 切线斜率
  const tangentAngle = Math.atan(tangentSlope);
  return tangentAngle + Math.PI / 2; // 垂直于切线
}
```

## 使用方法

### 1. 启动应用
打开 Wind Chime Player 并播放任意歌曲

### 2. 进入沉浸式歌词
点击歌词区域的展开按钮

### 3. 切换到曲线模式
1. 移动鼠标显示控件
2. 点击左上角的布局切换按钮
3. 选择"**曲线歌词**"模式

### 4. 调节曲率
1. 移动鼠标显示右下角的曲率控制面板
2. 拖动滑块调节曲率值
3. 实时观察歌词排列变化

## 视觉效果

### 直线模式（curvature = 0）
```
      🎵
       |
歌词1  |  歌词1
歌词2  |  歌词2
歌词3  |  歌词3
```

### 弧线模式（curvature > 0）
```
      🎵
       |
歌词1  |      歌词1
  歌词2|    歌词2
    歌词3| 歌词3
```

## 配置参数

### 显示范围
- `LINES_BEFORE`: 6 行（当前行之前）
- `LINES_AFTER`: 6 行（当前行之后）
- 总显示行数：13 行

### 样式设置
- **当前行**：
  - 字号：2.2rem
  - 字重：700
  - 不透明度：1.0
  - 发光效果：白色辉光
  
- **其他行**：
  - 字号：1.5rem
  - 字重：400
  - 不透明度：渐变（0.25 - 1.0）

### 动画参数
- 过渡时间：0.8秒
- 缓动函数：cubic-bezier(0.4, 0, 0.2, 1)

## 开发模式

在开发环境下，会显示黄色参考线用于调试：
```typescript
{process.env.NODE_ENV === 'development' && (
  <svg>
    <path stroke="rgba(255, 255, 0, 0.3)" ... />
  </svg>
)}
```

## 未来优化方向

1. **更多曲线类型**
   - 正弦曲线
   - 三次贝塞尔曲线
   - 螺旋线

2. **动画效果**
   - 曲率自动变化
   - 歌词淡入淡出
   - 粒子效果

3. **交互增强**
   - 触摸手势调节曲率
   - 双击重置
   - 预设模板

4. **性能优化**
   - 虚拟滚动
   - Canvas 渲染
   - GPU 加速

## 文件清单

- `src/components/immersive/CurvedLyricsFlow.tsx` - 核心组件
- `src/components/immersive/CurvedLyricsPanel.tsx` - 面板容器
- `src/components/immersive/index.ts` - 导出配置
- `src/components/ImmersiveLyricsView.tsx` - 集成点

---

**创建时间**: 2025-11-16  
**版本**: v1.0.0  
**作者**: Cascade AI Assistant
