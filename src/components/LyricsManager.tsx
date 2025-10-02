import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ParsedLyrics } from './LyricsDisplay';

interface Track {
  id: number;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration_ms?: number;
}

interface LyricsManagerProps {
  track: Track;
  onClose: () => void;
  onSave?: () => void;
}

export default function LyricsManager({ track, onClose, onSave }: LyricsManagerProps) {
  const [lyricsContent, setLyricsContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [parsedLyrics, setParsedLyrics] = useState<ParsedLyrics | null>(null);

  // 加载现有歌词
  useEffect(() => {
    const loadExistingLyrics = async () => {
      setIsLoading(true);
      try {
        const lyrics = await invoke('lyrics_get', { trackId: track.id, track_id: track.id });
        if (lyrics && typeof lyrics === 'object' && 'content' in lyrics) {
          setLyricsContent((lyrics as any).content);
        }
      } catch (err) {
        console.log('没有现有歌词，开始新建');
      } finally {
        setIsLoading(false);
      }
    };

    loadExistingLyrics();
  }, [track.id]);

  // 解析歌词预览
  const handlePreview = async () => {
    if (!lyricsContent.trim()) {
      setError('请输入歌词内容');
      return;
    }

    try {
      const parsed = await invoke('lyrics_parse', { content: lyricsContent }) as ParsedLyrics;
      setParsedLyrics(parsed);
      setPreviewMode(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '歌词解析失败');
    }
  };

  // 保存歌词
  const handleSave = async () => {
    if (!lyricsContent.trim()) {
      setError('请输入歌词内容');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await invoke('lyrics_save', {
        trackId: track.id,
        track_id: track.id,
        content: lyricsContent,
        format: 'lrc',
        source: 'manual'
      });

      onSave?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存歌词失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 删除歌词
  const handleDelete = async () => {
    if (!confirm('确定要删除这首歌的歌词吗？')) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await invoke('lyrics_delete', { trackId: track.id, track_id: track.id });
      onSave?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除歌词失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 导入本地歌词文件
  const handleImportFile = async () => {
    try {
      // 使用Tauri的dialog API选择文件（Tauri v2语法）
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [{
          name: '歌词文件',
          extensions: ['lrc', 'txt']
        }]
      });

      if (selected && typeof selected === 'string') {
        const content = await invoke('lyrics_load_file', { filePath: selected }) as ParsedLyrics;
        
        // 将解析后的歌词转换回LRC格式文本
        let lrcContent = '';
        
        // 添加元数据
        if (content.metadata) {
          for (const [key, value] of Object.entries(content.metadata)) {
            lrcContent += `[${key}:${value}]\n`;
          }
          if (Object.keys(content.metadata).length > 0) {
            lrcContent += '\n';
          }
        }
        
        // 添加歌词行
        for (const line of content.lines) {
          const minutes = Math.floor(line.timestamp_ms / 60000);
          const seconds = Math.floor((line.timestamp_ms % 60000) / 1000);
          const milliseconds = line.timestamp_ms % 1000;
          lrcContent += `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${Math.floor(milliseconds / 10).toString().padStart(2, '0')}]${line.text}\n`;
        }
        
        setLyricsContent(lrcContent);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入文件失败');
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p>加载歌词中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50">
      <div className="liquid-glass liquid-glass-advanced liquid-glass-depth w-full max-w-4xl max-h-[90vh] mx-4 flex flex-col rounded-2xl shadow-2xl shadow-black/20">
        {/* 标题栏 */}
        <div className="liquid-glass-content p-6 border-b border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-dark-900">歌词管理</h2>
              <p className="text-sm text-slate-600 dark:text-dark-700 mt-1">
                {track.title} - {track.artist}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 liquid-glass liquid-glass-interactive rounded-full transition-colors hover:bg-white/20"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* 主要内容区域 */}
        <div className="flex-1 flex min-h-0">
          {/* 左侧：编辑区域 */}
          <div className="flex-1 flex flex-col liquid-glass-content p-6 border-r border-white/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-slate-800 dark:text-dark-800">歌词编辑</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleImportFile}
                  className="px-3 py-1 text-sm liquid-glass liquid-glass-interactive rounded-full transition-colors hover:bg-white/30"
                >
                  导入文件
                </button>
                <button
                  onClick={handlePreview}
                  className="px-3 py-1 text-sm liquid-glass liquid-glass-interactive text-blue-700 rounded-full transition-colors hover:bg-blue-100/50"
                >
                  预览
                </button>
              </div>
            </div>
            
            <textarea
              value={lyricsContent}
              onChange={(e) => setLyricsContent(e.target.value)}
              placeholder={`请输入歌词，支持LRC格式：

[00:12.34]这是第一行歌词
[00:15.67]这是第二行歌词

或者纯文本格式：

这是第一行歌词
这是第二行歌词`}
              className="flex-1 p-4 liquid-glass liquid-glass-interactive rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent backdrop-blur-sm"
            />

            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* 右侧：预览区域 */}
          <div className="w-80 p-6 liquid-glass-content bg-gradient-to-br from-white/30 to-white/10">
            <h3 className="font-medium text-slate-800 dark:text-dark-800 mb-4">预览</h3>
            
            {previewMode && parsedLyrics ? (
              <div className="space-y-2">
                {/* 元数据 */}
                {parsedLyrics.metadata && Object.keys(parsedLyrics.metadata).length > 0 && (
                  <div className="mb-4 p-3 bg-white rounded-lg border">
                    {Object.entries(parsedLyrics.metadata).map(([key, value]) => (
                      <div key={key} className="text-xs text-slate-600 dark:text-dark-700">
                        <span className="font-medium">{key}:</span> {value}
                      </div>
                    ))}
                  </div>
                )}

                {/* 歌词行 */}
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {parsedLyrics.lines.map((line, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-xs text-slate-400 dark:text-dark-600 font-mono w-12 flex-shrink-0 pt-0.5">
                        {formatTime(line.timestamp_ms)}
                      </span>
                      <span className="text-slate-700 dark:text-dark-800">{line.text || '♪'}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 text-xs text-slate-500 dark:text-dark-700">
                  共 {parsedLyrics.lines.length} 行歌词
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 dark:text-dark-700 py-8">
                <div className="text-4xl mb-3">👀</div>
                <p className="text-sm">点击"预览"查看解析结果</p>
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮栏 */}
        <div className="liquid-glass-content p-6 border-t border-white/20 bg-gradient-to-r from-white/20 to-white/10">
          <div className="flex justify-between">
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="px-4 py-2 text-red-600 liquid-glass liquid-glass-interactive hover:bg-red-100/50 rounded-lg transition-colors disabled:opacity-50"
            >
              删除歌词
            </button>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-slate-600 dark:text-dark-700 liquid-glass liquid-glass-interactive hover:bg-white/30 dark:hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !lyricsContent.trim()}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-500/25 hover:shadow-blue-600/30 hover:transform hover:scale-105"
              >
                {isSaving && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                {isSaving ? '保存中...' : '保存歌词'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
