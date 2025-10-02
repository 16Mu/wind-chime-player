// 播放控制Actor
//
// 职责：
// - 播放、暂停、停止控制
// - 精确跳转
// - 音量控制
// - 位置追踪

use tokio::sync::{mpsc, oneshot, watch};
use std::time::{Duration, Instant};
use super::super::audio::{SinkPool, PooledSink, AudioDecoder, LazyAudioDevice};
use super::super::types::{Track, PlayerError, PlayerEvent, Result, PlayerState};

/// 播放Actor消息
#[derive(Debug)]
pub enum PlaybackMsg {
    /// 播放指定曲目
    Play {
        track: Track,
        reply: oneshot::Sender<Result<()>>,
    },
    
    /// 暂停播放
    Pause,
    
    /// 恢复播放
    Resume,
    
    /// 停止播放
    Stop,
    
    /// 跳转到指定位置（毫秒）
    Seek {
        position_ms: u64,
        reply: oneshot::Sender<Result<()>>,
    },
    
    /// 设置音量（0.0 - 1.0）
    SetVolume(f32),
    
    /// 获取当前位置（毫秒）
    GetPosition(oneshot::Sender<Option<u64>>),
    
    /// 缓存样本完成（后台任务通知）
    CacheSamples {
        track_path: String,
        samples: Vec<i16>,
        channels: u16,
        sample_rate: u32,
    },
    
    /// 关闭Actor
    Shutdown,
}

/// 播放状态
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PlaybackState {
    Idle,
    Playing,
    Paused,
    Stopped,
}

/// 缓存的音频样本数据
struct CachedAudioSamples {
    samples: Vec<i16>,
    channels: u16,
    sample_rate: u32,
}

/// 播放控制Actor
pub struct PlaybackActor {
    /// 消息接收器
    inbox: mpsc::Receiver<PlaybackMsg>,
    
    /// 消息发送器（用于后台任务回传）
    inbox_tx: mpsc::Sender<PlaybackMsg>,
    
    /// 音频设备（必须保持存活以输出声音）
    audio_device: Option<LazyAudioDevice>,
    
    /// Sink资源池（已包含设备句柄）
    sink_pool: Option<SinkPool>,
    
    /// 当前Sink
    current_sink: Option<PooledSink>,
    
    /// 播放开始时间（内部状态，用于位置计算）
    play_start_time: Option<Instant>,
    
    /// 播放开始时的位置（内部状态，用于位置计算）
    play_start_position_ms: u64,
    
    /// 状态订阅（从StateActor获取状态）
    state_rx: watch::Receiver<PlayerState>,
    
    /// 事件发送器
    event_tx: mpsc::Sender<PlayerEvent>,
    
    /// 当前曲目的缓存样本（用于快速Seek）
    cached_samples: Option<CachedAudioSamples>,
    
    /// 当前曲目路径（用于判断是否需要重新缓存）
    current_track_path: Option<String>,
}

impl PlaybackActor {
    /// 创建新的PlaybackActor
    pub fn new(
        event_tx: mpsc::Sender<PlayerEvent>,
        state_rx: watch::Receiver<PlayerState>,
    ) -> (Self, mpsc::Sender<PlaybackMsg>) {
        let (tx, rx) = mpsc::channel(32);
        
        let actor = Self {
            inbox: rx,
            inbox_tx: tx.clone(),
            audio_device: None,
            sink_pool: None,
            current_sink: None,
            play_start_time: None,
            play_start_position_ms: 0,
            state_rx,
            event_tx,
            cached_samples: None,
            current_track_path: None,
        };
        
        (actor, tx)
    }
    
    /// 使用外部创建的接收器创建PlaybackActor（用于线程内部创建）
    pub fn new_with_receiver(
        inbox: mpsc::Receiver<PlaybackMsg>,
        inbox_tx: mpsc::Sender<PlaybackMsg>,
        event_tx: mpsc::Sender<PlayerEvent>,
        state_rx: watch::Receiver<PlayerState>,
    ) -> Self {
        Self {
            inbox,
            inbox_tx,
            audio_device: None,
            sink_pool: None,
            current_sink: None,
            play_start_time: None,
            play_start_position_ms: 0,
            state_rx,
            event_tx,
            cached_samples: None,
            current_track_path: None,
        }
    }
    
    /// 运行Actor事件循环
    pub async fn run(mut self) {
        log::info!("▶️ PlaybackActor 启动（懒加载模式，无阻塞）");
        
        // 不在启动时初始化Sink池，延迟到第一次播放时
        // 这样可以避免阻塞应用启动
        
        let mut position_update_timer = tokio::time::interval(Duration::from_millis(100));
        position_update_timer.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        
        loop {
            tokio::select! {
                // 处理消息
                Some(msg) = self.inbox.recv() => {
                    match msg {
                        PlaybackMsg::Play { track, reply } => {
                            let result = self.handle_play(track).await;
                            let _ = reply.send(result);
                        }
                        PlaybackMsg::Pause => {
                            self.handle_pause();
                        }
                        PlaybackMsg::Resume => {
                            self.handle_resume();
                        }
                        PlaybackMsg::Stop => {
                            self.handle_stop();
                        }
                        PlaybackMsg::Seek { position_ms, reply } => {
                            let result = self.handle_seek(position_ms).await;
                            let _ = reply.send(result);
                        }
                        PlaybackMsg::SetVolume(volume) => {
                            self.handle_set_volume(volume);
                        }
                        PlaybackMsg::GetPosition(reply) => {
                            let position = self.get_current_position();
                            let _ = reply.send(position);
                        }
                        PlaybackMsg::CacheSamples { track_path, samples, channels, sample_rate } => {
                            self.handle_cache_samples(track_path, samples, channels, sample_rate);
                        }
                        PlaybackMsg::Shutdown => {
                            log::info!("▶️ PlaybackActor 收到关闭信号");
                            break;
                        }
                    }
                }
                
                // 定期更新位置
                _ = position_update_timer.tick() => {
                    self.update_position().await;
                }
                
                // 收件箱关闭
                else => {
                    log::warn!("▶️ PlaybackActor 收件箱关闭");
                    break;
                }
            }
        }
        
        log::info!("▶️ PlaybackActor 已停止");
    }
    
    /// 初始化Sink池
    async fn initialize_sink_pool(&mut self) -> Result<()> {
        log::info!("📦 初始化Sink资源池");
        
        // 创建音频设备（必须保存以保持OutputStream存活）
        let device = LazyAudioDevice::default();
        let dev = device.get_or_init().await?;
        let pool = SinkPool::with_default_capacity(dev.handle().clone());
        
        // 预热池（创建2个Sink）
        pool.warm_up(2)?;
        
        // 🔥 保存音频设备，确保OutputStream在整个生命周期内存活
        self.audio_device = Some(device);
        self.sink_pool = Some(pool);
        log::info!("✅ Sink资源池初始化完成");
        
        Ok(())
    }
    
    /// 处理播放请求（优化版：立即播放 + 异步缓存）
    async fn handle_play(&mut self, track: Track) -> Result<()> {
        log::info!("▶️ 播放: {:?}", track.title);
        
        // 懒加载：第一次播放时才初始化Sink池
        if self.sink_pool.is_none() {
            log::info!("🎯 首次播放，初始化Sink资源池...");
            if let Err(e) = self.initialize_sink_pool().await {
                log::error!("❌ 初始化Sink池失败: {}", e);
                return Err(e);
            }
        }
        
        // 停止当前播放
        self.handle_stop();
        
        // 确保Sink池已初始化
        if self.sink_pool.is_none() {
            self.initialize_sink_pool().await?;
        }
        
        // 检查是否已有缓存
        let has_cache = self.current_track_path.as_ref() == Some(&track.path) 
                        && self.cached_samples.is_some();
        
        // 创建音频源（统一类型使用 Box<dyn Source>）
        use rodio::Source;
        let source: Box<dyn Source<Item = i16> + Send> = if has_cache {
            // 从缓存创建音频源（即时）
            log::info!("⚡ [PlaybackActor] 使用缓存样本，即时播放");
            let cached = self.cached_samples.as_ref().unwrap();
            use rodio::buffer::SamplesBuffer;
            Box::new(SamplesBuffer::new(
                cached.channels,
                cached.sample_rate,
                cached.samples.clone(),
            ))
        } else {
            // 首次播放：直接解码并开始播放（不等待完整缓存）
            log::info!("🎵 [PlaybackActor] 首次播放，直接解码开始");
            let decoder = AudioDecoder::new(&track.path);
            match decoder.decode() {
                Ok(s) => {
                    log::info!("✅ [PlaybackActor] 音频解码成功，立即开始播放");
                    Box::new(s)
                }
                Err(e) => {
                    log::error!("❌ [PlaybackActor] 音频解码失败: {}", e);
                    return Err(e);
                }
            }
        };
        
        // 从池中获取Sink
        log::info!("🎵 [PlaybackActor] 从池中获取Sink...");
        let pool = self.sink_pool.as_ref().unwrap();
        let sink = match pool.acquire() {
            Ok(s) => {
                log::info!("✅ [PlaybackActor] Sink获取成功");
                s
            }
            Err(e) => {
                log::error!("❌ [PlaybackActor] Sink获取失败: {}", e);
                return Err(e);
            }
        };
        
        // 从状态读取音量
        let volume = self.state_rx.borrow().volume;
        log::info!("🔊 [PlaybackActor] 设置音量: {}", volume);
        sink.set_volume(volume);
        
        // 添加音频源并播放
        log::info!("▶️ [PlaybackActor] 添加音频源并开始播放...");
        sink.append(source);
        sink.play();
        
        // 更新本地播放控制状态
        self.current_sink = Some(sink);
        self.play_start_time = Some(Instant::now());
        self.play_start_position_ms = 0;
        
        // 如果没有缓存，在后台异步缓存样本
        if !has_cache {
            let track_path = track.path.clone();
            let inbox_tx = self.inbox_tx.clone();
            log::info!("🔄 [PlaybackActor] 启动后台缓存任务...");
            
            tokio::spawn(async move {
                let cache_start = Instant::now();
                log::info!("💾 [后台任务] 开始缓存音频样本: {:?}", track_path);
                
                let decoder = AudioDecoder::new(&track_path);
                match decoder.decode() {
                    Ok(source) => {
                        use rodio::Source;
                        let channels = source.channels();
                        let sample_rate = source.sample_rate();
                        let samples: Vec<i16> = source.convert_samples().collect();
                        
                        let cache_elapsed = cache_start.elapsed();
                        log::info!(
                            "✅ [后台任务] 样本缓存完成: {} 个样本, {}通道, {}Hz (耗时: {:?})",
                            samples.len(),
                            channels,
                            sample_rate,
                            cache_elapsed
                        );
                        
                        // 通过消息将缓存结果发送给 Actor
                        let _ = inbox_tx.send(PlaybackMsg::CacheSamples {
                            track_path: track_path.clone(),
                            samples,
                            channels,
                            sample_rate,
                        }).await;
                    }
                    Err(e) => {
                        log::error!("❌ [后台任务] 缓存失败: {:?}", e);
                    }
                }
            });
            
            // 更新跟踪路径（即使缓存未完成）
            self.current_track_path = Some(track.path.clone());
        }
        
        // 发送事件
        log::info!("📤 [PlaybackActor] 发送TrackChanged事件");
        let _ = self.event_tx.send(PlayerEvent::TrackChanged(Some(track))).await;
        
        log::info!("✅ [PlaybackActor] 播放开始成功");
        Ok(())
    }
    
    /// 处理暂停请求
    fn handle_pause(&mut self) {
        if let Some(sink) = &self.current_sink {
            log::info!("⏸️ 暂停播放");
            sink.pause();
            
            // 保存当前位置
            if let Some(position) = self.get_current_position() {
                self.play_start_position_ms = position;
            }
            self.play_start_time = None;
        }
    }
    
    /// 处理恢复请求
    fn handle_resume(&mut self) {
        if let Some(sink) = &self.current_sink {
            log::info!("▶️ 恢复播放");
            sink.play();
            
            // 重置播放开始时间
            self.play_start_time = Some(Instant::now());
        }
    }
    
    /// 处理停止请求
    fn handle_stop(&mut self) {
        if let Some(sink) = self.current_sink.take() {
            log::info!("⏹️ 停止播放");
            sink.stop();
            // sink在drop时会自动归还到池中
        }
        
        self.play_start_time = None;
        self.play_start_position_ms = 0;
    }
    
    /// 处理跳转请求（快速版本 - 使用缓存样本）
    async fn handle_seek(&mut self, position_ms: u64) -> Result<()> {
        let seek_start = Instant::now();
        log::info!("⚡ 快速跳转到: {}ms", position_ms);
        
        // 发送跳转开始事件
        let _ = self.event_tx.send(PlayerEvent::SeekStarted(position_ms)).await;
        
        // 提取缓存数据的副本（避免借用冲突）
        let (samples, channels, sample_rate) = match &self.cached_samples {
            Some(cached) => (
                cached.samples.clone(),
                cached.channels,
                cached.sample_rate,
            ),
            None => {
                log::warn!("⚠️ 没有缓存的样本数据，无法快速跳转");
                let _ = self.event_tx.send(PlayerEvent::SeekFailed {
                    position: position_ms,
                    error: "没有缓存的样本数据".to_string(),
                }).await;
                return Err(PlayerError::SeekFailed("没有缓存的样本数据".to_string()));
            }
        };
        
        // 确保Sink池已初始化
        if self.sink_pool.is_none() {
            log::info!("🎯 Sink池未初始化，开始初始化...");
            if let Err(e) = self.initialize_sink_pool().await {
                log::error!("❌ 初始化Sink池失败: {}", e);
                let _ = self.event_tx.send(PlayerEvent::SeekFailed {
                    position: position_ms,
                    error: format!("初始化失败: {}", e),
                }).await;
                return Err(e);
            }
        }
        
        // 停止当前播放
        self.handle_stop();
        
        // 计算需要跳过的样本数
        let samples_per_ms = sample_rate as u64 * channels as u64 / 1000;
        let skip_samples = (position_ms * samples_per_ms) as usize;
        
        // 从缓存样本中跳过指定位置
        let samples_to_play = if skip_samples < samples.len() {
            samples[skip_samples..].to_vec()
        } else {
            log::warn!("⚠️ 跳转位置超出音频长度");
            Vec::new()
        };
        
        // 创建音频源
        use rodio::buffer::SamplesBuffer;
        let source = SamplesBuffer::new(
            channels,
            sample_rate,
            samples_to_play,
        );
        
        // 从池中获取新的Sink
        let pool = self.sink_pool.as_ref().unwrap();
        let sink = match pool.acquire() {
            Ok(s) => s,
            Err(e) => {
                log::error!("❌ Sink获取失败: {}", e);
                let _ = self.event_tx.send(PlayerEvent::SeekFailed {
                    position: position_ms,
                    error: format!("Sink获取失败: {}", e),
                }).await;
                return Err(e);
            }
        };
        
        // 设置音量
        let volume = self.state_rx.borrow().volume;
        sink.set_volume(volume);
        
        // 添加音频源并播放
        sink.append(source);
        sink.play();
        
        // 更新播放状态
        self.current_sink = Some(sink);
        self.play_start_time = Some(Instant::now());
        self.play_start_position_ms = position_ms;
        
        // 计算跳转耗时
        let elapsed_ms = seek_start.elapsed().as_millis() as u64;
        
        // 发送跳转完成事件
        log::info!("⚡ 快速跳转完成: {}ms (耗时: {}ms) - 接近即时！", position_ms, elapsed_ms);
        let _ = self.event_tx.send(PlayerEvent::SeekCompleted {
            position: position_ms,
            elapsed_ms,
        }).await;
        
        Ok(())
    }
    
    /// 处理设置音量请求
    fn handle_set_volume(&mut self, volume: f32) {
        let clamped_volume = volume.clamp(0.0, 1.0);
        log::info!("🔊 设置音量: {:.0}%", clamped_volume * 100.0);
        
        if let Some(sink) = &self.current_sink {
            sink.set_volume(clamped_volume);
        }
        
        // 注意：音量应该由StateActor管理，这里只是应用到sink
    }
    
    /// 处理缓存样本完成通知
    fn handle_cache_samples(
        &mut self,
        track_path: String,
        samples: Vec<i16>,
        channels: u16,
        sample_rate: u32,
    ) {
        log::info!(
            "💾 [PlaybackActor] 收到缓存完成通知: {:?} ({} 样本, {}通道, {}Hz)",
            track_path,
            samples.len(),
            channels,
            sample_rate
        );
        
        // 只有当前曲目路径匹配时才更新缓存
        if self.current_track_path.as_ref() == Some(&track_path) {
            self.cached_samples = Some(CachedAudioSamples {
                samples,
                channels,
                sample_rate,
            });
            log::info!("✅ [PlaybackActor] 缓存已更新，后续Seek将秒速完成");
        } else {
            log::debug!("⚠️ [PlaybackActor] 曲目已切换，忽略过期缓存");
        }
    }
    
    /// 获取当前播放位置
    fn get_current_position(&self) -> Option<u64> {
        // 如果正在播放，计算当前位置
        if let Some(start_time) = self.play_start_time {
            let elapsed = start_time.elapsed().as_millis() as u64;
            Some(self.play_start_position_ms + elapsed)
        } else {
            // 暂停或停止状态，返回保存的位置
            Some(self.play_start_position_ms)
        }
    }
    
    /// 更新位置（发送事件）
    async fn update_position(&mut self) {
        // 检查播放是否完成
        if let Some(sink) = &self.current_sink {
            // 从状态读取当前曲目信息
            let current_track = self.state_rx.borrow().current_track.clone();
            let is_playing = self.play_start_time.is_some();
            
            // 🔧 修复：只有在播放一段时间后（至少500ms）才检查empty
            // 避免刚append音频就被判断为空而停止
            if sink.empty() && is_playing {
                if let Some(start_time) = self.play_start_time {
                    let elapsed = start_time.elapsed().as_millis();
                    
                    // 只有播放超过500ms且队列为空，才认为播放完成
                    if elapsed > 500 {
                        log::info!("✅ 曲目播放完成（播放时长: {}ms）", elapsed);
                        
                        if let Some(track) = current_track {
                            let _ = self.event_tx.send(PlayerEvent::TrackCompleted(track)).await;
                        }
                        
                        self.handle_stop();
                        return;
                    } else {
                        log::debug!("⏳ Sink为空但播放时间过短（{}ms），继续等待", elapsed);
                    }
                }
            }
        }
        
        // 发送位置更新事件（只在播放时）
        if self.play_start_time.is_some() {
            if let Some(position) = self.get_current_position() {
                let _ = self.event_tx.send(PlayerEvent::PositionChanged(position)).await;
            }
        }
    }
}

/// PlaybackActor的句柄
#[derive(Clone)]
pub struct PlaybackActorHandle {
    tx: mpsc::Sender<PlaybackMsg>,
}

impl PlaybackActorHandle {
    pub fn new(tx: mpsc::Sender<PlaybackMsg>) -> Self {
        Self { tx }
    }
    
    /// 播放曲目
    pub async fn play(&self, track: Track) -> Result<()> {
        let (tx, rx) = oneshot::channel();
        
        self.tx.send(PlaybackMsg::Play { track, reply: tx })
            .await
            .map_err(|e| PlayerError::Internal(format!("发送播放消息失败: {}", e)))?;
        
        rx.await
            .map_err(|e| PlayerError::Internal(format!("接收播放响应失败: {}", e)))?
    }
    
    /// 暂停
    pub async fn pause(&self) -> Result<()> {
        self.tx.send(PlaybackMsg::Pause)
            .await
            .map_err(|e| PlayerError::Internal(format!("发送暂停消息失败: {}", e)))
    }
    
    /// 恢复
    pub async fn resume(&self) -> Result<()> {
        self.tx.send(PlaybackMsg::Resume)
            .await
            .map_err(|e| PlayerError::Internal(format!("发送恢复消息失败: {}", e)))
    }
    
    /// 停止
    pub async fn stop(&self) -> Result<()> {
        self.tx.send(PlaybackMsg::Stop)
            .await
            .map_err(|e| PlayerError::Internal(format!("发送停止消息失败: {}", e)))
    }
    
    /// 跳转
    pub async fn seek(&self, position_ms: u64) -> Result<()> {
        let (tx, rx) = oneshot::channel();
        
        self.tx.send(PlaybackMsg::Seek { position_ms, reply: tx })
            .await
            .map_err(|e| PlayerError::Internal(format!("发送跳转消息失败: {}", e)))?;
        
        rx.await
            .map_err(|e| PlayerError::Internal(format!("接收跳转响应失败: {}", e)))?
    }
    
    /// 设置音量
    pub async fn set_volume(&self, volume: f32) -> Result<()> {
        self.tx.send(PlaybackMsg::SetVolume(volume))
            .await
            .map_err(|e| PlayerError::Internal(format!("发送设置音量消息失败: {}", e)))
    }
    
    /// 获取位置
    pub async fn get_position(&self) -> Result<Option<u64>> {
        let (tx, rx) = oneshot::channel();
        
        self.tx.send(PlaybackMsg::GetPosition(tx))
            .await
            .map_err(|e| PlayerError::Internal(format!("发送获取位置消息失败: {}", e)))?;
        
        rx.await
            .map_err(|e| PlayerError::Internal(format!("接收位置响应失败: {}", e)))
    }
    
    /// 关闭
    pub async fn shutdown(&self) -> Result<()> {
        self.tx.send(PlaybackMsg::Shutdown)
            .await
            .map_err(|e| PlayerError::Internal(format!("发送关闭消息失败: {}", e)))
    }
}
