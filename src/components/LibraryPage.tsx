import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
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
  isCached: boolean; // 数据是否已缓存
  onSearch: (query: string) => void;
  onRefresh: () => void; // 手动刷新数据
  membraneSettings?: {
    enabled: boolean;
    intensity: number;
    radius: number;
  };
}

export default function LibraryPage({ 
  onTrackSelect, 
  searchQuery = '', 
  tracks, 
  stats, 
  isLoading, 
  isCached,
  onSearch,
  onRefresh,
  membraneSettings = { enabled: true, intensity: 1, radius: 1 }
}: LibraryPageProps) {
  const [isScanning, setIsScanning] = useState(false);  // 是否正在扫描
  const [scanProgress, setScanProgress] = useState<{
    current_file: string;
    processed: number;
    total: number;
  } | null>(null);  // 扫描进度
  const [activeTab, setActiveTab] = useState<'tracks' | 'artists' | 'albums'>('tracks');  // 当前活跃标签
  const [errorMessage, setErrorMessage] = useState<string | null>(null);  // 错误消息

  // 🎵 只监听扫描相关事件（数据加载已移至App层）
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
        // 扫描完成后刷新数据
        console.log('🎵 扫描完成，刷新数据');
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
  }, []);

  // 🔍 处理搜索查询变化（使用App传入的onSearch函数）
  useEffect(() => {
    const searchDebounced = setTimeout(() => {
      onSearch(searchQuery);
    }, 200);

    return () => clearTimeout(searchDebounced);
  }, [searchQuery]); // 移除onSearch依赖，避免无限循环


  // handleSearch 函数已移除，搜索现在通过 App 组件的 searchQuery prop 处理

  return (
    <div className="flex flex-col glass-card">
      {/* 🎵 玻璃化顶部区域：标题和统计信息 */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-contrast-primary mb-2">音乐库</h2>
        {searchQuery ? (
          <p className="text-contrast-secondary text-base flex items-center gap-2 font-medium mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            搜索 "<span className="font-semibold text-brand-600">{searchQuery}</span>" 找到 <span className="font-bold">{tracks.length}</span> 首歌曲
          </p>
        ) : stats ? (
          <p className="text-contrast-secondary text-base flex items-center gap-4 font-medium mb-4">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <span className="font-bold">{stats.total_tracks || 0}</span> 首歌曲
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-bold">{stats.total_artists || 0}</span> 位艺术家
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="font-bold">{stats.total_albums || 0}</span> 张专辑
            </span>
          </p>
        ) : (
          /* 统计数据加载中或不可用 */
          <p className="text-contrast-secondary text-base font-medium mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            正在加载统计数据...
          </p>
        )}
      </div>

      {/* 🚨 玻璃化错误消息 */}
      {errorMessage && (
        <div className="mb-4 glass-card" style={{ background: 'rgba(245, 82, 82, 0.1)', borderColor: 'rgba(245, 82, 82, 0.3)' }}>
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-900 mb-1">操作失败</div>
              <div className="text-xs text-slate-700">{errorMessage}</div>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-danger hover:bg-red-100 transition-colors"
              title="关闭"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 📊 玻璃化扫描进度 */}
      {isScanning && scanProgress && (
        <div className="mb-6 glass-card glass-card-compact">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              正在扫描音乐文件...
            </span>
            <div className="glass-badge">
              {scanProgress.processed} / {scanProgress.total}
            </div>
          </div>
          
          <div className="glass-progress mb-3">
            <div
              className="glass-progress-fill"
              style={{
                width: `${(scanProgress.processed / scanProgress.total) * 100}%`,
              }}
            />
          </div>
          
          <div className="text-xs text-slate-600 truncate flex items-center gap-2">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>{scanProgress.current_file}</span>
          </div>
        </div>
      )}

      {/* 🎨 玻璃化主要内容区域 - 整个红色框选区域 */}
      <div className="glass-surface-strong flex flex-col">
        {/* 📊 标签页导航 */}
        <div className="p-6 pb-0">
          <div className="glass-tabs">
            {/* 🏷️ 滑动指示器 */}
            <div 
              className="tab-indicator"
              style={{
                left: `${activeTab === 'tracks' ? '4px' : activeTab === 'artists' ? 'calc(33.333% + 2px)' : 'calc(66.666% + 0px)'}`,
                width: 'calc(33.333% - 4px)',
                height: 'calc(100% - 8px)',
                top: '4px',
              }}
            />
            
            <button
              className={`glass-tab ${activeTab === 'tracks' ? 'active' : ''}`}
              onClick={() => setActiveTab('tracks')}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                曲目
              </span>
            </button>
            
            <button
              className={`glass-tab ${activeTab === 'artists' ? 'active' : ''}`}
              onClick={() => setActiveTab('artists')}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                艺术家
              </span>
            </button>
            
            <button
              className={`glass-tab ${activeTab === 'albums' ? 'active' : ''}`}
              onClick={() => setActiveTab('albums')}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                专辑
              </span>
            </button>
          </div>
        </div>

        {/* 🎶 玻璃化内容区域 */}
        <div className="p-6">
          {!isCached && isLoading && tracks.length === 0 ? (
            /* 只有在数据未缓存且首次加载时才显示加载状态 */
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center glass-card max-w-md">
                <div className="text-slate-400 mb-6">
                  <svg className="w-16 h-16 mx-auto animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-contrast-primary mb-3">
                  正在加载音乐库...
                </h3>
                <p className="text-contrast-secondary mb-6 text-base font-medium">
                  请稍候，正在获取您的音乐数据
                </p>
              </div>
            </div>
          ) : tracks.length === 0 ? (
            /* 空状态 */
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center glass-card max-w-md">
                <div className="text-slate-400 mb-6">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-contrast-primary mb-3">
                  {isScanning ? '正在扫描音乐文件...' : '音乐库为空'}
                </h3>
                <p className="text-contrast-secondary mb-6 text-base font-medium">
                  {isScanning
                    ? '请稍候，正在搜索您选择文件夹中的音乐文件'
                    : '请前往设置页面扫描音乐文件夹，添加音乐到您的库中'
                  }
                </p>
                
                {/* 🎤 玻璃化功能提示卡片 */}
                <div className="glass-card glass-card-compact" style={{ background: 'var(--gradient-brand-soft)', borderColor: 'rgba(255,255,255,0.4)' }}>
                  <div className="text-center text-white">
                    <div className="text-white mb-2">
                      <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="text-sm font-semibold mb-2">歌词系统已就绪</div>
                    <div className="text-xs opacity-90 leading-relaxed">
                      扫描音乐后，选择任意歌曲播放<br/>
                      在底部播放器中点击🎵按钮查看歌词<br/>
                      支持手动编辑、导入LRC文件等功能
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 根据活跃标签显示不同的视图 */
            <>
              {activeTab === 'tracks' && (
                <TracksView 
                  tracks={tracks} 
                  onTrackSelect={onTrackSelect} 
                  isLoading={isLoading && !isCached}
                  membraneEnabled={membraneSettings.enabled}
                  membraneIntensity={membraneSettings.intensity}
                  membraneRadius={membraneSettings.radius}
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
    </div>
  );
}