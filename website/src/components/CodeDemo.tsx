import { motion } from 'framer-motion'
import { useState } from 'react'

const codeExamples = {
  rust: `// Rust 音频播放引擎
pub async fn play(&mut self, path: String) {
    let audio = AudioDecoder::new(&path)?;
    
    // 零延迟 seek
    self.engine.seek(position).await?;
    
    // Actor 模型处理
    self.send(PlayCommand::Play).await;
}`,
  
  typescript: `// React 前端组件
const [isPlaying, setIsPlaying] = useState(false)

// 调用 Tauri 命令
await invoke('play_audio', { 
  path: currentTrack.path 
})

// 零延迟响应
setIsPlaying(true)`,
  
  webgl: `// WebGL 极光背景
uniform float uTime;
uniform vec3 uColorStops[3];

// Simplex noise for aurora
float noise = snoise(uv * 2.0 + uTime);
vec3 color = mix(color1, color2, noise);`
}

export default function CodeDemo() {
  const [activeTab, setActiveTab] = useState<keyof typeof codeExamples>('rust')

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
      className="glass-dark rounded-3xl overflow-hidden"
    >
      {/* 代码编辑器标题栏 */}
      <div className="bg-macos-gray-800 px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div className="flex space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        
        {/* 标签页 */}
        <div className="flex space-x-2">
          {Object.keys(codeExamples).map((lang) => (
            <button
              key={lang}
              onClick={() => setActiveTab(lang as keyof typeof codeExamples)}
              className={`px-4 py-1 rounded-lg text-sm transition-colors ${
                activeTab === lang
                  ? 'bg-macos-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {lang === 'rust' && '🦀 Rust'}
              {lang === 'typescript' && '⚛️ TypeScript'}
              {lang === 'webgl' && '🎨 WebGL'}
            </button>
          ))}
        </div>
        
        <div className="w-16"></div>
      </div>

      {/* 代码内容 */}
      <div className="relative p-6 font-mono text-sm overflow-x-auto">
        <motion.pre
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="text-gray-300"
        >
          <code className="language-rust">
            {codeExamples[activeTab].split('\n').map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="leading-relaxed"
              >
                <span className="text-gray-500 mr-4 select-none">{i + 1}</span>
                <SyntaxHighlight line={line} />
              </motion.div>
            ))}
          </code>
        </motion.pre>

        {/* 光标闪烁 */}
        <motion.div
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="inline-block w-2 h-5 bg-ios-blue ml-1"
        />
      </div>
    </motion.div>
  )
}

// 简单的语法高亮
function SyntaxHighlight({ line }: { line: string }) {
  // 关键字
  const keywords = ['pub', 'async', 'fn', 'let', 'await', 'const', 'await', 'invoke', 'uniform', 'float', 'vec3']
  
  let highlighted = line
  
  // 高亮关键字
  keywords.forEach(keyword => {
    highlighted = highlighted.replace(
      new RegExp(`\\b${keyword}\\b`, 'g'),
      `<span class="text-purple-400">${keyword}</span>`
    )
  })
  
  // 高亮字符串
  highlighted = highlighted.replace(
    /(["'])(.*?)\1/g,
    '<span class="text-green-400">$1$2$1</span>'
  )
  
  // 高亮注释
  highlighted = highlighted.replace(
    /\/\/.*/g,
    '<span class="text-gray-500">$&</span>'
  )
  
  // 高亮函数名
  highlighted = highlighted.replace(
    /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
    '<span class="text-blue-400">$1</span>('
  )

  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />
}

