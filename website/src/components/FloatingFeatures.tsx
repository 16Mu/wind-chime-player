import { motion } from 'framer-motion'
import { Zap, Music, Layers, Database, Globe, Shield } from 'lucide-react'

const features = [
  { icon: Zap, label: '零延迟 Seek', color: 'from-blue-500 to-cyan-500', delay: 0 },
  { icon: Music, label: '沉浸式歌词', color: 'from-purple-500 to-pink-500', delay: 0.2 },
  { icon: Layers, label: 'macOS 设计', color: 'from-cyan-500 to-blue-500', delay: 0.4 },
  { icon: Database, label: '智能管理', color: 'from-green-500 to-emerald-500', delay: 0.6 },
  { icon: Globe, label: '跨平台', color: 'from-orange-500 to-red-500', delay: 0.8 },
  { icon: Shield, label: '开源免费', color: 'from-pink-500 to-rose-500', delay: 1 },
]

export default function FloatingFeatures() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {features.map((feature, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.6,
            delay: feature.delay,
            type: "spring",
            stiffness: 100
          }}
          viewport={{ once: true }}
          whileHover={{ 
            y: -10,
            transition: { duration: 0.2 }
          }}
          className="group relative"
        >
          {/* 发光效果 */}
          <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-500 rounded-2xl`} />
          
          <div className="relative glass-dark rounded-2xl p-6 flex flex-col items-center space-y-3 hover:bg-white/10 transition-all">
            {/* 图标 */}
            <motion.div
              className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center`}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <feature.icon className="w-7 h-7 text-white" />
            </motion.div>
            
            {/* 标签 */}
            <span className="text-sm font-medium text-center">{feature.label}</span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

