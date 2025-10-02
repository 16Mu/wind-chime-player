export default function AboutSettings() {
  return (
    <div className="space-y-6">
      {/* 软件信息 */}
      <div className="bg-white dark:bg-dark-200 rounded-xl p-6 border border-slate-200 dark:border-dark-400">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-dark-900 mb-6 flex items-center gap-3">
          <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          软件信息
        </h3>
        
        <div className="space-y-6">
          {/* 软件信息卡片 */}
          <div className="bg-gradient-to-br from-brand-50 to-sky-50 dark:from-brand-900/20 dark:to-sky-900/20 rounded-xl p-6 border border-brand-200/50 dark:border-brand-700/50">
            <div className="flex items-start gap-4">
              {/* 软件图标 */}
              <div className="w-16 h-16 bg-gradient-to-br from-brand-600 to-sky-400 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                <span className="text-white text-2xl font-bold">W</span>
              </div>
              
              {/* 软件详情 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-2xl font-bold text-slate-900 dark:text-dark-900">WindChime Player</h4>
                  <div className="px-2.5 py-1 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-md text-sm font-medium">v0.3.1</div>
                </div>
                <p className="text-slate-600 dark:text-dark-700 mb-3 leading-relaxed">
                  一款现代化的音乐播放器，采用 Tauri + React 技术栈构建。
                  注重用户体验和简约美学，提供流畅的音乐播放和管理功能。
                </p>
                <div className="flex flex-wrap gap-2">
                  <div className="px-2.5 py-1 bg-slate-100 dark:bg-dark-300 text-slate-700 dark:text-dark-800 rounded-md text-sm">音乐播放</div>
                  <div className="px-2.5 py-1 bg-slate-100 dark:bg-dark-300 text-slate-700 dark:text-dark-800 rounded-md text-sm">智能搜索</div>
                  <div className="px-2.5 py-1 bg-slate-100 dark:bg-dark-300 text-slate-700 dark:text-dark-800 rounded-md text-sm">简约设计</div>
                  <div className="px-2.5 py-1 bg-slate-100 dark:bg-dark-300 text-slate-700 dark:text-dark-800 rounded-md text-sm">高性能</div>
                </div>
              </div>
            </div>
          </div>

          {/* 开发者铭牌 */}
          <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-300 dark:to-blue-900/20 rounded-xl p-6 border border-slate-200 dark:border-dark-400">
            <div className="flex items-center gap-4">
              {/* 开发者头像 */}
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                <span className="text-white text-xl font-bold">W</span>
              </div>
              
              {/* 开发者信息 */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h5 className="text-lg font-semibold text-slate-900 dark:text-dark-900">Wind</h5>
                  <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-slate-600 dark:text-dark-700 text-sm mb-2">独立开发者 · 音乐爱好者</p>
                <p className="text-slate-600 dark:text-dark-700 text-sm">
                  专注于创造优雅且实用的用户体验，致力于将技术与艺术完美融合。
                </p>
              </div>
            </div>
            
            {/* 技术栈标签 */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-dark-400">
              <div className="flex flex-wrap gap-2">
                <div className="px-2.5 py-1 bg-white dark:bg-dark-200 text-slate-600 dark:text-dark-700 rounded-md text-sm border border-slate-200 dark:border-dark-400">Rust</div>
                <div className="px-2.5 py-1 bg-white dark:bg-dark-200 text-slate-600 dark:text-dark-700 rounded-md text-sm border border-slate-200 dark:border-dark-400">React</div>
                <div className="px-2.5 py-1 bg-white dark:bg-dark-200 text-slate-600 dark:text-dark-700 rounded-md text-sm border border-slate-200 dark:border-dark-400">TypeScript</div>
                <div className="px-2.5 py-1 bg-white dark:bg-dark-200 text-slate-600 dark:text-dark-700 rounded-md text-sm border border-slate-200 dark:border-dark-400">Tailwind CSS</div>
                <div className="px-2.5 py-1 bg-white dark:bg-dark-200 text-slate-600 dark:text-dark-700 rounded-md text-sm border border-slate-200 dark:border-dark-400">Tauri</div>
              </div>
            </div>
          </div>

          {/* 项目信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-dark-300 rounded-lg p-4 border border-slate-200 dark:border-dark-400">
              <div className="flex items-center gap-3 mb-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium text-slate-900 dark:text-dark-900">开源许可</span>
              </div>
              <p className="text-slate-600 dark:text-dark-700 text-sm">MIT License</p>
            </div>
            
            <div className="bg-white dark:bg-dark-300 rounded-lg p-4 border border-slate-200 dark:border-dark-400">
              <div className="flex items-center gap-3 mb-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium text-slate-900 dark:text-dark-900">最后更新</span>
              </div>
              <p className="text-slate-600 dark:text-dark-700 text-sm">2025年9月30日</p>
            </div>
          </div>
        </div>
      </div>

      {/* 特别感谢 */}
      <div className="bg-white dark:bg-dark-200 rounded-xl p-6 border border-slate-200 dark:border-dark-400">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-dark-900 mb-4 flex items-center gap-3">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          特别感谢
        </h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-dark-300 rounded-lg p-4 border border-slate-200 dark:border-dark-400">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">T</span>
                </div>
                <span className="font-medium text-slate-900 dark:text-dark-900">Tauri</span>
              </div>
              <p className="text-slate-600 dark:text-dark-700 text-sm">跨平台应用开发框架</p>
            </div>
            
            <div className="bg-slate-50 dark:bg-dark-300 rounded-lg p-4 border border-slate-200 dark:border-dark-400">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">R</span>
                </div>
                <span className="font-medium text-slate-900 dark:text-dark-900">React</span>
              </div>
              <p className="text-slate-600 dark:text-dark-700 text-sm">用户界面构建库</p>
            </div>
            
            <div className="bg-slate-50 dark:bg-dark-300 rounded-lg p-4 border border-slate-200 dark:border-dark-400">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">T</span>
                </div>
                <span className="font-medium text-slate-900 dark:text-dark-900">TypeScript</span>
              </div>
              <p className="text-slate-600 dark:text-dark-700 text-sm">类型安全的JavaScript</p>
            </div>
            
            <div className="bg-slate-50 dark:bg-dark-300 rounded-lg p-4 border border-slate-200 dark:border-dark-400">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">T</span>
                </div>
                <span className="font-medium text-slate-900 dark:text-dark-900">Tailwind CSS</span>
              </div>
              <p className="text-slate-600 dark:text-dark-700 text-sm">实用优先的CSS框架</p>
            </div>
          </div>
        </div>
      </div>

      {/* 联系方式 */}
      <div className="bg-white dark:bg-dark-200 rounded-xl p-6 border border-slate-200 dark:border-dark-400">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-dark-900 mb-4 flex items-center gap-3">
          <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          联系开发者
        </h3>
        
        <div className="text-center py-6">
          <div className="inline-block px-3 py-1.5 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-md text-sm font-medium">敬请期待</div>
          <p className="text-slate-600 dark:text-dark-700 text-sm mt-2">反馈渠道和社区链接将在后续版本中提供</p>
        </div>
      </div>
    </div>
  );
}


