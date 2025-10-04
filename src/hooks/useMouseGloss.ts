import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * 跟随鼠标的光泽效果Hook
 * 
 * 创建实时跟随鼠标的径向渐变光泽效果
 * 
 * 性能优化：
 * - 节流控制（默认16ms，约60fps）
 * - 自动清理事件监听器
 * 
 * @param options 配置选项
 * @param options.intensity 光泽强度 0-1（默认0.15）
 * @param options.radius 光泽半径百分比（默认30）
 * @param options.color 光泽颜色（默认半透明白色）
 * @param options.throttleMs 节流间隔毫秒数（默认16ms）
 * 
 * @returns {{
 *   attachRef: 附加到目标元素的ref回调,
 *   glossStyle: 光泽层的CSS样式对象,
 *   hasGloss: 是否有光泽效果（鼠标是否在元素上）
 * }}
 * 
 * @example
 * const { attachRef, glossStyle } = useMouseGloss({ intensity: 0.2 });
 * 
 * <div ref={attachRef} style={{ position: 'relative' }}>
 *   <div style={{ ...glossStyle, position: 'absolute', inset: 0 }} />
 *   Content
 * </div>
 */
export function useMouseGloss(options?: {
  intensity?: number;
  radius?: number;
  color?: string;
  throttleMs?: number;
}) {
  const {
    intensity = 0.15,
    radius = 30,
    color = 'rgba(255, 255, 255, 0.4)',
    throttleMs = 16, // 🔧 P3新增：默认16ms节流（~60fps）
  } = options || {};

  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // 🔧 P2修复：添加节流，减少状态更新频率
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!elementRef.current) return;

    // 节流控制
    const now = performance.now();
    if (now - lastUpdateRef.current < throttleMs) {
      return;
    }
    lastUpdateRef.current = now;

    const rect = elementRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setMousePosition({ x, y });
  }, [throttleMs]);

  const handleMouseLeave = useCallback(() => {
    setMousePosition(null);
  }, []);

  const attachRef = useCallback((element: HTMLElement | null) => {
    if (elementRef.current) {
      elementRef.current.removeEventListener('mousemove', handleMouseMove);
      elementRef.current.removeEventListener('mouseleave', handleMouseLeave);
    }

    elementRef.current = element;

    if (element) {
      element.addEventListener('mousemove', handleMouseMove);
      element.addEventListener('mouseleave', handleMouseLeave);
    }
  }, [handleMouseMove, handleMouseLeave]);

  // 清理
  useEffect(() => {
    return () => {
      if (elementRef.current) {
        elementRef.current.removeEventListener('mousemove', handleMouseMove);
        elementRef.current.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [handleMouseMove, handleMouseLeave]);

  // 生成光泽样式
  const glossStyle = mousePosition
    ? {
        background: `radial-gradient(circle ${radius}% at ${mousePosition.x}% ${mousePosition.y}%, ${color} 0%, transparent 100%)`,
        opacity: intensity,
        pointerEvents: 'none' as const,
      }
    : {
        opacity: 0,
        pointerEvents: 'none' as const,
      };

  return {
    attachRef,
    glossStyle,
    hasGloss: mousePosition !== null,
  };
}
