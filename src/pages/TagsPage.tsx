import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TagManager } from '@/components/tag';
import { getAllTagsWithCount } from '@/services/api';
import type { TagWithCount } from '@/types';

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
    <div className="flex h-full flex-col bg-background text-primary transition-colors">
      <div className="flex items-center justify-between border-b border-border/40 bg-surface/80 px-6 py-4 backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-primary">标签</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tags.length} 个标签 · {tags.reduce((sum, t) => sum + t.photoCount, 0)} 张照片
          </p>
        </div>
        <button
          onClick={() => setManagerOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:bg-primary-hover active:scale-95"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          管理标签
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">加载中...</div>
        ) : tags.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center text-muted-foreground">
            <svg className="mb-4 h-16 w-16 text-muted-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <p className="font-medium">暂无标签</p>
            <p className="mt-1 text-sm">点击右上角按钮创建一个标签吧</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {tags.map(({ tag, photoCount }) => (
              <button
                key={tag.tagId}
                type="button"
                onClick={() => handleTagClick({ tag, photoCount })}
                className="group rounded-xl border border-border bg-surface p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-lg"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span
                    className="h-8 w-8 flex-shrink-0 rounded-full transition-transform group-hover:scale-110"
                    style={{ backgroundColor: tag.color || '#6366F1' }}
                  />
                  <h3 className="truncate font-semibold text-primary group-hover:text-primary">
                    {tag.tagName}
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{photoCount} 张照片</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <TagManager open={managerOpen} onClose={() => setManagerOpen(false)} onTagsChange={loadTags} />
    </div>
  );
}

export default TagsPage;
