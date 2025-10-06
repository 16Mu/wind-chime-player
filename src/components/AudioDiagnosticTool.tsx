// 音频诊断工具组件
// 完成度：100%（后端已完成，前端接入）
// 功能：自动诊断和修复音频设备问题

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Play, AlertTriangle, CheckCircle, RefreshCw, Wrench, XCircle } from 'lucide-react';

interface AudioDevice {
  name: string;
  is_default: boolean;
  is_available: boolean;
}

interface AudioDiagnosticResult {
  has_devices: boolean;
  default_device: string | null;
  available_devices: AudioDevice[];
  issues: string[];
  recommendations: string[];
}

interface AudioFixResult {
  success: boolean;
  message: string;
  fixed_issues: string[];
}

export function AudioDiagnosticTool() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<AudioDiagnosticResult | null>(null);
  const [fixResult, setFixResult] = useState<AudioFixResult | null>(null);

  // 运行简单诊断（原有功能）
  const runSimpleDiagnostic = async () => {
    setIsRunning(true);
    setFixResult(null);
    
    try {
      const result = await invoke<string>('diagnose_audio_system');
      // 解析字符串结果为结构化数据
      const lines = result.split('\n');
      const issues: string[] = [];
      const recommendations: string[] = [];
      let inRecommendations = false;
      
      for (const line of lines) {
        if (line.includes('建议的解决方案')) {
          inRecommendations = true;
          continue;
        }
        if (inRecommendations && line.trim().match(/^\d+\./)) {
          recommendations.push(line.trim());
        } else if (line.includes('❌') || line.includes('⚠️')) {
          issues.push(line.trim());
        }
      }
      
      setDiagnosticResult({
        has_devices: !result.includes('未找到'),
        default_device: null,
        available_devices: [],
        issues: issues.length > 0 ? issues : [],
        recommendations: recommendations.length > 0 ? recommendations : ['系统正常'],
      });
    } catch (error) {
      console.error('音频诊断失败:', error);
      setDiagnosticResult({
        has_devices: false,
        default_device: null,
        available_devices: [],
        issues: [`诊断失败: ${error}`],
        recommendations: ['请检查系统音频设置'],
      });
    } finally {
      setIsRunning(false);
    }
  };

  // 运行高级调试（新功能 - debug_audio_system）
  const runAdvancedDebug = async () => {
    setIsRunning(true);
    setFixResult(null);
    
    try {
      const result = await invoke<string>('debug_audio_system');
      // 解析调试结果
      const lines = result.split('\n');
      const devices: AudioDevice[] = [];
      let defaultDevice: string | null = null;
      const issues: string[] = [];
      
      for (const line of lines) {
        if (line.includes('默认输出设备:')) {
          defaultDevice = line.split(':')[1]?.trim() || null;
          if (defaultDevice) {
            devices.push({ name: defaultDevice, is_default: true, is_available: true });
          }
        } else if (line.includes('❌')) {
          issues.push(line.trim());
        }
      }
      
      setDiagnosticResult({
        has_devices: devices.length > 0,
        default_device: defaultDevice,
        available_devices: devices,
        issues: issues,
        recommendations: issues.length === 0 ? ['✅ 音频系统运行正常'] : ['请检查上述问题'],
      });
    } catch (error) {
      console.error('高级调试失败:', error);
      setDiagnosticResult({
        has_devices: false,
        default_device: null,
        available_devices: [],
        issues: [`调试失败: ${error}`],
        recommendations: ['请检查系统音频设置'],
      });
    } finally {
      setIsRunning(false);
    }
  };

  // 运行诊断（默认使用简单诊断）
  const runDiagnostic = runSimpleDiagnostic;

  // 自动修复
  const autoFix = async () => {
    setIsRunning(true);
    
    try {
      const result = await invoke<AudioFixResult>('fix_audio_system');
      setFixResult(result);
      
      // 修复后重新诊断
      if (result.success) {
        setTimeout(() => runDiagnostic(), 1000);
      }
    } catch (error) {
      console.error('音频修复失败:', error);
      setFixResult({
        success: false,
        message: `修复失败: ${error}`,
        fixed_issues: [],
      });
    } finally {
      setIsRunning(false);
    }
  };

  // 重置音频设备
  const resetDevice = async () => {
    setIsRunning(true);
    
    try {
      await invoke('reset_audio_device');
      setFixResult({
        success: true,
        message: '音频设备已重置',
        fixed_issues: ['重置了音频设备'],
      });
      
      // 重置后重新诊断
      setTimeout(() => runDiagnostic(), 1000);
    } catch (error) {
      console.error('重置失败:', error);
      setFixResult({
        success: false,
        message: `重置失败: ${error}`,
        fixed_issues: [],
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
      {/* 触发按钮 */}
      <button
        onClick={() => {
          setIsOpen(true);
          if (!diagnosticResult) {
            runDiagnostic();
          }
        }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-dark-800 
                   hover:bg-slate-200 dark:hover:bg-dark-700 transition-colors"
        title="音频诊断工具"
      >
        <Play size={18} />
        <span>音频诊断</span>
      </button>

      {/* 诊断面板 */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-16 pb-32 overflow-y-auto">
          <div className="bg-white dark:bg-dark-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[calc(100vh-180px)] overflow-hidden flex flex-col my-auto">
            {/* 标题栏 */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-dark-700">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Play className="text-brand-600" />
                音频系统诊断
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
              >
                <XCircle size={24} className="text-slate-500" />
              </button>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 操作按钮 */}
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={runDiagnostic}
                  disabled={isRunning}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg 
                           hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw size={18} className={isRunning ? 'animate-spin' : ''} />
                  {isRunning ? '诊断中...' : '快速诊断'}
                </button>

                <button
                  onClick={runAdvancedDebug}
                  disabled={isRunning}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg 
                           hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Play size={18} />
                  {isRunning ? '调试中...' : '高级调试'}
                </button>

                {diagnosticResult && diagnosticResult.issues.length > 0 && (
                  <>
                    <button
                      onClick={autoFix}
                      disabled={isRunning}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg 
                               hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Wrench size={18} />
                      自动修复
                    </button>

                    <button
                      onClick={resetDevice}
                      disabled={isRunning}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg 
                               hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <RefreshCw size={18} />
                      重置设备
                    </button>
                  </>
                )}
              </div>

              {/* 诊断结果 */}
              {diagnosticResult && (
                <div className="space-y-4">
                  {/* 整体状态 */}
                  <div className={`p-4 rounded-lg ${
                    diagnosticResult.issues.length === 0
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
                  }`}>
                    <div className="flex items-center gap-2">
                      {diagnosticResult.issues.length === 0 ? (
                        <>
                          <CheckCircle className="text-green-600" size={24} />
                          <span className="font-semibold text-green-900 dark:text-green-300">
                            音频系统正常
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="text-orange-600" size={24} />
                          <span className="font-semibold text-orange-900 dark:text-orange-300">
                            发现 {diagnosticResult.issues.length} 个问题
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 设备信息 */}
                  <div className="bg-slate-50 dark:bg-dark-800 p-4 rounded-lg space-y-3">
                    <h3 className="font-semibold text-slate-900 dark:text-white">音频设备信息</h3>
                    
                    {diagnosticResult.default_device && (
                      <div className="text-sm">
                        <span className="text-slate-600 dark:text-dark-400">默认设备：</span>
                        <span className="ml-2 text-slate-900 dark:text-white font-medium">
                          {diagnosticResult.default_device}
                        </span>
                      </div>
                    )}

                    {diagnosticResult.available_devices.length > 0 && (
                      <div>
                        <div className="text-sm text-slate-600 dark:text-dark-400 mb-2">
                          可用设备 ({diagnosticResult.available_devices.length}):
                        </div>
                        <div className="space-y-1">
                          {diagnosticResult.available_devices.map((device, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-sm text-slate-700 dark:text-dark-300"
                            >
                              <CheckCircle size={14} className="text-green-500" />
                              <span>{device.name}</span>
                              {device.is_default && (
                                <span className="px-2 py-0.5 bg-brand-100 text-brand-700 dark:bg-brand-900/30 
                                               dark:text-brand-300 rounded text-xs">
                                  默认
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 问题列表 */}
                  {diagnosticResult.issues.length > 0 && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg space-y-2">
                      <h3 className="font-semibold text-orange-900 dark:text-orange-300 flex items-center gap-2">
                        <AlertTriangle size={18} />
                        发现的问题
                      </h3>
                      <ul className="space-y-1">
                        {diagnosticResult.issues.map((issue, idx) => (
                          <li key={idx} className="text-sm text-orange-800 dark:text-orange-200 flex gap-2">
                            <span>•</span>
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 建议 */}
                  {diagnosticResult.recommendations.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-2">
                      <h3 className="font-semibold text-blue-900 dark:text-blue-300">建议</h3>
                      <ul className="space-y-1">
                        {diagnosticResult.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-sm text-blue-800 dark:text-blue-200 flex gap-2">
                            <span>•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* 修复结果 */}
              {fixResult && (
                <div className={`p-4 rounded-lg ${
                  fixResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-start gap-2">
                    {fixResult.success ? (
                      <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                    ) : (
                      <XCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                    )}
                    <div>
                      <div className={`font-semibold ${
                        fixResult.success
                          ? 'text-green-900 dark:text-green-300'
                          : 'text-red-900 dark:text-red-300'
                      }`}>
                        {fixResult.message}
                      </div>
                      {fixResult.fixed_issues.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {fixResult.fixed_issues.map((issue, idx) => (
                            <li key={idx} className="text-sm text-green-800 dark:text-green-200 flex gap-2">
                              <span>✓</span>
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 底部提示 */}
            <div className="p-4 bg-slate-50 dark:bg-dark-800 border-t border-slate-200 dark:border-dark-700">
              <p className="text-sm text-slate-600 dark:text-dark-400">
                💡 提示：如果问题仍然存在，请检查系统音频设置或重启应用程序
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

