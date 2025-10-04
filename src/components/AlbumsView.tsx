import { useMemo, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Track } from '../types/music';

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

  // 开发环境：在控制台提供测试和重新扫描函数（生产环境移除）
  useEffect(() => {
    if (import.meta.env.DEV) {
      // 使用命名空间避免污染全局作用域
      if (!(window as any).__windChimePlayer) {
        (window as any).__windChimePlayer = {};
      }
      
      (window as any).__windChimePlayer.rescanCovers = async () => {
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

      (window as any).__windChimePlayer.testAudioCover = async (filePath: string) => {
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
      (window as any).__windChimePlayer.testTracks = () => {
        console.log('📝 可用的测试命令:');
        console.log('1. __windChimePlayer.testAudioCover("E:\\\\Music\\\\鹿晗 - 我们的明天.flac")');
        console.log('2. __windChimePlayer.testAudioCover("E:\\\\Music\\\\邓超 _ 陈赫 _ 范志毅 _ 王勉 _ 李乃文 _ 王俊凯 - 耙耳朵.flac")');
        console.log('3. __windChimePlayer.rescanCovers()');
      };

      console.log('🛠️ [开发模式] 调试工具已加载，输入 __windChimePlayer.testTracks() 查看可用命令');
      
      // 清理函数：组件卸载时移除
      return () => {
        if ((window as any).__windChimePlayer) {
          delete (window as any).__windChimePlayer;
        }
      };
    }
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
            const result = await invoke('get_album_cover', { track_id: firstTrack.id, trackId: firstTrack.id }) as [number[], string] | null;
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
          <div className="flex justify-center mb-6">
            <div className="ring-loader" style={{ width: '64px', height: '64px', borderWidth: '4px' }}></div>
          </div>
          <h3 className="text-xl font-bold text-contrast-primary mb-3">
            正在加载专辑
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

  if (albums.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center glass-card max-w-md">
          <div className="text-slate-400 dark:text-dark-700 mb-6">
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

  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);

  const selectedAlbumData = selectedAlbum 
    ? albums.find(a => `${a.name}::${a.artist}` === selectedAlbum) 
    : null;

  // ESC键关闭抽屉
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedAlbum) {
        setSelectedAlbum(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedAlbum]);

  return (
    <div className="albums-view-container">
      {/* 专辑网格 */}
      <div className={`albums-grid-container ${selectedAlbum ? 'has-selection' : ''}`}>
        {albums.map((album) => {
          const albumKey = `${album.name}::${album.artist}`;
          const isSelected = selectedAlbum === albumKey;
          
          return (
            <div 
              key={`${albumKey}-${selectedAlbum ? 'list' : 'grid'}`}
              className={`album-card ${isSelected ? 'album-card-selected' : ''}`}
              onClick={() => {
                setSelectedAlbum(albumKey);
              }}
            >
              {/* 封面 */}
              <div className="album-cover">
                {albumCovers.get(albumKey) ? (
                  <img 
                    src={albumCovers.get(albumKey)}
                    alt={`${album.name} 专辑封面`}
                    className="album-cover-img"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const nextSibling = e.currentTarget.nextElementSibling as HTMLElement;
                      if (nextSibling) {
                        nextSibling.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div className={`album-cover-placeholder ${albumCovers.get(albumKey) ? 'hidden' : ''}`}>
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>

                {/* 播放按钮（悬停显示） */}
                <div className="album-play-overlay">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>

              {/* 专辑信息 */}
              <div className="album-info-wrapper">
                <h3 className="album-name" title={album.name}>
                  {album.name}
                </h3>
                <p className="album-artist" title={album.artist}>
                  {album.artist}
                </p>
                <p className="album-track-count">
                  {album.trackCount} 首
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
      {selectedAlbumData && (
        <div className="album-drawer">
          {/* 返回按钮 */}
          <button 
            className="album-drawer-back-btn"
            onClick={() => setSelectedAlbum(null)}
            title="返回（ESC）"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>返回</span>
          </button>

          {/* 头部 - 封面和信息 */}
          <div className="album-drawer-header">
            <div className="album-drawer-cover">
              {albumCovers.get(selectedAlbum!) ? (
                <img 
                  src={albumCovers.get(selectedAlbum!)}
                  alt={`${selectedAlbumData.name} 专辑封面`}
                />
              ) : (
                <div className="album-drawer-cover-placeholder">
                  <svg className="w-20 h-20 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              )}
            </div>

            <div className="album-drawer-info">
              <span className="album-drawer-badge">专辑</span>
              <h2 className="album-drawer-name">{selectedAlbumData.name}</h2>
              <p className="album-drawer-artist">{selectedAlbumData.artist}</p>
              <p className="album-drawer-stats">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                共 {selectedAlbumData.trackCount} 首歌曲
              </p>
              
              <button 
                className="album-drawer-play-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedAlbumData.tracks.length > 0) {
                    onTrackSelect(selectedAlbumData.tracks[0]);
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
              <div className="drawer-track-col-artist">艺术家</div>
              <div className="drawer-track-col-duration">时长</div>
            </div>
            
            <div className="album-drawer-tracks-body">
              {selectedAlbumData.tracks.map((track, index) => (
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
                  <div className="drawer-track-col-artist">{track.artist || selectedAlbumData.artist}</div>
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
