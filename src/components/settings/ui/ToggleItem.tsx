/**
 * 开关设置项组件
 * 统一的开关样式
 */

interface ToggleItemProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  badge?: string;
}

export function ToggleItem({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  badge
}: ToggleItemProps) {
  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <div className="flex-1 mr-4">
        <div className="flex items-center gap-2">
          <div className="font-medium text-slate-900 dark:text-dark-900">
            {label}
          </div>
          {badge && (
            <span className="px-2 py-0.5 text-xs rounded-md bg-slate-100 dark:bg-dark-300 text-slate-600 dark:text-dark-700">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <div className="text-sm text-slate-600 dark:text-dark-700 mt-1">
            {description}
          </div>
        )}
      </div>
      
      {/* Toggle Switch */}
      <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`
          relative w-12 h-6 rounded-full transition-all duration-300 
          focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${checked 
            ? 'bg-brand-600 dark:bg-brand-500 shadow-inner' 
            : 'bg-slate-300 dark:bg-dark-400 shadow-inner'
          }
        `}
      >
        <div
          className={`
            absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md 
            transition-transform duration-300 flex items-center justify-center
            ${checked ? 'transform translate-x-6' : ''}
          `}
        >
          {checked ? (
            <svg className="w-3 h-3 text-brand-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <div className="w-2 h-2 bg-slate-400 dark:bg-dark-500 rounded-full"></div>
          )}
        </div>
      </button>
    </div>
  );
}

