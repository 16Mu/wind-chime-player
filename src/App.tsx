/**
 * App主组件 - 重构版
 * 
 * 架构改进：
 * - 使用Context分层管理状态（ThemeContext, UIContext, LibraryContext, PlaybackContext）
 * - 减少state数量从18个到3个
 * - 事件监听集中管理
 * - 高内聚低耦合设计
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

// Components
import Sidebar from './components/Sidebar';
import LibraryPage from './components/LibraryPage';
import PlaylistPlayer from './components/PlaylistPlayer';
import ExplorePage from './components/ExplorePage';
import PlaylistsPage from './components/PlaylistsPage';
import FavoritesView from './components/FavoritesView';
import SettingsPageNew from './components/SettingsPageNew';
import PlayHistoryPage from './components/PlayHistoryPage';

// Contexts
import { ThemeProvider } from './contexts/ThemeContext';
import { UIProvider, useUI } from './contexts/UIContext';
import { LibraryProvider, useLibrary } from './contexts/LibraryContext';
import { PlaybackProvider } from './contexts/PlaybackContext';
import { PlaylistProvider } from './contexts/PlaylistContext';
import { PlayHistoryProvider } from './contexts/PlayHistoryContext';
import { ToastProvider } from './contexts/ToastContext';
import { RemoteSourceProvider } from './contexts/RemoteSourceContext';
// ConfigProvider 已移除（高级设置功能已删除）
// import { ConfigProvider } from './contexts/ConfigContext';

// Types
import type { Track } from './types/music';

// Hooks
import { useTauriEvent } from './hooks/useEventManager';

// Utils
import { startCacheCleanup } from './utils/cache';

// ==================== 音频错误处理组件 ====================

function AudioErrorDialog() {
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // 监听播放器错误
  useTauriEvent('player-error', (payload) => {
    console.error('播放器错误:', payload);
    
    const errorMsg = typeof payload === 'string' ? payload : payload?.PlaybackError || '未知错误';
    
    // 检查是否是音频设备相关错误
    if (
      errorMsg.includes('设备不可用') ||
      errorMsg.includes('NoDevice') ||
      errorMsg.includes('DeviceNotAvailable') ||
      errorMsg.includes('设备被其他应用占用')
    ) {
      setErrorMessage(errorMsg);
      setShowError(true);
    } else if (errorMsg === 'AUDIO_DEVICE_RESET_SUCCESS') {
      alert('✅ 音频设备重置成功！');
    } else if (errorMsg === 'AUDIO_DEVICE_RESET_PLEASE_REPLAY') {
      alert('🔄 音频设备已重置，请重新播放音乐。');
    } else {
      alert('播放失败: ' + errorMsg);
    }
  });

  const handleReset = async () => {
    if (typeof invoke === 'undefined') return;
    
    setIsResetting(true);
    try {
      await invoke('reset_audio_device');
      setShowError(false);
      alert('✅ 音频设备重置成功！');
    } catch (error) {
      alert('❌ 重置失败: ' + error);
    } finally {
      setIsResetting(false);
    }
  };

  const handleDiagnose = async () => {
    if (typeof invoke === 'undefined') return;
    
    try {
      const diagnostics = await invoke('diagnose_audio_system') as string;
      const newWindow = window.open('', '_blank', 'width=600,height=800');
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head>
              <title>音频系统诊断</title>
              <style>
                body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
                pre { background: #f5f5f5; padding: 15px; border-radius: 8px; }
              </style>
            </head>
            <body>
              <h1>🔍 音频系统诊断报告</h1>
              <pre>${diagnostics}</pre>
            </body>
          </html>
        `);
      }
    } catch (error) {
      alert('❌ 诊断失败: ' + error);
    }
  };

  if (!showError) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-surface rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-2">🎵 音频设备问题</h3>
          <p className="text-sm text-gray-600">{errorMessage}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDiagnose}
            className="flex-1 px-4 py-3 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 text-white text-sm font-medium rounded-xl"
          >
            🔍 诊断
          </button>
          <button
            onClick={handleReset}
            disabled={isResetting}
            className="flex-1 px-4 py-3 bg-green-600 dark:bg-green-500 hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-dark-500 text-white text-sm font-medium rounded-xl"
          >
            {isResetting ? '⏳ 重置中...' : '🔧 重置'}
          </button>
          <button
            onClick={() => setShowError(false)}
            className="px-4 py-3 bg-gray-200 dark:bg-dark-300 hover:bg-gray-300 dark:hover:bg-dark-400 text-sm font-medium rounded-xl"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== 主应用内容组件 ====================

function AppContent() {
  // 使用Context获取状态和方法
  const { currentPage, pageAnimationKey, searchQuery, sidebarCollapsed } = useUI();
  const { navigateTo, setSearchQuery, clearSearch, setSidebarCollapsed } = useUI();
  const { tracks, searchTracks } = useLibrary();

  // 本地状态：只保留确实需要的
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  // ========== 事件处理 ==========

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    searchTracks(query);
  }, [setSearchQuery, searchTracks]);

  // 播放列表加载状态
  const playlistLoadedRef = useRef(false);
  const tracksLengthRef = useRef(0);
  const isPlayRequestPendingRef = useRef(false); // 是否有播放请求正在处理
  const latestRequestedTrackRef = useRef<Track | null>(null); // 最新请求的曲目
  
  // 当tracks变化时重置播放列表加载状态
  useEffect(() => {
    if (tracks.length !== tracksLengthRef.current) {
      playlistLoadedRef.current = false;
      tracksLengthRef.current = tracks.length;
      console.log(`📋 [TRACKS] 曲目数量变化: ${tracks.length}, 重置播放列表状态`);
    }
  }, [tracks]);
  
  // 🎯 终极方案：强制串行化，同时只有一个播放请求
  const handleTrackSelect = useCallback(async (track: Track) => {
    const timestamp = Date.now();
    console.log(`🎯 [${timestamp}] 点击播放:`, track.id, track.title);
    
    // 立即更新UI反馈
    setSelectedTrack(track);
    latestRequestedTrackRef.current = track;
    
    // 如果已经有请求在处理，只更新目标曲目，不发送新请求
    if (isPlayRequestPendingRef.current) {
      console.log(`⏰ [${timestamp}] 有请求在处理中，更新目标为:`, track.title);
      return;
    }
    
    // 标记为处理中
    isPlayRequestPendingRef.current = true;
    
    // 执行播放请求
    const executePlay = async () => {
      try {
        // 获取最新的目标曲目
        const targetTrack = latestRequestedTrackRef.current;
        if (!targetTrack) return;
        
        const execTimestamp = Date.now();
        console.log(`▶️ [${execTimestamp}] 执行播放（使用 Web Audio Player）:`, targetTrack.id, targetTrack.title);
        
        // 🔥 使用 Web Audio Player 播放
        const { webAudioPlayer } = await import('./services/webAudioPlayer');
        
        // 设置播放列表
        if (!playlistLoadedRef.current && tracks.length > 0) {
          console.log(`📋 [${execTimestamp}] 设置播放列表 (${tracks.length}首)`);
          const currentIndex = tracks.findIndex(t => t.id === targetTrack.id);
          webAudioPlayer.setPlaylist(tracks, currentIndex >= 0 ? currentIndex : 0);
          playlistLoadedRef.current = true;
        }
        
        // 加载并播放歌曲
        console.log(`🎵 [${execTimestamp}] 开始加载歌曲...`);
        const loadSuccess = await webAudioPlayer.loadTrack(targetTrack);
        if (!loadSuccess) {
          throw new Error('加载歌曲失败');
        }
        
        const playSuccess = await webAudioPlayer.play();
        if (!playSuccess) {
          throw new Error('播放失败');
        }
        
        console.log(`✅ [${execTimestamp}] 播放命令完成`);
      } catch (error) {
        console.error(`❌ 播放失败:`, error);
      } finally {
        // 处理完成，检查是否有新的目标
        isPlayRequestPendingRef.current = false;
        
        // 如果有新的目标，延迟后再次执行
        if (latestRequestedTrackRef.current !== track) {
          console.log(`🔄 检测到新目标，500ms后执行`);
          setTimeout(() => {
            if (latestRequestedTrackRef.current && !isPlayRequestPendingRef.current) {
              isPlayRequestPendingRef.current = true;
              executePlay();
            }
          }, 500);
        }
      }
    };
    
    // 立即执行
    executePlay();
  }, [tracks]);

  // ========== 窗口控制 ==========

  const handleMinimize = useCallback(async () => {
    try {
      await invoke('minimize_window');
    } catch (error) {
      console.error('最小化失败:', error);
    }
  }, []);

  const handleMaximize = useCallback(async () => {
    try {
      await invoke('toggle_maximize');
    } catch (error) {
      console.error('最大化失败:', error);
    }
  }, []);

  const handleClose = useCallback(async () => {
    try {
      await invoke('close_window');
    } catch (error) {
      console.error('关闭失败:', error);
    }
  }, []);

  const handleDragStart = useCallback(async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-tauri-drag-region="false"]')) return;
    
    try {
      await getCurrentWindow().startDragging();
    } catch (error) {
      console.error('拖拽失败:', error);
    }
  }, []);

  // ========== 渲染 ==========

  return (
    <div className="app-container">
      {/* 顶部标题栏 */}
      <header 
        className="app-header h-16 flex items-center justify-between px-6 relative dark:bg-dark-100/90 dark:border-dark-500/30"
        onMouseDown={handleDragStart}
      >
        <div className="absolute inset-0 z-0" data-tauri-drag-region></div>
        
        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-400 dark:from-brand-600 dark:to-sky-400 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white text-sm font-bold">W</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-dark-900 leading-tight">WindChime Player</h1>
            <p className="text-xs text-slate-500 dark:text-dark-700 leading-tight">现代化音乐播放器</p>
          </div>
        </div>

        {/* 搜索栏 */}
        <div className="w-full max-w-md mx-8 relative z-20" data-tauri-drag-region="false">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="搜索音乐、艺术家或专辑..."
              className="glass-input w-full pr-10 dark:bg-glass-dark-bg dark:border-glass-dark-border dark:text-dark-900"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {searchQuery ? (
                <button onClick={clearSearch} className="text-slate-400 dark:text-dark-700 hover:text-slate-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : (
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* 窗口控制按钮 */}
        <div className="flex items-center gap-2 relative z-20" data-tauri-drag-region="false">
          <button onClick={handleMinimize} className="w-9 h-9 rounded-xl glass-surface glass-interactive flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
            </svg>
          </button>
          <button onClick={handleMaximize} className="w-9 h-9 rounded-xl glass-surface glass-interactive flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2m8-16h2a2 2 0 012 2v2m-4 12h2a2 2 0 002-2v-2" />
            </svg>
          </button>
          <button onClick={handleClose} className="w-9 h-9 rounded-xl glass-surface glass-interactive flex items-center justify-center hover:border-red-300">
            <svg className="w-4 h-4 group-hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <div className={`app-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Sidebar 
          currentPage={currentPage} 
          onNavigate={navigateTo}
          onCollapseChange={setSidebarCollapsed}
        />
        
        <main className="app-content">
          {currentPage === 'explore' && (
            <div key={`explore-${pageAnimationKey}`} className="page-transition p-6 pb-28 h-full">
              <div className="glass-card h-full">
                <ExplorePage />
              </div>
            </div>
          )}
          
          {currentPage === 'library' && (
            <div key={`library-${pageAnimationKey}`} className="page-transition p-6 pb-28">
              <LibraryPage 
                onTrackSelect={handleTrackSelect}
                selectedTrackId={selectedTrack?.id}
              />
            </div>
          )}
          
          {currentPage === 'playlists' && (
            <div key={`playlists-${pageAnimationKey}`} className="page-transition p-6 h-full">
              <PlaylistsPage 
                onTrackSelect={handleTrackSelect}
                selectedTrackId={selectedTrack?.id}
              />
            </div>
          )}
          
          {currentPage === 'history' && (
            <div key={`history-${pageAnimationKey}`} className="page-transition p-6 pb-28">
              <PlayHistoryPage />
            </div>
          )}
          
          {currentPage === 'favorite' && (
            <div key={`favorite-${pageAnimationKey}`} className="page-transition p-6 pb-28">
              <FavoritesView 
                onTrackSelect={handleTrackSelect}
                selectedTrackId={selectedTrack?.id}
              />
            </div>
          )}
          
          {currentPage === 'genres' && (
            <div key={`genres-${pageAnimationKey}`} className="page-transition p-6 pb-28 h-full">
              <div className="glass-card h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-slate-400 dark:text-dark-700 mb-6">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold mb-4">音乐分类</h2>
                  <p className="text-lg mb-6">按风格和类型浏览音乐</p>
                  <div className="glass-badge brand">即将推出</div>
                </div>
              </div>
            </div>
          )}
          
          {currentPage === 'settings' && (
            <div key={`settings-${pageAnimationKey}`} className="page-transition p-0 h-full">
              <SettingsPageNew />
            </div>
          )}
          
          {/* 底部播放器 */}
          <div 
            className="content-player-container"
            style={{
              '--sidebar-width': sidebarCollapsed ? '80px' : '240px'
            } as React.CSSProperties}
          >
            <PlaylistPlayer currentTrack={selectedTrack} />
          </div>
        </main>
      </div>

      {/* 音频错误对话框 */}
      <AudioErrorDialog />
    </div>
  );
}

// ==================== 根组件 ====================

export default function App() {
  // 启动缓存自动清理
  useEffect(() => {
    const cleanup = startCacheCleanup();
    return () => cleanup();
  }, []);

  return (
    <ThemeProvider>
      <RemoteSourceProvider>
        <UIProvider initialPage="library">
          <LibraryProvider>
            <PlaybackProvider>
              <PlaylistProvider>
                <PlayHistoryProvider>
                  <ToastProvider>
                    <AppContent />
                  </ToastProvider>
                </PlayHistoryProvider>
              </PlaylistProvider>
            </PlaybackProvider>
          </LibraryProvider>
        </UIProvider>
      </RemoteSourceProvider>
    </ThemeProvider>
  );
}
