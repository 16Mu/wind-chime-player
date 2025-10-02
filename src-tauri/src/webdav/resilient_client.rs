// 网络弹性客户端 - 解决网络I/O风险
// 采用多层防护：超时、重试、熔断、降级

use std::time::{Duration, Instant};
use tokio::time::timeout;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// 🛡️ 弹性错误类型 - 明确区分可恢复和不可恢复错误
#[derive(Error, Debug, Clone)]
pub enum ResilientError {
    #[error("网络超时 (可重试): {operation} - 已重试 {attempt}/{max_attempts} 次")]
    NetworkTimeout { 
        operation: String, 
        attempt: u8, 
        max_attempts: u8 
    },
    
    #[error("服务器错误 (可重试): HTTP {status} - {message}")]
    ServerError { 
        status: u16, 
        message: String,
        is_temporary: bool 
    },
    
    #[error("认证失败 (需重新登录): {reason}")]
    AuthenticationFailed { 
        reason: String,
        can_refresh_token: bool 
    },
    
    #[error("网络不可达 (致命): {cause}")]
    NetworkUnreachable { 
        cause: String 
    },
    
    #[error("客户端配置错误 (致命): {issue}")]
    ConfigurationError { 
        issue: String 
    },
}

impl ResilientError {
    /// 判断错误是否可以重试
    pub fn is_retryable(&self) -> bool {
        match self {
            Self::NetworkTimeout { .. } => true,
            Self::ServerError { is_temporary, .. } => *is_temporary,
            Self::AuthenticationFailed { can_refresh_token, .. } => *can_refresh_token,
            Self::NetworkUnreachable { .. } => false,
            Self::ConfigurationError { .. } => false,
        }
    }
    
    /// 获取建议的重试延迟
    pub fn retry_delay(&self, attempt: u8) -> Duration {
        let base_delay = match self {
            Self::NetworkTimeout { .. } => Duration::from_secs(2),
            Self::ServerError { .. } => Duration::from_secs(5),
            Self::AuthenticationFailed { .. } => Duration::from_secs(10),
            _ => Duration::from_secs(1),
        };
        
        // 指数退避 + 简单抖动
        let multiplier = 2_u32.pow(attempt.min(6) as u32);
        // 使用简单的伪随机抖动 (基于 attempt)
        let jitter = ((attempt as u64) * 137) % 1000; // 简单的伪随机
        base_delay * multiplier + Duration::from_millis(jitter)
    }
}

/// 🛡️ 熔断器 - 防止连续失败导致雪崩
#[derive(Debug, Clone)]
pub struct CircuitBreaker {
    failure_threshold: u32,
    recovery_timeout: Duration,
    failure_count: std::sync::Arc<std::sync::atomic::AtomicU32>,
    last_failure_time: std::sync::Arc<std::sync::Mutex<Option<Instant>>>,
    state: std::sync::Arc<std::sync::atomic::AtomicU8>, // 0=Closed, 1=Open, 2=HalfOpen
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CircuitState {
    Closed = 0,   // 正常工作
    Open = 1,     // 熔断开启，拒绝请求
    HalfOpen = 2, // 半开，尝试恢复
}

impl CircuitBreaker {
    pub fn new(failure_threshold: u32, recovery_timeout: Duration) -> Self {
        Self {
            failure_threshold,
            recovery_timeout,
            failure_count: std::sync::Arc::new(std::sync::atomic::AtomicU32::new(0)),
            last_failure_time: std::sync::Arc::new(std::sync::Mutex::new(None)),
            state: std::sync::Arc::new(std::sync::atomic::AtomicU8::new(CircuitState::Closed as u8)),
        }
    }
    
    /// 检查是否允许请求通过
    pub fn can_proceed(&self) -> Result<(), ResilientError> {
        use std::sync::atomic::Ordering;
        
        let current_state = match self.state.load(Ordering::Acquire) {
            0 => CircuitState::Closed,
            1 => CircuitState::Open,
            2 => CircuitState::HalfOpen,
            _ => CircuitState::Closed,
        };
        
        match current_state {
            CircuitState::Closed => Ok(()),
            CircuitState::Open => {
                // 检查是否到了恢复时间
                if let Ok(last_failure) = self.last_failure_time.lock() {
                    if let Some(time) = *last_failure {
                        if time.elapsed() >= self.recovery_timeout {
                            // 转换到半开状态
                            self.state.store(CircuitState::HalfOpen as u8, Ordering::Release);
                            log::info!("熔断器转换到半开状态，尝试恢复");
                            return Ok(());
                        }
                    }
                }
                
                Err(ResilientError::NetworkUnreachable {
                    cause: format!("熔断器开启，服务暂时不可用。将在 {:?} 后重试", 
                                 self.recovery_timeout)
                })
            },
            CircuitState::HalfOpen => Ok(()), // 允许少量请求通过
        }
    }
    
    /// 记录成功请求
    pub fn record_success(&self) {
        use std::sync::atomic::Ordering;
        
        self.failure_count.store(0, Ordering::Release);
        if self.state.load(Ordering::Acquire) == CircuitState::HalfOpen as u8 {
            self.state.store(CircuitState::Closed as u8, Ordering::Release);
            log::info!("熔断器恢复正常");
        }
    }
    
    /// 记录失败请求
    pub fn record_failure(&self) {
        use std::sync::atomic::Ordering;
        
        let current_failures = self.failure_count.fetch_add(1, Ordering::AcqRel) + 1;
        
        if current_failures >= self.failure_threshold {
            self.state.store(CircuitState::Open as u8, Ordering::Release);
            if let Ok(mut last_failure) = self.last_failure_time.lock() {
                *last_failure = Some(Instant::now());
            }
            log::warn!("熔断器开启，连续失败 {} 次", current_failures);
        }
    }
}

/// 🛡️ 弹性WebDAV客户端配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResilientConfig {
    /// 单个操作超时时间
    pub operation_timeout: Duration,
    /// 连接超时时间
    pub connect_timeout: Duration,
    /// 最大重试次数
    pub max_retries: u8,
    /// 熔断器失败阈值
    pub circuit_breaker_threshold: u32,
    /// 熔断器恢复时间
    pub circuit_breaker_recovery: Duration,
    /// 最大并发请求数
    pub max_concurrent_requests: usize,
    /// 响应大小限制 (MB)
    pub max_response_size_mb: u64,
    /// 启用请求去重
    pub enable_deduplication: bool,
}

impl Default for ResilientConfig {
    fn default() -> Self {
        Self {
            operation_timeout: Duration::from_secs(30),
            connect_timeout: Duration::from_secs(10),
            max_retries: 3,
            circuit_breaker_threshold: 5,
            circuit_breaker_recovery: Duration::from_secs(60),
            max_concurrent_requests: 10,
            max_response_size_mb: 100, // 100MB限制
            enable_deduplication: true,
        }
    }
}

/// 🛡️ 弹性WebDAV客户端主体
pub struct ResilientWebDAVClient {
    client: Client,
    config: ResilientConfig,
    circuit_breaker: CircuitBreaker,
    semaphore: tokio::sync::Semaphore,
    request_dedup: std::sync::Arc<std::sync::Mutex<std::collections::HashMap<String, tokio::sync::watch::Receiver<Result<bytes::Bytes, ResilientError>>>>>,
}

impl ResilientWebDAVClient {
    pub fn new(config: ResilientConfig) -> Result<Self, ResilientError> {
        let client = Client::builder()
            .timeout(config.operation_timeout)
            .connect_timeout(config.connect_timeout)
            .pool_max_idle_per_host(10)
            .pool_idle_timeout(Duration::from_secs(30))
            .user_agent("WindChime-WebDAV/1.0")
            .build()
            .map_err(|e| ResilientError::ConfigurationError {
                issue: format!("HTTP客户端创建失败: {}", e)
            })?;
            
        let circuit_breaker = CircuitBreaker::new(
            config.circuit_breaker_threshold,
            config.circuit_breaker_recovery
        );
        
        Ok(Self {
            client,
            config: config.clone(),
            circuit_breaker,
            semaphore: tokio::sync::Semaphore::new(config.max_concurrent_requests),
            request_dedup: std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
        })
    }
    
    /// 🛡️ 弹性HTTP请求 - 核心方法
    pub async fn resilient_request(&self, url: &str) -> Result<bytes::Bytes, ResilientError> {
        // 1. 检查熔断器状态
        self.circuit_breaker.can_proceed()?;
        
        // 2. 获取并发许可
        let _permit = self.semaphore.acquire().await
            .map_err(|_| ResilientError::ConfigurationError {
                issue: "获取并发许可失败".to_string()
            })?;
        
        // 3. 请求去重 (可选)
        if self.config.enable_deduplication {
            if let Some(existing) = self.check_duplicate_request(url).await {
                return existing;
            }
        }
        
        // 4. 重试逻辑
        let mut last_error = None;
        for attempt in 0..=self.config.max_retries {
            match self.execute_request_once(url).await {
                Ok(response) => {
                    self.circuit_breaker.record_success();
                    return Ok(response);
                }
                Err(e) => {
                    last_error = Some(e.clone());
                    self.circuit_breaker.record_failure();
                    
                    if attempt < self.config.max_retries && e.is_retryable() {
                        let delay = e.retry_delay(attempt);
                        log::warn!("请求失败，{}ms后重试 (第{}/{}次): {}", 
                                 delay.as_millis(), attempt + 1, self.config.max_retries, e);
                        tokio::time::sleep(delay).await;
                    } else {
                        break;
                    }
                }
            }
        }
        
        Err(last_error.unwrap_or(ResilientError::NetworkUnreachable {
            cause: "未知错误".to_string()
        }))
    }
    
    /// 执行单次请求
    async fn execute_request_once(&self, url: &str) -> Result<bytes::Bytes, ResilientError> {
        let start_time = Instant::now();
        
        // 带超时的请求执行
        let response = timeout(
            self.config.operation_timeout,
            self.client.get(url).send()
        ).await
        .map_err(|_| ResilientError::NetworkTimeout {
            operation: format!("GET {}", url),
            attempt: 1,
            max_attempts: self.config.max_retries,
        })?
        .map_err(|e| {
            if e.is_timeout() {
                ResilientError::NetworkTimeout {
                    operation: format!("GET {}", url),
                    attempt: 1,
                    max_attempts: self.config.max_retries,
                }
            } else if e.is_connect() {
                ResilientError::NetworkUnreachable {
                    cause: format!("连接失败: {}", e)
                }
            } else {
                ResilientError::ServerError {
                    status: e.status().map(|s| s.as_u16()).unwrap_or(0),
                    message: format!("请求失败: {}", e),
                    is_temporary: true,
                }
            }
        })?;
        
        // 检查响应状态
        if !response.status().is_success() {
            let status = response.status().as_u16();
            let is_temporary = match status {
                429 | 502 | 503 | 504 => true, // 可重试的错误
                401 | 403 => false, // 认证问题
                _ => status >= 500, // 5xx通常是临时的
            };
            
            return Err(if status == 401 || status == 403 {
                ResilientError::AuthenticationFailed {
                    reason: format!("HTTP {}", status),
                    can_refresh_token: status == 401,
                }
            } else {
                ResilientError::ServerError {
                    status,
                    message: format!("HTTP {}", status),
                    is_temporary,
                }
            });
        }
        
        // 检查内容长度限制
        if let Some(content_length) = response.content_length() {
            let max_size = self.config.max_response_size_mb * 1024 * 1024;
            if content_length > max_size {
                return Err(ResilientError::ConfigurationError {
                    issue: format!("响应大小 {}MB 超过限制 {}MB", 
                                 content_length / (1024 * 1024),
                                 self.config.max_response_size_mb)
                });
            }
        }
        
        // 安全地读取响应体
        let bytes = timeout(
            self.config.operation_timeout,
            response.bytes()
        ).await
        .map_err(|_| ResilientError::NetworkTimeout {
            operation: "读取响应体".to_string(),
            attempt: 1,
            max_attempts: self.config.max_retries,
        })?
        .map_err(|e| ResilientError::ServerError {
            status: 0,
            message: format!("读取响应体失败: {}", e),
            is_temporary: true,
        })?;
        
        // 记录性能指标
        let duration = start_time.elapsed();
        log::debug!("WebDAV请求成功: {} ({} bytes, {:?})", url, bytes.len(), duration);
        
        Ok(bytes)
    }
    
    /// 检查重复请求
    async fn check_duplicate_request(&self, _url: &str) -> Option<Result<bytes::Bytes, ResilientError>> {
        // TODO: 实现请求去重逻辑
        // 基于URL和时间窗口的去重
        None
    }
    
    /// 获取客户端健康状态
    pub fn get_health_status(&self) -> HealthStatus {
        HealthStatus {
            circuit_breaker_state: match self.circuit_breaker.state.load(std::sync::atomic::Ordering::Acquire) {
                0 => CircuitState::Closed,
                1 => CircuitState::Open, 
                2 => CircuitState::HalfOpen,
                _ => CircuitState::Closed,
            },
            failure_count: self.circuit_breaker.failure_count.load(std::sync::atomic::Ordering::Acquire),
            available_permits: self.semaphore.available_permits(),
            max_concurrent_requests: self.config.max_concurrent_requests,
        }
    }
}

/// 客户端健康状态
#[derive(Debug, Clone, Serialize)]
pub struct HealthStatus {
    pub circuit_breaker_state: CircuitState,
    pub failure_count: u32,
    pub available_permits: usize,
    pub max_concurrent_requests: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_circuit_breaker() {
        let breaker = CircuitBreaker::new(2, Duration::from_millis(100));
        
        // 正常状态
        assert!(breaker.can_proceed().is_ok());
        
        // 记录失败
        breaker.record_failure();
        breaker.record_failure();
        
        // 应该被熔断
        assert!(breaker.can_proceed().is_err());
        
        // 等待恢复时间
        tokio::time::sleep(Duration::from_millis(150)).await;
        
        // 应该转到半开状态
        assert!(breaker.can_proceed().is_ok());
        
        // 记录成功，应该恢复
        breaker.record_success();
        assert!(breaker.can_proceed().is_ok());
    }
    
    #[test]
    fn test_error_retry_logic() {
        let timeout_error = ResilientError::NetworkTimeout {
            operation: "test".to_string(),
            attempt: 1,
            max_attempts: 3,
        };
        
        assert!(timeout_error.is_retryable());
        
        let config_error = ResilientError::ConfigurationError {
            issue: "test".to_string()
        };
        
        assert!(!config_error.is_retryable());
    }
}
