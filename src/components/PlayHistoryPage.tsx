/**
 * 播放记录页面 - 精简列表风格
 * 
 * 功能：
 * - 统计概览（总播放次数、曲目数、总时长）
 * - 今日常听（紧凑卡片展示）
 * - 最常播放 Top 10 榜单（列表式）
 * - 完整历史记录（时间分组列表）
 * 
 * 设计：参考 Apple Music、Spotify 的紧凑列表风格
 */

import React, { useMemo } from 'react';
import { usePlayHistory } from '../contexts/PlayHistoryContext';
import { useAlbumCovers } from '../hooks/useAlbumCovers';
import { Clock, Music, Trash2, RefreshCw, Play, BarChart2, Headphones } from 'lucide-react';

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

  // 统计卡片展开/收起状态
  const [isStatsExpanded, setIsStatsExpanded] = React.useState(true);

  // ========== 封面加载 ==========
  
  // 提取所有曲目用于加载封面
  const tracks = useMemo(() => {
    return history.map(entry => entry.track);
  }, [history]);

  // 使用 Hook 加载封面（带懒加载和缓存）
  const { albumCoverUrls } = useAlbumCovers(tracks);

  // ========== 数据处理 ==========

  // 今日常听（最近24小时）
  const todayPlays = useMemo(() => {
    const now = Date.now() / 1000;
    const oneDayAgo = now - 24 * 60 * 60;
    return history.filter(entry => entry.last_played_at >= oneDayAgo).slice(0, 6);
  }, [history]);

  // 最常播放 Top 10
  const topTracks = useMemo(() => {
    return [...history]
      .sort((a, b) => b.play_count - a.play_count)
      .slice(0, 10);
  }, [history]);

  // 按时间分组的历史记录
  const groupedHistory = useMemo(() => {
    const groups: { [key: string]: typeof history } = {
      今天: [],
      昨天: [],
      本周: [],
      更早: [],
    };

    const now = Date.now() / 1000;
    const oneDayAgo = now - 24 * 60 * 60;
    const twoDaysAgo = now - 2 * 24 * 60 * 60;
    const oneWeekAgo = now - 7 * 24 * 60 * 60;

    history.forEach(entry => {
      if (entry.last_played_at >= oneDayAgo) {
        groups['今天'].push(entry);
      } else if (entry.last_played_at >= twoDaysAgo) {
        groups['昨天'].push(entry);
      } else if (entry.last_played_at >= oneWeekAgo) {
        groups['本周'].push(entry);
      } else {
        groups['更早'].push(entry);
      }
    });

    return groups;
  }, [history]);

  // ========== 格式化函数 ==========

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}小时${minutes}分钟`;
    return `${minutes}分钟`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    if (diff < 172800) return '昨天';
    if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
    return formatDate(timestamp);
  };

  // ========== 渲染 ==========

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
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
    );
  }

  return (
    <div className="min-h-full relative">
      {/* ========== 右侧可折叠悬浮统计卡片 - 流畅缓动动画 ========== */}
      <div 
        className="fixed top-20 right-0 z-10 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          transform: isStatsExpanded ? 'translateX(0)' : 'translateX(calc(100% - 2.5rem))',
        }}
      >
        <div 
          className="relative glass-card bg-white/80 dark:bg-dark-100/80 backdrop-blur-xl shadow-lg border border-slate-200/50 dark:border-white/10 overflow-hidden"
          style={{
            width: isStatsExpanded ? '12rem' : '2.5rem',
            height: isStatsExpanded ? 'auto' : '5rem',
            borderRadius: isStatsExpanded ? '0.75rem' : '9999px 0 0 9999px',
            marginRight: isStatsExpanded ? '1.5rem' : '0',
            borderRight: isStatsExpanded ? undefined : 'none',
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* 收起状态：半圆形按钮内容 */}
          <button
            onClick={() => setIsStatsExpanded(true)}
            className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
              isStatsExpanded ? 'opacity-0 pointer-events-none scale-50' : 'opacity-100 pointer-events-auto scale-100'
            }`}
            style={{
              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            title="查看统计"
          >
            <BarChart2 className="w-5 h-5 text-brand-600 dark:text-brand-400 -ml-1" />
          </button>

          {/* 展开状态：完整卡片内容 */}
          <div 
            className={`p-4 transition-all duration-500 ${
              isStatsExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
            }`}
            style={{
              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
              transitionDelay: isStatsExpanded ? '0.15s' : '0s',
            }}
          >
            {/* 标题 + 收起按钮 */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">统计概览</h3>
              </div>
              <button
                onClick={() => setIsStatsExpanded(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-dark-200 rounded transition-all duration-200"
                title="收起"
              >
                <svg className="w-3.5 h-3.5 text-slate-600 dark:text-dark-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* 统计数据 */}
            <div className="space-y-3">
              {/* 播放次数 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Headphones className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span className="text-xs text-slate-600 dark:text-dark-700">播放</span>
                </div>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {statistics?.total_plays || 0}
                </span>
              </div>

              {/* 曲目数 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Music className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  <span className="text-xs text-slate-600 dark:text-dark-700">曲目</span>
                </div>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {statistics?.unique_tracks || 0}
                </span>
              </div>

              {/* 时长 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs text-slate-600 dark:text-dark-700">时长</span>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatDuration(statistics?.total_duration_ms || 0)}
                </span>
              </div>
            </div>

            {/* 分隔线 */}
            <div className="my-3 border-t border-slate-200 dark:border-white/10"></div>

            {/* 更新时间 */}
            <div className="text-[10px] text-slate-500 dark:text-dark-700 text-center mb-3">
              {formatUpdateTime(lastUpdateTime)}
            </div>

            {/* 操作按钮 */}
            <div className="space-y-2">
              <button
                onClick={refresh}
                disabled={loading}
                className="w-full px-3 py-1.5 text-xs rounded-lg glass-card hover:bg-slate-50 dark:hover:bg-dark-200 text-slate-700 dark:text-dark-800 transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>刷新</span>
              </button>
              
              <button
                onClick={clearHistory}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-all duration-200 flex items-center justify-center gap-1.5 border border-red-200 dark:border-red-900/30"
              >
                <Trash2 className="w-3 h-3" />
                <span>清空历史</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 - 流畅的padding和transform过渡动画 */}
      <div 
        className="max-w-7xl mx-auto pb-8 relative"
        style={{
          paddingRight: isStatsExpanded ? '14rem' : '0',
          transition: 'padding-right 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* 内容包裹层 - 添加统一缓动过渡 */}
        <div
          className="transition-all duration-500"
          style={{
            transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {history.length === 0 ? (
            /* ========== 空状态 ========== */
            <div className="glass-card p-12 text-center transition-all duration-500" style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            <div className="mb-6 flex justify-center">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center shadow-lg">
                <Music className="w-12 h-12 text-slate-400 dark:text-dark-700" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-dark-900 mb-3">暂无播放记录</h3>
            <p className="text-slate-600 dark:text-dark-700 text-lg font-medium">
              开始播放音乐后，播放记录会显示在这里
            </p>
          </div>
        ) : (
          <>
            {/* ========== 今日常听 - 现代简约设计 ========== */}
            {todayPlays.length > 0 && (
              <div className="mb-8 transition-all duration-500" style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                <div className="flex items-baseline justify-between mb-4">
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">最近播放</h2>
                    <span className="text-xs text-slate-400 dark:text-dark-700">24小时内</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {todayPlays.map((entry) => {
                    const coverUrl = albumCoverUrls[entry.track.id];
                    
                    return (
                      <div
                        key={entry.track.id}
                        className="group cursor-pointer"
                      >
                        <div className="flex gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-dark-200/30 transition-colors">
                          {/* 封面 */}
                          <div className="w-14 h-14 bg-slate-200 dark:bg-slate-800 rounded flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                            {coverUrl ? (
                              <img 
                                src={coverUrl} 
                                alt={`${entry.track.album || '未知专辑'} 封面`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Music className="w-5 h-5 text-slate-400" />
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Play className="w-5 h-5 text-white" fill="currentColor" />
                            </div>
                          </div>

                          {/* 信息 */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-slate-900 dark:text-white truncate">
                              {entry.track.title || '未知曲目'}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-dark-700 truncate mt-0.5">
                              {entry.track.artist || '未知艺术家'}
                            </div>
                            <div className="text-xs text-slate-400 dark:text-dark-700 mt-1">
                              {entry.play_count}次 · {formatRelativeTime(entry.last_played_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ========== 最常播放 - 现代简约列表 ========== */}
            {topTracks.length > 0 && (
              <div className="mb-8 transition-all duration-500" style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">常听榜单</h2>
                </div>

                <div className="space-y-0.5">
                  {topTracks.map((entry, index) => {
                    const coverUrl = albumCoverUrls[entry.track.id];
                    
                    return (
                      <div
                        key={entry.track.id}
                        className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-dark-200/30 rounded-lg transition-colors cursor-pointer group"
                      >
                        {/* 排名 */}
                        <div className="w-6 flex items-center justify-center font-medium text-sm text-slate-400 dark:text-dark-700 flex-shrink-0">
                          {index + 1}
                        </div>

                        {/* 封面 */}
                        <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                          {coverUrl ? (
                            <img 
                              src={coverUrl} 
                              alt={`${entry.track.album || '未知专辑'} 封面`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Music className="w-4 h-4 text-slate-400" />
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="w-4 h-4 text-white" fill="currentColor" />
                          </div>
                        </div>

                        {/* 曲目信息 */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-slate-900 dark:text-white truncate">
                            {entry.track.title || '未知曲目'}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-dark-700 truncate mt-0.5">
                            {entry.track.artist || '未知艺术家'}
                          </div>
                        </div>

                        {/* 播放次数 */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-sm text-slate-600 dark:text-dark-700 font-medium">
                            {entry.play_count} 次
                          </span>

                          {/* 删除按钮 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromHistory(entry.track.id);
                            }}
                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-dark-300 rounded-md text-slate-400 hover:text-slate-600 dark:text-dark-700 dark:hover:text-dark-800 transition-all opacity-0 group-hover:opacity-100"
                            title="移除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ========== 完整历史 - 现代简约设计 ========== */}
            <div className="transition-all duration-500" style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">播放历史</h2>
                
                {/* 排序选项 */}
                <div className="flex gap-1">
                  <button
                    onClick={() => setSortBy('last_played')}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                      sortBy === 'last_played'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'text-slate-500 dark:text-dark-700 hover:bg-slate-100 dark:hover:bg-dark-200'
                    }`}
                  >
                    最近
                  </button>
                  <button
                    onClick={() => setSortBy('play_count')}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                      sortBy === 'play_count'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'text-slate-500 dark:text-dark-700 hover:bg-slate-100 dark:hover:bg-dark-200'
                    }`}
                  >
                    次数
                  </button>
                  <button
                    onClick={() => setSortBy('first_played')}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                      sortBy === 'first_played'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'text-slate-500 dark:text-dark-700 hover:bg-slate-100 dark:hover:bg-dark-200'
                    }`}
                  >
                    首次
                  </button>
                </div>
              </div>

              {/* 按时间分组显示 - 极简列表 */}
              {sortBy === 'last_played' && (
                <>
                  {Object.entries(groupedHistory).map(([timeGroup, entries]) => {
                    if (entries.length === 0) return null;
                    
                    return (
                      <div key={timeGroup} className="mb-6">
                        {/* 时间分组标签 */}
                        <div className="text-xs font-semibold text-slate-400 dark:text-dark-700 mb-2 px-1">
                          {timeGroup}
                        </div>

                        {/* 紧凑列表 */}
                        <div className="space-y-0.5">
                          {entries.map((entry) => {
                            const coverUrl = albumCoverUrls[entry.track.id];
                            
                            return (
                              <div
                                key={entry.track.id}
                                className="flex items-center gap-4 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-dark-200/30 rounded-lg transition-colors cursor-pointer group"
                              >
                                {/* 封面 */}
                                <div className="w-11 h-11 bg-slate-200 dark:bg-slate-800 rounded flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                                  {coverUrl ? (
                                    <img 
                                      src={coverUrl} 
                                      alt={`${entry.track.album || '未知专辑'} 封面`}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Music className="w-4 h-4 text-slate-400" />
                                  )}
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Play className="w-4 h-4 text-white" fill="currentColor" />
                                  </div>
                                </div>

                                {/* 信息 */}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm text-slate-900 dark:text-white truncate">
                                    {entry.track.title || '未知曲目'}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-dark-700 truncate mt-0.5">
                                    {entry.track.artist || '未知艺术家'}
                                  </div>
                                </div>

                                {/* 播放信息 */}
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <span className="text-xs text-slate-400 dark:text-dark-700 hidden sm:block">
                                    {entry.play_count} 次 · {formatRelativeTime(entry.last_played_at)}
                                  </span>

                                  {/* 删除按钮 */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeFromHistory(entry.track.id);
                                    }}
                                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-dark-300 rounded-md text-slate-400 hover:text-slate-600 dark:text-dark-700 dark:hover:text-dark-800 transition-all opacity-0 group-hover:opacity-100"
                                    title="移除"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* 非时间排序时显示简单列表 */}
              {sortBy !== 'last_played' && (
                <div className="space-y-0.5">
                  {history.map((entry) => {
                    const coverUrl = albumCoverUrls[entry.track.id];
                    
                    return (
                      <div
                        key={entry.track.id}
                        className="flex items-center gap-4 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-dark-200/30 rounded-lg transition-colors cursor-pointer group"
                      >
                        {/* 封面 */}
                        <div className="w-11 h-11 bg-slate-200 dark:bg-slate-800 rounded flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                          {coverUrl ? (
                            <img 
                              src={coverUrl} 
                              alt={`${entry.track.album || '未知专辑'} 封面`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Music className="w-4 h-4 text-slate-400" />
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="w-4 h-4 text-white" fill="currentColor" />
                          </div>
                        </div>

                        {/* 信息 */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-slate-900 dark:text-white truncate">
                            {entry.track.title || '未知曲目'}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-dark-700 truncate mt-0.5">
                            {entry.track.artist || '未知艺术家'}
                          </div>
                        </div>

                        {/* 播放信息 */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-xs text-slate-400 dark:text-dark-700 hidden sm:block">
                            {entry.play_count} 次 · {formatRelativeTime(entry.last_played_at)}
                          </span>

                          {/* 删除按钮 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromHistory(entry.track.id);
                            }}
                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-dark-300 rounded-md text-slate-400 hover:text-slate-600 dark:text-dark-700 dark:hover:text-dark-800 transition-all opacity-0 group-hover:opacity-100"
                            title="移除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}