/**
 * 艺术家封面自动同步服务
 * 
 * 功能：
 * - 应用启动时自动检查缺失的艺术家封面
 * - 在后台静默下载并保存到数据库
 * - 只下载缺失的，避免重复请求
 */

import { getAllArtistCovers, getOrFetchArtistCover } from './networkApiService';
import type { Track } from '../types/music';

interface SyncProgress {
  total: number;
  current: number;
  currentArtist: string;
}

let isSyncing = false;
let syncAbortController: AbortController | null = null;

/**
 * 从曲目列表中提取所有唯一的艺术家名称
 */
function extractUniqueArtists(tracks: Track[]): string[] {
  const artistSet = new Set<string>();
  
  tracks.forEach(track => {
    const artistString = track.artist || '未知艺术家';
    
    // 分离合作艺术家
    const separators = [/\s*\/\s*/, /\s*、\s*/, /\s*&\s*/, /\s*feat\.?\s+/i, /\s*featuring\s+/i, /\s*ft\.?\s+/i];
    let artistNames = [artistString];
    
    separators.forEach(separator => {
      const newNames: string[] = [];
      artistNames.forEach(name => {
        const split = name.split(separator);
        newNames.push(...split);
      });
      artistNames = newNames;
    });
    
    // 清理并添加到集合
    artistNames.forEach(artistName => {
      const cleanName = artistName.trim();
      if (cleanName && cleanName !== '未知艺术家') {
        artistSet.add(cleanName);
      }
    });
  });
  
  return Array.from(artistSet).sort();
}

/**
 * 自动同步艺术家封面
 * @param tracks 曲目列表
 * @param onProgress 进度回调
 * @param maxConcurrent 最大并发数（默认3）
 */
export async function syncArtistCovers(
  tracks: Track[],
  onProgress?: (progress: SyncProgress) => void,
  maxConcurrent: number = 3
): Promise<void> {
  if (isSyncing) {
    console.log('[ArtistCoverSync] Sync already in progress, skipping');
    return;
  }

  isSyncing = true;
  syncAbortController = new AbortController();

  try {
    console.log('[ArtistCoverSync] Starting artist cover sync...');
    
    const allArtists = extractUniqueArtists(tracks);
    console.log(`[ArtistCoverSync] Found ${allArtists.length} unique artists`);
    
    if (allArtists.length === 0) {
      console.log('[ArtistCoverSync] No artists to sync');
      return;
    }
    
    const existingCovers = await getAllArtistCovers();
    console.log(`[ArtistCoverSync] ${existingCovers.size} artist covers in database`);
    
    const missingArtists = allArtists.filter(artist => !existingCovers.has(artist));
    console.log(`[ArtistCoverSync] ${missingArtists.length} artists missing covers`);
    
    if (missingArtists.length === 0) {
      console.log('[ArtistCoverSync] All artist covers cached');
      return;
    }
    
    console.log(`[ArtistCoverSync] Downloading ${missingArtists.length} artist covers (max concurrent: ${maxConcurrent})...`);
    
    let completed = 0;
    let successCount = 0;
    
    for (let i = 0; i < missingArtists.length; i += maxConcurrent) {
      if (syncAbortController.signal.aborted) {
        console.log('[ArtistCoverSync] Sync aborted');
        break;
      }
      
      const batch = missingArtists.slice(i, i + maxConcurrent);
      
      const promises = batch.map(async (artistName) => {
        try {
          if (onProgress) {
            onProgress({
              total: missingArtists.length,
              current: completed + 1,
              currentArtist: artistName,
            });
          }
          
          const result = await getOrFetchArtistCover(artistName);
          
          if (result) {
            successCount++;
            console.log(`[ArtistCoverSync] [${completed + 1}/${missingArtists.length}] ${artistName} cover cached`);
          } else {
            console.log(`[ArtistCoverSync] [${completed + 1}/${missingArtists.length}] ${artistName} cover fetch failed`);
          }
        } catch (error) {
          console.warn(`[ArtistCoverSync] ${artistName} sync failed:`, error);
        } finally {
          completed++;
        }
      });
      
      await Promise.all(promises);
      
      if (i + maxConcurrent < missingArtists.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`[ArtistCoverSync] Sync complete! Success: ${successCount}/${missingArtists.length}`);
    
  } catch (error) {
    console.error('[ArtistCoverSync] Sync failed:', error);
  } finally {
    isSyncing = false;
    syncAbortController = null;
  }
}

/**
 * Stop current sync task
 */
export function stopSync(): void {
  if (syncAbortController) {
    syncAbortController.abort();
    console.log('[ArtistCoverSync] Sync stopped');
  }
}

/**
 * Check if sync is in progress
 */
export function isSyncInProgress(): boolean {
  return isSyncing;
}

/**
 * Silent sync for background use
 */
export async function silentSyncArtistCovers(tracks: Track[]): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('[ArtistCoverSync] Starting silent artist cover sync...');
  
  await syncArtistCovers(tracks, undefined, 3); // 并发数设为3，更快同步
}


