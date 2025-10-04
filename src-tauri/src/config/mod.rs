// 配置管理模块 - 高内聚：专注于配置数据的读写和管理
// 低耦合：通过清晰的接口与其他模块交互

pub mod webdav_config;

pub use webdav_config::*;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// 🔧 应用程序全局配置 - 单一职责：管理所有配置项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// 应用版本
    pub version: String,
    
    /// 数据库路径
    pub database_path: PathBuf,
    
    /// 缓存目录
    pub cache_directory: PathBuf,
    
    /// 临时目录
    pub temp_directory: PathBuf,
    
    /// 日志配置
    pub logging: LoggingConfig,
    
    /// WebDAV服务器配置
    pub webdav_servers: HashMap<String, WebDAVServerConfig>,
    
    /// 音频播放配置
    pub audio: AudioConfig,
    
    /// UI配置
    pub ui: UIConfig,
}

/// 🔧 日志配置 - 单一职责：管理日志行为
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    /// 日志级别
    pub level: String,
    
    /// 日志文件路径
    pub file_path: Option<PathBuf>,
    
    /// 是否输出到控制台
    pub console: bool,
    
    /// 日志文件最大大小 (MB)
    pub max_file_size_mb: u64,
    
    /// 保留的日志文件数量
    pub max_files: u32,
}

/// 🔧 音频播放配置 - 单一职责：管理音频相关设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioConfig {
    /// 默认音量 (0.0 - 1.0)
    pub default_volume: f32,
    
    /// 缓冲区大小
    pub buffer_size: usize,
    
    /// 音频输出设备
    pub output_device: Option<String>,
    
    /// 交叉淡化时间 (毫秒)
    pub crossfade_ms: u64,
    
    /// 预加载时间 (秒)
    pub preload_seconds: f64,
}

/// 🔧 UI配置 - 单一职责：管理界面相关设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UIConfig {
    /// 主题
    pub theme: String,
    
    /// 语言
    pub language: String,
    
    /// 窗口大小
    pub window_size: (u32, u32),
    
    /// 窗口位置
    pub window_position: Option<(i32, i32)>,
    
    /// 是否最大化
    pub maximized: bool,
    
    /// 自动保存播放列表
    pub auto_save_playlist: bool,
}

/// 🔧 配置管理器 - 单一职责：配置的持久化和内存管理
pub struct ConfigManager {
    config: AppConfig,
    config_path: PathBuf,
}

impl Default for AppConfig {
    fn default() -> Self {
        let home_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let app_dir = home_dir.join(".windchime");
        
        Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            database_path: app_dir.join("database.sqlite"),
            cache_directory: app_dir.join("cache"),
            temp_directory: app_dir.join("temp"),
            
            logging: LoggingConfig {
                level: "info".to_string(),
                file_path: Some(app_dir.join("logs").join("app.log")),
                console: true,
                max_file_size_mb: 10,
                max_files: 5,
            },
            
            webdav_servers: HashMap::new(),
            
            audio: AudioConfig {
                default_volume: 0.8,
                buffer_size: 4096,
                output_device: None,
                crossfade_ms: 3000,
                preload_seconds: 5.0,
            },
            
            ui: UIConfig {
                theme: "dark".to_string(),
                language: "zh-CN".to_string(),
                window_size: (1200, 800),
                window_position: None,
                maximized: false,
                auto_save_playlist: true,
            },
        }
    }
}

impl ConfigManager {
    /// 创建新的配置管理器
    pub fn new(config_path: Option<PathBuf>) -> Result<Self> {
        let config_path = config_path.unwrap_or_else(|| {
            dirs::config_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("windchime")
                .join("config.json")
        });
        
        let config = if config_path.exists() {
            Self::load_from_file(&config_path)?
        } else {
            let config = AppConfig::default();
            Self::save_to_file(&config, &config_path)?;
            config
        };
        
        Ok(Self { config, config_path })
    }
    
    /// 从文件加载配置
    fn load_from_file(path: &PathBuf) -> Result<AppConfig> {
        let content = std::fs::read_to_string(path)?;
        let config: AppConfig = serde_json::from_str(&content)?;
        log::info!("配置已从 {:?} 加载", path);
        Ok(config)
    }
    
    /// 保存配置到文件
    fn save_to_file(config: &AppConfig, path: &PathBuf) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        
        let content = serde_json::to_string_pretty(config)?;
        std::fs::write(path, content)?;
        log::info!("配置已保存到 {:?}", path);
        Ok(())
    }
    
    /// 获取当前配置
    pub fn get_config(&self) -> &AppConfig {
        &self.config
    }
    
    /// 获取可变配置
    pub fn get_config_mut(&mut self) -> &mut AppConfig {
        &mut self.config
    }
    
    /// 保存配置
    pub fn save(&self) -> Result<()> {
        Self::save_to_file(&self.config, &self.config_path)
    }
    
    /// 重新加载配置
    pub fn reload(&mut self) -> Result<()> {
        self.config = Self::load_from_file(&self.config_path)?;
        Ok(())
    }
    
    /// 添加WebDAV服务器配置
    pub fn add_webdav_server(&mut self, id: String, config: WebDAVServerConfig) -> Result<()> {
        self.config.webdav_servers.insert(id, config);
        self.save()?;
        log::info!("WebDAV服务器配置已添加");
        Ok(())
    }
    
    /// 移除WebDAV服务器配置
    pub fn remove_webdav_server(&mut self, id: &str) -> Result<bool> {
        let removed = self.config.webdav_servers.remove(id).is_some();
        if removed {
            self.save()?;
            log::info!("WebDAV服务器配置已移除: {}", id);
        }
        Ok(removed)
    }
    
    /// 更新WebDAV服务器配置
    pub fn update_webdav_server(&mut self, id: &str, config: WebDAVServerConfig) -> Result<bool> {
        if self.config.webdav_servers.contains_key(id) {
            self.config.webdav_servers.insert(id.to_string(), config);
            self.save()?;
            log::info!("WebDAV服务器配置已更新: {}", id);
            Ok(true)
        } else {
            Ok(false)
        }
    }
    
    /// 获取WebDAV服务器配置
    pub fn get_webdav_server(&self, id: &str) -> Option<&WebDAVServerConfig> {
        self.config.webdav_servers.get(id)
    }
    
    /// 列出所有WebDAV服务器配置
    pub fn list_webdav_servers(&self) -> Vec<(String, &WebDAVServerConfig)> {
        self.config.webdav_servers.iter()
            .map(|(id, config)| (id.clone(), config))
            .collect()
    }
    
    /// 获取启用的WebDAV服务器
    pub fn get_enabled_webdav_servers(&self) -> Vec<(String, &WebDAVServerConfig)> {
        self.config.webdav_servers.iter()
            .filter(|(_, config)| config.enabled)
            .map(|(id, config)| (id.clone(), config))
            .collect()
    }
}
