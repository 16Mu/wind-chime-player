/**
 * 播放控制 API
 * 
 * 提供统一的播放控制接口，内部使用 Web Audio Player
 * 替代原来的 Rust 后端调用
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

/**
 * 播放指定歌曲（替代 player_play）
 */
export async function playerPlay(trackId: number): Promise<void> {
  try {
    console.log(`🎵 [PlaybackControl] 播放歌曲: track_id=${trackId}`);
    
    // 1. 从数据库获取歌曲信息
    const track = await invoke<Track>('get_track', { trackId });
    
    console.log(`✅ [PlaybackControl] 获取歌曲信息: ${track.title || track.path}`);
    
    // 2. 使用 Web Audio Player 加载并播放
    const loadSuccess = await webAudioPlayer.loadTrack(track);
    if (!loadSuccess) {
      throw new Error('加载歌曲失败');
    }
    
    const playSuccess = await webAudioPlayer.play();
    if (!playSuccess) {
      throw new Error('播放失败');
    }
    
    console.log(`✅ [PlaybackControl] 播放成功`);
  } catch (error) {
    console.error('❌ [PlaybackControl] 播放失败:', error);
    throw error;
  }
}

/**
 * 暂停播放（替代 player_pause）
 */
export async function playerPause(): Promise<void> {
  try {
    webAudioPlayer.pause();
    console.log('⏸️ [PlaybackControl] 已暂停');
  } catch (error) {
    console.error('❌ [PlaybackControl] 暂停失败:', error);
    throw error;
  }
}

/**
 * 继续播放（替代 player_resume）
 */
export async function playerResume(): Promise<void> {
  try {
    await webAudioPlayer.play();
    console.log('▶️ [PlaybackControl] 已继续播放');
  } catch (error) {
    console.error('❌ [PlaybackControl] 继续播放失败:', error);
    throw error;
  }
}

/**
 * 停止播放（替代 player_stop）
 */
export async function playerStop(): Promise<void> {
  try {
    webAudioPlayer.stop();
    console.log('⏹️ [PlaybackControl] 已停止');
  } catch (error) {
    console.error('❌ [PlaybackControl] 停止失败:', error);
    throw error;
  }
}

/**
 * 跳转到指定位置（替代 player_seek）
 * @param positionMs 位置（毫秒）
 */
export async function playerSeek(positionMs: number): Promise<void> {
  try {
    const positionSec = positionMs / 1000;
    await webAudioPlayer.seek(positionSec);
    console.log(`⚡ [PlaybackControl] Seek 到 ${positionSec.toFixed(2)}s (0 延迟!)`);
  } catch (error) {
    console.error('❌ [PlaybackControl] Seek 失败:', error);
    throw error;
  }
}

/**
 * 设置音量（替代 player_set_volume）
 * @param volume 音量 (0.0 - 1.0)
 */
export async function playerSetVolume(volume: number): Promise<void> {
  try {
    webAudioPlayer.setVolume(volume);
    console.log(`🔊 [PlaybackControl] 音量设置为 ${(volume * 100).toFixed(0)}%`);
  } catch (error) {
    console.error('❌ [PlaybackControl] 设置音量失败:', error);
    throw error;
  }
}

/**
 * 播放下一首（替代 player_next）
 */
export async function playerNext(): Promise<void> {
  try {
    await webAudioPlayer.nextTrack();
    console.log('⏭️ [PlaybackControl] 已切换到下一首');
  } catch (error) {
    console.error('❌ [PlaybackControl] 下一首失败:', error);
    throw error;
  }
}

/**
 * 播放上一首（替代 player_previous）
 */
export async function playerPrevious(): Promise<void> {
  try {
    await webAudioPlayer.previousTrack();
    console.log('⏮️ [PlaybackControl] 已切换到上一首');
  } catch (error) {
    console.error('❌ [PlaybackControl] 上一首失败:', error);
    throw error;
  }
}

/**
 * 加载播放列表（替代 player_load_playlist）
 */
export async function playerLoadPlaylist(tracks: Track[], startIndex: number = 0): Promise<void> {
  try {
    console.log(`📋 [PlaybackControl] 加载播放列表: ${tracks.length}首歌曲`);
    
    webAudioPlayer.setPlaylist(tracks, startIndex);
    
    // 如果指定了起始歌曲，加载并播放
    if (startIndex >= 0 && startIndex < tracks.length) {
      const track = tracks[startIndex];
      await webAudioPlayer.loadTrack(track);
      await webAudioPlayer.play();
    }
    
    console.log('✅ [PlaybackControl] 播放列表加载完成');
  } catch (error) {
    console.error('❌ [PlaybackControl] 加载播放列表失败:', error);
    throw error;
  }
}

/**
 * 获取当前播放位置（毫秒）
 */
export function getPosition(): number {
  return webAudioPlayer.getPosition() * 1000;
}

/**
 * 获取歌曲总时长（毫秒）
 */
export function getDuration(): number {
  return webAudioPlayer.getDuration() * 1000;
}

/**
 * 获取当前歌曲
 */
export function getCurrentTrack(): Track | null {
  return webAudioPlayer.getCurrentTrack();
}

