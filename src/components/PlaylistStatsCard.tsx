// 歌单统计卡片组件
// 功能：显示歌单的总体统计信息

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Music, Clock, ListMusic, Star, Pin } from 'lucide-react';

interface PlaylistStats {
  total_playlists: number;
  total_tracks: number;
  total_duration_ms: number;
  smart_playlists: number;
  pinned_playlists: number;
}

export function PlaylistStatsCard() {
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
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-dark-900 rounded-xl shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 dark:bg-dark-700 rounded w-1/3"></div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-200 dark:bg-dark-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 
                    rounded-xl shadow-lg p-6 border border-blue-200 dark:border-blue-800">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <ListMusic className="text-blue-600 dark:text-blue-400" size={20} />
        歌单统计
      </h3>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 歌单总数 */}
        <div className="bg-white dark:bg-dark-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600 dark:text-dark-400">歌单总数</span>
            <ListMusic size={16} className="text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.total_playlists || 0}
          </div>
        </div>

        {/* 曲目总数 */}
        <div className="bg-white dark:bg-dark-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600 dark:text-dark-400">曲目总数</span>
            <Music size={16} className="text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {(stats.total_tracks || 0).toLocaleString()}
          </div>
        </div>

        {/* 总时长 */}
        <div className="bg-white dark:bg-dark-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600 dark:text-dark-400">总时长</span>
            <Clock size={16} className="text-slate-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            {formatDuration(stats.total_duration_ms || 0)}
          </div>
        </div>

        {/* 智能歌单 */}
        <div className="bg-white dark:bg-dark-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600 dark:text-dark-400">智能歌单</span>
            <Star size={16} className="text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {stats.smart_playlists || 0}
          </div>
        </div>

        {/* 置顶歌单 */}
        <div className="bg-white dark:bg-dark-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600 dark:text-dark-400">置顶歌单</span>
            <Pin size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats.pinned_playlists || 0}
          </div>
        </div>
      </div>

      {/* 刷新按钮 */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={loadStats}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 
                   dark:hover:text-blue-300 transition-colors"
        >
          刷新统计
        </button>
      </div>
    </div>
  );
}

