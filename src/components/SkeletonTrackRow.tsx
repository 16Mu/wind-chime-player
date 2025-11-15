/**
 * 骨架屏 - 曲目行
 * 用于数据加载时的占位显示
 */

export default function SkeletonTrackRow() {
  return (
    <tr className="border-b border-slate-100 dark:border-white/10">
      <td className="px-6 py-3">
        <div className="flex items-center gap-3">
          {/* 封面骨架 */}
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-slate-200 dark:bg-dark-300 animate-pulse" />
          
          {/* 文本骨架 */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-3.5 bg-slate-200 dark:bg-dark-300 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-slate-200 dark:bg-dark-300 rounded animate-pulse w-1/2" />
          </div>
        </div>
      </td>
      
      <td className="px-6 py-3 hidden md:table-cell">
        <div className="h-3 bg-slate-200 dark:bg-dark-300 rounded animate-pulse w-32" />
      </td>
      
      <td className="px-6 py-3 text-center">
        <div className="h-3 bg-slate-200 dark:bg-dark-300 rounded animate-pulse w-16 mx-auto" />
      </td>
    </tr>
  );
}

