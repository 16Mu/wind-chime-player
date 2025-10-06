import { useTheme } from '../../contexts/ThemeContext';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
}

export default function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = '搜索音乐、艺术家或专辑...'
}: SearchBarProps) {
  const { isDarkMode } = useTheme();

  return (
    <div 
      className="relative w-56 focus-within:w-full"
      data-tauri-drag-region="false"
      style={{
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`
          w-full px-4 py-2 pr-10 rounded-lg
          text-sm
          outline-none
          ${isDarkMode()
            ? 'bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:bg-white/10 focus:border-white/20 hover:bg-white/8'
            : 'bg-white border border-black/10 text-black placeholder-gray-400 focus:border-[#007AFF] hover:border-black/15 shadow-sm'
          }
        `}
        style={{
          transition: 'background-color 0.2s, border-color 0.2s'
        }}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        {value ? (
          <button
            onClick={onClear}
            className={`
              w-5 h-5 flex items-center justify-center
              transition-colors duration-200
              ${isDarkMode()
                ? 'text-gray-400 hover:text-white'
                : 'text-[#86868B] hover:text-black'
              }
            `}
            aria-label="清除搜索"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <svg 
            className={`w-4 h-4 pointer-events-none ${isDarkMode() ? 'text-gray-500' : 'text-[#86868B]'}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </div>
    </div>
  );
}
