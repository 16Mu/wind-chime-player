// 音乐库统计面板
// 功能：显示音乐库的详细统计信息

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Music, Album, User, Clock, TrendingUp, Loader2 } from 'lucide-react';

interface LibraryStats {
  total_tracks: number;
  total_albums: number;
  total_artists: number;
  total_duration_ms: number;
  avg_bitrate: number;
  total_size_bytes: number;
}

export function LibraryStatsPanel() {
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await invoke<LibraryStats>('test_library_stats');
      setStats(result);
    } catch (err) {
      console.error('加载库统计失败:', err);
      setError(`加载失败: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 格式化时长
  const formatDuration = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    if (days > 0) {
      return `${days}天 ${remainingHours}小时`;
    }
    if (hours > 0) {
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}小时 ${minutes}分钟`;
    }
    const minutes = Math.floor(ms / (1000 * 60));
    return `${minutes}分钟`;
  };

  // 格式化文件大小
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 
                    rounded-xl shadow-lg p-6 border border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="text-blue-600 dark:text-blue-400" size={24} />
          音乐库统计
        </h3>
        
        <button
          onClick={loadStats}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white 
                   rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>加载中...</span>
            </>
          ) : (
            <>
              <TrendingUp size={18} />
              <span>刷新统计</span>
            </>
          )}
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
                      rounded-lg p-4 mb-4">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* 统计数据 */}
      {stats ? (
        <div className="space-y-6">
          {/* 基础统计 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* 曲目总数 */}
            <div className="bg-white dark:bg-dark-800 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600 dark:text-dark-400">曲目总数</span>
                <Music size={18} className="text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.total_tracks.toLocaleString()}
              </div>
            </div>

            {/* 专辑总数 */}
            <div className="bg-white dark:bg-dark-800 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600 dark:text-dark-400">专辑总数</span>
                <Album size={18} className="text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.total_albums.toLocaleString()}
              </div>
            </div>

            {/* 艺术家总数 */}
            <div className="bg-white dark:bg-dark-800 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600 dark:text-dark-400">艺术家</span>
                <User size={18} className="text-green-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.total_artists.toLocaleString()}
              </div>
            </div>

            {/* 总时长 */}
            <div className="bg-white dark:bg-dark-800 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600 dark:text-dark-400">总时长</span>
                <Clock size={18} className="text-orange-500" />
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {formatDuration(stats.total_duration_ms)}
              </div>
            </div>

            {/* 平均码率 */}
            <div className="bg-white dark:bg-dark-800 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600 dark:text-dark-400">平均码率</span>
                <TrendingUp size={18} className="text-cyan-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.avg_bitrate.toFixed(0)} kbps
              </div>
            </div>

            {/* 总大小 */}
            <div className="bg-white dark:bg-dark-800 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600 dark:text-dark-400">总大小</span>
                <Music size={18} className="text-pink-500" />
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {formatBytes(stats.total_size_bytes)}
              </div>
            </div>
          </div>

          {/* 洞察分析 */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 
                        border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
            <h4 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-3 flex items-center gap-2">
              <TrendingUp size={18} />
              库洞察分析
            </h4>
            <ul className="space-y-2 text-sm text-indigo-800 dark:text-indigo-200">
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">•</span>
                <span>
                  平均每张专辑包含 <strong>{(stats.total_tracks / stats.total_albums).toFixed(1)}</strong> 首曲目
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">•</span>
                <span>
                  平均每位艺术家有 <strong>{(stats.total_albums / stats.total_artists).toFixed(1)}</strong> 张专辑
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">•</span>
                <span>
                  平均每首曲目大小约 <strong>{formatBytes(stats.total_size_bytes / stats.total_tracks)}</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">•</span>
                <span>
                  连续播放所有音乐需要 <strong>{formatDuration(stats.total_duration_ms)}</strong>
                </span>
              </li>
              {stats.avg_bitrate >= 320 && (
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span className="text-green-700 dark:text-green-300">
                    音质优秀 - 平均码率达到高品质标准
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <TrendingUp size={48} className="mx-auto mb-4 text-slate-300 dark:text-dark-600" />
          <p className="text-slate-500 dark:text-dark-600 mb-4">
            点击"刷新统计"按钮查看音乐库详细信息
          </p>
        </div>
      )}
    </div>
  );
}












