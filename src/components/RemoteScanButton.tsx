// 远程音乐库扫描按钮组件
// 功能：扫描远程服务器上的音乐文件

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface RemoteScanButtonProps {
  serverId: string;
  serverName: string;
  onScanComplete?: () => void;
}

export function RemoteScanButton({ serverId, serverName, onScanComplete }: RemoteScanButtonProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleScan = async () => {
    setIsScanning(true);
    setResult(null);

    try {
      const result = await invoke<any>('remote_scan_library', {
        serverId,
        rootPath: '/',
      });
      
      console.log('扫描结果:', result);

      setResult({
        success: true,
        message: `扫描完成: 新增${result.added}首，更新${result.updated}首`,
      });

      // 通知父组件
      if (onScanComplete) {
        onScanComplete();
      }

      // 3秒后清除结果
      setTimeout(() => setResult(null), 3000);
    } catch (error) {
      console.error('扫描失败:', error);
      setResult({
        success: false,
        message: `扫描失败: ${error}`,
      });

      // 5秒后清除错误
      setTimeout(() => setResult(null), 5000);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleScan}
        disabled={isScanning}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 
                 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors
                 disabled:opacity-50 disabled:cursor-not-allowed"
        title={`扫描 ${serverName} 上的音乐文件`}
      >
        {isScanning ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>扫描中...</span>
          </>
        ) : (
          <>
            <Search size={16} />
            <span>扫描音乐库</span>
          </>
        )}
      </button>

      {/* 结果提示 */}
      {result && (
        <div
          className={`absolute top-full mt-2 left-0 right-0 px-3 py-2 rounded-lg text-sm shadow-lg z-10 ${
            result.success
              ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle size={16} className="flex-shrink-0" />
            ) : (
              <AlertCircle size={16} className="flex-shrink-0" />
            )}
            <span className="whitespace-nowrap">{result.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
