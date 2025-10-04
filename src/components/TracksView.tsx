import { useState, useRef } from 'react';
import TrackRow from './TrackRow';
import { useHoverAnimation } from '../hooks/useHoverAnimation';
import { useAlbumCovers } from '../hooks/useAlbumCovers';
import { useResponsiveDensity } from '../hooks/useResponsiveDensity';

interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
}

interface TracksViewProps {
  tracks: Track[];
  onTrackSelect: (track: Track) => void;
  isLoading: boolean;
  selectedTrackId?: number;
  showFavoriteButtons?: boolean;
  onFavoriteChange?: (trackId: number, isFavorite: boolean) => void;
  onAddToPlaylist?: (track: Track) => void;
}

export default function TracksView({
  tracks,
  onTrackSelect,
  isLoading,
  selectedTrackId,
  showFavoriteButtons = false,
  onFavoriteChange,
  onAddToPlaylist
}: TracksViewProps) {
  // 状态管理
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number>(-1);
  const [favoriteStates, setFavoriteStates] = useState<{ [trackId: number]: boolean }>({});
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // 自定义Hooks
  const { hoverIndicator, indicatorRef, updateIndicator, hideIndicator } = useHoverAnimation(true);
  const { albumCoverUrls } = useAlbumCovers(tracks);
  const densitySettings = useResponsiveDensity();

  // 事件处理
  const handleRowMouseEnter = (index: number) => {
    setHoveredRowIndex(index);
    updateIndicator(rowRefs.current[index]);
  };

  const handleContainerMouseLeave = () => {
    setHoveredRowIndex(-1);
    hideIndicator();
  };

  const handleFavoriteToggle = (trackId: number) => {
    const newState = !favoriteStates[trackId];
    setFavoriteStates(prev => ({ ...prev, [trackId]: newState }));
    onFavoriteChange?.(trackId, newState);
  };

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
                <svg className="w-10 h-10 text-slate-400 dark:text-dark-700 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      className="overflow-hidden relative"
      onMouseLeave={handleContainerMouseLeave}
    >
      {/* 跟随鼠标的简洁悬停背景 */}
      {hoveredRowIndex >= 0 && hoverIndicator.visible && (
        <div
          ref={indicatorRef}
          className="absolute pointer-events-none z-0"
          style={{
            top: `${hoverIndicator.top}px`,
            height: `${hoverIndicator.height}px`,
            left: '0',
            right: '0',
            width: '100%',
            background: 'linear-gradient(90deg, rgba(43, 111, 255, 0.03) 0%, rgba(43, 111, 255, 0.06) 50%, rgba(43, 111, 255, 0.03) 100%)',
            borderRadius: '8px',
            transition: 'opacity 0.2s ease-out',
          }}
        />
      )}

      {/* 表格 */}
      <table className="w-full">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-contrast-primary dark:text-dark-800 tracking-wider transition-colors cursor-pointer group">
              <span className="flex items-center gap-2 whitespace-nowrap">
                <svg className="w-3.5 h-3.5 text-slate-500 dark:text-dark-600 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span className="tracking-wide">歌曲</span>
              </span>
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-contrast-primary dark:text-dark-800 tracking-wider transition-colors cursor-pointer group hidden md:table-cell">
              <span className="flex items-center gap-2 whitespace-nowrap">
                <svg className="w-3.5 h-3.5 text-slate-500 dark:text-dark-600 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="tracking-wide">专辑</span>
              </span>
            </th>
            <th className="px-6 py-3 text-center text-xs font-semibold text-contrast-primary dark:text-dark-800 tracking-wider transition-colors cursor-pointer group min-w-32">
              <span className="flex items-center justify-center gap-2 whitespace-nowrap">
                <svg className="w-3.5 h-3.5 text-slate-500 dark:text-dark-600 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="tracking-wide">时长</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              isSelected={selectedTrackId === track.id}
              isHovered={hoveredRowIndex === index}
              hoveredIndex={hoveredRowIndex}
              albumCoverUrl={albumCoverUrls[track.id]}
              densitySettings={densitySettings}
              showFavoriteButtons={showFavoriteButtons}
              isFavorite={favoriteStates[track.id]}
              onSelect={() => onTrackSelect(track)}
              onHover={() => handleRowMouseEnter(index)}
              onFavoriteToggle={() => handleFavoriteToggle(track.id)}
              onAddToPlaylist={onAddToPlaylist ? () => onAddToPlaylist(track) : undefined}
              rowRef={(el) => { rowRefs.current[index] = el; }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}