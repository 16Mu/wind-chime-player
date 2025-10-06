/**
 * 动画设置 - 独立页面
 * 包含歌词滚动动画等动效配置
 */

import { useState, useEffect, useRef } from 'react';
import { SettingSection } from './ui/SettingSection';
import { CollapsiblePanel } from './ui/CollapsiblePanel';
import { LyricsAnimationSettings } from '../../types/music';

interface AnimationSettingsProps {
  lyricsAnimationSettings: LyricsAnimationSettings;
  onUpdateLyricsAnimationSettings: (settings: Partial<LyricsAnimationSettings>) => void;
  highlightedSettingId?: string | null;
}

// 歌词动画预设配置 - 重新分类为4大类
const ANIMATION_PRESETS = {
  elastic: [
    { key: 'BOUNCY_SOFT' as const, name: '轻柔Q弹', emoji: '🏀', desc: '温和的回弹效果' },
    { key: 'BOUNCY_STRONG' as const, name: '强烈Q弹', emoji: '⚡', desc: '明显的回弹动画' },
    { key: 'BOUNCY_PLAYFUL' as const, name: '俏皮Q弹', emoji: '✨', desc: '灵动俏皮' },
    { key: 'ELASTIC_SOFT' as const, name: '轻柔弹性', emoji: '🎪', desc: '轻柔的弹性' },
    { key: 'ELASTIC_STRONG' as const, name: '强力弹性', emoji: '🎯', desc: '强劲的弹性' },
  ],
  smooth: [
    { key: 'SMOOTH_ELEGANT' as const, name: '优雅平滑', emoji: '🌊', desc: '优雅的过渡' },
    { key: 'SMOOTH_SWIFT' as const, name: '敏捷平滑', emoji: '💨', desc: '快速响应' },
    { key: 'SMOOTH_DREAMY' as const, name: '梦幻平滑', emoji: '🌙', desc: '柔和舒缓' },
    { key: 'ORGANIC_FLOW' as const, name: '自然流动', emoji: '🍃', desc: '流畅自然' },
    { key: 'GRADUAL_EASE' as const, name: '渐进缓和', emoji: '🌅', desc: '渐进式柔和' },
    { key: 'GRADUAL_ACCELERATE' as const, name: '渐进加速', emoji: '🚀', desc: '逐渐加速' },
  ],
  fast: [
    { key: 'PRECISE_SNAP' as const, name: '精准快速', emoji: '⚡', desc: '快速精确' },
    { key: 'INSTANT_SMOOTH' as const, name: '即时流畅', emoji: '⚡', desc: '瞬间响应' },
    { key: 'INSTANT_SHARP' as const, name: '即时锐利', emoji: '🔪', desc: '快速精准' },
    { key: 'SMOOTH_SWIFT' as const, name: '敏捷平滑', emoji: '💨', desc: '快速响应' },
  ],
  slow: [
    { key: 'SLOW_GENTLE' as const, name: '温柔缓慢', emoji: '🦢', desc: '缓慢优雅' },
    { key: 'SLOW_LUXURIOUS' as const, name: '奢华慢速', emoji: '💎', desc: '奢华感的慢速' },
    { key: 'SMOOTH_DREAMY' as const, name: '梦幻平滑', emoji: '🌙', desc: '柔和舒缓' },
  ],
};

// 模拟歌词数据
const PREVIEW_LYRICS = [
  { text: 'Lost in the echo', time: 0 },
  { text: 'But echo voices', time: 1 },
  { text: 'No no worry', time: 2 },
  { text: "Don't worry 'bout", time: 3 },
  { text: 'So breathe like', time: 4 },
  { text: 'Dancing in the moonlight', time: 5 },
  { text: 'Feeling so right', time: 6 },
];

export default function AnimationSettings({
  lyricsAnimationSettings,
  onUpdateLyricsAnimationSettings,
  highlightedSettingId
}: AnimationSettingsProps) {
  const [activeTab, setActiveTab] = useState<'elastic' | 'smooth' | 'fast' | 'slow'>('elastic');
  const [, setPreviewKey] = useState(0); // 用于触发预览动画
  const [currentPreviewLine, setCurrentPreviewLine] = useState(2); // 当前预览行索引
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewTimerRef = useRef<number | null>(null);
  
  // 获取当前动画类型
  const getCurrentAnimationType = (): 'elastic' | 'smooth' | 'fast' | 'slow' => {
    const style = lyricsAnimationSettings.style;
    if (style?.startsWith('BOUNCY_') || style?.startsWith('ELASTIC_')) return 'elastic';
    if (style?.startsWith('SMOOTH_') || ['ORGANIC_FLOW', 'GRADUAL_EASE', 'GRADUAL_ACCELERATE'].includes(style)) return 'smooth';
    if (['PRECISE_SNAP', 'INSTANT_SMOOTH', 'INSTANT_SHARP'].includes(style)) return 'fast';
    if (style?.startsWith('SLOW_')) return 'slow';
    return 'elastic';
  };

  // 获取当前选中动画的详细信息
  const getCurrentAnimationInfo = () => {
    const allPresets = [...ANIMATION_PRESETS.elastic, ...ANIMATION_PRESETS.smooth, ...ANIMATION_PRESETS.fast, ...ANIMATION_PRESETS.slow];
    return allPresets.find(p => p.key === lyricsAnimationSettings.style) || ANIMATION_PRESETS.elastic[0];
  };

  const currentPresets = ANIMATION_PRESETS[activeTab];

  // 根据动画样式返回对应的CSS动画
  const getAnimationCSS = (style: string): string => {
    const animations: Record<string, string> = {
      // 弹性Q弹系列
      'BOUNCY_SOFT': 'lyrics-preview-bouncy-soft 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      'BOUNCY_STRONG': 'lyrics-preview-bouncy-strong 1.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      'BOUNCY_PLAYFUL': 'lyrics-preview-bouncy-playful 1.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      'ELASTIC_SOFT': 'lyrics-preview-elastic-soft 1.5s cubic-bezier(0.5, 1.5, 0.5, 1)',
      'ELASTIC_STRONG': 'lyrics-preview-elastic-strong 1.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      
      // 平滑流畅系列
      'SMOOTH_ELEGANT': 'lyrics-preview-smooth 1.0s cubic-bezier(0.4, 0.0, 0.2, 1)',
      'SMOOTH_SWIFT': 'lyrics-preview-smooth 0.8s cubic-bezier(0.4, 0.0, 0.2, 1)',
      'SMOOTH_DREAMY': 'lyrics-preview-smooth 1.5s cubic-bezier(0.4, 0.0, 0.2, 1)',
      'ORGANIC_FLOW': 'lyrics-preview-smooth 1.2s cubic-bezier(0.33, 1, 0.68, 1)',
      'GRADUAL_EASE': 'lyrics-preview-smooth 1.3s ease-out',
      'GRADUAL_ACCELERATE': 'lyrics-preview-smooth 1.0s ease-in-out',
      
      // 快速系列
      'PRECISE_SNAP': 'lyrics-preview-fast 0.5s cubic-bezier(0.4, 0.0, 0.2, 1)',
      'INSTANT_SMOOTH': 'lyrics-preview-fast 0.4s ease-out',
      'INSTANT_SHARP': 'lyrics-preview-fast 0.3s ease-in-out',
      
      // 慢速系列
      'SLOW_GENTLE': 'lyrics-preview-slow 2.0s cubic-bezier(0.4, 0.0, 0.2, 1)',
      'SLOW_LUXURIOUS': 'lyrics-preview-slow 2.5s cubic-bezier(0.33, 1, 0.68, 1)',
    };
    
    return animations[style] || animations['BOUNCY_SOFT'];
  };

  // ✅ 修复1：初始化时自动切换到当前动画类型的标签页（只执行一次）
  useEffect(() => {
    const currentType = getCurrentAnimationType();
    setActiveTab(currentType);
  }, []); // 空依赖，只在初始化时执行

  // ✅ 修复2：当动画样式改变时，触发预览动画并重置歌词
  useEffect(() => {
    setPreviewKey(prev => prev + 1);
    setCurrentPreviewLine(2); // 重置到中间行
  }, [lyricsAnimationSettings.style]);

  // 自动切换预览歌词
  useEffect(() => {
    // 启动定时器，每2.5秒切换一次歌词
    previewTimerRef.current = window.setInterval(() => {
      setCurrentPreviewLine(prev => {
        const next = prev + 1;
        return next >= PREVIEW_LYRICS.length ? 0 : next;
      });
    }, 2500);

    return () => {
      if (previewTimerRef.current) {
        clearInterval(previewTimerRef.current);
      }
    };
  }, []);

  // 滚动预览容器，使当前行居中
  useEffect(() => {
    if (!previewContainerRef.current) return;

    const container = previewContainerRef.current;
    const lines = container.querySelectorAll<HTMLDivElement>('.preview-lyric-line');
    const currentLine = lines[currentPreviewLine];

    if (currentLine) {
      const containerHeight = container.clientHeight;
      const lineTop = currentLine.offsetTop;
      const lineHeight = currentLine.clientHeight;
      const targetScroll = lineTop - (containerHeight / 2) + (lineHeight / 2);

      // 获取当前动画配置
      const animationStyle = lyricsAnimationSettings.style;
      const animationCSS = getAnimationCSS(animationStyle);
      
      // 从动画CSS中提取时长
      const durationMatch = animationCSS.match(/([\d.]+)s/);
      const duration = durationMatch ? parseFloat(durationMatch[1]) * 1000 : 800;

      // 从CSS中提取easing函数
      const easingMatch = animationCSS.match(/cubic-bezier\([^)]+\)|ease-in-out|ease-out|ease-in|linear/);
      const easing = easingMatch ? easingMatch[0] : 'cubic-bezier(0.4, 0.0, 0.2, 1)';

      // 应用滚动动画
      container.style.transition = `transform ${duration}ms ${easing}`;
      container.style.transform = `translateY(-${targetScroll}px)`;
    }
  }, [currentPreviewLine, lyricsAnimationSettings.style]);

  return (
    <div className="space-y-6">
      {/* 歌词滚动动画 */}
      <SettingSection
        sectionId="lyrics-animation"
        isHighlighted={highlightedSettingId === 'animation-lyrics-scroll' || 
                     highlightedSettingId === 'animation-lyrics-bouncy' ||
                     highlightedSettingId === 'animation-lyrics-smooth'}
        title="歌词滚动动画"
        description="自定义歌词切换时的滚动效果"
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        }
      >
        <CollapsiblePanel
          title="选择动画效果"
          description="18种不同风格的滚动动画"
          badge={{ text: '18种效果', variant: 'info' }}
        >
          {/* 左右分栏布局 */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* 左侧：动画选择区 (3列) */}
            <div className="lg:col-span-3 space-y-3">
              {/* 标签页导航 */}
              <div className="flex gap-1 bg-slate-100 dark:bg-dark-300 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('elastic')}
                  className={`
                    flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all
                    ${activeTab === 'elastic'
                      ? 'bg-white dark:bg-dark-800 shadow text-brand-600 dark:text-brand-400'
                      : 'text-slate-600 dark:text-dark-700 hover:text-slate-900 dark:hover:text-dark-900'
                    }
                  `}
                >
                  🏀 弹性 <span className="text-[10px] opacity-70">(5)</span>
                </button>
                <button
                  onClick={() => setActiveTab('smooth')}
                  className={`
                    flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all
                    ${activeTab === 'smooth'
                      ? 'bg-white dark:bg-dark-800 shadow text-brand-600 dark:text-brand-400'
                      : 'text-slate-600 dark:text-dark-700 hover:text-slate-900 dark:hover:text-dark-900'
                    }
                  `}
                >
                  🌊 平滑 <span className="text-[10px] opacity-70">(6)</span>
                </button>
                <button
                  onClick={() => setActiveTab('fast')}
                  className={`
                    flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all
                    ${activeTab === 'fast'
                      ? 'bg-white dark:bg-dark-800 shadow text-brand-600 dark:text-brand-400'
                      : 'text-slate-600 dark:text-dark-700 hover:text-slate-900 dark:hover:text-dark-900'
                    }
                  `}
                >
                  ⚡ 快速 <span className="text-[10px] opacity-70">(4)</span>
                </button>
                <button
                  onClick={() => setActiveTab('slow')}
                  className={`
                    flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all
                    ${activeTab === 'slow'
                      ? 'bg-white dark:bg-dark-800 shadow text-brand-600 dark:text-brand-400'
                      : 'text-slate-600 dark:text-dark-700 hover:text-slate-900 dark:hover:text-dark-900'
                    }
                  `}
                >
                  🦢 舒缓 <span className="text-[10px] opacity-70">(3)</span>
                </button>
              </div>

              {/* 分类说明 */}
              <div className="text-xs text-slate-600 dark:text-dark-700 bg-slate-50 dark:bg-dark-200 px-3 py-2 rounded-lg">
                {activeTab === 'elastic' && '🏀 弹性动画 - 有回弹、Q弹、弹性效果'}
                {activeTab === 'smooth' && '🌊 平滑动画 - 流畅过渡、无突变、自然流动'}
                {activeTab === 'fast' && '⚡ 快速动画 - 响应迅速、干脆利落'}
                {activeTab === 'slow' && '🦢 舒缓动画 - 慢节奏、优雅从容'}
              </div>

              {/* 当前分类的动画列表 */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {currentPresets.map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => onUpdateLyricsAnimationSettings({ style: preset.key as LyricsAnimationSettings['style'] })}
                    className={`
                      w-full p-3 rounded-lg text-left transition-all
                      ${lyricsAnimationSettings.style === preset.key
                        ? 'bg-gradient-to-r from-brand-500 to-sky-500 text-white shadow-lg'
                        : 'bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-400 hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-md'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{preset.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium text-sm ${lyricsAnimationSettings.style === preset.key ? 'text-white' : 'text-slate-900 dark:text-dark-900'}`}>
                          {preset.name}
                        </div>
                        <div className={`text-xs ${lyricsAnimationSettings.style === preset.key ? 'text-white/80' : 'text-slate-600 dark:text-dark-700'}`}>
                          {preset.desc}
                        </div>
                      </div>
                      {lyricsAnimationSettings.style === preset.key && (
                        <svg className="w-5 h-5 text-white flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 右侧：效果预览区 (2列) */}
            <div className="lg:col-span-2">
              <div className="sticky top-4 space-y-3">
                {/* 预览区标题 */}
                <div className="bg-gradient-to-r from-brand-50 to-sky-50 dark:from-brand-900/20 dark:to-sky-900/20 p-4 rounded-xl border-2 border-brand-200 dark:border-brand-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span className="font-semibold text-brand-700 dark:text-brand-300 text-sm">💫 效果预览</span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-dark-600">🔄 自动循环</span>
                  </div>

                  {/* 模拟歌词滚动 - 真实预览动画 */}
                  <div className="bg-white/50 dark:bg-dark-800/50 rounded-lg p-4 text-center backdrop-blur-sm overflow-hidden relative h-[180px]">
                    {/* 滚动容器 */}
                    <div 
                      ref={previewContainerRef}
                      className="absolute inset-0 py-20"
                      style={{
                        willChange: 'transform',
                      }}
                    >
                      {PREVIEW_LYRICS.map((lyric, index) => (
                        <div 
                          key={index}
                          className={`preview-lyric-line py-2 transition-all duration-300 ${
                            index === currentPreviewLine 
                              ? 'text-sm font-semibold text-brand-600 dark:text-brand-400 scale-110' 
                              : index === currentPreviewLine - 1 || index === currentPreviewLine + 1
                              ? 'text-xs opacity-75 text-slate-700 dark:text-dark-800'
                              : 'text-xs opacity-50 text-slate-600 dark:text-dark-700'
                          }`}
                        >
                          {index === currentPreviewLine ? '▶ ' : ''}{lyric.text}{index === currentPreviewLine ? ' ◀' : ''}
                        </div>
                      ))}
                    </div>
                    
                    {/* 中心高亮指示器（可选） */}
                    <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-12 bg-brand-500/5 dark:bg-brand-400/5 pointer-events-none border-y border-brand-300/20 dark:border-brand-600/20" />
                  </div>

                  {/* 当前效果信息 */}
                  <div className="mt-3 pt-3 border-t border-brand-200 dark:border-brand-800">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{getCurrentAnimationInfo().emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-brand-700 dark:text-brand-300">
                          {getCurrentAnimationInfo().name}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-dark-700">
                          {getCurrentAnimationInfo().desc}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 技术参数 */}
                <div className="bg-slate-50 dark:bg-dark-200 p-4 rounded-lg">
                  <div className="text-xs font-semibold text-slate-700 dark:text-dark-800 mb-2">📊 技术参数</div>
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-dark-700">
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-slate-500 dark:text-dark-600">时长</span>
                      <span className="font-mono">1.2s</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-slate-500 dark:text-dark-600">缓动</span>
                      <span className="font-mono text-[10px]">cubic-bezier(...)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-slate-500 dark:text-dark-600">放大</span>
                      <span className="font-mono">1.0 → 1.08 → 1.2</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CollapsiblePanel>
      </SettingSection>
    </div>
  );
}


