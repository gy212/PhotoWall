/**
 * 首页组件 - 新版仪表盘视图
 *
 * 组装 HeroSection, TagRibbon 和 ContentShelf
 */

import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import HeroSection from '@/components/dashboard/HeroSection';
import TagRibbon from '@/components/dashboard/TagRibbon';
import ContentShelf from '@/components/dashboard/ContentShelf';
import { PhotoGrid, PhotoViewer } from '@/components/photo';
import { usePhotoStore } from '@/stores/photoStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { SelectionToolbar, SelectionAction, SelectionDivider } from '@/components/common/SelectionToolbar';
import { BatchTagSelector } from '@/components/tag';
import { Icon } from '@/components/common/Icon';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPhotosCursor, searchPhotosCursor, setPhotosFavorite, softDeletePhotos } from '@/services/api';
import type { Photo, PhotoCursor, SortField } from '@/types';

const PAGE_SIZE = 100;
const RECENT_PHOTOS_LIMIT = 20;

export default function HomePage() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Store State
  const sortOptions = usePhotoStore(state => state.sortOptions);
  const searchFilters = usePhotoStore(state => state.searchFilters);
  const totalCount = usePhotoStore(state => state.totalCount);
  const setTotalCount = usePhotoStore(state => state.setTotalCount);
  const selectedIds = useSelectionStore(state => state.selectedIds);
  const clearSelection = useSelectionStore(state => state.clearSelection);
  const select = useSelectionStore(state => state.select);
  const toggleSelection = useSelectionStore(state => state.toggle);
  const lastSelectedId = useSelectionStore(state => state.lastSelectedId);

  // Viewer State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<Photo | null>(null);

  // --- Check Tauri Runtime (兼容 Tauri 2.0) ---
  const isTauriRuntime = (() => {
    if (typeof window === 'undefined') return false;
    const w = window as typeof window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
    return Boolean(w.__TAURI__ ?? w.__TAURI_INTERNALS__);
  })();

  // --- 最近添加照片查询 ---
  const {
    data: recentPhotosData,
    isLoading: recentLoading,
    isError: recentError,
  } = useQuery({
    queryKey: ['recentPhotos'],
    queryFn: () => getPhotosCursor(
      RECENT_PHOTOS_LIMIT,
      null,
      { field: 'dateAdded', order: 'desc' },
      false
    ),
    enabled: isTauriRuntime,
    staleTime: 30000,
    retry: 1,
  });

  const recentPhotos = recentPhotosData?.items ?? [];

  // --- Infinite Query Logic for All Photos Grid ---
  const getCursorForPhoto = useCallback((photo: Photo, field: SortField): PhotoCursor => {
    let sortValue: string | number | null = null;
    switch (field) {
      case 'dateTaken': sortValue = photo.dateTaken ?? null; break;
      case 'dateAdded': sortValue = photo.dateAdded ?? null; break;
      case 'fileName': sortValue = photo.fileName ?? null; break;
      case 'fileSize': sortValue = photo.fileSize ?? null; break;
      case 'rating': sortValue = photo.rating ?? null; break;
      default: sortValue = photo.dateTaken ?? null; break;
    }
    return { sortValue, photoId: photo.photoId };
  }, []);

  // 检查是否有活动的搜索过滤器
  const hasActiveFilters = useMemo(() => {
    return !!(
      searchFilters.query?.trim() ||
      searchFilters.dateFrom ||
      searchFilters.dateTo ||
      (searchFilters.tagIds && searchFilters.tagIds.length > 0) ||
      searchFilters.minRating ||
      searchFilters.favoritesOnly ||
      (searchFilters.fileExtensions && searchFilters.fileExtensions.length > 0)
    );
  }, [searchFilters]);

  // 生成过滤器标题
  const filterTitle = useMemo(() => {
    if (!hasActiveFilters) return "全部照片";

    const parts: string[] = [];
    if (searchFilters.query?.trim()) {
      parts.push(`"${searchFilters.query.trim()}"`);
    }
    if (searchFilters.tagIds?.length) {
      if (searchFilters.tagIds.length === 1 && searchFilters.tagNames?.[0]) {
        parts.push(`标签: ${searchFilters.tagNames[0]}`);
      } else {
        parts.push(`${searchFilters.tagIds.length}个标签`);
      }
    }
    if (searchFilters.dateFrom || searchFilters.dateTo) {
      parts.push("日期范围");
    }
    if (searchFilters.minRating) {
      parts.push(`≥${searchFilters.minRating}星`);
    }
    if (searchFilters.favoritesOnly) {
      parts.push("收藏");
    }

    return parts.length > 0 ? `搜索: ${parts.join(" · ")}` : "筛选结果";
  }, [hasActiveFilters, searchFilters]);

  const photoFeedQueryKey = useMemo(
    () => ['photoFeed', { filters: searchFilters, field: sortOptions.field, order: sortOptions.order }] as const,
    [searchFilters, sortOptions.field, sortOptions.order]
  );

  const {
    data,
    isLoading: feedLoading,
    isError: feedError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: photoFeedQueryKey,
    enabled: isTauriRuntime,
    initialPageParam: null as PhotoCursor | null,
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam ?? null;
      const includeTotal = pageParam == null;
      if (hasActiveFilters) {
        return searchPhotosCursor(searchFilters, PAGE_SIZE, cursor, sortOptions, includeTotal);
      }
      return getPhotosCursor(PAGE_SIZE, cursor, sortOptions, includeTotal);
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.items.length < PAGE_SIZE) return undefined;
      const last = lastPage.items[lastPage.items.length - 1];
      return last ? getCursorForPhoto(last, sortOptions.field) : undefined;
    },
    retry: 1,
  });

  const photos = useMemo(() => data?.pages.flatMap(page => page.items) ?? [], [data]);

  // 修复：使用 isLoading 而非 status === 'pending'
  // isLoading 只在首次加载时为 true，之后即使数据为空也会是 false
  const loading = feedLoading || isFetchingNextPage;

  useEffect(() => {
    const total = data?.pages?.[0]?.total;
    if (typeof total === 'number') setTotalCount(total);
  }, [data, setTotalCount]);

  // --- Grid Interaction Handlers ---
  const handlePhotoClick = useCallback((photo: Photo, event?: React.MouseEvent) => {
    const isCtrlLike = Boolean(event?.ctrlKey || event?.metaKey);
    const isShift = Boolean(event?.shiftKey);
    if (isShift && lastSelectedId) {
      select(photo.photoId);
      return;
    }
    if (isCtrlLike) {
      toggleSelection(photo.photoId);
      return;
    }
    clearSelection();
    select(photo.photoId);
  }, [clearSelection, select, toggleSelection, lastSelectedId]);

  const handlePhotoDoubleClick = useCallback((photo: Photo) => {
    setViewerPhoto(photo);
    setViewerOpen(true);
  }, []);

  // 用于 ContentShelf 的单击打开查看器
  const handleShelfPhotoClick = useCallback((photo: Photo) => {
    setViewerPhoto(photo);
    setViewerOpen(true);
  }, []);

  const handleCloseViewer = useCallback(() => {
    setViewerOpen(false);
  }, []);

  const homeDebugEnabled =
    import.meta.env.DEV &&
    (import.meta.env as unknown as Record<string, string | boolean | undefined>).VITE_DEBUG_HOME === '1';

  // 调试信息（生产环境可移除）
  useEffect(() => {
    if (!homeDebugEnabled) return;
    console.log('[HomePage] isTauriRuntime:', isTauriRuntime);
    console.log('[HomePage] feedLoading:', feedLoading, 'feedError:', feedError);
    console.log('[HomePage] recentLoading:', recentLoading, 'recentError:', recentError);
    console.log('[HomePage] photos count:', photos.length);
    console.log('[HomePage] recentPhotos count:', recentPhotos.length);
  }, [
    homeDebugEnabled,
    isTauriRuntime,
    feedLoading,
    feedError,
    recentLoading,
    recentError,
    photos.length,
    recentPhotos.length,
  ]);

  // --- Selection Actions ---
  const queryClient = useQueryClient();
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);

  // 批量移动到回收站
  const handleMoveToTrash = async () => {
    if (selectedIds.size === 0) return;
    setIsActionLoading(true);
    try {
      await softDeletePhotos(Array.from(selectedIds));
      clearSelection();
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['photoFeed'] });
      queryClient.invalidateQueries({ queryKey: ['recentPhotos'] });
      // Optimistic update logic could be added here for better UX, 
      // but invalidation handles correctness.
    } catch (error) {
      console.error('Failed to move photos to trash:', error);
    } finally {
      setIsActionLoading(false);
    }
  };

  // 批量收藏/取消收藏 (此处简化为统一设为收藏，或根据第一个状态反转)
  // For simplicity: toggle favorite for all selected based on the first one's state or just favorite all.
  // A better UX might be: if any un-favorited, favorite all. If all favorited, un-favorite all.
  const handleToggleFavorite = async () => {
    if (selectedIds.size === 0) return;
    setIsActionLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const selectedPhotos = photos.filter((photo) => selectedIds.has(photo.photoId));
      const allSelectedFavorited =
        selectedPhotos.length > 0 && selectedPhotos.every((photo) => photo.isFavorite);
      await setPhotosFavorite(ids, !allSelectedFavorited);

      clearSelection();
      queryClient.invalidateQueries({ queryKey: ['photoFeed'] });
      queryClient.invalidateQueries({ queryKey: ['recentPhotos'] });
    } catch (error) {
      console.error('Failed to toggle favorites:', error);
    } finally {
      setIsActionLoading(false);
    }
  };

  // 批量标签操作完成
  const handleTagComplete = () => {
    setShowTagSelector(false);
    queryClient.invalidateQueries({ queryKey: ['photoFeed'] });
    queryClient.invalidateQueries({ queryKey: ['recentPhotos'] });
  };

  return (
    <div
      ref={scrollContainerRef}
      className="h-full overflow-y-auto p-6 space-y-8 relative"
    >
      {/* 仪表盘区域 */}
      <HeroSection onPhotoClick={handleShelfPhotoClick} />

      <TagRibbon />

      <ContentShelf
        title="最近添加"
        icon="schedule"
        photos={recentPhotos}
        loading={recentLoading}
        onPhotoClick={handleShelfPhotoClick}
      />

      {/* 全部照片区域 (Grid) */}
      <section className="min-h-[500px]">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-base font-medium flex items-center gap-2 text-primary">
            <Icon name={hasActiveFilters ? "filter_list" : "grid_view"} className="text-primary text-lg" />
            {filterTitle}
          </h3>
          <span className="text-sm text-secondary">{totalCount} 张</span>
        </div>

        {/* 错误提示 */}
        {feedError && (
          <div className="card rounded-2xl p-8 border border-red-500/20 text-center">
            <Icon name="error" className="text-4xl text-red-500 mb-4" />
            <p className="text-red-500">加载照片失败，请检查数据库连接</p>
          </div>
        )}

        {!feedError && (
          <div className="w-full card card-grid-bottom rounded-2xl overflow-hidden p-4 border border-border">
            <PhotoGrid
              photos={photos}
              loading={loading}
              hasMore={hasNextPage}
              onLoadMore={fetchNextPage}
              selectedIds={selectedIds}
              onPhotoClick={handlePhotoClick}
              onPhotoDoubleClick={handlePhotoDoubleClick}
              thumbnailSize={180}
              gap={12}
              groupByDateEnabled={true}
              embedded={true}
            />
          </div>
        )}
      </section>

      {/* 底部悬浮选择栏 */}
      <div className="fixed bottom-8 left-0 right-0 flex justify-center pointer-events-none z-50">
        {selectedIds.size > 0 && (
          <div className="pointer-events-auto">
            <SelectionToolbar selectedCount={selectedIds.size} onClear={clearSelection}>
              <SelectionAction
                icon="label"
                label="标签"
                onClick={() => setShowTagSelector(true)}
                disabled={isActionLoading}
              />
              <SelectionDivider />
              <SelectionAction
                icon="favorite"
                label="收藏"
                onClick={handleToggleFavorite}
                disabled={isActionLoading}
              />
              <SelectionDivider />
              <SelectionAction
                icon="delete"
                label="删除"
                className="hover:bg-red-500/20 text-red-400 group-hover:text-red-300"
                iconClassName="text-red-400"
                labelClassName="text-red-400"
                onClick={handleMoveToTrash}
                disabled={isActionLoading}
              />
            </SelectionToolbar>
          </div>
        )}
      </div>

      {/* 批量标签选择器 */}
      {showTagSelector && selectedIds.size > 0 && (
        <BatchTagSelector
          selectedPhotoIds={Array.from(selectedIds)}
          onComplete={handleTagComplete}
          onClose={() => setShowTagSelector(false)}
        />
      )}

      {viewerPhoto && (
        <PhotoViewer
          photo={viewerPhoto}
          open={viewerOpen}
          photos={recentPhotos.some(p => p.photoId === viewerPhoto.photoId) ? recentPhotos : photos}
          onClose={handleCloseViewer}
        />
      )}
    </div>
  );
}
