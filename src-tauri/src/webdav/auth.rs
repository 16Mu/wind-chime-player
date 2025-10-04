// WebDAV认证模块 - 单一职责：处理各种认证方式

use super::types::*;
use base64::prelude::*;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 认证类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthType {
    /// 基本认证 (Basic Auth)
    Basic { username: String, password: String },
    
    /// 摘要认证 (Digest Auth)
    Digest { 
        username: String, 
        password: String,
        realm: Option<String>,
        nonce: Option<String>,
        qop: Option<String>,
        opaque: Option<String>,
        algorithm: Option<String>,
        nc: u32,  // nonce count
        cnonce: Option<String>,  // client nonce
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
    /// 
    /// # 参数
    /// * `headers` - 要添加认证头的HeaderMap
    /// * `method` - HTTP方法（用于Digest认证）
    /// * `uri` - 请求URI（用于Digest认证）
    pub fn add_auth_headers_with_request(&self, headers: &mut HeaderMap, method: &str, uri: &str) -> WebDAVResult<()> {
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
            
            AuthType::Digest { username, password, realm, nonce, qop, opaque, algorithm, nc, cnonce } => {
                // Digest认证实现
                if realm.is_none() || nonce.is_none() {
                    log::error!("Digest认证缺少必要参数（realm或nonce）");
                    return Err(WebDAVError::AuthenticationFailed(
                        "Digest认证缺少必要参数".to_string()
                    ));
                }
                
                let realm_str = realm.as_ref().unwrap();
                let nonce_str = nonce.as_ref().unwrap();
                
                // 生成Digest响应
                let response = Self::calculate_digest_response(
                    username,
                    password,
                    realm_str,
                    nonce_str,
                    method,
                    uri,
                    qop.as_deref(),
                    *nc,
                    cnonce.as_deref(),
                    algorithm.as_deref(),
                )?;
                
                // 构建Authorization头
                let mut auth_parts = vec![
                    format!("username=\"{}\"", username),
                    format!("realm=\"{}\"", realm_str),
                    format!("nonce=\"{}\"", nonce_str),
                    format!("uri=\"{}\"", uri),
                    format!("response=\"{}\"", response),
                ];
                
                if let Some(algo) = algorithm {
                    auth_parts.push(format!("algorithm={}", algo));
                }
                
                if let Some(qop_value) = qop {
                    auth_parts.push(format!("qop={}", qop_value));
                    auth_parts.push(format!("nc={:08x}", nc));
                    if let Some(cnonce_value) = cnonce {
                        auth_parts.push(format!("cnonce=\"{}\"", cnonce_value));
                    }
                }
                
                if let Some(opaque_value) = opaque {
                    auth_parts.push(format!("opaque=\"{}\"", opaque_value));
                }
                
                let auth_value = format!("Digest {}", auth_parts.join(", "));
                
                headers.insert(
                    AUTHORIZATION,
                    HeaderValue::from_str(&auth_value)
                        .map_err(|e| WebDAVError::ConfigError(format!("无效的Digest认证头: {}", e)))?
                );
                
                log::debug!("已添加Digest认证头");
                Ok(())
            }
            
            AuthType::None => {
                log::debug!("无需认证");
                Ok(())
            }
        }
    }
    
    /// 添加认证头到请求（简化版，使用默认URI和方法）
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
            
            AuthType::Digest { .. } => {
                // 简化版使用默认值
                self.add_auth_headers_with_request(headers, "GET", "/")
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
                
                // 解析Digest认证的挑战信息
                if auth_header.starts_with("Digest") {
                    log::info!("服务器要求Digest认证，解析挑战信息...");
                    
                    // 获取当前的用户名和密码（如果是Basic认证，升级为Digest）
                    let (username, password) = match &self.auth_type {
                        AuthType::Basic { username, password } => {
                            (username.clone(), password.clone())
                        }
                        AuthType::Digest { username, password, .. } => {
                            (username.clone(), password.clone())
                        }
                        _ => {
                            return Err(WebDAVError::AuthenticationFailed(
                                "无法升级到Digest认证：缺少认证信息".to_string()
                            ));
                        }
                    };
                    
                    // 解析Digest挑战参数
                    let digest_params = Self::parse_digest_challenge(auth_header)?;
                    
                    // 更新认证类型为Digest
                    self.auth_type = AuthType::Digest {
                        username,
                        password,
                        realm: digest_params.get("realm").cloned(),
                        nonce: digest_params.get("nonce").cloned(),
                        qop: digest_params.get("qop").cloned(),
                        opaque: digest_params.get("opaque").cloned(),
                        algorithm: digest_params.get("algorithm").cloned(),
                        nc: 1,
                        cnonce: Some(Self::generate_cnonce()),
                    };
                    
                    log::info!("已升级为Digest认证");
                    return Ok(false); // 表示需要重试
                }
            }
            
            return Err(WebDAVError::AuthenticationFailed("认证失败，请检查用户名密码".to_string()));
        }
        
        Ok(response.status().is_success())
    }
    
    /// 计算Digest响应值
    fn calculate_digest_response(
        username: &str,
        password: &str,
        realm: &str,
        nonce: &str,
        method: &str,
        uri: &str,
        qop: Option<&str>,
        nc: u32,
        cnonce: Option<&str>,
        algorithm: Option<&str>,
    ) -> WebDAVResult<String> {
        // 默认算法为MD5
        let algo = algorithm.unwrap_or("MD5");
        
        if algo != "MD5" && algo != "MD5-sess" {
            return Err(WebDAVError::UnsupportedOperation(
                format!("不支持的Digest算法: {}", algo)
            ));
        }
        
        // 计算 HA1 = MD5(username:realm:password)
        let a1 = format!("{}:{}:{}", username, realm, password);
        let ha1 = format!("{:x}", md5::compute(a1.as_bytes()));
        
        // 如果算法是MD5-sess，需要额外处理
        let ha1 = if algo == "MD5-sess" {
            if let (Some(nonce_val), Some(cnonce_val)) = (Some(nonce), cnonce) {
                let a1_sess = format!("{}:{}:{}", ha1, nonce_val, cnonce_val);
                format!("{:x}", md5::compute(a1_sess.as_bytes()))
            } else {
                return Err(WebDAVError::ConfigError(
                    "MD5-sess算法需要nonce和cnonce".to_string()
                ));
            }
        } else {
            ha1
        };
        
        // 计算 HA2 = MD5(method:uri)
        let a2 = format!("{}:{}", method, uri);
        let ha2 = format!("{:x}", md5::compute(a2.as_bytes()));
        
        // 计算最终响应
        let response = if let Some(qop_value) = qop {
            // 如果有qop，需要包含nc和cnonce
            if let Some(cnonce_val) = cnonce {
                let response_data = format!(
                    "{}:{}:{:08x}:{}:{}:{}",
                    ha1, nonce, nc, cnonce_val, qop_value, ha2
                );
                format!("{:x}", md5::compute(response_data.as_bytes()))
            } else {
                return Err(WebDAVError::ConfigError(
                    "qop认证需要cnonce".to_string()
                ));
            }
        } else {
            // 旧式Digest认证（无qop）
            let response_data = format!("{}:{}:{}", ha1, nonce, ha2);
            format!("{:x}", md5::compute(response_data.as_bytes()))
        };
        
        Ok(response)
    }
    
    /// 解析Digest挑战头
    fn parse_digest_challenge(header: &str) -> WebDAVResult<HashMap<String, String>> {
        let mut params = HashMap::new();
        
        // 移除"Digest "前缀
        let header = header.strip_prefix("Digest ").unwrap_or(header).trim();
        
        // 简单的参数解析（支持带引号和不带引号的值）
        for part in header.split(',') {
            let part = part.trim();
            if let Some((key, value)) = part.split_once('=') {
                let key = key.trim().to_string();
                let value = value.trim()
                    .trim_matches('"')  // 移除引号
                    .to_string();
                params.insert(key, value);
            }
        }
        
        log::debug!("解析到的Digest参数: {:?}", params);
        Ok(params)
    }
    
    /// 生成客户端nonce (cnonce)
    fn generate_cnonce() -> String {
        use rand::Rng;
        let random_bytes: Vec<u8> = (0..16)
            .map(|_| rand::thread_rng().gen())
            .collect();
        format!("{:x}", md5::compute(&random_bytes))
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

