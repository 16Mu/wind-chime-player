/**
 * 高级设置页面 - 配置管理
 */

import { useState, useEffect } from 'react';
import { useConfig } from '../../contexts/ConfigContext';
import { SettingSection } from './ui/SettingSection';
import { CollapsiblePanel } from './ui/CollapsiblePanel';

export default function AdvancedSettings() {
  const { audioConfig, uiConfig, updateAudioConfig, updateUIConfig, resetConfig, isLoading } = useConfig();
  
  // 本地编辑状态
  const [editAudio, setEditAudio] = useState(audioConfig);
  const [editUI, setEditUI] = useState(uiConfig);

  // 同步远程配置到本地
  useEffect(() => {
    if (audioConfig) setEditAudio(audioConfig);
  }, [audioConfig]);

  useEffect(() => {
    if (uiConfig) setEditUI(uiConfig);
  }, [uiConfig]);

  const handleSaveAudio = async () => {
    if (!editAudio) return;
    try {
      await updateAudioConfig(editAudio);
      alert('音频配置已保存');
    } catch (error) {
      alert(`保存失败: ${error}`);
    }
  };

  const handleSaveUI = async () => {
    if (!editUI) return;
    try {
      await updateUIConfig(editUI);
      alert('UI配置已保存');
    } catch (error) {
      alert(`保存失败: ${error}`);
    }
  };

  const handleReset = async () => {
    if (!confirm('确定要重置所有配置为默认值吗？此操作不可撤销。')) return;
    try {
      await resetConfig();
      alert('配置已重置');
    } catch (error) {
      alert(`重置失败: ${error}`);
    }
  };

  if (!editAudio || !editUI) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
      {/* 音频配置 */}
      <SettingSection
        title="音频配置"
        description="调整音频播放参数"
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 012.828-2.828" />
          </svg>
        }
      >
        <CollapsiblePanel title="播放器设置" description="音量、缓冲和音频设备">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-2">
                默认音量
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={editAudio.default_volume}
                onChange={(e) => setEditAudio({ ...editAudio, default_volume: parseFloat(e.target.value) })}
                className="w-full"
              />
              <div className="text-xs text-slate-600 dark:text-dark-700 mt-1">
                当前值: {(editAudio.default_volume * 100).toFixed(0)}%
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-2">
                缓冲区大小
              </label>
              <input
                type="number"
                min="1024"
                max="16384"
                step="1024"
                value={editAudio.buffer_size}
                onChange={(e) => setEditAudio({ ...editAudio, buffer_size: parseInt(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-dark-400 bg-white dark:bg-dark-300 text-slate-900 dark:text-dark-900"
              />
              <div className="text-xs text-slate-600 dark:text-dark-700 mt-1">
                建议值: 4096 (更大的缓冲区可提高稳定性但增加延迟)
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-2">
                预加载时长（秒）
              </label>
              <input
                type="number"
                min="0"
                max="30"
                step="1"
                value={editAudio.preload_seconds}
                onChange={(e) => setEditAudio({ ...editAudio, preload_seconds: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-dark-400 bg-white dark:bg-dark-300 text-slate-900 dark:text-dark-900"
              />
              <div className="text-xs text-slate-600 dark:text-dark-700 mt-1">
                提前加载下一首歌曲，0表示禁用预加载
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-2">
                交叉淡化时长（毫秒）
              </label>
              <input
                type="number"
                min="0"
                max="5000"
                step="100"
                value={editAudio.crossfade_ms}
                onChange={(e) => setEditAudio({ ...editAudio, crossfade_ms: parseInt(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-dark-400 bg-white dark:bg-dark-300 text-slate-900 dark:text-dark-900"
              />
              <div className="text-xs text-slate-600 dark:text-dark-700 mt-1">
                歌曲之间的淡入淡出效果，0表示禁用
              </div>
            </div>

            <button
              onClick={handleSaveAudio}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              保存音频配置
            </button>
          </div>
        </CollapsiblePanel>
      </SettingSection>

      {/* UI配置 */}
      <SettingSection
        title="界面配置"
        description="自定义界面外观和行为"
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        }
      >
        <CollapsiblePanel title="界面偏好设置" description="语言、主题和窗口">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-2">
                语言
              </label>
              <select
                value={editUI.language}
                onChange={(e) => setEditUI({ ...editUI, language: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-dark-400 bg-white dark:bg-dark-300 text-slate-900 dark:text-dark-900"
              >
                <option value="zh-CN">简体中文</option>
                <option value="en-US">English</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-dark-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editUI.auto_save_playlist}
                  onChange={(e) => setEditUI({ ...editUI, auto_save_playlist: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                自动保存播放列表
              </label>
              <div className="text-xs text-slate-600 dark:text-dark-700 mt-1 ml-6">
                退出时自动保存当前播放列表
              </div>
            </div>

            <button
              onClick={handleSaveUI}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              保存界面配置
            </button>
          </div>
        </CollapsiblePanel>
      </SettingSection>

      {/* 重置配置 */}
      <SettingSection
        title="重置配置"
        description="恢复所有设置为默认值"
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        }
      >
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
            ⚠️ 此操作将重置所有配置为默认值，包括音频、界面等所有设置。
          </p>
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            重置所有配置
          </button>
        </div>
      </SettingSection>
    </div>
  );
}
