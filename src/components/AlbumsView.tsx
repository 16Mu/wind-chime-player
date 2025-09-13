import { useMemo, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
}

interface Album {
  name: string;
  artist: string;
  trackCount: number;
  tracks: Track[];
  coverUrl?: string;
}

interface AlbumsViewProps {
  tracks: Track[];
  onTrackSelect: (track: Track) => void;
  isLoading: boolean;
}

export default function AlbumsView({ tracks, onTrackSelect, isLoading }: AlbumsViewProps) {
  const [albumCovers, setAlbumCovers] = useState<Map<string, string>>(new Map());
  // 封面刷新触发器
  const [coverRefreshTrigger, setCoverRefreshTrigger] = useState(0);

  // 临时：在控制台提供测试和重新扫描函数
  useEffect(() => {
    (window as any).rescanCovers = async () => {
      try {
        console.log('🔄 开始重新扫描封面数据...');
        await invoke('library_rescan_covers');
        console.log('✅ 重新扫描请求已发送');
        // 清空当前封面缓存，强制重新加载
        setAlbumCovers(new Map());
        setCoverRefreshTrigger(prev => prev + 1);
      } catch (error) {
        console.error('❌ 重新扫描失败:', error);
      }
    };

    (window as any).testAudioCover = async (filePath: string) => {
      try {
        console.log('🔍 测试音频文件封面:', filePath);
        const result = await invoke('test_audio_cover', { filePath }) as string;
        console.log('📋 音频文件分析结果:\n', result);
        return result;
      } catch (error) {
        console.error('❌ 测试失败:', error);
        return error;
      }
    };

    // 提供快捷测试函数
    (window as any).testTracks = () => {
      console.log('📝 可用的测试命令:');
      console.log('1. testAudioCover("E:\\\\Music\\\\鹿晗 - 我们的明天.flac")');
      console.log('2. testAudioCover("E:\\\\Music\\\\邓超 _ 陈赫 _ 范志毅 _ 王勉 _ 李乃文 _ 王俊凯 - 耙耳朵.flac")');
      console.log('3. rescanCovers()');
    };
  }, []);
  
  const albums = useMemo(() => {
    const albumMap = new Map<string, Album>();

    tracks.forEach(track => {
      const albumName = track.album || '未知专辑';
      const artistName = track.artist || '未知艺术家';
      const albumKey = `${albumName}::${artistName}`;
      
      if (!albumMap.has(albumKey)) {
        albumMap.set(albumKey, {
          name: albumName,
          artist: artistName,
          trackCount: 0,
          tracks: [],
          coverUrl: albumCovers.get(albumKey)
        });
      }

      const album = albumMap.get(albumKey)!;
      album.trackCount++;
      album.tracks.push(track);
    });

    return Array.from(albumMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tracks, albumCovers]);

  // 为每个专辑加载封面
  useEffect(() => {
    const loadAlbumCovers = async () => {
      const newCovers = new Map<string, string>();
      
      for (const album of albums) {
        const albumKey = `${album.name}::${album.artist}`;
        
        // 如果已经有封面了且不是强制刷新，跳过
        if (albumCovers.has(albumKey) && coverRefreshTrigger === 0) {
          newCovers.set(albumKey, albumCovers.get(albumKey)!);
          continue;
        }
        
        // 使用专辑第一首歌的封面
        const firstTrack = album.tracks[0];
        if (firstTrack) {
          try {
            console.log(`🎨 尝试加载专辑封面: ${albumKey}, trackId: ${firstTrack.id}`);
            const result = await invoke('get_album_cover', { trackId: firstTrack.id }) as [number[], string] | null;
            if (result) {
              const [imageData, mimeType] = result;
              console.log(`✅ 成功获取封面数据: ${imageData.length} 字节, MIME: ${mimeType}`);
              const blob = new Blob([new Uint8Array(imageData)], { type: mimeType });
              const url = URL.createObjectURL(blob);
              newCovers.set(albumKey, url);
              console.log(`🖼️ 封面URL已创建: ${albumKey}`);
            } else {
              console.log(`❌ 未获取到封面数据: ${albumKey}`);
            }
          } catch (error) {
            console.error(`❌ 加载专辑封面失败 (${albumKey}):`, error);
          }
        }
      }
      
      if (newCovers.size > 0) {
        setAlbumCovers(prev => new Map([...prev, ...newCovers]));
      }
    };

    if (albums.length > 0) {
      loadAlbumCovers();
    }
  }, [albums.length, coverRefreshTrigger]);

  // 清理URL对象
  useEffect(() => {
    return () => {
      albumCovers.forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  if (isLoading && tracks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center glass-card max-w-md">
          <div className="text-slate-400 mb-6">
            <svg className="w-16 h-16 mx-auto animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-contrast-primary mb-3">
            正在加载专辑...
          </h3>
          <p className="text-contrast-secondary mb-6 text-base font-medium">
            请稍候，正在获取您的音乐数据
          </p>
        </div>
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center glass-card max-w-md">
          <div className="text-slate-400 mb-6">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-contrast-primary mb-3">
            暂无专辑
          </h3>
          <p className="text-contrast-secondary mb-6 text-base font-medium">
            点击上方的"选择文件夹扫描"按钮，添加音乐到您的库中
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {albums.map((album) => (
        <div key={`${album.name}::${album.artist}`} className="glass-surface rounded-2xl p-6 glass-interactive hover:shadow-lg transition-all duration-300">
          <div className="text-center mb-4">
            <div className="w-20 h-20 rounded-xl mx-auto mb-4 overflow-hidden shadow-lg">
              {albumCovers.get(`${album.name}::${album.artist}`) ? (
                <img 
                  src={albumCovers.get(`${album.name}::${album.artist}`)}
                  alt={`${album.name} 专辑封面`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // 加载失败时显示默认图标
                    e.currentTarget.style.display = 'none';
                    const nextSibling = e.currentTarget.nextElementSibling as HTMLElement;
                    if (nextSibling) {
                      nextSibling.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div className={`w-full h-full bg-gradient-to-br from-purple-600 to-pink-400 flex items-center justify-center ${albumCovers.get(`${album.name}::${album.artist}`) ? 'hidden' : ''}`}>
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-bold text-contrast-primary mb-1 truncate" title={album.name}>
              {album.name}
            </h3>
            <p className="text-sm text-contrast-secondary truncate mb-2" title={album.artist}>
              {album.artist}
            </p>
            <p className="text-xs text-contrast-tertiary">
              {album.trackCount} 首歌曲
            </p>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {album.tracks.slice(0, 5).map((track) => (
              <div
                key={track.id}
                className="flex items-center justify-between p-3 rounded-lg glass-surface-subtle glass-interactive cursor-pointer hover:bg-surface-secondary transition-colors group"
                onClick={() => {
                  console.log('🎵 AlbumsView - 播放曲目:', track);
                  onTrackSelect(track);
                }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-contrast-primary text-sm truncate group-hover:text-purple-600 transition-colors">
                      {track.title || '未知标题'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            
            {album.tracks.length > 5 && (
              <div className="text-center py-2">
                <span className="text-xs text-contrast-secondary">
                  还有 {album.tracks.length - 5} 首歌曲...
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
