import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import TracksView from './TracksView';
import type { Track } from '../types/music';

interface FavoritesViewProps {
  onTrackSelect: (track: Track) => void;
  selectedTrackId?: number;
}

type ViewMode = 'minimal' | 'cards' | 'album-wall';

export default function FavoritesView({ 
  onTrackSelect, 
  selectedTrackId
}: FavoritesViewProps) {
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('minimal');
  
  // 封面缓存：trackId -> coverUrl
  const [coverCache, setCoverCache] = useState<Map<number, string>>(new Map());
  
  // 动画触发key - 每次切换视图时更新
  const [animationKey, setAnimationKey] = useState(0);

  // 加载收藏列表
  const loadFavorites = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [favoriteTracks, count] = await Promise.all([
        invoke('favorites_get_all') as Promise<Track[]>,
        invoke('favorites_get_count') as Promise<number>
      ]);
      
      setFavorites(favoriteTracks);
      setFavoriteCount(count);
      console.log(`加载了 ${favoriteTracks.length} 首收藏歌曲`);
    } catch (error) {
      console.error('加载收藏失败:', error);
      setError('加载收藏失败，请稍后重试');
      setFavorites([]);
      setFavoriteCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  // 清空收藏列表
  const clearAllFavorites = async () => {
    if (!window.confirm(`确定要清空所有 ${favoriteCount} 首收藏歌曲吗？此操作无法撤销。`)) {
      return;
    }

    try {
      setIsLoading(true);
      
      // 批量删除收藏
      const promises = favorites.map(track => 
        invoke('favorites_remove', { trackId: track.id, track_id: track.id })
      );
      
      await Promise.all(promises);
      
      // 重新加载列表
      await loadFavorites();
      
      console.log('✅ 已清空所有收藏');
    } catch (error) {
      console.error('清空收藏失败:', error);
      setError('清空收藏失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 加载封面
  const loadCovers = async (tracks: Track[]) => {
    const newCovers = new Map<number, string>();
    const loadPromises = tracks.map(async (track) => {
      try {
        const result = await invoke('get_album_cover', { trackId: track.id }) as [number[], string] | null;
        if (result) {
          const [imageData, mimeType] = result;
          const blob = new Blob([new Uint8Array(imageData)], { type: mimeType });
          const url = URL.createObjectURL(blob);
          newCovers.set(track.id, url);
        }
      } catch (error) {
        console.error(`加载封面失败 (track ${track.id}):`, error);
      }
    });
    
    await Promise.all(loadPromises);
    setCoverCache(newCovers);
    console.log(`✅ 已加载 ${newCovers.size}/${tracks.length} 个封面`);
  };

  // 组件挂载时加载收藏
  useEffect(() => {
    loadFavorites();
  }, []);

  // 当收藏列表变化时加载封面
  useEffect(() => {
    if (favorites.length > 0) {
      loadCovers(favorites);
    }
    
    // 清理函数：释放所有封面URL
    return () => {
      coverCache.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          // 忽略清理错误
        }
      });
    };
  }, [favorites.length]); // 依赖于 favorites.length 而不是整个数组，避免不必要的重新加载

  // 刷新收藏列表
  const handleRefresh = () => {
    loadFavorites();
  };

  // 如果正在加载且没有数据
  if (isLoading && favorites.length === 0) {
    return (
      <div className="glass-card min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-400 dark:text-dark-700 mb-6">
            <svg className="w-16 h-16 mx-auto animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-contrast-primary mb-3">
            正在加载收藏...
          </h3>
          <p className="text-contrast-secondary text-base font-medium">
            正在获取您喜爱的音乐
          </p>
        </div>
      </div>
    );
  }

  // 如果出现错误
  if (error) {
    return (
      <div className="glass-card min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 dark:text-red-400 mb-6">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-contrast-primary mb-3">
            加载失败
          </h3>
          <p className="text-contrast-secondary text-base font-medium mb-6">
            {error}
          </p>
          <button
            onClick={handleRefresh}
            className="glass-button primary"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  // 如果没有收藏
  if (favorites.length === 0) {
    return (
      <div className="glass-card min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-400 dark:text-dark-700 mb-6">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-dark-900 mb-4">暂无收藏</h2>
          <p className="text-slate-600 dark:text-dark-700 text-lg mb-6">您还没有收藏任何音乐</p>
          <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-dark-600">
              点击播放器中的收藏按钮来收藏喜爱的歌曲
            </p>
            <button
              onClick={handleRefresh}
              className="glass-button secondary text-sm px-4 py-2"
            >
              刷新收藏
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 统一的头部组件
  const renderHeader = () => (
    <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/10 dark:border-white/10 animate-fadeIn">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-contrast-primary">我的收藏</h1>
          <p className="text-xs text-contrast-secondary">{favoriteCount} 首歌曲</p>
        </div>
        
        {/* 播放全部按钮 */}
        <button 
          onClick={() => favorites.length > 0 && onTrackSelect(favorites[0])}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-sm rounded-full font-medium shadow-md hover:shadow-lg transition-all ml-2"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
          播放
        </button>
      </div>
      
      <div className="flex items-center gap-1">
        {/* 视图切换 */}
        <div className="flex items-center gap-0.5 bg-black/5 dark:bg-white/5 rounded-lg p-0.5">
          <button 
            onClick={() => { setViewMode('minimal'); setAnimationKey(k => k + 1); }} 
            className={`p-1.5 rounded transition-colors ${viewMode === 'minimal' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'hover:bg-white/50 dark:hover:bg-gray-600/50'}`}
            title="列表视图"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <button 
            onClick={() => { setViewMode('cards'); setAnimationKey(k => k + 1); }} 
            className={`p-1.5 rounded transition-colors ${viewMode === 'cards' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'hover:bg-white/50 dark:hover:bg-gray-600/50'}`}
            title="卡片视图"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </button>
          <button 
            onClick={() => { setViewMode('album-wall'); setAnimationKey(k => k + 1); }} 
            className={`p-1.5 rounded transition-colors ${viewMode === 'album-wall' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'hover:bg-white/50 dark:hover:bg-gray-600/50'}`}
            title="专辑墙"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" /></svg>
          </button>
        </div>
        
        <button onClick={handleRefresh} disabled={isLoading} className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="刷新">
          <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
        
        {favoriteCount > 0 && (
          <button onClick={clearAllFavorites} disabled={isLoading} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors" title="清空收藏">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        )}
      </div>
    </div>
  );

  // 渲染不同视图模式的内容区域
  const renderContent = () => {
    // 方案1：列表模式 - 标准列表
    if (viewMode === 'minimal') {
      return (
        <div className="animate-fadeIn">
          <TracksView
            tracks={favorites}
            onTrackSelect={onTrackSelect}
            isLoading={isLoading}
            selectedTrackId={selectedTrackId}
            showFavoriteButtons={true}
            onFavoriteChange={(trackId, isFavorite) => {
              if (!isFavorite) {
                setFavorites(prev => prev.filter(track => track.id !== trackId));
                setFavoriteCount(prev => prev - 1);
              }
            }}
          />
        </div>
      );
    }


    // 方案2：卡片模式 - 现代卡片设计
    if (viewMode === 'cards') {
      return (
        <div key={`cards-view-${animationKey}`} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {favorites.map((track, index) => {
              const coverUrl = coverCache.get(track.id);
              return (
                <div
                  key={`${track.id}-${animationKey}`}
                  onClick={() => onTrackSelect(track)}
                  className={`group cursor-pointer rounded-lg p-3 transition-all border-2 animate-fadeInUp ${
                    selectedTrackId === track.id 
                      ? 'border-pink-400 dark:border-pink-500 bg-pink-50 dark:bg-pink-900/20' 
                      : 'border-transparent bg-black/5 dark:bg-white/5 hover:border-black/10 dark:hover:border-white/10'
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    {/* 封面 */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 shadow-md group-hover:shadow-lg transition-shadow bg-slate-100 dark:bg-slate-800">
                      {coverUrl ? (
                        <img 
                          src={coverUrl} 
                          alt={`${track.album || track.title} 封面`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-contrast-primary truncate mb-0.5">{track.title || '未知歌曲'}</h3>
                      <p className="text-xs text-contrast-secondary truncate">{track.artist || '未知艺术家'}</p>
                    </div>
                    <div className="text-xs text-contrast-secondary flex-shrink-0">
                      {track.duration_ms ? `${Math.floor(track.duration_ms / 60000)}:${String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      );
    }

    // 方案3：专辑墙模式 - 视觉化展示
    if (viewMode === 'album-wall') {
      return (
        <div key={`album-wall-view-${animationKey}`} className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {favorites.map((track, index) => {
              const coverUrl = coverCache.get(track.id);
              return (
                <div
                  key={`${track.id}-${animationKey}`}
                  onClick={() => onTrackSelect(track)}
                  className="group cursor-pointer animate-fadeInUp"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  {/* 封面 */}
                  <div className={`aspect-square rounded-lg mb-2 overflow-hidden relative transition-all ${
                    selectedTrackId === track.id 
                      ? 'ring-2 ring-pink-500 ring-offset-2 dark:ring-offset-gray-900 shadow-xl scale-105' 
                      : 'shadow-md group-hover:shadow-xl group-hover:scale-105'
                  }`}>
                    {coverUrl ? (
                      <>
                        <img 
                          src={coverUrl} 
                          alt={`${track.album || track.title} 封面`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                      </>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <h3 className="font-medium text-xs text-contrast-primary truncate mb-0.5">{track.title || '未知'}</h3>
                  <p className="text-[10px] text-contrast-secondary truncate">{track.artist || '未知艺术家'}</p>
                </div>
              );
            })}
          </div>
      );
    }

    return null;
  };

  // 显示收藏列表
  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-6">
        {renderHeader()}
        {renderContent()}
      </div>
    </div>
  );
}
