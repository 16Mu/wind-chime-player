import { useState, useRef, useEffect } from 'react';
import { Page } from '../App';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onCollapseChange?: (isCollapsed: boolean) => void;
}

export default function Sidebar({ currentPage, onNavigate, onCollapseChange }: SidebarProps) {
  // 动画状态
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistIcon, setNewPlaylistIcon] = useState('♪');
  const [newPlaylistColor, setNewPlaylistColor] = useState('from-purple-500 to-pink-500');
  const [newPlaylistPrivate, setNewPlaylistPrivate] = useState(false);
  const [playlists, setPlaylists] = useState([
    {
      id: 1,
      name: 'Wind的音乐精选',
      trackCount: 42,
      color: 'from-purple-500 to-pink-500',
      icon: '🎵',
      isPrivate: false
    },
    {
      id: 2,
      name: '深夜电台',
      trackCount: 28,
      color: 'from-blue-600 to-indigo-600',
      icon: '🌙',
      isPrivate: true
    },
    {
      id: 3,
      name: '工作专注',
      trackCount: 35,
      color: 'from-green-500 to-teal-500',
      icon: '⚡',
      isPrivate: false
    }
  ]);
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
    setIsCollapsed(newCollapsedState);
    onCollapseChange?.(newCollapsedState);
  };

  // 创建新歌单
  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim()) {
      const newPlaylist = {
        id: Date.now(),
        name: newPlaylistName.trim(),
        trackCount: 0,
        color: newPlaylistColor,
        icon: newPlaylistIcon,
        isPrivate: newPlaylistPrivate
      };
      setPlaylists([...playlists, newPlaylist]);
      setShowCreatePlaylist(false);
      setNewPlaylistName('');
      setNewPlaylistIcon('♪');
      setNewPlaylistColor('from-purple-500 to-pink-500');
      setNewPlaylistPrivate(false);
    }
  };

  // 预设的颜色方案
  const colorOptions = [
    'from-purple-500 to-pink-500',
    'from-blue-600 to-indigo-600', 
    'from-green-500 to-teal-500',
    'from-orange-500 to-red-500',
    'from-cyan-500 to-blue-500',
    'from-violet-500 to-purple-500',
    'from-amber-500 to-orange-500',
    'from-emerald-500 to-green-500'
  ];

  // 预设的简约图标选项
  const iconOptions = [
    { icon: '♪', name: '音符' },
    { icon: '♫', name: '双音符' },
    { icon: '♬', name: '音乐' },
    { icon: '★', name: '星星' },
    { icon: '♡', name: '爱心' },
    { icon: '◆', name: '钻石' },
    { icon: '●', name: '圆点' },
    { icon: '▲', name: '三角' },
    { icon: '■', name: '方块' },
    { icon: '▼', name: '下三角' },
    { icon: '◎', name: '圆环' },
    { icon: '✦', name: '光芒' }
  ];

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
      className={`app-sidebar flex flex-col relative transition-all duration-700 ${
        isCollapsed ? 'app-sidebar-collapsed' : ''
      }`}
      style={{
        width: isCollapsed ? '80px' : '240px',
        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}
      onMouseLeave={handleSidebarMouseLeave}
    >
      {/* 全局激活状态指示器 */}
      <div
        className={`absolute rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 shadow-md pointer-events-none z-10 bounce-indicator transition-all duration-700 ${
          isCollapsed ? 'left-3 right-3' : 'left-6 right-6'
        }`}
        style={{
          transform: `${activeIndicatorStyle.transform} ${hoveredItem === currentPage ? 'scale(1.03)' : 'scale(1)'}`,
          height: activeIndicatorStyle.height,
          opacity: activeIndicatorStyle.opacity,
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      />
      
      {/* 全局悬停状态指示器 */}
      {hoveredItem && hoveredItem !== currentPage && (
        <div
          className={`absolute rounded-xl bg-white/40 backdrop-blur-sm border border-white/30 shadow-sm pointer-events-none z-10 transition-all duration-700 ${
            isCollapsed ? 'left-3 right-3' : 'left-6 right-6'
          }`}
          style={{
            transform: hoverIndicatorStyle.transform,
            height: hoverIndicatorStyle.height,
            opacity: hoverIndicatorStyle.opacity,
            transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      )}

      {/* 导航菜单 */}
      <nav className={`flex-1 overflow-y-auto py-6 transition-all duration-700 ${
        isCollapsed ? 'px-2' : 'px-6'
      }`}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
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
                group transform-gpu transition-all duration-700 py-3
                ${isCollapsed ? 'px-2 justify-center' : 'px-4'}
                ${currentPage === item.id
                  ? `text-slate-900 font-semibold ${hoveredItem === item.id ? 'text-blue-800' : ''}`
                  : 'text-slate-700 hover:text-slate-900 font-medium'
                }
              `}
              style={{
                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: hoveredItem === item.id ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              <span className="flex items-center justify-center flex-shrink-0">{item.icon}</span>
              <div 
                className={`transition-all duration-700 overflow-hidden ${
                  isCollapsed 
                    ? 'max-w-0 opacity-0 ml-0' 
                    : 'max-w-[200px] opacity-100 ml-3'
                }`}
                style={{
                  transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
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
                <h3 className="text-sm font-bold text-slate-800">我的歌单</h3>
                <button
                  onClick={() => setShowCreatePlaylist(true)}
                  className="w-7 h-7 rounded-lg bg-brand-500 hover:bg-brand-600
                           flex items-center justify-center text-white hover:scale-105 
                           transition-all duration-300 shadow-sm hover:shadow-md"
                  title="创建新歌单"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            )}
            {isCollapsed && (
              <div className="mb-3">
                <button
                  onClick={() => setShowCreatePlaylist(true)}
                  className="w-full py-3 px-2 rounded-xl flex items-center justify-center
                           text-slate-800 hover:bg-slate-100 hover:scale-105 
                           transition-all duration-300"
                  title="创建新歌单"
                >
                  <span className="text-lg font-bold">+</span>
                </button>
              </div>
            )}
          </div>

          {/* 歌单列表 */}
          <div>
            <div className="space-y-1.5">
              {playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  className={`group relative transition-all duration-700 cursor-pointer rounded-xl py-3 flex items-center
                            ${isCollapsed ? 'px-2 justify-center' : 'px-4'}`}
                  style={{
                    transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }}
                  onClick={() => console.log('打开歌单:', playlist.name)}
                >
                  {/* 歌单图标 */}
                  <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${playlist.color} 
                                flex items-center justify-center text-white text-xs 
                                shadow-sm flex-shrink-0 transition-all duration-700`}
                       style={{
                         transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                       }}>
                    {playlist.icon}
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
                    className={`overflow-hidden transition-all duration-700 ${
                      isCollapsed 
                        ? 'max-w-0 opacity-0 ml-0' 
                        : 'max-w-[200px] opacity-100 ml-3 flex-1'
                    }`}
                    style={{
                      transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}
                  >
                    <div className="min-w-0 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-medium text-slate-800 text-sm truncate leading-tight whitespace-nowrap">
                            {playlist.name}
                          </h4>
                          {playlist.isPrivate && (
                            <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 leading-tight whitespace-nowrap">
                          {playlist.trackCount} 首
                        </p>
                      </div>
                      
                      {/* 播放按钮 */}
                      <button 
                        className="w-6 h-6 rounded-md bg-white/80 hover:bg-white 
                                 flex items-center justify-center opacity-0 group-hover:opacity-100 
                                 transition-all duration-200 hover:scale-105 shadow-sm ml-2 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('播放歌单:', playlist.name);
                        }}
                      >
                        <svg className="w-3 h-3 text-slate-700 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
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
      <div className={`absolute bottom-4 transition-all duration-700 ${
        isCollapsed ? 'left-4' : 'left-6 right-6'
      }`}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        <div className={`flex items-center gap-2 p-2 rounded-full
                        glass-surface backdrop-blur-md border border-white/30 shadow-lg
                        transition-all duration-700 ${
                          isCollapsed ? 'w-12 justify-center' : 'w-auto justify-center'
                        }`}>
          
          {/* 收缩/展开按钮 */}
          <button
            onClick={toggleCollapse}
            className="w-8 h-8 rounded-full flex items-center justify-center
                     text-slate-600 hover:text-slate-800 hover:bg-white/50
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
                           ? 'text-brand-600 bg-brand-100'
                           : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
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
                         text-slate-600 hover:text-slate-800 hover:bg-white/50
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
                         text-slate-600 hover:text-slate-800 hover:bg-white/50
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

      {/* 创建歌单浮动弹窗 - 整个软件正中央 */}
      {showCreatePlaylist && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* 高斯模糊背景 */}
          <div 
            className="absolute inset-0 bg-black/40"
            style={{
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
            onClick={() => setShowCreatePlaylist(false)}
          />
          
          {/* 弹窗内容 */}
          <div className="relative w-full max-w-sm bg-white/95 backdrop-blur-xl rounded-2xl 
                         shadow-2xl border border-white/30 overflow-hidden
                         animate-in fade-in zoom-in duration-300">
            
            {/* 标题栏 */}
            <div className="flex items-center justify-between p-6 pb-4">
              <h3 className="text-lg font-semibold text-slate-900">创建新歌单</h3>
              <button
                onClick={() => setShowCreatePlaylist(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 
                         flex items-center justify-center transition-colors duration-200"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 pb-6 space-y-4">
              {/* 歌单名称 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">歌单名称</label>
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl
                           focus:ring-2 focus:ring-brand-500 focus:border-transparent
                           text-slate-900 placeholder-slate-400 transition-all duration-200"
                  placeholder="给你的歌单起个好听的名字..."
                  autoFocus
                />
              </div>

              {/* 简约图标选择 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">选择图标</label>
                <div className="grid grid-cols-6 gap-2">
                  {iconOptions.map((iconItem) => (
                    <button
                      key={iconItem.icon}
                      onClick={() => setNewPlaylistIcon(iconItem.icon)}
                      className={`aspect-square rounded-lg flex items-center justify-center text-lg font-medium
                                transition-all duration-200 hover:scale-105
                                ${newPlaylistIcon === iconItem.icon 
                                  ? 'bg-brand-500 text-white shadow-md scale-105' 
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                      title={iconItem.name}
                    >
                      {iconItem.icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* 简约颜色选择 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">选择主题色</label>
                <div className="grid grid-cols-4 gap-3">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewPlaylistColor(color)}
                      className={`aspect-square rounded-lg bg-gradient-to-br ${color} 
                                transition-all duration-200 hover:scale-105 shadow-sm
                                ${newPlaylistColor === color 
                                  ? 'ring-3 ring-white ring-offset-2 ring-offset-slate-200 scale-105' 
                                  : 'hover:shadow-md'
                                }`}
                    />
                  ))}
                </div>
              </div>

              {/* 私密设置 */}
              <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4">
                <div>
                  <div className="font-medium text-slate-900 text-sm">私密歌单</div>
                  <div className="text-xs text-slate-500">只有你可以看到</div>
                </div>
                <button
                  onClick={() => setNewPlaylistPrivate(!newPlaylistPrivate)}
                  className={`relative w-11 h-6 rounded-full transition-all duration-300
                            ${newPlaylistPrivate ? 'bg-brand-500' : 'bg-slate-300'}`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm 
                              transition-transform duration-300
                              ${newPlaylistPrivate ? 'left-5' : 'left-0.5'}`}
                  />
                </button>
              </div>

              {/* 预览 */}
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-3">预览效果</div>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${newPlaylistColor} 
                                flex items-center justify-center text-white text-xl shadow-sm`}>
                    {newPlaylistIcon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 text-sm truncate">
                        {newPlaylistName || '未命名歌单'}
                      </span>
                      {newPlaylistPrivate && (
                        <div className="w-3 h-3 rounded-full bg-slate-400 flex items-center justify-center">
                          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">0 首歌曲</span>
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreatePlaylist(false)}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 
                           rounded-xl font-medium transition-colors duration-200"
                >
                  取消
                </button>
                <button
                  onClick={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim()}
                  className="flex-1 py-3 px-4 bg-brand-500 hover:bg-brand-600 text-white 
                           rounded-xl font-medium transition-all duration-200 
                           disabled:opacity-50 disabled:cursor-not-allowed
                           disabled:hover:bg-brand-500"
                >
                  创建歌单
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
