/**
 * 设置搜索结果下拉组件
 */

import { SettingItem, getSettingBreadcrumb } from '../../utils/settingsSearch';

interface SearchResultsDropdownProps {
  results: SettingItem[];
  query: string;
  onSelect: (item: SettingItem) => void;
  onClose: () => void;
}

export function SearchResultsDropdown({ 
  results, 
  query, 
  onSelect,
  onClose 
}: SearchResultsDropdownProps) {
  if (results.length === 0) {
    return (
      <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-dark-200 
                    border border-slate-200 dark:border-dark-400 rounded-lg shadow-xl z-50
                    overflow-hidden">
        <div className="p-8 text-center">
          <svg className="w-16 h-16 mx-auto text-slate-300 dark:text-dark-600 mb-3" 
               fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-dark-800 mb-1">
            未找到匹配的设置项
          </h4>
          <p className="text-xs text-slate-500 dark:text-dark-600">
            试试其他关键词，例如"歌词"、"主题"、"音频"等
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-dark-200 
                  border border-slate-200 dark:border-dark-400 rounded-lg shadow-xl z-50
                  overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
      {/* 结果统计 */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-dark-300 border-b border-slate-200 dark:border-dark-400">
        <p className="text-xs text-slate-600 dark:text-dark-700">
          找到 <span className="font-semibold text-brand-600 dark:text-brand-400">{results.length}</span> 个相关设置项
        </p>
      </div>

      {/* 搜索结果列表 */}
      <div className="max-h-96 overflow-y-auto">
        {results.map((item, index) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-dark-300 
                     transition-colors duration-150 border-b border-slate-100 dark:border-dark-400 
                     last:border-b-0 group"
          >
            <div className="flex items-start gap-3">
              {/* 图标 */}
              <div className="mt-0.5 flex-shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-sky-500 
                              flex items-center justify-center text-white text-xs font-bold
                              group-hover:scale-110 transition-transform duration-200">
                  {index + 1}
                </div>
              </div>

              {/* 内容 */}
              <div className="flex-1 min-w-0">
                {/* 标题 */}
                <div className="font-medium text-sm text-slate-900 dark:text-dark-900 mb-0.5
                              group-hover:text-brand-600 dark:group-hover:text-brand-400
                              transition-colors duration-200">
                  <HighlightText text={item.title} query={query} />
                </div>

                {/* 描述 */}
                <div className="text-xs text-slate-600 dark:text-dark-700 mb-1 line-clamp-1">
                  <HighlightText text={item.description} query={query} />
                </div>

                {/* 面包屑路径 */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-dark-600">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M9 5l7 7-7 7" />
                  </svg>
                  <span>{getSettingBreadcrumb(item)}</span>
                </div>
              </div>

              {/* 右侧箭头 */}
              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 
                            transition-opacity duration-200">
                <svg className="w-5 h-5 text-brand-500 dark:text-brand-400" 
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* 底部提示 */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-dark-300 border-t border-slate-200 dark:border-dark-400">
        <p className="text-xs text-slate-500 dark:text-dark-600 flex items-center gap-2">
          <kbd className="px-1.5 py-0.5 bg-white dark:bg-dark-200 border border-slate-300 dark:border-dark-500 
                       rounded text-xs font-mono">ESC</kbd>
          关闭搜索
        </p>
      </div>
    </div>
  );
}

// 转义正则表达式特殊字符
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 高亮文本组件
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) {
    return <span>{text}</span>;
  }

  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  
  // 构建正则表达式，匹配所有搜索词
  const pattern = words.map(w => escapeRegExp(w)).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  
  // 分割文本
  const parts = text.split(regex);
  
  return (
    <span>
      {parts.map((part, i) => {
        // 检查是否匹配搜索词（不区分大小写）
        const isMatch = words.some(word => 
          part.toLowerCase() === word.toLowerCase()
        );
        
        if (isMatch) {
          return (
            <mark
              key={i}
              className="bg-amber-200 dark:bg-amber-500/30 text-amber-900 dark:text-amber-100 
                       px-0.5 rounded font-semibold"
            >
              {part}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

