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
          animationDuration: `${animationDuration}s`
        } : undefined}
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
  const progressBarRef = useRef<HTMLDivElement>(null);
  
  const transportControlsRef = useRef<HTMLDivElement>(null);
  
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
  const [lyrics, setLyrics] = useState<Array<{ time: number; text: string }>>([]);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  
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
  
  // 收藏状态
  const [isFavorite, setIsFavorite] = useState(false);
  
  // 后端就绪状态
  const [isAppReady, setIsAppReady] = useState(false);
  
  // 动画状态
  // const [shuffleAnimating, setShuffleAnimating] = useState(false);
  // const [repeatAnimating, setRepeatAnimating] = useState(false);
  const [progressRipples, setProgressRipples] = useState<{x: number; key: number}[]>([]);

  // 等待后端就绪
  useEffect(() => {
    if (typeof listen === 'undefined') return;

    const setupReadyListener = async () => {
      const unlistenAppReady = await listen('app-ready', () => {
        console.log('✅ PlaylistPlayer：后端就绪');
        setIsAppReady(true);
      });

      return () => {
        if (typeof unlistenAppReady === 'function') unlistenAppReady();
      };
    };

    const cleanup = setupReadyListener();
    return () => {
      cleanup.then(fn => fn && fn());
    };
  }, []);

  useEffect(() => {
    // ✅ 移除重复的事件监听 - PlaybackContext已经处理了player-state/track/position-changed
    // 只保留UI专属的错误处理监听
    
    const unlistenPlayerError = listen('player-error', (event: any) => {
      console.error('🎵 播放器错误:', event.payload);
      
      // 显示所有播放器错误
      const errorMessage = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload);
      setAudioDeviceError(errorMessage);
      setShowAudioTroubleshooter(true);
      
      // 特别处理音频设备相关错误
      if (errorMessage.includes('NoDevice') || 
          errorMessage.includes('音频设备') || 
          errorMessage.includes('sink') ||
          errorMessage.includes('播放列表为空')) {
        console.warn('🎵 检测到音频系统问题:', errorMessage);
      }
    });

    // 监听歌曲完成事件
    const unlistenTrackCompleted = listen('track-completed', async (event: any) => {
      console.log('🎵 歌曲播放完成:', event.payload);
      // 🎵 自动播放下一曲
      try {
        await invoke('player_next');
        console.log('🎵 自动切换到下一曲');
      } catch (error) {
        console.error('🎵 自动切换下一曲失败:', error);
      }
    });

    // 监听播放列表完成事件
    const unlistenPlaylistCompleted = listen('playlist-completed', () => {
      console.log('🎵 播放列表播放完成');
      toast.info('播放列表已全部播放完毕', 3000);
      // 可以询问是否重新播放
    });

    // 监听音频设备失败事件
    const unlistenAudioDeviceFailed = listen('audio-device-failed', (event: any) => {
      const { error, recoverable } = event.payload || {};
      console.error('🎵 音频设备失败:', { error, recoverable });
      
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
      console.log('🎵 音频设备已就绪');
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
        console.log('🎵 初始化播放列表');
        await ensurePlaylistLoaded();
      } catch (error) {
        console.error('🎵 初始化播放列表失败:', error);
      }
    };

    // 延迟初始化，让其他组件先完成加载
    const timer = setTimeout(initializePlaylist, 500);

    return () => clearTimeout(timer);
  }, [isAppReady]);

  const handlePlay = async () => {
    try {
      if (currentTrack) {
        console.log('🎵 开始播放曲目:', currentTrack);
        
        // 在播放前确保播放列表已加载
        await ensurePlaylistLoaded();
        
        await invoke('player_play', { trackId: currentTrack.id, timestamp: Date.now() });
        console.log('🎵 播放命令发送成功');
        
        // 清除任何之前的错误
        setAudioDeviceError(null);
        setShowAudioTroubleshooter(false);
      } else {
        console.warn('🎵 没有选中的曲目无法播放');
      }
    } catch (error) {
      console.error('🎵 播放失败:', error);
      
      // 显示播放错误
      const errorMessage = error instanceof Error ? error.message : String(error);
      setAudioDeviceError(errorMessage);
      setShowAudioTroubleshooter(true);
    }
  };

  // 确保播放列表已加载
  const ensurePlaylistLoaded = async () => {
    try {
      console.log('🎵 确保播放列表已加载，当前随机模式:', playerState.shuffle);
      await invoke('load_playlist_by_mode', { shuffle: playerState.shuffle });
      console.log('🎵 播放列表加载完成');
      
      // 调试：获取播放列表内容验证
      try {
        const playlist = await invoke('generate_sequential_playlist') as any[];
        console.log('🎵 当前播放列表验证:', playlist.length, '首歌曲');
        console.log('🎵 播放列表前3首:', playlist.slice(0, 3).map(t => ({ id: t.id, title: t.title, path: t.path })));
      } catch (e) {
        console.warn('🎵 播放列表验证失败:', e);
      }
    } catch (error) {
      console.error('🎵 播放列表加载失败:', error);
    }
  };

  const handlePause = async () => {
    try {
      await invoke('player_pause');
    } catch (error) {
      console.error('暂停失败:', error);
    }
  };

  const handleResume = async () => {
    try {
      await invoke('player_resume');
    } catch (error) {
      console.error('继续播放失败:', error);
    }
  };

  const handleNext = async () => {
    try {
      await invoke('player_next');
    } catch (error) {
      console.error('下一首失败:', error);
    }
  };

  const handlePrevious = async () => {
    try {
      await invoke('player_previous');
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
    console.log('🎵 开始跳转到位置:', positionMs, 'ms');
    try {
      // 确保传递整数给Rust后端
      await invoke('player_seek', { positionMs: Math.floor(positionMs) });
      console.log('🎵 跳转命令发送成功');
      
      // If it was playing, ensure it resumes after seek
      if (playerState.is_playing) {
        console.log('🎵 跳转后恢复播放');
        await invoke('player_resume');
      }
    } catch (error) {
      console.error('🎵 跳转失败:', error);
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
    
    // 同步到后端
    try {
      await invoke('player_set_volume', { volume: clampedVolume });
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
        console.log(`✨ 已收藏: ${track.title || '未知歌曲'}`);
      } else {
        console.log(`💔 已取消收藏: ${track.title || '未知歌曲'}`);
      }
    } catch (error) {
      console.error('切换收藏状态失败:', error);
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
      console.log(`🎵 [歌词调试] 跳过重复加载 trackId=${trackId}`);
      return;
    }
    
    console.log('🎵 [歌词调试] 曲目改变:', {
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
      console.log(`🎵 [歌词调试] 开始加载 trackId=${trackId}, requestId=${lyricsRequestId}`);
      loadAlbumCover(trackId);
      checkFavoriteStatus(trackId);
      loadLyrics(trackId, lyricsRequestId);
    } else {
      console.log('🎵 [歌词调试] 无有效 track ID，清空状态');
      setIsFavorite(false);
      setLyrics([]);
      setCurrentLyric('');
      setIsLoadingLyrics(false);
    }
  }, [playerState.current_track?.id, currentTrack?.id]);

  // 🎵 获取歌词（方案A：数据库 → 文件系统降级）
  const loadLyrics = async (trackId: number, requestId: number) => {
    try {
      console.log(`🎵 [LRC#${requestId}] 开始加载歌词，trackId:`, trackId);
      
      // 🔧 检查请求是否已过期
      if (requestId !== lyricsRequestIdRef.current) {
        console.log(`⏭️ [LRC#${requestId}] 歌词请求已过期，跳过`);
        return;
      }
      
      const track = playerState.current_track || currentTrack;
      if (!track) {
        console.warn('❌ 没有当前曲目信息');
        setLyrics([]);
        return;
      }
      
      // 1️⃣ 查询数据库
      const dbLyrics = await invoke('lyrics_get', { 
        trackId: trackId 
      }) as { content: string; format: string; source: string } | null;
      
      if (dbLyrics && dbLyrics.content) {
        // 🔧 检测并清理损坏数据
        if (dbLyrics.content.includes('[NaN:')) {
          console.warn('⚠️ 检测到损坏的数据库歌词，已跳过');
          await invoke('lyrics_delete', { trackId: trackId }).catch(() => {});
        } else {
          const parsedLyrics = parseLrc(dbLyrics.content);
          if (parsedLyrics.length > 0) {
            console.log(`✅ [LRC#${requestId}] 从数据库加载歌词成功，共 ${parsedLyrics.length} 行`);
            setLyrics(parsedLyrics);
            return;
          }
        }
      }
      
      // 2️⃣ 查询文件系统（降级）
      console.log(`🔍 [LRC#${requestId}] 数据库未找到，尝试文件系统...`);
      const fileLyrics = await invoke('lyrics_search_comprehensive', { 
        audioPath: track.path 
      }) as any;
      
      if (fileLyrics && fileLyrics.lines && fileLyrics.lines.length > 0) {
        console.log(`✅ [LRC#${requestId}] 从文件系统加载歌词成功，共 ${fileLyrics.lines.length} 行`);
        
        // 转换为前端格式
        const lyrics = fileLyrics.lines.map((line: any) => ({
          time: line.timestamp_ms,
          text: line.text
        }));
        
        setLyrics(lyrics);
        return;
      }
      
      // 3️⃣ 都没有找到
      console.log(`❌ [LRC#${requestId}] 未找到歌词`);
      setLyrics([]);
      setCurrentLyric('');
      
    } catch (error) {
      console.error(`❌ [LRC#${requestId}] 加载歌词失败:`, error);
      setLyrics([]);
      setCurrentLyric('');
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

    console.log(`🎵 [歌词更新] 启动定时器，共 ${lyrics.length} 行歌词`);
    
    // 追踪上一次的歌词索引，避免重复日志
    let lastIndex = -1;

    // 使用定时器持续更新歌词
    const updateLyric = () => {
      const currentPosition = getCurrentPosition();
      
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
        const lyricText = lyrics[currentIndex].text;
        setCurrentLyric(lyricText);
        console.log(`🎵 [歌词更新] ${Math.floor(currentPosition/1000)}s -> [${currentIndex}/${lyrics.length}] ${lyricText.substring(0, 20)}...`);
        lastIndex = currentIndex;
      } else if (currentIndex < 0) {
        setCurrentLyric('');
      }
    };

    // 立即更新一次
    updateLyric();

    // 每100ms更新一次歌词
    const interval = setInterval(updateLyric, 100);

    return () => {
      console.log(`🎵 [歌词更新] 清理定时器`);
      clearInterval(interval);
    };
  }, [lyrics, playerState.is_playing, isDragging, dragPosition]);

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
    };
  }, [albumCoverUrl]);

  // 删除复杂的动画逻辑

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    console.log('🎵 进度条点击事件触发', e.currentTarget, e.target);
    
    if (!progressBarRef.current || !displayTrack?.duration_ms) {
      console.log('🎵 进度条点击失败: 缺少必要条件', {
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
    
    console.log('🎵 进度条点击计算:', {
      clickX,
      width: rect.width,
      percentage,
      newPosition,
      duration: displayTrack.duration_ms
    });
    
    handleSeek(newPosition);
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!displayTrack?.duration_ms) return;
    
    setIsDragging(true);
    const rect = progressBarRef.current!.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    setDragPosition(percentage * displayTrack.duration_ms);
  };

  // 进度条拖拽
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !progressBarRef.current || !displayTrack?.duration_ms) return;
      
      const rect = progressBarRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, mouseX / rect.width));
      setDragPosition(percentage * displayTrack.duration_ms);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        handleSeek(dragPosition);
        setIsDragging(false);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragPosition, playerState.current_track, currentTrack]);

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

  // 🔧 修复：使用useMemo稳定displayTrack引用，避免ImmersiveLyricsView无限重渲染
  // 只在track.id变化时才更新引用，避免对象引用变化导致的闪烁
  const displayTrack = useMemo(() => {
    return playerState.current_track || currentTrack;
  }, [playerState.current_track?.id, currentTrack?.id]);

  const getCurrentPosition = () => {
    // 🔧 修复：直接调用 getPosition() 获取实时位置，而不是使用固定的 playerState.position_ms
    const position = isDragging ? dragPosition : getPosition();
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
              <div className="album-cover-container">
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
            </div>

            {/* 信息区：垂直堆叠 */}
            <div className="left-info-wrapper">
              {/* 第一行：歌名 - 歌手 */}
              <div className="left-top-area">
                <div className="left-song-info">
                  <span className="track-title">
                    {displayTrack?.title || '如果当时'}
                  </span>
                  <span className="track-artist">
                    - {displayTrack?.artist || '许嵩'}
                  </span>
                </div>
              </div>

              {/* 第二行：当前歌词 */}
              <div 
                ref={lyricContainerRef}
                className={`current-lyric-display ${!currentLyric ? 'empty' : ''}`}
              >
                {isLoadingLyrics ? (
                  <span className="loading-lyrics">
                    <svg className="animate-spin h-3 w-3 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <circle cx="12" cy="12" r="10" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" opacity="0.25"/>
                      <path d="M12 2a10 10 0 0 1 10 10" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    正在加载歌词...
                  </span>
                ) : currentLyric ? (
                  <LyricContent 
                    text={currentLyric} 
                    animation={lyricAnimation}
                    containerRef={lyricContainerRef}
                  />
                ) : lyrics.length > 0 ? (
                  '♪'
                ) : (
                  '暂无歌词'
                )}
              </div>

              {/* 第三行：按钮组（与歌词容器重叠） */}
              <div className="left-bottom-buttons">
                {/* 收藏 */}
                <button 
                  className={`function-square-btn ${isFavorite ? 'active' : ''}`} 
                  onClick={toggleFavorite}
                  title={isFavorite ? '取消收藏' : '收藏'}
                >
                  <svg className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>

                {/* 评论 */}
                <button className="function-square-btn" title="评论">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </button>

                {/* 更多 */}
                <button className="function-square-btn" title="更多">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* 中间区域 - 垂直布局：上层播放控制 + 下层进度条 */}
          <div className="transport-area">
            {/* 上层：播放控制 */}
            <div 
              ref={transportControlsRef}
              className="transport-controls"
            >
              {/* 投屏 */}
              <button className="control-small-btn" title="投屏">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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

              {/* 播放/暂停 */}
              <button
                onClick={playerState.is_playing ? handlePause : (displayTrack ? handlePlay : handleResume)}
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

              {/* 音效 */}
              <button className="control-small-btn" title="音效">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M6 10h2a2 2 0 012 2v0a2 2 0 01-2 2H6v-4zm0 0V6a2 2 0 012-2h10a2 2 0 012 2v4m-6 4v4m-4-4v4" />
                </svg>
              </button>
            </div>

            {/* 下层：进度条 */}
            <div className="progress-area">
              <span className="time-current">
                {formatTime(getCurrentPosition())}
              </span>
              
              <div 
                ref={progressBarRef}
                className="progress-container"
                onClick={handleProgressClick}
                onMouseDown={handleProgressMouseDown}
              >
                <div className="progress-track" />
                <div 
                  className="progress-bar"
                  style={{
                    width: displayTrack?.duration_ms 
                      ? `${(getCurrentPosition() / displayTrack.duration_ms) * 100}%`
                      : '35%'
                  }}
                >
                  <div className={`progress-handle ${isDragging ? 'active' : ''}`} />
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
                {displayTrack?.duration_ms ? formatTime(displayTrack.duration_ms) : '2:56'}
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

            {/* 均衡器 */}
            <button className="function-square-btn" title="音效均衡器">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </button>
            
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50">
          <div className="liquid-glass liquid-glass-advanced liquid-glass-depth w-full max-w-lg mx-4 rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
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
