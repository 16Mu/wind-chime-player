use crossbeam_channel::{unbounded, Receiver, Sender};
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use std::fs::File;
use std::io::BufReader;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: i64,
    pub path: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration_ms: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub album_cover_data: Option<Vec<u8>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub album_cover_mime: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlayerState {
    pub is_playing: bool,
    pub current_track: Option<Track>,
    pub position_ms: u64,
    pub volume: f32,
    pub repeat_mode: RepeatMode,
    pub shuffle: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RepeatMode {
    Off,
    All,
    One,
}

#[derive(Debug)]
pub enum PlayerCommand {
    Play(i64),           // track_id
    Pause,
    Resume,
    Stop,
    Seek(u64),          // position_ms
    Next,
    Previous,
    SetVolume(f32),     // 0.0 - 1.0
    SetRepeatMode(RepeatMode),
    SetShuffle(bool),
    LoadPlaylist(Vec<Track>),
}

#[derive(Debug, Clone, Serialize)]
pub enum PlayerEvent {
    StateChanged(PlayerState),
    TrackChanged(Option<Track>),
    PositionChanged(u64),
    PlaybackError(String),
    TrackCompleted(Track),
    PlaylistCompleted,
}

pub struct Player {
    command_rx: Receiver<PlayerCommand>,
    event_tx: Sender<PlayerEvent>,
    state: Arc<Mutex<PlayerState>>,
    playlist: Arc<Mutex<VecDeque<Track>>>,
    current_index: Arc<Mutex<Option<usize>>>,
    stream_handle: OutputStreamHandle,
    sink: Arc<Mutex<Option<Sink>>>,
    playback_start_time: Arc<Mutex<Option<Instant>>>,
    seek_offset: Arc<Mutex<u64>>, // 记录seek偏移量
}

impl Player {
    /// 初始化音频输出，包含错误处理和重试机制
    fn initialize_audio_output() -> Result<(OutputStream, OutputStreamHandle)> {
        log::info!("Initializing audio output...");
        
        // 尝试使用默认音频设备，并验证能够创建sink
        match OutputStream::try_default() {
            Ok((stream, handle)) => {
                log::info!("Default audio output created, testing sink creation...");
                
                // 立即测试是否能创建sink
                match Sink::try_new(&handle) {
                    Ok(_test_sink) => {
                        log::info!("✅ Successfully verified default audio output with working sink");
                        return Ok((stream, handle));
                    }
                    Err(e) => {
                        log::warn!("❌ Default audio output created but cannot create sink: {}", e);
                        // 不要返回这个不工作的handle，继续尝试其他设备
                    }
                }
            }
            Err(e) => {
                log::warn!("Failed to initialize default audio output: {}", e);
            }
        }
        
        // 如果默认设备失败，尝试枚举所有可用设备
        log::info!("Attempting to enumerate available audio devices...");
        
        #[cfg(target_os = "windows")]
        {
            // Windows特定的音频设备处理
            match Self::try_windows_audio_devices() {
                Ok((stream, handle)) => return Ok((stream, handle)),
                Err(e) => log::warn!("Windows audio device enumeration failed: {}", e),
            }
        }
        
        #[cfg(not(target_os = "windows"))]
        {
            // 其他平台的音频设备处理
            match Self::try_alternative_audio_devices() {
                Ok((stream, handle)) => return Ok((stream, handle)),
                Err(e) => log::warn!("Alternative audio device detection failed: {}", e),
            }
        }
        
        // 最后尝试：创建一个静默输出（用于测试和开发）
        log::warn!("All audio device initialization attempts failed, creating silent output");
        Self::create_silent_output()
    }
    
    #[cfg(target_os = "windows")]
    fn try_windows_audio_devices() -> Result<(OutputStream, OutputStreamHandle)> {
        log::info!("Trying Windows audio devices using CPAL enumeration...");
        
        // 使用CPAL枚举音频设备
        use cpal::traits::{DeviceTrait, HostTrait};
        
        // 尝试不同的音频主机
        let available_hosts = cpal::available_hosts();
        log::info!("Available audio hosts: {:?}", available_hosts);
        
        for host_id in available_hosts {
            log::info!("Trying audio host: {:?}", host_id);
            
            match cpal::host_from_id(host_id) {
                Ok(host) => {
                    // 尝试获取默认输出设备
                    if let Some(device) = host.default_output_device() {
                        log::info!("Found default output device: {:?}", device.name());
                        
                        // 尝试使用该设备创建OutputStream
                        match OutputStream::try_from_device(&device) {
                            Ok((stream, handle)) => {
                                if let Ok(device_name) = device.name() {
                                    log::info!("OutputStream created from device {}, testing sink...", device_name);
                                    
                                    // 立即验证能否创建sink
                                    match Sink::try_new(&handle) {
                                        Ok(_test_sink) => {
                                            log::info!("✅ Successfully verified device {} with working sink", device_name);
                                            return Ok((stream, handle));
                                        }
                                        Err(e) => {
                                            log::warn!("❌ Device {} OutputStream created but sink failed: {}", device_name, e);
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                log::warn!("Failed to create OutputStream from device {:?}: {}", device.name(), e);
                            }
                        }
                    }
                    
                    // 如果默认设备失败，尝试枚举所有输出设备
                    match host.output_devices() {
                        Ok(devices) => {
                            for device in devices {
                                if let Ok(device_name) = device.name() {
                                    log::info!("Trying output device: {}", device_name);
                                    
                                    match OutputStream::try_from_device(&device) {
                                        Ok((stream, handle)) => {
                                            log::info!("OutputStream created from device {}, testing sink...", device_name);
                                            
                                            // 立即验证能否创建sink
                                            match Sink::try_new(&handle) {
                                                Ok(_test_sink) => {
                                                    log::info!("✅ Successfully verified device {} with working sink", device_name);
                                                    return Ok((stream, handle));
                                                }
                                                Err(e) => {
                                                    log::warn!("❌ Device {} OutputStream created but sink failed: {}", device_name, e);
                                                }
                                            }
                                        }
                                        Err(e) => {
                                            log::warn!("Failed to create OutputStream from device {}: {}", device_name, e);
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            log::warn!("Failed to enumerate output devices for host {:?}: {}", host_id, e);
                        }
                    }
                }
                Err(e) => {
                    log::warn!("Failed to get host {:?}: {}", host_id, e);
                }
            }
        }
        
        Err(anyhow::anyhow!("All Windows audio devices failed to initialize"))
    }
    
    #[cfg(not(target_os = "windows"))]
    fn try_alternative_audio_devices() -> Result<(OutputStream, OutputStreamHandle)> {
        // 非Windows平台的处理
        log::info!("Trying alternative audio backends...");
        
        // 可以在这里尝试不同的音频配置
        Err(anyhow::anyhow!("Alternative audio handling not implemented"))
    }
    
    fn create_silent_output() -> Result<(OutputStream, OutputStreamHandle)> {
        log::warn!("Creating silent audio output for fallback");
        
        // 最后一次尝试默认设备，使用强制初始化
        match OutputStream::try_default() {
            Ok((stream, handle)) => {
                log::info!("Default device worked on final attempt");
                return Ok((stream, handle));
            }
            Err(e) => {
                log::warn!("Final default device attempt failed: {}", e);
            }
        }
        
        // 尝试使用CPAL直接创建最基础的音频流
        log::info!("Attempting to create basic audio stream using CPAL...");
        
        use cpal::traits::{DeviceTrait, HostTrait};
        
        let host = cpal::default_host();
        if let Some(device) = host.default_output_device() {
            if let Ok(name) = device.name() {
                log::info!("Trying basic stream with device: {}", name);
                
                // 尝试获取设备的默认配置
                if let Ok(config) = device.default_output_config() {
                    log::info!("Device default config: {:?}", config);
                    
                    // 尝试用更简单的方法创建OutputStream
                    if let Ok((stream, handle)) = OutputStream::try_from_device_config(&device, config) {
                        log::info!("OutputStream created using device config, testing sink...");
                        
                        // 立即验证能否创建sink
                        match Sink::try_new(&handle) {
                            Ok(_test_sink) => {
                                log::info!("✅ Successfully verified device config with working sink");
                                return Ok((stream, handle));
                            }
                            Err(e) => {
                                log::warn!("❌ Device config OutputStream created but sink failed: {}", e);
                            }
                        }
                    }
                }
            }
        }
        
        // 最终fallback - 返回详细错误信息
        Err(anyhow::anyhow!(
            "无法初始化任何音频输出设备。请检查以下项目:\n\
            1) 确认音频设备正确连接（耳机/扬声器）\n\
            2) 验证Windows音频服务是否正在运行\n\
            3) 检查Windows声音设置中的默认播放设备\n\
            4) 确保没有其他应用程序独占音频设备\n\
            5) 尝试重新连接音频设备（耳机/扬声器）\n\
            6) 检查Windows设备管理器中音频驱动状态\n\
            7) 考虑重启应用程序或系统\n\
            \n如果问题持续存在，请在Windows声音设置中播放测试音频确认硬件工作正常。"
        ))
    }

    pub fn new() -> Result<(Self, Sender<PlayerCommand>, Receiver<PlayerEvent>, OutputStream)> {
        let (command_tx, command_rx) = unbounded();
        let (event_tx, event_rx) = unbounded();

        // Initialize audio output with retry mechanism
        let (stream, stream_handle) = Self::initialize_audio_output()?;

        let state = Arc::new(Mutex::new(PlayerState {
            is_playing: false,
            current_track: None,
            position_ms: 0,
            volume: 1.0,
            repeat_mode: RepeatMode::Off,
            shuffle: false,
        }));

        let player = Player {
            command_rx,
            event_tx,
            state,
            playlist: Arc::new(Mutex::new(VecDeque::new())),
            current_index: Arc::new(Mutex::new(None)),
            stream_handle,
            sink: Arc::new(Mutex::new(None)),
            playback_start_time: Arc::new(Mutex::new(None)),
            seek_offset: Arc::new(Mutex::new(0)),
        };

        Ok((player, command_tx, event_rx, stream))
    }
    
    /// 测试音频系统 - 播放一个简短的测试音调
    fn test_audio_system(&self) -> Result<()> {
        log::info!("Testing audio system...");
        
        // 创建一个简单的测试sink
        match Sink::try_new(&self.stream_handle) {
            Ok(test_sink) => {
                log::info!("Test sink created successfully");
                
                // 生成一个440Hz的测试音调，持续500ms
                use rodio::source::{SineWave, Source};
                use std::time::Duration;
                
                let source = SineWave::new(440.0)
                    .take_duration(Duration::from_millis(500))
                    .amplify(0.1);
                
                test_sink.append(source);
                test_sink.play();
                
                // 等待播放完成
                std::thread::sleep(Duration::from_millis(600));
                
                log::info!("Audio test completed successfully");
                Ok(())
            }
            Err(e) => {
                log::error!("Audio test failed - could not create test sink: {}", e);
                Err(anyhow::anyhow!("音频测试失败: {}", e))
            }
        }
    }
    
    /// 创建音频sink，包含智能重试和fallback机制
    fn create_audio_sink(&self) -> Result<Sink> {
        log::info!("Creating audio sink...");
        
        // 详细记录当前音频状态
        log::info!("Current audio diagnostics: {}", self.get_audio_troubleshooting_info());
        
        // 第一次尝试：使用现有的stream_handle
        log::info!("Attempting to create sink with current stream_handle...");
        match Sink::try_new(&self.stream_handle) {
            Ok(sink) => {
                log::info!("✅ Successfully created sink on first attempt");
                // 立即测试sink是否真的可用
                if sink.empty() {
                    log::info!("✅ Sink is empty and ready for audio");
                } else {
                    log::warn!("Sink is not empty - may have residual audio");
                }
                return Ok(sink);
            }
            Err(e) => {
                log::error!("❌ First attempt to create sink failed: {}", e);
                
                // 分析失败原因
                match e.to_string().as_str() {
                    s if s.contains("NoDevice") => {
                        log::error!("❌ No audio device available - this should not happen if device detection succeeded");
                    }
                    s if s.contains("DeviceNotAvailable") => {
                        log::error!("❌ Audio device not available - device may have been disconnected");
                    }
                    s if s.contains("InvalidStreamConfig") => {
                        log::error!("❌ Invalid stream configuration - audio format mismatch");
                    }
                    _ => {
                        log::error!("❌ Unknown sink creation error: {}", e);
                    }
                }
            }
        }
        
        // 第二次尝试：等待后重试
        log::info!("Waiting 200ms before retry...");
        std::thread::sleep(Duration::from_millis(200));
        
        match Sink::try_new(&self.stream_handle) {
            Ok(sink) => {
                log::info!("Successfully created sink on second attempt");
                return Ok(sink);
            }
            Err(e) => {
                log::warn!("Second attempt to create sink failed: {}", e);
            }
        }
        
        // 第三次尝试：强制重新初始化整个音频系统
        log::error!("🔄 All sink creation attempts with existing stream failed, forcing audio reinitialization...");
        
        match Self::initialize_audio_output() {
            Ok((fresh_stream, fresh_handle)) => {
                log::info!("✅ Successfully reinitialized audio output");
                
                match Sink::try_new(&fresh_handle) {
                    Ok(sink) => {
                        log::info!("✅ Successfully created sink with reinitialized audio system");
                        
                        // 警告：这是一个临时的内存泄漏解决方案
                        // 在程序正常关闭时，操作系统会回收这些资源
                        // 但这可能导致异常退出代码，需要后续架构改进
                        std::mem::forget(fresh_stream);
                        log::warn!("临时泄漏 OutputStream 内存以保持音频可用 - 可能影响程序退出代码");
                        
                        return Ok(sink);
                    }
                    Err(e) => {
                        log::error!("❌ Even reinitialized audio system cannot create sink: {}", e);
                    }
                }
            }
            Err(e) => {
                log::error!("❌ Failed to reinitialize audio output: {}", e);
            }
        }
        
        // 第四次尝试：跳过有问题的替代配置方法
        // 注意：create_sink_with_alternative_config 有stream生命周期问题
        // 会导致sink创建成功但没有声音输出
        log::warn!("Skipping alternative audio configurations due to stream lifecycle issues");
        
        // 最终失败，返回详细错误信息
        let diagnostic_info = self.get_audio_troubleshooting_info();
        Err(anyhow::anyhow!(
            "无法创建音频sink - 所有尝试均失败。{}", 
            diagnostic_info
        ))
    }
    
    /// 创建新的音频流和handle
    fn create_fresh_audio_stream() -> Result<(OutputStreamHandle, OutputStream)> {
        // 尝试重新初始化音频输出
        match Self::initialize_audio_output() {
            Ok((stream, handle)) => Ok((handle, stream)),
            Err(e) => Err(anyhow::anyhow!("Failed to create fresh audio stream: {}", e))
        }
    }
    
    /// 使用替代配置创建sink
    fn create_sink_with_alternative_config() -> Result<Sink> {
        use cpal::traits::{DeviceTrait, HostTrait};
        
        let host = cpal::default_host();
        if let Some(device) = host.default_output_device() {
            // 尝试获取不同的配置
            if let Ok(configs) = device.supported_output_configs() {
                for (i, orig_config) in configs.take(3).enumerate() { // 尝试前3个配置
                    let config = orig_config.with_max_sample_rate();
                    log::info!("Trying alternative config {}: {:?}", i + 1, config);
                    
                    if let Ok((stream, handle)) = OutputStream::try_from_device_config(&device, config) {
                        if let Ok(sink) = Sink::try_new(&handle) {
                            log::info!("Successfully created sink with alternative config {}", i + 1);
                            // 将stream转移到一个长期存储位置，而不是直接丢弃
                            // 这是一个临时解决方案，理想情况下应该重构Player结构来持有多个stream
                            std::mem::forget(stream); // 暂时保持现有逻辑
                            log::warn!("Using alternative config with potential stream lifecycle issue");
                            return Ok(sink);
                        }
                    }
                }
            }
        }
        
        Err(anyhow::anyhow!("No alternative configurations worked"))
    }
    
    /// 解码音频文件，包含重试机制和错误处理
    fn decode_audio_file(&self, path: &std::path::Path, extension: &str) -> Result<Decoder<BufReader<File>>> {
        log::info!("Decoding audio file: {:?} (format: {})", path, extension);
        
        // 第一次尝试
        match self.try_decode_file(path) {
            Ok(decoder) => {
                log::info!("Audio file decoded successfully on first attempt");
                return Ok(decoder);
            }
            Err(e) => {
                log::warn!("First decode attempt failed: {}", e);
            }
        }
        
        // 等待后重试
        std::thread::sleep(Duration::from_millis(100));
        log::info!("Retrying audio file decode...");
        
        match self.try_decode_file(path) {
            Ok(decoder) => {
                log::info!("Audio file decoded successfully on retry");
                return Ok(decoder);
            }
            Err(e) => {
                return Err(anyhow::anyhow!(
                    "音频文件解码失败: {} - 可能原因:\n\
                    1) 文件损坏或不完整\n\
                    2) 不支持的音频编码格式\n\
                    3) 文件正被其他程序占用\n\
                    4) 磁盘读取错误\n\
                    请检查文件完整性或尝试播放其他文件。", 
                    e
                ));
            }
        }
    }
    
    /// 尝试解码文件的底层实现
    fn try_decode_file(&self, path: &std::path::Path) -> Result<Decoder<BufReader<File>>> {
        let file = File::open(path)
            .map_err(|e| anyhow::anyhow!("无法打开文件: {}", e))?;
            
        Decoder::new(BufReader::new(file))
            .map_err(|e| anyhow::anyhow!("解码失败: {}", e))
    }
    
    /// 安全地启动播放，包含错误处理
    fn start_playback_safely(&self, sink: &Sink, source: Decoder<BufReader<File>>, _track: &Track, _extension: &str) -> Result<()> {
        log::info!("Starting playback safely...");
        
        // 检查sink状态
        if sink.empty() {
            log::info!("Sink is empty, appending audio source...");
        } else {
            log::warn!("Sink is not empty, clearing first...");
            sink.stop();
            std::thread::sleep(Duration::from_millis(50));
        }
        
        // 尝试添加音频源
        match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            sink.append(source);
        })) {
            Ok(_) => {
                log::info!("Audio source appended successfully");
            }
            Err(_) => {
                return Err(anyhow::anyhow!("添加音频源时发生内部错误"));
            }
        }
        
        // 尝试开始播放
        match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            sink.play();
        })) {
            Ok(_) => {
                log::info!("Playback started successfully");
                
                // 验证播放状态
                std::thread::sleep(Duration::from_millis(100));
                
                if sink.is_paused() {
                    log::warn!("Sink is paused after play command, attempting to resume...");
                    sink.play();
                }
                
                Ok(())
            }
            Err(_) => {
                return Err(anyhow::anyhow!("启动播放时发生内部错误"));
            }
        }
    }
    
    /// 获取音频故障排除信息和设备状态
    fn get_audio_troubleshooting_info(&self) -> String {
        let mut info = String::new();
        info.push_str("音频设备诊断: ");
        
        // 获取CPAL设备信息
        use cpal::traits::{DeviceTrait, HostTrait};
        
        let host = cpal::default_host();
        
        // 检查默认输出设备
        match host.default_output_device() {
            Some(device) => {
                match device.name() {
                    Ok(name) => {
                        info.push_str(&format!("找到设备'{}' - ", name));
                        
                        // 测试设备是否真的可用（能创建sink）
                        match OutputStream::try_from_device(&device) {
                            Ok((_, handle)) => {
                                match Sink::try_new(&handle) {
                                    Ok(_) => {
                                        info.push_str("设备完全可用 | ");
                                    }
                                    Err(e) => {
                                        info.push_str(&format!("设备部分可用但sink失败({}) | ", e));
                                    }
                                }
                            }
                            Err(e) => {
                                info.push_str(&format!("设备不可用({}) | ", e));
                            }
                        }
                    }
                    Err(e) => {
                        info.push_str(&format!("设备名称获取失败({}) | ", e));
                    }
                }
            }
            None => {
                info.push_str("未找到默认设备 | ");
            }
        }
        
        // 统计可用设备数量
        match host.output_devices() {
            Ok(devices) => {
                let count = devices.count();
                info.push_str(&format!("系统共有{}个输出设备", count));
            }
            Err(e) => {
                info.push_str(&format!("设备枚举失败({})", e));
            }
        }
        
        info
    }

    pub fn run(self) {
        thread::spawn(move || {
            log::info!("Player thread started");
            
            loop {
                // Handle commands with timeout to allow periodic updates
                match self.command_rx.recv_timeout(Duration::from_millis(100)) {
                    Ok(command) => {
                        if let Err(e) = self.handle_command(command) {
                            log::error!("Error handling player command: {}", e);
                            let _ = self.event_tx.send(PlayerEvent::PlaybackError(e.to_string()));
                        }
                    }
                    Err(crossbeam_channel::RecvTimeoutError::Timeout) => {
                        // Periodic update - check position, etc.
                        self.update_position();
                    }
                    Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                        log::info!("Player command channel disconnected, stopping player thread");
                        break;
                    }
                }
            }
        });
    }

    fn handle_command(&self, command: PlayerCommand) -> Result<()> {
        log::info!("📨 收到播放器命令: {:?}", std::mem::discriminant(&command));
        match command {
            PlayerCommand::Play(track_id) => {
                log::info!("开始播放曲目 ID: {}", track_id);
                match self.play_track_by_id(track_id) {
                    Ok(_) => {
                        log::info!("✅ 播放曲目成功: {}", track_id);
                    }
                    Err(e) => {
                        log::error!("❌ 播放曲目失败: {} - {}", track_id, e);
                        let _ = self.event_tx.send(PlayerEvent::PlaybackError(e.to_string()));
                        return Err(e);
                    }
                }
            }
            PlayerCommand::Pause => {
                self.pause()?;
            }
            PlayerCommand::Resume => {
                self.resume()?;
            }
            PlayerCommand::Stop => {
                self.stop()?;
            }
            PlayerCommand::Seek(position_ms) => {
                self.seek(position_ms)?;
            }
            PlayerCommand::Next => {
                self.next_track()?;
            }
            PlayerCommand::Previous => {
                self.previous_track()?;
            }
            PlayerCommand::SetVolume(volume) => {
                self.set_volume(volume)?;
            }
            PlayerCommand::SetRepeatMode(mode) => {
                self.set_repeat_mode(mode)?;
            }
            PlayerCommand::SetShuffle(shuffle) => {
                self.set_shuffle(shuffle)?;
            }
            PlayerCommand::LoadPlaylist(tracks) => {
                self.load_playlist(tracks)?;
            }
        }
        Ok(())
    }

    fn play_track_by_id(&self, track_id: i64) -> Result<()> {
        let playlist = self.playlist.lock().unwrap();
        log::info!("在播放列表中查找曲目 ID: {}, 播放列表长度: {}", track_id, playlist.len());
        
        // 调试：列出播放列表中的所有曲目ID
        if playlist.is_empty() {
            log::error!("❌ 播放列表为空！无法播放任何曲目");
            drop(playlist);
            return Err(anyhow::anyhow!("播放列表为空，无法播放曲目"));
        }
        
        log::info!("播放列表曲目IDs: {:?}", 
            playlist.iter().take(10).map(|t| t.id).collect::<Vec<_>>());
        
        if let Some((index, track)) = playlist.iter().enumerate().find(|(_, t)| t.id == track_id) {
            log::info!("✅ 找到曲目 ID: {} 在索引: {}, 曲目: {}", 
                track_id, index, track.title.as_deref().unwrap_or("未知标题"));
            drop(playlist);
            self.play_track_at_index(index)?;
        } else {
            log::error!("❌ 未在播放列表中找到曲目 ID: {}", track_id);
            drop(playlist);
            return Err(anyhow::anyhow!("曲目未在播放列表中找到: {}", track_id));
        }
        Ok(())
    }

    fn play_track_at_index(&self, index: usize) -> Result<()> {
        let playlist = self.playlist.lock().unwrap();
        if let Some(track) = playlist.get(index) {
            let track = track.clone();
            drop(playlist);

            log::info!("Playing track: {} - {}", track.title.as_deref().unwrap_or("Unknown"), track.path);

            // Stop current playback
            {
                let mut sink = self.sink.lock().unwrap();
                if let Some(current_sink) = sink.take() {
                    current_sink.stop();
                }
            }

            // Create new sink and load audio file
            let new_sink = self.create_audio_sink()
                .map_err(|e| anyhow::anyhow!("Failed to create audio sink: {}. {}", e, self.get_audio_troubleshooting_info()))?;

            // Load and play the audio file
            log::info!("尝试打开音频文件: {}", track.path);
            log::info!("当前播放曲目信息: ID={}, 标题={}, 艺术家={}", 
                track.id, 
                track.title.as_deref().unwrap_or("未知"), 
                track.artist.as_deref().unwrap_or("未知"));
            
            // 标准化文件路径，处理Windows路径和中文字符
            let path = std::path::Path::new(&track.path);
            let canonical_path = path.canonicalize()
                .unwrap_or_else(|_| path.to_path_buf());
            
            log::info!("Canonical path: {:?}", canonical_path);
            
            // Check if file exists
            if !canonical_path.exists() {
                return Err(anyhow::anyhow!("Audio file does not exist: {:?}", canonical_path));
            }
            
            // Check file extension for supported formats
            let extension = canonical_path.extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or("")
                .to_lowercase();
            
            log::info!("File extension: {}", extension);
            
            // 支持的音频格式 - 使用rodio + symphonia的全格式支持
            let supported_formats = [
                // 常见无损格式
                "flac", "wav", "aiff", "aif", "aifc",
                // 常见有损格式  
                "mp3", "aac", "m4a", "ogg", "oga", "opus",
                // 其他格式
                "wma", "ape", "tak", "tta", "dsd", "dsf", "dff",
                // 模块音乐格式
                "mod", "it", "s3m", "xm",
                // 其他无损格式
                "alac", "wv", "mka"
            ];
            
            if !supported_formats.contains(&extension.as_str()) {
                return Err(anyhow::anyhow!("Unsupported audio format: {} (supported: {})", 
                                         extension, supported_formats.join(", ")));
            }
            
            log::info!("File exists and format supported, attempting to decode...");
            
            // 尝试解码音频文件，包含重试机制
            log::info!("开始解码音频文件: {:?}", canonical_path);
            let source = match self.decode_audio_file(&canonical_path, &extension) {
                Ok(source) => {
                    log::info!("✅ 音频文件解码成功");
                    source
                }
                Err(e) => {
                    log::error!("❌ 音频文件解码失败: {}", e);
                    let _ = self.event_tx.send(PlayerEvent::PlaybackError(format!("音频解码失败: {}", e)));
                    return Err(e);
                }
            };

            log::info!("音频文件解码成功，开始启动播放...");
            
            // 安全地启动播放
            log::info!("开始安全启动播放...");
            match self.start_playback_safely(&new_sink, source, &track, &extension) {
                Ok(_) => {
                    log::info!("✅ 播放启动成功: {} ({})", 
                              track.title.as_deref().unwrap_or("未知标题"), extension);
                }
                Err(e) => {
                    log::error!("❌ 播放启动失败: {} - 文件: {} ({})", 
                        e, 
                        track.title.as_deref().unwrap_or("未知曲目"), 
                        extension);
                    let error_msg = format!("播放启动失败: {} - 文件: {} ({})", 
                        e, 
                        track.title.as_deref().unwrap_or("未知曲目"), 
                        extension);
                    let _ = self.event_tx.send(PlayerEvent::PlaybackError(error_msg.clone()));
                    return Err(anyhow::anyhow!(error_msg));
                }
            }

            // Update sink
            log::info!("更新音频sink...");
            {
                let mut sink = self.sink.lock().unwrap();
                *sink = Some(new_sink);
            }

            // Record playback start time and reset seek offset
            log::info!("设置播放开始时间...");
            {
                let mut start_time = self.playback_start_time.lock().unwrap();
                *start_time = Some(Instant::now());
            }
            {
                let mut seek_offset = self.seek_offset.lock().unwrap();
                *seek_offset = 0;
            }

            // Update state
            log::info!("更新播放器状态...");
            {
                let mut state = self.state.lock().unwrap();
                state.is_playing = true;
                state.current_track = Some(track.clone());
                state.position_ms = 0;
            }

            {
                let mut current_index = self.current_index.lock().unwrap();
                *current_index = Some(index);
            }

            // Emit events
            log::info!("发送状态变化事件...");
            let state = self.state.lock().unwrap().clone();
            let _ = self.event_tx.send(PlayerEvent::StateChanged(state));
            let _ = self.event_tx.send(PlayerEvent::TrackChanged(Some(track.clone())));
            
            log::info!("播放曲目完全设置完成: {}", track.title.as_deref().unwrap_or("未知标题"));
        }
        Ok(())
    }


    fn pause(&self) -> Result<()> {
        log::info!("Pausing playback");
        
        // Pause the audio sink
        {
            let sink = self.sink.lock().unwrap();
            if let Some(ref sink) = *sink {
                sink.pause();
            }
        }
        
        let mut state = self.state.lock().unwrap();
        state.is_playing = false;
        let state_clone = state.clone();
        drop(state);
        let _ = self.event_tx.send(PlayerEvent::StateChanged(state_clone));
        Ok(())
    }

    fn resume(&self) -> Result<()> {
        log::info!("Resuming playback");
        
        // Resume the audio sink
        {
            let sink = self.sink.lock().unwrap();
            if let Some(ref sink) = *sink {
                sink.play();
            }
        }
        
        let mut state = self.state.lock().unwrap();
        state.is_playing = true;
        let state_clone = state.clone();
        drop(state);
        let _ = self.event_tx.send(PlayerEvent::StateChanged(state_clone));
        Ok(())
    }

    fn stop(&self) -> Result<()> {
        log::info!("正在停止播放...");
        
        // Stop the audio sink with proper cleanup
        {
            let mut sink = self.sink.lock().unwrap();
            if let Some(current_sink) = sink.take() {
                // 先暂停，然后停止，确保音频资源正确释放
                current_sink.pause();
                std::thread::sleep(std::time::Duration::from_millis(10));
                current_sink.stop();
                log::info!("音频sink已停止");
            }
        }

        // Clear playback start time
        {
            let mut start_time = self.playback_start_time.lock().unwrap();
            *start_time = None;
        }
        
        let mut state = self.state.lock().unwrap();
        state.is_playing = false;
        state.current_track = None;
        state.position_ms = 0;
        let state_clone = state.clone();
        drop(state);
        
        let _ = self.event_tx.send(PlayerEvent::StateChanged(state_clone));
        let _ = self.event_tx.send(PlayerEvent::TrackChanged(None));
        log::info!("播放器已完全停止");
        Ok(())
    }

    fn seek(&self, position_ms: u64) -> Result<()> {
        log::info!("Seeking to position: {}ms", position_ms);
        
        let current_track = {
            let state = self.state.lock().unwrap();
            state.current_track.clone()
        };
        
        if let Some(track) = current_track {
            // 获取当前播放状态
            let was_playing = {
                let state = self.state.lock().unwrap();
                state.is_playing
            };
            
            // 记录seek偏移量
            {
                let mut seek_offset = self.seek_offset.lock().unwrap();
                *seek_offset = position_ms;
            }
            
            // 重新加载音频文件并跳转到指定位置
            self.reload_track_with_seek(&track, position_ms, was_playing)?;
        } else {
            // 没有当前曲目，仅更新状态
            let mut state = self.state.lock().unwrap();
            state.position_ms = position_ms;
            let state_clone = state.clone();
            drop(state);
            
            let _ = self.event_tx.send(PlayerEvent::PositionChanged(position_ms));
            let _ = self.event_tx.send(PlayerEvent::StateChanged(state_clone));
        }
        
        Ok(())
    }
    
    fn reload_track_with_seek(&self, track: &Track, seek_position_ms: u64, should_play: bool) -> Result<()> {
        log::info!("Reloading track with seek: {} at {}ms", track.title.as_deref().unwrap_or("Unknown"), seek_position_ms);
        
        // 停止当前播放
        {
            let mut sink = self.sink.lock().unwrap();
            if let Some(current_sink) = sink.take() {
                current_sink.stop();
            }
        }
        
        // 创建新的sink
        let new_sink = self.create_audio_sink()
            .map_err(|e| anyhow::anyhow!("Failed to create audio sink for seek: {}. {}", e, self.get_audio_troubleshooting_info()))?;
        
        // 加载音频文件
        let path = std::path::Path::new(&track.path);
        let canonical_path = path.canonicalize()
            .unwrap_or_else(|_| path.to_path_buf());
        
        if !canonical_path.exists() {
            return Err(anyhow::anyhow!("Audio file does not exist: {:?}", canonical_path));
        }
        
        let file = File::open(&canonical_path)
            .map_err(|e| anyhow::anyhow!("Failed to open audio file {:?}: {}", canonical_path, e))?;
        
        let source = Decoder::new(BufReader::new(file))
            .map_err(|e| anyhow::anyhow!("Failed to decode audio file {:?}: {}", canonical_path, e))?;
        
        // 计算需要跳过的样本数
        let sample_rate = source.sample_rate();
        let channels = source.channels();
        let skip_samples = ((seek_position_ms as f64) * (sample_rate as f64) * (channels as f64) / 1000.0) as usize;
        
        log::info!("Sample rate: {}, Channels: {}, Skip samples: {}", sample_rate, channels, skip_samples);
        
        // 跳过指定数量的样本来实现seek
        let seeked_source = source.skip_duration(Duration::from_millis(seek_position_ms));
        
        new_sink.append(seeked_source);
        
        if should_play {
            new_sink.play();
        } else {
            new_sink.pause();
        }
        
        // 更新sink
        {
            let mut sink = self.sink.lock().unwrap();
            *sink = Some(new_sink);
        }
        
        // 重新设置播放开始时间（考虑到seek偏移）
        {
            let mut start_time = self.playback_start_time.lock().unwrap();
            if should_play {
                *start_time = Some(Instant::now().checked_sub(Duration::from_millis(seek_position_ms)).unwrap_or(Instant::now()));
            } else {
                *start_time = None;
            }
        }
        
        // 更新状态
        {
            let mut state = self.state.lock().unwrap();
            state.position_ms = seek_position_ms;
            state.is_playing = should_play;
            let state_clone = state.clone();
            drop(state);
            
            // 发送事件
            let _ = self.event_tx.send(PlayerEvent::PositionChanged(seek_position_ms));
            let _ = self.event_tx.send(PlayerEvent::StateChanged(state_clone));
        }
        
        log::info!("Seek operation completed successfully");
        Ok(())
    }

    fn next_track(&self) -> Result<()> {
        let current_index = self.current_index.lock().unwrap();
        if let Some(index) = *current_index {
            let playlist = self.playlist.lock().unwrap();
            let playlist_len = playlist.len();
            
            // Protect against empty playlist
            if playlist_len == 0 {
                drop(playlist);
                drop(current_index);
                return Ok(());
            }
            
            let next_index = (index + 1) % playlist_len;
            drop(playlist);
            drop(current_index);
            self.play_track_at_index(next_index)?;
        }
        Ok(())
    }

    fn previous_track(&self) -> Result<()> {
        let current_index = self.current_index.lock().unwrap();
        if let Some(index) = *current_index {
            let playlist = self.playlist.lock().unwrap();
            let prev_index = if index == 0 { playlist.len() - 1 } else { index - 1 };
            drop(playlist);
            drop(current_index);
            self.play_track_at_index(prev_index)?;
        }
        Ok(())
    }

    fn set_volume(&self, volume: f32) -> Result<()> {
        let clamped_volume = volume.clamp(0.0, 1.0);
        log::info!("Setting volume to {}", clamped_volume);
        
        // Set volume on the audio sink
        {
            let sink = self.sink.lock().unwrap();
            if let Some(ref sink) = *sink {
                sink.set_volume(clamped_volume);
            }
        }
        
        let mut state = self.state.lock().unwrap();
        state.volume = clamped_volume;
        let state_clone = state.clone();
        drop(state);
        let _ = self.event_tx.send(PlayerEvent::StateChanged(state_clone));
        Ok(())
    }

    fn set_repeat_mode(&self, mode: RepeatMode) -> Result<()> {
        let mut state = self.state.lock().unwrap();
        state.repeat_mode = mode;
        let state_clone = state.clone();
        drop(state);
        let _ = self.event_tx.send(PlayerEvent::StateChanged(state_clone));
        Ok(())
    }

    fn set_shuffle(&self, shuffle: bool) -> Result<()> {
        let mut state = self.state.lock().unwrap();
        state.shuffle = shuffle;
        let state_clone = state.clone();
        drop(state);
        let _ = self.event_tx.send(PlayerEvent::StateChanged(state_clone));
        Ok(())
    }

    fn load_playlist(&self, tracks: Vec<Track>) -> Result<()> {
        let mut playlist = self.playlist.lock().unwrap();
        playlist.clear();
        playlist.extend(tracks);
        
        // Validate and reset current_index after loading new playlist
        let mut current_index = self.current_index.lock().unwrap();
        if let Some(index) = *current_index {
            // If current index is beyond new playlist bounds, reset to None
            if index >= playlist.len() {
                *current_index = None;
                log::info!("Reset current_index due to playlist size change");
            } else {
                // Check if current track still exists in new playlist
                let current_track = {
                    let state = self.state.lock().unwrap();
                    state.current_track.clone()
                };
                
                if let Some(track) = current_track {
                    // Find the track in the new playlist
                    if let Some(new_index) = playlist.iter().position(|t| t.id == track.id) {
                        *current_index = Some(new_index);
                        log::info!("Updated current_index to {} for existing track", new_index);
                    } else {
                        *current_index = None;
                        log::info!("Reset current_index as current track not found in new playlist");
                    }
                }
            }
        }
        
        Ok(())
    }

    fn update_position(&self) {
        let is_playing = {
            let state = self.state.lock().unwrap();
            state.is_playing
        };

        if is_playing {
            let start_time = self.playback_start_time.lock().unwrap();
            let seek_offset = {
                let seek_offset = self.seek_offset.lock().unwrap();
                *seek_offset
            };
            
            if let Some(start) = *start_time {
                let elapsed = start.elapsed();
                let position_ms = elapsed.as_millis() as u64 + seek_offset;
                
                // Update position in state
                {
                    let mut state = self.state.lock().unwrap();
                    state.position_ms = position_ms;
                }
                
                // Send position update event
                let _ = self.event_tx.send(PlayerEvent::PositionChanged(position_ms));
                
                // Check for track completion
                let current_track_duration = {
                    let state = self.state.lock().unwrap();
                    state.current_track.as_ref().and_then(|t| t.duration_ms)
                };
                
                // Check if track is completed
                let is_sink_empty = {
                    let sink = self.sink.lock().unwrap();
                    sink.as_ref().map_or(true, |s| s.empty())
                };
                
                if let Some(duration) = current_track_duration {
                    // Track is complete if position exceeds duration or sink is empty
                    // Convert i64 duration to u64 for comparison, handling negative values
                    let duration_u64 = if duration >= 0 { duration as u64 } else { 0 };
                    if position_ms >= duration_u64 || is_sink_empty {
                        self.handle_track_completion();
                    }
                }
            }
        }
    }

    fn handle_track_completion(&self) {
        let (current_track, current_index, repeat_mode, shuffle) = {
            let state = self.state.lock().unwrap();
            let index = self.current_index.lock().unwrap();
            (
                state.current_track.clone(),
                *index,
                state.repeat_mode.clone(),
                state.shuffle
            )
        };

        if let Some(track) = current_track {
            // Send track completed event
            let _ = self.event_tx.send(PlayerEvent::TrackCompleted(track));

            if let Some(index) = current_index {
                let playlist = self.playlist.lock().unwrap();
                let playlist_len = playlist.len();
                drop(playlist);

                match repeat_mode {
                    RepeatMode::One => {
                        // Repeat current track
                        if let Err(e) = self.play_track_at_index(index) {
                            log::error!("Failed to repeat track: {}", e);
                        }
                    }
                    RepeatMode::All => {
                        let next_index = if shuffle {
                            self.get_random_track_index(playlist_len, Some(index)).unwrap_or(0)
                        } else {
                            (index + 1) % playlist_len
                        };
                        
                        if let Err(e) = self.play_track_at_index(next_index) {
                            log::error!("Failed to play next track: {}", e);
                        }
                    }
                    RepeatMode::Off => {
                        if shuffle {
                            if let Ok(next_index) = self.get_random_track_index(playlist_len, Some(index)) {
                                if next_index < playlist_len {
                                    if let Err(e) = self.play_track_at_index(next_index) {
                                        log::error!("Failed to play random track: {}", e);
                                    }
                                    return;
                                }
                            }
                        } else if index + 1 < playlist_len {
                            if let Err(e) = self.play_track_at_index(index + 1) {
                                log::error!("Failed to play next track: {}", e);
                            }
                            return;
                        }
                        
                        // Reached end of playlist in RepeatMode::Off
                        let _ = self.stop();
                        let _ = self.event_tx.send(PlayerEvent::PlaylistCompleted);
                    }
                }
            }
        }
    }

    fn get_random_track_index(&self, playlist_len: usize, current_index: Option<usize>) -> Result<usize> {
        if playlist_len == 0 {
            return Err(anyhow::anyhow!("Empty playlist"));
        }

        if playlist_len == 1 {
            return Ok(0);
        }

        // Use a simple random number generator based on current time
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        
        // Add some entropy
        let entropy = self.state.lock().unwrap().position_ms as u128;
        let seed = now.wrapping_add(entropy);
        
        let mut random_index = (seed as usize) % playlist_len;
        
        // Avoid repeating the current track if possible
        if let Some(current) = current_index {
            if random_index == current && playlist_len > 1 {
                random_index = (random_index + 1) % playlist_len;
            }
        }

        Ok(random_index)
    }
}
