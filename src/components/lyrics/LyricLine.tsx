import React from 'react';

interface LyricLineProps {
  text: string;
  index: number;
  isCurrent: boolean;
  wasPrevious: boolean;
  currentLineIndex: number | null;
  fontSize: number;
  onLineClick: () => void;
}

/**
 * 单个歌词行组件
 * 
 * 使用 React.memo 优化，只在关键属性变化时重渲染
 */
const LyricLine = React.memo(
  React.forwardRef<HTMLDivElement, LyricLineProps>(
    ({ text, index, isCurrent, wasPrevious, currentLineIndex, fontSize, onLineClick }, ref) => {
      const distance = currentLineIndex !== null ? Math.abs(index - currentLineIndex) : 10;
      const isNear = distance <= 2;
      
      // 根据距离计算透明度和亮度，确保离当前行越近越亮
      // 提高远处歌词的可读性
      const opacity = isCurrent 
        ? 1.0  // 当前行：完全不透明，最亮
        : distance === 1 
          ? 0.8  // 相邻行（上一行或下一行）：较亮
          : distance === 2 
            ? 0.7  // 再远一行：中等亮度
            : distance <= 5 
              ? Math.max(0.45, 0.75 - distance * 0.06)  // 远处行：逐渐变暗但保持可读
              : Math.max(0.4, 0.8 - distance * 0.04);  // 很远的行：保持基本可读性
      
      const baseScale = isCurrent 
        ? 1.2  // fontSizes.current / fontSizes.normal
        : distance === 1
          ? 1.08  // 相邻行稍大一点
          : 1;

      return (
        <div 
          ref={ref}
          className="cursor-pointer relative px-4"
          style={{
            height: `${fontSize * 1.6}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: opacity,
            filter: isCurrent 
              ? 'none' 
              : distance === 1 
                ? 'blur(0.1px) brightness(0.95)'
                : distance === 2
                  ? 'blur(0.2px) brightness(0.92)'
                  : `blur(${Math.min(distance * 0.12, 0.4)}px) brightness(0.90)`,
            transition: isCurrent || distance === 1
              ? `opacity 1.0s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter 1.0s cubic-bezier(0.25, 0.46, 0.45, 0.94)`
              : `opacity 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
            // 🔍 调试：当前行添加背景色便于识别
            ...(isCurrent && (import.meta as any).env?.DEV ? {
              background: 'rgba(255, 0, 0, 0.1)',
              border: '1px solid rgba(255, 0, 0, 0.3)'
            } : {})
          }}
          onClick={onLineClick}
        >
          <p 
            className="relative z-10 leading-relaxed"
            style={{
              fontSize: `${fontSize}px`,
              color: isCurrent 
                ? 'rgba(255, 255, 255, 1.0)' 
                : distance === 1
                  ? 'rgba(255, 255, 255, 0.90)'
                  : distance === 2
                    ? 'rgba(255, 255, 255, 0.80)' 
                    : `rgba(255, 255, 255, ${Math.max(0.55, 0.85 - distance * 0.05)})`,
              // 发光效果：当前行最强，相邻行也有一定发光
              textShadow: isCurrent 
                ? `0 0 20px rgba(255, 255, 255, 0.7), 0 0 35px rgba(255, 255, 255, 0.5), 0 2px 12px rgba(255, 255, 255, 0.4)` 
                : distance === 1
                  ? '0 0 10px rgba(255, 255, 255, 0.35), 0 0 20px rgba(255, 255, 255, 0.2), 0 1px 6px rgba(255, 255, 255, 0.15)'
                  : distance === 2
                    ? '0 0 5px rgba(255, 255, 255, 0.2), 0 1px 3px rgba(255, 255, 255, 0.1)'
                    : '0 1px 2px rgba(255, 255, 255, 0.08)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              fontWeight: isCurrent ? 600 : distance === 1 ? 500 : 400,
              letterSpacing: isCurrent ? '0.02em' : distance === 1 ? '0.012em' : '0.005em',
              lineHeight: '1.6',
              transform: `scale(${Math.round(baseScale * 100) / 100})`,
              transformOrigin: 'center',
              transition: isCurrent || distance === 1
                ? 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), color 0.35s ease-out, text-shadow 0.5s ease-out, font-weight 0.25s ease-out, letter-spacing 0.35s ease-out, filter 0.4s ease-out' 
                : 'transform 0.35s ease-out, color 0.25s ease-out, text-shadow 0.35s ease-out, font-weight 0.2s ease-out, letter-spacing 0.25s ease-out, filter 0.3s ease-out',
              filter: isCurrent 
                ? 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.3))' 
                : distance === 1
                  ? 'drop-shadow(0 0 5px rgba(255, 255, 255, 0.15))'
                  : 'none',
            }}
          >
            {text || '♪'}
          </p>
        </div>
      );
    }
  ),
  // ✅ 自定义比较函数：仅在关键属性变化时重渲染
  (prevProps, nextProps) => {
    return (
      prevProps.text === nextProps.text &&
      prevProps.index === nextProps.index &&
      prevProps.isCurrent === nextProps.isCurrent &&
      prevProps.wasPrevious === nextProps.wasPrevious &&
      prevProps.currentLineIndex === nextProps.currentLineIndex &&
      prevProps.fontSize === nextProps.fontSize &&
      prevProps.onLineClick === nextProps.onLineClick
    );
  }
);

LyricLine.displayName = 'LyricLine';

export default LyricLine;

