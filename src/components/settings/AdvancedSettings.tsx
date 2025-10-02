import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../contexts/ToastContext';

export default function AdvancedSettings() {
  const toast = useToast();
  return (
    <div className="space-y-6">
      {/* 调试工具 */}
      <div className="bg-white dark:bg-dark-200 rounded-xl border border-slate-200 dark:border-dark-400 p-6">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-dark-900 mb-4 flex items-center gap-3">
          <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          调试工具
        </h3>
        
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              开发者工具
            </h4>
            <p className="text-amber-700 text-sm mb-4 leading-relaxed">
              这些工具用于诊断和调试应用问题，谨慎使用。
            </p>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={async () => {
                  if (typeof invoke !== 'undefined') {
                    try {
                      const result = await invoke('test_library_stats');
                      console.log('🔍 库统计测试结果:', result);
                      toast.success('测试完成，请查看控制台输出详情', 4000);
                    } catch (error) {
                      console.error('测试失败:', error);
                      toast.error('测试失败: ' + error);
                    }
                  } else {
                    toast.error('Tauri API 不可用');
                  }
                }}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 00-2-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H9z" />
                </svg>
                测试库统计数据
              </button>
              <p className="text-xs text-amber-600">
                点击此按钮可以直接从数据库查询统计数据，结果会显示在控制台中。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 系统信息 */}
      <div className="bg-white dark:bg-dark-200 rounded-xl border border-slate-200 dark:border-dark-400 p-6">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-dark-900 mb-4 flex items-center gap-3">
          <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a4 4 0 004 4z" />
          </svg>
          系统信息
        </h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-dark-300 border border-slate-200 dark:border-dark-400 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a4 4 0 004 4z" />
                </svg>
                <span className="font-medium text-slate-900 dark:text-dark-900">操作系统</span>
              </div>
              <p className="text-slate-600 dark:text-dark-700 text-sm">Windows 10/11</p>
            </div>
            
            <div className="bg-slate-50 dark:bg-dark-300 border border-slate-200 dark:border-dark-400 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="font-medium text-slate-900 dark:text-dark-900">运行环境</span>
              </div>
              <p className="text-slate-600 dark:text-dark-700 text-sm">Tauri 2.0</p>
            </div>
            
            <div className="bg-slate-50 dark:bg-dark-300 border border-slate-200 dark:border-dark-400 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                <span className="font-medium text-slate-900 dark:text-dark-900">内存使用</span>
              </div>
              <p className="text-slate-600 dark:text-dark-700 text-sm">实时监控中...</p>
            </div>
            
            <div className="bg-slate-50 dark:bg-dark-300 border border-slate-200 dark:border-dark-400 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium text-slate-900 dark:text-dark-900">运行时间</span>
              </div>
              <p className="text-slate-600 dark:text-dark-700 text-sm">启动后计时</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}







