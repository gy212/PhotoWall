import { memo, useMemo, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { MouseEvent } from 'react';
import { VirtuosoGrid, VirtuosoGridHandle } from 'react-virtuoso';
import PhotoThumbnail from './PhotoThumbnail';
import type { Photo } from '@/types';

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

  // Force recalculation after mount/route change so thumbnails render without manual scroll
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      setTimeout(() => {
        virtuosoRef.current?.scrollTo({ top: 0 });
      }, 50);
    });
    return () => cancelAnimationFrame(rafId);
  }, [photos.length, location.key]);

  // Custom list container style
  const listStyle = useMemo(
    () => ({
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: `${gap}px`,
      padding: `${gap}px`,
    }),
    [gap]
  );

  // 自定义项目容器样式
  const itemStyle = useMemo(
    () => ({
      width: `${thumbnailSize}px`,
      height: `${thumbnailSize}px`,
    }),
    [thumbnailSize]
  );

  // 渲染单个照片
  const itemContent = useCallback(
    (index: number) => {
      const photo = photos[index];
      if (!photo) return null;

      return (
        <PhotoThumbnail
          photo={photo}
          size={thumbnailSize}
          selected={selectedIds.has(photo.photoId)}
          onClick={onPhotoClick}
          onDoubleClick={onPhotoDoubleClick}
          onContextMenu={onPhotoContextMenu}
          onSelect={onPhotoSelect}
        />
      );
    },
    [photos, thumbnailSize, selectedIds, onPhotoClick, onPhotoDoubleClick, onPhotoContextMenu, onPhotoSelect]
  );

  // 加载更多
  const handleEndReached = useCallback(() => {
    if (!loading && hasMore && onLoadMore) {
      onLoadMore();
    }
  }, [loading, hasMore, onLoadMore]);

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
      <VirtuosoGrid
        ref={virtuosoRef}
        key={`grid-${location.key}-${photos.length}-${thumbnailSize}`}
        totalCount={photos.length}
        initialItemCount={Math.min(photos.length, 50)}
        overscan={400}
        listClassName="photo-grid-list"
        itemClassName="photo-grid-item"
        itemContent={itemContent}
        endReached={handleEndReached}
        scrollerRef={(ref) => {
          // 优化滚动性能
          if (ref) {
            (ref as HTMLElement).style.willChange = 'scroll-position';
          }
        }}
        components={{
          List: ({ style, children, ...props }) => (
            <div {...props} style={{ ...style, ...listStyle }}>
              {children}
            </div>
          ),
          Item: ({ style, children, ...props }) => (
            <div {...props} style={{ ...style, ...itemStyle }}>
              {children}
            </div>
          ),
          Footer: () =>
            loading ? (
              <div className="flex w-full items-center justify-center py-4">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
                <span className="ml-2 text-sm text-gray-500">加载中...</span>
              </div>
            ) : null,
        }}
      />
    </div>
  );
});

export default PhotoGrid;
