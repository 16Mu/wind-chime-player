/**
 * Web Audio API player
 * Full file decoding to memory for instant seeking
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
 * Web Audio API audio player
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
  
  private progressTimer: number | null = null;
  private callbacks: AudioPlayerCallbacks = {};
  
  /**
   * Initialize player
   */
  async initialize(callbacks?: AudioPlayerCallbacks): Promise<boolean> {
    try {
      console.log('[WebAudioPlayer] Initializing Web Audio API...');
      
      this.callbacks = callbacks || {};
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.gainNode.gain.value = this.volume;
      
      console.log('[WebAudioPlayer] Initialization complete');
      return true;
    } catch (error) {
      console.error('[WebAudioPlayer] Initialization failed:', error);
      return false;
    }
  }
  
  /**
   * Load audio track into memory
   */
  async loadTrack(track: Track): Promise<boolean> {
    try {
      console.log(`[WebAudioPlayer] Loading: ${track.title || track.path}`);
      const loadStart = performance.now();
      
      this.stop();
      this.audioBuffer = null;
      
      console.log('[WebAudioPlayer] Reading file...');
      const readStart = performance.now();
      
      let fileData: Uint8Array;
      
      // 🔥 检查是否是 WebDAV 路径
      if (track.path.startsWith('webdav://')) {
        console.log('[WebAudioPlayer] Detected WebDAV path, resolving server config and using webdav_download_file...');
        
        // 解析 webdav://server_id#/path/to/file 格式
        const match = track.path.match(/^webdav:\/\/([^#]+)#(.*)$/);
        if (!match) {
          throw new Error('Invalid WebDAV track path format');
        }
        
        const [, serverId, filePath] = match;
        console.log(`[WebAudioPlayer] Resolving WebDAV server: ${serverId}`);
        
        const { invoke } = await import('@tauri-apps/api/core');
        const servers = await invoke<any[]>('remote_get_servers');
        const server = (servers as any[]).find(s => s.id === serverId && s.server_type === 'webdav');
        
        if (!server || !server.config) {
          throw new Error(`WebDAV server not found: ${serverId}`);
        }
        
        const config = server.config as { url: string; username: string; password: string; mount_path?: string };
        const username = config.username;
        const password = config.password;

        // 构造包含挂载路径的基础 URL
        let baseUrl = (config.url || '').replace(/\/+$/, '');
        const mountPath = (config.mount_path || '').trim();
        if (mountPath) {
          const cleanMount = mountPath.replace(/^\/+/, '').replace(/\/+$/, '');
          if (cleanMount) {
            baseUrl = `${baseUrl}/${cleanMount}`;
          }
        }

        const url = baseUrl;
        console.log(`[WebAudioPlayer] Downloading from: ${url}${filePath}`);
        
        const bytes = await invoke<number[]>('webdav_download_file', {
          url,
          username,
          password,
          filePath,
        });
        
        fileData = new Uint8Array(bytes);
        console.log(`[WebAudioPlayer] WebDAV download complete (${fileData.byteLength} bytes, ${Math.round(performance.now() - readStart)}ms)`);
      } else {
        // 本地文件，使用标准 readFile
        fileData = await readFile(track.path);
        console.log(`[WebAudioPlayer] File read complete (${fileData.byteLength} bytes, ${Math.round(performance.now() - readStart)}ms)`);
      }
      
      // 创建标准 ArrayBuffer（避免 TypedArray 偏移和类型不兼容问题）
      const fileCopy = fileData.slice();
      const arrayBuffer = fileCopy.buffer;
      
      console.log('[WebAudioPlayer] Decoding audio...');
      const decodeStart = performance.now();
      
      this.audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      
      this.duration = this.audioBuffer.duration;
      
      console.log(`[WebAudioPlayer] Decode complete!`);
      console.log(`   - Decode time: ${Math.round(performance.now() - decodeStart)}ms`);
      console.log(`   - Total time: ${Math.round(performance.now() - loadStart)}ms`);
      console.log(`   - Duration: ${Math.round(this.duration)}s`);
      console.log(`   - Sample rate: ${this.audioBuffer.sampleRate}Hz`);
      console.log(`   - Channels: ${this.audioBuffer.numberOfChannels}`);
      
      this.currentTrack = track;
      
      if (this.callbacks.onTrackChanged) {
        this.callbacks.onTrackChanged(track);
      }
      
      return true;
    } catch (error) {
      console.error('[WebAudioPlayer] Audio loading failed:', error);
      return false;
    }
  }
  
  /**
   * Play audio
   */
  async play(): Promise<boolean> {
    try {
      if (!this.audioBuffer) {
        console.warn('[WebAudioPlayer] No audio loaded');
        return false;
      }
      
      if (this.audioContext!.state === 'suspended') {
        await this.audioContext!.resume();
      }
      
      if (this.isPlaying && !this.isPaused) {
        return true;
      }
      
      if (this.sourceNode) {
        try {
          this.sourceNode.onended = null;
          this.sourceNode.stop();
          this.sourceNode.disconnect();
        } catch (e) {}
        this.sourceNode = null;
      }
      
      this.sourceNode = this.audioContext!.createBufferSource();
      this.sourceNode.buffer = this.audioBuffer;
      
      this.sourceNode.connect(this.gainNode!);
      
      this.sourceNode.onended = () => {
        if (this.isPlaying) {
          this.onTrackEnded();
        }
      };
      
      const offset = this.isPaused ? this.pauseTime : 0;
      const validOffset = Math.max(0, Math.min(offset, this.duration - 0.1));
      
      console.log(`[WebAudioPlayer] Playing (offset: ${validOffset.toFixed(2)}s)`);
      
      this.sourceNode.start(0, validOffset);
      this.startTime = this.audioContext!.currentTime - validOffset;
      
      this.isPlaying = true;
      this.isPaused = false;
      
      this.startProgressTimer();
      
      if (this.callbacks.onPlaybackStateChanged) {
        this.callbacks.onPlaybackStateChanged(true);
      }
      
      return true;
    } catch (error) {
      console.error('[WebAudioPlayer] Play failed:', error);
      return false;
    }
  }
  
  /**
   * Pause playback
   */
  pause(): boolean {
    try {
      if (!this.isPlaying) {
        return false;
      }
      
      const currentPosition = this.audioContext!.currentTime - this.startTime;
      this.pauseTime = Math.max(0, Math.min(currentPosition, this.duration - 0.1));
      
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
      
      this.stopProgressTimer();
      
      console.log(`[WebAudioPlayer] Paused (position: ${this.pauseTime.toFixed(2)}s)`);
      
      if (this.callbacks.onPlaybackStateChanged) {
        this.callbacks.onPlaybackStateChanged(false);
      }
      
      return true;
    } catch (error) {
      console.error('[WebAudioPlayer] Pause failed:', error);
      return false;
    }
  }
  
  /**
   * Stop playback
   */
  stop(): boolean {
    try {
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
      
      this.stopProgressTimer();
      
      if (this.callbacks.onPlaybackStateChanged) {
        this.callbacks.onPlaybackStateChanged(false);
      }
      
      if (this.callbacks.onPositionChanged) {
        this.callbacks.onPositionChanged(0);
      }
      
      return true;
    } catch (error) {
      console.error('[WebAudioPlayer] Stop failed:', error);
      return false;
    }
  }
  
  /**
   * Seek to position (instant)
   */
  async seek(position: number): Promise<boolean> {
    try {
      if (!this.audioBuffer) {
        return false;
      }
      
      const wasPlaying = this.isPlaying;
      
      console.log(`[WebAudioPlayer] Seek to ${position.toFixed(2)}s (instant)`);
      
      if (this.sourceNode) {
        try {
          this.sourceNode.onended = null;
          this.sourceNode.stop();
          this.sourceNode.disconnect();
        } catch (e) {}
        this.sourceNode = null;
      }
      
      this.stopProgressTimer();
      
      this.pauseTime = Math.max(0, Math.min(position, this.duration));
      this.isPaused = true;
      this.isPlaying = false;
      
      if (wasPlaying) {
        await this.play();
      }
      
      if (this.callbacks.onPositionChanged) {
        this.callbacks.onPositionChanged(this.pauseTime);
      }
      
      return true;
    } catch (error) {
      console.error('[WebAudioPlayer] Seek failed:', error);
      return false;
    }
  }
  
  /**
   * Set volume
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
   * Get current playback position
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
   * Get audio duration
   */
  getDuration(): number {
    return this.duration;
  }
  
  /**
   * Get current track
   */
  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }
  
  /**
   * Set playlist
   */
  setPlaylist(tracks: Track[], startIndex: number = 0): void {
    this.playlist = tracks;
    this.currentIndex = startIndex;
    console.log(`[WebAudioPlayer] Playlist set: ${tracks.length} tracks`);
  }
  
  /**
   * Play next track
   */
  async nextTrack(): Promise<boolean> {
    if (this.playlist.length === 0) {
      return false;
    }
    
    this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
    const nextTrack = this.playlist[this.currentIndex];
    
    console.log(`[WebAudioPlayer] Next track: ${nextTrack.title || nextTrack.path}`);
    
    const loadResult = await this.loadTrack(nextTrack);
    if (loadResult) {
      return await this.play();
    }
    
    return false;
  }
  
  /**
   * Play previous track
   */
  async previousTrack(): Promise<boolean> {
    if (this.playlist.length === 0) {
      return false;
    }
    
    this.currentIndex = this.currentIndex > 0 
      ? this.currentIndex - 1 
      : this.playlist.length - 1;
    const prevTrack = this.playlist[this.currentIndex];
    
    console.log(`[WebAudioPlayer] Previous track: ${prevTrack.title || prevTrack.path}`);
    
    const loadResult = await this.loadTrack(prevTrack);
    if (loadResult) {
      return await this.play();
    }
    
    return false;
  }
  
  /**
   * Handle track ended
   */
  private onTrackEnded(): void {
    console.log('[WebAudioPlayer] Track ended');
    
    this.isPlaying = false;
    this.isPaused = false;
    
    if (this.callbacks.onTrackEnded) {
      this.callbacks.onTrackEnded();
    }
  }
  
  /**
   * Start progress update timer
   */
  private startProgressTimer(): void {
    this.stopProgressTimer();
    
    this.progressTimer = window.setInterval(() => {
      if (this.isPlaying && this.callbacks.onPositionChanged) {
        this.callbacks.onPositionChanged(this.getPosition());
      }
    }, 100);
  }
  
  /**
   * Stop progress update timer
   */
  private stopProgressTimer(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }
  
  /**
   * Destroy player
   */
  destroy(): void {
    this.stop();
    this.stopProgressTimer();
    
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

export const webAudioPlayer = new WebAudioPlayer();

