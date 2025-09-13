import { useMemo, useState } from 'react';

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
          <div className="text-slate-400 mb-6">
            <svg className="w-16 h-16 mx-auto animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-contrast-primary mb-3">
            正在加载艺术家...
          </h3>
          <p className="text-contrast-secondary mb-6 text-base font-medium">
            请稍候，正在获取您的音乐数据
          </p>
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

  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {artists.map((artist) => (
        <div key={artist.name} className="glass-surface rounded-2xl p-6 glass-interactive hover:shadow-lg transition-all duration-300">
          
          {/* 艺术家头像区域 */}
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-full mx-auto mb-4 overflow-hidden shadow-lg">
              <div className="w-full h-full bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 flex items-center justify-center relative">
                {/* 艺术家首字母 */}
                <span className="text-white text-2xl font-bold">
                  {artist.name.charAt(0).toUpperCase()}
                </span>
                {/* 音乐图标装饰 */}
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
                  <svg className="w-8 h-8 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <h3 className="text-lg font-bold text-contrast-primary mb-2 truncate" title={artist.name}>
              {artist.name}
            </h3>
            <p className="text-sm text-contrast-secondary flex items-center justify-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              {artist.trackCount} 首歌曲
            </p>
          </div>

          {/* 操作按钮区域 */}
          <div className="space-y-3">
            {/* 播放全部按钮 */}
            <button
              onClick={() => {
                console.log('🎵 ArtistsView - 播放艺术家全部歌曲:', artist.name);
                if (artist.tracks.length > 0) {
                  onTrackSelect(artist.tracks[0]); // 播放第一首歌
                }
              }}
              className="w-full glass-interactive flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border border-white/10 transition-all duration-300"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="font-medium text-contrast-primary">播放全部</span>
            </button>

            {/* 展开/收起歌曲列表按钮 */}
            <button
              onClick={() => setExpandedArtist(expandedArtist === artist.name ? null : artist.name)}
              className="w-full glass-interactive flex items-center justify-center gap-2 py-2 px-4 rounded-xl hover:bg-white/5 border border-white/5 transition-all duration-300"
            >
              <span className="text-sm text-contrast-secondary">歌曲列表</span>
              <svg 
                className={`w-4 h-4 text-contrast-secondary transition-transform duration-300 ${
                  expandedArtist === artist.name ? 'rotate-180' : ''
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* 可展开的歌曲列表 */}
          {expandedArtist === artist.name && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {artist.tracks.map((track, index) => (
                  <button
                    key={track.id}
                    type="button"
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg glass-interactive text-left hover:bg-white/5 group transition-all duration-200"
                    onClick={() => {
                      console.log('🎵 ArtistsView - 播放曲目:', track);
                      onTrackSelect(track);
                    }}
                    title={track.title || '未知标题'}
                  >
                    {/* 序号 */}
                    <span className="text-xs text-contrast-secondary min-w-[20px] text-center group-hover:text-contrast-primary transition-colors">
                      {(index + 1).toString().padStart(2, '0')}
                    </span>
                    
                    {/* 播放图标 */}
                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-500/20 transition-all duration-200">
                      <svg className="w-3 h-3 text-contrast-secondary group-hover:text-blue-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    
                    {/* 歌曲标题 */}
                    <span className="truncate text-sm text-contrast-primary font-medium flex-1">
                      {track.title || '未知标题'}
                    </span>
                    
                    {/* 时长 */}
                    {track.duration_ms && (
                      <span className="text-xs text-contrast-secondary whitespace-nowrap">
                        {Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
