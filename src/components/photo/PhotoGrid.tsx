import { memo, useMemo, useCallback, useRef, useEffect, useLayoutEffect, useState, forwardRef } from 'react';
import { useLocation } from 'react-router-dom';
import type { MouseEvent, CSSProperties } from 'react';
import { Virtuoso, type VirtuosoHandle, type ListRange } from 'react-virtuoso';
import clsx from 'clsx';
import PhotoThumbnail from './PhotoThumbnail';
import { convertFileSrc } from '@tauri-apps/api/core';
import { enqueueThumbnails, isThumbnailCached, checkThumbnailsCached, addToCacheExternal, type ThumbnailSize, thumbnailRequestManager } from '@/hooks';
import type { Photo } from '@/types';
import { getAspectRatioCategory, type AspectRatioCategory } from '@/types';
import { groupByDate, type DateGroup } from '@/utils/dateGrouping';

interface PhotoWithLayout extends Photo {
  aspectCategory: AspectRatioCategory;
  colSpan: number;
  rowSpan: number;
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
function findScrollParent(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;

  let parent: HTMLElement | null = element.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    const isScrollable = overflowY === 'auto' || overflowY === 'scroll';
    if (isScrollable && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
    parent = parent.parentElement;
  }

  return null;
}

function areSetsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}

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
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      <span className="ml-2 text-sm text-secondary">加载中...</span>
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
  /** 是否按日期分组显示 */
  groupByDateEnabled?: boolean;
  /** 嵌入模式：禁用内部滚动，融入父容器滚动流 */
  embedded?: boolean;
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
  groupByDateEnabled = false,
  embedded = false,
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
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1024);
  const [activeGroupDates, setActiveGroupDates] = useState<Set<string>>(() => new Set());
  const groupElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const activeGroupDatesRef = useRef<Set<string>>(new Set());

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
      const rowSpan = aspectCategory === 'tall' ? 2 : 1;

      const photoWithLayout: PhotoWithLayout = {
        ...photo,
        aspectCategory,
        colSpan,
        rowSpan,
      };

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

  // 日期分组（仅在 groupByDateEnabled 时使用）
  const dateGroups = useMemo<DateGroup<Photo>[]>(() => {
    if (!groupByDateEnabled) return [];
    return groupByDate(photos, (photo) => photo.dateTaken || photo.dateAdded);
  }, [photos, groupByDateEnabled]);

  const overscanPx = useMemo(
    () => Math.round(Math.min(1500, Math.max(600, thumbnailSize * 5))),
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

  // Embedded + grouped mode: keep active groups in sync with the actual scroll position.
  // This is a robust fallback for nested scrollers (HomePage uses an overflow container, not window scroll).
  useEffect(() => {
    if (!embedded || !groupByDateEnabled) return;

    const scrollRoot = findScrollParent(containerRef.current);
    const scrollTarget: HTMLElement | Window = scrollRoot ?? window;
    const marginPx = 1200;
    let rafId: number | null = null;

    const computeActive = () => {
      rafId = null;

      const rootRect =
        scrollRoot !== null
          ? scrollRoot.getBoundingClientRect()
          : ({ top: 0, bottom: window.innerHeight } as DOMRect);

      const next = new Set<string>();
      for (const [date, el] of groupElementsRef.current) {
        const rect = el.getBoundingClientRect();
        const visible =
          rect.bottom >= rootRect.top - marginPx && rect.top <= rootRect.bottom + marginPx;
        if (visible) next.add(date);
      }

      if (!areSetsEqual(activeGroupDatesRef.current, next)) {
        activeGroupDatesRef.current = next;
        setActiveGroupDates(next);
      }
    };

    const schedule = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(computeActive);
    };

    schedule();
    scrollTarget.addEventListener('scroll', schedule, { passive: true } as AddEventListenerOptions);
    window.addEventListener('resize', schedule);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      scrollTarget.removeEventListener('scroll', schedule as EventListener);
      window.removeEventListener('resize', schedule);
    };
  }, [embedded, groupByDateEnabled, dateGroups.length]);

  // 嵌入模式下的无限滚动：监听哨兵元素进入视口
  useEffect(() => {
    if (!embedded || !groupByDateEnabled || !hasMore || !onLoadMore) return;

    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const scrollRoot = findScrollParent(containerRef.current);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          onLoadMore();
        }
      },
      { root: scrollRoot ?? null, rootMargin: '800px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [embedded, groupByDateEnabled, hasMore, loading, onLoadMore]);

  // ✅ 关键修复：嵌入模式下的首屏预取
  // 使用 IntersectionObserver 观察日期分组块，进入视口时批量预取
  const groupObserverRef = useRef<IntersectionObserver | null>(null);
  const observedGroupsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!embedded || !groupByDateEnabled) return;

    const scrollRoot = findScrollParent(containerRef.current);

    // 创建 IntersectionObserver 观察日期分组块
    groupObserverRef.current = new IntersectionObserver(
      (entries) => {
        const visiblePhotos: Photo[] = [];

        for (const entry of entries) {
          if (entry.isIntersecting) {
            const groupDate = entry.target.getAttribute('data-group-date');
            if (!groupDate) continue;

            if (!observedGroupsRef.current.has(groupDate)) {
              observedGroupsRef.current.add(groupDate);
              // 找到对应的日期分组
              const group = dateGroups.find(g => g.date === groupDate);
              if (group) {
                visiblePhotos.push(...group.items);
              }
            }
          }
        }

        // 批量上报需求给 manager
        if (visiblePhotos.length > 0) {
          thumbnailRequestManager.demandBatch(
            visiblePhotos.map((photo, idx) => ({
              fileHash: photo.fileHash,
              size: 'small' as ThumbnailSize,
              sourcePath: photo.filePath,
              priority: 50 - idx,
              width: photo.width,
              height: photo.height,
              visible: true,
            }))
          );
          // 同时预取 tiny
          thumbnailRequestManager.demandBatch(
            visiblePhotos.map((photo, idx) => ({
              fileHash: photo.fileHash,
              size: 'tiny' as ThumbnailSize,
              sourcePath: photo.filePath,
              priority: 60 - idx, // tiny 优先级更高
              width: photo.width,
              height: photo.height,
              visible: true,
            }))
          );
        }
      },
      { root: scrollRoot ?? null, rootMargin: '800px 0px' }
    );

    for (const el of groupElementsRef.current.values()) {
      groupObserverRef.current.observe(el);
    }

    return () => {
      groupObserverRef.current?.disconnect();
      groupObserverRef.current = null;
    };
  }, [embedded, groupByDateEnabled, dateGroups]);

  // 页面回归时强制 flush（visibilitychange 和 focus 已在 manager 中处理）
  // 但这里额外处理路由变化回到当前页面的情况
  const prevLocationKeyRef2 = useRef(location.key);
  useEffect(() => {
    if (prevLocationKeyRef2.current !== location.key) {
      prevLocationKeyRef2.current = location.key;
      // 路由变化，强制 flush 一次
      thumbnailRequestManager.forceFlush();
    }
  }, [location.key]);

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
            gridAutoRows: `${thumbnailSize}px`,
            gap: `${gap}px`,
            padding: `0 ${gap}px`,
            marginBottom: `${gap}px`,
            alignItems: 'start',
          }}
        >
          {row.photos.map((photo) => (
            <div
              key={photo.photoId}
              style={{
                gridColumn: photo.colSpan > 1 ? `span ${photo.colSpan}` : undefined,
                gridRow: photo.rowSpan > 1 ? `span ${photo.rowSpan}` : undefined,
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
          ))}
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
          <h3 className="mt-4 text-lg font-medium text-primary">
            暂无照片
          </h3>
          <p className="mt-2 text-sm text-secondary">
            添加文件夹开始管理您的照片
          </p>
        </div>
      </div>
    );
  }

  // 嵌入模式 + 日期分组：渲染静态内容，无虚拟滚动
  if (embedded && groupByDateEnabled) {
    return (
      <div ref={containerRef} className="w-full" style={{ paddingTop: gap }}>
        {dateGroups.map((group) => (
          <div
            key={group.date}
            className="mb-8"
            data-group-date={group.date}
            ref={(el) => {
              if (el) {
                groupElementsRef.current.set(group.date, el);
                groupObserverRef.current?.observe(el);
              } else {
                groupElementsRef.current.delete(group.date);
              }
            }}
          >
            {/* 日期分组 Header - Solid Background */}
            <div className="sticky top-0 z-20 mb-4 px-4 py-3 bg-surface border-b border-border">
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-3">
                  <h3 className="text-2xl font-bold tracking-tight text-primary font-serif">
                    {group.displayDate}
                  </h3>
                  <span className="text-sm font-medium text-secondary">
                    {group.items.length} 张
                  </span>
                </div>
              </div>
            </div>
            {/* 照片网格 - 使用 CSS Grid 自动布局 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gridAutoRows: `${thumbnailSize}px`,
                gap: `${gap}px`,
                padding: `0 ${gap}px`,
              }}
            >
              {group.items.map((photo) => {
                const aspectCategory = getAspectRatioCategory(photo.width, photo.height);
                const colSpan = aspectCategory === 'wide' ? Math.min(2, columns) : 1;
                const rowSpan = aspectCategory === 'tall' ? 2 : 1;

                return (
                  <div
                    key={photo.photoId}
                    style={{
                      gridColumn: colSpan > 1 ? `span ${colSpan}` : undefined,
                      gridRow: rowSpan > 1 ? `span ${rowSpan}` : undefined,
                    }}
                  >
                    <PhotoThumbnail
                      photo={photo}
                      aspectCategory={aspectCategory}
                      selected={selectedIds.has(photo.photoId)}
                      thumbnailsEnabled={activeGroupDates.has(group.date)}
                      isScrolling={false}
                      onClick={onPhotoClick}
                      onDoubleClick={onPhotoDoubleClick}
                      onContextMenu={onPhotoContextMenu}
                      onSelect={onPhotoSelect}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {hasMore && <div ref={loadMoreSentinelRef} className="h-1" />}
        {loading && hasMore && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gridAutoRows: `${thumbnailSize}px`,
              gap: `${gap}px`,
              padding: `0 ${gap}px`,
            }}
          >
            {Array.from({ length: columns * 2 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700"
              />
            ))}
          </div>
        )}
        {loading && !hasMore && (
          <div className="flex w-full items-center justify-center py-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
            <span className="ml-2 text-sm text-secondary">加载中...</span>
          </div>
        )}
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
