import { motion, useMotionValue, useTransform } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Play, Pause, SkipForward, Volume2 } from 'lucide-react'

export default function InteractiveFeatureDemo() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setProgress((prev) => (prev >= 100 ? 0 : prev + 0.5))
      }, 50)
      return () => clearInterval(interval)
    }
  }, [isPlaying])

  return (
    <div className="relative">
      {/* 模拟播放器界面 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
        className="glass-dark rounded-3xl p-8 overflow-hidden"
      >
        {/* 专辑封面区域 */}
        <div className="flex items-center space-x-6 mb-6">
          <motion.div
            animate={{
              rotate: isPlaying ? 360 : 0,
            }}
            transition={{
              duration: 3,
              repeat: isPlaying ? Infinity : 0,
              ease: "linear"
            }}
            className="w-24 h-24 rounded-2xl bg-gradient-to-br from-ios-blue via-purple-500 to-pink-500 flex-shrink-0 shadow-xl"
          >
            <div className="w-full h-full rounded-2xl bg-gradient-to-br from-white/20 to-transparent backdrop-blur-sm flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-gray-900/50" />
            </div>
          </motion.div>

          <div className="flex-1">
            <h4 className="text-xl font-bold mb-1">示例歌曲</h4>
            <p className="text-gray-400 text-sm">WindChime Player</p>
            <div className="mt-2 flex items-center space-x-2">
              <span className="text-xs text-gray-500">FLAC</span>
              <span className="text-xs text-gray-500">·</span>
              <span className="text-xs text-gray-500">Hi-Res</span>
            </div>
          </div>
        </div>

        {/* 进度条 */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>{formatTime(progress * 2.4)}</span>
            <span>04:00</span>
          </div>
          <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-ios-blue to-purple-500"
              style={{ width: `${progress}%` }}
            />
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg"
              style={{ left: `calc(${progress}% - 8px)` }}
            />
          </div>
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center justify-center space-x-6">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <SkipForward className="w-5 h-5 rotate-180" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-16 h-16 rounded-full bg-ios-blue flex items-center justify-center hover:bg-blue-600 transition-colors shadow-lg shadow-ios-blue/50"
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <SkipForward className="w-5 h-5" />
          </motion.button>
        </div>

        {/* 音量控制 */}
        <div className="mt-6 flex items-center space-x-3">
          <Volume2 className="w-5 h-5 text-gray-400" />
          <div className="flex-1 h-1.5 bg-white/10 rounded-full">
            <div className="w-3/4 h-full bg-gradient-to-r from-ios-blue to-purple-500 rounded-full" />
          </div>
        </div>

        {/* 性能指标 */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-ios-blue">
              <CountUp end={8} />ms
            </div>
            <div className="text-xs text-gray-500">Seek 延迟</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-purple-400">60fps</div>
            <div className="text-xs text-gray-500">流畅播放</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-pink-400">0%</div>
            <div className="text-xs text-gray-500">CPU 占用</div>
          </div>
        </div>
      </motion.div>

      {/* 浮动粒子效果 */}
      <FloatingParticles isActive={isPlaying} />
    </div>
  )
}

// 计数动画组件
function CountUp({ end }: { end: number }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const duration = 2000
    const steps = 60
    const increment = end / steps
    const stepDuration = duration / steps

    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, stepDuration)

    return () => clearInterval(timer)
  }, [end])

  return <>{count}</>
}

// 浮动粒子组件
function FloatingParticles({ isActive }: { isActive: boolean }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-ios-blue/30"
          initial={{
            x: Math.random() * 100 + '%',
            y: Math.random() * 100 + '%',
          }}
          animate={isActive ? {
            y: [null, Math.random() * -100 - 50],
            opacity: [0.5, 0],
          } : {}}
          transition={{
            duration: Math.random() * 2 + 2,
            repeat: isActive ? Infinity : 0,
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  )
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

