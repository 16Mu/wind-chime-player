// 播放控制Actor
// 负责播放、暂停、停止控制、精确跳转、音量控制和位置追踪

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
    
    /// 跳转到指定位置(ms)
    Seek {
        position_ms: u64,
        reply: oneshot::Sender<Result<()>>,
    },
    
    /// 设置音量(0.0-1.0)
    SetVolume(f32),
    
    /// 获取当前播放位置(ms)
    GetPosition(oneshot::Sender<Option<u64>>),
    
    /// 后台缓存完成通知
    CacheSamples {
        track_path: String,
        samples: std::sync::Arc<[i16]>,
        channels: u16,
        sample_rate: u32,
    },
    
    /// 关闭
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

/// 缓存的音频样本数据，使用Arc避免重复拷贝
struct CachedAudioSamples {
    samples: std::sync::Arc<[i16]>,
    channels: u16,
    sample_rate: u32,
}

/// 播放控制Actor
pub struct PlaybackActor {
    inbox: mpsc::Receiver<PlaybackMsg>,
    inbox_tx: mpsc::Sender<PlaybackMsg>,
    audio_device: Option<LazyAudioDevice>,
    sink_pool: Option<SinkPool>,
    current_sink: Option<PooledSink>,
    play_start_time: Option<Instant>,
    play_start_position_ms: u64,
    state_rx: watch::Receiver<PlayerState>,
    event_tx: mpsc::Sender<PlayerEvent>,
    cached_samples: Option<CachedAudioSamples>,
    current_track_path: Option<String>,
    webdav_full_cache: Option<Vec<u8>>,
    current_track: Option<Track>,
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
            webdav_full_cache: None,
            current_track: None,
        };
        
        (actor, tx)
    }
    
    /// 使用外部接收器创建PlaybackActor
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
            webdav_full_cache: None,
            current_track: None,
        }
    }
    
    /// 运行Actor事件循环
    pub async fn run(mut self) {
        log::info!("PlaybackActor started");
        
        // Sink池延迟初始化，避免阻塞启动
        
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
                            log::info!("PlaybackActor shutdown requested");
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
                    log::warn!("PlaybackActor inbox closed");
                    break;
                }
            }
        }
        
        log::info!("PlaybackActor stopped");
    }
    
    /// 初始化Sink池
    async fn initialize_sink_pool(&mut self) -> Result<()> {
        log::info!("Initializing sink pool");
        
        let device = LazyAudioDevice::default();
        let dev = device.get_or_init().await?;
        let pool = SinkPool::with_default_capacity(dev.handle().clone());
        
        pool.warm_up(2)?;
        
        self.audio_device = Some(device);
        self.sink_pool = Some(pool);
        log::info!("Sink pool initialized");
        
        Ok(())
    }
    
    /// 清理缓存
    fn clear_cache(&mut self) {
        if self.cached_samples.is_some() || self.webdav_full_cache.is_some() {
            log::info!("Clearing track cache");
            self.cached_samples = None;
            self.webdav_full_cache = None;
        }
    }
    
    /// 处理播放请求
    async fn handle_play(&mut self, track: Track) -> Result<()> {
        use std::time::Instant;
        let start = Instant::now();
        log::info!("Playing: {:?}", track.title);
        println!("[PlaybackActor] Starting playback: {:?}", track.title);
        
        if self.current_track_path.as_ref() != Some(&track.path) {
            self.clear_cache();
        }
        
        self.current_track = Some(track.clone());
        self.current_track_path = Some(track.path.clone());
        
        if self.sink_pool.is_none() {
            let init_start = Instant::now();
            log::info!("First playback, initializing sink pool");
            println!("[PlaybackActor] Initializing sink pool");
            if let Err(e) = self.initialize_sink_pool().await {
                log::error!("Failed to initialize sink pool: {}", e);
                return Err(e);
            }
            println!("[PlaybackActor] Sink pool ready ({}ms)", init_start.elapsed().as_millis());
        }
        
        let stop_start = Instant::now();
        println!("[PlaybackActor] Stopping current playback");
        self.handle_stop();
        println!("[PlaybackActor] Stopped ({}ms)", stop_start.elapsed().as_millis());
        
        // 确保Sink池已初始化
        if self.sink_pool.is_none() {
            self.initialize_sink_pool().await?;
        }
        
        let has_cache = self.current_track_path.as_ref() == Some(&track.path) 
                        && self.cached_samples.is_some();
        
        use rodio::Source;
        let decode_start = Instant::now();
        let source: Box<dyn Source<Item = i16> + Send> = if has_cache {
            println!("[PlaybackActor] Using cached samples");
            let cached = self.cached_samples.as_ref().unwrap();
            use rodio::buffer::SamplesBuffer;
            Box::new(SamplesBuffer::new(
                cached.channels,
                cached.sample_rate,
                cached.samples.to_vec(),
            ))
        } else {
            println!("[PlaybackActor] Preparing audio");
            
            let source_result: Result<Box<dyn rodio::Source<Item = i16> + Send>> = if track.path.starts_with("webdav://") {
                println!("[PlaybackActor] WebDAV streaming playback");
                self.decode_streaming(&track.path).await
            } else {
                println!("[PlaybackActor] Decoding local file: {}", track.path);
                // 🚀 性能优化：使用spawn_blocking异步解码本地文件，避免阻塞
                let path = track.path.clone();
                tokio::task::spawn_blocking(move || {
                    let decoder = AudioDecoder::new(&path);
                    match decoder.decode() {
                        Ok(s) => {
                            println!("[PlaybackActor] Local decoder created");
                            Ok(Box::new(s) as Box<dyn rodio::Source<Item = i16> + Send>)
                        }
                        Err(e) => {
                            println!("[PlaybackActor] Decode failed: {}", e);
                            Err(e)
                        }
                    }
                })
                .await
                .map_err(|e| PlayerError::decode_error(format!("异步解码任务失败: {}", e)))?
            };
            
            match source_result {
                Ok(s) => {
                    println!("[PlaybackActor] Audio source ready ({}ms)", decode_start.elapsed().as_millis());
                    s
                }
                Err(e) => {
                    println!("[PlaybackActor] Source preparation failed: {}", e);
                    return Err(e);
                }
            }
        };
        println!("[PlaybackActor] Audio prepared ({}ms)", decode_start.elapsed().as_millis());
        
        let sink_start = Instant::now();
        println!("[PlaybackActor] Acquiring sink");
        let pool = self.sink_pool.as_ref().unwrap();
        let sink = match pool.acquire() {
            Ok(s) => {
                println!("[PlaybackActor] Sink acquired ({}ms)", sink_start.elapsed().as_millis());
                s
            }
            Err(e) => {
                println!("[PlaybackActor] Sink acquisition failed: {}", e);
                return Err(e);
            }
        };
        
        let play_start = Instant::now();
        let volume = self.state_rx.borrow().volume;
        sink.set_volume(volume);
        
        println!("[PlaybackActor] Starting playback");
        sink.append(source);
        sink.play();
        println!("[PlaybackActor] Playback started ({}ms)", play_start.elapsed().as_millis());
        
        self.current_sink = Some(sink);
        self.play_start_time = Some(Instant::now());
        self.play_start_position_ms = 0;
        
        println!("[PlaybackActor] Play complete ({}ms)", start.elapsed().as_millis());
        
        if !has_cache && track.path.starts_with("webdav://") {
            println!("[PlaybackActor] Starting background download for seek support");
            let track_path = track.path.clone();
            let inbox_tx = self.inbox_tx.clone();
            
            tokio::task::spawn(async move {
                println!("[Background] Downloading WebDAV file");
                
                // TODO: Implement WebDAV full download
                println!("[Background] WebDAV full download not yet implemented");
                
                let _ = inbox_tx;
                let _ = track_path;
            });
        } else if !has_cache {
            println!("[PlaybackActor] Local file uses hybrid player");
        }
        
        log::info!("Sending TrackChanged event");
        let _ = self.event_tx.send(PlayerEvent::TrackChanged(Some(track))).await;
        
        log::info!("Playback started successfully");
        Ok(())
    }
    
    /// 处理暂停
    fn handle_pause(&mut self) {
        if let Some(sink) = &self.current_sink {
            log::info!("Pausing playback");
            sink.pause();
            
            if let Some(position) = self.get_current_position() {
                self.play_start_position_ms = position;
            }
            self.play_start_time = None;
        }
    }
    
    /// 处理恢复
    fn handle_resume(&mut self) {
        if let Some(sink) = &self.current_sink {
            log::info!("Resuming playback");
            sink.play();
            
            self.play_start_time = Some(Instant::now());
        }
    }
    
    /// 处理停止
    fn handle_stop(&mut self) {
        if let Some(sink) = self.current_sink.take() {
            log::info!("Stopping playback");
            sink.clear();
        }
        
        self.play_start_time = None;
        self.play_start_position_ms = 0;
    }
    
    /// 处理跳转，需要缓存支持
    async fn handle_seek(&mut self, position_ms: u64) -> Result<()> {
        let seek_start = Instant::now();
        log::info!("Seeking to: {}ms", position_ms);
        
        // 提取缓存数据（Arc共享，避免大量clone）
        let (samples, channels, sample_rate) = match &self.cached_samples {
            Some(cached) => (
                cached.samples.clone(), // Arc clone是廉价的，只复制指针
                cached.channels,
                cached.sample_rate,
            ),
            None => {
                log::warn!("⚠️ 没有缓存的样本数据，seek暂时不可用（等待后台缓存中...）");
                return Err(PlayerError::Internal("音频尚未缓存完成，请稍后再试".to_string()));
            }
        };
        
        // 确保Sink池已初始化
        if self.sink_pool.is_none() {
            log::info!("🎯 Sink池未初始化，开始初始化...");
            if let Err(e) = self.initialize_sink_pool().await {
                log::error!("❌ 初始化Sink池失败: {}", e);
                return Err(e);
            }
        }
        
        // 停止当前播放
        self.handle_stop();
        
        // 计算需要跳过的样本数
        let samples_per_ms = sample_rate as u64 * channels as u64 / 1000;
        let skip_samples = (position_ms * samples_per_ms) as usize;
        
        // 检查跳转位置是否有效
        if skip_samples >= samples.len() {
            log::warn!("⚠️ 跳转位置超出音频长度: {} >= {}", skip_samples, samples.len());
            return Err(PlayerError::Internal("跳转位置超出音频长度".to_string()));
        }
        
        // 🎯 创建音频源（从指定位置开始）
        use rodio::buffer::SamplesBuffer;
        let remaining_samples: Vec<i16> = samples.iter().skip(skip_samples).copied().collect();
        let source = SamplesBuffer::new(channels, sample_rate, remaining_samples);
        
        // 从池中获取新的Sink
        let pool = self.sink_pool.as_ref().unwrap();
        let sink = pool.acquire()?;
        
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
        log::info!("⚡ Seek完成: {}ms (耗时: {}ms)", position_ms, elapsed_ms);
        
        // 发送跳转完成事件
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
    
    /// WEBDAV流式播放（真正的即点即播）
    async fn decode_streaming(&self, track_path: &str) -> Result<Box<dyn rodio::Source<Item = i16> + Send>> {
        use crate::streaming::SimpleHttpReader;
        use tokio::time::{timeout, Duration};
        use symphonia::core::io::MediaSourceStream;
        use symphonia::core::probe::Hint;
        use crate::player::audio::SymphoniaDecoder;
        
        log::info!("🌊 WEBDAV流式播放: {}", track_path);
        println!("🌊 [PlaybackActor] WEBDAV流式播放（真正的流式解码）: {}", track_path);
        
        // 只支持WEBDAV
        if !track_path.starts_with("webdav://") {
            return Err(PlayerError::decode_error("不支持的协议，仅支持WebDAV流式播放".to_string()));
        }
        
        // 解析WEBDAV URL（包含完整配置）
        let (http_url, username, password, _http_protocol) = self.parse_webdav_url_with_config(track_path)?;
        
        log::info!("📡 HTTP URL: {}", http_url);
        println!("📡 [PlaybackActor] 创建HTTP流式Reader（即点即播模式）...");
        
        // 🚀 创建SimpleHttpReader（零等待，立即返回）
        let create_future = SimpleHttpReader::new(http_url.clone(), username, password);
        
        let reader = match timeout(Duration::from_secs(5), create_future).await {
            Ok(Ok(r)) => {
                println!("✅ [PlaybackActor] HTTP Reader创建成功（零延迟）");
                r
            }
            Ok(Err(e)) => {
                let err_msg = format!("创建HTTP Reader失败: {}", e);
                log::error!("❌ {}", err_msg);
                println!("❌ [PlaybackActor] {}", err_msg);
                return Err(PlayerError::decode_error(err_msg));
            }
            Err(_) => {
                let err_msg = "创建HTTP Reader超时（5秒）";
                log::error!("❌ {}", err_msg);
                println!("❌ [PlaybackActor] {}", err_msg);
                return Err(PlayerError::decode_error(err_msg.to_string()));
            }
        };
        
        log::info!("✅ HTTP Reader已创建，等待初始缓冲...");
        println!("🎵 [PlaybackActor] 等待初始缓冲（提升播放流畅度）...");
        
        // 🔧 等待初始缓冲（256KB），确保格式探测不会因网络延迟而卡顿
        const INITIAL_BUFFER_SIZE: usize = 256 * 1024; // 256KB
        let buffer_timeout = Duration::from_secs(3);
        let buffer_start = std::time::Instant::now();
        
        loop {
            let available = reader.get_buffered_size();
            
            if available >= INITIAL_BUFFER_SIZE {
                log::info!("✅ 初始缓冲完成: {}KB", available / 1024);
                println!("✅ [PlaybackActor] 初始缓冲完成: {}KB", available / 1024);
                break;
            }
            
            if buffer_start.elapsed() > buffer_timeout {
                log::warn!("⚠️ 初始缓冲超时（仅缓冲了{}KB），继续播放", available / 1024);
                println!("⚠️ [PlaybackActor] 初始缓冲超时（仅缓冲了{}KB），继续播放", available / 1024);
                break;
            }
            
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        
        log::info!("🎵 使用SymphoniaDecoder进行真正的流式解码");
        println!("🎵 [PlaybackActor] 使用SymphoniaDecoder（真正的流式，不等待metadata）...");
        
        // 🔥 P0-4修复: 使用SymphoniaDecoder替代rodio::Decoder
        // Symphonia支持真正的流式播放，不需要预先读取完整metadata
        
        // 1. 包装为MediaSourceStream
        let mss = MediaSourceStream::new(Box::new(reader), Default::default());
        
        // 2. 探测格式（提供扩展名提示加速探测）
        let mut hint = Hint::new();
        // 从URL提取文件扩展名
        if let Some(ext) = http_url.split('.').last() {
            let ext_lower = ext.split('?').next().unwrap_or(ext).to_lowercase();
            hint.with_extension(&ext_lower);
            log::info!("🔍 文件扩展名提示: {}", ext_lower);
        }
        
        let probe_result = symphonia::default::get_probe()
            .format(&hint, mss, &Default::default(), &Default::default())
            .map_err(|e| {
                let err_msg = format!("格式探测失败: {}", e);
                log::error!("❌ {}", err_msg);
                println!("❌ [PlaybackActor] {}", err_msg);
                PlayerError::decode_error(err_msg)
            })?;
        
        let format = probe_result.format;
        
        // 3. 选择音轨
        let track = format.tracks()
            .iter()
            .find(|t| t.codec_params.codec != symphonia::core::codecs::CODEC_TYPE_NULL)
            .ok_or_else(|| {
                let err_msg = "没有找到有效音轨";
                log::error!("❌ {}", err_msg);
                println!("❌ [PlaybackActor] {}", err_msg);
                PlayerError::decode_error(err_msg.to_string())
            })?;
        
        let track_id = track.id;
        
        log::info!("✅ 找到音轨: ID={}, 编解码器={:?}", track_id, track.codec_params.codec);
        
        // 4. 创建解码器
        let decoder = symphonia::default::get_codecs()
            .make(&track.codec_params, &Default::default())
            .map_err(|e| {
                let err_msg = format!("创建解码器失败: {}", e);
                log::error!("❌ {}", err_msg);
                println!("❌ [PlaybackActor] {}", err_msg);
                PlayerError::decode_error(err_msg)
            })?;
        
        // 5. 使用 SymphoniaDecoder（真正的流式）
        let symphonia_decoder = SymphoniaDecoder::new(
            format,
            decoder,
            track_id
        );
        
        log::info!("✅ SymphoniaDecoder创建成功，真正的流式播放已启动");
        println!("✅ [PlaybackActor] SymphoniaDecoder创建成功（真正的流式播放）！");
        Ok(Box::new(symphonia_decoder))
    }
    
    /// 解析WEBDAV路径为HTTP URL（包含完整配置）
    fn parse_webdav_url_with_config(&self, track_path: &str) -> Result<(String, String, String, crate::webdav::types::HttpProtocolPreference)> {
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
        
        // 解析配置JSON为WebDAVConfig
        use crate::webdav::types::WebDAVConfig;
        let webdav_config: WebDAVConfig = serde_json::from_str(&server_config.3)
            .map_err(|e| PlayerError::decode_error(format!("解析配置失败: {}", e)))?;
        
        // 使用WebDAVConfig的build_full_url方法
        let url = webdav_config.build_full_url(file_path);
        
        // 返回URL、认证信息和HTTP协议偏好
        Ok((url, webdav_config.username, webdav_config.password, webdav_config.http_protocol))
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
