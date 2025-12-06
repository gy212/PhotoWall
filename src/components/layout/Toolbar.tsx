import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import { usePhotoStore } from '@/stores/photoStore';
import type { ViewMode, SortField } from '@/types';

const viewModes: { value: ViewMode; icon: React.ReactNode; label: string }[] = [
  {
    value: 'grid',
    label: '网格',
    icon: (
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M10 3H3v7h7V3zm11 0h-7v7h7V3zM10 14H3v7h7v-7zm11 0h-7v7h7v-7z" />
      </svg>
    ),
  },
  {
    value: 'timeline',
    label: '时间轴',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
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
      <div className="flex items-center space-x-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#444f60]">所有照片</h1>
        {/* 计数徽章 (Level -1) */}
        <div className="neu-pressed px-4 py-1.5 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-500">{formattedTotal}</span>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center space-x-8">
        {/* 搜索框 */}
        <form onSubmit={handleSearch}>
          <div className="neu-pressed flex items-center px-6 py-3 w-80 text-gray-400 focus-within:text-blue-500 transition-colors">
            <svg className="h-5 w-5 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="搜索..."
              className="bg-transparent border-none outline-none text-base w-full placeholder-gray-400 text-gray-600 font-medium"
              value={searchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
            />
          </div>
        </form>

        {/* 按钮组 */}
        <div className="flex space-x-5">
          {/* 视图切换 */}
          <div className="flex neu-pressed p-2 rounded-2xl items-center">
            {viewModes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setViewMode(mode.value)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition border-none ${
                  viewMode === mode.value
                    ? 'neu-btn text-blue-500 bg-white'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
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
              className="w-14 h-14 neu-btn flex items-center justify-center text-gray-500 hover:text-gray-700" 
              title="排序"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            </button>

            {/* 排序下拉菜单 */}
            {showSortMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase">排序方式</div>
                {sortFields.map((field) => (
                  <button
                    key={field.value}
                    onClick={() => {
                      setSortOptions({ ...sortOptions, field: field.value });
                      setShowSortMenu(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${
                      sortOptions.field === field.value ? 'text-blue-600 font-medium' : 'text-gray-700'
                    }`}
                  >
                    <span>{field.label}</span>
                    {sortOptions.field === field.value && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
                <div className="h-px bg-gray-100 my-2" />
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase">排序顺序</div>
                <button
                  onClick={() => {
                    setSortOptions({ ...sortOptions, order: 'desc' });
                    setShowSortMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${
                    sortOptions.order === 'desc' ? 'text-blue-600 font-medium' : 'text-gray-700'
                  }`}
                >
                  <span>降序（新→旧）</span>
                  {sortOptions.order === 'desc' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => {
                    setSortOptions({ ...sortOptions, order: 'asc' });
                    setShowSortMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${
                    sortOptions.order === 'asc' ? 'text-blue-600 font-medium' : 'text-gray-700'
                  }`}
                >
                  <span>升序（旧→新）</span>
                  {sortOptions.order === 'asc' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
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
