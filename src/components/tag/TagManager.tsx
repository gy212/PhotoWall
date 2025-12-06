/**
 * TagManager - 标签管理对话框
 *
 * 用于管理所有标签的CRUD操作
 */

import { useState, useEffect, useCallback } from 'react';
import { Tag, TagWithCount } from '@/types';
import { getAllTagsWithCount, createTag, updateTag, deleteTag } from '@/services/api';
import clsx from 'clsx';

interface TagManagerProps {
  open: boolean;
  onClose: () => void;
  onTagsChange?: () => void;
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

export function TagManager({ open, onClose, onTagsChange }: TagManagerProps) {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  // 加载标签
  const loadTags = useCallback(async () => {
    try {
      setLoading(true);
      const tagList = await getAllTagsWithCount();
      setTags(tagList);
      onTagsChange?.();
    } catch (err) {
      console.error('Failed to load tags:', err);
    } finally {
      setLoading(false);
    }
  }, [onTagsChange]);

  useEffect(() => {
    if (open) {
      loadTags();
    }
  }, [open, loadTags]);

  // 创建标签
  const handleCreate = useCallback(async () => {
    const name = newTagName.trim();
    if (!name) return;

    try {
      await createTag(name, newTagColor);
      setNewTagName('');
      setNewTagColor(TAG_COLORS[0]);
      await loadTags();
    } catch (err) {
      console.error('Failed to create tag:', err);
      alert('创建标签失败');
    }
  }, [newTagName, newTagColor, loadTags]);

  // 开始编辑
  const handleStartEdit = useCallback((tag: Tag) => {
    setEditingTag(tag);
    setEditName(tag.tagName);
    setEditColor(tag.color || TAG_COLORS[0]);
  }, []);

  // 保存编辑
  const handleSaveEdit = useCallback(async () => {
    if (!editingTag) return;

    const name = editName.trim();
    if (!name) return;

    try {
      await updateTag(editingTag.tagId, name, editColor);
      setEditingTag(null);
      await loadTags();
    } catch (err) {
      console.error('Failed to update tag:', err);
      alert('更新标签失败');
    }
  }, [editingTag, editName, editColor, loadTags]);

  // 删除标签
  const handleDelete = useCallback(async (tag: Tag) => {
    if (!confirm(`确定要删除标签 "${tag.tagName}" 吗?`)) return;

    try {
      await deleteTag(tag.tagId);
      await loadTags();
    } catch (err) {
      console.error('Failed to delete tag:', err);
      alert('删除标签失败');
    }
  }, [loadTags]);

  if (!open) return null;

  return (
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 对话框 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-xl font-bold text-gray-900">标签管理</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 创建新标签 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">创建新标签</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="标签名称"
                  className="flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
                <select
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  style={{ backgroundColor: newTagColor, color: 'white' }}
                >
                  {TAG_COLORS.map(color => (
                    <option key={color} value={color} style={{ backgroundColor: color }}>
                      {color}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleCreate}
                  disabled={!newTagName.trim()}
                  className={clsx(
                    "px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary transition-all",
                    newTagName.trim()
                      ? "hover:bg-primary-hover active:scale-95"
                      : "opacity-50 cursor-not-allowed"
                  )}
                >
                  创建
                </button>
              </div>
            </div>

            {/* 标签列表 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">
                所有标签 ({tags.length})
              </h3>
              {loading ? (
                <div className="text-center py-8 text-gray-500">加载中...</div>
              ) : tags.length === 0 ? (
                <div className="text-center py-8 text-gray-500">暂无标签</div>
              ) : (
                <div className="space-y-2">
                  {tags.map(({ tag, photoCount }) => (
                    <div
                      key={tag.tagId}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {editingTag?.tagId === tag.tagId ? (
                        // 编辑模式
                        <>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                            className="flex-1 px-3 py-1.5 text-sm border rounded focus:ring-2 focus:ring-primary"
                          />
                          <select
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            className="px-2 py-1.5 text-sm border rounded"
                            style={{ backgroundColor: editColor, color: 'white' }}
                          >
                            {TAG_COLORS.map(color => (
                              <option key={color} value={color} style={{ backgroundColor: color }}>
                                {color}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={handleSaveEdit}
                            className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="保存"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setEditingTag(null)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="取消"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        // 显示模式
                        <>
                          <span
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tag.color || '#6366F1' }}
                          />
                          <span className="flex-1 font-medium text-gray-900">{tag.tagName}</span>
                          <span className="text-sm text-gray-500">{photoCount} 张照片</span>
                          <button
                            onClick={() => handleStartEdit(tag)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="编辑"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(tag)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="删除"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
