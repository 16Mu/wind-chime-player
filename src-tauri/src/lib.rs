use crossbeam_channel::{Receiver, Sender};
use std::sync::{Arc, Mutex, OnceLock, atomic::{AtomicBool, Ordering}};
use tauri::{AppHandle, Emitter, Manager, State};
use anyhow::Result;

mod player; // 新的模块化player（已完成重构）
mod player_adapter; // PlayerCore适配器
mod library;
mod db;
mod lyrics;
mod playlist; // 企业级歌单系统
mod webdav; // 新增：WebDAV客户端模块
mod remote_source; // 新增：远程音乐源统一抽象层
mod audio_enhancement; // 新增：音质增强设置
mod metadata_extractor; // 新增：通用元数据提取器
mod play_history; // 新增：播放历史管理
mod streaming; // 新增：流式播放服务（高内聚低耦合设计）
mod network_api; // 新增：网络API服务（LrcApi集成）

// 使用新的PlayerCore（通过适配器）
use player::{PlayerCommand, PlayerEvent, Track, RepeatMode};
use play_history::{PlayHistoryEntry, PlayStatistics};
use player_adapter::PlayerAdapter;
use library::{Library, LibraryCommand, LibraryEvent};
use db::{Database, Lyrics};
use lyrics::{LyricsParser, ParsedLyrics};
use webdav::WebDAVClient;
use webdav::types::{WebDAVConfig, WebDAVFileInfo};
use network_api::NetworkApiService;

// Global state
static PLAYER_TX: OnceLock<Sender<PlayerCommand>> = OnceLock::new();
static LIBRARY_TX: OnceLock<Sender<LibraryCommand>> = OnceLock::new();
pub(crate) static DB: OnceLock<Arc<Mutex<Database>>> = OnceLock::new();
static SHUTDOWN_SIGNAL: AtomicBool = AtomicBool::new(false);

struct AppState {
    player_rx: Arc<Mutex<Receiver<PlayerEvent>>>,
    library_rx: Arc<Mutex<Receiver<LibraryEvent>>>,
    db: Arc<Mutex<Database>>,
    #[allow(dead_code)]
    player_adapter: Arc<PlayerAdapter>,
}

// Tauri Commands

/// 读取音频文件的完整数据（用于 Web Audio API）
#[tauri::command]
async fn read_audio_file(file_path: String) -> Result<Vec<u8>, String> {
    println!("📖 [COMMAND] read_audio_file 被调用: {}", file_path);
    let start = std::time::Instant::now();
    
    // 🔥 使用 tokio 异步读取（不阻塞）
    let data = tokio::fs::read(&file_path)
        .await
        .map_err(|e| format!("读取文件失败: {}", e))?;
    
    println!("✅ [COMMAND] 文件读取完成: {} 字节, 耗时: {}ms", 
        data.len(), 
        start.elapsed().as_millis()
    );
    
    Ok(data)
}

/// 从数据库获取歌曲信息（用于 Web Audio Player）
#[tauri::command]
async fn get_track(track_id: i64, state: State<'_, AppState>) -> Result<Track, String> {
    println!("📖 [COMMAND] get_track 被调用: track_id={}", track_id);
    
    let db = state.db.lock().map_err(|e| format!("数据库锁定失败: {}", e))?;
    
    // 从数据库获取歌曲信息
    let track = db.get_track_by_id(track_id)
        .map_err(|e| format!("获取歌曲失败: {}", e))?
        .ok_or_else(|| format!("歌曲不存在: {}", track_id))?;
    
    Ok(track)
}

/// 获取当前播放位置（用于引擎切换）
#[tauri::command]
async fn get_current_position() -> Result<u64, String> {
    let tx = PLAYER_TX.get().ok_or_else(|| "Player not initialized".to_string())?;
    
    let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
    
    tx.send(PlayerCommand::GetPosition(reply_tx))
        .map_err(|e| format!("发送命令失败: {}", e))?;
    
    let position = reply_rx.await
        .map_err(|e| format!("接收响应失败: {}", e))?
        .unwrap_or(0);
    
    Ok(position)
}

#[tauri::command]
async fn player_play(track_id: i64, timestamp: i64) -> Result<(), String> {
    println!("🎵 [COMMAND] player_play 被调用: track_id={}, timestamp={}", track_id, timestamp);
    log::info!("🎵 [COMMAND] player_play 被调用: track_id={}, timestamp={}", track_id, timestamp);
    
    let tx = PLAYER_TX.get().ok_or_else(|| {
        println!("❌ [COMMAND] PLAYER_TX 未初始化！");
        log::error!("❌ [COMMAND] PLAYER_TX 未初始化！");
        "Player not initialized".to_string()
    })?;
    
    println!("📤 [COMMAND] 发送 Play 命令到 PlayerAdapter...");
    log::info!("📤 [COMMAND] 发送 Play 命令到 PlayerAdapter...");
    
    tx.send(PlayerCommand::Play(track_id, timestamp))
        .map_err(|e| {
            println!("❌ [COMMAND] 发送命令失败: {}", e);
            log::error!("❌ [COMMAND] 发送命令失败: {}", e);
            e.to_string()
        })?;
    
    println!("✅ [COMMAND] Play 命令已发送");
    log::info!("✅ [COMMAND] Play 命令已发送");
    Ok(())
}

#[tauri::command]
async fn player_pause() -> Result<(), String> {
    let tx = PLAYER_TX.get().ok_or("Player not initialized")?;
    tx.send(PlayerCommand::Pause).map_err(|e| e.to_string())
}

#[tauri::command]
async fn player_resume() -> Result<(), String> {
    let tx = PLAYER_TX.get().ok_or("Player not initialized")?;
    tx.send(PlayerCommand::Resume).map_err(|e| e.to_string())
}

#[tauri::command]
async fn player_stop() -> Result<(), String> {
    let tx = PLAYER_TX.get().ok_or("Player not initialized")?;
    tx.send(PlayerCommand::Stop).map_err(|e| e.to_string())
}

#[tauri::command]
async fn player_next() -> Result<(), String> {
    let tx = PLAYER_TX.get().ok_or("Player not initialized")?;
    tx.send(PlayerCommand::Next).map_err(|e| e.to_string())
}

#[tauri::command]
async fn player_previous() -> Result<(), String> {
    let tx = PLAYER_TX.get().ok_or("Player not initialized")?;
    tx.send(PlayerCommand::Previous).map_err(|e| e.to_string())
}

#[tauri::command]
async fn player_seek(position_ms: u64) -> Result<(), String> {
    let tx = PLAYER_TX.get().ok_or("Player not initialized")?;
    tx.send(PlayerCommand::Seek(position_ms))
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn player_set_volume(volume: f32) -> Result<(), String> {
    let tx = PLAYER_TX.get().ok_or("Player not initialized")?;
    tx.send(PlayerCommand::SetVolume(volume))
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn player_set_repeat(mode: RepeatMode) -> Result<(), String> {
    let tx = PLAYER_TX.get().ok_or("Player not initialized")?;
    tx.send(PlayerCommand::SetRepeatMode(mode))
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn player_set_shuffle(shuffle: bool) -> Result<(), String> {
    let tx = PLAYER_TX.get().ok_or("Player not initialized")?;
    tx.send(PlayerCommand::SetShuffle(shuffle))
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn player_load_playlist(tracks: Vec<Track>) -> Result<(), String> {
    let tx = PLAYER_TX.get().ok_or("Player not initialized")?;
    tx.send(PlayerCommand::LoadPlaylist(tracks))
        .map_err(|e| e.to_string())
}

// 📊 系统性能监控命令
#[tauri::command]
async fn get_system_performance() -> Result<serde_json::Value, String> {
    use sysinfo::{System, Disks};
    
    let mut sys = System::new_all();
    sys.refresh_all();
    
    // CPU信息
    let cpu_usage = sys.global_cpu_info().cpu_usage();
    let cpu_count = sys.cpus().len();
    
    // 内存信息
    let total_memory = sys.total_memory();
    let used_memory = sys.used_memory();
    let memory_usage = (used_memory as f64 / total_memory as f64 * 100.0) as f32;
    
    // 当前进程信息
    let pid = sysinfo::get_current_pid().map_err(|e| e.to_string())?;
    let process_memory = sys.process(pid)
        .map(|p| p.memory())
        .unwrap_or(0);
    let process_cpu = sys.process(pid)
        .map(|p| p.cpu_usage())
        .unwrap_or(0.0);
    
    // 磁盘信息
    let disks = Disks::new_with_refreshed_list();
    let mut disk_info = Vec::new();
    for disk in disks.list() {
        disk_info.push(serde_json::json!({
            "name": disk.name().to_string_lossy(),
            "mount_point": disk.mount_point().to_string_lossy(),
            "total_space": disk.total_space(),
            "available_space": disk.available_space(),
            "usage_percent": ((disk.total_space() - disk.available_space()) as f64 / disk.total_space() as f64 * 100.0) as f32,
        }));
    }
    
    Ok(serde_json::json!({
        "cpu": {
            "usage": cpu_usage,
            "cores": cpu_count,
        },
        "memory": {
            "total": total_memory,
            "used": used_memory,
            "usage_percent": memory_usage,
        },
        "process": {
            "memory": process_memory,
            "cpu_usage": process_cpu,
        },
        "disks": disk_info,
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

// 🎵 音质增强命令
use audio_enhancement::{AudioEnhancementSettings, EqualizerPresets};
use once_cell::sync::Lazy;

// 全局音质增强设置存储
static AUDIO_ENHANCEMENT_SETTINGS: Lazy<Mutex<AudioEnhancementSettings>> = 
    Lazy::new(|| Mutex::new(AudioEnhancementSettings::default()));

#[tauri::command]
async fn get_audio_enhancement_settings() -> Result<AudioEnhancementSettings, String> {
    log::info!("🎵 获取音质增强设置");
    let settings = AUDIO_ENHANCEMENT_SETTINGS
        .lock()
        .map_err(|e| format!("锁定设置失败: {}", e))?
        .clone();
    Ok(settings)
}

#[tauri::command]
async fn set_audio_enhancement_settings(settings: AudioEnhancementSettings) -> Result<(), String> {
    log::info!("🎵 更新音质增强设置: enabled={}", settings.enabled);
    
    // 验证设置
    if settings.equalizer.gains.iter().any(|&g| g < -12.0 || g > 12.0) {
        return Err("均衡器增益必须在-12dB到+12dB之间".to_string());
    }
    
    if settings.bass_boost.gain < 0.0 || settings.bass_boost.gain > 12.0 {
        return Err("低音增强必须在0到12dB之间".to_string());
    }
    
    // 更新全局设置
    *AUDIO_ENHANCEMENT_SETTINGS
        .lock()
        .map_err(|e| format!("锁定设置失败: {}", e))? = settings;
    
    log::info!("✅ 音质增强设置已更新");
    Ok(())
}

#[tauri::command]
async fn get_equalizer_presets() -> Result<Vec<(String, Vec<f32>)>, String> {
    log::info!("🎵 获取均衡器预设列表");
    let presets = EqualizerPresets::all()
        .into_iter()
        .map(|(name, gains)| (name.to_string(), gains.to_vec()))
        .collect();
    Ok(presets)
}

#[tauri::command]
async fn apply_equalizer_preset(preset_name: String) -> Result<(), String> {
    log::info!("🎵 应用均衡器预设: {}", preset_name);
    
    let gains = EqualizerPresets::get(&preset_name)
        .ok_or_else(|| format!("未找到预设: {}", preset_name))?;
    
    let mut settings = AUDIO_ENHANCEMENT_SETTINGS
        .lock()
        .map_err(|e| format!("锁定设置失败: {}", e))?;
    
    settings.equalizer.gains = gains;
    settings.equalizer.preset = Some(preset_name.clone());
    
    log::info!("✅ 已应用预设: {}", preset_name);
    Ok(())
}

// 🔧 音频设备诊断和修复命令

#[tauri::command]
async fn diagnose_audio_system() -> Result<String, String> {
    use std::process::Command;
    
    let mut diagnostics = Vec::new();
    diagnostics.push("=== WindChime Player 音频系统诊断 ===".to_string());
    
    // 1. 检查Windows音频服务状态
    if let Ok(output) = Command::new("sc")
        .args(&["query", "audiosrv"])
        .output()
    {
        let status = String::from_utf8_lossy(&output.stdout);
        if status.contains("RUNNING") {
            diagnostics.push("✅ Windows Audio服务运行正常".to_string());
        } else {
            diagnostics.push("❌ Windows Audio服务未运行".to_string());
        }
    }
    
    // 2. 检查音频进程
    if let Ok(output) = Command::new("tasklist")
        .args(&["/FI", "IMAGENAME eq audiodg.exe"])
        .output()
    {
        let processes = String::from_utf8_lossy(&output.stdout);
        if processes.contains("audiodg.exe") {
            diagnostics.push("✅ Windows音频引擎进程运行正常".to_string());
        } else {
            diagnostics.push("❌ Windows音频引擎进程未找到".to_string());
        }
    }
    
    // 3. 检查可能冲突的音频应用
    let audio_apps = ["spotify.exe", "chrome.exe", "firefox.exe", "vlc.exe", "wmplayer.exe"];
    for app in &audio_apps {
        if let Ok(output) = Command::new("tasklist")
            .args(&["/FI", &format!("IMAGENAME eq {}", app)])
            .output()
        {
            let processes = String::from_utf8_lossy(&output.stdout);
            if processes.contains(app) {
                diagnostics.push(format!("⚠️ 发现可能冲突的应用: {}", app));
            }
        }
    }
    
    // 4. 检查Senary音频应用
    if let Ok(output) = Command::new("tasklist")
        .args(&["/FI", "IMAGENAME eq SenaryAudioApp*"])
        .output()
    {
        let processes = String::from_utf8_lossy(&output.stdout);
        if processes.contains("SenaryAudioApp") {
            diagnostics.push("⚠️ 检测到Senary音频增强软件，可能造成设备独占".to_string());
        }
    }
    
    diagnostics.push("".to_string());
    diagnostics.push("=== 建议的解决方案 ===".to_string());
    diagnostics.push("1. 关闭其他音频应用".to_string());
    diagnostics.push("2. 重新插拔耳机设备".to_string());
    diagnostics.push("3. 在Windows设置中切换默认音频设备".to_string());
    diagnostics.push("4. 尝试重启WindChime Player".to_string());
    diagnostics.push("5. 如果问题持续，请尝试重启计算机".to_string());
    
    Ok(diagnostics.join("\n"))
}

#[tauri::command]
async fn fix_audio_system() -> Result<String, String> {
    use std::process::Command;
    
    log::info!("🔧 用户请求修复音频系统");
    
    // 尝试重启Windows音频服务
    let mut results = Vec::new();
    
    // 1. 停止音频服务
    match Command::new("net")
        .args(&["stop", "audiosrv"])
        .output()
    {
        Ok(_) => {
            results.push("✅ 已停止Windows Audio服务".to_string());
            std::thread::sleep(std::time::Duration::from_millis(2000));
        }
        Err(e) => {
            results.push(format!("❌ 停止音频服务失败: {}", e));
        }
    }
    
    // 2. 启动音频服务
    match Command::new("net")
        .args(&["start", "audiosrv"])
        .output()
    {
        Ok(_) => {
            results.push("✅ 已启动Windows Audio服务".to_string());
        }
        Err(e) => {
            results.push(format!("❌ 启动音频服务失败: {}", e));
        }
    }
    
    // 3. 等待服务稳定
    std::thread::sleep(std::time::Duration::from_millis(3000));
    results.push("⏱️ 等待音频服务稳定...".to_string());
    
    results.push("".to_string());
    results.push("🎵 音频系统修复完成！请尝试重新播放音乐。".to_string());
    
    Ok(results.join("\n"))
}

#[tauri::command]
async fn reset_audio_device() -> Result<String, String> {
    log::info!("🔧 用户请求重置音频设备");
    
    let tx = PLAYER_TX.get().ok_or("Player not initialized")?;
    tx.send(PlayerCommand::ResetAudioDevice)
        .map_err(|e| e.to_string())?;
    
    Ok("🎵 音频设备重置命令已发送，请稍候...".to_string())
}

#[tauri::command]
async fn library_scan(paths: Vec<String>) -> Result<(), String> {
    let tx = LIBRARY_TX.get().ok_or("Library not initialized")?;
    tx.send(LibraryCommand::Scan(paths))
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn library_get_tracks() -> Result<(), String> {
    log::info!("📞 前端调用library_get_tracks命令");
    let tx = LIBRARY_TX.get().ok_or("Library not initialized")?;
    log::info!("📨 向Library发送GetTracks命令...");
    let send_result = tx.send(LibraryCommand::GetTracks)
        .map_err(|e| e.to_string());
    if send_result.is_ok() {
        log::info!("✅ GetTracks命令已发送");
    } else {
        log::error!("❌ GetTracks命令发送失败: {:?}", send_result);
    }
    send_result
}

#[tauri::command]
async fn library_search(query: String) -> Result<(), String> {
    let tx = LIBRARY_TX.get().ok_or("Library not initialized")?;
    tx.send(LibraryCommand::SearchTracks(query))
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn library_get_stats() -> Result<(), String> {
    let tx = LIBRARY_TX.get().ok_or("Library not initialized")?;
    tx.send(LibraryCommand::GetStats)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn library_rescan_covers() -> Result<(), String> {
    let tx = LIBRARY_TX.get().ok_or("Library not initialized")?;
    tx.send(LibraryCommand::RescanAll)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn library_get_music_folders(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.get_music_folder_paths().map_err(|e| e.to_string())
}

#[tauri::command]
async fn library_delete_folder(folder_path: String, state: State<'_, AppState>) -> Result<usize, String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.delete_folder_tracks(&folder_path).map_err(|e| e.to_string())
}

// Lyrics commands
#[tauri::command]
async fn lyrics_get(track_id: i64, state: State<'_, AppState>) -> Result<Option<Lyrics>, String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.get_lyrics_by_track_id(track_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn lyrics_parse(content: String) -> Result<ParsedLyrics, String> {
    let parser = LyricsParser::new();
    parser.parse_lrc(&content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn lyrics_save(track_id: i64, content: String, format: String, source: String, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.insert_lyrics(track_id, &content, &format, &source)
        .map_err(|e| e.to_string())
        .map(|_| ())
}

#[tauri::command]
async fn lyrics_delete(track_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.delete_lyrics(track_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn lyrics_refresh(track_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    // 获取曲目信息
    let track = {
        let db = state.inner().db.lock().map_err(|e| e.to_string())?;
        db.get_track_by_id(track_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Track not found".to_string())?
    };

    // 删除旧的临时歌词（保留用户手动添加的）
    {
        let db = state.inner().db.lock().map_err(|e| e.to_string())?;
        db.delete_lyrics_by_source(track_id, "temp").map_err(|e| e.to_string())?;
    }

    // 重新搜索歌词
    let parser = LyricsParser::new();
    if let Ok(Some(parsed)) = parser.search_lyrics_comprehensive(&track.path) {
        // 格式化为 LRC 格式
        let lrc_content = parser.format_as_lrc(&parsed);
        
        // 保存到数据库
        let db = state.inner().db.lock().map_err(|e| e.to_string())?;
        db.insert_lyrics(track_id, &lrc_content, "lrc", "temp")
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn lyrics_search_file(audio_path: String) -> Result<Option<String>, String> {
    let parser = LyricsParser::new();
    Ok(parser.find_lyrics_file(&audio_path))
}

#[tauri::command]
async fn lyrics_load_file(file_path: String) -> Result<ParsedLyrics, String> {
    let parser = LyricsParser::new();
    parser.load_from_file(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn lyrics_extract_from_metadata(audio_path: String) -> Result<Option<ParsedLyrics>, String> {
    let parser = LyricsParser::new();
    parser.extract_from_audio_metadata(&audio_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn lyrics_search_comprehensive(audio_path: String) -> Result<Option<ParsedLyrics>, String> {
    let parser = LyricsParser::new();
    parser.search_lyrics_comprehensive(&audio_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn lyrics_validate(content: String) -> Result<(bool, String, Vec<String>), String> {
    let parser = LyricsParser::new();
    Ok(parser.validate_lyrics(&content))
}

#[tauri::command]
async fn lyrics_parse_srt(content: String) -> Result<ParsedLyrics, String> {
    let parser = LyricsParser::new();
    parser.parse_srt(&content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn lyrics_parse_ass(content: String) -> Result<ParsedLyrics, String> {
    let parser = LyricsParser::new();
    parser.parse_ass(&content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn lyrics_parse_vtt(content: String) -> Result<ParsedLyrics, String> {
    let parser = LyricsParser::new();
    parser.parse_vtt(&content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn lyrics_auto_detect(content: String) -> Result<ParsedLyrics, String> {
    let parser = LyricsParser::new();
    parser.auto_detect_format(&content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn lyrics_format_as_lrc(lyrics: ParsedLyrics) -> Result<String, String> {
    let parser = LyricsParser::new();
    Ok(parser.format_as_lrc(&lyrics))
}

#[tauri::command]
async fn lyrics_get_current_line(track_id: i64, position_ms: u64, state: State<'_, AppState>) -> Result<Option<usize>, String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    let lyrics = db.get_lyrics_by_track_id(track_id).map_err(|e| e.to_string())?;
    
    if let Some(lyrics) = lyrics {
        let parser = LyricsParser::new();
        let parsed = parser.parse_lrc(&lyrics.content).map_err(|e| e.to_string())?;
        Ok(parser.get_current_line(&parsed.lines, position_ms))
    } else {
        Ok(None)
    }
}

// Network API commands (LrcApi integration)
/// 从网络API获取歌词
#[tauri::command]
async fn network_fetch_lyrics(
    title: String,
    artist: String,
    album: Option<String>
) -> Result<(String, String), String> {
    log::info!("🌐 [COMMAND] 网络获取歌词: {} - {}", title, artist);
    
    let service = NetworkApiService::new();
    let result = service
        .fetch_lyrics(&title, &artist, album.as_deref())
        .await
        .map_err(|e| e.to_string())?;
    
    Ok((result.content, result.source))
}

/// 从网络API获取封面
#[tauri::command]
async fn network_fetch_cover(
    title: Option<String>,
    artist: String,
    album: Option<String>
) -> Result<(Vec<u8>, String, String), String> {
    log::info!("🌐 [COMMAND] 网络获取封面: {} - {:?}", artist, album);
    
    let service = NetworkApiService::new();
    let result = service
        .fetch_cover(title.as_deref(), &artist, album.as_deref())
        .await
        .map_err(|e| e.to_string())?;
    
    Ok((result.data, result.mime_type, result.source))
}

/// 保存艺术家封面到数据库
#[tauri::command]
async fn artist_cover_save(
    state: State<'_, AppState>,
    artist_name: String,
    cover_data: Vec<u8>,
    cover_mime: String
) -> Result<(), String> {
    log::info!("💾 [COMMAND] 保存艺术家封面: {}", artist_name);
    
    let db = state.db.lock().unwrap();
    db.save_artist_cover(&artist_name, &cover_data, &cover_mime)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

/// 从数据库获取艺术家封面
#[tauri::command]
async fn artist_cover_get(
    state: State<'_, AppState>,
    artist_name: String
) -> Result<Option<(Vec<u8>, String)>, String> {
    log::info!("📖 [COMMAND] 获取艺术家封面: {}", artist_name);
    
    let db = state.db.lock().unwrap();
    db.get_artist_cover(&artist_name)
        .map_err(|e| e.to_string())
}

/// 批量获取所有艺术家封面
#[tauri::command]
async fn artist_covers_get_all(
    state: State<'_, AppState>
) -> Result<Vec<(String, Vec<u8>, String)>, String> {
    log::info!("📚 [COMMAND] 批量获取所有艺术家封面");
    
    let db = state.db.lock().unwrap();
    db.get_all_artist_covers()
        .map_err(|e| e.to_string())
}

// Playlist generation commands
#[tauri::command]
async fn generate_sequential_playlist(state: State<'_, AppState>) -> Result<Vec<Track>, String> {
    log::info!("生成顺序播放列表");
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    let all_tracks = db.get_all_tracks().map_err(|e| e.to_string())?;
    
    log::info!("顺序播放列表生成完成，共 {} 首歌曲", all_tracks.len());
    Ok(all_tracks)
}

#[tauri::command]
async fn generate_random_playlist(state: State<'_, AppState>) -> Result<Vec<Track>, String> {
    log::info!("生成随机播放列表");
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    let all_tracks = db.get_all_tracks().map_err(|e| e.to_string())?;
    
    if all_tracks.is_empty() {
        log::warn!("音乐库为空，无法生成随机播放列表");
        return Ok(Vec::new());
    }
    
    // 随机播放最多100首歌
    let max_tracks = 100.min(all_tracks.len());
    let mut random_tracks = Vec::new();
    
    // 使用简单的伪随机算法选择歌曲
    use std::collections::HashSet;
    let mut selected_indices = HashSet::new();
    
    // 使用当前时间作为种子
    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos() as u64;
    
    let mut rng_state = seed;
    while random_tracks.len() < max_tracks {
        // 简单的线性同余生成器
        rng_state = rng_state.wrapping_mul(1103515245).wrapping_add(12345);
        let index = (rng_state % all_tracks.len() as u64) as usize;
        
        if !selected_indices.contains(&index) {
            selected_indices.insert(index);
            random_tracks.push(all_tracks[index].clone());
        }
    }
    
    log::info!("随机播放列表生成完成，共 {} 首歌曲", random_tracks.len());
    Ok(random_tracks)
}

#[tauri::command]
async fn load_playlist_by_mode(shuffle: bool, state: State<'_, AppState>) -> Result<(), String> {
    log::info!("根据播放模式加载播放列表，随机模式: {}", shuffle);
    
    let tx = PLAYER_TX.get().ok_or("Player not initialized")?;
    
    let playlist = if shuffle {
        generate_random_playlist(state).await?
    } else {
        generate_sequential_playlist(state).await?
    };
    
    if playlist.is_empty() {
        return Err("音乐库为空，无法生成播放列表".to_string());
    }
    
    // 加载播放列表到播放器
    tx.send(PlayerCommand::LoadPlaylist(playlist))
        .map_err(|e| e.to_string())?;
    
    log::info!("播放列表已加载到播放器");
    Ok(())
}

// Favorites commands
#[tauri::command]
async fn favorites_add(track_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.add_favorite(track_id).map_err(|e| e.to_string()).map(|_| ())
}

#[tauri::command]
async fn favorites_remove(track_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.remove_favorite(track_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn favorites_is_favorite(track_id: i64, state: State<'_, AppState>) -> Result<bool, String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.is_favorite(track_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn favorites_get_all(state: State<'_, AppState>) -> Result<Vec<Track>, String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.get_all_favorites().map_err(|e| e.to_string())
}

#[tauri::command]
async fn favorites_toggle(track_id: i64, state: State<'_, AppState>) -> Result<bool, String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.toggle_favorite(track_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn favorites_get_count(state: State<'_, AppState>) -> Result<i64, String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.get_favorites_count().map_err(|e| e.to_string())
}

// ========== 企业级歌单管理命令 ==========

use playlist::{
    Playlist, PlaylistWithTracks, CreatePlaylistOptions, UpdatePlaylistOptions,
    PlaylistManager, PlaylistExporter, PlaylistImporter, ExportFormat,
    SmartRules, PlaylistStats,
};

// 基础 CRUD 命令
#[tauri::command]
async fn playlists_list(state: State<'_, AppState>) -> Result<Vec<Playlist>, String> {
    let db = state.inner().db.clone();
    let manager = PlaylistManager::new(db);
    manager.get_all_playlists().map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_create(options: CreatePlaylistOptions, state: State<'_, AppState>) -> Result<i64, String> {
    let db = state.inner().db.clone();
    let manager = PlaylistManager::new(db);
    manager.create_playlist(options).map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_get_detail(playlist_id: i64, state: State<'_, AppState>) -> Result<PlaylistWithTracks, String> {
    let db = state.inner().db.clone();
    let manager = PlaylistManager::new(db);
    manager.get_playlist_with_tracks(playlist_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_update(playlist_id: i64, options: UpdatePlaylistOptions, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.clone();
    let manager = PlaylistManager::new(db);
    manager.update_playlist(playlist_id, options).map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_delete(playlist_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.clone();
    let manager = PlaylistManager::new(db);
    manager.delete_playlist(playlist_id).map_err(|e| e.to_string())
}

// 曲目管理命令
#[tauri::command]
async fn playlists_add_tracks(playlist_id: i64, track_ids: Vec<i64>, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.clone();
    let manager = PlaylistManager::new(db);
    manager.add_tracks_to_playlist(playlist_id, track_ids).map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_remove_track(playlist_id: i64, track_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.clone();
    let manager = PlaylistManager::new(db);
    manager.remove_track_from_playlist(playlist_id, track_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_reorder_tracks(playlist_id: i64, track_ids: Vec<i64>, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.clone();
    let manager = PlaylistManager::new(db);
    manager.reorder_tracks(playlist_id, track_ids).map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_get_tracks(playlist_id: i64, state: State<'_, AppState>) -> Result<Vec<Track>, String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.get_playlist_tracks(playlist_id).map_err(|e| e.to_string())
}

// 智能歌单命令
#[tauri::command]
async fn playlists_create_smart(name: String, rules: SmartRules, state: State<'_, AppState>) -> Result<i64, String> {
    let db = state.inner().db.clone();
    let manager = PlaylistManager::new(db);
    manager.create_smart_playlist(name, rules).map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_update_smart_rules(playlist_id: i64, rules: SmartRules, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.clone();
    let manager = PlaylistManager::new(db);
    manager.update_smart_playlist(playlist_id, rules).map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_refresh_smart(playlist_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.clone();
    let manager = PlaylistManager::new(db);
    manager.refresh_smart_playlist(playlist_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_refresh_all_smart(state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.clone();
    let manager = PlaylistManager::new(db);
    manager.refresh_all_smart_playlists().map_err(|e| e.to_string())
}

// 导出命令
#[tauri::command]
async fn playlists_export(
    playlist_id: i64,
    file_path: String,
    format: ExportFormat,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.inner().db.clone();
    let manager = PlaylistManager::new(db);
    
    let playlist_with_tracks = manager.get_playlist_with_tracks(playlist_id)
        .map_err(|e| e.to_string())?;
    
    PlaylistExporter::export_to_file(
        &playlist_with_tracks.playlist,
        &playlist_with_tracks.tracks,
        &file_path,
        format,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_export_preview(
    playlist_id: i64,
    format: ExportFormat,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let db = state.inner().db.clone();
    let manager = PlaylistManager::new(db);
    
    let playlist_with_tracks = manager.get_playlist_with_tracks(playlist_id)
        .map_err(|e| e.to_string())?;
    
    PlaylistExporter::export_to_string(
        &playlist_with_tracks.playlist,
        &playlist_with_tracks.tracks,
        format,
    ).map_err(|e| e.to_string())
}

// 导入命令
#[tauri::command]
async fn playlists_import(file_path: String, state: State<'_, AppState>) -> Result<i64, String> {
    let (name, paths) = PlaylistImporter::import_from_file(&file_path)
        .map_err(|e| e.to_string())?;
    
    // 验证路径
    let (valid_paths, invalid_paths) = PlaylistImporter::validate_paths(&paths);
    
    if valid_paths.is_empty() {
        return Err(format!("没有有效的曲目路径。无效数量: {}", invalid_paths.len()));
    }
    
    log::info!("导入歌单: {} ({} 有效, {} 无效)", name, valid_paths.len(), invalid_paths.len());
    
    // 创建歌单
    let db = state.inner().db.clone();
    let manager = PlaylistManager::new(db.clone());
    
    let options = CreatePlaylistOptions {
        name,
        description: Some(format!("从文件导入 ({})", file_path)),
        color_theme: None,
        is_smart: false,
        smart_rules: None,
    };
    
    let playlist_id = manager.create_playlist(options).map_err(|e| e.to_string())?;
    
    // 添加曲目
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    let mut track_ids = Vec::new();
    
    for path in valid_paths {
        if let Ok(Some(track)) = db_guard.get_track_by_path(&path) {
            track_ids.push(track.id);
        }
    }
    drop(db_guard);
    
    manager.add_tracks_to_playlist(playlist_id, track_ids).map_err(|e| e.to_string())?;
    
    Ok(playlist_id)
}

// 其他功能命令
#[tauri::command]
async fn playlists_get_stats(state: State<'_, AppState>) -> Result<PlaylistStats, String> {
    let db = state.inner().db.clone();
    let manager = PlaylistManager::new(db);
    manager.get_stats().map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_mark_played(playlist_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.clone();
    let manager = PlaylistManager::new(db);
    manager.mark_played(playlist_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_toggle_favorite(playlist_id: i64, state: State<'_, AppState>) -> Result<bool, String> {
    let db = state.inner().db.clone();
    let manager = PlaylistManager::new(db);
    manager.toggle_favorite(playlist_id).map_err(|e| e.to_string())
}

// Pin歌单命令
#[tauri::command]
async fn playlists_pin(playlist_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.pin_playlist(playlist_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_unpin(playlist_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.unpin_playlist(playlist_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_toggle_pin(playlist_id: i64, state: State<'_, AppState>) -> Result<bool, String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.toggle_pin(playlist_id).map_err(|e| e.to_string())
}

// 播放历史命令
#[tauri::command]
async fn get_play_history(
    sort_by: Option<String>,
    limit: Option<i64>,
    state: State<'_, AppState>
) -> Result<Vec<PlayHistoryEntry>, String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    let sort = sort_by.unwrap_or_else(|| "last_played".to_string());
    let lim = limit.unwrap_or(50);
    
    let results = db.get_play_history(&sort, lim).map_err(|e| e.to_string())?;
    
    Ok(results.into_iter().map(|(track, play_count, last_played, first_played)| {
        PlayHistoryEntry {
            track,
            play_count,
            last_played_at: last_played,
            first_played_at: first_played,
        }
    }).collect())
}

#[tauri::command]
async fn get_play_statistics(state: State<'_, AppState>) -> Result<PlayStatistics, String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    let (total_plays, unique_tracks, total_duration_ms) = db.get_play_statistics()
        .map_err(|e| e.to_string())?;
    
    Ok(PlayStatistics {
        total_plays,
        unique_tracks,
        total_duration_ms,
    })
}

#[tauri::command]
async fn add_play_history(track_id: i64, duration_played_ms: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.add_play_history(track_id, duration_played_ms).map_err(|e| e.to_string())
}

#[tauri::command]
async fn clear_play_history(state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.clear_play_history().map_err(|e| e.to_string())
}

#[tauri::command]
async fn remove_from_history(track_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.remove_from_history(track_id).map_err(|e| e.to_string())
}

// Window control commands
#[tauri::command]
async fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn toggle_maximize(window: tauri::Window) -> Result<(), String> {
    if window.is_maximized().map_err(|e| e.to_string())? {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
async fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

// Audio device commands
#[tauri::command]
async fn check_audio_devices() -> Result<String, String> {
    use rodio::{OutputStream, Sink};
    
    log::info!("检查音频设备...");
    
    match OutputStream::try_default() {
        Ok((stream, handle)) => {
            log::info!("✅ 默认音频输出设备可用");
            
            // 测试是否能创建sink
            match Sink::try_new(&handle) {
                Ok(sink) => {
                    log::info!("✅ 音频sink创建成功");
                    
                    // 测试是否能播放一个简短的测试音
                    use rodio::source::{SineWave, Source};
                    use std::time::Duration;
                    
                    let source = SineWave::new(440.0)
                        .take_duration(Duration::from_millis(100))
                        .amplify(0.05);
                    
                    sink.append(source);
                    sink.play();
                    
                    // 保持stream存活
                    std::mem::forget(stream);
                    
                    Ok("音频设备完全可用，测试音播放成功".to_string())
                }
                Err(e) => {
                    log::error!("❌ 音频sink创建失败: {}", e);
                    Err(format!("音频设备部分可用但无法创建sink: {}", e))
                }
            }
        }
        Err(e) => {
            log::error!("❌ 找不到音频设备: {}", e);
            Err(format!("找不到音频设备: {}", e))
        }
    }
}

// Album cover commands
#[tauri::command]
async fn get_album_cover(track_id: i64, state: State<'_, AppState>) -> Result<Option<(Vec<u8>, String)>, String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    
    match db.get_track_by_id(track_id).map_err(|e| e.to_string())? {
        Some(track) => {
            if let Some(cover_data) = track.album_cover_data {
                // 宽松处理MIME类型：有数据就返回，没有MIME时使用默认值
                let mime_type = track.album_cover_mime.unwrap_or_else(|| {
                    // 根据数据头判断图片格式
                    if cover_data.len() >= 4 {
                        if &cover_data[0..4] == b"\xFF\xD8\xFF\xE0" || &cover_data[0..4] == b"\xFF\xD8\xFF\xE1" {
                            "image/jpeg".to_string()
                        } else if &cover_data[0..4] == b"\x89PNG" {
                            "image/png".to_string()
                        } else {
                            "image/jpeg".to_string() // 默认JPEG
                        }
                    } else {
                        "image/jpeg".to_string()
                    }
                });
                
                log::info!("✅ 返回封面数据: track_id={}, size={}, mime={}", track_id, cover_data.len(), mime_type);
                Ok(Some((cover_data, mime_type)))
            } else {
                log::warn!("❌ 数据库中无封面数据: track_id={}, path={}", track_id, track.path);
                Ok(None)
            }
        }
        None => {
            log::error!("❌ 未找到曲目: track_id={}", track_id);
            Err("Track not found".to_string())
        }
    }
}

// 重新提取单个曲目的封面
#[tauri::command]
async fn refresh_track_cover(track_id: i64, state: State<'_, AppState>) -> Result<bool, String> {
    use crate::metadata_extractor::MetadataExtractor;
    use std::path::Path;
    
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    
    match db.get_track_by_id(track_id).map_err(|e| e.to_string())? {
        Some(track) => {
            log::info!("🔄 重新提取封面: track_id={}, path={}", track_id, track.path);
            
            let extractor = MetadataExtractor::new();
            let path = Path::new(&track.path);
            
            match extractor.extract_from_file(path) {
                Ok(metadata) => {
                    if let (Some(cover_data), Some(mime)) = (metadata.album_cover_data, metadata.album_cover_mime) {
                        // 更新数据库中的封面
                        db.update_track_cover(track_id, Some(cover_data), Some(mime))
                            .map_err(|e| e.to_string())?;
                        
                        log::info!("✅ 封面更新成功: track_id={}", track_id);
                        Ok(true)
                    } else {
                        log::warn!("⚠️ 文件中未找到封面: track_id={}", track_id);
                        Ok(false)
                    }
                }
                Err(e) => {
                    log::error!("❌ 提取元数据失败: track_id={}, error={}", track_id, e);
                    Err(format!("提取元数据失败: {}", e))
                }
            }
        }
        None => {
            log::error!("❌ 未找到曲目: track_id={}", track_id);
            Err("Track not found".to_string())
        }
    }
}


// Audio debug commands
#[tauri::command]
async fn debug_audio_system() -> Result<String, String> {
    use rodio::OutputStream;
    use cpal::traits::{DeviceTrait, HostTrait};
    
    log::info!("调试音频系统...");
    
    let mut result = String::new();
    result.push_str("音频系统调试报告:\n\n");
    
    // 1. 检查音频主机
    let hosts = cpal::available_hosts();
    result.push_str(&format!("可用音频主机: {:?}\n", hosts));
    
    // 2. 检查默认主机和设备
    let host = cpal::default_host();
    if let Some(device) = host.default_output_device() {
        if let Ok(name) = device.name() {
            result.push_str(&format!("默认输出设备: {}\n", name));
            
            // 3. 检查设备配置
            if let Ok(config) = device.default_output_config() {
                result.push_str(&format!("默认配置: {:?}\n", config));
            }
            
            // 4. 测试OutputStream创建
            match OutputStream::try_from_device(&device) {
                Ok((stream, handle)) => {
                    result.push_str("✅ OutputStream创建成功\n");
                    
                    // 5. 测试Sink创建
                    match rodio::Sink::try_new(&handle) {
                        Ok(_) => result.push_str("✅ Sink创建成功\n"),
                        Err(e) => result.push_str(&format!("❌ Sink创建失败: {}\n", e)),
                    }
                    
                    std::mem::forget(stream); // 保持stream存活
                }
                Err(e) => {
                    result.push_str(&format!("❌ OutputStream创建失败: {}\n", e));
                }
            }
        }
    } else {
        result.push_str("❌ 未找到默认输出设备\n");
    }
    
    // 6. 列出所有输出设备
    match host.output_devices() {
        Ok(devices) => {
            result.push_str("\n所有输出设备:\n");
            for (i, device) in devices.enumerate() {
                if let Ok(name) = device.name() {
                    result.push_str(&format!("  {}. {}\n", i + 1, name));
                }
            }
        }
        Err(e) => {
            result.push_str(&format!("❌ 无法枚举输出设备: {}\n", e));
        }
    }
    
    log::info!("音频系统调试完成");
    Ok(result)
}

// ============================================================
// WebDAV 命令
// ============================================================

/// 测试 WebDAV 连接
#[tauri::command]
async fn webdav_test_connection(
    url: String,
    username: String,
    password: String,
) -> Result<String, String> {
    log::info!("测试 WebDAV 连接: {}", url);
    
    let config = WebDAVConfig {
        server_id: "test".to_string(),
        name: "测试服务器".to_string(),
        url,
        username,
        password,
        timeout_seconds: 30,
        max_redirects: 5,
        verify_ssl: true,
        user_agent: "WindChimePlayer/1.0".to_string(),
        ..Default::default()
    };
    
    let client = WebDAVClient::new(config)
        .map_err(|e| format!("创建 WebDAV 客户端失败: {}", e))?;
    
    // 测试获取根目录信息
    match client.get_file_info("/").await {
        Ok(file_info) => {
            Ok(format!(
                "✅ WebDAV 连接成功！\n服务器: {}\n类型: {}",
                file_info.name,
                if file_info.is_directory { "目录" } else { "文件" }
            ))
        }
        Err(e) => Err(format!("❌ WebDAV 连接失败: {}", e)),
    }
}

/// 列出 WebDAV 目录
#[tauri::command]
async fn webdav_list_directory(
    url: String,
    username: String,
    password: String,
    path: String,
) -> Result<Vec<WebDAVFileInfo>, String> {
    log::info!("列出 WebDAV 目录: {}", path);
    
    let config = WebDAVConfig {
        server_id: "browse".to_string(),
        name: "浏览服务器".to_string(),
        url,
        username,
        password,
        timeout_seconds: 30,
        max_redirects: 5,
        verify_ssl: true,
        user_agent: "WindChimePlayer/1.0".to_string(),
        ..Default::default()
    };
    
    let client = WebDAVClient::new(config)
        .map_err(|e| format!("创建 WebDAV 客户端失败: {}", e))?;
    
    match client.list_directory(&path).await {
        Ok(listing) => Ok(listing.files),
        Err(e) => Err(format!("列出目录失败: {}", e)),
    }
}

/// 获取 WebDAV 文件信息
#[tauri::command]
async fn webdav_get_file_info(
    url: String,
    username: String,
    password: String,
    file_path: String,
) -> Result<WebDAVFileInfo, String> {
    log::info!("获取 WebDAV 文件信息: {}", file_path);
    
    let config = WebDAVConfig {
        server_id: "info".to_string(),
        name: "信息查询".to_string(),
        url,
        username,
        password,
        timeout_seconds: 30,
        max_redirects: 5,
        verify_ssl: true,
        user_agent: "WindChimePlayer/1.0".to_string(),
        ..Default::default()
    };
    
    let client = WebDAVClient::new(config)
        .map_err(|e| format!("创建 WebDAV 客户端失败: {}", e))?;
    
    match client.get_file_info(&file_path).await {
        Ok(file_info) => Ok(file_info),
        Err(e) => Err(format!("获取文件信息失败: {}", e)),
    }
}

/// 检查 WebDAV 文件是否存在
#[tauri::command]
async fn webdav_file_exists(
    url: String,
    username: String,
    password: String,
    file_path: String,
) -> Result<bool, String> {
    log::info!("检查 WebDAV 文件是否存在: {}", file_path);
    
    let config = WebDAVConfig {
        server_id: "check".to_string(),
        name: "文件检查".to_string(),
        url,
        username,
        password,
        timeout_seconds: 30,
        max_redirects: 5,
        verify_ssl: true,
        user_agent: "WindChimePlayer/1.0".to_string(),
        ..Default::default()
    };
    
    let client = WebDAVClient::new(config)
        .map_err(|e| format!("创建 WebDAV 客户端失败: {}", e))?;
    
    match client.file_exists(&file_path).await {
        Ok(exists) => Ok(exists),
        Err(e) => Err(format!("检查文件失败: {}", e)),
    }
}

/// 创建 WebDAV 目录
#[tauri::command]
async fn webdav_create_directory(
    url: String,
    username: String,
    password: String,
    dir_path: String,
) -> Result<(), String> {
    log::info!("创建 WebDAV 目录: {}", dir_path);
    
    let config = WebDAVConfig {
        server_id: "mkdir".to_string(),
        name: "创建目录".to_string(),
        url,
        username,
        password,
        timeout_seconds: 30,
        max_redirects: 5,
        verify_ssl: true,
        user_agent: "WindChimePlayer/1.0".to_string(),
        ..Default::default()
    };
    
    let client = WebDAVClient::new(config)
        .map_err(|e| format!("创建 WebDAV 客户端失败: {}", e))?;
    
    match client.create_directory(&dir_path).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("创建目录失败: {}", e)),
    }
}

/// 删除 WebDAV 文件
#[tauri::command]
async fn webdav_delete_file(
    url: String,
    username: String,
    password: String,
    file_path: String,
) -> Result<(), String> {
    log::info!("删除 WebDAV 文件: {}", file_path);
    
    let config = WebDAVConfig {
        server_id: "delete".to_string(),
        name: "删除文件".to_string(),
        url,
        username,
        password,
        timeout_seconds: 30,
        max_redirects: 5,
        verify_ssl: true,
        user_agent: "WindChimePlayer/1.0".to_string(),
        ..Default::default()
    };
    
    let client = WebDAVClient::new(config)
        .map_err(|e| format!("创建 WebDAV 客户端失败: {}", e))?;
    
    match client.delete_file(&file_path).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("删除文件失败: {}", e)),
    }
}

// ============================================================
// 流式播放命令已移除
// 新架构中，流式播放在Rust后端内部处理，无需前端API
// ============================================================

// ============================================================
// 远程音乐源命令 (仅支持WebDAV)
// ============================================================

#[tauri::command]
async fn remote_add_server(
    state: State<'_, AppState>,
    server_type: String,
    name: String,
    config_json: String,
) -> Result<String, String> {
    let id = format!("{}_{}", server_type, uuid::Uuid::new_v4().to_string());
    
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.add_remote_server(&id, &name, &server_type, &config_json)
        .map_err(|e| e.to_string())?;
    
    log::info!("添加远程服务器: {} ({})", name, server_type);
    Ok(id)
}

#[tauri::command]
async fn remote_get_servers(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    let servers = db.get_remote_servers()
        .map_err(|e| e.to_string())?;
    
    let result: Vec<serde_json::Value> = servers.into_iter()
        .map(|(id, name, server_type, config_json, enabled)| {
            serde_json::json!({
                "id": id,
                "name": name,
                "server_type": server_type,
                "config": serde_json::from_str::<serde_json::Value>(&config_json).unwrap_or(serde_json::json!({})),
                "enabled": enabled
            })
        })
        .collect();
    
    Ok(result)
}

#[tauri::command]
async fn remote_delete_server(
    state: State<'_, AppState>,
    server_id: String,
) -> Result<(), String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.delete_remote_server(&server_id)
        .map_err(|e| e.to_string())?;
    
    log::info!("删除远程服务器: {}", server_id);
    Ok(())
}

#[tauri::command]
async fn remote_get_cache_stats(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    let (count, total_size) = db.get_cache_stats()
        .map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "file_count": count,
        "total_size_mb": total_size / (1024 * 1024),
    }))
}

#[tauri::command]
async fn remote_test_connection(
    server_type: String,
    config_json: String,
) -> Result<String, String> {
    log::info!("测试{}连接", server_type);
    
    use remote_source::{ConnectionStatus, RemoteSourceClient};
    
    // 创建临时客户端测试
    match server_type.as_str() {
        "webdav" => {
            let config: WebDAVConfig = serde_json::from_str(&config_json)
                .map_err(|e| format!("配置解析失败: {}", e))?;
            let client = WebDAVClient::new(config)
                .map_err(|e| format!("创建客户端失败: {}", e))?;
            let adapter = webdav::WebDAVRemoteAdapter::new(client);
            
            match RemoteSourceClient::test_connection(&adapter).await {
                Ok(ConnectionStatus::Connected) => Ok("✅ WebDAV连接成功！".to_string()),
                Ok(ConnectionStatus::Error(e)) => Err(format!("❌ 连接失败: {}", e)),
                _ => Err("❌ 连接失败：未知错误".to_string()),
            }
        },
        _ => Err(format!("不支持的服务器类型: {}，仅支持WebDAV", server_type)),
    }
}

/// 检查所有远程服务器的连接状态
#[tauri::command]
async fn remote_check_all_connections(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    log::info!("检查所有远程服务器连接状态");
    
    use remote_source::{RemoteClientManager, ConnectionStatus};
    
    let servers = {
        let db = state.inner().db.lock().map_err(|e| e.to_string())?;
        db.get_remote_servers().map_err(|e| e.to_string())?
    };
    
    let db_arc = state.inner().db.clone();
    let manager = RemoteClientManager::new(db_arc.clone());
    
    let mut results = Vec::new();
    
    for (id, name, server_type, _config_json, enabled) in servers {
        let status = if !enabled {
            "disabled".to_string()
        } else {
            match manager.get_client(&id).await {
                Ok(client) => {
                    match client.test_connection().await {
                        Ok(ConnectionStatus::Connected) => "connected".to_string(),
                        Ok(ConnectionStatus::Disconnected) => "disconnected".to_string(),
                        Ok(ConnectionStatus::Error(e)) => format!("error: {}", e),
                        _ => "unknown".to_string(),
                    }
                }
                Err(e) => format!("error: {}", e),
            }
        };
        
        results.push(serde_json::json!({
            "id": id,
            "name": name,
            "server_type": server_type,
            "status": status,
            "enabled": enabled,
        }));
    }
    
    log::info!("连接状态检查完成，共检查 {} 个服务器", results.len());
    Ok(results)
}

#[tauri::command]
async fn remote_browse_directory(
    state: State<'_, AppState>,
    server_id: String,
    path: String,
) -> Result<Vec<serde_json::Value>, String> {
    log::info!("浏览远程目录: {} - {}", server_id, path);
    
    use remote_source::RemoteClientManager;
    
    // 创建客户端管理器
    let db_arc = state.inner().db.clone();
    let manager = RemoteClientManager::new(db_arc);
    
    let client = manager.get_client(&server_id).await
        .map_err(|e| e.to_string())?;
    
    let files = client.list_directory(&path).await
        .map_err(|e| e.to_string())?;
    
    let result: Vec<serde_json::Value> = files.into_iter()
        .map(|f| serde_json::json!({
            "path": f.path,
            "name": f.name,
            "is_directory": f.is_directory,
            "size": f.size,
            "mime_type": f.mime_type,
            "last_modified": f.last_modified,
        }))
        .collect();
    
    Ok(result)
}

#[tauri::command]
async fn remote_scan_library(
    state: State<'_, AppState>,
    server_id: String,
    root_path: String,
) -> Result<serde_json::Value, String> {
    log::info!("开始扫描远程音乐库: {} - {}", server_id, root_path);
    
    use remote_source::{RemoteClientManager, RemoteScanner};
    
    // 创建客户端管理器
    let db_arc = state.inner().db.clone();
    let manager = RemoteClientManager::new(db_arc.clone());
    
    let client = manager.get_client(&server_id).await
        .map_err(|e| e.to_string())?;
    
    // 创建扫描器
    let scanner = RemoteScanner::new(client, db_arc, server_id);
    
    // 执行扫描
    let result = scanner.scan(&root_path).await
        .map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "total_files": result.total_files,
        "added": result.added,
        "updated": result.updated,
        "failed": result.failed,
        "errors": result.errors,
        "duration_seconds": result.duration_seconds,
    }))
}

// 测试命令：直接检查库统计数据
#[tauri::command]
async fn test_library_stats(state: State<'_, AppState>) -> Result<String, String> {
    log::info!("测试库统计数据");
    
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    
    let total_tracks = db.get_track_count().map_err(|e| e.to_string())?;
    let total_artists = db.get_artist_count().map_err(|e| e.to_string())?;
    let total_albums = db.get_album_count().map_err(|e| e.to_string())?;
    
    // 获取实际的曲目数据来验证
    let tracks = db.get_all_tracks().map_err(|e| e.to_string())?;
    
    let mut result = format!("库统计数据测试:\n");
    result.push_str(&format!("- 总曲目数: {}\n", total_tracks));
    result.push_str(&format!("- 总艺术家数: {}\n", total_artists));
    result.push_str(&format!("- 总专辑数: {}\n", total_albums));
    result.push_str(&format!("\n实际曲目列表 ({} 首):\n", tracks.len()));
    
    for (i, track) in tracks.iter().enumerate().take(10) { // 最多显示10首
        result.push_str(&format!("{}. {} - {} ({})\n", 
            i + 1,
            track.title.as_deref().unwrap_or("未知标题"),
            track.artist.as_deref().unwrap_or("未知艺术家"),
            track.album.as_deref().unwrap_or("未知专辑")
        ));
    }
    
    if tracks.len() > 10 {
        result.push_str(&format!("... 还有 {} 首歌曲\n", tracks.len() - 10));
    }
    
    log::info!("统计测试结果: {}", result);
    Ok(result)
}

// 测试命令：直接检查音频文件封面
#[allow(dead_code)]
#[tauri::command]
async fn test_audio_cover(file_path: String) -> Result<String, String> {
    use lofty::{probe::Probe, prelude::*};
    
    log::info!("测试音频文件封面: {}", file_path);
    
    match Probe::open(&file_path) {
        Ok(probe) => {
            match probe.read() {
                Ok(tagged_file) => {
                    let mut result = format!("文件: {}\n", file_path);
                    
                    // 检查文件格式
                    result.push_str(&format!("格式: {:?}\n", tagged_file.file_type()));
                    
                    // 检查所有标签
                    result.push_str(&format!("标签数量: {}\n", tagged_file.tags().len()));
                    
                    for (i, tag) in tagged_file.tags().iter().enumerate() {
                        result.push_str(&format!("标签 {}: {:?}\n", i, tag.tag_type()));
                        result.push_str(&format!("  图片数量: {}\n", tag.pictures().len()));
                        
                        for (j, picture) in tag.pictures().iter().enumerate() {
                            result.push_str(&format!("  图片 {}: {:?}, {} 字节\n", 
                                j, picture.mime_type(), picture.data().len()));
                        }
                    }
                    
                    // 检查主标签
                    if let Some(primary_tag) = tagged_file.primary_tag() {
                        result.push_str(&format!("主标签: {:?}\n", primary_tag.tag_type()));
                        result.push_str(&format!("主标签图片数量: {}\n", primary_tag.pictures().len()));
                    } else {
                        result.push_str("无主标签\n");
                    }
                    
                    Ok(result)
                }
                Err(e) => Err(format!("读取文件失败: {}", e))
            }
        }
        Err(e) => Err(format!("打开文件失败: {}", e))
    }
}

// Initialize the application - 异步初始化避免阻塞UI
fn init_app(app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logger
    env_logger::init();
    println!("🚀 [INIT] WindChime Player 启动中...");
    log::info!("🚀 WindChime Player 启动中...");

    let app_handle_clone = app_handle.clone();
    
    // 🔥 关键优化：在后台线程异步初始化，避免阻塞主线程和UI
    tauri::async_runtime::spawn(async move {
        println!("📦 [INIT] 进入异步初始化函数...");
        match init_app_async(&app_handle_clone).await {
            Ok(_) => {
                println!("✅ [INIT] WindChime Player 初始化完成");
                log::info!("✅ WindChime Player 初始化完成");
                // 通知前端初始化完成
                let _ = app_handle_clone.emit("app-ready", ());
                println!("📤 [INIT] 已发送 app-ready 事件");
            }
            Err(e) => {
                println!("❌ [INIT] WindChime Player 初始化失败: {}", e);
                log::error!("❌ WindChime Player 初始化失败: {}", e);
                // 通知前端初始化失败
                let _ = app_handle_clone.emit("app-init-error", e.to_string());
            }
        }
    });

    println!("✅ [INIT] UI 线程已就绪，后台初始化进行中...");
    log::info!("✅ UI 线程已就绪，后台初始化进行中...");
    Ok(())
}

// 异步初始化函数 - 在后台执行耗时操作
async fn init_app_async(app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    println!("📦 [INIT] 开始后台初始化...");
    log::info!("📦 开始后台初始化...");
    
    // Get app data directory
    println!("📁 [INIT] 获取应用数据目录...");
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Create app data directory if it doesn't exist
    std::fs::create_dir_all(&app_data_dir)?;
    println!("✅ [INIT] 应用数据目录已创建");

    // Initialize database
    println!("💾 [INIT] 初始化数据库...");
    log::info!("💾 初始化数据库...");
    let db_path = app_data_dir.join("windchime.db");
    let db = Arc::new(Mutex::new(Database::new(db_path)?));
    println!("✅ [INIT] 数据库初始化完成");
    log::info!("✅ 数据库初始化完成");

    // Initialize library
    println!("📚 [INIT] 初始化音乐库...");
    log::info!("📚 初始化音乐库...");
    let (library, library_tx, library_rx) = Library::new(Arc::clone(&db))?;
    library.run();
    println!("✅ [INIT] 音乐库初始化完成");
    log::info!("✅ 音乐库初始化完成");

    // Initialize player（使用新的PlayerCore）
    println!("🎵 [INIT] 初始化播放器（使用PlayerCore架构）...");
    log::info!("🎵 [INIT] 初始化播放器（使用PlayerCore架构）...");
    let player_adapter = PlayerAdapter::new().await
        .map_err(|e| {
            println!("❌ [INIT] 播放器初始化失败: {}", e);
            log::error!("❌ [INIT] 播放器初始化失败: {}", e);
            format!("播放器初始化失败: {}", e)
        })?;
    
    println!("🎵 [INIT] 获取播放器通道...");
    let player_tx = player_adapter.command_sender();
    let player_rx = player_adapter.event_receiver();
    
    println!("✅ [INIT] 播放器初始化完成（懒加载，无阻塞）");
    log::info!("✅ 播放器初始化完成（懒加载，无阻塞）");
    
    // 🔧 添加：等待一小段时间确保异步任务启动
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    println!("✅ [INIT] 播放器异步任务已启动");
    log::info!("✅ 播放器异步任务已启动");

    // Store senders in global state
    PLAYER_TX.set(player_tx.clone()).map_err(|_| "Failed to set player sender")?;
    LIBRARY_TX.set(library_tx.clone()).map_err(|_| "Failed to set library sender")?;
    DB.set(Arc::clone(&db)).map_err(|_| "Failed to set database")?;

    // 流式播放服务已移除，新架构中直接在播放时创建Reader
    println!("📺 [INIT] 流式播放服务已简化为按需创建");
    log::info!("📺 流式播放服务已简化为按需创建");
    println!("✅ [INIT] 流式播放服务初始化完成");
    log::info!("✅ 流式播放服务初始化完成");

    // Store state in Tauri
    let state = AppState {
        player_rx: Arc::new(Mutex::new(player_rx)),
        library_rx: Arc::new(Mutex::new(library_rx)),
        db,
        player_adapter: Arc::new(player_adapter),
    };
    app_handle.manage(state);

    // Start event listeners
    start_event_listeners(app_handle.clone());

    log::info!("🎉 WindChime Player 完全就绪");
    Ok(())
}

fn start_event_listeners(app_handle: AppHandle) {
    let app_handle_clone = app_handle.clone();

    // Player event listener
    tauri::async_runtime::spawn(async move {
        let state: State<AppState> = app_handle_clone.state();
        let rx = state.inner().player_rx.clone();

        loop {
            // 检查关闭信号
            if SHUTDOWN_SIGNAL.load(Ordering::Relaxed) {
                log::info!("播放器事件监听器收到关闭信号，正在退出...");
                break;
            }

            let event_received = {
                if let Ok(guard) = rx.try_lock() {
                    guard.try_recv().ok()
                } else {
                    None
                }
            };

            if let Some(event) = event_received {
                match &event {
                    PlayerEvent::StateChanged(state) => {
                        let _ = app_handle_clone.emit("player-state-changed", state);
                    }
                    PlayerEvent::TrackChanged(track) => {
                        if let Some(ref t) = track {
                            log::debug!("🎵 TrackChanged事件: title={:?}, duration_ms={:?}", 
                                t.title, t.duration_ms);
                            println!("🎵 [EVENT] TrackChanged: title={:?}, duration_ms={:?}ms", 
                                t.title, t.duration_ms);
                        } else {
                            println!("🎵 [EVENT] TrackChanged: None");
                        }
                        let _ = app_handle_clone.emit("player-track-changed", track);
                    }
                    PlayerEvent::PositionChanged(position) => {
                        let _ = app_handle_clone.emit("player-position-changed", position);
                    }
                    PlayerEvent::PlaybackError(error) => {
                        let _ = app_handle_clone.emit("player-error", error);
                    }
                    PlayerEvent::TrackCompleted(track) => {
                        let _ = app_handle_clone.emit("track-completed", track);
                    }
                    PlayerEvent::PlaylistCompleted => {
                        let _ = app_handle_clone.emit("playlist-completed", &());
                    }
                    PlayerEvent::SeekCompleted { position, elapsed_ms } => {
                        log::debug!("⚡ Seek完成: position={}ms, elapsed={}ms", position, elapsed_ms);
                        let _ = app_handle_clone.emit("seek-completed", serde_json::json!({"position": position, "elapsed": elapsed_ms}));
                    }
                    PlayerEvent::AudioDeviceReady => {
                        log::info!("🎵 音频设备就绪");
                        let _ = app_handle_clone.emit("audio-device-ready", ());
                    }
                    PlayerEvent::AudioDeviceFailed { error, recoverable } => {
                        log::error!("❌ 音频设备失败: {} (可恢复: {})", error, recoverable);
                        let _ = app_handle_clone.emit("audio-device-failed", serde_json::json!({"error": error, "recoverable": recoverable}));
                    }
                }
            } else {
                // No events available, sleep briefly
                tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
            }
        }
        log::info!("播放器事件监听器已退出");
    });

    // Library event listener
    tauri::async_runtime::spawn(async move {
        let state: State<AppState> = app_handle.state();
        let rx = state.inner().library_rx.clone();

        loop {
            // 检查关闭信号
            if SHUTDOWN_SIGNAL.load(Ordering::Relaxed) {
                log::info!("音乐库事件监听器收到关闭信号，正在退出...");
                break;
            }

            let event_received = {
                if let Ok(guard) = rx.try_lock() {
                    guard.try_recv().ok()
                } else {
                    None
                }
            };

            if let Some(event) = event_received {
                match &event {
                    LibraryEvent::ScanStarted { .. } => {
                        let _ = app_handle.emit("library-scan-started", &event);
                    }
                    LibraryEvent::ScanProgress(_) => {
                        let _ = app_handle.emit("library-scan-progress", &event);
                    }
                    LibraryEvent::ScanComplete { .. } => {
                        let _ = app_handle.emit("library-scan-complete", &event);
                    }
                    LibraryEvent::TracksLoaded(tracks) => {
                        log::info!("🔔 后端收到TracksLoaded事件，曲目数: {}", tracks.len());
                        let emit_result = app_handle.emit("library-tracks-loaded", tracks);
                        if emit_result.is_ok() {
                            log::info!("✅ 已向前端发送library-tracks-loaded事件");
                        } else {
                            log::error!("❌ 向前端发送library-tracks-loaded事件失败: {:?}", emit_result);
                        }
                    }
                    LibraryEvent::SearchResults(tracks) => {
                        let _ = app_handle.emit("library-search-results", tracks);
                    }
                    LibraryEvent::LibraryStats { total_tracks, total_artists, total_albums } => {
                        let stats_data = serde_json::json!({
                            "total_tracks": total_tracks,
                            "total_artists": total_artists,
                            "total_albums": total_albums
                        });
                        let _ = app_handle.emit("library-stats", stats_data);
                    }
                    LibraryEvent::Error(_) => {
                        let _ = app_handle.emit("library-error", &event);
                    }
                }
            } else {
                // No events available, sleep briefly
                tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
            }
        }
        log::info!("音乐库事件监听器已退出");
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            // Audio file reading (for Web Audio API)
            read_audio_file,
            get_track,
            get_current_position,
            // Player commands
            player_play,
            player_pause,
            player_resume,
            player_stop,
            player_next,
            player_previous,
            player_seek,
            player_set_volume,
            player_set_repeat,
            player_set_shuffle,
            player_load_playlist,
            // Playlist generation commands
            generate_sequential_playlist,
            generate_random_playlist,
            load_playlist_by_mode,
            // Library commands
            library_scan,
            library_get_tracks,
            library_search,
            library_get_stats,
            library_rescan_covers,
            library_get_music_folders,
            library_delete_folder,
            // Lyrics commands
            lyrics_get,
            lyrics_parse,
            lyrics_save,
            lyrics_delete,
            lyrics_refresh,
            lyrics_search_file,
            lyrics_load_file,
            lyrics_extract_from_metadata,
            lyrics_search_comprehensive,
            lyrics_validate,
            lyrics_parse_srt,
            lyrics_parse_ass,
            lyrics_parse_vtt,
            lyrics_auto_detect,
            lyrics_format_as_lrc,
            lyrics_get_current_line,
            // Network API commands (LrcApi)
            network_fetch_lyrics,
            network_fetch_cover,
            artist_cover_save,
            artist_cover_get,
            artist_covers_get_all,
            // Favorites commands
            favorites_add,
            favorites_remove,
            favorites_is_favorite,
            favorites_get_all,
            favorites_toggle,
            favorites_get_count,
            // 企业级歌单命令
            playlists_list,
            playlists_create,
            playlists_get_detail,
            playlists_update,
            playlists_delete,
            playlists_add_tracks,
            playlists_remove_track,
            playlists_reorder_tracks,
            playlists_get_tracks,
            playlists_create_smart,
            playlists_update_smart_rules,
            playlists_refresh_smart,
            playlists_refresh_all_smart,
            playlists_export,
            playlists_export_preview,
            playlists_import,
            playlists_get_stats,
            playlists_mark_played,
            playlists_toggle_favorite,
            // Pin命令
            playlists_pin,
            playlists_unpin,
            playlists_toggle_pin,
            // 播放历史命令
            get_play_history,
            get_play_statistics,
            add_play_history,
            clear_play_history,
            remove_from_history,
            // Window control commands
            minimize_window,
            toggle_maximize,
            close_window,
            // Audio device commands
            check_audio_devices,
            debug_audio_system,
            // Album cover commands
            get_album_cover,
            refresh_track_cover,
            // Audio enhancement commands
            get_audio_enhancement_settings,
            set_audio_enhancement_settings,
            get_equalizer_presets,
            apply_equalizer_preset,
            // Audio diagnostic commands
            diagnose_audio_system,
            fix_audio_system,
            reset_audio_device,
            // System performance monitoring
            get_system_performance,
            // WebDAV commands
            webdav_test_connection,
            webdav_list_directory,
            webdav_get_file_info,
            webdav_file_exists,
            webdav_create_directory,
            webdav_delete_file,
            // 远程音乐源命令 (仅支持WebDAV)
            remote_add_server,
            remote_get_servers,
            remote_delete_server,
            remote_get_cache_stats,
            remote_test_connection,
            remote_check_all_connections,
            remote_browse_directory,
            remote_scan_library,
            // Streaming commands已移除（新架构中后端内部处理）
            // Test commands
            test_library_stats,
        ])
        .setup(|app| {
            if let Err(e) = init_app(app.handle()) {
                log::error!("Failed to initialize app: {}", e);
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Initialization failed: {}", e),
                )));
            }
            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                log::info!("程序正在关闭，开始清理资源...");
                cleanup_resources();
                log::info!("资源清理完成");
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// 资源清理函数
fn cleanup_resources() {
    log::info!("开始清理应用资源...");
    
    // 设置关闭信号，通知所有监听器退出
    SHUTDOWN_SIGNAL.store(true, Ordering::Relaxed);
    log::info!("已发送关闭信号给事件监听器");
    
    // 停止播放器
    if let Some(tx) = PLAYER_TX.get() {
        let _ = tx.send(PlayerCommand::Stop);
        log::info!("已发送停止命令给播放器");
        // 给播放器一些时间来停止
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
    
    // 给事件监听器一些时间来优雅退出
    std::thread::sleep(std::time::Duration::from_millis(100));
    
    log::info!("应用资源清理完成");
}