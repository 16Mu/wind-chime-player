import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import Sidebar from './components/Sidebar';
import LibraryPage from './components/LibraryPage';
import PlaylistPlayer from './components/PlaylistPlayer';
import ExplorePage from './components/ExplorePage';
import PlaylistManager from './components/PlaylistManager';
import FavoritesView from './components/FavoritesView';
import SettingsPage from './components/SettingsPage';
import { ToastProvider } from './contexts/ToastContext';
import { PlaybackProvider } from './contexts/PlaybackContext';

export type Page = 'explore' | 'library' | 'playlist' | 'favorite' | 'genres' | 'settings';

interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
}

interface LibraryStats {
  total_tracks: number;
  total_artists: number;
  total_albums: number;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('library');
  const [pageAnimationKey, setPageAnimationKey] = useState(0); // 用于触发页面切换动画
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // 主题设置 (system/light/dark)
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('windchime-theme');
      if (stored && ['system', 'light', 'dark'].includes(stored)) {
        return stored as 'system' | 'light' | 'dark';
      }
    }
    return 'system';
  });

  // 高对比度设置
  const [isHighContrast, setIsHighContrast] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('windchime-high-contrast');
      if (stored !== null) {
        return stored === 'true';
      }
      return window.matchMedia('(prefers-contrast: more)').matches;
    }
    return false;
  });

  // 🎨 歌词滚动动画设置
  const [lyricsAnimationSettings, setLyricsAnimationSettings] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('windchime-lyrics-animation-settings');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (error) {
          console.warn('Failed to parse lyrics animation settings:', error);
        }
      }
    }
    return {
      style: 'BOUNCY_SOFT' // 默认使用轻柔Q弹效果
    };
  });
  
  // 音乐库数据状态
  const [tracks, setTracks] = useState<Track[]>([]);
  const [libraryStats, setLibraryStats] = useState<LibraryStats | null>(null);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const [hasLibraryInitialized, setHasLibraryInitialized] = useState(false);
  const [libraryDataCached, setLibraryDataCached] = useState(false);
  
  // 音频设备错误处理状态
  const [showAudioDeviceError, setShowAudioDeviceError] = useState(false);
  const [audioErrorMessage, setAudioErrorMessage] = useState<string>('');
  const [isResettingAudio, setIsResettingAudio] = useState(false);

  // ✅ 移除重复的事件监听 - PlaybackContext已经处理了player-track-changed事件
  // selectedTrack现在可以从PlaybackContext同步获取（如需要的话）

  // 页面切换处理（带动画）
  const handlePageChange = (page: Page) => {
    if (page !== currentPage) {
      setCurrentPage(page);
      setPageAnimationKey(prev => prev + 1); // 触发动画
    }
  };

  // 播放曲目处理
  const handleTrackSelect = async (track: Track) => {
    console.log('全局播放曲目:', track);
    
    if (typeof invoke !== 'undefined') {
      try {
        console.log('加载播放列表，共', tracks.length, '首歌曲');
        await invoke('player_load_playlist', { tracks });
        console.log('播放列表加载完成，开始播放曲目:', track.title);
        
        await invoke('player_play', { track_id: track.id, trackId: track.id });
        console.log('播放命令已发送');
      } catch (error) {
        console.error('播放失败:', error);
      }
    }
    
    setSelectedTrack(track);
    console.log('设置选中曲目完成');
  };

  // 窗口控制函数
  const handleMinimize = async () => {
    try {
      await invoke('minimize_window');
    } catch (error) {
      console.error('最小化窗口失败:', error);
    }
  };

  const handleMaximize = async () => {
    try {
      await invoke('toggle_maximize');
    } catch (error) {
      console.error('最大化窗口失败:', error);
    }
  };

  const handleClose = async () => {
    try {
      await invoke('close_window');
    } catch (error) {
      console.error('关闭窗口失败:', error);
    }
  };

  // 窗口拖拽处理
  const handleDragStart = async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const noDragElement = target.closest('[data-tauri-drag-region="false"]');
    
    if (noDragElement) {
      return;
    }
    
    try {
      await getCurrentWindow().startDragging();
    } catch (error) {
      console.error('拖拽失败:', error);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  // 音频设备重置处理
  const handleResetAudioDevice = async () => {
    if (typeof invoke === 'undefined') return;
    
    setIsResettingAudio(true);
    try {
      const result = await invoke('reset_audio_device');
      console.log('🔧 音频设备重置结果:', result);
      setShowAudioDeviceError(false);
      setAudioErrorMessage('');
      alert('✅ 音频设备重置成功！请尝试重新播放音乐。');
    } catch (error) {
      console.error('音频设备重置失败:', error);
      alert('❌ 音频设备重置失败: ' + error);
    } finally {
      setIsResettingAudio(false);
    }
  };

  const handleDiagnoseAudioSystem = async () => {
    if (typeof invoke === 'undefined') return;
    
    try {
      const diagnostics = await invoke('diagnose_audio_system') as string;
      console.log('🔍 音频系统诊断结果:', diagnostics);
      
      // 在新窗口中显示诊断结果
      const newWindow = window.open('', '_blank', 'width=600,height=800,scrollbars=yes');
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head>
              <title>WindChime Player - 音频系统诊断</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                       padding: 20px; line-height: 1.6; background: #f5f5f5; }
                pre { background: white; padding: 15px; border-radius: 8px; 
                      box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow-x: auto; }
                h1 { color: #2563eb; margin-bottom: 20px; }
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
      console.error('音频系统诊断失败:', error);
      alert('❌ 音频系统诊断失败: ' + error);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    handleLibrarySearch(query);
  };

  // 主题切换
  const changeTheme = useCallback((newTheme: 'system' | 'light' | 'dark') => {
    setTheme(newTheme);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('windchime-theme', newTheme);
    }
  }, []);

  // 高对比度切换
  const toggleHighContrast = useCallback(() => {
    const newValue = !isHighContrast;
    setIsHighContrast(newValue);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('windchime-high-contrast', newValue.toString());
    }
  }, [isHighContrast]);

  // 🎨 更新歌词滚动动画设置
  const updateLyricsAnimationSettings = useCallback((newSettings: Partial<typeof lyricsAnimationSettings>) => {
    const updated = { ...lyricsAnimationSettings, ...newSettings };
    setLyricsAnimationSettings(updated);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('windchime-lyrics-animation-settings', JSON.stringify(updated));
    }
  }, [lyricsAnimationSettings]);

  // 音乐库数据加载
  const loadLibraryTracks = useCallback(async () => {
    if (typeof invoke === 'undefined') {
      console.warn('Tauri API 不可用，跳过加载曲目');
      return;
    }
    try {
      console.log('📨 发送加载曲目请求...');
      setIsLibraryLoading(true);
      await invoke('library_get_tracks');
      console.log('✅ 加载曲目请求已发送，等待后端响应...');
    } catch (error) {
      console.error('加载音乐失败:', error);
      setIsLibraryLoading(false);
    }
  }, []);

  const loadLibraryStats = useCallback(async () => {
    if (typeof invoke === 'undefined') {
      console.warn('Tauri API 不可用，跳过加载统计');
      return;
    }
    try {
      console.log('开始加载统计数据...');
      console.log('当前libraryStats状态:', libraryStats);
      await invoke('library_get_stats');
      console.log('统计数据请求已发送，等待后端响应...');
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  }, [libraryStats]);

  const handleLibrarySearch = useCallback(async (query: string) => {
    if (typeof invoke === 'undefined') return;
    
    if (query && query.trim()) {
      console.log('执行搜索:', query);
      try {
        if (!libraryDataCached) {
          setIsLibraryLoading(true);
        }
        await invoke('library_search', { query: query.trim() });
      } catch (error) {
        console.error('搜索失败:', error);
        setIsLibraryLoading(false);
      }
    } else {
      // 恢复完整列表
      if (libraryDataCached && hasLibraryInitialized) {
        console.log('恢复缓存的音乐库数据');
        await loadLibraryTracks();
      } else if (hasLibraryInitialized) {
        console.log('重新加载音乐库数据');
        setIsLibraryLoading(true);
        loadLibraryTracks();
      }
    }
  }, [hasLibraryInitialized, libraryDataCached]);
  
  // 监听曲目选择
  useEffect(() => {
    if (selectedTrack) {
      console.log('曲目已选择:', selectedTrack.title);
    }
  }, [selectedTrack]);

  // 应用初始化 - 等待后端就绪
  useEffect(() => {
    console.log('应用启动，初始页面:', currentPage);

    const initializeLibraryData = async () => {
      const isInTauriApp = typeof window !== 'undefined' && (window as any).__TAURI__;
      
      if (!isInTauriApp || typeof invoke === 'undefined' || typeof listen === 'undefined') {
        console.warn('Tauri API 不可用，使用模拟数据');
        // 设置模拟数据
        const mockTracks: Track[] = [
          {
            id: 1,
            path: '/mock/song1.mp3',
            title: '静夜思',
            artist: '李白',
            album: '古诗词选集',
            duration_ms: 180000,
          },
          {
            id: 2,
            path: '/mock/song2.mp3', 
            title: '春晓',
            artist: '孟浩然',
            album: '春日诗词',
            duration_ms: 210000,
          },
        ];
        setTracks(mockTracks);
        
        const uniqueArtists = new Set(mockTracks.map(track => track.artist).filter(artist => artist && artist.trim() !== ''));
        const uniqueAlbums = new Set(mockTracks.map(track => track.album).filter(album => album && album.trim() !== ''));
        
        setLibraryStats({
          total_tracks: mockTracks.length,
          total_artists: uniqueArtists.size,
          total_albums: uniqueAlbums.size,
        });
        setIsLibraryLoading(false);
        setHasLibraryInitialized(true);
        setLibraryDataCached(true);
        return;
      }

      // 🔥 关键修复：先设置所有事件监听器，再等待后端初始化
      console.log('⏰ 设置事件监听器并等待后端初始化...');
      setIsLibraryLoading(true);
      
      // 1. 先设置 library-tracks-loaded 监听器（必须在调用 loadLibraryTracks 之前）
      const unlistenTracksLoaded = await listen('library-tracks-loaded', (event: any) => {
        console.log('📥 收到 library-tracks-loaded 事件:', event.payload);
        if (Array.isArray(event.payload)) {
          console.log(`✅ 加载了 ${event.payload.length} 首曲目`);
          setTracks(event.payload);
          setIsLibraryLoading(false);
          setHasLibraryInitialized(true);
          setLibraryDataCached(true);
          
          if (event.payload.length === 0) {
            console.log('💡 数据库为空，请添加音乐文件夹');
          }
        } else {
          console.error('❌ tracks-loaded 事件格式错误:', event.payload);
          setIsLibraryLoading(false);
        }
      });

      // 2. 设置 library-stats 监听器
      const unlistenStats = await listen('library-stats', (event: any) => {
        console.log('📊 收到统计数据:', event.payload);
        setLibraryStats(event.payload);
      });

      // 3. 监听 app-ready 事件
      const unlistenAppReady = await listen('app-ready', async () => {
        console.log('✅ 后端初始化完成，开始加载音乐库数据...');
        try {
          await loadLibraryTracks();
          await loadLibraryStats();
        } catch (error) {
          console.error('初始化音乐库失败:', error);
          setIsLibraryLoading(false);
        }
      });

      // 4. 监听初始化错误
      const unlistenInitError = await listen('app-init-error', (event: any) => {
        console.error('❌ 后端初始化失败:', event.payload);
        setIsLibraryLoading(false);
      });

      // 5. 监听扫描完成事件 - 自动刷新曲目列表
      const unlistenScanComplete = await listen('library-scan-complete', async (event: any) => {
        console.log('🎉 扫描完成，自动刷新曲目列表...', event.payload);
        try {
          await loadLibraryTracks();
          await loadLibraryStats();
        } catch (error) {
          console.error('刷新曲目列表失败:', error);
        }
      });

      // 🔥 立即尝试加载曲目（如果后端已经就绪）
      // 因为 app-ready 事件可能在监听器设置之前就已经发送了
      console.log('🔍 监听器设置完成，立即尝试加载曲目...');
      setTimeout(async () => {
        try {
          console.log('⏰ 延迟100ms后开始加载曲目（确保后端完全就绪）...');
          await loadLibraryTracks();
          await loadLibraryStats();
        } catch (error) {
          console.error('首次加载曲目失败（可能后端未就绪）:', error);
        }
      }, 100);

      // 清理所有监听器
      return () => {
        if (typeof unlistenTracksLoaded === 'function') unlistenTracksLoaded();
        if (typeof unlistenStats === 'function') unlistenStats();
        if (typeof unlistenAppReady === 'function') unlistenAppReady();
        if (typeof unlistenInitError === 'function') unlistenInitError();
        if (typeof unlistenScanComplete === 'function') unlistenScanComplete();
      };
    };

    initializeLibraryData();
  }, []);

  // 设置其他音乐库事件监听（搜索结果等）
  useEffect(() => {
    if (typeof listen === 'undefined') return;

    const setupLibraryListeners = async () => {
      // 注意：library-tracks-loaded 和 library-stats 已在初始化 useEffect 中设置
      
      const unlistenSearchResults = await listen('library-search-results', (event: any) => {
        if (Array.isArray(event.payload)) {
          setTracks(event.payload);
          setIsLibraryLoading(false);
        }
      });

      // 监听播放器错误
      const unlistenPlayerError = await listen('player-error', (event: any) => {
        console.error('播放器错误:', event.payload);
        
        if (event.payload && typeof event.payload === 'object') {
          const errorMessage = event.payload.PlaybackError || '未知错误';
          
          // 检查是否是音频设备相关的错误
          if (errorMessage.includes('设备不可用') || 
              errorMessage.includes('NoDevice') ||
              errorMessage.includes('DeviceNotAvailable') ||
              errorMessage.includes('设备被其他应用占用') ||
              errorMessage === 'AUDIO_DEVICE_RESET_SUCCESS' ||
              errorMessage === 'AUDIO_DEVICE_RESET_PLEASE_REPLAY') {
            
            if (errorMessage === 'AUDIO_DEVICE_RESET_SUCCESS') {
              alert('✅ 音频设备重置成功！');
              return;
            }
            
            if (errorMessage === 'AUDIO_DEVICE_RESET_PLEASE_REPLAY') {
              alert('🔄 音频设备已重置，请重新播放音乐。');
              return;
            }
            
            // 显示音频设备错误对话框
            setAudioErrorMessage(errorMessage);
            setShowAudioDeviceError(true);
          } else {
            // 其他类型的播放错误
            alert('播放失败: ' + errorMessage);
          }
        }
      });

      return () => {
        unlistenSearchResults();
        unlistenPlayerError();
      };
    };

    const cleanup = setupLibraryListeners();
    
    return () => {
      cleanup.then(fn => fn && fn());
    };
  }, []);

  // 主题模式应用
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyTheme = (themeMode: 'system' | 'light' | 'dark') => {
      const root = document.documentElement;
      
      // 移除所有主题类
      root.classList.remove('dark');
      root.removeAttribute('data-theme');
      
      if (themeMode === 'dark') {
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
      } else if (themeMode === 'light') {
        root.setAttribute('data-theme', 'light');
      } else {
        // system - 根据系统偏好决定
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
          root.classList.add('dark');
          root.setAttribute('data-theme', 'dark');
        } else {
          root.setAttribute('data-theme', 'light');
        }
      }
    };

    applyTheme(theme);

    // 监听系统主题偏好变化
    const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    systemThemeQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      systemThemeQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [theme]);

  // 对比度模式应用
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyContrastMode = (highContrast: boolean) => {
      if (highContrast) {
        document.documentElement.setAttribute('data-contrast', 'high');
      } else {
        document.documentElement.removeAttribute('data-contrast');
      }
    };

    applyContrastMode(isHighContrast);

    // 监听系统偏好变化
    const mediaQuery = window.matchMedia('(prefers-contrast: more)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      const hasManualPreference = localStorage.getItem('windchime-high-contrast') !== null;
      if (!hasManualPreference) {
        setIsHighContrast(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, [isHighContrast]);


  return (
    <PlaybackProvider>
      <ToastProvider>
        <div className="app-container">
      {/* 顶部标题栏 */}
      <header 
        className="app-header h-16 flex items-center justify-between px-6 relative dark:bg-dark-100/90 dark:border-dark-500/30"
        onMouseDown={handleDragStart}
      >
        {/* 拖拽区域 */}
        <div 
          className="absolute inset-0 z-0"
          data-tauri-drag-region
        ></div>
        
        {/* 品牌标识 */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 bg-gradient-to-br from-brand-600 to-sky-400 rounded-xl flex items-center justify-center shadow-md">
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
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              placeholder="搜索音乐、艺术家或专辑..."
              className="glass-input w-full pr-10 dark:bg-glass-dark-bg dark:border-glass-dark-border dark:text-dark-900 dark:placeholder-dark-600"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none">
              {searchQuery ? (
                <button
                  onClick={clearSearch}
                  className="text-slate-400 hover:text-slate-600 pointer-events-auto transition-colors duration-200 w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-200"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* 窗口控制按钮 */}
        <div className="flex items-center gap-2 relative z-20" data-tauri-drag-region="false">
          <button
            onClick={handleMinimize}
            className="w-9 h-9 rounded-xl glass-surface glass-interactive flex items-center justify-center group"
            title="最小化"
          >
            <svg className="w-4 h-4 text-slate-600 group-hover:text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
            </svg>
          </button>
          
          <button
            onClick={handleMaximize}
            className="w-9 h-9 rounded-xl glass-surface glass-interactive flex items-center justify-center group"
            title="最大化/还原"
          >
            <svg className="w-4 h-4 text-slate-600 group-hover:text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2M16 4h2a2 2 0 012 2v2M16 20h2a2 2 0 002-2v-2" />
            </svg>
          </button>
          
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-xl glass-surface glass-interactive flex items-center justify-center group hover:border-red-300"
            title="关闭"
          >
            <svg className="w-4 h-4 text-slate-600 group-hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* 主要内容区域 */}
      <div className={`app-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Sidebar 
          currentPage={currentPage} 
          onNavigate={handlePageChange}
          onCollapseChange={setSidebarCollapsed}
        />
        
        <main className="app-content">
          
          {/* 探索页面 */}
          {currentPage === 'explore' && (
            <div key={`explore-${pageAnimationKey}`} className="page-transition p-6 h-full">
              <div className="glass-card h-full dark:bg-glass-dark-bg-strong dark:border-glass-dark-border">
                <ExplorePage />
              </div>
            </div>
          )}
          
          {/* 音乐库页面 */}
          {currentPage === 'library' && (
            <div key={`library-${pageAnimationKey}`} className="page-transition p-6">
              <LibraryPage 
                onTrackSelect={handleTrackSelect} 
                searchQuery={searchQuery}
                tracks={tracks}
                stats={libraryStats}
                isLoading={isLibraryLoading}
                isCached={libraryDataCached}
                onSearch={handleLibrarySearch}
                selectedTrackId={selectedTrack?.id}
                onRefresh={() => {
                  console.log('手动刷新音乐库数据');
                  setLibraryDataCached(false);
                  setIsLibraryLoading(true);
                  loadLibraryTracks();
                  loadLibraryStats();
                }}
              />
            </div>
          )}
          
          {/* 播放列表页面 */}
          {currentPage === 'playlist' && (
            <div key={`playlist-${pageAnimationKey}`} className="page-transition p-6">
              <PlaylistManager 
                onTrackSelect={handleTrackSelect}
              />
            </div>
          )}
          
          {/* 我的收藏页面 */}
          {currentPage === 'favorite' && (
            <div key={`favorite-${pageAnimationKey}`} className="page-transition p-6">
              <FavoritesView 
                onTrackSelect={handleTrackSelect}
                selectedTrackId={selectedTrack?.id}
              />
            </div>
          )}
          
          {/* 音乐分类页面 */}
          {currentPage === 'genres' && (
            <div key={`genres-${pageAnimationKey}`} className="page-transition p-6 h-full">
              <div className="glass-card h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-slate-400 mb-6">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-4">音乐分类</h2>
                  <p className="text-slate-600 text-lg mb-6">按风格和类型浏览音乐</p>
                  <div className="glass-badge brand">即将推出</div>
                </div>
              </div>
            </div>
          )}
          
          
          {/* 应用设置页面 */}
          {currentPage === 'settings' && (
            <div key={`settings-${pageAnimationKey}`} className="page-transition">
              <SettingsPage
              theme={theme}
              onThemeChange={changeTheme}
              isHighContrast={isHighContrast}
              onToggleHighContrast={toggleHighContrast}
              lyricsAnimationSettings={lyricsAnimationSettings}
              onUpdateLyricsAnimationSettings={updateLyricsAnimationSettings}
            />
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
                            
      {/* 音频设备错误对话框 */}
      {showAudioDeviceError && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-surface rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">🎵 音频设备问题</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                音频设备似乎被其他应用占用或不可用
              </p>
                            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-red-800 text-sm font-medium mb-2">错误详情：</p>
              <p className="text-red-700 text-sm">{audioErrorMessage}</p>
                            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <p className="text-blue-800 text-sm font-medium mb-3">💡 解决建议：</p>
              <ul className="text-blue-700 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  关闭其他正在使用音频的应用程序
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  检查Windows声音设置中的默认播放设备
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  重新连接耳机或扬声器
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  检查音频驱动是否需要更新
                </li>
              </ul>
                      </div>
                      
            <div className="flex gap-3">
                        <button
                onClick={handleDiagnoseAudioSystem}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg"
              >
                🔍 系统诊断
                        </button>
                              <button
                onClick={handleResetAudioDevice}
                disabled={isResettingAudio}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg disabled:cursor-not-allowed"
              >
                {isResettingAudio ? '⏳ 重置中...' : '🔧 重置设备'}
                              </button>
                                    <button
                                      onClick={() => {
                  setShowAudioDeviceError(false);
                  setAudioErrorMessage('');
                }}
                className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                关闭
                                    </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ToastProvider>
    </PlaybackProvider>
  );
}
