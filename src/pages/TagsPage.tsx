import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TagManager } from '@/components/tag';
import { getAllTagsWithCount } from '@/services/api';
import type { TagWithCount } from '@/types';
import { Icon } from '@/components/common/Icon';

function TagsPage() {
  const navigate = useNavigate();
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);

  const loadTags = useCallback(async () => {
    try {
      setLoading(true);
      const tagList = await getAllTagsWithCount();
      setTags(tagList);
    } catch (err) {
      console.error('Failed to load tags:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleTagClick = useCallback(
    (tag: TagWithCount) => {
      console.log('View photos with tag:', tag);
      // navigate(`/tags/${tag.tag.tagId}`);
    },
    [navigate]
  );

  return (
    <div className="flex h-full flex-col bg-background p-6 overflow-hidden">
      <div className="flex-1 flex flex-col card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-4 sticky top-0 z-10">
          <div>
            <h1 className="text-2xl font-bold text-primary font-serif">标签</h1>
            <p className="mt-1 text-sm text-secondary">
              {tags.length} 个标签 · {tags.reduce((sum, t) => sum + t.photoCount, 0)} 张照片
            </p>
          </div>
          <button
            onClick={() => setManagerOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:bg-primary-dark active:scale-95"
          >
            <Icon name="settings" className="text-lg" />
            管理标签
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-background/50">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-tertiary">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-element border-t-primary" />
                <span className="text-sm">加载中...</span>
              </div>
            </div>
          ) : tags.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-element shadow-inner">
                <Icon name="image_search" className="text-4xl text-tertiary/50" />
              </div>
              <h3 className="text-xl font-bold text-primary font-serif mb-2">暂无标签</h3>
              <p className="text-secondary text-sm max-w-xs mx-auto">
                标签可以帮助您更好地组织照片。点击右上角按钮创建一个标签吧。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {tags.map((tagItem) => (
                <button
                  key={tagItem.tagId}
                  type="button"
                  onClick={() => handleTagClick(tagItem)}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg"
                >
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Icon name="image_search" className="text-6xl text-primary" />
                  </div>

                  <div className="relative z-10">
                    <div className="mb-4 flex items-center gap-3">
                      <span
                        className="h-10 w-10 flex-shrink-0 rounded-xl shadow-sm transition-transform group-hover:scale-110 flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: tagItem.color || '#6366F1' }}
                      >
                        {tagItem.tagName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <h3 className="truncate font-bold text-lg text-primary group-hover:text-primary-dark mb-1">
                      {tagItem.tagName}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-tertiary">
                      <Icon name="photo_library" className="text-sm" />
                      <span>{tagItem.photoCount} 张照片</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <TagManager open={managerOpen} onClose={() => setManagerOpen(false)} onTagsChange={loadTags} />
    </div>
  );
}

export default TagsPage;
