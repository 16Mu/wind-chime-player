import MusicFolderManager from '../MusicFolderManager';

export default function LibrarySettings() {
  return (
    <div className="space-y-6">
      {/* 文件夹管理 */}
      <div className="card-surface p-6">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-dark-900 mb-4 flex items-center gap-3">
          <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          音乐文件夹管理
        </h3>
        
        <MusicFolderManager />
      </div>

      {/* 扫描设置 */}
      <div className="card-surface p-6">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-dark-900 mb-4 flex items-center gap-3">
          <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          扫描设置
        </h3>
        
        <div className="space-y-4">
          <div className="text-center py-6">
            <div className="card-badge brand">即将推出</div>
            <p className="text-slate-600 text-sm mt-2">自动扫描、文件类型过滤等功能正在开发中</p>
          </div>
        </div>
      </div>

      {/* 元数据设置 */}
      <div className="card-surface p-6">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-dark-900 mb-4 flex items-center gap-3">
          <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          元数据管理
        </h3>
        
        <div className="space-y-4">
          <div className="text-center py-6">
            <div className="card-badge brand">即将推出</div>
            <p className="text-slate-600 text-sm mt-2">专辑封面缓存、标签编辑等功能正在开发中</p>
          </div>
        </div>
      </div>
    </div>
  );
}





