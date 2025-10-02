interface SkeletonLoaderProps {
  type?: 'track' | 'card' | 'text' | 'circle';
  count?: number;
  className?: string;
}

/**
 * 骨架屏加载组件
 * 用于在数据加载时提供视觉占位，提升用户体验
 */
export default function SkeletonLoader({ 
  type = 'track', 
  count = 3,
  className = '' 
}: SkeletonLoaderProps) {
  
  // 单个曲目骨架屏
  const TrackSkeleton = ({ delay = 0 }: { delay?: number }) => (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* 序号 */}
      <div className="skeleton-box w-6 h-6 rounded"></div>
      
      {/* 封面 */}
      <div className="skeleton-box w-12 h-12 rounded"></div>
      
      {/* 曲目信息 */}
      <div className="flex-1 space-y-2">
        <div className="skeleton-box h-4 w-3/4 rounded"></div>
        <div className="skeleton-box h-3 w-1/2 rounded"></div>
      </div>
      
      {/* 时长 */}
      <div className="skeleton-box h-4 w-12 rounded"></div>
      
      {/* 操作按钮 */}
      <div className="skeleton-box w-8 h-8 rounded-full"></div>
    </div>
  );

  // 卡片骨架屏
  const CardSkeleton = ({ delay = 0 }: { delay?: number }) => (
    <div 
      className="glass-surface rounded-lg p-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* 图片 */}
      <div className="skeleton-box w-full aspect-square rounded-lg mb-3"></div>
      
      {/* 标题 */}
      <div className="skeleton-box h-4 w-3/4 rounded mb-2"></div>
      
      {/* 副标题 */}
      <div className="skeleton-box h-3 w-1/2 rounded"></div>
    </div>
  );

  // 文本骨架屏
  const TextSkeleton = ({ delay = 0 }: { delay?: number }) => (
    <div 
      className="space-y-2"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="skeleton-box h-4 w-full rounded"></div>
      <div className="skeleton-box h-4 w-5/6 rounded"></div>
      <div className="skeleton-box h-4 w-4/6 rounded"></div>
    </div>
  );

  // 圆形骨架屏
  const CircleSkeleton = ({ delay = 0 }: { delay?: number }) => (
    <div 
      className="flex flex-col items-center gap-2"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="skeleton-box w-16 h-16 rounded-full"></div>
      <div className="skeleton-box h-3 w-20 rounded"></div>
    </div>
  );

  // 根据类型渲染不同的骨架屏
  const renderSkeleton = () => {
    const items = Array.from({ length: count }, (_, index) => {
      const delay = index * 100; // 每个项目延迟100ms
      
      switch (type) {
        case 'track':
          return <TrackSkeleton key={index} delay={delay} />;
        case 'card':
          return <CardSkeleton key={index} delay={delay} />;
        case 'text':
          return <TextSkeleton key={index} delay={delay} />;
        case 'circle':
          return <CircleSkeleton key={index} delay={delay} />;
        default:
          return <TrackSkeleton key={index} delay={delay} />;
      }
    });

    return items;
  };

  return (
    <div className={`skeleton-container ${className}`}>
      {renderSkeleton()}
    </div>
  );
}

