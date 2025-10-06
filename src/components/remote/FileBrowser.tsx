import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../contexts/ToastContext';

interface RemoteFile {
  path: string;
  name: string;
  is_directory: boolean;
  size?: number;
  mime_type?: string;
  last_modified?: number;
}

interface FileBrowserProps {
  serverId: string;
  serverName: string;
  onClose: () => void;
}

export function FileBrowser({ serverId, serverName, onClose }: FileBrowserProps) {
  const toast = useToast();
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnlyAudio, setShowOnlyAudio] = useState(false);
  const [showCreateDirDialog, setShowCreateDirDialog] = useState(false);
  const [newDirName, setNewDirName] = useState('');

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await invoke<RemoteFile[]>('remote_browse_directory', {
        serverId,
        path,
      });
      setFiles(data);
    } catch (err) {
      setError(`加载失败: ${err}`);
      console.error('加载目录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const navigateUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath('/' + parts.join('/'));
  };

  const enterDirectory = (dir: RemoteFile) => {
    if (dir.is_directory) {
      setCurrentPath(dir.path);
    }
  };

  const handleScanLibrary = async () => {
    // ✅ 立即关闭对话框
    onClose();
    
    // 显示开始扫描的通知
    toast.info(`开始扫描远程目录: ${currentPath}...`, 3000);
    
    // 在后台执行扫描
    try {
      const result = await invoke<any>('remote_scan_library', {
        serverId,
        rootPath: currentPath,
      });
      
      // 扫描完成，显示结果通知
      if (result.added > 0 || result.updated > 0) {
        toast.success(
          `扫描完成！找到 ${result.total_files} 个文件，` +
          `新增 ${result.added} 首，更新 ${result.updated} 首` +
          (result.failed > 0 ? `，${result.failed} 个失败` : ''),
          5000
        );
      } else {
        toast.warning(
          `扫描完成，但没有找到新的音乐文件。` +
          `共处理 ${result.total_files} 个文件` +
          (result.failed > 0 ? `，${result.failed} 个失败` : ''),
          5000
        );
      }
    } catch (error) {
      console.error('扫描失败:', error);
      toast.error(`扫描失败: ${error}`, 5000);
    }
  };

  const handleCreateDirectory = async () => {
    if (!newDirName.trim()) {
      toast.error('请输入文件夹名称', 2000);
      return;
    }

    const newPath = currentPath === '/' 
      ? `/${newDirName}` 
      : `${currentPath}/${newDirName}`;

    try {
      // 获取服务器配置
      const serverList = await invoke<any[]>('remote_get_servers');
      const server = serverList.find((s: any) => s.id === serverId);
      
      if (!server || !server.config.url) {
        throw new Error('服务器配置不存在');
      }

      await invoke('webdav_create_directory', {
        url: server.config.url,
        username: server.config.username,
        password: server.config.password,
        dirPath: newPath,
      });

      toast.success(`文件夹 "${newDirName}" 创建成功`, 2000);
      setShowCreateDirDialog(false);
      setNewDirName('');
      loadDirectory(currentPath); // 刷新列表
    } catch (error) {
      console.error('创建目录失败:', error);
      toast.error(`创建失败: ${error}`, 3000);
    }
  };

  const handleDeleteFile = async (file: RemoteFile) => {
    if (!window.confirm(`确定要删除 ${file.is_directory ? '文件夹' : '文件'} "${file.name}" 吗？此操作不可撤销。`)) {
      return;
    }

    try {
      // 获取服务器配置
      const serverList = await invoke<any[]>('remote_get_servers');
      const server = serverList.find((s: any) => s.id === serverId);
      
      if (!server || !server.config.url) {
        throw new Error('服务器配置不存在');
      }

      await invoke('webdav_delete_file', {
        url: server.config.url,
        username: server.config.username,
        password: server.config.password,
        filePath: file.path,
      });

      toast.success(`${file.is_directory ? '文件夹' : '文件'} "${file.name}" 已删除`, 2000);
      loadDirectory(currentPath); // 刷新列表
    } catch (error) {
      console.error('删除失败:', error);
      toast.error(`删除失败: ${error}`, 3000);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 音频文件扩展名列表
  const audioExtensions = ['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.wma', '.ape', '.alac'];
  
  // 过滤文件列表
  const filteredFiles = showOnlyAudio 
    ? files.filter(file => {
        if (file.is_directory) return true; // 总是显示目录
        const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
        return ext && audioExtensions.includes(ext);
      })
    : files;

  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-200 rounded-2xl w-full max-w-4xl h-[600px] mx-4 flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-dark-400">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-dark-900">
              浏览文件 - {serverName}
            </h3>
            <p className="text-sm text-slate-600 dark:text-dark-700 mt-0.5">
              当前路径：{currentPath}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-dark-900 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 面包屑导航和过滤器 */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-dark-300 border-b border-slate-200 dark:border-dark-400">
          <div className="flex items-center space-x-2 overflow-x-auto flex-1 mr-4">
            <button
              onClick={() => setCurrentPath('/')}
              className="px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors whitespace-nowrap"
            >
              根目录
            </button>
          {pathParts.map((part, index) => (
            <div key={index} className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <button
                onClick={() => setCurrentPath('/' + pathParts.slice(0, index + 1).join('/'))}
                className="px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors whitespace-nowrap"
              >
                {part}
              </button>
            </div>
          ))}
          </div>
          
          {/* 操作按钮组 */}
          <div className="flex items-center gap-2">
            {/* 新建文件夹 */}
            <button
              onClick={() => setShowCreateDirDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
              title="新建文件夹"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              新建文件夹
            </button>
            
            {/* 音频过滤开关 */}
            <button
              onClick={() => setShowOnlyAudio(!showOnlyAudio)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                showOnlyAudio 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' 
                  : 'bg-white dark:bg-dark-800 text-slate-600 dark:text-dark-700 hover:bg-slate-100 dark:hover:bg-dark-400'
              }`}
              title={showOnlyAudio ? '显示所有文件' : '仅显示音频文件'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              {showOnlyAudio ? '音频' : '全部'}
            </button>
          </div>
        </div>

        {/* 文件列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={() => loadDirectory(currentPath)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                重试
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {/* 返回上级 */}
              {currentPath !== '/' && (
                <button
                  onClick={navigateUp}
                  className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-300 transition-colors text-left"
                >
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span className="font-medium text-slate-600 dark:text-dark-700">返回上级目录</span>
                </button>
              )}

              {/* 文件列表 */}
              {filteredFiles.map((file) => (
                <div
                  key={file.path}
                  className="group flex items-center justify-between px-4 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-300 transition-colors"
                >
                  <button
                    onClick={() => file.is_directory && enterDirectory(file)}
                    disabled={!file.is_directory}
                    className="flex items-center space-x-3 flex-1 min-w-0 text-left disabled:cursor-default"
                  >
                    {file.is_directory ? (
                      <svg className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-emerald-500 dark:text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-dark-900 truncate">
                        {file.name}
                      </p>
                      {file.mime_type && (
                        <p className="text-xs text-slate-500 dark:text-dark-700">
                          {file.mime_type}
                        </p>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500 dark:text-dark-700">
                      {formatFileSize(file.size)}
                    </span>
                    {/* 删除按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(file);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-all"
                      title="删除"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

              {filteredFiles.length === 0 && !loading && (
                <div className="text-center py-12 text-slate-500 dark:text-dark-700">
                  {showOnlyAudio && files.length > 0 ? '此目录没有音频文件' : '此目录为空'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="p-4 border-t border-slate-200 dark:border-dark-400 flex space-x-3">
          <button
            onClick={handleScanLibrary}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>扫描此目录到音乐库</span>
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-600 hover:bg-slate-700 dark:bg-slate-500 dark:hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>
      </div>

      {/* 创建文件夹对话框 */}
      {showCreateDirDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateDirDialog(false)}>
          <div className="bg-white dark:bg-dark-200 rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-lg font-bold text-slate-900 dark:text-dark-900 mb-4">
              新建文件夹
            </h4>
            <input
              type="text"
              value={newDirName}
              onChange={(e) => setNewDirName(e.target.value)}
              placeholder="文件夹名称"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-dark-400 bg-white dark:bg-dark-300 text-slate-900 dark:text-dark-900 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent outline-none mb-4"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateDirectory()}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateDirDialog(false);
                  setNewDirName('');
                }}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-dark-400 text-slate-700 dark:text-dark-800 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-dark-300 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateDirectory}
                disabled={!newDirName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



