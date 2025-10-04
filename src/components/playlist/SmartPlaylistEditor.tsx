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
import { Plus, Trash2, Save, X } from 'lucide-react';

interface SmartPlaylistEditorProps {
  playlistId?: number; // 如果提供，则为编辑模式
  initialRules?: SmartRules;
  onSave?: (rules: SmartRules) => void;
  onCancel?: () => void;
  onClose?: () => void; // 添加以支持 PlaylistsPage.tsx 的使用
  onSuccess?: () => void; // 添加以支持 PlaylistsPage.tsx 的使用
}

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
}) => {
  const { updateSmartPlaylistRules, loading } = usePlaylist();

  // 规则状态
  const [rules, setRules] = useState<SmartRule[]>([]);
  const [matchAll, setMatchAll] = useState(true);
  const [limit, setLimit] = useState<number | undefined>(undefined);

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

  // 保存
  const handleSave = async () => {
    const smartRules: SmartRules = {
      rules,
      match_all: matchAll,
      limit,
    };

    if (playlistId) {
      try {
        await updateSmartPlaylistRules(playlistId, smartRules);
        onSave?.(smartRules);
        onSuccess?.(); // 调用成功回调
      } catch (err) {
        console.error('保存智能规则失败:', err);
      }
    } else {
      onSave?.(smartRules);
      onSuccess?.(); // 调用成功回调
    }
  };
  
  // 处理取消/关闭
  const handleClose = () => {
    onCancel?.();
    onClose?.();
  };

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-gray-700">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">智能规则</h3>
          <p className="text-sm text-gray-400 mt-1">
            设置规则自动筛选符合条件的曲目
          </p>
        </div>
      </div>

      {/* 匹配模式 */}
      <div className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700/50">
        <span className="text-gray-300">匹配模式:</span>
        <div className="flex gap-2">
          <button
            onClick={() => setMatchAll(true)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              matchAll
                ? 'bg-purple-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            所有规则 (AND)
          </button>
          <button
            onClick={() => setMatchAll(false)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              !matchAll
                ? 'bg-purple-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            任一规则 (OR)
          </button>
        </div>
      </div>

      {/* 规则列表 */}
      <div className="space-y-3">
        {rules.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>还没有设置规则</p>
            <p className="text-sm mt-1">点击下方按钮添加第一条规则</p>
          </div>
        ) : (
          rules.map((rule, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg 
                border border-gray-700/50 hover:border-gray-600/50 transition-colors"
            >
              {/* 字段选择 */}
              <select
                value={rule.field}
                onChange={(e) =>
                  handleUpdateRule(index, { field: e.target.value as RuleField })
                }
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg 
                  text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
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
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg 
                  text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
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
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg 
                    text-white text-sm placeholder-gray-500
                    focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              )}

              {/* 删除按钮 */}
              <button
                onClick={() => handleDeleteRule(index)}
                className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-400 hover:text-red-300"
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
        className="w-full py-3 border-2 border-dashed border-gray-600 hover:border-gray-500 
          rounded-lg text-gray-400 hover:text-gray-300 font-medium
          transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        添加规则
      </button>

      {/* 限制曲目数 */}
      <div className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700/50">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={limit !== undefined}
            onChange={(e) => setLimit(e.target.checked ? 50 : undefined)}
            className="w-4 h-4 text-purple-500 bg-gray-800 border-gray-600 rounded 
              focus:ring-purple-500/50 focus:ring-2"
          />
          <span className="text-gray-300">限制曲目数:</span>
        </label>
        {limit !== undefined && (
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value) || undefined)}
            min="1"
            max="1000"
            className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg 
              text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3 pt-4 border-t border-gray-700/50">
        {(onCancel || onClose) && (
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 
              text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            disabled={loading}
          >
            <X className="w-4 h-4" />
            取消
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={loading || rules.length === 0}
          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 
            hover:from-purple-600 hover:to-pink-600
            disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed
            text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl
            flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          {loading ? '保存中...' : '保存规则'}
        </button>
      </div>

      {/* 提示信息 */}
      {rules.length === 0 && (
        <p className="text-sm text-gray-500 text-center">
          至少需要一条规则才能保存
        </p>
      )}
    </div>
  );
};

