import { useState, useRef, useEffect } from 'react';
import { Page } from '../App';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  // 🎨 动画状态管理
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
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

  // 🎨 玻璃化导航项配置
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
      id: 'playlist' as Page, 
      label: '播放列表', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
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

  // 🎯 计算悬停指示器位置
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

  // 🎯 计算激活指示器位置
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

  // 🎨 鼠标事件处理
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

  // 🎯 侧边栏鼠标离开处理
  const handleSidebarMouseLeave = () => {
    setHoveredItem(null);
    setHoverIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
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
    <aside ref={sidebarRef} className="app-sidebar flex flex-col relative" onMouseLeave={handleSidebarMouseLeave}>
      {/* 🎯 全局激活状态指示器 - 当前选中页面（始终显示） */}
      <div
        className="absolute left-6 right-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 shadow-md pointer-events-none z-10 bounce-indicator"
        style={{
          transform: `${activeIndicatorStyle.transform} ${hoveredItem === currentPage ? 'scale(1.03)' : 'scale(1)'}`,
          height: activeIndicatorStyle.height,
          opacity: activeIndicatorStyle.opacity,
          transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      />
      
      {/* 🎯 全局悬停状态指示器 - 仅在非当前页面时显示 */}
      {hoveredItem && hoveredItem !== currentPage && (
        <div
          className="absolute left-6 right-6 rounded-xl bg-white/40 backdrop-blur-sm border border-white/30 shadow-sm pointer-events-none z-10"
          style={{
            transform: hoverIndicatorStyle.transform,
            height: hoverIndicatorStyle.height,
            opacity: hoverIndicatorStyle.opacity,
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      )}

      {/* 🎵 玻璃化导航菜单 */}
      <nav className="flex-1 p-6">
        <div ref={navRef} className="space-y-2 relative">
          
          {navigationItems.map((item) => (
            <button
              key={item.id}
              ref={(el) => { itemRefs.current[item.id] = el; }}
              onClick={() => onNavigate(item.id)}
              onMouseEnter={() => handleMouseEnter(item.id)}
              onMouseLeave={handleMouseLeave}
              className={`
                sidebar-button w-full flex items-center gap-3 px-4 py-3 rounded-xl relative z-10
                group transform-gpu
                ${currentPage === item.id
                  ? `text-slate-900 font-semibold ${hoveredItem === item.id ? 'text-blue-800' : ''}`
                  : 'text-slate-700 hover:text-slate-900 font-medium'
                }
              `}
              style={{
                transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: hoveredItem === item.id ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              <span className="flex items-center justify-center">{item.icon}</span>
              <span className="text-sm leading-tight">{item.label}</span>
              
              {currentPage === item.id && (
                <div className="absolute left-0 w-1 h-8 bg-gradient-to-b from-brand-600 to-sky-400 rounded-r-lg z-20"></div>
              )}
            </button>
          ))}
        </div>


        {/* 🎯 底部设置 */}
        <div className="mt-8 pt-6 border-t border-glass-border">
          <div className="space-y-2">
            <button
              ref={(el) => { itemRefs.current['settings'] = el; }}
              onClick={() => onNavigate('settings' as Page)}
              onMouseEnter={() => handleMouseEnter('settings')}
              onMouseLeave={handleMouseLeave}
              className={`
                sidebar-button w-full flex items-center gap-3 px-4 py-3 rounded-xl relative z-10
                group transform-gpu
                ${currentPage === 'settings'
                  ? 'text-slate-900 font-semibold'
                  : 'text-slate-700 hover:text-slate-900 font-medium'
                }
              `}
              style={{
                transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: hoveredItem === 'settings' ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              <span className="flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <span className="text-sm leading-tight">设置</span>
              {currentPage === 'settings' && (
                <div className="absolute left-0 w-1 h-8 bg-gradient-to-b from-brand-600 to-sky-400 rounded-r-lg z-20"></div>
              )}
            </button>
          </div>
        </div>
      </nav>
    </aside>
  );
}
