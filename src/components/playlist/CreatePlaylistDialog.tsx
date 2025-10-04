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
  const [colorTheme, setColorTheme] = useState('#8B5CF6'); // 默认紫色
  const [isSmartPlaylist, setIsSmartPlaylist] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  const isEditMode = !!editPlaylist;

  // 初始化表单（编辑模式）
  useEffect(() => {
    if (editPlaylist) {
      setName(editPlaylist.name);
      setDescription(editPlaylist.description || '');
      setColorTheme(editPlaylist.color_theme || '#8B5CF6');
      setIsSmartPlaylist(editPlaylist.is_smart);
    } else {
      // 重置表单
      setName('');
      setDescription('');
      setColorTheme('#8B5CF6');
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
          color_theme: colorTheme !== editPlaylist.color_theme ? colorTheme : undefined,
        };

        await updatePlaylist(editPlaylist.id, options);
        onSuccess?.(editPlaylist.id);
      } else {
        // 创建模式
        const options: CreatePlaylistOptions = {
          name,
          description: description || undefined,
          color_theme: colorTheme,
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

  // 预设主题色
  const presetColors = [
    '#8B5CF6', // 紫色
    '#EC4899', // 粉色
    '#EF4444', // 红色
    '#F59E0B', // 橙色
    '#10B981', // 绿色
    '#3B82F6', // 蓝色
    '#6366F1', // 靛蓝
    '#8B5A00', // 棕色
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="bg-white dark:bg-gradient-to-br dark:from-dark-100 dark:to-dark-200 rounded-2xl shadow-2xl 
          w-full max-w-md border border-slate-200 dark:border-dark-400 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="relative p-6 border-b border-slate-200 dark:border-dark-400">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-dark-900">
            {isEditMode ? '编辑歌单' : '创建新歌单'}
          </h2>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-dark-200 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5 text-slate-500 dark:text-dark-600" />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 歌单名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              歌单名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="给你的歌单起个名字..."
              className={`w-full px-4 py-2.5 bg-gray-900/50 border rounded-lg 
                text-white placeholder-gray-500
                focus:outline-none focus:ring-2 focus:border-transparent
                transition-all ${
                  errors.name
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-gray-700 focus:ring-purple-500/50'
                }`}
              disabled={loading}
              maxLength={100}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-400">{errors.name}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">{name.length}/100</p>
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="添加一些描述..."
              rows={3}
              className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg 
                text-white placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent
                transition-all resize-none"
              disabled={loading}
              maxLength={500}
            />
            <p className="mt-1 text-xs text-gray-500">{description.length}/500</p>
          </div>

          {/* 主题色 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              主题色
            </label>
            <div className="flex gap-3 flex-wrap">
              {presetColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setColorTheme(color)}
                  className={`w-10 h-10 rounded-lg transition-all ${
                    colorTheme === color
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  disabled={loading}
                />
              ))}
              {/* 自定义颜色选择器 */}
              <div className="relative w-10 h-10">
                <input
                  type="color"
                  value={colorTheme}
                  onChange={(e) => setColorTheme(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={loading}
                />
                <div
                  className="w-full h-full rounded-lg border-2 border-dashed border-gray-600 
                    flex items-center justify-center hover:border-gray-500 transition-colors"
                >
                  <span className="text-xs text-gray-500">+</span>
                </div>
              </div>
            </div>
          </div>

          {/* 智能歌单选项（仅创建模式） */}
          {!isEditMode && (
            <div>
              <label className="flex items-center gap-3 p-4 bg-purple-500/10 border border-purple-500/30 
                rounded-lg cursor-pointer hover:bg-purple-500/20 transition-colors">
                <input
                  type="checkbox"
                  checked={isSmartPlaylist}
                  onChange={(e) => setIsSmartPlaylist(e.target.checked)}
                  className="w-4 h-4 text-purple-500 bg-gray-900 border-gray-600 rounded 
                    focus:ring-purple-500/50 focus:ring-2"
                  disabled={loading}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>创建智能歌单</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    根据规则自动添加符合条件的曲目
                  </p>
                </div>
              </label>
              {isSmartPlaylist && (
                <p className="mt-2 text-xs text-purple-400">
                  创建后可以在歌单详情页设置智能规则
                </p>
              )}
            </div>
          )}

          {/* 按钮 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 
                text-white rounded-lg font-medium transition-colors"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 
                hover:from-purple-600 hover:to-pink-600
                disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed
                text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl"
              disabled={loading}
            >
              {loading ? '保存中...' : isEditMode ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

