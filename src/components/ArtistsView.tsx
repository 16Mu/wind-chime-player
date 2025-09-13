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
      const artistName = track.artist || '未知艺术家';
      
      if (!artistMap.has(artistName)) {
        artistMap.set(artistName, {
          name: artistName,
          trackCount: 0,
          tracks: []
        });
      }

      const artist = artistMap.get(artistName)!;
      artist.trackCount++;
      artist.tracks.push(track);
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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-3">
      {artists.map((artist) => (
        <div key={artist.name} className="glass-surface rounded-lg p-3 ring-1 ring-white/10">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm md:text-base font-semibold text-contrast-primary truncate" title={artist.name}>
              {artist.name}
            </h3>
            <span className="text-xs text-contrast-secondary whitespace-nowrap">
              {artist.trackCount} 首
            </span>
          </div>

          <div className="space-y-1 max-h-40 overflow-auto pr-1">
            {artist.tracks.map((track) => (
              <button
                key={track.id}
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded glass-interactive text-left hover:bg-surface-secondary/40"
                onClick={() => {
                  console.log('🎵 ArtistsView - 播放曲目:', track);
                  onTrackSelect(track);
                }}
                title={track.title || '未知标题'}
              >
                <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span className="truncate text-sm text-contrast-primary">
                  {track.title || '未知标题'}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
