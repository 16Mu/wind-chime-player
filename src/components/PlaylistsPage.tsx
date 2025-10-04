/**
 * 歌单管理页面 - 高内聚低耦合设计
 * 
 * 职责：
 * - 协调歌单列表和歌单详情的展示
 * - 处理歌单相关的所有交互逻辑
 * - 管理页面内部的导航状态
 * 
 * 设计原则：
 * - 高内聚：歌单页面的所有逻辑都封装在此
 * - 低耦合：通过PlaylistContext获取数据，通过props接收外部依赖
 * - 单一职责：只负责歌单页面的展示和交互
 */

import { useState } from 'react';
import { usePlaylist } from '../contexts/PlaylistContext';
import { PlaylistsView } from './playlist/PlaylistsView';
import { PlaylistDetail } from './playlist/PlaylistDetail';
import { CreatePlaylistDialog } from './playlist/CreatePlaylistDialog';
import { SmartPlaylistEditor } from './playlist/SmartPlaylistEditor';
import { MusicLibrarySelectorDialog } from './playlist/MusicLibrarySelectorDialog';
import { PlaylistStatsCard } from './PlaylistStatsCard';
import type { Track } from '../types/music';

interface PlaylistsPageProps {
  /** 当用户点击曲目时触发，用于播放音乐 */
  onTrackSelect?: (track: Track) => void;
  /** 当前选中的曲目ID，用于高亮显示 */
  selectedTrackId?: number;
}

type ViewMode = 'list' | 'detail' | 'create' | 'create-smart' | 'edit';

export default function PlaylistsPage({ onTrackSelect }: PlaylistsPageProps) {
  // ========== 状态管理 ==========
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [showMusicLibrarySelector, setShowMusicLibrarySelector] = useState(false);
  
  // 从Context获取数据和方法
  const { currentPlaylist, deletePlaylist, addTracksToPlaylist, clearCurrentPlaylist } = usePlaylist();

  // ========== 导航处理 ==========

  const handlePlaylistClick = (playlistId: number) => {
    setSelectedPlaylistId(playlistId);
    setViewMode('detail');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedPlaylistId(null);
    clearCurrentPlaylist(); // 清除当前歌单状态
  };

  const handleCreateClick = () => {
    setViewMode('create');
  };

  const handleCreateSuccess = () => {
    setViewMode('list');
  };

  const handleEditPlaylist = () => {
    // 编辑功能可以复用创建对话框，预填充数据
    setViewMode('edit');
  };

  const handleDeletePlaylist = async () => {
    if (!selectedPlaylistId) return;
    
    if (confirm('确定要删除这个歌单吗？此操作不可撤销。')) {
      try {
        await deletePlaylist(selectedPlaylistId);
        handleBackToList();
      } catch (err) {
        console.error('删除歌单失败:', err);
        alert('删除歌单失败：' + err);
      }
    }
  };

  const handleAddTracksClick = () => {
    setShowMusicLibrarySelector(true);
  };

  const handleTracksSelected = async (trackIds: number[]) => {
    if (!selectedPlaylistId || trackIds.length === 0) return;

    try {
      await addTracksToPlaylist(selectedPlaylistId, trackIds);
      alert(`已添加 ${trackIds.length} 首曲目到歌单`);
    } catch (err) {
      console.error('添加曲目失败:', err);
      alert('添加曲目失败：' + err);
    }
  };

  // ========== 曲目播放处理 ==========

  const handleTrackPlayById = (trackId: number) => {
    // 从当前歌单中找到对应的曲目
    if (currentPlaylist) {
      const track = currentPlaylist.tracks.find(t => t.id === trackId);
      if (track && onTrackSelect) {
        onTrackSelect(track);
      }
    }
  };

  // ========== 渲染 ==========

  return (
    <div className="h-full">
      {/* 歌单列表视图 */}
      {viewMode === 'list' && (
        <div className="h-full animate-fade-in space-y-6">
          {/* 歌单统计卡片 */}
          <PlaylistStatsCard />
          
          {/* 歌单列表 */}
          <PlaylistsView
            onCreateClick={handleCreateClick}
            onPlaylistClick={handlePlaylistClick}
          />
        </div>
      )}

      {/* 歌单详情视图 */}
      {viewMode === 'detail' && selectedPlaylistId && (
        <div className="h-full animate-fade-in">
          <PlaylistDetail
            playlistId={selectedPlaylistId}
            onBack={handleBackToList}
            onEdit={handleEditPlaylist}
            onDelete={handleDeletePlaylist}
            onPlayTrack={handleTrackPlayById}
            onAddTracks={handleAddTracksClick}
          />
        </div>
      )}

      {/* 创建普通歌单对话框 */}
      {viewMode === 'create' && (
        <CreatePlaylistDialog
          isOpen={true}
          onClose={handleBackToList}
          onSuccess={handleCreateSuccess}
        />
      )}

      {/* 编辑歌单对话框 */}
      {viewMode === 'edit' && selectedPlaylistId && currentPlaylist && (
        <CreatePlaylistDialog
          isOpen={true}
          onClose={handleBackToList}
          onSuccess={handleCreateSuccess}
          editPlaylist={currentPlaylist.playlist}
        />
      )}

      {/* 创建智能歌单对话框 */}
      {viewMode === 'create-smart' && (
        <SmartPlaylistEditor
          onClose={handleBackToList}
          onSuccess={handleCreateSuccess}
        />
      )}

      {/* 从音乐库选择曲目对话框 */}
      <MusicLibrarySelectorDialog
        isOpen={showMusicLibrarySelector}
        onClose={() => setShowMusicLibrarySelector(false)}
        onConfirm={handleTracksSelected}
        playlistName={currentPlaylist?.playlist.name}
      />
    </div>
  );
}

