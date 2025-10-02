
interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
}

interface TrackRowProps {
  track: Track;
  index: number;
  isSelected: boolean;
  isHovered: boolean;
  hoveredIndex: number;
  albumCoverUrl?: string;
  densitySettings: {
    rowPaddingY: number;
    thumbSize: number;
    contentGap: number;
  };
  showFavoriteButtons?: boolean;
  isFavorite?: boolean;
  onSelect: () => void;
  onHover: () => void;
  onFavoriteToggle?: () => void;
  rowRef: (el: HTMLTableRowElement | null) => void;
}

export default function TrackRow({
  track,
  index,
  isSelected,
  isHovered,
  hoveredIndex,
  albumCoverUrl,
  densitySettings,
  showFavoriteButtons,
  isFavorite,
  onSelect,
  onHover,
  onFavoriteToggle,
  rowRef
}: TrackRowProps) {
  const { rowPaddingY, thumbSize, contentGap } = densitySettings;
  
  // 移除行内背景 - 使用全局跟随指示器

  // 格式化时长
  const formatDuration = (ms?: number) => {
    if (!ms) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <tr
      ref={rowRef}
      className={`
        border-b border-slate-100 dark:border-white/10 cursor-pointer group
        relative z-10
        transition-all duration-200 ease-out
        ${isSelected ? 'selected-row' : ''}
      `}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      {/* 封面 + 歌曲信息列 */}
      <td className="px-6 py-0" style={{ paddingTop: rowPaddingY, paddingBottom: rowPaddingY }}>
        <div className="flex items-center min-w-0" style={{ gap: contentGap }}>
          {/* 专辑封面 */}
          <div 
            className="flex-shrink-0 rounded-lg overflow-hidden bg-slate-100/80 backdrop-blur-sm border border-white/40 shadow-sm ring-1 ring-black/5" 
            style={{ width: thumbSize, height: thumbSize }}
          >
            {albumCoverUrl ? (
              <img 
                src={albumCoverUrl} 
                alt={`${track.album || '未知专辑'} 封面`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 bg-gradient-to-br from-slate-50 to-slate-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
            )}
          </div>
          
          {/* 歌曲信息 */}
          <div className="flex items-center min-w-0 flex-1">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-slate-900 dark:text-dark-900 group-hover:text-brand-600 transition-colors duration-200 ease-out text-[13px] leading-tight truncate">
                {track.title || '未知标题'}
              </div>
              <div className="text-slate-500 dark:text-dark-700 text-[11px] leading-tight truncate mt-0.5 group-hover:text-slate-600 dark:group-hover:text-dark-800 transition-colors duration-150">
                {track.artist || '未知艺术家'}
              </div>
            </div>
            
            {/* 收藏按钮 */}
            {showFavoriteButtons && (
              <div className="ml-3 hidden md:flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFavoriteToggle?.();
                  }}
                  className={`
                    p-1.5 rounded-full transition-all duration-200
                    ${isFavorite 
                      ? 'text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-500/10' 
                      : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10'
                    }
                  `}
                >
                  <svg className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </td>

      {/* 专辑列 */}
      <td className="px-6 py-0 hidden md:table-cell" style={{ paddingTop: rowPaddingY, paddingBottom: rowPaddingY }}>
        <div className="text-slate-600 dark:text-dark-700 text-[12px] truncate max-w-xs group-hover:text-slate-700 transition-colors">
          {track.album || '未知专辑'}
        </div>
      </td>

      {/* 时长列 */}
      <td className="px-6 py-0 text-center min-w-32" style={{ paddingTop: rowPaddingY, paddingBottom: rowPaddingY }}>
        <div className="text-slate-500 dark:text-dark-700 text-[12px] font-medium tabular-nums group-hover:text-brand-500 transition-colors">
          {formatDuration(track.duration_ms)}
        </div>
      </td>
    </tr>
  );
}
