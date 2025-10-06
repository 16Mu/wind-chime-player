import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { Track } from '../types/music';
import { useCoverCache } from '../contexts/CoverCacheContext';
import '../styles/albums-view.css';

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
  // 使用全局封面缓存
  const { albumCovers, loadAlbumCover, getAlbumCover } = useCoverCache();
  
  // 封面刷新触发器
  const [coverRefreshTrigger, setCoverRefreshTrigger] = useState(0);
  
  // 加载中的专辑（防止重复请求）
  const loadingAlbumsRef = useRef<Set<string>>(new Set());

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
          // 触发重新加载（Context 会处理缓存清理）
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

  // 懒加载封面 - 只加载前30个 + 使用全局缓存
  useEffect(() => {
    const loadInitialCovers = async () => {
      // 只加载前30个专辑的封面（首屏 + 一点预加载）
      const initialLoadCount = Math.min(30, albums.length);
      const loadingPromises: Promise<void>[] = [];
      
      for (let i = 0; i < initialLoadCount; i++) {
        const album = albums[i];
        const albumKey = `${album.name}::${album.artist}`;
        
        // 如果已经缓存或正在加载，跳过
        if (getAlbumCover(albumKey) || loadingAlbumsRef.current.has(albumKey)) {
          continue;
        }
        
        // 标记为加载中
        loadingAlbumsRef.current.add(albumKey);
        
        // 使用专辑第一首歌的封面
        const firstTrack = album.tracks[0];
        if (firstTrack) {
          const loadPromise = loadAlbumCover(firstTrack.id, albumKey).finally(() => {
            loadingAlbumsRef.current.delete(albumKey);
          });
          loadingPromises.push(loadPromise);
        }
      }
      
      // 等待初始封面加载完成
      await Promise.all(loadingPromises);
      console.log(`✅ 已加载 ${Math.min(initialLoadCount, albums.length)}/${albums.length} 个专辑封面（懒加载模式）`);
    };

    if (albums.length > 0) {
      loadInitialCovers();
    }
  }, [albums.length, loadAlbumCover, getAlbumCover]);
  
  // 按需加载封面的函数（使用全局缓存）
  const loadCoverForAlbum = useCallback(async (albumKey: string, trackId: number) => {
    // 避免重复加载
    if (getAlbumCover(albumKey) || loadingAlbumsRef.current.has(albumKey)) {
      return;
    }
    
    loadingAlbumsRef.current.add(albumKey);
    
    try {
      await loadAlbumCover(trackId, albumKey);
    } catch (error) {
      console.error(`❌ 按需加载封面失败 (${albumKey}):`, error);
    } finally {
      loadingAlbumsRef.current.delete(albumKey);
    }
  }, [loadAlbumCover, getAlbumCover]);
  
  // Intersection Observer 用于懒加载封面
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isAnimatingRef = useRef(false);
  
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // 如果正在执行动画，跳过加载
        if (isAnimatingRef.current) {
          return;
        }
        
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            const albumKey = element.dataset.albumKey;
            const trackId = element.dataset.trackId;
            
            if (albumKey && trackId) {
              loadCoverForAlbum(albumKey, parseInt(trackId));
              // 加载后取消观察
              observerRef.current?.unobserve(element);
            }
          }
        });
      },
      {
        rootMargin: '200px', // 提前200px开始加载
        threshold: 0.01
      }
    );
    
    return () => {
      observerRef.current?.disconnect();
    };
  }, [loadCoverForAlbum]);
  
  // 注册专辑卡片到 Observer
  const albumCardRef = useCallback((element: HTMLDivElement | null, albumKey: string, trackId: number) => {
    if (element && observerRef.current && !isAnimatingRef.current) {
      element.dataset.albumKey = albumKey;
      element.dataset.trackId = trackId.toString();
      observerRef.current.observe(element);
    }
  }, []);

  // 注意：albumCovers 是全局状态，由 CoverCacheContext 管理
  // Blob URL 的清理在 Context 的 clearCache 函数中统一处理
  // 不应该在单个组件中清理全局缓存的 URL

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
  const [isExiting, setIsExiting] = useState(false);
  const [displayAlbum, setDisplayAlbum] = useState<string | null>(null);
  const [coverSize, setCoverSize] = useState(135);
  const [sidebarWidth, setSidebarWidth] = useState(240);

  // 同步 displayAlbum
  useEffect(() => {
    if (selectedAlbum && !isExiting) {
      setDisplayAlbum(selectedAlbum);
    }
  }, [selectedAlbum, isExiting]);

  // 监听窗口大小，动态调整封面尺寸（带防抖优化）
  useEffect(() => {
    let resizeTimer: number;
    
    const updateCoverSize = () => {
      const width = window.innerWidth;
      
      if (width >= 2560) {
        // 4K 显示器全屏
        setCoverSize(150);
        setSidebarWidth(280);
      } else if (width >= 1920) {
        // 2K/全屏 - 保持紧凑
        setCoverSize(145);
        setSidebarWidth(260);
      } else if (width >= 1600) {
        // 大屏幕
        setCoverSize(140);
        setSidebarWidth(250);
      } else if (width >= 1280) {
        // 中大屏幕
        setCoverSize(135);
        setSidebarWidth(240);
      } else if (width >= 1024) {
        // 中等屏幕
        setCoverSize(130);
        setSidebarWidth(230);
      } else if (width >= 768) {
        // 小屏幕
        setCoverSize(125);
        setSidebarWidth(220);
      } else {
        // 移动端
        setCoverSize(120);
        setSidebarWidth(210);
      }
    };

    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(updateCoverSize, 150);
    };

    // 初始化
    updateCoverSize();
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  const selectedAlbumData = displayAlbum 
    ? albums.find(a => `${a.name}::${a.artist}` === displayAlbum) 
    : null;

  // 关闭抽屉
  const handleCloseDrawer = () => {
    setIsExiting(true);
    isAnimatingRef.current = true; // 标记动画开始
    // 等待所有退出动画完成后再卸载（动画280ms + 最大延迟300ms + 缓冲100ms）
    setTimeout(() => {
      setSelectedAlbum(null);
      setDisplayAlbum(null);
      setIsExiting(false);
      // 动画完成后延迟恢复，避免卡顿
      setTimeout(() => {
        isAnimatingRef.current = false;
      }, 150);
    }, 700); // 确保所有动画完成
  };

  // ESC键关闭抽屉
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedAlbum) {
        handleCloseDrawer();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedAlbum]);

  // 鼠标高光跟随效果 - 优化性能和视觉效果
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
    <div className={`flex ${selectedAlbum ? 'gap-4' : ''} h-full`}>
      {/* 专辑网格 */}
      <div 
        className={`${selectedAlbum || isExiting ? 'flex-shrink-0 overflow-y-auto' : 'w-full overflow-y-auto px-8 pt-0'} transition-all duration-500 ease-out`}
        style={selectedAlbum || isExiting ? { width: `${sidebarWidth}px` } : {}}
      >
        {/* 内容最大宽度限制 - 响应式优化 */}
        <div className={selectedAlbum || isExiting ? '' : 'max-w-content mx-auto'}>
        <div 
          className={selectedAlbum || isExiting ? 'grid grid-cols-1 gap-2 pb-[68px]' : 'albums-grid-modern pb-[68px]'} 
          style={selectedAlbum || isExiting ? {} : {'--cover-size': `${coverSize}px`} as React.CSSProperties}
        >
        {albums.map((album, index) => {
          const albumKey = `${album.name}::${album.artist}`;
          const isSelected = selectedAlbum === albumKey;
          
          return (
            <div 
              key={`${albumKey}-${selectedAlbum ? 'list' : 'grid'}-${isExiting ? 'exiting' : 'entering'}`}
              ref={(el) => albumCardRef(el, albumKey, album.tracks[0]?.id || 0)}
              className={`
                ${selectedAlbum ? 
                  `group cursor-pointer rounded-lg p-2 flex items-center gap-3 ${isSelected ? 'bg-purple-50 dark:bg-purple-900/30 border-l-4 border-purple-500 dark:border-purple-400' : ''}` 
                  : 
                  'album-card-modern'
                }
                ${isExiting ? 'animate-fadeOutLeft' : 'animate-fadeInUp'}
              `}
              style={{
                animationDelay: isExiting ? `${Math.min(index * 15, 300)}ms` : `${Math.min(index * 30, 600)}ms`,
                willChange: isExiting || index < 50 ? 'transform, opacity' : 'auto'
              }}
              onClick={() => {
                setSelectedAlbum(albumKey);
              }}
              title={`${album.name}\n${album.artist} · ${album.trackCount} 首`}
            >
              {/* 封面 */}
              <div 
                className={selectedAlbum ? 
                  'album-art-wrapper relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-dark-200' 
                  : 
                  'album-cover-modern'
                }
                onMouseMove={!selectedAlbum ? handleMouseMove : undefined}
                onMouseLeave={!selectedAlbum ? handleMouseLeave : undefined}
                style={{
                  '--mx': '0.5',
                  '--my': '0.5',
                  '--gloss': '0',
                  '--ang': '0',
                } as React.CSSProperties}
              >
                {albumCovers.get(albumKey) ? (
                  <img 
                    src={albumCovers.get(albumKey)}
                    alt={`${album.name} 专辑封面`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const nextSibling = e.currentTarget.nextElementSibling as HTMLElement;
                      if (nextSibling) {
                        nextSibling.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-dark-300 dark:to-dark-400 ${albumCovers.get(albumKey) ? 'hidden' : ''}`}>
                  <svg className="w-8 h-8 text-slate-400 dark:text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>

              {/* 专辑信息 */}
              <div className={selectedAlbum ? 'flex-1 min-w-0' : 'album-info-modern'}>
                <h3 className={selectedAlbum ? 'album-name font-semibold text-slate-900 dark:text-dark-900 truncate transition-colors duration-200 text-sm mb-1' : 'album-name-modern'} title={album.name}>
                  {album.name}
                </h3>
                <p className={selectedAlbum ? 'album-artist text-xs text-slate-500 dark:text-dark-600 truncate leading-tight' : 'album-artist-modern'} title={album.artist}>
                  {album.artist} · {album.trackCount} 首
                </p>
              </div>
            </div>
          );
        })}
        </div>
        </div>
      </div>

      {/* 右侧歌曲列表 */}
      {selectedAlbumData && (
        <div 
          className={`flex-1 bg-white dark:bg-dark-100 rounded-lg border border-slate-200 dark:border-dark-400 flex flex-col overflow-hidden ${isExiting ? 'drawer-exit' : 'drawer-enter'}`}
        >
          {/* 头部 - 封面和信息 */}
          <div className="flex-shrink-0 flex items-center gap-4 p-4 border-b border-slate-200 dark:border-dark-400">
            {/* 封面 */}
            <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden shadow-md bg-slate-100 dark:bg-dark-200">
              {albumCovers.get(selectedAlbum!) ? (
                <img 
                  src={albumCovers.get(selectedAlbum!)}
                  alt={`${selectedAlbumData.name} 专辑封面`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-dark-300 dark:to-dark-400 flex items-center justify-center">
                  <svg className="w-10 h-10 text-slate-400 dark:text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              )}
            </div>
            
            {/* 信息和按钮 */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-dark-900 mb-1 truncate">{selectedAlbumData.name}</h2>
              <p className="text-sm text-slate-600 dark:text-dark-700 mb-2">{selectedAlbumData.artist}</p>
              <div className="flex items-center gap-3">
                <button 
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white rounded-full text-sm font-medium flex items-center gap-2 transition-colors shadow-md"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectedAlbumData.tracks.length > 0) {
                      onTrackSelect(selectedAlbumData.tracks[0]);
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
              <div className="col-span-3">艺术家</div>
              <div className="col-span-1 text-center">时长</div>
            </div>
            
            {/* 歌曲行 */}
            <div className="px-2 py-2">
              {selectedAlbumData.tracks.map((track, index) => (
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
                    <div className="text-xs text-slate-600 dark:text-dark-700 truncate">{track.artist || selectedAlbumData.artist}</div>
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
}
