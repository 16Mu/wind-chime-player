/**
 * 性能优化工具集
 * 
 * 提供常用的性能优化函数和工具
 */

/**
 * 防抖函数
 * 
 * @example
 * const debouncedSearch = debounce((query: string) => {
 *   searchTracks(query);
 * }, 300);
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * 节流函数
 * 
 * @example
 * const throttledScroll = throttle(() => {
 *   handleScroll();
 * }, 100);
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * 请求空闲回调（利用浏览器空闲时间）
 * 
 * @example
 * requestIdleCallback(() => {
 *   // 执行低优先级任务
 *   preloadImages();
 * });
 */
export function requestIdleCallback(callback: () => void, options?: { timeout?: number }) {
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, options);
  } else {
    // 降级方案
    return setTimeout(callback, 1);
  }
}

/**
 * 批量更新DOM（减少重排重绘）
 * 
 * @example
 * batchDOMUpdates(() => {
 *   element1.style.width = '100px';
 *   element2.style.height = '200px';
 * });
 */
export function batchDOMUpdates(updateFn: () => void) {
  requestAnimationFrame(() => {
    updateFn();
  });
}

/**
 * 图片懒加载
 * 
 * @example
 * lazyLoadImage(imgElement, '/path/to/image.jpg');
 */
export function lazyLoadImage(img: HTMLImageElement, src: string) {
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          img.src = src;
          observer.unobserve(img);
        }
      });
    });
    
    observer.observe(img);
  } else {
    // 降级：直接加载
    img.src = src;
  }
}

/**
 * 预加载图片
 * 
 * @example
 * preloadImages(['/img1.jpg', '/img2.jpg']).then(() => {
 *   console.log('图片预加载完成');
 * });
 */
export function preloadImages(urls: string[]): Promise<void[]> {
  return Promise.all(
    urls.map(url => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load ${url}`));
        img.src = url;
      });
    })
  );
}

/**
 * 内存优化：清理未使用的缓存
 * 
 * @example
 * clearUnusedCache(5 * 60 * 1000); // 清理5分钟前的缓存
 */
export function clearUnusedCache(maxAge: number = 10 * 60 * 1000) {
  const now = Date.now();
  
  // 清理localStorage中的过期项
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('cache-')) {
      try {
        const item = JSON.parse(localStorage.getItem(key) || '{}');
        if (item.timestamp && now - item.timestamp > maxAge) {
          localStorage.removeItem(key);
        }
      } catch (error) {
        // 忽略解析错误
      }
    }
  }
}

/**
 * 优化长列表渲染：分批渲染
 * 
 * @example
 * await renderInBatches(items, 100, (batch) => {
 *   batch.forEach(item => renderItem(item));
 * });
 */
export async function renderInBatches<T>(
  items: T[],
  batchSize: number,
  renderBatch: (batch: T[]) => void
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    renderBatch(batch);
    
    // 等待下一帧
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
}

/**
 * Web Worker工具：在后台线程执行计算密集型任务
 * 
 * @example
 * const result = await runInWorker((data) => {
 *   // 计算密集型任务
 *   return data.map(processItem);
 * }, largeDataset);
 */
export function runInWorker<T, R>(
  workerFn: (data: T) => R,
  data: T
): Promise<R> {
  return new Promise((resolve, reject) => {
    const workerCode = `
      self.onmessage = function(e) {
        const fn = ${workerFn.toString()};
        const result = fn(e.data);
        self.postMessage(result);
      };
    `;
    
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    
    worker.onmessage = (e) => {
      resolve(e.data);
      worker.terminate();
    };
    
    worker.onerror = (error) => {
      reject(error);
      worker.terminate();
    };
    
    worker.postMessage(data);
  });
}

/**
 * 检测性能瓶颈
 */
export function detectPerformanceBottlenecks() {
  const metrics = {
    fps: 0,
    memoryUsage: 0,
    longTasks: [] as number[]
  };

  // FPS监控
  let lastTime = performance.now();
  let frames = 0;

  function measureFPS() {
    const currentTime = performance.now();
    frames++;

    if (currentTime >= lastTime + 1000) {
      metrics.fps = Math.round((frames * 1000) / (currentTime - lastTime));
      frames = 0;
      lastTime = currentTime;
      
      if (metrics.fps < 30) {
        console.warn(`⚠️ FPS过低: ${metrics.fps}`);
      }
    }

    requestAnimationFrame(measureFPS);
  }

  measureFPS();

  // 内存监控
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    metrics.memoryUsage = Math.round(memory.usedJSHeapSize / 1048576); // MB
    
    if (metrics.memoryUsage > 100) {
      console.warn(`⚠️ 内存使用过高: ${metrics.memoryUsage}MB`);
    }
  }

  // 长任务监控
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          metrics.longTasks.push(entry.duration);
          console.warn(`⚠️ 检测到长任务: ${entry.duration.toFixed(2)}ms`);
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      // longtask可能不被支持
    }
  }

  return metrics;
}

/**
 * React组件性能分析辅助
 */
export const performanceHelpers = {
  /**
   * 检查是否应该使用React.memo
   */
  shouldUseMemo: (component: string, propsCount: number, renderTimeMs: number) => {
    if (renderTimeMs > 16.67 || propsCount > 5) {
      console.log(`💡 建议为 ${component} 使用 React.memo (渲染时间: ${renderTimeMs}ms, props: ${propsCount})`);
      return true;
    }
    return false;
  },

  /**
   * 检查是否应该使用虚拟滚动
   */
  shouldUseVirtualScroll: (itemCount: number) => {
    if (itemCount > 1000) {
      console.log(`💡 建议使用虚拟滚动 (项目数: ${itemCount})`);
      return true;
    }
    return false;
  }
};


