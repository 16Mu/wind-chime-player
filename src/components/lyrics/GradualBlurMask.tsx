import React from 'react';

interface GradualBlurMaskProps {
  /**
   * 遮罩方向
   */
  direction: 'top' | 'bottom';
  
  /**
   * 遮罩高度（vh单位）
   * @default 25
   */
  height?: number;
  
  /**
   * 最大模糊强度（px）
   * @default 20
   */
  maxBlur?: number;
}

/**
 * 渐变模糊遮罩组件 - 高性能版本
 * 
 * 优化策略：
 * 1. 使用单层元素 + 暗色渐变遮罩，模拟模糊效果
 * 2. 避免使用多层 backdrop-filter（性能杀手）
 * 3. 使用 transform: translateZ(0) 启用硬件加速
 * 4. 使用 will-change 提示浏览器优化
 * 
 * 性能对比：
 * - 之前：10层 backdrop-filter = 严重性能损耗
 * - 现在：1层渐变遮罩 = 极低性能开销
 */
const GradualBlurMask: React.FC<GradualBlurMaskProps> = ({ 
  direction, 
  height = 25,
  maxBlur = 20
}) => {
  const gradientDirection = direction === 'top' ? 'to bottom' : 'to top';
  
  return (
    <div 
      className={`absolute ${direction}-0 left-0 right-0 pointer-events-none z-10`}
      style={{
        height: `${height}vh`,
        background: `linear-gradient(${gradientDirection}, rgba(0, 0, 0, 0.4) 0%, transparent 100%)`,
        // 使用单层轻量级模糊
        backdropFilter: `blur(${maxBlur}px)`,
        WebkitBackdropFilter: `blur(${maxBlur}px)`,
        // 使用 mask 控制渐变强度
        maskImage: `linear-gradient(${gradientDirection}, rgba(0, 0, 0, 0.8) 0%, transparent 100%)`,
        WebkitMaskImage: `linear-gradient(${gradientDirection}, rgba(0, 0, 0, 0.8) 0%, transparent 100%)`,
        // 硬件加速
        transform: 'translateZ(0)',
        willChange: 'opacity'
      }}
    />
  );
};

export default React.memo(GradualBlurMask);

