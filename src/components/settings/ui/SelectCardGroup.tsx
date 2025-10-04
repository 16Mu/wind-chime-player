/**
 * 选择卡片组组件
 * 用于多选一的场景（如主题选择）
 */

interface Option {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface SelectCardGroupProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  columns?: 2 | 3 | 4;
}

export function SelectCardGroup({
  options,
  value,
  onChange,
  columns = 3
}: SelectCardGroupProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4'
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-3`}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`
            flex flex-col items-center justify-center p-4 rounded-lg border-2 
            transition-all duration-200 text-center
            ${value === option.value
              ? 'border-brand-600 dark:border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-md scale-105'
              : 'border-slate-200 dark:border-dark-400 bg-white dark:bg-dark-100 hover:border-slate-300 dark:hover:border-dark-300 hover:scale-102'
            }
          `}
        >
          {option.icon && (
            <div className={`mb-2 ${value === option.value ? 'text-brand-600 dark:text-brand-400' : 'text-slate-600 dark:text-dark-700'}`}>
              {option.icon}
            </div>
          )}
          <div className={`font-medium text-sm ${value === option.value ? 'text-brand-700 dark:text-brand-300' : 'text-slate-900 dark:text-dark-900'}`}>
            {option.label}
          </div>
          {option.description && (
            <div className="text-xs text-slate-500 dark:text-dark-600 mt-1">
              {option.description}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}








