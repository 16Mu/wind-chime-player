use rusqlite::{params, Connection, OptionalExtension};
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

// 注意：Playlist 和 PlaylistItem 定义已移至 playlist/types.rs，避免重复定义

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

// 注意：Favorite 结构体已移除，改用 favorites 表的直接操作

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

        // Migrate playlists table to add extended fields
        self.migrate_playlist_extended_columns()?;

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

        // Migrate playlist_items table to add extended fields
        self.migrate_playlist_items_extended_columns()?;

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

        // Create play_history table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS play_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                track_id INTEGER NOT NULL,
                played_at INTEGER NOT NULL,
                duration_played_ms INTEGER DEFAULT 0,
                FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Migrate existing play_history table to add duration_played_ms
        if self.conn.prepare("SELECT duration_played_ms FROM play_history LIMIT 1").is_err() {
            log::info!("添加duration_played_ms字段到play_history表");
            self.conn.execute("ALTER TABLE play_history ADD COLUMN duration_played_ms INTEGER DEFAULT 0", [])?;
        }

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_play_history_track ON play_history(track_id)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_play_history_time ON play_history(played_at DESC)",
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

        // ========== 远程音乐源相关表 (仅支持WebDAV) ==========
        
        // 统一的远程服务器配置表
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS remote_servers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                server_type TEXT NOT NULL CHECK(server_type IN ('webdav')),
                config_json TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                priority INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                last_connected_at INTEGER,
                connection_status TEXT DEFAULT 'unknown'
            )",
            [],
        )?;

        // 统一的缓存表
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS remote_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id TEXT NOT NULL,
                remote_path TEXT NOT NULL,
                local_cache_path TEXT NOT NULL,
                file_size INTEGER,
                mime_type TEXT,
                etag TEXT,
                last_modified INTEGER,
                cached_at INTEGER NOT NULL,
                last_accessed INTEGER NOT NULL,
                access_count INTEGER DEFAULT 0,
                cache_status TEXT DEFAULT 'valid' CHECK(cache_status IN ('valid', 'stale', 'invalid')),
                UNIQUE(server_id, remote_path),
                FOREIGN KEY(server_id) REFERENCES remote_servers(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // 缓存索引
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_cache_server ON remote_cache(server_id)",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_cache_access ON remote_cache(last_accessed DESC)",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_cache_status ON remote_cache(cache_status)",
            [],
        )?;

        // 同步任务表
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS sync_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id TEXT NOT NULL,
                task_type TEXT NOT NULL CHECK(task_type IN ('scan', 'download', 'cleanup')),
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
                progress_current INTEGER DEFAULT 0,
                progress_total INTEGER DEFAULT 0,
                started_at INTEGER,
                completed_at INTEGER,
                error_message TEXT,
                FOREIGN KEY(server_id) REFERENCES remote_servers(id) ON DELETE CASCADE
            )",
            [],
        )?;

        log::info!("远程服务器数据库表已创建");

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

    /// 迁移歌单表扩展字段
    fn migrate_playlist_extended_columns(&self) -> Result<()> {
        // description
        if self.conn.prepare("SELECT description FROM playlists LIMIT 1").is_err() {
            log::info!("添加description字段到playlists表");
            self.conn.execute("ALTER TABLE playlists ADD COLUMN description TEXT", [])?;
        }
        
        // cover_path
        if self.conn.prepare("SELECT cover_path FROM playlists LIMIT 1").is_err() {
            log::info!("添加cover_path字段到playlists表");
            self.conn.execute("ALTER TABLE playlists ADD COLUMN cover_path TEXT", [])?;
        }
        
        // is_smart
        if self.conn.prepare("SELECT is_smart FROM playlists LIMIT 1").is_err() {
            log::info!("添加is_smart字段到playlists表");
            self.conn.execute("ALTER TABLE playlists ADD COLUMN is_smart INTEGER DEFAULT 0", [])?;
        }
        
        // smart_rules
        if self.conn.prepare("SELECT smart_rules FROM playlists LIMIT 1").is_err() {
            log::info!("添加smart_rules字段到playlists表");
            self.conn.execute("ALTER TABLE playlists ADD COLUMN smart_rules TEXT", [])?;
        }
        
        // color_theme
        if self.conn.prepare("SELECT color_theme FROM playlists LIMIT 1").is_err() {
            log::info!("添加color_theme字段到playlists表");
            self.conn.execute("ALTER TABLE playlists ADD COLUMN color_theme TEXT", [])?;
        }
        
        // is_favorite
        if self.conn.prepare("SELECT is_favorite FROM playlists LIMIT 1").is_err() {
            log::info!("添加is_favorite字段到playlists表");
            self.conn.execute("ALTER TABLE playlists ADD COLUMN is_favorite INTEGER DEFAULT 0", [])?;
        }
        
        // last_played
        if self.conn.prepare("SELECT last_played FROM playlists LIMIT 1").is_err() {
            log::info!("添加last_played字段到playlists表");
            self.conn.execute("ALTER TABLE playlists ADD COLUMN last_played INTEGER", [])?;
        }
        
        // play_count
        if self.conn.prepare("SELECT play_count FROM playlists LIMIT 1").is_err() {
            log::info!("添加play_count字段到playlists表");
            self.conn.execute("ALTER TABLE playlists ADD COLUMN play_count INTEGER DEFAULT 0", [])?;
        }
        
        // updated_at
        if self.conn.prepare("SELECT updated_at FROM playlists LIMIT 1").is_err() {
            log::info!("添加updated_at字段到playlists表");
            self.conn.execute("ALTER TABLE playlists ADD COLUMN updated_at INTEGER", [])?;
        }
        
        // is_pinned
        if self.conn.prepare("SELECT is_pinned FROM playlists LIMIT 1").is_err() {
            log::info!("添加is_pinned字段到playlists表");
            self.conn.execute("ALTER TABLE playlists ADD COLUMN is_pinned INTEGER DEFAULT 0", [])?;
        }
        
        log::info!("歌单表扩展字段迁移完成");
        Ok(())
    }

    /// 迁移歌单项表扩展字段
    fn migrate_playlist_items_extended_columns(&self) -> Result<()> {
        // added_at
        if self.conn.prepare("SELECT added_at FROM playlist_items LIMIT 1").is_err() {
            log::info!("添加added_at字段到playlist_items表");
            self.conn.execute("ALTER TABLE playlist_items ADD COLUMN added_at INTEGER DEFAULT (strftime('%s', 'now'))", [])?;
        }
        
        log::info!("歌单项表扩展字段迁移完成");
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

    /// 创建歌单（简化版，已被 create_playlist_extended 替代）
    #[allow(dead_code)]
    pub fn create_playlist(&self, name: &str) -> Result<i64> {
        let mut stmt = self.conn.prepare(
            "INSERT INTO playlists (name) VALUES (?1)"
        )?;

        stmt.execute([name])?;
        Ok(self.conn.last_insert_rowid())
    }

    // 注意：get_all_playlists() 已被 get_all_playlists_extended() 替代

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

    /// 更新歌词（预留功能）
    #[allow(dead_code)]
    pub fn update_lyrics(&self, track_id: i64, content: &str) -> Result<()> {
        let mut stmt = self.conn.prepare(
            "UPDATE lyrics SET content = ?2, created_at = strftime('%s', 'now') WHERE track_id = ?1"
        )?;
        stmt.execute(params![track_id, content])?;
        Ok(())
    }

    /// 删除指定来源的歌词（用于清理临时歌词，预留功能）
    #[allow(dead_code)]
    pub fn delete_lyrics_by_source(&self, track_id: i64, source: &str) -> Result<()> {
        let mut stmt = self.conn.prepare(
            "DELETE FROM lyrics WHERE track_id = ?1 AND source = ?2"
        )?;
        stmt.execute(params![track_id, source])?;
        Ok(())
    }

    /// 检查歌词是否存在（预留功能）
    #[allow(dead_code)]
    pub fn has_lyrics(&self, track_id: i64) -> Result<bool> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM lyrics WHERE track_id = ?1",
            [track_id],
            |row| row.get(0),
        )?;
        Ok(count > 0)
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

    // ========== 远程服务器管理 ==========

    pub fn add_remote_server(&self, id: &str, name: &str, server_type: &str, config_json: &str) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        self.conn.execute(
            "INSERT INTO remote_servers (id, name, server_type, config_json, created_at, updated_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, name, server_type, config_json, now, now],
        )?;
        log::info!("添加远程服务器: {} ({})", name, server_type);
        Ok(())
    }

    pub fn get_remote_servers(&self) -> Result<Vec<(String, String, String, String, bool)>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, server_type, config_json, enabled FROM remote_servers ORDER BY priority DESC, name ASC"
        )?;
        
        let servers = stmt.query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get::<_, i64>(4)? == 1,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
        
        Ok(servers)
    }

    pub fn delete_remote_server(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM remote_servers WHERE id = ?1", params![id])?;
        log::info!("删除远程服务器: {}", id);
        Ok(())
    }

    // ========== 缓存管理 ==========

    /// 添加缓存条目（预留功能）
    #[allow(dead_code)]
    pub fn add_cache_entry(
        &self,
        server_id: &str,
        remote_path: &str,
        local_cache_path: &str,
        file_size: Option<i64>,
        mime_type: Option<&str>,
    ) -> Result<i64> {
        let now = chrono::Utc::now().timestamp();
        
        self.conn.execute(
            "INSERT OR REPLACE INTO remote_cache 
             (server_id, remote_path, local_cache_path, file_size, mime_type, cached_at, last_accessed, access_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)",
            params![server_id, remote_path, local_cache_path, file_size, mime_type, now, now],
        )?;
        
        Ok(self.conn.last_insert_rowid())
    }

    /// 获取缓存条目（预留功能）
    #[allow(dead_code)]
    pub fn get_cache_entry(&self, server_id: &str, remote_path: &str) -> Result<Option<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT local_cache_path FROM remote_cache 
             WHERE server_id = ?1 AND remote_path = ?2 AND cache_status = 'valid'"
        )?;
        
        let result = stmt.query_row(params![server_id, remote_path], |row| row.get(0))
            .optional()?;
        
        // 更新访问时间
        if result.is_some() {
            let now = chrono::Utc::now().timestamp();
            self.conn.execute(
                "UPDATE remote_cache SET last_accessed = ?1, access_count = access_count + 1 
                 WHERE server_id = ?2 AND remote_path = ?3",
                params![now, server_id, remote_path],
            )?;
        }
        
        Ok(result)
    }

    pub fn get_cache_stats(&self) -> Result<(i64, i64)> {
        let mut stmt = self.conn.prepare(
            "SELECT COUNT(*), COALESCE(SUM(file_size), 0) FROM remote_cache WHERE cache_status = 'valid'"
        )?;
        
        let result = stmt.query_row([], |row| {
            Ok((row.get(0)?, row.get(1)?))
        }).map_err(|e| anyhow::anyhow!("查询缓存统计失败: {}", e))?;
        
        Ok(result)
    }

    // ========== 扩展的歌单管理方法 ==========

    /// 创建扩展歌单（包含元数据）
    pub fn create_playlist_extended(
        &self,
        name: &str,
        description: Option<&str>,
        cover_path: Option<&str>,
        is_smart: bool,
        smart_rules: Option<&str>,
        color_theme: Option<&str>,
    ) -> Result<i64> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let mut stmt = self.conn.prepare(
            "INSERT INTO playlists (
                name, description, cover_path, is_smart, smart_rules, 
                color_theme, is_favorite, play_count, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 0, ?7, ?7)"
        )?;

        stmt.execute(params![
            name,
            description,
            cover_path,
            is_smart as i64,
            smart_rules,
            color_theme,
            now
        ])?;

        Ok(self.conn.last_insert_rowid())
    }

    /// 获取所有扩展歌单信息
    pub fn get_all_playlists_extended(&self) -> Result<Vec<crate::playlist::Playlist>> {
        let mut stmt = self.conn.prepare(
            "SELECT p.id, p.name, p.description, p.cover_path, p.color_theme,
                    p.is_smart, p.smart_rules, p.is_favorite, p.is_pinned, p.created_at, 
                    p.updated_at, p.last_played, p.play_count,
                    COUNT(pi.id) as track_count,
                    COALESCE(SUM(t.duration_ms), 0) as total_duration
             FROM playlists p
             LEFT JOIN playlist_items pi ON p.id = pi.playlist_id
             LEFT JOIN tracks t ON pi.track_id = t.id
             GROUP BY p.id
             ORDER BY p.created_at DESC"
        )?;

        let playlist_iter = stmt.query_map([], |row| {
            Ok(crate::playlist::Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                cover_path: row.get(3)?,
                color_theme: row.get(4)?,
                is_smart: row.get::<_, i64>(5)? == 1,
                smart_rules: row.get(6)?,
                is_favorite: row.get::<_, i64>(7)? == 1,
                is_pinned: row.get::<_, i64>(8)? == 1,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
                last_played: row.get(11)?,
                play_count: row.get(12)?,
                track_count: row.get(13)?,
                total_duration_ms: row.get(14)?,
            })
        })?;

        let mut playlists = Vec::new();
        for playlist in playlist_iter {
            playlists.push(playlist?);
        }

        Ok(playlists)
    }

    /// 获取单个歌单信息
    pub fn get_playlist_by_id(&self, playlist_id: i64) -> Result<Option<crate::playlist::Playlist>> {
        let mut stmt = self.conn.prepare(
            "SELECT p.id, p.name, p.description, p.cover_path, p.color_theme,
                    p.is_smart, p.smart_rules, p.is_favorite, p.is_pinned, p.created_at, 
                    p.updated_at, p.last_played, p.play_count,
                    COUNT(pi.id) as track_count,
                    COALESCE(SUM(t.duration_ms), 0) as total_duration
             FROM playlists p
             LEFT JOIN playlist_items pi ON p.id = pi.playlist_id
             LEFT JOIN tracks t ON pi.track_id = t.id
             WHERE p.id = ?1
             GROUP BY p.id"
        )?;

        let result = stmt.query_row([playlist_id], |row| {
            Ok(crate::playlist::Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                cover_path: row.get(3)?,
                color_theme: row.get(4)?,
                is_smart: row.get::<_, i64>(5)? == 1,
                smart_rules: row.get(6)?,
                is_favorite: row.get::<_, i64>(7)? == 1,
                is_pinned: row.get::<_, i64>(8)? == 1,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
                last_played: row.get(11)?,
                play_count: row.get(12)?,
                track_count: row.get(13)?,
                total_duration_ms: row.get(14)?,
            })
        });

        match result {
            Ok(playlist) => Ok(Some(playlist)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// 更新歌单元数据
    pub fn update_playlist_metadata(
        &self,
        playlist_id: i64,
        name: Option<&str>,
        description: Option<&str>,
        cover_path: Option<&str>,
        color_theme: Option<&str>,
        is_favorite: Option<bool>,
    ) -> Result<()> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let mut updates = Vec::new();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(n) = name {
            updates.push("name = ?");
            params.push(Box::new(n.to_string()));
        }
        if let Some(d) = description {
            updates.push("description = ?");
            params.push(Box::new(d.to_string()));
        }
        if let Some(c) = cover_path {
            updates.push("cover_path = ?");
            params.push(Box::new(c.to_string()));
        }
        if let Some(ct) = color_theme {
            updates.push("color_theme = ?");
            params.push(Box::new(ct.to_string()));
        }
        if let Some(f) = is_favorite {
            updates.push("is_favorite = ?");
            params.push(Box::new(f as i64));
        }

        if updates.is_empty() {
            return Ok(());
        }

        updates.push("updated_at = ?");
        params.push(Box::new(now));
        params.push(Box::new(playlist_id));

        let sql = format!(
            "UPDATE playlists SET {} WHERE id = ?",
            updates.join(", ")
        );

        let params_ref: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        self.conn.execute(&sql, params_ref.as_slice())?;

        Ok(())
    }

    /// 更新智能歌单规则
    pub fn update_smart_playlist_rules(&self, playlist_id: i64, rules: &str) -> Result<()> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        self.conn.execute(
            "UPDATE playlists SET smart_rules = ?1, updated_at = ?2 WHERE id = ?3",
            params![rules, now, playlist_id],
        )?;

        Ok(())
    }

    /// 清空歌单曲目
    pub fn clear_playlist_items(&self, playlist_id: i64) -> Result<()> {
        self.conn.execute(
            "DELETE FROM playlist_items WHERE playlist_id = ?1",
            [playlist_id],
        )?;
        Ok(())
    }

    /// 重排歌单曲目
    pub fn reorder_playlist_tracks(&self, playlist_id: i64, track_ids: &[i64]) -> Result<()> {
        // 使用事务确保原子性
        self.conn.execute("BEGIN TRANSACTION", [])?;

        for (index, track_id) in track_ids.iter().enumerate() {
            self.conn.execute(
                "UPDATE playlist_items SET order_index = ?1 
                 WHERE playlist_id = ?2 AND track_id = ?3",
                params![index as i64, playlist_id, track_id],
            )?;
        }

        self.conn.execute("COMMIT", [])?;
        Ok(())
    }

    /// 更新歌单的更新时间
    pub fn touch_playlist(&self, playlist_id: i64) -> Result<()> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        self.conn.execute(
            "UPDATE playlists SET updated_at = ?1 WHERE id = ?2",
            params![now, playlist_id],
        )?;

        Ok(())
    }

    /// 标记歌单为已播放
    pub fn mark_playlist_played(&self, playlist_id: i64) -> Result<()> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        self.conn.execute(
            "UPDATE playlists SET last_played = ?1, play_count = play_count + 1 WHERE id = ?2",
            params![now, playlist_id],
        )?;

        Ok(())
    }

    /// 切换歌单收藏状态
    pub fn toggle_playlist_favorite(&self, playlist_id: i64) -> Result<bool> {
        let is_favorite: i64 = self.conn.query_row(
            "SELECT is_favorite FROM playlists WHERE id = ?1",
            [playlist_id],
            |row| row.get(0),
        )?;

        let new_state = if is_favorite == 1 { 0 } else { 1 };

        self.conn.execute(
            "UPDATE playlists SET is_favorite = ?1 WHERE id = ?2",
            params![new_state, playlist_id],
        )?;

        Ok(new_state == 1)
    }

    /// 获取所有智能歌单ID
    pub fn get_smart_playlist_ids(&self) -> Result<Vec<i64>> {
        let mut stmt = self.conn.prepare(
            "SELECT id FROM playlists WHERE is_smart = 1"
        )?;

        let ids = stmt.query_map([], |row| row.get(0))?
            .collect::<Result<Vec<i64>, _>>()?;

        Ok(ids)
    }

    /// 获取歌单统计信息
    pub fn get_playlist_stats(&self) -> Result<crate::playlist::PlaylistStats> {
        let total_playlists: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM playlists",
            [],
            |row| row.get(0),
        )?;

        let total_smart_playlists: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM playlists WHERE is_smart = 1",
            [],
            |row| row.get(0),
        )?;

        let total_favorite_playlists: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM playlists WHERE is_favorite = 1",
            [],
            |row| row.get(0),
        )?;

        let total_tracks_in_playlists: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM playlist_items",
            [],
            |row| row.get(0),
        )?;

        Ok(crate::playlist::PlaylistStats {
            total_playlists,
            total_smart_playlists,
            total_favorite_playlists,
            total_tracks_in_playlists,
        })
    }

    // ========== Pin 歌单功能 ==========

    /// Pin歌单到侧边栏
    pub fn pin_playlist(&self, playlist_id: i64) -> Result<()> {
        self.conn.execute(
            "UPDATE playlists SET is_pinned = 1 WHERE id = ?1",
            params![playlist_id],
        )?;
        Ok(())
    }

    /// 取消Pin
    pub fn unpin_playlist(&self, playlist_id: i64) -> Result<()> {
        self.conn.execute(
            "UPDATE playlists SET is_pinned = 0 WHERE id = ?1",
            params![playlist_id],
        )?;
        Ok(())
    }

    /// 切换Pin状态
    pub fn toggle_pin(&self, playlist_id: i64) -> Result<bool> {
        let is_pinned: i64 = self.conn.query_row(
            "SELECT is_pinned FROM playlists WHERE id = ?1",
            params![playlist_id],
            |row| row.get(0),
        )?;
        
        let new_value = if is_pinned == 1 { 0 } else { 1 };
        self.conn.execute(
            "UPDATE playlists SET is_pinned = ?1 WHERE id = ?2",
            params![new_value, playlist_id],
        )?;
        
        Ok(new_value == 1)
    }

    // ========== 播放历史管理 ==========

    /// 记录播放历史
    pub fn add_play_history(&self, track_id: i64, duration_played_ms: i64) -> Result<()> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        
        self.conn.execute(
            "INSERT INTO play_history (track_id, played_at, duration_played_ms) VALUES (?1, ?2, ?3)",
            params![track_id, now, duration_played_ms],
        )?;
        Ok(())
    }

    /// 获取播放历史（带统计）
    pub fn get_play_history(&self, sort_by: &str, limit: i64) -> Result<Vec<(Track, i64, i64, i64)>> {
        let order_clause = match sort_by {
            "play_count" => "play_count DESC, last_played DESC",
            "first_played" => "first_played ASC",
            _ => "last_played DESC", // default: last_played
        };
        
        let sql = format!(
            "SELECT t.id, t.path, t.title, t.artist, t.album, t.duration_ms,
                    COUNT(ph.id) as play_count,
                    MAX(ph.played_at) as last_played,
                    MIN(ph.played_at) as first_played
             FROM tracks t
             INNER JOIN play_history ph ON t.id = ph.track_id
             GROUP BY t.id
             ORDER BY {}
             LIMIT ?1",
            order_clause
        );
        
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map([limit], |row| {
            Ok((
                Track {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    title: row.get(2).ok(),
                    artist: row.get(3).ok(),
                    album: row.get(4).ok(),
                    duration_ms: row.get(5).ok(),
                    album_cover_data: None,
                    album_cover_mime: None,
                },
                row.get(6)?, // play_count
                row.get(7)?, // last_played
                row.get(8)?, // first_played
            ))
        })?;
        
        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }

    /// 获取播放统计
    pub fn get_play_statistics(&self) -> Result<(i64, i64, i64)> {
        let total_plays: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM play_history",
            [],
            |row| row.get(0),
        )?;
        
        let unique_tracks: i64 = self.conn.query_row(
            "SELECT COUNT(DISTINCT track_id) FROM play_history",
            [],
            |row| row.get(0),
        )?;
        
        // 使用实际播放时长而非曲目完整时长
        let total_duration_ms: i64 = self.conn.query_row(
            "SELECT COALESCE(SUM(duration_played_ms), 0) FROM play_history",
            [],
            |row| row.get(0),
        )?;
        
        Ok((total_plays, unique_tracks, total_duration_ms))
    }

    /// 清空播放历史
    pub fn clear_play_history(&self) -> Result<()> {
        self.conn.execute("DELETE FROM play_history", [])?;
        Ok(())
    }

    /// 从历史中删除某曲目（预留功能）
    #[allow(dead_code)]
    pub fn remove_from_history(&self, track_id: i64) -> Result<()> {
        self.conn.execute(
            "DELETE FROM play_history WHERE track_id = ?1",
            params![track_id],
        )?;
        Ok(())
    }
    
    // 🔧 P2新增：播放历史相关的查询方法
    
    /// 删除指定时间之前的播放历史（预留功能）
    #[allow(dead_code)]
    pub fn delete_play_history_before(&self, timestamp: i64) -> Result<usize> {
        let deleted = self.conn.execute(
            "DELETE FROM play_history WHERE played_at < ?1",
            params![timestamp],
        )?;
        Ok(deleted)
    }
    
    /// 获取最近播放历史（返回PlayHistoryEntry结构，预留功能）
    #[allow(dead_code)]
    pub fn get_recent_play_history(&self, limit: usize) -> Result<Vec<crate::play_history::PlayHistoryEntry>> {
        let history_data = self.get_play_history("last_played", limit as i64)?;
        
        Ok(history_data.into_iter().map(|(track, play_count, last_played, first_played)| {
            crate::play_history::PlayHistoryEntry {
                track,
                play_count,
                last_played_at: last_played,
                first_played_at: first_played,
            }
        }).collect())
    }
    
    /// 🔧 修复：获取播放统计信息（返回PlayStatistics结构，预留功能）
    #[allow(dead_code)]
    pub fn get_play_statistics_struct(&self) -> Result<crate::play_history::PlayStatistics> {
        let (total_plays, unique_tracks, total_duration_ms) = self.get_play_statistics()?;
        Ok(crate::play_history::PlayStatistics {
            total_plays,
            unique_tracks,
            total_duration_ms,
        })
    }
    
    // 🔧 P2新增：智能歌单扩展字段查询
    
    /// 获取曲目的添加时间
    pub fn get_track_date_added(&self, track_id: i64) -> Result<Option<i64>> {
        // 从tracks表的created_at字段或文件系统时间获取
        let timestamp: Option<i64> = self.conn.query_row(
            "SELECT created_at FROM tracks WHERE id = ?1",
            params![track_id],
            |row| row.get(0),
        ).optional()?;
        
        Ok(timestamp)
    }
    
    /// 获取曲目的最后播放时间
    pub fn get_track_last_played(&self, track_id: i64) -> Result<Option<i64>> {
        let timestamp: Option<i64> = self.conn.query_row(
            "SELECT MAX(played_at) FROM play_history WHERE track_id = ?1",
            params![track_id],
            |row| row.get(0),
        ).optional()?;
        
        Ok(timestamp)
    }
    
    /// 获取曲目的播放次数
    pub fn get_track_play_count(&self, track_id: i64) -> Result<i64> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM play_history WHERE track_id = ?1",
            params![track_id],
            |row| row.get(0),
        ).unwrap_or(0);
        
        Ok(count)
    }
    
    /// 检查曲目是否被收藏
    pub fn is_track_favorite(&self, track_id: i64) -> Result<bool> {
        self.is_favorite(track_id)
    }
    
    /// 🔧 P2新增：使用SQL WHERE子句查询曲目（智能歌单优化）
    pub fn query_tracks_by_smart_rules(
        &self,
        where_clause: &str,
        params: &[String],
        limit: Option<u32>,
    ) -> Result<Vec<Track>> {
        let limit_clause = limit.map(|l| format!(" LIMIT {}", l)).unwrap_or_default();
        
        let sql = format!(
            "SELECT id, path, title, artist, album, duration_ms, album_cover_data, album_cover_mime 
             FROM tracks 
             WHERE {} 
             ORDER BY artist, album, title{}",
            where_clause,
            limit_clause
        );
        
        let mut stmt = self.conn.prepare(&sql)?;
        
        // 转换参数为rusqlite可接受的格式
        let rusqlite_params: Vec<&dyn rusqlite::ToSql> = params.iter()
            .map(|p| p as &dyn rusqlite::ToSql)
            .collect();
        
        let tracks = stmt.query_map(rusqlite_params.as_slice(), |row| {
            Ok(Track {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2).ok(),
                artist: row.get(3).ok(),
                album: row.get(4).ok(),
                duration_ms: row.get(5).ok(),
                album_cover_data: row.get(6).ok(),
                album_cover_mime: row.get(7).ok(),
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        
        Ok(tracks)
    }
}
