// 状态同步Actor
//
// 职责：
// - 状态聚合（从各个Actor收集状态）
// - 状态同步（向前端广播状态变化）
// - 状态持久化（可选）

use tokio::sync::{mpsc, watch};
use std::sync::Arc;
use parking_lot::RwLock;
use super::super::types::{PlayerState, PlayerEvent, Track, RepeatMode};

/// 状态Actor消息
#[derive(Debug)]
pub enum StateMsg {
    /// 更新播放状态
    UpdatePlayingState(bool),
    
    /// 更新当前曲目
    UpdateCurrentTrack(Option<Track>),
    
    /// 更新播放位置
    UpdatePosition(u64),
    
    /// 更新音量
    UpdateVolume(f32),
    
    /// 更新重复模式
    UpdateRepeatMode(RepeatMode),
    
    /// 更新随机播放
    UpdateShuffle(bool),
    
    /// 获取完整状态
    GetState(tokio::sync::oneshot::Sender<PlayerState>),
    
    /// 关闭Actor
    Shutdown,
}

/// 状态同步Actor
pub struct StateActor {
    /// 消息接收器
    inbox: mpsc::Receiver<StateMsg>,
    
    /// 共享状态
    state: Arc<RwLock<PlayerState>>,
    
    /// 状态变化广播器
    state_watch_tx: watch::Sender<PlayerState>,
    
    /// 事件发送器
    event_tx: mpsc::Sender<PlayerEvent>,
}

impl StateActor {
    /// 创建新的StateActor
    pub fn new(
        event_tx: mpsc::Sender<PlayerEvent>,
    ) -> (Self, mpsc::Sender<StateMsg>, watch::Receiver<PlayerState>) {
        let (tx, rx) = mpsc::channel(32);
        
        let initial_state = PlayerState::default();
        let (watch_tx, watch_rx) = watch::channel(initial_state.clone());
        
        let actor = Self {
            inbox: rx,
            state: Arc::new(RwLock::new(initial_state)),
            state_watch_tx: watch_tx,
            event_tx,
        };
        
        (actor, tx, watch_rx)
    }
    
    /// 运行Actor事件循环
    pub async fn run(mut self) {
        println!("📊 [CORE] StateActor.run() 方法开始执行");
        log::info!("📊 StateActor 启动");
        
        println!("📊 [CORE] StateActor 进入事件循环，等待消息...");
        loop {
            match self.inbox.recv().await {
                Some(msg) => {
                    match msg {
                        StateMsg::UpdatePlayingState(is_playing) => {
                            self.handle_update_playing_state(is_playing).await;
                        }
                        StateMsg::UpdateCurrentTrack(track) => {
                            self.handle_update_current_track(track).await;
                        }
                        StateMsg::UpdatePosition(position_ms) => {
                            self.handle_update_position(position_ms);
                        }
                        StateMsg::UpdateVolume(volume) => {
                            self.handle_update_volume(volume).await;
                        }
                        StateMsg::UpdateRepeatMode(mode) => {
                            self.handle_update_repeat_mode(mode).await;
                        }
                        StateMsg::UpdateShuffle(shuffle) => {
                            self.handle_update_shuffle(shuffle).await;
                        }
                        StateMsg::GetState(reply) => {
                            let state = self.state.read().clone();
                            let _ = reply.send(state);
                        }
                        StateMsg::Shutdown => {
                            log::info!("📊 StateActor 收到关闭信号");
                            break;
                        }
                    }
                }
                None => {
                    log::warn!("📊 StateActor 收件箱关闭");
                    break;
                }
            }
        }
        
        log::info!("📊 StateActor 已停止");
    }
    
    /// 处理更新播放状态
    async fn handle_update_playing_state(&mut self, is_playing: bool) {
        {
            let mut state = self.state.write();
            if state.is_playing != is_playing {
                state.is_playing = is_playing;
                log::debug!("📊 播放状态更新: {}", is_playing);
            } else {
                return; // 状态未变化，不广播
            }
        }
        
        self.broadcast_state().await;
    }
    
    /// 处理更新当前曲目
    async fn handle_update_current_track(&mut self, track: Option<Track>) {
        {
            let mut state = self.state.write();
            state.current_track = track.clone();
            state.position_ms = 0; // 重置位置
            log::debug!("📊 当前曲目更新: {:?}", track.as_ref().and_then(|t| t.title.as_ref()));
        }
        
        self.broadcast_state().await;
        
        // 发送曲目变化事件
        let _ = self.event_tx.send(PlayerEvent::TrackChanged(track)).await;
    }
    
    /// 处理更新播放位置
    fn handle_update_position(&mut self, position_ms: u64) {
        {
            let mut state = self.state.write();
            state.position_ms = position_ms;
        }
        
        // 位置更新频率高，不广播完整状态，只发送位置事件
        // 位置事件已由PlaybackActor发送，这里不重复发送
    }
    
    /// 处理更新音量
    async fn handle_update_volume(&mut self, volume: f32) {
        {
            let mut state = self.state.write();
            if (state.volume - volume).abs() > 0.001 {
                state.volume = volume;
                log::debug!("📊 音量更新: {:.0}%", volume * 100.0);
            } else {
                return;
            }
        }
        
        self.broadcast_state().await;
    }
    
    /// 处理更新重复模式
    async fn handle_update_repeat_mode(&mut self, mode: RepeatMode) {
        {
            let mut state = self.state.write();
            if state.repeat_mode != mode {
                state.repeat_mode = mode;
                log::debug!("📊 重复模式更新: {:?}", mode);
            } else {
                return;
            }
        }
        
        self.broadcast_state().await;
    }
    
    /// 处理更新随机播放
    async fn handle_update_shuffle(&mut self, shuffle: bool) {
        {
            let mut state = self.state.write();
            if state.shuffle != shuffle {
                state.shuffle = shuffle;
                log::debug!("📊 随机播放更新: {}", shuffle);
            } else {
                return;
            }
        }
        
        self.broadcast_state().await;
    }
    
    /// 广播状态变化
    async fn broadcast_state(&self) {
        let state = self.state.read().clone();
        
        // 通过watch通道广播
        let _ = self.state_watch_tx.send(state.clone());
        
        // 发送状态变化事件到前端
        let _ = self.event_tx.send(PlayerEvent::StateChanged(state)).await;
    }
}

/// StateActor的句柄
#[derive(Clone)]
pub struct StateActorHandle {
    tx: mpsc::Sender<StateMsg>,
    state: Arc<RwLock<PlayerState>>,
}

impl StateActorHandle {
    pub fn new(tx: mpsc::Sender<StateMsg>, state: Arc<RwLock<PlayerState>>) -> Self {
        Self { tx, state }
    }
    
    /// 更新播放状态
    pub async fn update_playing_state(&self, is_playing: bool) {
        let _ = self.tx.send(StateMsg::UpdatePlayingState(is_playing)).await;
    }
    
    /// 更新当前曲目
    pub async fn update_current_track(&self, track: Option<Track>) {
        let _ = self.tx.send(StateMsg::UpdateCurrentTrack(track)).await;
    }
    
    /// 更新播放位置
    pub async fn update_position(&self, position_ms: u64) {
        let _ = self.tx.send(StateMsg::UpdatePosition(position_ms)).await;
    }
    
    /// 更新音量
    pub async fn update_volume(&self, volume: f32) {
        let _ = self.tx.send(StateMsg::UpdateVolume(volume)).await;
    }
    
    /// 更新重复模式
    pub async fn update_repeat_mode(&self, mode: RepeatMode) {
        let _ = self.tx.send(StateMsg::UpdateRepeatMode(mode)).await;
    }
    
    /// 更新随机播放
    pub async fn update_shuffle(&self, shuffle: bool) {
        let _ = self.tx.send(StateMsg::UpdateShuffle(shuffle)).await;
    }
    
    /// 获取当前状态
    pub fn get_state(&self) -> PlayerState {
        self.state.read().clone()
    }
    
    /// 获取当前状态（异步版本，通过消息）
    pub async fn get_state_async(&self) -> PlayerState {
        let (tx, rx) = tokio::sync::oneshot::channel();
        
        if self.tx.send(StateMsg::GetState(tx)).await.is_ok() {
            rx.await.unwrap_or_else(|_| PlayerState::default())
        } else {
            PlayerState::default()
        }
    }
    
    /// 关闭
    pub async fn shutdown(&self) {
        let _ = self.tx.send(StateMsg::Shutdown).await;
    }
}
