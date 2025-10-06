/**
 * 创建/编辑歌单对话框 - 受控组件
 * 
 * 设计原则：
 * - 受控组件：完全由父组件控制显示/隐藏
 * - 表单逻辑内聚：表单验证和提交逻辑集中
 * - 单一职责：只负责歌单创建/编辑表单
 */

import React, { useState, useEffect } from 'react';
import { usePlaylist, CreatePlaylistOptions, UpdatePlaylistOptions, Playlist } from '../../contexts/PlaylistContext';
import { X, Sparkles } from 'lucide-react';

interface CreatePlaylistDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editPlaylist?: Playlist; // 如果提供，则为编辑模式
  onSuccess?: (playlistId: number) => void;
}

export const CreatePlaylistDialog: React.FC<CreatePlaylistDialogProps> = ({
  isOpen,
  onClose,
  editPlaylist,
  onSuccess,
}) => {
  const { createPlaylist, updatePlaylist, loading } = usePlaylist();

  // 表单状态
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSmartPlaylist, setIsSmartPlaylist] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  const isEditMode = !!editPlaylist;

  // 初始化表单（编辑模式）
  useEffect(() => {
    if (editPlaylist) {
      setName(editPlaylist.name);
      setDescription(editPlaylist.description || '');
      setIsSmartPlaylist(editPlaylist.is_smart);
    } else {
      // 重置表单
      setName('');
      setDescription('');
      setIsSmartPlaylist(false);
      setErrors({});
    }
  }, [editPlaylist, isOpen]);

  // 验证表单
  const validate = (): boolean => {
    const newErrors: { name?: string } = {};

    if (!name.trim()) {
      newErrors.name = '请输入歌单名称';
    } else if (name.length > 100) {
      newErrors.name = '名称不能超过100个字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 处理提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      if (isEditMode && editPlaylist) {
        // 编辑模式
        const options: UpdatePlaylistOptions = {
          name: name !== editPlaylist.name ? name : undefined,
          description: description !== editPlaylist.description ? description : undefined,
        };

        await updatePlaylist(editPlaylist.id, options);
        onSuccess?.(editPlaylist.id);
      } else {
        // 创建模式
        const options: CreatePlaylistOptions = {
          name,
          description: description || undefined,
          is_smart: isSmartPlaylist,
          smart_rules: undefined, // 智能歌单规则在后续编辑器中设置
        };

        const playlistId = await createPlaylist(options);
        onSuccess?.(playlistId);
      }

      onClose();
    } catch (err) {
      console.error('保存歌单失败:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl 
          w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* 标题 */}
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {isEditMode ? '编辑歌单' : '新建歌单'}
            </h2>
          </div>

          {/* 表单内容 */}
          <div className="space-y-4 mb-6">
            {/* 歌单名称 */}
            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="歌单标题"
                className={`w-full px-4 py-3 bg-slate-50 dark:bg-gray-700/50 border-0 rounded-lg
                  text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-purple-500/50
                  transition-all text-base ${
                    errors.name ? 'ring-2 ring-red-500/50' : ''
                  }`}
                disabled={loading}
                maxLength={100}
                autoFocus
              />
              {errors.name && (
                <p className="mt-2 text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            {/* 描述 */}
            <div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="添加描述（可选）"
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-gray-700/50 border-0 rounded-lg
                  text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-purple-500/50
                  transition-all resize-none text-sm"
                disabled={loading}
                maxLength={500}
              />
            </div>

            {/* 智能歌单选项 */}
            {!isEditMode && (
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={isSmartPlaylist}
                  onChange={(e) => setIsSmartPlaylist(e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-slate-100 dark:bg-gray-700 border-slate-300 dark:border-gray-600 
                    rounded focus:ring-2 focus:ring-purple-500/30"
                  disabled={loading}
                />
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm text-slate-700 dark:text-gray-300">智能歌单</span>
                </div>
              </label>
            )}
          </div>

          {/* 底部按钮 */}
          <div className="flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700
                rounded-lg font-medium transition-colors"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700
                disabled:bg-slate-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed
                text-white rounded-lg font-medium transition-all"
              disabled={loading || !name.trim()}
            >
              {loading ? '创建中...' : isEditMode ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
