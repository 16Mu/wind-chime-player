import { useState, useEffect, useRef } from 'react';

interface DensitySettings {
  rowPaddingY: number;
  thumbSize: number;
  contentGap: number;
}

// 🔧 P2修复：提取配置常量，避免魔法数字
const DENSITY_BREAKPOINTS = [
  { minHeight: 3000, rowPaddingY: 6, thumbSize: 36, contentGap: 10 },
  { minHeight: 2200, rowPaddingY: 7, thumbSize: 38, contentGap: 10 },
  { minHeight: 1600, rowPaddingY: 8, thumbSize: 40, contentGap: 12 },
  { minHeight: 1200, rowPaddingY: 10, thumbSize: 44, contentGap: 12 },
  { minHeight: 0, rowPaddingY: 12, thumbSize: 48, contentGap: 14 },
] as const;

/**
 * 响应式密度Hook
 * 
 * 根据窗口高度和设备像素比（DPR）自动调整UI密度
 * 
 * 原理：
 * - 计算有效高度 = 窗口高度 × DPR
 * - 根据断点自动选择最优密度设置
 * - 防抖处理resize事件（200ms），避免频繁计算
 * 
 * 断点配置：
 * - >= 3000px: 紧凑模式（适合4K+显示器）
 * - >= 2200px: 舒适模式（适合2K显示器）
 * - >= 1600px: 标准模式（适合FHD显示器）
 * - >= 1200px: 宽松模式（适合普通显示器）
 * - < 1200px: 超宽松模式（适合小屏幕）
 * 
 * @returns {DensitySettings} 密度设置对象
 * 
 * @example
 * const density = useResponsiveDensity();
 * 
 * <div style={{ 
 *   padding: `${density.rowPaddingY}px 0`,
 *   gap: `${density.contentGap}px`
 * }}>
 *   <img width={density.thumbSize} />
 * </div>
 */
export function useResponsiveDensity(): DensitySettings {
  const [settings, setSettings] = useState<DensitySettings>({
    rowPaddingY: 10,
    thumbSize: 44,
    contentGap: 12
  });

  // 🔧 P3修复：防抖处理resize事件
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const computeDensity = () => {
      const vh = window.innerHeight || 900;
      const dpr = window.devicePixelRatio || 1;
      const effectiveH = vh * dpr;

      // 🔧 P2修复：使用配置驱动，消除魔法数字
      for (const breakpoint of DENSITY_BREAKPOINTS) {
        if (effectiveH >= breakpoint.minHeight) {
          setSettings({
            rowPaddingY: breakpoint.rowPaddingY,
            thumbSize: breakpoint.thumbSize,
            contentGap: breakpoint.contentGap,
          });
          break;
        }
      }
    };
    
    // 🔧 P3修复：防抖resize事件（200ms）
    const handleResize = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = setTimeout(() => {
        computeDensity();
      }, 200);
    };

    computeDensity();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return settings;
}
