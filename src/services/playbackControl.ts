/**
 * Playback control API
 * Unified playback interface using Web Audio Player
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
 * Play track
 */
export async function playerPlay(trackId: number): Promise<void> {
  try {
    console.log(`[PlaybackControl] Play track: track_id=${trackId}`);
    
    const track = await invoke<Track>('get_track', { trackId });
    
    console.log(`[PlaybackControl] Track info retrieved: ${track.title || track.path}`);
    
    const loadSuccess = await webAudioPlayer.loadTrack(track);
    if (!loadSuccess) {
      throw new Error('Failed to load track');
    }
    
    const playSuccess = await webAudioPlayer.play();
    if (!playSuccess) {
      throw new Error('Failed to play');
    }
    
    console.log(`[PlaybackControl] Play successful`);
  } catch (error) {
    console.error('[PlaybackControl] Play failed:', error);
    throw error;
  }
}

/**
 * Pause playback
 */
export async function playerPause(): Promise<void> {
  try {
    webAudioPlayer.pause();
    console.log('[PlaybackControl] Paused');
  } catch (error) {
    console.error('[PlaybackControl] Pause failed:', error);
    throw error;
  }
}

/**
 * Resume playback
 */
export async function playerResume(): Promise<void> {
  try {
    await webAudioPlayer.play();
    console.log('[PlaybackControl] Resumed');
  } catch (error) {
    console.error('[PlaybackControl] Resume failed:', error);
    throw error;
  }
}

/**
 * Stop playback
 */
export async function playerStop(): Promise<void> {
  try {
    webAudioPlayer.stop();
    console.log('[PlaybackControl] Stopped');
  } catch (error) {
    console.error('[PlaybackControl] Stop failed:', error);
    throw error;
  }
}

/**
 * Seek to position
 * @param positionMs Position in milliseconds
 */
export async function playerSeek(positionMs: number): Promise<void> {
  try {
    const positionSec = positionMs / 1000;
    await webAudioPlayer.seek(positionSec);
    console.log(`[PlaybackControl] Seek to ${positionSec.toFixed(2)}s (instant!)`);
  } catch (error) {
    console.error('[PlaybackControl] Seek failed:', error);
    throw error;
  }
}

/**
 * Set volume
 * @param volume Volume level (0.0 - 1.0)
 */
export async function playerSetVolume(volume: number): Promise<void> {
  try {
    webAudioPlayer.setVolume(volume);
    console.log(`[PlaybackControl] Volume set to ${(volume * 100).toFixed(0)}%`);
  } catch (error) {
    console.error('[PlaybackControl] Set volume failed:', error);
    throw error;
  }
}

/**
 * Play next track
 */
export async function playerNext(): Promise<void> {
  try {
    await webAudioPlayer.nextTrack();
    console.log('[PlaybackControl] Next track');
  } catch (error) {
    console.error('[PlaybackControl] Next failed:', error);
    throw error;
  }
}

/**
 * Play previous track
 */
export async function playerPrevious(): Promise<void> {
  try {
    await webAudioPlayer.previousTrack();
    console.log('[PlaybackControl] Previous track');
  } catch (error) {
    console.error('[PlaybackControl] Previous failed:', error);
    throw error;
  }
}

/**
 * Load playlist
 */
export async function playerLoadPlaylist(tracks: Track[], startIndex: number = 0): Promise<void> {
  try {
    console.log(`[PlaybackControl] Load playlist: ${tracks.length} tracks`);
    
    webAudioPlayer.setPlaylist(tracks, startIndex);
    
    if (startIndex >= 0 && startIndex < tracks.length) {
      const track = tracks[startIndex];
      await webAudioPlayer.loadTrack(track);
      await webAudioPlayer.play();
    }
    
    console.log('[PlaybackControl] Playlist loaded');
  } catch (error) {
    console.error('[PlaybackControl] Load playlist failed:', error);
    throw error;
  }
}

/**
 * Get current position in milliseconds
 */
export function getPosition(): number {
  return webAudioPlayer.getPosition() * 1000;
}

/**
 * Get duration in milliseconds
 */
export function getDuration(): number {
  return webAudioPlayer.getDuration() * 1000;
}

/**
 * Get current track
 */
export function getCurrentTrack(): Track | null {
  return webAudioPlayer.getCurrentTrack();
}

