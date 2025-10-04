/**
 * 远程音乐源Context - 管理WebDAV音乐源
 * 
 * 设计原则：
 * - 高内聚：所有远程源的状态和操作统一管理
 * - 低耦合：通过抽象接口与后端交互，不依赖具体实现
 * - 单一职责：只负责远程源管理，不涉及UI渲染或播放器控制
 * 
 * 后端对应模块：
 * - src-tauri/src/remote_source/
 * - src-tauri/src/webdav/
 */

import { 
  createContext, 
  useContext, 
  useState, 
  useCallback, 
  useEffect, 
  ReactNode 
} from 'react';
import { invoke } from '@tauri-apps/api/core';

// ==================== 类型定义 ====================

/**
 * 远程服务器类型（仅支持WebDAV）
 */
export type RemoteServerType = 'webdav';

/**
 * 连接状态
 */
export type ConnectionStatus = 
  | 'connected' 
  | 'disconnected' 
  | 'disabled' 
  | 'error' 
  | 'unknown';

/**
 * 远程服务器配置
 */
export interface RemoteServer {
  id: string;
  name: string;
  server_type: RemoteServerType;
  config: WebDAVConfig;
  enabled: boolean;
  status?: ConnectionStatus;
}

/**
 * WebDAV配置
 */
export interface WebDAVConfig {
  server_id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  timeout_seconds: number;
  max_redirects: number;
  verify_ssl: boolean;
  user_agent: string;
}

/**
 * 远程文件信息
 */
export interface RemoteFile {
  path: string;
  name: string;
  is_directory: boolean;
  size?: number;
  mime_type?: string;
  last_modified?: string;
}

/**
 * 扫描结果
 */
export interface ScanResult {
  total_files: number;
  added: number;
  updated: number;
  failed: number;
  errors: string[];
  duration_seconds: number;
}

/**
 * 缓存统计
 */
export interface CacheStats {
  file_count: number;
  total_size_mb: number;
}

// ==================== Context接口 ====================

interface RemoteSourceContextValue {
  // 服务器列表
  servers: RemoteServer[];
  isLoading: boolean;
  
  // 缓存统计
  cacheStats: CacheStats | null;
  
  // 服务器管理
  addServer: (
    serverType: RemoteServerType, 
    name: string, 
    config: WebDAVConfig
  ) => Promise<string>;
  deleteServer: (serverId: string) => Promise<void>;
  refreshServers: () => Promise<void>;
  
  // 连接测试
  testConnection: (
    serverType: RemoteServerType, 
    config: WebDAVConfig
  ) => Promise<string>;
  checkAllConnections: () => Promise<void>;
  
  // 文件浏览
  browseDirectory: (serverId: string, path: string) => Promise<RemoteFile[]>;
  
  // 音乐库扫描
  scanLibrary: (serverId: string, rootPath: string) => Promise<ScanResult>;
  
  // 缓存管理
  refreshCacheStats: () => Promise<void>;
  
  // 工具方法
  getServerById: (serverId: string) => RemoteServer | undefined;
  getServersByType: (serverType: RemoteServerType) => RemoteServer[];
}

const RemoteSourceContext = createContext<RemoteSourceContextValue | undefined>(undefined);

// ==================== Provider组件 ====================

interface RemoteSourceProviderProps {
  children: ReactNode;
}

export function RemoteSourceProvider({ children }: RemoteSourceProviderProps) {
  // ========== 状态管理 ==========
  const [servers, setServers] = useState<RemoteServer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);

  // ========== 服务器管理 ==========

  /**
   * 添加远程服务器
   */
  const addServer = useCallback(async (
    serverType: RemoteServerType,
    name: string,
    config: WebDAVConfig
  ): Promise<string> => {
    if (typeof invoke === 'undefined') {
      throw new Error('Tauri API不可用');
    }

    try {
      const configJson = JSON.stringify(config);
      const serverId = await invoke<string>('remote_add_server', {
        serverType,
        name,
        configJson,
      });

      console.log(`✅ 远程服务器已添加: ${name} (${serverId})`);
      await refreshServers();
      return serverId;
    } catch (error) {
      console.error('添加服务器失败:', error);
      throw error;
    }
  }, []);

  /**
   * 删除远程服务器
   */
  const deleteServer = useCallback(async (serverId: string) => {
    if (typeof invoke === 'undefined') {
      throw new Error('Tauri API不可用');
    }

    try {
      await invoke('remote_delete_server', { serverId });
      console.log(`✅ 远程服务器已删除: ${serverId}`);
      await refreshServers();
    } catch (error) {
      console.error('删除服务器失败:', error);
      throw error;
    }
  }, []);

  /**
   * 刷新服务器列表
   */
  const refreshServers = useCallback(async () => {
    if (typeof invoke === 'undefined') {
      console.warn('Tauri API不可用，跳过刷新服务器');
      return;
    }

    try {
      setIsLoading(true);
      const serverList = await invoke<any[]>('remote_get_servers');
      setServers(serverList as RemoteServer[]);
      console.log(`✅ 已加载 ${serverList.length} 个远程服务器`);
    } catch (error) {
      console.error('刷新服务器列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ========== 连接测试 ==========

  /**
   * 测试服务器连接
   */
  const testConnection = useCallback(async (
    serverType: RemoteServerType,
    config: WebDAVConfig
  ): Promise<string> => {
    if (typeof invoke === 'undefined') {
      throw new Error('Tauri API不可用');
    }

    try {
      const configJson = JSON.stringify(config);
      const result = await invoke<string>('remote_test_connection', {
        serverType,
        configJson,
      });
      return result;
    } catch (error) {
      console.error('连接测试失败:', error);
      throw error;
    }
  }, []);

  /**
   * 检查所有服务器连接状态
   */
  const checkAllConnections = useCallback(async () => {
    if (typeof invoke === 'undefined') {
      console.warn('Tauri API不可用，跳过连接检查');
      return;
    }

    try {
      const results = await invoke<any[]>('remote_check_all_connections');
      
      // 更新服务器状态
      setServers(prevServers => 
        prevServers.map(server => {
          const result = results.find(r => r.id === server.id);
          if (result) {
            return { ...server, status: result.status as ConnectionStatus };
          }
          return server;
        })
      );
      
      console.log(`✅ 已检查 ${results.length} 个服务器的连接状态`);
    } catch (error) {
      console.error('检查连接失败:', error);
    }
  }, []);

  // ========== 文件浏览 ==========

  /**
   * 浏览远程目录
   */
  const browseDirectory = useCallback(async (
    serverId: string,
    path: string
  ): Promise<RemoteFile[]> => {
    if (typeof invoke === 'undefined') {
      throw new Error('Tauri API不可用');
    }

    try {
      const files = await invoke<any[]>('remote_browse_directory', {
        serverId,
        path,
      });
      return files as RemoteFile[];
    } catch (error) {
      console.error('浏览目录失败:', error);
      throw error;
    }
  }, []);

  // ========== 音乐库扫描 ==========

  /**
   * 扫描远程音乐库
   */
  const scanLibrary = useCallback(async (
    serverId: string,
    rootPath: string
  ): Promise<ScanResult> => {
    if (typeof invoke === 'undefined') {
      throw new Error('Tauri API不可用');
    }

    try {
      console.log(`🔍 开始扫描远程音乐库: ${serverId} - ${rootPath}`);
      const result = await invoke<ScanResult>('remote_scan_library', {
        serverId,
        rootPath,
      });
      console.log(`✅ 扫描完成: 添加${result.added}首, 更新${result.updated}首, 失败${result.failed}首`);
      return result;
    } catch (error) {
      console.error('扫描音乐库失败:', error);
      throw error;
    }
  }, []);

  // ========== 缓存管理 ==========

  /**
   * 刷新缓存统计
   */
  const refreshCacheStats = useCallback(async () => {
    if (typeof invoke === 'undefined') {
      console.warn('Tauri API不可用，跳过刷新缓存统计');
      return;
    }

    try {
      const stats = await invoke<CacheStats>('remote_get_cache_stats');
      setCacheStats(stats);
      console.log(`✅ 缓存统计: ${stats.file_count} 个文件, ${stats.total_size_mb} MB`);
    } catch (error) {
      console.error('刷新缓存统计失败:', error);
    }
  }, []);

  // ========== 工具方法 ==========

  /**
   * 根据ID获取服务器
   */
  const getServerById = useCallback((serverId: string): RemoteServer | undefined => {
    return servers.find(s => s.id === serverId);
  }, [servers]);

  /**
   * 根据类型获取服务器列表
   */
  const getServersByType = useCallback((serverType: RemoteServerType): RemoteServer[] => {
    return servers.filter(s => s.server_type === serverType);
  }, [servers]);

  // ========== 初始化 ==========

  useEffect(() => {
    // 初始加载服务器列表和缓存统计
    refreshServers();
    refreshCacheStats();
  }, [refreshServers, refreshCacheStats]);

  // ========== Context值 ==========

  const value: RemoteSourceContextValue = {
    servers,
    isLoading,
    cacheStats,
    addServer,
    deleteServer,
    refreshServers,
    testConnection,
    checkAllConnections,
    browseDirectory,
    scanLibrary,
    refreshCacheStats,
    getServerById,
    getServersByType,
  };

  return (
    <RemoteSourceContext.Provider value={value}>
      {children}
    </RemoteSourceContext.Provider>
  );
}

// ==================== Hook ====================

/**
 * 使用远程音乐源Context
 */
export function useRemoteSource(): RemoteSourceContextValue {
  const context = useContext(RemoteSourceContext);
  if (!context) {
    throw new Error('useRemoteSource必须在RemoteSourceProvider内使用');
  }
  return context;
}

















