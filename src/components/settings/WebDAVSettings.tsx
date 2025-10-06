import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileBrowser } from '../remote/FileBrowser';
import { useRemoteSource, RemoteServer } from '../../contexts/RemoteSourceContext';
import { RemoteScanButton } from '../RemoteScanButton';

export default function WebDAVSettings() {
  const {
    servers,
    cacheStats,
    refreshServers,
    refreshCacheStats,
    checkAllConnections,
    deleteServer,
    addServer,
  } = useRemoteSource();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [browsingServerId, setBrowsingServerId] = useState<string | null>(null);
  const [browsingServerName, setBrowsingServerName] = useState<string>('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isCheckingConnections, setIsCheckingConnections] = useState(false);

  // 只显示 WebDAV 服务器
  const webdavServers = servers.filter(s => s.server_type === 'webdav');

  useEffect(() => {
    refreshServers();
    refreshCacheStats();
    checkAllConnections();
  }, [refreshServers, refreshCacheStats, checkAllConnections]);

  const handleCheckAllConnections = async () => {
    setIsCheckingConnections(true);
    try {
      await checkAllConnections();
    } catch (error) {
      console.error('检查连接失败:', error);
    } finally {
      setIsCheckingConnections(false);
    }
  };

  const handleAddServer = async (config: any) => {
    try {
      setIsTestingConnection(true);
      await addServer('webdav', config.name, config);
      setShowAddDialog(false);
      // 刷新列表和统计
      await Promise.all([
        refreshServers(),
        refreshCacheStats()
      ]);
      alert('✅ 服务器添加成功！\n\n您现在可以点击"浏览"查看文件，或点击"扫描"将音乐添加到库中。');
    } catch (error) {
      console.error('添加服务器失败:', error);
      const errorMsg = typeof error === 'string' ? error : String(error);
      alert(`❌ 添加失败\n\n${errorMsg}\n\n请检查：\n• URL 格式是否正确\n• 用户名和密码是否正确\n• 服务器是否可访问`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleDelete = async (serverId: string, serverName: string) => {
    if (!confirm(`确定要删除服务器"${serverName}"吗？\n\n注意：相关缓存和扫描记录也将被清除。`)) return;
    
    try {
      await deleteServer(serverId);
      alert('✅ 服务器已删除');
      // 刷新列表和统计
      await Promise.all([
        refreshServers(),
        refreshCacheStats()
      ]);
    } catch (error) {
      console.error('删除服务器失败:', error);
      alert(`❌ 删除失败: ${error}`);
    }
  };

  const handleBrowse = (server: RemoteServer) => {
    setBrowsingServerId(server.id);
    setBrowsingServerName(server.name);
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-280px)] min-h-[600px]">
      {/* 左侧主区域 */}
      <div className="flex-1 flex flex-col space-y-4 min-w-0">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-dark-900">
              远程音乐源
            </h2>
            <p className="text-sm text-slate-600 dark:text-dark-700 mt-0.5">
              通过 WebDAV 协议连接您的云端音乐库
            </p>
          </div>
        </div>

        {/* 服务器列表 */}
        <div className="flex-1 overflow-hidden">
          <ServerList 
            servers={webdavServers}
            onBrowse={handleBrowse}
            onDelete={handleDelete}
            onAddClick={() => setShowAddDialog(true)}
          />
        </div>
      </div>

      {/* 右侧统计信息栏 */}
      <div className="w-72 xl:w-80 2xl:w-96 space-y-4 flex-shrink-0 overflow-y-auto">
        {/* 统计信息卡片 */}
        <div className="bg-white dark:bg-dark-200 rounded-xl border border-slate-200 dark:border-dark-400 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 dark:text-dark-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              统计信息
            </h3>
            <button
              onClick={() => {
                refreshCacheStats();
                handleCheckAllConnections();
              }}
              className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title="刷新统计"
            >
              <svg className={`w-4 h-4 ${isCheckingConnections ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* 缓存统计 */}
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
            <div className="bg-slate-50 dark:bg-dark-300/50 rounded-lg p-3">
              <div className="text-xs text-slate-600 dark:text-dark-700 mb-1">缓存条目</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-dark-900">
                {cacheStats?.file_count || 0}
              </div>
            </div>
            
            <div className="bg-slate-50 dark:bg-dark-300/50 rounded-lg p-3">
              <div className="text-xs text-slate-600 dark:text-dark-700 mb-1">缓存大小</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-dark-900">
                {cacheStats?.total_size_mb 
                  ? `${cacheStats.total_size_mb.toFixed(1)} MB`
                  : '0 MB'
                }
              </div>
            </div>
          </div>
        </div>

        {/* 快捷操作 */}
        <div className="bg-white dark:bg-dark-200 rounded-xl border border-slate-200 dark:border-dark-400 p-4">
          <h3 className="font-semibold text-slate-900 dark:text-dark-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            快捷操作
          </h3>
          
          <div className="space-y-2">
            <button
              onClick={handleCheckAllConnections}
              disabled={isCheckingConnections}
              className="w-full px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCheckingConnections ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-blue-600 dark:border-blue-400 border-t-transparent"></div>
                  检查中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  检查所有连接
                </>
              )}
            </button>

            <button
              onClick={() => {
                refreshServers();
                refreshCacheStats();
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-300 text-slate-600 dark:text-dark-700 hover:bg-slate-100 dark:hover:bg-dark-400 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              刷新数据
            </button>
          </div>
        </div>

        {/* 帮助提示 */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <div className="text-xs font-medium text-blue-900 dark:text-blue-200 mb-2">使用指南</div>
              <div className="space-y-2 text-xs text-blue-700 dark:text-blue-300">
                <p><strong>1. 添加服务器</strong><br/>输入 WebDAV URL 和认证信息，建议先测试连接</p>
                <p><strong>2. 浏览文件</strong><br/>点击"浏览"按钮查看云端音乐文件</p>
                <p><strong>3. 扫描入库</strong><br/>点击"扫描"将音乐添加到本地库</p>
                <p className="text-[11px] opacity-75 pt-1">支持 Nextcloud、ownCloud、Seafile 等服务</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* 常见问题 */}
        <div className="bg-slate-50 dark:bg-dark-300 rounded-xl p-4">
          <h3 className="font-semibold text-slate-900 dark:text-dark-900 mb-3 flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            常见问题
          </h3>
          <div className="space-y-2 text-xs text-slate-600 dark:text-dark-700">
            <details className="cursor-pointer">
              <summary className="font-medium hover:text-blue-600 dark:hover:text-blue-400">如何获取 WebDAV URL？</summary>
              <p className="mt-1 pl-4 text-[11px]">在 Nextcloud/ownCloud 的"文件"页面，点击左下角的"设置"，可以看到 WebDAV 地址。通常格式为：https://your-domain/remote.php/dav/files/username/</p>
            </details>
            <details className="cursor-pointer">
              <summary className="font-medium hover:text-blue-600 dark:hover:text-blue-400">连接测试失败怎么办？</summary>
              <p className="mt-1 pl-4 text-[11px]">请检查：① URL是否正确 ② 用户名密码是否正确 ③ 服务器是否开启了 WebDAV 功能 ④ 网络连接是否正常</p>
            </details>
            <details className="cursor-pointer">
              <summary className="font-medium hover:text-blue-600 dark:hover:text-blue-400">支持哪些音频格式？</summary>
              <p className="mt-1 pl-4 text-[11px]">支持 MP3、FLAC、WAV、OGG、M4A、AAC 等常见格式。所有格式都支持流式播放。</p>
            </details>
          </div>
        </div>
      </div>

      {/* 添加对话框 */}
      {showAddDialog && (
        <AddServerDialog
          onAdd={handleAddServer}
          onClose={() => setShowAddDialog(false)}
          isLoading={isTestingConnection}
        />
      )}

      {/* 文件浏览器 */}
      {browsingServerId && (
        <FileBrowser
          serverId={browsingServerId}
          serverName={browsingServerName}
          onClose={() => setBrowsingServerId(null)}
        />
      )}
    </div>
  );
}

// 服务器列表组件
function ServerList({ servers, onBrowse, onDelete, onAddClick }: {
  servers: RemoteServer[];
  onBrowse: (server: RemoteServer) => void;
  onDelete: (serverId: string, serverName: string) => void;
  onAddClick: () => void;
}) {
  return (
    <div className="bg-white dark:bg-dark-200 rounded-xl border border-slate-200 dark:border-dark-400 h-full flex flex-col overflow-hidden">
      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-6 flex-1">
          <div className="w-16 h-16 bg-slate-100 dark:bg-dark-300 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-400 dark:text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </div>
          <p className="text-slate-500 dark:text-dark-600 mb-4 text-center">
            还没有添加 WebDAV 服务器
          </p>
          <button
            onClick={onAddClick}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + 添加 WebDAV 服务器
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-dark-400 flex-1 overflow-y-auto">
          {servers.map(server => (
            <div
              key={server.id}
              className="p-4 hover:bg-slate-50 dark:hover:bg-dark-300/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-slate-900 dark:text-dark-900 truncate">
                      {server.name}
                    </h3>
                    {/* 状态徽章 */}
                    {server.status === 'connected' && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        已连接
                      </span>
                    )}
                    {server.status === 'disconnected' && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                        未连接
                      </span>
                    )}
                    {server.status?.startsWith('error') && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                        错误
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-dark-700 truncate">
                    {'url' in server.config ? server.config.url : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onBrowse(server)}
                    className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                  >
                    浏览
                  </button>
                  <RemoteScanButton 
                    serverId={server.id} 
                    serverName={server.name}
                    onScanComplete={() => {
                      console.log(`${server.name} 扫描完成`);
                    }}
                  />
                  <button
                    onClick={() => onDelete(server.id, server.name)}
                    className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="删除"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {/* 添加按钮（在列表底部） */}
          <div className="p-4">
            <button
              onClick={onAddClick}
              className="w-full py-2.5 border-2 border-dashed border-slate-300 dark:border-dark-400 text-slate-600 dark:text-dark-700 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors text-sm font-medium"
            >
              + 添加 WebDAV 服务器
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 添加服务器对话框组件
function AddServerDialog({ onAdd, onClose, isLoading }: any) {
  // 生成唯一的 server_id
  const generateServerId = () => {
    return `webdav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const [config, setConfig] = useState({
    name: '',
    url: 'https://',
    username: '',
    password: '',
    timeout_seconds: 30,
    verify_ssl: true,
    max_redirects: 5,
    user_agent: 'WindChimePlayer/1.0',
    server_id: generateServerId(),
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const configJson = JSON.stringify(config);
      const result = await invoke<string>('remote_test_connection', {
        serverType: 'webdav',
        configJson,
      });
      setTestResult({ success: true, message: result });
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: `连接失败: ${error}` 
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(config);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && !isLoading && onClose()}>
      <div className="bg-white dark:bg-dark-200 rounded-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-slate-900 dark:text-dark-900 mb-4">
          添加 WebDAV 服务器
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-1">
              服务器名称 *
            </label>
            <input
              type="text"
              value={config.name}
              onChange={e => setConfig({ ...config, name: e.target.value })}
              placeholder="我的音乐服务器"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-dark-400 bg-white dark:bg-dark-300 text-slate-900 dark:text-dark-900 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent outline-none transition"
              required
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-1">
              WebDAV URL *
            </label>
            <input
              type="url"
              value={config.url}
              onChange={e => setConfig({ ...config, url: e.target.value })}
              placeholder="https://example.com/webdav"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-dark-400 bg-white dark:bg-dark-300 text-slate-900 dark:text-dark-900 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent outline-none transition"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-slate-500 dark:text-dark-700 mt-1">
              例如：
              <br />• Nextcloud: https://cloud.example.com/remote.php/dav/files/username/
              <br />• ownCloud: https://cloud.example.com/remote.php/webdav/
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-1">
              用户名 *
            </label>
            <input
              type="text"
              value={config.username}
              onChange={e => setConfig({ ...config, username: e.target.value })}
              placeholder="用户名"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-dark-400 bg-white dark:bg-dark-300 text-slate-900 dark:text-dark-900 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent outline-none transition"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-dark-800 mb-1">
              密码 *
            </label>
            <input
              type="password"
              value={config.password}
              onChange={e => setConfig({ ...config, password: e.target.value })}
              placeholder="密码"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-dark-400 bg-white dark:bg-dark-300 text-slate-900 dark:text-dark-900 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent outline-none transition"
              required
              disabled={isLoading}
            />
          </div>

          {/* 测试结果显示 */}
          {testResult && (
            <div className={`px-4 py-3 rounded-lg ${
              testResult.success 
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}>
              <p className={`text-sm ${
                testResult.success 
                  ? 'text-green-700 dark:text-green-400' 
                  : 'text-red-700 dark:text-red-400'
              }`}>
                {testResult.message}
              </p>
            </div>
          )}

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading || isTesting}
              className="px-4 py-2 border border-slate-300 dark:border-dark-400 text-slate-700 dark:text-dark-800 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-dark-300 transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={isLoading || isTesting}
              className="px-4 py-2 border border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 font-medium rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isTesting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400"></div>
                  <span>测试中...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>测试连接</span>
                </>
              )}
            </button>
            <button
              type="submit"
              disabled={isLoading || isTesting || !testResult?.success}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>添加中...</span>
                </>
              ) : (
                <span>添加服务器</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
