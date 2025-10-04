// 歌单管理器 - 高内聚的核心业务逻辑
//
// 职责：
// - CRUD操作：创建、读取、更新、删除歌单
// - 智能歌单：规则管理和自动刷新
// - 曲目管理：添加、删除、重排曲目
// - 统计信息：提供歌单统计数据
// - 导入导出：集成导入导出功能
//
// 设计原则：
// - 单一职责：只负责歌单业务逻辑
// - 低耦合：通过Database trait与存储层解耦
// - 事务安全：所有修改操作使用数据库事务

use super::types::*;
use super::smart_playlist::SmartPlaylistEngine;
use crate::db::Database;
use anyhow::{Result, Context};
use std::sync::{Arc, Mutex};

/// 歌单管理器
/// 
/// 核心业务逻辑层，协调数据库操作和智能规则引擎
pub struct PlaylistManager {
    /// 数据库连接（通过Arc<Mutex>实现线程安全）
    db: Arc<Mutex<Database>>,
}

impl PlaylistManager {
    /// 创建新的歌单管理器
    /// 
    /// # 参数
    /// - db: 数据库连接的Arc引用
    pub fn new(db: Arc<Mutex<Database>>) -> Self {
        Self { db }
    }

    /// 创建歌单
    /// 
    /// # 参数
    /// - options: 创建选项，包含名称、描述、智能规则等
    /// 
    /// # 返回
    /// - 新创建的歌单ID
    pub fn create_playlist(&self, options: CreatePlaylistOptions) -> Result<i64> {
        let db = self.db.lock().map_err(|e| anyhow::anyhow!("Failed to lock database: {}", e))?;
        
        let smart_rules_json = if let Some(rules) = &options.smart_rules {
            Some(serde_json::to_string(rules)?)
        } else {
            None
        };

        db.create_playlist_extended(
            &options.name,
            options.description.as_deref(),
            None, // cover_path
            options.is_smart,
            smart_rules_json.as_deref(),
            options.color_theme.as_deref(),
        )
    }

    /// 获取所有歌单
    /// 
    /// # 返回
    /// - 所有歌单的列表（按更新时间倒序）
    pub fn get_all_playlists(&self) -> Result<Vec<Playlist>> {
        let db = self.db.lock().map_err(|e| anyhow::anyhow!("Failed to lock database: {}", e))?;
        db.get_all_playlists_extended()
    }

    /// 获取歌单详情（包含曲目）
    /// 
    /// # 参数
    /// - playlist_id: 歌单ID
    /// 
    /// # 返回
    /// - PlaylistWithTracks: 歌单信息和曲目列表
    pub fn get_playlist_with_tracks(&self, playlist_id: i64) -> Result<PlaylistWithTracks> {
        let db = self.db.lock().map_err(|e| anyhow::anyhow!("Failed to lock database: {}", e))?;
        
        let playlist = db.get_playlist_by_id(playlist_id)?
            .ok_or_else(|| anyhow::anyhow!("Playlist not found"))?;
        
        let tracks = db.get_playlist_tracks(playlist_id)?;

        Ok(PlaylistWithTracks { playlist, tracks })
    }

    /// 更新歌单
    pub fn update_playlist(&self, playlist_id: i64, options: UpdatePlaylistOptions) -> Result<()> {
        let db = self.db.lock().map_err(|e| anyhow::anyhow!("Failed to lock database: {}", e))?;
        
        db.update_playlist_metadata(
            playlist_id,
            options.name.as_deref(),
            options.description.as_deref(),
            options.cover_path.as_deref(),
            options.color_theme.as_deref(),
            options.is_favorite,
        )
    }

    /// 删除歌单
    pub fn delete_playlist(&self, playlist_id: i64) -> Result<()> {
        let db = self.db.lock().map_err(|e| anyhow::anyhow!("Failed to lock database: {}", e))?;
        db.delete_playlist(playlist_id)
    }

    /// 添加曲目到歌单
    /// 
    /// # 参数
    /// - playlist_id: 歌单ID
    /// - track_ids: 要添加的曲目ID列表
    /// 
    /// # 注意
    /// - 智能歌单不支持手动添加曲目
    pub fn add_tracks_to_playlist(&self, playlist_id: i64, track_ids: Vec<i64>) -> Result<()> {
        let db = self.db.lock().map_err(|e| anyhow::anyhow!("Failed to lock database: {}", e))?;
        
        for track_id in track_ids {
            db.add_track_to_playlist(playlist_id, track_id)?;
        }
        
        // 更新歌单的更新时间
        db.touch_playlist(playlist_id)?;
        
        Ok(())
    }

    /// 从歌单移除曲目
    pub fn remove_track_from_playlist(&self, playlist_id: i64, track_id: i64) -> Result<()> {
        let db = self.db.lock().map_err(|e| anyhow::anyhow!("Failed to lock database: {}", e))?;
        
        db.remove_track_from_playlist(playlist_id, track_id)?;
        db.touch_playlist(playlist_id)?;
        
        Ok(())
    }

    /// 重排歌单曲目
    pub fn reorder_tracks(&self, playlist_id: i64, track_ids: Vec<i64>) -> Result<()> {
        let db = self.db.lock().map_err(|e| anyhow::anyhow!("Failed to lock database: {}", e))?;
        
        db.reorder_playlist_tracks(playlist_id, &track_ids)?;
        db.touch_playlist(playlist_id)?;
        
        Ok(())
    }

    /// 创建智能歌单
    pub fn create_smart_playlist(&self, name: String, rules: SmartRules) -> Result<i64> {
        let options = CreatePlaylistOptions {
            name,
            description: None,
            color_theme: None,
            is_smart: true,
            smart_rules: Some(rules),
        };
        
        self.create_playlist(options)
    }

    /// 更新智能歌单规则
    pub fn update_smart_playlist(&self, playlist_id: i64, rules: SmartRules) -> Result<()> {
        let db = self.db.lock().map_err(|e| anyhow::anyhow!("Failed to lock database: {}", e))?;
        
        let rules_json = serde_json::to_string(&rules)?;
        db.update_smart_playlist_rules(playlist_id, &rules_json)?;
        
        // 立即刷新智能歌单内容
        drop(db); // 释放锁
        self.refresh_smart_playlist(playlist_id)?;
        
        Ok(())
    }

    /// 🔧 P2修复：刷新智能歌单（使用SQL优化，支持扩展字段）
    pub fn refresh_smart_playlist(&self, playlist_id: i64) -> Result<()> {
        let db = self.db.lock().map_err(|e| anyhow::anyhow!("Failed to lock database: {}", e))?;
        
        // 获取歌单信息
        let playlist = db.get_playlist_by_id(playlist_id)?
            .ok_or_else(|| anyhow::anyhow!("Playlist not found"))?;
        
        if !playlist.is_smart {
            return Err(anyhow::anyhow!("Not a smart playlist"));
        }
        
        let rules_json = playlist.smart_rules
            .ok_or_else(|| anyhow::anyhow!("Smart playlist has no rules"))?;
        
        let rules: SmartRules = serde_json::from_str(&rules_json)
            .context("Failed to parse smart rules")?;
        
        // 🔧 P2新增：尝试使用SQL查询优化（仅支持基本字段）
        let use_sql_optimization = rules.rules.iter().all(|rule| {
            matches!(rule.field, 
                RuleField::Title | RuleField::Artist | RuleField::Album | RuleField::Duration
            )
        });
        
        let filtered_track_ids: Vec<i64> = if use_sql_optimization {
            // 使用SQL WHERE子句优化查询
            if let Some((where_clause, params)) = SmartPlaylistEngine::build_sql_where_clause(&rules) {
                log::info!("Using SQL optimization for smart playlist refresh");
                // 使用数据库直接查询
                db.query_tracks_by_smart_rules(&where_clause, &params, rules.limit.map(|l| l as u32))?
                    .into_iter()
                    .map(|t| t.id)
                    .collect()
            } else {
                // Fallback到内存筛选
                let all_tracks = db.get_all_tracks()?;
                SmartPlaylistEngine::filter_tracks(&all_tracks, &rules)?
                    .into_iter()
                    .map(|t| t.id)
                    .collect()
            }
        } else {
            // 包含扩展字段，需要内存筛选
            log::info!("Using in-memory filtering for smart playlist (contains extended fields)");
            let all_tracks = db.get_all_tracks()?;
            
            // 创建元数据提供器
            let metadata_provider = |track_id: i64| -> Option<super::smart_playlist::TrackMetadata> {
                Some(super::smart_playlist::TrackMetadata {
                    date_added: db.get_track_date_added(track_id).ok()?,
                    last_played: db.get_track_last_played(track_id).ok()?,
                    play_count: db.get_track_play_count(track_id).unwrap_or(0),
                    is_favorite: db.is_track_favorite(track_id).unwrap_or(false),
                })
            };
            
            SmartPlaylistEngine::filter_tracks_with_metadata(&all_tracks, &rules, &metadata_provider)?
                .into_iter()
                .map(|t| t.id)
                .collect()
        };
        
        // 清空现有曲目
        db.clear_playlist_items(playlist_id)?;
        
        // 批量添加筛选后的曲目
        for track_id in filtered_track_ids {
            db.add_track_to_playlist(playlist_id, track_id)?;
        }
        
        db.touch_playlist(playlist_id)?;
        
        log::info!("Smart playlist {} refreshed", playlist_id);
        Ok(())
    }

    /// 刷新所有智能歌单
    pub fn refresh_all_smart_playlists(&self) -> Result<()> {
        let playlist_ids = {
            let db = self.db.lock().map_err(|e| anyhow::anyhow!("Failed to lock database: {}", e))?;
            db.get_smart_playlist_ids()?
        };
        
        for playlist_id in playlist_ids {
            if let Err(e) = self.refresh_smart_playlist(playlist_id) {
                log::error!("Failed to refresh smart playlist {}: {}", playlist_id, e);
            }
        }
        
        Ok(())
    }

    /// 获取歌单统计信息
    pub fn get_stats(&self) -> Result<PlaylistStats> {
        let db = self.db.lock().map_err(|e| anyhow::anyhow!("Failed to lock database: {}", e))?;
        db.get_playlist_stats()
    }

    /// 标记歌单为最近播放
    pub fn mark_played(&self, playlist_id: i64) -> Result<()> {
        let db = self.db.lock().map_err(|e| anyhow::anyhow!("Failed to lock database: {}", e))?;
        db.mark_playlist_played(playlist_id)
    }

    /// 切换收藏状态
    pub fn toggle_favorite(&self, playlist_id: i64) -> Result<bool> {
        let db = self.db.lock().map_err(|e| anyhow::anyhow!("Failed to lock database: {}", e))?;
        db.toggle_playlist_favorite(playlist_id)
    }
}


