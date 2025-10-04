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
  className = ''
}: SettingSectionProps) {
  return (
    <div className={`bg-white dark:bg-dark-200 rounded-xl border border-slate-200 dark:border-dark-400 overflow-hidden ${className}`}>
      {/* 标题栏 */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-dark-300">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            {icon && (
              <div className="w-6 h-6 text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5">
                {icon}
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-dark-900">
                {title}
              </h3>
              {description && (
                <p className="text-sm text-slate-600 dark:text-dark-700 mt-1">
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








