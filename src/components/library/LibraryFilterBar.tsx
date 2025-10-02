import { useState } from 'react';

type ViewMode = 'tracks' | 'albums' | 'artists' | 'playlists';
type DisplayMode = 'list' | 'grid' | 'compact';
type SortOption = 'title' | 'artist' | 'album' | 'date_added' | 'duration';

interface FilterTag {
  id: string;
  label: string;
  active: boolean;
}

interface LibraryFilterBarProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  filterTags?: FilterTag[];
  onTagToggle?: (tagId: string) => void;
  onAddTag?: () => void;
}

export default function LibraryFilterBar({
  activeView,
  onViewChange,
  displayMode,
  onDisplayModeChange,
  sortBy,
  onSortChange,
  filterTags = [],
  onTagToggle,
  onAddTag
}: LibraryFilterBarProps) {
  
  const [showSortMenu, setShowSortMenu] = useState(false);

  const viewOptions: Array<{ value: ViewMode; label: string; icon: JSX.Element }> = [
    {
      value: 'tracks',
      label: '歌曲',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      )
    },
    {
      value: 'albums',
      label: '专辑',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      value: 'artists',
      label: '艺术家',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      value: 'playlists',
      label: '歌单',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    }
  ];

  const sortOptions: Array<{ value: SortOption; label: string }> = [
    { value: 'title', label: '按标题' },
    { value: 'artist', label: '按艺术家' },
    { value: 'album', label: '按专辑' },
    { value: 'date_added', label: '按添加时间' },
    { value: 'duration', label: '按时长' }
  ];

  return (
    <div className="library-filter-bar">
      {/* 左侧：视图切换 */}
      <div className="filter-section filter-views">
        <span className="filter-label">视图：</span>
        <div className="view-tabs">
          {viewOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onViewChange(option.value)}
              className={`view-tab ${activeView === option.value ? 'active' : ''}`}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 中部：标签过滤 */}
      <div className="filter-section filter-tags">
        <span className="filter-label">标签：</span>
        <div className="tag-list">
          {filterTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => onTagToggle?.(tag.id)}
              className={`filter-tag ${tag.active ? 'active' : ''}`}
            >
              {tag.active && '●'}
              {tag.label}
              {tag.active && (
                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          ))}
          {onAddTag && (
            <button onClick={onAddTag} className="filter-tag add-tag">
              + 更多
            </button>
          )}
        </div>
      </div>

      {/* 右侧：排序和视图模式 */}
      <div className="filter-section filter-controls">
        {/* 排序下拉 */}
        <div className="sort-dropdown">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="sort-button"
          >
            排序：{sortOptions.find(o => o.value === sortBy)?.label}
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showSortMenu && (
            <div className="sort-menu">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onSortChange(option.value);
                    setShowSortMenu(false);
                  }}
                  className={`sort-option ${sortBy === option.value ? 'active' : ''}`}
                >
                  {option.label}
                  {sortBy === option.value && (
                    <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 显示模式切换 */}
        <div className="display-mode-toggle">
          <button
            onClick={() => onDisplayModeChange('list')}
            className={`mode-button ${displayMode === 'list' ? 'active' : ''}`}
            title="列表视图"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => onDisplayModeChange('grid')}
            className={`mode-button ${displayMode === 'grid' ? 'active' : ''}`}
            title="网格视图"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
          </button>
          <button
            onClick={() => onDisplayModeChange('compact')}
            className={`mode-button ${displayMode === 'compact' ? 'active' : ''}`}
            title="紧凑视图"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}




