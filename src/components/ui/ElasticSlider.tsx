import React, { useState, useRef, useCallback } from 'react';

interface ElasticSliderProps {
  value: number; // 0-100
  onChange: (value: number) => void;
  className?: string;
  showLabel?: boolean;
  icon?: React.ReactNode;
  variant?: 'light' | 'dark'; // 主题变体
}

export default function ElasticSlider({
  value,
  onChange,
  className = '',
  showLabel = false,
  icon,
  variant = 'dark',
}: ElasticSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const updateValue = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    onChange(Math.round(percentage));
  }, [onChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    updateValue(e.clientX);
    
    const handleMouseMove = (e: MouseEvent) => {
      updateValue(e.clientX);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      setHoverValue(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [updateValue]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setHoverValue(percentage);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) {
      setHoverValue(null);
    }
  }, [isDragging]);

  const displayValue = hoverValue !== null ? hoverValue : value;
  const scale = isDragging ? 1.08 : hoverValue !== null ? 1.04 : 1;

  // 根据主题变体设置样式
  const styles = variant === 'light' ? {
    iconColor: 'text-gray-600 hover:text-blue-600',
    trackBg: 'bg-gray-200',
    fillGradient: 'bg-gradient-to-r from-blue-500 to-indigo-500',
    handleBg: 'bg-blue-600',
    handleShadow: {
      idle: '0 2px 6px rgba(0, 0, 0, 0.15)',
      hover: '0 0 0 6px rgba(99, 102, 241, 0.1), 0 2px 8px rgba(0, 0, 0, 0.2)',
      active: '0 0 0 8px rgba(99, 102, 241, 0.15), 0 4px 12px rgba(0, 0, 0, 0.3)',
    },
    fillShadow: {
      idle: '0 0 10px rgba(99, 102, 241, 0.4)',
      active: '0 0 20px rgba(99, 102, 241, 0.6), 0 0 40px rgba(99, 102, 241, 0.3)',
    },
    labelBg: 'bg-gray-900/90',
  } : {
    iconColor: 'text-white/70 hover:text-white',
    trackBg: 'bg-white/10',
    fillGradient: 'bg-gradient-to-r from-blue-500 to-indigo-500',
    handleBg: 'bg-white',
    handleShadow: {
      idle: '0 2px 6px rgba(0, 0, 0, 0.2)',
      hover: '0 0 0 6px rgba(255, 255, 255, 0.1), 0 2px 8px rgba(0, 0, 0, 0.2)',
      active: '0 0 0 8px rgba(255, 255, 255, 0.15), 0 4px 12px rgba(0, 0, 0, 0.3)',
    },
    fillShadow: {
      idle: '0 0 10px rgba(99, 102, 241, 0.4)',
      active: '0 0 20px rgba(99, 102, 241, 0.6), 0 0 40px rgba(99, 102, 241, 0.3)',
    },
    labelBg: 'bg-black/80',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {icon && (
        <div className={`flex-shrink-0 transition-colors duration-200 ${styles.iconColor}`}>
          {icon}
        </div>
      )}
      
      <div className="flex-1 relative py-2">
        <div
          ref={sliderRef}
          className={`relative h-2 ${styles.trackBg} rounded-full cursor-pointer group`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: `scaleY(${scale})`,
            transformOrigin: 'center',
            transition: isDragging 
              ? 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)' 
              : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* 进度条填充 */}
          <div
            className={`absolute inset-y-0 left-0 ${styles.fillGradient} rounded-full transition-all duration-150 pointer-events-none`}
            style={{
              width: `${displayValue}%`,
              boxShadow: isDragging ? styles.fillShadow.active : styles.fillShadow.idle,
            }}
          />
          
          {/* 滑块手柄 */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 ${styles.handleBg} rounded-full shadow-lg pointer-events-none`}
            style={{
              left: `${displayValue}%`,
              transform: `translate(-50%, -50%) scale(${isDragging ? 1.3 : hoverValue !== null ? 1.15 : 1})`,
              transition: isDragging 
                ? 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)' 
                : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              boxShadow: isDragging
                ? styles.handleShadow.active
                : hoverValue !== null
                ? styles.handleShadow.hover
                : styles.handleShadow.idle,
            }}
          />

          {/* 悬停/拖拽时的值标签 */}
          {showLabel && (isDragging || hoverValue !== null) && (
            <div
              className={`absolute bottom-full mb-2 px-2 py-1 ${styles.labelBg} text-white text-xs rounded pointer-events-none`}
              style={{
                left: `${displayValue}%`,
                transform: 'translateX(-50%)',
                opacity: isDragging || hoverValue !== null ? 1 : 0,
                transition: 'opacity 0.2s ease-out',
              }}
            >
              {Math.round(displayValue)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




