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
                let cmd = {
                    let rx = cmd_rx.lock().await;
                    match rx.try_recv() {
                        Ok(cmd) => {
                            log::debug!("📬 接收到命令: {:?}", cmd);
                            cmd
                        },
                        Err(_) => {
                            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                            continue;
                        }
                    }
                };
                
                if matches!(cmd, PlayerCommand::Shutdown) {
                    log::info!("🛑 收到关闭命令");
                    let mut c = core.lock().await;
                    let _ = c.shutdown().await;
                    break;
                }
                
                log::debug!("📨 开始处理命令: {:?}", cmd);
                
                let mut c = core.lock().await;
                
                if let Err(e) = c.handle_command(cmd).await {
                    log::error!("❌ 命令处理失败: {}", e);
                } else {
                    log::debug!("✅ 命令处理成功");
                }
                
                drop(c);
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