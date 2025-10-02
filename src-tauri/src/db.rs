use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;
use anyhow::Result;
// 🔧 性能优化：添加缓存支持
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

// 使用新的PlayerCore的Track类型
use crate::player::Track;

// 🔧 性能优化：缓存条目结构
#[derive(Debug, Clone)]
struct CacheEntry<T> {
    data: T,
    created_at: Instant,
    ttl: Duration,
}

impl<T> CacheEntry<T> {
    fn new(data: T, ttl: Duration) -> Self {
        Self {
            data,
            created_at: Instant::now(),
            ttl,
        }
    }
    
    fn is_expired(&self) -> bool {
        self.created_at.elapsed() > self.ttl
    }
}

// 🔧 性能优化：数据库查询缓存
#[derive(Debug)]
struct QueryCache {
    // 统计缓存 - 5分钟TTL
    track_count: Option<CacheEntry<i64>>,
    artist_count: Option<CacheEntry<i64>>,
    album_count: Option<CacheEntry<i64>>,
    favorites_count: Option<CacheEntry<i64>>,
    
    // 轨道列表缓存 - 10分钟TTL
    all_tracks: Option<CacheEntry<Vec<Track>>>,
    
    // 搜索结果缓存 - 5分钟TTL，最多缓存50个搜索结果
    search_results: HashMap<String, CacheEntry<Vec<Track>>>,
}

impl QueryCache {
    fn new() -> Self {
        Self {
            track_count: None,
            artist_count: None,
            album_count: None,
            favorites_count: None,
            all_tracks: None,
            search_results: HashMap::new(),
        }
    }
    
    // 清理过期的搜索缓存
    fn cleanup_search_cache(&mut self) {
        self.search_results.retain(|_, entry| !entry.is_expired());
        
        // 限制搜索缓存大小
        if self.search_results.len() > 50 {
            let keys_to_remove: Vec<String> = self.search_results
                .iter()
                .map(|(k, v)| (k.clone(), v.created_at))
                .collect::<Vec<_>>()
                .into_iter()
                .map(|(k, _)| k)
                .take(self.search_results.len() - 40)
                .collect();
            
            for key in keys_to_remove {
                self.search_results.remove(&key);
            }
        }
    }
    
    // 清理所有过期缓存
    fn cleanup_expired(&mut self) {
        if let Some(ref entry) = self.track_count {
            if entry.is_expired() {
                self.track_count = None;
            }
        }
        if let Some(ref entry) = self.artist_count {
            if entry.is_expired() {
                self.artist_count = None;
            }
        }
        if let Some(ref entry) = self.album_count {
            if entry.is_expired() {
                self.album_count = None;
            }
        }
        if let Some(ref entry) = self.favorites_count {
            if entry.is_expired() {
                self.favorites_count = None;
            }
        }
        if let Some(ref entry) = self.all_tracks {
            if entry.is_expired() {
                self.all_tracks = None;
            }
        }
        
        self.cleanup_search_cache();
    }
    
    // 清空与tracks表相关的缓存（当数据发生变化时调用）
    fn invalidate_track_related(&mut self) {
        self.track_count = None;
        self.artist_count = None;
        self.album_count = None;
        self.all_tracks = None;
        self.search_results.clear();
    }
    
    // 清空与favorites表相关的缓存
    #[allow(dead_code)]
    fn invalidate_favorites_related(&mut self) {
        self.favorites_count = None;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: i64,
    pub name: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistItem {
    pub id: i64,
    pub playlist_id: i64,
    pub track_id: i64,
    pub order_index: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lyrics {
    pub id: i64,
    pub track_id: i64,
    pub content: String,
    pub format: String, // "lrc", "plain", etc.
    pub source: String, // "embedded", "file", "online", etc.
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricLine {
    pub timestamp_ms: u64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Favorite {
    pub id: i64,
    pub track_id: i64,
    pub created_at: i64,
}

pub struct Database {
    conn: Connection,
    // 🔧 性能优化：线程安全的查询缓存
    cache: Arc<Mutex<QueryCache>>,
}

impl Database {
    pub fn new<P: AsRef<Path>>(db_path: P) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Database { 
            conn,
            // 🔧 性能优化：初始化查询缓存
            cache: Arc::new(Mutex::new(QueryCache::new())),
        };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<()> {
        // Create tracks table - 扩展支持多种音乐源
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS tracks (
                id INTEGER PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                title TEXT,
                artist TEXT,
                album TEXT,
                duration_ms INTEGER,
                sample_rate INTEGER,
                channels INTEGER,
                last_modified INTEGER,
                file_hash TEXT,
                fingerprint TEXT,
                album_cover_data BLOB,
                album_cover_mime TEXT,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                -- WebDAV和同步支持的新字段
                source_type TEXT DEFAULT 'local' CHECK(source_type IN ('local', 'webdav', 'cached')),
                source_config TEXT, -- JSON格式存储源配置
                sync_status TEXT DEFAULT 'local_only' CHECK(sync_status IN ('local_only', 'remote_only', 'synced', 'conflict', 'syncing', 'sync_error')),
                cache_status TEXT DEFAULT 'none' CHECK(cache_status IN ('none', 'partial', 'cached', 'expired', 'updating')),
                remote_modified INTEGER,
                last_sync INTEGER,
                server_id TEXT -- 关联的WebDAV服务器ID
            )",
            [],
        )?;

        // Migrate existing schema: Add album cover columns if they don't exist
        self.migrate_album_cover_columns()?;
        
        // Migrate existing schema: Add WebDAV and sync support columns
        self.migrate_webdav_support_columns()?;

        // Create playlists table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS playlists (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )",
            [],
        )?;

        // Create playlist_items table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS playlist_items (
                id INTEGER PRIMARY KEY,
                playlist_id INTEGER NOT NULL,
                track_id INTEGER NOT NULL,
                order_index INTEGER NOT NULL,
                FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
                FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create lyrics table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS lyrics (
                id INTEGER PRIMARY KEY,
                track_id INTEGER NOT NULL UNIQUE,
                content TEXT NOT NULL,
                format TEXT NOT NULL DEFAULT 'lrc',
                source TEXT NOT NULL DEFAULT 'file',
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create favorites table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS favorites (
                id INTEGER PRIMARY KEY,
                track_id INTEGER NOT NULL UNIQUE,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create FTS table for search
        self.conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
                title, artist, album, path,
                content='tracks',
                content_rowid='id'
            )",
            [],
        )?;

        // Create WebDAV servers table - 单一职责：管理WebDAV服务器配置
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS webdav_servers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                url TEXT NOT NULL UNIQUE,
                username TEXT,
                password_encrypted TEXT, -- 加密存储的密码
                enabled BOOLEAN DEFAULT 1,
                auto_sync BOOLEAN DEFAULT 0,
                sync_direction TEXT DEFAULT 'bidirectional' CHECK(sync_direction IN ('bidirectional', 'local_to_remote', 'remote_to_local')),
                connection_timeout_seconds INTEGER DEFAULT 30,
                verify_ssl BOOLEAN DEFAULT 1,
                max_retries INTEGER DEFAULT 3,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now')),
                last_connected_at INTEGER,
                connection_status TEXT DEFAULT 'disconnected'
            )",
            [],
        )?;

        // Create sync queue table - 单一职责：管理同步任务队列
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY,
                task_type TEXT NOT NULL CHECK(task_type IN ('upload', 'download', 'delete', 'metadata_sync')),
                track_id INTEGER,
                source_path TEXT NOT NULL,
                target_path TEXT,
                server_id TEXT NOT NULL,
                priority INTEGER DEFAULT 0 CHECK(priority IN (0, 1, 2)), -- 0=低, 1=中, 2=高
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
                progress_percent INTEGER DEFAULT 0 CHECK(progress_percent BETWEEN 0 AND 100),
                error_message TEXT,
                retry_count INTEGER DEFAULT 0,
                max_retries INTEGER DEFAULT 3,
                file_size INTEGER,
                bytes_transferred INTEGER DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                started_at INTEGER,
                completed_at INTEGER,
                FOREIGN KEY (server_id) REFERENCES webdav_servers (id) ON DELETE CASCADE,
                FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create sync conflicts table - 单一职责：管理同步冲突
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS sync_conflicts (
                id INTEGER PRIMARY KEY,
                track_id INTEGER NOT NULL,
                server_id TEXT NOT NULL,
                conflict_type TEXT NOT NULL CHECK(conflict_type IN ('modified_both', 'local_deleted_remote_modified', 'local_modified_remote_deleted', 'different_size', 'different_hash')),
                local_path TEXT,
                remote_path TEXT,
                local_size INTEGER,
                remote_size INTEGER,
                local_modified INTEGER,
                remote_modified INTEGER,
                local_hash TEXT,
                remote_hash TEXT,
                resolution_strategy TEXT CHECK(resolution_strategy IN ('prefer_local', 'prefer_remote', 'prefer_newer', 'manual')),
                resolved BOOLEAN DEFAULT 0,
                resolved_at INTEGER,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE CASCADE,
                FOREIGN KEY (server_id) REFERENCES webdav_servers (id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create sync statistics table - 单一职责：记录同步统计信息
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS sync_statistics (
                id INTEGER PRIMARY KEY,
                server_id TEXT NOT NULL,
                sync_session_id TEXT NOT NULL,
                started_at INTEGER NOT NULL,
                completed_at INTEGER,
                total_files INTEGER DEFAULT 0,
                files_uploaded INTEGER DEFAULT 0,
                files_downloaded INTEGER DEFAULT 0,
                files_deleted INTEGER DEFAULT 0,
                files_skipped INTEGER DEFAULT 0,
                bytes_uploaded INTEGER DEFAULT 0,
                bytes_downloaded INTEGER DEFAULT 0,
                conflicts_detected INTEGER DEFAULT 0,
                conflicts_resolved INTEGER DEFAULT 0,
                errors_count INTEGER DEFAULT 0,
                success BOOLEAN DEFAULT 0,
                error_message TEXT,
                FOREIGN KEY (server_id) REFERENCES webdav_servers (id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create cache metadata table - 单一职责：管理缓存元数据
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS cache_metadata (
                id INTEGER PRIMARY KEY,
                track_id INTEGER NOT NULL,
                original_source_type TEXT NOT NULL,
                original_path TEXT NOT NULL,
                cache_path TEXT NOT NULL UNIQUE,
                cache_size INTEGER,
                cached_at INTEGER DEFAULT (strftime('%s', 'now')),
                expires_at INTEGER,
                access_count INTEGER DEFAULT 0,
                last_accessed INTEGER DEFAULT (strftime('%s', 'now')),
                is_complete BOOLEAN DEFAULT 1,
                cache_quality TEXT DEFAULT 'full' CHECK(cache_quality IN ('full', 'partial', 'preview')),
                FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create indexes for performance - 低耦合：优化查询性能
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tracks_path ON tracks(path)",
            [],
        )?;
        
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tracks_source_type ON tracks(source_type)",
            [],
        )?;
        
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tracks_server_id ON tracks(server_id)",
            [],
        )?;
        
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tracks_sync_status ON tracks(sync_status)",
            [],
        )?;
        
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status, priority)",
            [],
        )?;
        
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sync_queue_server ON sync_queue(server_id, status)",
            [],
        )?;
        
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sync_conflicts_resolved ON sync_conflicts(resolved, created_at)",
            [],
        )?;
        
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_cache_metadata_expires ON cache_metadata(expires_at)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_lyrics_track ON lyrics(track_id)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_favorites_track ON favorites(track_id)",
            [],
        )?;

        // Create triggers to sync with FTS
        self.conn.execute(
            "CREATE TRIGGER IF NOT EXISTS tracks_ai AFTER INSERT ON tracks BEGIN
                INSERT INTO tracks_fts(rowid, title, artist, album, path) 
                VALUES (new.id, new.title, new.artist, new.album, new.path);
            END",
            [],
        )?;

        self.conn.execute(
            "CREATE TRIGGER IF NOT EXISTS tracks_ad AFTER DELETE ON tracks BEGIN
                INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album, path) 
                VALUES('delete', old.id, old.title, old.artist, old.album, old.path);
            END",
            [],
        )?;

        self.conn.execute(
            "CREATE TRIGGER IF NOT EXISTS tracks_au AFTER UPDATE ON tracks BEGIN
                INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album, path) 
                VALUES('delete', old.id, old.title, old.artist, old.album, old.path);
                INSERT INTO tracks_fts(rowid, title, artist, album, path) 
                VALUES (new.id, new.title, new.artist, new.album, new.path);
            END",
            [],
        )?;

        Ok(())
    }

    /// 迁移专辑封面字段到现有数据库
    fn migrate_album_cover_columns(&self) -> Result<()> {
        // 检查是否需要添加专辑封面字段
        let column_exists = self.conn.prepare("SELECT album_cover_data FROM tracks LIMIT 1");
        
        if column_exists.is_err() {
            // 字段不存在，需要添加
            log::info!("添加专辑封面字段到现有数据库");
            
            self.conn.execute(
                "ALTER TABLE tracks ADD COLUMN album_cover_data BLOB",
                [],
            )?;
            
            self.conn.execute(
                "ALTER TABLE tracks ADD COLUMN album_cover_mime TEXT",
                [],
            )?;
            
            log::info!("专辑封面字段添加成功");
        }
        
        Ok(())
    }
    
    /// 迁移WebDAV和同步支持字段到现有数据库
    fn migrate_webdav_support_columns(&self) -> Result<()> {
        // 检查并添加source_type字段
        let source_type_exists = self.conn.prepare("SELECT source_type FROM tracks LIMIT 1");
        if source_type_exists.is_err() {
            log::info!("添加source_type字段到tracks表");
            self.conn.execute(
                "ALTER TABLE tracks ADD COLUMN source_type TEXT DEFAULT 'local' CHECK(source_type IN ('local', 'webdav', 'cached'))",
                []
            )?;
        }
        
        // 检查并添加source_config字段
        let source_config_exists = self.conn.prepare("SELECT source_config FROM tracks LIMIT 1");
        if source_config_exists.is_err() {
            log::info!("添加source_config字段到tracks表");
            self.conn.execute(
                "ALTER TABLE tracks ADD COLUMN source_config TEXT",
                []
            )?;
        }
        
        // 检查并添加sync_status字段
        let sync_status_exists = self.conn.prepare("SELECT sync_status FROM tracks LIMIT 1");
        if sync_status_exists.is_err() {
            log::info!("添加sync_status字段到tracks表");
            self.conn.execute(
                "ALTER TABLE tracks ADD COLUMN sync_status TEXT DEFAULT 'local_only' CHECK(sync_status IN ('local_only', 'remote_only', 'synced', 'conflict', 'syncing', 'sync_error'))",
                []
            )?;
        }
        
        // 检查并添加cache_status字段
        let cache_status_exists = self.conn.prepare("SELECT cache_status FROM tracks LIMIT 1");
        if cache_status_exists.is_err() {
            log::info!("添加cache_status字段到tracks表");
            self.conn.execute(
                "ALTER TABLE tracks ADD COLUMN cache_status TEXT DEFAULT 'none' CHECK(cache_status IN ('none', 'partial', 'cached', 'expired', 'updating'))",
                []
            )?;
        }
        
        // 检查并添加remote_modified字段
        let remote_modified_exists = self.conn.prepare("SELECT remote_modified FROM tracks LIMIT 1");
        if remote_modified_exists.is_err() {
            log::info!("添加remote_modified字段到tracks表");
            self.conn.execute(
                "ALTER TABLE tracks ADD COLUMN remote_modified INTEGER",
                []
            )?;
        }
        
        // 检查并添加last_sync字段
        let last_sync_exists = self.conn.prepare("SELECT last_sync FROM tracks LIMIT 1");
        if last_sync_exists.is_err() {
            log::info!("添加last_sync字段到tracks表");
            self.conn.execute(
                "ALTER TABLE tracks ADD COLUMN last_sync INTEGER",
                []
            )?;
        }
        
        // 检查并添加server_id字段
        let server_id_exists = self.conn.prepare("SELECT server_id FROM tracks LIMIT 1");
        if server_id_exists.is_err() {
            log::info!("添加server_id字段到tracks表");
            self.conn.execute(
                "ALTER TABLE tracks ADD COLUMN server_id TEXT",
                []
            )?;
        }
        
        log::info!("WebDAV支持字段迁移完成");
        Ok(())
    }

    pub fn insert_track(&self, track: &Track) -> Result<i64> {
        let mut stmt = self.conn.prepare(
            "INSERT INTO tracks (path, title, artist, album, duration_ms, album_cover_data, album_cover_mime, last_modified)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(path) DO UPDATE SET
                title = excluded.title,
                artist = excluded.artist,
                album = excluded.album,
                duration_ms = excluded.duration_ms,
                album_cover_data = excluded.album_cover_data,
                album_cover_mime = excluded.album_cover_mime,
                last_modified = excluded.last_modified"
        )?;

        let last_modified = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        stmt.execute(params![
            track.path,
            track.title,
            track.artist,
            track.album,
            track.duration_ms,
            track.album_cover_data,
            track.album_cover_mime,
            last_modified
        ])?;

        // 🔧 性能优化：失效与tracks表相关的缓存
        if let Ok(mut cache) = self.cache.lock() {
            cache.invalidate_track_related();
        }

        Ok(self.conn.last_insert_rowid())
    }

    pub fn get_track_by_id(&self, id: i64) -> Result<Option<Track>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, title, artist, album, duration_ms, album_cover_data, album_cover_mime FROM tracks WHERE id = ?1"
        )?;

        let track = stmt.query_row([id], |row| {
            Ok(Track {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                artist: row.get(3)?,
                album: row.get(4)?,
                duration_ms: row.get(5)?,
                album_cover_data: row.get(6)?,
                album_cover_mime: row.get(7)?,
            })
        });

        match track {
            Ok(track) => Ok(Some(track)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn get_track_by_path(&self, path: &str) -> Result<Option<Track>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, title, artist, album, duration_ms, album_cover_data, album_cover_mime FROM tracks WHERE path = ?1"
        )?;

        let track = stmt.query_row([path], |row| {
            Ok(Track {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                artist: row.get(3)?,
                album: row.get(4)?,
                duration_ms: row.get(5)?,
                album_cover_data: row.get(6)?,
                album_cover_mime: row.get(7)?,
            })
        });

        match track {
            Ok(track) => Ok(Some(track)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn get_all_tracks(&self) -> Result<Vec<Track>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, title, artist, album, duration_ms, album_cover_data, album_cover_mime FROM tracks ORDER BY artist, album, title"
        )?;

        let track_iter = stmt.query_map([], |row| {
            Ok(Track {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                artist: row.get(3)?,
                album: row.get(4)?,
                duration_ms: row.get(5)?,
                album_cover_data: row.get(6)?,
                album_cover_mime: row.get(7)?,
            })
        })?;

        let mut tracks = Vec::new();
        for track in track_iter {
            tracks.push(track?);
        }

        Ok(tracks)
    }

    pub fn search_tracks(&self, query: &str) -> Result<Vec<Track>> {
        if query.trim().is_empty() {
            return self.get_all_tracks();
        }

        // 构建模糊搜索查询
        let fuzzy_queries = self.build_fuzzy_search_queries(query);
        let mut all_tracks = Vec::new();
        let mut seen_ids = std::collections::HashSet::new();

        // 尝试多种搜索策略，按相关性排序
        for (search_query, _priority) in fuzzy_queries {
            let mut stmt = self.conn.prepare(
                "SELECT t.id, t.path, t.title, t.artist, t.album, t.duration_ms, t.album_cover_data, t.album_cover_mime 
                 FROM tracks t
                 JOIN tracks_fts fts ON t.id = fts.rowid 
                 WHERE tracks_fts MATCH ?1
                 ORDER BY rank"
            )?;

            let track_iter = stmt.query_map([&search_query], |row| {
                Ok(Track {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    title: row.get(2)?,
                    artist: row.get(3)?,
                    album: row.get(4)?,
                    duration_ms: row.get(5)?,
                    album_cover_data: row.get(6)?,
                    album_cover_mime: row.get(7)?,
                })
            });

            if let Ok(iter) = track_iter {
                for track in iter {
                    if let Ok(track) = track {
                        if !seen_ids.contains(&track.id) {
                            seen_ids.insert(track.id);
                            all_tracks.push(track);
                        }
                    }
                }
            }
        }

        // 如果 FTS 搜索没有结果，回退到 LIKE 模糊搜索
        if all_tracks.is_empty() {
            all_tracks = self.fallback_like_search(query)?;
        }

        Ok(all_tracks)
    }

    fn build_fuzzy_search_queries(&self, query: &str) -> Vec<(String, i32)> {
        let mut queries = Vec::new();
        let normalized_query = query.trim().to_lowercase();

        // 1. 精确匹配（最高优先级）
        queries.push((format!("\"{}\"", normalized_query), 1));

        // 2. 前缀匹配
        let terms: Vec<&str> = normalized_query.split_whitespace().collect();
        if !terms.is_empty() {
            let prefix_terms: Vec<String> = terms.iter().map(|t| format!("{}*", t)).collect();
            queries.push((prefix_terms.join(" "), 2));
        }

        // 3. 任意词匹配
        if terms.len() > 1 {
            queries.push((terms.join(" OR "), 3));
        }

        // 4. 单个词的前缀匹配
        for term in &terms {
            if term.len() > 1 {
                queries.push((format!("{}*", term), 4));
            }
        }

        queries
    }

    fn fallback_like_search(&self, query: &str) -> Result<Vec<Track>> {
        let pattern = format!("%{}%", query.trim().to_lowercase());
        
        let mut stmt = self.conn.prepare(
            "SELECT id, path, title, artist, album, duration_ms, album_cover_data, album_cover_mime
             FROM tracks 
             WHERE LOWER(title) LIKE ?1 
                OR LOWER(artist) LIKE ?1 
                OR LOWER(album) LIKE ?1
             ORDER BY 
                CASE 
                    WHEN LOWER(title) LIKE ?1 THEN 1
                    WHEN LOWER(artist) LIKE ?1 THEN 2
                    WHEN LOWER(album) LIKE ?1 THEN 3
                    ELSE 4
                END,
                title, artist"
        )?;

        let track_iter = stmt.query_map([&pattern], |row| {
            Ok(Track {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                artist: row.get(3)?,
                album: row.get(4)?,
                duration_ms: row.get(5)?,
                album_cover_data: row.get(6)?,
                album_cover_mime: row.get(7)?,
            })
        })?;

        let mut tracks = Vec::new();
        for track in track_iter {
            tracks.push(track?);
        }

        Ok(tracks)
    }

    pub fn create_playlist(&self, name: &str) -> Result<i64> {
        let mut stmt = self.conn.prepare(
            "INSERT INTO playlists (name) VALUES (?1)"
        )?;

        stmt.execute([name])?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn get_all_playlists(&self) -> Result<Vec<Playlist>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, created_at FROM playlists ORDER BY created_at DESC"
        )?;

        let playlist_iter = stmt.query_map([], |row| {
            Ok(Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
            })
        })?;

        let mut playlists = Vec::new();
        for playlist in playlist_iter {
            playlists.push(playlist?);
        }

        Ok(playlists)
    }

    pub fn add_track_to_playlist(&self, playlist_id: i64, track_id: i64) -> Result<()> {
        // Get the next order index
        let order_index: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(order_index), -1) + 1 FROM playlist_items WHERE playlist_id = ?1",
            [playlist_id],
            |row| row.get(0),
        )?;

        let mut stmt = self.conn.prepare(
            "INSERT INTO playlist_items (playlist_id, track_id, order_index) VALUES (?1, ?2, ?3)"
        )?;

        stmt.execute(params![playlist_id, track_id, order_index])?;
        Ok(())
    }

    pub fn get_playlist_tracks(&self, playlist_id: i64) -> Result<Vec<Track>> {
        let mut stmt = self.conn.prepare(
            "SELECT t.id, t.path, t.title, t.artist, t.album, t.duration_ms, t.album_cover_data, t.album_cover_mime
             FROM tracks t
             JOIN playlist_items pi ON t.id = pi.track_id
             WHERE pi.playlist_id = ?1
             ORDER BY pi.order_index"
        )?;

        let track_iter = stmt.query_map([playlist_id], |row| {
            Ok(Track {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                artist: row.get(3)?,
                album: row.get(4)?,
                duration_ms: row.get(5)?,
                album_cover_data: row.get(6)?,
                album_cover_mime: row.get(7)?,
            })
        })?;

        let mut tracks = Vec::new();
        for track in track_iter {
            tracks.push(track?);
        }

        Ok(tracks)
    }

    pub fn remove_track_from_playlist(&self, playlist_id: i64, track_id: i64) -> Result<()> {
        let mut stmt = self.conn.prepare(
            "DELETE FROM playlist_items WHERE playlist_id = ?1 AND track_id = ?2"
        )?;

        stmt.execute(params![playlist_id, track_id])?;
        Ok(())
    }

    pub fn delete_playlist(&self, playlist_id: i64) -> Result<()> {
        let mut stmt = self.conn.prepare("DELETE FROM playlists WHERE id = ?1")?;
        stmt.execute([playlist_id])?;
        Ok(())
    }

    pub fn get_track_count(&self) -> Result<i64> {
        // 🔧 性能优化：检查缓存
        if let Ok(mut cache) = self.cache.lock() {
            cache.cleanup_expired();
            
            if let Some(ref entry) = cache.track_count {
                if !entry.is_expired() {
                    return Ok(entry.data);
                }
            }
        }
        
        // 缓存未命中，执行查询
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM tracks",
            [],
            |row| row.get(0),
        )?;
        
        // 🔧 性能优化：更新缓存
        if let Ok(mut cache) = self.cache.lock() {
            cache.track_count = Some(CacheEntry::new(count, Duration::from_secs(300))); // 5分钟TTL
        }
        
        Ok(count)
    }

    pub fn get_artist_count(&self) -> Result<i64> {
        // 🔧 性能优化：检查缓存
        if let Ok(mut cache) = self.cache.lock() {
            cache.cleanup_expired();
            
            if let Some(ref entry) = cache.artist_count {
                if !entry.is_expired() {
                    return Ok(entry.data);
                }
            }
        }
        
        // 缓存未命中，执行查询
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(DISTINCT artist) FROM tracks WHERE artist IS NOT NULL AND artist != ''",
            [],
            |row| row.get(0),
        )?;
        
        // 🔧 性能优化：更新缓存
        if let Ok(mut cache) = self.cache.lock() {
            cache.artist_count = Some(CacheEntry::new(count, Duration::from_secs(300))); // 5分钟TTL
        }
        
        Ok(count)
    }

    pub fn get_album_count(&self) -> Result<i64> {
        // 🔧 性能优化：检查缓存
        if let Ok(mut cache) = self.cache.lock() {
            cache.cleanup_expired();
            
            if let Some(ref entry) = cache.album_count {
                if !entry.is_expired() {
                    return Ok(entry.data);
                }
            }
        }
        
        // 缓存未命中，执行查询
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(DISTINCT album) FROM tracks WHERE album IS NOT NULL AND album != ''",
            [],
            |row| row.get(0),
        )?;
        
        // 🔧 性能优化：更新缓存
        if let Ok(mut cache) = self.cache.lock() {
            cache.album_count = Some(CacheEntry::new(count, Duration::from_secs(300))); // 5分钟TTL
        }
        
        Ok(count)
    }

    // Lyrics methods
    pub fn insert_lyrics(&self, track_id: i64, content: &str, format: &str, source: &str) -> Result<i64> {
        let mut stmt = self.conn.prepare(
            "INSERT OR REPLACE INTO lyrics (track_id, content, format, source, created_at) 
             VALUES (?1, ?2, ?3, ?4, strftime('%s', 'now'))"
        )?;

        stmt.execute(params![track_id, content, format, source])?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn get_lyrics_by_track_id(&self, track_id: i64) -> Result<Option<Lyrics>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, track_id, content, format, source, created_at FROM lyrics WHERE track_id = ?1"
        )?;

        let lyrics = stmt.query_row([track_id], |row| {
            Ok(Lyrics {
                id: row.get(0)?,
                track_id: row.get(1)?,
                content: row.get(2)?,
                format: row.get(3)?,
                source: row.get(4)?,
                created_at: row.get(5)?,
            })
        });

        match lyrics {
            Ok(lyrics) => Ok(Some(lyrics)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn delete_lyrics(&self, track_id: i64) -> Result<()> {
        let mut stmt = self.conn.prepare("DELETE FROM lyrics WHERE track_id = ?1")?;
        stmt.execute([track_id])?;
        Ok(())
    }

    pub fn update_lyrics(&self, track_id: i64, content: &str) -> Result<()> {
        let mut stmt = self.conn.prepare(
            "UPDATE lyrics SET content = ?2, created_at = strftime('%s', 'now') WHERE track_id = ?1"
        )?;
        stmt.execute(params![track_id, content])?;
        Ok(())
    }

    /// 获取所有已扫描的音乐文件夹路径
    pub fn get_music_folder_paths(&self) -> Result<Vec<String>> {
        // 简化的 SQL 查询，在 Rust 中处理路径提取
        let mut stmt = self.conn.prepare(
            "SELECT DISTINCT path FROM tracks ORDER BY path"
        )?;

        let path_iter = stmt.query_map([], |row| {
            Ok(row.get::<_, String>(0)?)
        })?;

        let mut folder_set = std::collections::HashSet::new();
        for path_result in path_iter {
            let path = path_result?;
            // 使用 Rust 的 Path API 来正确处理路径分隔符
            if let Some(parent) = std::path::Path::new(&path).parent() {
                if let Some(parent_str) = parent.to_str() {
                    if !parent_str.is_empty() {
                        // 标准化路径格式（统一使用正斜杠）
                        let normalized = parent_str.replace("\\", "/");
                        folder_set.insert(normalized);
                    }
                }
            }
        }

        // 转换为向量并排序
        let mut folders: Vec<String> = folder_set.into_iter().collect();
        folders.sort();

        log::info!("找到的文件夹路径: {:?}", folders);
        Ok(folders)
    }

    /// 删除指定文件夹路径下的所有音乐文件
    pub fn delete_folder_tracks(&self, folder_path: &str) -> Result<usize> {
        // 标准化路径格式
        let normalized_folder = folder_path.replace("\\", "/");
        
        // 查找所有曲目，然后在Rust中过滤
        let mut stmt = self.conn.prepare(
            "SELECT id, path FROM tracks"
        )?;
        
        let track_iter = stmt.query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut tracks_to_delete = Vec::new();
        for track_result in track_iter {
            let (track_id, track_path) = track_result?;
            // 验证这个文件确实在指定的文件夹下
            if let Some(parent) = std::path::Path::new(&track_path).parent() {
                if let Some(parent_str) = parent.to_str() {
                    let normalized_parent = parent_str.replace("\\", "/");
                    if normalized_parent == normalized_folder {
                        tracks_to_delete.push(track_id);
                    }
                }
            }
        }

        // 删除找到的所有曲目
        let deleted_count = tracks_to_delete.len();
        for track_id in tracks_to_delete {
            let mut delete_stmt = self.conn.prepare("DELETE FROM tracks WHERE id = ?1")?;
            delete_stmt.execute([track_id])?;
        }
        
        // 🔧 性能优化：删除后失效缓存
        if deleted_count > 0 {
            if let Ok(mut cache) = self.cache.lock() {
                cache.invalidate_track_related();
            }
        }

        log::info!("删除了文件夹 '{}' 下的 {} 首曲目", folder_path, deleted_count);
        Ok(deleted_count)
    }

    // Favorites methods
    pub fn add_favorite(&self, track_id: i64) -> Result<i64> {
        let mut stmt = self.conn.prepare(
            "INSERT INTO favorites (track_id) VALUES (?1)"
        )?;
        
        stmt.execute([track_id])?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn remove_favorite(&self, track_id: i64) -> Result<()> {
        let mut stmt = self.conn.prepare(
            "DELETE FROM favorites WHERE track_id = ?1"
        )?;
        
        stmt.execute([track_id])?;
        Ok(())
    }

    pub fn is_favorite(&self, track_id: i64) -> Result<bool> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM favorites WHERE track_id = ?1",
            [track_id],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn get_all_favorites(&self) -> Result<Vec<Track>> {
        let mut stmt = self.conn.prepare(
            "SELECT t.id, t.path, t.title, t.artist, t.album, t.duration_ms, t.album_cover_data, t.album_cover_mime
             FROM tracks t
             JOIN favorites f ON t.id = f.track_id
             ORDER BY f.created_at DESC"
        )?;

        let track_iter = stmt.query_map([], |row| {
            Ok(Track {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                artist: row.get(3)?,
                album: row.get(4)?,
                duration_ms: row.get(5)?,
                album_cover_data: row.get(6)?,
                album_cover_mime: row.get(7)?,
            })
        })?;

        let mut tracks = Vec::new();
        for track in track_iter {
            tracks.push(track?);
        }

        Ok(tracks)
    }

    pub fn get_favorites_count(&self) -> Result<i64> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM favorites",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    pub fn toggle_favorite(&self, track_id: i64) -> Result<bool> {
        if self.is_favorite(track_id)? {
            self.remove_favorite(track_id)?;
            Ok(false)
        } else {
            self.add_favorite(track_id)?;
            Ok(true)
        }
    }
}
