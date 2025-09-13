import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import TracksView from './TracksView';

interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
}

interface FavoritesViewProps {
  onTrackSelect: (track: Track) => void;
  membraneSettings?: {
    enabled: boolean;
    intensity: number;
    radius: number;
  };
}

export default function FavoritesView({ 
  onTrackSelect, 
  membraneSettings = { enabled: true, intensity: 1, radius: 1 } 
}: FavoritesViewProps) {
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
        invoke('favorites_remove', { trackId: track.id })
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

  // 从收藏中移除单首歌曲（保留以备将来使用）
  // const removeFavorite = async (trackId: number) => {
  //   try {
  //     await invoke('favorites_remove', { trackId });
  //     
  //     // 更新本地状态，移除该歌曲
  //     setFavorites(prev => prev.filter(track => track.id !== trackId));
  //     setFavoriteCount(prev => prev - 1);
  //     
  //     console.log('💔 已取消收藏');
  //   } catch (error) {
  //     console.error('移除收藏失败:', error);
  //   }
  // };

  // 组件挂载时加载收藏
  useEffect(() => {
    loadFavorites();
  }, []);

  // 刷新收藏列表
  const handleRefresh = () => {
    loadFavorites();
  };

  // 如果正在加载且没有数据
  if (isLoading && favorites.length === 0) {
    return (
      <div className="glass-card min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-400 mb-6">
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
          <div className="text-red-400 mb-6">
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
          <div className="text-slate-400 mb-6">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">暂无收藏</h2>
          <p className="text-slate-600 text-lg mb-6">您还没有收藏任何音乐</p>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
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

  // 显示收藏列表
  return (
    <div className="space-y-6">
      {/* 收藏页面头部 */}
      <div className="glass-surface p-6 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">我的收藏</h1>
              <p className="text-slate-600">
                {favoriteCount} 首喜爱的音乐
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="glass-button secondary"
              disabled={isLoading}
              title="刷新收藏列表"
            >
              <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isLoading ? '刷新中' : '刷新'}
            </button>
            
            {favoriteCount > 0 && (
              <button
                onClick={clearAllFavorites}
                className="glass-button danger text-sm"
                disabled={isLoading}
                title="清空所有收藏"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                清空收藏
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 收藏歌曲列表 */}
      <TracksView
        tracks={favorites}
        onTrackSelect={onTrackSelect}
        isLoading={isLoading}
        blurBackdropSettings={{
          enabled: membraneSettings.enabled,
          intensity: membraneSettings.intensity === 1 ? 'medium' : membraneSettings.intensity > 1 ? 'high' : 'low',
          opacity: 0.8
        }}
        showFavoriteButtons={true}
        onFavoriteChange={(trackId, isFavorite) => {
          if (!isFavorite) {
            // 如果取消收藏，从列表中移除该歌曲
            setFavorites(prev => prev.filter(track => track.id !== trackId));
            setFavoriteCount(prev => prev - 1);
            console.log('💔 已从收藏中移除');
          }
        }}
      />
    </div>
  );
}


