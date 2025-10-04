// 音质增强设置模块
//
// 提供音质增强配置和管理功能

use serde::{Deserialize, Serialize};

/// 音质增强设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioEnhancementSettings {
    /// 是否启用音质增强
    pub enabled: bool,
    
    /// 均衡器设置
    pub equalizer: EqualizerSettings,
    
    /// 音场设置
    pub soundstage: SoundstageSettings,
    
    /// 低音增强
    pub bass_boost: BassBoostSettings,
    
    /// 响度规格化
    pub loudness_normalization: bool,
    
    /// 采样率增强（上采样）
    pub upsampling: UpsamplingSettings,
}

impl Default for AudioEnhancementSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            equalizer: EqualizerSettings::default(),
            soundstage: SoundstageSettings::default(),
            bass_boost: BassBoostSettings::default(),
            loudness_normalization: false,
            upsampling: UpsamplingSettings::default(),
        }
    }
}

/// 均衡器设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EqualizerSettings {
    /// 是否启用均衡器
    pub enabled: bool,
    
    /// 预设名称（可选）
    pub preset: Option<String>,
    
    /// 各频段增益（dB）
    /// 顺序：32Hz, 64Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz
    pub gains: [f32; 10],
}

impl Default for EqualizerSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            preset: None,
            gains: [0.0; 10], // 默认无增益
        }
    }
}

/// 音场设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoundstageSettings {
    /// 是否启用音场增强
    pub enabled: bool,
    
    /// 空间感（0.0 - 1.0）
    pub spatialization: f32,
    
    /// 混响强度（0.0 - 1.0）
    pub reverb: f32,
}

impl Default for SoundstageSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            spatialization: 0.5,
            reverb: 0.3,
        }
    }
}

/// 低音增强设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BassBoostSettings {
    /// 是否启用低音增强
    pub enabled: bool,
    
    /// 增强强度（dB，0 - 12）
    pub gain: f32,
    
    /// 截止频率（Hz，20 - 250）
    pub cutoff_frequency: u32,
}

impl Default for BassBoostSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            gain: 3.0,
            cutoff_frequency: 80,
        }
    }
}

/// 上采样设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpsamplingSettings {
    /// 是否启用上采样
    pub enabled: bool,
    
    /// 目标采样率（Hz）
    pub target_sample_rate: u32,
    
    /// 插值质量（1-10，10最高）
    pub quality: u8,
}

impl Default for UpsamplingSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            target_sample_rate: 96000,
            quality: 7,
        }
    }
}

/// 均衡器预设
pub struct EqualizerPresets;

impl EqualizerPresets {
    /// 获取所有可用预设
    pub fn all() -> Vec<(&'static str, [f32; 10])> {
        vec![
            ("平坦", [0.0; 10]),
            ("流行", [1.0, 0.5, 0.0, -0.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5]),
            ("摇滚", [2.0, 1.5, 1.0, 0.5, 0.0, -0.5, 0.5, 1.5, 2.0, 2.5]),
            ("爵士", [1.5, 1.0, 0.5, 0.0, -0.5, -0.5, 0.0, 0.5, 1.0, 1.5]),
            ("古典", [1.0, 0.5, 0.0, -0.5, -1.0, -1.0, -0.5, 0.5, 1.0, 1.5]),
            ("低音增强", [3.0, 2.5, 2.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
            ("高音增强", [0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 2.0, 2.5, 3.0, 3.5]),
            ("人声", [0.5, 0.0, -0.5, -1.0, -0.5, 1.0, 2.0, 2.5, 1.5, 0.5]),
        ]
    }
    
    /// 根据名称获取预设
    pub fn get(name: &str) -> Option<[f32; 10]> {
        Self::all().into_iter()
            .find(|(n, _)| *n == name)
            .map(|(_, gains)| gains)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_settings() {
        let settings = AudioEnhancementSettings::default();
        assert!(!settings.enabled);
        assert!(!settings.equalizer.enabled);
        assert!(!settings.soundstage.enabled);
        assert!(!settings.bass_boost.enabled);
        assert!(!settings.loudness_normalization);
        assert!(!settings.upsampling.enabled);
    }

    #[test]
    fn test_equalizer_presets() {
        let presets = EqualizerPresets::all();
        assert!(presets.len() >= 8);
        
        let flat = EqualizerPresets::get("平坦");
        assert!(flat.is_some());
        assert_eq!(flat.unwrap(), [0.0; 10]);
    }

    #[test]
    fn test_serialization() {
        let settings = AudioEnhancementSettings::default();
        let json = serde_json::to_string(&settings).unwrap();
        let deserialized: AudioEnhancementSettings = serde_json::from_str(&json).unwrap();
        
        assert_eq!(settings.enabled, deserialized.enabled);
    }
}

