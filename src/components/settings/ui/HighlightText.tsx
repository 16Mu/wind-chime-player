/**
 * 文本高亮组件 - 用于在设置搜索中高亮关键词
 */

interface HighlightTextProps {
  text: string;
  query: string;
  className?: string;
}

export function HighlightText({ text, query, className = '' }: HighlightTextProps) {
  if (!query.trim()) {
    return <span className={className}>{text}</span>;
  }

  const parts = text.split(new RegExp(`(${query})`, 'gi'));

  return (
    <span className={className}>
      {parts.map((part, index) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <mark 
            key={index}
            className="bg-amber-200 dark:bg-amber-500/30 text-amber-900 dark:text-amber-100 px-1 rounded"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  );
}

