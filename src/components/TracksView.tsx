import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

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
  // 当前选中曲目的 ID（用于行选中高亮）
  selectedTrackId?: number;
  // 模糊背景条设置
  blurBackdropSettings?: {
    enabled: boolean;
    intensity: 'low' | 'medium' | 'high';
    opacity: number; // 0-1
  };
  // 收藏功能设置（可选）
  showFavoriteButtons?: boolean; // 是否显示收藏按钮
  onFavoriteChange?: (trackId: number, isFavorite: boolean) => void; // 收藏状态变化回调
  // 悬停动画设置
  hoverAnimationSettings?: {
    enabled: boolean;
    range: number; // 影响范围（0-5）
    displacement: number; // 主行位移大小（像素）
  };
}

export default function TracksView({ 
  tracks, 
  onTrackSelect, 
  isLoading,
  selectedTrackId,
  blurBackdropSettings = { enabled: true, intensity: 'medium', opacity: 0.8 },
  showFavoriteButtons = false,
  onFavoriteChange,
  hoverAnimationSettings = { enabled: true, range: 2, displacement: 8 }
}: TracksViewProps) {

  // 收藏状态管理
  const [favoriteStates, setFavoriteStates] = useState<{ [trackId: number]: boolean }>({});
  
  // 悬停状态管理 - 追踪哪一行正在被悬停
  const [hoveredRowId, setHoveredRowId] = useState<number | null>(null);
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number>(-1);
  
  // 专辑封面状态管理
  const [albumCoverUrls, setAlbumCoverUrls] = useState<{ [trackId: number]: string }>({});
  
  // 动态悬停指示器状态管理
  const [hoverIndicator, setHoverIndicator] = useState<{ top: number; visible: boolean }>({ top: 0, visible: false });
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // 自适应密度：根据窗口高度与DPR调整行内边距与缩略图尺寸
  const [rowPaddingY, setRowPaddingY] = useState<number>(10); // px - 更紧凑
  const [thumbSize, setThumbSize] = useState<number>(44); // px - 更紧凑
  const [contentGap, setContentGap] = useState<number>(12); // px

  const computeDensity = () => {
    const vh = window.innerHeight || 900;
    const dpr = window.devicePixelRatio || 1;
    const effectiveH = vh * dpr;
    // 分段策略：更高的有效高度 → 更紧凑（显示更多行）
    if (effectiveH >= 3000) {
      setRowPaddingY(6);
      setThumbSize(36);
      setContentGap(10);
    } else if (effectiveH >= 2200) {
      setRowPaddingY(7);
      setThumbSize(38);
      setContentGap(10);
    } else if (effectiveH >= 1600) {
      setRowPaddingY(8);
      setThumbSize(40);
      setContentGap(12);
    } else if (effectiveH >= 1200) {
      setRowPaddingY(9);
      setThumbSize(42);
      setContentGap(12);
    } else {
      setRowPaddingY(10);
      setThumbSize(44);
      setContentGap(12);
    }
  };

  useEffect(() => {
    computeDensity();
    const onResize = () => computeDensity();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 批量检查收藏状态
  const checkFavoriteStates = async (trackList: Track[]) => {
    if (!showFavoriteButtons || trackList.length === 0) return;
    
    try {
      const promises = trackList.map(track => 
        invoke('favorites_is_favorite', { trackId: track.id }) as Promise<boolean>
      );
      
      const results = await Promise.all(promises);
      const newStates: { [trackId: number]: boolean } = {};
      
      trackList.forEach((track, index) => {
        newStates[track.id] = results[index];
      });
      
      setFavoriteStates(newStates);
    } catch (error) {
      console.error('批量检查收藏状态失败:', error);
    }
  };

  // 切换收藏状态
  const toggleFavorite = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发行点击事件
    
    try {
      const newFavoriteState = await invoke('favorites_toggle', { trackId: track.id }) as boolean;
      
      setFavoriteStates(prev => ({
        ...prev,
        [track.id]: newFavoriteState
      }));
      
      // 调用回调函数
      onFavoriteChange?.(track.id, newFavoriteState);
      
      console.log(newFavoriteState ? `✨ 已收藏: ${track.title}` : `💔 已取消收藏: ${track.title}`);
    } catch (error) {
      console.error('切换收藏状态失败:', error);
    }
  };

  // 加载专辑封面
  const loadAlbumCover = async (trackId: number) => {
    try {
      const result = await invoke('get_album_cover', { trackId }) as [number[], string] | null;
      if (result) {
        const [imageData, mimeType] = result;
        const blob = new Blob([new Uint8Array(imageData)], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        setAlbumCoverUrls(prev => ({
          ...prev,
          [trackId]: url
        }));
      }
    } catch (error) {
      console.error('加载专辑封面失败:', trackId, error);
    }
  };

  // 当歌曲列表变化时重新检查收藏状态
  useEffect(() => {
    if (showFavoriteButtons) {
      checkFavoriteStates(tracks);
    }
  }, [tracks, showFavoriteButtons]);

  // 平滑跟随鼠标的悬停指示器处理
  const updateIndicatorPosition = (clientY: number) => {
    if (!blurBackdropSettings.enabled || !containerRef.current || !indicatorRef.current) return;
    
    const tbody = containerRef.current.querySelector('tbody');
    const thead = containerRef.current.querySelector('thead');
    if (!tbody || !thead) return;
    
    const tbodyRect = tbody.getBoundingClientRect();
    const theadRect = thead.getBoundingClientRect();
    
    // 计算鼠标相对于tbody的位置
    const relativeY = clientY - tbodyRect.top;
    
    // 动态计算当前应该高亮的行
    const rows = tbody.querySelectorAll('tr');
    let targetRowIndex = -1;
    let targetY = 0;
    let targetH = 0;
    
    rows.forEach((row, index) => {
      const rowRect = row.getBoundingClientRect();
      const rowRelativeTop = rowRect.top - tbodyRect.top;
      const rowRelativeBottom = rowRect.bottom - tbodyRect.top;
      
      if (relativeY >= rowRelativeTop && relativeY <= rowRelativeBottom) {
        targetRowIndex = index;
        // 计算相对于整个容器的位置（包括thead的高度）
        targetY = (theadRect.height) + rowRelativeTop;
        targetH = rowRect.height;
      }
    });
    
    // 如果找到了目标行，平滑移动到该行
    if (targetRowIndex >= 0) {
      const indicator = indicatorRef.current;
      indicator.style.transform = `translateY(${targetY}px)`;
      indicator.style.transition = 'transform 0.1s cubic-bezier(0.2, 0, 0.38, 0.9), opacity 0.15s ease-out';
      if (targetH > 0) {
        indicator.style.height = `${targetH}px`;
      }
    }
  };
  
  // 处理容器内鼠标移动
  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!blurBackdropSettings.enabled) return;
    
    setHoverIndicator({ top: 0, visible: true });
    updateIndicatorPosition(e.clientY);
  };
  
  // 处理鼠标进入表格行
  const handleRowMouseEnter = (trackId: number, index: number) => {
    setHoveredRowId(trackId);
    setHoveredRowIndex(index);
    // 行进入时立即对齐指示器尺寸与位置
    if (!blurBackdropSettings.enabled || !containerRef.current || !indicatorRef.current) return;
    const tbody = containerRef.current.querySelector('tbody');
    const thead = containerRef.current.querySelector('thead');
    if (!tbody || !thead) return;
    const tbodyRect = tbody.getBoundingClientRect();
    const theadRect = thead.getBoundingClientRect();
    const rowEl = rowRefs.current[index];
    if (rowEl) {
      const r = rowEl.getBoundingClientRect();
      const rowRelativeTop = r.top - tbodyRect.top;
      const indicator = indicatorRef.current;
      indicator.style.transform = `translateY(${theadRect.height + rowRelativeTop}px)`;
      indicator.style.height = `${r.height}px`;
      setHoverIndicator({ top: 0, visible: true });
    }
  };
  
  const handleContainerMouseLeave = () => {
    if (!blurBackdropSettings.enabled) return;
    setHoverIndicator(prev => ({ ...prev, visible: false }));
    setHoveredRowId(null);
    setHoveredRowIndex(-1);
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };
  
  // 清理动画
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // 当歌曲列表变化时加载封面
  useEffect(() => {
    // 限制数量以避免性能问题
    const visibleTracks = tracks.slice(0, 50);
    visibleTracks.forEach(track => {
      loadAlbumCover(track.id);
    });
  }, [tracks]);

  // 清理URL对象
  useEffect(() => {
    return () => {
      Object.values(albumCoverUrls).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [albumCoverUrls]);

  const formatDuration = (ms?: number) => {
    if (!ms) return '--:--';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (isLoading && tracks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center glass-card max-w-md">
          <div className="text-slate-400 mb-6">
            <svg className="w-16 h-16 mx-auto animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-contrast-primary mb-3">
            正在加载曲目...
          </h3>
          <p className="text-contrast-secondary mb-6 text-base font-medium">
            请稍候，正在获取您的音乐数据
          </p>
        </div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center glass-card max-w-md">
          <div className="text-slate-400 mb-6">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-contrast-primary mb-3">
            暂无曲目
          </h3>
          <p className="text-contrast-secondary mb-6 text-base font-medium">
            点击上方的"选择文件夹扫描"按钮，添加音乐到您的库中
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="glass-music-library overflow-hidden relative"
      onMouseMove={handleContainerMouseMove}
      onMouseLeave={handleContainerMouseLeave}
    >
      {/* 动态跟随鼠标的悬停指示器 */}
      {blurBackdropSettings.enabled && (
        <div
          ref={indicatorRef}
          className={`
            absolute left-0 right-0 pointer-events-none z-0
            transition-opacity duration-200
            ${hoverIndicator.visible ? 'opacity-100' : 'opacity-0'}
          `}
          style={{
            top: '0px',
            height: '60px',
            backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark' 
              ? 'rgba(255, 255, 255, 0.08)' 
              : 'rgba(0, 0, 0, 0.05)',
            opacity: hoverIndicator.visible ? 1 : 0
          }}
        />
      )}
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-white/40 dark:bg-glass-dark-bg-strong backdrop-blur-md border-b border-white/30 dark:border-glass-dark-border">
          <tr>
            {/* 封面 + 歌名/歌手合并列 */}
            <th className="px-6 py-3 text-left text-xs font-semibold text-contrast-primary dark:text-dark-800 tracking-wider hover:bg-slate-50/50 dark:hover:bg-glass-dark-bg transition-colors cursor-pointer group">
              <span className="flex items-center gap-2 whitespace-nowrap">
                <svg className="w-3.5 h-3.5 text-slate-500 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span className="tracking-wide">歌曲</span>
                <svg className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-60 transition-opacity ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </th>
            {/* 专辑列 */}
            <th className="px-6 py-3 text-left text-xs font-semibold text-contrast-primary dark:text-dark-800 tracking-wider hover:bg-slate-50/50 dark:hover:bg-glass-dark-bg transition-colors cursor-pointer group hidden md:table-cell">
              <span className="flex items-center gap-2 whitespace-nowrap">
                <svg className="w-3.5 h-3.5 text-slate-500 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="tracking-wide">专辑</span>
                <svg className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-60 transition-opacity ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </th>
            <th className="px-6 py-3 text-center text-xs font-semibold text-contrast-primary dark:text-dark-800 tracking-wider hover:bg-slate-50/50 dark:hover:bg-glass-dark-bg transition-colors cursor-pointer group min-w-32">
              <span className="flex items-center justify-center gap-2 whitespace-nowrap">
                <svg className="w-3.5 h-3.5 text-slate-500 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="tracking-wide">时长</span>
                <svg className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-60 transition-opacity ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((track, index) => {
            const distance = Math.abs(index - hoveredRowIndex);
            const isHovered = hoveredRowIndex === index;
            
            // 根据设置计算动画效果
            let transformClasses = '';
            if (hoverAnimationSettings.enabled && hoveredRowIndex >= 0) {
              if (isHovered) {
                // 主悬停行：完整位移 + 浮空 + 阴影
                transformClasses = `shadow-lg`;
              } else if (distance <= hoverAnimationSettings.range && distance > 0) {
                // 影响范围内的相邻行：按距离递减位移
                const factor = (hoverAnimationSettings.range - distance + 1) / (hoverAnimationSettings.range + 1);
                // 不添加 CSS 类，而是用内联样式处理
              }
            }
            
            return (
            <tr
              ref={(el) => { rowRefs.current[index] = el; }}
              key={track.id}
              className={`
                border-b border-white/30 dark:border-white/10 cursor-pointer group
                bg-transparent
                relative z-10
                transition-all duration-300 ease-out
                ${transformClasses}
                ${selectedTrackId === track.id ? 'selected-row' : ''}
              `}
              style={{
                transform: hoverAnimationSettings.enabled && hoveredRowIndex >= 0 ? (() => {
                  if (isHovered) {
                    return `translateX(${hoverAnimationSettings.displacement}px) translateY(-2px)`;
                  } else if (distance <= hoverAnimationSettings.range && distance > 0) {
                    const factor = (hoverAnimationSettings.range - distance + 1) / (hoverAnimationSettings.range + 1);
                    const displacement = hoverAnimationSettings.displacement * factor * 0.5;
                    return `translateX(${displacement}px)`;
                  }
                  return 'none';
                })() : 'none'
              }}
              onClick={() => {
                console.log('🎵 TracksView - 播放曲目:', track);
                onTrackSelect(track);
              }}
              onMouseEnter={() => handleRowMouseEnter(track.id, index)}
              onMouseLeave={() => {
                setHoveredRowId(null);
                setHoveredRowIndex(-1);
              }}
            >
              {/* 封面 + 歌曲信息列 */}
              <td className="px-6 py-0" style={{ paddingTop: rowPaddingY, paddingBottom: rowPaddingY }}>
                <div className="flex items-center min-w-0" style={{ gap: contentGap }}>
                  {/* 专辑封面缩略图 */}
                  <div className="flex-shrink-0 rounded-lg overflow-hidden bg-slate-100/80 backdrop-blur-sm border border-white/40 shadow-sm ring-1 ring-black/5" style={{ width: thumbSize, height: thumbSize }}>
                    {albumCoverUrls[track.id] ? (
                      <img 
                        src={albumCoverUrls[track.id]} 
                        alt={`${track.album || '未知专辑'} 封面`}
                        className="w-full h-full object-cover"
                        onError={() => {
                          // 如果图片加载失败，清理URL
                          setAlbumCoverUrls(prev => {
                            const { [track.id]: removed, ...rest } = prev;
                            if (removed) URL.revokeObjectURL(removed);
                            return rest;
                          });
                        }}
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
                      {/* 歌曲名称 */}
                      <div className="font-medium text-slate-900 dark:text-dark-900 group-hover:text-brand-600 transition-colors duration-200 ease-out text-[13px] leading-tight truncate" title={track.title || '未知标题'}>
                        {track.title || '未知标题'}
                      </div>
                      {/* 歌手名称 */}
                      <div className="text-slate-500 dark:text-dark-600 text-[11px] leading-tight truncate mt-0.5 group-hover:text-slate-600 dark:group-hover:text-dark-700 transition-colors duration-150" title={track.artist || '未知艺术家'}>
                        {track.artist || '未知艺术家'}
                      </div>
                    </div>
                    {/* 收藏按钮（移动到专辑列之前） */}
                    {showFavoriteButtons && (
                      <div className="ml-3 hidden md:flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={(e) => toggleFavorite(track, e)}
                          className={`
                            w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150
                            bg-transparent
                            ${favoriteStates[track.id]
                              ? 'text-red-500 hover:text-red-600'
                              : 'text-slate-400 dark:text-dark-600 hover:text-red-500'}
                          `}
                          title={favoriteStates[track.id] ? '取消收藏' : '收藏'}
                        >
                          <svg className="w-3.5 h-3.5" fill={favoriteStates[track.id] ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </td>
              
              {/* 专辑列 */}
              <td className="px-6 py-0 text-slate-700 dark:text-dark-700 font-medium text-sm leading-relaxed hidden md:table-cell" style={{ paddingTop: rowPaddingY, paddingBottom: rowPaddingY }}>
                <span className="truncate block" title={track.album || '未知专辑'}>
                  {track.album || '未知专辑'}
                </span>
              </td>
              <td className="px-6 py-0 text-slate-700 dark:text-dark-700 font-mono text-sm leading-relaxed font-medium min-w-32 text-center relative" style={{ paddingTop: rowPaddingY, paddingBottom: rowPaddingY }}>
                {/* 时长显示 - 绝对居中，不受收藏按钮影响 */}
                <div className="flex items-center justify-center w-full">
                  <span className={`
                    transition-all duration-200 font-mono
                    ${hoveredRowId === track.id && showFavoriteButtons ? 'text-slate-500 dark:text-dark-600' : 'text-slate-700 dark:text-dark-700'}
                  `}>
                    {formatDuration(track.duration_ms)}
                  </span>
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
