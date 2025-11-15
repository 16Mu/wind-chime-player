import React, { useState, useEffect } from 'react';

interface BlurredBackgroundLayerProps {
  albumCoverUrl: string | null;
}

/**
 * 模糊背景层组件
 * 
 * 功能：
 * - 提取专辑封面的主色调
 * - 应用高斯模糊效果
 * - 可选：添加动态光影效果
 * 
 * 设计要点：
 * - 使用专辑封面作为背景
 * - 深度模糊（backdrop-filter + blur）
 * - 玻璃拟态效果（glassmorphism）
 * - 微妙的渐变叠加
 */
const BlurredBackgroundLayer: React.FC<BlurredBackgroundLayerProps> = ({
  albumCoverUrl,
}) => {
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);

  useEffect(() => {
    if (albumCoverUrl) {
      setBackgroundImage(albumCoverUrl);
    } else {
      setBackgroundImage(null);
    }
  }, [albumCoverUrl]);

  return (
    <>
      {/* 主背景图层 - 专辑封面模糊 */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: backgroundImage ? undefined : '#1a1a2e',
          filter: 'blur(60px) brightness(0.7)',
          transform: 'scale(1.1)', // 放大一点避免边缘模糊后出现空白
        }}
      />

      {/* 渐变叠加层 - 增强深度感 */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 50%, rgba(0, 0, 0, 0.4) 100%)',
        }}
      />

      {/* 玻璃拟态层 - 提升质感 */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
        }}
      />

      {/* 动态光影效果（可选） - 随音乐律动 */}
      <div
        className="absolute inset-0 z-0 opacity-30"
        style={{
          background: 'radial-gradient(circle at 30% 50%, rgba(139, 92, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)',
          animation: 'pulse 8s ease-in-out infinite',
        }}
      />

      {/* CSS动画定义 */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.05);
          }
        }
      `}</style>
    </>
  );
};

export default React.memo(BlurredBackgroundLayer);

