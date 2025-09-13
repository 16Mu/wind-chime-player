import { useState, useRef, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import Sidebar from './components/Sidebar';
import LibraryPage from './components/LibraryPage';
import PlaylistPlayer from './components/PlaylistPlayer';
import ExplorePage from './components/ExplorePage';
import MusicFolderManager from './components/MusicFolderManager';
import PlaylistManager from './components/PlaylistManager';

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
  const [playerVisible, setPlayerVisible] = useState(false);
  const [animatingPlayer, setAnimatingPlayer] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 🎯 高对比度模式状态管理
  const [isHighContrast, setIsHighContrast] = useState(() => {
    // 检查系统偏好和本地存储
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('windchime-high-contrast');
      if (stored !== null) {
        return stored === 'true';
      }
      // 检查系统偏好
      return window.matchMedia('(prefers-contrast: more)').matches;
    }
    return false;
  });

  // 🎭 软膜联动动画设置
  const [membraneSettings, setMembraneSettings] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('windchime-membrane-settings');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (error) {
          console.warn('Failed to parse membrane settings:', error);
        }
      }
    }
    return {
      enabled: true,
      intensity: 1,
      radius: 1
    };
  });

  // 软膜联动效果详细设置的展开状态
  const [membraneDetailsExpanded, setMembraneDetailsExpanded] = useState(false);
  
  // 🎵 全局音乐库数据管理 - 缓存机制
  const [tracks, setTracks] = useState<Track[]>([]);
  const [libraryStats, setLibraryStats] = useState<LibraryStats | null>(null);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false); // 默认不加载
  const [hasLibraryInitialized, setHasLibraryInitialized] = useState(false);
  const [libraryDataCached, setLibraryDataCached] = useState(false); // 数据是否已缓存
  
  const playerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPageRef = useRef<Page | null>(null); // 初始为 null，这样第一次切换会被检测到

  // 显示播放器动画
  const showPlayer = useCallback(() => {
    console.log('🎵 showPlayer 被调用，当前状态:', { animatingPlayer, playerVisible });
    
    // 如果已经显示且没有在进行隐藏动画，直接返回
    if (playerVisible && !animatingPlayer) {
      console.log('🎵 播放器已显示且无动画，跳过');
      return;
    }
    
    // 清除任何正在进行的定时器
    if (playerTimeoutRef.current) {
      clearTimeout(playerTimeoutRef.current);
    }
    
    console.log('🎵 开始显示播放器动画');
    setAnimatingPlayer(true);
    setPlayerVisible(true);
    
    playerTimeoutRef.current = setTimeout(() => {
      console.log('🎵 播放器显示动画完成');
      setAnimatingPlayer(false);
    }, 700);
  }, [animatingPlayer, playerVisible]);

  // 隐藏播放器动画
  const hidePlayer = useCallback(() => {
    console.log('🎵 hidePlayer 被调用，当前状态:', { animatingPlayer, playerVisible });
    
    // 如果已经隐藏且没有在进行显示动画，直接返回
    if (!playerVisible && !animatingPlayer) {
      console.log('🎵 播放器已隐藏且无动画，跳过');
      return;
    }
    
    // 清除任何正在进行的定时器
    if (playerTimeoutRef.current) {
      clearTimeout(playerTimeoutRef.current);
    }
    
    console.log('🎵 开始隐藏播放器动画');
    setAnimatingPlayer(true);
    setPlayerVisible(false);
    
    playerTimeoutRef.current = setTimeout(() => {
      console.log('🎵 播放器隐藏动画完成');
      setAnimatingPlayer(false);
    }, 500);
  }, [animatingPlayer, playerVisible]);

  // 全局播放曲目处理函数
  const handleTrackSelect = async (track: Track) => {
    console.log('🎵 全局播放曲目:', track);
    
    // 先加载当前的歌曲列表到播放列表
    if (typeof invoke !== 'undefined') {
      try {
        console.log('🎵 加载播放列表，共', tracks.length, '首歌曲');
        await invoke('player_load_playlist', { tracks });
        console.log('🎵 播放列表加载完成，开始播放曲目:', track.title);
      } catch (error) {
        console.error('加载播放列表失败:', error);
      }
    }
    
    setSelectedTrack(track);
    console.log('🎵 设置选中曲目完成，当前播放器可见性:', playerVisible);
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

  // 编程方式拖拽处理
  const handleDragStart = async (e: React.MouseEvent) => {
    // 检查是否点击的是不可拖拽区域
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
    // 搜索逻辑现在在App中处理
    handleLibrarySearch(query);
  };

  // 🎯 高对比度模式切换函数
  const toggleHighContrast = useCallback(() => {
    const newValue = !isHighContrast;
    setIsHighContrast(newValue);
    
    // 保存到本地存储
    if (typeof window !== 'undefined') {
      localStorage.setItem('windchime-high-contrast', newValue.toString());
    }
  }, [isHighContrast]);

  // 🎭 软膜联动设置更新函数
  const updateMembraneSettings = useCallback((newSettings: Partial<typeof membraneSettings>) => {
    const updated = { ...membraneSettings, ...newSettings };
    setMembraneSettings(updated);
    
    // 保存到本地存储
    if (typeof window !== 'undefined') {
      localStorage.setItem('windchime-membrane-settings', JSON.stringify(updated));
    }
  }, [membraneSettings]);

  // 🎵 全局音乐库数据加载和搜索逻辑
  const loadLibraryTracks = useCallback(async () => {
    if (typeof invoke === 'undefined') {
      console.warn('🎵 Tauri API 不可用，跳过加载曲目');
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
      console.warn('🎵 Tauri API 不可用，跳过加载统计');
      return;
    }
    try {
      console.log('🎵 开始加载统计数据...');
      console.log('🎵 当前libraryStats状态:', libraryStats);
      await invoke('library_get_stats');
      console.log('🎵 统计数据请求已发送，等待后端响应...');
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  }, [libraryStats]);

  const handleLibrarySearch = useCallback(async (query: string) => {
    if (typeof invoke === 'undefined') return;
    
    if (query && query.trim()) {
      console.log('🔍 执行模糊搜索:', query);
      try {
        // 搜索时不显示加载状态，因为数据已缓存
        if (!libraryDataCached) {
          setIsLibraryLoading(true);
        }
        await invoke('library_search', { query: query.trim() });
      } catch (error) {
        console.error('搜索失败:', error);
        setIsLibraryLoading(false);
      }
    } else {
      // 搜索为空时：恢复所有数据
      if (libraryDataCached && hasLibraryInitialized) {
        console.log('🎵 恢复缓存的音乐库数据');
        await loadLibraryTracks(); // 不设置loading状态，因为数据已缓存
      } else if (hasLibraryInitialized) {
        console.log('🎵 重新加载音乐库数据');
        setIsLibraryLoading(true);
        loadLibraryTracks();
      }
    }
  }, [hasLibraryInitialized, libraryDataCached]); // 移除 loadLibraryTracks 依赖

  // 监听页面切换，控制播放器显示/隐藏
  useEffect(() => {
    // 只有在初始化完成后才响应页面切换
    if (!isInitialized) {
      return;
    }
    
    const previousPage = previousPageRef.current;
    console.log('🎵 监听到页面切换:', { 
      previousPage, 
      currentPage, 
      playerVisible, 
      selectedTrack: selectedTrack?.title,
      isInitialized 
    });
    
    // 只有当页面真正发生改变时才处理
    if (previousPage !== currentPage) {
      if (currentPage === 'settings') {
        // 进入设置页面，隐藏播放器
        console.log('🎵 进入设置页面，隐藏播放器');
        hidePlayer();
      } else {
        // 其他页面都显示播放器
        console.log('🎵 进入非设置页面，显示播放器');
        showPlayer();
      }
      
      // 更新上一个页面的引用
      previousPageRef.current = currentPage;
    }
  }, [currentPage, isInitialized]); // 移除 showPlayer 和 hidePlayer 依赖

  // 监听选中曲目变化，更新播放器内容（但不控制显示/隐藏）
  useEffect(() => {
    console.log('🎵 监听到曲目状态变化:', { selectedTrack: selectedTrack?.title });
    // 只更新曲目，不控制播放器的显示/隐藏
    if (selectedTrack) {
      console.log('🎵 曲目已选择:', selectedTrack.title);
    }
  }, [selectedTrack]); // 移除 currentPage 依赖

  // 🚀 应用启动时初始化（只执行一次）
  useEffect(() => {
    console.log('🎵 应用启动，初始页面:', currentPage);
    // 设置初始的 previousPage
    previousPageRef.current = currentPage;

    // 🎵 初始化音乐库数据（只在应用启动时执行一次）
    const initializeLibraryData = async () => {
      // 检测是否在Tauri环境中运行
      const isInTauriApp = typeof window !== 'undefined' && window.__TAURI__;
      
      if (!isInTauriApp || typeof invoke === 'undefined' || typeof listen === 'undefined') {
        console.warn('🎵 Tauri API 不可用，使用模拟数据');
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
        
        // 动态计算统计数据而不是硬编码
        const uniqueArtists = new Set(mockTracks.map(track => track.artist).filter(artist => artist && artist.trim() !== ''));
        const uniqueAlbums = new Set(mockTracks.map(track => track.album).filter(album => album && album.trim() !== ''));
        
        setLibraryStats({
          total_tracks: mockTracks.length,
          total_artists: uniqueArtists.size,
          total_albums: uniqueAlbums.size,
        });
        setIsLibraryLoading(false);
        setHasLibraryInitialized(true);
        setLibraryDataCached(true); // 标记数据已缓存
        return;
      }

      // 加载真实数据（只在首次启动时）
      console.log('🎵 首次加载音乐库数据...');
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
    
    // 如果启动时不是设置页面，显示播放器
    if (currentPage !== 'settings') {
      console.log('🎵 启动时在非设置页面，显示播放器');
      // 直接设置状态，避免依赖showPlayer导致重复执行
      setPlayerVisible(true);
      setAnimatingPlayer(true);
      
      playerTimeoutRef.current = setTimeout(() => {
        console.log('🎵 启动时播放器显示动画完成');
        setAnimatingPlayer(false);
        setIsInitialized(true); // 在动画完成后才标记为初始化完成
      }, 700);
    } else {
      // 如果在设置页面，直接标记为初始化完成
      console.log('🎵 启动时在设置页面，标记初始化完成');
      setIsInitialized(true);
    }
    
    // 应用初始化完成
    return () => {};  // 清理函数
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 🎵 设置音乐库事件监听器
  useEffect(() => {
    if (typeof listen === 'undefined') return;

    const setupLibraryListeners = async () => {
      const unlistenTracksLoaded = await listen('library-tracks-loaded', (event: any) => {
        if (Array.isArray(event.payload)) {
          setTracks(event.payload);
          setIsLibraryLoading(false);
          setHasLibraryInitialized(true);
          setLibraryDataCached(true); // 标记数据已缓存
        }
      });

      const unlistenSearchResults = await listen('library-search-results', (event: any) => {
        if (Array.isArray(event.payload)) {
          setTracks(event.payload);
          setIsLibraryLoading(false);
          // 搜索结果不改变缓存状态，因为这是临时的筛选结果
        }
      });

      const unlistenStats = await listen('library-stats', (event: any) => {
        console.log('🎵 收到统计数据事件:', event.payload);
        console.log('🎵 事件类型:', typeof event.payload);
        console.log('🎵 事件结构:', JSON.stringify(event.payload, null, 2));
        console.log('🎵 当前状态中的libraryStats:', libraryStats);
        
        if (event.payload && typeof event.payload === 'object') {
          // 验证统计数据结构
          if ('total_tracks' in event.payload && 'total_artists' in event.payload && 'total_albums' in event.payload) {
            console.log('🎵 统计数据有效，更新状态:', event.payload);
            console.log('🎵 更新前的状态:', libraryStats);
            setLibraryStats(event.payload);
            console.log('🎵 setLibraryStats调用完成');
          } else {
            console.warn('🎵 统计数据格式无效:', event.payload);
          }
        } else {
          console.warn('🎵 统计数据事件载荷无效');
        }
      });

      // 🎵 监听播放器错误
      const unlistenPlayerError = await listen('player-error', (event: any) => {
        console.error('🎵 播放器错误:', event.payload);
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

  // 🎯 监听系统对比度偏好变化和应用对比度模式
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 应用对比度模式到DOM
    const applyContrastMode = (highContrast: boolean) => {
      if (highContrast) {
        document.documentElement.setAttribute('data-contrast', 'high');
      } else {
        document.documentElement.removeAttribute('data-contrast');
      }
    };

    // 立即应用当前状态
    applyContrastMode(isHighContrast);

    // 监听系统偏好变化
    const mediaQuery = window.matchMedia('(prefers-contrast: more)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      // 只有在没有手动设置过偏好时才跟随系统
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

  // 清理定时器
  useEffect(() => {
    return () => {
      if (playerTimeoutRef.current) {
        clearTimeout(playerTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="app-container">
      {/* 🔮 玻璃化顶部标题栏 */}
      <header 
        className="app-header h-16 flex items-center justify-between px-6 relative"
        onMouseDown={handleDragStart}
      >
        {/* 背景拖拽层 */}
        <div 
          className="absolute inset-0 z-0"
          data-tauri-drag-region
        ></div>
        
        {/* 左侧：品牌标识 */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 bg-gradient-to-br from-brand-600 to-sky-400 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white text-sm font-bold">W</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">WindChime Player</h1>
            <p className="text-xs text-slate-500 leading-tight">玻璃化音乐播放器</p>
          </div>
        </div>

        {/* 中间：玻璃化搜索栏 */}
        <div className="w-full max-w-md mx-8 relative z-20" data-tauri-drag-region="false">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              placeholder="搜索音乐、艺术家或专辑..."
              className="glass-input w-full pr-10"
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

        {/* 右侧：玻璃化窗口控制按钮 */}
        <div className="flex items-center gap-2 relative z-20" data-tauri-drag-region="false">
          {/* 最小化按钮 */}
          <button
            onClick={handleMinimize}
            className="w-9 h-9 rounded-xl glass-surface glass-interactive flex items-center justify-center group"
            title="最小化"
          >
            <svg className="w-4 h-4 text-slate-600 group-hover:text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
            </svg>
          </button>
          
          {/* 最大化/还原按钮 */}
          <button
            onClick={handleMaximize}
            className="w-9 h-9 rounded-xl glass-surface glass-interactive flex items-center justify-center group"
            title="最大化/还原"
          >
            <svg className="w-4 h-4 text-slate-600 group-hover:text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2M16 4h2a2 2 0 012 2v2M16 20h2a2 2 0 002-2v-2" />
            </svg>
          </button>
          
          {/* 关闭按钮 */}
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

      {/* 🎨 玻璃化主要内容区域 */}
      <div className="app-main">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
        
        <main className="app-content">
          
          {/* 🚀 探索页面 */}
          {currentPage === 'explore' && (
            <div className="p-6 h-full">
              <div className="glass-card h-full">
                <ExplorePage />
              </div>
            </div>
          )}
          
          {/* 📚 音乐库页面 */}
          {currentPage === 'library' && (
            <div className="p-6 h-full">
              <LibraryPage 
                onTrackSelect={handleTrackSelect} 
                searchQuery={searchQuery}
                tracks={tracks}
                stats={libraryStats}
                isLoading={isLibraryLoading}
                isCached={libraryDataCached}
                onSearch={handleLibrarySearch}
                membraneSettings={membraneSettings}
                onRefresh={() => {
                  console.log('🔄 手动刷新音乐库数据');
                  setLibraryDataCached(false);
                  setIsLibraryLoading(true);
                  loadLibraryTracks();
                  loadLibraryStats();
                }}
              />
            </div>
          )}
          {/* 📋 播放列表页面 */}
          {currentPage === 'playlist' && (
            <div className="p-6 h-full">
              <PlaylistManager 
                onTrackSelect={handleTrackSelect} 
                membraneSettings={membraneSettings}
              />
            </div>
          )}
          
          
          {/* ❤️ 我的收藏页面 */}
          {currentPage === 'favorite' && (
            <div className="p-6 h-full">
              <div className="glass-card h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-slate-400 mb-6">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-4">我的收藏</h2>
                  <p className="text-slate-600 text-lg mb-6">您最喜爱的音乐作品</p>
                  <div className="glass-badge brand">即将推出</div>
                </div>
              </div>
            </div>
          )}
          
          
          
          {/* 🎭 音乐分类页面 */}
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
          
          
          {/* ⚙️ 应用设置页面 */}
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
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">应用设置</h2>
                    <p className="text-slate-600 text-lg mb-6">个性化您的音乐播放体验</p>
                  </div>

                  {/* 🎯 可访问性设置区域 */}
                  <div className="glass-surface p-6 mb-6">
                    <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-3">
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

                  {/* 🎵 音乐库管理区域 */}
                  <MusicFolderManager className="mb-6" />

                  {/* 🔍 调试工具区域 */}
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

                  {/* 🎭 交互动画设置区域 */}
                  <div className="glass-surface p-6 mb-6">
                    <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-3">
                      <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      交互动画
                    </h3>
                    <div className="space-y-4">
                      {/* 软膜联动效果 */}
                      <div className="glass-surface rounded-lg overflow-hidden">
                        <button
                          onClick={() => setMembraneDetailsExpanded(!membraneDetailsExpanded)}
                          className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 active:scale-[0.98] transition-all duration-200 group"
                          style={{
                            transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                          }}
                        >
                          <div className="text-left">
                            <div className="font-semibold text-slate-900 mb-1">软膜联动效果</div>
                            <div className="text-sm text-slate-600">
                              鼠标滑过曲目列表时，相邻行产生弹性联动，营造软膜质感
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {/* 状态指示 */}
                            <div 
                              className={`
                                px-2 py-1 rounded-full text-xs font-medium transition-all duration-300
                                ${membraneSettings.enabled 
                                  ? 'bg-green-100 text-green-700 scale-100' 
                                  : 'bg-slate-100 text-slate-600 scale-95'
                                }
                              `}
                              style={{
                                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                              }}
                            >
                              {membraneSettings.enabled ? '已启用' : '已禁用'}
                            </div>
                            
                            {/* 展开/收起图标 */}
                            <svg
                              className={`w-5 h-5 text-slate-400 transition-all ${
                                membraneDetailsExpanded 
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
                          className={`
                            border-t border-white/30 bg-slate-50/30 overflow-hidden 
                            transition-all ease-out
                            ${membraneDetailsExpanded 
                              ? 'max-h-96 opacity-100 duration-1000' 
                              : 'max-h-0 opacity-0 duration-300'
                            }
                          `}
                          style={{
                            transitionTimingFunction: membraneDetailsExpanded 
                              ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' // Q弹展开
                              : 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' // 平滑收缩
                          }}
                        >
                          <div 
                            className={`
                              p-4 space-y-4 transition-all
                              ${membraneDetailsExpanded 
                                ? 'transform translate-y-0 opacity-100 duration-600 delay-200' 
                                : 'transform -translate-y-2 opacity-0 duration-150 delay-0'
                              }
                            `}
                            style={{
                              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                            }}
                          >
                            {/* 启用/禁用开关 */}
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-900">启用软膜联动</span>
                              <button
                                onClick={() => updateMembraneSettings({ enabled: !membraneSettings.enabled })}
                                className={`
                                  relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                                  ${membraneSettings.enabled 
                                    ? 'bg-brand-600 shadow-inner' 
                                    : 'bg-slate-300 shadow-inner'
                                  }
                                `}
                              >
                                <div
                                  className={`
                                    absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 flex items-center justify-center
                                    ${membraneSettings.enabled ? 'transform translate-x-6' : ''}
                                  `}
                                >
                                  {membraneSettings.enabled ? (
                                    <svg className="w-3 h-3 text-brand-600" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  ) : (
                                    <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                                  )}
                                </div>
                              </button>
                            </div>

                            {/* 动画强度滑块 */}
                            <div 
                              className={`
                                space-y-3 transition-all duration-300 ease-out
                                ${membraneSettings.enabled 
                                  ? 'opacity-100 transform translate-y-0' 
                                  : 'opacity-50 transform translate-y-1 pointer-events-none'
                                }
                              `}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <span className="font-medium text-slate-900">动画强度</span>
                                  <span className="text-sm text-slate-600">{Math.round(membraneSettings.intensity * 100)}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="0.2"
                                  max="2"
                                  step="0.1"
                                  value={membraneSettings.intensity}
                                  onChange={(e) => updateMembraneSettings({ intensity: parseFloat(e.target.value) })}
                                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer slider"
                                  disabled={!membraneSettings.enabled}
                                />
                              </div>

                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <span className="font-medium text-slate-900">影响范围</span>
                                  <span className="text-sm text-slate-600">{Math.round(membraneSettings.radius * 100)}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="0.4"
                                  max="2"
                                  step="0.1"
                                  value={membraneSettings.radius}
                                  onChange={(e) => updateMembraneSettings({ radius: parseFloat(e.target.value) })}
                                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer slider"
                                  disabled={!membraneSettings.enabled}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 🎵 音频设置区域 */}
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

                  {/* 📱 界面设置区域 */}
                  <div className="glass-surface p-6 mb-6">
                    <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-3">
                      <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h14a2 2 0 012 2v12a4 4 0 01-4 4M7 21h10a4 4 0 004-4V5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a4 4 0 004 4z" />
                      </svg>
                      界面主题
                    </h3>
                    <div className="text-center py-8">
                      <div className="glass-badge brand">即将推出</div>
                      <p className="text-slate-600 text-sm mt-2">深色模式、主题色彩等功能正在开发中</p>
                    </div>
                  </div>

                  {/* 📖 关于软件区域 */}
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
          {/* 右侧内容区域播放器 - 固定在右侧内容区底端，除设置页面外始终显示 */}
          {currentPage !== 'settings' && (
            <div className="content-player-container">
              <PlaylistPlayer currentTrack={selectedTrack} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
