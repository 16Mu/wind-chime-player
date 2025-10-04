import { useMemo, useState, useEffect } from 'react';
import type { Track } from '../types/music';

interface Artist {
  name: string;
  trackCount: number;
  tracks: Track[];
}

interface ArtistsViewProps {
  tracks: Track[];
  onTrackSelect: (track: Track) => void;
  isLoading: boolean;
}

export default function ArtistsView({ tracks, onTrackSelect, isLoading }: ArtistsViewProps) {
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);

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

  const selectedArtistData = selectedArtist 
    ? artists.find(a => a.name === selectedArtist) 
    : null;

  // ESC键关闭抽屉
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedArtist) {
        setSelectedArtist(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedArtist]);

  return (
    <div className="albums-view-container">
      {/* 艺术家网格 */}
      <div className={`albums-grid-container ${selectedArtist ? 'has-selection' : ''}`}>
        {artists.map((artist) => {
          const isSelected = selectedArtist === artist.name;
          
          return (
            <div 
              key={`${artist.name}-${selectedArtist ? 'list' : 'grid'}`}
              className={`artist-card-modern ${isSelected ? 'album-card-selected' : ''}`}
              onClick={() => {
                setSelectedArtist(artist.name);
              }}
            >
              {/* 头像区域 */}
              <div className="artist-avatar-modern">
                <span className="artist-initial-modern">
                  {artist.name.charAt(0).toUpperCase()}
                </span>
                {/* 悬停播放按钮 */}
                <div className="artist-play-btn-modern">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>

              {/* 艺术家信息 */}
              <div className="artist-info-modern">
                <h3 className="artist-name-modern" title={artist.name}>
                  {artist.name}
                </h3>
                <p className="artist-meta-modern">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>歌手</span>
                  <span className="artist-dot">•</span>
                  <span>{artist.trackCount} 首歌曲</span>
                </p>
              </div>

              {/* 选中指示器 */}
              {isSelected && (
                <div className="album-selected-indicator">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 右侧抽屉 */}
      {selectedArtistData && (
        <div className="album-drawer">
          {/* 返回按钮 */}
          <button 
            className="album-drawer-back-btn"
            onClick={() => setSelectedArtist(null)}
            title="返回（ESC）"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>返回</span>
          </button>

          {/* 头部 - 艺术家头像和信息 */}
          <div className="album-drawer-header">
            <div className="album-drawer-cover">
              <div className="album-drawer-cover-placeholder" style={{ borderRadius: '50%' }}>
                <div className="artist-avatar-modern" style={{ width: '100%', height: '100%', margin: 0 }}>
                  <span className="artist-initial-modern" style={{ fontSize: '4rem' }}>
                    {selectedArtistData.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <div className="album-drawer-info">
              <span className="album-drawer-badge">艺术家</span>
              <h2 className="album-drawer-name">{selectedArtistData.name}</h2>
              <p className="album-drawer-stats">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                共 {selectedArtistData.trackCount} 首歌曲
              </p>
              
              <button 
                className="album-drawer-play-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedArtistData.tracks.length > 0) {
                    onTrackSelect(selectedArtistData.tracks[0]);
                  }
                }}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                播放全部
              </button>
            </div>
          </div>

          {/* 歌曲列表 - 表格式 */}
          <div className="album-drawer-tracks">
            <div className="album-drawer-tracks-header">
              <div className="drawer-track-col-number">#</div>
              <div className="drawer-track-col-title">标题</div>
              <div className="drawer-track-col-artist">专辑</div>
              <div className="drawer-track-col-duration">时长</div>
            </div>
            
            <div className="album-drawer-tracks-body">
              {selectedArtistData.tracks.map((track, index) => (
                <div
                  key={track.id}
                  className="album-drawer-track-row"
                  onClick={() => onTrackSelect(track)}
                >
                  <div className="drawer-track-col-number">
                    <span className="drawer-track-number">{index + 1}</span>
                    <svg className="drawer-track-play-icon w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <div className="drawer-track-col-title">{track.title || '未知标题'}</div>
                  <div className="drawer-track-col-artist">{track.album || '未知专辑'}</div>
                  <div className="drawer-track-col-duration">
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
}
