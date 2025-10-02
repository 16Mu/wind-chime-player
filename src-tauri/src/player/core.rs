// PlayerCore - 播放器核心协调器
//
// 职责：
// - 创建并管理所有Actor
// - 提供统一的公共API
// - 命令分发到对应的Actor
// - 事件聚合并转发到前端
// - 生命周期管理

use tokio::sync::{mpsc, watch};
use std::sync::Arc;
use std::thread;
use parking_lot::RwLock;
use tauri::async_runtime::JoinHandle;

use super::actors::{
    AudioActor, AudioActorHandle,
    PlaybackActor, PlaybackActorHandle,
    PlaylistActor, PlaylistActorHandle,
    PreloadActor, PreloadActorHandle,
    StateActor, StateActorHandle,
};
use super::types::{
    Track, PlayerState, PlayerEvent, PlayerCommand, Result, PlayerError,
};

#[cfg(test)]
use super::types::RepeatMode;

/// PlayerCore配置
#[derive(Debug, Clone)]
pub struct PlayerCoreConfig {
    /// 事件通道容量
    pub event_channel_capacity: usize,
    /// 是否自动初始化音频设备
    pub auto_init_audio: bool,
    /// 预加载缓存容量（曲目数）
    pub preload_cache_capacity: usize,
    /// 预加载缓存大小（MB）
    pub preload_cache_size_mb: usize,
    /// 是否启用智能预加载
    pub enable_preload: bool,
}

impl Default for PlayerCoreConfig {
    fn default() -> Self {
        Self {
            event_channel_capacity: 100,
            auto_init_audio: false, // 懒加载
            preload_cache_capacity: 3, // 最多缓存3首歌曲
            preload_cache_size_mb: 150, // 最大缓存150MB
            enable_preload: true, // 默认启用预加载
        }
    }
}

/// PlayerCore - 播放器核心
pub struct PlayerCore {
    /// Audio Actor句柄（用于初始化和监控）
    #[allow(dead_code)]
    audio_handle: AudioActorHandle,
    
    /// Playback Actor句柄
    playback_handle: PlaybackActorHandle,
    
    /// Playlist Actor句柄
    playlist_handle: PlaylistActorHandle,
    
    /// Preload Actor句柄
    preload_handle: Option<PreloadActorHandle>,
    
    /// State Actor句柄
    state_handle: StateActorHandle,
    
    /// 状态观察器
    state_watch: watch::Receiver<PlayerState>,
    
    /// 事件接收器（Arc包装，可以独立访问）
    event_rx: Arc<tokio::sync::Mutex<mpsc::Receiver<PlayerEvent>>>,
    
    /// Actor任务句柄（tokio任务）
    actor_handles: Vec<JoinHandle<()>>,
    
    /// Playback线程句柄（独立线程）
    playback_thread: Option<thread::JoinHandle<()>>,
    
    /// 配置
    config: PlayerCoreConfig,
}

impl PlayerCore {
    /// 创建新的PlayerCore
    /// 
    /// # 参数
    /// - `config`: 配置
    /// 
    /// # 返回
    /// - `Result<Self>`: PlayerCore实例
    pub async fn new(config: PlayerCoreConfig) -> Result<Self> {
        println!("🚀 [CORE] 开始创建PlayerCore...");
        log::info!("🚀 开始创建PlayerCore...");
        
        // 创建事件通道
        println!("📡 [CORE] 创建事件通道...");
        log::info!("📡 创建事件通道...");
        let (event_tx, event_rx) = mpsc::channel(config.event_channel_capacity);
        println!("✅ [CORE] 事件通道创建完成");
        log::info!("✅ 事件通道创建完成");
        
        // 创建Audio Actor
        println!("🎧 [CORE] 创建AudioActor...");
        log::info!("🎧 创建AudioActor...");
        let (audio_actor, audio_tx) = AudioActor::new(event_tx.clone());
        let audio_handle = AudioActorHandle::new(audio_tx);
        println!("✅ [CORE] AudioActor创建完成");
        log::info!("✅ AudioActor创建完成");
        
        // 创建Playlist Actor
        println!("📋 [CORE] 创建PlaylistActor...");
        log::info!("📋 创建PlaylistActor...");
        let (playlist_actor, playlist_tx) = PlaylistActor::new(event_tx.clone());
        let playlist_handle = PlaylistActorHandle::new(playlist_tx);
        println!("✅ [CORE] PlaylistActor创建完成");
        log::info!("✅ PlaylistActor创建完成");
        
        // 创建State Actor
        println!("📊 [CORE] 创建StateActor...");
        log::info!("📊 创建StateActor...");
        let (state_actor, state_tx, state_watch) = StateActor::new(event_tx.clone());
        let state = Arc::new(RwLock::new(PlayerState::default()));
        let state_handle = StateActorHandle::new(state_tx, state);
        println!("✅ [CORE] StateActor创建完成");
        log::info!("✅ StateActor创建完成");
        
        // 创建Preload Actor（可选）
        let (preload_actor, preload_handle) = if config.enable_preload {
            println!("🔄 [CORE] 创建PreloadActor...");
            log::info!("🔄 创建PreloadActor...");
            let (preload_tx, preload_rx) = mpsc::channel(100);
            let actor = PreloadActor::new(
                preload_rx,
                event_tx.clone(),
                config.preload_cache_capacity,
                config.preload_cache_size_mb,
            );
            let handle = PreloadActorHandle::new(preload_tx);
            println!("✅ [CORE] PreloadActor创建完成");
            log::info!("✅ PreloadActor创建完成");
            (Some(actor), Some(handle))
        } else {
            println!("⏭️ [CORE] 预加载功能已禁用");
            log::info!("⏭️ 预加载功能已禁用");
            (None, None)
        };
        
        // 启动所有Actor
        println!("🚀 [CORE] 开始启动所有Actor...");
        log::info!("🚀 开始启动所有Actor...");
        drop(audio_actor); // AudioActor暂不使用
        
        // PlaybackActor在独立线程中运行（因为AudioDevice不是Send）
        // 关键：在线程内部创建PlaybackActor，避免跨线程传递
        println!("🧵 [CORE] 创建PlaybackActor独立线程...");
        log::info!("🧵 创建PlaybackActor独立线程...");
        
        let event_tx_for_playback = event_tx.clone();
        let state_watch_for_playback = state_watch.clone();
        let (playback_tx, playback_rx) = mpsc::channel(100);
        let playback_tx_clone = playback_tx.clone();
        let playback_handle = PlaybackActorHandle::new(playback_tx);
        
        let playback_thread = thread::Builder::new()
            .name("playback-actor".to_string())
            .spawn(move || {
                println!("🧵 [CORE] PlaybackActor线程已启动");
                log::info!("🧵 PlaybackActor线程已启动");
                
                // 在线程内部创建PlaybackActor（避免Send问题）
                let playback_actor = PlaybackActor::new_with_receiver(playback_rx, playback_tx_clone, event_tx_for_playback, state_watch_for_playback);
                
                // 创建单线程tokio runtime
                let rt = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .expect("创建playback runtime失败");
                
                println!("⚡ [CORE] PlaybackActor runtime已创建");
                log::info!("⚡ PlaybackActor runtime已创建");
                // 在该runtime上执行playback_actor
                rt.block_on(async move {
                    println!("▶️ [CORE] PlaybackActor.run() 开始执行");
                    log::info!("▶️ PlaybackActor.run() 开始执行");
                    playback_actor.run().await;
                    println!("⏹️ [CORE] PlaybackActor已退出");
                    log::info!("⏹️ PlaybackActor已退出");
                });
            })
            .map_err(|e| PlayerError::Internal(format!("创建playback线程失败: {}", e)))?;
        
        println!("✅ [CORE] PlaybackActor线程创建成功");
        log::info!("✅ PlaybackActor线程创建成功");
        
        // 🔧 修复：使用tauri::async_runtime::spawn确保Actor在正确的runtime中运行
        println!("🚀 [CORE] 启动PlaylistActor、StateActor和PreloadActor...");
        log::info!("🚀 启动PlaylistActor、StateActor和PreloadActor...");
        let mut handles = vec![
            tauri::async_runtime::spawn(playlist_actor.run()),
            tauri::async_runtime::spawn(state_actor.run()),
        ];
        
        // 启动PreloadActor（如果启用）
        if let Some(preload_actor) = preload_actor {
            handles.push(tauri::async_runtime::spawn(preload_actor.run()));
        }
        
        println!("🎉 [CORE] PlayerCore创建完成，所有Actor已启动！");
        log::info!("🎉 PlayerCore创建完成，所有Actor已启动！");
        
        // 如果配置要求，初始化音频设备
        if config.auto_init_audio {
            println!("🎵 [CORE] 自动初始化音频设备");
            log::info!("🎵 自动初始化音频设备");
            let _ = audio_handle.initialize().await;
        }
        
        Ok(Self {
            audio_handle,
            playback_handle,
            playlist_handle,
            preload_handle,
            state_handle,
            state_watch,
            event_rx: Arc::new(tokio::sync::Mutex::new(event_rx)),
            actor_handles: handles,
            playback_thread: Some(playback_thread),
            config,
        })
    }
    
    /// 创建默认配置的PlayerCore
    pub async fn with_default_config() -> Result<Self> {
        Self::new(PlayerCoreConfig::default()).await
    }
    
    /// 处理命令
    /// 
    /// 这是主要的命令入口，分发命令到对应的Actor
    pub async fn handle_command(&mut self, command: PlayerCommand) -> Result<()> {
        println!("📨 [CORE] 处理命令: {:?}", command);
        log::info!("📨 [CORE] 处理命令: {:?}", command);
        
        match command {
            // 播放控制命令
            PlayerCommand::Play(track_id) => {
                println!("▶️ [CORE] 处理Play命令: track_id={}", track_id);
                log::info!("▶️ [CORE] 处理Play命令: track_id={}", track_id);
                self.handle_play(track_id).await
            }
            PlayerCommand::Pause => {
                self.playback_handle.pause().await
            }
            PlayerCommand::Resume => {
                self.playback_handle.resume().await
            }
            PlayerCommand::Stop => {
                self.playback_handle.stop().await?;
                self.state_handle.update_playing_state(false).await;
                Ok(())
            }
            PlayerCommand::Seek(position_ms) => {
                self.playback_handle.seek(position_ms).await
            }
            PlayerCommand::Next => {
                self.handle_next().await
            }
            PlayerCommand::Previous => {
                self.handle_previous().await
            }
            
            // 音量控制
            PlayerCommand::SetVolume(volume) => {
                self.playback_handle.set_volume(volume).await?;
                self.state_handle.update_volume(volume).await;
                Ok(())
            }
            
            // 播放列表命令
            PlayerCommand::LoadPlaylist(tracks) => {
                println!("📋 [CORE] 处理LoadPlaylist命令: {} 首曲目", tracks.len());
                log::info!("📋 [CORE] 处理LoadPlaylist命令: {} 首曲目", tracks.len());
                
                println!("📋 [CORE] 调用playlist_handle.load_playlist...");
                self.playlist_handle.load_playlist(tracks.clone()).await?;
                println!("✅ [CORE] playlist_handle.load_playlist 完成");
                
                // 通知PreloadActor播放列表已更新
                if let Some(preload) = &self.preload_handle {
                    println!("🔄 [CORE] 通知PreloadActor更新播放列表...");
                    let current_index = self.playlist_handle.get_current_index().await.ok().flatten();
                    let _ = preload.update_playlist(tracks, current_index).await;
                    println!("✅ [CORE] PreloadActor通知完成");
                }
                
                println!("✅ [CORE] LoadPlaylist命令处理完成");
                log::info!("✅ [CORE] LoadPlaylist命令处理完成");
                Ok(())
            }
            PlayerCommand::SetShuffle(enabled) => {
                self.playlist_handle.set_shuffle(enabled).await?;
                self.state_handle.update_shuffle(enabled).await;
                // 通知PreloadActor播放模式已更新
                if let Some(preload) = &self.preload_handle {
                    let state = self.get_state();
                    let _ = preload.update_play_mode(state.repeat_mode, enabled).await;
                }
                Ok(())
            }
            PlayerCommand::SetRepeatMode(mode) => {
                self.playlist_handle.set_repeat_mode(mode).await?;
                self.state_handle.update_repeat_mode(mode).await;
                // 通知PreloadActor播放模式已更新
                if let Some(preload) = &self.preload_handle {
                    let state = self.get_state();
                    let _ = preload.update_play_mode(mode, state.shuffle).await;
                }
                Ok(())
            }
            
            // 设备管理
            PlayerCommand::ResetAudioDevice => {
                self.audio_handle.reset().await
            }
            
            // 关闭
            PlayerCommand::Shutdown => {
                self.shutdown().await
            }
        }
    }
    
    /// 处理播放命令
    async fn handle_play(&mut self, track_id: i64) -> Result<()> {
        println!("🎵 [CORE] 处理播放命令: track_id={}", track_id);
        log::info!("🎵 [CORE] 处理播放命令: track_id={}", track_id);
        
        // 从播放列表获取曲目
        println!("📋 [CORE] 从播放列表获取曲目...");
        log::info!("📋 [CORE] 从播放列表获取曲目...");
        let track = match self.playlist_handle.jump_to(track_id).await {
            Ok(t) => {
                println!("✅ [CORE] 曲目获取成功: {:?}", t.title);
                log::info!("✅ [CORE] 曲目获取成功: {:?}", t.title);
                t
            }
            Err(e) => {
                println!("❌ [CORE] 获取曲目失败: {}", e);
                log::error!("❌ [CORE] 获取曲目失败: {}", e);
                return Err(e);
            }
        };
        
        // 获取当前索引和完整播放列表
        let current_index = self.playlist_handle.get_current_index().await.ok().flatten().unwrap_or(0);
        let playlist = self.playlist_handle.get_playlist().await.unwrap_or_default();
        
        // 播放曲目
        println!("▶️ [CORE] 调用PlaybackActor播放...");
        log::info!("▶️ [CORE] 调用PlaybackActor播放...");
        self.playback_handle.play(track.clone()).await?;
        
        // 更新状态
        println!("📊 [CORE] 更新播放状态...");
        log::info!("📊 [CORE] 更新播放状态...");
        self.state_handle.update_current_track(Some(track.clone())).await;
        self.state_handle.update_playing_state(true).await;
        
        // 触发预加载（如果启用）
        if let Some(preload) = &self.preload_handle {
            log::debug!("🔄 触发预加载: track={}, index={}", track.id, current_index);
            // 更新播放列表信息
            if !playlist.is_empty() {
                let _ = preload.update_playlist(playlist.clone(), Some(current_index)).await;
            }
            // 通知曲目变化
            let _ = preload.on_track_changed(track.clone(), current_index).await;
        }
        
        println!("✅ [CORE] 播放命令处理完成");
        log::info!("✅ [CORE] 播放命令处理完成");
        Ok(())
    }
    
    /// 处理下一曲命令
    async fn handle_next(&mut self) -> Result<()> {
        // 从播放列表获取下一曲
        let next_track = self.playlist_handle.get_next().await?;
        
        match next_track {
            Some(track) => {
                // 播放下一曲
                self.playback_handle.play(track.clone()).await?;
                self.state_handle.update_current_track(Some(track.clone())).await;
                self.state_handle.update_playing_state(true).await;
                
                // 触发预加载
                if let Some(preload) = &self.preload_handle {
                    let current_index = self.playlist_handle.get_current_index().await.ok().flatten().unwrap_or(0);
                    let _ = preload.on_track_changed(track, current_index).await;
                }
                
                Ok(())
            }
            None => {
                // 没有下一曲，停止播放
                log::info!("📋 播放列表已结束");
                self.playback_handle.stop().await?;
                self.state_handle.update_playing_state(false).await;
                Ok(())
            }
        }
    }
    
    /// 处理上一曲命令
    async fn handle_previous(&mut self) -> Result<()> {
        // 从播放列表获取上一曲
        let prev_track = self.playlist_handle.get_previous().await?;
        
        match prev_track {
            Some(track) => {
                // 播放上一曲
                self.playback_handle.play(track.clone()).await?;
                self.state_handle.update_current_track(Some(track.clone())).await;
                self.state_handle.update_playing_state(true).await;
                
                // 触发预加载
                if let Some(preload) = &self.preload_handle {
                    let current_index = self.playlist_handle.get_current_index().await.ok().flatten().unwrap_or(0);
                    let _ = preload.on_track_changed(track, current_index).await;
                }
                
                Ok(())
            }
            None => {
                log::warn!("⚠️ 没有上一曲");
                Err(PlayerError::Internal("没有上一曲".to_string()))
            }
        }
    }
    
    /// 获取当前状态
    pub fn get_state(&self) -> PlayerState {
        self.state_handle.get_state()
    }
    
    /// 订阅状态变化
    pub fn subscribe_state(&self) -> watch::Receiver<PlayerState> {
        self.state_watch.clone()
    }
    
    /// 获取事件接收器的克隆（用于独立的事件循环）
    pub fn get_event_receiver(&self) -> Arc<tokio::sync::Mutex<mpsc::Receiver<PlayerEvent>>> {
        Arc::clone(&self.event_rx)
    }
    
    /// 接收下一个事件（非阻塞）
    pub async fn recv_event(&self) -> Option<PlayerEvent> {
        let mut rx = self.event_rx.lock().await;
        rx.recv().await
    }
    
    /// 尝试接收事件（立即返回）
    pub fn try_recv_event(&self) -> Option<PlayerEvent> {
        if let Ok(mut rx) = self.event_rx.try_lock() {
            rx.try_recv().ok()
        } else {
            None
        }
    }
    
    /// 获取播放列表
    pub async fn get_playlist(&self) -> Result<Vec<Track>> {
        self.playlist_handle.get_playlist().await
    }
    
    /// 获取当前播放位置
    pub async fn get_position(&self) -> Result<Option<u64>> {
        self.playback_handle.get_position().await
    }
    
    /// 关闭PlayerCore
    pub async fn shutdown(&mut self) -> Result<()> {
        log::info!("🛑 关闭PlayerCore");
        
        // 发送关闭信号给所有Actor
        let _ = self.playback_handle.shutdown().await;
        let _ = self.playlist_handle.shutdown().await;
        let _ = self.state_handle.shutdown().await;
        let _ = self.audio_handle.shutdown().await;
        
        // 关闭PreloadActor（如果启用）
        if let Some(preload) = &self.preload_handle {
            let _ = preload.shutdown().await;
        }
        
        // 等待所有Actor任务完成（带超时）
        let timeout = tokio::time::Duration::from_secs(5);
        for handle in self.actor_handles.drain(..) {
            let _ = tokio::time::timeout(timeout, handle).await;
        }
        
        // 等待playback线程完成
        if let Some(thread_handle) = self.playback_thread.take() {
            // 注意：这里使用spawn_blocking因为thread::join是阻塞的
            tokio::task::spawn_blocking(move || {
                if let Err(e) = thread_handle.join() {
                    log::error!("等待playback线程失败: {:?}", e);
                }
            }).await.ok();
        }
        
        log::info!("✅ PlayerCore已关闭");
        Ok(())
    }
}

impl Drop for PlayerCore {
    fn drop(&mut self) {
        log::info!("🗑️ PlayerCore Drop");
        // 注意：在Drop中不能使用async，所以只能中止任务
        for handle in &self.actor_handles {
            handle.abort();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_player_core_creation() {
        let result = PlayerCore::with_default_config().await;
        assert!(result.is_ok());
        
        if let Ok(mut core) = result {
            let state = core.get_state();
            assert!(!state.is_playing);
            assert!(state.current_track.is_none());
            
            // 清理
            let _ = core.shutdown().await;
        }
    }
    
    #[tokio::test]
    async fn test_player_core_state() {
        let core = PlayerCore::with_default_config().await.unwrap();
        let state = core.get_state();
        
        assert_eq!(state.volume, 1.0);
        assert_eq!(state.repeat_mode, RepeatMode::Off);
        assert!(!state.shuffle);
    }
}
