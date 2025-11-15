/**
 * 音乐库缓存服务 - IndexedDB持久化存储
 * 
 * 设计原则（参考QQ音乐、网易云音乐等大厂实践）：
 * 1. 启动秒开：首屏数据从IndexedDB加载，几乎无延迟
 * 2. 后台同步：异步检查更新，不阻塞UI
 * 3. 分层存储：元数据和大数据分离存储
 * 4. 智能过期：基于版本号和时间戳的缓存策略
 * 5. 渐进加载：优先加载核心数据，非必要数据懒加载
 */

import { Track, LibraryStats } from '../types/music';

// ==================== 缓存数据结构 ====================

/**
 * 轻量级曲目元数据（用于快速列表展示）
 */
export interface TrackMetadata {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
  // 注意：不包含封面数据，减小缓存体积
}

/**
 * 缓存版本信息
 */
export interface CacheVersion {
  version: number;
  timestamp: number;
  trackCount: number;
  lastUpdateTime: number;
}

/**
 * 远程服务器缓存数据
 */
export interface RemoteServerCache {
  id: string;
  name: string;
  server_type: string;
  config: any;
  enabled: boolean;
  cachedAt: number;
}

// ==================== IndexedDB管理类 ====================

const DB_NAME = 'WindChimeMusicCache';
const DB_VERSION = 2;

// 数据库表名
const STORES = {
  TRACK_METADATA: 'trackMetadata',      // 轻量级曲目列表
  TRACK_COVERS: 'trackCovers',          // 专辑封面（分离存储）
  LIBRARY_STATS: 'libraryStats',        // 音乐库统计
  CACHE_VERSION: 'cacheVersion',        // 缓存版本信息
  REMOTE_SERVERS: 'remoteServers',      // 远程服务器配置
  APP_SETTINGS: 'appSettings',          // 应用设置
};

/**
 * 音乐库缓存服务
 */
class MusicCacheService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * 初始化数据库连接
   */
  private async init(): Promise<void> {
    if (this.db) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('❌ IndexedDB打开失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB已连接');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('🔄 升级IndexedDB schema...');

        // 创建曲目元数据存储（轻量级）
        if (!db.objectStoreNames.contains(STORES.TRACK_METADATA)) {
          const trackStore = db.createObjectStore(STORES.TRACK_METADATA, { keyPath: 'id' });
          trackStore.createIndex('artist', 'artist', { unique: false });
          trackStore.createIndex('album', 'album', { unique: false });
          console.log('✅ 创建trackMetadata存储');
        }

        // 创建封面存储（分离存储，减少主列表体积）
        if (!db.objectStoreNames.contains(STORES.TRACK_COVERS)) {
          db.createObjectStore(STORES.TRACK_COVERS, { keyPath: 'trackId' });
          console.log('✅ 创建trackCovers存储');
        }

        // 创建统计信息存储
        if (!db.objectStoreNames.contains(STORES.LIBRARY_STATS)) {
          db.createObjectStore(STORES.LIBRARY_STATS, { keyPath: 'id' });
          console.log('✅ 创建libraryStats存储');
        }

        // 创建缓存版本存储
        if (!db.objectStoreNames.contains(STORES.CACHE_VERSION)) {
          db.createObjectStore(STORES.CACHE_VERSION, { keyPath: 'id' });
          console.log('✅ 创建cacheVersion存储');
        }

        // 创建远程服务器缓存
        if (!db.objectStoreNames.contains(STORES.REMOTE_SERVERS)) {
          db.createObjectStore(STORES.REMOTE_SERVERS, { keyPath: 'id' });
          console.log('✅ 创建remoteServers存储');
        }

        // 创建应用设置存储
        if (!db.objectStoreNames.contains(STORES.APP_SETTINGS)) {
          db.createObjectStore(STORES.APP_SETTINGS, { keyPath: 'key' });
          console.log('✅ 创建appSettings存储');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * 确保数据库已初始化
   */
  private async ensureDB(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) {
      throw new Error('数据库未初始化');
    }
    return this.db;
  }

  // ==================== 曲目元数据缓存 ====================

  /**
   * 保存曲目列表到缓存（仅元数据，不含封面）
   */
  async saveTracks(tracks: Track[]): Promise<void> {
    const db = await this.ensureDB();

    try {
      // 清空旧数据
      await this.clearStore(STORES.TRACK_METADATA);
      await this.clearStore(STORES.TRACK_COVERS);

      // 使用新事务保存数据
      const transaction = db.transaction([STORES.TRACK_METADATA, STORES.TRACK_COVERS], 'readwrite');
      const metadataStore = transaction.objectStore(STORES.TRACK_METADATA);
      const coverStore = transaction.objectStore(STORES.TRACK_COVERS);

      // 分离元数据和封面数据
      for (const track of tracks) {
        // 1. 保存轻量级元数据
        const metadata: TrackMetadata = {
          id: track.id,
          path: track.path,
          title: track.title,
          artist: track.artist,
          album: track.album,
          duration_ms: track.duration_ms,
        };
        metadataStore.put(metadata);

        // 2. 单独保存封面数据（如果存在）
        if (track.album_cover_data || track.artist_photo_data) {
          coverStore.put({
            trackId: track.id,
            album_cover_data: track.album_cover_data,
            album_cover_mime: track.album_cover_mime,
            artist_photo_data: track.artist_photo_data,
            artist_photo_mime: track.artist_photo_mime,
            embedded_lyrics: track.embedded_lyrics,
          });
        }
      }

      // 等待事务完成
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(new Error('Transaction aborted'));
      });

      // 更新缓存版本
      await this.updateCacheVersion(tracks.length);

      console.log(`✅ 已缓存 ${tracks.length} 首曲目（元数据和封面分离存储）`);
    } catch (error) {
      console.error('❌ 保存曲目缓存失败:', error);
      throw error;
    }
  }

  /**
   * 从缓存加载曲目列表（仅元数据，快速加载）
   */
  async loadTracksMetadata(): Promise<TrackMetadata[]> {
    const db = await this.ensureDB();
    const transaction = db.transaction(STORES.TRACK_METADATA, 'readonly');
    const store = transaction.objectStore(STORES.TRACK_METADATA);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const tracks = request.result as TrackMetadata[];
        console.log(`✅ 从缓存加载 ${tracks.length} 首曲目元数据`);
        resolve(tracks);
      };
      request.onerror = () => {
        console.error('❌ 加载曲目缓存失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 按需加载单个曲目的完整数据（包含封面）
   */
  async loadTrackWithCover(trackId: number, metadata: TrackMetadata): Promise<Track> {
    const db = await this.ensureDB();
    const transaction = db.transaction(STORES.TRACK_COVERS, 'readonly');
    const store = transaction.objectStore(STORES.TRACK_COVERS);

    return new Promise((resolve, reject) => {
      const request = store.get(trackId);
      request.onsuccess = () => {
        const coverData = request.result;
        const track: Track = {
          ...metadata,
          album_cover_data: coverData?.album_cover_data,
          album_cover_mime: coverData?.album_cover_mime,
          artist_photo_data: coverData?.artist_photo_data,
          artist_photo_mime: coverData?.artist_photo_mime,
          embedded_lyrics: coverData?.embedded_lyrics,
        };
        resolve(track);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 批量加载曲目的完整数据
   */
  async loadTracksWithCovers(trackIds: number[]): Promise<Map<number, Track>> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.TRACK_METADATA, STORES.TRACK_COVERS], 'readonly');
    const metadataStore = transaction.objectStore(STORES.TRACK_METADATA);
    const coverStore = transaction.objectStore(STORES.TRACK_COVERS);

    const result = new Map<number, Track>();

    try {
      for (const trackId of trackIds) {
        const metadataRequest = metadataStore.get(trackId);
        const coverRequest = coverStore.get(trackId);

        const metadata = await new Promise<TrackMetadata>((resolve, reject) => {
          metadataRequest.onsuccess = () => resolve(metadataRequest.result);
          metadataRequest.onerror = () => reject(metadataRequest.error);
        });

        const coverData = await new Promise<any>((resolve, reject) => {
          coverRequest.onsuccess = () => resolve(coverRequest.result);
          coverRequest.onerror = () => reject(coverRequest.error);
        });

        if (metadata) {
          result.set(trackId, {
            ...metadata,
            album_cover_data: coverData?.album_cover_data,
            album_cover_mime: coverData?.album_cover_mime,
            artist_photo_data: coverData?.artist_photo_data,
            artist_photo_mime: coverData?.artist_photo_mime,
            embedded_lyrics: coverData?.embedded_lyrics,
          });
        }
      }

      return result;
    } catch (error) {
      console.error('❌ 批量加载曲目失败:', error);
      throw error;
    }
  }

  // ==================== 统计信息缓存 ====================

  /**
   * 保存音乐库统计信息
   */
  async saveStats(stats: LibraryStats): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(STORES.LIBRARY_STATS, 'readwrite');
    const store = transaction.objectStore(STORES.LIBRARY_STATS);

    return new Promise((resolve, reject) => {
      const request = store.put({ id: 'current', ...stats });
      request.onsuccess = () => {
        console.log('✅ 已缓存音乐库统计信息');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 加载音乐库统计信息
   */
  async loadStats(): Promise<LibraryStats | null> {
    const db = await this.ensureDB();
    const transaction = db.transaction(STORES.LIBRARY_STATS, 'readonly');
    const store = transaction.objectStore(STORES.LIBRARY_STATS);

    return new Promise((resolve, reject) => {
      const request = store.get('current');
      request.onsuccess = () => {
        const data = request.result;
        if (data) {
          const { id, ...stats } = data;
          resolve(stats as LibraryStats);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== 远程服务器缓存 ====================

  /**
   * 保存远程服务器配置
   */
  async saveRemoteServers(servers: RemoteServerCache[]): Promise<void> {
    const db = await this.ensureDB();

    try {
      await this.clearStore(STORES.REMOTE_SERVERS);

      const transaction = db.transaction(STORES.REMOTE_SERVERS, 'readwrite');
      const store = transaction.objectStore(STORES.REMOTE_SERVERS);

      for (const server of servers) {
        store.put({
          ...server,
          cachedAt: Date.now(),
        });
      }

      // 等待事务完成
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(new Error('Transaction aborted'));
      });

      console.log(`✅ 已缓存 ${servers.length} 个远程服务器配置`);
    } catch (error) {
      console.error('❌ 保存远程服务器缓存失败:', error);
      throw error;
    }
  }

  /**
   * 加载远程服务器配置
   */
  async loadRemoteServers(): Promise<RemoteServerCache[]> {
    const db = await this.ensureDB();
    const transaction = db.transaction(STORES.REMOTE_SERVERS, 'readonly');
    const store = transaction.objectStore(STORES.REMOTE_SERVERS);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const servers = request.result as RemoteServerCache[];
        console.log(`✅ 从缓存加载 ${servers.length} 个远程服务器配置`);
        resolve(servers);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== 缓存版本管理 ====================

  /**
   * 更新缓存版本信息
   */
  private async updateCacheVersion(trackCount: number): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(STORES.CACHE_VERSION, 'readwrite');
    const store = transaction.objectStore(STORES.CACHE_VERSION);

    const version: CacheVersion = {
      version: Date.now(), // 使用时间戳作为版本号
      timestamp: Date.now(),
      trackCount,
      lastUpdateTime: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put({ id: 'current', ...version });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取当前缓存版本
   */
  async getCacheVersion(): Promise<CacheVersion | null> {
    const db = await this.ensureDB();
    const transaction = db.transaction(STORES.CACHE_VERSION, 'readonly');
    const store = transaction.objectStore(STORES.CACHE_VERSION);

    return new Promise((resolve, reject) => {
      const request = store.get('current');
      request.onsuccess = () => {
        const data = request.result;
        if (data) {
          const { id, ...version } = data;
          resolve(version as CacheVersion);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 检查缓存是否过期（超过24小时）
   */
  async isCacheExpired(): Promise<boolean> {
    const version = await this.getCacheVersion();
    if (!version) return true;

    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    return (now - version.timestamp) > maxAge;
  }

  // ==================== 工具方法 ====================

  /**
   * 清空指定存储
   */
  private async clearStore(storeName: string): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 清空所有缓存
   */
  async clearAllCache(): Promise<void> {
    console.log('🗑️ 清空所有缓存...');
    const stores = Object.values(STORES);
    for (const store of stores) {
      try {
        await this.clearStore(store);
      } catch (error) {
        console.warn(`清空${store}失败:`, error);
      }
    }
    console.log('✅ 所有缓存已清空');
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{
    trackCount: number;
    coverCount: number;
    cacheSize: string;
    version: CacheVersion | null;
  }> {
    const db = await this.ensureDB();

    // 获取曲目数量
    const trackCount = await new Promise<number>((resolve, reject) => {
      const transaction = db.transaction(STORES.TRACK_METADATA, 'readonly');
      const store = transaction.objectStore(STORES.TRACK_METADATA);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // 获取封面数量
    const coverCount = await new Promise<number>((resolve, reject) => {
      const transaction = db.transaction(STORES.TRACK_COVERS, 'readonly');
      const store = transaction.objectStore(STORES.TRACK_COVERS);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // 获取版本信息
    const version = await this.getCacheVersion();

    // 估算缓存大小（IndexedDB API不直接提供，这里给出估算值）
    const estimatedSize = (trackCount * 0.5 + coverCount * 50); // 元数据约0.5KB，封面约50KB
    const cacheSize = estimatedSize < 1024 
      ? `${estimatedSize.toFixed(2)} KB`
      : `${(estimatedSize / 1024).toFixed(2)} MB`;

    return {
      trackCount,
      coverCount,
      cacheSize,
      version,
    };
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
      console.log('✅ IndexedDB连接已关闭');
    }
  }
}

// 导出单例
export const cacheService = new MusicCacheService();

