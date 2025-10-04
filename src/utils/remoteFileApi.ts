import { invoke } from '@tauri-apps/api/core';

// ============================================================
// WebDAV API 封装
// ============================================================

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

export interface WebDAVFileInfo {
  path: string;
  name: string;
  is_directory: boolean;
  size: number;
  content_type?: string;
  last_modified?: number;
  etag?: string;
}

/**
 * WebDAV 客户端 API
 */
export const webdavApi = {
  /**
   * 测试 WebDAV 连接
   */
  async testConnection(
    url: string,
    username: string,
    password: string
  ): Promise<string> {
    return await invoke('webdav_test_connection', {
      url,
      username,
      password,
    });
  },

  /**
   * 列出 WebDAV 目录
   */
  async listDirectory(
    url: string,
    username: string,
    password: string,
    path: string
  ): Promise<WebDAVFileInfo[]> {
    return await invoke('webdav_list_directory', {
      url,
      username,
      password,
      path,
    });
  },

  /**
   * 获取 WebDAV 文件信息
   */
  async getFileInfo(
    url: string,
    username: string,
    password: string,
    filePath: string
  ): Promise<WebDAVFileInfo> {
    return await invoke('webdav_get_file_info', {
      url,
      username,
      password,
      filePath,
    });
  },

  /**
   * 检查 WebDAV 文件是否存在
   */
  async fileExists(
    url: string,
    username: string,
    password: string,
    filePath: string
  ): Promise<boolean> {
    return await invoke('webdav_file_exists', {
      url,
      username,
      password,
      filePath,
    });
  },

  /**
   * 创建 WebDAV 目录
   */
  async createDirectory(
    url: string,
    username: string,
    password: string,
    dirPath: string
  ): Promise<void> {
    await invoke('webdav_create_directory', {
      url,
      username,
      password,
      dirPath,
    });
  },

  /**
   * 删除 WebDAV 文件
   */
  async deleteFile(
    url: string,
    username: string,
    password: string,
    filePath: string
  ): Promise<void> {
    await invoke('webdav_delete_file', {
      url,
      username,
      password,
      filePath,
    });
  },
};

// ===========================================================
// 辅助函数
// ============================================================

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * 格式化日期时间
 */
export function formatDateTime(timestamp?: number): string {
  if (!timestamp) return '未知';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}


