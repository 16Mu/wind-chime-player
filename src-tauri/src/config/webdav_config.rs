// WebDAV配置 - 极简版

use crate::webdav::AuthType;
use anyhow::Result;
use serde::{Deserialize, Serialize};

/// WebDAV服务器配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebDAVServerConfig {
    /// 服务器名称
    pub name: String,
    
    /// WebDAV服务器URL
    pub url: String,
    
    /// 用户名
    pub username: Option<String>,
    
    /// 密码
    pub password: Option<String>,
    
    /// 是否启用
    pub enabled: bool,
}

impl Default for WebDAVServerConfig {
    fn default() -> Self {
        Self {
            name: "新建服务器".to_string(),
            url: String::new(),
            username: None,
            password: None,
            enabled: true,
        }
    }
}

impl WebDAVServerConfig {
    /// 创建新配置
    pub fn new(name: String, url: String) -> Self {
        Self {
            name,
            url,
            ..Default::default()
        }
    }
    
    /// 转换为WebDAV认证类型
    pub fn to_webdav_auth(&self) -> Result<AuthType> {
        match (&self.username, &self.password) {
            (Some(username), Some(password)) => {
                Ok(AuthType::Basic {
                    username: username.clone(),
                    password: password.clone(),
                })
            }
            _ => Ok(AuthType::None)
        }
    }
}
