import React, { useState, useEffect } from 'react';
import type { Track } from '../../types/music';

interface AlbumCoverRotatingProps {
  albumCoverUrl: string | null;
  isPlaying: boolean;
  track: Track | null;
  currentPositionMs: number;
}

/**
 * 旋转专辑封面组件
 * 
 * 功能：
 * - 显示圆形专辑封面，播放时缓慢旋转（模拟黑胶唱片）
 * - 显示歌曲信息（歌名、艺术家、专辑）
 * - 显示播放进度条和时间
 * 
 * 设计要点：
 * - 正圆形封面
 * - 播放时顺时针旋转（8秒一圈，极缓慢）
 * - 暂停时停止旋转但保持当前角度
 */
const AlbumCoverRotating: React.FC<AlbumCoverRotatingProps> = ({
  albumCoverUrl,
  isPlaying,
  track,
  currentPositionMs,
}) => {
  const [rotation, setRotation] = useState(0);

  // 旋转动画
  useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId: number;
    let lastTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const delta = now - lastTime;
      lastTime = now;

      // 每8秒旋转360度，即每毫秒旋转 360/8000 = 0.045度
      setRotation(prev => (prev + delta * 0.045) % 360);

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  // 格式化时间
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const currentTime = formatTime(currentPositionMs);
  const totalTime = formatTime(track?.duration_ms || 0);
  const progress = track?.duration_ms ? (currentPositionMs / track.duration_ms) * 100 : 0;

  return (
    <div className="flex flex-col items-center w-full max-w-md">
      {/* 圆形专辑封面 */}
      <div className="relative mb-8">
        {/* 外圈装饰 - 黑胶唱片边缘效果 */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent" style={{ width: '420px', height: '420px', transform: 'translate(-10px, -10px)' }}></div>
        
        {/* 专辑封面主体 */}
        <div
          className="relative rounded-full overflow-hidden shadow-2xl"
          style={{
            width: '400px',
            height: '400px',
            transform: `rotate(${rotation}deg)`,
            transition: isPlaying ? 'none' : 'transform 0.3s ease-out',
          }}
        >
          {albumCoverUrl ? (
            <img
              src={albumCoverUrl}
              alt="Album Cover"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
              <svg className="w-32 h-32 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
          )}
          
          {/* 中心圆点 - 黑胶唱片中心 */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm border-2 border-white/20"></div>
        </div>
      </div>

      {/* 歌曲信息 */}
      <div className="text-center mb-6 w-full">
        <h2 className="text-3xl font-bold text-white mb-2 truncate px-4">
          {track?.title || '未知歌曲'}
        </h2>
        <p className="text-xl text-white/80 mb-1 truncate px-4">
          {track?.artist || '未知艺术家'}
        </p>
        {track?.album && (
          <p className="text-sm text-white/60 truncate px-4">
            {track.album}
          </p>
        )}
      </div>

      {/* 播放进度条 */}
      <div className="w-full px-4">
        {/* 时间显示 */}
        <div className="flex justify-between text-sm text-white/70 mb-2">
          <span>{currentTime}</span>
          <span>{totalTime}</span>
        </div>

        {/* 进度条 */}
        <div className="relative h-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-white/80 to-white/60 rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          >
            {/* 进度条末端的光点 */}
            <div className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg shadow-white/50"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(AlbumCoverRotating);

