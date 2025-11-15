import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Track } from '../../types/music';
import type { ParsedLyrics, LyricLine } from '../LyricsDisplay';

interface ImmersiveLyricsScrollProps {
  lyrics: ParsedLyrics | null;
  currentPositionMs: number;
  isPlaying: boolean;
  isLoading: boolean;
  track: Track | null;
}

/**
 * 沉浸式歌词滚动组件
 * 
 * 设计规格（严格遵循技术文档）：
 * 
 * 1. 歌词状态：
 *    - active（当前播放行）：最大字号、粗体、完全不透明
 *    - inactive（未播放/已播放行）：较小字号、常规字重、半透明
 * 
 * 2. 字体样式：
 *    - active原文：2.5rem、font-weight: 700、opacity: 1
 *    - active译文：1.5rem、font-weight: 400、opacity: 1
 *    - inactive原文：1.8rem、font-weight: 400、opacity: 0.5
 *    - inactive译文：1.2rem、font-weight: 400、opacity: 0.5
 * 
 * 3. 动画效果：
 *    - 所有样式变化使用 transition: all 0.5s ease-in-out
 *    - 滚动动画平滑，将active行滚动到容器垂直居中
 * 
 * 4. 间距规格：
 *    - 块内间距小（原文与译文紧凑）
 *    - 块间距大（不同歌词块明显分离）
 */
const ImmersiveLyricsScroll: React.FC<ImmersiveLyricsScrollProps> = ({
  lyrics,
  currentPositionMs,
  isLoading,
  track,
}) => {
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 获取当前歌词行索引
  const getCurrentLineIndex = useCallback((lines: LyricLine[], positionMs: number): number | null => {
    if (!lines.length) return null;
    
    let currentIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].timestamp_ms <= positionMs) {
        currentIndex = i;
      } else {
        break;
      }
    }
    
    return currentIndex >= 0 ? currentIndex : null;
  }, []);

  // 更新当前行并滚动
  useEffect(() => {
    if (!lyrics?.lines || lyrics.lines.length === 0) return;
    
    const newIndex = getCurrentLineIndex(lyrics.lines, currentPositionMs);
    
    if (newIndex !== currentLineIndex) {
      setCurrentLineIndex(newIndex);
      
      // 平滑滚动到当前行
      if (newIndex !== null && lineRefs.current[newIndex] && containerRef.current) {
        const container = containerRef.current;
        const lineElement = lineRefs.current[newIndex];
        
        // 计算目标位置：将当前行滚动到容器中央
        const containerHeight = container.clientHeight;
        const lineTop = lineElement.offsetTop;
        const lineHeight = lineElement.clientHeight;
        const targetScrollTop = lineTop - (containerHeight / 2) + (lineHeight / 2);
        
        // 平滑滚动
        container.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth',
        });
      }
    }
  }, [lyrics?.lines, currentPositionMs, currentLineIndex, getCurrentLineIndex]);

  // 点击歌词行跳转
  const handleLineClick = useCallback(async (timestamp_ms: number) => {
    if (!track?.id) return;
    
    try {
      const { hybridPlayer } = await import('../../services/hybridPlayer');
      await hybridPlayer.seek(Math.floor(timestamp_ms));
    } catch (error) {
      console.error('歌词跳转失败:', error);
    }
  }, [track?.id]);

  // 渲染加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
          <span className="text-white/70 text-lg">加载歌词中...</span>
        </div>
      </div>
    );
  }

  // 渲染无歌词状态
  if (!lyrics || !lyrics.lines.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <svg className="w-20 h-20 mx-auto mb-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-white/70 text-lg">暂无歌词</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-y-auto overflow-x-hidden scrollbar-hide"
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {/* 上部空白区域，确保第一行可以居中 */}
      <div className="h-1/2"></div>

      {/* 歌词列表 */}
      <div className="px-8">
        {lyrics.lines.map((line, index) => {
          const isActive = index === currentLineIndex;
          
          return (
            <div
              key={index}
              ref={(el) => {
                lineRefs.current[index] = el;
              }}
              className="lyric-block cursor-pointer"
              style={{
                marginBottom: '2em', // 块间距
                transition: 'all 0.5s ease-in-out',
              }}
              onClick={() => handleLineClick(line.timestamp_ms)}
            >
              {/* 原文歌词 */}
              <p
                className="primary-lyric text-white text-center"
                style={{
                  fontSize: isActive ? '2.5rem' : '1.8rem',
                  fontWeight: isActive ? 700 : 400,
                  opacity: isActive ? 1 : 0.5,
                  transition: 'all 0.5s ease-in-out',
                  marginBottom: line.translation ? '0.3em' : 0, // 如果有译文，减小间距
                }}
              >
                {line.text || '♪'}
              </p>

              {/* 译文歌词（如果有） */}
              {line.translation && (
                <p
                  className="translated-lyric text-white text-center"
                  style={{
                    fontSize: isActive ? '1.5rem' : '1.2rem',
                    fontWeight: 400,
                    opacity: isActive ? 1 : 0.5,
                    transition: 'all 0.5s ease-in-out',
                  }}
                >
                  {line.translation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* 下部空白区域，确保最后一行可以居中 */}
      <div className="h-1/2"></div>
    </div>
  );
};

export default React.memo(ImmersiveLyricsScroll);

