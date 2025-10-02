interface Track {
  id: number;
  title?: string;
  artist?: string;
  album?: string;
}

interface ListeningHistoryItem {
  time: string;
  track: Track;
}

interface LibraryAsidePanelProps {
  currentTrack?: Track | null;
  isPlaying?: boolean;
  genres?: string[];
  listeningHistory?: ListeningHistoryItem[];
  announcement?: {
    title: string;
    content: string;
  };
  onGenreClick?: (genre: string) => void;
  onHistoryTrackClick?: (trackId: number) => void;
}

export default function LibraryAsidePanel({
  currentTrack,
  isPlaying = false,
  genres = ['流行', '摇滚', '爵士', '电子', '古典', '民谣'],
  listeningHistory = [],
  announcement,
  onGenreClick,
  onHistoryTrackClick
}: LibraryAsidePanelProps) {
  
  return (
    <div className="library-aside-panel">
      {/* 正在播放卡片 */}
      <div className="aside-card now-playing-card">
        <h3 className="aside-card-title">正在播放</h3>
        {currentTrack ? (
          <div className="now-playing-content">
            <div className="now-playing-cover">
              <div className="cover-placeholder">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
            </div>
            <div className="now-playing-info">
              <div className="track-title">{currentTrack.title || '未知曲目'}</div>
              <div className="track-artist">{currentTrack.artist || '未知艺术家'}</div>
            </div>
            <div className="now-playing-status">
              {isPlaying ? (
                <div className="playing-indicator">
                  <span className="wave-bar"></span>
                  <span className="wave-bar"></span>
                  <span className="wave-bar"></span>
                </div>
              ) : (
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
          </div>
        ) : (
          <div className="now-playing-empty">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p className="text-sm text-gray-500">暂无播放</p>
          </div>
        )}
      </div>

      {/* 流派探索卡片 */}
      <div className="aside-card genre-explorer-card">
        <h3 className="aside-card-title">流派探索</h3>
        <div className="genre-tags">
          {genres.map((genre, index) => (
            <button
              key={index}
              onClick={() => onGenreClick?.(genre)}
              className="genre-tag"
              style={{
                backgroundColor: `hsl(${index * 60}, 70%, 95%)`,
                color: `hsl(${index * 60}, 70%, 35%)`
              }}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* 持续收听卡片 */}
      <div className="aside-card listening-timeline-card">
        <h3 className="aside-card-title">持续收听</h3>
        {listeningHistory.length > 0 ? (
          <div className="listening-timeline">
            {listeningHistory.slice(0, 5).map((item, index) => (
              <button
                key={index}
                onClick={() => onHistoryTrackClick?.(item.track.id)}
                className="timeline-item"
              >
                <div className="timeline-time">{item.time}</div>
                <div className="timeline-track">
                  <div className="timeline-track-title">{item.track.title || '未知曲目'}</div>
                  <div className="timeline-track-artist">{item.track.artist || '未知艺术家'}</div>
                </div>
                <svg className="w-4 h-4 timeline-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">暂无播放历史</p>
        )}
      </div>

      {/* 公告/更新卡片 */}
      {announcement && (
        <div className="aside-card announcement-card">
          <h3 className="aside-card-title">{announcement.title}</h3>
          <div className="announcement-content">
            <p className="text-sm text-gray-600 leading-relaxed">{announcement.content}</p>
          </div>
        </div>
      )}
    </div>
  );
}




