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

  // ========== 核心操作方法 ==========

  /**
   * 加载所有曲目
   */
  const loadTracks = useCallback(async () => {
    if (typeof invoke === 'undefined') {
      console.warn('Tauri API不可用，跳过加载曲目');
      return;
    }

    try {
      console.log('📨 LibraryContext: 发送加载曲目请求...');
      setIsLoading(true);
      await invoke('library_get_tracks');
      console.log('✅ LibraryContext: 加载请求已发送');
    } catch (error) {
      console.error('LibraryContext: 加载曲目失败', error);
      setIsLoading(false);
    }
  }, []);

  /**
   * 加载统计数据
   */
  const loadStats = useCallback(async () => {
    if (typeof invoke === 'undefined') {
      console.warn('Tauri API不可用，跳过加载统计');
      return;
    }

    try {
      console.log('📊 LibraryContext: 加载统计数据...');
      await invoke('library_get_stats');
    } catch (error) {
      console.error('LibraryContext: 加载统计失败', error);
    }
  }, []);

  /**
   * 搜索曲目
   */
  const searchTracks = useCallback(async (query: string) => {
    if (typeof invoke === 'undefined') return;

    if (query && query.trim()) {
      console.log('🔍 LibraryContext: 搜索', query);
      try {
        if (!isCached) {
          setIsLoading(true);
        }
        await invoke('library_search', { query: query.trim() });
      } catch (error) {
        console.error('LibraryContext: 搜索失败', error);
        setIsLoading(false);
      }
    } else {
      // 恢复完整列表
      if (hasInitialized) {
        console.log('LibraryContext: 恢复完整列表');
        await loadTracks();
      }
    }
  }, [hasInitialized, isCached, loadTracks]);

  /**
   * 刷新音乐库数据
   */
  const refresh = useCallback(async () => {
    console.log('🔄 LibraryContext: 刷新音乐库');
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
   * 监听曲目加载完成
   */
  useTauriEvent('library-tracks-loaded', (payload) => {
    console.log(`📥 LibraryContext: 收到曲目数据，共${payload.length}首`);
    setTracks(payload);
    setIsLoading(false);
    setHasInitialized(true);
    setIsCached(true);
    
    // 🎨 自动同步艺术家封面（后台静默执行）
    if (payload.length > 0) {
      silentSyncArtistCovers(payload).catch(error => {
        console.warn('艺术家封面自动同步失败:', error);
      });
    }
  });

  /**
   * 监听搜索结果
   */
  useTauriEvent('library-search-results', (payload) => {
    console.log(`🔍 LibraryContext: 搜索结果，共${payload.length}首`);
    setTracks(payload);
    setIsLoading(false);
  });

  /**
   * 监听统计数据
   */
  useTauriEvent('library-stats', (payload) => {
    console.log('📊 LibraryContext: 收到统计数据', payload);
    setStats(payload);
  });

  /**
   * 监听扫描开始
   */
  useTauriEvent('library-scan-started', () => {
    console.log('🎬 LibraryContext: 扫描开始');
    setIsScanning(true);
    setScanProgress(null);
  });

  /**
   * 监听扫描进度
   */
  useTauriEvent('library-scan-progress', (payload) => {
    setScanProgress(payload);
  });

  /**
   * 监听扫描完成
   */
  useTauriEvent('library-scan-complete', async (payload) => {
    console.log('🎉 LibraryContext: 扫描完成', payload);
    setIsScanning(false);
    setScanProgress(null);
    
    // 自动刷新数据
    await loadTracks();
    await loadStats();
    
    // 🎨 扫描完成后也触发艺术家封面同步（可能有新艺术家）
    if (tracks.length > 0) {
      silentSyncArtistCovers(tracks).catch(error => {
        console.warn('艺术家封面自动同步失败:', error);
      });
    }
  });

  // ========== 初始化 ==========

  /**
   * 监听应用就绪事件，自动加载数据
   */
  useTauriEvent('app-ready', async () => {
    console.log('✅ LibraryContext: 应用就绪，加载音乐库数据');
    await loadTracks();
    await loadStats();
  });

  /**
   * 组件挂载时尝试立即加载（如果后端已就绪）
   */
  useEffect(() => {
    // 延迟100ms确保后端完全就绪
    const timer = setTimeout(async () => {
      if (!hasInitialized && typeof invoke !== 'undefined') {
        console.log('⏰ LibraryContext: 尝试立即加载数据');
        await loadTracks();
        await loadStats();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

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



