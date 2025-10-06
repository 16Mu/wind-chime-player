/**
 * 智能歌单规则编辑器 - 复杂业务组件
 * 
 * 设计原则：
 * - 组件内聚：规则编辑逻辑集中管理
 * - 状态隔离：本地状态与全局状态分离
 * - 可组合：规则项组件可独立复用
 */

import React, { useState, useEffect } from 'react';
import {
  SmartRule,
  SmartRules,
  RuleField,
  RuleOperator,
  usePlaylist,
} from '../../contexts/PlaylistContext';
import { Plus, Trash2, Save, X, Calendar, Heart, Zap, Music, Flame } from 'lucide-react';

interface SmartPlaylistEditorProps {
  playlistId?: number; // 如果提供，则为编辑模式
  initialRules?: SmartRules;
  onSave?: (rules: SmartRules) => void;
  onCancel?: () => void;
  onClose?: () => void; // 添加以支持 PlaylistsPage.tsx 的使用
  onSuccess?: () => void; // 添加以支持 PlaylistsPage.tsx 的使用
  isCreateMode?: boolean; // 是否为创建模式（需要输入名称和描述）
}

// 🎯 智能歌单模板
interface PlaylistTemplate {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  rules: SmartRule[];
  matchAll: boolean;
  limit?: number;
}

const smartPlaylistTemplates: PlaylistTemplate[] = [
  {
    name: '最近添加',
    description: '最近30天添加的歌曲',
    icon: Calendar,
    rules: [
      { field: 'date_added', operator: 'within_days', value: '30' }
    ],
    matchAll: true,
    limit: 100,
  },
  {
    name: '热门歌曲',
    description: '播放次数超过10次',
    icon: Flame,
    rules: [
      { field: 'play_count', operator: 'greater_than', value: '10' }
    ],
    matchAll: true,
    limit: 50,
  },
  {
    name: '短歌精选',
    description: '时长小于4分钟',
    icon: Zap,
    rules: [
      { field: 'duration', operator: 'less_than', value: '240000' }
    ],
    matchAll: true,
    limit: 100,
  },
  {
    name: '长曲收藏',
    description: '时长大于5分钟',
    icon: Music,
    rules: [
      { field: 'duration', operator: 'greater_than', value: '300000' }
    ],
    matchAll: true,
    limit: 50,
  },
  {
    name: '常听歌曲',
    description: '最近7天播放过',
    icon: Flame,
    rules: [
      { field: 'last_played', operator: 'within_days', value: '7' }
    ],
    matchAll: true,
    limit: 100,
  },
  {
    name: '我的收藏',
    description: '已标记为收藏',
    icon: Heart,
    rules: [
      { field: 'is_favorite', operator: 'is_true', value: '' }
    ],
    matchAll: true,
  },
];

// 字段选项
const fieldOptions: { value: RuleField; label: string }[] = [
  { value: 'title', label: '标题' },
  { value: 'artist', label: '艺术家' },
  { value: 'album', label: '专辑' },
  { value: 'duration', label: '时长' },
  { value: 'date_added', label: '添加日期' },
  { value: 'last_played', label: '最后播放' },
  { value: 'play_count', label: '播放次数' },
  { value: 'is_favorite', label: '是否收藏' },
];

// 操作符选项（根据字段类型）
const getOperatorOptions = (field: RuleField): { value: RuleOperator; label: string }[] => {
  const stringOps = [
    { value: 'equals' as RuleOperator, label: '等于' },
    { value: 'not_equals' as RuleOperator, label: '不等于' },
    { value: 'contains' as RuleOperator, label: '包含' },
    { value: 'not_contains' as RuleOperator, label: '不包含' },
    { value: 'starts_with' as RuleOperator, label: '开头是' },
    { value: 'ends_with' as RuleOperator, label: '结尾是' },
  ];

  const numberOps = [
    { value: 'equals' as RuleOperator, label: '等于' },
    { value: 'not_equals' as RuleOperator, label: '不等于' },
    { value: 'greater_than' as RuleOperator, label: '大于' },
    { value: 'less_than' as RuleOperator, label: '小于' },
    { value: 'greater_or_equal' as RuleOperator, label: '大于等于' },
    { value: 'less_or_equal' as RuleOperator, label: '小于等于' },
  ];

  const dateOps = [
    { value: 'within_days' as RuleOperator, label: '最近N天内' },
    { value: 'not_within_days' as RuleOperator, label: '不在最近N天内' },
    { value: 'before' as RuleOperator, label: '早于' },
    { value: 'after' as RuleOperator, label: '晚于' },
  ];

  const boolOps = [
    { value: 'is_true' as RuleOperator, label: '是' },
    { value: 'is_false' as RuleOperator, label: '否' },
  ];

  if (field === 'title' || field === 'artist' || field === 'album') {
    return stringOps;
  } else if (field === 'duration' || field === 'play_count') {
    return numberOps;
  } else if (field === 'date_added' || field === 'last_played') {
    return dateOps;
  } else if (field === 'is_favorite') {
    return boolOps;
  }

  return stringOps;
};

export const SmartPlaylistEditor: React.FC<SmartPlaylistEditorProps> = ({
  playlistId,
  initialRules,
  onSave,
  onCancel,
  onClose,
  onSuccess,
  isCreateMode = false,
}) => {
  const { updateSmartPlaylistRules, createSmartPlaylist, loading } = usePlaylist();

  // 基本信息状态（创建模式）
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');

  // 规则状态
  const [rules, setRules] = useState<SmartRule[]>([]);
  const [matchAll, setMatchAll] = useState(true);
  const [limit, setLimit] = useState<number | undefined>(undefined);
  
  // 模板选择器状态
  const [showTemplates, setShowTemplates] = useState(isCreateMode); // 创建模式下默认显示模板

  // 初始化
  useEffect(() => {
    if (initialRules) {
      setRules(initialRules.rules);
      setMatchAll(initialRules.match_all);
      setLimit(initialRules.limit);
    }
  }, [initialRules]);

  // 添加规则
  const handleAddRule = () => {
    const newRule: SmartRule = {
      field: 'title',
      operator: 'contains',
      value: '',
    };
    setRules([...rules, newRule]);
  };

  // 更新规则
  const handleUpdateRule = (index: number, updates: Partial<SmartRule>) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], ...updates };

    // 如果字段改变，重置操作符
    if (updates.field && updates.field !== newRules[index].field) {
      const operators = getOperatorOptions(updates.field);
      newRules[index].operator = operators[0].value;
    }

    setRules(newRules);
  };

  // 删除规则
  const handleDeleteRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  // 🎯 应用模板
  const handleApplyTemplate = (template: PlaylistTemplate) => {
    if (isCreateMode && !name) {
      setName(template.name);
    }
    if (isCreateMode && !description) {
      setDescription(template.description);
    }
    setRules(template.rules);
    setMatchAll(template.matchAll);
    setLimit(template.limit);
    setShowTemplates(false);
  };

  // 保存
  const handleSave = async () => {
    // 创建模式下验证名称
    if (isCreateMode) {
      if (!name.trim()) {
        setNameError('请输入歌单名称');
        return;
      }
      if (name.length > 100) {
        setNameError('名称不能超过100个字符');
        return;
      }
    }

    const smartRules: SmartRules = {
      rules,
      match_all: matchAll,
      limit,
    };

    try {
      if (isCreateMode) {
        // 创建新的智能歌单（注意：description 暂时不支持，需要后续更新）
        await createSmartPlaylist(name, smartRules);
        onSuccess?.();
      } else if (playlistId) {
        // 更新已有歌单的规则
        await updateSmartPlaylistRules(playlistId, smartRules);
        onSave?.(smartRules);
        onSuccess?.();
      } else {
        onSave?.(smartRules);
        onSuccess?.();
      }
    } catch (err) {
      console.error('保存智能规则失败:', err);
      alert('保存失败：' + err);
    }
  };
  
  // 处理取消/关闭
  const handleClose = () => {
    onCancel?.();
    onClose?.();
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* 头部 */}
      <div className="flex-none flex items-center justify-between p-6 border-b border-slate-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          {/* 返回按钮 */}
          {(onClose || onCancel) && (
            <button
              onClick={handleClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-slate-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isCreateMode ? '创建智能歌单' : '智能规则'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
              设置规则自动筛选符合条件的曲目
            </p>
          </div>
        </div>
      </div>

      {/* 内容区域 - 可滚动 */}
      <div className="flex-1 overflow-y-auto p-6 pb-32 space-y-6">{/* pb-32 为底部播放器留出空间 */}

        {/* 🎯 智能模板选择器 */}
        {showTemplates && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white">选择模板快速创建</h4>
              <button
                onClick={() => setShowTemplates(false)}
                className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
              >
                自定义规则 →
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {smartPlaylistTemplates.map((template, index) => {
                const IconComponent = template.icon;
                return (
                  <button
                    key={index}
                    onClick={() => handleApplyTemplate(template)}
                    className="group relative p-5 bg-white dark:bg-gray-800/50 
                      border border-slate-200 dark:border-gray-700/50 
                      rounded-xl text-left transition-all duration-200 
                      hover:border-purple-400 dark:hover:border-purple-500/50
                      hover:shadow-lg hover:shadow-purple-500/10
                      active:scale-[0.98]"
                  >
                    {/* 顶部图标区域 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-gray-700/50 
                        group-hover:bg-purple-100 dark:group-hover:bg-purple-500/20
                        transition-colors">
                        <IconComponent className="w-5 h-5 text-slate-600 dark:text-gray-400 
                          group-hover:text-purple-600 dark:group-hover:text-purple-400
                          transition-colors" />
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-4 h-4 text-slate-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                    
                    {/* 文字内容 */}
                    <div>
                      <h5 className="font-semibold text-slate-900 dark:text-white mb-1.5 
                        group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                        {template.name}
                      </h5>
                      <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed mb-3">
                        {template.description}
                      </p>
                      
                      {/* 底部标签 */}
                      <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-gray-500">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-gray-700/50">
                          {template.rules.length} 条规则
                        </span>
                        {template.limit && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-gray-700/50">
                            {template.limit} 首
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            
            <div className="text-center p-4 bg-slate-50 dark:bg-gray-800/50 rounded-lg border border-slate-200 dark:border-gray-700/50">
              <p className="text-sm text-slate-600 dark:text-gray-400">
                或者点击右上角"自定义规则"手动设置条件
              </p>
            </div>
          </div>
        )}

        {/* 基本信息（仅创建模式，非模板选择状态） */}
        {isCreateMode && !showTemplates && (
          <div className="space-y-4 p-4 bg-slate-50 dark:bg-gray-900/50 rounded-lg border border-slate-200 dark:border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">基本信息</h4>
              <button
                onClick={() => setShowTemplates(true)}
                className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
                使用模板
              </button>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                歌单名称 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError('');
                }}
                placeholder="给你的智能歌单起个名字..."
                className={`w-full px-4 py-2.5 bg-white dark:bg-gray-800 border rounded-lg 
                  text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:border-transparent
                  transition-all ${
                    nameError
                      ? 'border-red-500 focus:ring-red-500/50'
                      : 'border-slate-300 dark:border-gray-700 focus:ring-purple-500/50'
                  }`}
                disabled={loading}
                maxLength={100}
                autoFocus
              />
              {nameError && (
                <p className="mt-1 text-sm text-red-500 dark:text-red-400">{nameError}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                描述（可选）
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="添加一些描述..."
                rows={2}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 rounded-lg 
                  text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent
                  transition-all resize-none"
                disabled={loading}
                maxLength={500}
              />
            </div>
          </div>
        )}

        {/* 规则配置区域（非模板选择状态时显示） */}
        {!showTemplates && (
          <>
        {/* 匹配模式 */}
        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-gray-900/50 rounded-lg border border-slate-200 dark:border-gray-700/50">
          <span className="text-slate-700 dark:text-gray-300 text-sm font-medium">匹配模式</span>
          <div className="flex gap-2 bg-slate-200 dark:bg-gray-700/50 p-1 rounded-lg">
            <button
              onClick={() => setMatchAll(true)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                matchAll
                  ? 'bg-white dark:bg-gray-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              所有规则
            </button>
            <button
              onClick={() => setMatchAll(false)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                !matchAll
                  ? 'bg-white dark:bg-gray-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              任一规则
            </button>
          </div>
        </div>

        {/* 规则列表 */}
        <div className="space-y-3">
          {rules.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-gray-500">
              <p>还没有设置规则</p>
              <p className="text-sm mt-1">点击下方按钮添加第一条规则</p>
            </div>
          ) : (
            rules.map((rule, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900/50 rounded-lg 
                  border border-slate-200 dark:border-gray-700/50 hover:border-purple-300 dark:hover:border-gray-600/50 transition-colors"
              >
                {/* 字段选择 */}
                <select
                  value={rule.field}
                  onChange={(e) =>
                    handleUpdateRule(index, { field: e.target.value as RuleField })
                  }
                  className="px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-300 dark:border-gray-700 rounded-lg 
                    text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  {fieldOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {/* 操作符选择 */}
                <select
                  value={rule.operator}
                  onChange={(e) =>
                    handleUpdateRule(index, { operator: e.target.value as RuleOperator })
                  }
                  className="px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-300 dark:border-gray-700 rounded-lg 
                    text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  {getOperatorOptions(rule.field).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {/* 值输入 */}
                {rule.field !== 'is_favorite' && (
                  <input
                    type={rule.field === 'duration' || rule.field === 'play_count' ? 'number' : 'text'}
                    value={rule.value}
                    onChange={(e) => handleUpdateRule(index, { value: e.target.value })}
                    placeholder="输入值..."
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-300 dark:border-gray-700 rounded-lg 
                      text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500
                      focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                )}

                {/* 删除按钮 */}
                <button
                  onClick={() => handleDeleteRule(index)}
                  className="p-2 hover:bg-red-100 dark:hover:bg-red-500/10 rounded-lg transition-colors text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* 添加规则按钮 */}
        <button
          onClick={handleAddRule}
          className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-gray-500 
            rounded-lg text-slate-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-gray-300 font-medium
            transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          添加规则
        </button>

        {/* 限制曲目数 */}
        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-gray-900/50 rounded-lg border border-slate-200 dark:border-gray-700/50">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={limit !== undefined}
              onChange={(e) => setLimit(e.target.checked ? 50 : undefined)}
              className="w-4 h-4 text-purple-500 bg-white dark:bg-gray-800 border-slate-300 dark:border-gray-600 rounded 
                focus:ring-purple-500/50 focus:ring-2"
            />
            <span className="text-slate-700 dark:text-gray-300">限制曲目数:</span>
          </label>
          {limit !== undefined && (
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || undefined)}
              min="1"
              max="1000"
              className="w-24 px-3 py-2 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 rounded-lg 
                text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          )}
        </div>

        {/* 提示信息 */}
        {rules.length === 0 && (
          <div className="p-4 bg-slate-50 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700/50 rounded-lg">
            <p className="text-sm text-slate-700 dark:text-gray-300 text-center mb-1">
              智能歌单会根据规则自动筛选曲目
            </p>
            <p className="text-xs text-slate-500 dark:text-gray-400 text-center">
              例如：筛选"艺术家 = 周杰伦"且"时长 &lt; 4分钟"的歌曲
            </p>
          </div>
        )}
        </>
        )}
      </div>

      {/* 底部操作按钮 - 固定在底部 */}
      <div className="flex-none p-6 border-t border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex gap-3">
          {(onCancel || onClose) && (
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 
                text-slate-700 dark:text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              disabled={loading}
            >
              <X className="w-4 h-4" />
              取消
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={loading || (rules.length === 0 && !showTemplates)}
            className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 
              disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed
              text-white rounded-lg font-medium transition-colors
              flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? '保存中...' : showTemplates ? '下一步' : '保存规则'}
          </button>
        </div>
      </div>
    </div>
  );
};

