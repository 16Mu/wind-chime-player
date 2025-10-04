/**
 * 歌单卡片组件 - 纯展示组件
 * 
 * 设计原则：
 * - 单一职责：只负责展示单个歌单
 * - 纯组件：不包含业务逻辑，只接收props
 * - 可复用：可在多个场景使用
 */

import React from 'react';
import { Playlist } from '../../contexts/PlaylistContext';
import { Music, Heart, Sparkles, Clock, TrendingUp, Pin } from 'lucide-react';

interface PlaylistCardProps {
  playlist: Playlist;
  onClick?: () => void;
  onFavoriteToggle?: () => void;
  className?: string;
}

export const PlaylistCard: React.FC<PlaylistCardProps> = ({
  playlist,
  onClick,
  onFavoriteToggle,
  className = '',
}) => {
  // 格式化时长
  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  };

  // 格式化日期
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div
      className={`group relative bg-gradient-to-br from-white to-slate-50 dark:from-gray-800/50 dark:to-gray-900/50 
        backdrop-blur-sm rounded-xl p-5 
        hover:from-slate-100 hover:to-slate-200 dark:hover:from-gray-700/60 dark:hover:to-gray-800/60
        transition-all duration-300 cursor-pointer
        border border-slate-200 dark:border-gray-700/50 hover:border-slate-300 dark:hover:border-gray-600/50
        hover:shadow-xl hover:shadow-purple-500/10
        ${className}`}
      onClick={onClick}
    >
      {/* 封面区域 */}
      <div className="relative mb-4 aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-500/20 dark:to-pink-500/20">
        {playlist.cover_path ? (
          <img
            src={playlist.cover_path}
            alt={playlist.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-16 h-16 text-purple-300 dark:text-purple-400/40" />
          </div>
        )}
        
        {/* 悬浮遮罩 */}
        <div className="absolute inset-0 bg-white/0 dark:bg-black/0 group-hover:bg-white/60 dark:group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <TrendingUp className="w-12 h-12 text-slate-900 dark:text-white drop-shadow-lg" />
          </div>
        </div>

        {/* 标签 */}
        <div className="absolute top-2 right-2 flex gap-2">
          {playlist.is_pinned && (
            <div className="bg-amber-500/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <Pin className="w-3 h-3" />
              <span>置顶</span>
            </div>
          )}
          {playlist.is_smart && (
            <div className="bg-purple-500/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>智能</span>
            </div>
          )}
          {playlist.is_favorite && (
            <div className="bg-red-500/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
              <Heart className="w-3 h-3 fill-current" />
            </div>
          )}
        </div>
      </div>

      {/* 信息区域 */}
      <div className="space-y-2">
        {/* 标题 */}
        <h3 className="text-slate-900 dark:text-white font-semibold text-lg truncate group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
          {playlist.name}
        </h3>

        {/* 描述 */}
        {playlist.description && (
          <p className="text-slate-600 dark:text-gray-400 text-sm line-clamp-2 leading-relaxed">
            {playlist.description}
          </p>
        )}

        {/* 统计信息 */}
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-gray-500">
          <div className="flex items-center gap-1">
            <Music className="w-3.5 h-3.5" />
            <span>{playlist.track_count} 首</span>
          </div>
          {playlist.total_duration_ms > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDuration(playlist.total_duration_ms)}</span>
            </div>
          )}
        </div>

        {/* 播放次数和创建时间 */}
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-gray-600">
          {playlist.play_count > 0 && (
            <span>播放 {playlist.play_count} 次</span>
          )}
          <span>{formatDate(playlist.created_at)}</span>
        </div>
      </div>

      {/* 收藏按钮 */}
      {onFavoriteToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFavoriteToggle();
          }}
          className="absolute top-3 left-3 p-2 rounded-full bg-white/60 dark:bg-black/40 backdrop-blur-sm
            opacity-0 group-hover:opacity-100 transition-opacity duration-300
            hover:bg-white/80 dark:hover:bg-black/60"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              playlist.is_favorite ? 'fill-red-500 text-red-500' : 'text-slate-900 dark:text-white'
            }`}
          />
        </button>
      )}

      {/* 主题色装饰 */}
      {playlist.color_theme && (
        <div
          className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl"
          style={{ backgroundColor: playlist.color_theme }}
        />
      )}
    </div>
  );
};

