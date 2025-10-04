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
use std::sync::atomic::{AtomicI64, Ordering};
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
    
    /// 最新播放请求时间戳（用于快速切歌优化）
    latest_play_timestamp: Arc<AtomicI64>,
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
                preload_tx.clone(),  // ✅ 添加inbox_tx参数用于内部消息传递
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
        
        // 🔧 P1修复：使用catch_unwind处理panic，防止线程崩溃
        let playback_thread = thread::Builder::new()
            .name("playback-actor".to_string())
            .spawn(move || {
                println!("🧵 [CORE] PlaybackActor线程已启动");
                log::info!("🧵 PlaybackActor线程已启动");
                
                // 使用catch_unwind捕获panic
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    // 在线程内部创建PlaybackActor（避免Send问题）
                    let playback_actor = PlaybackActor::new_with_receiver(playback_rx, playback_tx_clone, event_tx_for_playback, state_watch_for_playback);
                    
                    // 🔧 修复：使用多线程runtime以支持流式播放中的block_in_place
                    // 虽然AudioDevice不是Send，但PlaybackActor已经在专用线程中，
                    // 多线程runtime只是允许并发执行异步任务，音频操作仍在同一线程
                    let rt = tokio::runtime::Builder::new_multi_thread()
                        .worker_threads(2) // 使用2个工作线程，足够处理流式IO
                        .thread_name("playback-worker")
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
                }));
                
                // 处理panic
                if let Err(panic_err) = result {
                    let panic_msg = if let Some(s) = panic_err.downcast_ref::<&str>() {
                        s.to_string()
                    } else if let Some(s) = panic_err.downcast_ref::<String>() {
                        s.clone()
                    } else {
                        "Unknown panic".to_string()
                    };
                    
                    log::error!("❌ [CORE] PlaybackActor线程panic: {}", panic_msg);
                    println!("❌ [CORE] PlaybackActor线程panic: {}", panic_msg);
                }
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
            latest_play_timestamp: Arc::new(AtomicI64::new(0)),
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
            PlayerCommand::Play(track_id, timestamp) => {
                println!("▶️ [CORE] 处理Play命令: track_id={}, timestamp={}", track_id, timestamp);
                log::info!("▶️ [CORE] 处理Play命令: track_id={}, timestamp={}", track_id, timestamp);
                
                // 🎯 关键优化：在入口处立即检查时间戳，避免过期请求执行任何操作
                let current_latest = self.latest_play_timestamp.load(Ordering::SeqCst);
                if timestamp < current_latest {
                    println!("⏭️ [CORE] 播放请求已过期（入口检查: 请求={}, 最新={}），立即拒绝", timestamp, current_latest);
                    log::info!("⏭️ [CORE] 播放请求已过期（入口检查），立即拒绝");
                    return Ok(()); // 直接返回，不执行任何操作
                }
                
                // 更新最新时间戳
                self.latest_play_timestamp.store(timestamp, Ordering::SeqCst);
                
                self.handle_play(track_id, timestamp).await
            }
            PlayerCommand::Pause => {
                self.playback_handle.pause().await?;
                self.state_handle.update_playing_state(false).await;
                Ok(())
            }
            PlayerCommand::Resume => {
                self.playback_handle.resume().await?;
                self.state_handle.update_playing_state(true).await;
                Ok(())
            }
            PlayerCommand::Stop => {
                self.playback_handle.stop().await?;
                self.state_handle.update_playing_state(false).await;
                Ok(())
            }
            PlayerCommand::Seek(position_ms) => {
                // 🔧 修复：记录seek前的播放状态
                let was_playing = self.get_state().is_playing;
                
                // 执行seek操作
                self.playback_handle.seek(position_ms).await?;
                
                // 🔧 修复：如果原本在播放，确保seek后状态保持为playing
                // 因为handle_seek内部会调用sink.play()，但不会更新StateActor
                if was_playing {
                    self.state_handle.update_playing_state(true).await;
                }
                
                Ok(())
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
    async fn handle_play(&mut self, track_id: i64, timestamp: i64) -> Result<()> {
        use std::time::Instant;
        let start_time = Instant::now();
        println!("🎵 [CORE] 处理播放命令: track_id={}, timestamp={}", track_id, timestamp);
        log::info!("🎵 [CORE] 处理播放命令: track_id={}, timestamp={}", track_id, timestamp);
        
        // 从播放列表获取曲目
        let step1 = Instant::now();
        println!("📋 [CORE] 从播放列表获取曲目...");
        let track = match self.playlist_handle.jump_to(track_id).await {
            Ok(t) => {
                println!("✅ [CORE] 曲目获取成功: {:?} (耗时: {}ms)", t.title, step1.elapsed().as_millis());
                t
            }
            Err(e) => {
                println!("❌ [CORE] 获取曲目失败: {}", e);
                return Err(e);
            }
        };
        
        // 检查时间戳（防止在获取曲目过程中有新请求）
        let latest_timestamp = self.latest_play_timestamp.load(Ordering::SeqCst);
        if timestamp < latest_timestamp {
            println!("⏭️ [CORE] 播放请求已过期，跳过");
            return Ok(());
        }
        
        // 🔧 优化：快速切歌时先停止当前播放
        let step2 = Instant::now();
        let current_state = self.get_state();
        if let Some(ref curr) = current_state.current_track {
            if curr.id != track.id {
                println!("⏸️ [CORE] 先停止当前播放...");
                let _ = self.playback_handle.stop().await;
                println!("✅ [CORE] 停止完成 (耗时: {}ms)", step2.elapsed().as_millis());
            }
        }
        
        // 再次检查时间戳
        let latest_timestamp = self.latest_play_timestamp.load(Ordering::SeqCst);
        if timestamp < latest_timestamp {
            println!("⏭️ [CORE] 播放请求已过期（播放前检查），跳过");
            return Ok(());
        }
        
        // 播放曲目
        let step3 = Instant::now();
        println!("▶️ [CORE] 调用PlaybackActor播放...");
        self.playback_handle.play(track.clone()).await?;
        println!("✅ [CORE] PlaybackActor播放完成 (耗时: {}ms)", step3.elapsed().as_millis());
        
        // 更新状态（异步，不等待）
        let step4 = Instant::now();
        self.state_handle.update_current_track(Some(track.clone())).await;
        self.state_handle.update_playing_state(true).await;
        println!("✅ [CORE] 状态更新完成 (耗时: {}ms)", step4.elapsed().as_millis());
        
        // 触发预加载（异步，不阻塞）
        if let Some(preload) = &self.preload_handle {
            let current_index = self.playlist_handle.get_current_index().await.ok().flatten().unwrap_or(0);
            let playlist = self.playlist_handle.get_playlist().await.unwrap_or_default();
            if !playlist.is_empty() {
                let _ = preload.update_playlist(playlist.clone(), Some(current_index)).await;
            }
            let _ = preload.on_track_changed(track.clone(), current_index).await;
        }
        
        println!("✅ [CORE] 播放命令处理完成 (总耗时: {}ms)", start_time.elapsed().as_millis());
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
    
    /// 🔧 P1修复：关闭PlayerCore（并发关闭+超时，防止死锁）
    pub async fn shutdown(&mut self) -> Result<()> {
        log::info!("🛑 关闭PlayerCore");
        
        // 并发发送关闭信号给所有Actor（不等待响应）
        use tokio::time::{timeout, Duration};
        
        // 并发发送关闭信号给所有Actor（不等待响应）
        let timeout_duration = Duration::from_secs(5);
        
        // 分别执行关闭并收集结果
        // 注意：state_handle.shutdown()返回()，需要包装为Result类型
        let r1 = timeout(timeout_duration, self.playback_handle.shutdown()).await;
        let r2 = timeout(timeout_duration, self.playlist_handle.shutdown()).await;
        let r3 = timeout(timeout_duration, async {
            self.state_handle.shutdown().await;
            Ok::<(), PlayerError>(())
        }).await;
        let r4 = timeout(timeout_duration, self.audio_handle.shutdown()).await;
        
        // 记录失败的关闭操作
        match r1 {
            Ok(Ok(_)) => log::debug!("PlaybackActor 关闭成功"),
            Ok(Err(e)) => log::warn!("PlaybackActor 关闭失败: {}", e),
            Err(_) => log::warn!("PlaybackActor 关闭超时"),
        }
        
        match r2 {
            Ok(Ok(_)) => log::debug!("PlaylistActor 关闭成功"),
            Ok(Err(e)) => log::warn!("PlaylistActor 关闭失败: {}", e),
            Err(_) => log::warn!("PlaylistActor 关闭超时"),
        }
        
        if let Ok(Ok(_)) = r3 {
            log::debug!("StateActor 关闭成功");
        } else if let Ok(Err(ref e)) = r3 {
            log::warn!("StateActor 关闭失败: {}", e);
        } else {
            log::warn!("StateActor 关闭超时");
        }
        
        if let Ok(Ok(_)) = r4 {
            log::debug!("AudioActor 关闭成功");
        } else if let Ok(Err(ref e)) = r4 {
            log::warn!("AudioActor 关闭失败: {}", e);
        } else {
            log::warn!("AudioActor 关闭超时");
        }
        
        // 关闭PreloadActor（如果启用）
        if let Some(preload) = &self.preload_handle {
            match timeout(timeout_duration, preload.shutdown()).await {
                Ok(Ok(_)) => log::debug!("PreloadActor 关闭成功"),
                Ok(Err(e)) => log::warn!("PreloadActor 关闭失败: {}", e),
                Err(_) => log::warn!("PreloadActor 关闭超时"),
            }
        }
        
        // 并发等待所有Actor任务完成（带超时）
        let actor_timeout = Duration::from_secs(3);
        let handle_futures: Vec<_> = self.actor_handles.drain(..)
            .map(|handle| timeout(actor_timeout, handle))
            .collect();
        
        let _ = futures::future::join_all(handle_futures).await;
        
        // 等待playback线程完成（带超时）
        if let Some(thread_handle) = self.playback_thread.take() {
            let join_result = tokio::task::spawn_blocking(move || {
                thread_handle.join()
            });
            
            // 超时3秒
            match timeout(Duration::from_secs(3), join_result).await {
                Ok(Ok(Ok(_))) => log::info!("Playback线程正常退出"),
                Ok(Ok(Err(e))) => log::error!("Playback线程panic: {:?}", e),
                Ok(Err(e)) => log::error!("等待playback线程失败: {}", e),
                Err(_) => log::warn!("等待playback线程超时"),
            }
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
