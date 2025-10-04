import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Track } from '../types/music';

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

export default function CurrentPlaylistView({ 
  onTrackSelect, 
  membraneSettings = { enabled: true, intensity: 1, radius: 1 } 
}: PlaylistManagerProps) {
  const [currentPlaylist, setCurrentPlaylist] = useState<Track[]>([]);
  const [playerState, setPlayerState] = useState<PlayerState>({
    is_playing: false,
    position_ms: 0,
    volume: 1.0,
    repeat_mode: 'Off',
    shuffle: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  
  // 背景条状态
  const [backdropPosition, setBackdropPosition] = useState<{ top: number; visible: boolean }>({ top: 0, visible: false });
  const containerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);


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
  
  // 模糊背景条动画处理 - 优化版本，减少抖动
  const updateBackdropPosition = (targetTop: number) => {
    if (!membraneSettings.enabled || !backdropRef.current) return;
    
    // 取消之前的动画
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    // 直接设置位置，使用CSS transition来处理平滑动画
    const backdrop = backdropRef.current;
    backdrop.style.top = `${targetTop}px`;
    
    // 添加短暂的弹性效果
    backdrop.style.transform = 'scale(1.02)';
    backdrop.style.transition = 'top 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s ease-out';
    
    // 150ms后移除缩放效果
    setTimeout(() => {
      if (backdrop && backdrop.style) {
        backdrop.style.transform = 'scale(1)';
        backdrop.style.transition = 'top 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s ease-out';
      }
      
    }, 150);
  };
  
  // 处理鼠标进入和移动 - 适配新的紧凑布局
  const handleRowMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!membraneSettings.enabled || !containerRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    // 考虑标题区域的偏移
    const titleOffset = containerRef.current.querySelector('.border-b')?.getBoundingClientRect().height || 0;
    const relativeTop = rect.top - containerRect.top - titleOffset;
    
    setBackdropPosition({ top: Math.max(0, relativeTop), visible: true });
    updateBackdropPosition(Math.max(0, relativeTop));
  };
  
  const handleContainerMouseLeave = () => {
    if (!membraneSettings.enabled) return;
    setBackdropPosition(prev => ({ ...prev, visible: false }));
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };
  
  // 清理动画
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);



  const loadCurrentPlaylist = async () => {
    try {
      setIsLoading(true);
      console.log('🎵 获取当前播放列表');
      const playlist = await invoke('generate_sequential_playlist') as Track[];
      setCurrentPlaylist(playlist);
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
      // 现在 onTrackSelect 已经会自动播放，所以只需要调用它即可
      console.log('🎵 PlaylistManager - 播放曲目:', track.title);
      onTrackSelect(track);
    } catch (error) {
      console.error('🎵 PlaylistManager - 选择曲目失败:', error);
    }
  };

  return (
    <div className="flex flex-col glass-card">
      {/* 紧凑的标题和控制区域 */}
      <div className="mb-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 dark:border-white/5">
          <div>
            <h2 className="text-xl font-bold text-contrast-primary mb-1">当前播放列表</h2>
            <p className="text-contrast-secondary text-sm">
              {playerState.shuffle ? '随机播放模式' : '顺序播放模式'} · 共 {currentPlaylist.length} 首歌曲
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* 刷新播放列表按钮 - 紧凑版本 */}
            <button
              onClick={() => refreshPlaylist(playerState.shuffle)}
              className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 dark:bg-white/5 dark:hover:bg-white/10 text-contrast-secondary hover:text-contrast-primary rounded-lg transition-colors flex items-center gap-2"
              disabled={isLoading}
              title="重新生成播放列表"
            >
              <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              刷新
            </button>
            
            {/* 切换播放模式按钮 - 紧凑版本 */}
            <button
              onClick={handleModeToggle}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-2 ${
                playerState.shuffle 
                  ? 'bg-brand-500/20 text-brand-600 dark:text-brand-400' 
                  : 'bg-white/10 hover:bg-white/20 dark:bg-white/5 dark:hover:bg-white/10 text-contrast-secondary hover:text-contrast-primary'
              }`}
              title={playerState.shuffle ? '切换到顺序播放' : '切换到随机播放'}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="text-slate-400 dark:text-dark-700 mb-6">
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
              <div className="text-slate-400 dark:text-dark-700 mb-6">
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
          <div className="p-0">
            <div 
              ref={containerRef}
              className="relative"
              onMouseLeave={handleContainerMouseLeave}
            >
              {/* 模糊背景条 - 优化后的紧凑版本 */}
              {membraneSettings.enabled && (
                <div
                  ref={backdropRef}
                  className={`absolute left-0 right-0 h-12 rounded-lg pointer-events-none transition-all duration-200 ${
                    backdropPosition.visible ? 'bg-white/5 dark:bg-white/8' : 'bg-transparent'
                  }`}
                  style={{
                    top: `${backdropPosition.top}px`,
                    opacity: backdropPosition.visible ? 1 : 0
                  }}
                />
              )}
              
              {/* 紧凑的播放列表 */}
              <div className="divide-y divide-white/10 dark:divide-white/5">
                {currentPlaylist.map((track, index) => (
                  <div
                    key={track.id}
                    className={`flex items-center px-4 py-2 hover:bg-white/5 dark:hover:bg-white/3 transition-colors cursor-pointer relative group ${
                      playerState.current_track?.id === track.id ? 'bg-brand-500/10 dark:bg-brand-500/20' : ''
                    }`}
                    onClick={() => handleTrackPlay(track)}
                    onMouseEnter={handleRowMouseEnter}
                  >
                    {/* 序号 */}
                    <div className="w-10 text-center text-contrast-secondary font-mono text-sm flex-shrink-0">
                      {playerState.current_track?.id === track.id && playerState.is_playing ? (
                        <div className="flex items-center justify-center text-brand-500">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <polygon points="6,4 20,12 6,20" strokeLinejoin="round" strokeLinecap="round"/>
                          </svg>
                        </div>
                      ) : (
                        <span className="group-hover:text-contrast-primary transition-colors">
                          {index + 1}
                        </span>
                      )}
                    </div>

                    {/* 歌曲信息 - 紧凑布局 */}
                    <div className="flex-1 min-w-0 px-3">
                      <div className="font-medium text-contrast-primary truncate text-sm group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {track.title || '未知标题'}
                      </div>
                      <div className="text-xs text-contrast-secondary truncate mt-0.5 group-hover:text-contrast-primary transition-colors">
                        {track.artist || '未知艺术家'}
                        {track.album && <span className="opacity-70"> · {track.album}</span>}
                      </div>
                    </div>

                    {/* 时长 */}
                    <div className="text-xs text-contrast-secondary font-mono flex-shrink-0 w-12 text-right group-hover:text-contrast-primary transition-colors">
                      {formatTime(track.duration_ms)}
                    </div>

                    {/* 播放按钮 - 在悬停时显示 */}
                    <div className="w-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      <button
                        className="w-6 h-6 rounded-full bg-brand-500/20 hover:bg-brand-500/30 flex items-center justify-center text-brand-500 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTrackPlay(track);
                        }}
                        title="播放"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                          <polygon points="6,4 20,12 6,20" strokeLinejoin="round" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
