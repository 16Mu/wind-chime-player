import { useEffect, useLayoutEffect, useRef, useCallback } from 'react';

interface ScrollConfig {
  easing: string;
  durationBase: number;
  durationMin: number;
  durationMax: number;
  durationK: number;
  minDeltaNonAnimPx: number;
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

/**
 * 歌词滚动动画 Hook
 *
 * 职责：
 * 1. 监听目标索引变化，触发滚动动画
 * 2. 监听布局变化（字体大小），重新对齐
 * 3. 管理 transform 和 transition 样式
 * 4. 自动判断是否需要 seek（大跨度跳转）
 *
 * @param containerRef 滚动容器的 ref
 * @param linesRef 歌词行元素数组的 ref
 * @param targetIndex 目标行索引
 * @param fontSizes 字体大小配置
 * @param scrollConfig 滚动动画配置
 */
export function useScrollAnimation(
  containerRef: React.RefObject<HTMLDivElement>,
  linesRef: React.RefObject<(HTMLDivElement | null)[]>,
  targetIndex: number | null,
  fontSizes: FontSizes,
  scrollConfig: ScrollConfig,
  options?: {
    resumeDelayMs?: number;
    onUserScrollChange?: (isScrolling: boolean) => void;
    onManualFocusChange?: (index: number | null) => void;
  }
) {
  const currentYRef = useRef<number>(0);
  const lastIndexRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  // const isInitialMountRef = useRef<boolean>(true); // 标记是否为首次加载
  const pendingScrollIndexRef = useRef<number | null>(null); // 标记待处理的滚动索引
  // 🔧 P1修复：添加重试计数器，防止无限重试
  const retryCountRef = useRef<number>(0);
  const MAX_RETRIES = 3; // 最多重试3次

  // 用户交互控制
  const isUserScrollingRef = useRef<boolean>(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuedIndexRef = useRef<number | null>(null);
  // const queuedManualIndexRef = useRef<number | null>(null); // 标记待恢复的自动高亮索引

  // 测量行中心位置（相对于容器内容起点，未应用 transform）
  const measureCenter = useCallback((idx: number): number | null => {
    const el = linesRef.current?.[idx];
    const container = containerRef.current;

    if (!el || !container) {
      console.warn(`⚠️ [useScrollAnimation] 第 ${idx} 行元素或容器不存在`);
      return null;
    }

    // 使用 offsetTop 获取元素相对于容器的位置
    const offsetTop = el.offsetTop;
    const offsetHeight = el.offsetHeight;

    if (offsetHeight === 0) {
      console.warn(`⚠️ [useScrollAnimation] 第 ${idx} 行高度为 0`);
      return null;
    }

    // 元素中心位置 = offsetTop + 元素高度的一半
    const centerY = offsetTop + offsetHeight / 2;

    // 🔍 调试：显示详细的测量信息
    const viewport = container.parentElement;
    console.log(`📏 [measureCenter] 第 ${idx} 行:`, {
      offsetTop,
      offsetHeight,
      centerY,
      containerScrollTop: container.scrollTop,
      viewportHeight: viewport?.clientHeight,
      containerHeight: container.clientHeight
    });

    return centerY;
  }, []);

  // 计算目标 Y 位置（使用父容器的可视区域高度）
  const computeTargetY = useCallback((centerY: number): { targetY: number; isReady: boolean } => {
    const container = containerRef.current;
    if (!container) return { targetY: 0, isReady: false };

    // 使用父元素（可视区域）的高度，而不是内容容器的高度
    const viewportContainer = container.parentElement;
    if (!viewportContainer) {
      console.warn('⚠️ [computeTargetY] 未找到父容器');
      return { targetY: 0, isReady: false };
    }

    const viewportHeight = viewportContainer.clientHeight;

    // 高度检查：如果容器高度异常小（<100px），说明布局尚未稳定
    if (viewportHeight < 100) {
      console.warn(`⚠️ [computeTargetY] 容器高度异常 ${viewportHeight}px，布局尚未稳定`);
      return { targetY: currentYRef.current, isReady: false };
    }

    const viewportMid = viewportHeight / 2;
    const targetY = Math.round(viewportMid - centerY);

    console.log(`🎯 [computeTargetY] 可视区域高度=${viewportHeight}px, 中点=${viewportMid}px, 行中心=${centerY}px, targetY=${targetY}px`);
    console.log(`🎯 [computeTargetY] 详细信息:`, {
      viewportHeight,
      viewportMid,
      centerY,
      targetY,
      currentY: currentYRef.current,
      deltaY: targetY - currentYRef.current
    });

    return { targetY, isReady: true };
  }, []);

  // 使用 ref 存储 scrollConfig，避免依赖项变化导致函数重新创建
  const scrollConfigRef = useRef(scrollConfig);
  useLayoutEffect(() => {
    scrollConfigRef.current = scrollConfig;
  });

  // 计算动画时长
  const computeDuration = useCallback((deltaY: number): number => {
    const abs = Math.abs(deltaY);
    const config = scrollConfigRef.current;
    return Math.max(
      config.durationMin,
      Math.min(
        config.durationMax,
        config.durationBase + config.durationK * abs
      )
    );
  }, []);

  // 应用 transform（带动画）
  const applyAnimated = useCallback((targetY: number, duration: number) => {
    const container = containerRef.current;
    if (!container) return;

    const config = scrollConfigRef.current;

    // 使用 CSS Variables 控制动画
    container.style.setProperty('--lyrics-y', `${targetY}px`);
    container.style.setProperty('--lyrics-duration', `${duration}ms`);
    container.style.setProperty('--lyrics-easing', config.easing);

    // 确保 transition 生效
    if (!container.style.transition || container.style.transition === 'none') {
      container.style.transition = 'transform var(--lyrics-duration, 0ms) var(--lyrics-easing)';
    }

    currentYRef.current = targetY;

    console.log(`🎬 [动画] 滚动到 ${targetY}px, 时长 ${duration}ms`);
  }, []);

  // 应用 transform（瞬时）
  const applyInstant = useCallback((targetY: number) => {
    const container = containerRef.current;
    if (!container) return;

    container.style.setProperty('--lyrics-y', `${targetY}px`);
    container.style.setProperty('--lyrics-duration', '0ms');
    container.style.transition = 'none';

    // 强制 reflow
    void container.offsetHeight;

    currentYRef.current = targetY;

    console.log(`⚡ [瞬时] 跳转到 ${targetY}px`);
  }, []);

  // 初始化 CSS Variables（仅在挂载时执行一次）
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const config = scrollConfigRef.current;

    // 设置初始 CSS 变量
    container.style.setProperty('--lyrics-y', '0px');
    container.style.setProperty('--lyrics-duration', '0ms');
    container.style.setProperty('--lyrics-easing', config.easing);

    // 设置 CSS 属性
    container.style.transform = 'translate3d(0, var(--lyrics-y, 0), 0)';
    container.style.transition = 'transform var(--lyrics-duration, 0ms) var(--lyrics-easing)';
    container.style.willChange = 'transform';

    console.log('[useScrollAnimation] 初始化完成');

    return () => {
      console.log('[useScrollAnimation] 组件卸载');
    };
  }, []);

  // 响应目标索引变化
  useEffect(() => {
    if (targetIndex === null) return;

    // 若正在用户滚动，则仅记录待恢复的索引
    if (isUserScrollingRef.current) {
      queuedIndexRef.current = targetIndex;
      return;
    }

    if (targetIndex === null) return;

    const centerY = measureCenter(targetIndex);
    if (centerY === null) return;

    const result = computeTargetY(centerY);

    // 如果布局尚未就绪，标记待处理并等待下次重试
    if (!result.isReady) {
      // 🔧 P1修复：检查重试次数
      if (retryCountRef.current >= MAX_RETRIES) {
        console.warn(`⚠️ [滚动] 达到最大重试次数 (${MAX_RETRIES})，放弃滚动到索引 ${targetIndex}`);
        retryCountRef.current = 0;
        pendingScrollIndexRef.current = null;
        return;
      }

      console.log(`⏳ [滚动延迟] 布局尚未就绪，标记索引 ${targetIndex} 待处理 (重试 ${retryCountRef.current + 1}/${MAX_RETRIES})`);
      pendingScrollIndexRef.current = targetIndex;
      retryCountRef.current++;

      // 设置一个短暂的延迟重试
      const retryTimer = setTimeout(() => {
        if (pendingScrollIndexRef.current === targetIndex) {
          console.log(`🔄 [滚动重试] 重新尝试滚动到索引 ${targetIndex}`);
          const retryCenter = measureCenter(targetIndex);
          if (retryCenter !== null) {
            const retryResult = computeTargetY(retryCenter);
            if (retryResult.isReady) {
              applyAnimated(retryResult.targetY, computeDuration(retryResult.targetY - currentYRef.current));
              pendingScrollIndexRef.current = null;
              retryCountRef.current = 0; // 成功后重置计数器
            }
          }
        }
      }, 100);

      return () => clearTimeout(retryTimer);
    }

    const deltaY = result.targetY - currentYRef.current;
    const duration = computeDuration(deltaY);

    if (Math.abs(deltaY) < scrollConfigRef.current.minDeltaNonAnimPx) {
      applyInstant(result.targetY);
    } else {
      applyAnimated(result.targetY, duration);
    }

    lastIndexRef.current = targetIndex;
    lastUpdateTimeRef.current = Date.now();

    // 清除待处理标记和重试计数器
    pendingScrollIndexRef.current = null;
    retryCountRef.current = 0; // 成功滚动后重置计数器
  }, [targetIndex, measureCenter, computeTargetY, applyAnimated, applyInstant, computeDuration]);

  // 监听字体大小变化导致的重新对齐
  useEffect(() => {
    const index = lastIndexRef.current;
    if (index === null) return;

    const centerY = measureCenter(index);
    if (centerY === null) return;

    const result = computeTargetY(centerY);
    if (!result.isReady) return;

    applyInstant(result.targetY);
  }, [fontSizes, measureCenter, computeTargetY, applyInstant]);

  // 监听容器尺寸变化进行重对齐
  useEffect(() => {
    const handleResize = () => {
      if (lastIndexRef.current === null) return;
      const centerY = measureCenter(lastIndexRef.current);
      if (centerY === null) return;
      const result = computeTargetY(centerY);
      if (!result.isReady) return;
      applyInstant(result.targetY);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [measureCenter, computeTargetY, applyInstant]);

  // 处理用户滚动事件
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resumeDelay = options?.resumeDelayMs ?? 1500;

    const resetResumeTimer = (delay: number) => {
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
      
      console.log(`⏱️ [resumeTimer] 设置恢复定时器，延迟 ${delay}ms`);
      
      resumeTimerRef.current = setTimeout(() => {
        const wasScrolling = isUserScrollingRef.current;
        isUserScrollingRef.current = false;
        resumeTimerRef.current = null;

        console.log(`✅ [resumeTimer] 定时器触发，开始自动归位`, {
          wasScrolling,
          queuedIndex: queuedIndexRef.current,
          targetIndex,
          currentY: currentYRef.current
        });

        if (wasScrolling && options?.onUserScrollChange) {
          options.onUserScrollChange(false);
        }

        // 🔧 清除手动滚动标志（高亮始终跟随播放，无需额外操作）
        console.log(`🔄 [resumeTimer] 结束手动滚动模式`);

        const queued = queuedIndexRef.current ?? targetIndex;
        queuedIndexRef.current = null;

        if (queued !== null) {
          console.log(`🎯 [resumeTimer] 归位到索引 ${queued}`);
          const centerY = measureCenter(queued);
          if (centerY !== null) {
            const result = computeTargetY(centerY);
            if (result.isReady) {
              const deltaY = result.targetY - currentYRef.current;
              const duration = computeDuration(deltaY);
              console.log(`🎬 [resumeTimer] 执行归位动画，deltaY=${deltaY}px, duration=${duration}ms`);
              if (Math.abs(deltaY) < scrollConfigRef.current.minDeltaNonAnimPx) {
                applyInstant(result.targetY);
              } else {
                applyAnimated(result.targetY, duration);
              }
              lastIndexRef.current = queued;
            }
          }
        } else {
          console.warn(`⚠️ [resumeTimer] 没有目标索引可归位`);
        }
      }, delay);
    };

    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 0.5) return;

      event.preventDefault();

      const wasScrolling = isUserScrollingRef.current;
      isUserScrollingRef.current = true;
      queuedIndexRef.current = targetIndex;

      if (!wasScrolling) {
        console.log(`🖱️ [wheel] 开始手动滚动，当前播放索引: ${targetIndex}`);
        if (options?.onUserScrollChange) {
          options.onUserScrollChange(true);
        }
      }

      const containerEl = containerRef.current;
      if (containerEl) {
        const currentVar = containerEl.style.getPropertyValue('--lyrics-y');
        const currentY = currentVar ? parseFloat(currentVar) || currentYRef.current : currentYRef.current;

        // 🎨 增加滚动距离系数，让滚动更灵敏、更Q弹
        const scrollMultiplier = 1.8;
        let nextY = currentY - (event.deltaY * scrollMultiplier);

        if (!Number.isFinite(nextY)) {
          nextY = currentYRef.current - event.deltaY;
        }

        const lines = linesRef.current;
        let closestIdx = null as number | null;
        if (lines && lines.length > 0) {
          const viewportHeight = containerEl.parentElement?.clientHeight ?? 0;
          const viewportMid = viewportHeight / 2;
          let closestDiff = Infinity;

          lines.forEach((line, idx) => {
            if (!line) return;
            const rect = line.getBoundingClientRect();
            const containerRect = containerEl.getBoundingClientRect();
            const center = rect.top + rect.height / 2 - containerRect.top;
            const diff = Math.abs(center - viewportMid);
            if (diff < closestDiff) {
              closestDiff = diff;
              closestIdx = idx;
            }
          });

          if (closestIdx !== null) {
            const firstCenter = measureCenter(0);
            const lastCenter = measureCenter(lines.length - 1);
            if (firstCenter !== null && lastCenter !== null) {
              const firstResult = computeTargetY(firstCenter);
              const lastResult = computeTargetY(lastCenter);
              if (firstResult.isReady && lastResult.isReady) {
                const maxY = firstResult.targetY;
                const minY = lastResult.targetY;
                if (Number.isFinite(maxY) && Number.isFinite(minY)) {
                  nextY = Math.max(Math.min(nextY, maxY), minY);
                }
              }
            }

            // 🔧 记录最近的索引（用于边界检测），但不影响高亮
            console.log(`📍 [wheel] 滚动到接近索引 ${closestIdx} 的位置`);
            // 注意：不调用 onManualFocusChange，高亮始终跟随播放位置
          }
        }

        // 🎨 使用缓动动画替代瞬时应用，增加Q弹感
        const smoothDuration = 150; // 150ms 短动画
        const smoothEasing = 'cubic-bezier(0.34, 1.56, 0.64, 1)'; // Q弹缓动
        
        containerEl.style.setProperty('--lyrics-y', `${nextY}px`);
        containerEl.style.setProperty('--lyrics-duration', `${smoothDuration}ms`);
        containerEl.style.setProperty('--lyrics-easing', smoothEasing);
        
        if (!containerEl.style.transition || containerEl.style.transition === 'none') {
          containerEl.style.transition = 'transform var(--lyrics-duration, 0ms) var(--lyrics-easing)';
        }
        
        currentYRef.current = nextY;
      }

      resetResumeTimer(resumeDelay);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
    };
  }, [containerRef, targetIndex, measureCenter, computeTargetY, applyAnimated, applyInstant, computeDuration, options?.resumeDelayMs, options?.onUserScrollChange, options?.onManualFocusChange]);
}
