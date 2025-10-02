// FTP客户端模块 - 支持FTP/FTPS音乐源
pub mod client;
pub mod types;

pub use client::FTPClient;
// FTP类型（暂不导出）
#[allow(unused_imports)]
pub(crate) use types::*;

