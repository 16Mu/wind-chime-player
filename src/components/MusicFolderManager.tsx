import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface MusicFolderManagerProps {
  className?: string;
}

export default function MusicFolderManager({ className = '' }: MusicFolderManagerProps) {
  const [musicFolders, setMusicFolders] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  // 加载已扫描的音乐文件夹路径
  useEffect(() => {
    loadMusicFolders();
  }, []);

  // 监听扫描事件，自动刷新文件夹列表并显示状态
  useEffect(() => {
    if (typeof listen === 'undefined') return;

    const setupScanListeners = async () => {
      const unlistenScanStarted = await listen('library-scan-started', () => {
        console.log('🎵 音乐文件夹管理器：扫描开始');
        setIsScanning(true);
      });

      const unlistenScanComplete = await listen('library-scan-complete', (event: any) => {
        console.log('🎵 音乐文件夹管理器：扫描完成，刷新文件夹列表', event);
        setIsScanning(false);
        
        // 检查扫描结果
        const payload = event.payload;
        if (payload && typeof payload === 'object') {
          const { tracks_added, tracks_updated, errors } = payload;
          
          // 如果没有添加或更新任何歌曲，提示用户
          if (tracks_added === 0 && tracks_updated === 0) {
            if (errors && errors.length > 0) {
              // 有错误的情况
              alert(`扫描完成，但遇到了一些问题：\n\n${errors.slice(0, 3).join('\n')}\n${errors.length > 3 ? `\n还有 ${errors.length - 3} 个其他错误...` : ''}`);
            } else {
              // 没有错误但也没有找到歌曲
              alert('扫描完成，但在选择的文件夹中没有找到支持的音乐文件。\n\n支持的格式包括：MP3、FLAC、WAV、M4A、OGG 等常见音频格式。');
            }
          } else {
            // 成功找到歌曲
            const message = `扫描完成！\n\n新增歌曲：${tracks_added} 首\n更新歌曲：${tracks_updated} 首`;
            if (errors && errors.length > 0) {
              alert(`${message}\n\n遇到 ${errors.length} 个文件处理问题（可能是不支持的格式或损坏的文件）`);
            } else {
              // 可以考虑用更轻量的提示替代 alert
              console.log('✅ ' + message);
            }
          }
        }
        
        loadMusicFolders();
      });

      return () => {
        unlistenScanStarted();
        unlistenScanComplete();
      };
    };

    const cleanup = setupScanListeners();
    return () => {
      cleanup.then(fn => fn && fn());
    };
  }, []);

  const loadMusicFolders = async () => {
    try {
      setIsLoading(true);
      const folders = await invoke<string[]>('library_get_music_folders');
      setMusicFolders(folders);
    } catch (error) {
      console.error('获取音乐文件夹失败:', error);
      setMusicFolders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFolderSelect = async () => {
    // 检查是否正在扫描
    if (isScanning) {
      alert('正在扫描中，请等待当前扫描完成后再添加新文件夹');
      return;
    }

    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selectedPath = await open({
        multiple: false,
        directory: true,
        title: '选择包含音乐文件的文件夹',
        defaultPath: undefined,
      });
      if (selectedPath) {
        console.log('选择的音乐文件夹:', selectedPath);
        
        // 检查是否已经添加过该文件夹
        if (musicFolders.includes(selectedPath as string)) {
          alert('该文件夹已经添加过了！');
          return;
        }
        
        // 如果还没展开，先展开组件让用户看到过程
        if (!isExpanded) {
          setIsExpanded(true);
        }
        
        console.log('开始扫描文件夹:', selectedPath);
        await invoke('library_scan', { paths: [selectedPath as string] });
        // 注意：扫描完成后的刷新由 library-scan-complete 事件监听器处理
      }
    } catch (error) {
      console.error('文件夹选择或启动扫描失败:', error);
      
      // 更详细的错误处理
      let errorMessage = '扫描失败';
      if (error instanceof Error) {
        errorMessage += ': ' + error.message;
        
        // 特殊处理扫描中的错误
        if (error.message.includes('Scan already in progress')) {
          errorMessage = '扫描正在进行中，请等待当前扫描完成后再试';
        }
      } else {
        errorMessage += ': 未知错误';
      }
      
      alert(errorMessage);
    }
  };

  const handleDeleteFolder = async (folderPath: string) => {
    // 确认删除
    const confirmDelete = window.confirm(
      `确认要删除文件夹 "${folderPath}" 及其所有音乐文件吗？\n\n此操作将从音乐库中移除该文件夹下的所有曲目，但不会删除本地文件。`
    );
    
    if (!confirmDelete) return;

    try {
      setIsLoading(true);
      console.log('删除文件夹:', folderPath);
      
      const deletedCount = await invoke<number>('library_delete_folder', { folderPath });
      console.log(`成功删除了 ${deletedCount} 首曲目`);
      
      // 立即刷新文件夹列表
      await loadMusicFolders();
      
      // 显示成功消息
      alert(`成功删除了 ${deletedCount} 首曲目`);
    } catch (error) {
      console.error('删除文件夹失败:', error);
      alert('删除失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsLoading(false);
    }
  };

  const hasFolders = musicFolders.length > 0;

  return (
    <div className={`glass-surface rounded-lg overflow-hidden ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 active:scale-[0.98] transition-all duration-200 group"
        style={{
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        <div className="text-left">
          <div className="font-semibold text-slate-900 mb-1 flex items-center gap-3">
            <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            音乐库管理
          </div>
          <div className="text-sm text-slate-600">
            {isLoading ? '加载中...' : (
              isScanning ? '正在扫描文件夹...' : (
                hasFolders ? 
                  `已扫描 ${musicFolders.length} 个文件夹` : 
                  '选择包含音乐文件的文件夹，自动扫描并添加到音乐库中'
              )
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* 状态指示 */}
          <div 
            className={`
              px-2 py-1 rounded-full text-xs font-medium transition-all duration-300
              ${isScanning
                ? 'bg-blue-100 text-blue-700 scale-100'
                : hasFolders 
                ? 'bg-green-100 text-green-700 scale-100' 
                : 'bg-slate-100 text-slate-600 scale-95'
              }
            `}
            style={{
              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            {isLoading ? '...' : (
              isScanning ? (
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  扫描中
                </div>
              ) : (hasFolders ? '已配置' : '未配置')
            )}
          </div>
          
          {/* 展开/收起箭头 */}
          <div 
            className={`
              transition-all duration-300 text-slate-400
              ${isExpanded ? 'rotate-180' : 'group-hover:text-brand-500'}
            `}
            style={{
              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* 展开的内容区域 */}
      <div 
        className={`
          transition-all duration-300 overflow-hidden
          ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
        `}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        <div className="px-4 pb-4 space-y-3">
          <div className="h-px bg-slate-200"></div>
          
          {/* 无文件夹状态 */}
          {!hasFolders && !isLoading && (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <p className="text-sm text-slate-600 mb-4">还未添加任何音乐文件夹</p>
              <button
                onClick={handleFolderSelect}
                disabled={isScanning}
                className={`btn-brand flex items-center gap-2 mx-auto ${isScanning ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isScanning ? '正在扫描中，请稍候...' : '选择包含音乐文件的文件夹'}
              >
                {isScanning ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    扫描中...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    选择文件夹
                  </>
                )}
              </button>
            </div>
          )}

          {/* 有文件夹状态 */}
          {hasFolders && !isLoading && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700 mb-3">已导入的文件路径：</div>
              
              {/* 文件夹路径列表 */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {musicFolders.map((folder, index) => (
                  <div
                    key={index}
                    className="group relative flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors duration-200"
                  >
                    <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate" title={folder}>
                        {folder}
                      </div>
                    </div>
                    
                    {/* 删除按钮 - 鼠标悬停时显示 */}
                    <button
                      onClick={() => handleDeleteFolder(folder)}
                      disabled={isLoading || isScanning}
                      className={`
                        opacity-0 group-hover:opacity-100 w-8 h-8 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center transition-all duration-200 text-red-600 hover:text-red-700 hover:scale-110
                        ${(isLoading || isScanning) ? 'cursor-not-allowed opacity-50' : ''}
                      `}
                      title="删除此文件夹"
                      style={{
                        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              
              {/* 添加文件夹按钮 */}
              <div className="pt-2 border-t border-slate-200">
                <button
                  onClick={handleFolderSelect}
                  disabled={isScanning}
                  className={`w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg transition-all duration-200 ${
                    isScanning 
                      ? 'border-slate-200 text-slate-400 cursor-not-allowed opacity-50' 
                      : 'border-slate-300 text-slate-600 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50/50'
                  }`}
                  title={isScanning ? '正在扫描中，请稍候...' : '添加新的音乐文件夹'}
                >
                  {isScanning ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      扫描中...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      添加文件夹
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 加载状态 */}
          {isLoading && (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <p className="text-sm text-slate-600">加载音乐文件夹列表...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
