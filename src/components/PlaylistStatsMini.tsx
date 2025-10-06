// 歌单统计迷你卡片 - 侧边栏专用
// 紧凑设计，适合在侧边栏显示

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Music, Clock, ListMusic } from 'lucide-react';

interface PlaylistStats {
  total_playlists: number;
  total_tracks: number;
  total_duration_ms: number;
  pinned_playlists: number;
  favorite_playlists: number;
}

interface PlaylistStatsMiniProps {
  isCollapsed?: boolean;
}

export function PlaylistStatsMini({ isCollapsed = false }: PlaylistStatsMiniProps) {
  const [stats, setStats] = useState<PlaylistStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const result = await invoke<PlaylistStats>('playlists_get_stats');
      setStats(result);
    } catch (error) {
      console.error('加载歌单统计失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 格式化时长
  const formatDuration = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h${minutes}m`;
    }
    return `${minutes}分钟`;
  };

  // 加载状态 - 收起时显示简单图标
  if (isLoading) {
    return isCollapsed ? (
      <div className="flex items-center justify-center py-2">
        <div className="w-4 h-4 border-2 border-slate-300 dark:border-dark-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    ) : (
      <div className="px-4 mb-4">
        <div className="bg-slate-50 dark:bg-dark-800/50 rounded-lg p-3 animate-pulse">
          <div className="h-3 bg-slate-200 dark:bg-dark-700 rounded w-2/3 mb-2"></div>
          <div className="h-3 bg-slate-200 dark:bg-dark-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  // 确保stats存在且有效数据
  if (!stats || stats.total_playlists === undefined || stats.total_tracks === undefined) {
    return null;
  }

  // 收起状态：只显示一个图标按钮，悬停显示统计
  if (isCollapsed) {
    return (
      <div className="relative group mb-3">
        <button 
          className="w-full py-3 px-2 rounded-xl flex items-center justify-center
                   text-slate-600 dark:text-dark-400 hover:bg-slate-100 dark:hover:bg-dark-200/50 
                   hover:scale-105 transition-all duration-300"
          title={`${stats.total_playlists || 0}个歌单 · ${stats.total_tracks || 0}首曲目`}
        >
          <ListMusic size={16} />
        </button>
        
        {/* 悬停提示 */}
        <div className="absolute left-full ml-2 top-0 z-50 opacity-0 invisible group-hover:opacity-100 
                      group-hover:visible transition-all duration-200 pointer-events-none">
          <div className="bg-slate-900 dark:bg-dark-800 text-white text-xs rounded-lg p-3 shadow-xl 
                        border border-slate-700 dark:border-dark-600 whitespace-nowrap min-w-[140px]">
            <div className="flex items-center gap-2 mb-1.5">
              <ListMusic size={12} className="text-blue-400" />
              <span>{stats.total_playlists || 0} 个歌单</span>
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <Music size={12} className="text-purple-400" />
              <span>{stats.total_tracks || 0} 首曲目</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={12} className="text-green-400" />
              <span>{formatDuration(stats.total_duration_ms || 0)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 展开状态：紧凑的卡片设计
  return (
    <div className="px-4 mb-4">
      <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 
                    dark:from-blue-900/10 dark:to-indigo-900/10 
                    rounded-lg p-3 border border-blue-100 dark:border-blue-900/30
                    backdrop-blur-sm transition-all duration-300 hover:shadow-md">
        
        {/* 统计项 */}
        <div className="space-y-2">
          {/* 歌单数 */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-dark-400">
              <ListMusic size={14} className="text-blue-500 dark:text-blue-400" />
              <span>歌单</span>
            </div>
            <span className="font-semibold text-slate-900 dark:text-white">
              {stats.total_playlists || 0}
            </span>
          </div>

          {/* 曲目数 */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-dark-400">
              <Music size={14} className="text-purple-500 dark:text-purple-400" />
              <span>曲目</span>
            </div>
            <span className="font-semibold text-slate-900 dark:text-white">
              {(stats.total_tracks || 0).toLocaleString()}
            </span>
          </div>

          {/* 总时长 */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-dark-400">
              <Clock size={14} className="text-green-500 dark:text-green-400" />
              <span>时长</span>
            </div>
            <span className="font-semibold text-slate-900 dark:text-white">
              {formatDuration(stats.total_duration_ms || 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

