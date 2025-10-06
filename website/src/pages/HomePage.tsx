import { motion, useScroll, useTransform } from 'framer-motion'
import { Download, Github, Zap, Sparkles, Music2, Heart, Layers, Database, Shield, Code2, Gauge, Wifi } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRef } from 'react'
import AuroraBackground from '../components/AuroraBackground'
import ScreenshotShowcase from '../components/ScreenshotShowcase'
import InteractiveFeatureDemo from '../components/InteractiveFeatureDemo'
import CodeDemo from '../components/CodeDemo'
import FloatingFeatures from '../components/FloatingFeatures'
import Tilt3DCard from '../components/Tilt3DCard'

export default function HomePage() {
  const containerRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  })

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

  return (
    <div className="relative" ref={containerRef}>
      <AuroraBackground />
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <motion.div 
          className="max-w-7xl mx-auto text-center"
          style={{ y, opacity }}
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            {/* 小标签 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="inline-flex items-center space-x-2 glass-dark px-4 py-2 rounded-full mb-8"
            >
              <Sparkles className="w-4 h-4 text-ios-blue" />
              <span className="text-sm font-medium">v0.4.1 · Windows / macOS / Linux</span>
            </motion.div>

            {/* 超大标题 */}
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black mb-8 leading-none">
              <span className="block bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-purple-200">
                WindChime
              </span>
              <span className="block mt-2 bg-clip-text text-transparent bg-gradient-to-r from-ios-blue via-purple-400 to-pink-400">
                Player
              </span>
            </h1>

            <p className="text-2xl md:text-3xl text-gray-300 mb-6 max-w-4xl mx-auto font-light">
              让音乐如风铃般轻盈悦耳
            </p>

            <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
              混合播放引擎 · 零延迟 Seek · 沉浸式歌词 · macOS 风格设计
            </p>

            {/* CTA 按钮组 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Link
                to="/download"
                className="group relative px-10 py-5 bg-ios-blue rounded-2xl font-bold text-lg overflow-hidden transition-all hover:scale-105 hover:shadow-2xl hover:shadow-ios-blue/50"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center space-x-2">
                  <Download className="w-5 h-5" />
                  <span>免费下载</span>
                </span>
              </Link>
              
              <a
                href="https://github.com/16Mu/wind-chime-player"
                target="_blank"
                rel="noopener noreferrer"
                className="group px-10 py-5 glass-dark rounded-2xl font-semibold text-lg hover:bg-white/20 transition-all flex items-center space-x-2"
              >
                <Github className="w-5 h-5" />
                <span>View on GitHub</span>
              </a>
            </motion.div>

            {/* 统计数据 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="mt-20 grid grid-cols-3 gap-8 max-w-3xl mx-auto"
            >
              <div className="text-center">
                <div className="text-4xl font-bold text-ios-blue mb-2">&lt; 10ms</div>
                <div className="text-sm text-gray-400">Seek 延迟</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-400 mb-2">3</div>
                <div className="text-sm text-gray-400">支持平台</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-pink-400 mb-2">100%</div>
                <div className="text-sm text-gray-400">开源免费</div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* 滚动提示 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-2"
          >
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1.5 h-1.5 bg-white rounded-full"
            />
          </motion.div>
        </motion.div>
      </section>

      {/* 浮动特性卡片 */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <FloatingFeatures />
        </div>
      </section>

      {/* 交互式播放器演示 */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center space-x-2 glass-dark px-3 py-1 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-ios-blue" />
              <span className="text-sm">交互式演示</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              体验零延迟播放
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              混合播放引擎带来前所未有的响应速度，Seek 延迟低于 10ms，让你的每一次操作都即时生效。
            </p>
            <div className="space-y-4">
              <FeaturePoint 
                title="即时响应"
                description="Web Audio API 内存级操作"
              />
              <FeaturePoint 
                title="智能切换"
                description="双引擎自动选择最优方案"
              />
              <FeaturePoint 
                title="流畅播放"
                description="60fps 无卡顿体验"
              />
            </div>
          </motion.div>

          <Tilt3DCard>
            <InteractiveFeatureDemo />
          </Tilt3DCard>
        </div>
      </section>

      {/* Screenshot Showcase */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-6xl font-bold mb-4">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              精心设计的界面
            </span>
          </h2>
          <p className="text-xl text-gray-400">
            每一个细节都经过精心打磨
          </p>
        </motion.div>
        <ScreenshotShowcase />
      </section>

      {/* 代码演示区域 */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <Tilt3DCard>
            <CodeDemo />
          </Tilt3DCard>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center space-x-2 glass-dark px-3 py-1 rounded-full mb-6">
              <Code2 className="w-4 h-4 text-purple-400" />
              <span className="text-sm">开发者友好</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              现代化技术栈
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              使用最新的技术构建，Rust 保证性能，TypeScript 确保类型安全，WebGL 实现炫酷效果。
            </p>
            <div className="space-y-4">
              <TechPoint 
                icon="🦀"
                title="Rust 后端"
                description="Actor 模型 + 零成本抽象"
              />
              <TechPoint 
                icon="⚛️"
                title="React 前端"
                description="React 19 + TypeScript + Tailwind"
              />
              <TechPoint 
                icon="🎨"
                title="WebGL 渲染"
                description="GPU 加速的视觉效果"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bento Grid - 特性展示 */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-7xl font-bold mb-6">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                核心特性
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              为现代音乐爱好者打造的完美播放器
            </p>
          </motion.div>

          {/* Bento Grid 布局 */}
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* 混合播放引擎 - 超大卡片 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="group md:col-span-4 lg:col-span-4 relative overflow-hidden rounded-3xl glass-dark p-10 hover:bg-white/10 transition-all"
            >
              <div className="absolute -inset-1 bg-gradient-to-br from-blue-500 to-purple-500 opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-500" />
              
              <div className="relative">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 mb-4">
                      <Zap className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-4xl font-bold mb-3">混合播放引擎</h3>
                    <p className="text-gray-400 text-lg mb-6">创新的双引擎架构，实现零延迟 seek</p>
                  </div>
                  <div className="hidden lg:block text-6xl opacity-10">⚡</div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <FeatureItem 
                      icon={<Code2 className="w-5 h-5" />}
                      title="Rust + Web Audio API"
                      description="双引擎协同工作，智能切换"
                    />
                    <FeatureItem 
                      icon={<Gauge className="w-5 h-5" />}
                      title="零延迟 Seek"
                      description="内存级操作，响应时间 < 10ms"
                    />
                  </div>
                  <div className="space-y-4">
                    <FeatureItem 
                      icon={<Sparkles className="w-5 h-5" />}
                      title="Actor 模型架构"
                      description="清晰的职责分离，高并发性能"
                    />
                    <FeatureItem 
                      icon={<Shield className="w-5 h-5" />}
                      title="智能缓存系统"
                      description="LRU 算法，预加载优化"
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 沉浸式歌词 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="group md:col-span-2 lg:col-span-2 relative overflow-hidden rounded-3xl glass-dark p-8 hover:bg-white/10 transition-all"
            >
              <div className="absolute -inset-1 bg-gradient-to-br from-purple-500 to-pink-500 opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-500" />
              
              <div className="relative">
                <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4">
                  <Music2 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">沉浸式歌词</h3>
                <p className="text-gray-400 mb-4">8种智能滚动动画</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center space-x-2 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
                    <span>全屏展示</span>
                  </li>
                  <li className="flex items-center space-x-2 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
                    <span>实时同步</span>
                  </li>
                  <li className="flex items-center space-x-2 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
                    <span>网络获取</span>
                  </li>
                </ul>
              </div>
            </motion.div>

            {/* macOS 设计 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="group md:col-span-2 lg:col-span-3 relative overflow-hidden rounded-3xl glass-dark p-8 hover:bg-white/10 transition-all"
            >
              <div className="absolute -inset-1 bg-gradient-to-br from-cyan-500 to-blue-500 opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-500" />
              
              <div className="relative">
                <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 mb-4">
                  <Layers className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">macOS 风格设计</h3>
                <p className="text-gray-400 mb-4">完全对齐 Apple Music</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center space-x-2 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" />
                    <span>iOS 蓝主色调</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" />
                    <span>毛玻璃效果</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" />
                    <span>深浅主题</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" />
                    <span>响应式动画</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 智能音乐管理 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
              className="group md:col-span-2 lg:col-span-3 relative overflow-hidden rounded-3xl glass-dark p-8 hover:bg-white/10 transition-all"
            >
              <div className="absolute -inset-1 bg-gradient-to-br from-green-500 to-emerald-500 opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-500" />
              
              <div className="relative">
                <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 mb-4">
                  <Database className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">智能音乐管理</h3>
                <p className="text-gray-400 mb-4">强大的音乐库和歌单系统</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center space-x-2 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500" />
                    <span>FTS5 全文搜索</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500" />
                    <span>智能歌单</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500" />
                    <span>导入导出</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500" />
                    <span>播放历史</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* WebDAV 支持 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              viewport={{ once: true }}
              className="group md:col-span-2 lg:col-span-2 relative overflow-hidden rounded-3xl glass-dark p-8 hover:bg-white/10 transition-all"
            >
              <div className="absolute -inset-1 bg-gradient-to-br from-orange-500 to-red-500 opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-500" />
              
              <div className="relative">
                <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 mb-4">
                  <Wifi className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">远程音乐源</h3>
                <p className="text-gray-400 mb-4">WebDAV 集成</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center space-x-2 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500" />
                    <span>流式播放</span>
                  </li>
                  <li className="flex items-center space-x-2 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500" />
                    <span>混合音乐源</span>
                  </li>
                </ul>
              </div>
            </motion.div>

            {/* 开源免费 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              viewport={{ once: true }}
              className="group md:col-span-2 lg:col-span-2 relative overflow-hidden rounded-3xl glass-dark p-8 hover:bg-white/10 transition-all"
            >
              <div className="absolute -inset-1 bg-gradient-to-br from-pink-500 to-rose-500 opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-500" />
              
              <div className="relative">
                <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 mb-4">
                  <Heart className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">开源免费</h3>
                <p className="text-gray-400 mb-4">MIT 协议</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center space-x-2 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500" />
                    <span>完全开源</span>
                  </li>
                  <li className="flex items-center space-x-2 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500" />
                    <span>永久免费</span>
                  </li>
                </ul>
              </div>
            </motion.div>

            {/* 跨平台支持 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              viewport={{ once: true }}
              className="group md:col-span-2 lg:col-span-2 relative overflow-hidden rounded-3xl glass-dark p-8 hover:bg-white/10 transition-all"
            >
              <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-500" />
              
              <div className="relative">
                <div className="flex items-center space-x-3 mb-4">
                  <span className="text-3xl">🪟</span>
                  <span className="text-3xl">🍎</span>
                  <span className="text-3xl">🐧</span>
                </div>
                <h3 className="text-2xl font-bold mb-3">跨平台</h3>
                <p className="text-gray-400 text-sm">Windows / macOS / Linux</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 技术栈展示 */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-7xl font-bold mb-6">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                现代化技术栈
              </span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            <TechStackCard
              emoji="⚛️"
              title="前端"
              tech="React 19"
              description="TypeScript + Tailwind CSS + Vite"
              color="from-blue-400 to-cyan-400"
              details={["React 19", "TypeScript", "Tailwind CSS", "Framer Motion"]}
            />
            <TechStackCard
              emoji="🦀"
              title="后端"
              tech="Rust"
              description="Tauri 2.0 + SQLite + Actor 模型"
              color="from-orange-400 to-red-400"
              details={["Tauri 2.0", "SQLite FTS5", "Actor 模型", "异步 I/O"]}
            />
            <TechStackCard
              emoji="🎵"
              title="音频"
              tech="双引擎"
              description="Symphonia + Rodio + Web Audio API"
              color="from-purple-400 to-pink-400"
              details={["Symphonia", "Rodio", "Web Audio API", "硬件加速"]}
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-ios-blue via-purple-500 to-pink-500 opacity-90" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20" />
            
            <div className="relative px-8 py-20 md:px-16 md:py-24 text-center">
              <h2 className="text-4xl md:text-6xl font-bold mb-6 text-white">
                准备好开始了吗？
              </h2>
              <p className="text-xl md:text-2xl text-white/90 mb-10 max-w-2xl mx-auto">
                立即下载 WindChime Player，体验前所未有的音乐之旅
              </p>
              <Link
                to="/download"
                className="inline-flex items-center space-x-3 px-10 py-5 bg-white text-gray-900 rounded-2xl font-bold text-lg hover:scale-105 transition-all shadow-2xl"
              >
                <Download className="w-6 h-6" />
                <span>免费下载</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

// 特性项组件
function FeatureItem({ icon, title, description }: { 
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start space-x-3 glass-dark p-4 rounded-xl">
      <div className="text-ios-blue mt-0.5">{icon}</div>
      <div>
        <div className="font-semibold text-white mb-1">{title}</div>
        <div className="text-sm text-gray-400">{description}</div>
      </div>
    </div>
  )
}

// 特性点组件
function FeaturePoint({ title, description }: { title: string, description: string }) {
  return (
    <motion.div
      whileHover={{ x: 10 }}
      className="flex items-start space-x-4 glass-dark p-4 rounded-xl cursor-pointer"
    >
      <div className="w-2 h-2 rounded-full bg-ios-blue mt-2 flex-shrink-0" />
      <div>
        <div className="font-semibold text-lg mb-1">{title}</div>
        <div className="text-gray-400">{description}</div>
      </div>
    </motion.div>
  )
}

// 技术点组件
function TechPoint({ icon, title, description }: { icon: string, title: string, description: string }) {
  return (
    <motion.div
      whileHover={{ x: 10 }}
      className="flex items-start space-x-4 glass-dark p-4 rounded-xl cursor-pointer"
    >
      <div className="text-4xl">{icon}</div>
      <div>
        <div className="font-semibold text-lg mb-1">{title}</div>
        <div className="text-gray-400">{description}</div>
      </div>
    </motion.div>
  )
}

// 技术栈卡片
function TechStackCard({ emoji, title, tech, description, color, details }: {
  emoji: string
  title: string
  tech: string
  description: string
  color: string
  details: string[]
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="group relative"
    >
      <div className="relative glass-dark rounded-3xl p-8 hover:bg-white/10 transition-all overflow-hidden h-full">
        {/* 背景渐变 */}
        <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-10 transition-opacity`} />
        
        <div className="relative">
          <div className="text-6xl mb-6 group-hover:scale-110 transition-transform">{emoji}</div>
          <div className={`text-sm font-semibold bg-gradient-to-r ${color} bg-clip-text text-transparent mb-2`}>
            {title}
          </div>
          <h3 className="text-3xl font-bold mb-3">{tech}</h3>
          <p className="text-gray-400 text-sm mb-6">{description}</p>
          
          {/* 详细技术列表 */}
          <div className="space-y-2">
            {details.map((detail, i) => (
              <div key={i} className="flex items-center space-x-2 text-sm text-gray-300">
                <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${color}`} />
                <span>{detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
