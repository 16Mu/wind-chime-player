import { useState, useEffect } from 'react';

interface DensitySettings {
  rowPaddingY: number;
  thumbSize: number;
  contentGap: number;
}

/**
 * 响应式密度Hook
 * 根据窗口高度和DPR自动调整UI密度
 */
export function useResponsiveDensity(): DensitySettings {
  const [settings, setSettings] = useState<DensitySettings>({
    rowPaddingY: 10,
    thumbSize: 44,
    contentGap: 12
  });

  useEffect(() => {
    const computeDensity = () => {
      const vh = window.innerHeight || 900;
      const dpr = window.devicePixelRatio || 1;
      const effectiveH = vh * dpr;

      if (effectiveH >= 3000) {
        setSettings({ rowPaddingY: 6, thumbSize: 36, contentGap: 10 });
      } else if (effectiveH >= 2200) {
        setSettings({ rowPaddingY: 7, thumbSize: 38, contentGap: 10 });
      } else if (effectiveH >= 1600) {
        setSettings({ rowPaddingY: 8, thumbSize: 40, contentGap: 12 });
      } else if (effectiveH >= 1200) {
        setSettings({ rowPaddingY: 10, thumbSize: 44, contentGap: 12 });
      } else {
        setSettings({ rowPaddingY: 12, thumbSize: 48, contentGap: 14 });
      }
    };

    computeDensity();
    window.addEventListener('resize', computeDensity);

    return () => window.removeEventListener('resize', computeDensity);
  }, []);

  return settings;
}

