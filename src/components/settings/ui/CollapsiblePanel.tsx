/**
 * 可折叠面板组件
 * 用于复杂设置项的展开/收起
 */

import { useState, useRef, useEffect } from 'react';

interface CollapsiblePanelProps {
  title: string;
  description?: string;
  badge?: { text: string; variant: 'info' | 'warning' | 'success' };
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

const BADGE_STYLES = {
  info: 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300',
  warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-300',
  success: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300',
};

export function CollapsiblePanel({
  title,
  description,
  badge,
  children,
  defaultExpanded = false
}: CollapsiblePanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [children]);

  return (
    <div className="bg-white dark:bg-dark-100 rounded-lg border border-slate-200 dark:border-dark-400 overflow-hidden">
      {/* 标题按钮 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-dark-200/50 transition-colors group"
      >
        <div className="text-left flex-1">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-slate-900 dark:text-dark-900">
              {title}
            </div>
            {badge && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_STYLES[badge.variant]}`}>
                {badge.text}
              </span>
            )}
          </div>
          {description && (
            <div className="text-sm text-slate-600 dark:text-dark-700 mt-1">
              {description}
            </div>
          )}
        </div>
        
        {/* 展开/收起图标 */}
        <svg
          className={`w-5 h-5 text-slate-400 dark:text-dark-700 transition-transform duration-300 ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 内容区 */}
      <div
        style={{
          maxHeight: expanded ? `${contentHeight}px` : '0px',
          transition: 'max-height 0.3s ease-in-out, opacity 0.3s ease-in-out'
        }}
        className={`overflow-hidden ${expanded ? 'opacity-100' : 'opacity-0'}`}
      >
        <div 
          ref={contentRef}
          className="p-4 pt-0 border-t border-slate-100 dark:border-dark-300"
        >
          {children}
        </div>
      </div>
    </div>
  );
}








