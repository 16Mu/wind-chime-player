use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;
use anyhow::Result;

use crate::player::Track;

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

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new<P: AsRef<Path>>(db_path: P) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Database { conn };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<()> {
        // Create tracks table
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
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )",
            [],
        )?;

        // Migrate existing schema: Add album cover columns if they don't exist
        self.migrate_album_cover_columns()?;

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

        // Create FTS table for search
        self.conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
                title, artist, album, path,
                content='tracks',
                content_rowid='id'
            )",
            [],
        )?;

        // Create indexes
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tracks_path ON tracks(path)",
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
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM tracks",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    pub fn get_artist_count(&self) -> Result<i64> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(DISTINCT artist) FROM tracks WHERE artist IS NOT NULL AND artist != ''",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    pub fn get_album_count(&self) -> Result<i64> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(DISTINCT album) FROM tracks WHERE album IS NOT NULL AND album != ''",
            [],
            |row| row.get(0),
        )?;
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

        log::info!("删除了文件夹 '{}' 下的 {} 首曲目", folder_path, deleted_count);
        Ok(deleted_count)
    }
}
