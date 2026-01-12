import { memo, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { MouseEvent } from 'react';
import clsx from 'clsx';
import type { Photo, AspectRatioCategory } from '@/types';
import { useThumbnailProgressive } from '@/hooks';
import { Icon } from '@/components/common/Icon';

interface PhotoThumbnailProps {
  /** 照片数据 */
  photo: Photo;
  /** 宽高比分类 */
  aspectCategory?: AspectRatioCategory;
  /** 是否选中 */
  selected?: boolean;
  /** æ˜¯å¦å¯ç”¨ç¼©ç•¥å›¾åŠ è½½ï¼ˆå¯ç”¨äºŽ Scroll-Activated åŠ è½½ç­‰æƒ…å†µï¼‰ */
  thumbnailsEnabled?: boolean;
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
  if (tauriWindow.__TAURI__) {
    return true;
  }

  const internals = tauriWindow.__TAURI_INTERNALS__ as { invoke?: unknown } | undefined;
  return typeof internals?.invoke === 'function';
};

/** 最大重试次数 */
const MAX_RETRY_COUNT = 2;
/** 重试延迟（毫秒） */
const RETRY_DELAY_MS = 300;

const PhotoThumbnail = memo(function PhotoThumbnail({
  photo,
  aspectCategory = 'normal',
  selected = false,
  thumbnailsEnabled = true,
  isScrolling = false,
  onClick,
  onDoubleClick,
  onContextMenu,
  onSelect,
}: PhotoThumbnailProps) {
  const [tinyLoaded, setTinyLoaded] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);
  const [localError, setLocalError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tinyImgRef = useRef<HTMLImageElement | null>(null);
  const fullImgRef = useRef<HTMLImageElement | null>(null);
  const isTauriRuntime = useMemo(() => detectTauriRuntime(), []);
  const thumbnailsActive = isTauriRuntime && thumbnailsEnabled;
  const targetThumbnailSize = useMemo(() => {
    // 列表/网格页优先保证流畅性，避免触发后端更重的 large 路径
    return 'small' as const;
  }, []);

  // 使用渐进式加载：先加载 tiny 模糊占位图，再加载完整缩略图
  const { tinyUrl, fullUrl, isLoadingFull, showTiny, error: thumbnailError, reload } = useThumbnailProgressive(
    photo.filePath,
    photo.fileHash,
    {
      size: targetThumbnailSize,
      // 始终启用，但滚动时暂停新请求（保留已缓存结果）
      enabled: thumbnailsActive,
      suspendNewRequests: isScrolling,
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
    setRetryCount(0);
    // 清理重试定时器
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [tinyUrl, fullUrl, photo.photoId]);

  // Cache-hit fallback: sometimes `onLoad` might not fire for already-cached images; ensure state is updated.
  useEffect(() => {
    if (!thumbnailsActive) return;

    if (tinyUrl && tinyImgRef.current?.complete && tinyImgRef.current.naturalWidth > 0) {
      setTinyLoaded(true);
    }

    if (fullImageUrl && fullImgRef.current?.complete && fullImgRef.current.naturalWidth > 0) {
      setFullLoaded(true);
      setLocalError(false);
      setRetryCount(0);
    }
  }, [thumbnailsActive, tinyUrl, fullImageUrl]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

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
    setRetryCount(0); // 加载成功，重置重试计数
  }, []);

  // ✅ 关键修复：onError 兜底重试逻辑
  // 当图片加载失败时（可能是切页瞬间 asset 读不到），延迟后重试
  const handleError = useCallback(() => {
    if (retryCount < MAX_RETRY_COUNT) {
      // 还有重试机会，延迟后触发 reload
      setRetryCount(prev => prev + 1);
      retryTimerRef.current = setTimeout(() => {
        reload();
      }, RETRY_DELAY_MS);
    } else {
      // 重试次数用尽，显示错误状态
      setFullLoaded(true);
      setLocalError(true);
    }
  }, [retryCount, reload]);

  const hasError = isTauriRuntime ? Boolean(thumbnailError) || localError : localError;
  const isLoading = thumbnailsActive
    ? !hasError &&
    !showTiny &&
    (isLoadingFull ||
      (!fullUrl && !thumbnailError && !tinyUrl) ||
      (Boolean(fullImageUrl) && !fullLoaded))
    : false;

  return (
    <div
      className={clsx(
        'group relative cursor-pointer overflow-hidden rounded-xl bg-surface box-border',
        'border border-border', // 清晰的边框
        'transition-all duration-200 ease-out', // 快速响应
        !selected && 'hover:border-primary/50 hover:shadow-sm', // 悬停加深边框
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background border-transparent' // 选中态：品牌色强边框
      )}
      style={{ width: '100%', height: '100%' }}
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
          ref={tinyImgRef}
          src={tinyUrl}
          alt=""
          className={clsx(
            'absolute inset-0 h-full w-full transition-opacity duration-500',
            aspectCategory === 'normal' ? 'object-cover' : 'object-contain',
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
          ref={fullImgRef}
          src={fullImageUrl}
          alt={photo.fileName}
          className={clsx(
            'block h-full w-full transition-all duration-500',
            aspectCategory === 'normal' ? 'object-cover' : 'object-contain',
            fullLoaded ? 'opacity-100' : 'opacity-0'
            // !selected && 'group-hover:opacity-90' // 悬停轻微变暗
          )}
          onLoad={handleFullLoad}
          onError={handleError}
          decoding="async"
        />
      )}
      {hasError && (
        <div className="flex h-full w-full flex-col items-center justify-center bg-element text-tertiary">
          <Icon name="broken_image" className="text-3xl mb-1 opacity-50" />
          <span className="text-[10px] font-medium opacity-70">无法加载</span>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-element" />
      )}

      {/* 选中遮罩层 - 仅在选中时显示轻微遮罩 */}
      <div
        className={clsx(
          'absolute inset-0 transition-opacity duration-200 pointer-events-none',
          selected ? 'bg-primary/5' : 'bg-transparent'
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
              ? 'bg-primary text-white shadow-md'
              : 'bg-surface/90 border border-border hover:border-primary text-transparent hover:text-primary/30'
          )}
        >
          {selected ? (
            <Icon name="check" size={14} className="font-bold" />
          ) : (
            <Icon name="check" size={14} />
          )}
        </div>
      </div>

      {/* 底部信息面板 - 参考高级卡片设计 */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2.5 pt-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {/* 文件名 */}
        <p className="truncate text-xs font-medium text-white drop-shadow-sm leading-tight">
          {photo.fileName}
        </p>
        {/* 元数据行：日期 + 大小 */}
        <p className="mt-0.5 truncate text-[10px] text-white/70 leading-tight">
          {photo.dateTaken
            ? new Date(photo.dateTaken).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
            : new Date(photo.dateAdded).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })}
          {' · '}
          {photo.fileSize < 1024 * 1024
            ? `${(photo.fileSize / 1024).toFixed(0)} KB`
            : `${(photo.fileSize / 1024 / 1024).toFixed(1)} MB`}
          {photo.width && photo.height && ` · ${photo.width}×${photo.height}`}
        </p>
      </div>

      {/* 收藏图标 */}
      {photo.isFavorite && (
        <div className="absolute top-2 right-2 z-10">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 backdrop-blur-md shadow-sm">
            <Icon name="favorite" size={14} className="text-white fill-current drop-shadow-md" filled />
          </div>
        </div>
      )}
    </div>
  );
});

export default PhotoThumbnail;
