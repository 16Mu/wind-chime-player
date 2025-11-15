import React, { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Track } from '../../types/music';
import type { ParsedLyrics } from '../LyricsDisplay';
import CurvedLyricsFlow from './CurvedLyricsFlow';
import FBMWaveBackground from './FBMWaveBackground';
import { usePlaybackPosition } from '../../contexts/PlaybackContext';
import { useCoverCache } from '../../contexts/CoverCacheContext';

interface CurvedLyricsPanelProps {
  track: Track | null;
  currentPositionMs?: number;
  isPlaying: boolean;
  onClose: () => void;
  onError?: (message: string) => void;
}

const isDevelopment = (import.meta as any).env?.DEV || (import.meta as any).env?.MODE === 'development';

/**
 * 曲线参考系沉浸式歌词面板
 * 
 * 特性：
 * - 曲率可调的参考线系统
 * - 歌词垂直于参考线排列
 * - 圆形专辑封面在左侧
 * - 控件鼠标移动时显示
 */
const CurvedLyricsPanel: React.FC<CurvedLyricsPanelProps> = ({
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
  const [albumCoverUrl, setAlbumCoverUrl] = useState<string | null>(null);
  const trackRef = useRef(track);
  const onErrorRef = useRef(onError);
  const [visible, setVisible] = useState(false);
  
  // 保持 onErrorRef 最新
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

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
      onErrorRef.current?.('未找到歌词');
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载歌词失败';
      setLyrics(null);
      setError(message);
      onErrorRef.current?.(message);
    } finally {
      setIsLoading(false);
    }
  }, []); // ✅ 使用 onErrorRef，避免依赖变化导致无限循环

  // 加载专辑封面（使用缓存系统）
  useEffect(() => {
    if (!track?.id) {
      setAlbumCoverUrl(null);
      return;
    }

    const albumKey = `${track.album || 'Unknown'}-${track.artist || 'Unknown'}`;
    const cachedCover = getAlbumCover(albumKey);
    
    console.log('[CurvedLyricsPanel] 专辑Key:', albumKey);
    console.log('[CurvedLyricsPanel] 缓存封面:', cachedCover);
    
    if (cachedCover) {
      setAlbumCoverUrl(cachedCover);
      return;
    }

    loadAlbumCover(track.id, albumKey).then(url => {
      console.log('[CurvedLyricsPanel] 加载封面结果:', url);
      if (url) {
        setAlbumCoverUrl(url);
      }
    });
  }, [track?.id, track?.album, track?.artist, loadAlbumCover, getAlbumCover]);

  useEffect(() => {
    void loadLyrics();
  }, [track?.id]); // ✅ 只依赖 track?.id，不依赖 loadLyrics

  useEffect(() => {
    setVisible(true);
  }, []);

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
        <CurvedLyricsFlow
          lyrics={lyrics}
          currentPositionMs={effectivePositionMs}
          isPlaying={isPlaying}
          isLoading={isLoading}
          track={track}
          albumCoverUrl={albumCoverUrl}
        />
      </div>

      {isDevelopment && error && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-red-300 bg-black/50 px-6 py-3 rounded-xl z-50">
          错误: {error}
        </div>
      )}
    </div>
  );
};

export default CurvedLyricsPanel;
