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
  // 模糊背景条设置
  blurBackdropSettings?: {
    enabled: boolean;
    intensity: 'low' | 'medium' | 'high';
    opacity: number; // 0-1
  };
  // 收藏功能设置（可选）
  showFavoriteButtons?: boolean; // 是否显示收藏按钮
  onFavoriteChange?: (trackId: number, isFavorite: boolean) => void; // 收藏状态变化回调
}

export default function TracksView({ 
  tracks, 
  onTrackSelect, 
  isLoading,
  blurBackdropSettings = { enabled: true, intensity: 'medium', opacity: 0.8 },
  showFavoriteButtons = false,
  onFavoriteChange
}: TracksViewProps) {

  // 收藏状态管理
  const [favoriteStates, setFavoriteStates] = useState<{ [trackId: number]: boolean }>({});
  
  // 悬停状态管理 - 追踪哪一行正在被悬停
  const [hoveredRowId, setHoveredRowId] = useState<number | null>(null);
  
  // 专辑封面状态管理
  const [albumCoverUrls, setAlbumCoverUrls] = useState<{ [trackId: number]: string }>({});
  
  // 模糊背景条状态管理
  const [backdropPosition, setBackdropPosition] = useState<{ top: number; visible: boolean }>({ top: 0, visible: false });
  const containerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

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

  // 模糊背景条动画处理 - 优化版本，减少抖动
  const updateBackdropPosition = (targetTop: number) => {
    if (!blurBackdropSettings.enabled || !backdropRef.current) return;
    
    // 取消之前的动画
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    // 直接设置位置，使用CSS transition来处理平滑动画
    const backdrop = backdropRef.current;
    backdrop.style.top = `${targetTop}px`;
    
    // 添加短暂的弹性效果
    backdrop.style.transform = 'scale(1.02)';
    backdrop.style.transition = 'top 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s ease-out';
    
    // 200ms后移除缩放效果
    setTimeout(() => {
      if (backdrop && backdrop.style) {
        backdrop.style.transform = 'scale(1)';
        backdrop.style.transition = 'top 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s ease-out';
      }
    }, 150);
  };
  
  // 处理鼠标进入和移动
  const handleRowMouseEnter = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if (!blurBackdropSettings.enabled || !containerRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    const relativeTop = rect.top - containerRect.top;
    
    setBackdropPosition({ top: relativeTop, visible: true });
    updateBackdropPosition(relativeTop);
  };
  
  const handleContainerMouseLeave = () => {
    if (!blurBackdropSettings.enabled) return;
    setBackdropPosition(prev => ({ ...prev, visible: false }));
    
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
      className="glass-surface rounded-xl overflow-hidden relative"
      onMouseLeave={handleContainerMouseLeave}
    >
      {/* 模糊背景条 */}
      {blurBackdropSettings.enabled && (
        <div
          ref={backdropRef}
          className={`blur-backdrop ${
            backdropPosition.visible ? 'active' : ''
          } ${
            blurBackdropSettings.intensity === 'high' ? 'high-intensity' : 
            blurBackdropSettings.intensity === 'low' ? 'low-intensity' : ''
          }`}
          style={{
            top: `${backdropPosition.top}px`,
            opacity: backdropPosition.visible ? blurBackdropSettings.opacity : 0
          }}
        />
      )}
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-white/40 backdrop-blur-md border-b border-white/30">
          <tr>
            {/* 封面 + 歌名/歌手合并列 */}
            <th className="px-6 py-3 text-left text-xs font-semibold text-contrast-primary tracking-wider hover:bg-slate-50/50 transition-colors cursor-pointer group">
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
            <th className="px-6 py-3 text-left text-xs font-semibold text-contrast-primary tracking-wider hover:bg-slate-50/50 transition-colors cursor-pointer group hidden md:table-cell">
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
            <th className="px-6 py-3 text-center text-xs font-semibold text-contrast-primary tracking-wider hover:bg-slate-50/50 transition-colors cursor-pointer group min-w-32">
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
          {tracks.map((track, index) => (
            <tr
              ref={(el) => { rowRefs.current[index] = el; }}
              key={track.id}
              className={`
                border-b border-white/30 glass-interactive cursor-pointer group
                bg-slate-50/60 backdrop-blur-md
                hover:bg-slate-100/50 hover:backdrop-blur-lg hover:shadow-sm
                active:bg-slate-100/60 active:scale-[0.995]
                transition-all duration-200 ease-out
                relative z-10
              `}
              onClick={() => {
                console.log('🎵 TracksView - 播放曲目:', track);
                onTrackSelect(track);
              }}
              onMouseEnter={(e) => {
                setHoveredRowId(track.id);
                handleRowMouseEnter(e);
              }}
              onMouseLeave={() => setHoveredRowId(null)}
            >
              {/* 封面 + 歌曲信息列 */}
              <td className="px-6 py-3">
                <div className="flex items-center gap-4 min-w-0">
                  {/* 专辑封面缩略图 */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-slate-100/80 backdrop-blur-sm border border-white/40 shadow-sm ring-1 ring-black/5">
                    {albumCoverUrls[track.id] ? (
                      <img 
                        src={albumCoverUrls[track.id]} 
                        alt={`${track.album || '未知专辑'} 封面`}
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
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
                      <div className="font-medium text-slate-900 group-hover:text-brand-600 transition-colors duration-150 ease-out text-sm leading-tight truncate" title={track.title || '未知标题'}>
                        {track.title || '未知标题'}
                      </div>
                      {/* 歌手名称 */}
                      <div className="text-slate-500 text-xs leading-tight truncate mt-0.5 group-hover:text-slate-600 transition-colors duration-150" title={track.artist || '未知艺术家'}>
                        {track.artist || '未知艺术家'}
                      </div>
                    </div>
                  </div>
                </div>
              </td>
              
              {/* 专辑列 */}
              <td className="px-6 py-3 text-slate-700 font-medium text-sm leading-relaxed hidden md:table-cell">
                <span className="truncate block" title={track.album || '未知专辑'}>
                  {track.album || '未知专辑'}
                </span>
              </td>
              <td className="px-6 py-3 text-slate-700 font-mono text-sm leading-relaxed font-medium min-w-32 text-center relative">
                {/* 时长显示 - 绝对居中，不受收藏按钮影响 */}
                <div className="flex items-center justify-center w-full">
                  <span className={`
                    transition-all duration-200 font-mono
                    ${hoveredRowId === track.id && showFavoriteButtons ? 'text-slate-500' : 'text-slate-700'}
                  `}>
                    {formatDuration(track.duration_ms)}
                  </span>
                </div>
                
                {/* 收藏按钮 - 绝对定位在右侧，不影响时长居中 */}
                {showFavoriteButtons && (
                  <div className={`
                    absolute top-1/2 right-2 -translate-y-1/2
                    transition-all duration-200 ease-in-out
                    ${hoveredRowId === track.id 
                      ? 'opacity-100 translate-x-0 scale-100' 
                      : 'opacity-0 translate-x-2 scale-95 pointer-events-none'
                    }
                  `}>
                    <button
                      onClick={(e) => toggleFavorite(track, e)}
                      className={`
                        w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110
                        ${favoriteStates[track.id] 
                          ? 'text-red-500 hover:text-red-600 hover:bg-red-50' 
                          : 'text-slate-400 hover:text-red-400 hover:bg-slate-50'
                        }
                      `}
                      title={favoriteStates[track.id] ? '取消收藏' : '收藏'}
                    >
                      <svg className="w-3 h-3" fill={favoriteStates[track.id] ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
