use crossbeam_channel::{Receiver, Sender};
use std::sync::{Arc, Mutex, OnceLock, atomic::{AtomicBool, Ordering}};
use tauri::{AppHandle, Emitter, Manager, State};
use anyhow::Result;

mod player; // 新的模块化player（已完成重构）
mod player_adapter; // PlayerCore适配器
mod library;
mod db;
mod lyrics;
mod music_source; // 新增：音乐源抽象层
mod webdav; // 新增：WebDAV客户端模块
mod ftp; // 新增：FTP客户端模块
mod config; // 新增：配置管理模块

// 使用新的PlayerCore（通过适配器）
use player::{PlayerCommand, PlayerEvent, Track, RepeatMode};
use player_adapter::PlayerAdapter;
use library::{Library, LibraryCommand, LibraryEvent};
use db::{Database, Lyrics};
use lyrics::{LyricsParser, ParsedLyrics};
use webdav::WebDAVClient;
use webdav::types::{WebDAVConfig, WebDAVFileInfo};
use ftp::FTPClient;
use ftp::types::{FTPConfig, FTPFileInfo};

// Global state
static PLAYER_TX: OnceLock<Sender<PlayerCommand>> = OnceLock::new();
static LIBRARY_TX: OnceLock<Sender<LibraryCommand>> = OnceLock::new();
static SHUTDOWN_SIGNAL: AtomicBool = AtomicBool::new(false);

struct AppState {
    player_rx: Arc<Mutex<Receiver<PlayerEvent>>>,
    library_rx: Arc<Mutex<Receiver<LibraryEvent>>>,
    db: Arc<Mutex<Database>>,
    player_adapter: Arc<PlayerAdapter>,
}

// Tauri Commands
#[tauri::command]
async fn player_play(track_id: i64) -> Result<(), String> {
    println!("🎵 [COMMAND] player_play 被调用: track_id={}", track_id);
    log::info!("🎵 [COMMAND] player_play 被调用: track_id={}", track_id);
    
    let tx = PLAYER_TX.get().ok_or_else(|| {
        println!("❌ [COMMAND] PLAYER_TX 未初始化！");
        log::error!("❌ [COMMAND] PLAYER_TX 未初始化！");
        "Player not initialized".to_string()
    })?;
    
    println!("📤 [COMMAND] 发送 Play 命令到 PlayerAdapter...");
    log::info!("📤 [COMMAND] 发送 Play 命令到 PlayerAdapter...");
    
    tx.send(PlayerCommand::Play(track_id))
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

// 🎵 音质增强命令
// TODO: 需要先定义 AudioEnhancementSettings 类型
/*
#[tauri::command]
async fn get_audio_enhancement_settings() -> Result<AudioEnhancementSettings, String> {
    // TODO: 实现获取音质增强设置
    Ok(AudioEnhancementSettings::default())
}

#[tauri::command]
async fn set_audio_enhancement_settings(settings: AudioEnhancementSettings) -> Result<(), String> {
    // TODO: 实现设置音质增强
    log::info!("🎵 收到音质增强设置更新: enabled={}", settings.enabled);
    Ok(())
}
*/

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

// Playlist commands
#[tauri::command]
async fn playlists_list(state: State<'_, AppState>) -> Result<Vec<db::Playlist>, String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.get_all_playlists().map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_create(name: String, state: State<'_, AppState>) -> Result<i64, String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.create_playlist(&name).map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_delete(playlist_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.delete_playlist(playlist_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_add_track(playlist_id: i64, track_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.add_track_to_playlist(playlist_id, track_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_remove_track(playlist_id: i64, track_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.remove_track_from_playlist(playlist_id, track_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn playlists_get_tracks(playlist_id: i64, state: State<'_, AppState>) -> Result<Vec<Track>, String> {
    let db = state.inner().db.lock().map_err(|e| e.to_string())?;
    db.get_playlist_tracks(playlist_id).map_err(|e| e.to_string())
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
    };
    
    let client = WebDAVClient::new(config)
        .map_err(|e| format!("创建 WebDAV 客户端失败: {}", e))?;
    
    match client.get_file_info(&file_path).await {
        Ok(file_info) => Ok(file_info),
        Err(e) => Err(format!("获取文件信息失败: {}", e)),
    }
}

// ============================================================
// FTP 命令
// ============================================================

/// 测试 FTP 连接
#[tauri::command]
async fn ftp_test_connection(
    host: String,
    port: u16,
    username: String,
    password: String,
    use_tls: bool,
) -> Result<String, String> {
    log::info!("测试 FTP 连接: {}:{}", host, port);
    
    let config = FTPConfig {
        server_id: "test".to_string(),
        name: "测试服务器".to_string(),
        host,
        port,
        username,
        password,
        use_tls,
        timeout_seconds: 30,
    };
    
    let client = FTPClient::new(config)
        .map_err(|e| format!("创建 FTP 客户端失败: {}", e))?;
    
    match client.test_connection().await {
        Ok(result) => Ok(result),
        Err(e) => Err(format!("❌ FTP 连接失败: {}", e)),
    }
}

/// 列出 FTP 目录
#[tauri::command]
async fn ftp_list_directory(
    host: String,
    port: u16,
    username: String,
    password: String,
    use_tls: bool,
    path: String,
) -> Result<Vec<FTPFileInfo>, String> {
    log::info!("列出 FTP 目录: {}", path);
    
    let config = FTPConfig {
        server_id: "browse".to_string(),
        name: "浏览服务器".to_string(),
        host,
        port,
        username,
        password,
        use_tls,
        timeout_seconds: 30,
    };
    
    let client = FTPClient::new(config)
        .map_err(|e| format!("创建 FTP 客户端失败: {}", e))?;
    
    match client.list_directory(&path).await {
        Ok(listing) => Ok(listing.files),
        Err(e) => Err(format!("列出目录失败: {}", e)),
    }
}

/// 获取 FTP 文件信息
#[tauri::command]
async fn ftp_get_file_info(
    host: String,
    port: u16,
    username: String,
    password: String,
    use_tls: bool,
    file_path: String,
) -> Result<FTPFileInfo, String> {
    log::info!("获取 FTP 文件信息: {}", file_path);
    
    let config = FTPConfig {
        server_id: "info".to_string(),
        name: "信息查询".to_string(),
        host,
        port,
        username,
        password,
        use_tls,
        timeout_seconds: 30,
    };
    
    let client = FTPClient::new(config)
        .map_err(|e| format!("创建 FTP 客户端失败: {}", e))?;
    
    match client.get_file_info(&file_path).await {
        Ok(file_info) => Ok(file_info),
        Err(e) => Err(format!("获取文件信息失败: {}", e)),
    }
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
                    PlayerEvent::SeekStarted(position) => {
                        let _ = app_handle_clone.emit("seek-started", position);
                    }
                    PlayerEvent::SeekCompleted { position, elapsed_ms } => {
                        let _ = app_handle_clone.emit("seek-completed", serde_json::json!({"position": position, "elapsed": elapsed_ms}));
                    }
                    PlayerEvent::SeekFailed { position, error } => {
                        let _ = app_handle_clone.emit("seek-failed", serde_json::json!({"position": position, "error": error}));
                    }
                    PlayerEvent::AudioDeviceReady => {
                        log::info!("🎵 音频设备就绪");
                        let _ = app_handle_clone.emit("audio-device-ready", ());
                    }
                    PlayerEvent::AudioDeviceFailed { error, recoverable } => {
                        log::error!("❌ 音频设备失败: {} (可恢复: {})", error, recoverable);
                        let _ = app_handle_clone.emit("audio-device-failed", serde_json::json!({"error": error, "recoverable": recoverable}));
                    }
                    PlayerEvent::PreloadCompleted { track_id } => {
                        log::debug!("🔄 预加载完成: track_id={}", track_id);
                        // 可选：向前端发送事件，用于显示缓存状态
                        let _ = app_handle_clone.emit("preload-completed", serde_json::json!({"track_id": track_id}));
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
        .invoke_handler(tauri::generate_handler![
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
            lyrics_search_file,
            lyrics_load_file,
            lyrics_extract_from_metadata,
            lyrics_search_comprehensive,
            lyrics_validate,
            lyrics_parse_srt,
            lyrics_parse_ass,
            lyrics_parse_vtt,
            lyrics_auto_detect,
            // Favorites commands
            favorites_add,
            favorites_remove,
            favorites_is_favorite,
            favorites_get_all,
            favorites_toggle,
            favorites_get_count,
            // Playlist commands
            playlists_list,
            playlists_create,
            playlists_delete,
            playlists_add_track,
            playlists_remove_track,
            playlists_get_tracks,
            // Window control commands
            minimize_window,
            toggle_maximize,
            close_window,
            // Audio device commands
            check_audio_devices,
            debug_audio_system,
            // Album cover commands
            get_album_cover,
            // Audio enhancement commands
            // TODO: 取消注释当 AudioEnhancementSettings 类型定义后
            // get_audio_enhancement_settings,
            // set_audio_enhancement_settings,
            // Audio diagnostic commands
            diagnose_audio_system,
            fix_audio_system,
            reset_audio_device,
            // WebDAV commands
            webdav_test_connection,
            webdav_list_directory,
            webdav_get_file_info,
            // FTP commands
            ftp_test_connection,
            ftp_list_directory,
            ftp_get_file_info,
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