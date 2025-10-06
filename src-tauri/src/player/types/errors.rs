// 播放器错误定义

use thiserror::Error;

/// 播放器错误
#[derive(Debug, Error)]
#[allow(dead_code)]
pub enum PlayerError {
    /// 音频设备错误
    #[error("音频设备错误: {0}")]
    AudioDeviceError(String),
    
    /// 音频设备暂时不可用（可恢复）
    #[error("音频设备暂时不可用: {0}")]
    DeviceTemporaryUnavailable(String),
    
    /// 音频设备丢失
    #[error("音频设备连接丢失")]
    DeviceLost,
    
    /// 解码错误
    #[error("音频解码失败: {0}")]
    DecodeFailed(String),
    
    /// 文件不存在
    #[error("文件不存在: {0}")]
    FileNotFound(String),
    
    /// 文件读取错误
    #[error("文件读取失败: {0}")]
    FileReadError(String),
    
    /// 播放列表为空
    #[error("播放列表为空")]
    EmptyPlaylist,
    
    /// 曲目未找到
    #[error("曲目未找到: id={0}")]
    TrackNotFound(i64),
    
    /// 跳转失败
    #[error("跳转失败: {0}")]
    SeekFailed(String),
    
    /// 初始化失败
    #[error("播放器初始化失败: {0}")]
    InitializationFailed(String),
    
    /// 超时错误
    #[error("操作超时: {0}")]
    Timeout(String),
    
    /// Actor通信错误
    #[error("Actor通信失败: {0}")]
    ActorCommunication(String),
    
    /// 内部错误
    #[error("播放器内部错误: {0}")]
    Internal(String),
}

impl PlayerError {
    /// 创建设备错误
    pub fn device_error(msg: impl Into<String>) -> Self {
        PlayerError::AudioDeviceError(msg.into())
    }
    
    /// 创建设备超时错误
    pub fn device_timeout(msg: impl Into<String>) -> Self {
        PlayerError::Timeout(msg.into())
    }
    
    /// 创建解码错误
    pub fn decode_error(msg: impl Into<String>) -> Self {
        PlayerError::DecodeFailed(msg.into())
    }
    
    /// 创建资源耗尽错误
    pub fn resource_exhausted(msg: impl Into<String>) -> Self {
        PlayerError::Internal(format!("资源耗尽: {}", msg.into()))
    }
    
}

/// 将anyhow::Error转换为PlayerError
impl From<anyhow::Error> for PlayerError {
    fn from(err: anyhow::Error) -> Self {
        PlayerError::Internal(err.to_string())
    }
}

/// 将std::io::Error转换为PlayerError
impl From<std::io::Error> for PlayerError {
    fn from(err: std::io::Error) -> Self {
        match err.kind() {
            std::io::ErrorKind::NotFound => {
                PlayerError::FileNotFound(err.to_string())
            }
            std::io::ErrorKind::PermissionDenied => {
                PlayerError::FileReadError(format!("权限不足: {}", err))
            }
            std::io::ErrorKind::TimedOut => {
                PlayerError::Timeout(err.to_string())
            }
            _ => PlayerError::FileReadError(err.to_string()),
        }
    }
}


