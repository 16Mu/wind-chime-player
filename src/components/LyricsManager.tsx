import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ParsedLyrics } from './LyricsDisplay';
import type { Track } from '../types/music';
import { fetchLyricsFromNetwork } from '../services/networkApiService';

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
  const [parsedLyrics, setParsedLyrics] = useState<ParsedLyrics | null>(null);
  const [fetchedLyrics, setFetchedLyrics] = useState<string | null>(null);
  const [showFetchResult, setShowFetchResult] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [searchTitle, setSearchTitle] = useState(track.title);
  const [searchArtist, setSearchArtist] = useState(track.artist);
  const [searchAlbum, setSearchAlbum] = useState(track.album || '');

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
      setShowPreview(true);
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

  // 打开网络搜索对话框
  const handleFetchFromNetwork = () => {
    setSearchTitle(track.title);
    setSearchArtist(track.artist);
    setSearchAlbum(track.album || '');
    setShowSearchDialog(true);
  };

  // 执行网络搜索
  const handleExecuteSearch = async () => {
    if (!searchTitle || !searchArtist) {
      setError('歌曲名和艺术家不能为空');
      return;
    }

    setIsLoading(true);
    setError(null);
    setShowSearchDialog(false);
    setShowFetchResult(true);

    try {
      const result = await fetchLyricsFromNetwork(
        searchTitle,
        searchArtist,
        searchAlbum
      );

      if (result && result.content) {
        setFetchedLyrics(result.content);
        console.log(`✅ 从网络获取歌词成功 (来源: ${result.source})`);
      } else {
        setError('未找到歌词，请尝试手动输入或导入文件');
        setFetchedLyrics(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络获取歌词失败');
      setFetchedLyrics(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 确认导入网络获取的歌词
  const handleConfirmImport = () => {
    if (fetchedLyrics) {
      setLyricsContent(fetchedLyrics);
      setShowFetchResult(false);
      setFetchedLyrics(null);
    }
  };

  // 取消导入
  const handleCancelImport = () => {
    setShowFetchResult(false);
    setFetchedLyrics(null);
    setError(null);
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
        setIsLoading(true);
        setShowFetchResult(true);
        
        // 直接读取文件内容，不要解析后再重新构造
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        const lrcContent = await readTextFile(selected);
        
        setFetchedLyrics(lrcContent);
        setError(null);
        setIsLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入文件失败');
      setFetchedLyrics(null);
      setIsLoading(false);
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 pt-32 pb-32">
        <div className="bg-white rounded-lg p-6 max-w-xl w-full mx-4 my-auto">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 dark:border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p>加载歌词中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="liquid-glass liquid-glass-advanced liquid-glass-depth w-full max-w-5xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl shadow-black/30 overflow-hidden">
        
        {/* 标题栏 - 极简单行 */}
        <div className="liquid-glass-content px-5 py-3 border-b border-white/20 bg-gradient-to-r from-purple-50/30 to-blue-50/30 dark:from-purple-900/20 dark:to-blue-900/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 shrink-0">
                🎵 歌词管理
              </h2>
              <span className="text-slate-400 dark:text-gray-500">-</span>
              <p className="text-xs text-slate-600 dark:text-gray-400 truncate">
                <span className="font-medium">{track.title}</span>
                <span className="mx-1.5">-</span>
                <span>{track.artist}</span>
              </p>
            </div>
            
            {/* 功能按钮 */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleFetchFromNetwork}
                disabled={isLoading}
                className="p-2 liquid-glass liquid-glass-interactive rounded-lg transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110 border border-transparent hover:border-blue-200 dark:hover:border-blue-800 group"
                title="从网络获取"
              >
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                </svg>
              </button>
              <button
                onClick={handleImportFile}
                disabled={isLoading}
                className="p-2 liquid-glass liquid-glass-interactive rounded-lg transition-all duration-200 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110 border border-transparent hover:border-green-200 dark:hover:border-green-800 group"
                title="导入文件"
              >
                <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                </svg>
              </button>
              <button
                onClick={handlePreview}
                className="p-2 liquid-glass liquid-glass-interactive rounded-lg transition-all duration-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:scale-110 border border-transparent hover:border-purple-200 dark:hover:border-purple-800 group"
                title="预览"
              >
                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              </button>
              <div className="w-px h-5 bg-slate-300 dark:bg-gray-600 mx-1"></div>
              <button
                onClick={onClose}
                className="p-2 liquid-glass liquid-glass-interactive rounded-lg transition-all duration-200 hover:bg-white/30 dark:hover:bg-white/10 hover:rotate-90 group"
                title="关闭"
              >
                <svg className="w-4 h-4 text-slate-600 dark:text-gray-300 group-hover:text-slate-800 dark:group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 主要内容区域 */}
        <div className="flex-1 liquid-glass-content p-5 overflow-auto min-h-0">
          <textarea
            value={lyricsContent}
            onChange={(e) => setLyricsContent(e.target.value)}
            placeholder={`请输入歌词，支持LRC格式：

[00:12.34]这是第一行歌词
[00:15.67]这是第二行歌词

或者纯文本格式：

这是第一行歌词
这是第二行歌词`}
            className="w-full h-full min-h-[500px] p-4 liquid-glass liquid-glass-interactive rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent backdrop-blur-sm text-slate-700 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-500 shadow-inner"
            style={{ height: 'calc(85vh - 200px)' }}
          />
        </div>

        {/* 底部信息栏和按钮 */}
        <div className="liquid-glass-content px-5 py-2.5 border-t border-white/20 bg-gradient-to-r from-white/20 to-white/10">
          <div className="flex items-center justify-between gap-4 mb-2">
            <p className="text-xs text-slate-500 dark:text-gray-500 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
              </svg>
              <span>支持 <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">LRC</span> 格式或纯文本</span>
            </p>
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                </svg>
                <span>{error}</span>
              </p>
            )}
          </div>
          
          <div className="flex justify-between items-center gap-3">
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="group px-3.5 py-1.5 text-red-600 dark:text-red-400 liquid-glass liquid-glass-interactive hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 text-xs font-medium hover:scale-105 border border-transparent hover:border-red-200 dark:hover:border-red-800"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              <span>删除</span>
            </button>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-1.5 text-slate-600 dark:text-gray-300 liquid-glass liquid-glass-interactive hover:bg-white/40 dark:hover:bg-white/10 rounded-lg transition-all duration-200 disabled:opacity-50 text-xs font-medium hover:scale-105"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !lyricsContent.trim()}
                className="px-5 py-1.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-lg shadow-blue-500/30 hover:shadow-blue-600/40 hover:transform hover:scale-105 text-xs font-medium"
              >
                {isSaving && (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                </svg>
                <span>{isSaving ? '保存中' : '保存'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* 网络搜索对话框 */}
      {showSearchDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="liquid-glass liquid-glass-advanced liquid-glass-depth w-full max-w-lg rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
            {/* 标题栏 */}
            <div className="liquid-glass-content px-5 py-4 border-b border-white/20 bg-gradient-to-r from-blue-50/30 to-cyan-50/30 dark:from-blue-900/20 dark:to-cyan-900/20">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  🔍 搜索网络歌词
                </h3>
                <button
                  onClick={() => setShowSearchDialog(false)}
                  className="p-2 liquid-glass liquid-glass-interactive rounded-lg transition-all duration-200 hover:bg-white/30 dark:hover:bg-white/10"
                >
                  <svg className="w-4 h-4 text-slate-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* 搜索表单 */}
            <div className="liquid-glass-content p-5 space-y-4">
              <p className="text-xs text-slate-600 dark:text-gray-400 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                </svg>
                <span>系统已自动识别歌曲信息，可以修改后搜索</span>
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  歌曲名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={searchTitle}
                  onChange={(e) => setSearchTitle(e.target.value)}
                  className="w-full px-3 py-2 liquid-glass liquid-glass-interactive rounded-lg text-sm focus:ring-2 focus:ring-blue-400/50 focus:border-transparent backdrop-blur-sm text-slate-700 dark:text-gray-200"
                  placeholder="请输入歌曲名"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  艺术家 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={searchArtist}
                  onChange={(e) => setSearchArtist(e.target.value)}
                  className="w-full px-3 py-2 liquid-glass liquid-glass-interactive rounded-lg text-sm focus:ring-2 focus:ring-blue-400/50 focus:border-transparent backdrop-blur-sm text-slate-700 dark:text-gray-200"
                  placeholder="请输入艺术家"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  专辑 (可选)
                </label>
                <input
                  type="text"
                  value={searchAlbum}
                  onChange={(e) => setSearchAlbum(e.target.value)}
                  className="w-full px-3 py-2 liquid-glass liquid-glass-interactive rounded-lg text-sm focus:ring-2 focus:ring-blue-400/50 focus:border-transparent backdrop-blur-sm text-slate-700 dark:text-gray-200"
                  placeholder="请输入专辑名（选填）"
                />
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="liquid-glass-content px-5 py-3 border-t border-white/20 bg-gradient-to-r from-white/20 to-white/10">
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowSearchDialog(false)}
                  className="px-4 py-1.5 text-slate-600 dark:text-gray-300 liquid-glass liquid-glass-interactive hover:bg-white/40 dark:hover:bg-white/10 rounded-lg transition-all duration-200 text-xs font-medium hover:scale-105"
                >
                  取消
                </button>
                <button
                  onClick={handleExecuteSearch}
                  disabled={!searchTitle || !searchArtist}
                  className="px-5 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-lg shadow-blue-500/30 hover:shadow-blue-600/40 hover:transform hover:scale-105 text-xs font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <span>开始搜索</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 确认导入弹窗 */}
      {showFetchResult && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="liquid-glass liquid-glass-advanced liquid-glass-depth w-full max-w-3xl max-h-[80vh] flex flex-col rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
            {/* 标题栏 */}
            <div className="liquid-glass-content px-6 py-4 border-b border-white/20 bg-gradient-to-r from-green-50/30 to-blue-50/30 dark:from-green-900/20 dark:to-blue-900/20">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>正在获取歌词...</span>
                    </>
                  ) : fetchedLyrics ? (
                    <>
                      <span className="text-2xl">✅</span>
                      <span>歌词获取成功</span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl">❌</span>
                      <span>获取失败</span>
                    </>
                  )}
                </h3>
                <button
                  onClick={handleCancelImport}
                  disabled={isLoading}
                  className="p-2 liquid-glass liquid-glass-interactive rounded-lg transition-all duration-200 hover:bg-white/30 dark:hover:bg-white/10 disabled:opacity-50"
                >
                  <svg className="w-5 h-5 text-slate-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* 歌曲信息 */}
            <div className="liquid-glass-content px-6 py-3 border-b border-white/10 bg-gradient-to-r from-white/20 to-transparent">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-400">
                <span className="font-medium text-slate-700 dark:text-gray-300">{track.title}</span>
                <span>-</span>
                <span>{track.artist}</span>
              </div>
            </div>

            {/* 歌词内容预览 */}
            <div className="flex-1 liquid-glass-content p-6 overflow-y-auto min-h-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-slate-600 dark:text-gray-400">正在搜索歌词...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-4 max-w-md">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto">
                      <span className="text-4xl">😔</span>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-800 dark:text-white mb-2">获取失败</p>
                      <p className="text-sm text-slate-600 dark:text-gray-400">{error}</p>
                    </div>
                  </div>
                </div>
              ) : fetchedLyrics ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-slate-800 dark:text-white">歌词内容预览</h4>
                    <span className="text-xs px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full font-medium">
                      {fetchedLyrics.split('\n').filter(line => line.trim()).length} 行
                    </span>
                  </div>
                  <div className="liquid-glass liquid-glass-interactive rounded-xl p-4 max-h-96 overflow-y-auto">
                    <pre className="font-mono text-xs text-slate-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {fetchedLyrics}
                    </pre>
                  </div>
                  <div className="bg-blue-50/50 dark:bg-blue-900/20 rounded-xl p-4 flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                    </svg>
                    <div className="flex-1 text-sm text-slate-600 dark:text-gray-400">
                      <p className="font-medium text-slate-700 dark:text-gray-300 mb-1">确认导入吗？</p>
                      <p>导入后将替换当前编辑区的内容（如果有的话）</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* 底部按钮 */}
            <div className="liquid-glass-content px-6 py-4 border-t border-white/20 bg-gradient-to-r from-white/20 to-white/10">
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCancelImport}
                  disabled={isLoading}
                  className="px-5 py-2.5 text-slate-600 dark:text-gray-300 liquid-glass liquid-glass-interactive hover:bg-white/40 dark:hover:bg-white/10 rounded-xl transition-all duration-200 disabled:opacity-50 font-medium"
                >
                  取消
                </button>
                {fetchedLyrics && (
                  <button
                    onClick={handleConfirmImport}
                    disabled={isLoading}
                    className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-green-500/30 hover:shadow-green-600/40 hover:transform hover:scale-105 font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                    </svg>
                    <span>确认导入</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 预览弹窗 */}
      {showPreview && parsedLyrics && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="liquid-glass liquid-glass-advanced liquid-glass-depth w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
            {/* 标题栏 */}
            <div className="liquid-glass-content px-6 py-4 border-b border-white/20 bg-gradient-to-r from-purple-50/30 to-pink-50/30 dark:from-purple-900/20 dark:to-pink-900/20">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <span className="text-2xl">👁️</span>
                  <span>歌词预览</span>
                  <span className="text-xs px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full font-medium">
                    共 {parsedLyrics.lines.length} 行
                  </span>
                </h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 liquid-glass liquid-glass-interactive rounded-lg transition-all duration-200 hover:bg-white/30 dark:hover:bg-white/10"
                >
                  <svg className="w-5 h-5 text-slate-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* 歌曲信息 */}
            <div className="liquid-glass-content px-6 py-3 border-b border-white/10 bg-gradient-to-r from-white/20 to-transparent">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-400">
                <span className="font-medium text-slate-700 dark:text-gray-300">{track.title}</span>
                <span>-</span>
                <span>{track.artist}</span>
              </div>
            </div>

            {/* 歌词内容 */}
            <div className="flex-1 liquid-glass-content p-6 overflow-y-auto min-h-0">
              <div className="space-y-4">
                {/* 元数据 */}
                {parsedLyrics.metadata && Object.keys(parsedLyrics.metadata).length > 0 && (
                  <div className="liquid-glass liquid-glass-interactive rounded-xl p-4 border border-white/20">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-gray-300 mb-3">歌词信息</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(parsedLyrics.metadata).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2">
                          <span className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase w-12 flex-shrink-0">{key}:</span>
                          <span className="text-sm text-slate-700 dark:text-gray-300 flex-1">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 歌词行 */}
                <div className="space-y-2">
                  {parsedLyrics.lines.map((line, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 liquid-glass liquid-glass-interactive rounded-lg hover:bg-purple-50/30 dark:hover:bg-purple-900/10 transition-colors group"
                    >
                      <span className="text-xs text-slate-400 dark:text-gray-500 font-mono w-14 flex-shrink-0 pt-1 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors">
                        {formatTime(line.timestamp_ms)}
                      </span>
                      <span className="text-sm text-slate-700 dark:text-gray-300 flex-1 leading-relaxed">
                        {line.text || '♪ 音乐间奏 ♪'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="liquid-glass-content px-6 py-4 border-t border-white/20 bg-gradient-to-r from-white/20 to-white/10">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg shadow-purple-500/30 hover:shadow-purple-600/40 hover:transform hover:scale-105 font-medium"
                >
                  <span>关闭</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
