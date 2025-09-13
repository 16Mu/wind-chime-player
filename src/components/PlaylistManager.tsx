import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
}

interface PlayerState {
  is_playing: boolean;
  current_track?: Track;
  position_ms: number;
  volume: number;
  repeat_mode: 'Off' | 'All' | 'One';
  shuffle: boolean;
}

interface PlaylistManagerProps {
  onTrackSelect: (track: Track) => void;
  membraneSettings?: {
    enabled: boolean;
    intensity: number;
    radius: number;
  };
}

export default function PlaylistManager({ onTrackSelect, membraneSettings = { enabled: true, intensity: 1, radius: 1 } }: PlaylistManagerProps) {
  const [currentPlaylist, setCurrentPlaylist] = useState<Track[]>([]);
  const [playerState, setPlayerState] = useState<PlayerState>({
    is_playing: false,
    position_ms: 0,
    volume: 1.0,
    repeat_mode: 'Off',
    shuffle: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  // 软膜联动动画：容器与行引用
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rowCentersRef = useRef<number[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const mouseYRef = useRef<number | null>(null);

  useEffect(() => {
    // 监听播放器状态变化
    const unlistenStateChanged = listen('player-state-changed', (event: any) => {
      if (event.payload && typeof event.payload === 'object') {
        setPlayerState(event.payload);
      }
    });

    // 初始化时获取当前播放列表
    loadCurrentPlaylist();

    return () => {
      unlistenStateChanged.then(fn => fn());
    };
  }, []);

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
    if (!membraneSettings.enabled) {
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
    const sigma = 56 * Math.max(0.2, membraneSettings.radius); // 影响范围（像素）
    const maxScale = 0.012 * Math.max(0, membraneSettings.intensity); // 最大缩放系数
    const maxBright = 0.05 * Math.max(0, membraneSettings.intensity); // 最大亮度增加
    const maxTranslate = 2 * Math.max(0, membraneSettings.intensity); // 最大位移（px）

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
      (row.style as any).backgroundColor = `rgba(255, 255, 255, ${0.1 + 0.1 * w})`; // 白色基础上随权重微增
    }
  };

  // 事件：进入、移动、离开
  const handleMouseEnter = (e: React.MouseEvent) => {
    if (!membraneSettings.enabled) return;
    const container = containerRef.current;
    if (!container) return;
    const crect = container.getBoundingClientRect();
    mouseYRef.current = e.clientY - crect.top;
    if (animFrameRef.current == null) {
      animFrameRef.current = requestAnimationFrame(tick);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!membraneSettings.enabled) return;
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
    if (membraneSettings.enabled) return;
    
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
  }, [membraneSettings.enabled]);

  // 初始化与尺寸变化时重新计算行中心
  useEffect(() => {
    // 延迟到布局完成
    const id = requestAnimationFrame(() => {
      recomputeRowCenters();
    });
    return () => cancelAnimationFrame(id);
  }, [currentPlaylist.length]);

  // 清理动画资源
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const loadCurrentPlaylist = async () => {
    try {
      setIsLoading(true);
      console.log('🎵 获取当前播放列表');
      const playlist = await invoke('generate_sequential_playlist') as Track[];
      setCurrentPlaylist(playlist);
      // 重置 rowRefs 数组大小
      rowRefs.current = new Array(playlist.length).fill(null);
      console.log('🎵 播放列表获取完成，共', playlist.length, '首歌曲');
    } catch (error) {
      console.error('🎵 获取播放列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshPlaylist = async (shuffle: boolean) => {
    try {
      setIsLoading(true);
      console.log('🎵 重新生成播放列表，随机模式:', shuffle);
      
      const playlist = shuffle 
        ? await invoke('generate_random_playlist') as Track[]
        : await invoke('generate_sequential_playlist') as Track[];
      
      setCurrentPlaylist(playlist);
      // 重置 rowRefs 数组大小
      rowRefs.current = new Array(playlist.length).fill(null);
      
      // 同时加载到播放器
      await invoke('load_playlist_by_mode', { shuffle });
      
      console.log('🎵 播放列表刷新完成，共', playlist.length, '首歌曲');
    } catch (error) {
      console.error('🎵 刷新播放列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeToggle = async () => {
    const newShuffle = !playerState.shuffle;
    try {
      // 切换播放器模式
      await invoke('player_set_shuffle', { shuffle: newShuffle });
      // 刷新播放列表
      await refreshPlaylist(newShuffle);
    } catch (error) {
      console.error('🎵 切换播放模式失败:', error);
    }
  };

  const formatTime = (ms?: number) => {
    if (!ms) return '--:--';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleTrackPlay = async (track: Track) => {
    try {
      // 先选择曲目
      onTrackSelect(track);
      // 延迟一点再播放，确保界面更新
      setTimeout(async () => {
        try {
          await invoke('player_play', { trackId: track.id });
        } catch (error) {
          console.error('播放失败:', error);
        }
      }, 100);
    } catch (error) {
      console.error('选择曲目失败:', error);
    }
  };

  return (
    <div className="flex flex-col glass-card">
      {/* 标题和控制区域 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-contrast-primary mb-2">当前播放列表</h2>
            <p className="text-contrast-secondary text-base font-medium">
              {playerState.shuffle ? '随机播放模式' : '顺序播放模式'} · 共 {currentPlaylist.length} 首歌曲
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* 刷新播放列表按钮 */}
            <button
              onClick={() => refreshPlaylist(playerState.shuffle)}
              className="btn-brand-secondary"
              disabled={isLoading}
              title="重新生成播放列表"
            >
              <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              刷新
            </button>
            
            {/* 切换播放模式按钮 */}
            <button
              onClick={handleModeToggle}
              className={`btn-brand ${playerState.shuffle ? 'active' : ''}`}
              title={playerState.shuffle ? '切换到顺序播放' : '切换到随机播放'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {playerState.shuffle ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6m12 0l-3-3m3 3l-3 3M6 6l3 3 3-3M6 18l3-3 3 3" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                )}
              </svg>
              {playerState.shuffle ? '随机' : '顺序'}
            </button>
          </div>
        </div>
      </div>

      {/* 播放列表内容 */}
      <div className="glass-surface-strong flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center glass-card max-w-md">
              <div className="text-slate-400 mb-6">
                <svg className="w-16 h-16 mx-auto animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-contrast-primary mb-3">
                正在加载播放列表...
              </h3>
            </div>
          </div>
        ) : currentPlaylist.length === 0 ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center glass-card max-w-md">
              <div className="text-slate-400 mb-6">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-contrast-primary mb-3">
                播放列表为空
              </h3>
              <p className="text-contrast-secondary mb-6 text-base font-medium">
                请先在音乐库中添加一些音乐文件
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div 
              ref={containerRef}
              onMouseEnter={membraneSettings.enabled ? handleMouseEnter : undefined}
              onMouseMove={membraneSettings.enabled ? handleMouseMove : undefined}
              onMouseLeave={membraneSettings.enabled ? handleMouseLeave : undefined}
              className="space-y-2"
            >
              {currentPlaylist.map((track, index) => (
                <div
                  ref={(el) => { rowRefs.current[index] = el; }}
                  key={track.id}
                  className={`glass-card-interactive p-4 flex items-center gap-4 hover:bg-white/10 transition-colors cursor-pointer ${
                    playerState.current_track?.id === track.id ? 'bg-brand-500/20 border-brand-500/30' : ''
                  }`}
                  onClick={() => handleTrackPlay(track)}
                >
                  {/* 序号 */}
                  <div className="w-8 text-center text-contrast-secondary font-mono text-sm">
                    {playerState.current_track?.id === track.id && playerState.is_playing ? (
                      <div className="flex items-center justify-center">
                        <svg className="w-4 h-4 text-brand-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    ) : (
                      index + 1
                    )}
                  </div>

                  {/* 歌曲信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-contrast-primary truncate">
                      {track.title || '未知标题'}
                    </div>
                    <div className="text-sm text-contrast-secondary truncate">
                      {track.artist || '未知艺术家'}
                      {track.album && ` · ${track.album}`}
                    </div>
                  </div>

                  {/* 时长 */}
                  <div className="text-sm text-contrast-secondary font-mono">
                    {formatTime(track.duration_ms)}
                  </div>

                  {/* 播放按钮 */}
                  <button
                    className="w-8 h-8 rounded-full bg-brand-500/10 hover:bg-brand-500/20 flex items-center justify-center text-brand-500 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTrackPlay(track);
                    }}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
