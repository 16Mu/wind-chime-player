/**
 * 性能监控Hook - 高内聚的性能监控工具
 * 
 * 用途：
 * - 监控组件渲染时间
 * - 检测性能瓶颈（超过16.67ms警告）
 * - 开发环境性能调试
 * - 自动统计和报告
 * 
 * 特性：
 * - 自动内存管理（最多监控100个组件）
 * - LRU淘汰策略（优先保留活跃组件）
 * - 仅开发环境启用
 * - 全局访问接口（window.windChimePlayer.performanceMonitor）
 * 
 * 性能影响：
 * - 开发环境：轻微影响（~0.1ms per render）
 * - 生产环境：完全禁用（零影响）
 */

import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  componentName: string;
  renderTime: number;
  renderCount: number;
  averageRenderTime: number;
}

// 🔧 P1修复：添加大小限制，防止内存泄漏
const MAX_COMPONENTS = 100; // 最多监控100个组件
const performanceData = new Map<string, {
  totalTime: number;
  count: number;
}>();

/**
 * 监控组件渲染性能
 * 
 * 自动记录每次渲染的时间，超过16.67ms（一帧）时发出警告
 * 
 * @param componentName 组件名称（用于标识和统计）
 * @param enabled 是否启用监控（默认仅开发环境）
 * 
 * @example
 * function MyComponent() {
 *   usePerformanceMonitor('MyComponent');
 *   // ... 组件逻辑
 * }
 * 
 * @example
 * // 在特定组件强制启用监控
 * function CriticalComponent() {
 *   usePerformanceMonitor('CriticalComponent', true);
 *   // ... 组件逻辑
 * }
 */
export function usePerformanceMonitor(componentName: string, enabled = import.meta.env.DEV) {
  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);

  // 渲染开始
  renderStartTime.current = performance.now();
  renderCount.current++;

  useEffect(() => {
    if (!enabled) return;

    const renderTime = performance.now() - renderStartTime.current;
    
    // 🔧 P1修复：检查Map大小，超过限制时清理最旧的数据
    if (!performanceData.has(componentName) && performanceData.size >= MAX_COMPONENTS) {
      // 清理渲染次数最少的组件（优先保留活跃组件）
      let minCount = Infinity;
      let keyToDelete: string | null = null;
      
      performanceData.forEach((data, key) => {
        if (data.count < minCount) {
          minCount = data.count;
          keyToDelete = key;
        }
      });
      
      if (keyToDelete) {
        performanceData.delete(keyToDelete);
        console.log(`🧹 [PerformanceMonitor] 清理组件: ${keyToDelete} (count: ${minCount})`);
      }
    }
    
    // 更新性能数据
    const existing = performanceData.get(componentName) || { totalTime: 0, count: 0 };
    performanceData.set(componentName, {
      totalTime: existing.totalTime + renderTime,
      count: existing.count + 1
    });

    // 警告：渲染时间超过一帧（16.67ms）
    if (renderTime > 16.67) {
      console.warn(
        `⚠️ [Performance] ${componentName} 渲染时间过长: ${renderTime.toFixed(2)}ms`,
        `(第 ${renderCount.current} 次渲染)`
      );
    }

    // 每100次渲染输出平均性能
    if (renderCount.current % 100 === 0) {
      const data = performanceData.get(componentName)!;
      const avgTime = data.totalTime / data.count;
      console.log(
        `📊 [Performance] ${componentName} 平均渲染时间: ${avgTime.toFixed(2)}ms`,
        `(共 ${data.count} 次渲染)`
      );
    }
  });
}

/**
 * 获取所有组件的性能指标
 * 
 * @returns {PerformanceMetrics[]} 性能指标数组，按平均渲染时间倒序排列
 */
export function getPerformanceMetrics(): PerformanceMetrics[] {
  const metrics: PerformanceMetrics[] = [];
  
  performanceData.forEach((data, componentName) => {
    metrics.push({
      componentName,
      renderTime: data.totalTime,
      renderCount: data.count,
      averageRenderTime: data.totalTime / data.count
    });
  });

  return metrics.sort((a, b) => b.averageRenderTime - a.averageRenderTime);
}

/**
 * 清空性能数据
 * 
 * 重置所有组件的统计数据
 */
export function clearPerformanceMetrics() {
  performanceData.clear();
  console.log('🧹 性能监控数据已清空');
}

/**
 * 打印性能报告
 * 
 * 在控制台输出格式化的性能报告表格
 */
export function printPerformanceReport() {
  const metrics = getPerformanceMetrics();
  
  console.group('📊 组件性能报告');
  console.table(metrics.map(m => ({
    '组件': m.componentName,
    '渲染次数': m.renderCount,
    '平均时间(ms)': m.averageRenderTime.toFixed(2),
    '总时间(ms)': m.renderTime.toFixed(2)
  })));
  console.groupEnd();
}

/**
 * 测量函数执行时间
 * 
 * 记录并打印函数执行耗时，超过100ms时发出警告
 * 
 * @param label 函数标签（用于日志标识）
 * @param fn 要测量的函数（支持同步和异步）
 * 
 * @returns {Promise<T>} 函数执行结果
 * 
 * @example
 * const result = await measureExecutionTime('loadData', async () => {
 *   return await fetchData();
 * });
 */
export async function measureExecutionTime<T>(
  label: string,
  fn: () => T | Promise<T>
): Promise<T> {
  const start = performance.now();
  
  try {
    const result = await fn();
    const duration = performance.now() - start;
    
    if (duration > 100) {
      console.warn(`⏱️ [Timing] ${label} 执行时间: ${duration.toFixed(2)}ms`);
    } else {
      console.log(`⏱️ [Timing] ${label} 执行时间: ${duration.toFixed(2)}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`❌ [Timing] ${label} 执行失败 (${duration.toFixed(2)}ms):`, error);
    throw error;
  }
}

// 🔧 P2修复：useDebounce已移到独立的hooks/useDebounce.ts文件
// 如需使用，请导入：import { useDebounce } from './useDebounce';

// 🔧 P3修复：使用命名空间避免全局污染
declare global {
  interface Window {
    windChimePlayer?: {
      performanceMonitor?: {
        getMetrics: typeof getPerformanceMetrics;
        clear: typeof clearPerformanceMetrics;
        report: typeof printPerformanceReport;
      }
    }
  }
}

// 导出到全局（仅开发环境）
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.windChimePlayer = window.windChimePlayer || {};
  window.windChimePlayer.performanceMonitor = {
    getMetrics: getPerformanceMetrics,
    clear: clearPerformanceMetrics,
    report: printPerformanceReport
  };
  
  console.log(
    '💡 性能监控已启用，可在控制台使用:\n' +
    '  - window.windChimePlayer.performanceMonitor.report() - 查看性能报告\n' +
    '  - window.windChimePlayer.performanceMonitor.getMetrics() - 获取性能数据\n' +
    '  - window.windChimePlayer.performanceMonitor.clear() - 清空数据'
  );
}

// 🔧 P2修复：useDebounce已移到独立的hooks/useDebounce.ts文件
// 如需使用，请导入：import { useDebounce } from './useDebounce';

// 🔧 P3修复：使用命名空间避免全局污染
declare global {
  interface Window {
    windChimePlayer?: {
      performanceMonitor?: {
        getMetrics: typeof getPerformanceMetrics;
        clear: typeof clearPerformanceMetrics;
        report: typeof printPerformanceReport;
      }
    }
  }
}

// 导出到全局（仅开发环境）
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.windChimePlayer = window.windChimePlayer || {};
  window.windChimePlayer.performanceMonitor = {
    getMetrics: getPerformanceMetrics,
    clear: clearPerformanceMetrics,
    report: printPerformanceReport
  };
  
  console.log(
    '💡 性能监控已启用，可在控制台使用:\n' +
    '  - window.windChimePlayer.performanceMonitor.report() - 查看性能报告\n' +
    '  - window.windChimePlayer.performanceMonitor.getMetrics() - 获取性能数据\n' +
    '  - window.windChimePlayer.performanceMonitor.clear() - 清空数据'
  );
}

