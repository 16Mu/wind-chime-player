import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

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
}

export default function ImmersiveLyricsView({
  track,
  currentPositionMs,
  isPlaying,
  onClose,
  onError: _onError // 接收但不使用，避免警告
}: ImmersiveLyricsViewProps) {
  const [lyrics, setLyrics] = useState<ParsedLyrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);
  const [previousLineIndex, setPreviousLineIndex] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [fontSizes, setFontSizes] = useState(getResponsiveFontSizes());
  
  const containerRef = useRef<HTMLDivElement>(null);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // 背景渐变状态管理
  const [backgroundPhase, setBackgroundPhase] = useState(0);
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
  
  // 获取当前应该显示的歌词行
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

  // 平滑滚动 - 完整的错误捕获和调试
  const scrollToCurrentLine = useCallback((index: number) => {
    console.log(`🎵 [开始] scrollToCurrentLine 调用，index: ${index}`);
    
    try {
      // 检查基本条件
      if (!lyricsRef.current) {
        console.error('❌ lyricsRef.current 不存在');
        return;
      }
      
      if (!lineRefs.current[index]) {
        console.error(`❌ lineRefs.current[${index}] 不存在`);
        return;
      }
      
      const container = lyricsRef.current;
      const currentLine = lineRefs.current[index];
      
      console.log('✅ 基本元素检查通过:', {
        container: !!container,
        currentLine: !!currentLine,
        containerScrollBehavior: getComputedStyle(container).scrollBehavior
      });
      
      // 等待DOM更新后执行滚动
      setTimeout(() => {
        try {
          const containerHeight = container.clientHeight;
          const lineHeight = currentLine.offsetHeight;
          const lineTop = currentLine.offsetTop;
          const currentScrollTop = container.scrollTop;
          
          // 让当前行显示在屏幕正中央
          const targetScroll = lineTop - (containerHeight / 2) + (lineHeight / 2);
          const finalScroll = Math.max(0, targetScroll);
          const distance = Math.abs(finalScroll - currentScrollTop);
          
          // 详细调试信息
          console.log(`🎵 [计算] 第${index}行滚动参数:`, {
            容器高度: containerHeight,
            行高: lineHeight,
            行顶部位置: lineTop,
            当前滚动位置: currentScrollTop,
            计算目标位置: targetScroll,
            最终目标位置: finalScroll,
            滚动距离: distance,
            是否需要滚动: distance > 3
          });
          
          // 检查是否需要滚动
          if (distance < 3) {
            console.log('⏭️ 距离太小，跳过滚动');
            return;
          }
          
          // 记录滚动前状态
          const beforeScroll = {
            scrollTop: container.scrollTop,
            scrollBehavior: getComputedStyle(container).scrollBehavior,
            overflowY: getComputedStyle(container).overflowY
          };
          
          console.log('🚀 [执行] 开始滚动:', beforeScroll);
          
          // 尝试多种滚动方法
          const scrollMethods = [
            () => {
              console.log('🔄 方法1: scrollTo with behavior smooth');
              container.scrollTo({
                top: finalScroll,
                behavior: 'smooth'
              });
            },
            () => {
              console.log('🔄 方法2: scrollTop 直接设置');
              container.scrollTop = finalScroll;
            },
            () => {
              console.log('🔄 方法3: scrollIntoView');
              currentLine.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
              });
            }
          ];
          
          // 使用自定义动画增强视觉效果
          console.log('🎬 使用自定义平滑滚动动画');
          
          const startTime = performance.now();
          const startScroll = currentScrollTop;
          const scrollDistance = finalScroll - startScroll;
          const duration = Math.max(600, Math.min(1200, Math.abs(scrollDistance) * 3)); // 增加动画时长
          
          console.log('🎬 动画参数:', { duration, scrollDistance });
          
          const animateScroll = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 使用更明显的缓动函数
            const easeOutQuart = (t: number): number => {
              return 1 - Math.pow(1 - t, 4);
            };
            
            const easedProgress = easeOutQuart(progress);
            const currentPosition = startScroll + (scrollDistance * easedProgress);
            
            container.scrollTop = currentPosition;
            
            if (progress < 1) {
              requestAnimationFrame(animateScroll);
            } else {
              console.log('🎬 动画完成:', {
                最终位置: container.scrollTop,
                预期位置: finalScroll,
                动画时长: elapsed.toFixed(0) + 'ms'
              });
            }
          };
          
          requestAnimationFrame(animateScroll);
          
        } catch (innerError) {
          console.error('❌ [内部错误] setTimeout内部执行失败:', innerError);
        }
      }, 50);
      
    } catch (error) {
      console.error('❌ [外部错误] scrollToCurrentLine执行失败:', error);
      console.error('错误堆栈:', error.stack);
    }
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

  // 组件进入动画
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // 智能响应式字体大小更新 - 实时监听窗口变化
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    
    const handleResize = () => {
      // 防抖处理，避免频繁计算
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const newSizes = getResponsiveFontSizes();
        setFontSizes(newSizes);
        
        // 可选：在开发模式下输出调试信息
        if (process.env.NODE_ENV === 'development') {
          console.log('🎵 [响应式] 字体大小更新:', {
            screen: newSizes.screenInfo,
            fonts: {
              normal: newSizes.normal,
              near: newSizes.near,
              current: newSizes.current
            },
            layout: newSizes.spacingInfo,
            maxLines: newSizes.maxLines
          });
        }
      }, 150); // 150ms防抖
    };
    
    // 立即计算初始字体大小
    handleResize();
    
    // 监听多种窗口变化事件
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // 当曲目改变时加载歌词
  useEffect(() => {
    if (track?.id) {
      loadLyrics(track.id, track.path);
    } else {
      setLyrics(null);
      setError(null);
      setCurrentLineIndex(null);
    }
  }, [track?.id, track?.path]); // 移除loadLyrics依赖，避免无限循环

  // 更新当前行索引
  useEffect(() => {
    if (lyrics?.lines && lyrics.lines.length > 0) {
      const newIndex = getCurrentLineIndex(lyrics.lines, currentPositionMs);
      
      if (newIndex !== currentLineIndex) {
        console.log('🎵 [沉浸式] 歌词行切换:', {
          from: currentLineIndex,
          to: newIndex,
          timestamp: currentPositionMs,
          lyric: newIndex !== null ? lyrics.lines[newIndex]?.text : 'null'
        });
        
        // 保存上一行索引，用于淡出效果
        setPreviousLineIndex(currentLineIndex);
        setCurrentLineIndex(newIndex);
        
        // 延迟清理previousLineIndex，确保淡出动画完成
        setTimeout(() => {
          setPreviousLineIndex(null);
        }, 1000); // 与CSS动画时长保持一致
        
        // 精确的自动滚动：立即滚动到新行，确保同步
        if (newIndex !== null) {
          // 使用 requestAnimationFrame 确保DOM更新后再滚动
          requestAnimationFrame(() => {
            scrollToCurrentLine(newIndex);
          });
        }
      }
    } else if (currentLineIndex !== null) {
      setCurrentLineIndex(null);
    }
  }, [lyrics?.lines, currentPositionMs, currentLineIndex, getCurrentLineIndex, scrollToCurrentLine]);

  // 背景渐变动画 - 更平缓的变化
  useEffect(() => {
    const interval = setInterval(() => {
      setBackgroundPhase(prev => (prev + 0.5) % 360);
    }, 150); // 每150ms更新0.5度，更加平缓
    
    return () => clearInterval(interval);
  }, []);

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

  // 动态背景样式 - 修复版（不对容器应用模糊）
  const backgroundStyle = {
    // 始终使用默认渐变背景
    background: `
      linear-gradient(
        ${backgroundPhase}deg,
        rgba(99, 102, 241, 0.15) 0%,
        rgba(168, 85, 247, 0.12) 25%,
        rgba(236, 72, 153, 0.10) 50%,
        rgba(251, 146, 60, 0.12) 75%,
        rgba(34, 197, 94, 0.15) 100%
      ),
      radial-gradient(
        circle at ${50 + Math.sin(backgroundPhase * 0.008) * 15}% ${50 + Math.cos(backgroundPhase * 0.01) * 15}%,
        rgba(139, 92, 246, 0.08) 0%,
        transparent 50%
      ),
      radial-gradient(
        circle at ${30 + Math.cos(backgroundPhase * 0.008) * 15}% ${70 + Math.sin(backgroundPhase * 0.012) * 20}%,
        rgba(59, 130, 246, 0.06) 0%,
        transparent 45%
      ),
      linear-gradient(180deg, rgba(15, 23, 42, 0.90) 0%, rgba(30, 41, 59, 0.85) 100%),
      #0f1629
    `,
    backdropFilter: 'blur(20px)',
    transition: 'background 0.4s ease-out'
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

  return (
    <div 
      ref={containerRef}
      className={`
        fixed inset-0 z-[9999] overflow-hidden
        transition-all duration-700
        ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
      `}
      style={{
        ...backgroundStyle,
        transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      }}
    >
      {/* 专辑封面模糊背景层 */}
      {albumCoverUrl && (
        <div 
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: `url(${albumCoverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'blur(60px) brightness(0.6)',
            transform: 'scale(1.1)', // 稍微放大避免边缘模糊缺失
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
        
        {/* 关闭按钮 - 移动到整个界面右上角 */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 group z-50"
          style={{ transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
        >
          <svg className="w-6 h-6 text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 左侧：封面和信息区域 */}
        <div className="w-2/5 min-w-[320px] flex flex-col items-center justify-center p-8 relative h-full">
          <div 
            className="w-full max-w-sm space-y-8"
            style={{
              transform: 'translateY(-2vh)', // 轻微向上偏移，让整体组合的几何中心位于屏幕垂直中心
              transition: 'transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
          >
          
          {/* 上半部分：专辑封面和歌曲信息 */}
          <div className="flex flex-col items-center space-y-6">
            {/* 专辑封面 */}
            <div>
              {albumCoverUrl ? (
                <div 
                  className="w-64 h-64 rounded-2xl shadow-2xl bg-white/10 backdrop-blur-sm"
                  style={{
                    backgroundImage: `url(${albumCoverUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }}
                />
              ) : (
                <div className="w-64 h-64 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <svg className="w-20 h-20 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
              )}
            </div>

            {/* 歌曲信息 */}
            <div className="text-center space-y-3 max-w-xs">
              <h1 className="text-white text-2xl font-bold leading-tight">
                {track?.title || '未知歌曲'}
              </h1>
              <p className="text-white/80 text-lg">
                {track?.artist || '未知艺术家'}
              </p>
              {track?.album && (
                <p className="text-white/60 text-base">
                  {track.album}
                </p>
              )}
            </div>
          </div>

          {/* 下半部分：音乐控制条 */}
          <div className="w-full space-y-4">
            {/* 进度条 */}
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
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ 
                    left: `${track?.duration_ms ? (currentPositionMs / track.duration_ms) * 100 : 0}%`,
                    transform: 'translateX(-50%) translateY(-50%)'
                  }}
                />
              </div>
            </div>

            {/* 控制按钮 */}
            <div className="flex items-center justify-center space-x-4">
              {/* 上一首 */}
              <button
                onClick={handlePrevious}
                className="liquid-glass-btn w-12 h-12 rounded-full flex items-center justify-center group"
              >
                <svg className="w-5 h-5 text-white/80 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                </svg>
              </button>

              {/* 播放/暂停 */}
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

              {/* 下一首 */}
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
          {/* 歌词内容滚动区域 */}
           <div 
             ref={lyricsRef}
             className="absolute inset-0 overflow-y-auto overflow-x-hidden px-8 py-16"
             style={{ 
               scrollbarWidth: 'none',
               msOverflowStyle: 'none',
               scrollBehavior: 'smooth', // 启用浏览器原生平滑滚动
               // 增强滚动流畅性
               WebkitOverflowScrolling: 'touch',
               overscrollBehavior: 'contain'
             }}
          >
            <div className="min-h-full flex flex-col justify-center">
               {/* 歌词行 - 增加顶部和底部空间确保所有行都能居中 */}
               <div 
                 className="py-16" 
                 style={{ 
                   display: 'flex', 
                   flexDirection: 'column', 
                   gap: `${fontSizes.spacingInfo?.lineSpacing || Math.max(fontSizes.current * 0.6, 16)}px`,
                   paddingTop: '50vh', // 顶部添加足够空间
                   paddingBottom: '50vh' // 底部添加足够空间
                 }}
               >
                 {lyrics.lines.map((line, index) => {
                   const isCurrent = index === currentLineIndex;
                   const wasPrevious = index === previousLineIndex;
                   const isNear = currentLineIndex !== null && Math.abs(index - currentLineIndex) <= 2;
                   const distance = currentLineIndex !== null ? Math.abs(index - currentLineIndex) : 10;
                   
                   // 限制显示行数 - 只显示当前行周围的歌词
                   const maxDisplayDistance = 4; // 显示当前行前后4行，总共最多9行
                   if (currentLineIndex !== null && distance > maxDisplayDistance) {
                     return null; // 不渲染距离太远的行
                   }
                   
                   // 计算动画延迟和位移效果 - 波浪式过渡
                   const animationDelay = Math.abs(index - (currentLineIndex || 0)) * 40;
                   const translateY = isCurrent ? 0 : distance <= 1 ? 2 : distance <= 2 ? 4 : distance <= 3 ? 6 : 8;
                  
                  return (
                    <div
                      key={index}
                      ref={(el) => {
                        lineRefs.current[index] = el;
                      }}
                      className="cursor-pointer relative px-4 py-2"
                      style={{
                        opacity: isCurrent ? 1 : isNear ? 0.8 : distance <= 3 ? 0.5 : 0.3,
                        // 修复背景模糊问题：只对非当前行应用适度的模糊效果
                        filter: isCurrent ? 'none' : `blur(${Math.min(distance * 0.3, 0.8)}px) brightness(0.85)`,
                         transform: `translateY(${translateY}px) scale(${isCurrent ? 1.01 : 1})`,
                         transition: `all 1.8s cubic-bezier(0.34, 1.56, 0.64, 1)`,
                         transitionDelay: `${animationDelay * 0.8}ms`,
                      }}
                      onClick={async () => {
                        if (track?.id) {
                          try {
                            await invoke('player_seek', { positionMs: line.timestamp_ms });
                            // 如果原本在播放，确保seek后继续播放
                            if (isPlaying) {
                              await invoke('player_resume');
                            }
                          } catch (error) {
                            console.error('Lyrics seek failed:', error);
                          }
                        }
                      }}
                    >
                      {/* 歌词文本 */}
                      <p 
                        className={`
                          relative z-10 leading-relaxed
                          ${isCurrent ? 'lyrics-current-glow lyrics-fade-in' : ''}
                          ${wasPrevious && !isCurrent ? 'lyrics-fade-out' : ''}
                        `}
                         style={{
                           fontSize: `${isCurrent ? fontSizes.current : fontSizes.normal}px`,
                          color: isCurrent 
                            ? 'rgba(255, 255, 255, 1)' 
                            : isNear 
                              ? 'rgba(255, 255, 255, 0.85)' 
                              : `rgba(255, 255, 255, ${Math.max(0.3, 0.9 - distance * 0.15)})`,
                           // 为当前播放行添加强烈的光晕效果
                           textShadow: isCurrent 
                             ? `
                               0 0 20px rgba(255, 255, 255, 0.8),
                               0 0 30px rgba(255, 255, 255, 0.6),
                               0 0 40px rgba(255, 255, 255, 0.4),
                               0 2px 15px rgba(255, 255, 255, 0.3)
                             ` 
                             : '0 1px 3px rgba(255, 255, 255, 0.1)',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                          fontWeight: isCurrent ? 700 : 400,
                          letterSpacing: isCurrent ? '0.025em' : '0.005em',
                          lineHeight: '1.6',
                           transform: `scale(${isCurrent ? 1.02 : 1})`,
                           // 更Q弹的文字切换动画
                           transition: 'all 1.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                           transitionDelay: `${animationDelay * 0.12}ms`,
                          // 为当前行添加轻微的背景发光
                          filter: isCurrent 
                            ? 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.3))' 
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
    </div>
  );
}
