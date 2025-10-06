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
  // 防止重复同步
  if (isSyncing) {
    console.log('⏸️ 艺术家封面同步已在进行中，跳过');
    return;
  }

  isSyncing = true;
  syncAbortController = new AbortController();

  try {
    console.log('🎨 开始艺术家封面自动同步...');
    
    // 1. 提取所有艺术家
    const allArtists = extractUniqueArtists(tracks);
    console.log(`📊 发现 ${allArtists.length} 个唯一艺术家`);
    
    if (allArtists.length === 0) {
      console.log('✅ 没有艺术家需要同步');
      return;
    }
    
    // 2. 获取数据库中已有的封面
    const existingCovers = await getAllArtistCovers();
    console.log(`💾 数据库中已有 ${existingCovers.size} 个艺术家封面`);
    
    // 3. 找出缺失封面的艺术家
    const missingArtists = allArtists.filter(artist => !existingCovers.has(artist));
    console.log(`🔍 发现 ${missingArtists.length} 个艺术家缺少封面`);
    
    if (missingArtists.length === 0) {
      console.log('✅ 所有艺术家封面已缓存，无需同步');
      return;
    }
    
    // 4. 批量下载封面（控制并发数）
    console.log(`🌐 开始下载 ${missingArtists.length} 个艺术家封面（最大并发：${maxConcurrent}）...`);
    
    let completed = 0;
    let successCount = 0;
    
    // 分批处理
    for (let i = 0; i < missingArtists.length; i += maxConcurrent) {
      // 检查是否被中止
      if (syncAbortController.signal.aborted) {
        console.log('⛔ 艺术家封面同步已中止');
        break;
      }
      
      const batch = missingArtists.slice(i, i + maxConcurrent);
      
      // 并发处理当前批次
      const promises = batch.map(async (artistName) => {
        try {
          // 更新进度
          if (onProgress) {
            onProgress({
              total: missingArtists.length,
              current: completed + 1,
              currentArtist: artistName,
            });
          }
          
          // 获取封面（自动保存到数据库）
          const result = await getOrFetchArtistCover(artistName);
          
          if (result) {
            successCount++;
            console.log(`✅ [${completed + 1}/${missingArtists.length}] ${artistName} 封面已缓存`);
          } else {
            console.log(`⚠️ [${completed + 1}/${missingArtists.length}] ${artistName} 封面获取失败`);
          }
        } catch (error) {
          console.warn(`❌ ${artistName} 封面同步失败:`, error);
        } finally {
          completed++;
        }
      });
      
      // 等待当前批次完成
      await Promise.all(promises);
      
      // 小延迟，避免API请求过于频繁
      if (i + maxConcurrent < missingArtists.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`🎉 艺术家封面同步完成！成功: ${successCount}/${missingArtists.length}`);
    
  } catch (error) {
    console.error('❌ 艺术家封面同步失败:', error);
  } finally {
    isSyncing = false;
    syncAbortController = null;
  }
}

/**
 * 停止当前的同步任务
 */
export function stopSync(): void {
  if (syncAbortController) {
    syncAbortController.abort();
    console.log('⏹️ 艺术家封面同步已停止');
  }
}

/**
 * 检查是否正在同步
 */
export function isSyncInProgress(): boolean {
  return isSyncing;
}

/**
 * 静默同步（适合应用启动时使用）
 * - 在后台运行，不阻塞UI
 * - 不显示进度
 * - 使用较低的并发数
 */
export async function silentSyncArtistCovers(tracks: Track[]): Promise<void> {
  // 延迟1秒启动，更快开始同步
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('🔇 启动静默艺术家封面同步...');
  
  await syncArtistCovers(tracks, undefined, 3); // 并发数设为3，更快同步
}


