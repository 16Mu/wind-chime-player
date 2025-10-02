// WebDAV客户端模块 - 高内聚：专注于WebDAV协议实现
// 低耦合：通过trait接口与其他模块通信

pub mod client;
pub mod auth;
pub mod types;
pub mod safe_stream;
pub mod resilient_client;

pub use auth::*;
pub use client::WebDAVClient;
// 重新导出 Stream 转换相关类型
// 安全流类型（暂不导出）
#[allow(unused_imports)]
pub(crate) use safe_stream::{SafeWebDAVStream, SafeStreamConfig};
// 重新导出类型 - 保留给将来使用
// pub use types::*;

