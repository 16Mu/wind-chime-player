import { useMemo } from 'react';

interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
}

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
          <div className="text-slate-400 mb-6">
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

  return (
    <div className="artists-modern-grid">
      {artists.map((artist) => (
        <div 
          key={artist.name} 
          className="artist-card-modern"
          onClick={() => {
            console.log('🎵 ArtistsView - 播放艺术家全部歌曲:', artist.name);
            if (artist.tracks.length > 0) {
              onTrackSelect(artist.tracks[0]);
            }
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
        </div>
      ))}
    </div>
  );
}
