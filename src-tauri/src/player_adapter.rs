// PlayerCore适配器 - 提供与旧Player兼容的接口

use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;
use crossbeam_channel::{Receiver, Sender, unbounded};
use crate::player::{PlayerCore, PlayerCoreConfig, PlayerCommand, PlayerEvent};

pub struct PlayerAdapter {
    core: Arc<TokioMutex<PlayerCore>>,
    cmd_tx: Sender<PlayerCommand>,
    cmd_rx: Arc<TokioMutex<Receiver<PlayerCommand>>>,
    event_tx: Sender<PlayerEvent>,
    event_rx: Receiver<PlayerEvent>,
}

impl PlayerAdapter {
    pub async fn new() -> anyhow::Result<Self> {
        log::info!("🔧 开始创建 PlayerAdapter...");
        let core = PlayerCore::new(PlayerCoreConfig::default()).await?;
        log::info!("✅ PlayerCore 创建成功");
        
        let (cmd_tx, cmd_rx) = unbounded();
        let (event_tx, event_rx) = unbounded();
        
        let adapter = Self {
            core: Arc::new(TokioMutex::new(core)),
            cmd_tx,
            cmd_rx: Arc::new(TokioMutex::new(cmd_rx)),
            event_tx,
            event_rx,
        };
        
        log::info!("🚀 启动命令和事件转发循环...");
        adapter.spawn_loops();
        log::info!("✅ PlayerAdapter 创建完成");
        Ok(adapter)
    }
    
    pub fn command_sender(&self) -> Sender<PlayerCommand> {
        self.cmd_tx.clone()
    }
    
    pub fn event_receiver(&self) -> Receiver<PlayerEvent> {
        self.event_rx.clone()
    }
    
    fn spawn_loops(&self) {
        self.spawn_command_loop();
        self.spawn_event_loop();
    }
    
    fn spawn_command_loop(&self) {
        let core = Arc::clone(&self.core);
        let cmd_rx = Arc::clone(&self.cmd_rx);
        
        log::debug!("🚀 启动命令处理循环...");
        
        tauri::async_runtime::spawn(async move {
            log::info!("🔄 命令处理循环已启动");
            
            loop {
                // 🔧 关键优化：一次性获取所有待处理命令，过滤掉过期的Play命令
                let (cmd_to_process, skipped_play_count) = {
                    // 🔧 P1修复：使用spawn_blocking包装同步recv，避免阻塞async runtime
                    let rx_clone = Arc::clone(&cmd_rx);
                    let first_cmd = tokio::task::spawn_blocking(move || {
                        let rx = rx_clone.blocking_lock();
                        rx.recv()
                    }).await;
                    
                    let first_cmd = match first_cmd {
                        Ok(Ok(cmd)) => cmd,
                        _ => {
                            log::info!("Command channel closed or error, exiting loop");
                            break;
                        }
                    };
                    
                    let rx = cmd_rx.lock().await;
                    
                    // 如果不是Play命令，直接处理
                    if !matches!(first_cmd, PlayerCommand::Play(_, _)) {
                        drop(rx);
                        (first_cmd, 0)
                    } else {
                        // 如果是Play命令，检查队列中是否有更新的Play命令
                        let mut latest_play = first_cmd;
                        let mut skipped = 0;
                        let mut non_play_commands = Vec::new();
                        
                        // 继续从队列中获取命令，保留最新的Play命令
                        loop {
                            match rx.try_recv() {
                                Ok(next_cmd) => {
                                    if let PlayerCommand::Play(_, _) = next_cmd {
                                        println!("⏭️ [ADAPTER] 跳过过期Play命令，保留最新");
                                        latest_play = next_cmd;
                                        skipped += 1;
                                    } else {
                                        // 遇到非Play命令，收集起来稍后处理
                                        non_play_commands.push(next_cmd);
                                    }
                                }
                                Err(_) => break, // 队列空了
                            }
                        }
                        
                        drop(rx);
                        
                        // 处理收集到的非Play命令
                        for non_play_cmd in non_play_commands {
                            let mut c = core.lock().await;
                            let _ = c.handle_command(non_play_cmd).await;
                        }
                        
                        (latest_play, skipped)
                    }
                };
                
                if skipped_play_count > 0 {
                    println!("✨ [ADAPTER] 跳过了 {} 个过期Play命令", skipped_play_count);
                    log::info!("✨ [ADAPTER] 跳过了 {} 个过期Play命令", skipped_play_count);
                }
                
                if matches!(cmd_to_process, PlayerCommand::Shutdown) {
                    log::info!("🛑 收到关闭命令");
                    let mut c = core.lock().await;
                    let _ = c.shutdown().await;
                    break;
                }
                
                log::debug!("📨 处理命令: {:?}", cmd_to_process);
                
                // Play命令异步处理，不阻塞循环
                if matches!(cmd_to_process, PlayerCommand::Play(_, _)) {
                    let core_clone = Arc::clone(&core);
                    tauri::async_runtime::spawn(async move {
                        let mut c = core_clone.lock().await;
                        if let Err(e) = c.handle_command(cmd_to_process).await {
                            log::error!("❌ Play命令失败: {}", e);
                        }
                    });
                } else {
                    // 其他命令同步处理
                    let mut c = core.lock().await;
                    let _ = c.handle_command(cmd_to_process).await;
                }
            }
            
            log::info!("⏹️ 命令处理循环已退出");
        });
    }
    
    fn spawn_event_loop(&self) {
        let core = Arc::clone(&self.core);
        let event_tx = self.event_tx.clone();
        
        tauri::async_runtime::spawn(async move {
            log::info!("🔄 事件处理循环已启动");
            
            // 获取event_rx的独立引用，避免锁定PlayerCore
            let event_rx = {
                let c = core.lock().await;
                c.get_event_receiver()
            };
            
            loop {
                let event = {
                    let mut rx = event_rx.lock().await;
                    rx.recv().await
                };
                
                match event {
                    Some(e) => {
                        if event_tx.send(e).is_err() {
                            break;
                        }
                    }
                    None => break,
                }
            }
            
            log::info!("⏹️ 事件处理循环已退出");
        });
    }
}