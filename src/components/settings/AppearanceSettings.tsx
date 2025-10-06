/**
 * 外观设置 - 使用新UI组件重构
 * 主题和可访问性设置
 */

import { SettingSection } from './ui/SettingSection';
import { ToggleItem } from './ui/ToggleItem';
import { SelectCardGroup } from './ui/SelectCardGroup';

interface AppearanceSettingsProps {
  theme: 'system' | 'light' | 'dark';
  onThemeChange: (theme: 'system' | 'light' | 'dark') => void;
  isHighContrast: boolean;
  onToggleHighContrast: () => void;
  highlightedSettingId?: string | null;
}

export default function AppearanceSettings({
  theme,
  onThemeChange,
  isHighContrast,
  onToggleHighContrast,
  highlightedSettingId
}: AppearanceSettingsProps) {

  return (
    <div className="space-y-6">
      {/* 主题设置 */}
      <SettingSection
        sectionId="theme-settings"
        isHighlighted={highlightedSettingId === 'appearance-theme'}
        title="界面主题"
        description="选择你喜欢的界面外观"
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h14a2 2 0 012 2v12a4 4 0 01-4 4M7 21h10a4 4 0 004-4V5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a4 4 0 004 4z" />
          </svg>
        }
      >
        <SelectCardGroup
          columns={3}
          value={theme}
          onChange={(value) => onThemeChange(value as 'system' | 'light' | 'dark')}
          options={[
            {
              value: 'system',
              label: '跟随系统',
              description: '自动切换',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              ),
            },
            {
              value: 'light',
              label: '浅色模式',
              description: '明亮清爽',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ),
            },
            {
              value: 'dark',
              label: '深色模式',
              description: '护眼舒适',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ),
            },
          ]}
        />

        {/* 系统偏好提示 */}
        {theme === 'system' && typeof window !== 'undefined' && (
          <div className="mt-3 text-xs text-slate-500 dark:text-dark-600 bg-slate-50 dark:bg-dark-200 p-3 rounded-lg">
            <span className="font-medium">当前系统偏好：</span>
            {window.matchMedia('(prefers-color-scheme: dark)').matches ? '深色模式 🌙' : '浅色模式 ☀️'}
          </div>
        )}
      </SettingSection>

      {/* 可访问性 */}
      <SettingSection
        sectionId="accessibility"
        isHighlighted={highlightedSettingId === 'appearance-contrast'}
        title="可访问性"
        description="改善视觉体验和可读性"
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        }
      >
        <ToggleItem
          label="高对比度模式"
          description="提升文字和界面元素的对比度，改善可读性"
          checked={isHighContrast}
          onChange={onToggleHighContrast}
          badge={typeof window !== 'undefined' && window.matchMedia('(prefers-contrast: more)').matches ? '系统偏好' : undefined}
        />
      </SettingSection>

    </div>
  );
}
