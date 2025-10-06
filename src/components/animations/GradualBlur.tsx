/**
 * GradualBlur - 渐变模糊效果组件
 * 来源: ReactBits (https://reactbits.dev/default/Animations/GradualBlur)
 * 
 * 用于创建平滑的渐变模糊效果，常用于顶部或底部的过渡区域
 */

import React from 'react';

interface GradualBlurProps {
  /** 模糊方向 */
  direction?: 'top' | 'bottom' | 'left' | 'right';
  /** 模糊强度（像素） */
  strength?: number;
  /** 渐变高度（像素或百分比） */
  height?: string | number;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 起始颜色（RGBA） */
  fromColor?: string;
  /** 结束颜色（RGBA） */
  toColor?: string;
  /** z-index */
  zIndex?: number;
}

export const GradualBlur: React.FC<GradualBlurProps> = ({
  direction = 'bottom',
  strength = 12,
  height = '64px',
  className = '',
  style = {},
  fromColor = 'transparent',
  toColor = 'rgba(255, 255, 255, 0.6)',
  zIndex = 10,
}) => {
  // 根据方向确定渐变方向和定位
  const getGradientDirection = () => {
    switch (direction) {
      case 'top':
        return 'to bottom';
      case 'bottom':
        return 'to top';
      case 'left':
        return 'to right';
      case 'right':
        return 'to left';
      default:
        return 'to top';
    }
  };

  const getPositionStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      left: 0,
      right: 0,
    };

    switch (direction) {
      case 'top':
        return { ...base, top: 0, height };
      case 'bottom':
        return { ...base, bottom: 0, height };
      case 'left':
        return { ...base, left: 0, width: height, height: '100%', top: 0 };
      case 'right':
        return { ...base, right: 0, width: height, height: '100%', top: 0 };
      default:
        return { ...base, bottom: 0, height };
    }
  };

  const maskImage = `linear-gradient(${getGradientDirection()}, ${fromColor}, ${toColor})`;

  return (
    <div
      className={`gradual-blur pointer-events-none ${className}`}
      style={{
        ...getPositionStyle(),
        backdropFilter: `blur(${strength}px)`,
        WebkitBackdropFilter: `blur(${strength}px)`,
        maskImage,
        WebkitMaskImage: maskImage,
        zIndex,
        ...style,
      }}
    />
  );
};

// 导出默认配置的变体
export const TopBlur: React.FC<Omit<GradualBlurProps, 'direction'>> = (props) => (
  <GradualBlur direction="top" {...props} />
);

export const BottomBlur: React.FC<Omit<GradualBlurProps, 'direction'>> = (props) => (
  <GradualBlur direction="bottom" {...props} />
);

export const LeftBlur: React.FC<Omit<GradualBlurProps, 'direction'>> = (props) => (
  <GradualBlur direction="left" {...props} />
);

export const RightBlur: React.FC<Omit<GradualBlurProps, 'direction'>> = (props) => (
  <GradualBlur direction="right" {...props} />
);

export default GradualBlur;
