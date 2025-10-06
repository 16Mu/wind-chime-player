import { motion } from 'framer-motion'
import { Zap, Music2, Palette, Globe, Database, Shield } from 'lucide-react'
import AuroraBackground from '../components/AuroraBackground'

export default function FeaturesPage() {
  return (
    <div className="relative">
      <AuroraBackground />
      
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-6">强大特性</h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              WindChime Player 集成了众多创新功能，为你带来无与伦比的音乐体验
            </p>
          </motion.div>

          {/* Feature Sections */}
          <div className="space-y-32">
            {featureSections.map((section, index) => (
              <FeatureSection key={index} section={section} index={index} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

const featureSections = [
  {
    icon: <Zap className="w-12 h-12" />,
    title: "混合播放引擎",
    description: "创新的双引擎架构，智能切换实现零延迟 seek",
    features: [
      "Rust 原生引擎 + Web Audio API 双引擎架构",
      "零延迟 Seek - Web Audio API 实现内存级 seek（< 10ms）",
      "智能引擎切换 - 自动检测并平滑切换，用户无感知",
      "双层 Ref 模式 - 解决 React 闭包问题，实现稳定的函数引用"
    ],
    image: "screenshot-library.png"
  },
  {
    icon: <Music2 className="w-12 h-12" />,
    title: "沉浸式歌词体验",
    description: "全屏歌词展示，8种智能滚动动画，电影级音乐体验",
    features: [
      "8种智能滚动动画 - 支持实时切换和预览",
      "自适应动画 - 根据歌词时间间隔动态调整滚动参数",
      "单引擎歌词滚动 - 事件驱动的状态机，避免竞态条件",
      "多格式支持 - LRC、Enhanced LRC 等主流歌词格式"
    ],
    image: "screenshot-lyrics-1.png"
  },
  {
    icon: <Palette className="w-12 h-12" />,
    title: "macOS 风格设计",
    description: "完全对齐 Apple Music 视觉语言，优雅而现代",
    features: [
      "iOS 蓝主色调 - 采用标准 iOS 蓝（#007AFF）",
      "毛玻璃效果 - backdrop-filter 实现半透明背景",
      "双主题系统 - 深色/浅色模式无缝切换",
      "高对比度优化 - 浅色模式纯黑文字，提升可读性"
    ],
    image: "screenshot-albums.png"
  },
  {
    icon: <Globe className="w-12 h-12" />,
    title: "跨平台支持",
    description: "Windows、macOS、Linux 三大平台一键运行",
    features: [
      "Windows - MSI 和 NSIS 安装包，自动 WebView2",
      "macOS - Universal Binary（Intel + Apple Silicon）",
      "Linux - DEB 和 AppImage 双格式支持",
      "一致体验 - 所有平台保持相同的功能和界面"
    ],
    image: "screenshot-artists.png"
  },
  {
    icon: <Database className="w-12 h-12" />,
    title: "智能音乐管理",
    description: "强大的音乐库管理和智能歌单系统",
    features: [
      "SQLite FTS5 全文搜索 - 快速定位任何音乐",
      "智能歌单引擎 - 支持14种操作符和复杂逻辑组合",
      "导入导出 - M3U/M3U8/JSON 多格式支持",
      "播放历史 - 自动记录，统计分析，实时刷新"
    ],
    image: "screenshot-history.png"
  },
  {
    icon: <Shield className="w-12 h-12" />,
    title: "隐私与性能",
    description: "本地优先，高性能，完全掌控你的音乐数据",
    features: [
      "本地优先 - 所有数据存储在本地，完全掌控",
      "WebDAV 支持 - 可选的远程音乐源，流式播放",
      "性能优化 - 虚拟滚动、懒加载、智能预加载",
      "开源透明 - MIT 协议，代码完全开源"
    ],
    image: "screenshot-library.png"
  }
]

function FeatureSection({ section, index }: { section: typeof featureSections[0], index: number }) {
  const isEven = index % 2 === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
      className={`grid md:grid-cols-2 gap-12 items-center ${!isEven ? 'md:flex-row-reverse' : ''}`}
    >
      <div className={isEven ? 'md:order-1' : 'md:order-2'}>
        <div className="text-ios-blue mb-6">
          {section.icon}
        </div>
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          {section.title}
        </h2>
        <p className="text-xl text-gray-400 mb-8">
          {section.description}
        </p>
        <ul className="space-y-4">
          {section.features.map((feature, i) => (
            <li key={i} className="flex items-start space-x-3">
              <div className="mt-1 w-5 h-5 rounded-full bg-ios-blue/20 flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-ios-blue" />
              </div>
              <span className="text-gray-300">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={isEven ? 'md:order-2' : 'md:order-1'}>
        <div className="glass-dark rounded-2xl p-2 shadow-2xl">
          <img 
            src={`https://raw.githubusercontent.com/16Mu/wind-chime-player/master/${section.image}`}
            alt={section.title}
            className="rounded-xl w-full"
          />
        </div>
      </div>
    </motion.div>
  )
}

