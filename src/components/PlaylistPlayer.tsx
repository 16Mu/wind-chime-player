import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import ImmersiveLyricsView from './ImmersiveLyricsView';
import LyricsManager from './LyricsManager';
import { useToast } from '../contexts/ToastContext';
import { usePlaybackState, usePlaybackPosition } from '../contexts/PlaybackContext';

interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
}

// ✅ PlayerState已迁移到PlaybackContext，不再需要本地定义

interface PlaylistPlayerProps {
  currentTrack: Track | null;
}

// 🎬 歌词内容组件（支持跑马灯和动画）
interface LyricContentProps {
  text: string;
  animation: 'slide-in' | 'slide-out' | 'none';
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const LyricContent: React.FC<LyricContentProps> = ({ text, animation, containerRef }) => {
  const [isOverflow, setIsOverflow] = useState(false);
  const [animationDuration, setAnimationDuration] = useState(10);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // 检测歌词是否超出容器宽度
    if (textRef.current && containerRef.current) {
      const textWidth = textRef.current.scrollWidth;
      const containerWidth = containerRef.current.clientWidth;
      const overflow = textWidth > containerWidth;
      
      setIsOverflow(overflow);
      
      if (overflow) {
        // 根据文本长度动态计算动画时长
        // 基础速度：每200px需要5秒
        const duration = Math.max(5, (textWidth / 200) * 5);
        setAnimationDuration(duration);
      }
    }
  }, [text, containerRef]);

  const animationClass = animation === 'slide-in' ? 'lyric-slide-in' : 
                         animation === 'slide-out' ? 'lyric-slide-out' : '';

  return (
    <div className={`lyric-content-wrapper ${animationClass}`}>
      <span
        ref={textRef}
        className={isOverflow ? 'lyric-marquee' : ''}
        data-text={text}
        style={isOverflow ? {
          animationDuration: `${animationDuration}s`,
          whiteSpace: 'pre-line'
        } : { whiteSpace: 'pre-line' }}
      >
        {text}
      </span>
    </div>
  );
};

export default function PlaylistPlayer({ currentTrack }: PlaylistPlayerProps) {
  const toast = useToast();
  
  // ✅ 使用PlaybackContext代替本地state
  const playbackState = usePlaybackState();
  const getPosition = usePlaybackPosition();
  
  // ✅ 完整的播放器状态现在由PlaybackContext统一管理
  // 播放器状态完全从Rust端同步，通过'player-state-changed'事件
  const playerState = {
    current_track: playbackState.track,
    is_playing: playbackState.isPlaying,
    position_ms: getPosition(),
    volume: playbackState.volume,
    repeat_mode: playbackState.repeatMode,
    shuffle: playbackState.shuffle,
  };

  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);
  const dragPositionRef = useRef(0); // 用于保存最新的拖拽位置
  const progressBarRef = useRef<HTMLDivElement>(null);
  
  const transportControlsRef = useRef<HTMLDivElement>(null);
  
  // 🔥 实时位置更新（用于进度条流畅显示）
  const [realTimePosition, setRealTimePosition] = useState(0);
  
  // 🔊 音量控制状态
  const [volume, setVolume] = useState(1); // 0-1 范围
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(1); // 保存静音前的音量
  const [isVolumeDragging, setIsVolumeDragging] = useState(false);
  const volumeSliderRef = useRef<HTMLDivElement>(null);
  
  
  // 简化状态管理
  
  // 歌词相关状态
  const [showLyrics, setShowLyrics] = useState(false);
  const [showLyricsManager, setShowLyricsManager] = useState(false);
  const [currentLyric, setCurrentLyric] = useState<string>('');
  const [lyrics, setLyrics] = useState<Array<{ time: number; text: string; translation?: string }>>([]);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [hasPlayedLyric, setHasPlayedLyric] = useState(false); // 🎵 跟踪是否已经播放过歌词
  
  // 歌词动画状态
  const [lyricAnimation, setLyricAnimation] = useState<'slide-in' | 'slide-out' | 'none'>('none');
  const lyricContainerRef = useRef<HTMLDivElement>(null);
  const previousLyricRef = useRef<string>('');
  
  const albumThumbnailRef = useRef<HTMLDivElement>(null);
  
  // 音频设备状态
  const [audioDeviceError, setAudioDeviceError] = useState<string | null>(null);
  const [showAudioTroubleshooter, setShowAudioTroubleshooter] = useState(false);
  
  // 专辑封面状态
  const [albumCoverUrl, setAlbumCoverUrl] = useState<string | null>(null);
  const [nextAlbumCoverUrl, setNextAlbumCoverUrl] = useState<string | null>(null);
  const [prevAlbumCoverUrl, setPrevAlbumCoverUrl] = useState<string | null>(null);
  
  // 收藏状态
  const [isFavorite, setIsFavorite] = useState(false);
  
  // 后端就绪状态
  const [isAppReady, setIsAppReady] = useState(false);
  
  // 动画状态
  // const [shuffleAnimating, setShuffleAnimating] = useState(false);
  // const [repeatAnimating, setRepeatAnimating] = useState(false);
  const [progressRipples, setProgressRipples] = useState<{x: number; key: number}[]>([]);
  
  // 切歌动画状态
  const [coverFlipAnimation, setCoverFlipAnimation] = useState<'flip-next' | 'flip-prev' | ''>('');
  const [infoSlideAnimation, setInfoSlideAnimation] = useState<'slide-out-next' | 'slide-out-prev' | 'slide-in-next' | 'slide-in-prev' | ''>('');
  const [lastFlipDirection, setLastFlipDirection] = useState<'next' | 'prev'>('next'); // 记录上次翻转方向
  const [isAnimatingTrackChange, setIsAnimatingTrackChange] = useState(false); // 标记正在进行切歌动画
  const previousTrackIdRef = useRef<number | null>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const coverAnimationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 等待后端就绪
  useEffect(() => {
    if (typeof listen === 'undefined') return;

    let isActive = true;
    let unlistenAppReady: (() => void) | null = null;

    const setupReadyListener = async () => {
      try {
        unlistenAppReady = await listen('app-ready', () => {
          if (!isActive) return;
          console.log('[PlaylistPlayer] Backend ready');
          setIsAppReady(true);
        });
        
        if (!isActive && unlistenAppReady) {
          unlistenAppReady();
        }
      } catch (err) {
        console.error('[PlaylistPlayer] Failed to set backend ready listener:', err);
      }
    };

    setupReadyListener();
    
    return () => {
      isActive = false;
      if (unlistenAppReady) {
        unlistenAppReady();
      }
    };
  }, []);

  // 🔥 监听歌曲切换事件，启动后台 Web Audio 加载 + 触发切歌动画
  useEffect(() => {
    let isActive = true; // 标记组件是否处于活动状态
    let lastLoadedTrackId: number | null = null;
    let unlistenTrackChanged: (() => void) | null = null;
    
    const setupListener = async () => {
      try {
        unlistenTrackChanged = await listen('player-track-changed', async (event: any) => {
          if (!isActive) return; // 🔒 检查组件是否仍然挂载
          
          const newTrack = event.payload;
          if (newTrack && newTrack.id) {
            console.log('[PlaylistPlayer] Track changed:', newTrack.title, 'ID:', newTrack.id);
            
            // 🎬 检测切歌方向（通过比较track ID）
            const direction = previousTrackIdRef.current !== null && newTrack.id > previousTrackIdRef.current ? 'next' : 'prev';
            previousTrackIdRef.current = newTrack.id;
            setLastFlipDirection(direction); // 记录方向
            
            // 🎬 打断之前的动画
            if (animationTimeoutRef.current) {
              clearTimeout(animationTimeoutRef.current);
            }
            if (coverAnimationTimeoutRef.current) {
              clearTimeout(coverAnimationTimeoutRef.current);
            }
            
            // 🎬 确保背面封面已准备好，如果没有则等待加载
            const backCoverUrl = direction === 'next' ? nextAlbumCoverUrl : prevAlbumCoverUrl;
            if (!backCoverUrl) {
              console.warn('[PlaylistPlayer] Back cover not ready, loading immediately...');
              // 立即加载缺失的封面
              const coverUrl = await loadCoverUrl(newTrack.id);
              if (coverUrl) {
                if (direction === 'next') {
                  setNextAlbumCoverUrl(coverUrl);
                } else {
                  setPrevAlbumCoverUrl(coverUrl);
                }
              }
            }
            
            // 🎬 标记正在进行切歌动画（阻止 useEffect 中的 loadAlbumCover）
            setIsAnimatingTrackChange(true);
            
            // 🎬 启动滑出动画（歌曲信息）
            setInfoSlideAnimation(direction === 'next' ? 'slide-out-next' : 'slide-out-prev');
            
            // 🎬 启动封面翻转动画（使用预加载的封面）
            setCoverFlipAnimation(direction === 'next' ? 'flip-next' : 'flip-prev');
            
            // 🎬 300ms后结束滑出，启动滑入
            animationTimeoutRef.current = setTimeout(() => {
              setInfoSlideAnimation(direction === 'next' ? 'slide-in-next' : 'slide-in-prev');
              
              // 🎬 再400ms后清除动画类
              animationTimeoutRef.current = setTimeout(() => {
                setInfoSlideAnimation('');
              }, 400);
            }, 300);
            
            // 🎬 600ms后清除封面动画并交换封面
            coverAnimationTimeoutRef.current = setTimeout(async () => {
              // 🎬 根据方向选择对应的预加载封面
              let newCoverUrl = direction === 'next' ? nextAlbumCoverUrl : prevAlbumCoverUrl;
              
              // 🔧 如果预加载封面不存在，立即加载当前歌曲的封面
              if (!newCoverUrl && newTrack.id) {
                console.warn('[PlaylistPlayer] 预加载封面缺失，立即加载封面:', newTrack.title);
                newCoverUrl = await loadCoverUrl(newTrack.id);
              }
              
              if (newCoverUrl) {
                const oldCover = albumCoverUrl;
                setAlbumCoverUrl(newCoverUrl);
                
                // 清空已使用的预加载封面
                if (direction === 'next') {
                  setNextAlbumCoverUrl(null);
                } else {
                  setPrevAlbumCoverUrl(null);
                }
                
                // 🎬 使用requestAnimationFrame确保DOM更新后再清除动画
                requestAnimationFrame(() => {
                  setCoverFlipAnimation('');
                  // 清理旧封面
                  if (oldCover && oldCover !== newCoverUrl) {
                    URL.revokeObjectURL(oldCover);
                  }
                  
                  // 🎬 标记动画完成
                  setIsAnimatingTrackChange(false);
                  
                  // 🎬 重新预加载邻近封面
                  setTimeout(() => {
                    preloadNeighborCovers();
                  }, 100);
                });
              } else {
                // 🔧 即使没有封面，也要结束动画状态
                setCoverFlipAnimation('');
                setIsAnimatingTrackChange(false);
                // 尝试加载当前歌曲的封面（非动画模式）
                if (newTrack.id) {
                  const coverUrl = await loadCoverUrl(newTrack.id);
                  if (coverUrl) {
                    setAlbumCoverUrl(coverUrl);
                  }
                }
              }
            }, 600);
            
            // 🔥 避免重复加载同一首歌
            if (newTrack.id !== lastLoadedTrackId) {
              lastLoadedTrackId = newTrack.id;
              
              // 🔥 延迟 100ms 后启动后台加载（让 Rust 先开始播放）
              setTimeout(async () => {
                if (!isActive) return; // 🔒 再次检查组件是否仍然挂载
                
                try {
                  const { hybridPlayer } = await import('../services/hybridPlayer');
                  // 🔥 使用 skipRustPlay=true 仅启动后台加载，不重新播放
                  console.log('[PlaylistPlayer] Starting background Web Audio loading...');
                  await hybridPlayer.play(newTrack, [], true);
                } catch (error) {
                  console.error('[PlaylistPlayer] Background loading failed:', error);
                  // 🔥 加载失败时重置 lastLoadedTrackId，允许下次重试
                  lastLoadedTrackId = null;
                }
              }, 100);
            } else {
              console.log('[PlaylistPlayer] Skipping duplicate track load', newTrack.id);
            }
          }
        });
        
        // 最后检查组件是否还活跃
        if (!isActive && unlistenTrackChanged) {
          unlistenTrackChanged();
          console.log('[PlaylistPlayer] Component unmounted, canceling listener');
        }
      } catch (err) {
        console.error('[PlaylistPlayer] Failed to set listener:', err);
      }
    };
    
    setupListener();
    
    return () => {
      isActive = false; // 🔒 标记组件为非活动状态
      
      if (unlistenTrackChanged) {
        unlistenTrackChanged();
      }
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      if (coverAnimationTimeoutRef.current) {
        clearTimeout(coverAnimationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // ✅ 移除重复的事件监听 - PlaybackContext已经处理了player-state/track/position-changed
    // 只保留UI专属的错误处理监听
    
    const unlistenPlayerError = listen('player-error', (event: any) => {
      console.error('[PlaylistPlayer] Player error:', event.payload);
      
      // 显示所有播放器错误
      const errorMessage = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload);
      setAudioDeviceError(errorMessage);
      setShowAudioTroubleshooter(true);
      
      // 特别处理音频设备相关错误
      if (errorMessage.includes('NoDevice') || 
          errorMessage.includes('音频设备') || 
          errorMessage.includes('sink') ||
          errorMessage.includes('播放列表为空')) {
        console.warn('[PlaylistPlayer] Audio system issue detected:', errorMessage);
      }
    });

    // 监听歌曲完成事件
    const unlistenTrackCompleted = listen('track-completed', async (event: any) => {
      console.log('[PlaylistPlayer] Track playback complete:', event.payload);
      // 🎵 自动播放下一曲
      try {
        const { hybridPlayer } = await import('../services/hybridPlayer');
        await hybridPlayer.next();
        console.log('[PlaylistPlayer] Auto-switching to next track');
      } catch (error) {
        console.error('[PlaylistPlayer] Auto-switch to next failed:', error);
      }
    });

    // 监听播放列表完成事件
    const unlistenPlaylistCompleted = listen('playlist-completed', () => {
      console.log('[PlaylistPlayer] Playlist playback complete');
      toast.info('播放列表已全部播放完毕', 3000);
      // 可以询问是否重新播放
    });

    // 监听音频设备失败事件
    const unlistenAudioDeviceFailed = listen('audio-device-failed', (event: any) => {
      const { error, recoverable } = event.payload || {};
      console.error('[PlaylistPlayer] Audio device failed:', { error, recoverable });
      
      if (recoverable) {
        toast.warning(`音频设备问题: ${error}。正在尝试恢复...`, 5000);
        setAudioDeviceError(error);
      } else {
        toast.error(`音频设备错误: ${error}。请检查音频设备设置。`, 8000);
        setAudioDeviceError(error);
        setShowAudioTroubleshooter(true);
      }
    });

    // 监听音频设备就绪事件
    const unlistenAudioDeviceReady = listen('audio-device-ready', () => {
      console.log('[PlaylistPlayer] Audio device ready');
      setAudioDeviceError(null);
      setShowAudioTroubleshooter(false);
      toast.success('音频设备已恢复正常', 2000);
    });

    return () => {
      // ✅ 只清理本组件专属的监听器
      unlistenPlayerError.then(fn => fn());
      unlistenTrackCompleted.then(fn => fn());
      unlistenPlaylistCompleted.then(fn => fn());
      unlistenAudioDeviceFailed.then(fn => fn());
      unlistenAudioDeviceReady.then(fn => fn());
    };
  }, [toast]);

  // 初始化播放列表（等待后端就绪）
  useEffect(() => {
    if (!isAppReady) return;

    const initializePlaylist = async () => {
      try {
        console.log('[PlaylistPlayer] Initializing playlist');
        await ensurePlaylistLoaded();
      } catch (error) {
        console.error('[PlaylistPlayer] Playlist initialization failed:', error);
      }
    };

    // 延迟初始化，让其他组件先完成加载
    const timer = setTimeout(initializePlaylist, 500);

    return () => clearTimeout(timer);
  }, [isAppReady]);

  // 确保播放列表已加载
  const ensurePlaylistLoaded = async () => {
    try {
      console.log('[PlaylistPlayer] Ensuring playlist loaded, shuffle mode:', playerState.shuffle);
      await invoke('load_playlist_by_mode', { shuffle: playerState.shuffle });
      console.log('[PlaylistPlayer] Playlist load complete');
      
      // 调试：获取播放列表内容验证
      try {
        const playlist = await invoke('generate_sequential_playlist') as any[];
        console.log('[PlaylistPlayer] Playlist verification:', playlist.length, 'tracks');
        console.log('[PlaylistPlayer] First 3 tracks:', playlist.slice(0, 3).map(t => ({ id: t.id, title: t.title, path: t.path })));
      } catch (e) {
        console.warn('[PlaylistPlayer] Playlist verification failed:', e);
      }
    } catch (error) {
      console.error('[PlaylistPlayer] Playlist load failed:', error);
    }
  };

  // 🔥 统一的播放/暂停切换（替代单独的 pause/resume 函数）
  const handlePlayPauseToggle = async () => {
    try {
      const { hybridPlayer } = await import('../services/hybridPlayer');
      
      if (playerState.is_playing) {
        // 正在播放 → 暂停
        await hybridPlayer.pause();
        console.log('[PlaylistPlayer] Paused');
      } else if (playerState.current_track) {
        await hybridPlayer.resume();
        console.log('[PlaylistPlayer] Resumed');
      }
    } catch (error) {
      console.error('播放/暂停切换失败:', error);
    }
  };

  const handleNext = async () => {
    try {
      const { hybridPlayer } = await import('../services/hybridPlayer');
      await hybridPlayer.next();
      console.log('[PlaylistPlayer] Switched to next track');
    } catch (error) {
      console.error('下一首失败:', error);
    }
  };

  const handlePrevious = async () => {
    try {
      const { hybridPlayer } = await import('../services/hybridPlayer');
      await hybridPlayer.previous();
      console.log('[PlaylistPlayer] Switched to previous track');
    } catch (error) {
      console.error('上一首失败:', error);
    }
  };


  // 🔧 修复：稳定歌词视图的回调函数引用
  const handleLyricsClose = useCallback(() => {
    setShowLyrics(false);
  }, []);

  const handleLyricsError = useCallback((error: string) => {
    console.error('歌词显示错误:', error);
  }, []);

  const handleSeek = async (positionMs: number) => {
    console.log('[Seek] Jump to position:', positionMs, 'ms');
    
    // 🔥 立即更新本地位置状态（避免歌词显示错误）
    setRealTimePosition(positionMs);
    
    try {
      // 🔥 使用混合播放器（智能选择引擎）
      const { hybridPlayer } = await import('../services/hybridPlayer');
      await hybridPlayer.seek(positionMs);
      console.log('[Seek] Jump complete');
    } catch (error) {
      console.error('[Seek] Jump failed:', error);
      
      // 如果是 Rust seek 失败（流式播放不支持），提示用户
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('音频尚未缓存') || errorMessage.includes('seek暂时不可用')) {
        console.log('[Seek] Tip: Web Audio engine loading in background, fast seeking available soon');
        toast.info('正在加载高速跳转功能，请稍候...', 2000);
      } else {
        toast.error(`跳转失败: ${errorMessage}`, 3000);
      }
    }
  };

  // const handleSetShuffle = async (shuffle: boolean) => {
  //   // 触发动画
  //   // setShuffleAnimating(true);
  //   // setTimeout(() => setShuffleAnimating(false), 400);
  //   
  //   try {
  //     await invoke('player_set_shuffle', { shuffle });
  //     
  //     // 切换播放模式时重新生成播放列表
  //     console.log('🎵 播放模式切换，重新生成播放列表，随机模式:', shuffle);
  //     await invoke('load_playlist_by_mode', { shuffle });
  //     console.log('🎵 播放列表重新生成完成');
  //   } catch (error) {
  //     console.error('设置随机播放失败:', error);
  //   }
  // };

  // const handleCycleRepeat = async () => {
  //   // 触发动画
  //   // setRepeatAnimating(true);
  //   // setTimeout(() => setRepeatAnimating(false), 500);
  //   
  //   try {
  //     let nextMode: 'Off' | 'All' | 'One';
  //     switch (playerState.repeat_mode) {
  //       case 'Off':
  //         nextMode = 'All';
  //         break;
  //       case 'All':
  //         nextMode = 'One';
  //         break;
  //       case 'One':
  //         nextMode = 'Off';
  //         break;
  //       default:
  //         nextMode = 'Off';
  //     }
  //     await invoke('player_set_repeat', { mode: nextMode });
  //   } catch (error) {
  //     console.error('设置重复模式失败:', error);
  //   }
  // };

  // 🔊 音量控制函数
  const handleVolumeChange = async (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
    
    // 如果调整音量且音量大于0，自动取消静音
    if (clampedVolume > 0 && isMuted) {
      setIsMuted(false);
    }
    
    // 🔥 同步到混合播放器
    try {
      const { hybridPlayer } = await import('../services/hybridPlayer');
      await hybridPlayer.setVolume(clampedVolume);
      console.log(`[Volume] Set to ${(clampedVolume * 100).toFixed(0)}%`);
    } catch (error) {
      console.error('设置音量失败:', error);
    }
  };

  // 静音切换
  const handleToggleMute = () => {
    if (isMuted) {
      // 取消静音，恢复之前的音量
      setIsMuted(false);
      handleVolumeChange(previousVolume);
    } else {
      // 静音，保存当前音量
      setPreviousVolume(volume);
      setIsMuted(true);
      handleVolumeChange(0);
    }
  };

  // 音量条点击
  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeSliderRef.current) return;
    
    const rect = volumeSliderRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    
    handleVolumeChange(percentage);
  };

  // 音量条拖拽开始
  const handleVolumeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsVolumeDragging(true);
    handleVolumeClick(e); // 立即更新到点击位置
  };

  // const getRepeatModeTitle = () => {
  //   switch (playerState.repeat_mode) {
  //     case 'Off':
  //       return '开启重复播放';
  //     case 'All':
  //       return '重复播放全部 (点击切换到单曲循环)';
  //     case 'One':
  //       return '单曲循环 (点击关闭重复)';
  //     default:
  //       return '重复播放';
  //   }
  // };

  const checkAudioDevices = async () => {
    try {
      const result = await invoke('check_audio_devices') as string;
      toast.success(`音频设备检测成功: ${result}`);
      setAudioDeviceError(null);
      setShowAudioTroubleshooter(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setAudioDeviceError(errorMessage);
      toast.error(`音频设备检测失败: ${errorMessage}`);
    }
  };

  // 加载专辑封面
  const loadAlbumCover = async (trackId: number) => {
    try {
      const result = await invoke('get_album_cover', { trackId }) as [number[], string] | null;
      if (result) {
        const [imageData, mimeType] = result;
        const blob = new Blob([new Uint8Array(imageData)], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        // 清理之前的当前封面URL
        if (albumCoverUrl) {
          URL.revokeObjectURL(albumCoverUrl);
        }
        setAlbumCoverUrl(url);
      } else {
        setAlbumCoverUrl(null);
      }
    } catch (error) {
      console.error('加载专辑封面失败:', error);
      setAlbumCoverUrl(null);
    }
  };
  
  // 🎬 加载指定曲目的封面并返回URL
  const loadCoverUrl = async (trackId: number): Promise<string | null> => {
    try {
      const result = await invoke('get_album_cover', { trackId }) as [number[], string] | null;
      if (result) {
        const [imageData, mimeType] = result;
        const blob = new Blob([new Uint8Array(imageData)], { type: mimeType });
        return URL.createObjectURL(blob);
      }
      return null;
    } catch (error) {
      console.error('加载封面失败:', error);
      return null;
    }
  };
  
  // 🎬 预加载上一首和下一首的封面
  const preloadNeighborCovers = async () => {
    try {
      // 获取播放列表
      const playlist = await invoke('player_get_playlist') as Track[];
      const currentIndex = playlist.findIndex(t => t.id === displayTrack?.id);
      
      if (currentIndex === -1) return;
      
      // 预加载下一首封面
      const nextIndex = (currentIndex + 1) % playlist.length;
      if (playlist[nextIndex]) {
        const nextUrl = await loadCoverUrl(playlist[nextIndex].id);
        if (nextUrl) {
          if (nextAlbumCoverUrl) {
            URL.revokeObjectURL(nextAlbumCoverUrl);
          }
          setNextAlbumCoverUrl(nextUrl);
          console.log('[Cover] Preloaded next cover:', playlist[nextIndex].title);
        }
      }
      
      // 预加载上一首封面
      const prevIndex = currentIndex === 0 ? playlist.length - 1 : currentIndex - 1;
      if (playlist[prevIndex]) {
        const prevUrl = await loadCoverUrl(playlist[prevIndex].id);
        if (prevUrl) {
          if (prevAlbumCoverUrl) {
            URL.revokeObjectURL(prevAlbumCoverUrl);
          }
          setPrevAlbumCoverUrl(prevUrl);
          console.log('[Cover] Preloaded previous cover:', playlist[prevIndex].title);
        }
      }
    } catch (error) {
      console.error('预加载邻近封面失败:', error);
    }
  };

  // 检查曲目收藏状态
  const checkFavoriteStatus = async (trackId: number) => {
    try {
      const isFav = await invoke('favorites_is_favorite', { trackId }) as boolean;
      setIsFavorite(isFav);
    } catch (error) {
      console.error('检查收藏状态失败:', error);
      setIsFavorite(false);
    }
  };

  // 切换收藏状态
  const toggleFavorite = async () => {
    // 优先使用播放器状态中的当前曲目
    const track = playerState.current_track || currentTrack;
    if (!track) return;

    try {
      const newFavoriteState = await invoke('favorites_toggle', { trackId: track.id }) as boolean;
      setIsFavorite(newFavoriteState);
      
      // 显示反馈消息
      if (newFavoriteState) {
        toast.success(`✨ 已收藏: ${track.title || '未知歌曲'}`);
      } else {
        toast.info(`💔 已取消收藏: ${track.title || '未知歌曲'}`);
      }
    } catch (error) {
      console.error('切换收藏状态失败:', error);
      toast.error('收藏操作失败');
    }
  };

  // 🔧 歌词加载请求ID追踪
  const lyricsRequestIdRef = useRef(0);
  const lastLoadedTrackIdRef = useRef<number | null>(null);
  
  // 当曲目变化时加载专辑封面和检查收藏状态
  useEffect(() => {
    // 优先使用播放器状态中的当前曲目，确保与实际播放保持同步
    const track = playerState.current_track || currentTrack;
    const trackId = track?.id;
    
    // 🔧 防止重复加载：如果track ID没变，跳过
    if (trackId === lastLoadedTrackIdRef.current) {
      console.log(`[Lyrics] Skipping duplicate load trackId=${trackId}`);
      return;
    }
    
    console.log('[Lyrics] Track changed:', {
      oldTrackId: lastLoadedTrackIdRef.current,
      newTrackId: trackId,
      trackTitle: track?.title
    });
    
    // 更新最后加载的track ID
    lastLoadedTrackIdRef.current = trackId || null;
    
    // 清理之前的URL
    const currentUrl = albumCoverUrl;
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      setAlbumCoverUrl(null);
    }

    if (trackId) {
      // 🔧 生成新的歌词请求ID
      const lyricsRequestId = ++lyricsRequestIdRef.current;
      console.log(`[Lyrics] Starting load trackId=${trackId}, requestId=${lyricsRequestId}`);
      
      // 🎬 如果正在进行切歌动画，跳过 loadAlbumCover（使用预加载的封面）
      if (!isAnimatingTrackChange) {
        loadAlbumCover(trackId);
      } else {
        console.log('🎬 切歌动画进行中，跳过立即加载封面，使用预加载封面');
      }
      
      checkFavoriteStatus(trackId);
      loadLyrics(trackId, lyricsRequestId);
      setHasPlayedLyric(false); // 🎵 重置歌词播放状态
      
      // 🎬 预加载上一首和下一首的封面（延迟执行，避免阻塞当前歌曲加载）
      setTimeout(() => {
        preloadNeighborCovers();
      }, 500);
    } else {
      console.log('[Lyrics] No valid track ID, clearing state');
      setIsFavorite(false);
      setLyrics([]);
      setCurrentLyric('');
      setIsLoadingLyrics(false);
      setHasPlayedLyric(false);
      
      // 清理预加载封面
      if (nextAlbumCoverUrl) {
        URL.revokeObjectURL(nextAlbumCoverUrl);
        setNextAlbumCoverUrl(null);
      }
      if (prevAlbumCoverUrl) {
        URL.revokeObjectURL(prevAlbumCoverUrl);
        setPrevAlbumCoverUrl(null);
      }
    }
  }, [playerState.current_track?.id, currentTrack?.id]);

  // 🎵 获取歌词（方案A：数据库 → 文件系统降级）
  const loadLyrics = async (trackId: number, requestId: number) => {
    try {
      console.log(`[LRC#${requestId}] Loading lyrics, trackId:`, trackId);
      setIsLoadingLyrics(true);
      
      // 🔧 检查请求是否已过期
      if (requestId !== lyricsRequestIdRef.current) {
        console.log(`[LRC#${requestId}] Lyrics request expired, skipping`);
        setIsLoadingLyrics(false);
        return;
      }
      
      const track = playerState.current_track || currentTrack;
      if (!track) {
        console.warn('[Lyrics] No current track info');
        setLyrics([]);
        setIsLoadingLyrics(false);
        return;
      }
      
      // 1️⃣ 查询数据库
      const dbLyrics = await invoke('lyrics_get', { 
        trackId: trackId,
        track_id: trackId
      }) as { content: string; format: string; source: string } | null;
      
      if (dbLyrics && dbLyrics.content) {
        // 🔧 检测并清理损坏数据
        if (dbLyrics.content.includes('[NaN:')) {
          console.warn('[Lyrics] Detected corrupted database lyrics, skipped');
          await invoke('lyrics_delete', { trackId: trackId }).catch(() => {});
        } else {
          try {
            const parsed = await invoke('lyrics_parse', { 
              content: dbLyrics.content 
            }) as { lines: Array<{ timestamp_ms: number; text: string; translation?: string }> };

            if (parsed && parsed.lines && parsed.lines.length > 0) {
              const normalized = parsed.lines.map(line => ({
                time: line.timestamp_ms,
                text: line.text,
                translation: line.translation,
              }));

              console.log(`[LRC#${requestId}] Lyrics loaded from database (parsed): ${normalized.length} lines`);
              setLyrics(normalized);
              setIsLoadingLyrics(false);
              return;
            }
          } catch (parseError) {
            console.warn('[Lyrics] Failed to parse database lyrics with backend parser, fallback to simple LRC parser:', parseError);
          }

          const parsedLyrics = parseLrc(dbLyrics.content);
          if (parsedLyrics.length > 0) {
            console.log(`[LRC#${requestId}] Lyrics loaded from database (fallback): ${parsedLyrics.length} lines`);
            setLyrics(parsedLyrics);
            setIsLoadingLyrics(false);
            return;
          }
        }
      }
      
      // 2️⃣ 查询文件系统（降级）
      console.log(`[LRC#${requestId}] Not found in database, trying filesystem...`);
      const fileLyrics = await invoke('lyrics_search_comprehensive', { 
        audioPath: track.path,
        audio_path: track.path
      }) as any;
      
      if (fileLyrics && fileLyrics.lines && fileLyrics.lines.length > 0) {
        console.log(`[LRC#${requestId}] Lyrics loaded from filesystem: ${fileLyrics.lines.length} lines`);
        
        // 转换为前端格式
        const lyrics = fileLyrics.lines.map((line: any) => ({
          time: line.timestamp_ms,
          text: line.text,
          translation: line.translation
        }));
        
        setLyrics(lyrics);
        setIsLoadingLyrics(false);
        console.log(`[LRC#${requestId}] Reset loading state: isLoadingLyrics = false`);
        return;
      }
      
      // 3️⃣ 都没有找到
      console.log(`[LRC#${requestId}] Lyrics not found`);
      setLyrics([]);
      setCurrentLyric('');
      setIsLoadingLyrics(false);
      
    } catch (error) {
      console.error(`[LRC#${requestId}] Failed to load lyrics:`, error);
      setLyrics([]);
      setCurrentLyric('');
      setIsLoadingLyrics(false);
    }
  };

  // 解析LRC格式歌词
  const parseLrc = (lrc: string): Array<{ time: number; text: string }> => {
    const lines = lrc.split('\n');
    const result: Array<{ time: number; text: string }> = [];
    
    for (const line of lines) {
      // 🔧 修复：支持1-2位数的分钟，毫秒可选
      const match = line.match(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0')) : 0;
        const time = (minutes * 60 + seconds) * 1000 + milliseconds;
        const text = match[4].trim();
        
        if (text) {
          result.push({ time, text });
        }
      }
    }
    
    return result.sort((a, b) => a.time - b.time);
  };

  // 🎵 根据当前播放位置更新显示的歌词
  useEffect(() => {
    if (lyrics.length === 0) {
      setCurrentLyric('');
      return;
    }

    console.log(`[Lyrics] Timer started, ${lyrics.length} lines`);
    console.log(`[Lyrics] First line: ${lyrics[0]?.time}ms "${lyrics[0]?.text}"`);
    
    // 追踪上一次的歌词索引，避免重复日志
    let lastIndex = -1;

    // 使用定时器持续更新歌词
    const updateLyric = () => {
      // 🔥 直接读取最新的位置（解决闭包陷阱）
      const currentPosition = isDragging ? dragPosition : getPosition();
      
      // 🔧 调试：输出当前状态
      if (lastIndex === -1) {
        console.log(`[Lyrics] Current position: ${Math.floor(currentPosition/1000)}s`);
      }
      
      // 找到当前应该显示的歌词
      let currentIndex = -1;
      for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].time <= currentPosition) {
          currentIndex = i;
        } else {
          break;
        }
      }

      if (currentIndex >= 0 && currentIndex !== lastIndex) {
        const line = lyrics[currentIndex];
        const baseText = line.text;
        const translationText = line.translation || '';
        const lyricText = translationText ? `${baseText}\n${translationText}` : baseText;
        setCurrentLyric(lyricText);
        setHasPlayedLyric(true); // 🎵 标记已经播放过歌词
        console.log(`[Lyrics] ${Math.floor(currentPosition/1000)}s -> [${currentIndex}/${lyrics.length}] ${baseText.substring(0, 20)}...`);
        lastIndex = currentIndex;
      } else if (currentIndex < 0) {
        // 🔧 调试：歌词未开始（位置早于第一行歌词）
        if (lastIndex !== -1) {
          console.log(`[Lyrics] ${Math.floor(currentPosition/1000)}s -> Waiting for first line (${Math.floor(lyrics[0].time/1000)}s)`);
          lastIndex = -1;
        }
        setCurrentLyric('');
      }
    };

    // 立即更新一次
    updateLyric();

    // 每100ms更新一次歌词
    const interval = setInterval(updateLyric, 100);

    return () => {
      console.log(`[Lyrics] Timer cleaned up`);
      clearInterval(interval);
    };
  }, [lyrics, getPosition, isDragging, dragPosition]); // 添加必要的依赖项

  // 🎬 歌词切换动画
  useEffect(() => {
    if (currentLyric && currentLyric !== previousLyricRef.current) {
      // 🔧 第一句歌词不需要动画
      if (!previousLyricRef.current) {
        previousLyricRef.current = currentLyric;
        setLyricAnimation('none');
        return;
      }
      
      // 有歌词变化，触发退出动画
      setLyricAnimation('slide-out');
      
      // 300ms后切换内容并播放进入动画（匹配 slide-out 时长）
      const timer = setTimeout(() => {
        previousLyricRef.current = currentLyric;
        setLyricAnimation('slide-in');
        
        // 动画完成后重置状态（500ms 匹配 slide-in 时长）
        setTimeout(() => {
          setLyricAnimation('none');
        }, 500);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [currentLyric]);

  // 🧹 组件卸载时清理所有URL
  useEffect(() => {
    return () => {
      if (albumCoverUrl) {
        URL.revokeObjectURL(albumCoverUrl);
      }
      if (nextAlbumCoverUrl) {
        URL.revokeObjectURL(nextAlbumCoverUrl);
      }
      if (prevAlbumCoverUrl) {
        URL.revokeObjectURL(prevAlbumCoverUrl);
      }
    };
  }, [albumCoverUrl, nextAlbumCoverUrl, prevAlbumCoverUrl]);

  // 删除复杂的动画逻辑

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    console.log('[Progress] Click event triggered', e.currentTarget, e.target);
    
    if (!progressBarRef.current || !displayTrack?.duration_ms) {
      console.log('[Progress] Click failed: Missing required conditions', {
        hasRef: !!progressBarRef.current,
        hasDuration: !!displayTrack?.duration_ms,
        displayTrack: displayTrack
      });
      return;
    }
    
    // 阻止事件冒泡，避免与拖拽事件冲突
    e.preventDefault();
    e.stopPropagation();
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newPosition = percentage * displayTrack.duration_ms;
    
    // 添加波纹效果
    const rippleX = (clickX / rect.width) * 100;
    const ripple = { x: rippleX, key: Date.now() };
    setProgressRipples(prev => [...prev, ripple]);
    setTimeout(() => {
      setProgressRipples(prev => prev.filter(r => r.key !== ripple.key));
    }, 600);
    
    console.log('[Progress] Click calculation:', {
      clickX,
      width: rect.width,
      percentage,
      newPosition,
      duration: displayTrack.duration_ms
    });
    
    handleSeek(newPosition);
  };

  // 🔧 修复：使用useMemo稳定displayTrack引用，避免ImmersiveLyricsView无限重渲染
  // 只在track.id变化时才更新引用，避免对象引用变化导致的闪烁
  const displayTrack = useMemo(() => {
    return playerState.current_track || currentTrack;
  }, [playerState.current_track?.id, currentTrack?.id]);

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!displayTrack?.duration_ms) return;
    
    setIsDragging(true);
    const rect = progressBarRef.current!.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newPosition = percentage * displayTrack.duration_ms;
    setDragPosition(newPosition);
    dragPositionRef.current = newPosition; // 同步更新 ref
  };

  // 进度条拖拽
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!progressBarRef.current || !displayTrack?.duration_ms) return;
      
      const rect = progressBarRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, mouseX / rect.width));
      const newPosition = percentage * displayTrack.duration_ms;
      setDragPosition(newPosition);
      dragPositionRef.current = newPosition; // 同步更新 ref
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // 使用 ref 获取最新的拖拽位置，避免闭包陷阱
      const finalPosition = dragPositionRef.current;
      console.log('[Progress] Drag ended, executing seek:', finalPosition);
      handleSeek(finalPosition);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, displayTrack?.duration_ms]);

  // 🔊 音量条拖拽
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isVolumeDragging || !volumeSliderRef.current) return;
      
      const rect = volumeSliderRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, mouseX / rect.width));
      
      handleVolumeChange(percentage);
    };

    const handleMouseUp = () => {
      if (isVolumeDragging) {
        setIsVolumeDragging(false);
      }
    };

    if (isVolumeDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isVolumeDragging]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 处理封面点击，启动沉浸式歌词
  const handleAlbumCoverClick = () => {
    setShowLyrics(true);
  };

  // 🔥 实时更新位置（用于流畅的进度条）
  useEffect(() => {
    if (!playerState.is_playing) {
      // 暂停时使用静态位置
      setRealTimePosition(getPosition());
      return;
    }
    
    let frameId: number;
    const updatePosition = () => {
      const pos = getPosition();
      setRealTimePosition(pos);
      frameId = requestAnimationFrame(updatePosition);
    };
    
    frameId = requestAnimationFrame(updatePosition);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [playerState.is_playing, getPosition]);

  const getCurrentPosition = () => {
    // 🔧 修复：直接调用 getPosition() 获取实时位置，而不是使用固定的 playerState.position_ms
    // 拖拽时使用拖拽位置，否则使用实时位置
    const position = isDragging ? dragPosition : realTimePosition;
    return position;
  };

  return (
    <>
      <div className="modern-player">
        {/* 上行：主控制区 */}
        <div className="player-container">
          {/* 左侧区域 - 水平布局：封面 + 信息区 */}
          <div className="player-left-section">
            {/* 专辑缩略图 */}
            <div 
              ref={albumThumbnailRef}
              className="album-thumbnail" 
              onClick={handleAlbumCoverClick}
              title="点击查看歌词"
            >
              <div className={`album-cover-container ${coverFlipAnimation}`}>
                {/* 正面封面 */}
                <div className="album-cover-front">
                  {albumCoverUrl ? (
                    <img 
                      src={albumCoverUrl} 
                      alt={displayTrack?.album || '专辑封面'}
                      className="album-image"
                      onError={() => setAlbumCoverUrl(null)}
                    />
                  ) : (
                    <div className="album-placeholder">
                      <svg className="w-5 h-5 text-slate-400 dark:text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  )}
                </div>
                
                {/* 背面封面（根据翻转方向智能选择） */}
                <div className="album-cover-back">
                  {(() => {
                    // 如果正在翻转，显示对应方向的封面；否则显示下一首封面作为默认
                    let backCoverUrl;
                    if (coverFlipAnimation === 'flip-next') {
                      backCoverUrl = nextAlbumCoverUrl;
                    } else if (coverFlipAnimation === 'flip-prev') {
                      backCoverUrl = prevAlbumCoverUrl;
                    } else {
                      // 不翻转时，默认准备下一首封面在背面
                      backCoverUrl = lastFlipDirection === 'next' ? nextAlbumCoverUrl : prevAlbumCoverUrl;
                    }
                    
                    return backCoverUrl ? (
                      <img 
                        src={backCoverUrl} 
                        alt="新歌曲专辑封面"
                        className="album-image"
                      />
                    ) : (
                      <div className="album-placeholder">
                        <svg className="w-5 h-5 text-slate-400 dark:text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* 信息区：垂直堆叠 */}
            <div className="left-info-wrapper">
              {/* 第一行：歌名 - 歌手 */}
              <div className="left-top-area">
                <div className={`left-song-info ${infoSlideAnimation}`}>
                  {displayTrack ? (
                    <>
                      <span className="track-title">
                        {displayTrack.title || '未知曲目'}
                      </span>
                      <span className="track-artist">
                        - {displayTrack.artist || '未知艺术家'}
                      </span>
                    </>
                  ) : (
                    <span className="track-title text-slate-400 dark:text-dark-600">
                      未播放
                    </span>
                  )}
                </div>
              </div>

              {/* 第二行：当前歌词 */}
              <div 
                ref={lyricContainerRef}
                className={`current-lyric-display ${!currentLyric ? 'empty' : ''}`}
              >
                {(() => {
                  if (isLoadingLyrics) {
                    return (
                      <span className="loading-lyrics">
                        <svg className="animate-spin h-3 w-3 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <circle cx="12" cy="12" r="10" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" opacity="0.25"/>
                          <path d="M12 2a10 10 0 0 1 10 10" strokeWidth="3" strokeLinecap="round"/>
                        </svg>
                        正在加载歌词...
                      </span>
                    );
                  }
                  
                  if (currentLyric) {
                    return (
                      <LyricContent 
                        text={currentLyric} 
                        animation={lyricAnimation}
                        containerRef={lyricContainerRef}
                      />
                    );
                  }
                  
                  // 🎵 只在歌曲开始且未播放过歌词时显示"等待歌词..."
                  if (lyrics.length > 0 && !hasPlayedLyric) {
                    return (
                      <span className="text-[#86868B] dark:text-dark-600 text-sm">
                        ♪ 等待歌词...
                      </span>
                    );
                  }
                  
                  return '暂无歌词';
                })()}
              </div>
            </div>
          </div>

          {/* 中间区域 - 垂直布局：上层播放控制 + 下层进度条 */}
          <div className="transport-area">
            {/* 上层：播放控制 + 功能按钮 */}
            <div 
              ref={transportControlsRef}
              className="transport-controls"
            >
              {/* 左侧按钮组 */}
              <div className="controls-left">
                {/* 收藏按钮 */}
                <button 
                  onClick={toggleFavorite}
                  className={`control-icon-btn ${isFavorite ? 'text-red-500' : ''}`}
                  title={isFavorite ? '取消收藏' : '收藏'}
                >
                  <svg className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>

                {/* 上一首 */}
                <button
                  onClick={handlePrevious}
                  className="control-medium-btn"
                  title="上一首"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                  </svg>
                </button>
              </div>

              {/* 中间：播放/暂停按钮 */}
              <button
                onClick={handlePlayPauseToggle}
                className="control-main-btn"
                title={playerState.is_playing ? '暂停' : '播放'}
              >
                {playerState.is_playing ? (
                  <svg className="w-6 h-6 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
                    <rect width="3.5" height="14" x="6" y="5" rx="1.5"></rect>
                    <rect width="3.5" height="14" x="14.5" y="5" rx="1.5"></rect>
                  </svg>
                ) : (
                  <svg className="w-6 h-6 play-icon drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>

              {/* 右侧按钮组 */}
              <div className="controls-right">
                {/* 下一首 */}
                <button
                  onClick={handleNext}
                  className="control-medium-btn"
                  title="下一首"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                  </svg>
                </button>

                {/* 歌词按钮 */}
                {displayTrack && (
                  <button
                    onClick={() => setShowLyricsManager(true)}
                    className="control-icon-btn"
                    title="歌词"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* 下层：进度条 - Apple Music 风格 */}
            <div className="progress-area">
              <span className="time-current">
                {displayTrack ? formatTime(getCurrentPosition()) : '--:--'}
              </span>
              
              <div 
                ref={progressBarRef}
                className="progress-container"
                onClick={handleProgressClick}
                onMouseDown={handleProgressMouseDown}
              >
                <div className="progress-track">
                  <div 
                    className="progress-fill"
                    style={{
                      width: displayTrack?.duration_ms
                        ? `${(getCurrentPosition() / displayTrack.duration_ms) * 100}%`
                        : '0%'
                    }}
                  >
                    <div className={`progress-handle ${isDragging ? 'active' : ''}`} />
                  </div>
                </div>
                {progressRipples.map(ripple => (
                  <div
                    key={ripple.key}
                    className="progress-ripple"
                    style={{'--ripple-x': `${ripple.x}%`} as React.CSSProperties}
                  />
                ))}
              </div>
              
              <span className="time-total">
                {displayTrack?.duration_ms ? formatTime(displayTrack.duration_ms) : '--:--'}
              </span>
            </div>
          </div>

          {/* 右侧：功能区 */}
          <div className="player-right-section">
            {/* 音量控制 - 图标+横向滑块 */}
            <div className="volume-control">
              <button 
                className="volume-icon-btn" 
                onClick={handleToggleMute}
                title={isMuted ? '取消静音' : '静音'}
              >
                {isMuted || volume === 0 ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : volume < 0.5 ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                )}
              </button>
              <div 
                ref={volumeSliderRef}
                className="volume-slider-container"
                onClick={handleVolumeClick}
                onMouseDown={handleVolumeMouseDown}
              >
                <div className="volume-slider-fill" style={{ width: `${volume * 100}%` }}>
                  <div className={`volume-slider-handle ${isVolumeDragging ? 'active' : ''}`} />
                </div>
              </div>
            </div>

            {/* 歌词 */}
            {displayTrack && (
              <button
                onClick={() => setShowLyricsManager(true)}
                className="function-square-btn"
                title="歌词"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}

            {/* 更多 */}
            <button className="function-square-btn" title="更多选项">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 沉浸式歌词 */}
      {showLyrics && displayTrack && (
        <ImmersiveLyricsView
          key={`lyrics-${displayTrack.id}`}
          track={displayTrack}
          isPlaying={playerState.is_playing}
          onClose={handleLyricsClose}
          onError={handleLyricsError}
        />
      )}

      {/* 歌词管理弹窗 */}
      {showLyricsManager && displayTrack && (
        <LyricsManager
          track={displayTrack}
          onClose={() => setShowLyricsManager(false)}
          onSave={() => {
            // 歌词保存后，如果正在显示歌词，刷新显示
            if (showLyrics) {
              // 触发LyricsDisplay重新加载，可以通过key变化来实现
              setShowLyrics(false);
              setTimeout(() => setShowLyrics(true), 100);
            }
          }}
        />
      )}

      {/* 音频设备故障排除弹窗 */}
      {showAudioTroubleshooter && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-start justify-center z-50 pt-16 pb-32 overflow-y-auto">
          <div className="liquid-glass liquid-glass-advanced liquid-glass-depth w-full max-w-xl mx-4 rounded-2xl shadow-2xl shadow-black/20 overflow-hidden my-auto">
            {/* 故障排除标题栏 */}
            <div className="liquid-glass-content p-6 border-b border-white/20 bg-gradient-to-r from-red-100/20 to-orange-100/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-dark-900">音频设备错误</h3>
                    <p className="text-sm text-slate-600 dark:text-dark-700">播放器无法访问音频设备</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAudioTroubleshooter(false)}
                  className="p-2 liquid-glass liquid-glass-interactive rounded-full transition-colors hover:bg-white/20"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* 故障排除内容 */}
            <div className="liquid-glass-content p-6">
              <div className="space-y-4">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <h4 className="font-medium text-red-800 dark:text-red-300 mb-2">错误信息</h4>
                  <p className="text-sm text-red-700 dark:text-red-300 font-mono bg-red-100 dark:bg-red-900/30 p-2 rounded">
                    {audioDeviceError}
                  </p>
                </div>
                
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-3">故障排除步骤</h4>
                  <ol className="space-y-2 text-sm text-blue-700">
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-50 dark:bg-blue-900/20 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
                      <span>检查音频设备是否正确连接（耳机/音响）</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-50 dark:bg-blue-900/20 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">2</span>
                      <span>确认Windows音频服务正在运行</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-50 dark:bg-blue-900/20 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">3</span>
                      <span>检查Windows声音设置中的默认播放设备</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-50 dark:bg-blue-900/20 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">4</span>
                      <span>确保没有其他应用独占音频设备</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-50 dark:bg-blue-900/20 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">5</span>
                      <span>更新或重新安装音频驱动程序</span>
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="liquid-glass-content p-6 border-t border-white/20 bg-gradient-to-r from-white/20 to-white/10">
              <div className="flex justify-between">
                <button
                  onClick={() => setShowAudioTroubleshooter(false)}
                  className="px-4 py-2 text-slate-600 dark:text-dark-700 liquid-glass liquid-glass-interactive hover:bg-white/30 dark:hover:bg-white/10 rounded-lg transition-colors"
                >
                  稍后处理
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={checkAudioDevices}
                    className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    重新检测音频设备
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
