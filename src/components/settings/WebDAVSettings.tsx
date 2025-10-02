export default function WebDAVSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-dark-900 mb-2">
          远程音乐源
        </h2>
        <p className="text-slate-600 dark:text-dark-700">
          通过 WebDAV / FTP 访问远程音乐库
        </p>
      </div>

      {/* 开发中提示 */}
      <div className="bg-white dark:bg-dark-200 rounded-xl border border-slate-200 dark:border-dark-400 p-12">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          
          <div className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-md text-sm font-medium mb-4 inline-block">🚧 正在开发中</div>
          
          <h3 className="text-xl font-bold text-slate-900 dark:text-dark-900 mb-3">
            WebDAV / FTP 功能开发中
          </h3>
          
          <p className="text-slate-600 dark:text-dark-700 mb-6 leading-relaxed">
            我们正在积极开发远程音乐源功能，即将支持：
          </p>

          <div className="space-y-3 text-left mb-8">
            <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-dark-200 rounded-lg">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-medium text-slate-900 dark:text-dark-900">WebDAV 协议支持</div>
                <div className="text-sm text-slate-600 dark:text-dark-700">连接 Nextcloud、ownCloud 等云存储</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-dark-200 rounded-lg">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-medium text-slate-900 dark:text-dark-900">FTP/FTPS 支持</div>
                <div className="text-sm text-slate-600 dark:text-dark-700">访问 FTP 服务器上的音乐文件</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-dark-200 rounded-lg">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-medium text-slate-900 dark:text-dark-900">智能缓存</div>
                <div className="text-sm text-slate-600 dark:text-dark-700">自动缓存常听歌曲，流畅播放体验</div>
              </div>
            </div>
          </div>

          <p className="text-sm text-slate-500 dark:text-dark-600">
            敬请期待后续版本更新 ✨
          </p>
        </div>
      </div>
    </div>
  );
}
