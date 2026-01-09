/**
 * TagSelector - 标签选择器组件
 *
 * 用于选择/创建标签并添加到照片
 */

import { useState, useEffect, useCallback } from 'react';
import { Tag } from '@/types';
import { getAllTags, getTagsForPhoto, addTagToPhoto, removeTagFromPhoto, createTag } from '@/services/api';
import clsx from 'clsx';

interface TagSelectorProps {
  /** 照片ID */
  photoId: number;
  /** 标签变化回调 */
  onTagsChange?: (tags: Tag[]) => void;
}

/**
 * 标签颜色预设
 */
const TAG_COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
];

export function TagSelector({ photoId, onTagsChange }: TagSelectorProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [photoTags, setPhotoTags] = useState<Tag[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // 加载所有标签和照片标签
  const loadTags = useCallback(async () => {
    try {
      setLoading(true);
      const [all, photo] = await Promise.all([
        getAllTags(),
        getTagsForPhoto(photoId),
      ]);
      setAllTags(all);
      setPhotoTags(photo);
      onTagsChange?.(photo);
    } catch (err) {
      console.error('Failed to load tags:', err);
    } finally {
      setLoading(false);
    }
  }, [photoId, onTagsChange]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // 添加标签
  const handleAddTag = useCallback(async (tag: Tag) => {
    try {
      await addTagToPhoto(photoId, tag.tagId);
      const updatedTags = [...photoTags, tag];
      setPhotoTags(updatedTags);
      onTagsChange?.(updatedTags);
    } catch (err) {
      console.error('Failed to add tag:', err);
    }
  }, [photoId, photoTags, onTagsChange]);

  // 移除标签
  const handleRemoveTag = useCallback(async (tag: Tag) => {
    try {
      await removeTagFromPhoto(photoId, tag.tagId);
      const updatedTags = photoTags.filter(t => t.tagId !== tag.tagId);
      setPhotoTags(updatedTags);
      onTagsChange?.(updatedTags);
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
  }, [photoId, photoTags, onTagsChange]);

  // 创建新标签
  const handleCreateTag = useCallback(async () => {
    const tagName = searchQuery.trim();
    if (!tagName) return;

    try {
      setCreating(true);
      // 随机选择颜色
      const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
      const tagId = await createTag(tagName, color);

      // 重新加载标签列表
      await loadTags();

      // 查找新创建的标签并添加到照片
      const newTag = allTags.find(t => t.tagId === tagId);
      if (newTag) {
        await handleAddTag(newTag);
      }

      setSearchQuery('');
      setShowDropdown(false);
    } catch (err) {
      console.error('Failed to create tag:', err);
    } finally {
      setCreating(false);
    }
  }, [searchQuery, allTags, loadTags, handleAddTag]);

  // 过滤标签
  const filteredTags = allTags.filter(tag => {
    const matchesSearch = tag.tagName.toLowerCase().includes(searchQuery.toLowerCase());
    const notSelected = !photoTags.some(t => t.tagId === tag.tagId);
    return matchesSearch && notSelected;
  });

  // 检查是否可以创建新标签
  const canCreateTag = searchQuery.trim() &&
    !allTags.some(t => t.tagName.toLowerCase() === searchQuery.toLowerCase());

  return (
    <div className="relative">
      {/* 已选标签 */}
      <div className="flex flex-wrap gap-2 mb-2">
        {photoTags.map(tag => (
          <button
            key={tag.tagId}
            onClick={() => handleRemoveTag(tag)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white transition-all hover:opacity-80 active:scale-95"
            style={{ backgroundColor: tag.color || '#6366F1' }}
            title="点击移除"
          >
            <span>{tag.tagName}</span>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ))}
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          placeholder="添加标签..."
          className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
        />

        {/* 下拉菜单 */}
        {showDropdown && (
          <>
            {/* 遮罩层 */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowDropdown(false)}
            />

            {/* 下拉列表 */}
            <div className="absolute z-20 w-full mt-1 bg-surface border border-border rounded-xl shadow-xl max-h-60 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-3 text-sm text-tertiary text-center">
                  加载中...
                </div>
              ) : filteredTags.length > 0 ? (
                filteredTags.map(tag => (
                  <button
                    key={tag.tagId}
                    onClick={() => {
                      handleAddTag(tag);
                      setSearchQuery('');
                      setShowDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-element flex items-center gap-2 transition-colors text-primary"
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color || '#6366F1' }}
                    />
                    <span>{tag.tagName}</span>
                  </button>
                ))
              ) : canCreateTag ? (
                <button
                  onClick={handleCreateTag}
                  disabled={creating}
                  className={clsx(
                    "w-full px-4 py-2 text-left text-sm hover:bg-primary/5 flex items-center gap-2 transition-colors",
                    creating && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-primary font-medium">
                    创建标签 "{searchQuery}"
                  </span>
                </button>
              ) : (
                <div className="px-4 py-3 text-sm text-tertiary text-center">
                  未找到匹配的标签
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
