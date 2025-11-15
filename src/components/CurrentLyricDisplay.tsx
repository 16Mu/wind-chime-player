import { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { usePlaybackPosition } from '../contexts/PlaybackContext';

interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
}

interface LyricLine {
  time: number;
  text: string;
  translation?: string;
}

interface CurrentLyricDisplayProps {
  track: Track | null;
  className?: string;
  lyricsData?: LyricLine[];
}

export default function CurrentLyricDisplay({ track, className = '', lyricsData }: CurrentLyricDisplayProps) {
  const [currentText, setCurrentText] = useState('');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const lyricsRef = useRef<LyricLine[]>(lyricsData ?? []);
  const getPosition = usePlaybackPosition();

  const parseLyrics = (content: string): LyricLine[] => {
    return content
      .split('\n')
      .map(line => {
        // 🔧 修复：支持1-2位数的分钟，毫秒可选
        const match = line.match(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/);
        if (!match) return null;

        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
        const text = match[4].trim();
        if (!text) return null;

        return {
          time: (minutes * 60 + seconds) * 1000 + milliseconds,
          text,
        };
      })
      .filter((line): line is LyricLine => line !== null)
      .sort((a, b) => a.time - b.time);
  };

  useEffect(() => {
    if (lyricsData) {
      lyricsRef.current = lyricsData;
      return;
    }

    let isMounted = true;

    const loadLyrics = async () => {
      if (!track?.id) {
        if (isMounted) {
          setCurrentText('');
          lyricsRef.current = [];
        }
        return;
      }

      try {
        const result = await invoke('lyrics_get', { trackId: track.id, track_id: track.id }) as { content: string } | null;
        if (!isMounted) return;

        if (result?.content) {
          const parsed = parseLyrics(result.content);
          lyricsRef.current = parsed;
        } else {
          lyricsRef.current = [];
          setCurrentText('');
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('加载歌词失败:', error);
        lyricsRef.current = [];
        setCurrentText('');
      }
    };

    loadLyrics();
    return () => {
      isMounted = false;
    };
  }, [track?.id, lyricsData]);

  const displayText = useMemo(() => {
    if (currentText) return currentText;
    if (lyricsRef.current.length > 0) return '♪';
    if (track) return '暂无歌词';
    return '';
  }, [currentText, track]);

  useEffect(() => {
    if (lyricsRef.current.length === 0) {
      setCurrentText('');
      return;
    }

    let rafId: number;

    const update = () => {
      const position = getPosition();
      if (typeof position === 'number' && !isNaN(position)) {
        const lines = lyricsRef.current;
        let index = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].time <= position) {
            index = i;
          } else {
            break;
          }
        }

        const currentLine = index >= 0 ? lines[index] : null;
        const text = currentLine?.text || '';
        const translation = currentLine?.translation || '';
        const displayText = translation ? `${text}\n${translation}` : text;
        
        if (displayText !== currentText) {
          setIsFadingOut(true);
          setTimeout(() => {
            setCurrentText(displayText);
            setIsFadingOut(false);
          }, 160);
        }
      }
      rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [getPosition, currentText]);

  const isEmpty = !currentText;
  const animationClass = isFadingOut ? 'lyric-fade-out' : 'lyric-fade-in';

  return (
    <div
      className={`current-lyric-display ${isEmpty ? 'empty' : ''} ${animationClass} ${className}`.trim()}
    >
      {displayText}
    </div>
  );
}

