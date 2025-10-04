import React, { useRef, useMemo, useCallback } from 'react';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';
import LyricLine from './LyricLine';

interface ParsedLyrics {
  lines: Array<{
    text: string;
    timestamp_ms: number;
  }>;
}

interface FontSizes {
  normal: number;
  near: number;
  current: number;
  maxLines: number;
  spacingInfo?: {
    lineHeight: number;
    lineSpacing: number;
  };
}

interface ScrollConfig {
  easing: string;
  durationBase: number;
  durationMin: number;
  durationMax: number;
  durationK: number;
  minDeltaNonAnimPx: number;
}

interface LyricsScrollContainerProps {
  lyrics: ParsedLyrics;
  currentLineIndex: number | null;
  previousLineIndex: number | null;
  fontSizes: FontSizes;
  scrollConfig: ScrollConfig;
  onLineClick: (timestamp: number, index: number) => void;
  highlightOverrideIndex?: number | null;
  onScrollStateChange?: (isScrolling: boolean) => void;
  onManualHighlightChange?: (index: number | null) => void;
  className?: string;
}

/**
 * 歌词滚动容器组件
 * 
 * 使用 React.memo 优化，避免父组件重渲染导致的DOM元素重新挂载
 * 
 * 核心设计：
 * 1. 接收当前索引作为props，内部不管理索引状态
 * 2. 使用useScrollAnimation处理所有滚动逻辑
 * 3. 使用CSS Variables控制transform，避免直接操作style
 */
const LyricsScrollContainer = React.memo<LyricsScrollContainerProps>(
  ({ 
    lyrics, 
    currentLineIndex, 
    previousLineIndex, 
    fontSizes, 
    scrollConfig,
    onLineClick,
    onScrollStateChange,
    className = ''
  }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const linesRef = useRef<(HTMLDivElement | null)[]>([]);
    
    // ✅ 使用专用Hook处理滚动动画（内部自动判断seek）
    // 注意：高亮始终跟随 currentLineIndex，不受手动滚动影响
    useScrollAnimation(
      containerRef as React.RefObject<HTMLDivElement>,
      linesRef,
      currentLineIndex,
      fontSizes,
      scrollConfig,
      {
        resumeDelayMs: 1500,
        onUserScrollChange: onScrollStateChange,
        // 不使用 onManualFocusChange，高亮始终跟随播放位置
      }
    );
    
    // ✅ 使用useCallback确保onLineClick引用稳定
    const handleLineClick = useCallback((timestamp: number, index: number) => {
      onLineClick(timestamp, index);
    }, [onLineClick]);
    
    // ✅ 计算间距（memo避免重复计算）
    // ✅ 修复1: 增大歌词行之间的间距（从0.6倍增加到1.2倍字体大小），使其明显大于同一行内的换行间距
    const lineSpacing = useMemo(() => {
      return fontSizes.spacingInfo?.lineSpacing || Math.max(fontSizes.normal * 1.2, 32);
    }, [fontSizes.spacingInfo?.lineSpacing, fontSizes.normal]);
    
    console.log(`🔄 [LyricsScrollContainer] 渲染, currentIndex=${currentLineIndex}, linesCount=${lyrics.lines.length}`, {
      fontSizes: fontSizes.normal,
      scrollConfig: scrollConfig.easing,
      onLineClick: typeof onLineClick
    });
    
    return (
      <div 
        ref={containerRef}
        className={`lyrics-scroll-container min-h-full flex flex-col justify-center will-change-transform ${className}`}
        style={{
          // ✅ 使用CSS Variables，由useScrollAnimation控制
          transform: 'translate3d(0, var(--lyrics-y, 0), 0)',
          transition: 'transform var(--lyrics-duration, 0ms) var(--lyrics-easing)',
        }}
      >
        <div 
          className="py-16 relative" 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: `${lineSpacing}px`,
            paddingTop: '30vh',
            paddingBottom: '30vh'
          }}
        >
          {lyrics.lines.map((line, index) => {
            // ✅ 发光始终跟随当前播放索引，不受手动滚动影响
            const isCurrentLine = index === currentLineIndex;
            
            return (
              <LyricLine
                key={`line-${index}-${line.timestamp_ms}`}
                ref={(el) => {
                  linesRef.current[index] = el;
                }}
                text={line.text}
                index={index}
                isCurrent={isCurrentLine}
                wasPrevious={index === previousLineIndex}
                currentLineIndex={currentLineIndex}
                fontSize={fontSizes.normal}
                onLineClick={() => handleLineClick(line.timestamp_ms, index)}
              />
            );
          })}
        </div>
      </div>
    );
  },
  // ✅ 自定义比较函数：精确控制何时重渲染
  (prevProps, nextProps) => {
    // 对比歌词内容（使用行数和首行时间戳作为快速检查）
    const lyricsEqual = 
      prevProps.lyrics.lines.length === nextProps.lyrics.lines.length &&
      prevProps.lyrics.lines[0]?.timestamp_ms === nextProps.lyrics.lines[0]?.timestamp_ms;
    
    // 对比索引
    const indexEqual = 
      prevProps.currentLineIndex === nextProps.currentLineIndex &&
      prevProps.previousLineIndex === nextProps.previousLineIndex;
    
    // 对比字体大小（只比较关键值）
    const fontEqual = 
      prevProps.fontSizes.normal === nextProps.fontSizes.normal &&
      prevProps.fontSizes.near === nextProps.fontSizes.near &&
      prevProps.fontSizes.current === nextProps.fontSizes.current;
    
    // 对比滚动配置 - 对比所有关键属性
    const configEqual = 
      prevProps.scrollConfig.easing === nextProps.scrollConfig.easing &&
      prevProps.scrollConfig.durationBase === nextProps.scrollConfig.durationBase &&
      prevProps.scrollConfig.durationMin === nextProps.scrollConfig.durationMin &&
      prevProps.scrollConfig.durationMax === nextProps.scrollConfig.durationMax &&
      prevProps.scrollConfig.durationK === nextProps.scrollConfig.durationK &&
      prevProps.scrollConfig.minDeltaNonAnimPx === nextProps.scrollConfig.minDeltaNonAnimPx;
    
    // 对比其他props
    const otherEqual = 
      prevProps.onLineClick === nextProps.onLineClick &&
      prevProps.className === nextProps.className;
    
    const shouldSkipRender = lyricsEqual && indexEqual && fontEqual && configEqual && otherEqual;
    
    if (!shouldSkipRender) {
      console.log(`🔄 [LyricsScrollContainer] 需要重渲染:`, {
        lyricsEqual,
        indexEqual,
        fontEqual,
        configEqual,
        otherEqual,
        fontSizesChanged: {
          normal: prevProps.fontSizes.normal !== nextProps.fontSizes.normal,
          near: prevProps.fontSizes.near !== nextProps.fontSizes.near,
          current: prevProps.fontSizes.current !== nextProps.fontSizes.current
        },
        configChanged: {
          easing: prevProps.scrollConfig.easing !== nextProps.scrollConfig.easing,
          durationBase: prevProps.scrollConfig.durationBase !== nextProps.scrollConfig.durationBase,
          minDeltaNonAnimPx: prevProps.scrollConfig.minDeltaNonAnimPx !== nextProps.scrollConfig.minDeltaNonAnimPx
        }
      });
    }
    
    return shouldSkipRender;
  }
);

LyricsScrollContainer.displayName = 'LyricsScrollContainer';

export default LyricsScrollContainer;

