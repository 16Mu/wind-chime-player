/**
 * 配置管理Context
 * 
 * 提供应用级配置的读写接口
 */

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

// ==================== 类型定义 ====================

export interface AudioConfig {
  default_volume: number;
  buffer_size: number;
  output_device: string | null;
  crossfade_ms: number;
  preload_seconds: number;
}

export interface UIConfig {
  theme: string;
  language: string;
  window_size: [number, number];
  window_position: [number, number] | null;
  maximized: boolean;
  auto_save_playlist: boolean;
}

export interface AppConfig {
  version: string;
  database_path: string;
  cache_directory: string;
  temp_directory: string;
  audio: AudioConfig;
  ui: UIConfig;
}

// ==================== Context接口 ====================

interface ConfigContextValue {
  // 配置状态
  audioConfig: AudioConfig | null;
  uiConfig: UIConfig | null;
  isLoading: boolean;
  
  // 配置管理
  refreshAudioConfig: () => Promise<void>;
  updateAudioConfig: (config: AudioConfig) => Promise<void>;
  refreshUIConfig: () => Promise<void>;
  updateUIConfig: (config: UIConfig) => Promise<void>;
  resetConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

// ==================== Provider组件 ====================

interface ConfigProviderProps {
  children: ReactNode;
}

export function ConfigProvider({ children }: ConfigProviderProps) {
  const [audioConfig, setAudioConfig] = useState<AudioConfig | null>(null);
  const [uiConfig, setUIConfig] = useState<UIConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // ========== 音频配置 ==========

  const refreshAudioConfig = useCallback(async () => {
    if (typeof invoke === 'undefined') {
      console.warn('Tauri API不可用');
      return;
    }

    try {
      const config = await invoke<AudioConfig>('config_get_audio');
      setAudioConfig(config);
    } catch (error) {
      console.error('获取音频配置失败:', error);
    }
  }, []);

  const updateAudioConfig = useCallback(async (config: AudioConfig) => {
    if (typeof invoke === 'undefined') {
      throw new Error('Tauri API不可用');
    }

    try {
      setIsLoading(true);
      await invoke('config_update_audio', { config });
      await refreshAudioConfig();
      console.log('✅ 音频配置已更新');
    } catch (error) {
      console.error('更新音频配置失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [refreshAudioConfig]);

  // ========== UI配置 ==========

  const refreshUIConfig = useCallback(async () => {
    if (typeof invoke === 'undefined') {
      console.warn('Tauri API不可用');
      return;
    }

    try {
      const config = await invoke<UIConfig>('config_get_ui');
      setUIConfig(config);
    } catch (error) {
      console.error('获取UI配置失败:', error);
    }
  }, []);

  const updateUIConfig = useCallback(async (config: UIConfig) => {
    if (typeof invoke === 'undefined') {
      throw new Error('Tauri API不可用');
    }

    try {
      setIsLoading(true);
      await invoke('config_update_ui', { config });
      await refreshUIConfig();
      console.log('✅ UI配置已更新');
    } catch (error) {
      console.error('更新UI配置失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [refreshUIConfig]);

  // ========== 重置配置 ==========

  const resetConfig = useCallback(async () => {
    if (typeof invoke === 'undefined') {
      throw new Error('Tauri API不可用');
    }

    try {
      setIsLoading(true);
      await invoke('config_reset');
      await Promise.all([refreshAudioConfig(), refreshUIConfig()]);
      console.log('✅ 配置已重置为默认值');
    } catch (error) {
      console.error('重置配置失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [refreshAudioConfig, refreshUIConfig]);

  // ========== 初始化 ==========

  useEffect(() => {
    refreshAudioConfig();
    refreshUIConfig();
  }, [refreshAudioConfig, refreshUIConfig]);

  // ========== Context值 ==========

  const value: ConfigContextValue = {
    audioConfig,
    uiConfig,
    isLoading,
    refreshAudioConfig,
    updateAudioConfig,
    refreshUIConfig,
    updateUIConfig,
    resetConfig,
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

// ==================== Hook ====================

export function useConfig(): ConfigContextValue {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig必须在ConfigProvider内使用');
  }
  return context;
}
