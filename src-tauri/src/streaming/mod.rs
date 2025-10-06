// 流式播放模块
// 
// 核心实现：
// - HTTP流式传输（chunked encoding）
// - 边接收边播放
// - 零等待启动

pub mod webdav_reader;
pub mod simple_http_reader;

pub use webdav_reader::WebDAVStreamReader;
pub use simple_http_reader::SimpleHttpReader;

