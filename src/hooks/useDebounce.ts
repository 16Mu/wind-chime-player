/**
 * 🔧 P2修复：防抖Hook（从usePerformanceMonitor独立出来）
 * 
 * 设计原则：
 * - 单一职责：只负责防抖逻辑
 * - 可复用：适用于任何类型的值
 * - 类型安全：完整的TypeScript支持
 * 
 * @example
 * const searchQuery = useDebounce(inputValue, 500);
 * 
 * useEffect(() => {
 *   // 只在用户停止输入500ms后执行搜索
 *   search(searchQuery);
 * }, [searchQuery]);
 */

import { useEffect, useState } from 'react';

/**
 * 防抖Hook
 * 
 * @param value 要防抖的值
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的值
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 节流Hook
 * 
 * @param value 要节流的值
 * @param delay 节流时间（毫秒）
 * @returns 节流后的值
 */
export function useThrottle<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdate;

    if (timeSinceLastUpdate >= delay) {
      setThrottledValue(value);
      setLastUpdate(now);
    } else {
      const timer = setTimeout(() => {
        setThrottledValue(value);
        setLastUpdate(Date.now());
      }, delay - timeSinceLastUpdate);

      return () => clearTimeout(timer);
    }
  }, [value, delay, lastUpdate]);

  return throttledValue;
}

