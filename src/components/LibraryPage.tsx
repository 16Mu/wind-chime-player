/**
 * 音乐库页面 - 重构版
 * 
 * 优化：
 * - 使用LibraryContext获取数据，减少props传递
 * - 使用React.memo优化渲染性能
 * - 移除重复的事件监听（已在LibraryContext中处理）
 * - 高内聚低耦合设计
 */

import { useState, useMemo, memo, useRef, useEffect } from 'react';
import TracksView from './TracksView';
import ArtistsView from './ArtistsView';
import AlbumsView from './AlbumsView';
import { PlaylistSelectorDialog } from './playlist/PlaylistSelectorDialog';
import { useLibrary, useLibraryStatus } from '../contexts/LibraryContext';
import { usePlaylist } from '../contexts/PlaylistContext';
import type { Track } from '../types/music';

// ==================== 类型定义 ====================

type ViewMode = 'tracks' | 'albums' | 'artists';

interface LibraryPageProps {
  onTrackSelect: (track: Track) => void;
  selectedTrackId?: number;
}

// ==================== 主组件 ====================

const LibraryPage = memo(function LibraryPage({
  onTrackSelect,
  selectedTrackId
}: LibraryPageProps) {
  // ========== Context数据 ==========
  const { tracks, stats } = useLibrary();
  const { isLoading, isScanning } = useLibraryStatus();
  const { addTracksToPlaylist } = usePlaylist();

  // ========== 本地状态 ==========
  const [viewMode, setViewMode] = useState<ViewMode>('tracks');
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);
  const [selectedTrackForPlaylist, setSelectedTrackForPlaylist] = useState<Track | null>(null);
  const [isScrolled, setIsScrolled] = useState(false); // 滚动状态
  
  // 排序状态
  const [sortBy, setSortBy] = useState<'default' | 'title' | 'artist' | 'album' | 'duration'>('default');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // 自定义排序顺序（拖拽后的顺序）
  const [customOrder, setCustomOrder] = useState<number[]>([]); // 存储 track ID 的顺序
  
  // ========== Refs ==========
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ========== 计算实时统计 ==========
  const realTimeStats = useMemo(() => {
    if (!tracks.length) {
      return { total_tracks: 0, total_artists: 0, total_albums: 0 };
    }

    const artistsMap = new Map<string, boolean>();
    const albumsMap = new Map<string, boolean>();

    tracks.forEach(track => {
      const artistName = track.artist || '未知艺术家';
      const albumName = track.album || '未知专辑';
      const albumKey = `${albumName}::${artistName}`;
      
      artistsMap.set(artistName, true);
      albumsMap.set(albumKey, true);
    });

    return {
      total_tracks: tracks.length,
      total_artists: artistsMap.size,
      total_albums: albumsMap.size
    };
  }, [tracks]);

  const displayStats = stats || realTimeStats;

  // ========== 排序后的曲目列表 ==========
  const sortedTracks = useMemo(() => {
    if (!tracks.length) return [];
    
    // 如果是默认排序且有自定义顺序
    if (sortBy === 'default' && customOrder.length > 0) {
      // 按自定义顺序排列
      const orderMap = new Map(customOrder.map((id, index) => [id, index]));
      return [...tracks].sort((a, b) => {
        const indexA = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const indexB = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return indexA - indexB;
      });
    }
    
    // 如果是默认排序且没有自定义顺序
    if (sortBy === 'default') {
      return tracks; // 返回原始顺序
    }
    
    // 其他字段排序
    const sorted = [...tracks].sort((a, b) => {
      let compareResult = 0;
      
      switch (sortBy) {
        case 'title':
          compareResult = (a.title || '未知曲目').localeCompare(b.title || '未知曲目', 'zh-CN');
          break;
        case 'artist':
          compareResult = (a.artist || '未知艺术家').localeCompare(b.artist || '未知艺术家', 'zh-CN');
          break;
        case 'album':
          compareResult = (a.album || '未知专辑').localeCompare(b.album || '未知专辑', 'zh-CN');
          break;
        case 'duration':
          compareResult = (a.duration_ms || 0) - (b.duration_ms || 0);
          break;
      }
      
      return sortOrder === 'asc' ? compareResult : -compareResult;
    });
    
    return sorted;
  }, [tracks, sortBy, sortOrder, customOrder]);

  // ========== 排序处理函数 ==========
  const handleSort = (field: 'default' | 'title' | 'artist' | 'album' | 'duration') => {
    if (field === 'default') {
      setSortBy('default');
      return;
    }
    
    if (sortBy === field) {
      // 同一字段，切换排序方向
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // 不同字段，设置为升序
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // ========== 恢复默认排序 ==========
  const handleResetSort = () => {
    setSortBy('default');
    setCustomOrder([]); // 清除自定义排序
  };

  // ========== 拖拽排序处理 ==========
  const handleDragEnd = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    
    // 更新自定义顺序
    const newOrder = [...sortedTracks];
    const [movedItem] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedItem);
    
    // 保存新的排序顺序（track IDs）
    const newCustomOrder = newOrder.map(track => track.id);
    setCustomOrder(newCustomOrder);
    
    // 切换到默认排序模式（使用自定义顺序）
    setSortBy('default');
  };

  // ========== 视图切换时重置滚动状态 ==========
  useEffect(() => {
    setIsScrolled(false);
  }, [viewMode]);

  // ========== 滚动监听 - 所有视图都启用 ==========
  useEffect(() => {

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      // 检查是否是滚动容器
      if (!target.classList.contains('overflow-y-auto')) return;
      
      const scrollTop = target.scrollTop;
      const threshold = 1; // 滚动阈值 - 只要滚动1px就隐藏
      const nearTopThreshold = 1; // 回到顶部的阈值

      if (scrollTop >= threshold) {
        setIsScrolled(true);
      } else if (scrollTop < nearTopThreshold) {
        setIsScrolled(false);
      }
    };

    // 使用定时器等待DOM渲染完成后添加监听
    const timer = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (container) {
        // 对于tracks视图，监听容器本身
        if (viewMode === 'tracks') {
          container.addEventListener('scroll', handleScroll, { passive: true });
        } else {
          // 对于albums和artists视图，监听内部的滚动容器
          const scrollableElements = container.querySelectorAll('.overflow-y-auto');
          scrollableElements.forEach(el => {
            el.addEventListener('scroll', handleScroll, { passive: true });
          });
        }
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      const container = scrollContainerRef.current;
      if (container) {
        if (viewMode === 'tracks') {
          container.removeEventListener('scroll', handleScroll);
        } else {
          const scrollableElements = container.querySelectorAll('.overflow-y-auto');
          scrollableElements.forEach(el => {
            el.removeEventListener('scroll', handleScroll);
          });
        }
      }
    };
  }, [viewMode]); // 依赖viewMode，切换视图时重新绑定

  // ========== 播放全部 ==========
  // 性能优化：复用上层的 onTrackSelect，只选择当前排序后的第一首歌
  // 不再在前端传递整库 tracks 给 HybridPlayer，避免大库下 UI 卡顿
  const handlePlayAll = () => {
    const firstTrack = sortedTracks[0];
    if (firstTrack) {
      onTrackSelect(firstTrack);
    }
  };

  // ========== 添加到歌单 ==========
  const handleAddToPlaylist = (track: Track) => {
    setSelectedTrackForPlaylist(track);
    setShowPlaylistSelector(true);
  };

  const handlePlaylistSelected = async (playlistId: number) => {
    if (!selectedTrackForPlaylist) return;

    try {
      await addTracksToPlaylist(playlistId, [selectedTrackForPlaylist.id]);
      alert(`已添加"${selectedTrackForPlaylist.title || '未知标题'}"到歌单`);
    } catch (error) {
      console.error('添加到歌单失败:', error);
      alert('添加到歌单失败：' + error);
    } finally {
      setSelectedTrackForPlaylist(null);
    }
  };

  // ========== 渲染 ==========

  return (
    <div className="library-simple flex flex-col h-full relative">
      {/* 🎨 背景层 - 融合主题色系 */}
      
      {/* 方案一：简洁渐变 - 单层设计 ✅ 推荐 */}
      <div className="absolute inset-0 bg-gradient-to-br from-surface-secondary via-surface-secondary to-surface-tertiary dark:from-dark-50 dark:via-dark-50 dark:to-dark-100" />
      
      {/* 方案二：精致点阵纹理 - Apple Music 风格 */}
      {/* <div className="absolute inset-0 bg-surface-secondary dark:bg-dark-50" />
      <div 
        className="absolute inset-0 opacity-[0.4] dark:opacity-[0.15]" 
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(58, 122, 254, 0.03) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      /> */}
      
      {/* 方案三：柔和光晕 - 使用主题品牌色 */}
      {/* <div className="absolute inset-0 bg-surface-secondary dark:bg-dark-50" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-600/[0.03] dark:bg-brand-400/[0.05] rounded-full blur-[150px] transform translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent-500/[0.02] dark:bg-accent-400/[0.04] rounded-full blur-[120px] transform -translate-x-1/4 translate-y-1/3" /> */}
      
      {/* 方案四：分层玻璃态 - 深度感设计 */}
      {/* <div className="absolute inset-0 bg-gradient-to-b from-surface-tertiary via-surface-secondary to-white dark:from-dark-100 dark:via-dark-50 dark:to-dark-50" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(58,122,254,0.05),transparent_50%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(127,176,255,0.08),transparent_50%)]" /> */}
      
      {/* 方案五：细腻噪点纹理 - 现代感 */}
      {/* <div className="absolute inset-0 bg-gradient-to-br from-surface-secondary to-surface-tertiary dark:from-dark-50 dark:to-dark-100" />
      <svg className="absolute inset-0 w-full h-full opacity-[0.015] dark:opacity-[0.025]">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg> */}
      
      {/* 内容区 - 相对定位 */}
      <div className="relative z-10 flex flex-col h-full">
        {/* 🎨 智能滚动顶栏 - 丝滑推挤动画 */}
        <div 
          className="flex-shrink-0 overflow-hidden"
          style={{
            maxHeight: isScrolled ? '0px' : '92px',
            transition: isScrolled 
              ? 'max-height 0.4s ease-out'  // 收起：平滑
              : 'max-height 0.45s cubic-bezier(0.16, 1, 0.3, 1)'  // 展开：有力冲出
          }}
        >
          <header 
            className="border-b border-border-primary dark:border-white/10"
            style={{
              transform: isScrolled ? 'translateY(-100%)' : 'translateY(0)',
              opacity: isScrolled ? 0 : 1,
              transition: isScrolled
                ? 'all 0.4s ease-out'  // 收起：平滑
                : 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)',  // 展开：有力冲出
              pointerEvents: isScrolled ? 'none' : 'auto'
            }}
          >
            <div className="flex items-end justify-between px-8 pt-2 pb-3">
            {/* 左侧：标题和统计信息 */}
            <div className="flex-shrink-0">
              <h1 className="text-[32px] font-bold text-text-primary dark:text-dark-900 mb-1.5 tracking-tight">
                我的曲库
              </h1>
              <p className="text-[15px] text-text-muted dark:text-dark-700 font-normal">
                {isLoading ? '...' : displayStats.total_tracks} 首歌曲 · 
                {isLoading ? '...' : displayStats.total_albums} 张专辑 · 
                {isLoading ? '...' : displayStats.total_artists} 位艺术家
              </p>
            </div>

            {/* 右侧：Tab切换 + 播放按钮 */}
            <div className="flex items-center gap-3">
              {/* Tab切换按钮组 */}
              <div className="flex items-center gap-1 bg-surface-tertiary dark:bg-dark-200 p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('tracks')}
                  className={`px-5 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 ${
                    viewMode === 'tracks'
                      ? 'bg-white dark:bg-dark-50 text-text-primary dark:text-dark-900 shadow-sm'
                      : 'text-text-muted dark:text-dark-700 hover:text-text-secondary dark:hover:text-dark-800'
                  }`}
                >
                  歌曲
                </button>
                <button
                  onClick={() => setViewMode('albums')}
                  className={`px-5 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 ${
                    viewMode === 'albums'
                      ? 'bg-white dark:bg-dark-50 text-text-primary dark:text-dark-900 shadow-sm'
                      : 'text-text-muted dark:text-dark-700 hover:text-text-secondary dark:hover:text-dark-800'
                  }`}
                >
                  专辑
                </button>
                <button
                  onClick={() => setViewMode('artists')}
                  className={`px-5 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 ${
                    viewMode === 'artists'
                      ? 'bg-white dark:bg-dark-50 text-text-primary dark:text-dark-900 shadow-sm'
                      : 'text-text-muted dark:text-dark-700 hover:text-text-secondary dark:hover:text-dark-800'
                  }`}
                >
                  艺术家
                </button>
              </div>

              {/* 播放全部按钮 */}
              <button
                onClick={handlePlayAll}
                disabled={tracks.length === 0 || isScanning}
                className="flex items-center gap-2 pl-4 pr-5 py-2.5 bg-gradient-to-r from-[#FA233B] to-[#FB5C74] hover:from-[#E8152E] hover:to-[#FA4961] text-white rounded-full font-semibold shadow-lg hover:shadow-xl active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500 transition-all duration-200"
              >
                <svg className="w-[15px] h-[15px] fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span className="text-[13px] font-semibold tracking-wide">播放</span>
              </button>
            </div>
          </div>
          </header>
        </div>

        {/* 内容区域 - 丝滑跟随动画 */}
        <div 
          className="flex-1 min-h-0"
          style={{
            transition: isScrolled
              ? 'all 0.4s ease-out'  // 收起：平滑
              : 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)'  // 展开：有力冲出
          }}
        >
          {/* 内容最大宽度容器 */}
          <div className="h-full max-w-content mx-auto">
            {viewMode === 'tracks' && (
              <div className="h-full flex flex-col">
                {/* 表头固定层 - 支持排序 */}
                <div className="flex-shrink-0 px-8 pt-0">
                  <div className="grid grid-cols-12 gap-3 px-3 pb-3 text-xs font-medium text-slate-500 dark:text-dark-600 border-b border-slate-200/50 dark:border-dark-400/50">
                    {/* 歌曲名 - 可排序 */}
                    <button
                      onClick={() => handleSort('title')}
                      className="col-span-6 flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-dark-800 transition-colors cursor-pointer"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <span>歌曲</span>
                      {sortBy === 'title' && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {sortOrder === 'asc' ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          )}
                        </svg>
                      )}
                    </button>
                    
                    {/* 专辑 - 可排序 */}
                    <button
                      onClick={() => handleSort('album')}
                      className="col-span-4 flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-dark-800 transition-colors cursor-pointer"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span>专辑</span>
                      {sortBy === 'album' && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {sortOrder === 'asc' ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          )}
                        </svg>
                      )}
                    </button>
                    
                    {/* 时长 - 可排序 + 重置按钮 */}
                    <div className="col-span-2 flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleSort('duration')}
                        className="flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-dark-800 transition-colors cursor-pointer"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>时长</span>
                        {sortBy === 'duration' && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {sortOrder === 'asc' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            )}
                          </svg>
                        )}
                      </button>
                      
                      {/* 重置排序按钮 - 只在非默认排序时显示 */}
                      {(sortBy !== 'default' || customOrder.length > 0) && (
                        <button
                          onClick={handleResetSort}
                          className="flex items-center justify-center w-5 h-5 rounded
                                   text-slate-400 dark:text-dark-600 
                                   hover:text-brand-600 dark:hover:text-brand-500
                                   hover:bg-brand-50 dark:hover:bg-brand-900/20
                                   transition-all duration-200"
                          title="恢复默认排序"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* 滚动内容区 */}
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-8 pb-8">
                  <TracksView
                    tracks={sortedTracks}
                    onTrackSelect={onTrackSelect}
                    isLoading={isLoading}
                    selectedTrackId={selectedTrackId}
                    onAddToPlaylist={handleAddToPlaylist}
                    enableDragSort={sortBy === 'default'} // 只在默认排序时允许拖拽
                    onDragEnd={handleDragEnd}
                  />
                </div>
              </div>
            )}
            
            {viewMode === 'albums' && (
              <div ref={scrollContainerRef} className="h-full">
                <AlbumsView 
                  tracks={tracks}
                  onTrackSelect={onTrackSelect}
                  isLoading={isLoading}
                />
              </div>
            )}
            
            {viewMode === 'artists' && (
              <div ref={scrollContainerRef} className="h-full">
                <ArtistsView 
                  tracks={tracks}
                  onTrackSelect={onTrackSelect}
                  isLoading={isLoading}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 歌单选择对话框 */}
      <PlaylistSelectorDialog
        isOpen={showPlaylistSelector}
        onClose={() => {
          setShowPlaylistSelector(false);
          setSelectedTrackForPlaylist(null);
        }}
        onSelect={handlePlaylistSelected}
        trackCount={1}
      />
    </div>
  );
});

export default LibraryPage;


