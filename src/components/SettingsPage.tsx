import { useState } from 'react';
import AppearanceSettings from './settings/AppearanceSettings';
import PlaybackSettings from './settings/PlaybackSettings';
import LibrarySettings from './settings/LibrarySettings';
import WebDAVSettings from './settings/WebDAVSettings';
import AdvancedSettings from './settings/AdvancedSettings';
import AboutSettings from './settings/AboutSettings';

export type SettingsTab = 'appearance' | 'playback' | 'library' | 'webdav' | 'advanced' | 'about';

interface SettingsPageProps {
  theme: 'system' | 'light' | 'dark';
  onThemeChange: (theme: 'system' | 'light' | 'dark') => void;
  isHighContrast: boolean;
  onToggleHighContrast: () => void;
  lyricsAnimationSettings: {
    style: string;
  };
  onUpdateLyricsAnimationSettings: (settings: Partial<SettingsPageProps['lyricsAnimationSettings']>) => void;
}

export default function SettingsPage({
  theme,
  onThemeChange,
  isHighContrast,
  onToggleHighContrast,
  lyricsAnimationSettings,
  onUpdateLyricsAnimationSettings,
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [animationKey, setAnimationKey] = useState(0);

  // 处理标签切换，带淡入上滑动画效果
  const handleTabChange = (newTab: SettingsTab) => {
    if (newTab === activeTab) return;
    
    // 切换内容并触发动画
    setActiveTab(newTab);
    setAnimationKey(prev => prev + 1);
  };

  const tabs = [
    {
      id: 'appearance' as const,
      name: '外观',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h14a2 2 0 012 2v12a4 4 0 01-4 4M7 21h10a4 4 0 004-4V5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a4 4 0 004 4z" />
        </svg>
      ),
      description: '主题、高对比度、歌词动画'
    },
    {
      id: 'playback' as const,
      name: '播放',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 12a3 3 0 106 0 3 3 0 00-6 0z" />
        </svg>
      ),
      description: '音频设备、音质增强'
    },
    {
      id: 'library' as const,
      name: '音乐库',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      description: '文件夹管理、扫描设置'
    },
    {
      id: 'webdav' as const,
      name: 'WebDAV',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      description: '远程音乐源（开发中）'
    },
    {
      id: 'advanced' as const,
      name: '高级',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      description: '性能监控、调试工具'
    },
    {
      id: 'about' as const,
      name: '关于',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      description: '软件信息、开发者信息'
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'appearance':
        return (
          <AppearanceSettings
            theme={theme}
            onThemeChange={onThemeChange}
            isHighContrast={isHighContrast}
            onToggleHighContrast={onToggleHighContrast}
            lyricsAnimationSettings={lyricsAnimationSettings}
            onUpdateLyricsAnimationSettings={onUpdateLyricsAnimationSettings}
          />
        );
      case 'playback':
        return <PlaybackSettings />;
      case 'library':
        return <LibrarySettings />;
      case 'webdav':
        return <WebDAVSettings />;
      case 'advanced':
        return <AdvancedSettings />;
      case 'about':
        return <AboutSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <div className="text-slate-400 dark:text-dark-600 mb-6">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-dark-900 mb-4">应用设置</h2>
          <p className="text-slate-600 dark:text-dark-700 text-lg mb-6">个性化您的音乐播放体验</p>
        </div>

          {/* 紧凑图标导航栏 */}
          <div className="mb-8">
            <div className="flex justify-center items-center py-4">
              <nav className="flex items-center gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`
                      relative flex flex-col items-center justify-center px-6 py-3 rounded-xl
                      transition-all duration-300 group
                      ${activeTab === tab.id
                        ? 'text-brand-600 dark:text-brand-400'
                        : 'text-slate-400 dark:text-dark-600 hover:text-slate-600 dark:hover:text-dark-700 hover:bg-slate-50 dark:hover:bg-dark-300/30'
                      }
                    `}
                    style={{
                      transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}
                  >
                    {/* 图标 */}
                    <span 
                      className={`
                        transition-all duration-300
                        ${activeTab === tab.id ? 'scale-110' : 'scale-100 group-hover:scale-105'}
                      `}
                      style={{
                        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                        fontSize: '28px'
                      }}
                    >
                      {tab.icon}
                    </span>
                    
                    {/* 标签文字 */}
                    <span className={`
                      mt-1.5 text-xs font-medium transition-all duration-300
                      ${activeTab === tab.id ? 'opacity-100 font-semibold' : 'opacity-70'}
                    `}>
                      {tab.name}
                    </span>
                    
                    {/* 选中指示器 - 底部下划线 */}
                    {activeTab === tab.id && (
                      <div 
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-gradient-to-r from-brand-500 to-brand-600 rounded-full animate-scale-in"
                        style={{
                          width: '32px',
                          animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                        }}
                      />
                    )}
                  </button>
                ))}
              </nav>
            </div>
            
            {/* 分隔线 */}
            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-dark-400 to-transparent" />
          </div>

          {/* 标签页内容 */}
          <div className="relative overflow-hidden min-h-[600px]">
            <div 
              key={animationKey}
              className="settings-tab-content animate-fade-slide-up"
            >
              {renderTabContent()}
            </div>
          </div>
        </div>
    </div>
  );
}



