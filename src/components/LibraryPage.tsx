import { useState, useEffect, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import TracksView from './TracksView';
import ArtistsView from './ArtistsView';
import AlbumsView from './AlbumsView';

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
  selectedTrackId?: number;
}

type ViewMode = 'tracks' | 'albums' | 'artists';

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
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    current_file: string;
    processed: number;
    total: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<ViewMode>('tracks');
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
        if (cleanName) artistsMap.set(cleanName, true);
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

  // 处理搜索
  useEffect(() => {
    const searchDebounced = setTimeout(() => {
      onSearch(searchQuery);
    }, 200);
    return () => clearTimeout(searchDebounced);
  }, [searchQuery, onSearch]);

  // 播放全部
  const handlePlayAll = async () => {
    if (tracks.length > 0) {
      try {
        await invoke('player_load_playlist', { tracks });
        await invoke('player_play', { track_id: tracks[0].id });
      } catch (error) {
        console.error('播放失败:', error);
      }
    }
  };

  return (
    <div className="library-simple">
      {/* 顶部标题和统计 */}
      <div className="library-header">
        <h1 className="library-title">音乐库</h1>
        
        {/* 统计信息 */}
        <div className="library-stats-bar">
          <span className="stat-item">
            <span className="stat-label">歌曲</span>
            <span className="stat-value">{realTimeStats.total_tracks}</span>
          </span>
          <span className="stat-divider">|</span>
          <span className="stat-item">
            <span className="stat-label">歌手</span>
            <span className="stat-value">{realTimeStats.total_artists}</span>
          </span>
          <span className="stat-divider">|</span>
          <span className="stat-item">
            <span className="stat-label">专辑</span>
            <span className="stat-value">{realTimeStats.total_albums}</span>
          </span>
          {searchQuery && (
            <>
              <span className="stat-divider">|</span>
              <span className="stat-item search-result">
                搜索 "{searchQuery}" 找到 {tracks.length} 首
              </span>
            </>
          )}
        </div>
      </div>

      {/* 操作栏 */}
      <div className="library-actions">
        <button 
          className="animated-button play-all-button"
          onClick={handlePlayAll}
          disabled={tracks.length === 0}
          title="播放全部歌曲"
        >
          <svg className="svgIcon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
        
        <button className="animated-button refresh-button" onClick={onRefresh} title="刷新音乐库">
          <svg className="svgIcon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {/* 视图切换标签 */}
        <div className="view-tabs">
          <div className="view-tabs-slider" style={{
            transform: `translateX(${activeTab === 'tracks' ? '0%' : activeTab === 'artists' ? '100%' : '200%'})`
          }} />
          <button 
            className={`view-tab ${activeTab === 'tracks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tracks')}
          >
            歌曲
          </button>
          <button 
            className={`view-tab ${activeTab === 'artists' ? 'active' : ''}`}
            onClick={() => setActiveTab('artists')}
          >
            歌手
          </button>
          <button 
            className={`view-tab ${activeTab === 'albums' ? 'active' : ''}`}
            onClick={() => setActiveTab('albums')}
          >
            专辑
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {errorMessage && (
        <div className="library-error">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)}>×</button>
        </div>
      )}

      {/* 扫描进度 */}
      {isScanning && scanProgress && (
        <div className="library-scanning">
          <div className="scanning-header">
            <span>正在扫描音乐文件...</span>
            <span className="scanning-progress">{scanProgress.processed} / {scanProgress.total}</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(scanProgress.processed / scanProgress.total) * 100}%` }}
            />
          </div>
          <div className="scanning-file">{scanProgress.current_file}</div>
        </div>
      )}

      {/* 主内容区 */}
      <div className="library-content">
        {!isCached && isLoading && tracks.length === 0 ? (
          // 加载状态
          <div className="library-loading">
            <div className="ring-loader"></div>
            <p>正在加载音乐库...</p>
          </div>
        ) : tracks.length === 0 ? (
          // 空状态
          <div className="library-empty">
            <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <h3>{isScanning ? '正在扫描音乐文件...' : '音乐库为空'}</h3>
            <p>
              {isScanning
                ? '请稍候，正在搜索您选择文件夹中的音乐文件'
                : '请前往设置页面扫描音乐文件夹，添加音乐到您的库中'
              }
            </p>
          </div>
        ) : (
          // 内容视图
          <>
            {activeTab === 'tracks' && (
              <TracksView
                tracks={tracks}
                onTrackSelect={onTrackSelect}
                isLoading={isLoading && !isCached}
                selectedTrackId={selectedTrackId}
                showFavoriteButtons={true}
              />
            )}
            {activeTab === 'artists' && (
              <ArtistsView
                tracks={tracks}
                onTrackSelect={onTrackSelect}
                isLoading={isLoading && !isCached}
              />
            )}
            {activeTab === 'albums' && (
              <AlbumsView
                tracks={tracks}
                onTrackSelect={onTrackSelect}
                isLoading={isLoading && !isCached}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

