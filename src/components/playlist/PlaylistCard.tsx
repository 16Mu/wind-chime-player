import React from 'react';
import { Playlist } from '../../contexts/PlaylistContext';
import { Music, Heart, Sparkles } from 'lucide-react';
import { usePlaylistCover } from '../../hooks/usePlaylistCover';

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
  const coverImage = usePlaylistCover(playlist.id, playlist.cover_path, playlist.track_count);

  return (
    <div
      className={`group cursor-pointer ${className}`}
      onClick={onClick}
    >
      {/* 主卡片容器 */}
      <div className="rounded-lg overflow-hidden bg-white dark:bg-gray-800/50
                    border border-slate-200 dark:border-gray-700
                    hover:border-slate-300 dark:hover:border-gray-600
                    transition-colors">
        
        {/* 封面区域 */}
        <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-gray-700/50">
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
                <Sparkles className="w-12 h-12 text-slate-400 dark:text-gray-500" />
              ) : (
                <Music className="w-12 h-12 text-slate-400 dark:text-gray-500" />
              )}
            </div>
          )}
          
          {/* 收藏按钮 */}
          {onFavoriteToggle && playlist.is_favorite && (
            <div className="absolute top-2 left-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFavoriteToggle();
                }}
                className="w-7 h-7 rounded-full bg-white/90 dark:bg-gray-800/90
                  flex items-center justify-center"
              >
                <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
              </button>
            </div>
          )}

          {/* 智能歌单标记 */}
          {playlist.is_smart && (
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-slate-900/80 dark:bg-gray-700/80 text-white text-[10px]">
              智能
            </div>
          )}
        </div>

        {/* 信息区域 */}
        <div className="p-3">
          <h3 className="font-medium text-sm text-slate-900 dark:text-white truncate mb-1">
            {playlist.name}
          </h3>
          <div className="text-xs text-slate-500 dark:text-gray-400">
            {playlist.track_count} 首
          </div>
        </div>
      </div>
    </div>
  );
};
