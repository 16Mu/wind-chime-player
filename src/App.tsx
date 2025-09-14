import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import Sidebar from './components/Sidebar';
import LibraryPage from './components/LibraryPage';
import PlaylistPlayer from './components/PlaylistPlayer';
import ExplorePage from './components/ExplorePage';
import MusicFolderManager from './components/MusicFolderManager';
import PlaylistManager from './components/PlaylistManager';
import FavoritesView from './components/FavoritesView';

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

  // 背景模糊效果设置
  const [blurBackdropSettings, setBlurBackdropSettings] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('windchime-blur-backdrop-settings');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (error) {
          console.warn('Failed to parse blur backdrop settings:', error);
        }
      }
    }
    return {
      enabled: true,
      intensity: 'medium',
      opacity: 0.8
    };
  });

  const [blurBackdropDetailsExpanded, setBlurBackdropDetailsExpanded] = useState(false);

  // 悬停动画设置
  const [hoverAnimationSettings, setHoverAnimationSettings] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('windchime-hover-animation-settings');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (error) {
          console.warn('Failed to parse hover animation settings:', error);
        }
      }
    }
    return {
      enabled: true,
      range: 2,
      displacement: 8
    };
  });

  const [hoverAnimationDetailsExpanded, setHoverAnimationDetailsExpanded] = useState(false);
  
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

  const [lyricsAnimationDetailsExpanded, setLyricsAnimationDetailsExpanded] = useState(false);
  
  // 兼容PlaylistManager的设置格式
  const membraneSettings = {
    enabled: blurBackdropSettings.enabled,
    intensity: blurBackdropSettings.intensity === 'high' ? 1.5 : blurBackdropSettings.intensity === 'low' ? 0.5 : 1,
    radius: 1
  };
  
  // 音乐库数据状态
  const [tracks, setTracks] = useState<Track[]>([]);
  const [libraryStats, setLibraryStats] = useState<LibraryStats | null>(null);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const [hasLibraryInitialized, setHasLibraryInitialized] = useState(false);
  const [libraryDataCached, setLibraryDataCached] = useState(false);

  // 监听播放器曲目变化事件
  useEffect(() => {
    const unlistenTrackChanged = listen('player-track-changed', (event: any) => {
      console.log('App收到曲目变化事件:', event.payload);
      if (event.payload) {
        setSelectedTrack(event.payload);
        console.log('已同步更新selectedTrack:', event.payload.title);
      }
    });

    return () => {
      unlistenTrackChanged.then(fn => fn());
    };
  }, []);

  // 播放曲目处理
  const handleTrackSelect = async (track: Track) => {
    console.log('全局播放曲目:', track);
    
    if (typeof invoke !== 'undefined') {
      try {
        console.log('加载播放列表，共', tracks.length, '首歌曲');
        await invoke('player_load_playlist', { tracks });
        console.log('播放列表加载完成，开始播放曲目:', track.title);
        
        await invoke('player_play', { trackId: track.id });
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

  // 更新模糊效果设置
  const updateBlurBackdropSettings = useCallback((newSettings: Partial<typeof blurBackdropSettings>) => {
    const updated = { ...blurBackdropSettings, ...newSettings };
    setBlurBackdropSettings(updated);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('windchime-blur-backdrop-settings', JSON.stringify(updated));
    }
  }, [blurBackdropSettings]);

  // 更新悬停动画设置
  const updateHoverAnimationSettings = useCallback((newSettings: Partial<typeof hoverAnimationSettings>) => {
    const updated = { ...hoverAnimationSettings, ...newSettings };
    setHoverAnimationSettings(updated);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('windchime-hover-animation-settings', JSON.stringify(updated));
    }
  }, [hoverAnimationSettings]);

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
      await invoke('library_get_tracks');
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

  // 应用初始化
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

      // 加载真实数据
      console.log('首次加载音乐库数据...');
      setIsLibraryLoading(true);
      try {
        await loadLibraryTracks();
        await loadLibraryStats();
      } catch (error) {
        console.error('初始化音乐库失败:', error);
        setIsLibraryLoading(false);
      }
    };

    initializeLibraryData();
  }, []);

  // 设置音乐库事件监听
  useEffect(() => {
    if (typeof listen === 'undefined') return;

    const setupLibraryListeners = async () => {
      const unlistenTracksLoaded = await listen('library-tracks-loaded', (event: any) => {
        if (Array.isArray(event.payload)) {
          setTracks(event.payload);
          setIsLibraryLoading(false);
          setHasLibraryInitialized(true);
          setLibraryDataCached(true);
        }
      });

      const unlistenSearchResults = await listen('library-search-results', (event: any) => {
        if (Array.isArray(event.payload)) {
          setTracks(event.payload);
          setIsLibraryLoading(false);
        }
      });

      const unlistenStats = await listen('library-stats', (event: any) => {
        console.log('收到统计数据事件:', event.payload);
        console.log('事件类型:', typeof event.payload);
        console.log('事件结构:', JSON.stringify(event.payload, null, 2));
        console.log('当前状态中的libraryStats:', libraryStats);
        
        if (event.payload && typeof event.payload === 'object') {
          if ('total_tracks' in event.payload && 'total_artists' in event.payload && 'total_albums' in event.payload) {
            console.log('统计数据有效，更新状态:', event.payload);
            console.log('更新前的状态:', libraryStats);
            setLibraryStats(event.payload);
            console.log('setLibraryStats调用完成');
          } else {
            console.warn('统计数据格式无效:', event.payload);
          }
        } else {
          console.warn('统计数据事件载荷无效');
        }
      });

      // 监听播放器错误
      const unlistenPlayerError = await listen('player-error', (event: any) => {
        console.error('播放器错误:', event.payload);
        if (event.payload && typeof event.payload === 'object') {
          alert('播放失败: ' + (event.payload.PlaybackError || '未知错误'));
        }
      });

      return () => {
        unlistenTracksLoaded();
        unlistenSearchResults();
        unlistenStats();
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
            <p className="text-xs text-slate-500 dark:text-dark-700 leading-tight">玻璃化音乐播放器</p>
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
          onNavigate={setCurrentPage}
          onCollapseChange={setSidebarCollapsed}
        />
        
        <main className="app-content">
          
          {/* 探索页面 */}
          {currentPage === 'explore' && (
            <div className="p-6 h-full">
              <div className="glass-card h-full dark:bg-glass-dark-bg-strong dark:border-glass-dark-border">
                <ExplorePage />
              </div>
            </div>
          )}
          
          {/* 音乐库页面 */}
          {currentPage === 'library' && (
            <div className="p-6">
              <LibraryPage 
                onTrackSelect={handleTrackSelect} 
                searchQuery={searchQuery}
                tracks={tracks}
                stats={libraryStats}
                isLoading={isLibraryLoading}
                isCached={libraryDataCached}
                onSearch={handleLibrarySearch}
                membraneSettings={membraneSettings}
                selectedTrackId={selectedTrack?.id}
                hoverAnimationSettings={hoverAnimationSettings}
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
            <div className="p-6">
              <PlaylistManager 
                onTrackSelect={handleTrackSelect} 
                membraneSettings={membraneSettings}
              />
            </div>
          )}
          
          {/* 我的收藏页面 */}
          {currentPage === 'favorite' && (
            <div className="p-6">
              <FavoritesView 
                onTrackSelect={handleTrackSelect} 
                membraneSettings={membraneSettings}
                selectedTrackId={selectedTrack?.id}
              />
            </div>
          )}
          
          {/* 音乐分类页面 */}
          {currentPage === 'genres' && (
            <div className="p-6 h-full">
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
            <div className="p-6">
              <div className="glass-card">
                <div className="max-w-2xl mx-auto">
                  <div className="text-center mb-8">
                    <div className="text-slate-400 mb-6">
                      <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-dark-900 mb-4">应用设置</h2>
                    <p className="text-slate-600 dark:text-dark-700 text-lg mb-6">个性化您的音乐播放体验</p>
                  </div>

                  {/* 界面主题设置 */}
                  <div className="glass-surface p-6 mb-6">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-dark-900 mb-4 flex items-center gap-3">
                      <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h14a2 2 0 012 2v12a4 4 0 01-4 4M7 21h10a4 4 0 004-4V5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a4 4 0 004 4z" />
                      </svg>
                      界面主题
                    </h3>
                    <div className="space-y-4">
                      {/* 主题选择 */}
                      <div className="p-4 glass-surface rounded-lg">
                        <div className="font-semibold text-slate-900 dark:text-dark-900 mb-3">主题模式</div>
                        <div className="space-y-3">
                          {/* 主题选项 */}
                          <div className="flex gap-3">
                            {(['system', 'light', 'dark'] as const).map((themeOption) => (
                              <button
                                key={themeOption}
                                onClick={() => changeTheme(themeOption)}
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
                  <div className="glass-surface p-6 mb-6">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-dark-900 mb-4 flex items-center gap-3">
                      <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      可访问性
                    </h3>
                    <div className="space-y-4">
                      {/* 高对比度开关 */}
                      <div className="flex items-center justify-between p-4 glass-surface rounded-lg">
                        <div>
                          <div className="font-semibold text-slate-900 mb-1">高对比度模式</div>
                          <div className="text-sm text-slate-600">
                            提升文字和界面元素的对比度，改善可读性
                            {typeof window !== 'undefined' && window.matchMedia('(prefers-contrast: more)').matches && (
                              <span className="ml-2 text-xs glass-badge">系统偏好</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={toggleHighContrast}
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

                  {/* 音乐库管理 */}
                  <MusicFolderManager className="mb-6" />

                  {/* 调试工具 */}
                  <div className="glass-surface p-6 mb-6">
                    <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-3">
                      <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      调试工具
                    </h3>
                    <div className="space-y-4">
                      <button
                        onClick={async () => {
                          if (typeof invoke !== 'undefined') {
                            try {
                              const result = await invoke('test_library_stats');
                              console.log('🔍 库统计测试结果:', result);
                              alert('测试完成，请查看控制台输出');
                            } catch (error) {
                              console.error('测试失败:', error);
                              alert('测试失败: ' + error);
                            }
                          } else {
                            alert('Tauri API 不可用');
                          }
                        }}
                        className="glass-button primary"
                      >
                        测试库统计数据
                      </button>
                      <p className="text-sm text-slate-600">
                        点击此按钮可以直接从数据库查询统计数据，结果会显示在控制台中。
                      </p>
                    </div>
                  </div>

                  {/* 交互动画设置 */}
                  <div className="glass-surface p-6 mb-6">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-dark-900 mb-4 flex items-center gap-3">
                      <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      系统动画设置
                    </h3>
                    <div className="space-y-4">
                      {/* 模糊背景条 */}
                      <div className="glass-surface rounded-lg overflow-hidden">
                        <button
                          onClick={() => setBlurBackdropDetailsExpanded(!blurBackdropDetailsExpanded)}
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
                            <div className="font-semibold text-slate-900 dark:text-dark-900 mb-1 truncate">模糊背景条</div>
                            <div className="text-sm text-slate-600 dark:text-dark-700 line-clamp-2">
                              鼠标悬停时显示Q弹跟随的模糊背景条，营造现代玻璃质感
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {/* 状态指示 */}
                            <div 
                              className={`
                                px-2 py-1 rounded-full text-xs font-medium
                                ${blurBackdropSettings.enabled 
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                                  : 'bg-slate-100 dark:bg-dark-200 text-slate-600 dark:text-dark-600'
                                }
                              `}
                              style={{
                                transitionProperty: 'background-color, color, transform',
                                transitionDuration: '0.3s',
                                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                                transform: blurBackdropSettings.enabled ? 'scale(1)' : 'scale(0.95)'
                              }}
                            >
                              {blurBackdropSettings.enabled ? '已启用' : '已禁用'}
                            </div>
                            
                            {/* 展开/收起图标 */}
                            <svg
                              className={`w-5 h-5 text-slate-400 transition-all ${
                                blurBackdropDetailsExpanded 
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
                          className={`border-t border-white/30 dark:border-glass-dark-border bg-slate-50/30 dark:bg-glass-dark-bg overflow-hidden`}
                          style={{
                            transitionTimingFunction: blurBackdropDetailsExpanded 
                              ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' // Q弹展开
                              : 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', // 平滑收缩
                            transitionProperty: 'max-height, opacity',
                            transitionDuration: blurBackdropDetailsExpanded ? '0.8s' : '0.3s',
                            maxHeight: blurBackdropDetailsExpanded ? '500px' : '0px',
                            opacity: blurBackdropDetailsExpanded ? 1 : 0,
                            willChange: 'max-height, opacity'
                          }}
                        >
                          <div 
                            className={`p-4 space-y-4`}
                            style={{
                              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                              transitionProperty: 'transform, opacity',
                              transitionDuration: blurBackdropDetailsExpanded ? '0.6s' : '0.15s',
                              transitionDelay: blurBackdropDetailsExpanded ? '0.2s' : '0s',
                              transform: blurBackdropDetailsExpanded ? 'translateY(0)' : 'translateY(-8px)',
                              opacity: blurBackdropDetailsExpanded ? 1 : 0,
                              willChange: 'transform, opacity'
                            }}
                          >
                            {/* 启用/禁用开关 */}
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-900 dark:text-dark-900">启用模糊背景条</span>
                              <button
                                onClick={() => updateBlurBackdropSettings({ enabled: !blurBackdropSettings.enabled })}
                                className={`
                                  relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                                  ${blurBackdropSettings.enabled 
                                    ? 'bg-brand-600 shadow-inner' 
                                    : 'bg-slate-300 shadow-inner'
                                  }
                                `}
                              >
                                <div
                                  className={`
                                    absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 flex items-center justify-center
                                    ${blurBackdropSettings.enabled ? 'transform translate-x-6' : ''}
                                  `}
                                >
                                  {blurBackdropSettings.enabled ? (
                                    <svg className="w-3 h-3 text-brand-600" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  ) : (
                                    <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                                  )}
                                </div>
                              </button>
                            </div>

                            {/* 模糊强度选择 */}
                            <div className={`transition-all duration-500 ${
                              blurBackdropSettings.enabled 
                                ? 'opacity-100 transform translate-y-0' 
                                : 'opacity-50 transform translate-y-2 pointer-events-none'
                            }`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-slate-600 dark:text-dark-600">模糊强度</span>
                                <span className="text-sm text-slate-600 dark:text-dark-600 capitalize">{blurBackdropSettings.intensity}</span>
                              </div>
                              <div className="flex gap-2">
                                {['low', 'medium', 'high'].map((intensity) => (
                                  <button
                                    key={intensity}
                                    onClick={() => updateBlurBackdropSettings({ intensity: intensity as 'low' | 'medium' | 'high' })}
                                    className={`
                                      flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all duration-200
                                      ${blurBackdropSettings.intensity === intensity
                                        ? 'bg-brand-500 text-white shadow-md scale-105'
                                        : 'bg-slate-100 dark:bg-dark-200 text-slate-600 dark:text-dark-600 hover:bg-slate-200 dark:hover:bg-dark-300'
                                      }
                                    `}
                                    disabled={!blurBackdropSettings.enabled}
                                  >
                                    {intensity === 'low' ? '轻微' : intensity === 'medium' ? '适中' : '强烈'}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 透明度调节 */}
                            <div className={`transition-all duration-500 ${
                              blurBackdropSettings.enabled 
                                ? 'opacity-100 transform translate-y-0' 
                                : 'opacity-50 transform translate-y-2 pointer-events-none'
                            }`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-slate-600 dark:text-dark-600">透明度</span>
                                <span className="text-sm text-slate-600 dark:text-dark-600">{Math.round(blurBackdropSettings.opacity * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min="0.2"
                                max="1"
                                step="0.1"
                                value={blurBackdropSettings.opacity}
                                onChange={(e) => updateBlurBackdropSettings({ opacity: parseFloat(e.target.value) })}
                                className="w-full accent-brand-500"
                                disabled={!blurBackdropSettings.enabled}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* 悬停动画设置 */}
                      <div className="glass-surface rounded-lg overflow-hidden">
                        <button
                          onClick={() => setHoverAnimationDetailsExpanded(!hoverAnimationDetailsExpanded)}
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
                            <div className="font-semibold text-slate-900 dark:text-dark-900 mb-1 truncate">悬停动画效果</div>
                            <div className="text-sm text-slate-600 dark:text-dark-700 line-clamp-2">
                              鼠标悬停歌曲时的位移动画和连锁反应范围
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {/* 状态指示 */}
                            <div 
                              className={`
                                px-2 py-1 rounded-full text-xs font-medium
                                ${hoverAnimationSettings.enabled 
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                                  : 'bg-slate-100 dark:bg-dark-200 text-slate-600 dark:text-dark-600'
                                }
                              `}
                              style={{
                                transitionProperty: 'background-color, color, transform',
                                transitionDuration: '0.3s',
                                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                                transform: hoverAnimationSettings.enabled ? 'scale(1)' : 'scale(0.95)'
                              }}
                            >
                              {hoverAnimationSettings.enabled ? '已启用' : '已禁用'}
                            </div>
                            
                            {/* 展开/收起图标 */}
                            <svg
                              className={`w-5 h-5 text-slate-400 transition-all ${
                                hoverAnimationDetailsExpanded 
                                  ? 'transform rotate-180 text-brand-500' 
                                  : 'transform rotate-0'
                              }`}
                              style={{
                                transitionProperty: 'transform, color',
                                transitionDuration: '0.3s',
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

                        {/* 悬停动画详细设置 */}
                        <div 
                          className={`overflow-hidden transition-all duration-300 ease-out ${
                            hoverAnimationDetailsExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                          }`}
                        >
                          <div className="p-4 bg-slate-50/30 dark:bg-dark-100/30 border-t border-slate-200/50 dark:border-dark-300/50 space-y-4">
                            {/* 启用/禁用开关 */}
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-900 dark:text-dark-900">启用悬停动画</span>
                              <button
                                onClick={() => updateHoverAnimationSettings({ enabled: !hoverAnimationSettings.enabled })}
                                className={`
                                  relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                                  ${hoverAnimationSettings.enabled 
                                    ? 'bg-brand-600 shadow-inner' 
                                    : 'bg-slate-300 shadow-inner'
                                  }
                                `}
                              >
                                <div
                                  className={`
                                    absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-lg transform transition-all duration-300
                                    ${hoverAnimationSettings.enabled ? 'translate-x-6' : 'translate-x-0.5'}
                                  `}
                                />
                              </button>
                            </div>

                            {/* 影响范围设置 */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-slate-900 dark:text-dark-900">影响范围</span>
                                <span className="text-sm text-slate-600 dark:text-dark-600">{hoverAnimationSettings.range} 行</span>
                              </div>
                              <div className="flex gap-2">
                                {[0, 1, 2, 3, 4, 5].map((range) => (
                                  <button
                                    key={range}
                                    onClick={() => updateHoverAnimationSettings({ range })}
                                    className={`
                                      flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200
                                      ${hoverAnimationSettings.range === range
                                        ? 'bg-brand-600 text-white shadow-md'
                                        : 'bg-slate-200 dark:bg-dark-200 text-slate-700 dark:text-dark-700 hover:bg-slate-300 dark:hover:bg-dark-300'
                                      }
                                    `}
                                  >
                                    {range === 0 ? '无' : range}
                                  </button>
                                ))}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-dark-600">
                                设置悬停时相邻歌曲的响应行数
                              </div>
                            </div>

                            {/* 位移大小设置 */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-slate-900 dark:text-dark-900">位移大小</span>
                                <span className="text-sm text-slate-600 dark:text-dark-600 font-mono bg-slate-100 dark:bg-dark-200 px-2 py-1 rounded">{hoverAnimationSettings.displacement}px</span>
                              </div>
                              <div className="relative">
                                {/* 滑块轨道 */}
                                <div className="w-full h-2 bg-slate-200 dark:bg-dark-300 rounded-full relative">
                                  {/* 滑块进度条 */}
                                  <div 
                                    className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all duration-200"
                                    style={{ width: `${(hoverAnimationSettings.displacement / 20) * 100}%` }}
                                  />
                                  {/* 滑块把手 */}
                                  <div 
                                    className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-brand-500 rounded-full shadow-lg cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95"
                                    style={{ left: `calc(${(hoverAnimationSettings.displacement / 20) * 100}% - 10px)` }}
                                  />
                                </div>
                                {/* 隐藏的滑块输入 */}
                                <input
                                  type="range"
                                  min="0"
                                  max="20"
                                  step="1"
                                  value={hoverAnimationSettings.displacement}
                                  onChange={(e) => updateHoverAnimationSettings({ displacement: parseInt(e.target.value) })}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                              </div>
                              {/* 刻度标记 */}
                              <div className="flex justify-between text-xs text-slate-400 dark:text-dark-500 px-0.5">
                                <span>0px</span>
                                <span>5px</span>
                                <span>10px</span>
                                <span>15px</span>
                                <span>20px</span>
                              </div>
                              <div className="text-xs text-slate-500 dark:text-dark-600">
                                设置主悬停行向右移动的像素距离（0px = 禁用位移）
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 🎨 歌词滚动动画设置 */}
                      <div className="glass-surface rounded-lg overflow-hidden">
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
                          className="border-t border-white/30 dark:border-glass-dark-border bg-slate-50/30 dark:bg-glass-dark-bg overflow-hidden"
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
                                       lyricsAnimationSettings.style?.startsWith('SMOOTH_') ? '平滑' : '特殊'}
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
                                          updateLyricsAnimationSettings({ style: 'BOUNCY_SOFT' });
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
                                          updateLyricsAnimationSettings({ style: 'SMOOTH_ELEGANT' });
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
                                          updateLyricsAnimationSettings({ style: 'ORGANIC_FLOW' });
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

                                {/* 第二层：具体风格选择 - 水平滑动切换 */}
                                <div className="relative overflow-hidden rounded-lg bg-slate-50/50 dark:bg-dark-300/50 min-h-[140px]">
                                  <div 
                                    className="flex transition-transform duration-500 ease-out h-full"
                                    style={{
                                      transform: lyricsAnimationSettings.style?.startsWith('BOUNCY_') 
                                        ? 'translateX(0%)' 
                                        : lyricsAnimationSettings.style?.startsWith('SMOOTH_') 
                                        ? 'translateX(-33.333%)' 
                                        : 'translateX(-66.666%)',
                                      transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // 所有切换都使用Q弹效果
                                      width: '300%' // 三个面板的总宽度
                                    }}
                                  >
                                    {/* Q弹风格选择面板 */}
                                    <div className="w-1/3 p-4 space-y-3 flex-shrink-0">
                                      <div className="text-sm font-medium text-brand-700 dark:text-brand-300 flex items-center gap-2">
                                        <span className="text-base animate-bounce">🏀</span>
                                        Q弹风格
                                      </div>
                                      <div className="grid grid-cols-3 gap-2">
                                        {[
                                          { key: 'BOUNCY_SOFT', name: '轻柔', desc: '温和回弹' },
                                          { key: 'BOUNCY_STRONG', name: '强烈', desc: '明显回弹' },
                                          { key: 'BOUNCY_PLAYFUL', name: '俏皮', desc: '活泼回弹' }
                                        ].map(({ key, name, desc }, index) => (
                                          <button
                                            key={key}
                                            onClick={() => updateLyricsAnimationSettings({ style: key })}
                                            className={`
                                              py-2.5 px-2 rounded-lg text-sm font-medium transition-all duration-300 group
                                              ${lyricsAnimationSettings.style === key
                                                ? 'bg-brand-600 text-white shadow-md scale-105'
                                                : 'bg-slate-200 dark:bg-dark-200 text-slate-700 dark:text-dark-700 hover:bg-slate-300 dark:hover:bg-dark-300'
                                              }
                                            `}
                                            title={desc}
                                            style={{
                                              transitionDelay: lyricsAnimationSettings.style?.startsWith('BOUNCY_') ? `${index * 50}ms` : '0ms',
                                              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                                            }}
                                          >
                                            <div className="flex flex-col items-center gap-0.5">
                                              <span className="text-xs">{name}</span>
                                              <span className="text-xs opacity-70 group-hover:opacity-100 transition-opacity">
                                                {desc}
                                              </span>
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    {/* 平滑风格选择面板 */}
                                    <div className="w-1/3 p-4 space-y-3 flex-shrink-0">
                                      <div className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                        <span className="text-base animate-pulse">🌊</span>
                                        平滑风格
                                      </div>
                                      <div className="grid grid-cols-3 gap-2">
                                        {[
                                          { key: 'SMOOTH_ELEGANT', name: '优雅', desc: '温文尔雅' },
                                          { key: 'SMOOTH_SWIFT', name: '敏捷', desc: '快速直接' },
                                          { key: 'SMOOTH_DREAMY', name: '梦幻', desc: '柔和飘逸' }
                                        ].map(({ key, name, desc }, index) => (
                                          <button
                                            key={key}
                                            onClick={() => updateLyricsAnimationSettings({ style: key })}
                                            className={`
                                              py-2.5 px-2 rounded-lg text-sm font-medium transition-all duration-300 group
                                              ${lyricsAnimationSettings.style === key
                                                ? 'bg-brand-600 text-white shadow-md scale-105'
                                                : 'bg-slate-200 dark:bg-dark-200 text-slate-700 dark:text-dark-700 hover:bg-slate-300 dark:hover:bg-dark-300'
                                              }
                                            `}
                                            title={desc}
                                            style={{
                                              transitionDelay: lyricsAnimationSettings.style?.startsWith('SMOOTH_') ? `${index * 30}ms` : '0ms',
                                              transitionTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                                            }}
                                          >
                                            <div className="flex flex-col items-center gap-0.5">
                                              <span className="text-xs">{name}</span>
                                              <span className="text-xs opacity-70 group-hover:opacity-100 transition-opacity">
                                                {desc}
                                              </span>
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    {/* 特殊效果选择面板 */}
                                    <div className="w-1/3 p-4 space-y-3 flex-shrink-0">
                                      <div className="text-sm font-medium text-purple-700 dark:text-purple-300 flex items-center gap-2">
                                        <span className="text-base animate-spin" style={{ animationDuration: '2s' }}>✨</span>
                                        特殊效果
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        {[
                                          { key: 'ORGANIC_FLOW', name: '自然流动', desc: '仿生曲线' },
                                          { key: 'PRECISE_SNAP', name: '精准快速', desc: '瞬间切换' }
                                        ].map(({ key, name, desc }, index) => (
                                          <button
                                            key={key}
                                            onClick={() => updateLyricsAnimationSettings({ style: key })}
                                            className={`
                                              py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-300 group
                                              ${lyricsAnimationSettings.style === key
                                                ? 'bg-brand-600 text-white shadow-md scale-105'
                                                : 'bg-slate-200 dark:bg-dark-200 text-slate-700 dark:text-dark-700 hover:bg-slate-300 dark:hover:bg-dark-300'
                                              }
                                            `}
                                            title={desc}
                                            style={{
                                              transitionDelay: ['ORGANIC_FLOW', 'PRECISE_SNAP'].includes(lyricsAnimationSettings.style) ? `${index * 100}ms` : '0ms',
                                              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' // 使用Q弹效果
                                            }}
                                          >
                                            <div className="flex flex-col items-center gap-0.5">
                                              <span className="text-xs">{name}</span>
                                              <span className="text-xs opacity-70 group-hover:opacity-100 transition-opacity">
                                                {desc}
                                              </span>
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  {/* 页面指示器 */}
                                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                                    <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                                      lyricsAnimationSettings.style?.startsWith('BOUNCY_') 
                                        ? 'bg-brand-600 w-4' 
                                        : 'bg-slate-300 dark:bg-dark-500'
                                    }`} />
                                    <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                                      lyricsAnimationSettings.style?.startsWith('SMOOTH_') 
                                        ? 'bg-blue-600 w-4' 
                                        : 'bg-slate-300 dark:bg-dark-500'
                                    }`} />
                                    <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                                      ['ORGANIC_FLOW', 'PRECISE_SNAP'].includes(lyricsAnimationSettings.style) 
                                        ? 'bg-purple-600 w-4' 
                                        : 'bg-slate-300 dark:bg-dark-500'
                                    }`} />
                                  </div>
                                </div>

                                {/* 说明提示 */}
                                <div className="text-xs text-slate-500 dark:text-dark-600 mt-3 p-3 bg-slate-100/50 dark:bg-dark-300/50 rounded-lg">
                                  <div className="space-y-1">
                                    <div><strong className="text-brand-600">🏀 Q弹</strong>：滚动结束时有轻微回弹效果，增加趣味性和活力感</div>
                                    <div><strong className="text-blue-600">🌊 平滑</strong>：纯流畅滚动无回弹，呈现优雅专业的视觉体验</div>
                                    <div><strong className="text-purple-600">✨ 特殊</strong>：独特的动画风格，为不同场景提供个性化选择</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* 音频设置 */}
                  <div className="glass-surface p-6 mb-6">
                    <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-3">
                      <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 12a3 3 0 106 0 3 3 0 00-6 0z" />
                      </svg>
                      音频设置
                    </h3>
                    <div className="text-center py-8">
                      <div className="glass-badge brand">即将推出</div>
                      <p className="text-slate-600 text-sm mt-2">音质设置、均衡器等功能正在开发中</p>
                    </div>
                  </div>


                  {/* 关于软件 */}
                  <div className="glass-surface p-6 mb-6">
                    <h3 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-3">
                      <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      关于软件
                    </h3>
                    
                    <div className="space-y-6">
                      {/* 软件信息卡片 */}
                      <div className="glass-surface rounded-xl p-6 bg-gradient-to-br from-brand-50/50 to-sky-50/50 border border-brand-200/30">
                        <div className="flex items-start gap-4">
                          {/* 软件图标 */}
                          <div className="w-16 h-16 bg-gradient-to-br from-brand-600 to-sky-400 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                            <span className="text-white text-2xl font-bold">W</span>
                          </div>
                          
                          {/* 软件详情 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-2xl font-bold text-slate-900">WindChime Player</h4>
                              <div className="glass-badge brand text-sm">v1.0.0</div>
                            </div>
                            <p className="text-slate-600 mb-3 leading-relaxed">
                              一款现代化的玻璃化音乐播放器，采用 Tauri + React 技术栈构建。
                              注重用户体验和视觉美学，提供流畅的音乐播放和管理功能。
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <div className="glass-badge secondary">🎵 音乐播放</div>
                              <div className="glass-badge secondary">🔍 智能搜索</div>
                              <div className="glass-badge secondary">🎨 玻璃化设计</div>
                              <div className="glass-badge secondary">⚡ 高性能</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 开发者铭牌 */}
                      <div className="glass-surface rounded-xl p-6 bg-gradient-to-br from-slate-50/50 to-blue-50/50 border border-slate-200/30">
                        <div className="flex items-center gap-4">
                          {/* 开发者头像 */}
                          <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                            <span className="text-white text-xl font-bold">W</span>
                          </div>
                          
                          {/* 开发者信息 */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="text-lg font-semibold text-slate-900">Wind</h5>
                              <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <p className="text-slate-600 text-sm mb-2">独立开发者 · 音乐爱好者</p>
                            <p className="text-slate-600 text-sm">
                              专注于创造优雅且实用的用户体验，致力于将技术与艺术完美融合。
                            </p>
                          </div>
                        </div>
                        
                        {/* 技术栈标签 */}
                        <div className="mt-4 pt-4 border-t border-slate-200/50">
                          <div className="flex flex-wrap gap-2">
                            <div className="glass-badge tertiary">🦀 Rust</div>
                            <div className="glass-badge tertiary">⚛️ React</div>
                            <div className="glass-badge tertiary">🌊 TypeScript</div>
                            <div className="glass-badge tertiary">🎨 Tailwind CSS</div>
                            <div className="glass-badge tertiary">⚡ Tauri</div>
                          </div>
                        </div>
                      </div>

                      {/* 项目信息 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="glass-surface rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-medium text-slate-900">开源许可</span>
                          </div>
                          <p className="text-slate-600 text-sm">MIT License</p>
                        </div>
                        
                        <div className="glass-surface rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-medium text-slate-900">最后更新</span>
                          </div>
                          <p className="text-slate-600 text-sm">2025年9月13日</p>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
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
    </div>
  );
}
