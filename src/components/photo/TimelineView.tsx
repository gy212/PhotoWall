import { memo, useMemo, useCallback, useRef, useState, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import PhotoThumbnail from './PhotoThumbnail';
import type { Photo } from '@/types';

const INITIAL_PHOTOS_PER_GROUP = 50;
const PHOTOS_LOAD_MORE_COUNT = 50;

interface TimelineViewProps {
  photos: Photo[];
  thumbnailSize?: number;
  gap?: number;
  selectedIds?: Set<number>;
  hasMore?: boolean;
  loading?: boolean;
  onPhotoClick?: (photo: Photo, event: ReactMouseEvent) => void;
  onPhotoDoubleClick?: (photo: Photo) => void;
  onPhotoContextMenu?: (photo: Photo, event: ReactMouseEvent) => void;
  onPhotoSelect?: (photo: Photo, selected: boolean) => void;
  onLoadMore?: () => void;
}

const formatDate = (dateStr: string): string => {
  if (dateStr === 'unknown') return '未知日期';

  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return '今天';
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return '昨天';
  }

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  if (date > weekAgo) {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return days[date.getDay()];
  }

  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

const TimelineView = memo(function TimelineView({
  photos,
  thumbnailSize = 200,
  gap = 16,
  selectedIds = new Set(),
  hasMore = false,
  loading = false,
  onPhotoClick,
  onPhotoDoubleClick,
  onPhotoContextMenu,
  onPhotoSelect,
  onLoadMore,
}: TimelineViewProps) {
  const virtuosoRef = useRef<any>(null);
  const location = useLocation();
  const firstPhotoId = photos[0]?.photoId ?? null;
  const prevFirstPhotoIdRef = useRef<number | null>(null);
  const prevLocationKeyRef = useRef(location.key);
  const [expandedGroups, setExpandedGroups] = useState<Map<string, number>>(new Map());

  // Force a recompute when route/view changes so thumbnails load without manual scroll
  useEffect(() => {
    const locationChanged = prevLocationKeyRef.current !== location.key;
    const firstPhotoChanged = firstPhotoId !== null && prevFirstPhotoIdRef.current !== firstPhotoId;

    prevLocationKeyRef.current = location.key;
    prevFirstPhotoIdRef.current = firstPhotoId;

    if (!locationChanged && !firstPhotoChanged) {
      return;
    }

    const rafId = requestAnimationFrame(() => {
      setTimeout(() => {
        virtuosoRef.current?.scrollTo?.({ top: 0 });
      }, 50);
    });
    return () => cancelAnimationFrame(rafId);
  }, [firstPhotoId, location.key]);

  // Group photos by date
  const dateGroups = useMemo(() => {
    const groups = new Map<string, Photo[]>();

    photos.forEach((photo) => {
      const date = photo.dateTaken || photo.dateAdded;
      const dateKey = date ? new Date(date).toISOString().split('T')[0] : 'unknown';

      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(photo);
    });

    return Array.from(groups.entries())
      .map(([date, items]) => ({
        date,
        displayDate: formatDate(date),
        photos: items,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [photos]);

  const renderDateGroup = useCallback(
    (index: number) => {
      const group = dateGroups[index];
      if (!group) return null;

      const visibleCount = expandedGroups.get(group.date) ?? INITIAL_PHOTOS_PER_GROUP;
      const visiblePhotos = group.photos.slice(0, visibleCount);
      const hasMorePhotos = group.photos.length > visibleCount;
      const remainingCount = group.photos.length - visibleCount;

      const handleShowMore = () => {
        setExpandedGroups((prev) => {
          const next = new Map(prev);
          next.set(group.date, visibleCount + PHOTOS_LOAD_MORE_COUNT);
          return next;
        });
      };

      return (
        <div key={group.date} className="mb-8">
          <div className="sticky top-0 z-10 mb-4 px-2 py-3 bg-surface/95 backdrop-blur-md border-b border-border/40 transition-all duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold tracking-tight text-on-surface flex items-baseline gap-2">
                {group.displayDate}
                <span className="text-sm font-normal text-muted-foreground">{group.photos.length} 张</span>
              </h3>
            </div>
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(thumbnailSize - 40, 120)}px, 1fr))`,
              gap: `${gap}px`,
            }}
          >
            {visiblePhotos.map((photo) => (
              <PhotoThumbnail
                key={photo.photoId}
                photo={photo}
                size={thumbnailSize - 40}
                selected={selectedIds.has(photo.photoId)}
                onClick={onPhotoClick}
                onDoubleClick={onPhotoDoubleClick}
                onContextMenu={onPhotoContextMenu}
                onSelect={onPhotoSelect}
              />
            ))}
          </div>

          {hasMorePhotos && (
            <button
              onClick={handleShowMore}
              className="mt-3 w-full py-2 text-sm text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              加载更多（剩余 {remainingCount} 张）
            </button>
          )}
        </div>
      );
    },
    [dateGroups, thumbnailSize, expandedGroups, onPhotoClick, onPhotoDoubleClick, onPhotoContextMenu, onPhotoSelect, gap]
  );

  const handleEndReached = useCallback(() => {
    if (hasMore && !loading && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, loading, onLoadMore]);

  const handleRangeChanged = useCallback(
    (range: any) => {
      if (!hasMore || loading || !onLoadMore || dateGroups.length === 0) {
        return;
      }

      const endIndex = typeof range?.endIndex === 'number' ? range.endIndex : 0;
      const prefetchThreshold = 2;
      if (endIndex >= dateGroups.length - prefetchThreshold) {
        onLoadMore();
      }
    },
    [dateGroups.length, hasMore, loading, onLoadMore]
  );

  if (dateGroups.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <svg
            className="mx-auto h-16 w-16 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">暂无照片</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">添加文件夹开始管理您的照片</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <Virtuoso
        style={{ height: '100%' }}
        ref={virtuosoRef}
        key={`timeline-${location.key}-${thumbnailSize}`}
        totalCount={dateGroups.length}
        initialItemCount={Math.min(dateGroups.length, 10)}
        itemContent={renderDateGroup}
        rangeChanged={handleRangeChanged}
        endReached={handleEndReached}
        overscan={1000}
        className="px-6"
        components={{
          Footer: () => (
            <div className="py-4 text-center">
              {loading ? (
                <div className="flex items-center justify-center space-x-2 text-muted-foreground">
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>加载中...</span>
                </div>
              ) : hasMore ? (
                <span className="text-sm text-muted-foreground">下滑加载更多</span>
              ) : photos.length > 0 ? (
                <span className="text-sm text-muted-foreground">已加载全部 {photos.length} 张照片</span>
              ) : null}
            </div>
          ),
        }}
      />
    </div>
  );
});

export default TimelineView;
