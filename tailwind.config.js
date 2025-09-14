/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // 启用 class 驱动的深色模式
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#7C5CFF',
          50: '#F8F6FF',
          100: '#F0ECFF',
          500: '#7C5CFF',
          600: '#6B4FE6',
          700: '#5B42CC',
        },
        'bg-light': '#F7F9FC',
        card: '#FFFFFF',
        muted: '#6B7280',
        // 高对比度颜色系统
        'text-primary': '#0F172A',
        'text-secondary': '#334155',
        'text-muted': '#64748B',
        'text-disabled': '#94A3B8',
        'surface-primary': '#FFFFFF',
        'surface-secondary': '#F8FAFC',
        'surface-tertiary': '#F1F5F9',
        'border-primary': '#CBD5E1',
        'border-secondary': '#E2E8F0',
        'border-focus': '#2563EB',
        // 深色模式专用色彩
        dark: {
          50: '#0B1220',   // 深蓝黑 - 主要表面
          100: '#0F172A',  // 深灰蓝 - 次要表面  
          200: '#111827',  // 暖深灰 - 三级表面
          300: '#1E293B',  // 中性深灰
          400: '#334155',  // 浅深灰
          500: '#475569',  // 中等灰
          600: '#64748B',  // 禁用文字
          700: '#94A3B8',  // 辅助文字
          800: '#C7D2FE',  // 次要文字
          900: '#E5EAF3',  // 主要文字
        },
        // 深色玻璃效果色彩
        'glass-dark': {
          bg: 'rgba(15, 23, 42, 0.25)',
          'bg-strong': 'rgba(15, 23, 42, 0.4)',
          'bg-overlay': 'rgba(15, 23, 42, 0.6)',
          border: 'rgba(255, 255, 255, 0.08)',
          'border-outer': 'rgba(99, 102, 241, 0.3)',
        },
      },
      fontFamily: {
        'primary': ['Segoe UI Variable', 'Microsoft YaHei UI', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        'mono': ['Cascadia Code', 'Consolas', 'Courier New', 'monospace'],
      },
      fontSize: {
        'xs': ['0.8125rem', { lineHeight: '1.25' }],     // 13px
        'sm': ['0.875rem', { lineHeight: '1.5' }],       // 14px  
        'base': ['0.9375rem', { lineHeight: '1.5' }],    // 15px - 提升基础字号
        'lg': ['1rem', { lineHeight: '1.5' }],           // 16px
        'xl': ['1.125rem', { lineHeight: '1.625' }],     // 18px
        '2xl': ['1.25rem', { lineHeight: '1.75' }],      // 20px
      },
      lineHeight: {
        'tight': '1.25',
        'normal': '1.5', 
        'relaxed': '1.625',
        'loose': '1.75',
      },
      backdropBlur: {
        'glass': '8px',
        'none': '0px',
      },
      boxShadow: {
        'subtle': '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08)',
        'moderate': '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
        'prominent': '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
