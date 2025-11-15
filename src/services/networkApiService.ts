import { invoke } from '@tauri-apps/api/core';

export async function fetchLyricsFromNetwork(
  title: string,
  artist: string,
  album?: string
): Promise<{ content: string; source: string } | null> {
  try {
    const [content, source] = await invoke<[string, string]>('network_fetch_lyrics', {
      title,
      artist,
      album,
    });
    return { content, source };
  } catch (error) {
    console.error('Failed to fetch lyrics from network:', error);
    return null;
  }
}

export async function fetchCoverFromNetwork(
  artist: string,
  title?: string,
  album?: string
): Promise<{ data: number[]; mimeType: string; source: string } | null> {
  try {
    const [data, mimeType, source] = await invoke<[number[], string, string]>('network_fetch_cover', {
      title,
      artist,
      album,
    });
    return { data, mimeType, source };
  } catch (error) {
    console.error('Failed to fetch cover from network:', error);
    return null;
  }
}

// ========== 艺术家封面持久化操作 ==========

/**
 * 保存艺术家封面到数据库
 */
export async function saveArtistCover(
  artistName: string,
  coverData: number[],
  coverMime: string
): Promise<boolean> {
  try {
    await invoke('artist_cover_save', {
      artistName,
      coverData,
      coverMime,
    });
    console.log(`[NetworkApiService] Artist cover saved: ${artistName}`);
    return true;
  } catch (error) {
    console.error(`Failed to save artist cover for ${artistName}:`, error);
    return false;
  }
}

/**
 * 从数据库获取艺术家封面
 */
export async function getArtistCover(
  artistName: string
): Promise<{ data: number[]; mimeType: string } | null> {
  try {
    const result = await invoke<[number[], string] | null>('artist_cover_get', {
      artistName,
    });
    
    if (result) {
      const [data, mimeType] = result;
      return { data, mimeType };
    }
    return null;
  } catch (error) {
    console.error(`Failed to get artist cover for ${artistName}:`, error);
    return null;
  }
}

/**
 * 批量获取所有艺术家封面
 */
export async function getAllArtistCovers(): Promise<Map<string, { data: number[]; mimeType: string }>> {
  try {
    const covers = await invoke<Array<[string, number[], string]>>('artist_covers_get_all');
    const coverMap = new Map<string, { data: number[]; mimeType: string }>();
    
    covers.forEach(([artistName, data, mimeType]) => {
      coverMap.set(artistName, { data, mimeType });
    });
    
    console.log(`📚 从数据库加载了 ${coverMap.size} 个艺术家封面`);
    return coverMap;
  } catch (error) {
    console.error('Failed to get all artist covers:', error);
    return new Map();
  }
}

/**
 * 获取艺术家封面（带自动网络下载和保存）
 * 优先级：数据库 → 网络API → null
 */
export async function getOrFetchArtistCover(
  artistName: string
): Promise<{ data: number[]; mimeType: string } | null> {
  // 1. 先从数据库获取
  const dbCover = await getArtistCover(artistName);
  if (dbCover) {
    console.log(`[NetworkApiService] Artist cover loaded from database: ${artistName}`);
    return dbCover;
  }
  
  // Fetch from network if not in database
  console.log(`[NetworkApiService] Fetching artist cover from network: ${artistName}`);
  const networkCover = await fetchCoverFromNetwork(artistName);
  
  if (networkCover && networkCover.data.length > 0) {
    // 3. 保存到数据库
    await saveArtistCover(artistName, networkCover.data, networkCover.mimeType);
    return { data: networkCover.data, mimeType: networkCover.mimeType };
  }
  
  return null;
}

/**
 * 将封面数据转换为 URL（用于图片显示）
 */
export function convertCoverDataToUrl(data: number[], mimeType: string): string {
  const blob = new Blob([new Uint8Array(data)], { type: mimeType });
  return URL.createObjectURL(blob);
}
