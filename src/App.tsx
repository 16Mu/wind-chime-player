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
import SearchBar from './components/ui/SearchBar';

// Contexts
import { ThemeProvider } from './contexts/ThemeContext';
import { UIProvider, useUI } from './contexts/UIContext';
import { LibraryProvider, useLibrary } from './contexts/LibraryContext';
import { PlaybackProvider, usePlaybackControl } from './contexts/PlaybackContext';
import { PlaylistProvider } from './contexts/PlaylistContext';
import { PlayHistoryProvider } from './contexts/PlayHistoryContext';
import { ToastProvider } from './contexts/ToastContext';
import { RemoteSourceProvider } from './contexts/RemoteSourceContext';
import { CoverCacheProvider } from './contexts/CoverCacheContext';
// ConfigProvider 已移除（高级设置功能已删除）
// import { ConfigProvider } from './contexts/ConfigContext';

// Types
import type { Track } from './types/music';

// Services - 🔧 静态导入，避免点击时动态加载导致卡顿
import { hybridPlayer } from './services/hybridPlayer';

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
  const updatePlaybackState = usePlaybackControl();

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
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null); // 延迟重试定时器
  const currentPlayingTrackIdRef = useRef<number | null>(null); // 当前正在播放的歌曲ID
  
  // 当tracks变化时重置播放列表加载状态
  useEffect(() => {
    if (tracks.length !== tracksLengthRef.current) {
      playlistLoadedRef.current = false;
      tracksLengthRef.current = tracks.length;
      console.log(`📋 [TRACKS] 曲目数量变化: ${tracks.length}, 重置播放列表状态`);
    }
    
    // 清理定时器
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [tracks]);
  
  // 🎯 终极方案：强制串行化，同时只有一个播放请求
  // ⚙️ 性能优化：普通点击播放仅发送 trackId，不再每次传递整库 tracks 给后端
  const handleTrackSelect = useCallback(async (track: Track) => {
    const timestamp = Date.now();
    console.log(`🎯 [${timestamp}] 点击播放:`, track.id, track.title);
    
    // 🔥 清除之前的重试定时器
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      console.log(`🧹 [${timestamp}] 清除之前的重试定时器`);
    }
    
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
        
        // 🔥 防止重复播放同一首歌
        if (currentPlayingTrackIdRef.current === targetTrack.id) {
          console.log(`⏭️ 跳过重复播放: track ${targetTrack.id} 已经在播放中`);
          return;
        }
        
        const execTimestamp = Date.now();
        console.log(`▶️ [${execTimestamp}] 执行播放（使用混合播放器）:`, targetTrack.id, targetTrack.title);
        
        // 🔥 立即更新UI状态，不等待播放实际开始（避免卡顿）
        updatePlaybackState({
          track: targetTrack,
          isPlaying: true,
        });
        currentPlayingTrackIdRef.current = targetTrack.id;
        playlistLoadedRef.current = true;
        
        console.log(`✅ [${execTimestamp}] UI已更新，开始播放...`);
        
        // 🚀 异步播放，不阻塞UI（使用Promise.then而不是await）
        // 普通点击播放：只传递当前曲目，让后端按既有播放列表/模式处理
        hybridPlayer.play(targetTrack)
          .then(playSuccess => {
            if (playSuccess) {
              console.log(`✅ [${execTimestamp}] 播放命令完成（Rust 已启动，Web Audio 后台加载中...）`);
            } else {
              console.error(`❌ [${execTimestamp}] 播放失败`);
              // 播放失败时恢复UI状态
              if (currentPlayingTrackIdRef.current === targetTrack.id) {
                updatePlaybackState({
                  track: null,
                  isPlaying: false,
                });
                currentPlayingTrackIdRef.current = null;
              }
            }
          })
          .catch(error => {
            console.error(`❌ [${execTimestamp}] 播放异常:`, error);
            // 播放失败时恢复UI状态
            if (currentPlayingTrackIdRef.current === targetTrack.id) {
              updatePlaybackState({
                track: null,
                isPlaying: false,
              });
              currentPlayingTrackIdRef.current = null;
            }
          });
        
      } catch (error) {
        console.error(`❌ 播放失败:`, error);
      } finally {
        // 处理完成，检查是否有新的目标
        isPlayRequestPendingRef.current = false;
        
        // 🔥 清除之前的重试定时器
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        
        // 如果有新的目标且不是当前播放的歌曲，延迟后再次执行
        const latestTrack = latestRequestedTrackRef.current;
        if (latestTrack && latestTrack.id !== currentPlayingTrackIdRef.current) {
          console.log(`🔄 检测到新目标（${latestTrack.title}），500ms后执行`);
          retryTimerRef.current = setTimeout(() => {
            if (latestRequestedTrackRef.current && 
                !isPlayRequestPendingRef.current &&
                latestRequestedTrackRef.current.id !== currentPlayingTrackIdRef.current) {
              isPlayRequestPendingRef.current = true;
              executePlay();
            }
          }, 500);
        }
      }
    };
    
    // 立即执行
    executePlay();
  }, [updatePlaybackState]);

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

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // 优化：使用 dataset 检查，比 closest 更快
    if (target.dataset.tauriDragRegion === 'false') return;
    
    // 检查父元素（最多检查3层，避免深度遍历）
    let current: HTMLElement | null = target;
    let depth = 0;
    while (current && depth < 3) {
      if (current.dataset.tauriDragRegion === 'false') return;
      current = current.parentElement;
      depth++;
    }
    
    // 异步启动拖动，不阻塞主线程
    getCurrentWindow().startDragging().catch(error => {
      console.error('拖拽失败:', error);
    });
  }, []);

  // ========== 渲染 ==========

  return (
    <div className="app-container">
      {/* 顶部标题栏 - 优化性能：移除不必要的样式计算 */}
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

        {/* 搜索栏 - 外层容器允许拖拽，只有搜索框本身不可拖拽 */}
        <div className="w-full max-w-md mx-8 relative z-20">
          <SearchBar 
            value={searchQuery}
            onChange={handleSearch}
            onClear={clearSearch}
            placeholder="搜索音乐、艺术家或专辑..."
          />
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
            <div key={`explore-${pageAnimationKey}`} className="page-transition p-6 h-full overflow-y-auto">
              <div className="glass-card h-full">
                <ExplorePage />
              </div>
            </div>
          )}
          
          {currentPage === 'library' && (
            <div key={`library-${pageAnimationKey}`} className="page-transition h-full">
              <LibraryPage 
                onTrackSelect={handleTrackSelect}
                selectedTrackId={selectedTrack?.id}
              />
            </div>
          )}
          
          {currentPage === 'playlists' && (
            <div key={`playlists-${pageAnimationKey}`} className="page-transition p-6 h-full overflow-y-auto">
              <PlaylistsPage 
                onTrackSelect={handleTrackSelect}
                selectedTrackId={selectedTrack?.id}
              />
            </div>
          )}
          
          {currentPage === 'history' && (
            <div key={`history-${pageAnimationKey}`} className="page-transition p-6 h-full overflow-y-auto">
              <PlayHistoryPage />
            </div>
          )}
          
          {currentPage === 'favorite' && (
            <div key={`favorite-${pageAnimationKey}`} className="page-transition p-6 h-full overflow-y-auto">
              <FavoritesView 
                onTrackSelect={handleTrackSelect}
                selectedTrackId={selectedTrack?.id}
              />
            </div>
          )}
          
          {currentPage === 'genres' && (
            <div key={`genres-${pageAnimationKey}`} className="page-transition p-6 h-full overflow-y-auto">
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
              '--sidebar-width': sidebarCollapsed ? '80px' : undefined // 🔥 不展开时为 80px，展开时由 CSS 媒体查询控制
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
        <CoverCacheProvider>
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
        </CoverCacheProvider>
      </RemoteSourceProvider>
    </ThemeProvider>
  );
}
