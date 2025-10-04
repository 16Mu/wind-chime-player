import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useToast } from '../contexts/ToastContext';

interface MusicFolderManagerProps {
  className?: string;
}

export default function MusicFolderManager({ className = '' }: MusicFolderManagerProps) {
  const toast = useToast();
  
  const [musicFolders, setMusicFolders] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);

  // 等待后端就绪
  useEffect(() => {
    if (typeof listen === 'undefined') return;

    const setupReadyListener = async () => {
      const unlistenAppReady = await listen('app-ready', () => {
        console.log('✅ 音乐文件夹管理器：后端就绪');
        setIsAppReady(true);
      });

      // 🔥 备用机制：延迟后尝试加载（防止错过 app-ready 事件）
      setTimeout(() => {
        if (!isAppReady) {
          console.log('⏰ 音乐文件夹管理器：延迟加载（可能错过了 app-ready 事件）');
          setIsAppReady(true);
        }
      }, 200);

      return () => {
        if (typeof unlistenAppReady === 'function') unlistenAppReady();
      };
    };

    const cleanup = setupReadyListener();
    return () => {
      cleanup.then(fn => fn && fn());
    };
  }, [isAppReady]);

  // 加载已扫描的音乐文件夹路径（等待后端就绪）
  useEffect(() => {
    if (!isAppReady) return;
    loadMusicFolders();
  }, [isAppReady]);

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
              toast.error(`扫描完成，但遇到了一些问题：${errors.slice(0, 3).join(' / ')} ${errors.length > 3 ? `还有 ${errors.length - 3} 个其他错误...` : ''}`, 6000);
            } else {
              // 没有错误但也没有找到歌曲
              toast.warning('扫描完成，但在选择的文件夹中没有找到支持的音乐文件。支持的格式包括：MP3、FLAC、WAV、M4A、OGG 等常见音频格式。', 5000);
            }
          } else {
            // 成功找到歌曲
            const message = `扫描完成！新增歌曲：${tracks_added} 首，更新歌曲：${tracks_updated} 首`;
            if (errors && errors.length > 0) {
              toast.warning(`${message}。遇到 ${errors.length} 个文件处理问题`, 5000);
            } else {
              toast.success(message, 4000);
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
      toast.warning('正在扫描中，请等待当前扫描完成后再添加新文件夹');
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
          toast.info('该文件夹已经添加过了！');
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
      
      toast.error(errorMessage);
    }
  };

  const handleDeleteFolder = async (folderPath: string) => {
    // ✅ 修复：先确认，确认后再执行删除操作
    const confirmDelete = window.confirm(
      `确认要删除文件夹 "${folderPath}" 及其所有音乐文件吗？\n\n此操作将从音乐库中移除该文件夹下的所有曲目，但不会删除本地文件。`
    );
    
    if (!confirmDelete) {
      console.log('用户取消删除操作');
      return;
    }

    try {
      setIsLoading(true);
      console.log('开始删除文件夹:', folderPath);
      
      const deletedCount = await invoke<number>('library_delete_folder', { folderPath });
      console.log(`成功删除了 ${deletedCount} 首曲目`);
      
      // 立即刷新文件夹列表
      await loadMusicFolders();
      
      // 显示成功消息
      toast.success(`成功删除了 ${deletedCount} 首曲目`);
    } catch (error) {
      console.error('删除文件夹失败:', error);
      toast.error('删除失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsLoading(false);
    }
  };

  const hasFolders = musicFolders.length > 0;

  return (
    <div className={`bg-white dark:bg-dark-100 border border-slate-200 dark:border-dark-400 rounded-lg overflow-hidden ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 dark:hover:bg-dark-200/50 group"
        style={{
          transitionProperty: 'background-color, transform',
          transitionDuration: '0.2s',
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        <div className="text-left flex-1 min-w-0">
          <div className="font-semibold text-slate-900 dark:text-dark-900 mb-1 flex items-center gap-3 truncate">
            <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            音乐库管理
          </div>
          <div className="text-sm text-slate-600 dark:text-dark-700 line-clamp-2">
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
              px-2 py-1 rounded-full text-xs font-medium
              ${isScanning
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : hasFolders 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                : 'bg-slate-100 dark:bg-dark-200 text-slate-600 dark:text-dark-700'
              }
            `}
            style={{
              transitionProperty: 'background-color, color, transform',
              transitionDuration: '0.3s',
              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: (isScanning || hasFolders) ? 'scale(1)' : 'scale(0.95)'
            }}
          >
            {isLoading ? '...' : (
              isScanning ? (
                <div className="flex items-center gap-1 scanning-pulse">
                  <div className="ring-loader" style={{ width: '12px', height: '12px', borderWidth: '2px' }}></div>
                  扫描中
                </div>
              ) : (hasFolders ? '已配置' : '未配置')
            )}
          </div>
          
          {/* 展开/收起箭头 */}
          <div 
            className={`
              text-slate-400 dark:text-dark-600
              ${isExpanded ? 'rotate-180' : 'group-hover:text-brand-500'}
            `}
            style={{
              transitionProperty: 'transform, color',
              transitionDuration: '0.3s',
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
        className={`overflow-hidden`}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          transitionProperty: 'max-height, opacity',
          transitionDuration: '0.4s',
          maxHeight: isExpanded ? '600px' : '0px',
          opacity: isExpanded ? 1 : 0,
          willChange: 'max-height, opacity'
        }}
      >
        <div className="px-4 pb-4 space-y-3">
          <div className="h-px bg-slate-200 dark:bg-dark-500"></div>
          
          {/* 无文件夹状态 */}
          {!hasFolders && !isLoading && (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-dark-200 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400 dark:text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <p className="text-sm text-slate-600 dark:text-dark-700 mb-4">还未添加任何音乐文件夹</p>
              <button
                onClick={handleFolderSelect}
                disabled={isScanning}
                className={`btn-brand flex items-center gap-2 mx-auto ${isScanning ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isScanning ? '正在扫描中，请稍候...' : '选择包含音乐文件的文件夹'}
              >
                {isScanning ? (
                  <>
                    <div className="ring-loader" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
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
              <div className="text-sm font-medium text-slate-700 dark:text-dark-800 mb-3">已导入的文件路径：</div>
              
              {/* 文件夹路径列表 */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {musicFolders.map((folder, index) => (
                  <div
                    key={index}
                    className="group relative flex items-center gap-3 p-3 bg-slate-50 dark:bg-dark-200 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-300 transition-colors duration-200 folder-item-enter"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="w-8 h-8 bg-brand-100 dark:bg-brand-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-dark-900 truncate" title={folder}>
                        {folder}
                      </div>
                    </div>
                    
                    {/* 删除按钮 - 鼠标悬停时显示 */}
                    <button
                      onClick={() => handleDeleteFolder(folder)}
                      disabled={isLoading || isScanning}
                      className={`
                        opacity-0 group-hover:opacity-100 w-8 h-8 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded-lg flex items-center justify-center transition-all duration-200 text-red-600 dark:text-red-400 hover:text-red-700 hover:scale-110
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
              <div className="pt-2 border-t border-slate-200 dark:border-dark-500">
                <button
                  onClick={handleFolderSelect}
                  disabled={isScanning}
                  className={`w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg transition-all duration-200 ${
                    isScanning 
                      ? 'border-slate-200 dark:border-dark-500 text-slate-400 dark:text-dark-600 cursor-not-allowed opacity-50' 
                      : 'border-slate-300 dark:border-dark-500 text-slate-600 dark:text-dark-700 hover:border-brand-300 dark:hover:border-brand-600 hover:text-brand-600 hover:bg-brand-50/50 dark:hover:bg-brand-900/20'
                  }`}
                  title={isScanning ? '正在扫描中，请稍候...' : '添加新的音乐文件夹'}
                >
                  {isScanning ? (
                    <>
                      <div className="ring-loader" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
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
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-dark-200 rounded-full flex items-center justify-center">
                <div className="ring-loader" style={{ width: '24px', height: '24px', borderWidth: '3px' }}></div>
              </div>
              <p className="text-sm text-slate-600 dark:text-dark-700">加载音乐文件夹列表...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
