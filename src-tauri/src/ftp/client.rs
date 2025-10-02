// FTP客户端实现
use super::types::*;
use suppaftp::FtpStream;
use suppaftp::types::FileType as FtpFileType;

/// FTP客户端
#[derive(Clone)]
pub struct FTPClient {
    config: FTPConfig,
}

impl FTPClient {
    /// 创建新的FTP客户端
    pub fn new(config: FTPConfig) -> FTPResult<Self> {
        config.validate()?;
        Ok(Self { config })
    }
    
    /// 连接到FTP服务器（同步）
    fn connect_sync(&self) -> FTPResult<FtpStream> {
        log::info!("连接到 FTP 服务器: {}:{}", self.config.host, self.config.port);
        
        // 连接到服务器
        let address = format!("{}:{}", self.config.host, self.config.port);
        let mut ftp_stream = FtpStream::connect(&address)
            .map_err(|e| FTPError::ConnectionError(format!("连接失败: {}", e)))?;
        
        // 登录
        ftp_stream.login(&self.config.username, &self.config.password)
            .map_err(|e| FTPError::AuthenticationFailed(format!("登录失败: {}", e)))?;
        
        // 设置二进制传输模式（音频文件必须）
        ftp_stream.transfer_type(FtpFileType::Binary)
            .map_err(|e| FTPError::FtpError(format!("设置传输模式失败: {}", e)))?;
        
        log::info!("FTP 连接成功");
        Ok(ftp_stream)
    }
    
    /// 测试连接
    pub async fn test_connection(&self) -> FTPResult<String> {
        let config = self.config.clone();
        let host = config.host.clone();
        let port = config.port;
        
        tokio::task::spawn_blocking(move || {
            let client = FTPClient { config };
            let mut ftp_stream = client.connect_sync()?;
            
            // 获取当前目录
            let pwd = ftp_stream.pwd()
                .map_err(|e| FTPError::FtpError(format!("获取目录失败: {}", e)))?;
            
            // 退出连接
            let _ = ftp_stream.quit();
            
            Ok::<String, FTPError>(format!(
                "✅ FTP 连接成功！\n服务器: {}:{}\n当前目录: {}",
                host, port, pwd
            ))
        })
        .await
        .map_err(|e| FTPError::ConnectionError(format!("任务执行失败: {}", e)))?
    }
    
    /// 列出目录
    pub async fn list_directory(&self, path: &str) -> FTPResult<FTPDirectoryListing> {
        let config = self.config.clone();
        let path = path.to_string();
        
        tokio::task::spawn_blocking(move || {
            let client = FTPClient { config };
            let mut ftp_stream = client.connect_sync()?;
            
            // 切换到目标目录
            if path != "/" && !path.is_empty() {
                ftp_stream.cwd(&path)
                    .map_err(|_| FTPError::FileNotFound { path: path.clone() })?;
            }
            
            // 列出文件
            let list = ftp_stream.list(None)
                .map_err(|e| FTPError::FtpError(format!("列出目录失败: {}", e)))?;
            
            // 解析文件列表
            let mut files = Vec::new();
            for line in list {
                if let Some(file_info) = parse_list_line(&line, &path) {
                    files.push(file_info);
                }
            }
            
            // 退出连接
            let _ = ftp_stream.quit();
            
            Ok::<FTPDirectoryListing, FTPError>(FTPDirectoryListing {
                path,
                total_count: files.len(),
                files,
            })
        })
        .await
        .map_err(|e| FTPError::ConnectionError(format!("任务执行失败: {}", e)))?
    }
    
    /// 获取文件信息
    pub async fn get_file_info(&self, path: &str) -> FTPResult<FTPFileInfo> {
        let config = self.config.clone();
        let path = path.to_string();
        
        tokio::task::spawn_blocking(move || {
            let client = FTPClient { config };
            let mut ftp_stream = client.connect_sync()?;
            
            // 获取文件大小 
            let size = ftp_stream.size(&path).ok().map(|s| s as u64);
            
            // 获取修改时间
            let modified = ftp_stream.mdtm(&path)
                .ok()
                .map(|dt| dt.and_utc().timestamp());
            
            // 退出连接
            let _ = ftp_stream.quit();
            
            let name = path.split('/').last().unwrap_or(&path).to_string();
            
            Ok::<FTPFileInfo, FTPError>(FTPFileInfo {
                path,
                name,
                is_directory: false,
                size,
                modified,
            })
        })
        .await
        .map_err(|e| FTPError::ConnectionError(format!("任务执行失败: {}", e)))?
    }
    
    /// 下载文件为字节数组（用于流式播放）
    pub async fn download_bytes(&self, path: &str) -> FTPResult<Vec<u8>> {
        let config = self.config.clone();
        let path = path.to_string();
        
        tokio::task::spawn_blocking(move || {
            let client = FTPClient { config };
            let mut ftp_stream = client.connect_sync()?;
            
            // 获取文件内容
            let mut data = Vec::new();
            let result = ftp_stream.retr(&path, |reader| {
                std::io::Read::read_to_end(reader, &mut data)
                    .map(|_| ()) // 忽略usize，只需要Ok(())
                    .map_err(|e| suppaftp::FtpError::SecureError(format!("读取失败: {}", e)))
            });
            
            result.map_err(|e| FTPError::FtpError(format!("下载文件失败: {}", e)))?;
            
            // 退出连接
            let _ = ftp_stream.quit();
            
            Ok::<Vec<u8>, FTPError>(data)
        })
        .await
        .map_err(|e| FTPError::ConnectionError(format!("任务执行失败: {}", e)))?
    }
    
    /// 检查文件是否存在
    pub async fn file_exists(&self, path: &str) -> FTPResult<bool> {
        let config = self.config.clone();
        let path = path.to_string();
        
        tokio::task::spawn_blocking(move || {
            let client = FTPClient { config };
            let mut ftp_stream = client.connect_sync()?;
            
            let exists = ftp_stream.size(&path).is_ok();
            
            let _ = ftp_stream.quit();
            
            Ok::<bool, FTPError>(exists)
        })
        .await
        .map_err(|e| FTPError::ConnectionError(format!("任务执行失败: {}", e)))?
    }
}

/// 解析LIST命令返回的行
fn parse_list_line(line: &str, current_path: &str) -> Option<FTPFileInfo> {
    // Unix风格: drwxr-xr-x   2 user  group     4096 Dec  1 10:30 filename
    // Windows风格: 12-01-20  10:30AM       <DIR>          filename
    
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.is_empty() {
        return None;
    }
    
    // Unix风格解析
    if parts[0].starts_with('d') || parts[0].starts_with('-') {
        let is_directory = parts[0].starts_with('d');
        let name = parts.get(8..)?.join(" ");
        
        // 跳过 . 和 ..
        if name == "." || name == ".." {
            return None;
        }
        
        let size = if !is_directory {
            parts.get(4)?.parse::<u64>().ok()
        } else {
            None
        };
        
        let path = if current_path == "/" {
            format!("/{}", name)
        } else {
            format!("{}/{}", current_path.trim_end_matches('/'), name)
        };
        
        return Some(FTPFileInfo {
            path,
            name,
            is_directory,
            size,
            modified: None,
        });
    }
    
    // Windows风格解析
    if parts.len() >= 4 {
        let is_directory = parts.get(2)? == &"<DIR>";
        let name = parts.get(3..)?.join(" ");
        
        let size = if !is_directory {
            parts.get(2)?.parse::<u64>().ok()
        } else {
            None
        };
        
        let path = if current_path == "/" {
            format!("/{}", name)
        } else {
            format!("{}/{}", current_path.trim_end_matches('/'), name)
        };
        
        return Some(FTPFileInfo {
            path,
            name,
            is_directory,
            size,
            modified: None,
        });
    }
    
    None
}