import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import ImmersiveLyricsView from './ImmersiveLyricsView';
import LyricsManager from './LyricsManager';

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

interface PlaylistPlayerProps {
  currentTrack: Track | null;
}

export default function PlaylistPlayer({ currentTrack }: PlaylistPlayerProps) {
  const [playerState, setPlayerState] = useState<PlayerState>({
    is_playing: false,
    position_ms: 0,
    volume: 1.0,
    repeat_mode: 'Off',
    shuffle: false,
    current_track: undefined,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);
  
  // 简化状态管理
  
  // 歌词相关状态
  const [showLyrics, setShowLyrics] = useState(false);
  const [showLyricsManager, setShowLyricsManager] = useState(false);
  
  // 音频设备状态
  const [audioDeviceError, setAudioDeviceError] = useState<string | null>(null);
  const [showAudioTroubleshooter, setShowAudioTroubleshooter] = useState(false);
  
  // 专辑封面状态
  const [albumCoverUrl, setAlbumCoverUrl] = useState<string | null>(null);
  
  // 收藏状态 (临时演示用)
  const [isFavorite, setIsFavorite] = useState(false);
  
  // 简化布局，移除复杂动画状态

  useEffect(() => {
    // 设置播放器事件监听器
    const unlistenStateChanged = listen('player-state-changed', (event: any) => {
      console.log('🎵 收到播放器状态变化:', event.payload);
      if (event.payload && typeof event.payload === 'object') {
        setPlayerState(event.payload);
      }
    });

    const unlistenTrackChanged = listen('player-track-changed', (event: any) => {
      console.log('🎵 收到曲目变化:', event.payload);
      // 注意：现在event.payload直接是track对象，不需要再访问.payload
      setPlayerState(prev => ({
        ...prev,
        current_track: event.payload,
      }));
    });

    const unlistenPositionChanged = listen('player-position-changed', (event: any) => {
      // 注意：现在event.payload直接是position数字
      console.log('🎵 收到位置更新:', event.payload);
      setPlayerState(prev => ({
        ...prev,
        position_ms: event.payload,
      }));
    });

    const unlistenPlayerError = listen('player-error', (event: any) => {
      console.error('🎵 播放器错误:', event.payload);
      
      // 检查是否是音频设备错误
      if (typeof event.payload === 'string' && event.payload.includes('NoDevice')) {
        setAudioDeviceError(event.payload);
        setShowAudioTroubleshooter(true);
      }
    });

    // 监听歌曲完成事件
    const unlistenTrackCompleted = listen('track-completed', (event: any) => {
      console.log('🎵 歌曲播放完成:', event.payload);
      // 可以在这里添加歌曲完成的UI反馈
    });

    // 监听播放列表完成事件
    const unlistenPlaylistCompleted = listen('playlist-completed', (event: any) => {
      console.log('🎵 播放列表播放完成');
      // 可以在这里添加播放列表完成的UI反馈
      // 例如显示通知或重置UI状态
    });

    return () => {
      unlistenStateChanged.then(fn => fn());
      unlistenTrackChanged.then(fn => fn());
      unlistenPositionChanged.then(fn => fn());
      unlistenPlayerError.then(fn => fn());
      unlistenTrackCompleted.then(fn => fn());
      unlistenPlaylistCompleted.then(fn => fn());
    };
  }, []);

  // 初始化播放列表
  useEffect(() => {
    const initializePlaylist = async () => {
      try {
        console.log('🎵 初始化播放列表');
        await ensurePlaylistLoaded();
      } catch (error) {
        console.error('🎵 初始化播放列表失败:', error);
      }
    };

    // 延迟初始化，让其他组件先完成加载
    const timer = setTimeout(initializePlaylist, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handlePlay = async () => {
    try {
      if (currentTrack) {
        console.log('🎵 开始播放曲目:', currentTrack);
        
        // 在播放前确保播放列表已加载
        await ensurePlaylistLoaded();
        
        await invoke('player_play', { trackId: currentTrack.id });
        console.log('🎵 播放命令发送成功');
      } else {
        console.warn('🎵 没有选中的曲目无法播放');
      }
    } catch (error) {
      console.error('🎵 播放失败:', error);
    }
  };

  // 确保播放列表已加载
  const ensurePlaylistLoaded = async () => {
    try {
      console.log('🎵 确保播放列表已加载，当前随机模式:', playerState.shuffle);
      await invoke('load_playlist_by_mode', { shuffle: playerState.shuffle });
      console.log('🎵 播放列表加载完成');
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


  const handleSeek = async (positionMs: number) => {
    try {
      await invoke('player_seek', { positionMs });
      // If it was playing, ensure it resumes after seek
      if (playerState.is_playing) {
        await invoke('player_resume');
      }
    } catch (error) {
      console.error('跳转失败:', error);
    }
  };

  const handleSetShuffle = async (shuffle: boolean) => {
    try {
      await invoke('player_set_shuffle', { shuffle });
      
      // 切换播放模式时重新生成播放列表
      console.log('🎵 播放模式切换，重新生成播放列表，随机模式:', shuffle);
      await invoke('load_playlist_by_mode', { shuffle });
      console.log('🎵 播放列表重新生成完成');
    } catch (error) {
      console.error('设置随机播放失败:', error);
    }
  };

  const handleCycleRepeat = async () => {
    try {
      let nextMode: 'Off' | 'All' | 'One';
      switch (playerState.repeat_mode) {
        case 'Off':
          nextMode = 'All';
          break;
        case 'All':
          nextMode = 'One';
          break;
        case 'One':
          nextMode = 'Off';
          break;
        default:
          nextMode = 'Off';
      }
      await invoke('player_set_repeat', { mode: nextMode });
    } catch (error) {
      console.error('设置重复模式失败:', error);
    }
  };

  const getRepeatModeTitle = () => {
    switch (playerState.repeat_mode) {
      case 'Off':
        return '开启重复播放';
      case 'All':
        return '重复播放全部 (点击切换到单曲循环)';
      case 'One':
        return '单曲循环 (点击关闭重复)';
      default:
        return '重复播放';
    }
  };

  const checkAudioDevices = async () => {
    try {
      const result = await invoke('check_audio_devices') as string;
      alert(`音频设备检测成功: ${result}`);
      setAudioDeviceError(null);
      setShowAudioTroubleshooter(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setAudioDeviceError(errorMessage);
      alert(`音频设备检测失败: ${errorMessage}`);
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

  // 当曲目变化时加载专辑封面
  useEffect(() => {
    // 优先使用播放器状态中的当前曲目，确保与实际播放保持同步
    const track = playerState.current_track || currentTrack;
    
    // 清理之前的URL
    const currentUrl = albumCoverUrl;
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      setAlbumCoverUrl(null);
    }

    if (track?.id) {
      loadAlbumCover(track.id);
    }
  }, [playerState.current_track?.id, currentTrack?.id]);

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
    if (!progressBarRef.current || !displayTrack?.duration_ms) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newPosition = percentage * displayTrack.duration_ms;
    
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

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 优先显示播放器状态中的当前曲目，确保与实际播放保持同步
  const displayTrack = playerState.current_track || currentTrack;

  const getCurrentPosition = () => {
    const position = isDragging ? dragPosition : playerState.position_ms;
    console.log('🎵 getCurrentPosition:', position, 'isDragging:', isDragging, 'playerState.position_ms:', playerState.position_ms);
    return position;
  };

  return (
    <>
      <div className="modern-player">
        {/* 严格按照图片的左中右三栏布局 */}
        <div className="player-container">
          
          {/* 左侧：专辑信息区 */}
          <div className="player-left-section">
            {/* 专辑缩略图 */}
            <div 
              className="album-thumbnail" 
              onClick={() => setShowLyrics(true)}
              title="点击查看歌词"
            >
              <div className="album-cover-container">
                {/* 专辑封面 */}
                {albumCoverUrl ? (
                  <img 
                    src={albumCoverUrl} 
                    alt={displayTrack?.album || '专辑封面'}
                    className="album-image"
                    onError={() => setAlbumCoverUrl(null)}
                  />
                ) : (
                  <div className="album-placeholder">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* 双行文字栈 */}
            <div className="track-text-stack">
              <div className="track-info-content">
                <div className="track-title">
                  {displayTrack?.title || 'Drank In My Cup'}
                </div>
                <div className="track-artist">
                  {displayTrack?.artist || 'Kirko Bangz'}
                </div>
              </div>
            </div>
          </div>

          {/* 中轴区：传输控制与进度条 - 新设计 */}
          <div className="transport-area">
            {/* 上行：传输控制 - 5格栅格布局 */}
            <div className="transport-controls">
              {/* 左侧小键：随机播放 */}
              <button
                onClick={() => handleSetShuffle(!playerState.shuffle)}
                className={`control-small-btn ${playerState.shuffle ? 'active' : ''}`}
                title={playerState.shuffle ? '关闭随机播放' : '开启随机播放'}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6m12 0l-3-3m3 3l-3 3M6 6l3 3 3-3M6 18l3-3 3 3" />
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

              {/* 播放/暂停 - 中心主键 */}
              <button
                onClick={playerState.is_playing ? handlePause : (displayTrack ? handlePlay : handleResume)}
                className="control-main-btn"
                title={playerState.is_playing ? '暂停' : '播放'}
              >
                {playerState.is_playing ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect width="4" height="16" x="6" y="4"></rect>
                    <rect width="4" height="16" x="14" y="4"></rect>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 play-icon" fill="currentColor" viewBox="0 0 24 24">
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

              {/* 右侧小键：循环播放 */}
              <button
                onClick={handleCycleRepeat}
                className={`control-small-btn ${playerState.repeat_mode !== 'Off' ? 'active' : ''}`}
                title={getRepeatModeTitle()}
              >
                {playerState.repeat_mode === 'One' ? (
                  <div className="relative">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12v8a2 2 0 002 2h8m0-10l4-4m0 0l4 4m-4-4v8" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12v-8a2 2 0 00-2-2h-8m0 10l-4 4m0 0l-4-4m4 4v-8" />
                    </svg>
                    <span className="repeat-indicator">1</span>
                  </div>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12v8a2 2 0 002 2h8m0-10l4-4m0 0l4 4m-4-4v8" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12v-8a2 2 0 00-2-2h-8m0 10l-4 4m0 0l-4-4m4 4v-8" />
                  </svg>
                )}
              </button>
            </div>

            {/* 下行：进度区 - 3格栅格布局 */}
            <div className="progress-area">
              {/* 当前时间 */}
              <span className="time-current">
                {formatTime(getCurrentPosition())}
              </span>
              
              {/* 进度条容器 - 与上行同宽并中心对齐 */}
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
                  {/* 进度条拖拽点 */}
                  <div className={`progress-handle ${
                    isDragging ? 'active' : ''
                  }`} />
                </div>
              </div>
              
              {/* 总时长 */}
              <span className="time-total">
                {displayTrack?.duration_ms ? formatTime(displayTrack.duration_ms) : '2:56'}
              </span>
            </div>
          </div>

          {/* 右侧：功能按钮区 */}
          <div className="player-right-section">
            {/* 收藏 */}
            <button 
              className={`function-square-btn ${isFavorite ? 'active' : ''}`} 
              onClick={() => setIsFavorite(!isFavorite)}
              title={isFavorite ? '取消收藏' : '收藏'}
            >
              <svg className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>

            {/* 分享 */}
            <button className="function-square-btn" title="分享">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
            </button>

            {/* 音量/设备 */}
            <button className="function-square-btn" title="音量">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 12a3 3 0 106 0 3 3 0 00-6 0z" />
              </svg>
            </button>

            {/* 菜单/更多 */}
            <button className="function-square-btn" title="更多选项">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            {/* 歌词管理按钮（仅在有歌曲时显示） */}
            {displayTrack && (
              <button
                onClick={() => setShowLyricsManager(true)}
                className="function-square-btn"
                title="编辑歌词"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 沉浸式歌词 */}
      {showLyrics && displayTrack && (
        <ImmersiveLyricsView
          track={displayTrack}
          currentPositionMs={getCurrentPosition()}
          isPlaying={playerState.is_playing}
          onClose={() => setShowLyrics(false)}
          onError={(error) => console.error('歌词显示错误:', error)}
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
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">音频设备错误</h3>
                    <p className="text-sm text-gray-600">播放器无法访问音频设备</p>
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
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-800 mb-2">错误信息</h4>
                  <p className="text-sm text-red-700 font-mono bg-red-100 p-2 rounded">
                    {audioDeviceError}
                  </p>
                </div>
                
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-3">故障排除步骤</h4>
                  <ol className="space-y-2 text-sm text-blue-700">
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
                      <span>检查音频设备是否正确连接（耳机/音响）</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">2</span>
                      <span>确认Windows音频服务正在运行</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">3</span>
                      <span>检查Windows声音设置中的默认播放设备</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">4</span>
                      <span>确保没有其他应用独占音频设备</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">5</span>
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
                  className="px-4 py-2 text-gray-600 liquid-glass liquid-glass-interactive hover:bg-white/30 rounded-lg transition-colors"
                >
                  稍后处理
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={checkAudioDevices}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
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
