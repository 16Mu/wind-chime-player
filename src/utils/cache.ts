/**
 * 前端缓存管理工具
 * 
 * 设计原则：
 * - 通用性：支持任意类型的数据缓存
 * - TTL机制：自动过期清理
 * - 类型安全：TypeScript泛型支持
 * - 内存管理：提供清理机制防止内存泄漏
 */

// ==================== 缓存管理器 ====================

/**
 * 缓存条目接口
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // 过期时间（毫秒）
}

/**
 * 🔧 P2优化：通用缓存管理器（支持LRU淘汰）
 * 
 * 功能：
 * - TTL自动过期
 * - LRU淘汰策略
 * - 缓存击穿防护
 * - 统计信息
 * 
 * @example
 * const cache = new CacheManager<string>(30 * 60 * 1000, 100); // 30分钟TTL，最多100条
 * cache.set('key', 'value');
 * const value = cache.get('key');
 */
export class CacheManager<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTTL: number;
  private maxSize: number; // 🔧 P2新增：最大缓存条目数
  private pendingPromises = new Map<string, Promise<T>>(); // 🔧 P3新增：防止缓存击穿

  /**
   * @param ttlMs 默认过期时间（毫秒）
   * @param maxSize 最大缓存条目数（默认1000）
   */
  constructor(ttlMs: number = 10 * 60 * 1000, maxSize: number = 1000) {
    this.defaultTTL = ttlMs;
    this.maxSize = maxSize;
  }

  /**
   * 获取缓存数据（LRU更新访问时间）
   * @returns 缓存的数据，如果不存在或已过期则返回null
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // 🔧 P2优化：LRU - 更新访问时间（通过重新插入实现）
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  /**
   * 🔧 P2优化：设置缓存数据（支持LRU淘汰）
   * @param key 缓存键
   * @param data 缓存数据
   * @param ttl 可选的自定义过期时间（毫秒）
   */
  set(key: string, data: T, ttl?: number): void {
    // 🔧 P2新增：检查缓存大小，执行LRU淘汰
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      // 删除最旧的项（Map的第一项）
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    });
  }

  /**
   * 检查缓存是否存在且有效
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * 删除指定缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 清理所有过期缓存
   */
  cleanExpired(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const now = Date.now();
    let validCount = 0;
    let expiredCount = 0;

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredCount++;
      } else {
        validCount++;
      }
    }

    return {
      total: this.cache.size,
      valid: validCount,
      expired: expiredCount,
    };
  }

  /**
   * 🔧 P3优化：获取或设置缓存（防止缓存击穿）
   * 
   * 并发调用相同key时，只执行一次factory函数
   */
  async getOrSet(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get(key);
    
    if (cached !== null) {
      return cached;
    }

    // 🔧 P3修复：检查是否有pending的Promise，防止缓存击穿
    const pending = this.pendingPromises.get(key);
    if (pending) {
      return pending;
    }

    // 创建新的Promise并缓存
    const promise = factory()
      .then(data => {
        this.set(key, data, ttl);
        this.pendingPromises.delete(key);
        return data;
      })
      .catch(error => {
        this.pendingPromises.delete(key);
        throw error;
      });

    this.pendingPromises.set(key, promise);
    return promise;
  }
}

// ==================== 预定义缓存实例 ====================

/**
 * 专辑封面缓存
 * 
 * 配置：
 * - TTL: 30分钟
 * - 最大条目: 200个封面
 */
export const albumCoverCache = new CacheManager<string>(30 * 60 * 1000, 200);

/**
 * 歌词缓存
 * 
 * 配置：
 * - TTL: 60分钟
 * - 最大条目: 100首歌词
 */
export const lyricsCache = new CacheManager<any>(60 * 60 * 1000, 100);

/**
 * 搜索结果缓存
 * 
 * 配置：
 * - TTL: 5分钟（搜索结果变化较快）
 * - 最大条目: 50个搜索结果
 */
export const searchResultsCache = new CacheManager<any[]>(5 * 60 * 1000, 50);

/**
 * API响应缓存（通用）
 * 
 * 配置：
 * - TTL: 10分钟
 * - 最大条目: 500个响应
 */
export const apiResponseCache = new CacheManager<any>(10 * 60 * 1000, 500);

// ==================== 缓存工具函数 ====================

/**
 * 生成缓存键
 * 
 * 将多个部分组合成一个唯一的缓存键
 * 
 * @param parts 键的各部分（字符串或数字）
 * @returns 组合后的缓存键
 * 
 * @example
 * const key = generateCacheKey('album-cover', trackId, 'thumbnail');
 * // 结果: "album-cover:123:thumbnail"
 */
export function generateCacheKey(...parts: (string | number)[]): string {
  return parts.join(':');
}

/**
 * 🔧 P2修复：定期清理过期缓存（单例模式）
 * 
 * 建议在应用初始化时调用一次
 * 
 * 功能：
 * - 每隔指定时间清理所有预定义缓存中的过期条目
 * - 单例模式防止重复启动
 * - 返回清理函数用于停止定期清理
 * 
 * @param intervalMs 清理间隔（毫秒，默认5分钟）
 * @returns 停止清理的函数
 * 
 * @example
 * // 在App组件中启动
 * useEffect(() => {
 *   const stopCleanup = startCacheCleanup();
 *   return stopCleanup;
 * }, []);
 */
let cleanupIntervalId: NodeJS.Timeout | null = null;

export function startCacheCleanup(intervalMs: number = 5 * 60 * 1000): () => void {
  // 如果已经有运行中的cleanup，先停止
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
  }
  
  const caches = [
    albumCoverCache,
    lyricsCache,
    searchResultsCache,
    apiResponseCache,
  ];

  cleanupIntervalId = setInterval(() => {
    let totalCleaned = 0;
    
    for (const cache of caches) {
      totalCleaned += cache.cleanExpired();
    }

    if (totalCleaned > 0) {
      console.log(`🧹 缓存清理: 清理了 ${totalCleaned} 个过期项`);
    }
  }, intervalMs);

  // 返回清理函数
  return () => {
    if (cleanupIntervalId) {
      clearInterval(cleanupIntervalId);
      cleanupIntervalId = null;
    }
  };
}

/**
 * 清空所有预定义缓存
 * 
 * 包括：专辑封面、歌词、搜索结果、API响应
 */
export function clearAllCaches(): void {
  albumCoverCache.clear();
  lyricsCache.clear();
  searchResultsCache.clear();
  apiResponseCache.clear();
  console.log('🧹 已清空所有缓存');
}

/**
 * 获取所有缓存的统计信息
 * 
 * @returns 各个缓存的统计信息对象
 * 
 * @example
 * const stats = getAllCacheStats();
 * console.log('封面缓存:', stats.albumCover);
 * // { total: 50, valid: 45, expired: 5 }
 */
export function getAllCacheStats() {
  return {
    albumCover: albumCoverCache.getStats(),
    lyrics: lyricsCache.getStats(),
    searchResults: searchResultsCache.getStats(),
    apiResponse: apiResponseCache.getStats(),
  };
}

// ==================== React Hook支持 ====================

import { useState, useEffect, useRef } from 'react';

/**
 * 🔧 P3修复：使用缓存的React Hook（返回loading状态）
 * 
 * @example
 * const { data: albumCover, isLoading } = useCachedData(
 *   `album-cover-${trackId}`,
 *   () => loadAlbumCover(trackId),
 *   albumCoverCache,
 *   [trackId]
 * );
 * 
 * @returns {{ data: T | null, isLoading: boolean }}
 */
export function useCachedData<T>(
  key: string,
  factory: () => Promise<T>,
  cacheManager: CacheManager<T>,
  dependencies: any[] = []
): { data: T | null; isLoading: boolean } {
  const [data, setData] = useState<T | null>(() => cacheManager.get(key));
  const [isLoading, setIsLoading] = useState(false);
  
  // 🔧 P2修复：使用ref存储dependencies，避免stale closure
  const depsRef = useRef(dependencies);
  useEffect(() => {
    depsRef.current = dependencies;
  });

  useEffect(() => {
    // 先检查缓存
    const cached = cacheManager.get(key);
    if (cached !== null) {
      setData(cached);
      return;
    }

    // 缓存未命中，加载数据（使用防缓存击穿的getOrSet）
    setIsLoading(true);
    cacheManager.getOrSet(key, factory)
      .then(result => {
        setData(result);
      })
      .catch(error => {
        console.error('加载缓存数据失败:', error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [key, cacheManager, ...depsRef.current]);

  // 🔧 P3修复：返回loading状态
  return { data, isLoading };
}

/**
 * 专门用于专辑封面的Hook
 * 
 * @param trackId 曲目ID
 * @param loader 封面加载函数
 * 
 * @returns {{ data: string | null, isLoading: boolean }} 封面URL和加载状态
 * 
 * @example
 * const { data: coverUrl, isLoading } = useCachedAlbumCover(track.id, async () => {
 *   return await invoke('get_album_cover', { trackId: track.id });
 * });
 */
export function useCachedAlbumCover(trackId: number, loader: () => Promise<string>): { data: string | null; isLoading: boolean } {
  return useCachedData(
    generateCacheKey('album-cover', trackId),
    loader,
    albumCoverCache,
    [trackId]
  );
}

/**
 * 专门用于歌词的Hook
 * 
 * @param trackId 曲目ID
 * @param loader 歌词加载函数
 * 
 * @returns {{ data: any | null, isLoading: boolean }} 歌词数据和加载状态
 * 
 * @example
 * const { data: lyrics, isLoading } = useCachedLyrics(track.id, async () => {
 *   return await invoke('get_lyrics', { trackId: track.id });
 * });
 */
export function useCachedLyrics(trackId: number, loader: () => Promise<any>): { data: any | null; isLoading: boolean } {
  return useCachedData(
    generateCacheKey('lyrics', trackId),
    loader,
    lyricsCache,
    [trackId]
  );
}