import { useState, useEffect, useMemo, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import TracksView from './TracksView';
import ArtistsView from './ArtistsView';
import AlbumsView from './AlbumsView';
import LibraryOverview from './library/LibraryOverview';
import LibraryFilterBar from './library/LibraryFilterBar';
import LibraryAsidePanel from './library/LibraryAsidePanel';

interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
}

interface LibraryStats {
  total_tracks: number;
  total_artists: number;
  total_albums: number;
}

interface LibraryPageProps {
  onTrackSelect: (track: Track) => void;
  searchQuery?: string;
  tracks: Track[];
  stats: LibraryStats | null;
  isLoading: boolean;
  isCached: boolean;
  onSearch: (query: string) => void;
  onRefresh: () => void;
  membraneSettings?: {
    enabled: boolean;
    intensity: number;
    radius: number;
  };
  selectedTrackId?: number;
  hoverAnimationSettings?: {
    enabled: boolean;
    range: number;
    displacement: number;
  };
}

type ViewMode = 'tracks' | 'albums' | 'artists' | 'playlists';
type DisplayMode = 'list' | 'grid' | 'compact';
type SortOption = 'title' | 'artist' | 'album' | 'date_added' | 'duration';

export default function LibraryPage({
  onTrackSelect,
  searchQuery = '',
  tracks,
  stats: _stats,
  isLoading,
  isCached,
  onSearch,
  onRefresh,
  selectedTrackId
}: LibraryPageProps) {
  // 状态管理
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    current_file: string;
    processed: number;
    total: number;
  } | null>(null);
  const [activeView, setActiveView] = useState<ViewMode>('tracks');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('list');
  const [sortBy, setSortBy] = useState<SortOption>('title');
  const [filterTags, setFilterTags] = useState<Array<{ id: string; label: string; active: boolean }>>([
    { id: 'pop', label: '流行', active: false },
    { id: 'rock', label: '摇滚', active: false },
    { id: 'jazz', label: '爵士', active: false }
  ]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 实时计算统计数据
  const realTimeStats = useMemo(() => {
    if (!tracks.length) return { total_tracks: 0, total_artists: 0, total_albums: 0 };

    const artistsMap = new Map<string, boolean>();
    tracks.forEach(track => {
      const artistString = track.artist || '未知艺术家';
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
      
      artistNames.forEach(artistName => {
        const cleanName = artistName.trim();
        if (cleanName) {
          artistsMap.set(cleanName, true);
        }
      });
      
      if (artistNames.length === 0 || artistNames.every(name => !name.trim())) {
        artistsMap.set('未知艺术家', true);
      }
    });

    const albumsMap = new Map<string, boolean>();
    tracks.forEach(track => {
      const albumName = track.album || '未知专辑';
      const artistName = track.artist || '未知艺术家';
      const albumKey = `${albumName}::${artistName}`;
      albumsMap.set(albumKey, true);
    });

    return {
      total_tracks: tracks.length,
      total_artists: artistsMap.size,
      total_albums: albumsMap.size
    };
  }, [tracks]);

  // 获取最近播放曲目（模拟数据，实际应从后端获取）
  const recentTracks = useMemo(() => {
    return tracks.slice(0, 3);
  }, [tracks]);

  // 获取播放历史（模拟数据）
  const listeningHistory = useMemo(() => {
    return tracks.slice(0, 5).map((track, index) => ({
      time: `${10 - index * 2}:${(30 - index * 5).toString().padStart(2, '0')}`,
      track
    }));
  }, [tracks]);

  // 监听扫描事件
  useEffect(() => {
    if (typeof listen === 'undefined') return;

    const setupScanListeners = async () => {
      const unlistenScanStarted = await listen('library-scan-started', () => {
        setIsScanning(true);
        setScanProgress(null);
      });

      const unlistenScanProgress = await listen('library-scan-progress', (event: any) => {
        setScanProgress(event.payload);
      });

      const unlistenScanComplete = await listen('library-scan-complete', () => {
        setIsScanning(false);
        setScanProgress(null);
        console.log('扫描完成，刷新数据');
        onRefresh();
      });

      return () => {
        unlistenScanStarted();
        unlistenScanProgress();
        unlistenScanComplete();
      };
    };

    const setupListeners = setupScanListeners();
    return () => {
      setupListeners.then(cleanup => cleanup && cleanup());
    };
  }, [onRefresh]);

  // 处理搜索查询变化
  useEffect(() => {
    const searchDebounced = setTimeout(() => {
      onSearch(searchQuery);
    }, 200);

    return () => clearTimeout(searchDebounced);
  }, [searchQuery, onSearch]);

  // 处理标签切换
  const handleTagToggle = useCallback((tagId: string) => {
    setFilterTags(prev =>
      prev.map(tag =>
        tag.id === tagId ? { ...tag, active: !tag.active } : tag
      )
    );
  }, []);

  // 处理流派点击
  const handleGenreClick = useCallback((genre: string) => {
    console.log('选择流派:', genre);
    // TODO: 实现流派筛选逻辑
  }, []);

  // 处理历史曲目点击
  const handleHistoryTrackClick = useCallback((trackId: number) => {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
      onTrackSelect(track);
    }
  }, [tracks, onTrackSelect]);

  return (
    <div className="library-page-container" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* 概览区 */}
      <LibraryOverview
        stats={realTimeStats}
        recentTracks={recentTracks}
        onScanFolder={() => {
          console.log('打开扫描文件夹对话框');
          // TODO: 实现打开文件夹选择对话框
        }}
        onImportMusic={() => {
          console.log('导入音乐');
          // TODO: 实现导入音乐逻辑
        }}
        onOpenLyrics={() => {
          console.log('打开歌词面板');
          // TODO: 实现打开歌词面板
        }}
      />

      {/* 筛选带 */}
      <LibraryFilterBar
        activeView={activeView}
        onViewChange={setActiveView}
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
        sortBy={sortBy}
        onSortChange={setSortBy}
        filterTags={filterTags}
        onTagToggle={handleTagToggle}
        onAddTag={() => console.log('添加更多标签')}
      />

      {/* 错误消息 */}
      {errorMessage && (
        <div className="mb-4" style={{
          padding: '16px',
          background: 'rgba(245, 82, 82, 0.1)',
          border: '1px solid rgba(245, 82, 82, 0.3)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>操作失败</div>
            <div style={{ fontSize: '12px', color: '#374151' }}>{errorMessage}</div>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#EF4444',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer'
            }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 扫描进度 */}
      {isScanning && scanProgress && (
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="ring-loader" style={{ width: '16px', height: '16px' }}></div>
              正在扫描音乐文件...
            </span>
            <div style={{
              padding: '4px 8px',
              background: '#EFF6FF',
              color: '#2563EB',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 500
            }}>
              {scanProgress.processed} / {scanProgress.total}
            </div>
          </div>
          
          <div style={{
            height: '4px',
            background: '#F3F4F6',
            borderRadius: '2px',
            overflow: 'hidden',
            marginBottom: '12px'
          }}>
            <div style={{
              width: `${(scanProgress.processed / scanProgress.total) * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #2563EB 0%, #7EC8FF 100%)',
              transition: 'width 0.3s ease'
            }} />
          </div>
          
          <div style={{ fontSize: '12px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scanProgress.current_file}</span>
          </div>
        </div>
      )}

      {/* 主内容区 - 左右分栏 */}
      <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '24px' }}>
        {/* 左侧：内容视图 */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)'
        }}>
          {!isCached && isLoading && tracks.length === 0 ? (
            /* 加载状态 */
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
              <div style={{ textAlign: 'center', maxWidth: '400px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                  <div className="ring-loader" style={{ width: '64px', height: '64px', borderWidth: '4px' }}></div>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
                  正在加载音乐库
                </h3>
                <div className="loading-dots" style={{ display: 'flex', justifyContent: 'center', fontSize: '8px' }}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          ) : tracks.length === 0 ? (
            /* 空状态 */
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
              <div style={{ textAlign: 'center', maxWidth: '400px', padding: '24px' }}>
                <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
                  <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
                  {isScanning ? '正在扫描音乐文件...' : '音乐库为空'}
                </h3>
                <p style={{ color: '#6B7280', marginBottom: '24px', fontSize: '15px', fontWeight: 500 }}>
                  {isScanning
                    ? '请稍候，正在搜索您选择文件夹中的音乐文件'
                    : '请点击上方"扫描文件夹"按钮，添加音乐到您的库中'
                  }
                </p>
              </div>
            </div>
          ) : (
            /* 根据活跃视图显示内容 */
            <div style={{ padding: '24px' }}>
              {activeView === 'tracks' && (
                <TracksView
                  tracks={tracks}
                  onTrackSelect={onTrackSelect}
                  isLoading={isLoading && !isCached}
                  selectedTrackId={selectedTrackId}
                  showFavoriteButtons={true}
                />
              )}
              {activeView === 'artists' && (
                <ArtistsView
                  tracks={tracks}
                  onTrackSelect={onTrackSelect}
                  isLoading={isLoading && !isCached}
                />
              )}
              {activeView === 'albums' && (
                <AlbumsView
                  tracks={tracks}
                  onTrackSelect={onTrackSelect}
                  isLoading={isLoading && !isCached}
                />
              )}
              {activeView === 'playlists' && (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <p style={{ color: '#6B7280', fontSize: '15px' }}>歌单视图开发中...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右侧：动态侧栏 */}
        <LibraryAsidePanel
          currentTrack={tracks.find(t => t.id === selectedTrackId)}
          isPlaying={false}
          listeningHistory={listeningHistory}
          announcement={{
            title: '版本更新',
            content: '全新普通主题音乐库界面已上线，提供更清爽的视觉体验和更高效的浏览方式。'
          }}
          onGenreClick={handleGenreClick}
          onHistoryTrackClick={handleHistoryTrackClick}
        />
      </div>
    </div>
  );
}




