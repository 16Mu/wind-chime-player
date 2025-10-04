// WebDAV客户端模块 - 高内聚：专注于WebDAV协议实现
// 低耦合：通过trait接口与其他模块通信

pub mod client;
pub mod auth;
pub mod types;
pub mod safe_stream;
// 已删除：resilient_client（高级弹性客户端，项目使用简化版）
pub mod xml_parser;
pub mod remote_adapter;

pub use auth::*;
pub use client::WebDAVClient;
pub use remote_adapter::WebDAVRemoteAdapter;  // 新增导出
// 重新导出 Stream 转换相关类型
// 安全流类型（暂不导出）
#[allow(unused_imports)]
pub(crate) use safe_stream::{SafeWebDAVStream, SafeStreamConfig};

