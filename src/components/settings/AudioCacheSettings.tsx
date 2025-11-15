// 音频缓存设置组件

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface CacheConfig {
  enabled: boolean;
  cache_path: string;
  max_size_mb: number;
  auto_cache_favorites: boolean;
  wifi_only_cache: boolean;
  cache_quality: 'Source' | 'High' | 'Medium';
  min_play_count: number;
  cache_recent_days: number;
  cleanup_policy: {
    auto_cleanup_days: number;
    cleanup_on_low_storage: boolean;
    low_storage_threshold: number;
  };
  preload_next: boolean;
}

interface CacheStats {
  file_count: number;
  total_size_mb: number;
  usage_percent: number;
  hit_rate: number;
  saved_bandwidth_mb: number;
  high_priority_count: number;
  medium_priority_count: number;
  low_priority_count: number;
}

export default function AudioCacheSettings() {
  const [config, setConfig] = useState<CacheConfig | null>(null);
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 加载配置和统计
  useEffect(() => {
    loadConfig();
    loadStats();
  }, []);

  const loadConfig = async () => {
    try {
      const configJson = await invoke<string>('cache_get_config');
      const parsed = JSON.parse(configJson);
      setConfig(parsed);
    } catch (error) {
      console.error('加载缓存配置失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await invoke<CacheStats>('cache_get_stats');
      setStats(statsData);
    } catch (error) {
      console.error('加载缓存统计失败:', error);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    setIsSaving(true);
    try {
      const configJson = JSON.stringify(config);
      await invoke('cache_update_config', { configJson });
      alert('✅ 缓存配置已保存！');
      loadStats(); // 刷新统计
    } catch (error) {
      console.error('保存缓存配置失败:', error);
      alert(`❌ 保存失败: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('确定要清空所有缓存吗？\n\n这将删除所有已缓存的音频文件，下次播放时需要重新下载。')) {
      return;
    }

    try {
      await invoke('cache_clear_all');
      alert('✅ 缓存已清空');
      loadStats();
    } catch (error) {
      console.error('清空缓存失败:', error);
      alert(`❌ 清空失败: ${error}`);
    }
  };

  const handleAutoCleanup = async () => {
    try {
      const count = await invoke<number>('cache_auto_cleanup');
      alert(`✅ 清理完成\n\n删除了 ${count} 个过期缓存文件`);
      loadStats();
    } catch (error) {
      console.error('自动清理失败:', error);
      alert(`❌ 清理失败: ${error}`);
    }
  };

  const handleSelectPath = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择缓存目录',
      });

      if (selected && typeof selected === 'string' && config) {
        setConfig({ ...config, cache_path: selected });
      }
    } catch (error) {
      console.error('选择目录失败:', error);
    }
  };

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-dark-700">加载缓存设置...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 统计信息卡片 */}
      {stats && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-dark-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            缓存统计
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-dark-200 rounded-lg p-4">
              <div className="text-xs text-slate-600 dark:text-dark-700 mb-1">缓存文件</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-dark-900">{stats.file_count}</div>
            </div>
            
            <div className="bg-white dark:bg-dark-200 rounded-lg p-4">
              <div className="text-xs text-slate-600 dark:text-dark-700 mb-1">已用空间</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-dark-900">
                {stats.total_size_mb.toFixed(1)} MB
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {stats.usage_percent.toFixed(1)}% / {config.max_size_mb} MB
              </div>
            </div>
            
            <div className="bg-white dark:bg-dark-200 rounded-lg p-4">
              <div className="text-xs text-slate-600 dark:text-dark-700 mb-1">命中率</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.hit_rate.toFixed(0)}%
              </div>
            </div>
            
            <div className="bg-white dark:bg-dark-200 rounded-lg p-4">
              <div className="text-xs text-slate-600 dark:text-dark-700 mb-1">节省流量</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.saved_bandwidth_mb.toFixed(0)} MB
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 基础设置 */}
      <div className="bg-white dark:bg-dark-200 rounded-xl p-6 border border-slate-200 dark:border-dark-400">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-dark-900 mb-4">基础设置</h3>
        
        <div className="space-y-4">
          {/* 启用缓存 */}
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-dark-800">启用智能缓存</span>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="w-5 h-5"
            />
          </label>

          {/* 缓存路径 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-2">
              缓存路径
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={config.cache_path}
                readOnly
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-dark-300 border border-slate-200 dark:border-dark-500 rounded-lg text-sm"
              />
              <button
                onClick={handleSelectPath}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              >
                选择目录
              </button>
            </div>
          </div>

          {/* 最大缓存大小 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-2">
              最大缓存大小 (MB)
            </label>
            <input
              type="number"
              min="100"
              max="100000"
              step="100"
              value={config.max_size_mb}
              onChange={(e) => setConfig({ ...config, max_size_mb: parseInt(e.target.value) || 2048 })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-dark-500 rounded-lg text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">
              推荐：2048 MB (2GB) ~ 10240 MB (10GB)
            </p>
          </div>
        </div>
      </div>

      {/* 智能缓存策略 */}
      <div className="bg-white dark:bg-dark-200 rounded-xl p-6 border border-slate-200 dark:border-dark-400">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-dark-900 mb-4">智能缓存策略</h3>
        
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-dark-800">自动缓存收藏歌曲</span>
            <input
              type="checkbox"
              checked={config.auto_cache_favorites}
              onChange={(e) => setConfig({ ...config, auto_cache_favorites: e.target.checked })}
              className="w-5 h-5"
            />
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-dark-800">仅WiFi下缓存</span>
            <input
              type="checkbox"
              checked={config.wifi_only_cache}
              onChange={(e) => setConfig({ ...config, wifi_only_cache: e.target.checked })}
              className="w-5 h-5"
            />
          </label>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-2">
              播放几次后缓存
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={config.min_play_count}
              onChange={(e) => setConfig({ ...config, min_play_count: parseInt(e.target.value) || 2 })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-dark-500 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-2">
              缓存最近N天播放的歌曲
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={config.cache_recent_days}
              onChange={(e) => setConfig({ ...config, cache_recent_days: parseInt(e.target.value) || 7 })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-dark-500 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      {/* 缓存管理 */}
      <div className="bg-white dark:bg-dark-200 rounded-xl p-6 border border-slate-200 dark:border-dark-400">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-dark-900 mb-4">缓存管理</h3>
        
        <div className="flex gap-3">
          <button
            onClick={handleAutoCleanup}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm transition-colors"
          >
            🧹 自动清理过期缓存
          </button>
          
          <button
            onClick={handleClearAll}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
          >
            🗑️ 清空所有缓存
          </button>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => loadConfig()}
          className="px-6 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-dark-400 dark:hover:bg-dark-500 text-slate-700 dark:text-dark-800 rounded-lg transition-colors"
        >
          重置
        </button>
        
        <button
          onClick={saveConfig}
          disabled={isSaving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          {isSaving && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          )}
          {isSaving ? '保存中...' : '保存设置'}
        </button>
      </div>
    </div>
  );
}






