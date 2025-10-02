// 播放器命令定义

use super::{track::Track, state::RepeatMode};

/// 播放器命令
#[derive(Debug)]
pub enum PlayerCommand {
    /// 播放指定曲目（by track_id）
    Play(i64),
    
    /// 暂停播放
    Pause,
    
    /// 恢复播放
    Resume,
    
    /// 停止播放
    Stop,
    
    /// 跳转到指定位置（毫秒）
    Seek(u64),
    
    /// 下一曲
    Next,
    
    /// 上一曲
    Previous,
    
    /// 设置音量（0.0 - 1.0）
    SetVolume(f32),
    
    /// 设置重复模式
    SetRepeatMode(RepeatMode),
    
    /// 设置随机播放
    SetShuffle(bool),
    
    /// 加载播放列表
    LoadPlaylist(Vec<Track>),
    
    /// 重置音频设备
    ResetAudioDevice,
    
    /// 关闭播放器
    Shutdown,
}

impl PlayerCommand {
    /// 获取命令名称（用于日志）
    pub fn name(&self) -> &str {
        match self {
            PlayerCommand::Play(_) => "Play",
            PlayerCommand::Pause => "Pause",
            PlayerCommand::Resume => "Resume",
            PlayerCommand::Stop => "Stop",
            PlayerCommand::Seek(_) => "Seek",
            PlayerCommand::Next => "Next",
            PlayerCommand::Previous => "Previous",
            PlayerCommand::SetVolume(_) => "SetVolume",
            PlayerCommand::SetRepeatMode(_) => "SetRepeatMode",
            PlayerCommand::SetShuffle(_) => "SetShuffle",
            PlayerCommand::LoadPlaylist(_) => "LoadPlaylist",
            PlayerCommand::ResetAudioDevice => "ResetAudioDevice",
            PlayerCommand::Shutdown => "Shutdown",
        }
    }
    
    /// 判断是否为播放控制命令
    pub fn is_playback_control(&self) -> bool {
        matches!(
            self,
            PlayerCommand::Play(_)
                | PlayerCommand::Pause
                | PlayerCommand::Resume
                | PlayerCommand::Stop
                | PlayerCommand::Seek(_)
        )
    }
    
    /// 判断是否为播放列表命令
    pub fn is_playlist_control(&self) -> bool {
        matches!(
            self,
            PlayerCommand::Next
                | PlayerCommand::Previous
                | PlayerCommand::LoadPlaylist(_)
                | PlayerCommand::SetShuffle(_)
        )
    }
}







