import { memo, useMemo, useCallback, useRef, useEffect, useLayoutEffect, useState, forwardRef } from 'react';
import { useLocation } from 'react-router-dom';
import type { MouseEvent, CSSProperties } from 'react';
import { VirtuosoGrid, type ContextProp, type GridComponents, type GridItemProps, type GridListProps, type ScrollerProps, type VirtuosoGridHandle, type ListRange } from 'react-virtuoso';
import clsx from 'clsx';
import PhotoThumbnail from './PhotoThumbnail';
import { convertFileSrc } from '@tauri-apps/api/core';
import { enqueueThumbnails, isThumbnailCached, checkThumbnailsCached, addToCacheExternal, type ThumbnailSize } from '@/hooks';
import type { Photo } from '@/types';

type PhotoGridVirtuosoContext = {
  loading: boolean;
};

type GridScrollerProps = Omit<ScrollerProps, 'ref'> & ContextProp<PhotoGridVirtuosoContext>;

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

// 自定义 Scroller：仅在需要的系统上稳定滚动条占位，避免宽度变化导致的抖动
const GridScroller = forwardRef<HTMLDivElement, GridScrollerProps>(
  ({ style, context: _context, ...props }, ref) => {
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
      />
    );
  }
);

const GridFooter = memo(function GridFooter({ context }: ContextProp<PhotoGridVirtuosoContext>) {
  if (!context.loading) {
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
  /** 照片列表 */
  photos: Photo[];
  /** 缩略图大小 */
  thumbnailSize?: number;
  /** 网格间距 */
  gap?: number;
  /** 选中的照片ID集合 */
  selectedIds?: Set<number>;
  /** 是否正在加载 */
  loading?: boolean;
  /** 是否还有更多数据 */
  hasMore?: boolean;
  /** 照片点击事件 */
  onPhotoClick?: (photo: Photo, event: MouseEvent) => void;
  /** 照片双击事件 */
  onPhotoDoubleClick?: (photo: Photo) => void;
  /** 照片右键菜单事件 */
  onPhotoContextMenu?: (photo: Photo, event: MouseEvent) => void;
  /** 照片选择事件 */
  onPhotoSelect?: (photo: Photo, selected: boolean) => void;
  /** 加载更多 */
  onLoadMore?: () => void;
}

/**
 * 照片网格组件
 *
 * 使用 react-virtuoso 实现虚拟滚动，高效渲染大量照片
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
  const virtuosoRef = useRef<VirtuosoGridHandle>(null);
  const location = useLocation();
  const firstPhotoId = photos[0]?.photoId ?? null;
  const prevFirstPhotoIdRef = useRef<number | null>(null);
  const prevLocationKeyRef = useRef(location.key);
  const [isScrolling, setIsScrolling] = useState(false);
  const virtuosoContext = useMemo<PhotoGridVirtuosoContext>(() => ({ loading }), [loading]);
  const preloadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  const overscanPx = useMemo(
    () => Math.round(Math.min(900, Math.max(400, thumbnailSize * 3))),
    [thumbnailSize]
  );

  const increaseViewportBy = useMemo(
    () => ({ top: Math.round(overscanPx * 0.5), bottom: overscanPx }),
    [overscanPx]
  );

  const estimatedVisibleCount = useMemo(() => {
    const availableWidth = Math.max(0, viewportSize.width - gap * 2);
    const columns = Math.max(1, Math.floor(availableWidth / (thumbnailSize + gap)));
    const rows = Math.max(1, Math.ceil(viewportSize.height / (thumbnailSize + gap)));
    return columns * rows;
  }, [gap, thumbnailSize, viewportSize.height, viewportSize.width]);

  const dataPrefetchThreshold = useMemo(
    () => Math.min(80, Math.max(40, Math.floor(estimatedVisibleCount * 0.8))),
    [estimatedVisibleCount]
  );

  const thumbnailPreloadCount = useMemo(
    () => Math.min(40, Math.max(12, Math.floor(estimatedVisibleCount * 0.25))),
    [estimatedVisibleCount]
  );

  // Force recalculation after mount/route change so thumbnails render without manual scroll
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cleanup preload debounce timer on unmount
  useEffect(() => {
    return () => {
      if (preloadDebounceRef.current) {
        clearTimeout(preloadDebounceRef.current);
      }
    };
  }, []);

  // 使用 useMemo 创建 gridComponents，避免每次渲染都创建新实例导致 remount
  const gridComponents = useMemo<GridComponents<PhotoGridVirtuosoContext>>(
    () => ({
      Scroller: GridScroller,
      List: forwardRef<HTMLDivElement, Omit<GridListProps, 'ref'> & ContextProp<PhotoGridVirtuosoContext>>(
        ({ style, children, context: _context, ...props }, ref) => (
          <div
            ref={ref}
            {...props}
            style={{
              ...style,
              display: 'flex',
              flexWrap: 'wrap',
              gap: `${gap}px`,
              padding: `${gap}px`,
            }}
          >
            {children}
          </div>
        )
      ),
      Item: forwardRef<HTMLDivElement, Omit<GridItemProps, 'ref'> & ContextProp<PhotoGridVirtuosoContext>>(
        ({ children, style, context: _context, ...props }, ref) => (
          <div
            ref={ref}
            {...props}
            style={{
              ...style,
              width: `${thumbnailSize}px`,
              height: `${thumbnailSize}px`,
              boxSizing: 'border-box',
            }}
          >
            {children}
          </div>
        )
      ),
      Footer: GridFooter,
    }),
    [gap, thumbnailSize]
  );

  // 渲染单个照片 - 使用 data 模式，直接接收 photo 对象
  const itemContent = useCallback(
    (_index: number, photo: Photo) => {
      if (!photo) return null;

      return (
        <PhotoThumbnail
          photo={photo}
          size={thumbnailSize}
          selected={selectedIds.has(photo.photoId)}
          isScrolling={isScrolling}
          onClick={onPhotoClick}
          onDoubleClick={onPhotoDoubleClick}
          onContextMenu={onPhotoContextMenu}
          onSelect={onPhotoSelect}
        />
      );
    },
    [thumbnailSize, selectedIds, isScrolling, onPhotoClick, onPhotoDoubleClick, onPhotoContextMenu, onPhotoSelect]
  );

  // 稳定的 key 计算函数，避免用 index
  const computeItemKey = useCallback(
    (_index: number, photo: Photo) => photo.photoId,
    []
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
      if (hasMore && !loading && onLoadMore && photos.length > 0) {
        const endIndex = typeof range?.endIndex === 'number' ? range.endIndex : 0;
        const prefetchThreshold = dataPrefetchThreshold;
        if (endIndex >= photos.length - prefetchThreshold) {
          onLoadMore();
        }
      }

      // Debounced thumbnail preloading
      if (preloadDebounceRef.current) {
        clearTimeout(preloadDebounceRef.current);
      }
      preloadDebounceRef.current = setTimeout(async () => {
        if (photos.length === 0) return;

        const preloadCount = thumbnailPreloadCount;
        const startIndex = typeof range?.startIndex === 'number' ? range.startIndex : 0;
        const endIndex = typeof range?.endIndex === 'number' ? range.endIndex : 0;
        const start = Math.max(0, startIndex - preloadCount);
        const end = Math.min(photos.length - 1, endIndex + preloadCount);

        const photosToCheck = photos.slice(start, end + 1);

        // 先过滤掉已在内存缓存中的
        const checkItems = photosToCheck
          .filter(p => !isThumbnailCached(p.fileHash, 'small'))
          .map(p => ({ fileHash: p.fileHash, size: 'small' as ThumbnailSize }));

        if (checkItems.length === 0) return;

        try {
          // 批量检查磁盘缓存
          const cacheStatus = await checkThumbnailsCached(checkItems);

          // 预热：已有磁盘缓存的加入内存缓存
          for (const [key, status] of cacheStatus) {
            if (status.cached && status.path) {
              const [fileHash, size] = key.split('_');
              addToCacheExternal(fileHash, size as ThumbnailSize, convertFileSrc(status.path));
            }
          }

          // 只 enqueue 真正没缓存的
          const tasks = photosToCheck
            .filter(p => {
              const status = cacheStatus.get(`${p.fileHash}_small`);
              return status && !status.cached;
            })
            .map((p, idx) => ({
              sourcePath: p.filePath,
              fileHash: p.fileHash,
              size: 'small' as const,
              // Higher priority for items closer to visible range center
              priority: 50 - Math.abs(idx - (end - start) / 2),
            }));

          if (tasks.length > 0) {
            await enqueueThumbnails(tasks);
          }
        } catch {
          // Ignore preload errors
        }
      }, 150);
    },
    [dataPrefetchThreshold, hasMore, loading, onLoadMore, photos, thumbnailPreloadCount]
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
    <div className="h-full w-full">
      <VirtuosoGrid<Photo, PhotoGridVirtuosoContext>
        ref={virtuosoRef}
        key={`grid-${location.key}-${thumbnailSize}`}
        data={photos}
        context={virtuosoContext}
        computeItemKey={computeItemKey}
        initialItemCount={Math.min(photos.length, 50)}
        overscan={overscanPx}
        increaseViewportBy={increaseViewportBy}
        isScrolling={setIsScrolling}
        listClassName={clsx('photo-grid-list', isScrolling && 'pointer-events-none')}
        itemClassName="photo-grid-item"
        itemContent={itemContent}
        rangeChanged={handleRangeChanged}
        endReached={handleEndReached}
        scrollerRef={(ref) => {
          if (ref) {
            (ref as HTMLElement).style.willChange = 'scroll-position';
          }
        }}
        components={gridComponents}
      />
    </div>
  );
});

export default PhotoGrid;
