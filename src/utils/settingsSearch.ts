/**
 * 设置搜索索引和搜索逻辑
 */

export interface SettingItem {
  id: string;                    // 唯一标识
  tab: 'library' | 'appearance' | 'animation' | 'playback' | 'webdav' | 'about';
  sectionId?: string;            // 设置区块ID
  title: string;                 // 标题
  description: string;           // 描述
  keywords: string[];            // 搜索关键词
}

// 所有设置项的索引
export const SETTINGS_INDEX: SettingItem[] = [
  // 音乐库设置
  {
    id: 'library-folders',
    tab: 'library',
    sectionId: 'music-folders',
    title: '音乐文件夹管理',
    description: '添加和管理音乐库文件夹',
    keywords: ['音乐', '文件夹', '路径', '导入', 'music', 'folder', 'library']
  },
  {
    id: 'library-scan',
    tab: 'library',
    sectionId: 'scan-settings',
    title: '扫描设置',
    description: '配置音乐库扫描选项',
    keywords: ['扫描', '自动扫描', '检测', 'scan', '文件类型']
  },
  {
    id: 'library-metadata',
    tab: 'library',
    sectionId: 'metadata',
    title: '元数据管理',
    description: '管理音乐文件的标签和元数据',
    keywords: ['元数据', '标签', '封面', '专辑', 'metadata', 'tag', 'album']
  },

  // 外观设置
  {
    id: 'appearance-theme',
    tab: 'appearance',
    sectionId: 'theme-settings',
    title: '界面主题',
    description: '选择你喜欢的界面外观',
    keywords: ['主题', '外观', '深色', '浅色', 'theme', 'dark', 'light', '颜色', '配色']
  },
  {
    id: 'appearance-contrast',
    tab: 'appearance',
    sectionId: 'accessibility',
    title: '高对比度模式',
    description: '提升文字和界面元素的对比度',
    keywords: ['对比度', '可访问性', '可读性', 'contrast', 'accessibility', '视觉']
  },

  // 动画设置
  {
    id: 'animation-lyrics-scroll',
    tab: 'animation',
    sectionId: 'lyrics-animation',
    title: '歌词滚动动画',
    description: '自定义歌词切换时的滚动效果',
    keywords: ['歌词', '动画', '滚动', '沉浸式', 'lyrics', 'animation', '效果', '弹性', '平滑', '快速', '缓慢', 'Q弹', '弹性动画']
  },
  {
    id: 'animation-lyrics-bouncy',
    tab: 'animation',
    sectionId: 'lyrics-animation',
    title: '弹性动画效果',
    description: '弹性、Q弹、回弹效果',
    keywords: ['弹性', 'Q弹', '回弹', '弹跳', 'bouncy', 'elastic', '歌词动画']
  },
  {
    id: 'animation-lyrics-smooth',
    tab: 'animation',
    sectionId: 'lyrics-animation',
    title: '平滑动画效果',
    description: '流畅过渡、无突变、自然流动',
    keywords: ['平滑', '流畅', '优雅', 'smooth', '自然', '歌词动画']
  },

  // 播放设置
  {
    id: 'playback-audio-device',
    tab: 'playback',
    sectionId: 'audio-device',
    title: '音频设备管理',
    description: '诊断和管理音频设备',
    keywords: ['音频', '设备', '声音', 'audio', 'device', '播放', '音量', '故障', '诊断', '重置']
  },
  {
    id: 'playback-quality',
    tab: 'playback',
    sectionId: 'audio-enhancement',
    title: '音质增强',
    description: '均衡器和音效设置',
    keywords: ['音质', '均衡器', '音效', 'equalizer', 'quality', '增强', 'EQ']
  },
  {
    id: 'playback-behavior',
    tab: 'playback',
    sectionId: 'playback-behavior',
    title: '播放行为',
    description: '自动播放和淡入淡出',
    keywords: ['播放', '自动播放', '淡入淡出', 'autoplay', 'crossfade', '行为']
  },

  // WebDAV设置
  {
    id: 'webdav-remote-music',
    tab: 'webdav',
    sectionId: 'webdav-settings',
    title: '远程音乐源',
    description: 'WebDAV远程音乐库配置',
    keywords: ['WebDAV', '远程', '云端', '网络', 'remote', 'cloud', '音乐源']
  },

  // 关于
  {
    id: 'about-app',
    tab: 'about',
    sectionId: 'about-info',
    title: '关于应用',
    description: '应用版本和信息',
    keywords: ['关于', '版本', '更新', 'about', 'version', '信息']
  },
];

/**
 * 模糊搜索设置项
 */
export function searchSettings(query: string): SettingItem[] {
  if (!query.trim()) {
    return [];
  }

  const lowerQuery = query.toLowerCase().trim();
  const words = lowerQuery.split(/\s+/); // 支持多词搜索

  return SETTINGS_INDEX.filter(item => {
    // 检查标题匹配
    const titleMatch = item.title.toLowerCase().includes(lowerQuery);
    
    // 检查描述匹配
    const descMatch = item.description.toLowerCase().includes(lowerQuery);
    
    // 检查关键词匹配
    const keywordMatch = item.keywords.some(keyword => 
      keyword.toLowerCase().includes(lowerQuery)
    );

    // 多词匹配：所有词都要在某个字段中找到
    const multiWordMatch = words.every(word => {
      return item.title.toLowerCase().includes(word) ||
             item.description.toLowerCase().includes(word) ||
             item.keywords.some(k => k.toLowerCase().includes(word));
    });

    return titleMatch || descMatch || keywordMatch || multiWordMatch;
  }).sort((a, b) => {
    // 优先级排序：标题完全匹配 > 标题包含 > 关键词匹配 > 描述匹配
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();
    
    if (aTitle === lowerQuery) return -1;
    if (bTitle === lowerQuery) return 1;
    
    if (aTitle.includes(lowerQuery) && !bTitle.includes(lowerQuery)) return -1;
    if (bTitle.includes(lowerQuery) && !aTitle.includes(lowerQuery)) return 1;
    
    return 0;
  });
}

/**
 * 获取设置项的面包屑路径
 */
export function getSettingBreadcrumb(item: SettingItem): string {
  const tabNames = {
    library: '音乐库',
    appearance: '外观',
    animation: '动画',
    playback: '播放',
    webdav: '远程音乐源',
    about: '关于'
  };
  
  return `${tabNames[item.tab]} / ${item.title}`;
}

