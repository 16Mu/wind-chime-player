import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../contexts/ToastContext';

export default function PlaybackSettings() {
  const toast = useToast();
  const [isResettingAudio, setIsResettingAudio] = useState(false);

  const handleDiagnoseAudioSystem = async () => {
    if (typeof invoke !== 'undefined') {
      try {
        const result = await invoke('diagnose_audio_system');
        console.log('🔍 音频系统诊断结果:', result);
        toast.success('诊断完成，请查看控制台输出详情', 5000);
      } catch (error) {
        console.error('诊断失败:', error);
        toast.error('诊断失败: ' + error);
      }
    } else {
      toast.error('Tauri API 不可用');
    }
  };

  const handleResetAudioDevice = async () => {
    if (typeof invoke !== 'undefined') {
      setIsResettingAudio(true);
      try {
        const result = await invoke('reset_audio_device');
        console.log('🔧 音频设备重置结果:', result);
        toast.success('音频设备重置完成！', 4000);
      } catch (error) {
        console.error('重置失败:', error);
        toast.error('重置失败: ' + error);
      } finally {
        setIsResettingAudio(false);
      }
    } else {
      toast.error('Tauri API 不可用');
    }
  };

  return (
    <div className="space-y-6">
      {/* 音频设备管理 */}
      <div className="bg-white dark:bg-dark-200 rounded-xl border border-slate-200 dark:border-dark-400 p-6">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-dark-900 mb-4 flex items-center gap-3">
          <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 12a3 3 0 106 0 3 3 0 00-6 0z" />
          </svg>
          音频设备管理
        </h3>
        
        {/* 音频故障排除工具 */}
        <div className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/20 border border-blue-200 dark:border-blue-700/50 rounded-xl p-4 mb-6">
          <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            音频故障排除工具
          </h4>
          <p className="text-blue-700 text-sm mb-4 leading-relaxed">
            如果遇到音频播放问题，可以使用以下工具进行诊断和修复。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleDiagnoseAudioSystem}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              系统诊断
            </button>
            <button
              onClick={handleResetAudioDevice}
              disabled={isResettingAudio}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isResettingAudio ? '重置中...' : '重置设备'}
            </button>
          </div>
        </div>
        
        <div className="text-center py-6">
          <div className="px-2.5 py-1 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-md text-sm font-medium">即将推出</div>
          <p className="text-slate-600 text-sm mt-2">设备选择、采样率等设置正在开发中</p>
        </div>
      </div>

      {/* 音质增强设置 */}
      <div className="bg-white dark:bg-dark-200 rounded-xl border border-slate-200 dark:border-dark-400 p-6">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-dark-900 mb-4 flex items-center gap-3">
          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 11.293l1.414 1.414a5 5 0 010 7.071l-1.414-1.414a3 3 0 000-4.243zm-7.071 0a3 3 0 000 4.243l-1.414 1.414a5 5 0 010-7.071l1.414 1.414zm2.828-2.829l2.829 2.829-2.829 2.828-2.828-2.828 2.828-2.829z" />
          </svg>
          音质增强
        </h3>
        
        <div className="text-center py-6">
          <div className="px-2.5 py-1 bg-slate-100 dark:bg-dark-300 text-slate-700 dark:text-dark-800 rounded-md text-sm">待开发</div>
          <p className="text-slate-600 dark:text-dark-700 text-sm mt-2">均衡器、音效等功能待开发</p>
        </div>
      </div>

      {/* 播放行为设置 */}
      <div className="bg-white dark:bg-dark-200 rounded-xl border border-slate-200 dark:border-dark-400 p-6">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-dark-900 mb-4 flex items-center gap-3">
          <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m2-10v18a2 2 0 01-2 2H5a2 2 0 01-2-2V4a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          播放行为
        </h3>
        
        <div className="text-center py-6">
          <div className="px-2.5 py-1 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-md text-sm font-medium">即将推出</div>
          <p className="text-slate-600 text-sm mt-2">自动播放、交叉淡入淡出等功能正在开发中</p>
        </div>
      </div>
    </div>
  );
}







