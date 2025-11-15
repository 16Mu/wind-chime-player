/**
 * 封面懒加载Hook - 按需加载曲目封面数据
 * 
 * 设计原则：
 * 1. 初始加载时只加载轻量级元数据
 * 2. 封面数据按需懒加载（进入可视区域时加载）
 * 3. 使用LRU缓存策略，避免重复加载
 * 4. 批量加载优化，减少IndexedDB访问次数
 * 
 * 用法示例：
 * ```tsx
 * const { getTrackCover, preloadCovers } = useLazyTrackCovers();
 * 
 * // 单个封面加载
 * const cover = getTrackCover(trackId);
 * 
 * // 批量预加载（用于虚拟滚动）
 * preloadCovers([trackId1, trackId2, trackId3]);
 * ```
 */

import { useState, useCallback, useRef } from 'react';
import { cacheService } from '../services/cacheService';

/**
 * 封面数据接口
 */
export interface CoverData {
  album_cover_data?: Uint8Array;
  album_cover_mime?: string;
  artist_photo_data?: Uint8Array;
  artist_photo_mime?: string;
}

/**
 * LRU缓存条目
 */
interface CoverCacheEntry {
  data: CoverData;
  timestamp: number;
}

/**
 * 封面懒加载Hook
 */
export function useLazyTrackCovers() {
  // 内存缓存（LRU策略，最多缓存200个封面）
  const coverCache = useRef<Map<number, CoverCacheEntry>>(new Map());
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  
  const MAX_CACHE_SIZE = 200;
  const CACHE_TTL = 5 * 60 * 1000; // 5分钟

  /**
   * 清理过期缓存
   */
  const cleanupCache = useCallback(() => {
    const now = Date.now();
    const cache = coverCache.current;
    
    // 删除过期条目
    for (const [trackId, entry] of cache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        cache.delete(trackId);
      }
    }
    
    // 如果缓存仍然超出限制，删除最旧的条目（LRU）
    if (cache.size > MAX_CACHE_SIZE) {
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toDelete = entries.slice(0, entries.length - MAX_CACHE_SIZE);
      toDelete.forEach(([trackId]) => cache.delete(trackId));
    }
  }, []);

  /**
   * 从IndexedDB加载单个封面
   */
  const loadCover = useCallback(async (trackId: number): Promise<CoverData | null> => {
    try {
      // 检查内存缓存
      const cached = coverCache.current.get(trackId);
      if (cached) {
        const age = Date.now() - cached.timestamp;
        if (age < CACHE_TTL) {
          return cached.data;
        } else {
          // 缓存过期，删除
          coverCache.current.delete(trackId);
        }
      }

      // 从IndexedDB加载
      setLoadingIds(prev => new Set(prev).add(trackId));
      
      // 这里需要先获取metadata，然后加载封面
      // 由于我们已经有元数据了，这里直接加载封面部分即可
      const coverData = await new Promise<CoverData | null>((resolve, reject) => {
        const db = indexedDB.open('WindChimeMusicCache', 2);
        
        db.onsuccess = () => {
          const database = db.result;
          const transaction = database.transaction('trackCovers', 'readonly');
          const store = transaction.objectStore('trackCovers');
          const request = store.get(trackId);
          
          request.onsuccess = () => {
            const result = request.result;
            if (result) {
              resolve({
                album_cover_data: result.album_cover_data,
                album_cover_mime: result.album_cover_mime,
                artist_photo_data: result.artist_photo_data,
                artist_photo_mime: result.artist_photo_mime,
              });
            } else {
              resolve(null);
            }
          };
          
          request.onerror = () => reject(request.error);
        };
        
        db.onerror = () => reject(db.error);
      });

      // 保存到内存缓存
      if (coverData) {
        coverCache.current.set(trackId, {
          data: coverData,
          timestamp: Date.now(),
        });
        
        // 清理过期缓存
        cleanupCache();
      }

      setLoadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(trackId);
        return newSet;
      });

      return coverData;
    } catch (error) {
      console.error(`❌ 加载封面失败 (trackId: ${trackId}):`, error);
      setLoadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(trackId);
        return newSet;
      });
      return null;
    }
  }, [cleanupCache]);

  /**
   * 批量预加载封面（用于虚拟滚动优化）
   */
  const preloadCovers = useCallback(async (trackIds: number[]) => {
    // 过滤已缓存的
    const uncachedIds = trackIds.filter(id => {
      const cached = coverCache.current.get(id);
      if (!cached) return true;
      
      const age = Date.now() - cached.timestamp;
      return age >= CACHE_TTL;
    });

    if (uncachedIds.length === 0) return;

    console.log(`📦 批量预加载 ${uncachedIds.length} 个封面...`);

    try {
      // 批量加载
      const coverMap = await cacheService.loadTracksWithCovers(uncachedIds);
      
      // 保存到内存缓存
      for (const [trackId, track] of coverMap.entries()) {
        coverCache.current.set(trackId, {
          data: {
            album_cover_data: track.album_cover_data,
            album_cover_mime: track.album_cover_mime,
            artist_photo_data: track.artist_photo_data,
            artist_photo_mime: track.artist_photo_mime,
          },
          timestamp: Date.now(),
        });
      }
      
      cleanupCache();
      
      console.log(`✅ 批量预加载完成，已缓存 ${coverMap.size} 个封面`);
    } catch (error) {
      console.error('❌ 批量预加载失败:', error);
    }
  }, [cleanupCache]);

  /**
   * 获取封面数据（同步方法，如果未缓存则返回null）
   */
  const getCachedCover = useCallback((trackId: number): CoverData | null => {
    const cached = coverCache.current.get(trackId);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age >= CACHE_TTL) {
      coverCache.current.delete(trackId);
      return null;
    }
    
    return cached.data;
  }, []);

  /**
   * 检查是否正在加载
   */
  const isLoading = useCallback((trackId: number): boolean => {
    return loadingIds.has(trackId);
  }, [loadingIds]);

  /**
   * 清空所有缓存
   */
  const clearCache = useCallback(() => {
    coverCache.current.clear();
    console.log('🗑️ 封面缓存已清空');
  }, []);

  return {
    loadCover,         // 异步加载封面
    preloadCovers,     // 批量预加载
    getCachedCover,    // 获取已缓存的封面
    isLoading,         // 检查加载状态
    clearCache,        // 清空缓存
  };
}



