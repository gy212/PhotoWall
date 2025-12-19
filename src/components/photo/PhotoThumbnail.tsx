import { memo, useState, useCallback, useEffect, useMemo } from 'react';
import type { MouseEvent } from 'react';
import clsx from 'clsx';
import type { Photo } from '@/types';
import { useThumbnailProgressive } from '@/hooks';

interface PhotoThumbnailProps {
  /** 照片数据 */
  photo: Photo;
  /** 缩略图大小 */
  size?: number;
  /** 是否选中 */
  selected?: boolean;
  /** 是否正在滚动（滚动时延迟加载缩略图） */
  isScrolling?: boolean;
  /** 点击事件 */
  onClick?: (photo: Photo, event: MouseEvent) => void;
  /** 双击事件 */
  onDoubleClick?: (photo: Photo) => void;
  /** 右键菜单事件 */
  onContextMenu?: (photo: Photo, event: MouseEvent) => void;
  /** 选择事件 */
  onSelect?: (photo: Photo, selected: boolean) => void;
}

const detectTauriRuntime = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  const tauriWindow = window as typeof window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  return Boolean(tauriWindow.__TAURI__ ?? tauriWindow.__TAURI_INTERNALS__);
};

const PhotoThumbnail = memo(function PhotoThumbnail({
  photo,
  size = 200,
  selected = false,
  isScrolling = false,
  onClick,
  onDoubleClick,
  onContextMenu,
  onSelect,
}: PhotoThumbnailProps) {
  const [tinyLoaded, setTinyLoaded] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);
  const [localError, setLocalError] = useState(false);
  const isTauriRuntime = useMemo(() => detectTauriRuntime(), []);
  const targetThumbnailSize = useMemo(() => {
    // 列表/网格页优先保证流畅性，避免触发后端更重的 large 路径
    return 'small' as const;
  }, []);

  // 使用渐进式加载：先加载 tiny 模糊占位图，再加载完整缩略图
  const { tinyUrl, fullUrl, isLoadingFull, showTiny, error: thumbnailError } = useThumbnailProgressive(
    photo.filePath,
    photo.fileHash,
    {
      size: targetThumbnailSize,
      // 滚动时完全禁用加载，停止滚动后才开始
      enabled: isTauriRuntime && !isScrolling,
      // 滚动时防抖：快速划过的条目通常会在延迟内卸载，从而避免发起后端生成请求
      loadDelay: 80,
    }
  );

  // 完整图片 URL（优先使用缩略图，回退到原图）
  const fullImageUrl = fullUrl;

  useEffect(() => {
    setTinyLoaded(false);
    setFullLoaded(false);
    setLocalError(false);
  }, [tinyUrl, fullUrl, photo.photoId]);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      onClick?.(photo, e);
    },
    [photo, onClick]
  );

  const handleSelectToggle = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onSelect?.(photo, !selected);
    },
    [photo, selected, onSelect]
  );

  const handleDoubleClick = useCallback(() => {
    onDoubleClick?.(photo);
  }, [photo, onDoubleClick]);

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      onContextMenu?.(photo, e);
    },
    [photo, onContextMenu]
  );

  const handleTinyLoad = useCallback(() => {
    setTinyLoaded(true);
  }, []);

  const handleFullLoad = useCallback(() => {
    setFullLoaded(true);
    setLocalError(false);
  }, []);

  const handleError = useCallback(() => {
    setFullLoaded(true);
    setLocalError(true);
  }, []);

  const hasError = isTauriRuntime ? Boolean(thumbnailError) || localError : localError;
  const isLoading = isTauriRuntime
    ? !hasError &&
      !showTiny &&
      (isLoadingFull ||
        (!fullUrl && !thumbnailError && !tinyUrl) ||
        (Boolean(fullImageUrl) && !fullLoaded))
    : false;

  return (
    <div
      className={clsx(
        'group relative cursor-pointer overflow-hidden rounded-2xl bg-[#ecf0f3] box-border',
        selected && 'ring-[4px] ring-[#3b82f6] ring-inset'
      )}
      style={{ width: size, height: size }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      role="button"
      tabIndex={0}
      aria-label={photo.fileName}
      aria-selected={selected}
    >
      {/* 极小模糊占位图（渐进式加载第一阶段） */}
      {!hasError && tinyUrl && showTiny && (
        <img
          src={tinyUrl}
          alt=""
          className={clsx(
            'absolute inset-0 h-full w-full object-cover rounded-2xl transition-opacity duration-200',
            'blur-sm scale-105', // 模糊并略微放大以隐藏像素化
            tinyLoaded ? 'opacity-100' : 'opacity-0'
          )}
          onLoad={handleTinyLoad}
          decoding="async"
        />
      )}
      {/* 完整缩略图 */}
      {!hasError && fullImageUrl && (
        <img
          src={fullImageUrl}
          alt={photo.fileName}
          className={clsx(
            'block h-full w-full object-cover rounded-2xl transition-opacity duration-200',
            fullLoaded ? 'opacity-100' : 'opacity-0'
          )}
          onLoad={handleFullLoad}
          onError={handleError}
          decoding="async"
        />
      )}
      {hasError && (
        <div className="flex h-full w-full flex-col items-center justify-center bg-[#ecf0f3] text-gray-400">
          <svg className="h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs">无法加载</span>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-gray-200" />
      )}

      <div
        className={clsx(
          'absolute top-3 left-3 z-10 transition-[transform,opacity] duration-200',
          selected ? 'opacity-100 scale-100' : 'opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100'
        )}
        onClick={handleSelectToggle}
      >
        <div
          className={clsx(
            'flex h-6 w-6 items-center justify-center rounded-lg transition-colors shadow-md',
            selected ? 'bg-[#3b82f6] text-white' : 'bg-white/80 text-gray-400 hover:bg-white hover:text-[#3b82f6]'
          )}
        >
          {selected && (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2d3748]/80 via-[#2d3748]/40 to-transparent p-3 pt-8 opacity-0 transition-opacity duration-200 group-hover:opacity-100 rounded-b-2xl">
        <p className="truncate text-xs font-bold text-white drop-shadow-sm">
          {photo.fileName}
        </p>
      </div>

      {photo.isFavorite && (
        <div className="absolute top-3 right-3 z-10">
          <svg className="h-5 w-5 text-red-500 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
      )}
    </div>
  );
});

export default PhotoThumbnail;
