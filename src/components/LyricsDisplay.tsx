import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import ImmersiveLyricsView from './ImmersiveLyricsView';

export interface LyricLine {
  timestamp_ms: number;
  text: string;
}

export interface ParsedLyrics {
  lines: LyricLine[];
  metadata: { [key: string]: string };
}

interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
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
  const [lyrics, setLyrics] = useState<ParsedLyrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);
  const [showImmersiveMode, setShowImmersiveMode] = useState(false);
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

  // 滚动到当前歌词行
  const scrollToCurrentLine = useCallback((index: number) => {
    if (!lyricsRef.current || !lineRefs.current[index]) return;
    
    const container = lyricsRef.current;
    const currentLine = lineRefs.current[index];
    
    // 计算滚动位置，让当前行居中显示
    const containerHeight = container.clientHeight;
    const lineHeight = currentLine.offsetHeight;
    const lineTop = currentLine.offsetTop;
    
    const targetScroll = lineTop - (containerHeight / 2) + (lineHeight / 2);
    
    // 平滑滚动
    container.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: 'smooth'
    });
  }, []);

  // 缓存已加载的歌词，避免重复加载
  const [lyricsCache, setLyricsCache] = useState<Map<number, ParsedLyrics | null>>(new Map());

  // 加载歌词
  const loadLyrics = useCallback(async (id: number, trackPath?: string) => {
    if (!id) return;
    
    // 检查缓存
    if (lyricsCache.has(id)) {
      const cachedLyrics = lyricsCache.get(id);
      console.log('🎵 使用缓存的歌词, trackId:', id);
      setLyrics(cachedLyrics);
      setError(cachedLyrics ? null : '未找到歌词');
      return;
    }
    
    console.log('🎵 开始加载歌词, trackId:', id, 'trackPath:', trackPath);
    setIsLoading(true);
    setError(null);
    
    try {
      // 首先尝试从数据库获取歌词
      const dbLyrics = await invoke('lyrics_get', { trackId: id });
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
            audioPath: trackPath 
          }) as string | null;
          console.log('🎵 歌词文件路径搜索结果:', lyricsFilePath);
          
          // 然后尝试综合搜索歌词（包括同目录的lrc文件、音频元数据等）
          console.log('🎵 开始综合搜索...');
          const searchResult = await invoke('lyrics_search_comprehensive', { 
            audioPath: trackPath 
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
                const minutes = Math.floor(line.timestamp_ms / 60000);
                const seconds = Math.floor((line.timestamp_ms % 60000) / 1000);
                const milliseconds = line.timestamp_ms % 1000;
                lrcContent += `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${Math.floor(milliseconds / 10).toString().padStart(2, '0')}]${line.text}\n`;
              }
              
              await invoke('lyrics_save', {
                trackId: id,
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

  // 更新当前行索引 - 优化性能，减少不必要的日志
  useEffect(() => {
    if (lyrics?.lines && lyrics.lines.length > 0) {
      const newIndex = getCurrentLineIndex(lyrics.lines, currentPositionMs);
      
      if (newIndex !== currentLineIndex) {
        setCurrentLineIndex(newIndex);
        
        // 自动滚动到当前行（仅在播放时）
        if (newIndex !== null && isPlaying) {
          scrollToCurrentLine(newIndex);
        }
      }
    } else if (currentLineIndex !== null) {
      // 如果没有歌词但还有当前行索引，清除它
      setCurrentLineIndex(null);
    }
  }, [lyrics?.lines, currentPositionMs, currentLineIndex, getCurrentLineIndex, scrollToCurrentLine, isPlaying]);

  // 渲染加载状态
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-gray-500">加载歌词中...</span>
        </div>
      </div>
    );
  }

  // 渲染错误状态
  if (error && !lyrics) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="text-slate-400 mb-3">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">{error}</p>
          
          {/* 显示调试信息 */}
          {track?.path && (
            <div className="mt-4 text-xs text-left max-w-lg mx-auto">
              <div className="bg-gray-100 p-3 rounded-lg text-gray-700 font-mono break-all">
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
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
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
              className="px-3 py-1 text-xs bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
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
          <div className="text-slate-400 mb-3">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">暂无歌词</p>
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
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={() => setShowImmersiveMode(true)}
            className="w-10 h-10 bg-blue-500/20 hover:bg-blue-500/30 backdrop-blur-sm rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 group immersive-button-hover"
            title="沉浸式歌词模式"
          >
            <svg className="w-5 h-5 text-blue-600 group-hover:text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>

        {/* 歌词元数据显示（如果有的话） */}
        {lyrics.metadata.ti && (
          <div className="text-center mb-6 pb-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-800">{lyrics.metadata.ti}</h3>
            {lyrics.metadata.ar && (
              <p className="text-sm text-gray-500 mt-1">{lyrics.metadata.ar}</p>
            )}
            {lyrics.metadata.al && (
              <p className="text-xs text-gray-400 mt-1">{lyrics.metadata.al}</p>
            )}
          </div>
        )}
      
      {/* 歌词内容 */}
      <div className="space-y-3 py-4">
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
                  text-blue-700 font-semibold transform scale-110 
                  bg-gradient-to-r from-blue-50 via-blue-100 to-blue-50
                  shadow-lg shadow-blue-200/50
                  before:absolute before:inset-0 before:bg-gradient-to-r 
                  before:from-transparent before:via-blue-200/20 before:to-transparent 
                  before:rounded-xl before:animate-pulse
                ` 
                : 'text-gray-600 hover:text-gray-800 hover:bg-white/30 hover:backdrop-blur-sm'
              }
              ${Math.abs((currentLineIndex ?? -1) - index) <= 1 && currentLineIndex !== null
                ? 'opacity-100 transform translate-y-0' 
                : 'opacity-50 transform translate-y-1'
              }
              hover:shadow-md hover:shadow-gray-200/30 hover:transform hover:scale-105
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
                  await invoke('player_seek', { positionMs: line.timestamp_ms });
                  // 如果原本在播放，确保seek后继续播放
                  if (isPlaying) {
                    await invoke('player_resume');
                  }
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
            
            <span className="relative z-10">
              {line.text || '♪'}
            </span>
          </div>
        ))}
      </div>
      
        {/* 底部空白区域，确保最后一行可以居中显示 */}
        <div className="h-32"></div>
      </div>

      {/* 沉浸式歌词模式 */}
      {showImmersiveMode && (
        <ImmersiveLyricsView
          track={track}
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
