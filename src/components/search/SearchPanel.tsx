/**
 * SearchPanel - 搜索面板组件
 *
 * 全屏搜索面板，支持文本搜索和高级过滤器
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Icon } from '@/components/common/Icon';
import { usePhotoStore } from '@/stores/photoStore';
import { getAllTags } from '@/services/api';
import type { Tag, SearchFilters } from '@/types';

interface SearchPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SearchPanel({ open, onClose }: SearchPanelProps) {
  const setSearchFilters = usePhotoStore(state => state.setSearchFilters);
  const clearSearchFilters = usePhotoStore(state => state.clearSearchFilters);

  // 本地过滤器状态
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // 标签列表
  const [tags, setTags] = useState<Tag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // 加载标签
  useEffect(() => {
    if (open && tags.length === 0) {
      setLoadingTags(true);
      getAllTags()
        .then(setTags)
        .catch(console.error)
        .finally(() => setLoadingTags(false));
    }
  }, [open, tags.length]);

  // 键盘事件
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // 执行搜索
  const handleSearch = useCallback(() => {
    const filters: SearchFilters = {};

    if (query.trim()) filters.query = query.trim();
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (selectedTagIds.length > 0) {
      filters.tagIds = selectedTagIds;
      filters.tagNames = tags.filter(t => selectedTagIds.includes(t.tagId)).map(t => t.tagName);
    }
    if (minRating > 0) filters.minRating = minRating;
    if (favoritesOnly) filters.favoritesOnly = true;

    setSearchFilters(filters);
    onClose();
  }, [query, dateFrom, dateTo, selectedTagIds, tags, minRating, favoritesOnly, setSearchFilters, onClose]);

  // 清除过滤器
  const handleClear = useCallback(() => {
    setQuery('');
    setDateFrom('');
    setDateTo('');
    setSelectedTagIds([]);
    setMinRating(0);
    setFavoritesOnly(false);
    clearSearchFilters();
  }, [clearSearchFilters]);

  // 切换标签选择
  const toggleTag = useCallback((tagId: number) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  }, []);

  // 检查是否有活动过滤器
  const hasFilters = query || dateFrom || dateTo || selectedTagIds.length > 0 || minRating > 0 || favoritesOnly;

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-20">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 搜索面板 */}
      <div className="relative w-full max-w-2xl bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
        {/* 搜索输入框 */}
        <div className="flex items-center px-6 py-4 border-b border-border">
          <Icon name="search" className="text-2xl text-tertiary mr-4" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索照片..."
            className="flex-1 bg-transparent text-xl text-primary placeholder:text-tertiary outline-none"
            autoFocus
          />
          <button
            onClick={onClose}
            className="p-2 text-secondary hover:text-primary hover:bg-element rounded-lg transition-colors"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        {/* 过滤器区域 */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* 标签过滤 */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-3">标签</label>
            <div className="flex flex-wrap gap-2">
              {loadingTags ? (
                <span className="text-sm text-tertiary">加载中...</span>
              ) : tags.length === 0 ? (
                <span className="text-sm text-tertiary">暂无标签</span>
              ) : (
                tags.map(tag => (
                  <button
                    key={tag.tagId}
                    onClick={() => toggleTag(tag.tagId)}
                    className={clsx(
                      'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                      selectedTagIds.includes(tag.tagId)
                        ? 'text-white shadow-md'
                        : 'bg-element text-secondary hover:bg-hover'
                    )}
                    style={selectedTagIds.includes(tag.tagId) ? { backgroundColor: tag.color || '#6366F1' } : undefined}
                  >
                    {tag.tagName}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* 日期范围 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">开始日期</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 bg-element border border-border rounded-lg text-primary text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">结束日期</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 bg-element border border-border rounded-lg text-primary text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* 评分过滤 */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-3">最低评分</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setMinRating(minRating === star ? 0 : star)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Icon
                    name="star"
                    className={clsx(
                      'text-2xl',
                      star <= minRating ? 'text-yellow-400' : 'text-tertiary/30 hover:text-yellow-300'
                    )}
                    filled={star <= minRating}
                  />
                </button>
              ))}
              {minRating > 0 && (
                <span className="ml-2 text-sm text-secondary">{minRating} 星及以上</span>
              )}
            </div>
          </div>

          {/* 仅收藏 */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-secondary">仅显示收藏</label>
            <button
              onClick={() => setFavoritesOnly(!favoritesOnly)}
              className={clsx(
                'relative w-12 h-6 rounded-full transition-colors',
                favoritesOnly ? 'bg-primary' : 'bg-element border border-border'
              )}
            >
              <span
                className={clsx(
                  'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  favoritesOnly && 'translate-x-6'
                )}
              />
            </button>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-element/50">
          <button
            onClick={handleClear}
            disabled={!hasFilters}
            className="px-4 py-2 text-sm font-medium text-secondary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            清除过滤器
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-tertiary">Ctrl+Enter 搜索</span>
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20"
            >
              搜索
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
