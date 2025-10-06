/**
 * 进度条组件
 * 
 * 职责：
 * - 显示播放进度
 * - 拖拽跳转到指定位置
 * - 时间显示
 */

import { useState, useRef, useEffect, memo, useCallback } from 'react';

interface ProgressBarProps {
  position: number; // 当前位置（毫秒）
  duration: number; // 总时长（毫秒）
  onSeek: (positionMs: number) => void;
  disabled?: boolean;
}

const ProgressBar = memo(function ProgressBar({
  position,
  duration,
  onSeek,
  disabled = false
}: ProgressBarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);
  const dragPositionRef = useRef(0); // 用于保存最新的拖拽位置，避免闭包陷阱
  const progressBarRef = useRef<HTMLDivElement>(null);

  // 格式化时间
  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // 处理拖拽开始
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled || !progressBarRef.current) return;

    setIsDragging(true);
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newPosition = percent;
    setDragPosition(newPosition);
    dragPositionRef.current = newPosition; // 同步更新 ref
  }, [disabled]);

  // 监听全局鼠标事件
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!progressBarRef.current) return;

      const rect = progressBarRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newPosition = percent;
      setDragPosition(newPosition);
      dragPositionRef.current = newPosition; // 同步更新 ref
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // 使用 ref 获取最新的拖拽位置，避免闭包陷阱
      const finalPosition = dragPositionRef.current;
      const targetMs = Math.floor(finalPosition * duration);
      console.log('🎵 [ProgressBar] 拖拽结束，执行 seek:', targetMs);
      onSeek(targetMs);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, duration, onSeek]);

  const displayPosition = isDragging ? dragPosition * duration : position;
  const progress = duration > 0 ? (displayPosition / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      {/* 当前时间 */}
      <span className="text-xs font-medium text-slate-500 dark:text-dark-700 min-w-[40px] text-right tabular-nums">
        {formatTime(displayPosition)}
      </span>

      {/* 进度条 */}
      <div
        ref={progressBarRef}
        className={`flex-1 h-1.5 bg-slate-200 dark:bg-dark-300 rounded-full overflow-visible group ${
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        }`}
        onMouseDown={handleMouseDown}
      >
        <div
          className="h-full relative transition-all group-hover:h-2"
          style={{ 
            width: `${progress}%`,
            background: 'linear-gradient(90deg, var(--progress-color-from), var(--progress-color-to))',
            boxShadow: `
              0 0 0 1px rgba(255, 255, 255, 0.6),
              0 0 8px rgba(255, 255, 255, 0.3),
              0 0 12px var(--progress-glow),
              0 2px 4px var(--progress-shadow)
            `,
            borderRadius: '9999px'
          }}
        >
          {/* 拖拽手柄 - 始终轻微可见 */}
          <div 
            className="absolute right-0 top-1/2 w-[18px] h-[18px] bg-white rounded-full transition-all group-hover:opacity-100 group-hover:scale-100"
            style={{
              border: '2.5px solid var(--progress-color-from)',
              opacity: 0.6,
              transform: 'translateY(-50%) scale(0.75)',
              boxShadow: `
                0 2px 8px var(--progress-glow),
                0 4px 16px var(--progress-shadow),
                0 0 0 2px rgba(255, 255, 255, 0.2)
              `
            }}
          />
        </div>
      </div>

      {/* 总时长 */}
      <span className="text-xs font-medium text-slate-500 dark:text-dark-700 min-w-[40px] tabular-nums">
        {formatTime(duration)}
      </span>
    </div>
  );
});

export default ProgressBar;



