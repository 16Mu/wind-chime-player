import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Track {
  id: number;
  path: string;
}

/**
 * 专辑封面加载Hook
 * 自动加载和管理专辑封面URL
 */
export function useAlbumCovers(tracks: Track[]) {
  const [albumCoverUrls, setAlbumCoverUrls] = useState<{ [trackId: number]: string }>({});
  const urlsRef = useRef<{ [trackId: number]: string }>({});

  useEffect(() => {
    const loadCovers = async () => {
      const currentTrackIds = new Set(tracks.map(t => t.id));
      let hasChanges = false;
      
      // 清理不再需要的 URL
      Object.keys(urlsRef.current).forEach(trackIdStr => {
        const trackId = parseInt(trackIdStr);
        if (!currentTrackIds.has(trackId)) {
          const url = urlsRef.current[trackId];
          if (url) {
            URL.revokeObjectURL(url);
            delete urlsRef.current[trackId];
            hasChanges = true;
          }
        }
      });

      // 如果有清理，更新状态
      if (hasChanges) {
        setAlbumCoverUrls(prev => {
          const newUrls = { ...prev };
          Object.keys(newUrls).forEach(trackIdStr => {
            const trackId = parseInt(trackIdStr);
            if (!currentTrackIds.has(trackId)) {
              delete newUrls[trackId];
            }
          });
          return newUrls;
        });
      }

      // 加载新的封面
      for (const track of tracks) {
        if (urlsRef.current[track.id]) continue;

        try {
          const result = await invoke<[number[], string] | null>('get_album_cover', {
            trackId: track.id
          });

          if (result && result[0] && result[0].length > 0) {
            const [coverData, mimeType] = result;
            const blob = new Blob([new Uint8Array(coverData)], { type: mimeType || 'image/jpeg' });
            const url = URL.createObjectURL(blob);
            
            urlsRef.current[track.id] = url;
            setAlbumCoverUrls(prev => ({ ...prev, [track.id]: url }));
          }
        } catch (err) {
          console.warn(`封面加载失败 (track ${track.id}):`, err);
        }
      }
    };

    loadCovers();
  }, [tracks]);

  // 组件卸载时清理所有 URL
  useEffect(() => {
    return () => {
      Object.values(urlsRef.current).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
      urlsRef.current = {};
    };
  }, []);

  return albumCoverUrls;
}

