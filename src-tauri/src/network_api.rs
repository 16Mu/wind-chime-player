use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};

/// 网络API服务 - 用于从公开API获取歌词和封面
pub struct NetworkApiService {
    client: reqwest::Client,
    base_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LyricsResult {
    pub content: String,
    pub source: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CoverResult {
    pub data: Vec<u8>,
    pub mime_type: String,
    pub source: String,
}

impl NetworkApiService {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .user_agent("WindChimePlayer/0.4.0")
                .build()
                .unwrap(),
            base_url: "https://api.lrc.cx".to_string(),
        }
    }

    /// 从网络API获取歌词
    /// 
    /// # 参数
    /// - `title`: 歌曲标题
    /// - `artist`: 艺术家名称
    /// - `album`: 专辑名称（可选）
    pub async fn fetch_lyrics(
        &self,
        title: &str,
        artist: &str,
        album: Option<&str>,
    ) -> Result<LyricsResult> {
        log::info!("🌐 从网络API获取歌词: {} - {}", title, artist);

        let url = format!("{}/lyrics", self.base_url);
        let mut params = vec![
            ("title", title),
            ("artist", artist),
        ];
        
        if let Some(album_name) = album {
            params.push(("album", album_name));
        }

        let response = self.client
            .get(&url)
            .query(&params)
            .send()
            .await
            .map_err(|e| anyhow!("网络请求失败: {}", e))?;

        if !response.status().is_success() {
            return Err(anyhow!("API返回错误状态: {}", response.status()));
        }

        let content = response.text().await
            .map_err(|e| anyhow!("读取响应失败: {}", e))?;

        if content.trim().is_empty() {
            return Err(anyhow!("API返回空内容"));
        }

        log::info!("✅ 网络歌词获取成功，长度: {} 字符", content.len());

        Ok(LyricsResult {
            content,
            source: "LrcApi".to_string(),
        })
    }

    /// 从网络API获取封面
    /// 
    /// # 参数
    /// - `title`: 歌曲标题（可选）
    /// - `artist`: 艺术家名称
    /// - `album`: 专辑名称（可选）
    pub async fn fetch_cover(
        &self,
        title: Option<&str>,
        artist: &str,
        album: Option<&str>,
    ) -> Result<CoverResult> {
        log::info!("🌐 从网络API获取封面: {} - {:?}", artist, album);

        let url = format!("{}/cover", self.base_url);
        let mut params: Vec<(&str, &str)> = vec![("artist", artist)];
        
        if let Some(title_name) = title {
            params.push(("title", title_name));
        }
        
        if let Some(album_name) = album {
            params.push(("album", album_name));
        }

        let response = self.client
            .get(&url)
            .query(&params)
            .send()
            .await
            .map_err(|e| anyhow!("网络请求失败: {}", e))?;

        if !response.status().is_success() {
            return Err(anyhow!("API返回错误状态: {}", response.status()));
        }

        // 获取 MIME 类型
        let mime_type = response
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("image/jpeg")
            .to_string();

        let data = response.bytes().await
            .map_err(|e| anyhow!("读取响应失败: {}", e))?
            .to_vec();

        if data.is_empty() {
            return Err(anyhow!("API返回空数据"));
        }

        log::info!("✅ 网络封面获取成功，大小: {} 字节", data.len());

        Ok(CoverResult {
            data,
            mime_type,
            source: "LrcApi".to_string(),
        })
    }
}

impl Default for NetworkApiService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_fetch_lyrics() {
        let service = NetworkApiService::new();
        let result = service.fetch_lyrics("告白气球", "周杰伦", None).await;
        
        match result {
            Ok(lyrics) => {
                println!("歌词长度: {}", lyrics.content.len());
                assert!(!lyrics.content.is_empty());
            }
            Err(e) => {
                println!("获取歌词失败: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_fetch_cover() {
        let service = NetworkApiService::new();
        let result = service.fetch_cover(Some("告白气球"), "周杰伦", None).await;
        
        match result {
            Ok(cover) => {
                println!("封面大小: {} 字节", cover.data.len());
                assert!(!cover.data.is_empty());
            }
            Err(e) => {
                println!("获取封面失败: {}", e);
            }
        }
    }
}

