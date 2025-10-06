import { motion } from 'framer-motion'
import { useState } from 'react'

interface Screenshot {
  src: string
  alt: string
  title: string
}

const screenshots: Screenshot[] = [
  {
    src: 'https://raw.githubusercontent.com/16Mu/wind-chime-player/master/screenshot-library.png',
    alt: '音乐库',
    title: '音乐库 - 歌曲列表视图'
  },
  {
    src: 'https://raw.githubusercontent.com/16Mu/wind-chime-player/master/screenshot-albums.png',
    alt: '专辑视图',
    title: '专辑视图 - 网格布局'
  },
  {
    src: 'https://raw.githubusercontent.com/16Mu/wind-chime-player/master/screenshot-artists.png',
    alt: '艺术家',
    title: '艺术家 - 封面展示'
  },
  {
    src: 'https://raw.githubusercontent.com/16Mu/wind-chime-player/master/screenshot-lyrics-1.png',
    alt: '沉浸式歌词',
    title: '沉浸式歌词 - 全屏展示'
  },
  {
    src: 'https://raw.githubusercontent.com/16Mu/wind-chime-player/master/screenshot-history.png',
    alt: '播放记录',
    title: '播放记录 - 统计分析'
  }
]

export default function ScreenshotShowcase() {
  const [currentIndex, setCurrentIndex] = useState(0)

  return (
    <div className="relative max-w-6xl mx-auto">
      {/* Main Screenshot with Mac Window Frame */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
        className="relative"
      >
        {/* Mac Window Frame */}
        <div className="relative rounded-xl overflow-hidden shadow-2xl shadow-ios-blue/20 border border-white/10">
          {/* Window Title Bar */}
          <div className="bg-macos-gray-800 px-4 py-3 flex items-center space-x-2 border-b border-white/10">
            <div className="flex space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div className="flex-1 text-center text-sm text-gray-400">
              {screenshots[currentIndex].title}
            </div>
            <div className="w-16"></div> {/* Spacer for centering */}
          </div>

          {/* Screenshot Content */}
          <div className="relative bg-gray-900 aspect-video">
            <motion.img
              key={currentIndex}
              src={screenshots[currentIndex].src}
              alt={screenshots[currentIndex].alt}
              className="w-full h-full object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              loading="lazy"
            />
          </div>
        </div>

        {/* 3D Effect Shadow */}
        <div className="absolute inset-0 bg-gradient-to-br from-ios-blue/20 to-purple-500/20 blur-3xl -z-10 transform scale-95" />
      </motion.div>

      {/* Thumbnail Navigation */}
      <div className="mt-8 flex justify-center gap-3 overflow-x-auto pb-4">
        {screenshots.map((screenshot, index) => (
          <motion.button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`relative flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden border-2 transition-all ${
              index === currentIndex
                ? 'border-ios-blue shadow-lg shadow-ios-blue/50 scale-105'
                : 'border-white/10 hover:border-white/30'
            }`}
            whileHover={{ scale: index === currentIndex ? 1.05 : 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <img
              src={screenshot.src}
              alt={screenshot.alt}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {index === currentIndex && (
              <div className="absolute inset-0 bg-ios-blue/10 backdrop-blur-[1px]" />
            )}
          </motion.button>
        ))}
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={() => setCurrentIndex((currentIndex - 1 + screenshots.length) % screenshots.length)}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/70 transition-all"
        aria-label="上一张"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        onClick={() => setCurrentIndex((currentIndex + 1) % screenshots.length)}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/70 transition-all"
        aria-label="下一张"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Indicator Dots */}
      <div className="flex justify-center gap-2 mt-6">
        {screenshots.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-2 rounded-full transition-all ${
              index === currentIndex
                ? 'w-8 bg-ios-blue'
                : 'w-2 bg-white/30 hover:bg-white/50'
            }`}
            aria-label={`跳转到第 ${index + 1} 张截图`}
          />
        ))}
      </div>
    </div>
  )
}

