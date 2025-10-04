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
    ({ text, index, isCurrent, currentLineIndex, fontSize, onLineClick }, ref) => {
      const distance = currentLineIndex !== null ? Math.abs(index - currentLineIndex) : 10;
      
      // ✅ 最佳方案：固定容器 + 限制文本宽度 + scale() 缩放
      // 核心原理：
      // 1. 容器宽度固定（100%）
      // 2. 文本宽度限制（80%）
      // 3. 缩放时：80% × 1.2 = 96% < 100%，始终有余量
      // 效果：无论如何缩放，文本都不会触发换行，避免跳动
      
      // 根据距离计算透明度和亮度，确保离当前行越近越亮
      const opacity = isCurrent 
        ? 1.0  // 当前行：完全不透明，最亮
        : distance === 1 
          ? 0.8  // 相邻行（上一行或下一行）：较亮
          : distance === 2 
            ? 0.7  // 再远一行：中等亮度
            : distance <= 5 
              ? Math.max(0.45, 0.75 - distance * 0.06)  // 远处行：逐渐变暗但保持可读
              : Math.max(0.4, 0.8 - distance * 0.04);  // 很远的行：保持基本可读性
      
      // ✅ 使用 scale() 进行缩放（不触发重排）
      const scale = isCurrent 
        ? 1.2        // 当前行：放大20%
        : distance === 1
          ? 1.08     // 相邻行：放大8%
          : 1;       // 其他行：正常大小

      return (
        <div 
          ref={ref}
          className="cursor-pointer relative px-4"
          style={{
            // ✅ 自适应高度，允许长文本换行
            minHeight: `${fontSize * 1.6}px`,
            height: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: opacity,
            // ✅ 外层容器的模糊和亮度效果，渐进式变化
            filter: isCurrent 
              ? 'none' 
              : distance === 1 
                ? 'blur(0.1px) brightness(0.95)'
                : distance === 2
                  ? 'blur(0.2px) brightness(0.92)'
                  : `blur(${Math.min(distance * 0.12, 0.4)}px) brightness(0.90)`,
            // ✅ 使用更长的过渡时间和丝滑的缓动曲线
            transition: isCurrent || distance === 1
              ? `opacity 1.2s cubic-bezier(0.25, 0.1, 0.25, 1), filter 1.2s cubic-bezier(0.25, 0.1, 0.25, 1)`
              : `opacity 0.9s cubic-bezier(0.33, 0, 0.67, 1), filter 0.9s cubic-bezier(0.33, 0, 0.67, 1)`,
            // 🔍 调试：当前行添加背景色便于识别
            ...(isCurrent && (import.meta as any).env?.DEV ? {
              background: 'rgba(255, 0, 0, 0.1)',
              border: '1px solid rgba(255, 0, 0, 0.3)'
            } : {})
          }}
          onClick={onLineClick}
        >
          <p 
            className="relative z-10"
            style={{
              // ✅ 使用固定字体大小（不变）
              fontSize: `${fontSize}px`,
              // ✅ 固定宽度80%，确保缩放后不改变布局
              width: '80%',
              // ✅ 使用 transform: scale() 进行缩放（不触发重排）
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              color: isCurrent 
                ? 'rgba(255, 255, 255, 1.0)' 
                : distance === 1
                  ? 'rgba(255, 255, 255, 0.90)'
                  : distance === 2
                    ? 'rgba(255, 255, 255, 0.80)' 
                    : `rgba(255, 255, 255, ${Math.max(0.55, 0.85 - distance * 0.05)})`,
              // ✅ 发光效果：渐进式衰减，避免突然消失
              textShadow: isCurrent 
                ? `0 0 20px rgba(255, 255, 255, 0.7), 0 0 35px rgba(255, 255, 255, 0.5), 0 2px 12px rgba(255, 255, 255, 0.4)` 
                : distance === 1
                  ? '0 0 10px rgba(255, 255, 255, 0.35), 0 0 20px rgba(255, 255, 255, 0.2), 0 1px 6px rgba(255, 255, 255, 0.15)'
                  : distance === 2
                    ? '0 0 5px rgba(255, 255, 255, 0.2), 0 1px 3px rgba(255, 255, 255, 0.1)'
                    : distance === 3
                      ? '0 0 3px rgba(255, 255, 255, 0.12), 0 1px 2px rgba(255, 255, 255, 0.06)'
                      : '0 1px 2px rgba(255, 255, 255, 0.04)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              fontWeight: isCurrent ? 600 : distance === 1 ? 500 : 400,
              letterSpacing: isCurrent ? '0.02em' : distance === 1 ? '0.012em' : '0.005em',
              // ✅ 行内换行紧凑间距（1.3），使其明显小于歌词行之间的间距（1.2倍字体大小）
              lineHeight: '1.3',
              // ✅ 允许文本自动换行（在80%固定宽度内）
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              whiteSpace: 'normal',
              textAlign: 'center',
              // ✅ 使用丝滑的缓动曲线，让缩放更流畅自然
              transition: isCurrent || distance === 1
                ? 'transform 0.8s cubic-bezier(0.25, 0.1, 0.25, 1), color 0.6s cubic-bezier(0.25, 0.1, 0.25, 1), text-shadow 0.8s cubic-bezier(0.25, 0.1, 0.25, 1), font-weight 0.6s cubic-bezier(0.25, 0.1, 0.25, 1), letter-spacing 0.6s cubic-bezier(0.25, 0.1, 0.25, 1), filter 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)' 
                : 'transform 0.6s cubic-bezier(0.33, 0, 0.67, 1), color 0.5s ease-out, text-shadow 0.6s ease-out, font-weight 0.5s ease-out, letter-spacing 0.5s ease-out, filter 0.6s ease-out',
              // ✅ drop-shadow 渐进式衰减，避免突然消失
              filter: isCurrent 
                ? 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.3))' 
                : distance === 1
                  ? 'drop-shadow(0 0 5px rgba(255, 255, 255, 0.15))'
                  : distance === 2
                    ? 'drop-shadow(0 0 3px rgba(255, 255, 255, 0.08))'
                    : distance === 3
                      ? 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.04))'
                      : 'drop-shadow(0 0 1px rgba(255, 255, 255, 0.02))',
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

