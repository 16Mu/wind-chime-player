/**
 * 进度条组件
 * 
 * 职责：
 * - 显示播放进度
 * - 拖拽跳转到指定位置
 * - 时间显示
 */

import { useState, useRef, memo, useCallback } from 'react';

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
  const progressBarRef = useRef<HTMLDivElement>(null);

  // 格式化时间
  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // 处理拖拽
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled || !progressBarRef.current) return;

    setIsDragging(true);
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setDragPosition(percent);
  }, [disabled]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !progressBarRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setDragPosition(percent);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);
    const targetMs = Math.floor(dragPosition * duration);
    onSeek(targetMs);
  }, [isDragging, dragPosition, duration, onSeek]);

  // 监听全局鼠标事件
  useState(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
    const handleGlobalMouseUp = () => handleMouseUp();

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  });

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
        className={`flex-1 h-1.5 bg-slate-200 dark:bg-dark-300 rounded-full overflow-hidden group ${
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        }`}
        onMouseDown={handleMouseDown}
      >
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-brand-600 relative transition-all group-hover:h-2"
          style={{ width: `${progress}%` }}
        >
          {/* 拖拽手柄 */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
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



