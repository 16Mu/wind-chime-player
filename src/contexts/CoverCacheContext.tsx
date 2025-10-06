/**
 * 全局封面缓存 Context
 * 避免重复加载封面，提升性能
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { getAllArtistCovers, convertCoverDataToUrl } from '../services/networkApiService';
import { invoke } from '@tauri-apps/api/core';

interface CoverCacheContextType {
  // 艺术家封面缓存
  artistCovers: Map<string, string>;
  loadArtistCovers: () => Promise<void>;
  getArtistCover: (artistName: string) => string | undefined;
  
  // 专辑封面缓存
  albumCovers: Map<string, string>;
  loadAlbumCover: (trackId: number, albumKey: string) => Promise<string | null>;
  getAlbumCover: (albumKey: string) => string | undefined;
  
  // 清理缓存
  clearCache: () => void;
}

const CoverCacheContext = createContext<CoverCacheContextType | undefined>(undefined);

export function CoverCacheProvider({ children }: { children: React.ReactNode }) {
  const [artistCovers, setArtistCovers] = useState<Map<string, string>>(new Map());
  const [albumCovers, setAlbumCovers] = useState<Map<string, string>>(new Map());
  
  // 加载状态标记
  const isLoadingArtistCovers = useRef(false);
  const artistCoversLoaded = useRef(false);
  const albumCoverPromises = useRef<Map<string, Promise<string | null>>>(new Map());

  // 批量加载所有艺术家封面（只加载一次）
  const loadArtistCovers = useCallback(async () => {
    // 如果已经加载过或正在加载，直接返回
    if (artistCoversLoaded.current || isLoadingArtistCovers.current) {
      console.log('⚡ 艺术家封面已缓存，跳过加载');
      return;
    }

    isLoadingArtistCovers.current = true;
    const startTime = performance.now();
    
    try {
      console.log('🚀 [CoverCache] 开始批量加载艺术家封面...');
      
      // 从数据库获取所有封面
      const allCachedCovers = await getAllArtistCovers();
      
      if (allCachedCovers.size === 0) {
        console.log('⚠️ 数据库中没有缓存的封面');
        artistCoversLoaded.current = true;
        return;
      }
      
      // 批量转换为 Blob URL
      const newCovers = new Map<string, string>();
      allCachedCovers.forEach((coverData, artistName) => {
        const url = convertCoverDataToUrl(coverData.data, coverData.mimeType);
        newCovers.set(artistName, url);
      });
      
      setArtistCovers(newCovers);
      artistCoversLoaded.current = true;
      
      const totalTime = (performance.now() - startTime).toFixed(2);
      console.log(`✅ [CoverCache] 艺术家封面加载完成！${newCovers.size} 个封面，耗时 ${totalTime}ms`);
      
    } catch (error) {
      console.error('❌ [CoverCache] 批量加载封面失败:', error);
    } finally {
      isLoadingArtistCovers.current = false;
    }
  }, []);

  // 获取艺术家封面
  const getArtistCover = useCallback((artistName: string) => {
    return artistCovers.get(artistName);
  }, [artistCovers]);

  // 加载单个专辑封面（带缓存和去重）
  const loadAlbumCover = useCallback(async (trackId: number, albumKey: string): Promise<string | null> => {
    // 如果已缓存，直接返回
    if (albumCovers.has(albumKey)) {
      return albumCovers.get(albumKey)!;
    }

    // 如果正在加载，返回现有的 Promise（避免重复请求）
    if (albumCoverPromises.current.has(albumKey)) {
      return albumCoverPromises.current.get(albumKey)!;
    }

    // 创建新的加载 Promise
    const loadPromise = (async () => {
      try {
        console.log(`🔍 [CoverCache] 开始加载专辑封面: ${albumKey}, track_id: ${trackId}`);
        const result = await invoke('get_album_cover', { 
          track_id: trackId, 
          trackId: trackId 
        }) as [number[], string] | null;
        
        if (result) {
          const [imageData, mimeType] = result;
          console.log(`✅ [CoverCache] 收到封面数据: ${albumKey}, 大小: ${imageData.length} 字节, MIME: ${mimeType}`);
          const blob = new Blob([new Uint8Array(imageData)], { type: mimeType });
          const url = URL.createObjectURL(blob);
          console.log(`✅ [CoverCache] 创建 Blob URL: ${url}`);
          
          // 更新缓存
          setAlbumCovers(prev => new Map(prev).set(albumKey, url));
          
          return url;
        } else {
          console.warn(`⚠️ [CoverCache] 未找到封面数据: ${albumKey}, track_id: ${trackId}`);
        }
        return null;
      } catch (error) {
        console.error(`❌ 加载专辑封面失败 (${albumKey}):`, error);
        return null;
      } finally {
        // 清理 Promise 缓存
        albumCoverPromises.current.delete(albumKey);
      }
    })();

    // 缓存 Promise
    albumCoverPromises.current.set(albumKey, loadPromise);
    
    return loadPromise;
  }, [albumCovers]);

  // 获取专辑封面
  const getAlbumCover = useCallback((albumKey: string) => {
    return albumCovers.get(albumKey);
  }, [albumCovers]);

  // 清理缓存
  const clearCache = useCallback(() => {
    // 释放所有 Blob URLs
    artistCovers.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // 忽略错误
      }
    });
    
    albumCovers.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // 忽略错误
      }
    });
    
    setArtistCovers(new Map());
    setAlbumCovers(new Map());
    artistCoversLoaded.current = false;
    albumCoverPromises.current.clear();
    
    console.log('🧹 封面缓存已清理');
  }, [artistCovers, albumCovers]);

  return (
    <CoverCacheContext.Provider value={{
      artistCovers,
      loadArtistCovers,
      getArtistCover,
      albumCovers,
      loadAlbumCover,
      getAlbumCover,
      clearCache,
    }}>
      {children}
    </CoverCacheContext.Provider>
  );
}

export function useCoverCache() {
  const context = useContext(CoverCacheContext);
  if (!context) {
    throw new Error('useCoverCache must be used within CoverCacheProvider');
  }
  return context;
}



