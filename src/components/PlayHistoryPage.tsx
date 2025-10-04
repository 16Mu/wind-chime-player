/**
 * 播放记录页面 - 播放历史统计与分析
 * 
 * 功能：
 * - 显示播放统计信息（总播放次数、曲目数、总时长）
 * - 显示播放历史列表（支持排序）
 * - 清空历史、删除单条记录
 * 
 * 设计：遵循音乐库的视觉风格
 */

import React from 'react';
import { usePlayHistory } from '../contexts/PlayHistoryContext';
import { Clock, TrendingUp, Music, Trash2, RefreshCw } from 'lucide-react';

export default function PlayHistoryPage() {
  const {
    history,
    statistics,
    loading,
    sortBy,
    setSortBy,
    clearHistory,
    removeFromHistory,
    lastUpdateTime,
    refresh,
  } = usePlayHistory();

  // 强制重新渲染以更新相对时间显示
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 10000); // 每10秒更新一次显示
    return () => clearInterval(timer);
  }, []);

  // 格式化时长
  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}小时${minutes}分钟`;
    return `${minutes}分钟`;
  };

  // 格式化日期
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 格式化更新时间（相对时间）
  const formatUpdateTime = (timestamp: number | null) => {
    if (!timestamp) return '未更新';
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 5000) return '刚刚更新';
    if (diff < 60000) return `${Math.floor(diff / 1000)}秒前`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* 统计卡片 - 仿照音乐库风格 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-4 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-dark-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 dark:text-dark-700 mb-1">总播放次数</div>
              <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                {statistics?.total_plays || 0}
              </div>
            </div>
            <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/30 rounded-xl flex items-center justify-center">
              <Music className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            </div>
          </div>
        </div>

        <div className="glass-card p-4 bg-gradient-to-br from-violet-50 to-white dark:from-violet-900/20 dark:to-dark-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 dark:text-dark-700 mb-1">不同曲目</div>
              <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                {statistics?.unique_tracks || 0}
              </div>
            </div>
            <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
        </div>

        <div className="glass-card p-4 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-dark-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 dark:text-dark-700 mb-1">总播放时长</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatDuration(statistics?.total_duration_ms || 0)}
              </div>
            </div>
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>
      </div>

      {/* 工具栏 - 仿照音乐库风格 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('last_played')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                sortBy === 'last_played'
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-white dark:bg-dark-100 border border-slate-200 dark:border-dark-400 text-slate-700 dark:text-dark-800 hover:bg-slate-50 dark:hover:bg-dark-200'
              }`}
            >
              最近播放
            </button>
            <button
              onClick={() => setSortBy('play_count')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                sortBy === 'play_count'
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-white dark:bg-dark-100 border border-slate-200 dark:border-dark-400 text-slate-700 dark:text-dark-800 hover:bg-slate-50 dark:hover:bg-dark-200'
              }`}
            >
              播放次数
            </button>
            <button
              onClick={() => setSortBy('first_played')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                sortBy === 'first_played'
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-white dark:bg-dark-100 border border-slate-200 dark:border-dark-400 text-slate-700 dark:text-dark-800 hover:bg-slate-50 dark:hover:bg-dark-200'
              }`}
            >
              首次播放
            </button>
          </div>

          {/* 更新时间显示 */}
          <div className="text-sm text-slate-500 dark:text-dark-700 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>{formatUpdateTime(lastUpdateTime)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-white dark:bg-dark-100 border border-slate-200 dark:border-dark-400 text-slate-700 dark:text-dark-800 font-medium transition-colors hover:bg-slate-50 dark:hover:bg-dark-200 flex items-center gap-2 disabled:opacity-50"
            title="刷新数据"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button
            onClick={clearHistory}
            className="px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 font-medium transition-colors flex items-center gap-2 border border-red-200 dark:border-red-900/30"
          >
            <Trash2 className="w-4 h-4" />
            清空历史
          </button>
        </div>
      </div>

      {/* 历史列表 - 仿照音乐库表格风格 */}
      <div className="flex-1 glass-card p-6 overflow-hidden">
        <div className="h-full overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-4">
                <div className="ring-loader" style={{ width: '48px', height: '48px', borderWidth: '4px' }}></div>
                <p className="text-slate-600 dark:text-dark-700 font-medium flex items-center gap-2">
                  加载中
                  <span className="loading-dots" style={{ fontSize: '6px' }}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                </p>
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="mb-6 flex justify-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center shadow-lg">
                    <Music className="w-10 h-10 text-slate-400 dark:text-dark-700" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-dark-900 mb-3">暂无播放记录</h3>
                <p className="text-slate-600 dark:text-dark-700 mb-6 text-base font-medium">
                  开始播放音乐后，播放记录会显示在这里
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 dark:text-dark-800 tracking-wider">
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <svg className="w-3.5 h-3.5 text-slate-500 dark:text-dark-600 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <span className="tracking-wide">曲目</span>
                    </span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 dark:text-dark-800 tracking-wider">
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <svg className="w-3.5 h-3.5 text-slate-500 dark:text-dark-600 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="tracking-wide">艺术家</span>
                    </span>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-900 dark:text-dark-800 tracking-wider">
                    <span className="flex items-center justify-center gap-2 whitespace-nowrap">
                      <svg className="w-3.5 h-3.5 text-slate-500 dark:text-dark-600 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <span className="tracking-wide">播放次数</span>
                    </span>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-900 dark:text-dark-800 tracking-wider">
                    <span className="flex items-center justify-center gap-2 whitespace-nowrap">
                      <svg className="w-3.5 h-3.5 text-slate-500 dark:text-dark-600 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="tracking-wide">最后播放</span>
                    </span>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-900 dark:text-dark-800 tracking-wider w-20">
                    <span className="tracking-wide">操作</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr
                    key={entry.track.id}
                    className="border-b border-slate-100 dark:border-white/10 hover:bg-gradient-to-r hover:from-brand-50/30 hover:to-transparent dark:hover:from-brand-900/10 dark:hover:to-transparent transition-all duration-200 cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-dark-900">
                        {entry.track.title || '未知曲目'}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-dark-700">
                        {entry.track.album || '未知专辑'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-dark-800">
                      {entry.track.artist || '未知艺术家'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-sm font-medium">
                        {entry.play_count} 次
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-slate-600 dark:text-dark-700">
                      {formatDate(entry.last_played_at)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromHistory(entry.track.id);
                        }}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-500 dark:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="从历史中移除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
