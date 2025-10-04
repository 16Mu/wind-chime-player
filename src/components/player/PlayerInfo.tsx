/**
 * 播放器信息显示组件
 * 
 * 职责：
 * - 显示当前曲目信息
 * - 显示专辑封面
 * - 显示当前歌词
 */

import { memo } from 'react';
import type { Track } from '../../types/music';

interface PlayerInfoProps {
  track: Track | null;
  albumCoverUrl: string | null;
  currentLyric?: string;
  onAlbumClick?: () => void;
}

const PlayerInfo = memo(function PlayerInfo({
  track,
  albumCoverUrl,
  currentLyric,
  onAlbumClick
}: PlayerInfoProps) {
  
  if (!track) {
    return (
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-dark-200 dark:to-dark-300 flex items-center justify-center">
          <svg className="w-7 h-7 text-slate-400 dark:text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-400 dark:text-dark-600">
            未播放
          </div>
          <div className="text-xs text-slate-400 dark:text-dark-600">
            选择一首歌曲开始播放
          </div>
        </div>
      </div>
    );
  }

  const title = track.title || '未知曲目';
  const artist = track.artist || '未知艺术家';
  const album = track.album || '未知专辑';

  return (
    <div className="flex items-center gap-4 min-w-0">
      {/* 专辑封面 */}
      <button
        onClick={onAlbumClick}
        className="group relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 transition-transform hover:scale-105"
      >
        {albumCoverUrl ? (
          <img
            src={albumCoverUrl}
            alt={album}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
            <svg className="w-7 h-7 text-white opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}
        {/* 悬停效果 */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      </button>

      {/* 曲目信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-dark-900 truncate">
            {title}
          </h3>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-dark-700">
          <span className="truncate">{artist}</span>
          {album && album !== '未知专辑' && (
            <>
              <span>•</span>
              <span className="truncate">{album}</span>
            </>
          )}
        </div>

        {/* 当前歌词 */}
        {currentLyric && (
          <div className="mt-1 text-xs text-brand-600 dark:text-brand-400 truncate font-medium">
            {currentLyric}
          </div>
        )}
      </div>
    </div>
  );
});

export default PlayerInfo;



