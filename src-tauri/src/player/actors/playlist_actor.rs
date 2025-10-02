// 播放列表管理Actor
//
// 职责：
// - 播放列表管理
// - 随机播放
// - 循环模式控制
// - 智能预加载（可选）

use tokio::sync::{mpsc, oneshot};
use std::collections::VecDeque;
use rand::seq::SliceRandom;
use super::super::types::{Track, PlayerError, PlayerEvent, RepeatMode, Result};

/// 播放列表Actor消息
#[derive(Debug)]
pub enum PlaylistMsg {
    /// 加载播放列表
    LoadPlaylist {
        tracks: Vec<Track>,
        reply: oneshot::Sender<Result<()>>,
    },
    
    /// 获取下一曲
    GetNext(oneshot::Sender<Option<Track>>),
    
    /// 获取上一曲
    GetPrevious(oneshot::Sender<Option<Track>>),
    
    /// 跳转到指定曲目
    JumpTo {
        track_id: i64,
        reply: oneshot::Sender<Result<Track>>,
    },
    
    /// 设置随机播放
    SetShuffle(bool),
    
    /// 设置重复模式
    SetRepeatMode(RepeatMode),
    
    /// 获取当前播放列表
    GetPlaylist(oneshot::Sender<Vec<Track>>),
    
    /// 获取当前索引
    GetCurrentIndex(oneshot::Sender<Option<usize>>),
    
    /// 关闭Actor
    Shutdown,
}

/// 播放列表Actor
pub struct PlaylistActor {
    /// 消息接收器
    inbox: mpsc::Receiver<PlaylistMsg>,
    
    /// 原始播放列表（按加载顺序）
    original_playlist: Vec<Track>,
    
    /// 当前播放队列（可能是随机后的）
    current_queue: VecDeque<Track>,
    
    /// 当前播放索引
    current_index: Option<usize>,
    
    /// 是否随机播放
    shuffle: bool,
    
    /// 重复模式
    repeat_mode: RepeatMode,
    
    /// 播放历史（用于上一曲）
    history: VecDeque<Track>,
    
    /// 历史记录最大长度
    max_history: usize,
    
    /// 事件发送器
    event_tx: mpsc::Sender<PlayerEvent>,
}

impl PlaylistActor {
    /// 创建新的PlaylistActor
    pub fn new(event_tx: mpsc::Sender<PlayerEvent>) -> (Self, mpsc::Sender<PlaylistMsg>) {
        let (tx, rx) = mpsc::channel(32);
        
        let actor = Self {
            inbox: rx,
            original_playlist: Vec::new(),
            current_queue: VecDeque::new(),
            current_index: None,
            shuffle: false,
            repeat_mode: RepeatMode::Off,
            history: VecDeque::new(),
            max_history: 50,
            event_tx,
        };
        
        (actor, tx)
    }
    
    /// 运行Actor事件循环
    pub async fn run(mut self) {
        log::info!("📋 PlaylistActor 启动");
        
        loop {
            match self.inbox.recv().await {
                Some(msg) => {
                    log::debug!("📋 收到消息: {:?}", msg);
                    match msg {
                        PlaylistMsg::LoadPlaylist { tracks, reply } => {
                            log::debug!("📋 处理LoadPlaylist消息，{} 首曲目", tracks.len());
                            let result = self.handle_load_playlist(tracks).await;
                            let _ = reply.send(result);
                        }
                        PlaylistMsg::GetNext(reply) => {
                            let track = self.handle_get_next();
                            let _ = reply.send(track);
                        }
                        PlaylistMsg::GetPrevious(reply) => {
                            let track = self.handle_get_previous();
                            let _ = reply.send(track);
                        }
                        PlaylistMsg::JumpTo { track_id, reply } => {
                            let result = self.handle_jump_to(track_id);
                            let _ = reply.send(result);
                        }
                        PlaylistMsg::SetShuffle(enabled) => {
                            self.handle_set_shuffle(enabled).await;
                        }
                        PlaylistMsg::SetRepeatMode(mode) => {
                            self.handle_set_repeat_mode(mode).await;
                        }
                        PlaylistMsg::GetPlaylist(reply) => {
                            let _ = reply.send(self.original_playlist.clone());
                        }
                        PlaylistMsg::GetCurrentIndex(reply) => {
                            let _ = reply.send(self.current_index);
                        }
                        PlaylistMsg::Shutdown => {
                            log::info!("📋 PlaylistActor 收到关闭信号");
                            break;
                        }
                    }
                }
                None => {
                    log::warn!("📋 PlaylistActor 收件箱关闭");
                    break;
                }
            }
        }
        
        log::info!("📋 PlaylistActor 已停止");
    }
    
    /// 处理加载播放列表
    async fn handle_load_playlist(&mut self, tracks: Vec<Track>) -> Result<()> {
        if tracks.is_empty() {
            return Err(PlayerError::EmptyPlaylist);
        }
        
        log::info!("📋 加载播放列表：{} 首曲目", tracks.len());
        
        self.original_playlist = tracks;
        self.current_index = Some(0);
        self.history.clear();
        
        // 重建播放队列
        self.rebuild_queue();
        
        Ok(())
    }
    
    /// 处理获取下一曲
    fn handle_get_next(&mut self) -> Option<Track> {
        if self.original_playlist.is_empty() {
            return None;
        }
        
        // 单曲循环模式
        if self.repeat_mode == RepeatMode::One {
            if let Some(idx) = self.current_index {
                return self.original_playlist.get(idx).cloned();
            }
        }
        
        // 随机模式
        if self.shuffle {
            return self.get_next_shuffle();
        }
        
        // 顺序播放
        let next_index = match self.current_index {
            Some(idx) => {
                let next = idx + 1;
                if next >= self.original_playlist.len() {
                    // 到达列表末尾
                    match self.repeat_mode {
                        RepeatMode::All => 0, // 列表循环
                        _ => return None,      // 不循环，播放结束
                    }
                } else {
                    next
                }
            }
            None => 0,
        };
        
        self.current_index = Some(next_index);
        let track = self.original_playlist.get(next_index).cloned();
        
        // 添加到历史
        if let Some(t) = &track {
            self.add_to_history(t.clone());
        }
        
        track
    }
    
    /// 处理获取上一曲
    fn handle_get_previous(&mut self) -> Option<Track> {
        // 从历史记录中获取
        if let Some(track) = self.history.pop_back() {
            log::debug!("⏮️ 从历史获取上一曲");
            return Some(track);
        }
        
        // 如果没有历史，返回列表中的上一首
        if self.original_playlist.is_empty() {
            return None;
        }
        
        let prev_index = match self.current_index {
            Some(idx) => {
                if idx == 0 {
                    // 在列表开头
                    match self.repeat_mode {
                        RepeatMode::All => self.original_playlist.len() - 1, // 跳到末尾
                        _ => return None,
                    }
                } else {
                    idx - 1
                }
            }
            None => self.original_playlist.len() - 1,
        };
        
        self.current_index = Some(prev_index);
        self.original_playlist.get(prev_index).cloned()
    }
    
    /// 处理跳转到指定曲目
    fn handle_jump_to(&mut self, track_id: i64) -> Result<Track> {
        log::debug!("📋 收到跳转请求: track_id={}", track_id);
        
        if self.original_playlist.is_empty() {
            log::error!("❌ 播放列表为空！");
            return Err(PlayerError::EmptyPlaylist);
        }
        
        let position = self.original_playlist
            .iter()
            .position(|t| t.id == track_id)
            .ok_or_else(|| {
                log::error!("❌ 未找到track_id={}的曲目", track_id);
                PlayerError::TrackNotFound(track_id)
            })?;
        
        self.current_index = Some(position);
        let track = self.original_playlist[position].clone();
        
        log::debug!("✅ 跳转成功: {:?} (position={})", track.title, position);
        
        Ok(track)
    }
    
    /// 处理设置随机播放
    async fn handle_set_shuffle(&mut self, enabled: bool) {
        log::info!("🔀 设置随机播放: {}", enabled);
        
        self.shuffle = enabled;
        
        if enabled {
            self.rebuild_queue();
        }
    }
    
    /// 处理设置重复模式
    async fn handle_set_repeat_mode(&mut self, mode: RepeatMode) {
        log::info!("🔁 设置重复模式: {:?}", mode);
        self.repeat_mode = mode;
    }
    
    /// 重建播放队列
    fn rebuild_queue(&mut self) {
        self.current_queue.clear();
        
        if self.shuffle {
            // 随机打乱
            let mut rng = rand::thread_rng();
            let mut shuffled = self.original_playlist.clone();
            shuffled.shuffle(&mut rng);
            self.current_queue = shuffled.into();
            
            log::debug!("🔀 播放列表已随机打乱");
        } else {
            self.current_queue = self.original_playlist.iter().cloned().collect();
        }
    }
    
    /// 获取下一首（随机模式）
    fn get_next_shuffle(&mut self) -> Option<Track> {
        // 如果队列为空，重建队列
        if self.current_queue.is_empty() {
            match self.repeat_mode {
                RepeatMode::All => {
                    self.rebuild_queue();
                }
                RepeatMode::One => {
                    // 单曲循环，返回当前曲目
                    if let Some(idx) = self.current_index {
                        return self.original_playlist.get(idx).cloned();
                    }
                }
                RepeatMode::Off => {
                    return None;
                }
            }
        }
        
        let track = self.current_queue.pop_front();
        
        if let Some(t) = &track {
            self.add_to_history(t.clone());
        }
        
        track
    }
    
    /// 添加到历史记录
    fn add_to_history(&mut self, track: Track) {
        self.history.push_back(track);
        
        // 限制历史长度
        if self.history.len() > self.max_history {
            self.history.pop_front();
        }
    }
}

/// PlaylistActor的句柄
#[derive(Clone)]
pub struct PlaylistActorHandle {
    tx: mpsc::Sender<PlaylistMsg>,
}

impl PlaylistActorHandle {
    pub fn new(tx: mpsc::Sender<PlaylistMsg>) -> Self {
        Self { tx }
    }
    
    /// 加载播放列表
    pub async fn load_playlist(&self, tracks: Vec<Track>) -> Result<()> {
        log::debug!("📋 load_playlist 被调用，{} 首曲目", tracks.len());
        let (tx, rx) = oneshot::channel();
        
        self.tx.send(PlaylistMsg::LoadPlaylist { tracks, reply: tx })
            .await
            .map_err(|e| PlayerError::Internal(format!("发送加载列表消息失败: {}", e)))?;
        
        rx.await
            .map_err(|e| PlayerError::Internal(format!("接收加载响应失败: {}", e)))?
    }
    
    /// 获取下一曲
    pub async fn get_next(&self) -> Result<Option<Track>> {
        let (tx, rx) = oneshot::channel();
        
        self.tx.send(PlaylistMsg::GetNext(tx))
            .await
            .map_err(|e| PlayerError::Internal(format!("发送获取下一曲消息失败: {}", e)))?;
        
        rx.await
            .map_err(|e| PlayerError::Internal(format!("接收下一曲响应失败: {}", e)))
    }
    
    /// 获取上一曲
    pub async fn get_previous(&self) -> Result<Option<Track>> {
        let (tx, rx) = oneshot::channel();
        
        self.tx.send(PlaylistMsg::GetPrevious(tx))
            .await
            .map_err(|e| PlayerError::Internal(format!("发送获取上一曲消息失败: {}", e)))?;
        
        rx.await
            .map_err(|e| PlayerError::Internal(format!("接收上一曲响应失败: {}", e)))
    }
    
    /// 跳转到指定曲目
    pub async fn jump_to(&self, track_id: i64) -> Result<Track> {
        let (tx, rx) = oneshot::channel();
        
        self.tx.send(PlaylistMsg::JumpTo { track_id, reply: tx })
            .await
            .map_err(|e| PlayerError::Internal(format!("发送跳转消息失败: {}", e)))?;
        
        rx.await
            .map_err(|e| PlayerError::Internal(format!("接收跳转响应失败: {}", e)))?
    }
    
    /// 设置随机播放
    pub async fn set_shuffle(&self, enabled: bool) -> Result<()> {
        self.tx.send(PlaylistMsg::SetShuffle(enabled))
            .await
            .map_err(|e| PlayerError::Internal(format!("发送设置随机消息失败: {}", e)))
    }
    
    /// 设置重复模式
    pub async fn set_repeat_mode(&self, mode: RepeatMode) -> Result<()> {
        self.tx.send(PlaylistMsg::SetRepeatMode(mode))
            .await
            .map_err(|e| PlayerError::Internal(format!("发送设置重复模式消息失败: {}", e)))
    }
    
    /// 获取播放列表
    pub async fn get_playlist(&self) -> Result<Vec<Track>> {
        let (tx, rx) = oneshot::channel();
        
        self.tx.send(PlaylistMsg::GetPlaylist(tx))
            .await
            .map_err(|e| PlayerError::Internal(format!("发送获取列表消息失败: {}", e)))?;
        
        rx.await
            .map_err(|e| PlayerError::Internal(format!("接收列表响应失败: {}", e)))
    }
    
    /// 获取当前索引
    pub async fn get_current_index(&self) -> Result<Option<usize>> {
        let (tx, rx) = oneshot::channel();
        
        self.tx.send(PlaylistMsg::GetCurrentIndex(tx))
            .await
            .map_err(|e| PlayerError::Internal(format!("发送获取索引消息失败: {}", e)))?;
        
        rx.await
            .map_err(|e| PlayerError::Internal(format!("接收索引响应失败: {}", e)))
    }
    
    /// 关闭
    pub async fn shutdown(&self) -> Result<()> {
        self.tx.send(PlaylistMsg::Shutdown)
            .await
            .map_err(|e| PlayerError::Internal(format!("发送关闭消息失败: {}", e)))
    }
}
