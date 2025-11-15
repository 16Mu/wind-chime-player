/**
 * 音乐库Context - 管理音乐库相关的所有状态和逻辑
 * 
 * 设计原则：
 * - 高内聚：所有音乐库相关的状态、逻辑、事件监听都在这里
 * - 低耦合：通过Context API暴露接口，组件只依赖接口而非实现
 * - 单一职责：只负责音乐库数据管理，不涉及UI或播放器状态
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Track, LibraryStats, ScanProgress } from '../types/music';
import { useTauriEvent } from '../hooks/useEventManager';
import { silentSyncArtistCovers } from '../services/artistCoverSync';
import { cacheService, TrackMetadata } from '../services/cacheService';
import { perfDiag } from '../utils/performanceDiagnostics';

// ==================== Context类型定义 ====================

interface LibraryContextValue {
  // 数据状态
  tracks: Track[];
  stats: LibraryStats | null;
  
  // 加载状态
  isLoading: boolean;
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  
  // 初始化状态
  hasInitialized: boolean;
  isCached: boolean;
  
  // 操作方法
  loadTracks: () => Promise<void>;
  loadStats: () => Promise<void>;
  searchTracks: (query: string) => Promise<void>;
  refresh: () => Promise<void>;
  
  // 工具方法
  getTrackById: (id: number) => Track | undefined;
  getTracksByArtist: (artist: string) => Track[];
  getTracksByAlbum: (album: string) => Track[];
}

const LibraryContext = createContext<LibraryContextValue | undefined>(undefined);

// ==================== Provider组件 ====================

interface LibraryProviderProps {
  children: ReactNode;
}

export function LibraryProvider({ children }: LibraryProviderProps) {
  // ========== 状态管理 ==========
  const [tracks, setTracks] = useState<Track[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isCached, setIsCached] = useState(false);
  // 新增：标识是否正在从缓存加载和后台同步
  const [, setIsLoadingFromCache] = useState(true);
  const [, setIsSyncing] = useState(false);

  // ========== 核心操作方法 ==========

  /**
   * 从缓存快速加载（启动优化 - 秒开策略）
   */
  const loadFromCache = useCallback(async () => {
    try {
      console.log('⚡ [性能优化] 从IndexedDB缓存加载数据...');
      setIsLoadingFromCache(true);

      // 1. 加载轻量级元数据（几乎无延迟）
      const cachedMetadata = await cacheService.loadTracksMetadata();
      
      if (cachedMetadata.length > 0) {
        // 转换为Track格式（暂时不包含封面数据）
        const tracksFromCache: Track[] = cachedMetadata.map((meta: TrackMetadata) => ({
          ...meta,
          album_cover_data: undefined,
          album_cover_mime: undefined,
          artist_photo_data: undefined,
          artist_photo_mime: undefined,
          embedded_lyrics: undefined,
        }));

        setTracks(tracksFromCache);
        setHasInitialized(true);
        setIsCached(true);
        console.log(`✅ 从缓存加载了 ${cachedMetadata.length} 首曲目（轻量级模式）`);
      }

      // 2. 加载统计信息
      const cachedStats = await cacheService.loadStats();
      if (cachedStats) {
        setStats(cachedStats);
        console.log('✅ 从缓存加载了统计信息');
      }

      // 3. 检查缓存是否过期
      const isExpired = await cacheService.isCacheExpired();
      if (isExpired) {
        console.log('⚠️ 缓存已过期（超过24小时），将在后台刷新');
      }

      return {
        hasCache: cachedMetadata.length > 0,
        isExpired,
      };
    } catch (error) {
      console.error('❌ 从缓存加载失败:', error);
      return {
        hasCache: false,
        isExpired: true,
      };
    } finally {
      setIsLoadingFromCache(false);
    }
  }, []);

  /**
   * 后台同步最新数据
   */
  const syncFromBackend = useCallback(async (silent: boolean = true) => {
    if (typeof invoke === 'undefined') {
      console.warn('Tauri API不可用，跳过同步');
      return;
    }

    try {
      if (silent) {
        console.log('🔄 [后台同步] 静默刷新最新数据...');
        setIsSyncing(true);
      } else {
        console.log('[LibraryContext] 显式加载数据...');
        setIsLoading(true);
      }

      await invoke('library_get_tracks');
      console.log('[LibraryContext] 同步请求已发送');
    } catch (error) {
      console.error('[LibraryContext] 同步失败', error);
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  /**
   * 加载所有曲目（兼容旧接口）
   */
  const loadTracks = useCallback(async () => {
    await syncFromBackend(false);
  }, [syncFromBackend]);

  /**
   * Load statistics
   */
  const loadStats = useCallback(async () => {
    if (typeof invoke === 'undefined') {
      console.warn('Tauri API not available, skipping stats load');
      return;
    }

    try {
      console.log('[LibraryContext] Loading statistics...');
      await invoke('library_get_stats');
    } catch (error) {
      console.error('[LibraryContext] Failed to load stats', error);
    }
  }, []);

  /**
   * Search tracks
   */
  const searchTracks = useCallback(async (query: string) => {
    if (typeof invoke === 'undefined') return;

    if (query && query.trim()) {
      console.log('[LibraryContext] Searching', query);
      try {
        if (!isCached) {
          setIsLoading(true);
        }
        await invoke('library_search', { query: query.trim() });
      } catch (error) {
        console.error('[LibraryContext] Search failed', error);
        setIsLoading(false);
      }
    } else {
      if (hasInitialized) {
        console.log('[LibraryContext] Restoring full list');
        await loadTracks();
      }
    }
  }, [hasInitialized, isCached, loadTracks]);

  /**
   * Refresh library data
   */
  const refresh = useCallback(async () => {
    console.log('[LibraryContext] Refreshing library');
    setIsCached(false);
    setIsLoading(true);
    await loadTracks();
    await loadStats();
  }, [loadTracks, loadStats]);

  // ========== 工具方法 ==========

  /**
   * 根据ID获取曲目
   */
  const getTrackById = useCallback((id: number): Track | undefined => {
    return tracks.find(track => track.id === id);
  }, [tracks]);

  /**
   * 获取指定艺术家的所有曲目
   */
  const getTracksByArtist = useCallback((artist: string): Track[] => {
    return tracks.filter(track => track.artist === artist);
  }, [tracks]);

  /**
   * 获取指定专辑的所有曲目
   */
  const getTracksByAlbum = useCallback((album: string): Track[] => {
    return tracks.filter(track => track.album === album);
  }, [tracks]);

  // ========== 事件监听 ==========

  /**
   * Listen for tracks loaded
   */
  useTauriEvent('library-tracks-loaded', (payload) => {
    console.log(`[LibraryContext] Received track data, ${payload.length} tracks`);
    setTracks(payload);
    setIsLoading(false);
    setIsSyncing(false);
    setHasInitialized(true);
    setIsCached(true);
    
    // 🚀 性能优化：保存到IndexedDB缓存
    if (payload.length > 0) {
      cacheService.saveTracks(payload).catch(error => {
        console.warn('⚠️ 保存曲目到缓存失败:', error);
      });
      
      silentSyncArtistCovers(payload).catch(error => {
        console.warn('Artist cover auto-sync failed:', error);
      });
    }
  });

  /**
   * Listen for search results
   */
  useTauriEvent('library-search-results', (payload) => {
    console.log(`[LibraryContext] Search results, ${payload.length} tracks`);
    setTracks(payload);
    setIsLoading(false);
  });

  /**
   * Listen for statistics
   */
  useTauriEvent('library-stats', (payload) => {
    console.log('[LibraryContext] Received statistics', payload);
    setStats(payload);
    
    // 🚀 性能优化：保存统计信息到缓存
    cacheService.saveStats(payload).catch(error => {
      console.warn('⚠️ 保存统计信息到缓存失败:', error);
    });
  });

  /**
   * Listen for scan started
   */
  useTauriEvent('library-scan-started', () => {
    console.log('[LibraryContext] Scan started');
    setIsScanning(true);
    setScanProgress(null);
  });

  /**
   * Listen for scan progress
   */
  useTauriEvent('library-scan-progress', (payload) => {
    setScanProgress(payload);
  });

  /**
   * Listen for scan complete
   */
  useTauriEvent('library-scan-complete', async (payload) => {
    console.log('[LibraryContext] Scan complete', payload);
    setIsScanning(false);
    setScanProgress(null);
    
    await loadTracks();
    await loadStats();
    
    if (tracks.length > 0) {
      silentSyncArtistCovers(tracks).catch(error => {
        console.warn('Artist cover auto-sync failed:', error);
      });
    }
  });

  // ========== Initialization ==========

  /**
   * 🚀 性能优化：组件挂载时的初始化流程
   * 策略：缓存优先 + 后台同步（参考QQ音乐、网易云音乐）
   */
  useEffect(() => {
    const initializeLibrary = async () => {
      perfDiag.start();
      console.log('🎵 初始化音乐库...');

      perfDiag.checkpoint('开始加载缓存');
      // 步骤1: 立即从缓存加载（几乎无延迟，实现秒开）
      const cacheResult = await loadFromCache();
      perfDiag.checkpoint('缓存加载完成');

      // 步骤2: 等待Tauri后端就绪
      await new Promise(resolve => setTimeout(resolve, 100));
      perfDiag.checkpoint('等待Tauri就绪');

      if (typeof invoke === 'undefined') {
        console.warn('⚠️ Tauri API不可用，仅使用缓存数据');
        perfDiag.report();
        return;
      }

      // 步骤3: 后台异步同步最新数据
      if (cacheResult.hasCache) {
        // 有缓存：后台静默刷新（不阻塞UI）
        console.log('🔄 缓存已加载，后台静默同步最新数据...');
        perfDiag.checkpoint('UI可用（有缓存）');
        perfDiag.report();
        
        setTimeout(async () => {
          await syncFromBackend(true); // 静默模式
          await loadStats();
          console.log('✅ 后台同步完成');
        }, 500); // 延迟500ms，让UI先渲染
      } else {
        // 无缓存：显式加载（显示加载状态）
        console.log('📥 首次启动，从后端加载数据...');
        perfDiag.checkpoint('开始从后端加载');
        await syncFromBackend(false); // 非静默模式
        await loadStats();
        perfDiag.checkpoint('后端加载完成');
        perfDiag.report();
      }
    };

    initializeLibrary().catch(error => {
      console.error('❌ 初始化音乐库失败:', error);
      perfDiag.report();
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Listen for app ready event（兼容旧的事件触发方式）
   */
  useTauriEvent('app-ready', async () => {
    console.log('[LibraryContext] App ready event received');
    // 如果还未初始化，则触发加载
    if (!hasInitialized) {
      await syncFromBackend(false);
      await loadStats();
    }
  });

  // ========== Context Value ==========

  const value: LibraryContextValue = {
    // 数据
    tracks,
    stats,
    
    // 状态
    isLoading,
    isScanning,
    scanProgress,
    hasInitialized,
    isCached,
    
    // 方法
    loadTracks,
    loadStats,
    searchTracks,
    refresh,
    getTrackById,
    getTracksByArtist,
    getTracksByAlbum,
  };

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
}

// ==================== Hook导出 ====================

/**
 * 使用音乐库Context的Hook
 * 
 * @example
 * const { tracks, loadTracks, isLoading } = useLibrary();
 */
export function useLibrary() {
  const context = useContext(LibraryContext);
  
  if (context === undefined) {
    throw new Error('useLibrary必须在LibraryProvider内部使用');
  }
  
  return context;
}

/**
 * 只获取音乐库数据的Hook（性能优化）
 */
export function useLibraryData() {
  const { tracks, stats } = useLibrary();
  return { tracks, stats };
}

/**
 * 只获取音乐库状态的Hook（性能优化）
 */
export function useLibraryStatus() {
  const { isLoading, isScanning, scanProgress, hasInitialized, isCached } = useLibrary();
  return { isLoading, isScanning, scanProgress, hasInitialized, isCached };
}



