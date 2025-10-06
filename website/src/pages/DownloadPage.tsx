import { motion } from 'framer-motion'
import { Download, Github, BookOpen, CheckCircle2 } from 'lucide-react'
import AuroraBackground from '../components/AuroraBackground'

export default function DownloadPage() {
  return (
    <div className="relative">
      <AuroraBackground />
      
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-6">下载 WindChime Player</h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-4">
              选择适合你的平台，立即开始使用
            </p>
            <div className="inline-flex items-center space-x-2 glass-dark px-4 py-2 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm">当前版本: v0.4.1</span>
            </div>
          </motion.div>

          {/* Download Cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            <DownloadCard
              platform="Windows"
              icon="🪟"
              version="v0.4.1"
              requirements="Windows 10+ (64-bit)"
              formats={[
                { name: 'NSIS 安装程序', size: '~80MB', recommended: true },
                { name: 'MSI 安装程序', size: '~80MB', recommended: false }
              ]}
            />
            
            <DownloadCard
              platform="macOS"
              icon="🍎"
              version="v0.4.1"
              requirements="macOS 10.13+"
              formats={[
                { name: 'Universal Binary (DMG)', size: '~90MB', recommended: true },
                { name: 'App Bundle', size: '~90MB', recommended: false }
              ]}
            />
            
            <DownloadCard
              platform="Linux"
              icon="🐧"
              version="v0.4.1"
              requirements="Ubuntu 20.04+ / Debian 11+"
              formats={[
                { name: 'DEB Package', size: '~75MB', recommended: true },
                { name: 'AppImage', size: '~80MB', recommended: false }
              ]}
            />
          </div>

          {/* Installation Guide */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="glass-dark rounded-2xl p-8 mb-12"
          >
            <h2 className="text-3xl font-bold mb-6">安装指南</h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div>
                <h3 className="text-xl font-semibold mb-4 text-ios-blue flex items-center">
                  <span className="mr-2">🪟</span> Windows
                </h3>
                <ol className="space-y-2 text-gray-400">
                  <li>1. 下载 NSIS 或 MSI 安装包</li>
                  <li>2. 双击运行安装程序</li>
                  <li>3. 按照向导完成安装</li>
                  <li>4. WebView2 将自动下载</li>
                </ol>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-4 text-ios-blue flex items-center">
                  <span className="mr-2">🍎</span> macOS
                </h3>
                <ol className="space-y-2 text-gray-400">
                  <li>1. 下载 DMG 文件</li>
                  <li>2. 双击打开 DMG</li>
                  <li>3. 拖拽应用到 Applications</li>
                  <li>4. 首次运行需允许权限</li>
                </ol>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-4 text-ios-blue flex items-center">
                  <span className="mr-2">🐧</span> Linux
                </h3>
                <ol className="space-y-2 text-gray-400">
                  <li>1. 下载 DEB 或 AppImage</li>
                  <li>2. DEB: sudo dpkg -i *.deb</li>
                  <li>3. AppImage: chmod +x 并运行</li>
                  <li>4. 安装系统依赖（如需）</li>
                </ol>
              </div>
            </div>
          </motion.div>

          {/* System Requirements */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="glass-dark rounded-2xl p-8 mb-12"
          >
            <h2 className="text-3xl font-bold mb-6">系统要求</h2>
            
            <div className="grid md:grid-cols-2 gap-6 text-gray-400">
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">最低配置</h3>
                <ul className="space-y-2">
                  <li>• 处理器: 双核 1.8 GHz+</li>
                  <li>• 内存: 4 GB RAM</li>
                  <li>• 存储: 200 MB 可用空间</li>
                  <li>• 显卡: 支持硬件加速</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-3">推荐配置</h3>
                <ul className="space-y-2">
                  <li>• 处理器: 四核 2.4 GHz+</li>
                  <li>• 内存: 8 GB RAM</li>
                  <li>• 存储: 500 MB 可用空间</li>
                  <li>• 显卡: 独立显卡</li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Links */}
          <div className="grid md:grid-cols-3 gap-6">
            <LinkCard
              icon={<Github className="w-6 h-6" />}
              title="GitHub 仓库"
              description="查看源代码，提交问题"
              href="https://github.com/16Mu/wind-chime-player"
            />
            
            <LinkCard
              icon={<BookOpen className="w-6 h-6" />}
              title="使用文档"
              description="详细的使用和开发指南"
              href="https://github.com/16Mu/wind-chime-player#readme"
            />
            
            <LinkCard
              icon={<Download className="w-6 h-6" />}
              title="更新日志"
              description="查看所有版本历史"
              href="https://github.com/16Mu/wind-chime-player/releases"
            />
          </div>
        </div>
      </section>
    </div>
  )
}

function DownloadCard({ 
  platform, 
  icon, 
  version, 
  requirements, 
  formats 
}: { 
  platform: string
  icon: string
  version: string
  requirements: string
  formats: Array<{ name: string, size: string, recommended: boolean }>
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="glass-dark rounded-2xl p-8 hover:bg-white/10 transition-all"
    >
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-2xl font-bold mb-2">{platform}</h3>
      <p className="text-sm text-gray-400 mb-6">{requirements}</p>
      
      <div className="space-y-3">
        {formats.map((format, index) => (
          <a
            key={index}
            href="https://github.com/16Mu/wind-chime-player/releases"
            target="_blank"
            rel="noopener noreferrer"
            className={`block w-full px-4 py-3 rounded-lg transition-all ${
              format.recommended 
                ? 'bg-ios-blue hover:bg-blue-600 text-white font-semibold' 
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <Download className="w-4 h-4" />
                  <span className="text-sm">{format.name}</span>
                </div>
                {format.recommended && (
                  <span className="text-xs opacity-80">推荐</span>
                )}
              </div>
              <span className="text-xs opacity-60">{format.size}</span>
            </div>
          </a>
        ))}
      </div>
      
      <div className="mt-4 text-xs text-gray-500">
        版本: {version}
      </div>
    </motion.div>
  )
}

function LinkCard({ 
  icon, 
  title, 
  description, 
  href 
}: { 
  icon: React.ReactNode
  title: string
  description: string
  href: string
}) {
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="glass-dark rounded-xl p-6 hover:bg-white/10 transition-all group"
    >
      <div className="text-ios-blue mb-3 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </motion.a>
  )
}

