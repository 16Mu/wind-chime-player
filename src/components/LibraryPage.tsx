/**
 * 音乐库页面 - 重构版
 * 
 * 优化：
 * - 使用LibraryContext获取数据，减少props传递
 * - 使用React.memo优化渲染性能
 * - 移除重复的事件监听（已在LibraryContext中处理）
 * - 高内聚低耦合设计
 */

import { useState, useMemo, memo } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
  const { tracks, stats, refresh } = useLibrary();
  const { isLoading, isScanning, scanProgress } = useLibraryStatus();
  const { addTracksToPlaylist } = usePlaylist();

  // ========== 本地状态 ==========
  const [viewMode, setViewMode] = useState<ViewMode>('tracks');
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);
  const [selectedTrackForPlaylist, setSelectedTrackForPlaylist] = useState<Track | null>(null);

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

  // ========== 扫描进度文本 ==========
  const scanProgressText = useMemo(() => {
    if (!scanProgress) return '';
    
    const percent = scanProgress.progress_percent || 0;
    const current = scanProgress.scanned_files || 0;
    const total = scanProgress.total_files || 0;
    
    return `扫描中... ${percent.toFixed(0)}% (${current}/${total})`;
  }, [scanProgress]);

  // ========== 播放全部 ==========
  const handlePlayAll = async () => {
    if (tracks.length > 0) {
      try {
        await invoke('player_load_playlist', { tracks });
        await invoke('player_play', { trackId: tracks[0].id, timestamp: Date.now() });
      } catch (error) {
        console.error('播放失败:', error);
      }
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
    <div className="library-simple">
      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-4 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-dark-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 dark:text-dark-700 mb-1">曲目总数</div>
              <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                {isLoading ? '...' : displayStats.total_tracks}
              </div>
            </div>
            <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/30 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 bg-gradient-to-br from-violet-50 to-white dark:from-violet-900/20 dark:to-dark-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 dark:text-dark-700 mb-1">艺术家</div>
              <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                {isLoading ? '...' : displayStats.total_artists}
              </div>
            </div>
            <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-dark-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 dark:text-dark-700 mb-1">专辑</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {isLoading ? '...' : displayStats.total_albums}
              </div>
            </div>
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('tracks')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'tracks'
                ? 'bg-brand-600 text-white shadow-md'
                : 'bg-white dark:bg-dark-100 border border-slate-200 dark:border-dark-400 text-slate-700 dark:text-dark-800 hover:bg-slate-50 dark:hover:bg-dark-200'
            }`}
          >
            曲目
          </button>
          <button
            onClick={() => setViewMode('albums')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'albums'
                ? 'bg-brand-600 text-white shadow-md'
                : 'bg-white dark:bg-dark-100 border border-slate-200 dark:border-dark-400 text-slate-700 dark:text-dark-800 hover:bg-slate-50 dark:hover:bg-dark-200'
            }`}
          >
            专辑
          </button>
          <button
            onClick={() => setViewMode('artists')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'artists'
                ? 'bg-brand-600 text-white shadow-md'
                : 'bg-white dark:bg-dark-100 border border-slate-200 dark:border-dark-400 text-slate-700 dark:text-dark-800 hover:bg-slate-50 dark:hover:bg-dark-200'
            }`}
          >
            艺术家
          </button>
        </div>

        <div className="flex gap-2">
          {isScanning ? (
            <div className="px-4 py-2 bg-white dark:bg-dark-100 border border-slate-200 dark:border-dark-400 rounded-lg flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-slate-600 dark:text-dark-700">{scanProgressText}</span>
            </div>
          ) : (
            <>
              <button
                onClick={handlePlayAll}
                disabled={tracks.length === 0}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
              >
                播放全部
              </button>
              <button
                onClick={refresh}
                className="px-4 py-2 bg-white dark:bg-dark-100 border border-slate-200 dark:border-dark-400 rounded-lg font-medium text-slate-700 dark:text-dark-800 hover:bg-slate-50 dark:hover:bg-dark-200"
              >
                刷新
              </button>
            </>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="glass-card p-6">
        {viewMode === 'tracks' && (
          <TracksView
            tracks={tracks}
            onTrackSelect={onTrackSelect}
            isLoading={isLoading}
            selectedTrackId={selectedTrackId}
            onAddToPlaylist={handleAddToPlaylist}
          />
        )}
        
          {viewMode === 'albums' && (
            <AlbumsView 
              tracks={tracks}
              onTrackSelect={onTrackSelect}
              isLoading={isLoading}
            />
          )}
          
          {viewMode === 'artists' && (
            <ArtistsView 
              tracks={tracks}
              onTrackSelect={onTrackSelect}
              isLoading={isLoading}
            />
          )}
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


