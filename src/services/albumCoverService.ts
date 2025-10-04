/**
 * 专辑封面加载服务
 * 
 * 设计原则：
 * - 高内聚：所有封面加载、缓存、清理逻辑集中在此服务中
 * - 低耦合：通过接口抽象，不直接依赖Tauri invoke
 * - 单一职责：只负责封面的加载和生命周期管理
 */

/**
 * 封面数据提供者接口（依赖倒置原则）
 * 允许注入不同的实现（Tauri、HTTP、Mock等）
 */
export interface AlbumCoverProvider {
  getCoverData(trackId: number): Promise<CoverData | null>;
}

/**
 * 封面数据类型
 */
export interface CoverData {
  data: number[];  // 图片字节数组
  mimeType: string;
}

/**
 * 加载配置
 */
export interface LoadConfig {
  maxConcurrent: number;  // 最大并发数
  maxCacheSize: number;   // 最大缓存数量
  retryCount: number;     // 重试次数
}

/**
 * 加载结果
 */
export interface LoadResult {
  trackId: number;
  url: string | null;
  error?: Error;
}

/**
 * 专辑封面服务（高内聚：所有封面操作集中管理）
 */
export class AlbumCoverService {
  private cache: Map<number, string> = new Map();
  private loading: Map<number, Promise<string | null>> = new Map();
  private provider: AlbumCoverProvider;
  private config: LoadConfig;

  constructor(
    provider: AlbumCoverProvider,
    config: Partial<LoadConfig> = {}
  ) {
    this.provider = provider;
    this.config = {
      maxConcurrent: 5,
      maxCacheSize: 200,
      retryCount: 2,
      ...config,
    };
  }

  /**
   * 批量加载封面（并发控制 + 去重）
   */
  async loadCovers(
    trackIds: number[],
    signal?: AbortSignal
  ): Promise<Map<number, string>> {
    // 检查中止信号
    if (signal?.aborted) {
      throw new Error('Load operation aborted');
    }

    const results = new Map<number, string>();
    const toLoad: number[] = [];

    // 1. 从缓存获取已有的封面
    for (const trackId of trackIds) {
      const cached = this.cache.get(trackId);
      if (cached) {
        results.set(trackId, cached);
      } else {
        toLoad.push(trackId);
      }
    }

    if (toLoad.length === 0) {
      return results;
    }

    // 2. 并发加载（限制并发数）
    const loadResults = await this.loadConcurrent(toLoad, signal);

    // 3. 收集结果并更新缓存
    for (const result of loadResults) {
      if (result.url) {
        results.set(result.trackId, result.url);
        this.addToCache(result.trackId, result.url);
      }
    }

    return results;
  }

  /**
   * 并发加载（限制并发数）
   */
  private async loadConcurrent(
    trackIds: number[],
    signal?: AbortSignal
  ): Promise<LoadResult[]> {
    const results: LoadResult[] = [];
    const queue = [...trackIds];
    const inProgress: Promise<void>[] = [];

    while (queue.length > 0 || inProgress.length > 0) {
      // 检查中止信号
      if (signal?.aborted) {
        break;
      }

      // 启动新任务直到达到并发限制
      while (queue.length > 0 && inProgress.length < this.config.maxConcurrent) {
        const trackId = queue.shift()!;
        const task = this.loadSingle(trackId, signal).then((result) => {
          results.push(result);
          // 从进行中列表移除
          const index = inProgress.indexOf(task);
          if (index > -1) {
            inProgress.splice(index, 1);
          }
        });
        inProgress.push(task);
      }

      // 等待至少一个任务完成
      if (inProgress.length > 0) {
        await Promise.race(inProgress);
      }
    }

    return results;
  }

  /**
   * 加载单个封面（带重试 + 去重）
   */
  private async loadSingle(
    trackId: number,
    signal?: AbortSignal
  ): Promise<LoadResult> {
    // 防止重复加载（如果已经在加载中，返回同一个Promise）
    const existing = this.loading.get(trackId);
    if (existing) {
      const url = await existing;
      return { trackId, url };
    }

    // 创建加载Promise
    const loadPromise = this.loadWithRetry(trackId, signal);
    this.loading.set(trackId, loadPromise);

    try {
      const url = await loadPromise;
      return { trackId, url };
    } catch (error) {
      return {
        trackId,
        url: null,
        error: error as Error,
      };
    } finally {
      // 加载完成后从loading中移除
      this.loading.delete(trackId);
    }
  }

  /**
   * 带重试的加载
   */
  private async loadWithRetry(
    trackId: number,
    signal?: AbortSignal
  ): Promise<string | null> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retryCount; attempt++) {
      if (signal?.aborted) {
        throw new Error('Load operation aborted');
      }

      try {
        const coverData = await this.provider.getCoverData(trackId);
        if (!coverData) {
          return null;
        }

        // 创建Blob和ObjectURL
        const blob = new Blob(
          [new Uint8Array(coverData.data)],
          { type: coverData.mimeType || 'image/jpeg' }
        );
        const url = URL.createObjectURL(blob);

        return url;
      } catch (error) {
        lastError = error as Error;
        // 指数退避
        if (attempt < this.config.retryCount) {
          await this.sleep(Math.pow(2, attempt) * 100);
        }
      }
    }

    console.warn(`封面加载失败 (track ${trackId}):`, lastError);
    return null;
  }

  /**
   * 添加到缓存（LRU淘汰）
   */
  private addToCache(trackId: number, url: string): void {
    // 如果超过最大缓存大小，移除最旧的
    if (this.cache.size >= this.config.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        const oldUrl = this.cache.get(firstKey);
        if (oldUrl) {
          URL.revokeObjectURL(oldUrl);
        }
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(trackId, url);
  }

  /**
   * 清理指定的封面
   */
  cleanupCovers(trackIds: number[]): void {
    const toKeep = new Set(trackIds);
    const toRemove: number[] = [];

    // 找出需要清理的
    for (const [trackId, url] of this.cache.entries()) {
      if (!toKeep.has(trackId)) {
        URL.revokeObjectURL(url);
        toRemove.push(trackId);
      }
    }

    // 从缓存移除
    toRemove.forEach(trackId => this.cache.delete(trackId));
  }

  /**
   * 清理所有封面
   */
  cleanup(): void {
    // 清理所有ObjectURL
    for (const url of this.cache.values()) {
      URL.revokeObjectURL(url);
    }
    this.cache.clear();
    this.loading.clear();
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      loadingCount: this.loading.size,
      maxCacheSize: this.config.maxCacheSize,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Tauri封面提供者实现
 */
export class TauriAlbumCoverProvider implements AlbumCoverProvider {
  async getCoverData(trackId: number): Promise<CoverData | null> {
    // 动态导入避免循环依赖
    const { invoke } = await import('@tauri-apps/api/core');
    
    const result = await invoke<[number[], string] | null>('get_album_cover', {
      trackId,
    });

    if (!result || !result[0] || result[0].length === 0) {
      return null;
    }

    return {
      data: result[0],
      mimeType: result[1] || 'image/jpeg',
    };
  }
}

// 全局单例实例（可选，也可以在需要的地方创建）
let globalService: AlbumCoverService | null = null;

/**
 * 获取全局封面服务实例
 */
export function getAlbumCoverService(): AlbumCoverService {
  if (!globalService) {
    const provider = new TauriAlbumCoverProvider();
    globalService = new AlbumCoverService(provider);
  }
  return globalService;
}

/**
 * 重置全局服务（主要用于测试）
 */
export function resetAlbumCoverService(): void {
  if (globalService) {
    globalService.cleanup();
    globalService = null;
  }
}

