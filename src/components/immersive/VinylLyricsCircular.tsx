import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ParsedLyrics, LyricLine } from '../LyricsDisplay';
import type { Track } from '../../types/music';
import { useCoverCache } from '../../contexts/CoverCacheContext';

interface VinylLyricsCircularProps {
  lyrics: ParsedLyrics | null;
  currentPositionMs: number;
  isPlaying: boolean;
  isLoading: boolean;
  track: Track | null;
}

// 唱片配置常量 - 统一管理所有尺寸，方便调整
const VINYL_CONFIG = {
  // 唱片整体尺寸
  size: 420,                    // 唱片外圈直径（px）
  grooveInset: 40,              // 唱片沟槽到封面的距离（px）
  
  // 唱臂配置
  tonearm: {
    length: 208,                // 唱臂长度（px）= size * 0.5 左右
    width: 8,                   // 唱臂宽度（px）
    offsetRight: 0.24,          // 唱臂右侧偏移（相对唱片半径的比例）
    offsetTop: 0.05,            // 唱臂顶部偏移（相对唱片半径的比例）
    anglePlay: 20,              // 播放时角度（度）
    anglePause: 40,             // 暂停时角度（度）
  },
};

/**
 * 黑胶唱片模式组件
 * 
 * 设计理念（参考 Apple Music、网易云音乐等主流APP）：
 * - 中心是旋转的黑胶唱片，专辑封面在唱片中央
 * - 唱片外圈有黑色边框和沟槽效果
 * - 播放时唱片旋转，暂停时停止
 * - 唱片上方显示歌曲信息
 * - 唱片下方显示歌词，垂直滚动
 * - 可选的唱臂装饰效果
 */
const VinylLyricsCircular: React.FC<VinylLyricsCircularProps> = ({
  lyrics,
  currentPositionMs,
  isPlaying,
  isLoading,
  track,
}) => {
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);
  const [albumCoverUrl, setAlbumCoverUrl] = useState<string | null>(null);
  const { loadAlbumCover, getAlbumCover } = useCoverCache();

  // 基于配置计算唱臂位置
  const tonearmPosition = useMemo(() => {
    const radius = VINYL_CONFIG.size / 2;
    return {
      right: -(radius * VINYL_CONFIG.tonearm.offsetRight),
      top: radius * VINYL_CONFIG.tonearm.offsetTop,
    };
  }, []);

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

  // 更新当前行
  useEffect(() => {
    if (!lyrics?.lines || lyrics.lines.length === 0) return;
    
    const newIndex = getCurrentLineIndex(lyrics.lines, currentPositionMs);
    if (newIndex !== currentLineIndex) {
      setCurrentLineIndex(newIndex);
    }
  }, [lyrics?.lines, currentPositionMs, currentLineIndex, getCurrentLineIndex]);

  // 加载专辑封面
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

  // 计算要显示的歌词行
  const visibleLines = useMemo(() => {
    if (!lyrics?.lines || currentLineIndex === null) return [];
    
    const LINES_BEFORE = 1;  // 显示前1行
    const LINES_AFTER = 6;   // 显示后6行，充分利用下方空间
    
    const startIndex = Math.max(0, currentLineIndex - LINES_BEFORE);
    const endIndex = Math.min(lyrics.lines.length - 1, currentLineIndex + LINES_AFTER);
    
    return lyrics.lines.slice(startIndex, endIndex + 1).map((line, idx) => ({
      line,
      originalIndex: startIndex + idx,
      isActive: startIndex + idx === currentLineIndex,
    }));
  }, [lyrics?.lines, currentLineIndex]);

  // 渲染加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
          <span className="text-white/70 text-lg">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col items-center overflow-hidden">
      {/* 顶部留空 - 为歌曲信息预留空间 */}
      <div className="h-32" />

      {/* 黑胶唱片 + 唱臂整体区域 */}
      <div className="relative mb-14 z-10 flex-shrink-0 flex items-center justify-center">
        <div 
          className="relative"
          style={{
            width: `${VINYL_CONFIG.size}px`,
            height: `${VINYL_CONFIG.size}px`,
          }}
        >
          {/* 外圈黑胶边框 - 最外层 */}
          <div 
            className="absolute inset-0 rounded-full bg-gradient-to-br from-gray-900 via-black to-gray-800"
            style={{
              boxShadow: '0 30px 60px rgba(0,0,0,0.6), inset 0 0 80px rgba(0,0,0,0.8)',
            }}
          >
            {/* 唱片沟槽效果 */}
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full border border-white/5"
                style={{
                  inset: `${20 + i * 12}px`,
                  animation: isPlaying ? 'spin 3s linear infinite' : 'none',
                }}
              />
            ))}
          </div>

          {/* 旋转的封面容器 */}
          <div
            className="absolute rounded-full overflow-hidden shadow-2xl"
            style={{
              inset: `${VINYL_CONFIG.grooveInset}px`,
              animation: isPlaying ? 'spin 8s linear infinite' : 'none',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 0 30px rgba(0,0,0,0.3)',
            }}
          >
            {/* 专辑封面 */}
            {albumCoverUrl ? (
              <img
                src={albumCoverUrl}
                alt={track?.title || 'Album Cover'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                <svg className="w-32 h-32 text-white/20" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                </svg>
              </div>
            )}
            
            {/* 中心圆孔 */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-gray-800 via-black to-gray-700 shadow-inner">
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-gray-900 to-black shadow-2xl" />
            </div>
          </div>

          {/* 高光效果 */}
          <div 
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.1) 0%, transparent 60%)',
            }}
          />

          {/* 唱臂装饰 - 基于配置自动定位 */}
          <div
            className="absolute origin-top-right pointer-events-none transition-transform duration-1000 ease-out"
            style={{
              right: `${tonearmPosition.right}px`,
              top: `${tonearmPosition.top}px`,
              transform: isPlaying 
                ? `rotate(${VINYL_CONFIG.tonearm.anglePlay}deg)` 
                : `rotate(${VINYL_CONFIG.tonearm.anglePause}deg)`,
            }}
          >
            <div className="relative">
              {/* 唱臂支架 */}
              <div
                className="bg-gradient-to-b from-gray-400 via-gray-300 to-gray-400 rounded-full shadow-lg"
                style={{
                  width: `${VINYL_CONFIG.tonearm.width}px`,
                  height: `${VINYL_CONFIG.tonearm.length}px`,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.3)',
                }}
              />
              {/* 唱针头 */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-gray-500 rounded-full shadow-md" />
              {/* 唱臂连接点 */}
              <div className="absolute -top-3 right-0 w-7 h-7 bg-gray-700 rounded-full shadow-lg border-2 border-gray-500" />
            </div>
          </div>
        </div>
      </div>

      {/* 歌词区域 */}
      <div className="w-full max-w-4xl flex-1 z-10 px-8 pb-20 flex items-start">
        {!lyrics || !lyrics.lines.length ? (
          <div className="text-center py-12 w-full">
            <p className="text-white/40 text-xl">暂无歌词</p>
          </div>
        ) : (
          <div className="space-y-4 w-full pt-10">
            {visibleLines.map(({ line, originalIndex, isActive }) => (
              <div
                key={originalIndex}
                className="text-center cursor-pointer transition-all duration-700 ease-out"
                onClick={() => handleLineClick(line.timestamp_ms)}
              >
                {/* 原文 */}
                <p
                  className={`transition-all duration-700 leading-tight ${
                    isActive 
                      ? 'text-white text-3xl font-bold scale-105' 
                      : 'text-white/50 text-lg font-normal'
                  }`}
                  style={{
                    textShadow: isActive 
                      ? '0 0 30px rgba(255,255,255,0.8), 0 2px 10px rgba(0,0,0,0.5)' 
                      : 'none',
                    transform: isActive ? 'translateY(0)' : 'translateY(0)',
                  }}
                >
                  {line.text || '♪'}
                </p>
                
                {/* 译文 */}
                {line.translation && (
                  <p
                    className={`mt-3 transition-all duration-700 ${
                      isActive 
                        ? 'text-white/70 text-lg font-medium' 
                        : 'text-white/25 text-base'
                    }`}
                    style={{
                      textShadow: isActive ? '0 1px 5px rgba(0,0,0,0.3)' : 'none',
                    }}
                  >
                    {line.translation}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 全局动画样式 */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default React.memo(VinylLyricsCircular);
