import { invoke } from '@tauri-apps/api/core';

interface LibraryStats {
  total_tracks: number;
  total_artists: number;
  total_albums: number;
}

interface LibraryOverviewProps {
  stats: LibraryStats;
  recentTracks?: Array<{ id: number; title?: string; artist?: string }>;
  onImportMusic?: () => void;
  onScanFolder?: () => void;
  onOpenLyrics?: () => void;
}

export default function LibraryOverview({
  stats,
  recentTracks = [],
  onImportMusic,
  onScanFolder,
  onOpenLyrics
}: LibraryOverviewProps) {
  
  const handlePlayRecent = async (trackId: number) => {
    try {
      await invoke('player_play', { trackId, timestamp: Date.now() });
    } catch (error) {
      console.error('播放失败:', error);
    }
  };

  return (
    <div className="library-overview">
      {/* 我的收藏卡片 */}
      <div className="overview-card">
        <div className="overview-card-icon">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <div className="overview-card-content">
          <h3 className="overview-card-title">我的收藏</h3>
          <div className="overview-card-stats">
            <span className="text-2xl font-bold">{stats.total_tracks}</span>
            <span className="text-sm text-gray-600">首歌曲</span>
          </div>
          <button className="overview-card-action">查看收藏 →</button>
        </div>
      </div>

      {/* 最近播放卡片 */}
      <div className="overview-card">
        <div className="overview-card-icon">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="overview-card-content">
          <h3 className="overview-card-title">最近播放</h3>
          <div className="recent-tracks-list">
            {recentTracks.slice(0, 3).map((track) => (
              <button
                key={track.id}
                onClick={() => handlePlayRecent(track.id)}
                className="recent-track-item"
              >
                <span className="recent-track-title">{track.title || '未知曲目'}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            ))}
            {recentTracks.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-dark-600">暂无播放记录</p>
            )}
          </div>
        </div>
      </div>

      {/* 智能推荐卡片 */}
      <div className="overview-card">
        <div className="overview-card-icon">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div className="overview-card-content">
          <h3 className="overview-card-title">智能推荐</h3>
          <div className="smart-recommendations">
            <button className="recommendation-tag tag-focus">深夜专注</button>
            <button className="recommendation-tag tag-morning">晨间轻松</button>
            <button className="recommendation-tag tag-custom">自定义模式 →</button>
          </div>
        </div>
      </div>

      {/* 快速任务卡片 */}
      <div className="overview-card">
        <div className="overview-card-icon">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="overview-card-content">
          <h3 className="overview-card-title">快速任务</h3>
          <div className="quick-actions">
            <button 
              onClick={onScanFolder}
              className="quick-action-btn"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              扫描文件夹
            </button>
            <button 
              onClick={onImportMusic}
              className="quick-action-btn"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              导入音乐
            </button>
            <button 
              onClick={onOpenLyrics}
              className="quick-action-btn"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              打开歌词面板
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}




