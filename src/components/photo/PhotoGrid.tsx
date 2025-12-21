import { memo, useMemo, useCallback, useRef, useEffect, useLayoutEffect, useState, forwardRef } from 'react';
import { useLocation } from 'react-router-dom';
import type { MouseEvent, CSSProperties } from 'react';
import { Virtuoso, type VirtuosoHandle, type ListRange } from 'react-virtuoso';
import clsx from 'clsx';
import PhotoThumbnail from './PhotoThumbnail';
import { convertFileSrc } from '@tauri-apps/api/core';
import { enqueueThumbnails, isThumbnailCached, checkThumbnailsCached, addToCacheExternal, type ThumbnailSize } from '@/hooks';
import type { Photo } from '@/types';
import { getAspectRatioCategory, type AspectRatioCategory } from '@/types';

interface PhotoWithLayout extends Photo {
  aspectCategory: AspectRatioCategory;
  colSpan: number;
}

interface GridRow {
  id: string;
  photos: PhotoWithLayout[];
}

type PhotoGridVirtuosoContext = {
  loading: boolean;
};

type ScrollbarMode = 'auto' | 'stable-gutter' | 'force-scroll';
let cachedScrollbarMode: ScrollbarMode | null = null;

function resolveScrollbarMode(): ScrollbarMode {
  if (cachedScrollbarMode) {
    return cachedScrollbarMode;
  }

  if (typeof document === 'undefined' || !document.body) {
    return 'auto';
  }

  const outer = document.createElement('div');
  outer.style.visibility = 'hidden';
  outer.style.overflow = 'scroll';
  outer.style.position = 'absolute';
  outer.style.top = '-9999px';
  outer.style.width = '100px';
  outer.style.height = '100px';
  document.body.appendChild(outer);

  const scrollbarWidth = outer.offsetWidth - outer.clientWidth;
  document.body.removeChild(outer);

  if (scrollbarWidth === 0) {
    cachedScrollbarMode = 'auto';
    return cachedScrollbarMode;
  }

  const cssApi = typeof window !== 'undefined' ? window.CSS : undefined;
  const supportsGutter =
    cssApi !== undefined &&
    typeof cssApi.supports === 'function' &&
    cssApi.supports('scrollbar-gutter: stable');

  cachedScrollbarMode = supportsGutter ? 'stable-gutter' : 'force-scroll';
  return cachedScrollbarMode;
}

// 自定义 Scroller
const GridScroller = forwardRef<HTMLDivElement, { style?: CSSProperties; children?: React.ReactNode }>(
  ({ style, children, ...props }, ref) => {
    const [scrollbarMode, setScrollbarMode] = useState<ScrollbarMode>('auto');

    useLayoutEffect(() => {
      setScrollbarMode(resolveScrollbarMode());
    }, []);

    return (
      <div
        ref={ref}
        {...props}
        style={{
          ...style,
          overflowY: scrollbarMode === 'force-scroll' ? 'scroll' : 'auto',
          ...(scrollbarMode === 'stable-gutter' ? ({ scrollbarGutter: 'stable' } as CSSProperties) : {}),
          overflowAnchor: 'none',
        }}
      >
        {children}
      </div>
    );
  }
);

const GridFooter = memo(function GridFooter({ context }: { context?: PhotoGridVirtuosoContext }) {
  if (!context?.loading) {
    return null;
  }

  return (
    <div className="flex w-full items-center justify-center py-4">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
      <span className="ml-2 text-sm text-gray-500">加载中...</span>
    </div>
  );
});

interface PhotoGridProps {
  photos: Photo[];
  thumbnailSize?: number;
  gap?: number;
  selectedIds?: Set<number>;
  loading?: boolean;
  hasMore?: boolean;
  onPhotoClick?: (photo: Photo, event: MouseEvent) => void;
  onPhotoDoubleClick?: (photo: Photo) => void;
  onPhotoContextMenu?: (photo: Photo, event: MouseEvent) => void;
  onPhotoSelect?: (photo: Photo, selected: boolean) => void;
  onLoadMore?: () => void;
}

/**
 * 照片网格组件 - 支持超宽/超长图自适应布局
 */
const PhotoGrid = memo(function PhotoGrid({
  photos,
  thumbnailSize = 200,
  gap = 16,
  selectedIds = new Set(),
  loading = false,
  hasMore = false,
  onPhotoClick,
  onPhotoDoubleClick,
  onPhotoContextMenu,
  onPhotoSelect,
  onLoadMore,
}: PhotoGridProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const location = useLocation();
  const firstPhotoId = photos[0]?.photoId ?? null;
  const prevFirstPhotoIdRef = useRef<number | null>(null);
  const prevLocationKeyRef = useRef(location.key);
  const [isScrolling, setIsScrolling] = useState(false);
  const virtuosoContext = useMemo<PhotoGridVirtuosoContext>(() => ({ loading }), [loading]);
  const virtuosoComponents = useMemo(() => ({ Scroller: GridScroller, Footer: GridFooter }), []);
  const preloadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1024);

  // 计算列数
  const columns = useMemo(() => {
    const availableWidth = Math.max(0, containerWidth - gap * 2);
    return Math.max(2, Math.floor(availableWidth / (thumbnailSize + gap)));
  }, [containerWidth, gap, thumbnailSize]);

  // 将照片分组为行
  const rows = useMemo<GridRow[]>(() => {
    const result: GridRow[] = [];
    let currentRow: PhotoWithLayout[] = [];
    let currentColCount = 0;
    const flushRow = () => {
      if (currentRow.length === 0) return;
      result.push({
        id: currentRow.map(p => p.photoId).join('-'),
        photos: currentRow,
      });
      currentRow = [];
      currentColCount = 0;
    };

    for (const photo of photos) {
      const aspectCategory = getAspectRatioCategory(photo.width, photo.height);
      const colSpan = aspectCategory === 'wide' ? Math.min(2, columns) : 1;

      const photoWithLayout: PhotoWithLayout = {
        ...photo,
        aspectCategory,
        colSpan,
      };

      if (aspectCategory === 'tall') {
        flushRow();
        result.push({
          id: `${photo.photoId}`,
          photos: [photoWithLayout],
        });
        continue;
      }

      // 如果当前行放不下，先保存当前行
      if (currentColCount + colSpan > columns && currentRow.length > 0) {
        flushRow();
      }

      currentRow.push(photoWithLayout);
      currentColCount += colSpan;

      // 行满了
      if (currentColCount >= columns) {
        flushRow();
      }
    }

    // 最后一行
    flushRow();

    return result;
  }, [photos, columns]);

  const overscanPx = useMemo(
    () => Math.round(Math.min(900, Math.max(400, thumbnailSize * 3))),
    [thumbnailSize]
  );

  // 监听容器宽度变化
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(container);
    setContainerWidth(container.clientWidth);

    return () => observer.disconnect();
  }, []);

  // 路由/数据变化时滚动到顶部
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
        virtuosoRef.current?.scrollTo({ top: 0 });
      }, 50);
    });
    return () => cancelAnimationFrame(rafId);
  }, [firstPhotoId, location.key]);

  // Cleanup preload debounce timer on unmount
  useEffect(() => {
    return () => {
      if (preloadDebounceRef.current) {
        clearTimeout(preloadDebounceRef.current);
      }
    };
  }, []);

  // 渲染单行
  const rowContent = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row) return null;

      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: `${gap}px`,
            padding: `0 ${gap}px`,
            marginBottom: `${gap}px`,
            alignItems: 'start',
          }}
        >
          {row.photos.map((photo) => {
            const allowTallDoubleHeight = row.photos.length === 1;
            const itemHeight =
              allowTallDoubleHeight && photo.aspectCategory === 'tall'
                ? thumbnailSize * 2 + gap
                : thumbnailSize;

            return (
              <div
                key={photo.photoId}
                style={{
                  gridColumn: photo.colSpan > 1 ? `span ${photo.colSpan}` : undefined,
                  height: itemHeight,
                  alignSelf: 'start',
                }}
              >
                <PhotoThumbnail
                  photo={photo}
                  aspectCategory={photo.aspectCategory}
                  selected={selectedIds.has(photo.photoId)}
                  isScrolling={isScrolling}
                  onClick={onPhotoClick}
                  onDoubleClick={onPhotoDoubleClick}
                  onContextMenu={onPhotoContextMenu}
                  onSelect={onPhotoSelect}
                />
              </div>
            );
          })}
        </div>
      );
    },
    [rows, columns, gap, thumbnailSize, selectedIds, isScrolling, onPhotoClick, onPhotoDoubleClick, onPhotoContextMenu, onPhotoSelect]
  );

  const computeItemKey = useCallback(
    (index: number) => rows[index]?.id ?? index,
    [rows]
  );

  // 加载更多
  const handleEndReached = useCallback(() => {
    if (!loading && hasMore && onLoadMore) {
      onLoadMore();
    }
  }, [loading, hasMore, onLoadMore]);

  const handleRangeChanged = useCallback(
    (range: ListRange) => {
      // Data prefetch logic
      if (hasMore && !loading && onLoadMore && rows.length > 0) {
        const endIndex = typeof range?.endIndex === 'number' ? range.endIndex : 0;
        if (endIndex >= rows.length - 5) {
          onLoadMore();
        }
      }

      // Debounced thumbnail preloading
      if (preloadDebounceRef.current) {
        clearTimeout(preloadDebounceRef.current);
      }
      preloadDebounceRef.current = setTimeout(async () => {
        if (photos.length === 0) return;

        const startIndex = typeof range?.startIndex === 'number' ? range.startIndex : 0;
        const endIndex = typeof range?.endIndex === 'number' ? range.endIndex : 0;

        // 获取可见行范围内的所有照片
        const visiblePhotos: Photo[] = [];
        for (let i = Math.max(0, startIndex - 2); i <= Math.min(rows.length - 1, endIndex + 2); i++) {
          if (rows[i]) {
            visiblePhotos.push(...rows[i].photos);
          }
        }

        const checkItems = visiblePhotos
          .filter(p => !isThumbnailCached(p.fileHash, 'small'))
          .map(p => ({ fileHash: p.fileHash, size: 'small' as ThumbnailSize }));

        if (checkItems.length === 0) return;

        try {
          const cacheStatus = await checkThumbnailsCached(checkItems);

          for (const [key, status] of cacheStatus) {
            if (status.cached && status.path) {
              const [fileHash, size] = key.split('_');
              addToCacheExternal(fileHash, size as ThumbnailSize, convertFileSrc(status.path));
            }
          }

          const tasks = visiblePhotos
            .filter(p => {
              const status = cacheStatus.get(`${p.fileHash}_small`);
              return status && !status.cached;
            })
            .map((p, idx) => ({
              sourcePath: p.filePath,
              fileHash: p.fileHash,
              size: 'small' as const,
              priority: 50 - idx,
              width: p.width,
              height: p.height,
            }));

          if (tasks.length > 0) {
            await enqueueThumbnails(tasks);
          }
        } catch {
          // Ignore preload errors
        }
      }, 150);
    },
    [hasMore, loading, onLoadMore, photos.length, rows]
  );

  // 空状态
  if (photos.length === 0 && !loading) {
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
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            暂无照片
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            添加文件夹开始管理您的照片
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <Virtuoso
        ref={virtuosoRef}
        key={`grid-${location.key}-${thumbnailSize}-${columns}`}
        totalCount={rows.length}
        context={virtuosoContext}
        computeItemKey={computeItemKey}
        overscan={overscanPx}
        isScrolling={setIsScrolling}
        itemContent={rowContent}
        rangeChanged={handleRangeChanged}
        endReached={handleEndReached}
        components={virtuosoComponents}
        style={{ paddingTop: gap }}
        className={clsx(isScrolling && 'pointer-events-none')}
      />
    </div>
  );
});

export default PhotoGrid;
