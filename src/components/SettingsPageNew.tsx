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

import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useUI } from '../contexts/UIContext';
import { searchSettings } from '../utils/settingsSearch';
import type { SettingItem } from '../utils/settingsSearch';
import { SearchResultsDropdown } from './settings/SearchResultsDropdown';

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

  // 从UIContext获取搜索状态
  const {
    settingsSearchQuery,
    settingsSearchVisible,
    setSettingsSearchQuery,
    clearSettingsSearch,
    hideSettingsSearch,
    highlightedSettingId,
    setHighlightedSettingId,
    navigateTo
  } = useUI();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchResults, setSearchResults] = useState<SettingItem[]>([]);

  // 当搜索框可见时自动聚焦
  useEffect(() => {
    if (settingsSearchVisible && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [settingsSearchVisible]);

  // 实时搜索设置项
  useEffect(() => {
    if (settingsSearchQuery.trim()) {
      const results = searchSettings(settingsSearchQuery);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [settingsSearchQuery]);

  // ESC键关闭搜索框
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && settingsSearchVisible) {
        hideSettingsSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsSearchVisible, hideSettingsSearch]);

  // 根据搜索查询过滤Tab
  const getFilteredTabs = () => {
    if (!settingsSearchQuery.trim()) {
      return TABS;
    }

    const query = settingsSearchQuery.toLowerCase();
    return TABS.filter(tab => 
      tab.label.toLowerCase().includes(query) ||
      tab.id.toLowerCase().includes(query)
    );
  };

  const filteredTabs = getFilteredTabs();

  // 检查Tab是否匹配搜索
  const isTabMatched = (tabId: SettingsTab) => {
    if (!settingsSearchQuery.trim()) return false;
    return filteredTabs.some(tab => tab.id === tabId);
  };

  // 处理搜索结果选择
  const handleSelectSearchResult = (item: SettingItem) => {
    // 跳转到对应的Tab
    setActiveTab(item.tab);
    
    // 设置高亮的设置项ID
    setHighlightedSettingId(item.id);
    
    // 等待Tab切换和渲染完成后滚动到目标位置
    setTimeout(() => {
      const element = document.getElementById(item.sectionId || '');
      if (element) {
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center'
        });
      }
    }, 100);
    
    // 3秒后自动取消高亮
    setTimeout(() => {
      setHighlightedSettingId(null);
    }, 3000);
  };

  // 渲染对应的设置内容
  const renderContent = () => {
    // 如果有搜索查询但当前Tab不匹配，显示提示
    if (settingsSearchQuery.trim() && !isTabMatched(activeTab)) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-16 h-16 text-slate-300 dark:text-dark-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-700 dark:text-dark-800 mb-2">
            当前分类不匹配搜索条件
          </h3>
          <p className="text-sm text-slate-500 dark:text-dark-600 mb-4">
            请切换到高亮的分类标签查看搜索结果
          </p>
          {filteredTabs.length > 0 && (
            <button
              onClick={() => setActiveTab(filteredTabs[0].id)}
              className="px-4 py-2 bg-brand-500 dark:bg-brand-600 text-white rounded-lg
                       hover:bg-brand-600 dark:hover:bg-brand-700 transition-colors duration-200"
            >
              跳转到 {filteredTabs[0].label}
            </button>
          )}
        </div>
      );
    }

    switch (activeTab) {
      case 'library':
        return <LibrarySettings highlightedSettingId={highlightedSettingId} />;
      
      case 'appearance':
        return (
          <AppearanceSettings
            theme={theme}
            onThemeChange={setTheme}
            isHighContrast={isHighContrast}
            onToggleHighContrast={toggleHighContrast}
            highlightedSettingId={highlightedSettingId}
          />
        );
      
      case 'animation':
        return (
          <AnimationSettings
            lyricsAnimationSettings={lyricsAnimationSettings}
            onUpdateLyricsAnimationSettings={updateLyricsAnimationSettings}
            highlightedSettingId={highlightedSettingId}
          />
        );
      
      case 'playback':
        return <PlaybackSettings highlightedSettingId={highlightedSettingId} />;
      
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
          {/* 小标题 + 搜索框 */}
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

            {/* 右侧搜索框 */}
            {settingsSearchVisible && (
              <div className="relative flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="relative w-96">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={settingsSearchQuery}
                    onChange={(e) => setSettingsSearchQuery(e.target.value)}
                    placeholder="搜索设置项，例如：歌词动画、主题、音频..."
                    className="w-full px-4 py-2 pr-10 rounded-lg
                             text-sm
                             bg-slate-50 dark:bg-dark-100
                             border border-slate-200 dark:border-dark-400
                             text-slate-900 dark:text-dark-900
                             placeholder-slate-400 dark:placeholder-dark-600
                             focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400
                             transition-all duration-200"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {settingsSearchQuery ? (
                      <button
                        onClick={clearSettingsSearch}
                        className="w-5 h-5 flex items-center justify-center
                                 text-slate-400 dark:text-dark-600
                                 hover:text-slate-600 dark:hover:text-dark-800
                                 transition-colors duration-200"
                        aria-label="清除搜索"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    ) : (
                      <svg 
                        className="w-4 h-4 text-slate-400 dark:text-dark-600"
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    )}
                  </div>

                  {/* 搜索结果下拉 */}
                  {settingsSearchQuery.trim() && (
                    <SearchResultsDropdown
                      results={searchResults}
                      query={settingsSearchQuery}
                      onSelect={handleSelectSearchResult}
                      onClose={hideSettingsSearch}
                    />
                  )}
                </div>
                <button
                  onClick={hideSettingsSearch}
                  className="p-2 rounded-lg
                           text-slate-400 dark:text-dark-600
                           hover:text-slate-600 dark:hover:text-dark-800
                           hover:bg-slate-100 dark:hover:bg-dark-200
                           transition-all duration-200"
                  aria-label="关闭搜索"
                  title="关闭搜索 (ESC)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* 搜索结果提示 */}
          {settingsSearchQuery.trim() && (
            <div className="mb-3 text-center">
              <p className="text-xs text-slate-500 dark:text-dark-600">
                {filteredTabs.length > 0 ? (
                  <>
                    找到 <span className="font-semibold text-amber-600 dark:text-amber-400">{filteredTabs.length}</span> 个匹配的设置分类
                  </>
                ) : (
                  <span className="text-slate-400 dark:text-dark-700">未找到匹配的设置分类</span>
                )}
              </p>
            </div>
          )}

          {/* Tab导航 - 横向滑动指示器 */}
          <div className="relative flex justify-center">
            <div className="relative flex">
              {TABS.map((tab) => {
                const isMatched = isTabMatched(tab.id);
                const isFiltered = settingsSearchQuery.trim() && !isMatched;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex flex-col items-center gap-1.5 px-6 py-3
                      whitespace-nowrap transition-all duration-300 relative z-10
                      ${activeTab === tab.id
                        ? 'text-brand-600 dark:text-brand-400'
                        : isMatched
                          ? 'text-amber-500 dark:text-amber-400'
                          : isFiltered
                            ? 'opacity-30 text-slate-300 dark:text-dark-700'
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
                    <span className="text-sm font-medium relative">
                      {tab.label}
                      {/* 搜索匹配标记 */}
                      {isMatched && (
                        <span className="absolute -top-1 -right-3 w-1.5 h-1.5 bg-amber-500 dark:bg-amber-400 rounded-full"></span>
                      )}
                    </span>
                  </button>
                );
              })}
              
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

