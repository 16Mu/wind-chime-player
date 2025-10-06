/**
 * 歌单选择对话框 - 用于将曲目添加到歌单
 * 
 * 设计原则：
 * - 纯展示组件：接收歌单列表，发出选择事件
 * - 受控组件：由父组件控制显示/隐藏
 * - 支持快速创建新歌单
 */

import React, { useState, useMemo } from 'react';
import { usePlaylist, CreatePlaylistOptions } from '../../contexts/PlaylistContext';
import { X, Search, Plus, Music, Sparkles } from 'lucide-react';

interface PlaylistSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (playlistId: number) => void;
  /** 可选：预选的歌单ID */
  selectedPlaylistId?: number;
  /** 可选：要添加的曲目数量，用于显示提示 */
  trackCount?: number;
}

export const PlaylistSelectorDialog: React.FC<PlaylistSelectorDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedPlaylistId,
  trackCount = 1,
}) => {
  const { playlists, createPlaylist, loading } = usePlaylist();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // 筛选歌单（排除智能歌单，因为它们不能手动添加曲目）
  const availablePlaylists = useMemo(() => {
    return playlists.filter(p => !p.is_smart);
  }, [playlists]);

  // 搜索过滤
  const filteredPlaylists = useMemo(() => {
    if (!searchQuery.trim()) return availablePlaylists;
    
    const query = searchQuery.toLowerCase();
    return availablePlaylists.filter(
      p => p.name.toLowerCase().includes(query) ||
           p.description?.toLowerCase().includes(query)
    );
  }, [availablePlaylists, searchQuery]);

  // 处理选择歌单
  const handleSelectPlaylist = (playlistId: number) => {
    onSelect(playlistId);
    onClose();
  };

  // 处理创建新歌单
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;

    setIsCreating(true);
    try {
      const options: CreatePlaylistOptions = {
        name: newPlaylistName.trim(),
        is_smart: false,
      };
      
      const playlistId = await createPlaylist(options);
      
      // 创建成功后，直接选择这个歌单
      setNewPlaylistName('');
      setShowCreateForm(false);
      handleSelectPlaylist(playlistId);
    } catch (err) {
      console.error('创建歌单失败:', err);
      alert('创建歌单失败：' + err);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-16 pb-32 overflow-y-auto">
      <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-2xl max-w-lg w-full max-h-[calc(100vh-180px)] flex flex-col my-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-dark-400">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-dark-900">
              添加到歌单
            </h2>
            <p className="text-sm text-slate-500 dark:text-dark-600 mt-1">
              {trackCount === 1 ? '选择一个歌单' : `添加 ${trackCount} 首曲目`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* 搜索栏 */}
        <div className="p-4 border-b border-slate-200 dark:border-dark-400">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-dark-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索歌单..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-dark-200 border border-slate-200 dark:border-dark-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-dark-900"
            />
          </div>
        </div>

        {/* 歌单列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredPlaylists.length === 0 ? (
            <div className="text-center py-8">
              <Music className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery ? '未找到匹配的歌单' : '还没有歌单'}
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                点击下方按钮创建新歌单
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPlaylists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => handleSelectPlaylist(playlist.id)}
                  className={`
                    w-full p-3 rounded-lg text-left transition-colors
                    ${selectedPlaylistId === playlist.id
                      ? 'bg-brand-50 dark:bg-brand-900/20 border-2 border-brand-500'
                      : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white flex-shrink-0">
                      {playlist.is_smart ? (
                        <Sparkles className="w-5 h-5" />
                      ) : (
                        <Music className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {playlist.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {playlist.track_count} 首歌曲
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 创建新歌单 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          {showCreateForm ? (
            <div className="space-y-3">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="输入歌单名称..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreatePlaylist();
                  if (e.key === 'Escape') {
                    setShowCreateForm(false);
                    setNewPlaylistName('');
                  }
                }}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim() || isCreating}
                  className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                >
                  {isCreating ? '创建中...' : '创建'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewPlaylistName('');
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              创建新歌单
            </button>
          )}
        </div>
      </div>
    </div>
  );
};




