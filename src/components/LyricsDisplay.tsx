import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ImmersiveLyricsPanel } from './immersive';
import type { Track } from '../types/music';

export interface LyricLine {
  timestamp_ms: number;
  text: string;
  translation?: string;
}

export interface ParsedLyrics {
  lines: LyricLine[];
  metadata: { [key: string]: string };
}

interface LyricsDisplayProps {
  track?: Track;
  currentPositionMs: number;
  isPlaying: boolean;
  className?: string;
  onError?: (error: string) => void;
}


function LyricsDisplay({ 
  track, 
  currentPositionMs, 
  isPlaying,
  className = '',
  onError 
}: LyricsDisplayProps) {
  // 🐛 调试：追踪track对象引用变化
  const trackRefForDebug = useRef(track);
  useEffect(() => {
    if (trackRefForDebug.current !== track && trackRefForDebug.current?.id === track?.id) {
      console.warn('⚠️ [LyricsDisplay] track对象引用变化但ID相同！这会导致子组件无限重渲染', {
        oldTrack: trackRefForDebug.current,
        newTrack: track,
        相同: trackRefForDebug.current === track
      });
    }
    trackRefForDebug.current = track;
  }, [track]);
  
  // ✅ 稳定track对象引用，只在id变化时才创建新对象
  const stableTrack = useMemo(() => track, [track?.id]);
  
  const [lyrics, setLyrics] = useState<ParsedLyrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);
  const [showImmersiveMode, setShowImmersiveMode] = useState(false);
  
  // 简化的滚动系统 - 移除连续滚动，仅保留基础引用
  
  const lyricsRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 获取当前应该显示的歌词行
  const getCurrentLineIndex = useCallback((lines: LyricLine[], positionMs: number): number | null => {
    if (!lines.length) return null;
    
    // 找到最后一个时间戳小于等于当前位置的行
    let currentIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].timestamp_ms <= positionMs) {
        currentIndex = i;
      } else {
        break;
      }
    }
    
    return currentIndex >= 0 ? currentIndex : null;
  }, []);

  // 移除用户滚动处理 - 沉浸式模式自管理用户交互

  // 移除预计算函数 - 沉浸式模式自带位置计算
  
  // 移除连续滚动相关函数 - 统一使用沉浸式模式的离散滚动
  

  // 缓存已加载的歌词，避免重复加载
  const [lyricsCache, setLyricsCache] = useState<Map<number, ParsedLyrics | null>>(new Map());

  // 加载歌词
  const loadLyrics = useCallback(async (id: number, trackPath?: string) => {
    if (!id) return;
    
    // 检查缓存
    if (lyricsCache.has(id)) {
      const cachedLyrics = lyricsCache.get(id);
      console.log('🎵 使用缓存的歌词, trackId:', id);
      if (cachedLyrics) {
        setLyrics(cachedLyrics);
      }
      setError(cachedLyrics ? null : '未找到歌词');
      return;
    }
    
    console.log('🎵 开始加载歌词, trackId:', id, 'trackPath:', trackPath);
    setIsLoading(true);
    setError(null);
    
    try {
      // 首先尝试从数据库获取歌词
      const dbLyrics = await invoke('lyrics_get', { trackId: id, track_id: id });
      console.log('🎵 数据库歌词查询结果:', dbLyrics);
      
      if (dbLyrics && typeof dbLyrics === 'object' && 'content' in dbLyrics) {
        console.log('🎵 找到数据库歌词，开始解析...');
        // 解析歌词内容
        const parsed = await invoke('lyrics_parse', { 
          content: (dbLyrics as any).content 
        }) as ParsedLyrics;
        
        console.log('🎵 歌词解析完成:', parsed);
        setLyrics(parsed);
        // 缓存歌词
        setLyricsCache(prev => new Map(prev).set(id, parsed));
        return;
      }
      
      // 如果数据库中没有歌词，且有音频文件路径，尝试从文件系统搜索
      if (trackPath) {
        console.log('🎵 数据库中无歌词，尝试从文件系统搜索...');
        
        try {
          // 先单独测试文件搜索
          console.log('🎵 测试单独的文件搜索...');
          const lyricsFilePath = await invoke('lyrics_search_file', { 
            audioPath: trackPath,
            audio_path: trackPath 
          }) as string | null;
          console.log('🎵 歌词文件路径搜索结果:', lyricsFilePath);
          
          // 然后尝试综合搜索歌词（包括同目录的lrc文件、音频元数据等）
          console.log('🎵 开始综合搜索...');
        const searchResult = await invoke('lyrics_search_comprehensive', {
          audioPath: trackPath,
          audio_path: trackPath
          }) as ParsedLyrics | null;
          
          console.log('🎵 综合搜索结果:', searchResult);
          
          if (searchResult && searchResult.lines && searchResult.lines.length > 0) {
            console.log('🎵 找到文件系统歌词，自动保存到数据库...');
            setLyrics(searchResult);
            // 缓存歌词
            setLyricsCache(prev => new Map(prev).set(id, searchResult));
            
            // 将找到的歌词保存到数据库，以便下次快速加载
            try {
              // 将解析后的歌词转换回LRC格式保存
              let lrcContent = '';
              
              // 添加元数据
              if (searchResult.metadata) {
                for (const [key, value] of Object.entries(searchResult.metadata)) {
                  lrcContent += `[${key}:${value}]\n`;
                }
                if (Object.keys(searchResult.metadata).length > 0) {
                  lrcContent += '\n';
                }
              }
              
              // 添加歌词行
              for (const line of searchResult.lines) {
                // 🔧 验证 timestamp_ms 是否有效
                if (typeof line.timestamp_ms !== 'number' || isNaN(line.timestamp_ms)) {
                  console.warn('🎵 跳过无效的歌词行（timestamp无效）:', line);
                  continue;
                }
                
                const minutes = Math.floor(line.timestamp_ms / 60000);
                const seconds = Math.floor((line.timestamp_ms % 60000) / 1000);
                const milliseconds = line.timestamp_ms % 1000;
                lrcContent += `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${Math.floor(milliseconds / 10).toString().padStart(2, '0')}]${line.text}\n`;
              }
              
              await invoke('lyrics_save', {
                trackId: id,
                track_id: id,
                content: lrcContent,
                format: 'lrc',
                source: 'file_auto'
              });
              
              console.log('🎵 歌词已自动保存到数据库');
            } catch (saveError) {
              console.warn('🎵 自动保存歌词到数据库失败:', saveError);
              // 保存失败不影响显示
            }
            
            return;
          }
        } catch (searchError) {
          console.warn('🎵 文件系统搜索歌词失败:', searchError);
        }
      }
      
      // 如果所有方式都没有找到歌词
      console.log('🎵 未找到任何歌词');
      setLyrics(null);
      setError('未找到歌词');
      // 缓存空结果，避免重复搜索
      setLyricsCache(prev => new Map(prev).set(id, null));
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载歌词失败';
      console.error('🎵 歌词加载失败:', errorMessage);
      setError(errorMessage);
      onError?.(errorMessage);
      setLyrics(null);
      // 缓存错误结果，避免重复尝试
      setLyricsCache(prev => new Map(prev).set(id, null));
    } finally {
      setIsLoading(false);
    }
  }, [onError, lyricsCache]);

  // 当曲目改变时加载歌词 - 只依赖track.id，避免频繁重新加载
  useEffect(() => {
    if (track?.id) {
      loadLyrics(track.id, track.path);
    } else {
      setLyrics(null);
      setError(null);
      setCurrentLineIndex(null);
    }
  }, [track?.id]); // 移除 track?.path 和 loadLyrics 依赖

  // 简化的发光系统 - 仅负责高亮当前行，滚动由沉浸式模式处理
  useEffect(() => {
    if (!lyrics?.lines || lyrics.lines.length === 0) {
      return;
    }
    
    // 仅更新发光效果，不处理滚动
    const currentIndex = getCurrentLineIndex(lyrics.lines, currentPositionMs);
    if (currentIndex !== currentLineIndex) {
      console.log('🎵 [发光切换] LyricsDisplay从第', currentLineIndex, '行切换到第', currentIndex, '行');
      setCurrentLineIndex(currentIndex);
    }
  }, [lyrics?.lines, currentPositionMs, currentLineIndex, getCurrentLineIndex]);
  
  // 移除位置预计算和RAF清理 - 沉浸式模式自管理滚动



  // 渲染加载状态
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 dark:border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-500 dark:text-dark-700">加载歌词中...</span>
        </div>
      </div>
    );
  }

  // 渲染错误状态
  if (error && !lyrics) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="text-slate-400 dark:text-dark-700 mb-3">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500 dark:text-dark-700">{error}</p>
          
          {/* 显示调试信息 */}
          {track?.path && (
            <div className="mt-4 text-xs text-left max-w-lg mx-auto">
              <div className="bg-slate-100 dark:bg-dark-200 p-3 rounded-lg text-slate-700 dark:text-dark-800 font-mono break-all">
                <div className="font-bold mb-2">调试信息：</div>
                <div>音频文件：{track.path}</div>
                <div className="mt-2">
                  预期歌词文件位置：
                  <br />• {track.path.replace(/\.[^.]+$/, '.lrc')}
                  <br />• {track.path.replace(/\.[^.]+$/, '.txt')}
                </div>
              </div>
            </div>
          )}
          
          <div className="flex gap-2 justify-center mt-4">
            <button
              onClick={() => track?.id && loadLyrics(track.id, track.path)}
              className="px-3 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-white rounded-full hover:bg-blue-600 transition-colors"
            >
              重试
            </button>
            
            {/* 手动检查文件按钮 */}
            <button
              onClick={async () => {
                if (!track?.path) return;
                
                console.log('🔍 开始手动检查歌词文件...');
                try {
                  // 检查具体的文件路径
                  const basePath = track.path.replace(/\.[^.]+$/, '');
                  const extensions = ['lrc', 'txt'];
                  
                  for (const ext of extensions) {
                    const testPath = `${basePath}.${ext}`;
                    console.log(`🔍 检查文件是否存在: ${testPath}`);
                    
                    try {
                      // 尝试直接加载文件
                      const result = await invoke('lyrics_load_file', { filePath: testPath });
                      console.log(`✅ 找到歌词文件: ${testPath}`, result);
                      // 直接加载找到的歌词
                      setLyrics(result as ParsedLyrics);
                      setError(null);
                      return;
                    } catch (e) {
                      const errorStr = String(e);
                      console.log(`❌ 文件不存在或无法读取: ${testPath}`, errorStr);
                      
                      // 特别处理编码问题
                      if (errorStr.includes('UTF-8')) {
                        console.log(`🔄 检测到编码问题，尝试其他方式读取: ${testPath}`);
                        // 这里我们可以提示用户文件编码问题
                      }
                    }
                  }
                  
                  console.log('❌ 未找到任何可读取的歌词文件');
                } catch (e) {
                  console.error('手动检查失败:', e);
                }
              }}
              className="px-3 py-1 text-xs bg-green-500 dark:bg-green-600 text-white rounded-full hover:bg-green-600 transition-colors"
            >
              手动检查
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 渲染无歌词状态
  if (!lyrics || !lyrics.lines.length) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="text-slate-400 dark:text-dark-700 mb-3">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <p className="text-sm text-slate-500 dark:text-dark-700">暂无歌词</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div 
        ref={lyricsRef}
        className={`overflow-y-auto scrollbar-hide ${className} relative`}
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {/* 沉浸式模式切换按钮 */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          {/* 新版沉浸式歌词按钮 */}
          <button
            onClick={() => setShowImmersiveMode(true)}
            className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-500/30 backdrop-blur-sm rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 group"
            title="沉浸式歌词模式（新版）"
          >
            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400 group-hover:text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>

        {/* 歌词元数据显示（如果有的话） */}
        {lyrics.metadata.ti && (
          <div className="text-center mb-6 pb-4 border-b border-slate-200 dark:border-dark-400">
            <h3 className="font-medium text-slate-800 dark:text-dark-900">{lyrics.metadata.ti}</h3>
            {lyrics.metadata.ar && (
              <p className="text-sm text-slate-500 dark:text-dark-700 mt-1">{lyrics.metadata.ar}</p>
            )}
            {lyrics.metadata.al && (
              <p className="text-xs text-slate-400 dark:text-dark-600 mt-1">{lyrics.metadata.al}</p>
            )}
          </div>
        )}
      
      {/* 歌词内容 - 平衡居中显示和滚动效果 */}
      <div className="space-y-3" style={{ paddingTop: '50vh', paddingBottom: '50vh' }}>
        {lyrics.lines.map((line, index) => (
          <div
            key={index}
            ref={(el) => {
              lineRefs.current[index] = el;
            }}
            className={`
              text-center px-6 py-3 rounded-xl transition-all duration-700 ease-out cursor-pointer relative
              ${index === currentLineIndex 
                ? `
                  text-blue-700 dark:text-blue-300 font-semibold transform scale-110 
                  bg-gradient-to-r from-blue-50 via-blue-100 to-blue-50
                  shadow-lg shadow-blue-200/50
                  before:absolute before:inset-0 before:bg-gradient-to-r 
                  before:from-transparent before:via-blue-200/20 before:to-transparent 
                  before:rounded-xl before:animate-pulse
                ` 
                : 'text-slate-600 dark:text-dark-700 hover:text-slate-800 dark:hover:text-dark-900 hover:bg-white/30 dark:hover:bg-white/10 hover:backdrop-blur-sm'
              }
              ${Math.abs((currentLineIndex ?? -1) - index) <= 1 && currentLineIndex !== null
                ? 'opacity-100 transform translate-y-0' 
                : 'opacity-50 transform translate-y-1'
              }
              hover:shadow-md hover:shadow-slate-200/30 dark:hover:shadow-dark-400/30 hover:transform hover:scale-105
              backdrop-blur-sm
            `}
            style={{
              background: index === currentLineIndex 
                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 197, 253, 0.1) 50%, rgba(59, 130, 246, 0.05) 100%)'
                : undefined,
              boxShadow: index === currentLineIndex 
                ? '0 8px 32px rgba(59, 130, 246, 0.15), inset 0 1px 2px rgba(255, 255, 255, 0.5)'
                : undefined
            }}
            onClick={async () => {
              // 点击歌词行跳转到对应时间点
              if (track?.id) {
                try {
                  console.log('🎵 [用户点击] LyricsDisplay用户点击第', index, '行，时间戳:', line.timestamp_ms);
                  
                  // 🔥 使用混合播放器跳转
                  const { hybridPlayer } = await import('../services/hybridPlayer');
                  await hybridPlayer.seek(Math.floor(line.timestamp_ms));
                  
                  // 沉浸式模式的离散滚动会自动处理位置
                } catch (error) {
                  console.error('Lyrics seek failed:', error);
                }
              }
            }}
          >
            {/* 当前行的光效装饰 */}
            {index === currentLineIndex && (
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-blue-400/10 to-transparent animate-pulse"></div>
            )}
            
            <div className="relative z-10 flex flex-col items-center gap-1">
              <span>{line.text || '♪'}</span>
              {line.translation && (
                <span className="text-sm opacity-80">
                  {line.translation}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      
        {/* 底部空白区域，确保最后一行可以居中显示 */}
        <div className="h-32"></div>
      </div>

      {/* 沉浸式歌词模式 */}
      {showImmersiveMode && (
        <ImmersiveLyricsPanel
          track={stableTrack || null}
          currentPositionMs={currentPositionMs}
          isPlaying={isPlaying}
          onClose={() => setShowImmersiveMode(false)}
          onError={onError}
        />
      )}
    </>
  );
}

// 使用 React.memo 优化性能，避免不必要的重新渲染
export default React.memo(LyricsDisplay, (prevProps, nextProps) => {
  // 如果关键属性没有变化，则跳过重新渲染
  return (
    prevProps.track?.id === nextProps.track?.id &&
    prevProps.isPlaying === nextProps.isPlaying &&
    prevProps.className === nextProps.className &&
    // 只有当播放位置变化超过 500ms 时才重新渲染，避免频繁更新
    Math.abs(prevProps.currentPositionMs - nextProps.currentPositionMs) < 500
  );
});
