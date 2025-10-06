/**
 * 设置页面 - 现代化重构版
 * 
 * 布局优化：
 * - ❌ 移除左右分栏布局
 * - ✅ 顶部Tab横向导航
 * - ✅ 单列垂直内容区
 * - ✅ 响应式设计
 * - ✅ 统一的设计系统
 */

import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

// 设置分类Tab
import LibrarySettings from './settings/LibrarySettings';
import AppearanceSettings from './settings/AppearanceSettings';
import AnimationSettings from './settings/AnimationSettings';
import PlaybackSettings from './settings/PlaybackSettings';
import WebDAVSettings from './settings/WebDAVSettings';
import AboutSettings from './settings/AboutSettings';

type SettingsTab = 'library' | 'appearance' | 'animation' | 'playback' | 'webdav' | 'about';

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: string;
  emoji: string; // 更直观的emoji图标
}

const TABS: TabConfig[] = [
  { 
    id: 'library', 
    label: '音乐库', 
    emoji: '🎵',
    icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' 
  },
  { 
    id: 'appearance', 
    label: '外观', 
    emoji: '🎨',
    icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' 
  },
  { 
    id: 'animation', 
    label: '动画', 
    emoji: '⚡',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z' 
  },
  { 
    id: 'playback', 
    label: '播放', 
    emoji: '📹',
    icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z' 
  },
  { 
    id: 'webdav', 
    label: '远程音乐源', 
    emoji: '☁️',
    icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z' 
  },
  { 
    id: 'about', 
    label: '关于', 
    emoji: 'ℹ️',
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' 
  },
];

export default function SettingsPageNew() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('library');
  
  // 从ThemeContext获取主题设置
  const { 
    theme, 
    setTheme, 
    isHighContrast, 
    toggleHighContrast,
    lyricsAnimationSettings,
    updateLyricsAnimationSettings 
  } = useTheme();

  // 渲染对应的设置内容
  const renderContent = () => {
    switch (activeTab) {
      case 'library':
        return <LibrarySettings />;
      
      case 'appearance':
        return (
          <AppearanceSettings
            theme={theme}
            onThemeChange={setTheme}
            isHighContrast={isHighContrast}
            onToggleHighContrast={toggleHighContrast}
          />
        );
      
      case 'animation':
        return (
          <AnimationSettings
            lyricsAnimationSettings={lyricsAnimationSettings}
            onUpdateLyricsAnimationSettings={updateLyricsAnimationSettings}
          />
        );
      
      case 'playback':
        return <PlaybackSettings />;
      
      case 'webdav':
        return <WebDAVSettings />;
      
      case 'about':
        return <AboutSettings />;
      
      default:
        return null;
    }
  };

  return (
    <div className="settings-page-new h-full flex flex-col bg-slate-50 dark:bg-dark-100">
      {/* 顶部导航栏 */}
      <div className="settings-header bg-white dark:bg-dark-200 border-b border-slate-200 dark:border-dark-400 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          {/* 小标题 + Tab导航 */}
          <div className="flex items-center justify-between mb-4">
            {/* 左侧小标题 */}
            <div className="flex items-center gap-3">
              <svg 
                className="w-6 h-6 text-slate-400 dark:text-dark-600"
                fill="none" 
                stroke="currentColor" 
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-dark-900">
                应用设置
              </h1>
            </div>
          </div>

          {/* Tab导航 - 横向滑动指示器 */}
          <div className="relative flex justify-center">
            <div className="relative flex">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex flex-col items-center gap-1.5 px-6 py-3
                    whitespace-nowrap transition-colors duration-300 relative z-10
                    ${activeTab === tab.id
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-slate-400 dark:text-dark-600'
                    }
                  `}
                >
                  {/* SVG图标 */}
                  <svg 
                    className="w-7 h-7"
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                  </svg>
                  {/* 文字 */}
                  <span className="text-sm font-medium">
                    {tab.label}
                  </span>
                </button>
              ))}
              
              {/* 底部横向指示器 */}
              <div 
                className="absolute left-0 right-0 bottom-0 h-0.5 bg-slate-200 dark:bg-dark-400 pointer-events-none"
              >
                {/* 滑动高亮条 */}
                <div 
                  className="absolute h-full transition-all duration-500 ease-out"
                  style={{
                    width: `calc(100% / ${TABS.length})`,
                    transform: `translateX(${TABS.findIndex(t => t.id === activeTab) * 100}%)`
                  }}
                >
                  {/* 主高亮条 - 使用 brand 颜色 */}
                  <div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-600 dark:via-brand-400 to-transparent"
                  />
                  
                  {/* 柔和光晕 */}
                  <div 
                    className="absolute inset-0 bg-brand-600/20 dark:bg-brand-400/20"
                    style={{
                      filter: 'blur(8px)',
                      transform: 'scaleY(3)'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 内容区 - 单列垂直布局 */}
      <div className="settings-content flex-1 overflow-y-auto">
        <div className={`${activeTab === 'webdav' ? 'h-full' : 'max-w-4xl mx-auto'} px-6 py-8`}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

