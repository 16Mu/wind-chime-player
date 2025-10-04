/**
 * 歌单列表视图 - 容器组件
 * 
 * 设计原则：
 * - 职责：协调PlaylistCard和Context
 * - 包含：布局、筛选、排序逻辑
 * - 不包含：具体展示细节（委托给PlaylistCard）
 */

import React, { useState, useMemo } from 'react';
import { usePlaylist } from '../../contexts/PlaylistContext';
import { PlaylistCard } from './PlaylistCard';
import { Plus, Grid, List, Search, Filter, Sparkles, Heart, Upload, Music } from 'lucide-react';

type ViewMode = 'grid' | 'list';
type SortBy = 'created' | 'name' | 'count' | 'played';
type FilterBy = 'all' | 'smart' | 'favorite' | 'regular';

interface PlaylistsViewProps {
  onCreateClick?: () => void;
  onPlaylistClick?: (playlistId: number) => void;
}

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({
  onCreateClick,
  onPlaylistClick,
}) => {
  const {
    playlists,
    stats,
    loading,
    error,
    toggleFavorite,
    importPlaylist,
  } = usePlaylist();

  // 视图状态
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('created');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [importing, setImporting] = useState(false);

  // 筛选和排序
  const filteredAndSortedPlaylists = useMemo(() => {
    let result = [...playlists];

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
      );
    }

    // 类型过滤
    switch (filterBy) {
      case 'smart':
        result = result.filter((p) => p.is_smart);
        break;
      case 'favorite':
        result = result.filter((p) => p.is_favorite);
        break;
      case 'regular':
        result = result.filter((p) => !p.is_smart);
        break;
    }

    // 排序 - 置顶歌单始终在前
    result.sort((a, b) => {
      // 先按置顶状态排序
      if (a.is_pinned !== b.is_pinned) {
        return a.is_pinned ? -1 : 1;
      }
      
      // 然后按选定的排序方式
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name, 'zh-CN');
        case 'count':
          return b.track_count - a.track_count;
        case 'played':
          return b.play_count - a.play_count;
        case 'created':
        default:
          return b.created_at - a.created_at;
      }
    });

    return result;
  }, [playlists, searchQuery, filterBy, sortBy]);

  // 处理导入歌单
  const handleImport = async () => {
    try {
      setImporting(true);
      const { open } = await import('@tauri-apps/plugin-dialog');
      const filePath = await open({
        multiple: false,
        filters: [{
          name: '歌单文件',
          extensions: ['m3u', 'm3u8', 'pls', 'json'],
        }],
      });

      if (filePath && typeof filePath === 'string') {
        await importPlaylist(filePath);
        alert('导入成功！');
      }
    } catch (err) {
      alert('导入失败：' + err);
    } finally {
      setImporting(false);
    }
  };

  // 处理收藏切换
  const handleFavoriteToggle = async (playlistId: number) => {
    try {
      await toggleFavorite(playlistId);
    } catch (err) {
      console.error('切换收藏失败:', err);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* 头部 */}
      <div className="flex-none p-6 space-y-4 bg-gradient-to-b from-white/80 to-transparent dark:from-gray-800/50 dark:to-transparent backdrop-blur-sm">
        {/* 标题和创建按钮 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">我的歌单</h1>
            {stats && (
              <p className="text-slate-600 dark:text-gray-400 text-sm">
                共 {stats.total_playlists} 个歌单 · {stats.total_tracks_in_playlists} 首曲目
              </p>
            )}
          </div>
          
          <div className="flex gap-2">
            {onCreateClick && (
              <button
                onClick={onCreateClick}
                className="flex items-center gap-2 px-4 py-2.5 
                  bg-gradient-to-r from-purple-500 to-pink-500 
                  hover:from-purple-600 hover:to-pink-600
                  text-white rounded-lg font-medium
                  transition-all duration-200 shadow-lg hover:shadow-xl
                  hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                <span>创建歌单</span>
              </button>
            )}
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 px-4 py-2.5 
                bg-white dark:bg-gray-800 
                hover:bg-slate-50 dark:hover:bg-gray-700
                text-slate-700 dark:text-gray-300
                border border-slate-200 dark:border-gray-700
                rounded-lg font-medium
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-5 h-5" />
              <span>{importing ? '导入中...' : '导入歌单'}</span>
            </button>
          </div>
        </div>

        {/* 工具栏 */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* 搜索 */}
          <div className="flex-1 min-w-[200px] max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-gray-500" />
            <input
              type="text"
              placeholder="搜索歌单..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800/50 border border-slate-300 dark:border-gray-700 
                rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500
                transition-all"
            />
          </div>

          {/* 筛选 */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500 dark:text-gray-500" />
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as FilterBy)}
              className="px-3 py-2 bg-white dark:bg-gray-800/50 border border-slate-300 dark:border-gray-700 rounded-lg 
                text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              <option value="all">全部</option>
              <option value="regular">普通歌单</option>
              <option value="smart">智能歌单</option>
              <option value="favorite">收藏</option>
            </select>
          </div>

          {/* 排序 */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2 bg-white dark:bg-gray-800/50 border border-slate-300 dark:border-gray-700 rounded-lg 
              text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="created">创建时间</option>
            <option value="name">名称</option>
            <option value="count">曲目数</option>
            <option value="played">播放次数</option>
          </select>

          {/* 视图切换 */}
          <div className="flex items-center gap-1 bg-white dark:bg-gray-800/50 border border-slate-300 dark:border-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-purple-500 text-white'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-purple-500 text-white'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 统计标签 */}
        {stats && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-slate-600 dark:text-gray-400">
              <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400" />
              <span>{stats.total_smart_playlists} 个智能歌单</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-gray-400">
              <Heart className="w-4 h-4 text-red-500 dark:text-red-400" />
              <span>{stats.total_favorite_playlists} 个收藏</span>
            </div>
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-6 mb-4 p-4 bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto px-6 pb-28">
        {loading && playlists.length === 0 ? (
          // 加载骨架屏
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
            : 'space-y-2'
          }>
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800/50 rounded-xl overflow-hidden animate-pulse border border-slate-200 dark:border-gray-700"
              >
                <div className="aspect-square bg-slate-200 dark:bg-gray-700/50" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-slate-200 dark:bg-gray-700/50 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 dark:bg-gray-700/50 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredAndSortedPlaylists.length === 0 ? (
          // 空状态
          <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-gray-500">
            <Music className="w-20 h-20 mb-4 text-slate-400 dark:text-gray-600" />
            <p className="text-lg mb-2">
              {searchQuery || filterBy !== 'all' ? '没有找到匹配的歌单' : '还没有歌单'}
            </p>
            <p className="text-sm text-slate-600 dark:text-gray-600 mb-4">
              {searchQuery || filterBy !== 'all' ? '试试其他搜索条件' : '创建第一个歌单开始整理音乐'}
            </p>
            {!searchQuery && filterBy === 'all' && onCreateClick && (
              <button
                onClick={onCreateClick}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 
                  text-white rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>创建歌单</span>
              </button>
            )}
          </div>
        ) : (
          // 歌单列表
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                : 'space-y-2'
            }
          >
            {filteredAndSortedPlaylists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                onClick={() => onPlaylistClick?.(playlist.id)}
                onFavoriteToggle={() => handleFavoriteToggle(playlist.id)}
                className={viewMode === 'list' ? 'flex-row items-center' : ''}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

