/**
 * 音量控制组件
 * 
 * 职责：
 * - 音量调节
 * - 静音切换
 * - 音量滑块
 */

import { useState, useRef, memo, useCallback, useEffect } from 'react';

interface VolumeControlProps {
  volume: number; // 0-1
  isMuted: boolean;
  onChange: (volume: number) => void;
  onToggleMute: () => void;
  disabled?: boolean;
}

const VolumeControl = memo(function VolumeControl({
  volume,
  isMuted,
  onChange,
  onToggleMute,
  disabled = false
}: VolumeControlProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  // 获取音量图标
  const getVolumeIcon = useCallback(() => {
    if (isMuted || volume === 0) {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z" />
        </svg>
      );
    } else if (volume < 0.3) {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M5,9V15H9L14,20V4L9,9M18.5,12C18.5,10.23 17.5,8.71 16,7.97V16.02C17.5,15.29 18.5,13.76 18.5,12Z" />
        </svg>
      );
    } else if (volume < 0.7) {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M5,9V15H9L14,20V4L9,9M18.5,12C18.5,10.23 17.5,8.71 16,7.97V16.02C17.5,15.29 18.5,13.76 18.5,12Z" />
        </svg>
      );
    } else {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16.02C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z" />
        </svg>
      );
    }
  }, [volume, isMuted]);

  // 处理拖拽
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled || !sliderRef.current) return;

    setIsDragging(true);
    const rect = sliderRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onChange(percent);
  }, [disabled, onChange]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onChange(percent);
  }, [isDragging, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 监听全局鼠标事件
  useEffect(() => {
    if (!isDragging) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const displayVolume = isMuted ? 0 : volume;

  return (
    <div 
      className="flex items-center gap-2 group"
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => !isDragging && setShowSlider(false)}
    >
      {/* 音量按钮 */}
      <button
        onClick={onToggleMute}
        disabled={disabled}
        className="w-9 h-9 rounded-lg text-slate-600 dark:text-dark-700 hover:bg-slate-100 dark:hover:bg-dark-200/50 transition-all disabled:opacity-30"
        title={isMuted ? '取消静音' : '静音'}
      >
        {getVolumeIcon()}
      </button>

      {/* 音量滑块 */}
      <div
        className={`transition-all overflow-hidden ${
          showSlider ? 'w-24 opacity-100' : 'w-0 opacity-0'
        }`}
      >
        <div
          ref={sliderRef}
          className={`h-1.5 bg-slate-200 dark:bg-dark-300 rounded-full overflow-hidden ${
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          }`}
          onMouseDown={handleMouseDown}
        >
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-brand-600 relative"
            style={{ width: `${displayVolume * 100}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md" />
          </div>
        </div>
      </div>

      {/* 音量百分比 */}
      {showSlider && (
        <span className="text-xs font-medium text-slate-500 dark:text-dark-700 min-w-[32px] tabular-nums">
          {Math.round(displayVolume * 100)}%
        </span>
      )}
    </div>
  );
});

export default VolumeControl;



