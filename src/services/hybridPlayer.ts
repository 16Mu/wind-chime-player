/**
 * Hybrid audio player using dual-engine architecture
 * Strategy: Rust streaming for immediate playback, Web Audio for instant seeking
 */

import { invoke } from '@tauri-apps/api/core';
import { webAudioPlayer } from './webAudioPlayer';

export interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
}

export interface HybridPlayerCallbacks {
  onEngineSwitch?: (engine: 'rust' | 'webaudio') => void;
  onLoadingProgress?: (progress: number) => void;
}

/**
 * Hybrid player engine
 */
export class HybridPlayer {
  private currentEngine: 'rust' | 'webaudio' = 'rust';
  private isWebAudioReady = false;
  private callbacks: HybridPlayerCallbacks = {};
  
  private playStartTime = 0;
  private rustStartTime = 0;
  private webAudioStartTime = 0;
  private webAudioReadyTime = 0;
  
  private currentLoadingTask: Promise<void> | null = null;
  private shouldCancelLoading = false;
  private currentTrackId: number | null = null;
  private pendingSeekPosition: number | null = null;
  private isSwitching = false; // 🔥 防止重复切换引擎
  
  /**
   * Initialize player
   */
  async initialize(callbacks?: HybridPlayerCallbacks): Promise<boolean> {
    try {
      console.log('[HybridPlayer] Initializing...');
      
      this.callbacks = callbacks || {};
      
      console.log('[HybridPlayer] Initialization complete');
      return true;
    } catch (error) {
      console.error('[HybridPlayer] Initialization failed:', error);
      return false;
    }
  }
  
  /**
   * Play track using dual-engine strategy
   * @param skipRustPlay - Skip Rust playback, background loading only
   */
  async play(track: Track, playlist: Track[] = [], skipRustPlay: boolean = false): Promise<boolean> {
    try {
      // 🔥 立即取消旧的加载任务（不等待完成，避免阻塞）
      if (this.currentLoadingTask) {
        console.log(`[HybridPlayer] New play request, canceling previous task (track ${this.currentTrackId})`);
        this.shouldCancelLoading = true;
        // ⚠️ 不 await，让旧任务自行取消，不阻塞新播放
      }
      
      // 🔥 立即停止 Web Audio 播放器（避免旧歌继续播放）
      if (this.currentEngine === 'webaudio' || this.isWebAudioReady) {
        console.log(`[HybridPlayer] Stopping Web Audio player for new track`);
        webAudioPlayer.stop();
        this.currentEngine = 'rust';
        this.isWebAudioReady = false;
      }
      
      if (skipRustPlay) {
        console.log(`[HybridPlayer] Background loading mode only (track ${track.id}: ${track.title})`);
        
        this.currentTrackId = track.id;
        this.shouldCancelLoading = false;
        this.pendingSeekPosition = null;
        this.playStartTime = performance.now();
        this.currentEngine = 'rust';
        this.isWebAudioReady = false;
        this.isSwitching = false;
        
        this.webAudioStartTime = performance.now();
        console.log(`[HybridPlayer] Starting background Web Audio loading...`);
        this.currentLoadingTask = this.loadWebAudioInBackground(track);
        
        return true;
      }
      
      // 🔥 已在前面统一处理，这里不需要重复
      
      this.playStartTime = performance.now();
      this.currentTrackId = track.id;
      this.shouldCancelLoading = false;
      this.pendingSeekPosition = null;
      this.isSwitching = false; // 🔥 重置切换状态
      
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
      
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`[HybridPlayer] [${timeStr}] T+0ms - Playing: ${track.title || track.path} (ID: ${track.id})`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      this.isWebAudioReady = false;
      this.currentEngine = 'rust';
      
      this.rustStartTime = performance.now();
      const rustElapsed = Math.round(this.rustStartTime - this.playStartTime);
      console.log(`[HybridPlayer] T+${rustElapsed}ms - Phase 1: Starting Rust streaming...`);
      
      // 🚀 确保播放列表至少包含当前曲目
      const effectivePlaylist = playlist.length > 0 ? playlist : [track];
      
      try {
        await invoke('player_load_playlist', { tracks: effectivePlaylist });
        console.log(`[HybridPlayer] Playlist loaded: ${effectivePlaylist.length} track(s)`);
      } catch (error) {
        console.error('[HybridPlayer] Load playlist failed:', error);
        return false;
      }
      
      // 🚀 播放列表已加载，异步发送播放命令（快速响应，让 Rust 后台播放）
      invoke('player_play', { trackId: track.id, timestamp: Date.now() })
        .then(() => {
          console.log('[HybridPlayer] Rust playback started');
        })
        .catch(error => {
          console.error('[HybridPlayer] Play command failed:', error);
        });
      
      const rustDone = performance.now();
      const rustTotalTime = Math.round(rustDone - this.rustStartTime);
      const totalElapsed = Math.round(rustDone - this.playStartTime);
      
      console.log(`[HybridPlayer] T+${totalElapsed}ms - Playlist loaded, play command sent`);
      console.log(`[HybridPlayer] T+${totalElapsed}ms - Rust starting playback in background`);
      
      this.webAudioStartTime = performance.now();
      const bgStartElapsed = Math.round(this.webAudioStartTime - this.playStartTime);
      console.log(`[HybridPlayer] T+${bgStartElapsed}ms - Phase 2: Background Web Audio loading...`);
      
      this.currentLoadingTask = this.loadWebAudioInBackground(track);
      
      return true;
    } catch (error) {
      console.error('[HybridPlayer] Play failed:', error);
      return false;
    }
  }
  
  /**
   * Load Web Audio in background
   */
  private async loadWebAudioInBackground(track: Track): Promise<void> {
    const taskTrackId = track.id;
    
    try {
      const bgElapsed = Math.round(performance.now() - this.playStartTime);
      console.log(`[HybridPlayer] T+${bgElapsed}ms - Background task started: Web Audio decoding (track ${taskTrackId})`);
      
      if (this.shouldCancelLoading || this.currentTrackId !== taskTrackId) {
        console.log(`[HybridPlayer] Background task canceled (pre-check failed) (track ${taskTrackId})`);
        return;
      }
      
      const readStart = performance.now();
      const loadSuccess = await webAudioPlayer.loadTrack(track);
      const readTime = Math.round(performance.now() - readStart);
      const readElapsed = Math.round(performance.now() - this.playStartTime);
      
      if (!loadSuccess) {
        throw new Error('Web Audio loading failed');
      }
      
      console.log(`[HybridPlayer] T+${readElapsed}ms - File read complete (${readTime}ms) (track ${taskTrackId})`);
      
      if (this.shouldCancelLoading || this.currentTrackId !== taskTrackId) {
        console.log(`[HybridPlayer] Background task canceled (post-read check failed) (track ${taskTrackId})`);
        return;
      }
      
      const decodeElapsed = Math.round(performance.now() - this.playStartTime);
      console.log(`[HybridPlayer] T+${decodeElapsed}ms - Starting full decode... (track ${taskTrackId})`);
      
      this.webAudioReadyTime = performance.now();
      const webAudioTotalTime = Math.round(this.webAudioReadyTime - this.webAudioStartTime);
      const finalElapsed = Math.round(this.webAudioReadyTime - this.playStartTime);
      
      if (this.shouldCancelLoading || this.currentTrackId !== taskTrackId) {
        console.log(`[HybridPlayer] Background task canceled (post-decode check failed) (track ${taskTrackId})`);
        return;
      }
      
      this.isWebAudioReady = true;
      console.log(`[HybridPlayer] T+${finalElapsed}ms - Web Audio ready (${webAudioTotalTime}ms) (track ${taskTrackId})`);
      
      if (this.callbacks.onLoadingProgress) {
        this.callbacks.onLoadingProgress(100);
      }
      
      if (!this.shouldCancelLoading && this.currentTrackId === taskTrackId) {
        await this.switchToWebAudio();
      } else {
        console.log(`[HybridPlayer] Final check failed, task canceled (track ${taskTrackId})`);
      }
      
    } catch (error) {
      const errorElapsed = Math.round(performance.now() - this.playStartTime);
      console.error(`[HybridPlayer] T+${errorElapsed}ms - Background loading failed:`, error);
    } finally {
      if (this.currentLoadingTask) {
        this.currentLoadingTask = null;
      }
    }
  }
  
  /**
   * Switch to Web Audio engine
   */
  private async switchToWebAudio(): Promise<void> {
    const currentTaskId = this.currentTrackId;
    
    // 🔥 防止重复切换
    if (this.isSwitching) {
      console.log('[HybridPlayer] Engine switch already in progress, skipping...');
      return;
    }
    
    if (this.currentEngine === 'webaudio') {
      console.log('[HybridPlayer] Already using Web Audio engine, skipping switch...');
      return;
    }
    
    this.isSwitching = true;
    
    try {
      const switchStart = performance.now();
      const switchElapsed = Math.round(switchStart - this.playStartTime);
      
      console.log(`[HybridPlayer] T+${switchElapsed}ms - Starting engine switch... (track ${currentTaskId})`);
      
      const positionStart = performance.now();
      const currentPosition = await invoke<number>('get_current_position');
      const positionTime = Math.round(performance.now() - positionStart);
      const posElapsed = Math.round(performance.now() - this.playStartTime);
      
      console.log(`[HybridPlayer] T+${posElapsed}ms - Rust position: ${currentPosition}ms (${positionTime}ms)`);
      
      if (this.shouldCancelLoading || this.currentTrackId !== currentTaskId) {
        console.log(`[HybridPlayer] Pre-switch check failed (task ${currentTaskId} -> current ${this.currentTrackId})`);
        return;
      }
      
      const isPlaying = true;
      
      this.currentEngine = 'webaudio';
      
      if (this.callbacks.onEngineSwitch) {
        this.callbacks.onEngineSwitch('webaudio');
        console.log(`[HybridPlayer] T+${Math.round(performance.now() - this.playStartTime)}ms - Engine switch notified -> Web Audio`);
      }
      
      const stopStart = performance.now();
      await invoke('player_stop');
      const stopTime = Math.round(performance.now() - stopStart);
      const stopElapsed = Math.round(performance.now() - this.playStartTime);
      
      console.log(`[HybridPlayer] T+${stopElapsed}ms - Rust player stopped (${stopTime}ms)`);
      
      if (this.shouldCancelLoading || this.currentTrackId !== currentTaskId) {
        console.log(`[HybridPlayer] Post-stop check failed (task ${currentTaskId})`);
        return;
      }
      
      const webAudioStart = performance.now();
      
      // 🔥 如果有 pending seek，使用它；否则使用当前 Rust 位置
      const targetPosition = this.pendingSeekPosition ?? currentPosition;
      const positionSec = targetPosition / 1000;
      
      if (this.pendingSeekPosition !== null) {
        console.log(`[HybridPlayer] Executing pending seek -> ${this.pendingSeekPosition}ms`);
      }
      
      await webAudioPlayer.seek(positionSec);
      
      if (isPlaying) {
        await webAudioPlayer.play();
      }
      
      this.pendingSeekPosition = null; // 清除 pending seek
      
      const webAudioTime = Math.round(performance.now() - webAudioStart);
      const playElapsed = Math.round(performance.now() - this.playStartTime);
      
      const totalSwitchTime = Math.round(performance.now() - switchStart);
      const finalElapsed = Math.round(performance.now() - this.playStartTime);
      
      console.log(`[HybridPlayer] T+${playElapsed}ms - Web Audio started at ${positionSec.toFixed(2)}s (${webAudioTime}ms)`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[HybridPlayer] T+${finalElapsed}ms - Engine switch complete: Rust -> Web Audio (${totalSwitchTime}ms) (track ${currentTaskId})`);
      console.log(`[HybridPlayer] T+${finalElapsed}ms - Instant seek now available (<10ms)`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log('');
      
    } catch (error) {
      const errorTime = Math.round(performance.now() - this.playStartTime);
      console.error(`[HybridPlayer] T+${errorTime}ms - Engine switch failed:`, error);
    } finally {
      this.isSwitching = false;
    }
  }
  
  /**
   * Pause playback
   */
  async pause(): Promise<void> {
    if (this.currentEngine === 'webaudio' && this.isWebAudioReady) {
      webAudioPlayer.pause();
      console.log('[HybridPlayer] Paused (Web Audio)');
    } else {
      await invoke('player_pause');
      console.log('[HybridPlayer] Paused (Rust)');
    }
  }
  
  /**
   * Resume playback
   */
  async resume(): Promise<void> {
    if (this.currentEngine === 'webaudio' && this.isWebAudioReady) {
      webAudioPlayer.play();
      console.log('[HybridPlayer] Resumed (Web Audio)');
    } else {
      await invoke('player_resume');
      console.log('[HybridPlayer] Resumed (Rust)');
    }
  }
  
  /**
   * Stop playback
   */
  async stop(): Promise<void> {
    // 🔥 取消后台加载
    if (this.currentLoadingTask) {
      this.shouldCancelLoading = true;
    }
    
    // 停止 Web Audio
    if (this.currentEngine === 'webaudio' || this.isWebAudioReady) {
      webAudioPlayer.stop();
    }
    
    // 停止 Rust
    await invoke('player_stop');
    
    // 重置所有状态
    this.currentEngine = 'rust';
    this.isWebAudioReady = false;
    this.isSwitching = false;
    this.currentTrackId = null;
    this.pendingSeekPosition = null;
    
    console.log('[HybridPlayer] Stopped');
  }
  
  /**
   * Seek to position
   * 优化策略（避免暂停死锁）：
   * 1. 如果 Web Audio 已准备好 -> 立即使用 Web Audio seek
   * 2. 如果还没准备好 -> 保存 pending seek，不暂停 Rust（让音乐继续播放）
   * 3. Web Audio 准备好后，自动从 pending seek 位置开始
   */
  async seek(positionMs: number): Promise<void> {
    const positionMsInt = Math.floor(positionMs);
    const positionSec = positionMsInt / 1000;
    const seekStart = performance.now();
    
    console.log(`[HybridPlayer] Seek request: ${positionSec.toFixed(2)}s (${positionMsInt}ms)`, {
      currentEngine: this.currentEngine,
      isWebAudioReady: this.isWebAudioReady,
      willUse: this.isWebAudioReady ? 'Web Audio (instant)' : 'Pending (Rust continues playing)'
    });
    
    // 🔥 只要 Web Audio 已准备好，就立即使用
    if (this.isWebAudioReady) {
      await webAudioPlayer.seek(positionSec);
      this.pendingSeekPosition = null;
      const seekTime = Math.round(performance.now() - seekStart);
      console.log(`[HybridPlayer] ✓ Seek -> ${positionSec.toFixed(2)}s [Web Audio] [${seekTime}ms] Instant!`);
      
      // 如果引擎还没切换，立即切换
      if (this.currentEngine !== 'webaudio') {
        console.log('[HybridPlayer] Triggering immediate engine switch (Web Audio already ready)...');
        this.switchToWebAudio().catch(err => {
          console.error('[HybridPlayer] Engine switch failed:', err);
        });
      }
    } else {
      // 🔥 Web Audio 还没准备好 - 新策略：不暂停 Rust，只保存 pending seek
      console.log(`[HybridPlayer] ⏳ Web Audio not ready, queuing seek (Rust continues)`);
      
      // 🔥 可选：如果是 Rust 引擎且支持 seek，可以先用 Rust seek
      if (this.currentEngine === 'rust') {
        try {
          await invoke('player_seek', { positionMs: positionMsInt });
          console.log(`[HybridPlayer] Rust seek executed: ${positionMsInt}ms`);
        } catch (error) {
          console.warn(`[HybridPlayer] Rust seek failed (expected for WebDAV):`, error);
        }
      }
      
      // 保存 pending seek，Web Audio 准备好后会从这个位置开始
      this.pendingSeekPosition = positionMsInt;
      console.log(`[HybridPlayer] Seek queued: ${positionMsInt}ms (will apply when Web Audio ready)`);
    }
  }
  
  /**
   * Set volume
   */
  async setVolume(volume: number): Promise<void> {
    if (this.currentEngine === 'webaudio' && this.isWebAudioReady) {
      webAudioPlayer.setVolume(volume);
    }
    
    await invoke('player_set_volume', { volume });
    
    console.log(`[HybridPlayer] Volume: ${(volume * 100).toFixed(0)}%`);
  }
  
  /**
   * Play next track
   */
  async next(): Promise<void> {
    console.log('[HybridPlayer] Next track requested...');
    
    // 🔥 立即停止旧的播放和加载
    if (this.currentLoadingTask) {
      console.log(`[HybridPlayer] Canceling previous background task (track ${this.currentTrackId})`);
      this.shouldCancelLoading = true;
    }
    
    if (this.currentEngine === 'webaudio' || this.isWebAudioReady) {
      webAudioPlayer.stop();
    }
    
    // 重置状态
    this.currentEngine = 'rust';
    this.isWebAudioReady = false;
    this.pendingSeekPosition = null;
    this.isSwitching = false;
    this.currentTrackId = null;
    
    await invoke('player_next');
    
    console.log('[HybridPlayer] Next command sent (Rust will handle)');
  }
  
  /**
   * Play previous track
   */
  async previous(): Promise<void> {
    console.log('[HybridPlayer] Previous track requested...');
    
    // 🔥 立即停止旧的播放和加载
    if (this.currentLoadingTask) {
      console.log(`[HybridPlayer] Canceling previous background task (track ${this.currentTrackId})`);
      this.shouldCancelLoading = true;
    }
    
    if (this.currentEngine === 'webaudio' || this.isWebAudioReady) {
      webAudioPlayer.stop();
    }
    
    // 重置状态
    this.currentEngine = 'rust';
    this.isWebAudioReady = false;
    this.pendingSeekPosition = null;
    this.isSwitching = false;
    this.currentTrackId = null;
    
    await invoke('player_previous');
    
    console.log('[HybridPlayer] Previous command sent (Rust will handle)');
  }
  
  /**
   * Get current engine
   */
  getCurrentEngine(): 'rust' | 'webaudio' {
    return this.currentEngine;
  }
  
  /**
   * Check if Web Audio engine is ready
   */
  isWebAudioEngineReady(): boolean {
    return this.isWebAudioReady;
  }
}

export const hybridPlayer = new HybridPlayer();
