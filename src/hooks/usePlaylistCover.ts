/**
 * 歌单封面 Hook
 * 自动加载第一首歌曲的封面作为歌单封面
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

export const usePlaylistCover = (
  playlistId: number,
  coverPath: string | null | undefined,
  trackCount: number
): string | null => {
  const [firstTrackCover, setFirstTrackCover] = useState<string | null>(null);
  const coverUrlRef = useRef<string | null>(null);

  const loadFirstTrackCover = useCallback(async () => {
    try {
      console.log(`[usePlaylistCover] 开始加载歌单 ${playlistId} 的第一首歌封面...`);
      
      const result = await invoke<{ tracks: any[] }>('playlists_get_detail', {
        playlistId,
      });
      
      console.log(`[usePlaylistCover] 歌单 ${playlistId} 曲目数据:`, result.tracks?.length);
      
      if (result.tracks && result.tracks.length > 0) {
        const firstTrack = result.tracks[0];
        console.log(`[usePlaylistCover] 第一首歌:`, { id: firstTrack.id });
        
        // 使用 Tauri invoke 调用获取封面，生成 Blob URL
        if (firstTrack.id) {
          const coverData = await invoke<[number[], string] | null>('get_album_cover', {
            track_id: firstTrack.id,
            trackId: firstTrack.id
          });
          
          if (coverData && coverData[0] && coverData[1]) {
            const [bytes, mimeType] = coverData;
            const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
            const url = URL.createObjectURL(blob);
            
            // 清理旧的 URL
            if (coverUrlRef.current) {
              URL.revokeObjectURL(coverUrlRef.current);
            }
            
            coverUrlRef.current = url;
            setFirstTrackCover(url);
            console.log(`[usePlaylistCover] ✅ 成功加载封面，大小: ${bytes.length} 字节`);
          } else {
            console.log(`[usePlaylistCover] ⚠️ 第一首歌没有封面数据`);
            setFirstTrackCover(null);
          }
        } else {
          console.log(`[usePlaylistCover] 第一首歌没有 ID`);
          setFirstTrackCover(null);
        }
      } else {
        console.log(`[usePlaylistCover] 歌单 ${playlistId} 没有曲目`);
        setFirstTrackCover(null);
      }
    } catch (error) {
      console.error(`[usePlaylistCover] 加载歌单 ${playlistId} 第一首歌封面失败:`, error);
      setFirstTrackCover(null);
    }
  }, [playlistId]);

  useEffect(() => {
    console.log(`[usePlaylistCover] Hook 触发 - playlistId: ${playlistId}, coverPath: ${coverPath}, trackCount: ${trackCount}`);
    
    // 如果 playlistId 无效（0 或负数），清除封面
    if (!playlistId || playlistId <= 0) {
      console.log(`[usePlaylistCover] playlistId 无效，清除封面`);
      // 清理旧的 Blob URL
      if (coverUrlRef.current) {
        URL.revokeObjectURL(coverUrlRef.current);
        coverUrlRef.current = null;
      }
      setFirstTrackCover(null);
      return;
    }
    
    // 如果已有自定义封面路径，清除第一首歌封面
    if (coverPath) {
      console.log(`[usePlaylistCover] 使用自定义封面: ${coverPath}`);
      // 清理旧的 Blob URL
      if (coverUrlRef.current) {
        URL.revokeObjectURL(coverUrlRef.current);
        coverUrlRef.current = null;
      }
      setFirstTrackCover(null);
      return;
    }

    // 如果没有曲目，清除封面
    if (trackCount === 0) {
      console.log(`[usePlaylistCover] 歌单没有曲目，清除封面`);
      // 清理旧的 Blob URL
      if (coverUrlRef.current) {
        URL.revokeObjectURL(coverUrlRef.current);
        coverUrlRef.current = null;
      }
      setFirstTrackCover(null);
      return;
    }

    // 加载第一首歌的封面
    console.log(`[usePlaylistCover] 需要加载第一首歌封面`);
    loadFirstTrackCover();
  }, [playlistId, coverPath, trackCount, loadFirstTrackCover]);

  // 组件卸载时清理 Blob URL
  useEffect(() => {
    return () => {
      if (coverUrlRef.current) {
        URL.revokeObjectURL(coverUrlRef.current);
        coverUrlRef.current = null;
      }
    };
  }, []);

  // 优先返回 cover_path，其次返回第一首歌封面
  return coverPath || firstTrackCover;
};



