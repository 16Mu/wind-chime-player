/**
 * 歌单上下文 - 企业级状态管理
 * 
 * 设计原则：
 * - 高内聚：所有歌单相关状态和逻辑集中在此
 * - 低耦合：通过Context API与组件解耦
 * - 单一职责：只负责歌单状态管理和API调用
 * - 接口隔离：提供清晰的公共API
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

// ==================== 类型定义 ====================

export interface Playlist {
  id: number;
  name: string;
  description?: string;
  cover_path?: string;
  color_theme?: string;
  is_smart: boolean;
  smart_rules?: string; // JSON格式
  is_favorite: boolean;
  is_pinned: boolean;
  track_count: number;
  total_duration_ms: number;
  created_at: number;
  updated_at?: number;
  last_played?: number;
  play_count: number;
}

export interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
}

export interface PlaylistWithTracks {
  playlist: Playlist;
  tracks: Track[];
}

export interface SmartRule {
  field: RuleField;
  operator: RuleOperator;
  value: string;
}

export type RuleField = 
  | 'title' 
  | 'artist' 
  | 'album' 
  | 'duration' 
  | 'date_added' 
  | 'last_played' 
  | 'play_count' 
  | 'is_favorite';

export type RuleOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'contains' 
  | 'not_contains' 
  | 'starts_with' 
  | 'ends_with'
  | 'greater_than' 
  | 'less_than' 
  | 'greater_or_equal' 
  | 'less_or_equal'
  | 'within_days' 
  | 'not_within_days' 
  | 'before' 
  | 'after'
  | 'is_true' 
  | 'is_false';

export interface SmartRules {
  rules: SmartRule[];
  match_all: boolean; // true=AND, false=OR
  limit?: number;
}

export interface CreatePlaylistOptions {
  name: string;
  description?: string;
  color_theme?: string;
  is_smart: boolean;
  smart_rules?: SmartRules;
}

export interface UpdatePlaylistOptions {
  name?: string;
  description?: string;
  cover_path?: string;
  color_theme?: string;
  is_favorite?: boolean;
}

export type ExportFormat = 'M3U' | 'M3U8' | 'JSON';

export interface PlaylistStats {
  total_playlists: number;
  total_smart_playlists: number;
  total_favorite_playlists: number;
  total_tracks_in_playlists: number;
}

// ==================== Context接口 ====================

interface PlaylistContextType {
  // 状态
  playlists: Playlist[];
  currentPlaylist: PlaylistWithTracks | null;
  stats: PlaylistStats | null;
  loading: boolean;
  error: string | null;

  // CRUD操作
  loadPlaylists: () => Promise<void>;
  createPlaylist: (options: CreatePlaylistOptions) => Promise<number>;
  getPlaylistDetail: (id: number) => Promise<void>;
  updatePlaylist: (id: number, options: UpdatePlaylistOptions) => Promise<void>;
  deletePlaylist: (id: number) => Promise<void>;

  // 曲目管理
  addTracksToPlaylist: (playlistId: number, trackIds: number[]) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: number, trackId: number) => Promise<void>;
  reorderTracks: (playlistId: number, trackIds: number[]) => Promise<void>;

  // 智能歌单
  createSmartPlaylist: (name: string, rules: SmartRules) => Promise<number>;
  updateSmartPlaylistRules: (id: number, rules: SmartRules) => Promise<void>;
  refreshSmartPlaylist: (id: number) => Promise<void>;
  refreshAllSmartPlaylists: () => Promise<void>;

  // 导入导出
  exportPlaylist: (id: number, filePath: string, format: ExportFormat) => Promise<void>;
  exportPlaylistPreview: (id: number, format: ExportFormat) => Promise<string>;
  importPlaylist: (filePath: string) => Promise<number>;

  // 其他功能
  loadStats: () => Promise<void>;
  markPlayed: (id: number) => Promise<void>;
  toggleFavorite: (id: number) => Promise<boolean>;
  clearError: () => void;
  clearCurrentPlaylist: () => void;
  
  // Pin功能
  pinPlaylist: (id: number) => Promise<void>;
  unpinPlaylist: (id: number) => Promise<void>;
  togglePin: (id: number) => Promise<boolean>;
  
  // 侧边栏智能展示
  getSidebarPlaylists: () => Playlist[];
}

// ==================== Context创建 ====================

const PlaylistContext = createContext<PlaylistContextType | null>(null);

// ==================== Provider组件 ====================

export const PlaylistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 状态
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [currentPlaylist, setCurrentPlaylist] = useState<PlaylistWithTracks | null>(null);
  const [stats, setStats] = useState<PlaylistStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ==================== 辅助函数 ====================

  const handleError = useCallback((err: unknown, action: string) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[PlaylistContext] ${action} 失败:`, err);
    setError(`${action}失败: ${message}`);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearCurrentPlaylist = useCallback(() => {
    setCurrentPlaylist(null);
  }, []);

  // ==================== CRUD操作 ====================

  const loadPlaylists = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await invoke<Playlist[]>('playlists_list');
      setPlaylists(result);
    } catch (err) {
      handleError(err, '加载歌单列表');
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const createPlaylist = useCallback(async (options: CreatePlaylistOptions): Promise<number> => {
    try {
      setLoading(true);
      setError(null);
      const playlistId = await invoke<number>('playlists_create', { options });
      await loadPlaylists(); // 刷新列表
      return playlistId;
    } catch (err) {
      handleError(err, '创建歌单');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadPlaylists, handleError]);

  const getPlaylistDetail = useCallback(async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      const result = await invoke<PlaylistWithTracks>('playlists_get_detail', { playlistId: id });
      setCurrentPlaylist(result);
    } catch (err) {
      handleError(err, '加载歌单详情');
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const updatePlaylist = useCallback(async (id: number, options: UpdatePlaylistOptions) => {
    try {
      setLoading(true);
      setError(null);
      await invoke('playlists_update', { playlistId: id, options });
      await loadPlaylists(); // 刷新列表
      if (currentPlaylist?.playlist.id === id) {
        await getPlaylistDetail(id); // 刷新当前详情
      }
    } catch (err) {
      handleError(err, '更新歌单');
    } finally {
      setLoading(false);
    }
  }, [loadPlaylists, getPlaylistDetail, currentPlaylist, handleError]);

  const deletePlaylist = useCallback(async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      await invoke('playlists_delete', { playlistId: id });
      await loadPlaylists(); // 刷新列表
      if (currentPlaylist?.playlist.id === id) {
        setCurrentPlaylist(null); // 清除当前详情
      }
    } catch (err) {
      handleError(err, '删除歌单');
    } finally {
      setLoading(false);
    }
  }, [loadPlaylists, currentPlaylist, handleError]);

  // ==================== 曲目管理 ====================

  const addTracksToPlaylist = useCallback(async (playlistId: number, trackIds: number[]) => {
    try {
      setLoading(true);
      setError(null);
      await invoke('playlists_add_tracks', { playlistId, trackIds });
      await loadPlaylists(); // 刷新列表
      if (currentPlaylist?.playlist.id === playlistId) {
        await getPlaylistDetail(playlistId); // 刷新当前详情
      }
    } catch (err) {
      handleError(err, '添加曲目到歌单');
    } finally {
      setLoading(false);
    }
  }, [loadPlaylists, getPlaylistDetail, currentPlaylist, handleError]);

  const removeTrackFromPlaylist = useCallback(async (playlistId: number, trackId: number) => {
    try {
      setLoading(true);
      setError(null);
      await invoke('playlists_remove_track', { playlistId, trackId });
      await loadPlaylists(); // 刷新列表
      if (currentPlaylist?.playlist.id === playlistId) {
        await getPlaylistDetail(playlistId); // 刷新当前详情
      }
    } catch (err) {
      handleError(err, '从歌单移除曲目');
    } finally {
      setLoading(false);
    }
  }, [loadPlaylists, getPlaylistDetail, currentPlaylist, handleError]);

  const reorderTracks = useCallback(async (playlistId: number, trackIds: number[]) => {
    try {
      setError(null);
      await invoke('playlists_reorder_tracks', { playlistId, trackIds });
      if (currentPlaylist?.playlist.id === playlistId) {
        await getPlaylistDetail(playlistId); // 刷新当前详情
      }
    } catch (err) {
      handleError(err, '重排曲目');
    }
  }, [getPlaylistDetail, currentPlaylist, handleError]);

  // ==================== 智能歌单 ====================

  const createSmartPlaylist = useCallback(async (name: string, rules: SmartRules): Promise<number> => {
    try {
      setLoading(true);
      setError(null);
      const playlistId = await invoke<number>('playlists_create_smart', { name, rules });
      await loadPlaylists(); // 刷新列表
      return playlistId;
    } catch (err) {
      handleError(err, '创建智能歌单');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadPlaylists, handleError]);

  const updateSmartPlaylistRules = useCallback(async (id: number, rules: SmartRules) => {
    try {
      setLoading(true);
      setError(null);
      await invoke('playlists_update_smart_rules', { playlistId: id, rules });
      await loadPlaylists(); // 刷新列表
      if (currentPlaylist?.playlist.id === id) {
        await getPlaylistDetail(id); // 刷新当前详情
      }
    } catch (err) {
      handleError(err, '更新智能歌单规则');
    } finally {
      setLoading(false);
    }
  }, [loadPlaylists, getPlaylistDetail, currentPlaylist, handleError]);

  const refreshSmartPlaylist = useCallback(async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      await invoke('playlists_refresh_smart', { playlistId: id });
      await loadPlaylists(); // 刷新列表
      if (currentPlaylist?.playlist.id === id) {
        await getPlaylistDetail(id); // 刷新当前详情
      }
    } catch (err) {
      handleError(err, '刷新智能歌单');
    } finally {
      setLoading(false);
    }
  }, [loadPlaylists, getPlaylistDetail, currentPlaylist, handleError]);

  const refreshAllSmartPlaylists = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await invoke('playlists_refresh_all_smart');
      await loadPlaylists(); // 刷新列表
    } catch (err) {
      handleError(err, '刷新所有智能歌单');
    } finally {
      setLoading(false);
    }
  }, [loadPlaylists, handleError]);

  // ==================== 导入导出 ====================

  const exportPlaylist = useCallback(async (id: number, filePath: string, format: ExportFormat) => {
    try {
      setLoading(true);
      setError(null);
      await invoke('playlists_export', { playlistId: id, filePath, format });
    } catch (err) {
      handleError(err, '导出歌单');
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const exportPlaylistPreview = useCallback(async (id: number, format: ExportFormat): Promise<string> => {
    try {
      setError(null);
      return await invoke<string>('playlists_export_preview', { playlistId: id, format });
    } catch (err) {
      handleError(err, '预览导出');
      throw err;
    }
  }, [handleError]);

  const importPlaylist = useCallback(async (filePath: string): Promise<number> => {
    try {
      setLoading(true);
      setError(null);
      const playlistId = await invoke<number>('playlists_import', { filePath });
      await loadPlaylists(); // 刷新列表
      return playlistId;
    } catch (err) {
      handleError(err, '导入歌单');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadPlaylists, handleError]);

  // ==================== 其他功能 ====================

  const loadStats = useCallback(async () => {
    try {
      const result = await invoke<PlaylistStats>('playlists_get_stats');
      setStats(result);
    } catch (err) {
      console.error('[PlaylistContext] 加载统计信息失败:', err);
    }
  }, []);

  const markPlayed = useCallback(async (id: number) => {
    try {
      await invoke('playlists_mark_played', { playlistId: id });
      await loadPlaylists(); // 刷新列表
    } catch (err) {
      console.error('[PlaylistContext] 标记播放失败:', err);
    }
  }, [loadPlaylists]);

  const toggleFavorite = useCallback(async (id: number): Promise<boolean> => {
    try {
      const isFavorite = await invoke<boolean>('playlists_toggle_favorite', { playlistId: id });
      await loadPlaylists(); // 刷新列表
      return isFavorite;
    } catch (err) {
      handleError(err, '切换收藏状态');
      throw err;
    }
  }, [loadPlaylists, handleError]);

  // ==================== Pin功能 ====================

  const pinPlaylist = useCallback(async (id: number) => {
    try {
      await invoke('playlists_pin', { playlistId: id });
      await loadPlaylists();
    } catch (err) {
      handleError(err, 'Pin歌单');
    }
  }, [loadPlaylists, handleError]);

  const unpinPlaylist = useCallback(async (id: number) => {
    try {
      await invoke('playlists_unpin', { playlistId: id });
      await loadPlaylists();
    } catch (err) {
      handleError(err, '取消Pin');
    }
  }, [loadPlaylists, handleError]);

  const togglePin = useCallback(async (id: number): Promise<boolean> => {
    try {
      const isPinned = await invoke<boolean>('playlists_toggle_pin', { playlistId: id });
      await loadPlaylists();
      return isPinned;
    } catch (err) {
      handleError(err, '切换Pin状态');
      throw err;
    }
  }, [loadPlaylists, handleError]);

  // ==================== 侧边栏智能展示 ====================

  const getSidebarPlaylists = useCallback((): Playlist[] => {
    // 优先级1：固定的歌单（最多3个）
    const pinned = playlists
      .filter(p => p.is_pinned)
      .sort((a, b) => (b.last_played || 0) - (a.last_played || 0))
      .slice(0, 3);

    const remainingSlots = 5 - pinned.length;
    if (remainingSlots <= 0) return pinned;

    // 优先级2：最近播放的非固定歌单
    const recentNotPinned = playlists
      .filter(p => !p.is_pinned && p.last_played)
      .sort((a, b) => (b.last_played || 0) - (a.last_played || 0))
      .slice(0, remainingSlots);

    const combined = [...pinned, ...recentNotPinned];
    if (combined.length >= 5) return combined;

    // 优先级3：播放次数最多的歌单
    const mostPlayed = playlists
      .filter(p => !pinned.includes(p) && !recentNotPinned.includes(p))
      .sort((a, b) => b.play_count - a.play_count)
      .slice(0, 5 - combined.length);

    return [...combined, ...mostPlayed];
  }, [playlists]);

  // ==================== 初始化 ====================

  useEffect(() => {
    loadPlaylists();
    loadStats();
  }, [loadPlaylists, loadStats]);

  // ==================== Context值 ====================

  const value: PlaylistContextType = {
    // 状态
    playlists,
    currentPlaylist,
    stats,
    loading,
    error,

    // CRUD操作
    loadPlaylists,
    createPlaylist,
    getPlaylistDetail,
    updatePlaylist,
    deletePlaylist,

    // 曲目管理
    addTracksToPlaylist,
    removeTrackFromPlaylist,
    reorderTracks,

    // 智能歌单
    createSmartPlaylist,
    updateSmartPlaylistRules,
    refreshSmartPlaylist,
    refreshAllSmartPlaylists,

    // 导入导出
    exportPlaylist,
    exportPlaylistPreview,
    importPlaylist,

    // 其他功能
    loadStats,
    markPlayed,
    toggleFavorite,
    clearError,
    clearCurrentPlaylist,
    
    // Pin功能
    pinPlaylist,
    unpinPlaylist,
    togglePin,
    
    // 侧边栏智能展示
    getSidebarPlaylists,
  };

  return (
    <PlaylistContext.Provider value={value}>
      {children}
    </PlaylistContext.Provider>
  );
};

// ==================== Hook ====================

export const usePlaylist = (): PlaylistContextType => {
  const context = useContext(PlaylistContext);
  if (!context) {
    throw new Error('usePlaylist must be used within PlaylistProvider');
  }
  return context;
};

