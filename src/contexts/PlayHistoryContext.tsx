/**
 * 播放历史Context - 播放统计数据管理
 * 
 * 设计原则：
 * - 高内聚：所有播放历史相关状态和逻辑集中在此
 * - 低耦合：通过Context API与组件解耦
 * - 单一职责：只负责播放历史状态管理和API调用
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { PlayHistoryEntry, PlayStatistics, HistorySortBy } from '../types/music';

// ==================== Context接口 ====================

interface PlayHistoryContextType {
  // 状态
  history: PlayHistoryEntry[];
  statistics: PlayStatistics | null;
  loading: boolean;
  error: string | null;
  sortBy: HistorySortBy;
  lastUpdateTime: number | null;
  
  // 操作
  setSortBy: (sort: HistorySortBy) => void;
  loadHistory: () => Promise<void>;
  loadStatistics: () => Promise<void>;
  clearHistory: () => Promise<void>;
  removeFromHistory: (trackId: number) => Promise<void>;
  getSortedHistory: () => PlayHistoryEntry[];
  refresh: () => Promise<void>;
}

// ==================== Context创建 ====================

const PlayHistoryContext = createContext<PlayHistoryContextType | null>(null);

// ==================== Provider组件 ====================

export const PlayHistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 状态
  const [history, setHistory] = useState<PlayHistoryEntry[]>([]);
  const [statistics, setStatistics] = useState<PlayStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<HistorySortBy>('last_played');
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null);
  
  // 用于跟踪当前播放的曲目和播放时长
  const currentPlayingRef = useRef<{
    trackId: number;
    startTime: number;
    lastPosition: number;
    trackDurationMs?: number; // 歌曲总时长（用于计算播放百分比）
  } | null>(null);
  
  // 用于去重：记录最近一次记录的曲目ID和时间戳
  const lastRecordedRef = useRef<{
    trackId: number;
    timestamp: number;
  } | null>(null);

  // ==================== 数据加载 ====================

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await invoke<PlayHistoryEntry[]>('get_play_history', {
        sortBy,
        limit: 100,
      });
      setHistory(data);
      setLastUpdateTime(Date.now());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`加载播放历史失败: ${message}`);
      console.error('[PlayHistoryContext] 加载历史失败:', err);
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  const loadStatistics = useCallback(async () => {
    try {
      const stats = await invoke<PlayStatistics>('get_play_statistics');
      setStatistics(stats);
    } catch (err) {
      console.error('[PlayHistoryContext] 加载统计失败:', err);
    }
  }, []);

  // 手动刷新
  const refresh = useCallback(async () => {
    await Promise.all([loadHistory(), loadStatistics()]);
  }, [loadHistory, loadStatistics]);

  // ==================== 数据操作 ====================

  const clearHistory = useCallback(async () => {
    try {
      setLoading(true);
      await invoke('clear_play_history');
      setHistory([]);
      setStatistics(null);
      await loadStatistics();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`清空历史失败: ${message}`);
      console.error('[PlayHistoryContext] 清空历史失败:', err);
    } finally {
      setLoading(false);
    }
  }, [loadStatistics]);

  const removeFromHistory = useCallback(async (trackId: number) => {
    try {
      await invoke('remove_from_history', { trackId });
      await loadHistory();
      await loadStatistics();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`删除失败: ${message}`);
      console.error('[PlayHistoryContext] 删除失败:', err);
    }
  }, [loadHistory, loadStatistics]);

  const getSortedHistory = useCallback(() => {
    return [...history];
  }, [history]);

  // ==================== 初始化 ====================

  // 初始加载
  useEffect(() => {
    loadHistory();
    loadStatistics();
  }, []);

  // sortBy变化时重新加载
  useEffect(() => {
    loadHistory();
  }, [sortBy, loadHistory]);

  // ==================== 自动记录与刷新监听 ====================

  // 使用 ref 保存最新的 sortBy 值，避免监听器重新创建
  const sortByRef = useRef(sortBy);
  useEffect(() => {
    sortByRef.current = sortBy;
  }, [sortBy]);

  // 记录上一首歌的播放历史
  const recordPreviousTrack = useCallback(async (durationMs: number, trackDurationMs?: number) => {
    const current = currentPlayingRef.current;
    if (!current) return;
    
    // 🔒 去重检查：如果在3秒内已经记录过同一首歌，则跳过
    const now = Date.now();
    const lastRecorded = lastRecordedRef.current;
    if (lastRecorded && 
        lastRecorded.trackId === current.trackId && 
        now - lastRecorded.timestamp < 3000) {
      console.log(`[PlayHistoryContext] ⏭️ 跳过重复记录: track_id=${current.trackId} (距上次记录 ${now - lastRecorded.timestamp}ms)`);
      return;
    }
    
    // 📊 播放时长过滤：参考 Spotify/Last.fm 标准
    // 条件1: 播放时长 >= 30秒
    // 条件2: 播放时长 >= 歌曲总时长的 50%（用于短歌曲）
    const MIN_DURATION_MS = 30 * 1000; // 30秒
    const MIN_PERCENTAGE = 0.5; // 50%
    
    const playedSeconds = durationMs / 1000;
    const isLongEnough = durationMs >= MIN_DURATION_MS;
    const isHalfPlayed = trackDurationMs ? (durationMs >= trackDurationMs * MIN_PERCENTAGE) : false;
    
    if (!isLongEnough && !isHalfPlayed) {
      console.log(`[PlayHistoryContext] ⏭️ 播放时长不足，不计入记录: track_id=${current.trackId}, 播放=${playedSeconds.toFixed(1)}秒 (需要≥30秒或≥50%)`);
      return;
    }
    
    try {
      console.log(`[PlayHistoryContext] 📝 记录播放: track_id=${current.trackId}, 时长=${durationMs}ms (${playedSeconds.toFixed(1)}秒)${trackDurationMs ? ` / 总时长${(trackDurationMs/1000).toFixed(0)}秒 (${((durationMs/trackDurationMs)*100).toFixed(1)}%)` : ''}`);
      await invoke('add_play_history', { 
        trackId: current.trackId, 
        durationPlayedMs: durationMs 
      });
      
      // 更新最近记录的信息
      lastRecordedRef.current = {
        trackId: current.trackId,
        timestamp: now
      };
      
      console.log('[PlayHistoryContext] ✅ 播放历史已记录');
    } catch (err) {
      console.warn('[PlayHistoryContext] ⚠️ 记录播放历史失败:', err);
    }
  }, []);

  // 监听播放器曲目切换事件，自动记录播放历史并刷新数据
  // ⚠️ 重要：此 useEffect 只在组件挂载时执行一次，不应该依赖 sortBy
  useEffect(() => {
    let isActive = true; // 标记组件是否处于活动状态
    let refreshTimeout: NodeJS.Timeout | null = null;
    
    // 使用 ref 保存取消监听函数，确保清理函数能访问到
    const unlistenersRef = {
      trackChanged: null as (() => void) | null,
      position: null as (() => void) | null,
    };
    
    // 设置监听器
    const setupListeners = async () => {
      try {
        // 监听曲目切换
        const unlistenTrack = await listen('player-track-changed', async (event: any) => {
          // 🔒 检查组件是否仍然挂载
          if (!isActive) return;
          
          const trackData = event.payload;
          console.log('[PlayHistoryContext] 🎵 检测到曲目切换:', trackData);
          
          // 如果有上一首歌，先记录它的播放时长
          if (currentPlayingRef.current) {
            const playedDuration = currentPlayingRef.current.lastPosition;
            const trackDuration = currentPlayingRef.current.trackDurationMs;
            await recordPreviousTrack(playedDuration, trackDuration);
          }
          
          // 记录新曲目的开始信息
          if (trackData && trackData.id) {
            currentPlayingRef.current = {
              trackId: trackData.id,
              startTime: Date.now(),
              lastPosition: 0,
              trackDurationMs: trackData.duration_ms, // 保存歌曲总时长
            };
            console.log('[PlayHistoryContext] 🆕 开始跟踪新曲目:', trackData.id, trackData.duration_ms ? `(${(trackData.duration_ms/1000).toFixed(0)}秒)` : '');
          } else {
            currentPlayingRef.current = null;
          }
          
          // 防抖：延迟1.5秒后刷新UI
          if (refreshTimeout) {
            clearTimeout(refreshTimeout);
          }
          
          refreshTimeout = setTimeout(async () => {
            // 🔒 再次检查组件是否仍然挂载
            if (!isActive) return;
            
            console.log('[PlayHistoryContext] 🔄 刷新播放历史和统计数据');
            try {
              // 使用 ref 获取最新的 sortBy 值
              const historyData = await invoke<PlayHistoryEntry[]>('get_play_history', {
                sortBy: sortByRef.current,
                limit: 100,
              });
              
              // 🔒 在更新状态前检查组件是否仍然挂载
              if (!isActive) return;
              
              setHistory(historyData);
              setLastUpdateTime(Date.now());
              
              const stats = await invoke<PlayStatistics>('get_play_statistics');
              if (!isActive) return;
              
              setStatistics(stats);
              
              console.log('[PlayHistoryContext] ✅ 数据刷新完成');
            } catch (err) {
              console.error('[PlayHistoryContext] ❌ 刷新数据失败:', err);
            }
          }, 1500);
        });
        
        // 监听播放位置更新，持续跟踪实际播放进度
        const unlistenPos = await listen('player-position-changed', (event: any) => {
          // 🔒 检查组件是否仍然挂载
          if (!isActive) return;
          
          const positionMs = event.payload as number;
          if (currentPlayingRef.current) {
            currentPlayingRef.current.lastPosition = positionMs;
          }
        });
        
        // 保存取消监听函数到 ref
        unlistenersRef.trackChanged = unlistenTrack;
        unlistenersRef.position = unlistenPos;
        
        // 最后检查组件是否还活跃
        if (isActive) {
          console.log('[PlayHistoryContext] ✅ 已设置播放历史监听器');
        } else {
          // 如果在设置期间组件已卸载，立即清理
          unlistenTrack();
          unlistenPos();
          console.log('[PlayHistoryContext] ⚠️ 组件已卸载，取消刚设置的监听器');
        }
      } catch (err) {
        console.error('[PlayHistoryContext] ❌ 设置监听器失败:', err);
      }
    };
    
    setupListeners();

    // 清理函数：在组件卸载时，记录当前正在播放的曲目
    return () => {
      // 🔒 标记组件为非活动状态
      isActive = false;
      
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      
      if (currentPlayingRef.current) {
        const playedDuration = currentPlayingRef.current.lastPosition;
        const trackDuration = currentPlayingRef.current.trackDurationMs;
        if (playedDuration > 0) {
          // 异步记录，不阻塞卸载
          recordPreviousTrack(playedDuration, trackDuration);
        }
      }
      
      // 取消监听器
      if (unlistenersRef.trackChanged) {
        unlistenersRef.trackChanged();
      }
      if (unlistenersRef.position) {
        unlistenersRef.position();
      }
      
      console.log('[PlayHistoryContext] 🧹 已清理播放历史监听器');
    };
  }, []); // ✅ 移除所有依赖，确保只在挂载/卸载时执行

  // ==================== Context Value ====================

  const value: PlayHistoryContextType = {
    history,
    statistics,
    loading,
    error,
    sortBy,
    lastUpdateTime,
    setSortBy,
    loadHistory,
    loadStatistics,
    clearHistory,
    removeFromHistory,
    getSortedHistory,
    refresh,
  };

  return (
    <PlayHistoryContext.Provider value={value}>
      {children}
    </PlayHistoryContext.Provider>
  );
};

// ==================== Hook ====================

export const usePlayHistory = (): PlayHistoryContextType => {
  const context = useContext(PlayHistoryContext);
  if (!context) {
    throw new Error('usePlayHistory必须在PlayHistoryProvider内部使用');
  }
  return context;
};

