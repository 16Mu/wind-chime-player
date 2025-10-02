import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';

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

  // 提供高频状态访问接口（确保返回值类型安全）
  const getPosition = useCallback((): number => {
    // ✅ 类型保护：确保始终返回有效的number
    const position = positionRef.current;
    if (typeof position !== 'number' || isNaN(position)) {
      return 0; // 返回默认值而不是undefined
    }
    return position;
  }, []);

  // 状态更新方法
  const updateState = useCallback((updates: Partial<PlaybackState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const frameRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number | null>(null);
  const fallbackActiveRef = useRef<boolean>(false);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [positionVersion, setPositionVersion] = useState(0);

  // 监听Tauri事件同步完整的播放器状态
  useEffect(() => {
    // 监听完整的播放器状态变化（包含所有字段）
    const unlistenState = listen('player-state-changed', (event: any) => {
      const rustState = event.payload as any;

      updateState({
        track: rustState.current_track || null,
        isPlaying: rustState.is_playing || false,
        volume: rustState.volume ?? 1.0,
        repeatMode: rustState.repeat_mode || 'Off',
        shuffle: rustState.shuffle || false,
      });

      const position = typeof rustState.position_ms === 'number' && !isNaN(rustState.position_ms)
        ? rustState.position_ms
        : 0;
      positionRef.current = position;
      lastTickTimeRef.current = performance.now();

      if (rustState.is_playing) {
        fallbackActiveRef.current = false;
        if (fallbackTimeoutRef.current) {
          clearTimeout(fallbackTimeoutRef.current);
          fallbackTimeoutRef.current = null;
        }
      }
    });

    // 监听曲目变化（向后兼容）
    const unlistenTrack = listen('player-track-changed', (event: any) => {
      updateState({ track: event.payload || null });
      // 切歌时重置本地进度，避免沿用上一首的时间
      positionRef.current = 0;
      lastTickTimeRef.current = performance.now();

      // 若后端暂未推送播放状态，启用临时补偿，避免等待
      fallbackActiveRef.current = true;
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
      }
      fallbackTimeoutRef.current = setTimeout(() => {
        fallbackActiveRef.current = false;
        fallbackTimeoutRef.current = null;
      }, 10000); // 最多补偿10秒，待后端状态接管
    });

    // 监听播放位置变化（高频，使用ref存储）
    const unlistenPosition = listen('player-position-changed', (event: any) => {
      positionRef.current = event.payload as number;
      lastTickTimeRef.current = performance.now();

      // 收到真实位置后，可关闭临时补偿
      if (fallbackActiveRef.current) {
        fallbackActiveRef.current = false;
        if (fallbackTimeoutRef.current) {
          clearTimeout(fallbackTimeoutRef.current);
          fallbackTimeoutRef.current = null;
        }
      }
    });

    return () => {
      unlistenState.then(fn => fn());
      unlistenTrack.then(fn => fn());
      unlistenPosition.then(fn => fn());
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
    };
  }, [updateState]);

  // 本地补偿：当后端暂未推送位置事件时，使用 rAF 持续推进位置
  useEffect(() => {
    if (!state.isPlaying && !fallbackActiveRef.current) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastTickTimeRef.current = null;
      return;
    }

    lastTickTimeRef.current = performance.now();

    const tick = () => {
      const now = performance.now();
      if (lastTickTimeRef.current !== null) {
        const delta = now - lastTickTimeRef.current;
        if (delta > 0) {
          positionRef.current += delta;
          setPositionVersion(v => v + 1);
        }
      }
      lastTickTimeRef.current = now;
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [state.isPlaying, state.track?.id]);

  useEffect(() => {
    if (!state.isPlaying && !fallbackActiveRef.current) {
      const timer = setTimeout(() => setPositionVersion(v => v + 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [state.isPlaying, fallbackActiveRef.current]);

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

