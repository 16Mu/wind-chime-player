// WEBDAV流式播放模块
// 
// 核心实现：
// - 基于HTTP Range协议
// - reqwest自动连接池
// - bytes::Bytes零拷贝
// - 智能内存管理

pub mod webdav_reader;

pub use webdav_reader::WebDAVStreamReader;

