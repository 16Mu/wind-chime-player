import { SettingSection } from './ui/SettingSection';

export default function AboutSettings() {
  return (
    <div className="space-y-6">
      {/* 软件信息 */}
      <SettingSection
        title="软件信息"
        description="关于 WindChime Player"
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      >
        {/* 软件信息卡片 */}
        <div className="bg-gradient-to-br from-brand-50 to-sky-50 dark:from-brand-900/20 dark:to-sky-900/20 rounded-lg p-6 border border-brand-200/50 dark:border-brand-700/50">
          <div className="flex items-start gap-4">
            {/* 软件图标 */}
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-400 dark:from-brand-600 dark:to-sky-400 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-white text-2xl font-bold">W</span>
            </div>
            
            {/* 软件详情 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h4 className="text-2xl font-bold text-slate-900 dark:text-dark-900">WindChime Player</h4>
                <div className="px-2.5 py-1 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-md text-sm font-medium">v0.4.1</div>
              </div>
              <p className="text-slate-600 dark:text-dark-700 mb-3 leading-relaxed">
                现代化跨平台音乐播放器，采用 macOS 风格设计，支持本地+WebDAV混合音乐源，提供沉浸式歌词体验。
                采用混合播放引擎架构，实现零延迟 seek（&lt; 10ms），提供流畅的音乐播放和管理功能。
              </p>
              <div className="flex flex-wrap gap-2">
                <div className="px-2.5 py-1 bg-slate-100 dark:bg-dark-300/50 text-slate-700 dark:text-dark-900 rounded-md text-sm">混合播放引擎</div>
                <div className="px-2.5 py-1 bg-slate-100 dark:bg-dark-300/50 text-slate-700 dark:text-dark-900 rounded-md text-sm">macOS 风格</div>
                <div className="px-2.5 py-1 bg-slate-100 dark:bg-dark-300/50 text-slate-700 dark:text-dark-900 rounded-md text-sm">智能搜索</div>
                <div className="px-2.5 py-1 bg-slate-100 dark:bg-dark-300/50 text-slate-700 dark:text-dark-900 rounded-md text-sm">沉浸式歌词</div>
                <div className="px-2.5 py-1 bg-slate-100 dark:bg-dark-300/50 text-slate-700 dark:text-dark-900 rounded-md text-sm">WebDAV</div>
                <div className="px-2.5 py-1 bg-slate-100 dark:bg-dark-300/50 text-slate-700 dark:text-dark-900 rounded-md text-sm">高性能</div>
              </div>
            </div>
          </div>
        </div>

        {/* 开发者铭牌 */}
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-300 dark:to-blue-900/20 rounded-lg p-6 border border-slate-200 dark:border-dark-400 mt-4">
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
              <div className="px-2.5 py-1 bg-slate-100 dark:bg-dark-200/50 text-slate-700 dark:text-dark-800 rounded-md text-sm border border-slate-300 dark:border-dark-400">Rust</div>
              <div className="px-2.5 py-1 bg-slate-100 dark:bg-dark-200/50 text-slate-700 dark:text-dark-800 rounded-md text-sm border border-slate-300 dark:border-dark-400">React</div>
              <div className="px-2.5 py-1 bg-slate-100 dark:bg-dark-200/50 text-slate-700 dark:text-dark-800 rounded-md text-sm border border-slate-300 dark:border-dark-400">TypeScript</div>
              <div className="px-2.5 py-1 bg-slate-100 dark:bg-dark-200/50 text-slate-700 dark:text-dark-800 rounded-md text-sm border border-slate-300 dark:border-dark-400">Tailwind CSS</div>
              <div className="px-2.5 py-1 bg-slate-100 dark:bg-dark-200/50 text-slate-700 dark:text-dark-800 rounded-md text-sm border border-slate-300 dark:border-dark-400">Tauri</div>
            </div>
          </div>
        </div>

        {/* 项目信息 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-green-50 dark:bg-dark-300/50 rounded-lg p-4 border border-green-200 dark:border-dark-400">
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium text-slate-900 dark:text-dark-900">开源许可</span>
            </div>
            <p className="text-slate-700 dark:text-dark-800 text-sm">MIT License</p>
          </div>
          
          <div className="bg-blue-50 dark:bg-dark-300/50 rounded-lg p-4 border border-blue-200 dark:border-dark-400">
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium text-slate-900 dark:text-dark-900">最后更新</span>
            </div>
            <p className="text-slate-700 dark:text-dark-800 text-sm">2025年10月8日</p>
          </div>
        </div>
      </SettingSection>

      {/* 特别感谢 */}
      <SettingSection
        title="特别感谢"
        description="感谢所有开源项目和贡献者的支持"
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        }
      >
        {/* 技术栈 - 词云风格 */}
        <div className="mb-5">
          <h5 className="text-sm font-semibold text-slate-900 dark:text-dark-900 mb-4">技术栈</h5>
          <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-200/50 dark:to-blue-900/10 rounded-xl border border-slate-200 dark:border-dark-400 p-8">
            <div className="flex flex-wrap items-center justify-center gap-3" style={{ lineHeight: '2' }}>
              {/* 第一行 */}
              <span className="text-base font-medium text-blue-600 dark:text-blue-400 hover:scale-110 transition-transform cursor-default inline-block" style={{ transform: 'rotate(-5deg)' }}>Vite</span>
              <span className="text-3xl font-bold text-indigo-700 dark:text-indigo-400 hover:scale-110 transition-transform cursor-default inline-block" style={{ transform: 'rotate(2deg)' }}>React</span>
              <span className="text-lg font-semibold text-purple-600 dark:text-purple-400 hover:scale-110 transition-transform cursor-default inline-block" style={{ transform: 'rotate(-3deg)' }}>Tailwind</span>
              <span className="text-xl font-semibold text-orange-600 dark:text-orange-400 hover:scale-110 transition-transform cursor-default inline-block" style={{ transform: 'rotate(4deg)' }}>Rodio</span>
              
              {/* 第二行 */}
              <span className="text-2xl font-bold text-rose-600 dark:text-rose-400 hover:scale-110 transition-transform cursor-default inline-block" style={{ transform: 'rotate(-2deg)' }}>Rust</span>
              <span className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:scale-110 transition-transform cursor-default inline-block" style={{ transform: 'rotate(6deg)' }}>Axios</span>
              <span className="text-3xl font-bold text-cyan-700 dark:text-cyan-400 hover:scale-110 transition-transform cursor-default inline-block" style={{ transform: 'rotate(-4deg)' }}>TypeScript</span>
              <span className="text-xl font-semibold text-amber-600 dark:text-amber-400 hover:scale-110 transition-transform cursor-default inline-block" style={{ transform: 'rotate(3deg)' }}>Symphonia</span>
              
              {/* 第三行 */}
              <span className="text-lg font-medium text-emerald-600 dark:text-emerald-400 hover:scale-110 transition-transform cursor-default inline-block" style={{ transform: 'rotate(-6deg)' }}>Tokio</span>
              <span className="text-3xl font-bold text-blue-700 dark:text-blue-400 hover:scale-110 transition-transform cursor-default inline-block" style={{ transform: 'rotate(1deg)' }}>Tauri</span>
              <span className="text-base font-medium text-pink-600 dark:text-pink-400 hover:scale-110 transition-transform cursor-default inline-block" style={{ transform: 'rotate(-4deg)' }}>JavaScript</span>
              
              {/* 第四行 */}
              <span className="text-xl font-semibold text-sky-600 dark:text-sky-400 hover:scale-110 transition-transform cursor-default inline-block" style={{ transform: 'rotate(5deg)' }}>Rusqlite</span>
              <span className="text-lg font-medium text-violet-600 dark:text-violet-400 hover:scale-110 transition-transform cursor-default inline-block" style={{ transform: 'rotate(-2deg)' }}>TanStack Query</span>
            </div>
          </div>
        </div>

        {/* API服务提供方 */}
        <div className="mb-6">
          <h5 className="text-sm font-semibold text-slate-900 dark:text-dark-900 mb-3">API服务提供方</h5>
          <div className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 rounded-lg p-4 border border-pink-200 dark:border-pink-700/50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h6 className="font-semibold text-slate-900 dark:text-dark-900">LrcApi</h6>
                  <a 
                    href="https://github.com/HisAtri/LrcApi"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    @HisAtri
                  </a>
                </div>
                <p className="text-slate-600 dark:text-dark-700 text-sm">提供公开的歌词和封面API服务，为本项目提供网络歌词和封面获取支持</p>
              </div>
            </div>
          </div>
        </div>

        {/* 社区贡献者 */}
        <div>
          <h5 className="text-sm font-semibold text-slate-900 dark:text-dark-900 mb-3">社区贡献者</h5>
          <div className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-dark-300 dark:to-dark-200 rounded-lg p-4 border border-slate-200 dark:border-dark-400">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-gray-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                <span className="text-white text-sm font-bold">J</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h6 className="font-semibold text-slate-900 dark:text-dark-900">January</h6>
                  <div className="px-2 py-0.5 bg-slate-100 dark:bg-dark-300 text-slate-700 dark:text-dark-800 rounded text-xs">UI/UX审查专家</div>
                </div>
                <p className="text-slate-600 dark:text-dark-700 text-sm">负责前端页面合理性审查和视觉优化建议</p>
              </div>
            </div>
          </div>
        </div>
      </SettingSection>

      {/* 联系方式 */}
      <SettingSection
        title="联系开发者"
        description="反馈和建议"
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 邮箱 */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700/50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h6 className="font-semibold text-slate-900 dark:text-dark-900 mb-2">电子邮箱</h6>
                <a 
                  href="mailto:GGBondpy@gmail.com"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                >
                  GGBondpy@gmail.com
                </a>
                <p className="text-slate-600 dark:text-dark-700 text-xs mt-2">欢迎发送邮件反馈问题或建议</p>
              </div>
            </div>
          </div>

          {/* 酷安 */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700/50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h6 className="font-semibold text-slate-900 dark:text-dark-900 mb-2">酷安社区</h6>
                <a 
                  href="http://www.coolapk.com/u/18468719"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-600 dark:text-green-400 hover:underline inline-flex items-center gap-1"
                >
                  访问我的酷安主页
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <p className="text-slate-600 dark:text-dark-700 text-xs mt-2">在酷安关注最新动态和交流</p>
              </div>
            </div>
          </div>
        </div>
      </SettingSection>
    </div>
  );
}
