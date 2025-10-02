import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * 跟随鼠标的光泽效�?Hook
 * 返回鼠标相对位置和事件处理器，用于创建实时跟随鼠标的径向渐变光泽
 */
export function useMouseGloss(options?: {
  intensity?: number; // 光泽强度 0-1
  radius?: number; // 光泽半径百分�?
  color?: string; // 光泽颜色
}) {
  const {
    intensity = 0.15,
    radius = 30,
    color = 'rgba(255, 255, 255, 0.4)'
  } = options || {};

  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!elementRef.current) return;

    const rect = elementRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setMousePosition({ x, y });
  }, []);

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

