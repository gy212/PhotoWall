import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import { usePhotoStore } from '@/stores/photoStore';
import type { ViewMode, SortField } from '@/types';
import { Icon } from '@/components/common/Icon';
import clsx from 'clsx';

const viewModes: { value: ViewMode; icon: React.ReactNode; label: string }[] = [
  {
    value: 'grid',
    label: '网格',
    icon: <Icon name="grid_view" className="text-base" />,
  },
  {
    value: 'timeline',
    label: '时间轴',
    icon: <Icon name="schedule" className="text-base" />,
  },
];

// 排序字段配置
const sortFields: { value: SortField; label: string }[] = [
  { value: 'dateTaken', label: '拍摄时间' },
  { value: 'dateAdded', label: '添加时间' },
  { value: 'fileName', label: '文件名' },
  { value: 'fileSize', label: '文件大小' },
  { value: 'rating', label: '评分' },
];

function Toolbar() {
  const viewMode = usePhotoStore((state) => state.viewMode);
  const totalCount = usePhotoStore((state) => state.totalCount);
  const sortOptions = usePhotoStore((state) => state.sortOptions);
  const setViewMode = usePhotoStore((state) => state.setViewMode);
  const setSearchQuery = usePhotoStore((state) => state.setSearchQuery);
  const setSortOptions = usePhotoStore((state) => state.setSortOptions);

  const [searchQuery, setLocalSearchQuery] = useState('');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const formattedTotal = useMemo(() => new Intl.NumberFormat('zh-CN').format(totalCount), [totalCount]);

  // 点击外部关闭排序菜单
  useEffect(() => {
    if (!showSortMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSortMenu]);

  const handleSearch = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setSearchQuery(searchQuery.trim());
    },
    [searchQuery, setSearchQuery]
  );

  return (
    <>
      {/* 标题 */}
      <div className="flex items-center space-x-4">
        <h1 className="text-2xl font-bold tracking-tight text-primary font-serif">所有照片</h1>
        {/* 计数徽章 */}
        <div className="px-3 py-1 rounded-full bg-element border border-border flex items-center justify-center">
          <span className="text-xs font-bold text-secondary">{formattedTotal}</span>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center space-x-4">
        {/* 搜索框 */}
        <form onSubmit={handleSearch}>
          <div className="flex items-center px-4 py-2 w-64 bg-element border border-border rounded-xl focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
            <Icon name="search" className="text-tertiary mr-2 text-lg" />
            <input
              type="text"
              placeholder="搜索..."
              className="bg-transparent border-none outline-none text-sm w-full placeholder-tertiary text-primary font-medium"
              value={searchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
            />
          </div>
        </form>

        {/* 按钮组 */}
        <div className="flex space-x-3">
          {/* 视图切换 */}
          <div className="flex bg-element p-1 rounded-xl border border-border items-center">
            {viewModes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setViewMode(mode.value)}
                className={clsx(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                  viewMode === mode.value
                    ? "bg-surface text-primary shadow-sm"
                    : "text-tertiary hover:text-secondary hover:bg-hover"
                )}
                title={mode.label}
              >
                {mode.icon}
              </button>
            ))}
          </div>

          {/* 排序按钮 */}
          <div className="relative" ref={sortMenuRef}>
            <button 
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={clsx(
                "w-10 h-10 flex items-center justify-center rounded-xl border transition-colors",
                showSortMenu 
                  ? "bg-primary text-white border-primary" 
                  : "bg-element text-secondary border-border hover:bg-hover hover:text-primary"
              )}
              title="排序"
            >
              <Icon name="expand_more" className="text-xl" />
            </button>

            {/* 排序下拉菜单 */}
            {showSortMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-surface rounded-xl shadow-xl border border-border py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider">排序方式</div>
                {sortFields.map((field) => (
                  <button
                    key={field.value}
                    onClick={() => {
                      setSortOptions({ ...sortOptions, field: field.value });
                      setShowSortMenu(false);
                    }}
                    className={clsx(
                      "w-full px-4 py-2 text-left text-sm flex items-center justify-between transition-colors",
                      sortOptions.field === field.value 
                        ? "text-primary bg-primary/5 font-medium" 
                        : "text-secondary hover:bg-element hover:text-primary"
                    )}
                  >
                    <span>{field.label}</span>
                    {sortOptions.field === field.value && (
                      <Icon name="check" className="text-primary text-sm" />
                    )}
                  </button>
                ))}
                
                <div className="h-px bg-border/50 my-2" />
                
                <div className="px-3 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider">排序顺序</div>
                <button
                  onClick={() => {
                    setSortOptions({ ...sortOptions, order: 'desc' });
                    setShowSortMenu(false);
                  }}
                  className={clsx(
                    "w-full px-4 py-2 text-left text-sm flex items-center justify-between transition-colors",
                    sortOptions.order === 'desc' 
                      ? "text-primary bg-primary/5 font-medium" 
                      : "text-secondary hover:bg-element hover:text-primary"
                  )}
                >
                  <span>降序（新→旧）</span>
                  {sortOptions.order === 'desc' && (
                    <Icon name="check" className="text-primary text-sm" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setSortOptions({ ...sortOptions, order: 'asc' });
                    setShowSortMenu(false);
                  }}
                  className={clsx(
                    "w-full px-4 py-2 text-left text-sm flex items-center justify-between transition-colors",
                    sortOptions.order === 'asc' 
                      ? "text-primary bg-primary/5 font-medium" 
                      : "text-secondary hover:bg-element hover:text-primary"
                  )}
                >
                  <span>升序（旧→新）</span>
                  {sortOptions.order === 'asc' && (
                    <Icon name="check" className="text-primary text-sm" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Toolbar;
