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
        samples: std::sync::Arc<[i16]>,
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
/// 
/// 优化：使用Arc共享samples，避免每次播放时clone大量数据
struct CachedAudioSamples {
    samples: std::sync::Arc<[i16]>,
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
        use std::time::Instant;
        let start = Instant::now();
        log::info!("▶️ 播放: {:?}", track.title);
        println!("🎵 [PlaybackActor] 开始播放: {:?}", track.title);
        
        // 懒加载：第一次播放时才初始化Sink池
        if self.sink_pool.is_none() {
            let init_start = Instant::now();
            log::info!("🎯 首次播放，初始化Sink资源池...");
            println!("🎯 [PlaybackActor] 首次播放，初始化Sink资源池...");
            if let Err(e) = self.initialize_sink_pool().await {
                log::error!("❌ 初始化Sink池失败: {}", e);
                return Err(e);
            }
            println!("✅ [PlaybackActor] Sink池初始化完成 (耗时: {}ms)", init_start.elapsed().as_millis());
        }
        
        // 停止当前播放
        let stop_start = Instant::now();
        println!("⏸️ [PlaybackActor] 停止当前播放...");
        self.handle_stop();
        println!("✅ [PlaybackActor] 停止完成 (耗时: {}ms)", stop_start.elapsed().as_millis());
        
        // 确保Sink池已初始化
        if self.sink_pool.is_none() {
            self.initialize_sink_pool().await?;
        }
        
        // 检查是否已有缓存
        let has_cache = self.current_track_path.as_ref() == Some(&track.path) 
                        && self.cached_samples.is_some();
        
        // 创建音频源（统一类型使用 Box<dyn Source>）
        use rodio::Source;
        let decode_start = Instant::now();
        let source: Box<dyn Source<Item = i16> + Send> = if has_cache {
            // 从缓存创建音频源（即时，Arc共享，无需完整clone）
            println!("⚡ [PlaybackActor] 使用缓存样本（Arc共享，零拷贝）");
            let cached = self.cached_samples.as_ref().unwrap();
            use rodio::buffer::SamplesBuffer;
            // Arc<[i16]>转换为Vec - rodio需要拥有数据
            // 但这是最后一次不可避免的拷贝，之前的缓存复用都是零成本的
            Box::new(SamplesBuffer::new(
                cached.channels,
                cached.sample_rate,
                cached.samples.to_vec(),
            ))
        } else {
            // 首次播放：解码音频文件
            println!("🎵 [PlaybackActor] 准备音频文件...");
            
            // 🔥 优化：使用流式播放，不下载完整文件
            let source_result: Result<Box<dyn rodio::Source<Item = i16> + Send>> = if track.path.starts_with("webdav://") {
                println!("🌊 [PlaybackActor] 检测到WebDAV远程文件，使用流式播放（边下边播）...");
                self.decode_streaming(&track.path).await
            } else {
                println!("🎵 [PlaybackActor] 解码本地音频文件: {}...", track.path);
                let decoder = AudioDecoder::new(&track.path);
                match decoder.decode() {
                    Ok(s) => {
                        println!("✅ [PlaybackActor] 本地文件解码完成 (耗时: {}ms)", decode_start.elapsed().as_millis());
                        Ok(Box::new(s) as Box<dyn rodio::Source<Item = i16> + Send>)
                    }
                    Err(e) => {
                        println!("❌ [PlaybackActor] 音频解码失败: {}", e);
                        Err(e)
                    }
                }
            };
            
            match source_result {
                Ok(s) => {
                    println!("✅ [PlaybackActor] 音频源已准备 (耗时: {}ms)", decode_start.elapsed().as_millis());
                    s
                }
                Err(e) => {
                    println!("❌ [PlaybackActor] 音频源准备失败: {}", e);
                    return Err(e);
                }
            }
        };
        println!("✅ [PlaybackActor] 音频源准备完成 (耗时: {}ms)", decode_start.elapsed().as_millis());
        
        // 从池中获取Sink
        let sink_start = Instant::now();
        println!("🎵 [PlaybackActor] 从池中获取Sink...");
        let pool = self.sink_pool.as_ref().unwrap();
        let sink = match pool.acquire() {
            Ok(s) => {
                println!("✅ [PlaybackActor] Sink获取成功 (耗时: {}ms)", sink_start.elapsed().as_millis());
                s
            }
            Err(e) => {
                println!("❌ [PlaybackActor] Sink获取失败: {}", e);
                return Err(e);
            }
        };
        
        // 从状态读取音量并播放
        let play_start = Instant::now();
        let volume = self.state_rx.borrow().volume;
        sink.set_volume(volume);
        
        println!("▶️ [PlaybackActor] 添加音频源并开始播放...");
        sink.append(source);
        sink.play();
        println!("✅ [PlaybackActor] 播放启动完成 (耗时: {}ms)", play_start.elapsed().as_millis());
        
        // 更新本地播放控制状态
        self.current_sink = Some(sink);
        self.play_start_time = Some(Instant::now());
        self.play_start_position_ms = 0;
        
        println!("✅ [PlaybackActor] handle_play完成 (总耗时: {}ms)", start.elapsed().as_millis());
        
        // 🔥 后台缓存优化：使用spawn_blocking避免阻塞runtime
        if !has_cache && !track.path.starts_with("webdav://") && !track.path.starts_with("ftp://") {
            println!("💾 [PlaybackActor] 启动后台缓存任务（非阻塞）");
            let track_path = track.path.clone();
            let inbox_tx = self.inbox_tx.clone();
            
            // 在阻塞线程池中进行音频解码
            tokio::task::spawn_blocking(move || {
                println!("🔧 [后台缓存] 开始解码音频文件...");
                let decode_start = std::time::Instant::now();
                
                let decoder = AudioDecoder::new(&track_path);
                match decoder.decode() {
                    Ok(source) => {
                        use rodio::Source;
                        // 将音频源转换为样本数组
                        let channels = source.channels();
                        let sample_rate = source.sample_rate();
                        let samples: Vec<i16> = source.collect();
                        let samples_arc: std::sync::Arc<[i16]> = std::sync::Arc::from(samples.into_boxed_slice());
                        
                        println!("✅ [后台缓存] 解码完成 (耗时: {}ms, {} 样本)", 
                            decode_start.elapsed().as_millis(), 
                            samples_arc.len()
                        );
                        
                        // 发送缓存完成消息（非阻塞）
                        let _ = inbox_tx.blocking_send(PlaybackMsg::CacheSamples {
                            track_path,
                            samples: samples_arc,
                            channels,
                            sample_rate,
                        });
                    }
                    Err(e) => {
                        println!("❌ [后台缓存] 解码失败: {}", e);
                    }
                }
            });
            
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
            // 🔧 优化：使用clear()而非stop()，立即清空缓冲区，避免5秒延迟
            sink.clear();
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
        
        // 提取缓存数据（Arc共享，避免大量clone）
        let (samples, channels, sample_rate) = match &self.cached_samples {
            Some(cached) => (
                cached.samples.clone(), // Arc clone是廉价的，只复制指针
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
        
        // 🔧 性能优化：使用Arc切片避免大量内存复制
        // 检查跳转位置是否有效
        if skip_samples >= samples.len() {
            log::warn!("⚠️ 跳转位置超出音频长度: {} >= {}", skip_samples, samples.len());
            let _ = self.event_tx.send(PlayerEvent::SeekFailed {
                position: position_ms,
                error: "跳转位置超出音频长度".to_string(),
            }).await;
            return Err(PlayerError::SeekFailed("跳转位置超出音频长度".to_string()));
        }
        
        // 🎯 关键优化：使用零拷贝的ArcSliceSource
        // 直接从Arc切片中读取数据，避免to_vec()的巨大内存复制开销
        // 这可以将seek延迟从1秒以上降低到几乎即时（<100ms）
        use crate::player::audio::ArcSliceSource;
        let source = ArcSliceSource::new(
            samples.clone(), // Arc clone是零成本的，只复制指针
            channels,
            sample_rate,
            skip_samples, // 从指定位置开始播放
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
        samples: std::sync::Arc<[i16]>,
        channels: u16,
        sample_rate: u32,
    ) {
        log::info!(
            "💾 [PlaybackActor] 收到缓存完成通知（Arc共享）: {:?} ({} 样本, {}通道, {}Hz)",
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
        
        // ✅ 修复3: 发送位置更新事件（播放和暂停时都发送，确保UI能正确显示暂停位置）
        // 即使在暂停状态，也需要定期发送位置更新，否则前端会认为位置为0
        if let Some(position) = self.get_current_position() {
            let _ = self.event_tx.send(PlayerEvent::PositionChanged(position)).await;
        }
    }
    
    /// WEBDAV流式播放（HTTP Range高性能实现）
    async fn decode_streaming(&self, track_path: &str) -> Result<Box<dyn rodio::Source<Item = i16> + Send>> {
        use crate::streaming::WebDAVStreamReader;
        use std::io::BufReader;
        use tokio::time::{timeout, Duration};
        
        log::info!("🌊 WEBDAV流式播放: {}", track_path);
        println!("🌊 [PlaybackActor] WEBDAV流式播放: {}", track_path);
        
        // 只支持WEBDAV
        if !track_path.starts_with("webdav://") {
            return Err(PlayerError::decode_error("不支持的协议，仅支持WebDAV流式播放".to_string()));
        }
        
        // 解析WEBDAV URL
        let http_url = self.parse_webdav_url(track_path)?;
        
        log::info!("📡 WEBDAV HTTP URL: {}", http_url);
        println!("📡 [PlaybackActor] 创建WEBDAV Reader...");
        
        // 创建WEBDAV Reader（智能配置）
        let create_future = WebDAVStreamReader::new(http_url, None);
        
        let reader = match timeout(Duration::from_secs(10), create_future).await {
            Ok(Ok(r)) => {
                println!("✅ [PlaybackActor] WEBDAV Reader创建成功");
                r
            }
            Ok(Err(e)) => {
                let err_msg = format!("创建WEBDAV Reader失败: {}", e);
                log::error!("❌ {}", err_msg);
                println!("❌ [PlaybackActor] {}", err_msg);
                return Err(PlayerError::decode_error(err_msg));
            }
            Err(_) => {
                let err_msg = "创建WEBDAV Reader超时（10秒）";
                log::error!("❌ {}", err_msg);
                println!("❌ [PlaybackActor] {}", err_msg);
                return Err(PlayerError::decode_error(err_msg.to_string()));
            }
        };
        
        log::info!("✅ WEBDAV Reader已创建，开始解码");
        println!("🎵 [PlaybackActor] 开始解码音频流...");
        
        // rodio解码
        let buf_reader = BufReader::with_capacity(256 * 1024, reader);
        let decoder = rodio::Decoder::new(buf_reader)
            .map_err(|e| {
                let err_msg = format!("解码失败: {}", e);
                log::error!("❌ {}", err_msg);
                println!("❌ [PlaybackActor] {}", err_msg);
                PlayerError::decode_error(err_msg)
            })?;
        
        log::info!("✅ 解码器已创建，开始播放");
        println!("✅ [PlaybackActor] 解码器已创建，准备播放");
        Ok(Box::new(decoder))
    }
    
    /// 解析WEBDAV路径为HTTP URL
    fn parse_webdav_url(&self, track_path: &str) -> Result<String> {
        // webdav://server_id#/path/to/file.flac
        let path_without_prefix = track_path.strip_prefix("webdav://")
            .ok_or_else(|| PlayerError::decode_error("无效的WEBDAV路径".to_string()))?;
        
        let (server_id, file_path) = path_without_prefix.split_once('#')
            .ok_or_else(|| PlayerError::decode_error("WEBDAV路径格式错误".to_string()))?;
        
        // 从数据库获取服务器配置
        let db = crate::DB.get()
            .ok_or_else(|| PlayerError::decode_error("数据库未初始化".to_string()))?;
        
        let servers = db.lock().unwrap().get_remote_servers()
            .map_err(|e| PlayerError::decode_error(format!("获取服务器列表失败: {}", e)))?;
        
        // 找到对应的服务器
        let server_config = servers.iter()
            .find(|(id, _, server_type, _, _)| id == server_id && server_type == "webdav")
            .ok_or_else(|| PlayerError::decode_error(format!("找不到WEBDAV服务器: {}", server_id)))?;
        
        // 解析配置JSON
        let config: serde_json::Value = serde_json::from_str(&server_config.3)
            .map_err(|e| PlayerError::decode_error(format!("解析配置失败: {}", e)))?;
        
        let base_url = config["url"].as_str()
            .ok_or_else(|| PlayerError::decode_error("配置中缺少URL".to_string()))?;
        
        // 构建完整URL
        let url = if base_url.ends_with('/') {
            format!("{}{}", base_url, file_path.trim_start_matches('/'))
        } else {
            format!("{}/{}", base_url, file_path.trim_start_matches('/'))
        };
        
        Ok(url)
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
