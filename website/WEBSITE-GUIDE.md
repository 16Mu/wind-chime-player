# WindChime Player 官网开发指南

## 🎯 项目概述

这是一个为 WindChime Player 打造的现代化官方网站，采用与主应用一致的技术栈和设计语言。

## ✨ 核心特性

### 1. Liquid Chrome 背景效果

参考了 [ReactBits Liquid Chrome](https://www.reactbits.dev/backgrounds/liquid-chrome) 的设计理念，创建了适合音乐主题的流动渐变背景。

**实现要点：**
- 使用 CSS 渐变和关键帧动画
- 采用音乐主题的配色（iOS 蓝、紫色、粉色等）
- 结合 Framer Motion 实现动态光球效果
- 添加深色遮罩层提升文字可读性

**自定义背景：**

编辑 `src/components/LiquidChromeBackground.tsx`:

```tsx
// 修改颜色方案
background: linear-gradient(
  135deg,
  #007AFF 0%,      // iOS 蓝
  #5856D6 20%,     // 紫色
  #AF52DE 40%,     // 紫红
  #FF2D55 60%,     // 粉红
  #FF9500 80%,     // 橙色
  #007AFF 100%     // 回到蓝色
);

// 调整动画速度
animation: liquid-chrome 20s ease infinite;
```

### 2. 响应式设计

**断点设置（Tailwind CSS）：**
- `sm`: 640px+  （手机横屏）
- `md`: 768px+  （平板）
- `lg`: 1024px+ （桌面）
- `xl`: 1280px+ （大屏幕）

**最佳实践：**
```tsx
// 移动优先
<div className="text-lg md:text-xl lg:text-2xl">
  // 默认 text-lg，平板以上 text-xl，桌面以上 text-2xl
</div>

// 网格布局
<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
  // 默认单列，平板2列，桌面3列
</div>
```

### 3. 毛玻璃效果

**预定义类：**
```css
.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.glass-dark {
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

**使用示例：**
```tsx
<div className="glass-dark rounded-2xl p-8">
  内容
</div>
```

### 4. 动画效果

使用 Framer Motion 实现页面滚动动画：

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6 }}
  viewport={{ once: true }}
>
  内容在滚动时淡入并上移
</motion.div>
```

**常用动画模式：**
- `initial`: 初始状态
- `animate`: 动画状态
- `whileInView`: 进入视口时的状态
- `viewport={{ once: true }}`: 只播放一次

## 📁 文件结构详解

```
website/
├── src/
│   ├── components/
│   │   ├── LiquidChromeBackground.tsx  # 背景效果组件
│   │   └── Navbar.tsx                  # 导航栏组件
│   │
│   ├── pages/
│   │   ├── HomePage.tsx      # 首页 - Hero、特性、技术栈
│   │   ├── FeaturesPage.tsx  # 特性详情页
│   │   └── DownloadPage.tsx  # 下载页 - 平台选择、安装指南
│   │
│   ├── App.tsx        # 路由配置
│   ├── main.tsx       # React 入口
│   └── index.css      # 全局样式、动画定义
│
├── public/            # 静态资源
├── .github/workflows/ # CI/CD 配置
└── 配置文件...
```

## 🎨 设计系统

### 颜色规范

**主色调：**
```js
'ios-blue': '#007AFF'  // iOS 蓝，用于 CTA、链接、强调
```

**macOS 灰度：**
```js
'macos-gray': {
  50: '#F5F5F7',   // 最浅
  400: '#86868B',  // 中等
  900: '#1C1C1E',  // 最深（背景）
}
```

### 字体规范

- **标题**: 粗体（font-bold）
- **正文**: 常规（默认）
- **大小梯度**: text-sm → text-base → text-lg → text-xl → text-2xl...

### 间距规范

使用 Tailwind 的间距系统：
- `p-4`: 1rem (16px)
- `p-6`: 1.5rem (24px)
- `p-8`: 2rem (32px)
- `gap-8`: 元素间距 2rem

## 🔧 开发技巧

### 1. 添加新页面

**步骤：**

1. 创建页面组件 `src/pages/NewPage.tsx`:
```tsx
import LiquidChromeBackground from '../components/LiquidChromeBackground'

export default function NewPage() {
  return (
    <div className="relative">
      <LiquidChromeBackground />
      <section className="relative pt-32 pb-20 px-4">
        {/* 内容 */}
      </section>
    </div>
  )
}
```

2. 在 `src/App.tsx` 添加路由:
```tsx
import NewPage from './pages/NewPage'

<Route path="/new" element={<NewPage />} />
```

3. 在导航栏添加链接:
```tsx
<Link to="/new">新页面</Link>
```

### 2. 优化图片加载

**使用 GitHub 原图：**
```tsx
<img 
  src="https://raw.githubusercontent.com/16Mu/wind-chime-player/master/screenshot-library.png"
  alt="描述"
  loading="lazy"  // 懒加载
/>
```

**或使用本地图片：**
1. 将图片放到 `public/images/`
2. 引用: `src="/wind-chime-player/images/xxx.png"`

### 3. SEO 优化

**更新 Meta 标签（`index.html`）：**
```html
<meta name="description" content="网站描述" />
<meta name="keywords" content="关键词1,关键词2" />
<meta property="og:title" content="社交分享标题" />
<meta property="og:image" content="分享图片URL" />
```

**添加结构化数据：**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "WindChime Player",
  "description": "...",
  "operatingSystem": "Windows, macOS, Linux"
}
</script>
```

### 4. 性能优化

**代码分割：**
```tsx
import { lazy, Suspense } from 'react'

const FeaturesPage = lazy(() => import('./pages/FeaturesPage'))

<Suspense fallback={<div>Loading...</div>}>
  <Route path="/features" element={<FeaturesPage />} />
</Suspense>
```

**图片优化：**
- 使用 WebP 格式
- 设置合适的尺寸
- 启用懒加载

## 📊 引流策略

### 1. SEO 优化清单

- [x] 语义化 HTML 结构
- [x] Meta 标签完整
- [x] Open Graph 支持
- [ ] 生成 sitemap.xml
- [ ] 添加 robots.txt
- [ ] 结构化数据标记

### 2. 社交媒体分享

已配置 Open Graph 标签，分享到社交媒体时会显示：
- 标题
- 描述
- 预览图（需要添加）

### 3. 社区推广建议

**国外平台：**
- Product Hunt
- Hacker News
- Reddit (r/opensource, r/rust, r/reactjs)
- Twitter

**国内平台：**
- V2EX
- 少数派
- 掘金
- 知乎

**推广文案示例：**
```
🎵 WindChime Player - 开源跨平台音乐播放器

✨ 特性：
• 混合播放引擎，零延迟 seek
• macOS 风格设计，沉浸式歌词
• 支持 WebDAV 远程音乐源
• Windows/macOS/Linux 全平台

🔗 官网：https://16mu.github.io/wind-chime-player/
💻 GitHub：https://github.com/16Mu/wind-chime-player
```

## 🚀 部署清单

上线前检查：

- [ ] 所有链接可访问
- [ ] 图片加载正常
- [ ] 移动端适配完美
- [ ] 浏览器兼容性测试
- [ ] 加载速度优化
- [ ] SEO 标签完整
- [ ] GitHub Actions 配置正确
- [ ] 404 页面处理

## 📚 参考资源

### 设计灵感
- [ReactBits Backgrounds](https://www.reactbits.dev/backgrounds) - 背景效果参考
- [Apple Design Resources](https://developer.apple.com/design/resources/) - macOS 设计规范
- [Tailwind UI](https://tailwindui.com/) - UI 组件参考

### 技术文档
- [Vite 文档](https://vitejs.dev/)
- [React Router](https://reactrouter.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Tailwind CSS](https://tailwindcss.com/)

### 部署平台
- [GitHub Pages](https://pages.github.com/)
- [Vercel](https://vercel.com/)
- [Netlify](https://www.netlify.com/)

## 🤝 贡献指南

欢迎贡献：
- 设计改进
- 新功能页面
- 性能优化
- 文档完善
- Bug 修复

提交 PR 时请确保：
1. 代码风格一致
2. 移动端适配
3. 无 TypeScript 错误
4. 测试通过

---

有问题？查看 [部署指南](./DEPLOYMENT.md) 或提交 Issue。

