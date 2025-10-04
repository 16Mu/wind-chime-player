/**
 * 播放器控制按钮组件
 * 
 * 职责：
 * - 播放/暂停/上一曲/下一曲按钮
 * - 随机播放和循环模式切换
 * - 独立的UI逻辑，不涉及音频控制
 */

import { memo } from 'react';
import type { RepeatMode } from '../../types/music';

interface PlayerControlsProps {
  isPlaying: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onShuffleToggle: () => void;
  onRepeatToggle: () => void;
  disabled?: boolean;
}

const PlayerControls = memo(function PlayerControls({
  isPlaying,
  shuffle,
  repeatMode,
  onPlayPause,
  onPrevious,
  onNext,
  onShuffleToggle,
  onRepeatToggle,
  disabled = false
}: PlayerControlsProps) {
  
  // 获取循环模式图标
  const getRepeatIcon = () => {
    switch (repeatMode) {
      case 'One':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 17H7V14L3 18L7 22V19H19V13H17M7 7H17V10L21 6L17 2V5H5V11H7V7Z" />
            <text x="12" y="15" fontSize="8" textAnchor="middle" fill="currentColor" fontWeight="bold">1</text>
          </svg>
        );
      case 'All':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 17H7V14L3 18L7 22V19H19V13H17M7 7H17V10L21 6L17 2V5H5V11H7V7Z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
    }
  };

  return (
    <div className="flex items-center justify-center gap-4">
      {/* 随机播放 */}
      <button
        onClick={onShuffleToggle}
        disabled={disabled}
        className={`w-9 h-9 rounded-lg transition-all transform hover:scale-105 active:scale-95 disabled:opacity-30 ${
          shuffle
            ? 'bg-brand-600 text-white shadow-md'
            : 'text-slate-600 dark:text-dark-700 hover:bg-slate-100 dark:hover:bg-dark-200/50'
        }`}
        title={shuffle ? '关闭随机播放' : '开启随机播放'}
      >
        <svg className="w-4 h-4 mx-auto" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10.59,9.17L5.41,4L4,5.41l5.17,5.17l1.42-1.41M14.5,4l2.04,2.04L4,18.59L5.41,20L17.96,7.46L20,9.5V4M19,19h-2L5.41,7.41L4,8.83L15.17,20H17v2h2v-2h2v-2h-2v2Z" />
        </svg>
      </button>

      {/* 上一曲 */}
      <button
        onClick={onPrevious}
        disabled={disabled}
        className="w-10 h-10 rounded-full text-slate-600 dark:text-dark-700 hover:bg-slate-100 dark:hover:bg-dark-200/50 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-30"
        title="上一曲"
      >
        <svg className="w-5 h-5 mx-auto" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6,18V6H8V18H6M9.5,12L18,6V18L9.5,12Z" />
        </svg>
      </button>

      {/* 播放/暂停 */}
      <button
        onClick={onPlayPause}
        disabled={disabled}
        className="w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
        title={isPlaying ? '暂停' : '播放'}
      >
        {isPlaying ? (
          <svg className="w-6 h-6 mx-auto" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14,19H18V5H14M6,19H10V5H6V19Z" />
          </svg>
        ) : (
          <svg className="w-6 h-6 mx-auto ml-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8,5.14V19.14L19,12.14L8,5.14Z" />
          </svg>
        )}
      </button>

      {/* 下一曲 */}
      <button
        onClick={onNext}
        disabled={disabled}
        className="w-10 h-10 rounded-full text-slate-600 dark:text-dark-700 hover:bg-slate-100 dark:hover:bg-dark-200/50 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-30"
        title="下一曲"
      >
        <svg className="w-5 h-5 mx-auto" fill="currentColor" viewBox="0 0 24 24">
          <path d="M16,18H18V6H16M6,18L14.5,12L6,6V18Z" />
        </svg>
      </button>

      {/* 循环模式 */}
      <button
        onClick={onRepeatToggle}
        disabled={disabled}
        className={`w-9 h-9 rounded-lg transition-all transform hover:scale-105 active:scale-95 disabled:opacity-30 ${
          repeatMode !== 'Off'
            ? 'bg-brand-600 text-white shadow-md'
            : 'text-slate-600 dark:text-dark-700 hover:bg-slate-100 dark:hover:bg-dark-200/50'
        }`}
        title={
          repeatMode === 'One' ? '单曲循环' :
          repeatMode === 'All' ? '列表循环' :
          '循环关闭'
        }
      >
        {getRepeatIcon()}
      </button>
    </div>
  );
});

export default PlayerControls;



