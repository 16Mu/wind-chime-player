import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

// 🎵 音质增强数据类型定义
interface AudioEnhancementSettings {
  enabled: boolean;
  equalizer: EqualizerSettings;
  spatial_audio: SpatialAudioSettings;
  dynamic_range: DynamicRangeSettings;
  output_quality: OutputQualitySettings;
}

interface EqualizerSettings {
  enabled: boolean;
  preset: string;
  bands: number[]; // 10-band EQ
}

interface SpatialAudioSettings {
  enabled: boolean;
  room_size: number;
  reverb_amount: number;
  stereo_width: number;
}

interface DynamicRangeSettings {
  compressor_enabled: boolean;
  threshold_db: number;
  ratio: number;
  volume_normalization: boolean;
  target_lufs: number;
}

interface OutputQualitySettings {
  sample_rate: number;
  bit_depth: number;
  dithering: boolean;
  upsampling_quality: string;
}

const AudioEnhancementPanel: React.FC = () => {
  const [settings, setSettings] = useState<AudioEnhancementSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [activeSlider, setActiveSlider] = useState<number | null>(null);
  const [animatingToggle, setAnimatingToggle] = useState(false);
  const [animatingPreset, setAnimatingPreset] = useState(false);

  // EQ预设
  const EQ_PRESETS = {
    flat: { name: '平坦', bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    bass_boost: { name: '低音增强', bands: [6, 4, 2, 0, -1, 0, 1, 2, 3, 4] },
    vocal_enhance: { name: '人声增强', bands: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1] },
    rock: { name: '摇滚', bands: [4, 3, 2, 0, -1, 1, 2, 3, 4, 4] },
    classical: { name: '古典', bands: [2, 1, 0, 0, -1, -1, 0, 1, 2, 3] },
    jazz: { name: '爵士', bands: [2, 1, 0, 1, 2, 1, 0, 1, 2, 2] },
    electronic: { name: '电子', bands: [3, 2, 1, 0, -1, 1, 2, 3, 4, 3] }
  };

  // EQ频段标签
  const EQ_BANDS = ['32Hz', '64Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'];

  // 🔄 加载设置
  const loadSettings = async () => {
    if (typeof invoke === 'undefined') {
      console.warn('Tauri API 不可用，使用默认设置');
      setSettings({
        enabled: false,
        equalizer: {
          enabled: false,
          preset: 'flat',
          bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        spatial_audio: {
          enabled: false,
          room_size: 0.5,
          reverb_amount: 0.2,
          stereo_width: 1.0
        },
        dynamic_range: {
          compressor_enabled: false,
          threshold_db: -12.0,
          ratio: 4.0,
          volume_normalization: false,
          target_lufs: -16.0
        },
        output_quality: {
          sample_rate: 44100,
          bit_depth: 16,
          dithering: false,
          upsampling_quality: 'linear'
        }
      });
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await invoke('get_audio_enhancement_settings') as AudioEnhancementSettings;
      setSettings(data);
      setIsDirty(false);
    } catch (error) {
      console.error('获取音质增强设置失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 💾 保存设置
  const saveSettings = async () => {
    if (!settings || typeof invoke === 'undefined') {
      console.log('设置已保存到localStorage（模拟）');
      setIsDirty(false);
      return;
    }

    try {
      await invoke('set_audio_enhancement_settings', { settings });
      setIsDirty(false);
      console.log('音质增强设置已保存');
    } catch (error) {
      console.error('保存音质增强设置失败:', error);
    }
  };

  // 🎛️ 更新设置的辅助函数
  const updateSettings = (updates: Partial<AudioEnhancementSettings>) => {
    setSettings(prev => prev ? { ...prev, ...updates } : null);
    setIsDirty(true);
  };

  const updateEqualizer = (updates: Partial<EqualizerSettings>) => {
    if (!settings) return;
    updateSettings({
      equalizer: { ...settings.equalizer, ...updates }
    });
  };

  const updateSpatialAudio = (updates: Partial<SpatialAudioSettings>) => {
    if (!settings) return;
    updateSettings({
      spatial_audio: { ...settings.spatial_audio, ...updates }
    });
  };

  const updateDynamicRange = (updates: Partial<DynamicRangeSettings>) => {
    if (!settings) return;
    updateSettings({
      dynamic_range: { ...settings.dynamic_range, ...updates }
    });
  };

  const updateOutputQuality = (updates: Partial<OutputQualitySettings>) => {
    if (!settings) return;
    updateSettings({
      output_quality: { ...settings.output_quality, ...updates }
    });
  };

  // 初始化
  useEffect(() => {
    loadSettings();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-3 text-slate-600 dark:text-dark-700">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>加载音质增强设置中...</span>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-8 text-slate-600 dark:text-dark-700">
        <p>无法加载音质增强设置</p>
        <button 
          onClick={loadSettings}
          className="mt-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 主开关和保存按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className={`flex items-center gap-2 ${animatingToggle ? 'toggle-switch-animate' : ''}`}>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => {
                updateSettings({ enabled: e.target.checked });
                setAnimatingToggle(true);
                setTimeout(() => setAnimatingToggle(false), 400);
              }}
              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 transition-transform duration-200"
            />
            <span className="font-semibold text-slate-900 dark:text-dark-900">
              启用音质增强
            </span>
          </label>
          {settings.enabled && (
            <div className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
              已启用
            </div>
          )}
        </div>
        
        {isDirty && (
          <button
            onClick={saveSettings}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            保存设置
          </button>
        )}
      </div>

      <div className={`space-y-6 ${!settings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>

        {/* 🎚️ 均衡器 */}
        <div className="glass-surface rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h5 className="font-semibold text-slate-900 dark:text-dark-900">均衡器</h5>
            </div>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.equalizer.enabled}
                onChange={(e) => updateEqualizer({ enabled: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-600 dark:text-dark-700">启用</span>
            </label>
          </div>

          {settings.equalizer.enabled && (
            <>
              {/* EQ预设选择 */}
              <div className="mb-4">
                <label className="block text-sm text-slate-600 dark:text-dark-700 mb-2">预设</label>
                <select
                  value={settings.equalizer.preset}
                  onChange={(e) => {
                    const preset = e.target.value;
                    updateEqualizer({
                      preset,
                      bands: EQ_PRESETS[preset as keyof typeof EQ_PRESETS]?.bands || settings.equalizer.bands
                    });
                    setAnimatingPreset(true);
                    setTimeout(() => setAnimatingPreset(false), 300);
                  }}
                  className={`w-full px-3 py-2 border border-slate-300 dark:border-dark-500 rounded-lg bg-white dark:bg-dark-100 text-slate-900 dark:text-dark-900 focus:ring-2 focus:ring-blue-500 transition-all ${animatingPreset ? 'preset-select-animate' : ''}`}
                >
                  {Object.entries(EQ_PRESETS).map(([key, { name }]) => (
                    <option key={key} value={key}>{name}</option>
                  ))}
                </select>
              </div>

              {/* EQ频段控制 */}
              <div className="space-y-2">
                <label className="block text-sm text-slate-600 dark:text-dark-700">频段增益 (dB)</label>
                <div className="grid grid-cols-5 gap-2">
                  {EQ_BANDS.map((band, index) => (
                    <div 
                      key={band} 
                      className={`text-center p-2 rounded-lg transition-all duration-200 ${activeSlider === index ? 'eq-slider-active bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                    >
                      <div className="mb-1">
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          step="0.5"
                          value={settings.equalizer.bands[index] || 0}
                          onChange={(e) => {
                            const newBands = [...settings.equalizer.bands];
                            newBands[index] = parseFloat(e.target.value);
                            updateEqualizer({ bands: newBands, preset: 'custom' });
                          }}
                          onMouseDown={() => setActiveSlider(index)}
                          onMouseUp={() => setActiveSlider(null)}
                          onTouchStart={() => setActiveSlider(index)}
                          onTouchEnd={() => setActiveSlider(null)}
                          className="w-full h-16 slider vertical transition-all duration-200"
                          style={{
                            writingMode: 'vertical-lr' as any,
                            WebkitAppearance: 'slider-vertical',
                          } as React.CSSProperties}
                        />
                      </div>
                      <div className="text-xs text-slate-500 dark:text-dark-600 mb-1">{band}</div>
                      <div className="text-xs font-mono text-slate-700 dark:text-dark-800">
                        {(settings.equalizer.bands[index] || 0) >= 0 ? '+' : ''}{(settings.equalizer.bands[index] || 0).toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 🌌 空间音频 */}
        <div className="glass-surface rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h5 className="font-semibold text-slate-900 dark:text-dark-900">空间音频</h5>
            </div>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.spatial_audio.enabled}
                onChange={(e) => updateSpatialAudio({ enabled: e.target.checked })}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-600 dark:text-dark-700">启用</span>
            </label>
          </div>

          {settings.spatial_audio.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-dark-700 mb-2">房间大小</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.spatial_audio.room_size}
                  onChange={(e) => updateSpatialAudio({ room_size: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="text-xs text-center mt-1 font-mono text-slate-500">
                  {(settings.spatial_audio.room_size * 100).toFixed(0)}%
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-600 dark:text-dark-700 mb-2">混响量</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.spatial_audio.reverb_amount}
                  onChange={(e) => updateSpatialAudio({ reverb_amount: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="text-xs text-center mt-1 font-mono text-slate-500">
                  {(settings.spatial_audio.reverb_amount * 100).toFixed(0)}%
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-600 dark:text-dark-700 mb-2">立体声宽度</label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={settings.spatial_audio.stereo_width}
                  onChange={(e) => updateSpatialAudio({ stereo_width: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="text-xs text-center mt-1 font-mono text-slate-500">
                  {settings.spatial_audio.stereo_width.toFixed(1)}x
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 🔊 动态范围 */}
        <div className="glass-surface rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 11.293l1.414 1.414a5 5 0 010 7.071l-1.414-1.414a3 3 0 000-4.243zm-7.071 0a3 3 0 000 4.243l-1.414 1.414a5 5 0 010-7.071l1.414 1.414zm2.828-2.829l2.829 2.829-2.829 2.828-2.828-2.828 2.828-2.829z" />
              </svg>
            </div>
            <h5 className="font-semibold text-slate-900 dark:text-dark-900">动态范围控制</h5>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.dynamic_range.compressor_enabled}
                  onChange={(e) => updateDynamicRange({ compressor_enabled: e.target.checked })}
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm text-slate-600 dark:text-dark-700">压缩器</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.dynamic_range.volume_normalization}
                  onChange={(e) => updateDynamicRange({ volume_normalization: e.target.checked })}
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm text-slate-600 dark:text-dark-700">音量标准化</span>
              </label>
            </div>

            {settings.dynamic_range.compressor_enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm text-slate-600 dark:text-dark-700 mb-2">阈值 (dB)</label>
                  <input
                    type="range"
                    min="-30"
                    max="0"
                    step="1"
                    value={settings.dynamic_range.threshold_db}
                    onChange={(e) => updateDynamicRange({ threshold_db: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <div className="text-xs text-center mt-1 font-mono text-slate-500">
                    {settings.dynamic_range.threshold_db}dB
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-600 dark:text-dark-700 mb-2">压缩比</label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={settings.dynamic_range.ratio}
                    onChange={(e) => updateDynamicRange({ ratio: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <div className="text-xs text-center mt-1 font-mono text-slate-500">
                    {settings.dynamic_range.ratio.toFixed(1)}:1
                  </div>
                </div>
              </div>
            )}

            {settings.dynamic_range.volume_normalization && (
              <div>
                <label className="block text-sm text-slate-600 dark:text-dark-700 mb-2">目标响度 (LUFS)</label>
                <input
                  type="range"
                  min="-30"
                  max="-6"
                  step="1"
                  value={settings.dynamic_range.target_lufs}
                  onChange={(e) => updateDynamicRange({ target_lufs: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="text-xs text-center mt-1 font-mono text-slate-500">
                  {settings.dynamic_range.target_lufs}LUFS ({settings.dynamic_range.target_lufs === -23 ? '广播标准' : settings.dynamic_range.target_lufs === -16 ? '音乐标准' : '自定义'})
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 🎧 输出质量 */}
        <div className="glass-surface rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h5 className="font-semibold text-slate-900 dark:text-dark-900">输出质量</h5>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-dark-700 mb-2">采样率</label>
              <select
                value={settings.output_quality.sample_rate}
                onChange={(e) => updateOutputQuality({ sample_rate: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-dark-500 rounded-lg bg-white dark:bg-dark-100 text-slate-900 dark:text-dark-900"
              >
                <option value={44100}>44.1 kHz (CD质量)</option>
                <option value={48000}>48 kHz (DVD质量)</option>
                <option value={96000}>96 kHz (Hi-Res)</option>
                <option value={192000}>192 kHz (超高解析度)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-600 dark:text-dark-700 mb-2">位深度</label>
              <select
                value={settings.output_quality.bit_depth}
                onChange={(e) => updateOutputQuality({ bit_depth: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-dark-500 rounded-lg bg-white dark:bg-dark-100 text-slate-900 dark:text-dark-900"
              >
                <option value={16}>16-bit (CD质量)</option>
                <option value={24}>24-bit (专业级)</option>
                <option value={32}>32-bit (工作室级)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-600 dark:text-dark-700 mb-2">上采样质量</label>
              <select
                value={settings.output_quality.upsampling_quality}
                onChange={(e) => updateOutputQuality({ upsampling_quality: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-dark-500 rounded-lg bg-white dark:bg-dark-100 text-slate-900 dark:text-dark-900"
              >
                <option value="linear">线性 (快速)</option>
                <option value="cubic">三次样条 (平衡)</option>
                <option value="lanczos">Lanczos (高质量)</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.output_quality.dithering}
                  onChange={(e) => updateOutputQuality({ dithering: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-600 dark:text-dark-700">抖动处理</span>
              </label>
            </div>
          </div>
        </div>

      </div>

      {/* 提示信息 */}
      {!settings.enabled && (
        <div className="text-center py-4 text-slate-500 dark:text-dark-600 text-sm">
          启用音质增强以访问高级音频设置
        </div>
      )}
    </div>
  );
};

export default AudioEnhancementPanel;
