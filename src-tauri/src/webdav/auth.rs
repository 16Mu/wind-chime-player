// WebDAV认证模块 - 单一职责：处理各种认证方式

use super::types::*;
use base64::prelude::*;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde::{Deserialize, Serialize};

/// 认证类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthType {
    /// 基本认证 (Basic Auth)
    Basic { username: String, password: String },
    
    /// 摘要认证 (Digest Auth) - 未来扩展
    Digest { 
        username: String, 
        password: String,
        realm: Option<String>,
        nonce: Option<String>,
    },
    
    /// Bearer Token认证 - 适用于某些WebDAV实现
    Bearer { token: String },
    
    /// 无认证
    None,
}

/// 认证管理器 - 高内聚：专注于认证逻辑
pub struct AuthManager {
    auth_type: AuthType,
}

impl AuthManager {
    /// 创建新的认证管理器
    pub fn new(auth_type: AuthType) -> Self {
        Self { auth_type }
    }
    
    /// 从WebDAV配置创建认证管理器
    pub fn from_config(config: &WebDAVConfig) -> Self {
        let auth_type = if !config.username.is_empty() {
            AuthType::Basic {
                username: config.username.clone(),
                password: config.password.clone(),
            }
        } else {
            AuthType::None
        };
        
        Self::new(auth_type)
    }
    
    /// 添加认证头到请求
    pub fn add_auth_headers(&self, headers: &mut HeaderMap) -> WebDAVResult<()> {
        match &self.auth_type {
            AuthType::Basic { username, password } => {
                let credentials = format!("{}:{}", username, password);
                let encoded = BASE64_STANDARD.encode(credentials.as_bytes());
                let auth_value = format!("Basic {}", encoded);
                
                headers.insert(
                    AUTHORIZATION,
                    HeaderValue::from_str(&auth_value)
                        .map_err(|e| WebDAVError::ConfigError(format!("无效的认证头: {}", e)))?
                );
                
                log::debug!("已添加Basic认证头");
                Ok(())
            }
            
            AuthType::Bearer { token } => {
                let auth_value = format!("Bearer {}", token);
                headers.insert(
                    AUTHORIZATION,
                    HeaderValue::from_str(&auth_value)
                        .map_err(|e| WebDAVError::ConfigError(format!("无效的Bearer token: {}", e)))?
                );
                
                log::debug!("已添加Bearer认证头");
                Ok(())
            }
            
            AuthType::Digest { username: _, password: _, realm: _, nonce: _ } => {
                // 摘要认证实现 - 暂时返回错误，后续实现
                log::warn!("摘要认证暂未实现");
                Err(WebDAVError::UnsupportedOperation("摘要认证暂未支持".to_string()))
            }
            
            AuthType::None => {
                log::debug!("无需认证");
                Ok(())
            }
        }
    }
    
    /// 检查是否需要认证
    pub fn requires_auth(&self) -> bool {
        !matches!(self.auth_type, AuthType::None)
    }
    
    /// 获取认证类型字符串（用于日志）
    pub fn get_auth_type_name(&self) -> &'static str {
        match self.auth_type {
            AuthType::Basic { .. } => "Basic",
            AuthType::Digest { .. } => "Digest",
            AuthType::Bearer { .. } => "Bearer",
            AuthType::None => "None",
        }
    }
    
    /// 验证认证配置
    pub fn validate(&self) -> WebDAVResult<()> {
        match &self.auth_type {
            AuthType::Basic { username, password } => {
                if username.is_empty() {
                    return Err(WebDAVError::AuthenticationFailed("用户名不能为空".to_string()));
                }
                if password.is_empty() {
                    log::warn!("密码为空，可能导致认证失败");
                }
                Ok(())
            }
            
            AuthType::Bearer { token } => {
                if token.is_empty() {
                    return Err(WebDAVError::AuthenticationFailed("Bearer token不能为空".to_string()));
                }
                Ok(())
            }
            
            AuthType::Digest { username, password, .. } => {
                if username.is_empty() {
                    return Err(WebDAVError::AuthenticationFailed("用户名不能为空".to_string()));
                }
                if password.is_empty() {
                    return Err(WebDAVError::AuthenticationFailed("密码不能为空".to_string()));
                }
                Ok(())
            }
            
            AuthType::None => Ok(()),
        }
    }
    
    /// 从HTTP响应中提取认证挑战信息
    pub fn handle_auth_challenge(&mut self, response: &reqwest::Response) -> WebDAVResult<bool> {
        if response.status() == 401 {
            log::warn!("收到401认证失败响应");
            
            if let Some(www_auth) = response.headers().get("www-authenticate") {
                let auth_header = www_auth.to_str()
                    .map_err(|e| WebDAVError::AuthenticationFailed(format!("无法解析认证头: {}", e)))?;
                
                log::debug!("服务器认证挑战: {}", auth_header);
                
                // 这里可以解析Digest认证的挑战信息
                // 暂时只是记录日志
                if auth_header.starts_with("Digest") {
                    log::info!("服务器要求Digest认证，但当前不支持");
                    return Err(WebDAVError::UnsupportedOperation("服务器要求Digest认证".to_string()));
                }
            }
            
            return Err(WebDAVError::AuthenticationFailed("认证失败，请检查用户名密码".to_string()));
        }
        
        Ok(response.status().is_success())
    }
    
    /// 测试认证是否有效
    pub async fn test_authentication(&self, client: &reqwest::Client, base_url: &str) -> WebDAVResult<bool> {
        let mut headers = HeaderMap::new();
        self.add_auth_headers(&mut headers)?;
        
        // 发送OPTIONS请求测试认证
        let response = client
            .request(reqwest::Method::OPTIONS, base_url)
            .headers(headers)
            .send()
            .await?;
        
        log::info!("认证测试响应状态: {}", response.status());
        
        if response.status() == 401 {
            Err(WebDAVError::AuthenticationFailed("认证测试失败".to_string()))
        } else if response.status().is_success() {
            Ok(true)
        } else {
            Err(WebDAVError::HttpStatusError {
                status: response.status().as_u16(),
                message: format!("认证测试失败: {}", response.status()),
            })
        }
    }
}

/// 认证助手函数
pub mod auth_utils {
    use super::*;
    
    /// 从用户名密码创建Basic认证头值
    pub fn create_basic_auth(username: &str, password: &str) -> String {
        let credentials = format!("{}:{}", username, password);
        let encoded = BASE64_STANDARD.encode(credentials.as_bytes());
        format!("Basic {}", encoded)
    }
    
    /// 验证Base64编码的认证字符串
    pub fn validate_basic_auth(auth_header: &str) -> WebDAVResult<(String, String)> {
        if !auth_header.starts_with("Basic ") {
            return Err(WebDAVError::AuthenticationFailed("不是Basic认证格式".to_string()));
        }
        
        let encoded = auth_header.strip_prefix("Basic ")
            .ok_or_else(|| WebDAVError::AuthenticationFailed("Basic认证格式错误".to_string()))?;
        
        let decoded = BASE64_STANDARD.decode(encoded)
            .map_err(|e| WebDAVError::AuthenticationFailed(format!("Base64解码失败: {}", e)))?;
        
        let credentials = String::from_utf8(decoded)
            .map_err(|e| WebDAVError::AuthenticationFailed(format!("认证信息不是有效UTF-8: {}", e)))?;
        
        let parts: Vec<&str> = credentials.splitn(2, ':').collect();
        if parts.len() != 2 {
            return Err(WebDAVError::AuthenticationFailed("认证信息格式错误".to_string()));
        }
        
        Ok((parts[0].to_string(), parts[1].to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_basic_auth_creation() {
        let manager = AuthManager::new(AuthType::Basic {
            username: "user".to_string(),
            password: "pass".to_string(),
        });
        
        let mut headers = HeaderMap::new();
        assert!(manager.add_auth_headers(&mut headers).is_ok());
        assert!(headers.contains_key(AUTHORIZATION));
    }
    
    #[test]
    fn test_auth_validation() {
        let valid_auth = AuthManager::new(AuthType::Basic {
            username: "user".to_string(),
            password: "pass".to_string(),
        });
        assert!(valid_auth.validate().is_ok());
        
        let invalid_auth = AuthManager::new(AuthType::Basic {
            username: "".to_string(),
            password: "pass".to_string(),
        });
        assert!(invalid_auth.validate().is_err());
    }
}

