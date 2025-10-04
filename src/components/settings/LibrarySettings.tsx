import { SettingSection } from './ui/SettingSection';
import MusicFolderManager from '../MusicFolderManager';

export default function LibrarySettings() {
  return (
    <div className="space-y-6">
      {/* 文件夹管理 */}
      <SettingSection
        title="音乐文件夹管理"
        description="添加和管理音乐库文件夹"
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        }
      >
        <MusicFolderManager />
      </SettingSection>

      {/* 扫描设置 */}
      <SettingSection
        title="扫描设置"
        description="配置音乐库扫描选项"
        badge={{ text: '即将推出', variant: 'info' }}
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
      >
        <div className="text-center py-6">
          <p className="text-slate-600 dark:text-dark-700 text-sm">
            自动扫描、文件类型过滤等功能正在开发中
          </p>
        </div>
      </SettingSection>

      {/* 元数据设置 */}
      <SettingSection
        title="元数据管理"
        description="管理音乐文件的标签和元数据"
        badge={{ text: '即将推出', variant: 'info' }}
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        }
      >
        <div className="text-center py-6">
          <p className="text-slate-600 dark:text-dark-700 text-sm">
            专辑封面缓存、标签编辑等功能正在开发中
          </p>
        </div>
      </SettingSection>
    </div>
  );
}
