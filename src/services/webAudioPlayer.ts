/**
 * Web Audio API 播放器
 * 
 * 特点：
 * - 完整文件解码到内存
 * - 0 延迟 seek（纯内存操作）
 * - 浏览器内置解码器（硬件加速，快速）
 */

import { readFile } from '@tauri-apps/plugin-fs';

export interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
}

export interface AudioPlayerCallbacks {
  onTrackChanged?: (track: Track | null) => void;
  onPlaybackStateChanged?: (isPlaying: boolean) => void;
  onPositionChanged?: (position: number) => void;
  onVolumeChanged?: (volume: number) => void;
  onTrackEnded?: () => void;
}

/**
 * Web Audio API 音频播放器
 */
export class WebAudioPlayer {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  
  private isPlaying = false;
  private isPaused = false;
  private startTime = 0;
  private pauseTime = 0;
  private duration = 0;
  private volume = 0.7;
  
  private currentTrack: Track | null = null;
  private playlist: Track[] = [];
  private currentIndex = -1;
  
  // 进度更新定时器
  private progressTimer: number | null = null;
  
  // 回调函数
  private callbacks: AudioPlayerCallbacks = {};
  
  /**
   * 初始化播放器
   */
  async initialize(callbacks?: AudioPlayerCallbacks): Promise<boolean> {
    try {
      console.log('🎵 [WebAudioPlayer] 初始化 Web Audio API...');
      
      this.callbacks = callbacks || {};
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.gainNode.gain.value = this.volume;
      
      console.log('✅ [WebAudioPlayer] 初始化完成');
      return true;
    } catch (error) {
      console.error('❌ [WebAudioPlayer] 初始化失败:', error);
      return false;
    }
  }
  
  /**
   * 加载音频文件（完整加载到内存）
   */
  async loadTrack(track: Track): Promise<boolean> {
    try {
      console.log(`🎵 [WebAudioPlayer] 加载音频: ${track.title || track.path}`);
      const loadStart = performance.now();
      
      this.stop();
      
      // 清理旧的音频缓冲区
      this.audioBuffer = null;
      
      // 🔥 关键：使用 Tauri fs 插件读取文件（高性能，快速）
      console.log('📖 [WebAudioPlayer] 读取本地文件...');
      const readStart = performance.now();
      
      // 使用 Tauri 的 readFile（直接返回 Uint8Array）
      const fileData = await readFile(track.path);
      
      console.log(`✅ [WebAudioPlayer] 文件读取完成 (${fileData.byteLength} 字节, 耗时: ${Math.round(performance.now() - readStart)}ms)`);
      
      // 转换为 ArrayBuffer
      const arrayBuffer = fileData.buffer;
      
      // 🔥 关键：使用 Web Audio API 解码（快速！）
      console.log('🔄 [WebAudioPlayer] 开始解码音频...');
      const decodeStart = performance.now();
      
      this.audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      
      this.duration = this.audioBuffer.duration;
      
      console.log(`✅ [WebAudioPlayer] 解码完成！`);
      console.log(`   - 解码耗时: ${Math.round(performance.now() - decodeStart)}ms`);
      console.log(`   - 总耗时: ${Math.round(performance.now() - loadStart)}ms`);
      console.log(`   - 时长: ${Math.round(this.duration)}s`);
      console.log(`   - 采样率: ${this.audioBuffer.sampleRate}Hz`);
      console.log(`   - 声道数: ${this.audioBuffer.numberOfChannels}`);
      
      // 更新当前歌曲信息
      this.currentTrack = track;
      
      // 触发回调
      if (this.callbacks.onTrackChanged) {
        this.callbacks.onTrackChanged(track);
      }
      
      return true;
    } catch (error) {
      console.error('❌ [WebAudioPlayer] 音频加载失败:', error);
      return false;
    }
  }
  
  /**
   * 播放音频
   */
  async play(): Promise<boolean> {
    try {
      if (!this.audioBuffer) {
        console.warn('⚠️ [WebAudioPlayer] 没有加载的音频');
        return false;
      }
      
      // 恢复音频上下文（用户交互后需要）
      if (this.audioContext!.state === 'suspended') {
        await this.audioContext!.resume();
      }
      
      // 如果已经在播放且未暂停，不重复播放
      if (this.isPlaying && !this.isPaused) {
        return true;
      }
      
      // 停止当前播放
      if (this.sourceNode) {
        try {
          this.sourceNode.onended = null;
          this.sourceNode.stop();
          this.sourceNode.disconnect();
        } catch (e) {
          // 忽略已停止的错误
        }
        this.sourceNode = null;
      }
      
      // 🎯 创建新的音频源
      this.sourceNode = this.audioContext!.createBufferSource();
      this.sourceNode.buffer = this.audioBuffer;
      
      // 连接到增益节点
      this.sourceNode.connect(this.gainNode!);
      
      // 设置播放结束回调
      this.sourceNode.onended = () => {
        if (this.isPlaying) {
          this.onTrackEnded();
        }
      };
      
      // 🔥 关键：从指定位置开始播放
      const offset = this.isPaused ? this.pauseTime : 0;
      const validOffset = Math.max(0, Math.min(offset, this.duration - 0.1));
      
      console.log(`▶️ [WebAudioPlayer] 开始播放 (偏移: ${validOffset.toFixed(2)}s)`);
      
      this.sourceNode.start(0, validOffset);
      this.startTime = this.audioContext!.currentTime - validOffset;
      
      this.isPlaying = true;
      this.isPaused = false;
      
      // 开始进度更新
      this.startProgressTimer();
      
      // 触发回调
      if (this.callbacks.onPlaybackStateChanged) {
        this.callbacks.onPlaybackStateChanged(true);
      }
      
      return true;
    } catch (error) {
      console.error('❌ [WebAudioPlayer] 播放失败:', error);
      return false;
    }
  }
  
  /**
   * 暂停播放
   */
  pause(): boolean {
    try {
      if (!this.isPlaying) {
        return false;
      }
      
      // 记录暂停位置
      const currentPosition = this.audioContext!.currentTime - this.startTime;
      this.pauseTime = Math.max(0, Math.min(currentPosition, this.duration - 0.1));
      
      // 停止音频源
      if (this.sourceNode) {
        try {
          this.sourceNode.onended = null;
          this.sourceNode.stop();
          this.sourceNode.disconnect();
        } catch (e) {}
        this.sourceNode = null;
      }
      
      this.isPlaying = false;
      this.isPaused = true;
      
      // 停止进度更新
      this.stopProgressTimer();
      
      console.log(`⏸️ [WebAudioPlayer] 暂停播放 (位置: ${this.pauseTime.toFixed(2)}s)`);
      
      // 触发回调
      if (this.callbacks.onPlaybackStateChanged) {
        this.callbacks.onPlaybackStateChanged(false);
      }
      
      return true;
    } catch (error) {
      console.error('❌ [WebAudioPlayer] 暂停失败:', error);
      return false;
    }
  }
  
  /**
   * 停止播放
   */
  stop(): boolean {
    try {
      // 停止音频源
      if (this.sourceNode) {
        try {
          this.sourceNode.onended = null;
          this.sourceNode.stop();
          this.sourceNode.disconnect();
        } catch (e) {}
        this.sourceNode = null;
      }
      
      this.isPlaying = false;
      this.isPaused = false;
      this.startTime = 0;
      this.pauseTime = 0;
      
      // 停止进度更新
      this.stopProgressTimer();
      
      // 触发回调
      if (this.callbacks.onPlaybackStateChanged) {
        this.callbacks.onPlaybackStateChanged(false);
      }
      
      if (this.callbacks.onPositionChanged) {
        this.callbacks.onPositionChanged(0);
      }
      
      return true;
    } catch (error) {
      console.error('❌ [WebAudioPlayer] 停止失败:', error);
      return false;
    }
  }
  
  /**
   * 跳转到指定位置（0 延迟！）
   */
  async seek(position: number): Promise<boolean> {
    try {
      if (!this.audioBuffer) {
        return false;
      }
      
      const wasPlaying = this.isPlaying;
      
      console.log(`⚡ [WebAudioPlayer] Seek 到 ${position.toFixed(2)}s (0 延迟)`);
      
      // 停止当前播放
      if (this.sourceNode) {
        try {
          this.sourceNode.onended = null;
          this.sourceNode.stop();
          this.sourceNode.disconnect();
        } catch (e) {}
        this.sourceNode = null;
      }
      
      // 停止进度更新
      this.stopProgressTimer();
      
      // 设置新位置
      this.pauseTime = Math.max(0, Math.min(position, this.duration));
      this.isPaused = true;
      this.isPlaying = false;
      
      // 如果之前在播放，继续播放
      if (wasPlaying) {
        await this.play();
      }
      
      // 触发回调
      if (this.callbacks.onPositionChanged) {
        this.callbacks.onPositionChanged(this.pauseTime);
      }
      
      return true;
    } catch (error) {
      console.error('❌ [WebAudioPlayer] Seek 失败:', error);
      return false;
    }
  }
  
  /**
   * 设置音量
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(this.volume, this.audioContext!.currentTime);
    }
    
    if (this.callbacks.onVolumeChanged) {
      this.callbacks.onVolumeChanged(this.volume);
    }
  }
  
  /**
   * 获取当前播放位置
   */
  getPosition(): number {
    if (!this.isPlaying && !this.isPaused) {
      return 0;
    }
    
    if (this.isPaused) {
      return this.pauseTime;
    }
    
    return this.audioContext!.currentTime - this.startTime;
  }
  
  /**
   * 获取音频时长
   */
  getDuration(): number {
    return this.duration;
  }
  
  /**
   * 获取当前歌曲
   */
  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }
  
  /**
   * 设置播放列表
   */
  setPlaylist(tracks: Track[], startIndex: number = 0): void {
    this.playlist = tracks;
    this.currentIndex = startIndex;
    console.log(`📋 [WebAudioPlayer] 播放列表已设置: ${tracks.length}首歌曲`);
  }
  
  /**
   * 下一首
   */
  async nextTrack(): Promise<boolean> {
    if (this.playlist.length === 0) {
      return false;
    }
    
    this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
    const nextTrack = this.playlist[this.currentIndex];
    
    console.log(`⏭️ [WebAudioPlayer] 切换到下一首: ${nextTrack.title || nextTrack.path}`);
    
    const loadResult = await this.loadTrack(nextTrack);
    if (loadResult) {
      return await this.play();
    }
    
    return false;
  }
  
  /**
   * 上一首
   */
  async previousTrack(): Promise<boolean> {
    if (this.playlist.length === 0) {
      return false;
    }
    
    this.currentIndex = this.currentIndex > 0 
      ? this.currentIndex - 1 
      : this.playlist.length - 1;
    const prevTrack = this.playlist[this.currentIndex];
    
    console.log(`⏮️ [WebAudioPlayer] 切换到上一首: ${prevTrack.title || prevTrack.path}`);
    
    const loadResult = await this.loadTrack(prevTrack);
    if (loadResult) {
      return await this.play();
    }
    
    return false;
  }
  
  /**
   * 歌曲播放结束处理
   */
  private onTrackEnded(): void {
    console.log('🔚 [WebAudioPlayer] 歌曲播放结束');
    
    this.isPlaying = false;
    this.isPaused = false;
    
    // 🔥 只触发回调，不自动播放下一首
    // 让混合播放器或外部控制器决定是否播放下一首
    if (this.callbacks.onTrackEnded) {
      this.callbacks.onTrackEnded();
    }
    
    // 注意：不再自动播放下一首，避免与混合播放器冲突
    // 如果需要自动播放，应该在 onTrackEnded 回调中处理
  }
  
  /**
   * 开始进度更新定时器
   */
  private startProgressTimer(): void {
    this.stopProgressTimer();
    
    this.progressTimer = window.setInterval(() => {
      if (this.isPlaying && this.callbacks.onPositionChanged) {
        this.callbacks.onPositionChanged(this.getPosition());
      }
    }, 100); // 100ms 更新一次，更流畅
  }
  
  /**
   * 停止进度更新定时器
   */
  private stopProgressTimer(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }
  
  /**
   * 销毁播放器
   */
  destroy(): void {
    this.stop();
    this.stopProgressTimer();
    
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

// 创建全局单例
export const webAudioPlayer = new WebAudioPlayer();

