import { SettingSection } from './ui/SettingSection';

export default function WebDAVDevelopmentStatus() {
  return (
    <div className="space-y-6">
      <SettingSection
        title="WEBDAV 功能开发状态"
        description="了解当前 WebDAV 模块的开发进展"
        badge={{ text: '开发中', variant: 'warning' }}
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8V4m0 16v-4m-6-2H4m16 0h-2M7.05 7.05L4.93 4.93m14.14 14.14-2.12-2.12M7.05 16.95l-2.12 2.12m14.14-14.14-2.12 2.12"
            />
          </svg>
        }
      >
        <p className="text-sm text-slate-600 dark:text-dark-700 leading-relaxed">
          WebDAV 模块正在进行功能完善与优化，当前版本仅开放“开发后使用”入口。我们正在集中精力完善同步能力、缓存策略与错误恢复机制。
        </p>
      </SettingSection>

      <SettingSection
        title="开发计划"
        description="后续里程碑预览"
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        }
        badge={{ text: '规划中', variant: 'info' }}
      >
        <ul className="space-y-3 text-sm text-slate-600 dark:text-dark-700 leading-relaxed">
          <li>
            <strong className="text-slate-900 dark:text-dark-900">第一阶段：</strong>
            完成基础的账号管理、新建与编辑 WebDAV 源的流程，并提供连接测试反馈。
          </li>
          <li>
            <strong className="text-slate-900 dark:text-dark-900">第二阶段：</strong>
            引入增量扫描与断点续传，提升远程曲库同步的稳定性与效率。
          </li>
          <li>
            <strong className="text-slate-900 dark:text-dark-900">第三阶段：</strong>
            支持多服务器切换、智能缓存策略，以及基于网络状态的自适应流式播放。
          </li>
        </ul>
      </SettingSection>

      <SettingSection
        title="当前体验提醒"
        description="开发阶段的临时限制"
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M4.93 19.07a10 10 0 1114.14 0 10 10 0 01-14.14 0z"
            />
          </svg>
        }
        badge={{ text: '请关注更新', variant: 'neutral' }}
      >
        <div className="space-y-2 text-sm text-slate-600 dark:text-dark-700 leading-relaxed">
          <p>• 开发中版本暂不支持批量导入与自动修复连接，若遇到问题请通过反馈渠道联系开发者。</p>
          <p>• 专用调试日志已启用，后续版本会提供日志导出入口，方便排查问题。</p>
          <p>• 欢迎在社区提交需求或建议，帮助我们打磨最终体验。</p>
        </div>
      </SettingSection>
    </div>
  );
}


