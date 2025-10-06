// 远程音乐库扫描按钮组件
// 功能：扫描远程服务器上的音乐文件

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, Loader2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface RemoteScanButtonProps {
  serverId: string;
  serverName: string;
  onScanComplete?: () => void;
}

export function RemoteScanButton({ serverId, serverName, onScanComplete }: RemoteScanButtonProps) {
  const [isScanning, setIsScanning] = useState(false);
  const toast = useToast();

  const handleScan = async () => {
    setIsScanning(true);

    try {
      const result = await invoke<any>('remote_scan_library', {
        serverId,
        rootPath: '/',
      });
      
      console.log('扫描结果:', result);

      // 使用Toast通知显示扫描结果
      if (result.added > 0 || result.updated > 0) {
        toast.success(
          `✅ 扫描完成！新增 ${result.added} 首，更新 ${result.updated} 首`,
          3000
        );
      } else {
        toast.info(
          `扫描完成，未发现新的音乐文件`,
          3000
        );
      }

      // 通知父组件
      if (onScanComplete) {
        onScanComplete();
      }
    } catch (error) {
      console.error('扫描失败:', error);
      toast.error(
        `扫描失败: ${error}`,
        5000
      );
    } finally {
      setIsScanning(false);
    }
  };

  return (
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
          <span>扫描</span>
        </>
      )}
    </button>
  );
}
