import { useEffect, useRef } from 'react';
interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
}

interface TracksViewProps {
  tracks: Track[];
  onTrackSelect: (track: Track) => void;
  isLoading: boolean;
  // 软膜联动设置（可选）
  membraneEnabled?: boolean; // 是否启用
  membraneIntensity?: number; // 强度系数（建议 0.5 - 1.5）
  membraneRadius?: number; // 影响范围系数（建议 0.6 - 1.6）
}

export default function TracksView({ tracks, onTrackSelect, isLoading, membraneEnabled = true, membraneIntensity = 1, membraneRadius = 1 }: TracksViewProps) {
  // 软膜联动动画：容器与行引用
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const rowCentersRef = useRef<number[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const mouseYRef = useRef<number | null>(null);

  // 计算行中心（容器坐标）
  const recomputeRowCenters = () => {
    const container = containerRef.current;
    if (!container) return;
    const crect = container.getBoundingClientRect();
    const centers: number[] = [];
    for (const row of rowRefs.current) {
      if (!row) { centers.push(0); continue; }
      const r = row.getBoundingClientRect();
      const center = (r.top - crect.top) + r.height / 2;
      centers.push(center);
    }
    rowCentersRef.current = centers;
  };

  // 动画主循环（直接使用鼠标位置作为焦点）
  const tick = () => {
    if (!membraneEnabled) {
      // 关闭时停止动画并清理
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }
    animFrameRef.current = requestAnimationFrame(tick);
    const container = containerRef.current;
    if (!container) return;
    const mouseY = mouseYRef.current;
    if (mouseY == null) return;

    // 根据距离应用高斯权重联动
    const centers = rowCentersRef.current;
    if (!centers.length) return;
    const sigma = 56 * Math.max(0.2, membraneRadius); // 影响范围（像素）
    const maxScale = 0.012 * Math.max(0, membraneIntensity); // 最大缩放系数
    const maxBright = 0.05 * Math.max(0, membraneIntensity); // 最大亮度增加
    const maxTranslate = 2 * Math.max(0, membraneIntensity); // 最大位移（px）

    for (let i = 0; i < rowRefs.current.length; i++) {
      const row = rowRefs.current[i];
      if (!row) continue;
      const d = centers[i] - mouseY; // 直接使用鼠标位置计算距离
      const w = Math.exp(- (d * d) / (2 * sigma * sigma)); // 高斯权重 0..1
      const scale = 1 + maxScale * w;
      const translateY = (d / sigma) * maxTranslate * w; // 与距离成比例的小形变
      const bright = 1 + maxBright * w;

      row.style.transform = `translateZ(0) translateY(${translateY.toFixed(2)}px) scale(${scale.toFixed(4)})`;
      row.style.filter = `brightness(${bright.toFixed(3)})`;
      row.style.transition = 'transform 80ms ease-out, filter 80ms ease-out';
      // 轻微背景叠加，保持主题
      (row.style as any).backgroundColor = `rgba(248, 250, 252, ${0.6 + 0.2 * w})`; // slate-50 基础上随权重微增
    }
  };

  // 事件：进入、移动、离开
  const handleMouseEnter = (e: React.MouseEvent) => {
    if (!membraneEnabled) return;
    const container = containerRef.current;
    if (!container) return;
    const crect = container.getBoundingClientRect();
    mouseYRef.current = e.clientY - crect.top;
    if (animFrameRef.current == null) {
      animFrameRef.current = requestAnimationFrame(tick);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!membraneEnabled) return;
    const container = containerRef.current;
    if (!container) return;
    const crect = container.getBoundingClientRect();
    mouseYRef.current = e.clientY - crect.top;
  };

  const handleMouseLeave = () => {
    // 释放到初始状态
    mouseYRef.current = null;
    // 渐隐回归
    for (const row of rowRefs.current) {
      if (!row) continue;
      row.style.transform = '';
      row.style.filter = '';
      row.style.transition = 'transform 180ms ease-out, filter 180ms ease-out, background-color 180ms ease-out';
      (row.style as any).backgroundColor = '';
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  // 当关闭联动时，清理样式
  useEffect(() => {
    if (membraneEnabled) return;
    
    // 立即停止动画
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    
    // 重置鼠标状态
    mouseYRef.current = null;
    
    // 清理所有行的样式
    for (const row of rowRefs.current) {
      if (!row) continue;
      row.style.transform = '';
      row.style.filter = '';
      row.style.backgroundColor = '';
      row.style.transition = 'transform 180ms ease-out, filter 180ms ease-out, background-color 180ms ease-out';
    }
  }, [membraneEnabled]);

  // 初始化与尺寸变化时重新计算行中心
  useEffect(() => {
    // 延迟到布局完成
    const id = requestAnimationFrame(() => {
      recomputeRowCenters();
    });
    const handleResize = () => recomputeRowCenters();
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', handleResize);
    };
  }, [tracks.length]);

  // 组件卸载时清理动画
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, []);
  const formatDuration = (ms?: number) => {
    if (!ms) return '--:--';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (isLoading && tracks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center glass-card max-w-md">
          <div className="text-slate-400 mb-6">
            <svg className="w-16 h-16 mx-auto animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-contrast-primary mb-3">
            正在加载曲目...
          </h3>
          <p className="text-contrast-secondary mb-6 text-base font-medium">
            请稍候，正在获取您的音乐数据
          </p>
        </div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center glass-card max-w-md">
          <div className="text-slate-400 mb-6">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-contrast-primary mb-3">
            暂无曲目
          </h3>
          <p className="text-contrast-secondary mb-6 text-base font-medium">
            点击上方的"选择文件夹扫描"按钮，添加音乐到您的库中
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseEnter={membraneEnabled ? handleMouseEnter : undefined}
      onMouseMove={membraneEnabled ? handleMouseMove : undefined}
      onMouseLeave={membraneEnabled ? handleMouseLeave : undefined}
      className="glass-surface rounded-xl overflow-hidden"
    >
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-white/40 backdrop-blur-md border-b border-white/30">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-contrast-primary tracking-wider hover:bg-slate-50/50 transition-colors cursor-pointer group">
              <span className="flex items-center gap-2 whitespace-nowrap">
                <svg className="w-3.5 h-3.5 text-slate-500 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span className="tracking-wide">标题</span>
                <svg className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-60 transition-opacity ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-contrast-primary tracking-wider hover:bg-slate-50/50 transition-colors cursor-pointer group w-2/5">
              <span className="flex items-center gap-2 whitespace-nowrap">
                <svg className="w-3.5 h-3.5 text-slate-500 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="tracking-wide">艺术家</span>
                <svg className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-60 transition-opacity ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-contrast-primary tracking-wider hover:bg-slate-50/50 transition-colors cursor-pointer group hidden md:table-cell">
              <span className="flex items-center gap-2 whitespace-nowrap">
                <svg className="w-3.5 h-3.5 text-slate-500 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="tracking-wide">专辑</span>
                <svg className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-60 transition-opacity ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-contrast-primary tracking-wider hover:bg-slate-50/50 transition-colors cursor-pointer group min-w-32">
              <span className="flex items-center justify-end gap-2 whitespace-nowrap">
                <svg className="w-3.5 h-3.5 text-slate-500 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="tracking-wide">时长</span>
                <svg className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-60 transition-opacity ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((track, index) => (
            <tr
              ref={(el) => { rowRefs.current[index] = el; }}
              key={track.id}
              className={`
                border-b border-white/30 glass-interactive
                bg-slate-50/60 backdrop-blur-md
                hover:bg-slate-100/40 hover:backdrop-blur-lg
                transition-all duration-200 ease-out
              `}
            >
              <td className="px-6 py-3">
                <div 
                  className="font-medium text-slate-900 cursor-pointer hover:text-brand-600 transition-colors duration-150 ease-out flex items-center gap-3 group text-sm leading-relaxed"
                  onClick={() => {
                    console.log('🎵 TracksView - 播放曲目:', track);
                    onTrackSelect(track);
                  }}
                >
                  <svg className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 group-hover:text-brand-600 transition-all duration-150 ease-out text-slate-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span className="truncate" title={track.title || '未知标题'}>{track.title || '未知标题'}</span>
                </div>
              </td>
              <td className="px-6 py-3 text-slate-800 font-medium text-sm leading-relaxed w-2/5">
                <span className="truncate block" title={track.artist || '未知艺术家'}>
                  {track.artist || '未知艺术家'}
                </span>
              </td>
              <td className="px-6 py-3 text-slate-700 font-medium text-sm leading-relaxed hidden md:table-cell">
                <span className="truncate block" title={track.album || '未知专辑'}>
                  {track.album || '未知专辑'}
                </span>
              </td>
              <td className="px-6 py-3 text-slate-700 font-mono text-sm leading-relaxed font-medium text-right min-w-32">
                {formatDuration(track.duration_ms)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
