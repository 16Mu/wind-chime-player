/**
 * 音乐库选择对话框 - 用于从音乐库选择曲目添加到歌单
 * 
 * 设计原则：
 * - 复用TracksView组件
 * - 支持多选模式
 * - 搜索和筛选功能
 */

import React, { useState, useMemo } from 'react';
import { useLibrary } from '../../contexts/LibraryContext';
import { X, Search, Check } from 'lucide-react';

interface MusicLibrarySelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (trackIds: number[]) => void;
  playlistName?: string;
}

export const MusicLibrarySelectorDialog: React.FC<MusicLibrarySelectorDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  playlistName,
}) => {
  const { tracks } = useLibrary();
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // 搜索过滤
  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    
    const query = searchQuery.toLowerCase();
    return tracks.filter(
      t =>
        t.title?.toLowerCase().includes(query) ||
        t.artist?.toLowerCase().includes(query) ||
        t.album?.toLowerCase().includes(query)
    );
  }, [tracks, searchQuery]);

  // 切换选择
  const toggleTrack = (trackId: number) => {
    setSelectedTrackIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trackId)) {
        newSet.delete(trackId);
      } else {
        newSet.add(trackId);
      }
      return newSet;
    });
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedTrackIds.size === filteredTracks.length) {
      setSelectedTrackIds(new Set());
    } else {
      setSelectedTrackIds(new Set(filteredTracks.map(t => t.id)));
    }
  };

  // 确认添加
  const handleConfirm = () => {
    if (selectedTrackIds.size > 0) {
      onConfirm(Array.from(selectedTrackIds));
      setSelectedTrackIds(new Set());
      setSearchQuery('');
      onClose();
    }
  };

  // 取消
  const handleCancel = () => {
    setSelectedTrackIds(new Set());
    setSearchQuery('');
    onClose();
  };

  // 格式化时长
  const formatDuration = (ms?: number): string => {
    if (!ms) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-dark-400">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-dark-900">
              从音乐库添加曲目
            </h2>
            {playlistName && (
              <p className="text-sm text-slate-500 dark:text-dark-600 mt-1">
                添加到：{playlistName}
              </p>
            )}
          </div>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* 搜索栏和统计 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索曲目、艺术家或专辑..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
            />
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-600 dark:text-gray-400">
              已选择 <span className="font-bold text-brand-600">{selectedTrackIds.size}</span> 首曲目
              {filteredTracks.length !== tracks.length && (
                <span className="ml-2">（从 {filteredTracks.length} 个结果中）</span>
              )}
            </div>
            <button
              onClick={toggleSelectAll}
              className="text-brand-600 hover:text-brand-700 font-medium"
            >
              {selectedTrackIds.size === filteredTracks.length ? '取消全选' : '全选'}
            </button>
          </div>
        </div>

        {/* 曲目列表 */}
        <div className="flex-1 overflow-y-auto">
          {filteredTracks.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-gray-500 dark:text-gray-400">
                {searchQuery ? '未找到匹配的曲目' : '音乐库为空'}
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
                  <th className="w-12 px-4 py-3"></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">曲目</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 hidden md:table-cell">专辑</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 w-20">时长</th>
                </tr>
              </thead>
              <tbody>
                {filteredTracks.map((track) => {
                  const isSelected = selectedTrackIds.has(track.id);
                  return (
                    <tr
                      key={track.id}
                      onClick={() => toggleTrack(track.id)}
                      className={`
                        border-b border-gray-100 dark:border-gray-700 cursor-pointer transition-colors
                        ${isSelected
                          ? 'bg-brand-50 dark:bg-brand-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }
                      `}
                    >
                      <td className="px-4 py-3">
                        <div
                          className={`
                            w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                            ${isSelected
                              ? 'bg-brand-600 border-brand-600'
                              : 'border-gray-300 dark:border-gray-600'
                            }
                          `}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white text-sm">
                          {track.title || '未知标题'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {track.artist || '未知艺术家'}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs">
                          {track.album || '未知专辑'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                          {formatDuration(track.duration_ms)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            共 {tracks.length} 首曲目
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedTrackIds.size === 0}
              className="px-6 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
            >
              添加 {selectedTrackIds.size > 0 && `(${selectedTrackIds.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};




