import React, { useState, useRef, useEffect } from 'react';
import type { Page } from '../types/music';
import { usePlaylist, type Playlist } from '../contexts/PlaylistContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUI } from '../contexts/UIContext';
import { usePlaylistCover } from '../hooks/usePlaylistCover';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onCollapseChange?: (isCollapsed: boolean) => void;
}

// 歌单卡片小组件（侧边栏专用）
interface PlaylistCardMiniProps {
  playlist: Playlist;
  onClick: () => void;
}

const PlaylistCardMini: React.FC<PlaylistCardMiniProps> = ({ playlist, onClick }) => {
  const coverImage = usePlaylistCover(playlist.id, playlist.cover_path, playlist.track_count);

  return (
    <button
      className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer
                 border border-slate-200 dark:border-gray-700
                 transition-all duration-200"
      onClick={onClick}
    >
      {/* 封面背景 */}
      {coverImage ? (
        <img
          src={coverImage}
          alt={playlist.name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        // 无封面时的默认背景
        <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-500/20 dark:to-pink-500/20 
                      flex items-center justify-center">
          {playlist.is_smart ? (
            <svg className="w-10 h-10 text-purple-400 dark:text-purple-400/60" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
            </svg>
          ) : (
            <svg className="w-10 h-10 text-purple-300 dark:text-purple-400/40" fill="currentColor" viewBox="0 0 20 20">
              <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
            </svg>
          )}
        </div>
      )}

      {/* 悬停遮罩和信息 */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 
                    transition-all duration-200
                    flex flex-col items-center justify-center p-2">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-center">
          <p className="text-white text-xs font-semibold line-clamp-2 leading-tight mb-1">
            {playlist.name}
          </p>
          <p className="text-white/90 text-[10px]">
            {playlist.track_count} 首
          </p>
        </div>
      </div>

      {/* 置顶标记 */}
      {playlist.is_pinned && (
        <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-purple-600 dark:bg-purple-400 rounded-full shadow-lg" />
      )}
    </button>
  );
};

export default function Sidebar({ currentPage, onNavigate, onCollapseChange }: SidebarProps) {
  // 从 PlaylistContext 获取歌单数据 - 高内聚低耦合
  const { getSidebarPlaylists } = usePlaylist();
  const sidebarPlaylists = getSidebarPlaylists() || []; // 防御性编程，确保总是返回数组
  
  // 主题管理
  const { theme, setTheme, isDarkMode } = useTheme();
  
  // UI管理
  const { showSettingsSearch } = useUI();

  // 动画状态
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoverIndicatorStyle, setHoverIndicatorStyle] = useState({
    transform: 'translateY(0px)',
    height: '48px',
    opacity: 0
  });
  const [activeIndicatorStyle, setActiveIndicatorStyle] = useState({
    transform: 'translateY(0px)',
    height: '48px',
    opacity: 0
  });
  const navRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  // 导航项配置
  const navigationItems = [
    { 
      id: 'library' as Page, 
      label: '音乐库', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      )
    },
    { 
      id: 'explore' as Page, 
      label: '发现', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )
    },
    { 
      id: 'playlists' as Page, 
      label: '歌单库', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    { 
      id: 'history' as Page, 
      label: '播放记录', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    { 
      id: 'favorite' as Page, 
      label: '我的收藏', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      )
    },
    { 
      id: 'genres' as Page, 
      label: '分类', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      )
    },
  ];

  // 计算悬停指示器位置
  const updateHoverIndicatorPosition = (itemId: string | null) => {
    if (!itemId || !itemRefs.current[itemId] || !sidebarRef.current) {
      setHoverIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
      return;
    }

    const button = itemRefs.current[itemId];
    const sidebar = sidebarRef.current;
    const buttonRect = button.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    
    const relativeTop = buttonRect.top - sidebarRect.top;
    
    setHoverIndicatorStyle({
      transform: `translateY(${relativeTop}px)`,
      height: `${buttonRect.height}px`,
      opacity: 1
    });
  };

  // 计算激活指示器位置
  const updateActiveIndicatorPosition = (itemId: string | null) => {
    if (!itemId || !itemRefs.current[itemId] || !sidebarRef.current) {
      setActiveIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
      return;
    }

    const button = itemRefs.current[itemId];
    const sidebar = sidebarRef.current;
    const buttonRect = button.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    
    const relativeTop = buttonRect.top - sidebarRect.top;
    
    setActiveIndicatorStyle({
      transform: `translateY(${relativeTop}px)`,
      height: `${buttonRect.height}px`,
      opacity: 1
    });
  };

  // 鼠标事件处理
  const handleMouseEnter = (itemId: string) => {
    setHoveredItem(itemId);
    updateHoverIndicatorPosition(itemId);
  };

  const handleMouseLeave = () => {
    // 延迟处理，给鼠标移动到其他按钮的时间
    setTimeout(() => {
      // 如果没有新的悬停项目，才隐藏指示器
      if (!document.querySelector('.sidebar-button:hover')) {
        setHoveredItem(null);
        setHoverIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
      }
    }, 10);
  };

  // 侧边栏鼠标离开处理
  const handleSidebarMouseLeave = () => {
    setHoveredItem(null);
    setHoverIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
  };

  // 收缩状态切换
  const toggleCollapse = () => {
    const newCollapsedState = !isCollapsed;
    
    // 添加动画类来优化性能
    if (sidebarRef.current) {
      sidebarRef.current.classList.add('animating');
      
      // 动画完成后移除优化类
      setTimeout(() => {
        if (sidebarRef.current) {
          sidebarRef.current.classList.remove('animating');
        }
      }, 700); // 与动画时长一致
    }
    
    setIsCollapsed(newCollapsedState);
    onCollapseChange?.(newCollapsedState);
  };

  // 点击歌单卡片 - 导航到歌单页面
  const handlePlaylistClick = () => {
    onNavigate('playlists' as Page);
  };

  // 获取歌单颜色样式
  const getPlaylistGradient = (index: number): string => {
    const gradients = [
      'from-purple-500 to-pink-500',
      'from-blue-600 to-indigo-600',
      'from-green-500 to-teal-500',
      'from-orange-500 to-red-500',
      'from-cyan-500 to-blue-500',
    ];
    return gradients[index % gradients.length];
  };

  // 🔄 当前页面变化时更新激活指示器
  useEffect(() => {
    updateActiveIndicatorPosition(currentPage);
  }, [currentPage]);

  // 📐 窗口大小变化时重新计算位置（添加节流优化）
  useEffect(() => {
    let resizeTimer: number;
    
    const handleResize = () => {
      // 清除之前的定时器
      clearTimeout(resizeTimer);
      
      // 延迟执行，避免频繁计算
      resizeTimer = window.setTimeout(() => {
        updateActiveIndicatorPosition(currentPage);
        if (hoveredItem) {
          updateHoverIndicatorPosition(hoveredItem);
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [hoveredItem, currentPage]);

  return (
    <aside 
      ref={sidebarRef} 
      className={`app-sidebar flex flex-col relative dark:bg-dark-100/95 dark:border-dark-500/30 ${
        isCollapsed ? 'app-sidebar-collapsed' : ''
      }`}
      onMouseLeave={handleSidebarMouseLeave}
    >
      {/* 全局激活状态指示器 - 优化：只动画 transform 和 opacity */}
      <div
        className={`absolute rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-dark-300/50 dark:to-dark-200/50 border border-blue-200 dark:border-card-dark-border shadow-md pointer-events-none z-10 bounce-indicator ${
          isCollapsed ? 'left-3 right-3' : 'left-6 right-6'
        }`}
        style={{
          transform: `${activeIndicatorStyle.transform} ${hoveredItem === currentPage ? 'scale(1.03)' : 'scale(1)'}`,
          height: activeIndicatorStyle.height,
          opacity: activeIndicatorStyle.opacity,
          transition: 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
          willChange: 'transform'
        }}
      />
      
      {/* 全局悬停状态指示器 - 优化：减少动画属性 */}
      {hoveredItem && hoveredItem !== currentPage && (
        <div
          className={`absolute rounded-xl bg-white/40 dark:bg-card-dark-bg backdrop-blur-sm border border-white/30 dark:border-card-dark-border shadow-sm pointer-events-none z-10 ${
            isCollapsed ? 'left-3 right-3' : 'left-6 right-6'
          }`}
          style={{
            transform: hoverIndicatorStyle.transform,
            height: hoverIndicatorStyle.height,
            opacity: hoverIndicatorStyle.opacity,
            transition: 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
            willChange: 'transform'
          }}
        />
      )}

      {/* 导航菜单 */}
      <nav className={`flex-1 overflow-y-auto py-6 transition-padding duration-700 ${
        isCollapsed ? 'px-2' : 'px-6'
      }`}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        transitionProperty: 'padding'
      }}>
        <div ref={navRef} className="space-y-2 relative">
          
          {navigationItems.map((item) => (
            <button
              key={item.id}
              ref={(el) => { itemRefs.current[item.id] = el; }}
              onClick={() => onNavigate(item.id)}
              onMouseEnter={() => handleMouseEnter(item.id)}
              onMouseLeave={handleMouseLeave}
              className={`
                sidebar-button w-full flex items-center rounded-xl relative z-10
                group transform-gpu py-3
                ${isCollapsed ? 'px-2 justify-center' : 'px-4'}
                ${currentPage === item.id
                  ? 'text-slate-900 dark:text-dark-900 font-semibold'
                  : hoveredItem === item.id
                    ? 'text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-slate-700 dark:text-dark-700 font-medium'
                }
              `}
              style={{
                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                transitionProperty: 'transform, color',
                transitionDuration: '0.7s',
                transform: hoveredItem === item.id ? 'scale(1.02)' : 'scale(1)',
                willChange: 'transform'
              }}
            >
              <span className="flex items-center justify-center flex-shrink-0">{item.icon}</span>
              <div 
                className={`overflow-hidden ${
                  isCollapsed 
                    ? 'max-w-0 opacity-0 ml-0' 
                    : 'max-w-[200px] opacity-100 ml-3'
                }`}
                style={{
                  transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transitionProperty: 'max-width, opacity, margin-left',
                  transitionDuration: '0.7s'
                }}
              >
                <span className="text-sm leading-tight whitespace-nowrap block">
                  {item.label}
                </span>
              </div>
              
              {currentPage === item.id && !isCollapsed && (
                <div className="absolute left-0 w-1 h-8 bg-gradient-to-b from-brand-600 to-sky-400 rounded-r-lg z-20"></div>
              )}
              {currentPage === item.id && isCollapsed && (
                <div className="absolute -right-1 top-1/2 transform -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-brand-600 to-sky-400 rounded-l-lg z-20"></div>
              )}
            </button>
          ))}
        </div>

        {/* 我的歌单区域 - 网格布局 */}
        <div className="mt-6 pb-20">
          {/* 歌单标题栏 */}
          <div className="mb-3">
            {!isCollapsed && (
              <div className="px-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-dark-900">我的歌单</h3>
                  <span className="text-xs font-semibold text-slate-500 dark:text-dark-600 
                                 bg-slate-100 dark:bg-dark-200/50 px-2 py-1 rounded-md">
                    {sidebarPlaylists.length}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 歌单网格 - 2x2布局（封面版） */}
          {!isCollapsed && (
            <div className="px-4">
              <div className="grid grid-cols-2 gap-2">
                {sidebarPlaylists.slice(0, 4).map((playlist) => (
                  <PlaylistCardMini key={playlist.id} playlist={playlist} onClick={handlePlaylistClick} />
                ))}
                
                {/* 创建新歌单按钮 */}
                {sidebarPlaylists.length < 4 && (
                  <button
                    className="aspect-square rounded-lg cursor-pointer
                             bg-slate-50 dark:bg-gray-800/30
                             hover:bg-slate-100 dark:hover:bg-gray-700/50
                             border-2 border-dashed border-slate-300 dark:border-gray-600
                             hover:border-purple-400 dark:hover:border-purple-500
                             transition-all duration-200
                             flex items-center justify-center group"
                    onClick={() => {
                      // TODO: 打开创建歌单对话框
                      console.log('创建新歌单');
                    }}
                  >
                    <svg className="w-8 h-8 text-slate-400 dark:text-gray-500 
                                  group-hover:text-purple-500 dark:group-hover:text-purple-400
                                  transition-colors" 
                         fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                )}
              </div>
              
              {/* 如果有更多歌单，显示"查看全部"按钮 */}
              {sidebarPlaylists.length > 4 && (
                <button
                  className="w-full mt-2 py-2 rounded-lg text-xs font-medium
                           text-slate-600 dark:text-gray-400
                           hover:text-purple-600 dark:hover:text-purple-400
                           hover:bg-slate-100 dark:hover:bg-gray-700/50
                           transition-all duration-200"
                  onClick={() => {
                    // TODO: 跳转到歌单页面
                    console.log('查看全部歌单');
                  }}
                >
                  查看全部 {sidebarPlaylists.length} 个歌单 →
                </button>
              )}
            </div>
          )}
          
          {/* 收起状态的歌单列表 - 封面版 */}
          {isCollapsed && sidebarPlaylists.length > 0 && (
            <div className="px-2 mt-3">
              <div className="space-y-1.5">
                {sidebarPlaylists.slice(0, 5).map((playlist) => (
                  <PlaylistCardMini key={playlist.id} playlist={playlist} onClick={handlePlaylistClick} />
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>

      
      {/* 底部工具栏 */}
      <div className={`absolute bottom-4 ${
        isCollapsed ? 'left-4' : 'left-6 right-6'
      }`}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        transitionProperty: 'left, right',
        transitionDuration: '0.7s'
      }}>
        <div className={`flex items-center gap-2 p-2 rounded-full
                        card-surface backdrop-blur-md border border-white/30 shadow-lg
                        ${isCollapsed ? 'w-12 justify-center' : 'w-auto justify-center'
                        }`}
                        style={{
                          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                          transitionProperty: 'width',
                          transitionDuration: '0.7s'
                        }}>
          
          {/* 收缩/展开按钮 */}
          <button
            onClick={toggleCollapse}
            className="w-8 h-8 rounded-full flex items-center justify-center
                     text-slate-600 dark:text-dark-700 hover:text-slate-800 dark:hover:text-dark-900 hover:bg-white/50 dark:hover:bg-card-dark-bg
                     transition-all duration-300 group"
            title={isCollapsed ? '展开侧边栏' : '收缩侧边栏'}
          >
            <svg 
              className={`w-4 h-4 transition-all duration-700 ${
                isCollapsed ? 'rotate-180' : ''
              }`}
              style={{
                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          {/* 其他工具按钮 - 仅在展开时显示 */}
          {!isCollapsed && (
            <>
              {/* 主题切换按钮 */}
              <button
                onClick={() => {
                  const currentIsDark = isDarkMode();
                  setTheme(currentIsDark ? 'light' : 'dark');
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center
                         text-slate-600 dark:text-dark-700 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-white/50 dark:hover:bg-card-dark-bg
                         transition-all duration-300"
                title={isDarkMode() ? '切换到浅色模式' : '切换到深色模式'}
              >
                {isDarkMode() ? (
                  /* 太阳图标 - 深色模式时显示 */
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                  </svg>
                ) : (
                  /* 月亮图标 - 浅色模式时显示 */
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              {/* 设置按钮 */}
              <button
                onClick={() => onNavigate('settings' as Page)}
                className={`w-8 h-8 rounded-full flex items-center justify-center
                         transition-all duration-300
                         ${currentPage === 'settings'
                           ? 'text-brand-600 bg-brand-100 dark:bg-brand-900/30 dark:text-brand-400'
                           : 'text-slate-600 dark:text-dark-700 hover:text-slate-800 dark:hover:text-dark-900 hover:bg-white/50 dark:hover:bg-card-dark-bg'
                         }`}
                title="设置"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* 搜索按钮 */}
              <button
                onClick={() => {
                  // 导航到设置页面并显示搜索框
                  onNavigate('settings' as Page);
                  showSettingsSearch();
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center
                         text-slate-600 dark:text-dark-700 hover:text-slate-800 dark:hover:text-dark-900 hover:bg-white/50 dark:hover:bg-card-dark-bg
                         transition-all duration-300"
                title="搜索设置"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

    </aside>
  );
}
