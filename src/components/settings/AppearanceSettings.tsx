import { useState } from 'react';

// 获取歌词动画样式的中文名称
const getLyricsAnimationName = (style: string): string => {
  const nameMap: Record<string, string> = {
    'BOUNCY_SOFT': '轻柔Q弹',
    'BOUNCY_STRONG': '强烈Q弹',
    'BOUNCY_PLAYFUL': '俏皮Q弹',
    'SMOOTH_ELEGANT': '优雅平滑',
    'SMOOTH_SWIFT': '敏捷平滑',
    'SMOOTH_DREAMY': '梦幻平滑',
    'ORGANIC_FLOW': '自然流动',
    'PRECISE_SNAP': '精准快速',
    'SLOW_GENTLE': '温柔缓慢',
    'SLOW_LUXURIOUS': '奢华慢速',
    'ELASTIC_SOFT': '轻柔弹性',
    'ELASTIC_STRONG': '强力弹性',
    'INSTANT_SMOOTH': '即时流畅',
    'INSTANT_SHARP': '即时锐利',
    'GRADUAL_EASE': '渐进缓和',
    'GRADUAL_ACCELERATE': '渐进加速',
  };
  return nameMap[style] || style;
};

interface AppearanceSettingsProps {
  theme: 'system' | 'light' | 'dark';
  onThemeChange: (theme: 'system' | 'light' | 'dark') => void;
  isHighContrast: boolean;
  onToggleHighContrast: () => void;
  lyricsAnimationSettings: {
    style: string;
  };
  onUpdateLyricsAnimationSettings: (settings: Partial<AppearanceSettingsProps['lyricsAnimationSettings']>) => void;
}

export default function AppearanceSettings({
  theme,
  onThemeChange,
  isHighContrast,
  onToggleHighContrast,
  lyricsAnimationSettings,
  onUpdateLyricsAnimationSettings,
}: AppearanceSettingsProps) {
  const [lyricsAnimationDetailsExpanded, setLyricsAnimationDetailsExpanded] = useState(false);

  return (
    <div className="space-y-6">
      {/* 界面主题设置 */}
      <div className="bg-white dark:bg-dark-200 rounded-xl p-6 border border-slate-200 dark:border-dark-400">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-dark-900 mb-4 flex items-center gap-3">
          <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h14a2 2 0 012 2v12a4 4 0 01-4 4M7 21h10a4 4 0 004-4V5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a4 4 0 004 4z" />
          </svg>
          界面主题
        </h3>
        <div className="space-y-4">
          {/* 主题选择 */}
          <div className="p-4 bg-slate-50 dark:bg-dark-300 rounded-lg border border-slate-200 dark:border-dark-400">
            <div className="font-semibold text-slate-900 dark:text-dark-900 mb-3">主题模式</div>
            <div className="space-y-3">
              {/* 主题选项 */}
              <div className="flex gap-3">
                {(['system', 'light', 'dark'] as const).map((themeOption) => (
                  <button
                    key={themeOption}
                    onClick={() => onThemeChange(themeOption)}
                    className={`
                      flex-1 p-3 rounded-lg border-2 text-sm font-medium
                      ${theme === themeOption
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                        : 'border-slate-200 dark:border-dark-500 bg-white dark:bg-dark-100 text-slate-600 dark:text-dark-700 hover:border-slate-300 dark:hover:border-dark-400'
                      }
                    `}
                    style={{
                      transitionProperty: 'border-color, background-color, color',
                      transitionDuration: '0.2s',
                      transitionTimingFunction: 'ease-in-out'
                    }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {themeOption === 'system' && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      )}
                      {themeOption === 'light' && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      )}
                      {themeOption === 'dark' && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                      )}
                      <span>
                        {themeOption === 'system' && '跟随系统'}
                        {themeOption === 'light' && '浅色模式'}
                        {themeOption === 'dark' && '深色模式'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              
              {/* 当前系统偏好提示 */}
              {theme === 'system' && typeof window !== 'undefined' && (
                <div className="text-xs text-slate-500 dark:text-dark-600 p-2 bg-slate-50 dark:bg-dark-200 rounded">
                  <span className="font-medium">当前系统偏好：</span>
                  {window.matchMedia('(prefers-color-scheme: dark)').matches ? '深色模式' : '浅色模式'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 可访问性设置 */}
      <div className="bg-white dark:bg-dark-200 rounded-xl p-6 border border-slate-200 dark:border-dark-400">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-dark-900 mb-4 flex items-center gap-3">
          <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          可访问性
        </h3>
        <div className="space-y-4">
          {/* 高对比度开关 */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-dark-300 rounded-lg border border-slate-200 dark:border-dark-400">
            <div>
              <div className="font-semibold text-slate-900 mb-1">高对比度模式</div>
              <div className="text-sm text-slate-600">
                提升文字和界面元素的对比度，改善可读性
                {typeof window !== 'undefined' && window.matchMedia('(prefers-contrast: more)').matches && (
                  <span className="ml-2 text-xs px-2 py-0.5 bg-slate-200 dark:bg-dark-400 text-slate-600 dark:text-dark-700 rounded-md">系统偏好</span>
                )}
              </div>
            </div>
            <button
              onClick={onToggleHighContrast}
              className={`
                relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                ${isHighContrast 
                  ? 'bg-brand-600 shadow-inner' 
                  : 'bg-slate-300 shadow-inner'
                }
              `}
            >
              <div
                className={`
                  absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 flex items-center justify-center
                  ${isHighContrast ? 'transform translate-x-6' : ''}
                `}
              >
                {isHighContrast ? (
                  <svg className="w-3 h-3 text-brand-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 动画设置 */}
      <div className="bg-white dark:bg-dark-200 rounded-xl p-6 border border-slate-200 dark:border-dark-400">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-dark-900 mb-4 flex items-center gap-3">
          <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          动画设置
        </h3>
        <div className="space-y-4">
          {/* 歌词滚动动画设置 */}
          <div className="bg-slate-50 dark:bg-dark-300 rounded-lg overflow-hidden border border-slate-200 dark:border-dark-400">
            <button
              onClick={() => setLyricsAnimationDetailsExpanded(!lyricsAnimationDetailsExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 dark:hover:bg-dark-200/50 group"
              style={{
                transitionProperty: 'background-color, transform',
                transitionDuration: '0.2s',
                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div className="text-left flex-1 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-dark-900 mb-1 truncate">歌词滚动动画</div>
                <div className="text-sm text-slate-600 dark:text-dark-700 line-clamp-2">
                  自定义歌词切换时的滚动动画效果，包含Q弹和平滑等多种风格
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* 功能标识 */}
                <div className="px-2 py-1 rounded-full text-xs font-medium bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300">
                  动效配置
                </div>
                
                {/* 展开/收起图标 */}
                <svg
                  className={`w-5 h-5 text-slate-400 transition-all ${
                    lyricsAnimationDetailsExpanded 
                      ? 'rotate-180 scale-110 duration-800' 
                      : 'scale-100 duration-200'
                  }`}
                  style={{
                    transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* 展开的详细设置 */}
            <div 
              className="border-t border-slate-200 dark:border-dark-400 bg-white/50 dark:bg-dark-200/50 overflow-hidden"
              style={{
                transitionTimingFunction: lyricsAnimationDetailsExpanded 
                  ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' // Q弹展开
                  : 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', // 平滑收缩
                transitionProperty: 'max-height, opacity',
                transitionDuration: lyricsAnimationDetailsExpanded ? '0.8s' : '0.3s',
                maxHeight: lyricsAnimationDetailsExpanded ? '600px' : '0px',
                opacity: lyricsAnimationDetailsExpanded ? 1 : 0,
                willChange: 'max-height, opacity'
              }}
            >
              <div 
                className="p-4 space-y-4"
                style={{
                  transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transitionProperty: 'transform, opacity',
                  transitionDuration: lyricsAnimationDetailsExpanded ? '0.6s' : '0.15s',
                  transitionDelay: lyricsAnimationDetailsExpanded ? '0.2s' : '0s',
                  transform: lyricsAnimationDetailsExpanded ? 'translateY(0)' : 'translateY(-8px)',
                  opacity: lyricsAnimationDetailsExpanded ? 1 : 0,
                  willChange: 'transform, opacity'
                }}
              >
                {/* 动画风格选择 - 分层设计 */}
                <div>
                  <div className="space-y-4">
                    {/* 第一层：动画类型选择 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900 dark:text-dark-900">动画类型</span>
                        <span className="text-sm text-slate-600 dark:text-dark-600">
                          {lyricsAnimationSettings.style?.startsWith('BOUNCY_') ? 'Q弹' : 
                           lyricsAnimationSettings.style?.startsWith('SMOOTH_') ? '平滑' : 
                           lyricsAnimationSettings.style?.startsWith('SLOW_') ? '缓慢' :
                           lyricsAnimationSettings.style?.startsWith('ELASTIC_') ? '弹性' :
                           lyricsAnimationSettings.style?.startsWith('INSTANT_') ? '即时' :
                           lyricsAnimationSettings.style?.startsWith('GRADUAL_') ? '渐进' :
                           '特殊'}
                        </span>
                      </div>
                      
                      <div className="relative grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-dark-300 rounded-xl">
                        {/* 滑动指示器背景 */}
                        <div
                          className="absolute top-1 bottom-1 bg-white dark:bg-dark-100 rounded-lg shadow-lg border border-slate-200/50 dark:border-dark-400/50 transition-all duration-500 ease-out"
                          style={{
                            width: '33.333%',
                            left: lyricsAnimationSettings.style?.startsWith('BOUNCY_') ? '0.25rem' :
                                  lyricsAnimationSettings.style?.startsWith('SMOOTH_') ? '33.333%' :
                                  ['ORGANIC_FLOW', 'PRECISE_SNAP'].includes(lyricsAnimationSettings.style) ? '66.666%' : '0.25rem',
                            transform: lyricsAnimationSettings.style?.startsWith('BOUNCY_') ? 'translateX(0)' :
                                      lyricsAnimationSettings.style?.startsWith('SMOOTH_') ? 'translateX(0)' :
                                      ['ORGANIC_FLOW', 'PRECISE_SNAP'].includes(lyricsAnimationSettings.style) ? 'translateX(0)' : 'translateX(0)',
                            transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Q弹效果
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)'
                          }}
                        />
                        
                        <button
                          onClick={() => {
                            // 如果当前不是Q弹类型，切换到Q弹的默认选项
                            if (!lyricsAnimationSettings.style?.startsWith('BOUNCY_')) {
                              onUpdateLyricsAnimationSettings({ style: 'BOUNCY_SOFT' });
                            }
                          }}
                          className={`
                            relative z-10 py-3 px-3 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 group
                            ${lyricsAnimationSettings.style?.startsWith('BOUNCY_')
                              ? 'text-brand-600 dark:text-brand-400'
                              : 'text-slate-600 dark:text-dark-700 hover:text-slate-800 dark:hover:text-dark-900'
                            }
                          `}
                          style={{
                            transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                          }}
                          onMouseDown={(e) => {
                            e.currentTarget.style.transform = 'scale(0.95)';
                          }}
                          onMouseUp={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <span 
                            className={`text-lg transition-all duration-300 ${
                              lyricsAnimationSettings.style?.startsWith('BOUNCY_') 
                                ? 'animate-bounce' 
                                : 'group-hover:animate-pulse'
                            }`}
                            style={{
                              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                            }}
                          >
                            🏀
                          </span>
                          <span className="font-semibold">Q弹</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            // 如果当前不是平滑类型，切换到平滑的默认选项
                            if (!lyricsAnimationSettings.style?.startsWith('SMOOTH_')) {
                              onUpdateLyricsAnimationSettings({ style: 'SMOOTH_ELEGANT' });
                            }
                          }}
                          className={`
                            relative z-10 py-3 px-3 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 group
                            ${lyricsAnimationSettings.style?.startsWith('SMOOTH_')
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-slate-600 dark:text-dark-700 hover:text-slate-800 dark:hover:text-dark-900'
                            }
                          `}
                          style={{
                            transitionTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                          }}
                          onMouseDown={(e) => {
                            e.currentTarget.style.transform = 'scale(0.95)';
                          }}
                          onMouseUp={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <span 
                            className={`text-lg transition-all duration-300 ${
                              lyricsAnimationSettings.style?.startsWith('SMOOTH_') 
                                ? 'animate-pulse' 
                                : 'group-hover:animate-pulse opacity-70'
                            }`}
                            style={{
                              transitionTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                            }}
                          >
                            🌊
                          </span>
                          <span className="font-semibold">平滑</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            // 如果当前不是特殊类型，切换到特殊的默认选项
                            if (!['ORGANIC_FLOW', 'PRECISE_SNAP'].includes(lyricsAnimationSettings.style)) {
                              onUpdateLyricsAnimationSettings({ style: 'ORGANIC_FLOW' });
                            }
                          }}
                          className={`
                            relative z-10 py-3 px-3 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 group
                            ${['ORGANIC_FLOW', 'PRECISE_SNAP'].includes(lyricsAnimationSettings.style)
                              ? 'text-purple-600 dark:text-purple-400'
                              : 'text-slate-600 dark:text-dark-700 hover:text-slate-800 dark:hover:text-dark-900'
                            }
                          `}
                          style={{
                            transitionTimingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
                          }}
                          onMouseDown={(e) => {
                            e.currentTarget.style.transform = 'scale(0.95)';
                          }}
                          onMouseUp={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <span 
                            className={`text-lg transition-all duration-300 ${
                              ['ORGANIC_FLOW', 'PRECISE_SNAP'].includes(lyricsAnimationSettings.style) 
                                ? 'animate-spin' 
                                : 'group-hover:animate-ping opacity-70'
                            }`}
                            style={{
                              transitionTimingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                              animationDuration: ['ORGANIC_FLOW', 'PRECISE_SNAP'].includes(lyricsAnimationSettings.style) ? '2s' : '1s'
                            }}
                          >
                            ✨
                          </span>
                          <span className="font-semibold">特殊</span>
                        </button>
                      </div>
                    </div>

                    {/* 说明提示 */}
                    <div className="text-xs text-slate-500 dark:text-dark-600 p-3 bg-slate-100/50 dark:bg-dark-300/50 rounded-lg">
                      <div className="space-y-1">
                        <div><strong className="text-brand-600">🏀 Q弹</strong>：滚动结束时有轻微回弹效果，增加趣味性和活力感</div>
                        <div><strong className="text-blue-600">🌊 平滑</strong>：纯流畅滚动无回弹，呈现优雅专业的视觉体验</div>
                        <div><strong className="text-purple-600">✨ 特殊</strong>：独特的动画风格，为不同场景提供个性化选择</div>
                      </div>
                    </div>
                    
                    {/* 第二层：具体动画样式选择 */}
                    <div className="space-y-3 mt-4">
                      <div className="font-medium text-slate-900 dark:text-dark-900 flex items-center gap-2">
                        <span>选择具体样式</span>
                        <span className="text-xs text-slate-500 dark:text-dark-600 bg-slate-100 dark:bg-dark-300 px-2 py-0.5 rounded-full">
                          {getLyricsAnimationName(lyricsAnimationSettings.style)}
                        </span>
                      </div>
                      
                      {/* Q弹系列 */}
                      {lyricsAnimationSettings.style?.startsWith('BOUNCY_') && (
                        <div className="grid grid-cols-1 gap-2">
                          {[
                            { key: 'BOUNCY_SOFT', name: '轻柔Q弹', desc: '温和的回弹效果，日常使用' },
                            { key: 'BOUNCY_STRONG', name: '强烈Q弹', desc: '明显的回弹动画，活力十足' },
                            { key: 'BOUNCY_PLAYFUL', name: '俏皮Q弹', desc: '灵动俏皮，充满趣味' },
                          ].map(preset => (
                            <button
                              key={preset.key}
                              onClick={() => onUpdateLyricsAnimationSettings({ style: preset.key })}
                              className={`
                                p-3 rounded-lg text-left transition-all duration-300
                                ${lyricsAnimationSettings.style === preset.key
                                  ? 'bg-brand-50 dark:bg-brand-900/20 border-2 border-brand-500 shadow-md'
                                  : 'bg-white dark:bg-dark-100 border border-slate-200 dark:border-dark-400 hover:border-brand-300 hover:shadow'
                                }
                              `}
                            >
                              <div className="font-medium text-sm text-slate-900 dark:text-dark-900">{preset.name}</div>
                              <div className="text-xs text-slate-600 dark:text-dark-600 mt-0.5">{preset.desc}</div>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* 平滑系列 */}
                      {lyricsAnimationSettings.style?.startsWith('SMOOTH_') && (
                        <div className="grid grid-cols-1 gap-2">
                          {[
                            { key: 'SMOOTH_ELEGANT', name: '优雅平滑', desc: '优雅的过渡效果' },
                            { key: 'SMOOTH_SWIFT', name: '敏捷平滑', desc: '快速响应，流畅切换' },
                            { key: 'SMOOTH_DREAMY', name: '梦幻平滑', desc: '柔和舒缓，如梦似幻' },
                          ].map(preset => (
                            <button
                              key={preset.key}
                              onClick={() => onUpdateLyricsAnimationSettings({ style: preset.key })}
                              className={`
                                p-3 rounded-lg text-left transition-all duration-300
                                ${lyricsAnimationSettings.style === preset.key
                                  ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 shadow-md'
                                  : 'bg-white dark:bg-dark-100 border border-slate-200 dark:border-dark-400 hover:border-blue-300 hover:shadow'
                                }
                              `}
                            >
                              <div className="font-medium text-sm text-slate-900 dark:text-dark-900">{preset.name}</div>
                              <div className="text-xs text-slate-600 dark:text-dark-600 mt-0.5">{preset.desc}</div>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* 特殊效果系列 */}
                      {['ORGANIC_FLOW', 'PRECISE_SNAP'].includes(lyricsAnimationSettings.style) && (
                        <div className="grid grid-cols-1 gap-2">
                          {[
                            { key: 'ORGANIC_FLOW', name: '自然流动', desc: '流畅自然的有机动画' },
                            { key: 'PRECISE_SNAP', name: '精准快速', desc: '快速精确的切换效果' },
                          ].map(preset => (
                            <button
                              key={preset.key}
                              onClick={() => onUpdateLyricsAnimationSettings({ style: preset.key })}
                              className={`
                                p-3 rounded-lg text-left transition-all duration-300
                                ${lyricsAnimationSettings.style === preset.key
                                  ? 'bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-500 shadow-md'
                                  : 'bg-white dark:bg-dark-100 border border-slate-200 dark:border-dark-400 hover:border-purple-300 hover:shadow'
                                }
                              `}
                            >
                              <div className="font-medium text-sm text-slate-900 dark:text-dark-900">{preset.name}</div>
                              <div className="text-xs text-slate-600 dark:text-dark-600 mt-0.5">{preset.desc}</div>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* 更多样式 - 可展开 */}
                      <details className="group">
                        <summary className="cursor-pointer text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 font-medium">
                          <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          更多动画样式
                        </summary>
                        <div className="mt-3 grid grid-cols-1 gap-2 pl-2">
                          {[
                            { key: 'SLOW_GENTLE', name: '🦢 温柔缓慢', desc: '缓慢优雅的过渡' },
                            { key: 'SLOW_LUXURIOUS', name: '🦢 奢华慢速', desc: '奢华感的慢速滚动' },
                            { key: 'ELASTIC_SOFT', name: '🎪 轻柔弹性', desc: '轻柔的弹性效果' },
                            { key: 'ELASTIC_STRONG', name: '🎪 强力弹性', desc: '强劲的弹性动画' },
                            { key: 'INSTANT_SMOOTH', name: '⚡ 即时流畅', desc: '瞬间响应，流畅切换' },
                            { key: 'INSTANT_SHARP', name: '⚡ 即时锐利', desc: '快速精准的响应' },
                            { key: 'GRADUAL_EASE', name: '🌅 渐进缓和', desc: '渐进式的柔和过渡' },
                            { key: 'GRADUAL_ACCELERATE', name: '🌅 渐进加速', desc: '逐渐加速的动画' },
                          ].map(preset => (
                            <button
                              key={preset.key}
                              onClick={() => onUpdateLyricsAnimationSettings({ style: preset.key })}
                              className={`
                                p-3 rounded-lg text-left transition-all duration-300
                                ${lyricsAnimationSettings.style === preset.key
                                  ? 'bg-brand-50 dark:bg-brand-900/20 border-2 border-brand-500 shadow-md'
                                  : 'bg-white dark:bg-dark-100 border border-slate-200 dark:border-dark-400 hover:border-brand-300 hover:shadow'
                                }
                              `}
                            >
                              <div className="font-medium text-sm text-slate-900 dark:text-dark-900">{preset.name}</div>
                              <div className="text-xs text-slate-600 dark:text-dark-600 mt-0.5">{preset.desc}</div>
                            </button>
                          ))}
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}





