/**
 * UI状态Context - 管理应用UI相关的所有状态
 * 
 * 设计原则：
 * - 高内聚：UI相关状态集中管理（页面、搜索、侧边栏等）
 * - 低耦合：UI状态独立于业务逻辑
 * - 易扩展：方便添加新的UI状态
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Page } from '../types/music';

// ==================== Context类型定义 ====================

interface UIContextValue {
  // 页面状态
  currentPage: Page;
  pageAnimationKey: number;
  
  // 搜索状态
  searchQuery: string;
  
  // 设置搜索状态
  settingsSearchQuery: string;
  settingsSearchVisible: boolean;
  highlightedSettingId: string | null;
  
  // 侧边栏状态
  sidebarCollapsed: boolean;
  
  // 操作方法
  navigateTo: (page: Page) => void;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
  setSettingsSearchQuery: (query: string) => void;
  clearSettingsSearch: () => void;
  showSettingsSearch: () => void;
  hideSettingsSearch: () => void;
  setHighlightedSettingId: (id: string | null) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const UIContext = createContext<UIContextValue | undefined>(undefined);

// ==================== Provider组件 ====================

interface UIProviderProps {
  children: ReactNode;
  initialPage?: Page;
}

export function UIProvider({ children, initialPage = 'library' }: UIProviderProps) {
  // ========== 页面状态 ==========
  const [currentPage, setCurrentPage] = useState<Page>(initialPage);
  const [pageAnimationKey, setPageAnimationKey] = useState(0);

  // ========== 搜索状态 ==========
  const [searchQuery, setSearchQueryState] = useState('');

  // ========== 设置搜索状态 ==========
  const [settingsSearchQuery, setSettingsSearchQueryState] = useState('');
  const [settingsSearchVisible, setSettingsSearchVisible] = useState(false);
  const [highlightedSettingId, setHighlightedSettingIdState] = useState<string | null>(null);

  // ========== 侧边栏状态 ==========
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);

  // ========== 页面导航 ==========

  /**
   * 导航到指定页面
   * 触发页面切换动画
   */
  const navigateTo = useCallback((page: Page) => {
    if (page !== currentPage) {
      setCurrentPage(page);
      setPageAnimationKey(prev => prev + 1); // 触发动画
      
      // 切换页面时可以清空搜索（可选）
      // setSearchQueryState('');
    }
  }, [currentPage]);

  // ========== 搜索操作 ==========

  /**
   * 设置搜索查询
   */
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
  }, []);

  /**
   * 清空搜索
   */
  const clearSearch = useCallback(() => {
    setSearchQueryState('');
  }, []);

  // ========== 设置搜索操作 ==========

  /**
   * 设置设置搜索查询
   */
  const setSettingsSearchQuery = useCallback((query: string) => {
    setSettingsSearchQueryState(query);
  }, []);

  /**
   * 清空设置搜索
   */
  const clearSettingsSearch = useCallback(() => {
    setSettingsSearchQueryState('');
  }, []);

  /**
   * 显示设置搜索框
   */
  const showSettingsSearch = useCallback(() => {
    setSettingsSearchVisible(true);
  }, []);

  /**
   * 隐藏设置搜索框
   */
  const hideSettingsSearch = useCallback(() => {
    setSettingsSearchVisible(false);
    setSettingsSearchQueryState('');
    setHighlightedSettingIdState(null);
  }, []);

  /**
   * 设置高亮的设置项ID
   */
  const setHighlightedSettingId = useCallback((id: string | null) => {
    setHighlightedSettingIdState(id);
  }, []);

  // ========== 侧边栏操作 ==========

  /**
   * 切换侧边栏折叠状态
   */
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsedState(prev => !prev);
  }, []);

  /**
   * 设置侧边栏折叠状态
   */
  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
  }, []);

  // ========== Context Value ==========

  const value: UIContextValue = {
    // 页面
    currentPage,
    pageAnimationKey,
    
    // 搜索
    searchQuery,
    
    // 设置搜索
    settingsSearchQuery,
    settingsSearchVisible,
    highlightedSettingId,
    
    // 侧边栏
    sidebarCollapsed,
    
    // 方法
    navigateTo,
    setSearchQuery,
    clearSearch,
    setSettingsSearchQuery,
    clearSettingsSearch,
    showSettingsSearch,
    hideSettingsSearch,
    setHighlightedSettingId,
    toggleSidebar,
    setSidebarCollapsed,
  };

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
}

// ==================== Hook导出 ====================

/**
 * 使用UI Context的Hook
 * 
 * @example
 * const { currentPage, navigateTo } = useUI();
 */
export function useUI() {
  const context = useContext(UIContext);
  
  if (context === undefined) {
    throw new Error('useUI必须在UIProvider内部使用');
  }
  
  return context;
}

/**
 * 只获取当前页面的Hook（性能优化）
 */
export function useCurrentPage() {
  const { currentPage, pageAnimationKey } = useUI();
  return { currentPage, pageAnimationKey };
}

/**
 * 只获取搜索状态的Hook（性能优化）
 */
export function useSearch() {
  const { searchQuery, setSearchQuery, clearSearch } = useUI();
  return { searchQuery, setSearchQuery, clearSearch };
}

/**
 * 只获取侧边栏状态的Hook（性能优化）
 */
export function useSidebar() {
  const { sidebarCollapsed, toggleSidebar, setSidebarCollapsed } = useUI();
  return { sidebarCollapsed, toggleSidebar, setSidebarCollapsed };
}



