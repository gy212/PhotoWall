/**
 * BatchTagSelector - 批量标签选择器组件
 *
 * 用于批量为多张照片添加/移除标签
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Tag } from '@/types';
import { getAllTags, addTagToPhotos, removeTagFromPhotos, createTag } from '@/services/api';
import { Icon } from '@/components/common/Icon';

interface BatchTagSelectorProps {
  /** 选中的照片ID列表 */
  selectedPhotoIds: number[];
  /** 操作完成回调 */
  onComplete?: () => void;
  /** 关闭回调 */
  onClose: () => void;
}

const TAG_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899',
];

export function BatchTagSelector({ selectedPhotoIds, onComplete, onClose }: BatchTagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 加载所有标签
  useEffect(() => {
    getAllTags()
      .then(setTags)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // 添加标签到所有选中照片
  const handleAddTag = useCallback(async (tag: Tag) => {
    if (operating || selectedPhotoIds.length === 0) return;
    setOperating(true);
    try {
      await addTagToPhotos(selectedPhotoIds, tag.tagId);
      onComplete?.();
    } catch (err) {
      console.error('批量添加标签失败:', err);
    } finally {
      setOperating(false);
    }
  }, [selectedPhotoIds, onComplete, operating]);

  // 从所有选中照片移除标签
  const handleRemoveTag = useCallback(async (tag: Tag) => {
    if (operating || selectedPhotoIds.length === 0) return;
    setOperating(true);
    try {
      await removeTagFromPhotos(selectedPhotoIds, tag.tagId);
      onComplete?.();
    } catch (err) {
      console.error('批量移除标签失败:', err);
    } finally {
      setOperating(false);
    }
  }, [selectedPhotoIds, onComplete, operating]);

  // 创建新标签并添加
  const handleCreateAndAdd = useCallback(async () => {
    const name = searchQuery.trim();
    if (!name || operating) return;
    setOperating(true);
    try {
      const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
      const tagId = await createTag(name, color);
      await addTagToPhotos(selectedPhotoIds, tagId);
      setSearchQuery('');
      // 刷新标签列表
      const updatedTags = await getAllTags();
      setTags(updatedTags);
      onComplete?.();
    } catch (err) {
      console.error('创建标签失败:', err);
    } finally {
      setOperating(false);
    }
  }, [searchQuery, selectedPhotoIds, onComplete, operating]);

  // 过滤标签
  const filteredTags = tags.filter(tag =>
    tag.tagName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canCreate = searchQuery.trim() &&
    !tags.some(t => t.tagName.toLowerCase() === searchQuery.toLowerCase());

  return createPortal(
    <>
      {/* 遮罩层 */}
      <div className="fixed inset-0 z-[100]" onClick={onClose} />

      {/* 弹出面板 */}
      <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[101] w-80 bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-medium text-primary">批量添加标签</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-element transition-colors"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        {/* 搜索框 */}
        <div className="p-3 border-b border-border">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索或创建标签..."
            className="w-full px-3 py-2 text-sm bg-element border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-primary placeholder:text-tertiary"
            autoFocus
          />
        </div>

        {/* 标签列表 */}
        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-6 text-center text-secondary text-sm">
              加载中...
            </div>
          ) : filteredTags.length > 0 ? (
            <div className="p-2">
              {filteredTags.map(tag => (
                <div
                  key={tag.tagId}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-element transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color || '#6366F1' }}
                    />
                    <span className="text-sm text-primary truncate">{tag.tagName}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleAddTag(tag)}
                      disabled={operating}
                      className="p-1.5 rounded-lg text-green-500 hover:bg-green-500/10 transition-colors disabled:opacity-50"
                      title="添加到选中照片"
                    >
                      <Icon name="add" className="text-base" />
                    </button>
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      disabled={operating}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      title="从选中照片移除"
                    >
                      <Icon name="remove" className="text-base" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : canCreate ? (
            <button
              onClick={handleCreateAndAdd}
              disabled={operating}
              className={clsx(
                "w-full px-4 py-4 text-left text-sm hover:bg-element flex items-center gap-2 transition-colors",
                operating && "opacity-50 cursor-not-allowed"
              )}
            >
              <Icon name="add" className="text-primary" />
              <span className="text-primary font-medium">
                创建并添加 "{searchQuery}"
              </span>
            </button>
          ) : (
            <div className="px-4 py-6 text-center text-secondary text-sm">
              {tags.length === 0 ? '暂无标签，输入名称创建' : '未找到匹配的标签'}
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="px-4 py-2 border-t border-border bg-element/50">
          <p className="text-xs text-tertiary text-center">
            将对 {selectedPhotoIds.length} 张照片执行操作
          </p>
        </div>
      </div>
    </>,
    document.body
  );
}
