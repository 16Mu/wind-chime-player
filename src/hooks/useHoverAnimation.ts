import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Q弹悬停动画Hook
 * 提供平滑的悬停指示器动画效果
 */
export function useHoverAnimation(enabled: boolean = true) {
  const [hoverIndicator, setHoverIndicator] = useState({
    top: 0,
    height: 0,
    visible: false,
    targetTop: 0,
    targetHeight: 0,
  });
  
  const indicatorRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  // Q弹缓动函�?
  const easeOutBack = (x: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  };

  // 平滑动画效果
  useEffect(() => {
    if (!enabled || !hoverIndicator.visible) return;

    const startTop = hoverIndicator.top;
    const startHeight = hoverIndicator.height;
    const targetTop = hoverIndicator.targetTop;
    const targetHeight = hoverIndicator.targetHeight;

    if (startTop === targetTop && startHeight === targetHeight) return;

    const duration = 250;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用简单的 ease-out
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      const currentTop = startTop + (targetTop - startTop) * easedProgress;
      const currentHeight = startHeight + (targetHeight - startHeight) * easedProgress;

      setHoverIndicator(prev => ({
        ...prev,
        top: currentTop,
        height: currentHeight
      }));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled, hoverIndicator.targetTop, hoverIndicator.targetHeight, hoverIndicator.visible]);

  const updateIndicator = useCallback((element: HTMLElement | null) => {
    if (!element || !enabled) {
      setHoverIndicator(prev => ({ ...prev, visible: false }));
      return;
    }

    const rect = element.getBoundingClientRect();
    // 查找包含表格的容器
    const table = element.closest('table');
    const container = table?.parentElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    
    // 计算相对于容器顶部的位置，考虑容器的scrollTop
    const top = rect.top - containerRect.top + container.scrollTop;
    const height = rect.height;

    // 立即更新位置，不使用动画
    setHoverIndicator(prev => {
      // 如果是首次显示，立即跳转
      if (!prev.visible) {
        return {
          visible: true,
          top: top,
          height: height,
          targetTop: top,
          targetHeight: height
        };
      }
      // 否则使用动画
      return {
        ...prev,
        visible: true,
        targetTop: top,
        targetHeight: height
      };
    });
  }, [enabled]);

  const hideIndicator = useCallback(() => {
    setHoverIndicator(prev => ({ ...prev, visible: false }));
  }, []);

  return {
    hoverIndicator,
    indicatorRef,
    updateIndicator,
    hideIndicator
  };
}

