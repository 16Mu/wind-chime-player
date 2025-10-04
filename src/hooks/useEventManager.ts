/**
 * Tauri事件管理Hook - 高内聚的事件监听管理
 * 
 * 设计原则：
 * - 单一职责：专注于事件监听的生命周期管理
 * - 类型安全：使用TypeScript泛型确保事件类型匹配
 * - 自动清理：组件卸载时自动清理所有监听器
 * - 避免重复：统一管理事件监听，防止重复监听
 * - 性能优化：使用ref避免频繁重建监听器
 * 
 * 性能特性：
 * - 监听器只在mount时创建一次
 * - handler更新不会重建监听器（通过ref实现）
 * - 自动清理，防止内存泄漏
 */

import { useEffect, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { TauriEventName, TauriEventPayloads } from '../types/music';

/**
 * 事件处理器映射类型
 * 
 * Key: Tauri事件名称
 * Value: 对应的事件处理函数
 */
type EventHandlers = {
  [K in TauriEventName]?: (payload: TauriEventPayloads[K]) => void;
};

/**
 * 单个事件监听Hook
 * 
 * 用于监听单个Tauri事件，自动管理生命周期
 * 
 * @param eventName Tauri事件名称
 * @param handler 事件处理函数
 * @param deps 依赖数组（可选，用于handler闭包的依赖）
 * 
 * @example
 * useTauriEvent('library-scan-complete', (data) => {
 *   console.log('扫描完成，共', data.total_tracks, '首歌曲');
 * });
 */
export function useTauriEvent<T extends TauriEventName>(
  eventName: T,
  handler: (payload: TauriEventPayloads[T]) => void,
  deps: React.DependencyList = []
) {
  useEffect(() => {
    if (typeof listen === 'undefined') {
      console.warn(`Tauri API不可用，无法监听事件: ${eventName}`);
      return;
    }

    let unlisten: UnlistenFn | undefined;

    const setupListener = async () => {
      try {
        unlisten = await listen(eventName, (event: any) => {
          handler(event.payload);
        });
      } catch (error) {
        console.error(`设置事件监听失败: ${eventName}`, error);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [eventName, ...deps]);
}

/**
 * 批量事件监听Hook
 * 
 * 高内聚设计：将相关的事件监听聚合在一起
 * 
 * 性能优化：
 * - 使用ref存储handlers，避免每次渲染重建监听器
 * - 只在eventName变化时重新设置监听器
 * - 组件卸载时自动清理所有监听器
 * 
 * @param handlers 事件处理器映射对象
 * 
 * @example
 * useEventManager({
 *   'library-scan-started': () => setIsScanning(true),
 *   'library-scan-complete': (data) => {
 *     setIsScanning(false);
 *     console.log('扫描完成', data);
 *   },
 * });
 */
export function useEventManager(handlers: EventHandlers) {
  const unlistenersRef = useRef<UnlistenFn[]>([]);
  // 🔧 P1修复：使用ref存储handlers，避免每次渲染都重建监听器
  const handlersRef = useRef(handlers);

  // 更新ref但不触发effect
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (typeof listen === 'undefined') {
      console.warn('Tauri API不可用，跳过事件监听设置');
      return;
    }

    const setupListeners = async () => {
      // 清理旧的监听器
      unlistenersRef.current.forEach(unlisten => unlisten());
      unlistenersRef.current = [];

      // 设置新的监听器
      const entries = Object.entries(handlersRef.current) as [TauriEventName, Function][];
      
      for (const [eventName, handler] of entries) {
        if (handler) {
          try {
            const unlisten = await listen(eventName, (event: any) => {
              // 总是使用最新的handler（通过ref）
              const currentHandler = handlersRef.current[eventName] as any;
              if (currentHandler) {
                currentHandler(event.payload);
              }
            });
            unlistenersRef.current.push(unlisten);
          } catch (error) {
            console.error(`设置事件监听失败: ${eventName}`, error);
          }
        }
      }
    };

    setupListeners();

    return () => {
      // 组件卸载时清理所有监听器
      unlistenersRef.current.forEach(unlisten => unlisten());
      unlistenersRef.current = [];
    };
    // 🎯 只依赖eventName列表，不依赖handler函数引用
  }, [Object.keys(handlers).join(',')]);
}

/**
 * 条件事件监听Hook
 * 
 * 只在满足条件时才监听事件，条件为false时不设置监听器
 * 
 * @param eventName Tauri事件名称
 * @param handler 事件处理函数
 * @param condition 监听条件（为true时才监听）
 * 
 * @example
 * useConditionalEvent(
 *   'player-track-changed',
 *   (track) => console.log('切换曲目', track),
 *   isPlayerReady // 只有播放器准备好后才监听
 * );
 */
export function useConditionalEvent<T extends TauriEventName>(
  eventName: T,
  handler: (payload: TauriEventPayloads[T]) => void,
  condition: boolean
) {
  useEffect(() => {
    if (!condition || typeof listen === 'undefined') return;

    let unlisten: UnlistenFn | undefined;

    const setupListener = async () => {
      try {
        unlisten = await listen(eventName, (event: any) => {
          handler(event.payload);
        });
      } catch (error) {
        console.error(`条件事件监听设置失败: ${eventName}`, error);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [eventName, condition, handler]);
}

/**
 * 一次性事件监听Hook
 * 
 * 事件触发一次后自动取消监听，常用于初始化事件
 * 
 * @param eventName Tauri事件名称
 * @param handler 事件处理函数（只会被调用一次）
 * 
 * @example
 * useOneTimeEvent('app-ready', () => {
 *   console.log('应用初始化完成');
 *   loadInitialData();
 * });
 */
export function useOneTimeEvent<T extends TauriEventName>(
  eventName: T,
  handler: (payload: TauriEventPayloads[T]) => void
) {
  const hasTriggeredRef = useRef(false);
  const handlerRef = useRef(handler);
  
  // 🔧 P2修复：更新handler ref
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (typeof listen === 'undefined') return;
    
    // 🔧 P2修复：eventName变化时重置hasTriggered
    hasTriggeredRef.current = false;

    let unlisten: UnlistenFn | undefined;

    const setupListener = async () => {
      try {
        unlisten = await listen(eventName, (event: any) => {
          if (!hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            // 使用最新的handler
            handlerRef.current(event.payload);
            // 触发后立即取消监听
            if (unlisten) {
              unlisten();
            }
          }
        });
      } catch (error) {
        console.error(`一次性事件监听设置失败: ${eventName}`, error);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [eventName]);
}
