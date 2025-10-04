/**
 * 歌单详情页 - 复合组件
 * 
 * 设计原则：
 * - 组合优于继承：组合多个小组件
 * - 逻辑与展示分离：业务逻辑在Context，展示在此
 * - 单向数据流：props下传，事件上报
 */

import React, { useEffect, useState } from 'react';
import { usePlaylist } from '../../contexts/PlaylistContext';
import {
  ArrowLeft,
  Play,
  Heart,
  MoreVertical,
  Clock,
  Music,
  Sparkles,
  Download,
  RefreshCw,
  Edit,
  Trash2,
  Share2,
  Pin,
  PinOff,
} from 'lucide-react';

interface PlaylistDetailProps {
  playlistId: number;
  onBack?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPlayTrack?: (trackId: number) => void;
  onAddTracks?: () => void;
}

export const PlaylistDetail: React.FC<PlaylistDetailProps> = ({
  playlistId,
  onBack,
  onEdit,
  onDelete,
  onPlayTrack,
  onAddTracks,
}) => {
  const {
    currentPlaylist,
    loading,
    error,
    getPlaylistDetail,
    removeTrackFromPlaylist,
    toggleFavorite,
    refreshSmartPlaylist,
    markPlayed,
    exportPlaylist,
    exportPlaylistPreview,
    pinPlaylist,
    unpinPlaylist,
  } = usePlaylist();

  const [showMenu, setShowMenu] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // 加载歌单详情
  useEffect(() => {
    getPlaylistDetail(playlistId);
  }, [playlistId, getPlaylistDetail]);

  if (loading && !currentPlaylist) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (!currentPlaylist) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center text-slate-500 dark:text-gray-500">
          <Music className="w-16 h-16 mx-auto mb-4 text-slate-400 dark:text-gray-600" />
          <p>歌单不存在</p>
        </div>
      </div>
    );
  }

  const { playlist, tracks } = currentPlaylist;

  // 格式化时长
  const formatDuration = (ms?: number): string => {
    if (!ms) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 格式化总时长
  const formatTotalDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  };

  // 处理收藏
  const handleToggleFavorite = async () => {
    try {
      await toggleFavorite(playlist.id);
    } catch (err) {
      console.error('切换收藏失败:', err);
    }
  };

  // 处理刷新智能歌单
  const handleRefreshSmart = async () => {
    if (!playlist.is_smart) return;
    try {
      await refreshSmartPlaylist(playlist.id);
    } catch (err) {
      console.error('刷新智能歌单失败:', err);
    }
  };

  // 处理删除曲目
  const handleRemoveTrack = async (trackId: number) => {
    try {
      await removeTrackFromPlaylist(playlist.id, trackId);
    } catch (err) {
      console.error('移除曲目失败:', err);
    }
  };

  // 处理播放全部
  const handlePlayAll = async () => {
    if (tracks.length > 0) {
      await markPlayed(playlist.id);
      onPlayTrack?.(tracks[0].id);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* 头部 - 歌单信息 */}
      <div className="flex-none">
        {/* 顶部工具栏 */}
        <div className="p-4 flex items-center justify-between bg-white/60 dark:bg-black/20 backdrop-blur-sm border-b border-slate-200 dark:border-gray-800">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-900 dark:text-white" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <MoreVertical className="w-5 h-5 text-slate-900 dark:text-white" />
            </button>

            {/* 下拉菜单 */}
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 rounded-lg shadow-xl z-10">
                {onEdit && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit();
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-gray-700 flex items-center gap-2 text-slate-900 dark:text-white text-sm"
                  >
                    <Edit className="w-4 h-4" />
                    编辑歌单
                  </button>
                )}
                {playlist.is_smart && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      handleRefreshSmart();
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-gray-700 flex items-center gap-2 text-slate-900 dark:text-white text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    刷新智能歌单
                  </button>
                )}
                <button
                  onClick={async () => {
                    setShowMenu(false);
                    try {
                      if (playlist.is_pinned) {
                        await unpinPlaylist(playlist.id);
                      } else {
                        await pinPlaylist(playlist.id);
                      }
                      // 重新加载歌单详情
                      await getPlaylistDetail(playlist.id);
                    } catch (err) {
                      alert('操作失败：' + err);
                    }
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-gray-700 flex items-center gap-2 text-slate-900 dark:text-white text-sm"
                >
                  {playlist.is_pinned ? (
                    <>
                      <PinOff className="w-4 h-4" />
                      取消置顶
                    </>
                  ) : (
                    <>
                      <Pin className="w-4 h-4" />
                      置顶歌单
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowExportDialog(true);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-gray-700 flex items-center gap-2 text-slate-900 dark:text-white text-sm"
                >
                  <Download className="w-4 h-4" />
                  导出歌单
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    // TODO: 分享功能
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-gray-700 flex items-center gap-2 text-slate-900 dark:text-white text-sm"
                >
                  <Share2 className="w-4 h-4" />
                  分享歌单
                </button>
                <div className="border-t border-slate-200 dark:border-gray-700 my-1" />
                {onDelete && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete();
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-red-50 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    删除歌单
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 歌单封面和信息 */}
        <div className="p-8 flex gap-6">
          {/* 封面 */}
          <div className="flex-none w-48 h-48 rounded-xl overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-500/20 dark:to-pink-500/20 shadow-2xl border border-purple-200 dark:border-transparent">
            {playlist.cover_path ? (
              <img
                src={playlist.cover_path}
                alt={playlist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="w-24 h-24 text-purple-300 dark:text-purple-400/40" />
              </div>
            )}
          </div>

          {/* 信息 */}
          <div className="flex-1 flex flex-col justify-end">
            {/* 标签 */}
            <div className="flex items-center gap-2 mb-3">
              {playlist.is_smart && (
                <span className="px-3 py-1 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-full text-xs flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  智能歌单
                </span>
              )}
              {playlist.is_favorite && (
                <span className="px-3 py-1 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 rounded-full text-xs flex items-center gap-1">
                  <Heart className="w-3 h-3 fill-current" />
                  收藏
                </span>
              )}
            </div>

            {/* 标题 */}
            <h1 className="text-5xl font-bold text-slate-900 dark:text-white mb-4">{playlist.name}</h1>

            {/* 描述 */}
            {playlist.description && (
              <p className="text-slate-600 dark:text-gray-400 mb-4 leading-relaxed">{playlist.description}</p>
            )}

            {/* 统计信息 */}
            <div className="flex items-center gap-6 text-sm text-slate-600 dark:text-gray-400">
              <span>{tracks.length} 首曲目</span>
              {playlist.total_duration_ms > 0 && (
                <>
                  <span>·</span>
                  <span>{formatTotalDuration(playlist.total_duration_ms)}</span>
                </>
              )}
              {playlist.play_count > 0 && (
                <>
                  <span>·</span>
                  <span>播放 {playlist.play_count} 次</span>
                </>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handlePlayAll}
                disabled={tracks.length === 0}
                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 
                  hover:from-purple-600 hover:to-pink-600
                  disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed
                  text-white rounded-full font-medium flex items-center gap-2
                  transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
              >
                <Play className="w-5 h-5" />
                播放全部
              </button>

              <button
                onClick={handleToggleFavorite}
                className={`p-3 rounded-full border-2 transition-all ${
                  playlist.is_favorite
                    ? 'border-red-500 text-red-500 bg-red-50 dark:bg-red-500/10'
                    : 'border-slate-400 dark:border-gray-600 text-slate-600 dark:text-gray-400 hover:border-slate-600 dark:hover:border-gray-500'
                }`}
              >
                <Heart className={`w-5 h-5 ${playlist.is_favorite ? 'fill-current' : ''}`} />
              </button>

              {onAddTracks && !playlist.is_smart && (
                <button
                  onClick={onAddTracks}
                  className="px-6 py-3 border-2 border-slate-400 dark:border-gray-600 text-slate-700 dark:text-gray-300 
                    hover:border-slate-600 dark:hover:border-gray-500 rounded-full font-medium
                    transition-colors"
                >
                  添加曲目
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-8 mb-4 p-4 bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 曲目列表 */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-gray-500">
            <Music className="w-16 h-16 mb-4 text-slate-400 dark:text-gray-600" />
            <p className="text-lg mb-2">
              {playlist.is_smart ? '没有匹配的曲目' : '还没有添加曲目'}
            </p>
            {!playlist.is_smart && onAddTracks && (
              <button
                onClick={onAddTracks}
                className="mt-4 px-4 py-2 bg-purple-500 hover:bg-purple-600 
                  text-white rounded-lg transition-colors"
              >
                添加曲目
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-black/20 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-200 dark:border-transparent">
            {/* 表头 */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs text-slate-500 dark:text-gray-500 uppercase border-b border-slate-200 dark:border-gray-700/50">
              <div className="col-span-1">#</div>
              <div className="col-span-5">标题</div>
              <div className="col-span-3">专辑</div>
              <div className="col-span-2">时长</div>
              <div className="col-span-1"></div>
            </div>

            {/* 曲目列表 */}
            {tracks.map((track, index) => (
              <div
                key={track.id}
                className="grid grid-cols-12 gap-4 px-6 py-3 hover:bg-slate-100 dark:hover:bg-white/5 
                  transition-colors group border-b border-slate-100 dark:border-gray-800/50 last:border-0"
              >
                {/* 序号 */}
                <div className="col-span-1 flex items-center text-slate-500 dark:text-gray-500">
                  <span className="group-hover:hidden">{index + 1}</span>
                  <Play
                    className="hidden group-hover:block w-4 h-4 text-slate-900 dark:text-white cursor-pointer"
                    onClick={() => onPlayTrack?.(track.id)}
                  />
                </div>

                {/* 标题和艺术家 */}
                <div className="col-span-5 flex flex-col justify-center min-w-0">
                  <div className="text-slate-900 dark:text-white truncate">{track.title || '未知标题'}</div>
                  <div className="text-sm text-slate-600 dark:text-gray-500 truncate">{track.artist || '未知艺术家'}</div>
                </div>

                {/* 专辑 */}
                <div className="col-span-3 flex items-center text-slate-600 dark:text-gray-400 truncate">
                  {track.album || '未知专辑'}
                </div>

                {/* 时长 */}
                <div className="col-span-2 flex items-center text-slate-600 dark:text-gray-400">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatDuration(track.duration_ms)}
                </div>

                {/* 操作 */}
                <div className="col-span-1 flex items-center justify-end">
                  {!playlist.is_smart && (
                    <button
                      onClick={() => handleRemoveTrack(track.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 hover:bg-slate-200 dark:hover:bg-white/10 
                        rounded transition-all text-slate-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 导出对话框 */}
      {showExportDialog && (
        <ExportPlaylistDialog
          playlistId={playlistId}
          playlistName={playlist.name}
          onClose={() => setShowExportDialog(false)}
          onExport={exportPlaylist}
          onPreview={exportPlaylistPreview}
        />
      )}
    </div>
  );
};

// 导出歌单对话框组件
interface ExportPlaylistDialogProps {
  playlistId: number;
  playlistName: string;
  onClose: () => void;
  onExport: (id: number, filePath: string, format: 'M3U' | 'M3U8' | 'JSON') => Promise<void>;
  onPreview: (id: number, format: 'M3U' | 'M3U8' | 'JSON') => Promise<string>;
}

const ExportPlaylistDialog: React.FC<ExportPlaylistDialogProps> = ({
  playlistId,
  playlistName,
  onClose,
  onExport,
  onPreview,
}) => {
  const [format, setFormat] = useState<'M3U' | 'M3U8' | 'JSON'>('M3U8');
  const [preview, setPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handlePreview = async () => {
    try {
      setLoading(true);
      const content = await onPreview(playlistId, format);
      setPreview(content);
      setShowPreview(true);
    } catch (err) {
      alert('预览失败：' + err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      // 生成默认文件名
      const timestamp = new Date().toISOString().slice(0, 10);
      const ext = format === 'JSON' ? 'json' : 'm3u8';
      const defaultPath = `${playlistName}_${timestamp}.${ext}`;
      
      // 使用文件对话框选择保存位置
      const { save } = await import('@tauri-apps/plugin-dialog');
      const filePath = await save({
        defaultPath,
        filters: [{
          name: `${format} 歌单`,
          extensions: [ext],
        }],
      });

      if (filePath) {
        await onExport(playlistId, filePath, format);
        alert('导出成功！');
        onClose();
      }
    } catch (err) {
      alert('导出失败：' + err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">导出歌单</h3>
          <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
            将"{playlistName}"导出为文件
          </p>
        </div>

        <div className="p-6 overflow-y-auto">
          <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
            选择格式
          </label>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {(['M3U', 'M3U8', 'JSON'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setFormat(fmt)}
                className={`px-4 py-3 rounded-lg border-2 transition-all ${
                  format === fmt
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                    : 'border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600 text-slate-700 dark:text-gray-300'
                }`}
              >
                <div className="font-semibold">{fmt}</div>
                <div className="text-xs mt-1">
                  {fmt === 'M3U' && '标准格式'}
                  {fmt === 'M3U8' && 'UTF-8编码'}
                  {fmt === 'JSON' && 'JSON格式'}
                </div>
              </button>
            ))}
          </div>

          {showPreview && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                预览
              </label>
              <pre className="bg-slate-100 dark:bg-gray-900 p-4 rounded-lg text-xs overflow-x-auto max-h-60">
                {preview}
              </pre>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={handlePreview}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 transition-colors disabled:opacity-50"
          >
            {loading ? '加载中...' : '预览'}
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? '导出中...' : '导出'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

