import { useState, useRef, useEffect } from 'react';
import type { Page } from '../types/music';
import { usePlaylist } from '../contexts/PlaylistContext';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onCollapseChange?: (isCollapsed: boolean) => void;
}

export default function Sidebar({ currentPage, onNavigate, onCollapseChange }: SidebarProps) {
  // 从 PlaylistContext 获取歌单数据 - 高内聚低耦合
  const { getSidebarPlaylists } = usePlaylist();
  const sidebarPlaylists = getSidebarPlaylists() || []; // 防御性编程，确保总是返回数组

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

  // 📐 窗口大小变化时重新计算位置
  useEffect(() => {
    const handleResize = () => {
      updateActiveIndicatorPosition(currentPage);
      if (hoveredItem) {
        updateHoverIndicatorPosition(hoveredItem);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [hoveredItem, currentPage]);

  return (
    <aside 
      ref={sidebarRef} 
      className={`app-sidebar flex flex-col relative dark:bg-dark-100/95 dark:border-dark-500/30 ${
        isCollapsed ? 'app-sidebar-collapsed' : ''
      }`}
      onMouseLeave={handleSidebarMouseLeave}
    >
      {/* 全局激活状态指示器 */}
      <div
        className={`absolute rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-dark-300/50 dark:to-dark-200/50 border border-blue-200 dark:border-blue-800/50 dark:border-card-dark-border shadow-md pointer-events-none z-10 bounce-indicator transition-opacity duration-700 ${
          isCollapsed ? 'left-3 right-3' : 'left-6 right-6'
        }`}
        style={{
          transform: `${activeIndicatorStyle.transform} ${hoveredItem === currentPage ? 'scale(1.03)' : 'scale(1)'}`,
          height: activeIndicatorStyle.height,
          opacity: activeIndicatorStyle.opacity,
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          transitionProperty: 'transform, opacity',
          willChange: 'transform, opacity'
        }}
      />
      
      {/* 全局悬停状态指示器 */}
      {hoveredItem && hoveredItem !== currentPage && (
        <div
          className={`absolute rounded-xl bg-white/40 dark:bg-card-dark-bg backdrop-blur-sm border border-white/30 dark:border-card-dark-border shadow-sm pointer-events-none z-10 ${
            isCollapsed ? 'left-3 right-3' : 'left-6 right-6'
          }`}
          style={{
            transform: hoverIndicatorStyle.transform,
            height: hoverIndicatorStyle.height,
            opacity: hoverIndicatorStyle.opacity,
            transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            transitionProperty: 'transform, opacity',
            transitionDuration: '0.7s',
            willChange: 'transform, opacity'
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

        {/* 我的歌单区域 */}
        <div className="mt-6 pb-20">
          {/* 歌单标题栏 */}
          <div className="mb-4">
            {!isCollapsed && (
              <div className="flex items-center justify-between mb-3 px-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-dark-900">我的歌单</h3>
                <button
                  onClick={() => onNavigate('playlists' as Page)}
                  className="w-7 h-7 rounded-lg bg-brand-500 dark:bg-brand-600 hover:bg-brand-600 dark:hover:bg-brand-700
                           flex items-center justify-center text-white hover:scale-105 
                           transition-all duration-300 shadow-sm hover:shadow-md"
                  title="管理歌单"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
            {isCollapsed && (
              <div className="mb-3">
                <button
                  onClick={() => onNavigate('playlists' as Page)}
                  className="w-full py-3 px-2 rounded-xl flex items-center justify-center
                           text-slate-800 dark:text-dark-900 hover:bg-slate-100 dark:hover:bg-dark-200/50 hover:scale-105 
                           transition-all duration-300"
                  title="管理歌单"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* 歌单列表 */}
          <div>
            <div className="space-y-1.5">
              {sidebarPlaylists.map((playlist, index) => (
                <div
                  key={playlist.id}
                  className={`group relative cursor-pointer rounded-xl py-3 flex items-center
                            ${isCollapsed ? 'px-2 justify-center' : 'px-4'}`}
                  style={{
                    transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transitionProperty: 'padding',
                    transitionDuration: '0.7s'
                  }}
                  onClick={handlePlaylistClick}
                >
                  {/* 歌单图标 */}
                  <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${getPlaylistGradient(index)} 
                                flex items-center justify-center text-white text-xs 
                                shadow-sm flex-shrink-0 group-hover:playlist-icon-hover`}
                       style={{
                         transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                         transitionProperty: 'transform',
                         transitionDuration: '0.7s'
                       }}>
                    {playlist.is_smart ? '⚡' : '♪'}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 
                                  transition-colors duration-300 flex items-center justify-center rounded-md">
                      <svg className="w-2.5 h-2.5 text-white opacity-0 group-hover:opacity-100 
                                   transition-opacity duration-300" 
                           fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* 歌单信息容器 */}
                  <div 
                    className={`overflow-hidden ${
                      isCollapsed 
                        ? 'max-w-0 opacity-0 ml-0' 
                        : 'max-w-[200px] opacity-100 ml-3 flex-1'
                    }`}
                    style={{
                      transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                      transitionProperty: 'max-width, opacity, margin-left',
                      transitionDuration: '0.7s'
                    }}
                  >
                    <div className="min-w-0 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-medium text-slate-800 dark:text-dark-900 text-sm truncate leading-tight whitespace-nowrap">
                            {playlist.name}
                          </h4>
                          {playlist.is_pinned && (
                            <svg className="w-3 h-3 text-amber-500 dark:text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.061 1.06l1.06 1.06z" />
                            </svg>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-dark-600 leading-tight whitespace-nowrap">
                          {playlist.track_count} 首
                        </p>
                      </div>
                      
                      {/* 播放按钮 */}
                      <button 
                        className="w-6 h-6 rounded-md bg-white/80 dark:bg-dark-300/80 hover:bg-white dark:hover:bg-dark-300
                                 flex items-center justify-center opacity-0 group-hover:opacity-100 
                                 transition-all duration-200 hover:scale-105 shadow-sm ml-2 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate('playlists' as Page);
                        }}
                      >
                        <svg className="w-3 h-3 text-slate-700 dark:text-dark-800 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
                className="w-8 h-8 rounded-full flex items-center justify-center
                         text-slate-600 dark:text-dark-700 hover:text-slate-800 dark:hover:text-dark-900 hover:bg-white/50 dark:hover:bg-card-dark-bg
                         transition-all duration-300"
                title="搜索歌单"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>

              {/* 更多操作按钮 */}
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center
                         text-slate-600 dark:text-dark-700 hover:text-slate-800 dark:hover:text-dark-900 hover:bg-white/50 dark:hover:bg-card-dark-bg
                         transition-all duration-300"
                title="更多操作"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

    </aside>
  );
}
