/**
 * 设置区块容器组件
 * 统一的卡片样式，简化代码
 */

import React from 'react';

interface Badge {
  text: string;
  variant: 'info' | 'warning' | 'success' | 'neutral';
}

interface SettingSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: Badge;
  children: React.ReactNode;
  className?: string;
  sectionId?: string;        // 用于搜索高亮定位
  isHighlighted?: boolean;   // 是否高亮显示
}

const BADGE_STYLES = {
  info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  success: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  neutral: 'bg-slate-100 dark:bg-dark-300 text-slate-700 dark:text-dark-700 border-slate-200 dark:border-dark-400',
};

export function SettingSection({ 
  title, 
  description, 
  icon, 
  badge, 
  children,
  className = '',
  sectionId,
  isHighlighted = false
}: SettingSectionProps) {
  return (
    <div 
      id={sectionId}
      className={`
        bg-white dark:bg-dark-200 rounded-xl border overflow-hidden
        transition-all duration-500
        ${isHighlighted
          ? 'border-amber-400 dark:border-amber-500 shadow-lg shadow-amber-200 dark:shadow-amber-900/30 ring-2 ring-amber-200 dark:ring-amber-500/30'
          : 'border-slate-200 dark:border-dark-400'
        }
        ${className}
      `}
    >
      {/* 标题栏 */}
      <div className={`
        px-6 py-4 border-b transition-colors duration-500
        ${isHighlighted
          ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-900/10'
          : 'border-slate-100 dark:border-dark-300'
        }
      `}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            {icon && (
              <div className={`
                w-6 h-6 flex-shrink-0 mt-0.5 transition-colors duration-500
                ${isHighlighted
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-brand-600 dark:text-brand-400'
                }
              `}>
                {icon}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className={`
                  text-lg font-semibold transition-colors duration-500
                  ${isHighlighted
                    ? 'text-amber-900 dark:text-amber-100'
                    : 'text-slate-900 dark:text-dark-900'
                  }
                `}>
                  {title}
                </h3>
                {isHighlighted && (
                  <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 
                                 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full animate-pulse">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    已找到
                  </span>
                )}
              </div>
              {description && (
                <p className={`
                  text-sm mt-1 transition-colors duration-500
                  ${isHighlighted
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-slate-600 dark:text-dark-700'
                  }
                `}>
                  {description}
                </p>
              )}
            </div>
          </div>
          
          {badge && (
            <span className={`
              px-2.5 py-1 rounded-md text-xs font-medium border
              ${BADGE_STYLES[badge.variant]}
            `}>
              {badge.text}
            </span>
          )}
        </div>
      </div>
      
      {/* 内容区 */}
      <div className="px-6 py-5">
        {children}
      </div>
    </div>
  );
}








