import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
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
  
  // 🔥 引擎状态（用于智能路由位置获取）
  const webAudioPlayerRef = useRef<any>(null);
  const currentEngineRef = useRef<'rust' | 'webaudio'>('rust');
  const lastTrackIdRef = useRef<number | null>(null);
  
  // 🔥 双层 ref 模式：解决闭包问题
  const getPositionRef = useRef<() => number>(() => 0);
  
  // 🔥 更新 getPosition 实现（总是访问最新的 refs）
  getPositionRef.current = () => {
    const engine = currentEngineRef.current;
    
    // 🔥 如果是 Web Audio 引擎，直接从 Web Audio Player 获取
    if (engine === 'webaudio' && webAudioPlayerRef.current) {
      try {
        const position = webAudioPlayerRef.current.getPosition();
        const positionMs = position * 1000;
        return positionMs;
      } catch (error) {
        console.error('获取 Web Audio 位置失败:', error);
        return positionRef.current;
      }
    }
    
    // Rust 引擎：从 ref 获取（由 Tauri 事件更新）
    const position = positionRef.current;
    if (typeof position !== 'number' || isNaN(position)) {
      return 0;
    }
    
    return position;
  };
  
  // 🔥 导出的 getPosition（稳定引用）
  const getPosition = useCallback(() => getPositionRef.current(), []);

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

    console.log('🎵 [PlaybackContext] 初始化混合播放器...');
    
    const initPlayer = async () => {
      try {
        // 🔥 保存 Web Audio Player 引用（用于获取实时位置）
        webAudioPlayerRef.current = webAudioPlayer;
        
        // 🔥 第一步：初始化 Web Audio Player
        await webAudioPlayer.initialize({
          // 歌曲变化回调
          onTrackChanged: (track) => {
            console.log('🎵 [PlaybackContext] Web Audio 歌曲变化:', track?.title || track?.path);
            // 🔥 只在 Web Audio 引擎下更新 track
            if (currentEngineRef.current === 'webaudio') {
              setState(prev => ({ ...prev, track }));
              positionRef.current = 0;
            }
          },
          
          // 播放状态变化回调
          onPlaybackStateChanged: (isPlaying) => {
            console.log('🎵 [PlaybackContext] Web Audio 播放状态变化:', isPlaying);
            // 🔥 只在 Web Audio 引擎下更新状态
            if (currentEngineRef.current === 'webaudio') {
              setState(prev => ({ ...prev, isPlaying }));
            }
          },
          
          // 播放位置变化回调（100ms 一次）
          onPositionChanged: (position) => {
            // 🔥 只在 Web Audio 引擎下更新位置
            if (currentEngineRef.current === 'webaudio') {
              positionRef.current = position * 1000; // 转换为毫秒
            }
          },
          
          // 音量变化回调
          onVolumeChanged: (volume) => {
            setState(prev => ({ ...prev, volume }));
          },
          
          // 歌曲结束回调
          onTrackEnded: () => {
            console.log('🔚 [PlaybackContext] Web Audio 歌曲播放结束');
            // Rust 的 track-completed 事件会处理自动播放
          },
        });
        
        // 🔥 第二步：初始化混合播放器（添加引擎切换回调）
        const { hybridPlayer } = await import('../services/hybridPlayer');
        await hybridPlayer.initialize({
          // 引擎切换回调
          onEngineSwitch: (engine) => {
            console.log(`🔄 [PlaybackContext] 引擎切换: ${engine}`);
            
            // 🔥 更新当前引擎标志
            currentEngineRef.current = engine;
            
            if (engine === 'webaudio') {
              console.log('✅ [PlaybackContext] 现在支持 0 延迟 seek！');
              console.log('🔄 [PlaybackContext] 切换到 Web Audio 位置更新');
              // 引擎切换后，确保播放状态为 true
              setState(prev => ({ ...prev, isPlaying: true }));
            } else {
              console.log('🔄 [PlaybackContext] 切换到 Rust 位置更新');
            }
          },
          
          // 加载进度回调
          onLoadingProgress: (progress) => {
            console.log(`💾 [PlaybackContext] Web Audio 加载进度: ${progress}%`);
          },
        });
        
        isPlayerInitialized.current = true;
        console.log('✅ [PlaybackContext] 混合播放器初始化完成');
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

  // 🔥 监听 Rust 播放器事件（当使用 Rust 引擎时）
  useEffect(() => {
    let isActive = true; // 标记组件是否处于活动状态
    
    // 使用对象保存取消监听函数，确保清理函数能访问到
    const unlistenersRef = {
      state: null as (() => void) | null,
      track: null as (() => void) | null,
      position: null as (() => void) | null,
    };
    
    const setupRustListeners = async () => {
      try {
        // 监听播放状态变化
        const unlistenState = await listen('player-state-changed', (event: any) => {
          if (!isActive) return; // 🔒 检查组件是否仍然挂载
          
          const rustState = event.payload as any;
          
          // 🔥 只在 Rust 引擎下更新状态
          if (currentEngineRef.current === 'rust') {
            // 🔥 特殊处理：如果是停止事件且正在播放，可能是引擎切换，忽略
            if (rustState.is_playing === false && state.isPlaying === true) {
              console.log('⚠️ [PlaybackContext] 检测到 Rust 停止事件，但当前正在播放，可能是引擎切换，忽略此状态更新');
              // 只更新位置，不更新 isPlaying
              const position = typeof rustState.position_ms === 'number' && !isNaN(rustState.position_ms)
                ? rustState.position_ms
                : 0;
              positionRef.current = position;
            } else {
              // 正常更新
              setState(prev => ({
                ...prev,
                track: rustState.current_track || prev.track,
                isPlaying: rustState.is_playing ?? prev.isPlaying,
                volume: rustState.volume ?? prev.volume,
              }));
              
              const position = typeof rustState.position_ms === 'number' && !isNaN(rustState.position_ms)
                ? rustState.position_ms
                : 0;
              positionRef.current = position;
            }
          }
          // Web Audio 引擎下忽略 Rust 的状态更新
        });
        
        // 监听曲目变化
        const unlistenTrack = await listen('player-track-changed', (event: any) => {
          if (!isActive) return; // 🔒 检查组件是否仍然挂载
          
          const newTrack = event.payload || null;
          setState(prev => ({ ...prev, track: newTrack }));
          positionRef.current = 0;
          
          // 🔥 歌曲切换时重置引擎为 Rust（新歌曲从 Rust 开始）
          if (newTrack && newTrack.id !== lastTrackIdRef.current) {
            currentEngineRef.current = 'rust';
            lastTrackIdRef.current = newTrack.id;
            console.log(`🔄 [PlaybackContext] 歌曲切换 (ID: ${newTrack.id})，引擎重置为 Rust`);
          }
        });
        
        // 监听位置变化
        const unlistenPosition = await listen('player-position-changed', (event: any) => {
          if (!isActive) return; // 🔒 检查组件是否仍然挂载
          
          // 🔥 只在 Rust 引擎下更新 positionRef
          if (currentEngineRef.current === 'rust') {
            positionRef.current = event.payload as number;
          }
          // Web Audio 引擎下忽略 Rust 的位置事件
        });
        
        // 保存取消监听函数到 ref
        unlistenersRef.state = unlistenState;
        unlistenersRef.track = unlistenTrack;
        unlistenersRef.position = unlistenPosition;
        
        // 最后检查组件是否还活跃
        if (!isActive) {
          // 如果在设置期间组件已卸载，立即清理
          unlistenState();
          unlistenTrack();
          unlistenPosition();
          console.log('[PlaybackContext] ⚠️ 组件已卸载，取消刚设置的监听器');
        }
      } catch (err) {
        console.error('[PlaybackContext] ❌ 设置监听器失败:', err);
      }
    };
    
    setupRustListeners();
    
    return () => {
      // 🔒 标记组件为非活动状态
      isActive = false;
      
      // 取消所有监听器
      if (unlistenersRef.state) {
        unlistenersRef.state();
      }
      if (unlistenersRef.track) {
        unlistenersRef.track();
      }
      if (unlistenersRef.position) {
        unlistenersRef.position();
      }
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

