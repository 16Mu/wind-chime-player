# WindChime Player 官方网站

这是 WindChime Player 的官方网站源代码，使用 React + TypeScript + Tailwind CSS 构建。

## 🎨 设计特点

- **Liquid Chrome 背景效果** - 流动的渐变背景，营造现代科技感
- **响应式设计** - 完美适配桌面、平板和移动设备
- **macOS 风格** - 与应用保持一致的设计语言
- **动画效果** - 使用 Framer Motion 实现流畅的页面过渡

## 🚀 本地开发

### 安装依赖

```bash
cd website
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

## 📦 部署

网站自动部署到 GitHub Pages，通过 GitHub Actions 实现：

1. 推送代码到 `master` 分支
2. GitHub Actions 自动构建
3. 部署到 GitHub Pages
4. 访问: https://16mu.github.io/wind-chime-player/

## 📁 项目结构

```
website/
├── src/
│   ├── components/          # React 组件
│   │   ├── LiquidChromeBackground.tsx  # 背景效果
│   │   └── Navbar.tsx                  # 导航栏
│   ├── pages/              # 页面组件
│   │   ├── HomePage.tsx    # 首页
│   │   ├── FeaturesPage.tsx # 特性页
│   │   └── DownloadPage.tsx # 下载页
│   ├── App.tsx            # 主应用
│   ├── main.tsx           # 入口文件
│   └── index.css          # 全局样式
├── public/                # 静态资源
├── .github/
│   └── workflows/
│       └── deploy.yml     # 自动部署配置
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🎨 自定义

### 修改主题色

编辑 `tailwind.config.js`:

```js
colors: {
  'ios-blue': '#007AFF',  // 主色调
  // ... 其他颜色
}
```

### 修改背景效果

编辑 `src/components/LiquidChromeBackground.tsx`

### 添加新页面

1. 在 `src/pages/` 创建新页面组件
2. 在 `src/App.tsx` 添加路由

## 📝 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **样式**: Tailwind CSS
- **动画**: Framer Motion
- **路由**: React Router 6
- **图标**: Lucide React
- **部署**: GitHub Pages

## 📄 开源协议

MIT License - 与主项目保持一致

