import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { Track } from '../types/music';
import { useCoverCache } from '../contexts/CoverCacheContext';

interface Artist {
  name: string;
  trackCount: number;
  tracks: Track[];
  coverUrl?: string; // 艺术家封面URL
}

interface ArtistsViewProps {
  tracks: Track[];
  onTrackSelect: (track: Track) => void;
  isLoading: boolean;
}

// 🚀 性能优化：使用React.memo避免不必要的重渲染
export default React.memo(function ArtistsView({ tracks, onTrackSelect, isLoading }: ArtistsViewProps) {
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [displayArtist, setDisplayArtist] = useState<string | null>(null);
  
  // 使用全局封面缓存
  const { artistCovers, loadArtistCovers } = useCoverCache();
  
  // 防止重复加载
  const loadTriggeredRef = useRef(false);

  // 同步 displayArtist
  useEffect(() => {
    if (selectedArtist && !isExiting) {
      setDisplayArtist(selectedArtist);
    }
  }, [selectedArtist, isExiting]);

  const artists = useMemo(() => {
    const artistMap = new Map<string, Artist>();

    tracks.forEach(track => {
      const artistString = track.artist || '未知艺术家';
      
      // 分离合作艺术家：支持 "/" 、"、"、"&"、"feat."、"featuring"等分隔符
      const separators = [/\s*\/\s*/, /\s*、\s*/, /\s*&\s*/, /\s*feat\.?\s+/i, /\s*featuring\s+/i, /\s*ft\.?\s+/i];
      let artistNames = [artistString];
      
      separators.forEach(separator => {
        const newNames: string[] = [];
        artistNames.forEach(name => {
          const split = name.split(separator);
          newNames.push(...split);
        });
        artistNames = newNames;
      });
      
      // 清理艺术家名称并添加到map中
      artistNames.forEach(artistName => {
        const cleanName = artistName.trim();
        if (cleanName && cleanName !== '未知艺术家') {
          if (!artistMap.has(cleanName)) {
            artistMap.set(cleanName, {
              name: cleanName,
              trackCount: 0,
              tracks: []
            });
          }
          
          const artist = artistMap.get(cleanName)!;
          // 避免重复添加同一首歌
          if (!artist.tracks.some(t => t.id === track.id)) {
            artist.trackCount++;
            artist.tracks.push(track);
          }
        }
      });
      
      // 如果没有有效的艺术家名称，添加到"未知艺术家"
      if (artistNames.length === 0 || artistNames.every(name => !name.trim())) {
        if (!artistMap.has('未知艺术家')) {
          artistMap.set('未知艺术家', {
            name: '未知艺术家',
            trackCount: 0,
            tracks: []
          });
        }
        
        const unknownArtist = artistMap.get('未知艺术家')!;
        if (!unknownArtist.tracks.some(t => t.id === track.id)) {
          unknownArtist.trackCount++;
          unknownArtist.tracks.push(track);
        }
      }
    });

    return Array.from(artistMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tracks]);

  // 🚀 使用全局缓存加载封面（只加载一次，所有视图共享）
  useEffect(() => {
    if (artists.length > 0 && !loadTriggeredRef.current) {
      loadTriggeredRef.current = true;
      loadArtistCovers();
    }
  }, [artists.length, loadArtistCovers]);

  if (isLoading && tracks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center glass-card max-w-md">
          <div className="flex justify-center mb-6">
            <div className="ring-loader" style={{ width: '64px', height: '64px', borderWidth: '4px' }}></div>
          </div>
          <h3 className="text-xl font-bold text-contrast-primary mb-3">
            正在加载艺术家
          </h3>
          <div className="loading-dots flex justify-center" style={{ fontSize: '8px' }}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    );
  }

  if (artists.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center glass-card max-w-md">
          <div className="text-slate-400 dark:text-dark-700 mb-6">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-contrast-primary mb-3">
            暂无艺术家
          </h3>
          <p className="text-contrast-secondary mb-6 text-base font-medium">
            点击上方的"选择文件夹扫描"按钮，添加音乐到您的库中
          </p>
        </div>
      </div>
    );
  }

  const selectedArtistData = displayArtist 
    ? artists.find(a => a.name === displayArtist) 
    : null;

  // 关闭抽屉
  const handleCloseDrawer = () => {
    setIsExiting(true);
    // 等待所有退出动画完成后再卸载
    setTimeout(() => {
      setSelectedArtist(null);
      setDisplayArtist(null);
      setIsExiting(false);
    }, 500); // 增加时间，确保动画完成
  };

  // ESC键关闭抽屉
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedArtist) {
        handleCloseDrawer();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedArtist]);

  // 鼠标高光跟随效果 - 与专辑视图一致
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const artEl = e.currentTarget as HTMLDivElement;
    
    const rect = artEl.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;  // 0..1
    const y = (e.clientY - rect.top) / rect.height;  // 0..1
    
    // 计算高光强度（靠近中心更强）
    const cx = Math.abs(x - 0.5) * 2;
    const cy = Math.abs(y - 0.5) * 2;
    const dist = Math.sqrt(cx * cx + cy * cy);
    const strength = Math.max(0, 1 - dist);
    
    // 计算角度（用于渐变方向）
    const angle = Math.atan2(y - 0.5, x - 0.5) * 180 / Math.PI;
    
    artEl.style.setProperty('--mx', x.toFixed(3));
    artEl.style.setProperty('--my', y.toFixed(3));
    artEl.style.setProperty('--gloss', (0.3 + 0.7 * strength).toFixed(3));
    artEl.style.setProperty('--ang', angle.toFixed(1));
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const artEl = e.currentTarget as HTMLDivElement;
    artEl.style.setProperty('--gloss', '0');
  };

  return (
    <div className={`flex ${selectedArtist ? 'gap-3' : ''} h-full`}>
      {/* 艺术家网格 */}
      <div className={`${selectedArtist || isExiting ? 'w-64 flex-shrink-0 overflow-y-auto' : 'w-full overflow-y-auto'} transition-all duration-500 ease-out`}>
        <div className={`grid gap-2 ${selectedArtist || isExiting ? 'grid-cols-1 pb-[68px]' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 pt-0 pb-[68px]'}`}>
        {artists.map((artist, index) => {
          const isSelected = selectedArtist === artist.name;
          // 限制动画延迟最大值，避免累积过长
          const maxDelay = 800; // 最大延迟800ms
          const enterDelay = Math.min(index * 30, maxDelay);
          const exitDelay = Math.min(index * 20, maxDelay);
          
          return (
            <div 
              key={`${artist.name}-${selectedArtist ? 'list' : 'grid'}-${isExiting ? 'exiting' : 'entering'}`}
              className={`
                artist-card-hover group cursor-pointer transition-all duration-200 
                ${isSelected ? 'bg-purple-50 dark:bg-purple-900/30 border-l-4 border-purple-500 dark:border-purple-400' : 'hover:bg-slate-50 dark:hover:bg-dark-200/50'} 
                ${selectedArtist ? 'rounded-lg p-2 flex items-center gap-3' : 'rounded-lg p-1.5'}
                ${isExiting ? 'animate-fadeOutLeft' : 'animate-fadeInUp'}
              `}
              style={{
                animationDelay: isExiting ? `${exitDelay}ms` : `${enterDelay}ms`
              }}
              onClick={() => {
                setSelectedArtist(artist.name);
              }}
            >
              {/* 头像区域 */}
              <div 
                className={`artist-avatar-gloss relative ${selectedArtist ? 'w-14 h-14 flex-shrink-0' : 'aspect-square'} rounded-md overflow-hidden bg-gradient-to-br from-brand-400 to-brand-600 shadow-sm ${selectedArtist ? '' : 'mb-1.5'} flex items-center justify-center`}
                onMouseMove={!selectedArtist ? handleMouseMove : undefined}
                onMouseLeave={!selectedArtist ? handleMouseLeave : undefined}
              >
                {artistCovers.has(artist.name) ? (
                  <img 
                    src={artistCovers.get(artist.name)} 
                    alt={artist.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // 图片加载失败时隐藏
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span className={`font-bold text-white ${selectedArtist ? 'text-2xl' : 'text-3xl'}`}>
                    {artist.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* 艺术家信息 */}
              <div className={selectedArtist ? 'flex-1 min-w-0' : 'space-y-0.5'}>
                <h3 className={`font-medium text-slate-900 dark:text-dark-900 truncate group-hover:text-brand-600 transition-colors ${selectedArtist ? 'text-sm mb-1' : 'text-sm'}`} title={artist.name}>
                  {artist.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-dark-600">
                  艺术家 • {artist.trackCount} 首
                </p>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* 右侧歌曲列表 */}
      {selectedArtistData && (
        <div 
          className={`flex-1 bg-white dark:bg-dark-100 rounded-lg border border-slate-200 dark:border-dark-400 flex flex-col overflow-hidden ${isExiting ? 'drawer-exit' : 'drawer-enter'}`}
        >
          {/* 头部 - 艺术家信息 */}
          <div className="flex-shrink-0 flex items-center gap-4 p-4 border-b border-slate-200 dark:border-dark-400">
            {/* 头像 */}
            <div className="w-24 h-24 flex-shrink-0 rounded-full overflow-hidden shadow-md bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
              {artistCovers.has(selectedArtistData.name) ? (
                <img 
                  src={artistCovers.get(selectedArtistData.name)} 
                  alt={selectedArtistData.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl font-bold text-white">
                  {selectedArtistData.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            
            {/* 信息和按钮 */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-dark-900 mb-1 truncate">{selectedArtistData.name}</h2>
              <p className="text-sm text-slate-600 dark:text-dark-700 mb-2">艺术家</p>
              <div className="flex items-center gap-3">
                <button 
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white rounded-full text-sm font-medium flex items-center gap-2 transition-colors shadow-md"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectedArtistData.tracks.length > 0) {
                      onTrackSelect(selectedArtistData.tracks[0]);
                    }
                  }}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  播放全部
                </button>
                <button
                  onClick={handleCloseDrawer}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-dark-700 hover:text-slate-900 dark:hover:text-dark-900 flex items-center gap-1.5 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  返回
                </button>
              </div>
            </div>
          </div>

          {/* 歌曲列表 */}
          <div className="flex-1 overflow-y-auto pb-[68px]">
            {/* 表头 */}
            <div className="grid grid-cols-12 gap-3 px-4 py-2 text-xs font-medium text-slate-500 dark:text-dark-600 border-b border-slate-200/50 dark:border-dark-400/50 sticky top-0 bg-white dark:bg-dark-100 z-10">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-7">标题</div>
              <div className="col-span-3">专辑</div>
              <div className="col-span-1 text-center">时长</div>
            </div>
            
            {/* 歌曲行 */}
            <div className="px-2 py-2">
              {selectedArtistData.tracks.map((track, index) => (
                <div
                  key={track.id}
                  className="grid grid-cols-12 gap-3 px-2 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-dark-200/50 cursor-pointer group transition-colors animate-fadeInUp"
                  style={{
                    animationDelay: `${index * 30}ms`
                  }}
                  onClick={() => onTrackSelect(track)}
                >
                  <div className="col-span-1 flex items-center justify-center text-xs text-slate-500 dark:text-dark-600 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                    <span className="group-hover:hidden">{index + 1}</span>
                    <svg className="w-3 h-3 hidden group-hover:block" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <div className="col-span-7 min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-dark-900 truncate">{track.title || '未知标题'}</div>
                  </div>
                  <div className="col-span-3 flex items-center min-w-0">
                    <div className="text-xs text-slate-600 dark:text-dark-700 truncate">{track.album || '未知专辑'}</div>
                  </div>
                  <div className="col-span-1 flex items-center justify-center text-xs text-slate-500 dark:text-dark-600 font-mono">
                    {track.duration_ms 
                      ? `${Math.floor(track.duration_ms / 60000)}:${String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}`
                      : '--:--'
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
