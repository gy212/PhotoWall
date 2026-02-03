/**
 * SearchSuggestions - 搜索建议组件
 *
 * 显示基于用户输入的搜索建议
 */

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Icon } from '@/components/common/Icon';
import { getSearchSuggestions, type SearchSuggestionItem } from '@/services/api/photos';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchSuggestionsProps {
  /** 搜索输入文本 */
  query: string;
  /** 选择建议时的回调 */
  onSelect: (suggestion: string) => void;
  /** 是否显示 */
  visible: boolean;
}

/** 建议类型对应的图标 */
const SUGGESTION_ICONS: Record<string, { icon: string; color: string }> = {
  file: { icon: 'photo_library', color: 'text-blue-500' },
  camera: { icon: 'camera', color: 'text-green-500' },
  lens: { icon: 'focal_length', color: 'text-purple-500' },
  tag: { icon: 'filter_list', color: 'text-orange-500' },
};

export function SearchSuggestions({ query, onSelect, visible }: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SearchSuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // 防抖查询
  const debouncedQuery = useDebounce(query, 200);

  // 获取搜索建议
  useEffect(() => {
    if (!visible || !debouncedQuery.trim()) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    getSearchSuggestions(debouncedQuery, 8)
      .then(setSuggestions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedQuery, visible]);

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  // 键盘导航
  useEffect(() => {
    if (!visible || suggestions.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Enter':
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            e.preventDefault();
            onSelect(suggestions[selectedIndex].text);
          }
          break;
        case 'Escape':
          setSelectedIndex(-1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, suggestions, selectedIndex, onSelect]);

  if (!visible || (!loading && suggestions.length === 0)) {
    return null;
  }

  return (
    <div className="px-6 py-2 border-b border-border bg-element/30">
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-sm text-tertiary">
          <Icon name="sync" className="animate-spin" />
          <span>搜索建议中...</span>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="text-xs text-tertiary mb-2">搜索建议</div>
          {suggestions.map((suggestion, index) => {
            const iconConfig = SUGGESTION_ICONS[suggestion.suggestionType] || {
              icon: 'search',
              color: 'text-tertiary',
            };

            return (
              <button
                key={`${suggestion.suggestionType}-${suggestion.text}`}
                onClick={() => onSelect(suggestion.text)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                  index === selectedIndex
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-element text-secondary hover:text-primary'
                )}
              >
                <Icon
                  name={iconConfig.icon as 'camera' | 'focal_length' | 'filter_list' | 'photo_library' | 'search'}
                  className={clsx('text-lg', iconConfig.color)}
                />
                <span className="flex-1 truncate">{suggestion.text}</span>
                {suggestion.label && (
                  <span className="text-xs text-tertiary px-2 py-0.5 bg-element rounded">
                    {suggestion.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
