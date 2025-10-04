/**
 * 主题Context - 管理应用主题和外观设置
 * 
 * 设计原则：
 * - 高内聚：主题、对比度、歌词动画等视觉设置集中管理
 * - 持久化：自动保存到localStorage
 * - 响应式：监听系统主题变化
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { ThemeMode, LyricsAnimationSettings } from '../types/music';

// ==================== Context类型定义 ====================

interface ThemeContextValue {
  // 主题状态
  theme: ThemeMode;
  isHighContrast: boolean;
  lyricsAnimationSettings: LyricsAnimationSettings;
  
  // 操作方法
  setTheme: (theme: ThemeMode) => void;
  toggleHighContrast: () => void;
  updateLyricsAnimationSettings: (settings: Partial<LyricsAnimationSettings>) => void;
  
  // 工具方法
  isDarkMode: () => boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ==================== 常量 ====================

const STORAGE_KEYS = {
  THEME: 'windchime-theme',
  HIGH_CONTRAST: 'windchime-high-contrast',
  LYRICS_ANIMATION: 'windchime-lyrics-animation-settings',
} as const;

const DEFAULT_LYRICS_ANIMATION: LyricsAnimationSettings = {
  style: 'BOUNCY_SOFT',
};

// ==================== Provider组件 ====================

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // ========== 主题状态 ==========
  
  /**
   * 主题模式
   */
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';
    
    const stored = localStorage.getItem(STORAGE_KEYS.THEME);
    if (stored && ['system', 'light', 'dark'].includes(stored)) {
      return stored as ThemeMode;
    }
    return 'system';
  });

  /**
   * 高对比度模式
   */
  const [isHighContrast, setIsHighContrast] = useState(() => {
    if (typeof window === 'undefined') return false;
    
    const stored = localStorage.getItem(STORAGE_KEYS.HIGH_CONTRAST);
    if (stored !== null) {
      return stored === 'true';
    }
    // 默认跟随系统设置
    return window.matchMedia('(prefers-contrast: more)').matches;
  });

  /**
   * 歌词动画设置
   */
  const [lyricsAnimationSettings, setLyricsAnimationSettings] = 
    useState<LyricsAnimationSettings>(() => {
      if (typeof window === 'undefined') return DEFAULT_LYRICS_ANIMATION;
      
      const stored = localStorage.getItem(STORAGE_KEYS.LYRICS_ANIMATION);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (error) {
          console.warn('解析歌词动画设置失败:', error);
        }
      }
      return DEFAULT_LYRICS_ANIMATION;
    });

  // ========== 主题操作方法 ==========

  /**
   * 设置主题模式
   */
  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
    }
  }, []);

  /**
   * 切换高对比度模式
   */
  const toggleHighContrast = useCallback(() => {
    const newValue = !isHighContrast;
    setIsHighContrast(newValue);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.HIGH_CONTRAST, newValue.toString());
    }
  }, [isHighContrast]);

  /**
   * 更新歌词动画设置
   */
  const updateLyricsAnimationSettings = useCallback((
    newSettings: Partial<LyricsAnimationSettings>
  ) => {
    setLyricsAnimationSettings(prev => {
      const updated = { ...prev, ...newSettings };
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.LYRICS_ANIMATION, JSON.stringify(updated));
      }
      
      return updated;
    });
  }, []);

  /**
   * 判断当前是否为暗色模式
   */
  const isDarkMode = useCallback((): boolean => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    
    // system模式下检查系统偏好
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, [theme]);

  // ========== 主题应用 ==========

  /**
   * 应用主题到DOM
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyTheme = (themeMode: ThemeMode) => {
      const root = document.documentElement;
      
      // 移除所有主题类
      root.classList.remove('dark');
      root.removeAttribute('data-theme');
      
      if (themeMode === 'dark') {
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
      } else if (themeMode === 'light') {
        root.setAttribute('data-theme', 'light');
      } else {
        // system - 根据系统偏好决定
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
          root.classList.add('dark');
          root.setAttribute('data-theme', 'dark');
        } else {
          root.setAttribute('data-theme', 'light');
        }
      }
    };

    applyTheme(theme);

    // 监听系统主题偏好变化
    const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    systemThemeQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      systemThemeQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [theme]);

  /**
   * 应用对比度设置到DOM
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyContrastMode = (highContrast: boolean) => {
      if (highContrast) {
        document.documentElement.setAttribute('data-contrast', 'high');
      } else {
        document.documentElement.removeAttribute('data-contrast');
      }
    };

    applyContrastMode(isHighContrast);

    // 监听系统对比度偏好变化
    const mediaQuery = window.matchMedia('(prefers-contrast: more)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      const hasManualPreference = localStorage.getItem(STORAGE_KEYS.HIGH_CONTRAST) !== null;
      if (!hasManualPreference) {
        setIsHighContrast(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, [isHighContrast]);

  // ========== Context Value ==========

  const value: ThemeContextValue = {
    // 状态
    theme,
    isHighContrast,
    lyricsAnimationSettings,
    
    // 方法
    setTheme,
    toggleHighContrast,
    updateLyricsAnimationSettings,
    isDarkMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ==================== Hook导出 ====================

/**
 * 使用主题Context的Hook
 * 
 * @example
 * const { theme, setTheme, isDarkMode } = useTheme();
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme必须在ThemeProvider内部使用');
  }
  
  return context;
}

/**
 * 只获取主题模式的Hook（性能优化）
 */
export function useThemeMode() {
  const { theme, setTheme, isDarkMode } = useTheme();
  return { theme, setTheme, isDarkMode };
}

/**
 * 只获取歌词动画设置的Hook（性能优化）
 */
export function useLyricsAnimation() {
  const { lyricsAnimationSettings, updateLyricsAnimationSettings } = useTheme();
  return { lyricsAnimationSettings, updateLyricsAnimationSettings };
}



