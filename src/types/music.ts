/**
 * 音乐播放器核心类型定义
 * 
 * 设计原则：
 * - 单一数据源：所有音乐相关类型集中定义
 * - 类型安全：严格的TypeScript类型定义
 * - 易于维护：统一管理，避免类型不一致
 */

// ==================== 核心数据结构 ====================

/**
 * 音轨/曲目信息
 * 与后端Rust Track结构保持一致
 */
export interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
}

/**
 * 音乐库统计信息
 */
export interface LibraryStats {
  total_tracks: number;
  total_artists: number;
  total_albums: number;
}

/**
 * 播放器状态
 */
export interface PlayerState {
  current_track: Track | null;
  is_playing: boolean;
  position_ms: number;
  volume: number;
  repeat_mode: RepeatMode;
  shuffle: boolean;
}

/**
 * 重复播放模式
 */
export type RepeatMode = 'Off' | 'One' | 'All';

// ==================== 专辑与艺术家 ====================

/**
 * 专辑信息
 */
export interface Album {
  name: string;
  artist: string;
  tracks: Track[];
}

/**
 * 艺术家信息
 */
export interface Artist {
  name: string;
  tracks: Track[];
}

// ==================== 歌词相关 ====================

/**
 * 解析后的歌词行
 */
export interface LyricLine {
  time: number;
  text: string;
}

/**
 * 解析后的歌词数据
 */
export interface ParsedLyrics {
  lines: LyricLine[];
  metadata: { [key: string]: string };
}

// ==================== 播放列表 ====================

/**
 * 播放列表信息
 */
export interface Playlist {
  id: number;
  name: string;
  description?: string;
  tracks: Track[];
  created_at?: string;
  updated_at?: string;
}

// ==================== 收藏与历史 ====================

/**
 * 收藏项
 */
export interface FavoriteItem {
  track_id: number;
  track: Track;
  added_at: string;
}

/**
 * 播放历史项
 */
export interface ListeningHistoryItem {
  timestamp: string;
  track: Track;
}

// ==================== 扫描相关 ====================

/**
 * 扫描进度信息
 */
export interface ScanProgress {
  current_file: string;
  total_files: number;
  scanned_files: number;
  progress_percent: number;
}

// ==================== 事件相关 ====================

/**
 * Tauri事件Payload类型映射
 */
export interface TauriEventPayloads {
  'library-scan-started': void;
  'library-scan-progress': ScanProgress;
  'library-scan-complete': { total_tracks: number };
  'library-tracks-loaded': Track[];
  'library-search-results': Track[];
  'library-stats': LibraryStats;
  'player-state-changed': PlayerState;
  'player-track-changed': Track;
  'player-error': { PlaybackError?: string } | string;
  'app-ready': void;
  'app-init-error': string;
}

/**
 * Tauri事件名称类型
 */
export type TauriEventName = keyof TauriEventPayloads;

// ==================== UI相关 ====================

/**
 * 页面类型
 */
export type Page = 'explore' | 'library' | 'playlists' | 'history' | 'favorite' | 'genres' | 'settings';

/**
 * 主题模式
 */
export type ThemeMode = 'system' | 'light' | 'dark';

/**
 * 歌词动画设置
 */
export interface LyricsAnimationSettings {
  style: 
    // Q弹系列
    | 'BOUNCY_SOFT' 
    | 'BOUNCY_STRONG' 
    | 'BOUNCY_PLAYFUL'
    // 平滑系列
    | 'SMOOTH_ELEGANT' 
    | 'SMOOTH_SWIFT' 
    | 'SMOOTH_DREAMY'
    // 特殊效果
    | 'ORGANIC_FLOW' 
    | 'PRECISE_SNAP'
    // 缓慢优雅系列
    | 'SLOW_GENTLE' 
    | 'SLOW_LUXURIOUS'
    // 弹性系列
    | 'ELASTIC_SOFT' 
    | 'ELASTIC_STRONG'
    // 即时响应系列
    | 'INSTANT_SMOOTH' 
    | 'INSTANT_SHARP'
    // 渐进系列
    | 'GRADUAL_EASE' 
    | 'GRADUAL_ACCELERATE';
}

// ==================== 辅助类型 ====================

/**
 * 可选的Track字段（用于更新操作）
 */
export type PartialTrack = Partial<Track> & Pick<Track, 'id'>;

/**
 * Track的显示信息（用于UI展示）
 */
export interface TrackDisplayInfo {
  id: number;
  title: string;
  artist: string;
  album: string;
  durationText: string;
}

// ==================== 播放历史 ====================

/**
 * 播放历史条目
 */
export interface PlayHistoryEntry {
  track: Track;
  play_count: number;
  last_played_at: number;
  first_played_at: number;
}

/**
 * 播放统计信息
 */
export interface PlayStatistics {
  total_plays: number;
  unique_tracks: number;
  total_duration_ms: number;
}

/**
 * 历史排序方式
 */
export type HistorySortBy = 'play_count' | 'last_played' | 'first_played';



