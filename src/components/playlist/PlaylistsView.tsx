/**
 * 歌单列表视图 - 容器组件
 * 
 * 设计原则：
 * - 职责：协调PlaylistCard和Context
 * - 包含：布局、筛选、排序逻辑
 * - 不包含：具体展示细节（委托给PlaylistCard）
 */

import React, { useState, useMemo } from 'react';
import { usePlaylist, Playlist } from '../../contexts/PlaylistContext';
import { PlaylistCard } from './PlaylistCard';
import { usePlaylistCover } from '../../hooks/usePlaylistCover';
import { Plus, Grid, List, Search, Sparkles, Heart, Upload, Music, Pin, TrendingUp, Clock } from 'lucide-react';

type ViewMode = 'grid' | 'list';
type SortBy = 'created' | 'name' | 'count' | 'played';
type FilterBy = 'all' | 'smart' | 'favorite' | 'regular';

interface PlaylistsViewProps {
  onCreateClick?: () => void;
  onCreateSmartClick?: () => void;
  onPlaylistClick?: (playlistId: number) => void;
}

// 列表视图项组件 - 需要单独组件以使用 Hook
interface PlaylistListItemProps {
  playlist: Playlist;
  onClick?: () => void;
  onFavoriteToggle: (id: number) => void;
}

const PlaylistListItem: React.FC<PlaylistListItemProps> = ({ playlist, onClick, onFavoriteToggle }) => {
  const coverImage = usePlaylistCover(playlist.id, playlist.cover_path, playlist.track_count);

  return (
    <div
      onClick={onClick}
      className="group relative bg-white dark:bg-gray-800/60 backdrop-blur-sm
               rounded-lg p-4 cursor-pointer
               border border-slate-200/60 dark:border-gray-700/40
               hover:border-purple-300 dark:hover:border-purple-500/50
               hover:bg-slate-50 dark:hover:bg-gray-800/80
               hover:shadow-lg hover:shadow-purple-500/10
               transition-all duration-200 hover:scale-[1.01]"
    >
      <div className="flex items-center gap-4">
        {/* 封面 */}
        <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden
                      bg-slate-100 dark:bg-gray-700/50">
          {coverImage ? (
            <img 
              src={coverImage} 
              alt={playlist.name} 
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {playlist.is_smart ? (
                <Sparkles className="w-8 h-8 text-purple-400 dark:text-purple-400/60" />
              ) : (
                <Music className="w-8 h-8 text-purple-300 dark:text-purple-400/40" />
              )}
            </div>
          )}
          
          {/* 悬停播放按钮 */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 
                        flex items-center justify-center">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center
                          opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100
                          transition-all duration-200 shadow-lg">
              <svg className="w-5 h-5 text-purple-600 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            </div>
          </div>
        </div>
        
        {/* 信息区域 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-slate-900 dark:text-white font-semibold text-base truncate
                         group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              {playlist.name}
            </h3>
            
            {/* 标签 */}
            {playlist.is_pinned && (
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-500/20 
                            flex items-center justify-center">
                <Pin className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              </div>
            )}
            {playlist.is_smart && (
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-500/20 
                            flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              </div>
            )}
          </div>
          
          {playlist.description && (
            <p className="text-slate-600 dark:text-gray-400 text-sm line-clamp-1 mb-2">
              {playlist.description}
            </p>
          )}
          
          {/* 统计信息 */}
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-gray-500">
            <span className="flex items-center gap-1.5">
              <Music className="w-4 h-4" />
              {playlist.track_count} 首歌曲
            </span>
            {playlist.play_count > 0 && (
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                播放 {playlist.play_count} 次
              </span>
            )}
            {playlist.total_duration_ms > 0 && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {Math.floor(playlist.total_duration_ms / 60000)} 分钟
              </span>
            )}
          </div>
        </div>
        
        {/* 右侧操作区 */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* 收藏按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteToggle(playlist.id);
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center
                     bg-slate-100 dark:bg-gray-700/50
                     hover:bg-slate-200 dark:hover:bg-gray-700
                     opacity-0 group-hover:opacity-100 transition-all duration-200
                     hover:scale-110"
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                playlist.is_favorite 
                  ? 'fill-red-500 text-red-500' 
                  : 'text-slate-600 dark:text-gray-400'
              }`}
            />
          </button>
          
          {/* 箭头 */}
          <svg className="w-5 h-5 text-slate-400 dark:text-gray-600 
                       group-hover:text-purple-500 dark:group-hover:text-purple-400
                       transition-colors" 
               fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
      
      {/* 底部主题色装饰 */}
      {playlist.color_theme && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5"
             style={{ backgroundColor: playlist.color_theme }} />
      )}
    </div>
  );
};

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({
  onCreateClick,
  onCreateSmartClick,
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

  // 分组歌单：置顶、智能、普通
  const groupedPlaylists = useMemo(() => {
    const pinned = filteredAndSortedPlaylists.filter(p => p.is_pinned || p.is_favorite);
    const smart = filteredAndSortedPlaylists.filter(p => !p.is_pinned && !p.is_favorite && p.is_smart);
    const regular = filteredAndSortedPlaylists.filter(p => !p.is_pinned && !p.is_favorite && !p.is_smart);
    
    return { pinned, smart, regular };
  }, [filteredAndSortedPlaylists]);

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
              <>
                <button
                  onClick={onCreateClick}
                  className="flex items-center gap-1.5 px-3 py-2 
                    bg-slate-900 dark:bg-gray-800
                    hover:bg-slate-800 dark:hover:bg-gray-700
                    text-white text-sm rounded-lg
                    transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>创建歌单</span>
                </button>
                <button
                  onClick={onCreateSmartClick}
                  className="flex items-center gap-1.5 px-3 py-2 
                    border border-slate-300 dark:border-gray-600
                    hover:bg-slate-50 dark:hover:bg-gray-800
                    text-slate-700 dark:text-gray-300 text-sm rounded-lg
                    transition-colors"
                  title="根据规则自动筛选曲目"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>智能歌单</span>
                </button>
              </>
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
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as FilterBy)}
            className="px-3 py-1.5 bg-white dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 rounded-lg 
              text-slate-700 dark:text-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-gray-600"
          >
            <option value="all">全部歌单</option>
            <option value="regular">普通歌单</option>
            <option value="smart">智能歌单</option>
            <option value="favorite">收藏</option>
          </select>

          {/* 排序 */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-1.5 bg-white dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 rounded-lg 
              text-slate-700 dark:text-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-gray-600"
          >
            <option value="created">创建时间</option>
            <option value="name">名称</option>
            <option value="count">曲目数</option>
            <option value="played">播放次数</option>
          </select>

          {/* 视图切换 */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-gray-800/50 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300'
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

      {/* 内容区域 - 混合视图布局 */}
      <div className="flex-1 overflow-y-auto px-6 pb-28">
        {loading && playlists.length === 0 ? (
          // 加载骨架屏
          <div className="space-y-8">
            {/* 置顶区域骨架 */}
            <div>
              <div className="h-6 bg-slate-200 dark:bg-gray-700/50 rounded w-32 mb-4 animate-pulse" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800/50 rounded-xl p-6 animate-pulse border border-slate-200 dark:border-gray-700">
                    <div className="flex items-start gap-4">
                      <div className="w-20 h-20 bg-slate-200 dark:bg-gray-700/50 rounded-lg" />
                      <div className="flex-1 space-y-3">
                        <div className="h-5 bg-slate-200 dark:bg-gray-700/50 rounded w-3/4" />
                        <div className="h-4 bg-slate-200 dark:bg-gray-700/50 rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* 网格区域骨架 */}
            <div>
              <div className="h-6 bg-slate-200 dark:bg-gray-700/50 rounded w-32 mb-4 animate-pulse" />
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800/50 rounded-lg overflow-hidden animate-pulse border border-slate-200 dark:border-gray-700">
                <div className="aspect-square bg-slate-200 dark:bg-gray-700/50" />
                    <div className="p-3 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-gray-700/50 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 dark:bg-gray-700/50 rounded w-1/2" />
                </div>
              </div>
            ))}
              </div>
            </div>
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
            {!searchQuery && filterBy === 'all' && (
              <div className="flex gap-3">
                {onCreateClick && (
                  <button
                    onClick={onCreateClick}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-gray-800
                      hover:bg-slate-800 dark:hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    <span>创建歌单</span>
                  </button>
                )}
                {onCreateSmartClick && (
                  <button
                    onClick={onCreateSmartClick}
                    className="flex items-center gap-2 px-5 py-2.5 
                      border border-slate-300 dark:border-gray-600
                      hover:bg-slate-50 dark:hover:bg-gray-800
                      text-slate-700 dark:text-gray-300 rounded-lg transition-colors"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>智能歌单</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : viewMode === 'list' ? (
          // 列表视图 - 紧凑横向布局
          <div className="space-y-2">
            {filteredAndSortedPlaylists.map((playlist) => (
              <PlaylistListItem
                key={playlist.id}
                playlist={playlist}
                onClick={() => onPlaylistClick?.(playlist.id)}
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))}
          </div>
        ) : (
          // 混合视图（网格模式）
          <div className="space-y-8">
            {/* 置顶/收藏歌单 - 大卡片展示 */}
            {groupedPlaylists.pinned.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <div className="w-1 h-5 bg-purple-600 rounded-full" />
                    精选歌单
                  </h2>
                  <span className="text-sm text-slate-500 dark:text-gray-500">
                    {groupedPlaylists.pinned.length} 个
                  </span>
                </div>
                
                {/* 大卡片布局 - 响应式 */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {groupedPlaylists.pinned.map((playlist) => (
                    <div
                      key={playlist.id}
                      onClick={() => onPlaylistClick?.(playlist.id)}
                      className="group relative bg-gradient-to-br from-white to-slate-50 dark:from-gray-800/80 dark:to-gray-900/80
                        backdrop-blur-sm rounded-2xl p-6 cursor-pointer
                        border border-slate-200 dark:border-gray-700/50
                        hover:border-purple-300 dark:hover:border-purple-500/50
                        hover:shadow-2xl hover:shadow-purple-500/20
                        transition-all duration-300 hover:scale-[1.02]"
                    >
                      {/* 背景装饰 */}
                      <div className="absolute inset-0 bg-purple-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      <div className="relative flex items-start gap-4">
                        {/* 封面 */}
                        <div className="flex-shrink-0 w-20 h-20 rounded-xl bg-purple-600
                                      flex items-center justify-center shadow-sm group-hover:shadow-md
                                      group-hover:scale-105 transition-all duration-200">
                          {playlist.cover_path ? (
                            <img src={playlist.cover_path} alt={playlist.name} className="w-full h-full object-cover rounded-xl" />
                          ) : (
                            <>
                              {playlist.is_smart ? (
                                <Sparkles className="w-10 h-10 text-white" />
                              ) : playlist.is_favorite ? (
                                <Heart className="w-10 h-10 text-white" />
                              ) : (
                                <Music className="w-10 h-10 text-white" />
                              )}
                            </>
                          )}
                          {/* 悬停播放按钮 */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl 
                                        flex items-center justify-center transition-all">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center
                                          opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100
                                          transition-all duration-300 shadow-lg">
                              <svg className="w-5 h-5 text-purple-600 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        
                        {/* 信息 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate
                                         group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                              {playlist.name}
                            </h3>
                            {/* 标签 */}
                            <div className="flex gap-1 flex-shrink-0">
                              {playlist.is_pinned && (
                                <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-500/20 
                                              flex items-center justify-center">
                                  <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v.5a.75.75 0 01-1.5 0v-.5A.75.75 0 0110 2zm0 13a.75.75 0 01.75.75v.5a.75.75 0 01-1.5 0v-.5A.75.75 0 0110 15zm7-5a.75.75 0 01-.75.75h-.5a.75.75 0 010-1.5h.5A.75.75 0 0117 10zm-13 0a.75.75 0 01-.75.75h-.5a.75.75 0 010-1.5h.5A.75.75 0 014 10zm11.314-4.314a.75.75 0 010 1.06l-.354.354a.75.75 0 01-1.06-1.06l.353-.354a.75.75 0 011.06 0zm-9.193 9.193a.75.75 0 010 1.06l-.353.354a.75.75 0 01-1.061-1.06l.354-.354a.75.75 0 011.06 0zm9.193 0a.75.75 0 00-1.06 0l-.354.353a.75.75 0 001.06 1.061l.354-.354a.75.75 0 000-1.06zM5.879 6.939a.75.75 0 00-1.06-1.06l-.354.353a.75.75 0 001.06 1.061l.354-.354zM8 10a2 2 0 114 0 2 2 0 01-4 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                              {playlist.is_favorite && (
                                <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-500/20 
                                              flex items-center justify-center">
                                  <Heart className="w-3.5 h-3.5 text-red-500 dark:text-red-400 fill-current" />
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {playlist.description && (
                            <p className="text-sm text-slate-600 dark:text-gray-400 line-clamp-1 mb-3">
                              {playlist.description}
                            </p>
                          )}
                          
                          {/* 统计信息 */}
                          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-gray-500">
                            <span className="flex items-center gap-1.5">
                              <Music className="w-4 h-4" />
                              {playlist.track_count} 首
                            </span>
                            {playlist.play_count > 0 && (
                              <span className="flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                </svg>
                                {playlist.play_count} 次
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* 底部渐变装饰 */}
                      {playlist.color_theme && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl opacity-60"
                             style={{ background: `linear-gradient(to right, ${playlist.color_theme}, transparent)` }} />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
            
            {/* 智能歌单 - 紧凑网格 */}
            {groupedPlaylists.smart.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    智能歌单
                  </h2>
                  <span className="text-sm text-slate-500 dark:text-gray-500">
                    {groupedPlaylists.smart.length} 个
                  </span>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
                  {groupedPlaylists.smart.map((playlist, index) => (
                    <div key={playlist.id} className="animate-fadeInUp" style={{ animationDelay: `${index * 50}ms` }}>
                      <PlaylistCard
                        playlist={playlist}
                        onClick={() => onPlaylistClick?.(playlist.id)}
                        onFavoriteToggle={() => handleFavoriteToggle(playlist.id)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
            
            {/* 普通歌单 - 紧凑网格 */}
            {groupedPlaylists.regular.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Music className="w-5 h-5 text-slate-600 dark:text-gray-400" />
                    我的歌单
                  </h2>
                  <span className="text-sm text-slate-500 dark:text-gray-500">
                    {groupedPlaylists.regular.length} 个
                  </span>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
                  {groupedPlaylists.regular.map((playlist, index) => (
                    <div key={playlist.id} className="animate-fadeInUp" style={{ animationDelay: `${index * 50}ms` }}>
                      <PlaylistCard
                        playlist={playlist}
                        onClick={() => onPlaylistClick?.(playlist.id)}
                        onFavoriteToggle={() => handleFavoriteToggle(playlist.id)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

