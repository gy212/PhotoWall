import { memo, useState, useCallback, useEffect, useMemo } from 'react';
import type { MouseEvent } from 'react';
import clsx from 'clsx';
import { getAssetUrl } from '@/services/api';
import type { Photo } from '@/types';
import { useThumbnail } from '@/hooks';
import type { ThumbnailSize } from '@/hooks';

interface PhotoThumbnailProps {
  /** 照片数据 */
  photo: Photo;
  /** 缩略图大小 */
  size?: number;
  /** 是否选中 */
  selected?: boolean;
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
  const tauriWindow = window as Window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  return Boolean(tauriWindow.__TAURI__ ?? tauriWindow.__TAURI_INTERNALS__);
};

/**
 * 根据显示尺寸和设备像素比计算最优缩略图尺寸
 * 适配高分辨率屏幕（如 Retina 显示器）
 */
const resolveThumbnailSize = (pixelSize: number): ThumbnailSize => {
  // 获取设备像素比，高分辨率屏幕需要更大的缩略图
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1;
  // 实际需要的像素尺寸 = 显示尺寸 × 设备像素比
  const actualPixelSize = pixelSize * dpr;
  
  // 后端缩略图尺寸: small=300, medium=500, large=800
  // 降低阈值以确保有足够的清晰度余量，避免边界情况导致模糊
  if (actualPixelSize <= 200) return 'small';
  if (actualPixelSize <= 400) return 'medium';
  return 'large';
};

const PhotoThumbnail = memo(function PhotoThumbnail({
  photo,
  size = 200,
  selected = false,
  onClick,
  onDoubleClick,
  onContextMenu,
  onSelect,
}: PhotoThumbnailProps) {
  const [loaded, setLoaded] = useState(false);
  const [localError, setLocalError] = useState(false);
  const isTauriRuntime = useMemo(() => detectTauriRuntime(), []);
  const targetThumbnailSize = useMemo(() => {
    // 列表/网格页优先保证流畅性，避免触发后端更重的 large 路径
    const resolved = resolveThumbnailSize(size);
    return resolved === 'large' ? 'medium' : resolved;
  }, [size]);
  const { thumbnailUrl, isLoading: thumbnailLoading, error: thumbnailError } = useThumbnail(
    photo.filePath,
    photo.fileHash,
    {
      size: targetThumbnailSize,
      enabled: isTauriRuntime,
      // 滚动时防抖：快速划过的条目通常会在延迟内卸载，从而避免发起后端生成请求
      loadDelay: 120,
    }
  );

  const fallbackAssetUrl = useMemo(() => {
    if (!isTauriRuntime) return null;
    try {
      return getAssetUrl(photo.filePath);
    } catch {
      return null;
    }
  }, [photo.filePath, isTauriRuntime]);

  const imageUrl = isTauriRuntime ? (thumbnailUrl ?? fallbackAssetUrl) : fallbackAssetUrl;

  useEffect(() => {
    setLoaded(false);
    setLocalError(false);
  }, [imageUrl, photo.photoId]);

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

  const handleLoad = useCallback(() => {
    setLoaded(true);
    setLocalError(false);
  }, []);

  const handleError = useCallback(() => {
    setLoaded(true);
    setLocalError(true);
  }, []);

  const hasError = isTauriRuntime ? Boolean(thumbnailError) || localError : localError;
  const isLoading = isTauriRuntime
    ? thumbnailLoading || (!thumbnailUrl && !thumbnailError) || (!loaded && !hasError && Boolean(imageUrl))
    : !loaded && !hasError && Boolean(imageUrl);

  return (
    <div
      className={clsx(
        'group relative cursor-pointer overflow-hidden rounded-2xl bg-[#ecf0f3]',
        'transition-all duration-300 ease-in-out',
        selected
          ? 'ring-[6px] ring-[#3b82f6] ring-offset-2 ring-offset-white scale-[1.03] shadow-2xl shadow-blue-500/30'
          : 'hover:scale-[1.02] hover:shadow-xl'
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
      {!hasError && imageUrl && (
        <img
          src={imageUrl}
          alt={photo.fileName}
          className={clsx(
            'h-full w-full object-cover transition-transform duration-500 will-change-transform rounded-2xl',
            loaded ? 'opacity-100' : 'opacity-0',
            'group-hover:scale-110'
          )}
          onLoad={handleLoad}
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
          'absolute top-3 left-3 z-10 transition-all duration-200',
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
