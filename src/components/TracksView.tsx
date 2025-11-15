import { useState, useRef, useCallback } from 'react';
import { useHoverAnimation } from '../hooks/useHoverAnimation';
import { useAlbumCovers } from '../hooks/useAlbumCovers';

interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
}

export interface TracksViewProps {
  tracks: Track[];
  onTrackSelect: (track: Track) => void;
  isLoading: boolean;
  selectedTrackId?: number;
  showFavoriteButtons?: boolean;
  onFavoriteChange?: (trackId: number, isFavorite: boolean) => void;
  onAddToPlaylist?: (track: Track) => void;
  enableDragSort?: boolean;
  onDragEnd?: (fromIndex: number, toIndex: number) => void;
}

export default function TracksView({
  tracks,
  onTrackSelect,
  isLoading,
  selectedTrackId,
  showFavoriteButtons: _showFavoriteButtons = false,
  onFavoriteChange: _onFavoriteChange,
  onAddToPlaylist: _onAddToPlaylist,
  enableDragSort = false,
  onDragEnd
}: TracksViewProps) {
  // 状态管理
  const [, setHoveredRowIndex] = useState<number>(-1);
  
  // 拖拽状态
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // 自定义Hooks
  const { hoverIndicator: _hoverIndicator, indicatorRef: _indicatorRef, updateIndicator, hideIndicator } = useHoverAnimation(true);
  
  // 🚀 性能优化：延迟加载封面，先渲染列表
  const { albumCoverUrls } = useAlbumCovers(tracks);

  // 🚀 性能优化：使用useCallback缓存事件处理函数
  const handleRowMouseEnter = useCallback((index: number) => {
    setHoveredRowIndex(index);
    updateIndicator(rowRefs.current[index]);
  }, [updateIndicator]);

  const handleContainerMouseLeave = useCallback(() => {
    setHoveredRowIndex(-1);
    hideIndicator();
  }, [hideIndicator]);


  // 🚀 性能优化：缓存拖拽事件处理函数
  const handleDragStart = useCallback((index: number) => {
    if (!enableDragSort) return;
    setDraggedIndex(index);
  }, [enableDragSort]);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    if (!enableDragSort) return;
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDropTargetIndex(index);
    }
  }, [enableDragSort, draggedIndex]);

  const handleDragLeave = useCallback(() => {
    setDropTargetIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, index: number) => {
    if (!enableDragSort) return;
    e.preventDefault();
    
    if (draggedIndex !== null && draggedIndex !== index && onDragEnd) {
      onDragEnd(draggedIndex, index);
    }
    
    setDraggedIndex(null);
    setDropTargetIndex(null);
  }, [enableDragSort, draggedIndex, onDragEnd]);

  const handleDragEndEvent = useCallback(() => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  }, []);

  // 加载状态
  if (isLoading) {
    return (
      <div className="glass-music-library overflow-hidden relative">
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-4">
            <div className="ring-loader" style={{ width: '48px', height: '48px', borderWidth: '4px' }}></div>
            <p className="text-contrast-secondary font-medium flex items-center gap-2">
              加载曲目中
              <span className="loading-dots" style={{ fontSize: '6px' }}>
                <span></span>
                <span></span>
                <span></span>
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 空状态
  if (tracks.length === 0) {
    return (
      <div className="glass-music-library overflow-hidden relative">
        <div className="flex items-center justify-center h-96">
          <div className="text-center max-w-md px-6">
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center shadow-lg">
                <svg className="w-10 h-10 text-slate-400 dark:text-dark-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold text-contrast-primary mb-3">暂无曲目</h3>
            <p className="text-contrast-secondary mb-6 text-base font-medium">
              点击上方的"选择文件夹扫描"按钮，添加音乐到您的库中
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="space-y-1 pt-0 pb-[68px]"
      onMouseLeave={handleContainerMouseLeave}
    >
      {/* 曲目列表 */}
      {tracks.map((track, index) => {
        const isSelected = selectedTrackId === track.id;
        const albumCoverUrl = albumCoverUrls[track.id];
        
        const isDragging = draggedIndex === index;
        const isDropTarget = dropTargetIndex === index;
        
        return (
          <div
            key={track.id}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            className={`
              grid grid-cols-12 gap-3 px-3 py-2 rounded-md group
              transition-all duration-150 cursor-pointer
              ${isDragging ? 'opacity-50 scale-95' : ''}
              ${isDropTarget ? 'bg-brand-100 dark:bg-brand-900/30 ring-2 ring-brand-400 dark:ring-brand-600' : ''}
              ${isSelected ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-slate-50 dark:hover:bg-dark-200/50'}
              animate-fadeInUp
            `}
            style={{
              animationDelay: `${index * 30}ms`
            }}
            onClick={() => !isDragging && onTrackSelect(track)}
            onMouseEnter={() => handleRowMouseEnter(index)}
          >
            {/* 封面 + 歌曲信息 */}
            <div className="col-span-6 flex items-center gap-2.5 min-w-0">
              {/* 封面 */}
              <div className="flex-shrink-0 w-11 h-11 rounded-md overflow-hidden bg-slate-100 dark:bg-dark-200">
                {albumCoverUrl ? (
                  <img 
                    src={albumCoverUrl} 
                    alt={`${track.album || '未知专辑'} 封面`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-dark-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
              </div>
              
              {/* 歌曲信息 */}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-dark-900 truncate group-hover:text-brand-600 transition-colors leading-snug">
                  {track.title || '未知标题'}
                </div>
                <div className="text-xs text-slate-500 dark:text-dark-700 truncate mt-0.5">
                  {track.artist || '未知艺术家'}
                </div>
              </div>
            </div>

            {/* 专辑 + 拖拽手柄 */}
            <div className="col-span-4 flex items-center gap-2 min-w-0">
              {/* 拖拽手柄 - 仅在拖拽模式下显示 */}
              {enableDragSort && (
                <div
                  draggable={true}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    handleDragStart(index);
                  }}
                  onDragEnd={(e) => {
                    e.stopPropagation();
                    handleDragEndEvent();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0 text-slate-400 dark:text-dark-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-move p-1 hover:text-slate-600 dark:hover:text-dark-800"
                  title="拖动以调整顺序"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>
              )}
              
              <div className="text-xs text-slate-600 dark:text-dark-700 truncate">
                {track.album || '未知专辑'}
              </div>
            </div>

            {/* 时长 */}
            <div className="col-span-2 flex items-center justify-center">
              <div className="text-xs text-slate-500 dark:text-dark-700 font-mono">
                {track.duration_ms 
                  ? `${Math.floor(track.duration_ms / 60000)}:${String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}`
                  : '--:--'
                }
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}