// 远程客户端管理器 - 单一职责：管理和缓存远程客户端实例
use crate::remote_source::RemoteSourceClient;
use crate::webdav::{WebDAVClient, WebDAVRemoteAdapter};
use crate::webdav::types::WebDAVConfig;
use crate::db::Database;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::RwLock;
use anyhow::Result;

pub struct RemoteClientManager {
    clients: Arc<RwLock<HashMap<String, Arc<dyn RemoteSourceClient>>>>,
    db: Arc<Mutex<Database>>,
}

impl RemoteClientManager {
    pub fn new(db: Arc<Mutex<Database>>) -> Self {
        Self {
            clients: Arc::new(RwLock::new(HashMap::new())),
            db,
        }
    }

    /// 获取或创建客户端
    pub async fn get_client(&self, server_id: &str) -> Result<Arc<dyn RemoteSourceClient>> {
        // 1. 检查缓存
        {
            let clients = self.clients.read().await;
            if let Some(client) = clients.get(server_id) {
                log::debug!("使用缓存的客户端: {}", server_id);
                return Ok(client.clone());
            }
        }
        
        // 2. 从数据库加载配置
        let (_, _, server_type, config_json, enabled) = {
            let db = self.db.lock().map_err(|e| anyhow::anyhow!("数据库锁定失败: {}", e))?;
            let servers = db.get_remote_servers()?;
            servers.into_iter()
                .find(|(id, _, _, _, _)| id == server_id)
                .ok_or_else(|| anyhow::anyhow!("服务器不存在: {}", server_id))?
        };
        
        if !enabled {
            return Err(anyhow::anyhow!("服务器已禁用"));
        }
        
        // 3. 创建客户端（仅支持WebDAV）
        let client: Arc<dyn RemoteSourceClient> = match server_type.as_str() {
            "webdav" => {
                let config: WebDAVConfig = serde_json::from_str(&config_json)?;
                let webdav_client = WebDAVClient::new(config)?;
                Arc::new(WebDAVRemoteAdapter::new(webdav_client))
            },
            _ => return Err(anyhow::anyhow!("不支持的服务器类型（仅支持WebDAV）: {}", server_type)),
        };
        
        // 4. 缓存客户端
        {
            let mut clients = self.clients.write().await;
            clients.insert(server_id.to_string(), client.clone());
        }
        
        log::info!("创建新客户端: {} ({})", server_id, server_type);
        Ok(client)
    }

    /// 移除客户端缓存（管理功能）
    #[allow(dead_code)]
    pub async fn remove_client(&self, server_id: &str) {
        let mut clients = self.clients.write().await;
        clients.remove(server_id);
        log::info!("移除客户端缓存: {}", server_id);
    }

    /// 清空所有客户端缓存（管理功能）
    #[allow(dead_code)]
    pub async fn clear_all(&self) {
        let mut clients = self.clients.write().await;
        clients.clear();
        log::info!("清空所有客户端缓存");
    }
}

