// ============================================================================
// PreloadActor - 智能预加载管理器
// ============================================================================
//
// 职责：
// - 预测下一首将要播放的曲目
// - 提前加载音频数据到缓存
// - 管理预加载缓存（LRU策略）
// - 根据播放模式调整预测策略
//
// 设计原则：
// - 高内聚：只负责预加载相关的逻辑，不涉及播放控制
// - 低耦合：通过消息与其他Actor通信，不直接依赖其他模块
// ============================================================================

use crate::player::{PlayerEvent, RepeatMode, Track};
use anyhow::{Context, Result};
use lru::LruCache;
use std::collections::HashMap;
use std::num::NonZeroUsize;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use tokio::fs;
use tokio::sync::{mpsc, oneshot};
use tokio::task::JoinHandle;

// ============================================================================
// 消息定义
// ============================================================================

/// PreloadActor的消息类型
#[derive(Debug)]
pub enum PreloadMsg {
    /// 开始预加载指定曲目
    PreloadTrack {
        track: Track,
        priority: PreloadPriority,
    },

    /// 批量预加载
    PreloadBatch {
        tracks: Vec<Track>,
        priority: PreloadPriority,
    },

    /// 取消预加载
    CancelPreload { track_id: i64 },

    /// 清空缓存
    ClearCache,

    /// 获取缓存状态
    GetCacheStatus(oneshot::Sender<CacheStatus>),

    /// 更新播放模式（影响预测逻辑）
    UpdatePlayMode {
        repeat_mode: RepeatMode,
        shuffle: bool,
    },

    /// 更新播放列表（用于预测）
    UpdatePlaylist {
        playlist: Vec<Track>,
        current_index: Option<usize>,
    },

    /// 通知当前播放曲目变化
    OnTrackChanged {
        current_track: Track,
        current_index: usize,
    },

    /// 检查缓存是否包含指定曲目
    HasCached {
        track_id: i64,
        respond_to: oneshot::Sender<bool>,
    },

    /// 获取缓存的音频数据
    GetCached {
        track_id: i64,
        respond_to: oneshot::Sender<Option<Arc<Vec<u8>>>>,
    },

    /// 关闭Actor
    Shutdown,
}

/// 预加载优先级
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum PreloadPriority {
    /// 低优先级：预测的可能播放的歌曲
    Low = 0,
    /// 中优先级：预测的下一首
    Medium = 1,
    /// 高优先级：用户明确指定的下一首
    High = 2,
    /// 紧急：即将播放，必须立即加载
    Urgent = 3,
}

// ============================================================================
// 缓存数据结构
// ============================================================================

/// 缓存的音频数据
#[derive(Clone)]
struct CachedAudio {
    /// 曲目ID
    track_id: i64,
    /// 音频原始数据
    data: Arc<Vec<u8>>,
    /// 文件大小（字节）
    size: usize,
    /// 缓存时间
    cached_at: Instant,
    /// 访问次数
    access_count: u32,
    /// 优先级
    priority: PreloadPriority,
}

/// 缓存状态信息
#[derive(Debug, Clone)]
pub struct CacheStatus {
    /// 缓存的曲目数量
    pub cached_count: usize,
    /// 总缓存大小（字节）
    pub total_size: usize,
    /// 最大容量（曲目数）
    pub max_capacity: usize,
    /// 缓存命中次数
    pub hits: u64,
    /// 缓存未命中次数
    pub misses: u64,
    /// 命中率
    pub hit_rate: f64,
}

// ============================================================================
// 音频缓存管理
// ============================================================================

/// 音频缓存管理器
struct AudioCache {
    /// LRU缓存
    cache: LruCache<i64, CachedAudio>,
    /// 最大缓存大小（字节）
    max_size_bytes: usize,
    /// 当前缓存大小（字节）
    current_size: usize,
    /// 缓存命中统计
    hits: u64,
    /// 缓存未命中统计
    misses: u64,
}

impl AudioCache {
    /// 创建新的缓存管理器
    fn new(max_capacity: usize, max_size_mb: usize) -> Self {
        Self {
            cache: LruCache::new(NonZeroUsize::new(max_capacity).unwrap()),
            max_size_bytes: max_size_mb * 1024 * 1024,
            current_size: 0,
            hits: 0,
            misses: 0,
        }
    }

    /// 插入缓存
    fn put(&mut self, audio: CachedAudio) {
        // 如果已存在，先移除旧的
        if let Some(old) = self.cache.get(&audio.track_id) {
            self.current_size -= old.size;
        }

        // 检查是否需要腾出空间
        while self.current_size + audio.size > self.max_size_bytes && !self.cache.is_empty() {
            if let Some((_, removed)) = self.cache.pop_lru() {
                self.current_size -= removed.size;
                log::debug!("缓存已满，移除曲目 {}", removed.track_id);
            }
        }

        // 如果单个文件就超过最大容量，则不缓存
        if audio.size > self.max_size_bytes {
            log::warn!(
                "曲目 {} 大小 {}MB 超过最大缓存容量，跳过缓存",
                audio.track_id,
                audio.size / 1024 / 1024
            );
            return;
        }

        self.current_size += audio.size;
        self.cache.put(audio.track_id, audio);
    }

    /// 获取缓存
    fn get(&mut self, track_id: i64) -> Option<Arc<Vec<u8>>> {
        if let Some(audio) = self.cache.get_mut(&track_id) {
            audio.access_count += 1;
            self.hits += 1;
            Some(audio.data.clone())
        } else {
            self.misses += 1;
            None
        }
    }

    /// 检查是否缓存
    fn contains(&self, track_id: i64) -> bool {
        self.cache.contains(&track_id)
    }

    /// 移除缓存
    fn remove(&mut self, track_id: i64) -> bool {
        if let Some(audio) = self.cache.pop(&track_id) {
            self.current_size -= audio.size;
            true
        } else {
            false
        }
    }

    /// 清空缓存
    fn clear(&mut self) {
        self.cache.clear();
        self.current_size = 0;
    }

    /// 获取缓存状态
    fn status(&self) -> CacheStatus {
        let total = self.hits + self.misses;
        CacheStatus {
            cached_count: self.cache.len(),
            total_size: self.current_size,
            max_capacity: self.cache.cap().get(),
            hits: self.hits,
            misses: self.misses,
            hit_rate: if total > 0 {
                self.hits as f64 / total as f64
            } else {
                0.0
            },
        }
    }
}

// ============================================================================
// PreloadActor实现
// ============================================================================

/// 预加载Actor
pub struct PreloadActor {
    /// 消息接收器
    inbox: mpsc::Receiver<PreloadMsg>,

    /// 缓存管理器
    cache: AudioCache,

    /// 事件发送器
    event_tx: mpsc::Sender<PlayerEvent>,

    /// 当前播放列表
    playlist: Vec<Track>,

    /// 当前播放索引
    current_index: Option<usize>,

    /// 播放模式
    repeat_mode: RepeatMode,

    /// 是否随机播放
    shuffle: bool,

    /// 正在加载的任务
    loading_tasks: HashMap<i64, JoinHandle<()>>,
}

impl PreloadActor {
    /// 创建新的PreloadActor
    pub fn new(
        inbox: mpsc::Receiver<PreloadMsg>,
        event_tx: mpsc::Sender<PlayerEvent>,
        max_cache_capacity: usize,
        max_cache_size_mb: usize,
    ) -> Self {
        Self {
            inbox,
            cache: AudioCache::new(max_cache_capacity, max_cache_size_mb),
            event_tx,
            playlist: Vec::new(),
            current_index: None,
            repeat_mode: RepeatMode::Off,
            shuffle: false,
            loading_tasks: HashMap::new(),
        }
    }

    /// 运行Actor主循环
    pub async fn run(mut self) {
        println!("🔄 [CORE] PreloadActor.run() 方法开始执行");
        log::info!("🔄 PreloadActor 已启动");
        
        println!("🔄 [CORE] PreloadActor 进入事件循环，等待消息...");
        while let Some(msg) = self.inbox.recv().await {
            match msg {
                PreloadMsg::PreloadTrack { track, priority } => {
                    self.handle_preload_track(track, priority).await;
                }

                PreloadMsg::PreloadBatch { tracks, priority } => {
                    self.handle_preload_batch(tracks, priority).await;
                }

                PreloadMsg::CancelPreload { track_id } => {
                    self.handle_cancel_preload(track_id).await;
                }

                PreloadMsg::ClearCache => {
                    self.handle_clear_cache().await;
                }

                PreloadMsg::GetCacheStatus(respond_to) => {
                    let _ = respond_to.send(self.cache.status());
                }

                PreloadMsg::UpdatePlayMode {
                    repeat_mode,
                    shuffle,
                } => {
                    self.handle_update_play_mode(repeat_mode, shuffle).await;
                }

                PreloadMsg::UpdatePlaylist {
                    playlist,
                    current_index,
                } => {
                    self.handle_update_playlist(playlist, current_index).await;
                }

                PreloadMsg::OnTrackChanged {
                    current_track,
                    current_index,
                } => {
                    self.handle_track_changed(current_track, current_index)
                        .await;
                }

                PreloadMsg::HasCached {
                    track_id,
                    respond_to,
                } => {
                    let _ = respond_to.send(self.cache.contains(track_id));
                }

                PreloadMsg::GetCached {
                    track_id,
                    respond_to,
                } => {
                    let data = self.cache.get(track_id);
                    let _ = respond_to.send(data);
                }

                PreloadMsg::Shutdown => {
                    log::info!("🛑 PreloadActor 正在关闭...");
                    self.shutdown().await;
                    break;
                }
            }
        }

        log::info!("✅ PreloadActor 已关闭");
    }

    /// 处理预加载单个曲目
    async fn handle_preload_track(&mut self, track: Track, priority: PreloadPriority) {
        // 如果已在缓存中，跳过
        if self.cache.contains(track.id) {
            log::debug!("曲目 {} 已在缓存中，跳过预加载", track.id);
            return;
        }

        // 如果正在加载，跳过
        if self.loading_tasks.contains_key(&track.id) {
            log::debug!("曲目 {} 正在加载中，跳过", track.id);
            return;
        }

        log::info!(
            "🔄 开始预加载曲目 {} - {:?} (优先级: {:?})",
            track.id,
            track.title,
            priority
        );

        // 启动加载任务
        let track_id = track.id;
        let path = PathBuf::from(&track.path);
        let cache_tx = self.event_tx.clone();

        let handle = tokio::spawn(async move {
            match Self::load_audio_data(&path).await {
                Ok(data) => {
                    log::info!(
                        "✅ 预加载成功: {} ({:.2}MB)",
                        track_id,
                        data.len() as f64 / 1024.0 / 1024.0
                    );

                    // 发送预加载完成事件（可选）
                    let _ = cache_tx
                        .send(PlayerEvent::PreloadCompleted { track_id })
                        .await;
                }
                Err(e) => {
                    log::error!("❌ 预加载失败: {} - {:?}", track_id, e);
                }
            }
        });

        self.loading_tasks.insert(track_id, handle);
    }

    /// 处理批量预加载
    async fn handle_preload_batch(&mut self, tracks: Vec<Track>, priority: PreloadPriority) {
        log::info!("🔄 批量预加载 {} 首曲目 (优先级: {:?})", tracks.len(), priority);

        for track in tracks {
            self.handle_preload_track(track, priority).await;
        }
    }

    /// 处理取消预加载
    async fn handle_cancel_preload(&mut self, track_id: i64) {
        if let Some(handle) = self.loading_tasks.remove(&track_id) {
            handle.abort();
            log::debug!("已取消预加载任务: {}", track_id);
        }
    }

    /// 处理清空缓存
    async fn handle_clear_cache(&mut self) {
        self.cache.clear();
        log::info!("🗑️ 缓存已清空");
    }

    /// 处理播放模式更新
    async fn handle_update_play_mode(&mut self, repeat_mode: RepeatMode, shuffle: bool) {
        self.repeat_mode = repeat_mode;
        self.shuffle = shuffle;
        log::debug!(
            "播放模式已更新: repeat={:?}, shuffle={}",
            repeat_mode,
            shuffle
        );

        // 根据新模式预测并预加载
        self.predict_and_preload().await;
    }

    /// 处理播放列表更新
    async fn handle_update_playlist(&mut self, playlist: Vec<Track>, current_index: Option<usize>) {
        self.playlist = playlist;
        self.current_index = current_index;
        log::debug!(
            "播放列表已更新: {} 首曲目, 当前索引: {:?}",
            self.playlist.len(),
            current_index
        );

        // 预测并预加载
        self.predict_and_preload().await;
    }

    /// 处理当前曲目变化
    async fn handle_track_changed(&mut self, _current_track: Track, current_index: usize) {
        self.current_index = Some(current_index);
        log::debug!("当前曲目已变化: 索引 {}", current_index);

        // 清理已完成的加载任务
        self.loading_tasks.retain(|_, handle| !handle.is_finished());

        // 预测并预加载下一首
        self.predict_and_preload().await;
    }

    /// 预测并预加载下一首曲目
    async fn predict_and_preload(&mut self) {
        let tracks_to_preload = self.predict_next_tracks();

        for (track, priority) in tracks_to_preload {
            self.handle_preload_track(track, priority).await;
        }
    }

    /// 预测下一首曲目（根据播放模式）
    fn predict_next_tracks(&self) -> Vec<(Track, PreloadPriority)> {
        if self.playlist.is_empty() {
            return Vec::new();
        }

        let Some(current_idx) = self.current_index else {
            return Vec::new();
        };

        let mut predictions = Vec::new();

        match self.repeat_mode {
            RepeatMode::Off => {
                // 顺序播放：预加载下一首
                if !self.shuffle && current_idx + 1 < self.playlist.len() {
                    predictions.push((
                        self.playlist[current_idx + 1].clone(),
                        PreloadPriority::High,
                    ));

                    // 预加载下下首（低优先级）
                    if current_idx + 2 < self.playlist.len() {
                        predictions.push((
                            self.playlist[current_idx + 2].clone(),
                            PreloadPriority::Low,
                        ));
                    }
                }
            }

            RepeatMode::All => {
                // 列表循环：预加载下一首（考虑循环）
                let next_idx = (current_idx + 1) % self.playlist.len();
                predictions.push((self.playlist[next_idx].clone(), PreloadPriority::High));

                // 预加载下下首
                let next_next_idx = (current_idx + 2) % self.playlist.len();
                predictions.push((
                    self.playlist[next_next_idx].clone(),
                    PreloadPriority::Medium,
                ));
            }

            RepeatMode::One => {
                // 单曲循环：不需要预加载（当前曲目已在播放）
            }
        }

        // 随机模式：预加载随机2-3首
        if self.shuffle {
            predictions.clear();
            use rand::seq::SliceRandom;
            let mut rng = rand::thread_rng();
            let mut indices: Vec<usize> = (0..self.playlist.len())
                .filter(|&i| i != current_idx)
                .collect();
            indices.shuffle(&mut rng);

            for idx in indices.iter().take(2) {
                predictions.push((
                    self.playlist[*idx].clone(),
                    PreloadPriority::Medium,
                ));
            }
        }

        predictions
    }

    /// 加载音频数据
    async fn load_audio_data(path: &PathBuf) -> Result<Vec<u8>> {
        let data = fs::read(path)
            .await
            .context("读取音频文件失败")?;

        Ok(data)
    }

    /// 关闭Actor
    async fn shutdown(&mut self) {
        // 取消所有加载任务
        for (_, handle) in self.loading_tasks.drain() {
            handle.abort();
        }

        // 清空缓存
        self.cache.clear();
    }
}

// ============================================================================
// PreloadActorHandle - Actor句柄
// ============================================================================

/// PreloadActor的句柄
#[derive(Clone)]
pub struct PreloadActorHandle {
    tx: mpsc::Sender<PreloadMsg>,
}

impl PreloadActorHandle {
    /// 创建新的句柄
    pub fn new(tx: mpsc::Sender<PreloadMsg>) -> Self {
        Self { tx }
    }

    /// 预加载单个曲目
    pub async fn preload_track(&self, track: Track, priority: PreloadPriority) -> Result<()> {
        self.tx
            .send(PreloadMsg::PreloadTrack { track, priority })
            .await
            .context("发送PreloadTrack消息失败")?;
        Ok(())
    }

    /// 批量预加载
    pub async fn preload_batch(
        &self,
        tracks: Vec<Track>,
        priority: PreloadPriority,
    ) -> Result<()> {
        self.tx
            .send(PreloadMsg::PreloadBatch { tracks, priority })
            .await
            .context("发送PreloadBatch消息失败")?;
        Ok(())
    }

    /// 取消预加载
    pub async fn cancel_preload(&self, track_id: i64) -> Result<()> {
        self.tx
            .send(PreloadMsg::CancelPreload { track_id })
            .await
            .context("发送CancelPreload消息失败")?;
        Ok(())
    }

    /// 清空缓存
    pub async fn clear_cache(&self) -> Result<()> {
        self.tx
            .send(PreloadMsg::ClearCache)
            .await
            .context("发送ClearCache消息失败")?;
        Ok(())
    }

    /// 获取缓存状态
    pub async fn get_cache_status(&self) -> Result<CacheStatus> {
        let (tx, rx) = oneshot::channel();
        self.tx
            .send(PreloadMsg::GetCacheStatus(tx))
            .await
            .context("发送GetCacheStatus消息失败")?;
        rx.await.context("接收CacheStatus响应失败")
    }

    /// 更新播放模式
    pub async fn update_play_mode(&self, repeat_mode: RepeatMode, shuffle: bool) -> Result<()> {
        self.tx
            .send(PreloadMsg::UpdatePlayMode {
                repeat_mode,
                shuffle,
            })
            .await
            .context("发送UpdatePlayMode消息失败")?;
        Ok(())
    }

    /// 更新播放列表
    pub async fn update_playlist(
        &self,
        playlist: Vec<Track>,
        current_index: Option<usize>,
    ) -> Result<()> {
        self.tx
            .send(PreloadMsg::UpdatePlaylist {
                playlist,
                current_index,
            })
            .await
            .context("发送UpdatePlaylist消息失败")?;
        Ok(())
    }

    /// 通知曲目变化
    pub async fn on_track_changed(&self, current_track: Track, current_index: usize) -> Result<()> {
        self.tx
            .send(PreloadMsg::OnTrackChanged {
                current_track,
                current_index,
            })
            .await
            .context("发送OnTrackChanged消息失败")?;
        Ok(())
    }

    /// 检查是否已缓存
    pub async fn has_cached(&self, track_id: i64) -> Result<bool> {
        let (tx, rx) = oneshot::channel();
        self.tx
            .send(PreloadMsg::HasCached {
                track_id,
                respond_to: tx,
            })
            .await
            .context("发送HasCached消息失败")?;
        rx.await.context("接收HasCached响应失败")
    }

    /// 获取缓存的音频数据
    pub async fn get_cached(&self, track_id: i64) -> Result<Option<Arc<Vec<u8>>>> {
        let (tx, rx) = oneshot::channel();
        self.tx
            .send(PreloadMsg::GetCached {
                track_id,
                respond_to: tx,
            })
            .await
            .context("发送GetCached消息失败")?;
        rx.await.context("接收GetCached响应失败")
    }

    /// 关闭Actor
    pub async fn shutdown(&self) -> Result<()> {
        self.tx
            .send(PreloadMsg::Shutdown)
            .await
            .context("发送Shutdown消息失败")?;
        Ok(())
    }
}

