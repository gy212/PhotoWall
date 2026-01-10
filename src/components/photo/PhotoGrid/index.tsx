/**
 * 照片网格组件 - 支持超宽/超长图自适应布局
 */

import { memo, useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Virtuoso, type VirtuosoHandle, type ListRange } from 'react-virtuoso';
import clsx from 'clsx';
import { convertFileSrc } from '@tauri-apps/api/core';
import { enqueueThumbnails, isThumbnailCached, checkThumbnailsCached, addToCacheExternal, type ThumbnailSize, thumbnailRequestManager } from '@/hooks';
import type { Photo } from '@/types';
import { groupByDate } from '@/utils/dateGrouping';

import type { PhotoGridProps, PhotoGridVirtuosoContext } from './types';
import { GridScroller } from './components/GridScroller';
import { GridFooter } from './components/GridFooter';
import { GridRow } from './components/GridRow';
import { DateGroupSection } from './components/DateGroupSection';
import { EmptyState } from './components/EmptyState';
import { useGridLayout } from './hooks/useGridLayout';
import { useScrollSync } from './hooks/useScrollSync';
import { useThumbnailPrefetch } from './hooks/useThumbnailPrefetch';
import { findScrollParent } from './utils/scrollbarMode';

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

  // 计算列数
  const columns = useMemo(() => {
    const availableWidth = Math.max(0, containerWidth - gap * 2);
    return Math.max(2, Math.floor(availableWidth / (thumbnailSize + gap)));
  }, [containerWidth, gap, thumbnailSize]);

  // 使用拆分后的 hooks
  const { rows } = useGridLayout(photos, columns);

  // 日期分组（仅在 groupByDateEnabled 时使用）
  const dateGroups = useMemo(() => {
    if (!groupByDateEnabled) return [];
    return groupByDate(photos, (photo) => photo.dateTaken || photo.dateAdded);
  }, [photos, groupByDateEnabled]);

  const { activeGroupDates, groupElementsRef, registerGroupElement } = useScrollSync(
    containerRef,
    dateGroups,
    embedded,
    groupByDateEnabled
  );

  useThumbnailPrefetch(
    containerRef,
    dateGroups,
    groupElementsRef,
    embedded,
    groupByDateEnabled
  );

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

  // 页面回归时强制 flush
  const prevLocationKeyRef2 = useRef(location.key);
  useEffect(() => {
    if (prevLocationKeyRef2.current !== location.key) {
      prevLocationKeyRef2.current = location.key;
      thumbnailRequestManager.forceFlush();
    }
  }, [location.key]);

  // 渲染单行
  const rowContent = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row) return null;

      return (
        <GridRow
          row={row}
          columns={columns}
          gap={gap}
          thumbnailSize={thumbnailSize}
          selectedIds={selectedIds}
          isScrolling={isScrolling}
          onPhotoClick={onPhotoClick}
          onPhotoDoubleClick={onPhotoDoubleClick}
          onPhotoContextMenu={onPhotoContextMenu}
          onPhotoSelect={onPhotoSelect}
        />
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
    return <EmptyState />;
  }

  // 嵌入模式 + 日期分组：渲染静态内容，无虚拟滚动
  if (embedded && groupByDateEnabled) {
    return (
      <div ref={containerRef} className="w-full" style={{ paddingTop: gap }}>
        {dateGroups.map((group) => (
          <DateGroupSection
            key={group.date}
            group={group}
            columns={columns}
            gap={gap}
            thumbnailSize={thumbnailSize}
            selectedIds={selectedIds}
            isActive={activeGroupDates.has(group.date)}
            onRegisterElement={registerGroupElement}
            onPhotoClick={onPhotoClick}
            onPhotoDoubleClick={onPhotoDoubleClick}
            onPhotoContextMenu={onPhotoContextMenu}
            onPhotoSelect={onPhotoSelect}
          />
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
                className="animate-pulse rounded-lg bg-element"
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
export type { PhotoGridProps };
