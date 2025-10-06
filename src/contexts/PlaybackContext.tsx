import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode, useMemo } from 'react';
import { webAudioPlayer } from '../services/webAudioPlayer';

// ==================== 类型定义 ====================

export interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
}

export interface PlaybackState {
  track: Track | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  repeatMode: 'Off' | 'One' | 'All';  // 重复模式
  shuffle: boolean;                    // 随机播放
}

// ==================== Context类型 ====================

interface PlaybackContextType {
  // 低频状态（会触发重渲染）
  state: PlaybackState;
  
  // 高频状态访问接口（不触发重渲染）
  getPosition: () => number;
  
  // 控制方法
  updateState: (updates: Partial<PlaybackState>) => void;
}

// ==================== Context创建 ====================

const PlaybackContext = createContext<PlaybackContextType | null>(null);

// ==================== 自定义Hooks（低耦合接口） ====================

/**
 * 获取播放状态（低频，会触发重渲染）
 * 用于：显示曲目信息、播放/暂停按钮状态等
 */
export function usePlaybackState() {
  const context = useContext(PlaybackContext);
  if (!context) {
    throw new Error('usePlaybackState must be used within PlaybackProvider');
  }
  return context.state;
}

/**
 * 获取播放位置（高频，不触发重渲染）
 * 用于：进度条、歌词同步等高频更新场景
 */
export function usePlaybackPosition() {
  const context = useContext(PlaybackContext);
  if (!context) {
    throw new Error('usePlaybackPosition must be used within PlaybackProvider');
  }
  return context.getPosition;
}

/**
 * 获取状态更新方法
 */
export function usePlaybackControl() {
  const context = useContext(PlaybackContext);
  if (!context) {
    throw new Error('usePlaybackControl must be used within PlaybackProvider');
  }
  return context.updateState;
}

// ==================== Provider组件 ====================

interface PlaybackProviderProps {
  children: ReactNode;
}

export function PlaybackProvider({ children }: PlaybackProviderProps) {
  // 低频状态（状态变更会触发重渲染）
  const [state, setState] = useState<PlaybackState>({
    track: null,
    isPlaying: false,
    volume: 1.0,
    isMuted: false,
    repeatMode: 'Off',
    shuffle: false,
  });

  // 高频状态（使用ref存储，变更不触发重渲染）
  const positionRef = useRef<number>(0);
  
  // 🎵 Web Audio Player 初始化标志
  const isPlayerInitialized = useRef<boolean>(false);

  // 提供高频状态访问接口（直接从 Web Audio Player 获取）
  const getPosition = useCallback((): number => {
    try {
      // 🔥 从 Web Audio Player 获取实时位置（0 延迟）
      const position = webAudioPlayer.getPosition();
      // 转换为毫秒
      return position * 1000;
    } catch (error) {
      console.error('获取播放位置失败:', error);
      return positionRef.current;
    }
  }, []);

  // 状态更新方法
  const updateState = useCallback((updates: Partial<PlaybackState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const frameRef = useRef<number | null>(null);
  const [positionVersion, setPositionVersion] = useState(0);

  // 🎵 初始化 Web Audio Player
  useEffect(() => {
    if (isPlayerInitialized.current) {
      return;
    }

    console.log('🎵 [PlaybackContext] 初始化 Web Audio Player...');
    
    const initPlayer = async () => {
      try {
        await webAudioPlayer.initialize({
          // 歌曲变化回调
          onTrackChanged: (track) => {
            console.log('🎵 [PlaybackContext] 歌曲变化:', track?.title || track?.path);
            setState(prev => ({ ...prev, track }));
            positionRef.current = 0;
          },
          
          // 播放状态变化回调
          onPlaybackStateChanged: (isPlaying) => {
            console.log('🎵 [PlaybackContext] 播放状态变化:', isPlaying);
            setState(prev => ({ ...prev, isPlaying }));
          },
          
          // 播放位置变化回调（100ms 一次）
          onPositionChanged: (position) => {
            positionRef.current = position * 1000; // 转换为毫秒
            setPositionVersion(v => v + 1);
          },
          
          // 音量变化回调
          onVolumeChanged: (volume) => {
            setState(prev => ({ ...prev, volume }));
          },
          
          // 歌曲结束回调
          onTrackEnded: () => {
            console.log('🎵 [PlaybackContext] 歌曲播放结束');
            // Web Audio Player 会自动播放下一首
          },
        });
        
        isPlayerInitialized.current = true;
        console.log('✅ [PlaybackContext] Web Audio Player 初始化完成');
      } catch (error) {
        console.error('❌ [PlaybackContext] Web Audio Player 初始化失败:', error);
      }
    };
    
    initPlayer();
    
    // 清理
    return () => {
      // Web Audio Player 会在应用关闭时自动清理
    };
  }, []);

  // ✅ Web Audio Player 已经处理了位置更新，不需要本地补偿
  // 保留 frameRef 用于强制刷新 UI
  useEffect(() => {
    if (!state.isPlaying) {
      return;
    }

    // 定期强制更新（确保 UI 刷新）
    const tick = () => {
      setPositionVersion(v => v + 1);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [state.isPlaying]);

  const contextValue = useMemo(() => ({
    state,
    getPosition,
    updateState,
  }), [state, getPosition, updateState, positionVersion]);

  return (
    <PlaybackContext.Provider value={contextValue}>
      {children}
    </PlaybackContext.Provider>
  );
}

