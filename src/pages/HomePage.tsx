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
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getPhotosCursor, searchPhotosCursor } from '@/services/api';
import type { Photo, PhotoCursor, SearchFilters, SortField } from '@/types';

const PAGE_SIZE = 100;
const RECENT_PHOTOS_LIMIT = 20;

export default function HomePage() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Store State
  const sortOptions = usePhotoStore(state => state.sortOptions);
  const searchQuery = usePhotoStore(state => state.searchQuery);
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

  const photoFeedQueryKey = useMemo(
    () => ['photoFeed', { q: searchQuery.trim(), field: sortOptions.field, order: sortOptions.order }] as const,
    [searchQuery, sortOptions.field, sortOptions.order]
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
      const q = searchQuery.trim();
      if (q) {
        const filters: SearchFilters = { query: q };
        return searchPhotosCursor(filters, PAGE_SIZE, cursor, sortOptions, includeTotal);
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

  const handleCloseViewer = useCallback(() => {
    setViewerOpen(false);
  }, []);

  // 调试信息（生产环境可移除）
  useEffect(() => {
    console.log('[HomePage] isTauriRuntime:', isTauriRuntime);
    console.log('[HomePage] feedLoading:', feedLoading, 'feedError:', feedError);
    console.log('[HomePage] recentLoading:', recentLoading, 'recentError:', recentError);
    console.log('[HomePage] photos count:', photos.length);
    console.log('[HomePage] recentPhotos count:', recentPhotos.length);
  }, [isTauriRuntime, feedLoading, feedError, recentLoading, recentError, photos.length, recentPhotos.length]);

  return (
    <div
      ref={scrollContainerRef}
      className="h-full overflow-y-auto no-scrollbar p-8 space-y-10"
    >
      {/* 仪表盘区域 */}
      <HeroSection />

      <TagRibbon />

      <ContentShelf
        title="最近添加"
        icon="schedule"
        photos={recentPhotos}
        loading={recentLoading}
      />

      {/* 全部照片区域 (Grid) */}
      <section className="min-h-[500px]">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-white/90">
            <span className="material-symbols-outlined text-blue-300 text-xl">grid_view</span>
            全部照片
          </h3>
          <span className="text-sm text-white/40">{totalCount} 张</span>
        </div>

        {/* 错误提示 */}
        {feedError && (
          <div className="glass-panel rounded-2xl p-8 border border-red-500/20 text-center">
            <span className="material-symbols-outlined text-4xl text-red-400 mb-4">error</span>
            <p className="text-red-400">加载照片失败，请检查数据库连接</p>
          </div>
        )}

        {!feedError && (
          <div className="w-full glass-panel rounded-2xl overflow-hidden p-4 border border-white/5">
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

      {viewerPhoto && (
        <PhotoViewer
          photo={viewerPhoto}
          open={viewerOpen}
          photos={photos}
          onClose={handleCloseViewer}
        />
      )}
    </div>
  );
}
