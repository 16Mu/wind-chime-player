// 远程音乐源统一抽象层
pub mod types;
pub mod client_manager;
pub mod scanner;

pub use types::*;
pub use client_manager::RemoteClientManager;
pub use scanner::RemoteScanner;
// ScanResult 在 types 中已导出









