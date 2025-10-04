import { useState, useEffect, useRef } from 'react';
import { getAlbumCoverService } from '../services/albumCoverService';

interface Track {
  id: number;
  path: string;
}

/**
 * 专辑封面加载Hook
 * 
 * 重构后的设计：
 * - 低耦合：依赖抽象的AlbumCoverService，而非直接调用invoke
 * - 高性能：使用服务的并发加载和缓存机制
 * - 防内存泄漏：使用AbortController中止异步操作
 * - 批量更新：一次性更新所有封面URL，减少重渲染
 */
export function useAlbumCovers(tracks: Track[]) {
  const [albumCoverUrls, setAlbumCoverUrls] = useState<{ [trackId: number]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  
  // 使用ref保持service引用稳定
  const serviceRef = useRef(getAlbumCoverService());
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // 取消之前的加载操作
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 创建新的AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const loadCovers = async () => {
      if (tracks.length === 0) {
        setAlbumCoverUrls({});
        return;
      }

      setIsLoading(true);
      const trackIds = tracks.map(t => t.id);

      try {
        // 并发加载所有封面（服务内部处理并发控制、缓存、去重）
        const results = await serviceRef.current.loadCovers(
          trackIds,
          abortController.signal
        );

        // 检查是否已被中止
        if (abortController.signal.aborted) {
          return;
        }

        // 转换为对象格式（批量更新，只触发一次重渲染）
        const urlsObject: { [trackId: number]: string } = {};
        results.forEach((url, trackId) => {
          urlsObject[trackId] = url;
        });

        setAlbumCoverUrls(urlsObject);

        // 清理不再需要的封面
        serviceRef.current.cleanupCovers(trackIds);
      } catch (error) {
        // 忽略中止错误
        if (error instanceof Error && error.message === 'Load operation aborted') {
          return;
        }
        console.error('批量加载封面失败:', error);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadCovers();

    // 清理函数：中止未完成的加载
    return () => {
      abortController.abort();
    };
  }, [tracks]);

  // 组件卸载时清理所有资源
  useEffect(() => {
    return () => {
      // 中止所有进行中的操作
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // 清理所有封面URL（在开发环境可选，因为service已经管理）
      // 生产环境建议保留service的全局缓存以提升性能
      if (import.meta.env.DEV) {
        serviceRef.current.cleanup();
      }
    };
  }, []);

  return { 
    albumCoverUrls, 
    isLoading,
    stats: serviceRef.current.getStats() // 提供缓存统计（调试用）
  };
}
