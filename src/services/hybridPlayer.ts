/**
 * 混合播放器 - 双引擎架构
 * 
 * 策略：
 * 1. 立即使用 Rust 流式播放（100ms 启动）
 * 2. 后台 Web Audio 完整加载（800ms 完成）
 * 3. 自动无缝切换到 Web Audio（支持 0 延迟 seek）
 * 
 * 优势：
 * - 点击播放立即响应（< 100ms）
 * - 快速切换后支持 0 延迟 seek
 * - 用户无感知切换
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
 * 混合播放器引擎
 */
export class HybridPlayer {
  private currentEngine: 'rust' | 'webaudio' = 'rust';
  private isWebAudioReady = false;
  private callbacks: HybridPlayerCallbacks = {};
  
  // 时间追踪
  private playStartTime = 0;
  private rustStartTime = 0;
  private webAudioStartTime = 0;
  private webAudioReadyTime = 0;
  
  // 🔥 任务控制：防止多个后台任务冲突
  private currentLoadingTask: Promise<void> | null = null;
  private shouldCancelLoading = false;
  private currentTrackId: number | null = null;
  private pendingSeekPosition: number | null = null;
  
  /**
   * 初始化播放器
   */
  async initialize(callbacks?: HybridPlayerCallbacks): Promise<boolean> {
    try {
      console.log('🎵 [HybridPlayer] 初始化混合播放器...');
      
      this.callbacks = callbacks || {};
      
      // 注意：Web Audio Player 由 PlaybackContext 初始化
      // 这里只保存回调配置
      
      console.log('✅ [HybridPlayer] 初始化完成');
      return true;
    } catch (error) {
      console.error('❌ [HybridPlayer] 初始化失败:', error);
      return false;
    }
  }
  
  /**
   * 播放歌曲（双引擎策略）
   * @param skipRustPlay - 如果为 true，则跳过 Rust 播放（仅启动后台加载）
   */
  async play(track: Track, playlist: Track[] = [], skipRustPlay: boolean = false): Promise<boolean> {
    try {
      // 🔥 取消之前的后台加载任务
      if (this.currentLoadingTask) {
        console.log(`🚫 [HybridPlayer] 检测到新播放请求，取消之前的后台任务 (track ${this.currentTrackId})`);
        this.shouldCancelLoading = true;
        // 等待旧任务取消
        await this.currentLoadingTask.catch(() => {});
      }
      
      // 🔥 如果跳过 Rust 播放（仅后台加载模式）
      if (skipRustPlay) {
        console.log(`🔄 [HybridPlayer] 仅启动后台加载模式 (track ${track.id}: ${track.title})`);
        
        // 更新状态
        this.currentTrackId = track.id;
        this.shouldCancelLoading = false;
        this.pendingSeekPosition = null;
        this.playStartTime = performance.now();
        this.currentEngine = 'rust';
        this.isWebAudioReady = false;
        
        // 🚀 直接启动后台加载
        this.webAudioStartTime = performance.now();
        console.log(`💾 [HybridPlayer] 启动后台 Web Audio 加载...`);
        this.currentLoadingTask = this.loadWebAudioInBackground(track);
        
        return true;
      }
      
      // 🔥 停止 Web Audio 播放（如果正在播放）
      if (this.currentEngine === 'webaudio' && this.isWebAudioReady) {
        console.log(`⏹️ [HybridPlayer] 停止之前的 Web Audio 播放 (track ${this.currentTrackId})`);
        webAudioPlayer.stop();
      }
      
      // 🔥 重置引擎状态为 Rust（新歌曲会重新走完整流程）
      this.currentEngine = 'rust';
      this.isWebAudioReady = false;
      
      // 记录播放开始时间
      this.playStartTime = performance.now();
      this.currentTrackId = track.id;
      this.shouldCancelLoading = false;
      this.pendingSeekPosition = null;
      
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
      
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🎵 [HybridPlayer] [${timeStr}] T+0ms - 播放: ${track.title || track.path} (ID: ${track.id})`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      this.isWebAudioReady = false;
      this.currentEngine = 'rust';
      
      // 🚀 第一阶段：立即使用 Rust 流式播放（100ms 启动）
      this.rustStartTime = performance.now();
      const rustElapsed = Math.round(this.rustStartTime - this.playStartTime);
      console.log(`⚡ [HybridPlayer] T+${rustElapsed}ms - 【阶段1】启动 Rust 流式播放...`);
      
      // 加载播放列表
      if (playlist.length > 0) {
        await invoke('player_load_playlist', { tracks: playlist });
      }
      
      // 播放歌曲
      await invoke('player_play', { trackId: track.id, timestamp: Date.now() });
      
      const rustDone = performance.now();
      const rustTotalTime = Math.round(rustDone - this.rustStartTime);
      const totalElapsed = Math.round(rustDone - this.playStartTime);
      
      console.log(`✅ [HybridPlayer] T+${totalElapsed}ms - Rust 播放器已启动 (耗时: ${rustTotalTime}ms)`);
      console.log(`🎵 [HybridPlayer] T+${totalElapsed}ms - 🔊 用户听到声音了！`);
      
      // 🔥 第二阶段：后台 Web Audio 完整加载（800ms 完成）
      this.webAudioStartTime = performance.now();
      const bgStartElapsed = Math.round(this.webAudioStartTime - this.playStartTime);
      console.log(`💾 [HybridPlayer] T+${bgStartElapsed}ms - 【阶段2】后台加载 Web Audio（支持快速 seek）...`);
      
      // 启动后台任务并保存引用
      this.currentLoadingTask = this.loadWebAudioInBackground(track);
      
      return true;
    } catch (error) {
      console.error('❌ [HybridPlayer] 播放失败:', error);
      return false;
    }
  }
  
  /**
   * 后台加载 Web Audio
   */
  private async loadWebAudioInBackground(track: Track): Promise<void> {
    const taskTrackId = track.id;
    
    try {
      const bgElapsed = Math.round(performance.now() - this.playStartTime);
      console.log(`🔧 [HybridPlayer] T+${bgElapsed}ms - 后台任务启动: Web Audio 完整解码 (track ${taskTrackId})`);
      
      // 🔥 第一次检查：开始前
      if (this.shouldCancelLoading || this.currentTrackId !== taskTrackId) {
        console.log(`🚫 [HybridPlayer] 后台任务取消（开始前检查失败） (track ${taskTrackId})`);
        return;
      }
      
      // 读取文件
      const readStart = performance.now();
      const loadSuccess = await webAudioPlayer.loadTrack(track);
      const readTime = Math.round(performance.now() - readStart);
      const readElapsed = Math.round(performance.now() - this.playStartTime);
      
      if (!loadSuccess) {
        throw new Error('Web Audio 加载失败');
      }
      
      console.log(`📂 [HybridPlayer] T+${readElapsed}ms - 文件读取完成 (耗时: ${readTime}ms) (track ${taskTrackId})`);
      
      // 🔥 第二次检查：文件读取后
      if (this.shouldCancelLoading || this.currentTrackId !== taskTrackId) {
        console.log(`🚫 [HybridPlayer] 后台任务取消（文件读取后检查失败） (track ${taskTrackId})`);
        return;
      }
      
      // 完整解码（这一步最耗时）
      const decodeElapsed = Math.round(performance.now() - this.playStartTime);
      console.log(`🔊 [HybridPlayer] T+${decodeElapsed}ms - 开始完整解码... (track ${taskTrackId})`);
      
      this.webAudioReadyTime = performance.now();
      const webAudioTotalTime = Math.round(this.webAudioReadyTime - this.webAudioStartTime);
      const finalElapsed = Math.round(this.webAudioReadyTime - this.playStartTime);
      
      // 🔥 第三次检查：解码完成后
      if (this.shouldCancelLoading || this.currentTrackId !== taskTrackId) {
        console.log(`🚫 [HybridPlayer] 后台任务取消（解码完成后检查失败） (track ${taskTrackId})`);
        return;
      }
      
      this.isWebAudioReady = true;
      console.log(`✅ [HybridPlayer] T+${finalElapsed}ms - Web Audio 加载完成 (总耗时: ${webAudioTotalTime}ms) (track ${taskTrackId})`);
      
      // 通知进度回调
      if (this.callbacks.onLoadingProgress) {
        this.callbacks.onLoadingProgress(100);
      }
      
      // 🎯 第三阶段：自动切换到 Web Audio（最后一次检查）
      if (!this.shouldCancelLoading && this.currentTrackId === taskTrackId) {
        await this.switchToWebAudio();
      } else {
        console.log(`🚫 [HybridPlayer] 切换前最终检查失败，任务已被取消 (track ${taskTrackId})`);
      }
      
    } catch (error) {
      const errorElapsed = Math.round(performance.now() - this.playStartTime);
      console.error(`❌ [HybridPlayer] T+${errorElapsed}ms - Web Audio 后台加载失败:`, error);
    } finally {
      // 清理任务引用
      if (this.currentLoadingTask) {
        this.currentLoadingTask = null;
      }
    }
  }
  
  /**
   * 切换到 Web Audio 引擎
   */
  private async switchToWebAudio(): Promise<void> {
    const currentTaskId = this.currentTrackId;
    
    try {
      const switchStart = performance.now();
      const switchElapsed = Math.round(switchStart - this.playStartTime);
      
      console.log(`🔄 [HybridPlayer] T+${switchElapsed}ms - 开始切换引擎... (track ${currentTaskId})`);
      
      // 获取当前播放位置（从 Rust）
      const positionStart = performance.now();
      const currentPosition = await invoke<number>('get_current_position');
      const positionTime = Math.round(performance.now() - positionStart);
      const posElapsed = Math.round(performance.now() - this.playStartTime);
      
      console.log(`📊 [HybridPlayer] T+${posElapsed}ms - 获取 Rust 播放位置: ${currentPosition}ms (耗时: ${positionTime}ms)`);
      
      // 🔥 检查任务是否仍然有效
      if (this.shouldCancelLoading || this.currentTrackId !== currentTaskId) {
        console.log(`🚫 [HybridPlayer] 切换前检查失败，已切换到其他歌曲 (task ${currentTaskId} → current ${this.currentTrackId})`);
        return;
      }
      
      // 获取当前播放状态
      const isPlaying = true; // 假设正在播放
      
      // 🔥 提前切换引擎标志（在停止 Rust 之前）
      this.currentEngine = 'webaudio';
      
      // 🔥 立即通知回调（让 PlaybackContext 提前切换引擎标志）
      if (this.callbacks.onEngineSwitch) {
        this.callbacks.onEngineSwitch('webaudio');
        console.log(`🔄 [HybridPlayer] T+${Math.round(performance.now() - this.playStartTime)}ms - 已通知引擎切换 → Web Audio`);
      }
      
      // 停止 Rust 播放器（此时 PlaybackContext 已经忽略 Rust 事件）
      const stopStart = performance.now();
      await invoke('player_stop');
      const stopTime = Math.round(performance.now() - stopStart);
      const stopElapsed = Math.round(performance.now() - this.playStartTime);
      
      console.log(`⏹️ [HybridPlayer] T+${stopElapsed}ms - Rust 播放器已停止 (耗时: ${stopTime}ms)`);
      
      // 🔥 最终检查
      if (this.shouldCancelLoading || this.currentTrackId !== currentTaskId) {
        console.log(`🚫 [HybridPlayer] Rust 停止后检查失败，已切换到其他歌曲 (task ${currentTaskId})`);
        return;
      }
      
      // 切换到 Web Audio 并从目标位置继续
      const webAudioStart = performance.now();
      const targetPosition = this.pendingSeekPosition ?? currentPosition;
      const positionSec = targetPosition / 1000;
      await webAudioPlayer.seek(positionSec);
      
      if (isPlaying) {
        await webAudioPlayer.play();
      }
      
      const webAudioTime = Math.round(performance.now() - webAudioStart);
      const playElapsed = Math.round(performance.now() - this.playStartTime);
      
      const totalSwitchTime = Math.round(performance.now() - switchStart);
      const finalElapsed = Math.round(performance.now() - this.playStartTime);
      
      console.log(`✅ [HybridPlayer] T+${playElapsed}ms - Web Audio 播放启动 (耗时: ${webAudioTime}ms)`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🎉 [HybridPlayer] T+${finalElapsed}ms - 引擎切换完成！ Rust → Web Audio (切换耗时: ${totalSwitchTime}ms) (track ${currentTaskId})`);
      console.log(`🎯 [HybridPlayer] T+${finalElapsed}ms - ⚡ 现在支持 0 延迟 seek (<10ms)！`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log('');
      
      // 🔥 如果有挂起的 seek 请求，现在执行
      if (this.pendingSeekPosition !== null) {
        console.log(`🎯 [HybridPlayer] 执行挂起的 Seek → ${this.pendingSeekPosition}ms`);
        const pendingSec = this.pendingSeekPosition / 1000;
        await webAudioPlayer.seek(pendingSec);
        if (isPlaying) {
          await webAudioPlayer.play();
        }
        this.pendingSeekPosition = null;
        console.log('✅ [HybridPlayer] 挂起 Seek 已完成');
      }
      
    } catch (error) {
      const errorTime = Math.round(performance.now() - this.playStartTime);
      console.error(`❌ [HybridPlayer] T+${errorTime}ms - 引擎切换失败:`, error);
    }
  }
  
  /**
   * 暂停播放
   */
  async pause(): Promise<void> {
    if (this.currentEngine === 'webaudio' && this.isWebAudioReady) {
      webAudioPlayer.pause();
      console.log('⏸️ [HybridPlayer] 暂停 (Web Audio)');
    } else {
      await invoke('player_pause');
      console.log('⏸️ [HybridPlayer] 暂停 (Rust)');
    }
  }
  
  /**
   * 继续播放
   */
  async resume(): Promise<void> {
    if (this.currentEngine === 'webaudio' && this.isWebAudioReady) {
      webAudioPlayer.play();
      console.log('▶️ [HybridPlayer] 继续 (Web Audio)');
    } else {
      await invoke('player_resume');
      console.log('▶️ [HybridPlayer] 继续 (Rust)');
    }
  }
  
  /**
   * 停止播放
   */
  async stop(): Promise<void> {
    if (this.currentEngine === 'webaudio' && this.isWebAudioReady) {
      webAudioPlayer.stop();
    }
    
    await invoke('player_stop');
    
    this.currentEngine = 'rust';
    this.isWebAudioReady = false;
    
    console.log('⏹️ [HybridPlayer] 已停止');
  }
  
  /**
   * Seek 跳转（智能选择引擎）
   */
  async seek(positionMs: number): Promise<void> {
    // 🔥 确保 positionMs 是整数（Rust 需要 u64）
    const positionMsInt = Math.floor(positionMs);
    const positionSec = positionMsInt / 1000;
    const seekStart = performance.now();
    
    // 🔥 调试日志：显示当前状态
    console.log(`🔍 [HybridPlayer] Seek 请求: ${positionSec.toFixed(2)}s (${positionMsInt}ms)`, {
      currentEngine: this.currentEngine,
      isWebAudioReady: this.isWebAudioReady,
      willUse: (this.currentEngine === 'webaudio' && this.isWebAudioReady) ? 'Web Audio' : 'Rust'
    });
    
    if (this.currentEngine === 'webaudio' && this.isWebAudioReady) {
      // Web Audio: 0 延迟 seek
      await webAudioPlayer.seek(positionSec);
      this.pendingSeekPosition = null;
      const seekTime = Math.round(performance.now() - seekStart);
      console.log(`⚡ [HybridPlayer] Seek → ${positionSec.toFixed(2)}s [引擎: Web Audio] [耗时: ${seekTime}ms] ✨ 0 延迟!`);
    } else {
      // Rust: 正常 seek（注意：流式播放模式下可能不可用）
      console.log(`⚠️ [HybridPlayer] 使用 Rust seek（流式播放模式下可能失败）`);
      this.pendingSeekPosition = positionMsInt;
      console.log(`🕒 [HybridPlayer] 挂起 Seek 请求，等待 Web Audio 引擎就绪: ${positionMsInt}ms`);
      try {
        // 🔥 确保传给 Rust 的是整数
        await invoke('player_seek', { positionMs: positionMsInt });
        const seekTime = Math.round(performance.now() - seekStart);
        console.log(`⚡ [HybridPlayer] Seek → ${positionSec.toFixed(2)}s [引擎: Rust] [耗时: ${seekTime}ms]`);
      } catch (error) {
        console.error(`❌ [HybridPlayer] Rust seek 失败（预期的 - 流式播放不支持 seek）:`, error);
        console.log(`💡 [HybridPlayer] 等待 Web Audio 引擎就绪后再尝试 seek`);
        throw error;
      }
    }
  }
  
  /**
   * 设置音量
   */
  async setVolume(volume: number): Promise<void> {
    if (this.currentEngine === 'webaudio' && this.isWebAudioReady) {
      webAudioPlayer.setVolume(volume);
    }
    
    await invoke('player_set_volume', { volume });
    
    console.log(`🔊 [HybridPlayer] 音量: ${(volume * 100).toFixed(0)}%`);
  }
  
  /**
   * 下一首
   */
  async next(): Promise<void> {
    console.log('⏭️ [HybridPlayer] 请求下一首...');
    
    // 🔥 取消之前的后台加载任务
    if (this.currentLoadingTask) {
      console.log(`🚫 [HybridPlayer] 取消之前的后台任务 (track ${this.currentTrackId})`);
      this.shouldCancelLoading = true;
    }
    
    // 🔥 总是使用 Rust 的下一首逻辑（避免双引擎冲突）
    await invoke('player_next');
    
    // 🔥 重置引擎状态（新歌曲会重新走完整流程）
    this.currentEngine = 'rust';
    this.isWebAudioReady = false;
    this.pendingSeekPosition = null;
    
    // 停止 Web Audio（如果正在播放）
    webAudioPlayer.stop();
    
    console.log('✅ [HybridPlayer] 下一首命令已发送（Rust 会处理）');
  }
  
  /**
   * 上一首
   */
  async previous(): Promise<void> {
    console.log('⏮️ [HybridPlayer] 请求上一首...');
    
    // 🔥 取消之前的后台加载任务
    if (this.currentLoadingTask) {
      console.log(`🚫 [HybridPlayer] 取消之前的后台任务 (track ${this.currentTrackId})`);
      this.shouldCancelLoading = true;
    }
    
    // 🔥 总是使用 Rust 的上一首逻辑
    await invoke('player_previous');
    
    // 🔥 重置引擎状态
    this.currentEngine = 'rust';
    this.isWebAudioReady = false;
    this.pendingSeekPosition = null;
    
    // 停止 Web Audio
    webAudioPlayer.stop();
    
    console.log('✅ [HybridPlayer] 上一首命令已发送（Rust 会处理）');
  }
  
  /**
   * 获取当前引擎
   */
  getCurrentEngine(): 'rust' | 'webaudio' {
    return this.currentEngine;
  }
  
  /**
   * Web Audio 引擎是否就绪
   */
  isWebAudioEngineReady(): boolean {
    return this.isWebAudioReady;
  }
}

// 导出单例
export const hybridPlayer = new HybridPlayer();
