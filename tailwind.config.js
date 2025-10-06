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
        // 主品牌色系统 - 优化后的蓝色体系
        brand: {
          400: '#7FB0FF',  // 浅品牌蓝
          500: '#4D86FF',  // 中等品牌蓝
          600: '#3A7AFE',  // 主品牌蓝 ⭐ 主要使用（Apple Music风格）
          700: '#1E56E0',  // 深品牌蓝
        },
        accent: {
          DEFAULT: '#7C5CFF',
          50: '#F8F6FF',
          100: '#F0ECFF',
          500: '#7C5CFF',
          600: '#6B4FE6',
          700: '#5B42CC',
        },
        'bg-light': '#FDFDFB',
        card: '#FDFDFB',
        muted: '#6B7280',
        // 🎨 优化后的颜色系统 - 层次分明
        'text-primary': '#1E293B',      // 主要文字 - 加深对比度
        'text-secondary': '#475569',    // 次要文字 - 高对比度
        'text-muted': '#64748B',        // 辅助文字 - 中等对比度
        'text-disabled': '#94A3B8',     // 禁用文字
        
        // 背景色系统 - 建立明确层次
        'surface-primary': '#FFFFFF',   // 主要表面 - 纯白
        'surface-secondary': '#F8FAFC', // 次要表面 - 极浅灰（页面背景）
        'surface-tertiary': '#F1F5F9',  // 三级表面 - 浅灰（侧边栏）
        'surface-elevated': '#FFFFFF',  // 提升表面（卡片）
        
        // 边框系统
        'border-primary': '#E2E8F0',    // 主要边框 - 更柔和
        'border-secondary': '#F1F5F9',  // 次要边框
        'border-focus': '#3A7AFE',      // 焦点边框
        
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
        // 深色模式卡片色彩
        'card-dark': {
          bg: '#0F172A',
          'bg-secondary': '#111827',
          border: 'rgba(148, 163, 184, 0.15)',
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
        // 优化后的阴影系统 - 更柔和的层次
        'card': '0 4px 12px rgba(0, 0, 0, 0.05)',              // 卡片默认阴影
        'card-hover': '0 8px 24px rgba(0, 0, 0, 0.08)',        // 卡片悬停
        'subtle': '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08)',
        'moderate': '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
        'prominent': '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
      },
      borderRadius: {
        'card': '16px',      // 统一的卡片圆角
        'button': '12px',    // 按钮圆角
      },
      spacing: {
        // 额外的间距选项
        '18': '4.5rem',   // 72px
        '88': '22rem',    // 352px
      },
      maxWidth: {
        'content': '2000px',  // 内容最大宽度
        'ultra': '2400px',    // 超宽屏最大宽度
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
