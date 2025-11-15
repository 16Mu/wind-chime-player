import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ParsedLyrics, LyricLine } from '../LyricsDisplay';
import type { Track } from '../../types/music';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface CurvedLyricsFlowProps {
  lyrics: ParsedLyrics | null;
  currentPositionMs: number;
  isPlaying: boolean;
  isLoading: boolean;
  track: Track | null;
  albumCoverUrl?: string | null;
}

const CURVED_LYRICS_SETTINGS_KEY = 'windchime-curved-lyrics-settings';

/**
 * 曲线参考系沉浸式歌词组件
 * 
 * 设计理念：
 * - 左侧圆形专辑封面 + 歌曲信息
 * - 可调节曲率的参考线（黄线），歌词沿此滚动
 * - 每句歌词垂直于参考线（绿线）
 * - 控件仅在鼠标移动时显示
 */
const CurvedLyricsFlow: React.FC<CurvedLyricsFlowProps> = ({
  lyrics,
  currentPositionMs,
  isPlaying,
  isLoading,
  track,
  albumCoverUrl,
}) => {
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);
  
  // 基础布局位置（固定值，不可调）
  const BASE_ALBUM_POSITION_X = 25; // vh
  const BASE_LYRICS_OFFSET_X = 17;  // vw
  
  // 默认设置（偏移量，可调节）
  const DEFAULT_SETTINGS = {
    curvature: -0.4,
    lineRadius: 6,
    spacingFactor: 0.10,
    glowStrength: 0.50,
    maxWidthPercent: 0.65,
    albumPositionX: 0,      // 专辑封面额外偏移（vh）
    lyricsOffsetX: 0,       // 歌词区域额外偏移（vw）
    blurBackground: false,  // 背景模糊效果（默认纯黑）
    albumSize: 256,         // 专辑封面尺寸（px）
    albumRotate: true,      // 专辑旋转效果
  };

  const [curvature, setCurvature] = useState(DEFAULT_SETTINGS.curvature);
  const [lineRadius, setLineRadius] = useState(DEFAULT_SETTINGS.lineRadius);
  const [spacingFactor, setSpacingFactor] = useState(DEFAULT_SETTINGS.spacingFactor);
  const [glowStrength, setGlowStrength] = useState(DEFAULT_SETTINGS.glowStrength);
  const [maxWidthPercent, setMaxWidthPercent] = useState(DEFAULT_SETTINGS.maxWidthPercent);
  const [albumPositionX, setAlbumPositionX] = useState(DEFAULT_SETTINGS.albumPositionX);
  const [lyricsOffsetX, setLyricsOffsetX] = useState(DEFAULT_SETTINGS.lyricsOffsetX);
  const [blurBackground, setBlurBackground] = useState(DEFAULT_SETTINGS.blurBackground);
  const [albumSize, setAlbumSize] = useState(DEFAULT_SETTINGS.albumSize);
  const [albumRotate, setAlbumRotate] = useState(DEFAULT_SETTINGS.albumRotate);
  const [showSettings, setShowSettings] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [glowWidth, setGlowWidth] = useState(400); // 动态发光层宽度
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const settingsLoadedRef = useRef(false);
  const currentLineRef = useRef<HTMLParagraphElement>(null);

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

  // 鼠标移动处理 - 显示控件
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    
    hideControlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000); // 3秒后隐藏
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, []);

  // 加载持久化设置
  useEffect(() => {
    if (typeof window === 'undefined' || settingsLoadedRef.current) return;
    settingsLoadedRef.current = true;
    try {
      const raw = window.localStorage.getItem(CURVED_LYRICS_SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<typeof DEFAULT_SETTINGS>;
      if (typeof parsed.curvature === 'number') setCurvature(parsed.curvature);
      if (typeof parsed.lineRadius === 'number') setLineRadius(parsed.lineRadius);
      if (typeof parsed.spacingFactor === 'number') setSpacingFactor(parsed.spacingFactor);
      if (typeof parsed.glowStrength === 'number') setGlowStrength(parsed.glowStrength);
      if (typeof parsed.maxWidthPercent === 'number') setMaxWidthPercent(parsed.maxWidthPercent);
      if (typeof parsed.albumPositionX === 'number') setAlbumPositionX(parsed.albumPositionX);
      if (typeof parsed.lyricsOffsetX === 'number') setLyricsOffsetX(parsed.lyricsOffsetX);
      if (typeof parsed.blurBackground === 'boolean') setBlurBackground(parsed.blurBackground);
      if (typeof parsed.albumSize === 'number') setAlbumSize(parsed.albumSize);
      if (typeof parsed.albumRotate === 'boolean') setAlbumRotate(parsed.albumRotate);
    } catch (error) {
      console.warn('加载曲线歌词设置失败:', error);
    }
  }, []);

  // 保存设置
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const payload = {
        curvature,
        lineRadius,
        spacingFactor,
        glowStrength,
        maxWidthPercent,
        albumPositionX,
        lyricsOffsetX,
        blurBackground,
        albumSize,
        albumRotate,
      };
      window.localStorage.setItem(CURVED_LYRICS_SETTINGS_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('保存曲线歌词设置失败:', error);
    }
  }, [curvature, lineRadius, spacingFactor, glowStrength, maxWidthPercent, albumPositionX, lyricsOffsetX, blurBackground, albumSize, albumRotate]);

  // 恢复默认设置
  const handleResetSettings = useCallback(() => {
    setCurvature(DEFAULT_SETTINGS.curvature);
    setLineRadius(DEFAULT_SETTINGS.lineRadius);
    setSpacingFactor(DEFAULT_SETTINGS.spacingFactor);
    setGlowStrength(DEFAULT_SETTINGS.glowStrength);
    setMaxWidthPercent(DEFAULT_SETTINGS.maxWidthPercent);
    setAlbumPositionX(DEFAULT_SETTINGS.albumPositionX);
    setLyricsOffsetX(DEFAULT_SETTINGS.lyricsOffsetX);
    setBlurBackground(DEFAULT_SETTINGS.blurBackground);
    setAlbumSize(DEFAULT_SETTINGS.albumSize);
    setAlbumRotate(DEFAULT_SETTINGS.albumRotate);
  }, [DEFAULT_SETTINGS]);

  // 窗口拖动功能
  const handleDragStart = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    // 如果是在交互元素上，不触发拖动
    const target = e.target as HTMLElement;
    if (
      target.closest('button') || 
      target.closest('input') ||
      target.closest('[class*="settings"]') ||
      target.closest('[data-no-drag]')
    ) {
      return;
    }
    
    try {
      const appWindow = getCurrentWindow();
      await appWindow.startDragging();
    } catch (error) {
      console.error('窗口拖动失败:', error);
    }
  }, []);

  // 动态测量当前行歌词宽度（带边距）
  useEffect(() => {
    if (currentLineRef.current) {
      const textWidth = currentLineRef.current.offsetWidth;
      // 添加左右边距，确保发光范围更大
      const targetWidth = Math.max(textWidth * 1.5, textWidth + 100);
      setGlowWidth(targetWidth);
    }
  }, [currentLineIndex, lyrics?.lines]);

  // 平滑过渡发光层宽度
  useEffect(() => {
    const timer = setInterval(() => {
      setGlowWidth(prev => {
        if (currentLineRef.current) {
          const textWidth = currentLineRef.current.offsetWidth;
          const targetWidth = Math.max(textWidth * 1.5, textWidth + 100);
          // 缓动插值
          return prev + (targetWidth - prev) * 0.2;
        }
        return prev;
      });
    }, 50);
    return () => clearInterval(timer);
  }, []);

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

  // 计算曲线上的点位置
  const getCurvePoint = useCallback((t: number, curvature: number) => {
    // t 是从 0 到 1 的参数，表示沿参考线的位置
    // curvature 是曲率值
    
    const y = t; // Y 坐标从 0 到 1
    
    // 计算 X 偏移（二次曲线）
    // 使用抛物线公式：x = curvature * (t - 0.5)^2
    const normalizedT = t - 0.5; // 归一化到 [-0.5, 0.5]
    const x = curvature * normalizedT * normalizedT;
    
    return { x, y };
  }, []);

  // 计算垂直于曲线的角度
  const getPerpedicularAngle = useCallback((t: number, curvature: number) => {
    // 使用曲线参数的导数向量 (dx, dy) 来计算切线方向
    // x = curvature * (t - 0.5)^2
    // y = t
    // => dx/dt = 2 * curvature * (t - 0.5)
    //    dy/dt = 1
    const normalizedT = t - 0.5;
    const dx = 2 * curvature * normalizedT;
    const dy = 1;

    // 切线角度：沿着 (dx, dy) 方向
    const tangentAngle = Math.atan2(dy, dx);

    // 垂直于切线的角度（法线方向）
    // 这里减去 90°，确保在曲率为 0 时，法线为水平方向
    const normalAngle = tangentAngle - Math.PI / 2;

    return normalAngle;
  }, []);

  // 计算要显示的歌词行（基于全局索引 + 相对偏移）
  const visibleLines = useMemo(() => {
    if (!lyrics?.lines || currentLineIndex === null) return [];

    // maxRenderOffset 比实际可见的行数多两行，用于制造“滑出屏幕”的动画缓冲区
    const maxRenderOffset = lineRadius + 2;

    return lyrics.lines
      .map((line, index) => {
        const offset = index - currentLineIndex;
        if (Math.abs(offset) > maxRenderOffset) {
          return null;
        }
        return {
          line,
          originalIndex: index,
          isActive: index === currentLineIndex,
          offset,
        };
      })
      .filter((item): item is { line: LyricLine; originalIndex: number; isActive: boolean; offset: number } => item !== null);
  }, [lyrics?.lines, currentLineIndex, lineRadius]);

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
    <>
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
      <div 
        className="relative w-full h-full overflow-hidden"
        style={{
          background: blurBackground ? undefined : '#000000',
        }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleDragStart}
      >
      {/* 左侧圆形专辑封面区域 */}
      <div 
        className="absolute top-1/2 -translate-y-1/2 z-10"
        style={{
          left: `${BASE_ALBUM_POSITION_X + albumPositionX}vh`,
          transition: 'left 0.3s ease-out',
        }}
      >
        {/* 专辑封面 */}
        <div className="relative">
          <div 
            className="rounded-full overflow-hidden shadow-2xl ring-4 ring-white/20"
            style={{
              width: `${albumSize}px`,
              height: `${albumSize}px`,
              transition: 'width 0.3s ease-out, height 0.3s ease-out',
            }}
          >
            {albumCoverUrl ? (
              <img 
                src={albumCoverUrl} 
                alt="Album Cover" 
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
                style={{
                  animation: albumRotate && isPlaying ? 'spin 10s linear infinite' : 'none',
                  display: 'block',
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onError={(e) => {
                  console.error('❌ 封面加载失败:', albumCoverUrl);
                  e.currentTarget.style.display = 'none';
                }}
                onLoad={(e) => {
                  console.log('✅ 封面加载成功:', albumCoverUrl);
                  e.currentTarget.style.display = 'block';
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <svg className="w-24 h-24 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
            )}
          </div>
          
          {/* 歌曲信息 */}
          <div className="mt-6 text-center max-w-xs">
            <h2 className="text-white text-2xl font-bold truncate mb-2">
              {track?.title || '未知歌曲'}
            </h2>
            <p className="text-white/80 text-lg truncate mb-1">
              {track?.artist || '未知艺术家'}
            </p>
            {track?.album && (
              <p className="text-white/60 text-base truncate">
                {track.album}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 歌词区域 */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `translateX(${BASE_LYRICS_OFFSET_X + lyricsOffsetX}vw)`,
          transition: 'transform 0.3s ease-out',
        }}
      >
        {/* 固定的中心发光层 - 动态宽度和高度 */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${glowWidth}px`,
            height: '12rem', // 增加高度以适应多行歌词
            filter: `blur(${30 * (0.3 + glowStrength * 0.7)}px)`,
            opacity: 0.6 * (0.3 + glowStrength * 0.7),
            background: 'radial-gradient(ellipse, rgba(255, 255, 255, 0.9) 0%, transparent 70%)',
            zIndex: 5,
            transition: 'width 0.4s ease-out, height 0.4s ease-out',
          }}
        />
        
        <div className="relative w-full h-full">
          {visibleLines.map(({ line, originalIndex, isActive, offset }) => {
            // 以当前行为中心，根据 offset 沿曲线分布
            const tCenter = 0.5;
            const tRaw = tCenter + offset * spacingFactor;
            
            // ⚠️ 修复：超出范围的歌词直接不渲染
            if (tRaw < -0.05 || tRaw > 1.05) {
              return null;
            }
            
            const t = Math.max(0, Math.min(1, tRaw));

            // 获取曲线上的点
            const curvePoint = getCurvePoint(t, curvature);
            const perpAngle = getPerpedicularAngle(t, curvature);

            // 计算屏幕位置
            const screenX = 50 + curvePoint.x * 100; // 从屏幕中心开始，单位：vw
            const screenY = curvePoint.y * 100; // 0-100vh

            // 计算透明度、缩放
            const distance = Math.abs(offset);
            const opacity = isActive ? 1 : Math.max(0.2, 1 - distance * 0.18);
            // 当前行轻微放大，其他行正常大小
            const scale = isActive ? 1.05 : 0.95;
            
            // 基于屏幕Y位置的模糊（Apple Music风格）
            // screenY范围是0-100，中心是50
            const distanceFromCenter = Math.abs(screenY - 50);
            // 距离中心0-20范围：0模糊
            // 距离中心20-50范围：逐渐增加到最大8px
            const blurAmount = Math.max(0, Math.min((distanceFromCenter - 20) * 0.4, 8));

            // Apple Music推挤动画：当前行主动快速进入，上一行明显延迟退出
            let duration: string;
            let timingFunction: string;
            let transformDelay: number;
            
            if (isActive) {
              // 当前行：舒缓地挤进来（带轻微弹性）
              duration = '0.75s';
              timingFunction = 'cubic-bezier(0.34, 1.2, 0.64, 1)'; // 轻微弹性
              transformDelay = 0;
            } else if (offset === -1) {
              // 上一行（刚被挤走）：延迟后平滑退出
              duration = '0.75s';
              timingFunction = 'cubic-bezier(0.25, 0.1, 0.25, 1)'; // 平滑退出
              transformDelay = 70; // 延迟产生推挤感，提前开始
            } else if (offset > 0) {
              // 下方行（等待进入）：跟随移动
              duration = '0.95s';
              timingFunction = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
              transformDelay = offset * 35;
            } else {
              // 其他已退出的行：缓慢退出
              duration = '1.05s';
              timingFunction = 'cubic-bezier(0.25, 0.1, 0.25, 1)';
              transformDelay = 70 + (Math.abs(offset) - 1) * 40;
            }

            return (
              <div
                key={originalIndex}
                className="absolute cursor-pointer select-none"
                style={{
                  left: `${screenX}%`,
                  top: `${screenY}%`,
                  transform: `translate(-50%, -50%) rotate(${perpAngle}rad) scale(${scale})`,
                  transformOrigin: 'center',
                  // Apple Music推挤效果：当前行快速弹入，上一行延迟退出
                  transition: `
                    left ${duration} ${timingFunction} ${transformDelay}ms,
                    top ${duration} ${timingFunction} ${transformDelay}ms,
                    transform ${duration} ${timingFunction} ${transformDelay}ms,
                    opacity 0.4s ease-out,
                    filter 0.5s ease-out
                  `.trim(),
                  opacity,
                  width: `${maxWidthPercent * 100}vw`,
                  filter: `blur(${blurAmount}px)`,
                  zIndex: isActive ? 20 : 10,
                  willChange: 'left, top, transform, opacity, filter',
                }}
                onClick={() => handleLineClick(line.timestamp_ms)}
              >
                <div className="flex flex-col items-center" style={{ gap: isActive ? '0.25rem' : '0.15rem' }}>
                  {/* 原文歌词 - 支持多行 */}
                  <div 
                    ref={isActive ? currentLineRef : null}
                    className="text-white text-center w-full px-4"
                    style={{
                      fontSize: isActive ? '2.2rem' : '1.5rem',
                      fontWeight: isActive ? 700 : 400,
                      transition: `
                        font-size ${duration} ${timingFunction} ${transformDelay}ms,
                        font-weight ${duration} ${timingFunction} ${transformDelay}ms
                      `.trim(),
                      lineHeight: 1.3,
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                    }}
                  >
                    {line.text || '♪'}
                  </div>

                  {/* 译文歌词（如果有） - 支持多行 */}
                  {line.translation && (
                    <div
                      className="text-white text-center w-full px-4"
                      style={{
                        fontSize: isActive ? '1.2rem' : '0.95rem',
                        fontWeight: 400,
                        opacity: isActive ? 0.9 : 0.7,
                        transition: `
                          font-size ${duration} ${timingFunction} ${transformDelay}ms,
                          opacity 0.4s ease-out
                        `.trim(),
                        lineHeight: 1.3,
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                      }}
                    >
                      {line.translation}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 设置按钮 - 仅在鼠标移动时显示，响应式定位 */}
      <button
        onClick={() => setShowSettings(true)}
        className={`absolute w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/80 transition-all duration-300 flex items-center justify-center group ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={{
          bottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
          right: 'max(1rem, env(safe-area-inset-right, 1rem))',
        }}
      >
        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white/80 group-hover:text-white group-hover:rotate-90 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* 设置侧边栏 - 响应式宽度 */}
      <div
        className="fixed top-0 right-0 h-full z-50 overflow-hidden"
        style={{
          width: 'min(400px, 90vw)', // 更小的最大宽度，确保小窗口下可见
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(80px) saturate(180%) brightness(0.85)',
          WebkitBackdropFilter: 'blur(80px) saturate(180%) brightness(0.85)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.3), inset 1px 0 0 rgba(255, 255, 255, 0.05)',
          transform: showSettings ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        data-no-drag
      >
        <div className="h-full flex flex-col">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
            <h2 className="text-lg sm:text-xl font-bold text-white">曲线歌词设置</h2>
            <button
              onClick={() => setShowSettings(false)}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-200 flex items-center justify-center flex-shrink-0"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 px-4 sm:px-6 py-4 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
              <div className="space-y-4 sm:space-y-5" data-no-drag>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-white text-sm font-medium">曲率调节</label>
                    <span className="text-white/60 text-sm">{curvature.toFixed(2)}</span>
                  </div>
                  <input type="range" min="-2" max="2" step="0.1" value={curvature} onChange={(e) => setCurvature(parseFloat(e.target.value))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg" />
                  <div className="flex justify-between text-xs text-white/50"><span>左弯</span><span>直线</span><span>右弯</span></div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-white text-sm font-medium">可见行数</label>
                    <span className="text-white/60 text-sm">±{lineRadius} 行</span>
                  </div>
                  <input type="range" min={2} max={10} step={1} value={lineRadius} onChange={(e) => setLineRadius(parseInt(e.target.value, 10))} className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-white text-sm font-medium">行间距</label>
                    <span className="text-white/60 text-sm">{spacingFactor.toFixed(3)}</span>
                  </div>
                  <input type="range" min={0.03} max={0.15} step={0.005} value={spacingFactor} onChange={(e) => setSpacingFactor(parseFloat(e.target.value))} className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-white text-sm font-medium">发光强度</label>
                    <span className="text-white/60 text-sm">{Math.round(glowStrength * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={1} step={0.05} value={glowStrength} onChange={(e) => setGlowStrength(parseFloat(e.target.value))} className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-white text-sm font-medium">歌词宽度</label>
                    <span className="text-white/60 text-sm">{Math.round(maxWidthPercent * 100)}%</span>
                  </div>
                  <input type="range" min={0.4} max={0.9} step={0.05} value={maxWidthPercent} onChange={(e) => setMaxWidthPercent(parseFloat(e.target.value))} className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg" />
                </div>
                <div className="border-t border-white/10 pt-6"></div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-white text-sm font-medium">专辑封面偏移</label>
                    <span className="text-white/60 text-sm">{albumPositionX > 0 ? '+' : ''}{albumPositionX}vh</span>
                  </div>
                  <input type="range" min={-20} max={20} step={1} value={albumPositionX} onChange={(e) => setAlbumPositionX(parseInt(e.target.value, 10))} className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-white text-sm font-medium">歌词水平偏移</label>
                    <span className="text-white/60 text-sm">{lyricsOffsetX > 0 ? '+' : ''}{lyricsOffsetX}vw</span>
                  </div>
                  <input type="range" min={-20} max={20} step={1} value={lyricsOffsetX} onChange={(e) => setLyricsOffsetX(parseInt(e.target.value, 10))} className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg" />
                </div>
                <div className="border-t border-white/10 pt-6"></div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-white text-sm font-medium">专辑封面大小</label>
                    <span className="text-white/60 text-sm">{albumSize}px</span>
                  </div>
                  <input type="range" min={150} max={400} step={10} value={albumSize} onChange={(e) => setAlbumSize(parseInt(e.target.value, 10))} className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-white text-sm font-medium">专辑旋转效果</label>
                    <button
                      onClick={() => setAlbumRotate(!albumRotate)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                        albumRotate ? 'bg-white text-black' : 'bg-white/20 text-white'
                      }`}
                    >
                      {albumRotate ? '开启' : '关闭'}
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-white text-sm font-medium">背景模糊效果</label>
                    <button
                      onClick={() => setBlurBackground(!blurBackground)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                        blurBackground ? 'bg-white text-black' : 'bg-white/20 text-white'
                      }`}
                    >
                      {blurBackground ? '开启' : '关闭'}
                    </button>
                  </div>
                </div>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-4 border-t border-white/10 flex items-center justify-between gap-2 sm:gap-4 flex-shrink-0">
            <button 
              onClick={handleResetSettings} 
              className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-medium transition-all duration-200"
            >
              恢复默认
            </button>
            <button 
              onClick={() => setShowSettings(false)} 
              className="px-5 sm:px-8 py-2 sm:py-2.5 rounded-xl bg-white text-black text-xs sm:text-sm font-semibold hover:bg-white/90 transition-all duration-200 shadow-lg"
            >
              完成
            </button>
          </div>
        </div>
      </div>

      {/* 参考黄线：仅在设置面板打开时出现 */}
      {showSettings && (
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: '100%', height: '100%' }}
        >
          <path
            d={(() => {
              const points: string[] = [];
              const steps = 80;
              for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const point = getCurvePoint(t, curvature);
                const x = (50 + point.x * 100) * window.innerWidth / 100;
                const y = point.y * window.innerHeight;
                points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
              }
              return points.join(' ');
            })()}
            stroke="rgba(255, 255, 0, 0.25)"
            strokeWidth={2}
            fill="none"
          />
        </svg>
      )}
      </div>
    </>
  );
};

export default React.memo(CurvedLyricsFlow);
