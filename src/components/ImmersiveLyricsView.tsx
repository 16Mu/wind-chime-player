import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

// 歌词滚动配置参数（严格按照手册第9章推荐）
// 🎨 动画效果预设方案
const ANIMATION_PRESETS = {
  // Q弹系列 🏀
  BOUNCY_SOFT: {
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    durBase: 350, durK: 1.0, durMin: 450, durMax: 1000,
    name: '轻柔Q弹'
  },
  BOUNCY_STRONG: {
    easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    durBase: 400, durK: 1.2, durMin: 500, durMax: 1200,
    name: '强烈Q弹'
  },
  BOUNCY_PLAYFUL: {
    easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    durBase: 320, durK: 1.1, durMin: 420, durMax: 1100,
    name: '俏皮Q弹'
  },
  
  // 平滑系列 🌊
  SMOOTH_ELEGANT: {
    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    durBase: 280, durK: 0.9, durMin: 380, durMax: 900,
    name: '优雅平滑'
  },
  SMOOTH_SWIFT: {
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    durBase: 250, durK: 0.8, durMin: 320, durMax: 800,
    name: '敏捷平滑'
  },
  SMOOTH_DREAMY: {
    easing: 'cubic-bezier(0.165, 0.84, 0.44, 1)',
    durBase: 380, durK: 1.3, durMin: 500, durMax: 1400,
    name: '梦幻平滑'
  },
  
  // 特殊效果 ✨
  ORGANIC_FLOW: {
    easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
    durBase: 320, durK: 1.0, durMin: 400, durMax: 1000,
    name: '自然流动'
  },
  PRECISE_SNAP: {
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    durBase: 200, durK: 0.7, durMin: 240, durMax: 600,
    name: '精准快速'
  }
};

// 动态生成滚动配置的函数
const createScrollConfig = (animationKey: keyof typeof ANIMATION_PRESETS) => {
  const animation = ANIMATION_PRESETS[animationKey];
  console.log(`🎨 [动画效果] 已启用: ${animation.name} | 缓动: ${animation.easing}`);
  
  return {
    SEEK_INDEX_SPAN: 3,
    SEEK_TIME_MULTIPLIER: 3.0,
    SEEK_TIME_MIN_MS: 8000,
    SEEK_TIME_MAX_MS: 30000,
    MIN_DELTA_NO_ANIM_PX: 30,
    DURATION_BASE_MS: animation.durBase,
    DURATION_K_PER_PX: animation.durK,
    DURATION_MIN_MS: animation.durMin,
    DURATION_MAX_MS: animation.durMax,
    EASING: animation.easing
  };
};

// 距离自适应时长计算函数
const computeDurationMs = (deltaY: number, config: ReturnType<typeof createScrollConfig>): number => {
  const abs = Math.abs(deltaY);
  const { DURATION_BASE_MS, DURATION_K_PER_PX, DURATION_MIN_MS, DURATION_MAX_MS } = config;
  return Math.max(DURATION_MIN_MS, Math.min(DURATION_MAX_MS, DURATION_BASE_MS + DURATION_K_PER_PX * abs));
};

// 轻量日志系统（按照手册第16章设计）
type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';
type LogEvent = {
  name: string;
  level: LogLevel;
  ts: number;
  ctx: Record<string, any>;
};

const LOG_CONFIG = {
  level: 'info' as LogLevel,  // 恢复正常日志级别
  sampling: 0.1 // 恢复正常采样率
};

const logBuffer: LogEvent[] = [];
const LOG_BUFFER_SIZE = 500;

const shouldLog = (level: LogLevel): boolean => {
  const levels = ['error', 'warn', 'info', 'debug', 'trace'];
  const currentIndex = levels.indexOf(LOG_CONFIG.level);
  const eventIndex = levels.indexOf(level);
  return eventIndex <= currentIndex && Math.random() < LOG_CONFIG.sampling;
};

const lyricsLog = (name: string, level: LogLevel, ctx: Record<string, any>) => {
  if (!shouldLog(level)) return;
  
  const event: LogEvent = {
    name,
    level,
    ts: Date.now(),
    ctx: {
      ...ctx,
      dpr: window.devicePixelRatio,
      screenW: window.innerWidth,
      screenH: window.innerHeight
    }
  };
  
  logBuffer.push(event);
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
  
  // 控制台输出（开发环境）
  if (level !== 'trace') {
    console.log(`[歌词滚动-${level}] ${name}:`, ctx);
  }
  
  // 异常判定
  if (name === 'scroll_compute' && ctx.branch === 'animated' && ctx.durationMs <= 120 && Math.abs(ctx.deltaY) >= 8) {
    console.warn('[疑似闪切] 短时长覆盖较大位移:', ctx);
  }
  
  // 周期性跳切诊断
  if (name === 'scroll_compute' && ctx.isJumpCut) {
    console.warn(`🔴 [跳切检测] 第${ctx.idx}行 → deltaY:${ctx.deltaY}px, 阈值:${ctx.minDeltaThreshold}px`, ctx);
  }
  
  if (name === 'scroll_compute' && ctx.branch === 'animated') {
    console.log(`🟢 [正常动画] 第${ctx.idx}行 → deltaY:${ctx.deltaY}px, 时长:${ctx.durationMs}ms`, ctx);
  }
};

// 方案B：单引擎状态机事件模型（按照手册定义）
type ScrollEvent = 
  | { type: 'IndexChange'; idx: number; tMs: number }
  | { type: 'Seek'; idx: number; tMs: number; dtMs: number; absIdxDelta: number }
  | { type: 'LayoutChange'; reason: 'font' | 'window' | 'lyrics' };

type ScrollState = 'Idle' | 'AlignInstant' | 'AlignAnimated';

// 单引擎滚动调度器Hook（消除多effect竞态写入）
const useLyricsScrollOrchestrator = (
  lyricsRef: React.RefObject<HTMLDivElement | null>,
  movingWrapRef: React.RefObject<HTMLDivElement | null>,
  lineRefs: React.RefObject<(HTMLDivElement | null)[]>,
  lyrics: ParsedLyrics | null,
  onLineIndexChange: (current: number | null, previous: number | null) => void,
  scrollConfig: ReturnType<typeof createScrollConfig>
) => {
  const stateRef = useRef<ScrollState>('Idle');
  const lastTranslateYRef = useRef<number>(0);
  const lastIdxRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // 测量行中心位置（防护版本）
  const measureCenter = useCallback((idx: number): number | null => {
    const el = lineRefs.current?.[idx];
    const container = lyricsRef.current;
    if (!el || !container) {
      lyricsLog('measure_line_center', 'trace', { 
        idx, 
        elExists: !!el, 
        containerExists: !!container, 
        isReady: false 
      });
      return null;
    }
    
    const rect = el.getBoundingClientRect();
    const offsetTop = el.offsetTop;
    const offsetHeight = el.offsetHeight;
    
    if (rect.height === 0 || offsetHeight === 0) {
      lyricsLog('measure_line_center', 'trace', { 
        idx, 
        rectHeight: rect.height, 
        offsetHeight, 
        isReady: false 
      });
      return null;
    }
    
    const centerY = offsetTop + offsetHeight / 2;
    lyricsLog('measure_line_center', 'trace', { 
      idx, 
      centerY, 
      offsetTop, 
      offsetHeight, 
      containerH: container.clientHeight, 
      isReady: true 
    });
    
    return centerY;
  }, []);

  // 计算目标位移
  const computeTranslateY = useCallback((centerY: number): number => {
    const container = lyricsRef.current;
    if (!container) return 0;
    return Math.round(container.clientHeight / 2 - centerY);
  }, []);

  // 瞬时对齐动作
  const applyTransformInstant = useCallback((y: number) => {
    const moving = movingWrapRef.current;
    if (!moving) return;
    
    lyricsLog('transition_interrupt', 'info', { 
      prevTransition: moving.style.transition, 
      currentTransform: moving.style.transform, 
      reason: 'instant align' 
    });
    
    moving.style.transition = 'none';
    moving.style.transform = `translate3d(0, ${y}px, 0)`;
    
    lyricsLog('transition_apply', 'info', { 
      transitionText: 'none', 
      transformText: `translate3d(0, ${y}px, 0)`, 
      ts: Date.now() 
    });
    
    lastTranslateYRef.current = y;
  }, []);

  // 动画对齐动作
  const applyTransformAnimated = useCallback((y: number, duration: number, easing: string) => {
    const moving = movingWrapRef.current;
    if (!moving) return;
    
    lyricsLog('transition_interrupt', 'info', { 
      prevTransition: moving.style.transition, 
      currentTransform: moving.style.transform, 
      reason: 'animated align' 
    });
    
    // 中断上一次动画
    moving.style.transition = 'none';
    // 强制reflow确保中断生效
    void moving.offsetHeight;
    
    // 设置新的过渡
    const transitionText = `transform ${duration}ms ${easing}`;
    moving.style.transition = transitionText;
    moving.style.transform = `translate3d(0, ${y}px, 0)`;
    
    lyricsLog('transition_apply', 'info', { 
      transitionText, 
      transformText: `translate3d(0, ${y}px, 0)`, 
      ts: Date.now() 
    });
    
    lastTranslateYRef.current = y;
  }, []);

  // 事件调度器（单写入通道）
  const dispatch = useCallback((event: ScrollEvent) => {
    
    const container = lyricsRef.current;
    const moving = movingWrapRef.current;
    if (!container || !moving || !lyrics?.lines?.length) {
      console.log(`⚠️ [Orchestrator] 条件不满足:`, { container: !!container, moving: !!moving, linesLength: lyrics?.lines?.length });
      return;
    }

    // 获取目标索引
    let idx: number;
    if (event.type === 'LayoutChange') {
      // LayoutChange应该基于当前实际显示的行，而不是lastIdxRef
      // 因为lastIdxRef可能在状态更新异步过程中不同步
      idx = lastIdxRef.current ?? 0;
    } else {
      idx = event.idx;
    }
    if (idx < 0) idx = 0;

    // 记录事件
    if (event.type === 'IndexChange') {
      lyricsLog('line_index_change', 'info', { 
        t: event.tMs, 
        idx, 
        lastIdx: lastIdxRef.current, 
        dtMs: event.tMs - lastTimeRef.current,
        eventType: event.type
      });
    } else if (event.type === 'Seek') {
      lyricsLog('line_index_change', 'info', { 
        t: event.tMs, 
        idx, 
        lastIdx: lastIdxRef.current, 
        dtMs: event.dtMs, 
        absIdxDelta: event.absIdxDelta,
        eventType: event.type
      });
    }

    // 统一测量
    const centerY = measureCenter(idx);
    if (centerY == null) {
      lyricsLog('measure_unready', 'warn', { idx, skipReason: `${event.type} - centerY is null` });
      return; // 未就绪，等待下次事件
    }
    
    const targetY = computeTranslateY(centerY);
    const deltaY = targetY - lastTranslateYRef.current;

    // 判定分支
    const isSeek = event.type === 'Seek';
    const isLayout = event.type === 'LayoutChange';
    const useInstant = isSeek || isLayout || Math.abs(deltaY) < scrollConfig.MIN_DELTA_NO_ANIM_PX;

    // 记录滚动计算
    const branch = useInstant ? (isSeek ? 'seek' : isLayout ? 'layout' : 'minDelta') : 'animated';
    const duration = !useInstant ? computeDurationMs(deltaY, scrollConfig) : 0;
    
    // 周期性诊断：标记是否为跳切
    const isJumpCut = useInstant && event.type === 'IndexChange';
    
    lyricsLog('scroll_compute', 'debug', { 
      idx: idx, // 添加行索引用于诊断
      targetTranslateY: targetY, 
      lastTranslateY: lastTranslateYRef.current, 
      deltaY, 
      absDeltaY: Math.abs(deltaY),
      durationMs: duration, 
      easing: scrollConfig.EASING, 
      branch,
      eventType: event.type,
      isJumpCut: isJumpCut, // 关键诊断字段
      minDeltaThreshold: scrollConfig.MIN_DELTA_NO_ANIM_PX,
      belowThreshold: Math.abs(deltaY) < scrollConfig.MIN_DELTA_NO_ANIM_PX,
      centerY: centerY, // 测量值
      containerH: container.clientHeight
    });

    // 执行动作（单写入通道）
    if (useInstant) {
      stateRef.current = 'AlignInstant';
      applyTransformInstant(targetY);
      if (isLayout) {
        lyricsLog('layout_resync', 'info', { 
          idx, 
          translateY: targetY, 
          containerH: container.clientHeight, 
          centerY, 
          reason: event.reason 
        });
      } else if (isSeek) {
        lyricsLog('seek_align', 'info', { 
          idx, 
          dtMs: event.type === 'Seek' ? event.dtMs : 0, 
          absIdxDelta: event.type === 'Seek' ? event.absIdxDelta : 0, 
          translateY: targetY 
        });
      }
    } else {
      stateRef.current = 'AlignAnimated';
      applyTransformAnimated(targetY, duration, scrollConfig.EASING);
    }

    // 同步高亮与追踪（仅在索引实际变化时）
    // 推迟状态更新到下一帧，确保DOM写入完成后再更新状态，避免时序竞态
    if (event.type !== 'LayoutChange' && lastIdxRef.current !== idx) {
      const prevIdx = lastIdxRef.current;
      requestAnimationFrame(() => {
        onLineIndexChange(idx, prevIdx);
      });
    }
    
    // 更新追踪变量
    lastIdxRef.current = idx;
    if (event.type === 'IndexChange' || event.type === 'Seek') {
      lastTimeRef.current = event.tMs;
    }
    
    stateRef.current = 'Idle';
  }, [lyrics?.lines, measureCenter, computeTranslateY, applyTransformInstant, applyTransformAnimated, onLineIndexChange]);

  return { dispatch, lastIdxRef, lastTimeRef };
};

// 智能响应式字体大小计算 - 基于窗口尺寸、分辨率和设备像素比
const getResponsiveFontSizes = () => {
  // 获取精确的视口尺寸
  const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  
  // 设备像素比检测，优化高DPI屏幕显示
  const dpr = window.devicePixelRatio || 1;
  const isHighDPI = dpr >= 1.5;
  
  // 计算实际歌词显示区域尺寸
  const lyricsWidth = vw * 0.6; // 右侧歌词区域宽度（60%）
  const lyricsHeight = vh * 0.8; // 歌词区域有效高度（考虑上下内边距）
  
  // 屏幕尺寸分类
  const isSmallScreen = vw < 1024 || vh < 768;
  const isMediumScreen = vw >= 1024 && vw < 1440;
  const isLargeScreen = vw >= 1440 && vw < 1920;
  const isXLargeScreen = vw >= 1920;
  
  // 基于屏幕尺寸的基础字体大小系数
  let baseSizeRatio, currentSizeRatio, nearSizeRatio;
  
  if (isSmallScreen) {
    // 小屏幕：更紧凑的字体（基础字体再增大40%）
    baseSizeRatio = isHighDPI ? 0.032 : 0.036;
    currentSizeRatio = isHighDPI ? 0.042 : 0.048;
    nearSizeRatio = isHighDPI ? 0.030 : 0.034;
  } else if (isMediumScreen) {
    // 中等屏幕：平衡的字体大小（基础字体再增大40%）
    baseSizeRatio = isHighDPI ? 0.036 : 0.042;
    currentSizeRatio = isHighDPI ? 0.050 : 0.056;
    nearSizeRatio = isHighDPI ? 0.035 : 0.040;
  } else if (isLargeScreen) {
    // 大屏幕：更舒适的字体（基础字体再增大40%）
    baseSizeRatio = isHighDPI ? 0.042 : 0.046;
    currentSizeRatio = isHighDPI ? 0.058 : 0.064;
    nearSizeRatio = isHighDPI ? 0.040 : 0.045;
  } else {
    // 超大屏幕：最大字体，但避免过大（基础字体再增大40%）
    baseSizeRatio = isHighDPI ? 0.045 : 0.050;
    currentSizeRatio = isHighDPI ? 0.063 : 0.070;
    nearSizeRatio = isHighDPI ? 0.043 : 0.048;
  }
  
  // 计算字体大小（同时考虑宽度和高度限制）
  const baseSize = Math.min(
    lyricsWidth * baseSizeRatio,
    vh * (baseSizeRatio * 0.8) // 高度约束稍微宽松
  );
  
  const currentSize = Math.min(
    lyricsWidth * currentSizeRatio,
    vh * (currentSizeRatio * 0.8)
  );
  
  const nearSize = Math.min(
    lyricsWidth * nearSizeRatio,
    vh * (nearSizeRatio * 0.8)
  );
  
  // 设置最小和最大字体限制（基础字体再增大40%）
  const minBase = isSmallScreen ? 22 : 25;
  const maxBase = isXLargeScreen ? 38 : 32;
  const minCurrent = isSmallScreen ? 26 : 28;
  const maxCurrent = isXLargeScreen ? 52 : 45;
  const minNear = isSmallScreen ? 20 : 22;
  const maxNear = isXLargeScreen ? 34 : 28;
  
  const finalBaseSize = Math.max(minBase, Math.min(maxBase, baseSize));
  const finalCurrentSize = Math.max(minCurrent, Math.min(maxCurrent, currentSize));
  const finalNearSize = Math.max(minNear, Math.min(maxNear, nearSize));
  
  // 智能行数计算 - 减少显示行数
  const lineHeight = finalCurrentSize * 1.6; // 行高系数
  const lineSpacing = Math.max(finalCurrentSize * 0.6, 16); // 行间距
  const totalLineSpace = lineHeight + lineSpacing;
  
  // 计算可显示的最大行数（考虑上下内边距）
  const availableHeight = lyricsHeight - (32 * 2); // 减去上下内边距
  const maxVisibleLines = Math.floor(availableHeight / totalLineSpace);
  
  // 确保合适的显示行数 - 减少显示行数让界面更简洁
  const optimalLines = Math.max(3, Math.min(9, Math.floor(maxVisibleLines * 0.6)));
  
  return {
    normal: Math.round(finalBaseSize),
    near: Math.round(finalNearSize), 
    current: Math.round(finalCurrentSize),
    maxLines: optimalLines,
    // 额外的布局信息
    screenInfo: {
      width: vw,
      height: vh,
      dpr: dpr,
      isHighDPI: isHighDPI,
      category: isSmallScreen ? 'small' : isMediumScreen ? 'medium' : isLargeScreen ? 'large' : 'xlarge'
    },
    spacingInfo: {
      lineHeight: Math.round(lineHeight),
      lineSpacing: Math.round(lineSpacing),
      availableHeight: availableHeight
    }
  };
};

export interface LyricLine {
  timestamp_ms: number;
  text: string;
}

export interface ParsedLyrics {
  lines: LyricLine[];
  metadata: { [key: string]: string };
}

interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
}

interface ImmersiveLyricsViewProps {
  track?: Track;
  currentPositionMs: number;
  isPlaying: boolean;
  onClose: () => void;
  onError?: (error: string) => void;
  transitionOrigin?: { x: number; y: number; width: number; height: number } | null;
  onTransitionComplete?: () => void;
}

export default function ImmersiveLyricsView({
  track,
  currentPositionMs,
  isPlaying,
  onClose,
  onError: _onError, // 接收但不使用，避免警告
  transitionOrigin,
  onTransitionComplete
}: ImmersiveLyricsViewProps) {
  const [lyrics, setLyrics] = useState<ParsedLyrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);
  const [previousLineIndex, setPreviousLineIndex] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [fontSizes, setFontSizes] = useState(getResponsiveFontSizes());
  
  // 过渡动画相关状态
  const [isTransitioning, setIsTransitioning] = useState(!!transitionOrigin);
  const [animationPhase, setAnimationPhase] = useState<'entering' | 'visible' | 'exiting'>('entering');
  
  // 鼠标移动检测状态
  const [showControls, setShowControls] = useState(false);
  const mouseTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 皮肤切换相关状态
  const [showSkinPanel, setShowSkinPanel] = useState(false);
  const [currentSkin, setCurrentSkin] = useState<'classic' | 'split' | 'fullscreen' | 'card' | 'minimal'>('classic');
  
  // 🎨 动画效果设置状态（从localStorage读取）
  const [selectedAnimation, setSelectedAnimation] = useState<keyof typeof ANIMATION_PRESETS>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('windchime-lyrics-animation-settings');
      if (stored) {
        try {
          const settings = JSON.parse(stored);
          return settings.enabled ? settings.style : 'BOUNCY_SOFT';
        } catch (error) {
          console.warn('Failed to parse lyrics animation settings:', error);
        }
      }
    }
    return 'BOUNCY_SOFT';
  });
  
  
  // 监听localStorage变化，同步动画设置
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'windchime-lyrics-animation-settings' && e.newValue) {
        try {
          const settings = JSON.parse(e.newValue);
          if (settings.enabled) {
            setSelectedAnimation(settings.style);
            console.log(`🎨 [动画设置] 已同步: ${ANIMATION_PRESETS[settings.style as keyof typeof ANIMATION_PRESETS]?.name}`);
          } else {
            // 禁用时使用精准快速模式（最小动画）
            setSelectedAnimation('PRECISE_SNAP');
            console.log('🎨 [动画设置] 动画已禁用，使用精准快速模式');
          }
        } catch (error) {
          console.warn('Failed to sync lyrics animation settings:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 初始化时检查设置状态
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('windchime-lyrics-animation-settings');
      if (stored) {
        try {
          const settings = JSON.parse(stored);
          if (!settings.enabled) {
            setSelectedAnimation('PRECISE_SNAP');
            console.log('🎨 [动画设置] 初始化：动画已禁用，使用精准快速模式');
          }
        } catch (error) {
          console.warn('Failed to parse lyrics animation settings on init:', error);
        }
      }
    }
  }, []);
  
  // 动态滚动配置
  const SCROLL_CONFIG = createScrollConfig(selectedAnimation);
  
  // 用户跳转状态
  // const [isUserJumping, setIsUserJumping] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const movingWrapRef = useRef<HTMLDivElement>(null); // 被 transform 的内部包裹层
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // 时间戳数组（二分查找用）
  const timestampsRef = useRef<number[]>([]);
  
  // 高亮状态变更回调
  const handleLineIndexChange = useCallback((current: number | null, previous: number | null) => {
    setPreviousLineIndex(previous);
    setCurrentLineIndex(current);
  }, []);

  // 方案B：单引擎滚动调度器（消除竞态写入）
  const { dispatch, lastIdxRef, lastTimeRef } = useLyricsScrollOrchestrator(
    lyricsRef,
    movingWrapRef,
    lineRefs,
    lyrics,
    handleLineIndexChange,
    SCROLL_CONFIG
  );

  // 二分查找当前行索引
  const findIndexAtTime = useCallback((timeMs: number): number => {
    const ts = timestampsRef.current;
    if (ts.length === 0) return -1;
    let lo = 0;
    let hi = ts.length - 1;
    if (timeMs < ts[0]) return -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (ts[mid] === timeMs) return mid;
      if (ts[mid] < timeMs) lo = mid + 1; else hi = mid - 1;
    }
    return Math.max(0, lo - 1);
  }, []);

  // 已移除独立的getLineCenter函数，由orchestrator内部的measureCenter取代

  // 已移除连续滚动的tick函数，改为仅在行切换时触发滚动（符合手册要求）
  
  // 背景渐变状态管理
  const [backgroundPhase] = useState(0);
  const [albumCoverUrl, setAlbumCoverUrl] = useState<string | null>(null);


  // 格式化时间函数
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 进度条点击处理
  const handleProgressClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!track?.duration_ms) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const targetPosition = Math.floor(percentage * track.duration_ms);
    
    try {
      await invoke('player_seek', { positionMs: targetPosition });
      // 如果原本在播放，确保seek后继续播放
      if (isPlaying) {
        await invoke('player_resume');
      }
    } catch (error) {
      console.error('Progress seek failed:', error);
    }
  }, [track?.duration_ms, isPlaying]);

  // 播放/暂停控制
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      invoke('player_pause').catch(console.error);
    } else {
      invoke('player_resume').catch(console.error);
    }
  }, [isPlaying]);

  // 上一首
  const handlePrevious = useCallback(() => {
    invoke('player_previous').catch(console.error);
  }, []);

  // 下一首  
  const handleNext = useCallback(() => {
    invoke('player_next').catch(console.error);
  }, []);
  
  
  
  
  

  // 加载歌词
  const loadLyrics = useCallback(async (id: number, trackPath?: string) => {
    if (!id) return;
    
    console.log('🎵 [沉浸式] 开始加载歌词, trackId:', id, 'trackPath:', trackPath);
    setIsLoading(true);
    setError(null);
    
    try {
      // 首先尝试从数据库获取歌词
      const dbLyrics = await invoke('lyrics_get', { trackId: id });
      
      if (dbLyrics && typeof dbLyrics === 'object' && 'content' in dbLyrics) {
        const parsed = await invoke('lyrics_parse', { 
          content: (dbLyrics as any).content 
        }) as ParsedLyrics;
        
        setLyrics(parsed);
        return;
      }
      
      // 如果数据库中没有歌词，尝试从文件系统搜索
      if (trackPath) {
        const searchResult = await invoke('lyrics_search_comprehensive', { 
          audioPath: trackPath 
        }) as ParsedLyrics | null;
        
        if (searchResult && searchResult.lines && searchResult.lines.length > 0) {
          setLyrics(searchResult);
          return;
        }
      }
      
      setLyrics(null);
      setError('未找到歌词');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载歌词失败';
      console.error('🎵 [沉浸式] 歌词加载失败:', errorMessage);
      setError(errorMessage);
      setLyrics(null);
    } finally {
      setIsLoading(false);
    }
  }, []); // 移除onError依赖，避免重复创建

  // 组件进入动画 - 支持过渡动画
  useEffect(() => {
    if (transitionOrigin) {
      // 有过渡动画起点，立即开始过渡动画
      setIsVisible(true);
      setAnimationPhase('entering');
      
      // 过渡动画完成后的处理
      const timer = setTimeout(() => {
        setAnimationPhase('visible');
        setIsTransitioning(false);
        onTransitionComplete?.();
      }, 800); // 与过渡动画时长保持一致
      
      return () => clearTimeout(timer);
    } else {
      // 没有过渡动画，使用原有的淡入动画
      const timer = setTimeout(() => {
        setIsVisible(true);
        setAnimationPhase('visible');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [transitionOrigin, onTransitionComplete]);


  // 当曲目改变时加载歌词
  useEffect(() => {
    console.log('🎵 [ImmersiveLyricsView] track变化:', track?.id, track?.title);
    if (track?.id) {
      loadLyrics(track.id, track.path);
    } else {
      setLyrics(null);
      setError(null);
      setCurrentLineIndex(null);
    }
  }, [track?.id, track?.path]); // 移除loadLyrics依赖，避免无限循环

  // 已移除基于定时器的渐进切换，统一由 rAF + transform 引擎驱动
  // （占位以保持结构稳定）

  // 更新时间戳表
  useEffect(() => {
    if (!lyrics?.lines || lyrics.lines.length === 0) return;
    timestampsRef.current = lyrics.lines.map(l => l.timestamp_ms);
  }, [lyrics?.lines]);

  // 计算歌词平均时间间隔（用于动态seek检测）
  const calculateAverageInterval = useCallback(() => {
    if (!lyrics?.lines?.length || lyrics.lines.length < 2) return 5000; // 默认5秒
    
    let totalInterval = 0;
    let count = 0;
    
    for (let i = 1; i < lyrics.lines.length; i++) {
      const interval = lyrics.lines[i].timestamp_ms - lyrics.lines[i-1].timestamp_ms;
      if (interval > 0 && interval < 60000) { // 排除异常值（>60秒的间隔）
        totalInterval += interval;
        count++;
      }
    }
    
    return count > 0 ? totalInterval / count : 5000;
  }, [lyrics?.lines]);

  // 播放位置变化事件发送（替代旧的直接写样式）
  useEffect(() => {
    if (!lyrics?.lines?.length) return;

    const idx = findIndexAtTime(currentPositionMs);
    if (idx < 0) return;
    
    const lastIdx = lastIdxRef.current;
    const lastTime = lastTimeRef.current;
    
    // 索引未变化则不发送事件
    if (lastIdx === idx) return;
    
    console.log(`🎵 [索引变化] ${lastIdx} → ${idx} (时间: ${currentPositionMs}ms)`);
    
    const dtMs = currentPositionMs - lastTime;
    const absIdxDelta = lastIdx !== null ? Math.abs(idx - lastIdx) : 0;
    
    // 🎯 智能seek检测：基于歌曲自身特征的动态阈值
    let isSeek = false;
    let dynamicTimeThreshold = SCROLL_CONFIG.SEEK_TIME_MIN_MS;
    
    if (lastIdx !== null) {
      const avgInterval = calculateAverageInterval();
      dynamicTimeThreshold = Math.max(
        Math.min(avgInterval * SCROLL_CONFIG.SEEK_TIME_MULTIPLIER, SCROLL_CONFIG.SEEK_TIME_MAX_MS),
        SCROLL_CONFIG.SEEK_TIME_MIN_MS
      );
      
      isSeek = (
        absIdxDelta >= SCROLL_CONFIG.SEEK_INDEX_SPAN ||
        Math.abs(dtMs) > dynamicTimeThreshold
      );
      
      // 详细诊断信息
      console.log(`🎯 [Seek判断] ${isSeek ? '⚡SEEK' : '🎵动画'}: dtMs=${dtMs}ms, 跨度=${absIdxDelta}行`);
      console.log(`📊 [动态阈值] 平均间隔=${Math.round(avgInterval)}ms, 动态阈值=${Math.round(dynamicTimeThreshold)}ms`);
    }
    
    // 发送相应事件
    if (isSeek) {
      dispatch({ type: 'Seek', idx, tMs: currentPositionMs, dtMs, absIdxDelta });
    } else {
      dispatch({ type: 'IndexChange', idx, tMs: currentPositionMs });
    }
  }, [currentPositionMs, lyrics?.lines?.length, findIndexAtTime, dispatch, calculateAverageInterval]);

  // 布局变化事件发送（字体变化时）
  useEffect(() => {
    if (currentLineIndex == null) return;
    console.log(`📤 发送LayoutChange事件: reason=font`);
    dispatch({ type: 'LayoutChange', reason: 'font' });
  }, [fontSizes, dispatch]); // 移除currentLineIndex依赖，避免每次行变化都触发

  // 窗口大小变化事件发送（集成到原有的resize监听中）

  // 歌词内容变化事件发送
  useEffect(() => {
    if (!lyrics?.lines?.length) return;
    console.log(`📤 发送LayoutChange事件: reason=lyrics`);
    dispatch({ type: 'LayoutChange', reason: 'lyrics' });
  }, [lyrics?.lines, dispatch]); // 移除currentLineIndex依赖，避免每次行变化都触发
  
  // DOM 渲染同步：确保行引用数组长度匹配
  useEffect(() => {
    if (lyrics?.lines) {
      // 确保 lineRefs 数组长度与歌词行数匹配
      lineRefs.current = lineRefs.current.slice(0, lyrics.lines.length);
    }
  }, [lyrics?.lines]);
  
  // 窗口大小变化时更新字体并发送LayoutChange事件
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        setFontSizes(getResponsiveFontSizes());
        // 发送窗口变化事件到orchestrator
        if (currentLineIndex != null) {
          dispatch({ type: 'LayoutChange', reason: 'window' });
        }
      }, 300);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [dispatch, currentLineIndex]);
  
  // 组件卸载时 rAF 在对应 effect 中已清理

  // 背景渐变动画 - 暂时禁用以调试重渲染问题
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     setBackgroundPhase(prev => (prev + 0.5) % 360);
  //   }, 150); // 每150ms更新0.5度，更加平缓
  //   
  //   return () => clearInterval(interval);
  // }, []);

  // 获取专辑封面图片
  useEffect(() => {
    const fetchAlbumCover = async () => {
      try {
        if (track?.id) {
          const coverData = await invoke<[number[], string] | null>('get_album_cover', { trackId: track.id });
          if (coverData && coverData[0] && coverData[1]) {
            const [bytes, mimeType] = coverData;
            // 将字节数组转换为 Blob
            const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
            const url = URL.createObjectURL(blob);
            setAlbumCoverUrl(url);
          } else {
            setAlbumCoverUrl(null);
          }
        } else {
          setAlbumCoverUrl(null);
        }
      } catch (e) {
        console.warn('专辑封面获取失败:', e);
        setAlbumCoverUrl(null);
      }
    };
    
    fetchAlbumCover();
  }, [track?.id]);

  // 组件卸载时清理封面URL
  useEffect(() => {
    return () => {
      if (albumCoverUrl) {
        URL.revokeObjectURL(albumCoverUrl);
      }
    };
  }, [albumCoverUrl]);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 鼠标移动检测
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      
      // 清除之前的定时器
      if (mouseTimerRef.current) {
        clearTimeout(mouseTimerRef.current);
      }
      
      // 设置新的定时器，3秒后隐藏控件
      mouseTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    const handleMouseLeave = () => {
      // 鼠标离开时立即隐藏控件，但给一个小延迟避免闪烁
      setTimeout(() => {
        setShowControls(false);
      }, 100);
      
      if (mouseTimerRef.current) {
        clearTimeout(mouseTimerRef.current);
        mouseTimerRef.current = null;
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
      if (mouseTimerRef.current) {
        clearTimeout(mouseTimerRef.current);
        mouseTimerRef.current = null;
      }
    };
  }, []); // 空依赖数组，防止重复绑定事件监听器

  // 皮肤面板状态监听 - 面板打开时保持控件显示
  useEffect(() => {
    if (showSkinPanel) {
      // 面板打开时显示控件并清除隐藏定时器
      setShowControls(true);
      if (mouseTimerRef.current) {
        clearTimeout(mouseTimerRef.current);
        mouseTimerRef.current = null;
      }
    }
  }, [showSkinPanel]);
  

  // 布局样式背景配置
  const getLayoutBackground = (layout: string, phase: number) => {
    switch (layout) {
      case 'classic':
        return {
          background: `
            linear-gradient(
              ${phase}deg,
              rgba(99, 102, 241, 0.15) 0%,
              rgba(168, 85, 247, 0.12) 25%,
              rgba(236, 72, 153, 0.10) 50%,
              rgba(251, 146, 60, 0.12) 75%,
              rgba(34, 197, 94, 0.15) 100%
            ),
            radial-gradient(
              circle at ${50 + Math.sin(phase * 0.008) * 15}% ${50 + Math.cos(phase * 0.01) * 15}%,
              rgba(139, 92, 246, 0.08) 0%,
              transparent 50%
            ),
            linear-gradient(180deg, rgba(15, 23, 42, 0.90) 0%, rgba(30, 41, 59, 0.85) 100%),
            #0f1629
          `
        };
      case 'split':
        return {
          background: `
            linear-gradient(
              90deg,
              rgba(6, 78, 59, 0.85) 0%,
              rgba(5, 46, 44, 0.90) 50%,
              rgba(6, 78, 59, 0.85) 100%
            ),
            radial-gradient(
              circle at ${25 + Math.sin(phase * 0.005) * 10}% ${50 + Math.cos(phase * 0.007) * 15}%,
              rgba(20, 184, 166, 0.12) 0%,
              transparent 60%
            ),
            radial-gradient(
              circle at ${75 + Math.cos(phase * 0.006) * 10}% ${50 + Math.sin(phase * 0.008) * 15}%,
              rgba(34, 197, 94, 0.10) 0%,
              transparent 55%
            ),
            #064e3b
          `
        };
      case 'fullscreen':
        return {
          background: `
            radial-gradient(
              ellipse at center,
              rgba(236, 72, 153, 0.15) 0%,
              rgba(147, 51, 234, 0.12) 35%,
              rgba(59, 130, 246, 0.08) 70%,
              transparent 100%
            ),
            linear-gradient(
              ${phase * 0.5}deg,
              rgba(251, 113, 133, 0.08) 0%,
              rgba(236, 72, 153, 0.12) 25%,
              rgba(147, 51, 234, 0.10) 50%,
              rgba(79, 70, 229, 0.08) 75%,
              rgba(59, 130, 246, 0.06) 100%
            ),
            radial-gradient(
              circle at ${30 + Math.sin(phase * 0.003) * 30}% ${40 + Math.cos(phase * 0.004) * 30}%,
              rgba(168, 85, 247, 0.15) 0%,
              transparent 70%
            ),
            linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(31, 41, 55, 0.90) 100%),
            #111827
          `
        };
      case 'card':
        return {
          background: `
            linear-gradient(
              135deg,
              rgba(245, 158, 11, 0.12) 0%,
              rgba(251, 146, 60, 0.15) 25%,
              rgba(249, 115, 22, 0.12) 50%,
              rgba(234, 88, 12, 0.10) 75%,
              rgba(194, 65, 12, 0.08) 100%
            ),
            repeating-linear-gradient(
              ${phase * 0.2}deg,
              transparent,
              transparent 40px,
              rgba(251, 191, 36, 0.03) 41px,
              rgba(251, 191, 36, 0.03) 42px
            ),
            radial-gradient(
              circle at ${60 + Math.sin(phase * 0.006) * 20}% ${40 + Math.cos(phase * 0.007) * 20}%,
              rgba(245, 158, 11, 0.10) 0%,
              transparent 65%
            ),
            linear-gradient(180deg, rgba(69, 26, 3, 0.88) 0%, rgba(92, 35, 4, 0.85) 100%),
            #451a03
          `
        };
      case 'minimal':
        return {
          background: `
            linear-gradient(
              180deg,
              rgba(30, 41, 59, 0.95) 0%,
              rgba(51, 65, 85, 0.92) 50%,
              rgba(30, 41, 59, 0.95) 100%
            ),
            radial-gradient(
              circle at 50% 50%,
              rgba(148, 163, 184, 0.05) 0%,
              transparent 70%
            ),
            #1e293b
          `
        };
      default:
        return getLayoutBackground('classic', phase);
    }
  };

  // 动态背景样式 - 支持布局切换
  const backgroundStyle = {
    ...getLayoutBackground(currentSkin, backgroundPhase),
    backdropFilter: 'blur(20px)',
    transition: 'background 0.8s ease-out'
  };



  if (isLoading) {
    return (
      <div 
        ref={containerRef}
        className={`
          fixed inset-0 z-[9999] flex items-center justify-center
          transition-all duration-700
          ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
        `}
        style={{
          ...backgroundStyle,
          transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
      >
        <div className="text-center space-y-6">
          {/* 加载动画 */}
          <div className="relative">
            <div className="w-20 h-20 mx-auto">
              <div className="absolute inset-0 border-4 border-white/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-white/60 rounded-full animate-spin"></div>
              <div className="absolute inset-2 border-2 border-transparent border-t-white/40 rounded-full animate-spin animation-delay-150"></div>
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-white/90 text-xl font-medium">加载歌词中...</p>
            <p className="text-white/60 text-sm">{track?.title || '未知歌曲'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !lyrics) {
    return (
      <div 
        ref={containerRef}
        className={`
          fixed inset-0 z-[9999] flex items-center justify-center
          transition-all duration-700
          ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
        `}
        style={{
          ...backgroundStyle,
          transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
      >
        <div className="text-center space-y-6 max-w-md mx-auto px-6">
          {/* 错误图标 */}
          <div className="w-20 h-20 mx-auto bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
            <svg className="w-10 h-10 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          
          <div className="space-y-3">
            <p className="text-white/90 text-xl font-medium">未找到歌词</p>
            <p className="text-white/60 text-sm">{track?.title || '未知歌曲'}</p>
          </div>
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => track?.id && loadLyrics(track.id, track.path)}
              className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-sm transition-all duration-300 hover:scale-110"
              style={{ transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
            >
              重试
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-all duration-300 hover:scale-110"
              style={{ transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!lyrics || !lyrics.lines.length) {
    return (
      <div 
        ref={containerRef}
        className={`
          fixed inset-0 z-[9999] flex items-center justify-center
          transition-all duration-700
          ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
        `}
        style={{
          ...backgroundStyle,
          transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
      >
        <div className="text-center space-y-6">
          <div className="w-20 h-20 mx-auto bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
            <svg className="w-10 h-10 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          
          <div className="space-y-3">
            <p className="text-white/90 text-xl font-medium">纯音乐时光</p>
            <p className="text-white/60 text-sm">尽情享受美妙的旋律</p>
          </div>
          
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-sm transition-all duration-300 hover:scale-110"
            style={{ transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  // 计算过渡动画样式
  const getTransitionStyles = () => {
    if (!transitionOrigin || !isTransitioning) {
      return {
        ...backgroundStyle,
        transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      };
    }
    
    // 计算从小封面到沉浸式界面的变换
    const { x, y, width, height } = transitionOrigin;
    const targetX = window.innerWidth * 0.2; // 沉浸式界面左侧封面的大致位置
    const targetY = window.innerHeight * 0.3;
    const targetWidth = 256; // 沉浸式界面封面大小
    const targetHeight = 256;
    
    const scaleX = width / targetWidth;
    const scaleY = height / targetHeight;
    const translateX = x - targetX;
    const translateY = y - targetY;
    
    return {
      ...backgroundStyle,
      transformOrigin: `${targetX}px ${targetY}px`,
      transform: animationPhase === 'entering' 
        ? `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})` 
        : 'translate(0, 0) scale(1, 1)',
      transition: animationPhase === 'entering' 
        ? 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease-out'
        : 'all 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      transitionDelay: animationPhase === 'entering' ? '0s' : '0s'
    };
  };

  return (
    <div 
      ref={containerRef}
      className={`
        fixed inset-0 z-[9999] overflow-hidden
        ${isVisible ? 'opacity-100' : 'opacity-0'}
        ${transitionOrigin ? '' : 'transition-all duration-700'}
      `}
      style={getTransitionStyles() as React.CSSProperties}
    >
      {/* 专辑封面模糊背景层 */}
      {albumCoverUrl && (
        <div 
          className="absolute -inset-8 -z-10"
          style={{
            backgroundImage: `url(${albumCoverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'blur(60px) brightness(0.6)',
            transition: 'all 0.6s ease-out'
          }}
        />
      )}
      
      {/* 额外的暗化遮罩层 */}
      {albumCoverUrl && (
        <div 
          className="absolute inset-0 -z-5 bg-black/40"
          style={{ transition: 'opacity 0.6s ease-out' }}
        />
      )}
      
         {/* 主内容区域 - 左右分栏布局 */}
         <div className="relative h-full flex">
           {/* 左侧：封面和信息区域 */}
           <div className="w-2/5 min-w-[320px] flex flex-col items-center justify-center p-8 relative h-full">
             <div 
               className="w-full max-w-sm space-y-8"
               style={{
                 transform: 'translateY(-2vh)',
                 transition: 'transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
               }}
             >
               {/* 上半部分：专辑封面和歌曲信息 */}
               <div className="flex flex-col items-center space-y-6">
                 <div 
                   className="album-cover-target"
                   style={{
                     // 在过渡动画期间应用特殊效果
                     transform: animationPhase === 'entering' && transitionOrigin 
                       ? 'scale(0.8) translateY(10px)' 
                       : 'scale(1) translateY(0)',
                     opacity: animationPhase === 'entering' ? 0.3 : 1,
                     transition: animationPhase === 'entering' 
                       ? 'transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s, opacity 0.6s ease-out 0.3s'
                       : 'transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease-out'
                   }}
                 >
                   {albumCoverUrl ? (
                     <div 
                       className="w-64 h-64 rounded-2xl shadow-2xl bg-white/10 backdrop-blur-sm transition-all duration-500"
                       style={{
                         backgroundImage: `url(${albumCoverUrl})`,
                         backgroundSize: 'cover',
                         backgroundPosition: 'center',
                         transform: animationPhase === 'entering' ? 'rotateY(15deg)' : 'rotateY(0deg)'
                       }}
                     />
                   ) : (
                     <div className="w-64 h-64 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center transition-all duration-500">
                       <svg className="w-20 h-20 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                       </svg>
                     </div>
                   )}
                 </div>
                 <div className="text-center space-y-3 w-full max-w-sm">
                   <h1 className="text-white text-2xl font-bold truncate px-2" title={track?.title || '未知歌曲'}>{track?.title || '未知歌曲'}</h1>
                   <p className="text-white/80 text-lg truncate px-2" title={track?.artist || '未知艺术家'}>{track?.artist || '未知艺术家'}</p>
                   {track?.album && <p className="text-white/60 text-base truncate px-2" title={track.album}>{track.album}</p>}
                 </div>
               </div>
               
               {/* 下半部分：音乐控制条 */}
               <div className="w-full space-y-4">
                 <div className="space-y-2">
                   <div className="flex justify-between text-xs text-white/60">
                     <span>{formatTime(currentPositionMs)}</span>
                     <span>{formatTime(track?.duration_ms || 0)}</span>
                   </div>
                   <div 
                     className="relative h-1 bg-white/20 rounded-full backdrop-blur-sm cursor-pointer group"
                     onClick={(e) => handleProgressClick(e)}
                   >
                     <div 
                       className="absolute top-0 left-0 h-full bg-gradient-to-r from-white/60 to-white/80 rounded-full transition-all duration-300"
                       style={{ 
                         width: `${track?.duration_ms ? (currentPositionMs / track.duration_ms) * 100 : 0}%` 
                       }}
                     />
                   </div>
                 </div>
                 
                 <div className="flex items-center justify-center space-x-4">
                   <button
                     onClick={handlePrevious}
                     className="liquid-glass-btn w-12 h-12 rounded-full flex items-center justify-center group"
                   >
                     <svg className="w-5 h-5 text-white/80 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                       <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                     </svg>
                   </button>
                   
                   <button
                     onClick={handlePlayPause}
                     className="liquid-glass-btn w-16 h-16 rounded-full flex items-center justify-center group"
                   >
                     {isPlaying ? (
                       <svg className="w-6 h-6 text-white group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                         <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                       </svg>
                     ) : (
                       <svg className="w-6 h-6 text-white group-hover:text-white transition-colors ml-1" fill="currentColor" viewBox="0 0 24 24">
                         <path d="M8 5v14l11-7z"/>
                       </svg>
                     )}
                   </button>
                   
                   <button
                     onClick={handleNext}
                     className="liquid-glass-btn w-12 h-12 rounded-full flex items-center justify-center group"
                   >
                     <svg className="w-5 h-5 text-white/80 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                       <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                     </svg>
                   </button>
                 </div>
               </div>
             </div>
           </div>
           
            {/* 右侧：歌词区域 */}
            <div className="flex-1 relative">
              
              <div 
                ref={lyricsRef}
                className="absolute inset-0 overflow-hidden px-8 py-16"
                style={{ 
                  overscrollBehavior: 'none',
                  willChange: 'transform',
                  transform: 'translateZ(0)'
                }}
              >
               <div className="min-h-full flex flex-col justify-center will-change-transform" ref={movingWrapRef} style={{ transform: 'translate3d(0,0,0)', contain: 'layout paint', backfaceVisibility: 'hidden' }}>
                {/* 歌词容器 - 行容器高度稳定化（按照手册第14章要求） */}
                <div 
                  className="py-16 relative" 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    // 固定间距，不随当前行变化
                    gap: `${fontSizes.spacingInfo?.lineSpacing || Math.max(fontSizes.normal * 0.6, 16)}px`,
                    paddingTop: '30vh',
                    paddingBottom: '30vh'
                  }}
                >
                    {lyrics?.lines.map((line, index) => {
                      // 基于碰撞检测的发光效果，而非索引
                      const isCurrent = index === currentLineIndex;
                      const wasPrevious = index === previousLineIndex;
                      const isNear = currentLineIndex !== null && Math.abs(index - currentLineIndex) <= 2;
                      const distance = currentLineIndex !== null ? Math.abs(index - currentLineIndex) : 10;
                      
                      // 移除垂直偏移效果，让歌词保持在原始位置流动
                     
                     // 计算scale因子（按照手册第14章：文本层统一font-size，通过scale呈现差异）
                     const baseScale = isCurrent 
                       ? fontSizes.current / fontSizes.normal
                       : wasPrevious 
                         ? fontSizes.near / fontSizes.normal 
                         : 1;
                     
                     return (
                       <div
                         key={index}
                         ref={(el) => {
                           lineRefs.current[index] = el;
                         }}
                         className="cursor-pointer relative px-4"
                         style={{
                           // 固定高度，不随当前行状态变化（防止布局漂移）
                           height: `${fontSizes.spacingInfo?.lineHeight || fontSizes.normal * 1.6}px`,
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           opacity: isCurrent ? 1 : wasPrevious ? 0.4 : isNear ? 0.85 : distance <= 5 ? Math.max(0.15, 0.7 - distance * 0.1) : 0.1,
                           filter: isCurrent ? 'none' : wasPrevious ? `blur(0.2px) brightness(0.85)` : `blur(${Math.min(distance * 0.15, 0.4)}px) brightness(0.92)`,
                           // 容器层不做scale变化，保持布局稳定
                           transition: isCurrent || wasPrevious 
                             ? `opacity 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)`
                             : `opacity 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
                         }}
                         onClick={async () => {
                           if (track?.id) {
                             try {
                               console.log('🎵 [用户点击] 用户点击第', index, '行，时间戳:', line.timestamp_ms);
                               
                               // 跳转到指定时间点
                               await invoke('player_seek', { positionMs: line.timestamp_ms });
                               if (isPlaying) {
                                 await invoke('player_resume');
                               }
                               
                               // 连续滚动会在下一次useEffect中自动恢复
                             } catch (error) {
                               console.error('Lyrics seek failed:', error);
                             }
                           }
                         }}
                       >
                         <p 
                           className={`
                             relative z-10 leading-relaxed
                             ${isCurrent ? 'lyrics-current-glow lyrics-fade-in' : ''}
                             ${wasPrevious && !isCurrent ? 'lyrics-fade-out' : ''}
                           `}
                           style={{
                             // 统一font-size（按照手册第14章要求）
                             fontSize: `${fontSizes.normal}px`,
                             color: isCurrent 
                               ? 'rgba(255, 255, 255, 1)' 
                               : wasPrevious 
                                 ? 'rgba(255, 255, 255, 0.5)' // 前一行渐渐变暗
                                 : isNear 
                                   ? 'rgba(255, 255, 255, 0.85)' 
                                   : `rgba(255, 255, 255, ${Math.max(0.1, 0.6 - distance * 0.08)})`,
                             textShadow: isCurrent 
                               ? `0 0 15px rgba(255, 255, 255, 0.6), 0 0 25px rgba(255, 255, 255, 0.4), 0 2px 10px rgba(255, 255, 255, 0.3)` 
                               : wasPrevious 
                                 ? '0 0 5px rgba(255, 255, 255, 0.2), 0 1px 3px rgba(255, 255, 255, 0.1)' // 前一行保持轻微发光
                                 : '0 1px 3px rgba(255, 255, 255, 0.1)',
                             fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                             fontWeight: isCurrent ? 600 : wasPrevious ? 500 : 400,
                             letterSpacing: isCurrent ? '0.015em' : wasPrevious ? '0.010em' : '0.005em',
                             lineHeight: '1.6',
                             // 通过scale实现视觉差异，不影响布局高度
                             transform: `scale(${Math.round(baseScale * 100) / 100})`, // 轻微量化避免亚像素抖动
                             transformOrigin: 'center',
                             transition: isCurrent || wasPrevious 
                               ? 'transform 1.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), color 1.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), text-shadow 1.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), font-weight 1.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), letter-spacing 1.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' 
                               : 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), color 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), text-shadow 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), font-weight 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), letter-spacing 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                             filter: isCurrent 
                               ? 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.25))' 
                               : wasPrevious 
                                 ? 'drop-shadow(0 0 4px rgba(255, 255, 255, 0.1))' // 前一行保持轻微阴影
                                 : 'none',
                           }}
                         >
                           {line.text || '♪'}
                         </p>
                       </div>
                     );
                   })}
                 </div>
               </div>
             </div>
           </div>
         </div>
        
        {/* 关闭按钮 - 鼠标移动时显示 */}
        <button
          onClick={onClose}
          className={`absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 group z-50 ${
            showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
          }`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
        >
          <svg className="w-6 h-6 text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 布局样式切换控件 - 圆形入口扩展为大面板 */}
        <div 
          className={`absolute top-6 transition-all duration-500 z-50 ${
            showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
          } ${
            showSkinPanel ? 'right-6' : 'right-20'
          }`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
        >
          <div
            className={`relative transition-all duration-500 ease-out cursor-pointer ${
              showSkinPanel 
                ? 'w-[min(480px,calc(100vw-3rem))] h-[min(288px,calc(100vh-6rem))]' 
                : 'w-12 h-12 hover:scale-110'
            }`}
            onClick={() => !showSkinPanel && setShowSkinPanel(true)}
            style={{
              borderRadius: showSkinPanel ? '24px' : '50%',
              background: showSkinPanel
                ? 'linear-gradient(135deg, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.65) 100%)'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.08) 100%)',
              backdropFilter: showSkinPanel ? 'blur(25px) saturate(200%)' : 'blur(20px) saturate(180%)',
              border: showSkinPanel ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: showSkinPanel
                ? '0 12px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                : '0 4px 16px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              transitionProperty: 'all, border-radius',
              transitionTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            }}
          >
            {!showSkinPanel ? (
              // 圆形状态：布局切换图标
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
            ) : (
              // 展开状态：布局样式选择面板
              <div className="w-full h-full p-3 sm:p-4 flex flex-col">
                {/* 顶部标题栏 */}
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h3 className="text-white/90 text-sm sm:text-base font-semibold">选择布局样式</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSkinPanel(false);
                    }}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200 hover:scale-110"
                  >
                    <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* 布局样式网格 - 响应式列数 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 flex-1 overflow-y-auto">
                  {[
                    {
                      key: 'classic',
                      name: '经典居中',
                      description: '歌词居中显示，专辑封面与播放控制在左侧',
                      preview: (
                        <div className="w-full h-12 sm:h-14 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg flex items-center justify-between p-2 relative overflow-hidden">
                          <div className="flex flex-col items-center space-y-1">
                            <div className="w-10 h-10 bg-white/25 rounded-lg"></div>
                            <div className="w-6 h-1 bg-white/40 rounded"></div>
                          </div>
                          <div className="flex-1 flex flex-col items-center space-y-1 px-3">
                            <div className="w-16 h-1.5 bg-white/70 rounded"></div>
                            <div className="w-12 h-1 bg-white/50 rounded"></div>
                            <div className="w-14 h-1 bg-white/30 rounded"></div>
                          </div>
                        </div>
                      )
                    },
                    {
                      key: 'split',
                      name: '左右分屏',
                      description: '大封面左侧显示，歌词在右侧平铺展示',
                      preview: (
                        <div className="w-full h-12 sm:h-14 bg-gradient-to-br from-green-500/20 to-teal-500/20 rounded-lg flex overflow-hidden">
                          <div className="w-2/5 bg-white/15 flex flex-col items-center justify-center space-y-1 p-2">
                            <div className="w-8 h-8 bg-white/35 rounded-lg"></div>
                            <div className="w-6 h-0.5 bg-white/50 rounded"></div>
                          </div>
                          <div className="flex-1 flex flex-col justify-center px-3 space-y-1">
                            <div className="w-full h-1.5 bg-white/70 rounded"></div>
                            <div className="w-4/5 h-1 bg-white/50 rounded"></div>
                            <div className="w-3/4 h-1 bg-white/30 rounded"></div>
                          </div>
                        </div>
                      )
                    },
                    {
                      key: 'fullscreen',
                      name: '全屏沉浸',
                      description: '歌词全屏显示，底部浮动信息条',
                      preview: (
                        <div className="w-full h-12 sm:h-14 bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded-lg flex items-center justify-center relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent"></div>
                          <div className="text-center z-10 space-y-1">
                            <div className="w-24 h-2 bg-white/80 mx-auto rounded"></div>
                            <div className="w-20 h-1.5 bg-white/60 mx-auto rounded"></div>
                          </div>
                          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex items-center space-x-1 bg-black/30 rounded-full px-2 py-0.5">
                            <div className="w-2 h-2 bg-white/50 rounded-full"></div>
                            <div className="w-8 h-0.5 bg-white/40 rounded"></div>
                          </div>
                        </div>
                      )
                    },
                    {
                      key: 'card',
                      name: '卡片模式',
                      description: '每行歌词以卡片形式展示，提升可读性',
                      preview: (
                        <div className="w-full h-12 sm:h-14 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-lg p-2 space-y-1">
                          <div className="w-full h-3 bg-white/20 rounded border border-white/10"></div>
                          <div className="w-full h-3 bg-white/30 rounded border border-white/15"></div>
                          <div className="w-3/4 h-3 bg-white/20 rounded border border-white/10"></div>
                        </div>
                      )
                    },
                    {
                      key: 'minimal',
                      name: '极简模式',
                      description: '纯文字居中，去除所有装饰元素',
                      preview: (
                        <div className="w-full h-12 sm:h-14 bg-gradient-to-br from-slate-500/15 to-gray-500/15 rounded-lg flex items-center justify-center">
                          <div className="text-center space-y-2">
                            <div className="w-18 h-0.5 bg-white/90 mx-auto rounded"></div>
                            <div className="w-14 h-0.5 bg-white/60 mx-auto rounded"></div>
                            <div className="w-16 h-0.5 bg-white/40 mx-auto rounded"></div>
                          </div>
                        </div>
                      )
                    },
                    {
                      key: 'cinematic',
                      name: '电影模式',
                      description: '宽屏比例显示，营造观影氛围',
                      preview: (
                        <div className="w-full h-12 sm:h-14 bg-gradient-to-br from-indigo-600/20 to-purple-700/20 rounded-lg relative overflow-hidden">
                          <div className="absolute top-0 left-0 right-0 h-2 bg-black/40"></div>
                          <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/40"></div>
                          <div className="h-full flex items-center justify-center">
                            <div className="text-center space-y-1">
                              <div className="w-20 h-1.5 bg-white/80 mx-auto rounded"></div>
                              <div className="w-16 h-1 bg-white/60 mx-auto rounded"></div>
                            </div>
                          </div>
                        </div>
                      )
                    }
                  ].map((layout) => (
                    <button
                      key={layout.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentSkin(layout.key as any);
                        setShowSkinPanel(false);
                      }}
                      className={`group relative p-2 sm:p-3 rounded-lg transition-all duration-300 hover:scale-[1.02] ${
                        currentSkin === layout.key 
                          ? 'bg-white/15 ring-2 ring-white/30 shadow-lg' 
                          : 'bg-white/8 hover:bg-white/12'
                      }`}
                      style={{ transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
                    >
                      {/* 预览区域 */}
                      <div className="mb-1 sm:mb-2">
                        {layout.preview}
                      </div>
                      
                      {/* 标题和描述 */}
                      <div className="text-left">
                        <h4 className="text-white/95 text-xs sm:text-sm font-semibold mb-0.5 sm:mb-1">{layout.name}</h4>
                        <p className="text-white/70 text-xs leading-relaxed hidden sm:block">{layout.description}</p>
                      </div>

                      {/* 选中指示器 */}
                      {currentSkin === layout.key && (
                        <div className="absolute top-2 right-2 w-3 h-3 bg-white/90 rounded-full flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
