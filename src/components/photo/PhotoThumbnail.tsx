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
        'group relative cursor-pointer overflow-hidden rounded-xl bg-white dark:bg-zinc-900 box-border',
        'border border-zinc-200 dark:border-zinc-800', // 清晰的边框
        'transition-all duration-200 ease-out', // 快速响应
        !selected && 'hover:border-zinc-400 dark:hover:border-zinc-500 hover:shadow-sm', // 悬停加深边框
        selected && 'ring-2 ring-zinc-900 dark:ring-zinc-100 ring-offset-2 ring-offset-white dark:ring-offset-black border-transparent' // 选中态：黑色强边框
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
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
            'blur-md scale-105', // 模糊并略微放大以隐藏像素化
            tinyLoaded ? 'opacity-100' : 'opacity-0'
          )}
          onLoad={handleTinyLoad}
          decoding="async"
        />
      )}
      {/* 完整缩略图 - 内缩 1px 以防遮挡边框 (可选，这里保持充满) */}
      {!hasError && fullImageUrl && (
        <img
          src={fullImageUrl}
          alt={photo.fileName}
          className={clsx(
            'block h-full w-full object-cover transition-all duration-500',
            fullLoaded ? 'opacity-100' : 'opacity-0'
            // !selected && 'group-hover:opacity-90' // 悬停轻微变暗
          )}
          onLoad={handleFullLoad}
          onError={handleError}
          decoding="async"
        />
      )}
      {hasError && (
        <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900 text-zinc-300">
          <span className="material-symbols-outlined text-3xl mb-1 opacity-50">broken_image</span>
          <span className="text-[10px] font-medium opacity-70">无法加载</span>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-zinc-100 dark:bg-zinc-800" />
      )}

      {/* 选中遮罩层 - 仅在选中时显示轻微遮罩 */}
      <div
        className={clsx(
          'absolute inset-0 transition-opacity duration-200 pointer-events-none',
          selected ? 'bg-black/10 dark:bg-white/10' : 'bg-transparent'
        )}
      />

      {/* 选择框 - Nucleo 风格 */}
      <div
        className={clsx(
          'absolute top-2 left-2 z-10 transition-all duration-200',
          selected 
            ? 'opacity-100 scale-100' 
            : 'opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100'
        )}
        onClick={handleSelectToggle}
      >
        <div
          className={clsx(
            'flex h-5 w-5 items-center justify-center rounded-full transition-all shadow-sm',
            selected 
              ? 'bg-zinc-900 text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900' 
              : 'bg-white/90 border border-zinc-200 hover:border-zinc-400 text-transparent hover:text-zinc-300'
          )}
        >
          {selected ? (
            <span className="material-symbols-outlined text-[14px] font-bold">check</span>
          ) : (
             <span className="material-symbols-outlined text-[14px]">check</span>
          )}
        </div>
      </div>

      {/* 文件名遮罩 - 优化渐变 */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent p-3 pt-6 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <p className="truncate text-[11px] font-medium text-white/90 drop-shadow-sm leading-tight">
          {photo.fileName}
        </p>
      </div>

      {/* 收藏图标 */}
      {photo.isFavorite && (
        <div className="absolute top-2 right-2 z-10">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 backdrop-blur-md shadow-sm">
             <span className="material-symbols-outlined text-[14px] text-white fill-current drop-shadow-md">favorite</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default PhotoThumbnail;
