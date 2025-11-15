import React, { useEffect, useRef, useState } from 'react';

interface FBMWaveBackgroundProps {
  albumCoverUrl: string | null;
  playing?: boolean;
}

/**
 * Apple Music风格的动态流动背景效果
 * 
 * 基于FBM (Fractional Brownian Motion) 波浪算法
 * 特性：
 * - 从专辑封面提取主色调
 * - 动态流动的波浪效果
 * - 平滑的颜色过渡
 * - 随播放状态变化的动画速度
 */
const FBMWaveBackground: React.FC<FBMWaveBackgroundProps> = ({
  albumCoverUrl,
  playing = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dominantColors, setDominantColors] = useState<string[]>([
    '#1a1a2e',
    '#16213e',
    '#0f3460',
  ]);
  const animationRef = useRef<number | null>(null);
  const timeRef = useRef(0);

  // 从专辑封面提取主色调
  useEffect(() => {
    if (!albumCoverUrl) {
      setDominantColors(['#1a1a2e', '#16213e', '#0f3460']);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = albumCoverUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 缩小图片以提高性能
        canvas.width = 50;
        canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);

        const imageData = ctx.getImageData(0, 0, 50, 50);
        const data = imageData.data;
        
        // 收集颜色样本
        const colorMap: { [key: string]: number } = {};
        for (let i = 0; i < data.length; i += 4) {
          const r = Math.floor(data[i] / 32) * 32;
          const g = Math.floor(data[i + 1] / 32) * 32;
          const b = Math.floor(data[i + 2] / 32) * 32;
          const key = `${r},${g},${b}`;
          colorMap[key] = (colorMap[key] || 0) + 1;
        }

        // 找出最常见的颜色 - 轻微增强，保持原色
        const sortedColors = Object.entries(colorMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([key]) => {
            const [r, g, b] = key.split(',').map(Number);
            
            // 中和版本：轻微提亮 + 适度增强饱和度
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const l = (max + min) / 2 / 255;
            const delta = max - min;
            
            let h = 0, s = 0;
            if (delta !== 0) {
              s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
              
              if (max === r) {
                h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
              } else if (max === g) {
                h = ((b - r) / delta + 2) / 6;
              } else {
                h = ((r - g) / delta + 4) / 6;
              }
            }
            
            // 适度增强饱和度和亮度
            s = Math.min(1, s * 1.15); // 饱和度提升 15%（中和值）
            const brightenedL = Math.min(0.65, l * 1.15); // 亮度提升 15%（中和值）
            
            const hslToRgb = (h: number, s: number, l: number) => {
              const hue2rgb = (p: number, q: number, t: number) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
              };
              
              if (s === 0) {
                const gray = Math.round(l * 255);
                return [gray, gray, gray];
              }
              
              const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
              const p = 2 * l - q;
              
              return [
                Math.round(hue2rgb(p, q, h + 1/3) * 255),
                Math.round(hue2rgb(p, q, h) * 255),
                Math.round(hue2rgb(p, q, h - 1/3) * 255)
              ];
            };
            
            const [enhancedR, enhancedG, enhancedB] = hslToRgb(h, s, brightenedL);
            return `rgb(${enhancedR}, ${enhancedG}, ${enhancedB})`;
          });

        setDominantColors(sortedColors.length > 0 ? sortedColors : ['#1a1a2e', '#16213e', '#0f3460']);
      } catch (error) {
        console.warn('提取封面颜色失败:', error);
        setDominantColors(['#1a1a2e', '#16213e', '#0f3460']);
      }
    };

    img.onerror = () => {
      setDominantColors(['#1a1a2e', '#16213e', '#0f3460']);
    };
  }, [albumCoverUrl]);

  // FBM波浪动画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // FBM噪声函数 (简化版)
    const noise = (x: number, y: number, t: number): number => {
      return Math.sin(x * 0.01 + t) * Math.cos(y * 0.01 + t * 0.5) * 0.5 + 0.5;
    };

    // 分形布朗运动
    const fbm = (x: number, y: number, t: number, octaves: number = 4): number => {
      let value = 0;
      let amplitude = 1;
      let frequency = 1;

      for (let i = 0; i < octaves; i++) {
        value += amplitude * noise(x * frequency, y * frequency, t * frequency);
        amplitude *= 0.5;
        frequency *= 2;
      }

      return value;
    };

    const animate = () => {
      const width = canvas.width;
      const height = canvas.height;

      // 清空画布
      ctx.clearRect(0, 0, width, height);

      // 时间增量（播放时速度更快）
      const timeSpeed = playing ? 0.0008 : 0.0003;
      timeRef.current += timeSpeed;
      const t = timeRef.current;

      // 创建渐变背景
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      
      // 使用提取的主色调
      dominantColors.forEach((color, index) => {
        const stop = index / (dominantColors.length - 1);
        gradient.addColorStop(stop, color);
      });

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // 绘制多层波浪 - 中和效果
      const layers = 5;
      for (let layer = 0; layer < layers; layer++) {
        const layerOpacity = 0.18 - layer * 0.025; // 中和的波浪不透明度
        const layerOffset = layer * 0.3;

        ctx.beginPath();
        
        // 波浪路径
        for (let x = 0; x <= width; x += 10) {
          const fbmValue = fbm(x + layerOffset * 100, layer * 50, t + layerOffset, 5);
          const y = height * 0.5 + Math.sin(x * 0.005 + t + layer) * 100 * fbmValue;
          
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        // 完成路径
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();

        // 填充波浪
        const waveGradient = ctx.createLinearGradient(0, 0, 0, height);
        waveGradient.addColorStop(0, `rgba(255, 255, 255, ${layerOpacity})`);
        waveGradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
        
        ctx.fillStyle = waveGradient;
        ctx.fill();
      }

      // 添加动态光斑 - 中和的光斑效果
      const spotlights = 3;
      for (let i = 0; i < spotlights; i++) {
        const spotX = width * (0.3 + Math.sin(t * 0.5 + i * 2) * 0.2);
        const spotY = height * (0.3 + Math.cos(t * 0.7 + i * 2) * 0.2);
        const spotRadius = 225 + Math.sin(t + i) * 60; // 中和值

        const spotGradient = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, spotRadius);
        spotGradient.addColorStop(0, `rgba(255, 255, 255, ${0.13 + Math.sin(t + i) * 0.06})`); // 中和的光斑强度
        spotGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = spotGradient;
        ctx.fillRect(0, 0, width, height);
      }

      // 添加粒子效果 - 中和的粒子
      const particleCount = 32; // 中和值
      for (let i = 0; i < particleCount; i++) {
        const particleX = (width * (i / particleCount) + t * 20 * (i % 3 + 1)) % width;
        const particleY = height * (0.5 + Math.sin(t * 2 + i) * 0.3);
        const particleSize = 1.2 + Math.sin(t * 3 + i) * 1.1; // 中和值
        const particleOpacity = 0.3 + Math.sin(t * 2 + i) * 0.15; // 中和值，有动态变化

        ctx.fillStyle = `rgba(255, 255, 255, ${particleOpacity})`;
        ctx.beginPath();
        ctx.arc(particleX, particleY, particleSize, 0, Math.PI * 2);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dominantColors, playing]);

  return (
    <>
      {/* Canvas波浪背景 */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0"
        style={{
          width: '100%',
          height: '100%',
        }}
      />

      {/* 中和叠加层 - 中心亮，边缘暗 */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: 'radial-gradient(circle at center, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.55) 100%)',
        }}
      />

      {/* 轻度玻璃拟态层 */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backdropFilter: 'blur(1.5px)',
          backgroundColor: 'rgba(0, 0, 0, 0.06)',
        }}
      />
    </>
  );
};

export default React.memo(FBMWaveBackground);
