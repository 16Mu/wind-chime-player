import React, { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Track } from '../../types/music';
import type { ParsedLyrics } from '../LyricsDisplay';
import VinylLyricsCircular from './VinylLyricsCircular';
import FBMWaveBackground from './FBMWaveBackground';
import { usePlaybackPosition } from '../../contexts/PlaybackContext';
import { useCoverCache } from '../../contexts/CoverCacheContext';

interface ImmersiveLyricsPanelProps {
  track: Track | null;
  currentPositionMs?: number;
  isPlaying: boolean;
  onClose: () => void;
  onError?: (message: string) => void;
}

const isDevelopment = (import.meta as any).env?.DEV || (import.meta as any).env?.MODE === 'development';

const ImmersiveLyricsPanel: React.FC<ImmersiveLyricsPanelProps> = ({
  track,
  currentPositionMs,
  isPlaying,
  onClose,
  onError,
}) => {
  const getPosition = usePlaybackPosition();
  const { getAlbumCover, loadAlbumCover } = useCoverCache();
  const [lyrics, setLyrics] = useState<ParsedLyrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [albumCoverUrl, setAlbumCoverUrl] = useState<string | null>(null);
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const trackRef = useRef(track);
  const [visible, setVisible] = useState(false);

  const effectivePositionMs = (() => {
    if (typeof currentPositionMs === 'number' && !Number.isNaN(currentPositionMs)) {
      return currentPositionMs;
    }
    const pos = getPosition();
    return typeof pos === 'number' && !Number.isNaN(pos) ? pos : 0;
  })();

  useEffect(() => {
    trackRef.current = track;
  }, [track]);


  const preprocessLyrics = (raw: ParsedLyrics | null): ParsedLyrics | null => {
    if (!raw) return null;
    return {
      ...raw,
      lines: raw.lines.filter((line) => (line.text?.trim().length || 0) > 0),
    };
  };

  const loadLyrics = useCallback(async () => {
    const currentTrack = trackRef.current;
    if (!currentTrack?.id) {
      setLyrics(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const dbLyrics = await invoke<any>('lyrics_get', { trackId: currentTrack.id, track_id: currentTrack.id });

      if (dbLyrics && typeof dbLyrics === 'object' && 'content' in dbLyrics) {
        const parsed = await invoke<ParsedLyrics>('lyrics_parse', { content: dbLyrics.content });
        setLyrics(preprocessLyrics(parsed));
        return;
      }

      if (currentTrack.path) {
        const searchResult = await invoke<ParsedLyrics | null>('lyrics_search_comprehensive', {
          audioPath: currentTrack.path,
          audio_path: currentTrack.path,
        });

        if (searchResult && searchResult.lines && searchResult.lines.length > 0) {
          setLyrics(preprocessLyrics(searchResult));
          return;
        }
      }

      setLyrics(null);
      setError('未找到歌词');
      onError?.('未找到歌词');
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载歌词失败';
      setLyrics(null);
      setError(message);
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  }, [onError]);


  useEffect(() => {
    void loadLyrics();
  }, [track?.id]);

  // 加载专辑封面（使用缓存系统）
  useEffect(() => {
    if (!track?.id) {
      setAlbumCoverUrl(null);
      return;
    }

    const albumKey = `${track.album || 'Unknown'}-${track.artist || 'Unknown'}`;
    const cachedCover = getAlbumCover(albumKey);
    
    if (cachedCover) {
      setAlbumCoverUrl(cachedCover);
      return;
    }

    loadAlbumCover(track.id, albumKey).then(url => {
      if (url) {
        setAlbumCoverUrl(url);
      }
    });
  }, [track?.id, track?.album, track?.artist, loadAlbumCover, getAlbumCover]);

  useEffect(() => {
    setVisible(true);
  }, []);

  // 鼠标移动检测
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      
      // 清除之前的定时器
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
      
      // 3秒后隐藏控制栏
      hideControlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, []);

  // 播放控制函数
  const handlePlayPause = async () => {
    try {
      const { hybridPlayer } = await import('../../services/hybridPlayer');
      if (isPlaying) {
        await hybridPlayer.pause();
      } else {
        await hybridPlayer.resume();
      }
    } catch (error) {
      console.error('播放控制失败:', error);
    }
  };

  const handlePrevious = async () => {
    try {
      const { hybridPlayer } = await import('../../services/hybridPlayer');
      await hybridPlayer.previous();
    } catch (error) {
      console.error('上一曲失败:', error);
    }
  };

  const handleNext = async () => {
    try {
      const { hybridPlayer } = await import('../../services/hybridPlayer');
      await hybridPlayer.next();
    } catch (error) {
      console.error('下一曲失败:', error);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black/90 backdrop-blur-3xl transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <FBMWaveBackground albumCoverUrl={albumCoverUrl} playing={isPlaying} />

      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-300 z-50"
      >
        <span className="text-white text-xl">×</span>
      </button>

      {/* 歌词显示区域 */}
      <div className="absolute inset-0">
        <VinylLyricsCircular
          lyrics={lyrics}
          currentPositionMs={effectivePositionMs}
          isPlaying={isPlaying}
          isLoading={isLoading}
          track={track}
        />
      </div>

      {/* 歌曲信息 - 固定在顶部 */}
      <div className="absolute top-4 left-0 right-0 flex flex-col items-center gap-1 z-20">
        <h1 className="text-white text-3xl font-bold truncate max-w-3xl px-8 drop-shadow-lg">
          {track?.title || '未知歌曲'}
        </h1>
        <p className="text-white/70 text-lg truncate max-w-3xl px-8 drop-shadow-md">
          {track?.artist || '未知艺术家'}
        </p>
        {track?.album && (
          <p className="text-white/50 text-sm truncate max-w-3xl px-8 drop-shadow-md">
            {track.album}
          </p>
        )}
      </div>

      {/* 播放控制栏 - 底部中央，鼠标移动时显示 */}
      <div 
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 transition-all duration-500 ease-out z-30 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="bg-white/10 backdrop-blur-xl rounded-full px-8 py-4 shadow-2xl border border-white/20">
          <div className="flex items-center gap-6">
            {/* 上一曲 */}
            <button
              onClick={handlePrevious}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-300 flex items-center justify-center group"
            >
              <svg className="w-6 h-6 text-white/80 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>

            {/* 播放/暂停 */}
            <button
              onClick={handlePlayPause}
              className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 transition-all duration-300 flex items-center justify-center group shadow-lg"
            >
              {isPlaying ? (
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            {/* 下一曲 */}
            <button
              onClick={handleNext}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-300 flex items-center justify-center group"
            >
              <svg className="w-6 h-6 text-white/80 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {isDevelopment && error && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 text-red-300 bg-black/50 px-6 py-3 rounded-xl z-50">
          错误: {error}
        </div>
      )}
    </div>
  );
};

export default ImmersiveLyricsPanel;
